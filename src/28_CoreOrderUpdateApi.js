/**
 * オーダー更新 API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   updateCoreOrderForFrontend(sessionId, orderId, orderData)
 * 権限キー:
 *   書き込み: deal_edit
 */

/* global getCoreSchemaV1HeaderName, getCoreSchemaV1Value, getCoreSchemaV1Sheet, withSheetWrite_,
   validateCoreSchemaV1TableForWrite, setEmailFromSession, checkPermission,
   validateQuoteLineInventory_, calculateOrderStatus, calculatePaymentStatus,
   getSpreadsheet, LockService,
   CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX,
   CORE_ORDER_WRITE_LINE_ID_PREFIX, CORE_ORDER_WRITE_ID_DIGITS,
   coreOrderWriteValue, coreOrderWriteNormalizeNumeric, coreOrderWriteGetNextLineMaxNum */

/** 金額系フィールドのキー一覧 */
var CORE_ORDER_UPDATE_AMOUNT_FIELDS = ['lines', 'shippingFee', 'duty', 'otherFee', 'discount'];

var CORE_ORDER_UPDATE_CACHE_TARGETS = [
  { indexKey: CORE_ORDERS_CACHE_INDEX, prefix: CORE_ORDERS_CACHE_PREFIX }
];

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 既存オーダーを更新する。
 *
 * 請求書発行済み（INVOICE_ISSUED_AT に値がある）場合は金額系フィールドの変更を禁止する。
 * 金額系: lines / shippingFee / duty / otherFee / discount
 *
 * @param {string} sessionId
 * @param {string} orderId
 * @param {{
 *   shippingFee?: string,
 *   duty?: string,
 *   otherFee?: string,
 *   discount?: string,
 *   lines?: Array<{
 *     productId: string,
 *     productName: string,
 *     category: string,
 *     status: string,
 *     quantity: string,
 *     unitPrice: string
 *   }>,
 *   paymentConfirmedAt?: string,
 *   shippedAt?: string,
 *   trackingNumber?: string,
 *   shippingMethod?: string,
 *   note?: string,
 *   shippingNote?: string,
 *   transactionNote?: string,
 *   internalNote?: string,
 *   cancellationReason?: string,
 *   cancellationNote?: string,
 * }} orderData
 * @returns {{ success: true, orderId: string }}
 */
function updateCoreOrderForFrontend(sessionId, orderId, orderData) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!orderId) throw new Error('MISSING_ORDER_ID');
  if (!orderData || typeof orderData !== 'object') throw new Error('MISSING_ORDER_DATA');

  var ss = getSpreadsheet();

  // 既存オーダーを取得する
  var existing = coreOrderUpdateGetExistingOrder_(ss, orderId);
  if (!existing) throw new Error('ORDER_NOT_FOUND:' + orderId);

  // 既存の請求書発行日を確認
  var invoiceIssuedAt = existing.INVOICE_ISSUED_AT;
  var isInvoiceIssued = invoiceIssuedAt !== '' && invoiceIssuedAt !== null && invoiceIssuedAt !== undefined;

  // 発行後の金額系フィールドを禁止する
  if (isInvoiceIssued) {
    var hasAmountField = CORE_ORDER_UPDATE_AMOUNT_FIELDS.some(function(key) {
      return orderData[key] !== undefined && orderData[key] !== null;
    });
    if (hasAmountField) {
      throw new Error('ORDER_AMOUNT_LOCKED');
    }
  }

  // 既存の為替レートを取得（再取得しない）
  var existingExchangeRate = Number(existing.EXCHANGE_RATE) || 1;

  // 在庫バリデーション（金額系フィールドがある場合のみ）
  var lines = orderData.lines;
  var hasLines = Array.isArray(lines) && lines.length > 0;
  if (hasLines) {
    validateQuoteLineInventory_(lines);
  }

  // 金額再計算（発行前かつ lines が指定された場合のみ）
  var shippingFee, duty, otherFee, discount, lineTotal, invoiceTotal, invoiceTotalJpy;
  if (!isInvoiceIssued && hasLines) {
    shippingFee = coreOrderWriteNormalizeNumeric(orderData.shippingFee, 'shippingFee') || 0;
    duty        = coreOrderWriteNormalizeNumeric(orderData.duty, 'duty') || 0;
    otherFee    = coreOrderWriteNormalizeNumeric(orderData.otherFee, 'otherFee') || 0;
    discount    = coreOrderWriteNormalizeNumeric(orderData.discount, 'discount') || 0;

    lineTotal = lines.reduce(function(sum, line) {
      var qty      = coreOrderWriteNormalizeNumeric(line.quantity, 'quantity') || 0;
      var unitPrice = coreOrderWriteNormalizeNumeric(line.unitPrice, 'unitPrice') || 0;
      return sum + qty * unitPrice;
    }, 0);

    invoiceTotal    = lineTotal + shippingFee + duty + otherFee - discount;
    invoiceTotalJpy = Math.round(invoiceTotal * existingExchangeRate);
  }

  // SHIPMENTS / PURCHASES を取得してステータスを再計算する
  var shipmentsMeta  = coreOrderUpdateReadRelated_(ss, 'SHIPMENTS',  ['ORDER_ID', 'PICKUP_REQUEST', 'TRACKING_NUMBER']);
  var purchasesMeta  = coreOrderUpdateReadRelated_(ss, 'PURCHASES',  ['ORDER_ID', 'STATUS']);

  var shipmentsForOrder = (shipmentsMeta[orderId] || []).map(function(s) {
    return { pickupRequest: s.PICKUP_REQUEST, trackingNumber: s.TRACKING_NUMBER };
  });
  var purchasesForOrder = (purchasesMeta[orderId] || []).map(function(p) {
    return { status: p.STATUS };
  });

  // 更新後の値でステータスを計算する
  var cancellationReason  = orderData.cancellationReason !== undefined
    ? coreOrderWriteValue(orderData.cancellationReason)
    : coreOrderWriteValue(existing.CANCELLATION_REASON);

  var paymentConfirmedAt = orderData.paymentConfirmedAt !== undefined
    ? coreOrderWriteValue(orderData.paymentConfirmedAt)
    : coreOrderWriteValue(existing.PAYMENT_CONFIRMED_AT);

  var newOrderStatus = calculateOrderStatus(
    {
      cancellationReason: cancellationReason,
      status:             coreOrderWriteValue(existing.STATUS),
      paymentConfirmedAt: paymentConfirmedAt,
      invoiceNumber:      coreOrderWriteValue(existing.INVOICE_NUMBER)
    },
    shipmentsForOrder,
    purchasesForOrder
  );

  var newPaymentStatus = calculatePaymentStatus({
    cancellationReason: cancellationReason,
    paymentConfirmedAt: paymentConfirmedAt,
    paymentDueAt:       existing.PAYMENT_DUE_AT
  });

  return withSheetWrite_(
    { useLock: true, cacheTargets: CORE_ORDER_UPDATE_CACHE_TARGETS },
    function() {
      var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
      var orderSheet   = ordersResult.sheet;
      var orderHI      = ordersResult.headerIndexes;

      // オーダー行を特定する（ORDER_ID 列で検索）
      var orderIdPhysical = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
      var orderIdColIdx   = orderHI[orderIdPhysical]; // 1-indexed
      if (!orderIdColIdx) throw new Error('ORDER_ID 列が見つかりません');

      var lastRow = orderSheet.getLastRow();
      var targetSheetRow = -1;

      if (lastRow >= 2) {
        var idValues = orderSheet.getRange(2, orderIdColIdx, lastRow - 1, 1).getValues();
        for (var i = 0; i < idValues.length; i++) {
          if (String(idValues[i][0] || '').trim() === orderId) {
            targetSheetRow = i + 2; // 2-indexed（ヘッダー行+1）
            break;
          }
        }
      }

      if (targetSheetRow < 0) throw new Error('ORDER_NOT_FOUND:' + orderId);

      var now = new Date();

      function setOrderCell(colKey, value) {
        var header = getCoreSchemaV1HeaderName('ORDERS', colKey);
        var idx    = orderHI[header];
        if (idx) orderSheet.getRange(targetSheetRow, idx).setValue(value);
      }

      // 常時編集可フィールドの更新
      if (orderData.paymentConfirmedAt !== undefined) setOrderCell('PAYMENT_CONFIRMED_AT', coreOrderWriteValue(orderData.paymentConfirmedAt));
      if (orderData.shippedAt         !== undefined) setOrderCell('SHIPPED_AT',           coreOrderWriteValue(orderData.shippedAt));
      if (orderData.trackingNumber    !== undefined) setOrderCell('TRACKING_NUMBER',       coreOrderWriteValue(orderData.trackingNumber));
      if (orderData.shippingMethod    !== undefined) setOrderCell('SHIPPING_METHOD',       coreOrderWriteValue(orderData.shippingMethod));
      if (orderData.note              !== undefined) setOrderCell('NOTE',                  coreOrderWriteValue(orderData.note));
      if (orderData.shippingNote      !== undefined) setOrderCell('SHIPPING_NOTE',         coreOrderWriteValue(orderData.shippingNote));
      if (orderData.transactionNote   !== undefined) setOrderCell('TRANSACTION_NOTE',      coreOrderWriteValue(orderData.transactionNote));
      if (orderData.internalNote      !== undefined) setOrderCell('INTERNAL_NOTE',         coreOrderWriteValue(orderData.internalNote));
      if (orderData.cancellationReason !== undefined) setOrderCell('CANCELLATION_REASON',  coreOrderWriteValue(orderData.cancellationReason));
      if (orderData.cancellationNote  !== undefined) setOrderCell('CANCELLATION_NOTE',     coreOrderWriteValue(orderData.cancellationNote));

      // ステータス更新
      setOrderCell('STATUS',          newOrderStatus);
      setOrderCell('PAYMENT_STATUS',  newPaymentStatus);
      setOrderCell('UPDATED_AT',      now);

      // 金額系フィールドの更新（発行前かつ lines が指定された場合のみ）
      if (!isInvoiceIssued && hasLines) {
        setOrderCell('SHIPPING_FEE',      shippingFee);
        setOrderCell('DUTY',              duty);
        setOrderCell('OTHER_FEE',         otherFee);
        setOrderCell('DISCOUNT',          discount);
        setOrderCell('LINE_TOTAL',        lineTotal);
        setOrderCell('INVOICE_TOTAL',     invoiceTotal);
        setOrderCell('INVOICE_TOTAL_JPY', invoiceTotalJpy);

        // 明細の更新: 既存明細を削除 → 新規明細を appendRow
        var linesResult = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
        var lineSheet   = linesResult.sheet;
        var lineHI      = linesResult.headerIndexes;

        var lineOrderIdPhysical = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_ID');
        var lineOrderIdColIdx   = lineHI[lineOrderIdPhysical];
        if (!lineOrderIdColIdx) throw new Error('ORDER_LINES.ORDER_ID 列が見つかりません');

        // 削除対象行を逆順で特定する（後ろから削除することで行ずれを防ぐ）
        var lastLineRow  = lineSheet.getLastRow();
        var rowsToDelete = [];
        if (lastLineRow >= 2) {
          var lineOrderIds = lineSheet.getRange(2, lineOrderIdColIdx, lastLineRow - 1, 1).getValues();
          for (var li = 0; li < lineOrderIds.length; li++) {
            if (String(lineOrderIds[li][0] || '').trim() === orderId) {
              rowsToDelete.push(li + 2); // 2-indexed
            }
          }
        }
        // 逆順に削除する（deleteRow は 1 行ずつ）
        for (var di = rowsToDelete.length - 1; di >= 0; di--) {
          lineSheet.deleteRow(rowsToDelete[di]);
        }

        // 新しい明細行を追加する
        var nextLineNum = coreOrderWriteGetNextLineMaxNum(lineSheet, lineHI);

        lines.forEach(function(line, i) {
          var qty       = coreOrderWriteNormalizeNumeric(line.quantity, 'quantity') || 0;
          var unitPrice = coreOrderWriteNormalizeNumeric(line.unitPrice, 'unitPrice') || 0;
          var subtotal  = qty * unitPrice;
          var lineId    = CORE_ORDER_WRITE_LINE_ID_PREFIX + String(nextLineNum + i + 1).padStart(CORE_ORDER_WRITE_ID_DIGITS, '0');

          var maxLineCols = lineSheet.getLastColumn();
          var lineRow     = new Array(maxLineCols).fill('');

          function setLineCell(colKey, value) {
            var header = getCoreSchemaV1HeaderName('ORDER_LINES', colKey);
            var idx    = lineHI[header];
            if (idx) lineRow[idx - 1] = value;
          }

          setLineCell('ORDER_LINE_ID', lineId);
          setLineCell('ORDER_ID',      orderId);
          setLineCell('LINE_NUMBER',   i + 1);
          setLineCell('CATEGORY',      coreOrderWriteValue(line.category));
          setLineCell('PRODUCT_NAME',  coreOrderWriteValue(line.productName));
          setLineCell('STATUS',        coreOrderWriteValue(line.status));
          setLineCell('QUANTITY',      qty);
          setLineCell('UNIT_PRICE',    unitPrice);
          setLineCell('SUBTOTAL',      subtotal);
          setLineCell('PRODUCT_ID',    coreOrderWriteValue(line.productId));

          lineSheet.appendRow(lineRow);
        });
      }

      return { success: true, orderId: orderId };
    }
  );
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * 既存オーダーを 1 件取得する。
 * 見つからない場合は null を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} orderId
 * @returns {Object|null}
 */
function coreOrderUpdateGetExistingOrder_(ss, orderId) {
  var sheet   = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return null;

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerToIdx = {};
  rawHeaders.forEach(function(h, i) {
    var key = String(h).trim();
    if (key) headerToIdx[key] = i;
  });

  var fields = [
    'ORDER_ID', 'STATUS', 'INVOICE_ISSUED_AT', 'INVOICE_NUMBER',
    'EXCHANGE_RATE', 'PAYMENT_DUE_AT', 'PAYMENT_CONFIRMED_AT',
    'CANCELLATION_REASON'
  ];
  var fieldIdxMap = {};
  fields.forEach(function(fieldKey) {
    var physicalName = getCoreSchemaV1HeaderName('ORDERS', fieldKey);
    if (headerToIdx[physicalName] !== undefined) {
      fieldIdxMap[fieldKey] = headerToIdx[physicalName];
    }
  });

  var orderIdPhysical = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
  var orderIdColIdx   = headerToIdx[orderIdPhysical];
  if (orderIdColIdx === undefined) return null;

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[orderIdColIdx] || '').trim() === orderId) {
      var obj = {};
      fields.forEach(function(fieldKey) {
        var idx = fieldIdxMap[fieldKey];
        obj[fieldKey] = (idx !== undefined) ? row[idx] : '';
      });
      return obj;
    }
  }
  return null;
}

/**
 * SHIPMENTS / PURCHASES を orderId でグループ化した辞書を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @param {string[]} fieldKeys
 * @returns {Object<string, Array<Object>>}
 */
function coreOrderUpdateReadRelated_(ss, tableKey, fieldKeys) {
  var sheet   = getCoreSchemaV1Sheet(ss, tableKey);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {};

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

  var data   = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var lookup = {};

  data.forEach(function(row) {
    var obj = {};
    fieldKeys.forEach(function(fieldKey) {
      var idx = fieldIdxMap[fieldKey];
      obj[fieldKey] = (idx !== undefined) ? row[idx] : '';
    });
    var key = String(obj.ORDER_ID || '').trim();
    if (!key) return;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(obj);
  });

  return lookup;
}
