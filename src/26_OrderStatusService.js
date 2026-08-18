/**
 * オーダーステータス判定サービス
 *
 * シートへの書き込みは一切しない。
 * calculateOrderStatus は純粋な計算のみ。
 * dryRunOrderStatusRecalculation は DEV 専用の差分確認（書き込みなし）。
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
