/**
 * オーダーステータス判定サービス
 *
 * calculateOrderStatus          純粋な計算のみ（書き込みなし）
 * dryRunOrderStatusRecalculation DEV 専用の差分確認（書き込みなし）
 * applyOrderStatusRecalculation  DEV 専用。差分7件のときのみ書き込む
 * recalculateOrderStatusById     1件のステータスを再計算して書き込む（updateCoreOrderForFrontend 用）
 * scheduledOrderStatusRecalculation  定期実行向け全件再計算（上限20件）
 */

/**
 * 1オーダー分のデータからあるべきステータスを返す。
 * シートへの書き込みは行わない。
 *
 * 判定の優先順位（上から最初に該当したものを返す）:
 *   1. キャンセル  : order.cancellationReason に値がある
 *   2. トラブル   : order.status が TROUBLE と一致（手動設定のため計算では変えない）
 *   3. 完了       : shipments のうち少なくとも1件で pickupRequest と trackingNumber 両方に値がある
 *   4. 発送待ち   : purchases のうち少なくとも1件で status が CONFIRMED と一致
 *   5. 仕入れ中   : order.paymentConfirmedAt に値がある
 *   6. 支払い待ち : order.invoiceNumber に値がある
 *   7. 不明       : 上記すべて非該当
 *
 * @param {{ cancellationReason: *, status: string, paymentConfirmedAt: *, invoiceNumber: * }} order
 * @param {Array<{ pickupRequest: *, trackingNumber: * }>} shipments
 * @param {Array<{ status: * }>} purchases
 * @returns {string} Core Schema V1 ORDERS.STATUS の値
 */
function calculateOrderStatus(order, shipments, purchases) {
  var troubleValue          = getCoreSchemaV1Value('ORDERS',    'STATUS', 'TROUBLE');
  var completedValue        = getCoreSchemaV1Value('ORDERS',    'STATUS', 'COMPLETED');
  var awaitingShippingValue = getCoreSchemaV1Value('ORDERS',    'STATUS', 'AWAITING_SHIPPING');
  var sourcingValue         = getCoreSchemaV1Value('ORDERS',    'STATUS', 'SOURCING');
  var awaitingPaymentValue  = getCoreSchemaV1Value('ORDERS',    'STATUS', 'AWAITING_PAYMENT');
  var cancelledValue        = getCoreSchemaV1Value('ORDERS',    'STATUS', 'CANCELLED');
  var unknownValue          = getCoreSchemaV1Value('ORDERS',    'STATUS', 'UNKNOWN');
  var purchaseConfirmedValue = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'CONFIRMED');

  // 1. キャンセル
  if (!isOrderStatusEmptyValue_(order.cancellationReason)) {
    return cancelledValue;
  }

  // 2. トラブル（手動設定のため計算では変えない）
  if (order.status === troubleValue) {
    return troubleValue;
  }

  // 3. 完了: 発送行のうち少なくとも1件で集荷依頼 AND 運送状番号の両方に値がある
  var isCompleted = (shipments || []).some(function(s) {
    return !isOrderStatusEmptyValue_(s.pickupRequest) && !isOrderStatusEmptyValue_(s.trackingNumber);
  });
  if (isCompleted) {
    return completedValue;
  }

  // 4. 発送待ち: 仕入れ行のうち少なくとも1件でステータスが CONFIRMED
  var hasPurchaseConfirmed = (purchases || []).some(function(p) {
    return p.status === purchaseConfirmedValue;
  });
  if (hasPurchaseConfirmed) {
    return awaitingShippingValue;
  }

  // 5. 仕入れ中: 支払確認日に値がある
  if (!isOrderStatusEmptyValue_(order.paymentConfirmedAt)) {
    return sourcingValue;
  }

  // 6. 支払い待ち: 請求書番号に値がある
  if (!isOrderStatusEmptyValue_(order.invoiceNumber)) {
    return awaitingPaymentValue;
  }

  // 7. 不明
  return unknownValue;
}

/**
 * 全オーダーについて現在の値と計算結果を比較し、件数のみを報告する。
 * 書き込みは一切しない。DEV 専用。
 *
 * 報告内容:
 *   総件数 / 変更なし件数 / 変更あり件数 / 変更内訳（旧値→新値ごとの件数）
 * オーダーIDや顧客名などのデータ値は出力しない。
 *
 * @returns {string}
 */
function dryRunOrderStatusRecalculation() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunOrderStatusRecalculation is available only in development');
  }

  var ss = getSpreadsheet();

  var ordersMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
  ]);
  var shipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
    'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
  ]);
  var purchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', [
    'ORDER_ID', 'STATUS'
  ]);

  var shipmentsByOrderId = buildOrderStatusLookup_(shipmentsMeta.rows, 'ORDER_ID');
  var purchasesByOrderId = buildOrderStatusLookup_(purchasesMeta.rows, 'ORDER_ID');

  var totalCount     = 0;
  var unchangedCount = 0;
  var changedCount   = 0;
  var changeSummary  = {};

  ordersMeta.rows.forEach(function(orderRow) {
    var orderId = String(orderRow.ORDER_ID || '').trim();
    if (!orderId) return;
    totalCount++;

    var currentStatus = orderRow.STATUS;

    var relatedShipments = (shipmentsByOrderId[orderId] || []).map(function(s) {
      return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
    });
    var relatedPurchases = (purchasesByOrderId[orderId] || []).map(function(p) {
      return { status: p.STATUS };
    });

    var newStatus = calculateOrderStatus(
      {
        cancellationReason: orderRow.CANCELLATION_REASON,
        status:             orderRow.STATUS,
        paymentConfirmedAt: orderRow.PAYMENT_CONFIRMED_AT,
        invoiceNumber:      orderRow.INVOICE_NUMBER
      },
      relatedShipments,
      relatedPurchases
    );

    if (newStatus === currentStatus) {
      unchangedCount++;
    } else {
      changedCount++;
      var key = '"' + currentStatus + '" → "' + newStatus + '"';
      changeSummary[key] = (changeSummary[key] || 0) + 1;
    }
  });

  var out = [
    '=== dryRunOrderStatusRecalculation ===',
    '総件数: ' + totalCount + '件',
    '変更なし: ' + unchangedCount + '件',
    '変更あり: ' + changedCount + '件'
  ];

  if (changedCount > 0) {
    out.push('');
    out.push('[変更内訳]');
    Object.keys(changeSummary).sort().forEach(function(k) {
      out.push('  ' + k + ': ' + changeSummary[k] + '件');
    });
  }

  out.push('');
  out.push('--- DRY RUN 完了（書き込みなし）---');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * PAID（支払済み）を発送待ち条件にした場合の影響を、書き込みなしで試算する。
 * 本体の calculateOrderStatus() は変更しない。
 *
 * @returns {{purchaseStatusCounts: Object<string, number>, statusTransitionCounts: Object<string, number>}}
 */
function dryRunOrderStatusWithPurchasePaid() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunOrderStatusWithPurchasePaid is available only in development');
  }

  var ss = getSpreadsheet();
  var ordersMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
  ]);
  var shipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
    'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
  ]);
  var purchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', ['ORDER_ID', 'STATUS']);
  var shipmentsByOrderId = buildOrderStatusLookup_(shipmentsMeta.rows, 'ORDER_ID');
  var purchasesByOrderId = buildOrderStatusLookup_(purchasesMeta.rows, 'ORDER_ID');
  var purchaseStatusCounts = {};
  var statusTransitionCounts = {};

  purchasesMeta.rows.forEach(function(purchaseRow) {
    var status = isOrderStatusEmptyValue_(purchaseRow.STATUS) ? '（空欄）' : String(purchaseRow.STATUS);
    purchaseStatusCounts[status] = (purchaseStatusCounts[status] || 0) + 1;
  });

  ordersMeta.rows.forEach(function(orderRow) {
    var orderId = String(orderRow.ORDER_ID || '').trim();
    if (!orderId) return;
    var shipments = (shipmentsByOrderId[orderId] || []).map(function(shipment) {
      return { pickupRequest: shipment.PICKUP_REQUEST, trackingNumber: shipment.TRACKING_NUMBER };
    });
    var purchases = (purchasesByOrderId[orderId] || []).map(function(purchase) {
      return { status: purchase.STATUS };
    });
    var calculatedStatus = calculateOrderStatusWithPurchasePaid_(
      {
        cancellationReason: orderRow.CANCELLATION_REASON,
        status: orderRow.STATUS,
        paymentConfirmedAt: orderRow.PAYMENT_CONFIRMED_AT,
        invoiceNumber: orderRow.INVOICE_NUMBER
      },
      shipments,
      purchases
    );
    var transition = String(orderRow.STATUS || '（空欄）') + ' → ' + calculatedStatus;
    statusTransitionCounts[transition] = (statusTransitionCounts[transition] || 0) + 1;
  });

  return {
    purchaseStatusCounts: purchaseStatusCounts,
    statusTransitionCounts: statusTransitionCounts
  };
}

function calculateOrderStatusWithPurchasePaid_(order, shipments, purchases) {
  var troubleValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'TROUBLE');
  var completedValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'COMPLETED');
  var awaitingShippingValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_SHIPPING');
  var sourcingValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'SOURCING');
  var awaitingPaymentValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');
  var cancelledValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'CANCELLED');
  var unknownValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'UNKNOWN');
  var purchasePaidValue = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'PAID');

  if (!isOrderStatusEmptyValue_(order.cancellationReason)) return cancelledValue;
  if (order.status === troubleValue) return troubleValue;
  if ((shipments || []).some(function(shipment) {
    return !isOrderStatusEmptyValue_(shipment.pickupRequest) && !isOrderStatusEmptyValue_(shipment.trackingNumber);
  })) return completedValue;
  if ((purchases || []).some(function(purchase) { return purchase.status === purchasePaidValue; })) return awaitingShippingValue;
  if (!isOrderStatusEmptyValue_(order.paymentConfirmedAt)) return sourcingValue;
  if (!isOrderStatusEmptyValue_(order.invoiceNumber)) return awaitingPaymentValue;
  return unknownValue;
}

// ─── private helpers ─────────────────────────────────────────────────────────

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey  Core Schema V1 のテーブルキー
 * @param {string[]} fieldKeys  取得したい論理ヘッダーキーの配列
 * @returns {{ rows: Array<Object> }}
 */
function readOrderStatusServiceSheet_(ss, tableKey, fieldKeys) {
  var sheet   = getCoreSchemaV1Sheet(ss, tableKey);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return { rows: [] };

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerToIdx = {};
  rawHeaders.forEach(function(h, i) {
    var key = String(h).trim();
    if (key) headerToIdx[key] = i;
  });

  var fieldIdxMap = {};
  fieldKeys.forEach(function(fieldKey) {
    var physicalName = getCoreSchemaV1HeaderName(tableKey, fieldKey);
    if (headerToIdx[physicalName] !== undefined) {
      fieldIdxMap[fieldKey] = headerToIdx[physicalName];
    }
  });

  var dataRowCount = lastRow - 1;
  var data = sheet.getRange(2, 1, dataRowCount, lastCol).getValues();

  var rows = data.map(function(row) {
    var obj = {};
    fieldKeys.forEach(function(fieldKey) {
      var idx = fieldIdxMap[fieldKey];
      obj[fieldKey] = (idx !== undefined) ? row[idx] : '';
    });
    return obj;
  });

  return { rows: rows };
}

/**
 * rows 配列を keyField の値でグループ化した辞書を返す。
 * @param {Array<Object>} rows
 * @param {string} keyField
 * @returns {Object}
 */
function buildOrderStatusLookup_(rows, keyField) {
  var lookup = {};
  rows.forEach(function(row) {
    var key = String(row[keyField] || '').trim();
    if (!key) return;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(row);
  });
  return lookup;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isOrderStatusEmptyValue_(value) {
  return value === null || value === undefined || value === '';
}

/**
 * 全オーダーのステータスを新体系で再計算し、差分を書き込む。
 * DEV 環境専用。差分が 7 件でなければ中断する。
 *
 * @returns {{ applied: number, verifyPassed: boolean }}
 */
function applyOrderStatusRecalculation() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyOrderStatusRecalculation は DEV 環境のみ実行できます');
  }

  var ss = getSpreadsheet();

  var ordersMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
  ]);
  var shipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
    'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
  ]);
  var purchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', [
    'ORDER_ID', 'STATUS'
  ]);

  var shipmentsByOrderId = buildOrderStatusLookup_(shipmentsMeta.rows, 'ORDER_ID');
  var purchasesByOrderId = buildOrderStatusLookup_(purchasesMeta.rows, 'ORDER_ID');

  var diffs = [];
  ordersMeta.rows.forEach(function(orderRow, i) {
    var orderId = String(orderRow.ORDER_ID || '').trim();
    if (!orderId) return;

    var relatedShipments = (shipmentsByOrderId[orderId] || []).map(function(s) {
      return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
    });
    var relatedPurchases = (purchasesByOrderId[orderId] || []).map(function(p) {
      return { status: p.STATUS };
    });

    var newStatus = calculateOrderStatus(
      {
        cancellationReason: orderRow.CANCELLATION_REASON,
        status:             orderRow.STATUS,
        paymentConfirmedAt: orderRow.PAYMENT_CONFIRMED_AT,
        invoiceNumber:      orderRow.INVOICE_NUMBER
      },
      relatedShipments,
      relatedPurchases
    );

    if (newStatus !== orderRow.STATUS) {
      diffs.push({ rowIndex: i, orderId: orderId, newStatus: newStatus });
    }
  });

  if (diffs.length !== 7) {
    throw new Error(
      'applyOrderStatusRecalculation: 差分件数が想定と異なるため中断します。' +
      '想定=7件、実際=' + diffs.length + '件'
    );
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var writeTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
    var statusPhysicalName = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
    var statusColIndex = writeTarget.headerIndexes[statusPhysicalName]; // 1-indexed

    if (!statusColIndex) {
      throw new Error('STATUS 列が見つかりません');
    }

    diffs.forEach(function(diff) {
      var sheetRow = diff.rowIndex + 2; // rows[i] → 行 i+2（ヘッダー行=1）
      writeTarget.sheet.getRange(sheetRow, statusColIndex).setValue(diff.newStatus);
    });

    // 書き込み後の検証
    var verifyMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
      'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
    ]);
    var verifyShipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
      'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
    ]);
    var verifyPurchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', [
      'ORDER_ID', 'STATUS'
    ]);
    var verifyShipmentsByOrderId = buildOrderStatusLookup_(verifyShipmentsMeta.rows, 'ORDER_ID');
    var verifyPurchasesByOrderId = buildOrderStatusLookup_(verifyPurchasesMeta.rows, 'ORDER_ID');

    var verifyFailedCount = 0;
    verifyMeta.rows.forEach(function(orderRow) {
      var orderId = String(orderRow.ORDER_ID || '').trim();
      if (!orderId) return;

      var relatedShipments = (verifyShipmentsByOrderId[orderId] || []).map(function(s) {
        return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
      });
      var relatedPurchases = (verifyPurchasesByOrderId[orderId] || []).map(function(p) {
        return { status: p.STATUS };
      });

      var expectedStatus = calculateOrderStatus(
        {
          cancellationReason: orderRow.CANCELLATION_REASON,
          status:             orderRow.STATUS,
          paymentConfirmedAt: orderRow.PAYMENT_CONFIRMED_AT,
          invoiceNumber:      orderRow.INVOICE_NUMBER
        },
        relatedShipments,
        relatedPurchases
      );

      if (expectedStatus !== orderRow.STATUS) {
        verifyFailedCount++;
      }
    });

    var verifyPassed = (verifyFailedCount === 0);
    Logger.log('applyOrderStatusRecalculation: applied=' + diffs.length + ', verifyPassed=' + verifyPassed);

    return { applied: diffs.length, verifyPassed: verifyPassed };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1件のオーダーのステータスを再計算して書き込む。
 * updateCoreOrderForFrontend から呼び出すことを想定。
 *
 * @param {string} orderId
 * @returns {string} 書き込んだ新ステータス（変更なしの場合は現在値をそのまま返す）
 */
function recalculateOrderStatusById(orderId) {
  if (!orderId) {
    throw new Error('recalculateOrderStatusById: orderId は必須です');
  }

  var ss = getSpreadsheet();

  var ordersMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
  ]);
  var shipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
    'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
  ]);
  var purchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', [
    'ORDER_ID', 'STATUS'
  ]);

  var shipmentsByOrderId = buildOrderStatusLookup_(shipmentsMeta.rows, 'ORDER_ID');
  var purchasesByOrderId = buildOrderStatusLookup_(purchasesMeta.rows, 'ORDER_ID');

  var targetIndex = -1;
  var targetRow   = null;
  ordersMeta.rows.forEach(function(row, i) {
    if (String(row.ORDER_ID || '').trim() === String(orderId).trim()) {
      targetIndex = i;
      targetRow   = row;
    }
  });

  if (targetRow === null) {
    throw new Error('recalculateOrderStatusById: ORDER_ID が見つかりません: ' + orderId);
  }

  var relatedShipments = (shipmentsByOrderId[String(orderId).trim()] || []).map(function(s) {
    return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
  });
  var relatedPurchases = (purchasesByOrderId[String(orderId).trim()] || []).map(function(p) {
    return { status: p.STATUS };
  });

  var newStatus = calculateOrderStatus(
    {
      cancellationReason: targetRow.CANCELLATION_REASON,
      status:             targetRow.STATUS,
      paymentConfirmedAt: targetRow.PAYMENT_CONFIRMED_AT,
      invoiceNumber:      targetRow.INVOICE_NUMBER
    },
    relatedShipments,
    relatedPurchases
  );

  if (newStatus === targetRow.STATUS) {
    return targetRow.STATUS;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var writeTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
    var statusPhysicalName = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
    var statusColIndex = writeTarget.headerIndexes[statusPhysicalName];

    if (!statusColIndex) {
      throw new Error('STATUS 列が見つかりません');
    }

    var sheetRow = targetIndex + 2;
    writeTarget.sheet.getRange(sheetRow, statusColIndex).setValue(newStatus);

    return newStatus;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 定期実行向け全件ステータス再計算。
 * 差分が 20 件を超える場合は異常と判断して中断する。
 * LockService で二重実行を防ぐ（tryLock: 競合時は即時中断）。
 *
 * @returns {{ checked: number, changed: number, skipped: boolean }}
 */
function scheduledOrderStatusRecalculation() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('scheduledOrderStatusRecalculation: 別プロセスが実行中のためスキップ');
    return { checked: 0, changed: 0, skipped: true };
  }

  try {
    var ss = getSpreadsheet();

    var ordersMeta = readOrderStatusServiceSheet_(ss, 'ORDERS', [
      'ORDER_ID', 'STATUS', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'INVOICE_NUMBER'
    ]);
    var shipmentsMeta = readOrderStatusServiceSheet_(ss, 'SHIPMENTS', [
      'ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER'
    ]);
    var purchasesMeta = readOrderStatusServiceSheet_(ss, 'PURCHASES', [
      'ORDER_ID', 'STATUS'
    ]);

    var shipmentsByOrderId = buildOrderStatusLookup_(shipmentsMeta.rows, 'ORDER_ID');
    var purchasesByOrderId = buildOrderStatusLookup_(purchasesMeta.rows, 'ORDER_ID');

    var checkedCount = 0;
    var diffs        = [];

    ordersMeta.rows.forEach(function(orderRow, i) {
      var orderId = String(orderRow.ORDER_ID || '').trim();
      if (!orderId) return;
      checkedCount++;

      var relatedShipments = (shipmentsByOrderId[orderId] || []).map(function(s) {
        return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
      });
      var relatedPurchases = (purchasesByOrderId[orderId] || []).map(function(p) {
        return { status: p.STATUS };
      });

      var newStatus = calculateOrderStatus(
        {
          cancellationReason: orderRow.CANCELLATION_REASON,
          status:             orderRow.STATUS,
          paymentConfirmedAt: orderRow.PAYMENT_CONFIRMED_AT,
          invoiceNumber:      orderRow.INVOICE_NUMBER
        },
        relatedShipments,
        relatedPurchases
      );

      if (newStatus !== orderRow.STATUS) {
        diffs.push({ rowIndex: i, orderId: orderId, newStatus: newStatus });
      }
    });

    if (diffs.length > 20) {
      Logger.log(
        'scheduledOrderStatusRecalculation: 差分が上限を超えたため中断 (' + diffs.length + '件)。' +
        '手動での確認が必要です（dryRunOrderStatusRecalculation を実行してください）。'
      );
      return { checked: checkedCount, changed: 0, skipped: false };
    }

    if (diffs.length === 0) {
      Logger.log('scheduledOrderStatusRecalculation: 差分なし (' + checkedCount + '件チェック)');
      return { checked: checkedCount, changed: 0, skipped: false };
    }

    var writeTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
    var statusPhysicalName = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
    var statusColIndex = writeTarget.headerIndexes[statusPhysicalName];

    if (!statusColIndex) {
      throw new Error('STATUS 列が見つかりません');
    }

    diffs.forEach(function(diff) {
      var sheetRow = diff.rowIndex + 2;
      writeTarget.sheet.getRange(sheetRow, statusColIndex).setValue(diff.newStatus);
    });

    Logger.log(
      'scheduledOrderStatusRecalculation: 完了 (チェック=' + checkedCount + '件, 更新=' + diffs.length + '件)'
    );

    return { checked: checkedCount, changed: diffs.length, skipped: false };
  } finally {
    lock.releaseLock();
  }
}

/**
 * scheduledOrderStatusRecalculation の時間トリガーを登録する。
 * 同名関数のトリガーが既に存在する場合は削除してから1件だけ登録する。
 * 他の関数のトリガーには一切触れない。
 *
 * @returns {Array<{ handlerFunction: string, eventType: string, uniqueId: string }>}
 */
function setupOrderStatusRecalculationTrigger() {
  var targetFn = 'scheduledOrderStatusRecalculation';

  // 同名トリガーのみ削除（他には触れない）
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === targetFn) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎日 4:00〜5:00 に実行
  ScriptApp.newTrigger(targetFn)
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .create();

  // 登録後のトリガー一覧を返す
  return ScriptApp.getProjectTriggers().map(function(t) {
    return {
      handlerFunction: t.getHandlerFunction(),
      eventType:       String(t.getEventType()),
      uniqueId:        t.getUniqueId()
    };
  });
}
