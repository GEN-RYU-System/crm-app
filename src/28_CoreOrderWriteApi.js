/**
 * Core Schema V1 を正本としてオーダーを書き込む React フロント専用 API。
 * 物理シート名・物理ヘッダー名・状態値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   createCoreOrderForFrontend(sessionId, orderData)
 *
 * 権限キー:
 *   書き込み: deal_edit — オーダーは商談編集の一部
 */

/** オーダーID接頭辞: OD-00001 形式 */
var CORE_ORDER_ID_PREFIX = 'OD-';
/** 明細ID接頭辞: ODL-00001 形式 */
var CORE_ORDER_LINE_ID_PREFIX = 'ODL-';
/** ID の連番部桁数 */
var CORE_ORDER_ID_DIGITS = 5;

var CORE_ORDERS_WRITE_CACHE_TARGETS = [
  { indexKey: CORE_ORDERS_CACHE_INDEX, prefix: CORE_ORDERS_CACHE_PREFIX }
];

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * オーダーを新規作成する（明細も同時登録）。
 * 合計金額は明細から自動計算する（フロントの値を信用しない）。
 * 受注担当IDはセッションから自動解決する。
 *
 * @param {string} sessionId
 * @param {{
 *   customerId: string,
 *   shippingDestinationId: string,
 *   paymentDestinationId: string,
 *   sourceLeadId: string,
 *   currency?: string,
 *   shippingFee?: number|null,
 *   duty?: number|null,
 *   otherFee?: number|null,
 *   discount?: number|null,
 *   paymentMethod?: string,
 *   paymentTerms?: string,
 *   paymentDueAt?: string,
 *   note?: string,
 *   lines?: Array<{ lineNo, productId, productName, condition, quantity, unitPrice }>
 * }} orderData
 * @returns {{ success: true, orderId: string }}
 */
function createCoreOrderForFrontend(sessionId, orderData) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  var sessionUser = getSessionUser(sessionId);
  if (!sessionUser) throw new Error('SESSION_INVALID');

  var ss = getSpreadsheet();

  // 1. 必須フィールドチェック
  if (!orderData) throw new Error('ORDER_DATA_REQUIRED');
  var customerId = String(orderData.customerId || '').trim();
  var shippingDestinationId = String(orderData.shippingDestinationId || '').trim();
  var paymentDestinationId = String(orderData.paymentDestinationId || '').trim();
  var sourceLeadId = String(orderData.sourceLeadId || '').trim();

  if (!customerId) throw new Error('ORDER_CUSTOMER_ID_REQUIRED');
  if (!shippingDestinationId) throw new Error('ORDER_SHIPPING_DESTINATION_ID_REQUIRED');
  if (!paymentDestinationId) throw new Error('ORDER_PAYMENT_DESTINATION_ID_REQUIRED');
  if (!sourceLeadId) throw new Error('ORDER_SOURCE_LEAD_ID_REQUIRED');

  // 2. 存在チェック
  coreOrderAssertEntityExists(ss, 'CUSTOMERS', 'CUSTOMER_ID', customerId, 'CUSTOMER_NOT_FOUND');
  coreOrderAssertEntityExists(ss, 'SHIPPING_DESTINATIONS', 'SHIPPING_DESTINATION_ID', shippingDestinationId, 'SHIPPING_DESTINATION_NOT_FOUND');
  coreOrderAssertEntityExists(ss, 'PAYMENT_DESTINATIONS', 'PAYMENT_DESTINATION_ID', paymentDestinationId, 'PAYMENT_DESTINATION_NOT_FOUND');
  coreOrderAssertEntityExists(ss, 'LEADS', 'LEAD_ID', sourceLeadId, 'LEAD_NOT_FOUND');

  // 3. 受注担当IDをセッションから解決
  var orderAssigneeId = sessionUser.staffId;

  // 4. 数値正規化
  var normalizedShippingFee = coreOrderNormalizeNumericField('shippingFee', orderData.shippingFee);
  var normalizedDuty = coreOrderNormalizeNumericField('duty', orderData.duty);
  var normalizedOtherFee = coreOrderNormalizeNumericField('otherFee', orderData.otherFee);
  var normalizedDiscount = coreOrderNormalizeNumericField('discount', orderData.discount);

  // 5. 通貨・為替レート
  var currency = String(orderData.currency || 'JPY').trim().toUpperCase();
  var exchangeRate = getCurrentExchangeRate(currency);

  // 6. 明細から金額計算（フロントから受け取った金額は使わない）
  var lines = Array.isArray(orderData.lines) ? orderData.lines : [];
  var lineTotal = 0;
  lines.forEach(function(line) {
    var qty = coreOrderNormalizeNumericField('quantity', line.quantity) || 0;
    var price = coreOrderNormalizeNumericField('unitPrice', line.unitPrice) || 0;
    lineTotal += qty * price;
  });
  var shippingFee = normalizedShippingFee || 0;
  var duty = normalizedDuty || 0;
  var otherFee = normalizedOtherFee || 0;
  var discount = normalizedDiscount || 0;
  var invoiceTotal = lineTotal + shippingFee + duty + otherFee - discount;
  var invoiceTotalJpy = invoiceTotal * exchangeRate;

  // 7. 支払いステータス計算
  var paymentDueAt = String(orderData.paymentDueAt || '').trim() || null;
  var paymentStatus = calculatePaymentStatus({
    paymentConfirmedAt: null,
    paymentDueAt: paymentDueAt,
    cancellationReason: null
  });

  // 8. オーダーステータス: 新規作成は invoiceNumber 未設定 → '不明'
  var orderStatus = getCoreSchemaV1Value('ORDERS', 'STATUS', 'UNKNOWN');

  return withSheetWrite_(
    { useLock: true, cacheTargets: CORE_ORDERS_WRITE_CACHE_TARGETS },
    function() {
      var now = new Date();
      var orderDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

      var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
      var orderSheet = ordersResult.sheet;
      var orderHI = ordersResult.headerIndexes;

      // 8. ORDER_ID 採番
      var newOrderId = coreOrderGenerateNextOrderId(orderSheet, orderHI);

      // 9. ORDERS シートへ書き込み
      var orderFieldMap = {
        ORDER_ID:                 newOrderId,
        INVOICE_NUMBER:           '',
        CUSTOMER_ID:              customerId,
        SHIPPING_DESTINATION_ID:  shippingDestinationId,
        PAYMENT_DESTINATION_ID:   paymentDestinationId,
        SOURCE_LEAD_ID:           sourceLeadId,
        STATUS:                   orderStatus,
        ORDER_DATE:               orderDate,
        CURRENCY:                 currency,
        EXCHANGE_RATE:            exchangeRate,
        LINE_TOTAL:               lineTotal,
        SHIPPING_FEE:             shippingFee,
        DUTY:                     duty,
        INVOICE_TOTAL:            invoiceTotal,
        PAYMENT_METHOD:           String(orderData.paymentMethod || '').trim(),
        INVOICE_LINK:             '',
        INVOICE_ISSUED_AT:        '',
        PAYMENT_DUE_AT:           paymentDueAt || '',
        PAYMENT_CONFIRMED_AT:     '',
        SHIPPING_METHOD:          '',
        SHIPPED_AT:               '',
        TRACKING_NUMBER:          '',
        SHIPPING_NOTE:            '',
        NOTE:                     String(orderData.note || '').trim(),
        REGISTERED_AT:            now,
        UPDATED_AT:               now,
        ORDER_ASSIGNEE_ID:        orderAssigneeId,
        SALES_ASSIGNEE_ID:        '',
        SHIPPING_ASSIGNEE_ID:     '',
        TRANSACTION_NOTE:         '',
        OTHER_FEE:                otherFee,
        DISCOUNT:                 discount,
        PAYMENT_TERMS:            String(orderData.paymentTerms || '').trim(),
        CANCELLATION_REASON:      '',
        CANCELLATION_NOTE:        '',
        PAYMENT_STATUS:           paymentStatus,
        INVOICE_TOTAL_JPY:        invoiceTotalJpy
      };

      var orderLastCol = orderSheet.getLastColumn();
      var orderRowData = new Array(orderLastCol).fill('');
      Object.keys(orderFieldMap).forEach(function(headerKey) {
        var physicalHeader = getCoreSchemaV1HeaderName('ORDERS', headerKey);
        var colIdx = orderHI[physicalHeader];
        if (colIdx) orderRowData[colIdx - 1] = orderFieldMap[headerKey];
      });
      orderSheet.appendRow(orderRowData);

      // 10. 明細書き込み
      if (lines.length > 0) {
        var linesResult = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
        var lineSheet = linesResult.sheet;
        var lineHI = linesResult.headerIndexes;
        coreOrderWriteLines(lineSheet, lineHI, newOrderId, lines);
      }

      // 11. 戻り値
      return { success: true, orderId: newOrderId };
    }
  );
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * 数値フィールドを正規化する。
 * - 全角数字 → 半角変換
 * - 空・null・undefined → null
 * - 数値として不正 → INVALID_NUMERIC_FIELD エラー
 *
 * @param {string} fieldName
 * @param {*} raw
 * @returns {number|null}
 */
function coreOrderNormalizeNumericField(fieldName, raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  var s = String(raw).replace(/[０-９．]/g, function(c) {
    return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
  });
  if (!s.trim()) return null;
  var n = Number(s);
  if (!isFinite(n)) throw new Error('INVALID_NUMERIC_FIELD:' + fieldName + ':' + raw);
  return n;
}

/**
 * オーダーID（OD-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @returns {string}
 */
function coreOrderGenerateNextOrderId(sheet, headerIndexes) {
  var orderIdHeader = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
  var colIdx = headerIndexes[orderIdHeader];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(CORE_ORDER_ID_PREFIX) === 0) {
        var num = parseInt(id.slice(CORE_ORDER_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_ORDER_ID_PREFIX + String(maxNum + 1).padStart(CORE_ORDER_ID_DIGITS, '0');
}

/**
 * 明細ID（ODL-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @returns {string}
 */
function coreOrderGenerateNextLineId(sheet, headerIndexes) {
  var lineIdHeader = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
  var colIdx = headerIndexes[lineIdHeader];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(CORE_ORDER_LINE_ID_PREFIX) === 0) {
        var num = parseInt(id.slice(CORE_ORDER_LINE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_ORDER_LINE_ID_PREFIX + String(maxNum + 1).padStart(CORE_ORDER_ID_DIGITS, '0');
}

/**
 * 汎用エンティティ存在チェック。
 * 指定テーブルの指定ヘッダーキーに該当IDが存在しない場合は Error を throw する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {string} tableKey  'CUSTOMERS' | 'SHIPPING_DESTINATIONS' | 'PAYMENT_DESTINATIONS' | 'LEADS'
 * @param {string} headerKey  'CUSTOMER_ID' | 'SHIPPING_DESTINATION_ID' | 'PAYMENT_DESTINATION_ID' | 'LEAD_ID'
 * @param {string} id
 * @param {string} errorCode  エラー時に throw するコード
 */
function coreOrderAssertEntityExists(spreadsheet, tableKey, headerKey, id, errorCode) {
  var table = getCoreSchemaV1Table(tableKey);
  var sheet = getCoreSchemaV1Sheet(spreadsheet, tableKey);
  var lastRow = sheet.getLastRow();
  var dataRowStart = table.headerRowNumber + 1;
  if (lastRow < dataRowStart) throw new Error(errorCode + ': ' + id);

  var headers = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  var physicalHeader = getCoreSchemaV1HeaderName(tableKey, headerKey);
  var colIdx = headers.indexOf(physicalHeader);
  if (colIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + headerKey);

  var rowCount = lastRow - table.headerRowNumber;
  var data = sheet.getRange(dataRowStart, colIdx + 1, rowCount, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === id) return;
  }
  throw new Error(errorCode + ': ' + id);
}

/**
 * ORDER_LINES シートに明細行を書き込む。
 * SUBTOTAL = QUANTITY × UNIT_PRICE で自動計算。
 * condition は STATUS（状態）列に書き込む。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @param {string} orderId
 * @param {Array} lines
 */
function coreOrderWriteLines(sheet, headerIndexes, orderId, lines) {
  lines.forEach(function(line, index) {
    var lineId = coreOrderGenerateNextLineId(sheet, headerIndexes);
    var qty = coreOrderNormalizeNumericField('quantity', line.quantity) || 0;
    var price = coreOrderNormalizeNumericField('unitPrice', line.unitPrice) || 0;
    var subtotal = qty * price;

    var fieldMap = {
      ORDER_LINE_ID: lineId,
      ORDER_ID:      orderId,
      LINE_NUMBER:   index + 1,
      CATEGORY:      '',
      PRODUCT_NAME:  String(line.productName || '').trim(),
      STATUS:        String(line.condition   || '').trim(),
      SKU:           '',
      QUANTITY:      qty,
      UNIT_PRICE:    price,
      SUBTOTAL:      subtotal,
      PRODUCT_ID:    String(line.productId   || '').trim()
    };

    var lastCol = sheet.getLastColumn();
    var rowData = new Array(lastCol).fill('');
    Object.keys(fieldMap).forEach(function(headerKey) {
      var physicalHeader = getCoreSchemaV1HeaderName('ORDER_LINES', headerKey);
      var colIdx = headerIndexes[physicalHeader];
      if (colIdx) rowData[colIdx - 1] = fieldMap[headerKey];
    });
    sheet.appendRow(rowData);
  });
}
