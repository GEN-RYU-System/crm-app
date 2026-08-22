/**
 * DEV 専用テスト注文シード
 *
 * createDevTestUnpaidOrder() で「支払い待ち」ステータスのテスト注文を1件作成する。
 *
 * 前提:
 *   - ENVIRONMENT === 'development' でなければ即時 throw する。
 *   - 既に「支払い待ち」の注文が1件以上あれば ABORT して件数を返す（書き込みなし）。
 *
 * 作成データ:
 *   オーダー管理 1行 + オーダー明細 1行
 *   INVOICE_NUMBER    = 'TEST-0001'
 *   INVOICE_ISSUED_AT = 実行日
 *   PAYMENT_DUE_AT    = 実行日 + 3日
 *   STATUS            = calculateOrderStatus() で算出
 *
 * 実行方法:
 *   clasp run createDevTestUnpaidOrder
 */

/* global getCoreSchemaV1HeaderName, getCoreSchemaV1Value, getCoreSchemaV1Sheet,
   validateCoreSchemaV1TableForWrite, withSheetWrite_,
   calculateOrderStatus, calculatePaymentStatus, getCurrentExchangeRate,
   getEnvironment, getSpreadsheet,
   CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX,
   LockService */

var DEV_TEST_ORDER_INVOICE_NUMBER   = 'TEST-0001';
var DEV_TEST_ORDER_DUE_DAYS         = 3;
var DEV_TEST_ORDER_UNIT_PRICE       = 1;
var DEV_TEST_ORDER_QUANTITY         = 1;
var DEV_TEST_ORDER_PRODUCT_NAME     = 'DEV-TEST-ITEM';
var DEV_TEST_ORDER_CATEGORY         = 'TEST';
var DEV_TEST_ORDER_CURRENCY         = 'USD';
var DEV_TEST_ORDER_PAYMENT_METHOD   = 'WISE';

/**
 * 「支払い待ち」ステータスのテスト注文を1件作成する。DEV 専用。
 *
 * @returns {{ success: true, orderId: string } | { aborted: true, reason: string, count: number }}
 */
function createDevTestUnpaidOrder() {
  // 環境ガード
  if (getEnvironment() !== 'development') {
    throw new Error('createDevTestUnpaidOrder は development 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // 二重実行防止: 既存の「支払い待ち」件数を確認
  var awaitingPaymentValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');
  var existingCount = devTestOrderCountByStatus_(ss, awaitingPaymentValue);
  if (existingCount > 0) {
    return {
      aborted: true,
      reason:  'ALREADY_EXISTS',
      count:   existingCount,
      message: '\u652f\u6255\u3044\u5f85\u3061\u306e\u6ce8\u6587\u304c\u65e2\u306b ' + existingCount + ' \u4ef6\u3042\u308b\u305f\u3081\u4e2d\u6b62\u3057\u307e\u3057\u305f'
    };
  }

  // 既存マスタから流用する ID を取得
  var customerId             = devTestOrderGetFirstId_(ss, 'CUSTOMERS',             'CUSTOMER_ID');
  var shippingDestinationId  = devTestOrderGetFirstId_(ss, 'SHIPPING_DESTINATIONS',  'SHIPPING_DESTINATION_ID');
  var paymentDestinationId   = devTestOrderGetFirstId_(ss, 'PAYMENT_DESTINATIONS',   'PAYMENT_DESTINATION_ID');

  if (!customerId)            throw new Error('DEV_SEED: 顧客マスタにデータがありません');
  if (!shippingDestinationId) throw new Error('DEV_SEED: 配送先マスタにデータがありません');
  if (!paymentDestinationId)  throw new Error('DEV_SEED: 支払先マスタにデータがありません');

  // 為替レートはサーバーサイドで取得
  var exchangeRate = getCurrentExchangeRate(DEV_TEST_ORDER_CURRENCY);

  // 日付計算
  var now            = new Date();
  var paymentDueDate = new Date(now.getTime());
  paymentDueDate.setDate(paymentDueDate.getDate() + DEV_TEST_ORDER_DUE_DAYS);

  // 金額計算
  var lineTotal    = DEV_TEST_ORDER_QUANTITY * DEV_TEST_ORDER_UNIT_PRICE;
  var invoiceTotal = lineTotal;
  var invoiceTotalJpy = Math.round(invoiceTotal * exchangeRate);

  // ステータス算出（invoiceNumber あり → 支払い待ち）
  var orderStatus = calculateOrderStatus(
    {
      cancellationReason: '',
      status:             '',
      paymentConfirmedAt: '',
      invoiceNumber:      DEV_TEST_ORDER_INVOICE_NUMBER
    },
    [],
    []
  );

  var paymentStatus = calculatePaymentStatus({
    cancellationReason: '',
    paymentConfirmedAt: '',
    paymentDueAt:       paymentDueDate
  });

  var paymentMethodValue = getCoreSchemaV1Value('ORDERS', 'PAYMENT_METHOD', DEV_TEST_ORDER_PAYMENT_METHOD);

  var cacheTargets = [
    { indexKey: CORE_ORDERS_CACHE_INDEX, prefix: CORE_ORDERS_CACHE_PREFIX }
  ];

  return withSheetWrite_(
    { useLock: true, cacheTargets: cacheTargets },
    function() {
      var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
      var orderSheet   = ordersResult.sheet;
      var orderHI      = ordersResult.headerIndexes;

      var linesResult  = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
      var lineSheet    = linesResult.sheet;
      var lineHI       = linesResult.headerIndexes;

      // オーダーID 採番
      var newOrderId  = devTestOrderNextOrderId_(orderSheet, orderHI);
      var newLineId   = devTestOrderNextLineId_(lineSheet, lineHI);

      // 支払サイトラベル
      var paymentTermsLabel = String(DEV_TEST_ORDER_DUE_DAYS) + '\u65e5\u5f8c'; // "3日後"

      // ─── オーダー行 ───────────────────────────────────────────────────────────
      var maxCols   = orderSheet.getLastColumn();
      var orderRow  = new Array(maxCols).fill('');

      function setOrder(colKey, value) {
        var header = getCoreSchemaV1HeaderName('ORDERS', colKey);
        var idx    = orderHI[header];
        if (idx) orderRow[idx - 1] = value;
      }

      setOrder('ORDER_ID',                newOrderId);
      setOrder('INVOICE_NUMBER',          DEV_TEST_ORDER_INVOICE_NUMBER);
      setOrder('CUSTOMER_ID',             customerId);
      setOrder('SHIPPING_DESTINATION_ID', shippingDestinationId);
      setOrder('PAYMENT_DESTINATION_ID',  paymentDestinationId);
      setOrder('STATUS',                  orderStatus);
      setOrder('ORDER_DATE',              now);
      setOrder('CURRENCY',                DEV_TEST_ORDER_CURRENCY);
      setOrder('EXCHANGE_RATE',           exchangeRate);
      setOrder('LINE_TOTAL',              lineTotal);
      setOrder('SHIPPING_FEE',            0);
      setOrder('DUTY',                    0);
      setOrder('OTHER_FEE',               0);
      setOrder('DISCOUNT',                0);
      setOrder('INVOICE_TOTAL',           invoiceTotal);
      setOrder('INVOICE_TOTAL_JPY',       invoiceTotalJpy);
      setOrder('PAYMENT_METHOD',          paymentMethodValue);
      setOrder('INVOICE_ISSUED_AT',       now);
      setOrder('PAYMENT_DUE_AT',          paymentDueDate);
      setOrder('PAYMENT_TERMS',           paymentTermsLabel);
      setOrder('PAYMENT_STATUS',          paymentStatus);
      setOrder('REGISTERED_AT',           now);
      setOrder('UPDATED_AT',              now);

      orderSheet.appendRow(orderRow);

      // ─── 明細行 ───────────────────────────────────────────────────────────────
      var maxLineCols = lineSheet.getLastColumn();
      var lineRow     = new Array(maxLineCols).fill('');

      function setLine(colKey, value) {
        var header = getCoreSchemaV1HeaderName('ORDER_LINES', colKey);
        var idx    = lineHI[header];
        if (idx) lineRow[idx - 1] = value;
      }

      setLine('ORDER_LINE_ID', newLineId);
      setLine('ORDER_ID',      newOrderId);
      setLine('LINE_NUMBER',   1);
      setLine('PRODUCT_NAME',  DEV_TEST_ORDER_PRODUCT_NAME);
      setLine('CATEGORY',      DEV_TEST_ORDER_CATEGORY);
      setLine('QUANTITY',      DEV_TEST_ORDER_QUANTITY);
      setLine('UNIT_PRICE',    DEV_TEST_ORDER_UNIT_PRICE);
      setLine('SUBTOTAL',      lineTotal);

      lineSheet.appendRow(lineRow);

      return { success: true, orderId: newOrderId };
    }
  );
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * ORDERS シート上で指定ステータスの行数を返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} statusValue
 * @returns {number}
 */
function devTestOrderCountByStatus_(ss, statusValue) {
  var sheet = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var statusPhysical = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
  var colIdx = rawHeaders.indexOf(statusPhysical); // 0-based
  if (colIdx < 0) return 0;

  var count = 0;
  var data = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  data.forEach(function(row) {
    if (String(row[0] || '').trim() === statusValue) count++;
  });
  return count;
}

/**
 * 指定テーブルの先頭データ行から主キー列の値を返す。
 * データがなければ空文字を返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @param {string} pkHeaderKey
 * @returns {string}
 */
function devTestOrderGetFirstId_(ss, tableKey, pkHeaderKey) {
  var sheet = getCoreSchemaV1Sheet(ss, tableKey);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  var rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, pkHeaderKey);
  var colIdx = rawHeaders.indexOf(pkPhysical); // 0-based
  if (colIdx < 0) return '';

  var data = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    if (id) return id;
  }
  return '';
}

/**
 * オーダーIDを採番する（OD-XXXXX 形式）。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @returns {string}
 */
function devTestOrderNextOrderId_(sheet, headerIndexes) {
  var prefix  = 'OD-';
  var digits  = 5;
  var header  = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
  var colIdx  = headerIndexes[header];
  var maxNum  = 0;
  var lastRow = sheet.getLastRow();

  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(prefix) === 0) {
        var num = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return prefix + String(maxNum + 1).padStart(digits, '0');
}

/**
 * 明細IDを採番する（ODL-XXXXX 形式）。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @returns {string}
 */
function devTestOrderNextLineId_(sheet, headerIndexes) {
  var prefix  = 'ODL-';
  var digits  = 5;
  var header  = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
  var colIdx  = headerIndexes[header];
  var maxNum  = 0;
  var lastRow = sheet.getLastRow();

  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(prefix) === 0) {
        var num = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return prefix + String(maxNum + 1).padStart(digits, '0');
}
