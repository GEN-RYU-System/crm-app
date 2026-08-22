/**
 * DEV 環境専用: 「支払い待ち」テストオーダー 3件 + 明細 3件 を投入する。
 *
 * 目的: /sales-orders の支払期日バッジ（赤/黄/通常）を DEV 実機で確認するためのシードデータ。
 *
 * 実行条件:
 *   - ENVIRONMENT === 'development' であること
 *   - ステータスが「支払い待ち」の行が既に0件であること（二重実行防止）
 *
 * 投入データ（3件）:
 *   TEST-0001: 支払期日 = 実行日の翌日  → /sales-orders で黄色バッジ
 *   TEST-0002: 支払期日 = 実行日の前日  → /sales-orders で赤バッジ
 *   TEST-0003: 支払期日 = 実行日の10日後 → /sales-orders で通常テキスト
 *
 * 実行方法:
 *   clasp run createDevTestUnpaidOrder
 *
 * 戻り値:
 *   成功: { success: true,  resultType: 'DEV_TEST_UNPAID_ORDERS_CREATED', orders: [...] }
 *   中断: { success: false, resultType: 'ABORT_DUPLICATE_AWAITING_PAYMENT', ... }
 */
function createDevTestUnpaidOrder() {
  // ── 環境ガード ────────────────────────────────────────────────────────────
  if (getEnvironment() !== 'development') {
    throw new Error('createDevTestUnpaidOrder is available only in development');
  }

  // ── LockService ──────────────────────────────────────────────────────────
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();

    // ── 二重実行防止ガード ──────────────────────────────────────────────────
    var awaitingPaymentValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');
    var ordersSheet = getCoreSchemaV1Sheet(ss, 'ORDERS');
    var ordersLastRow = ordersSheet.getLastRow();
    var existingAwaitingCount = 0;
    if (ordersLastRow >= 2) {
      var statusHeaderName = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
      var ordersHeaders = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getDisplayValues()[0];
      var statusColIdx = ordersHeaders.indexOf(statusHeaderName);
      if (statusColIdx !== -1) {
        var statusValues = ordersSheet.getRange(2, statusColIdx + 1, ordersLastRow - 1, 1).getDisplayValues();
        statusValues.forEach(function(row) {
          if (row[0] === awaitingPaymentValue) existingAwaitingCount++;
        });
      }
    }
    if (existingAwaitingCount > 0) {
      return {
        success: false,
        resultType: 'ABORT_DUPLICATE_AWAITING_PAYMENT',
        existingAwaitingPaymentCount: existingAwaitingCount
      };
    }

    // ── 既存先頭行から参照IDを取得 ──────────────────────────────────────────
    var customerIdHeaderName     = getCoreSchemaV1HeaderName('ORDERS', 'CUSTOMER_ID');
    var shippingDestIdHeaderName = getCoreSchemaV1HeaderName('ORDERS', 'SHIPPING_DESTINATION_ID');
    var paymentDestIdHeaderName  = getCoreSchemaV1HeaderName('ORDERS', 'PAYMENT_DESTINATION_ID');
    var sourceLeadIdHeaderName   = getCoreSchemaV1HeaderName('ORDERS', 'SOURCE_LEAD_ID');

    var ordersAllHeaders = ordersSheet.getLastColumn() > 0
      ? ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getDisplayValues()[0]
      : [];

    function getIdxByHeaderName(headers, name) {
      var idx = headers.indexOf(name);
      if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + name);
      return idx;
    }

    var custIdx    = getIdxByHeaderName(ordersAllHeaders, customerIdHeaderName);
    var shipIdx    = getIdxByHeaderName(ordersAllHeaders, shippingDestIdHeaderName);
    var payDestIdx = getIdxByHeaderName(ordersAllHeaders, paymentDestIdHeaderName);
    var leadIdx    = getIdxByHeaderName(ordersAllHeaders, sourceLeadIdHeaderName);

    var customerId     = '';
    var shippingDestId = '';
    var paymentDestId  = '';
    var sourceLeadId   = '';

    if (ordersLastRow >= 2) {
      var firstDataRow = ordersSheet.getRange(2, 1, 1, ordersSheet.getLastColumn()).getValues()[0];
      customerId     = String(firstDataRow[custIdx]    || '').trim();
      shippingDestId = String(firstDataRow[shipIdx]    || '').trim();
      paymentDestId  = String(firstDataRow[payDestIdx] || '').trim();
      sourceLeadId   = String(firstDataRow[leadIdx]    || '').trim();
    }

    // ── テスト注文3件の設定 ───────────────────────────────────────────────────
    // paymentDueDayOffset: 実行日を基準とした支払期日のオフセット（日数）
    var TEST_ORDER_CONFIGS = [
      { invoiceNumber: 'TEST-0001', paymentDueDayOffset:  1 }, // 翌日  → 黄色バッジ
      { invoiceNumber: 'TEST-0002', paymentDueDayOffset: -1 }, // 前日  → 赤バッジ
      { invoiceNumber: 'TEST-0003', paymentDueDayOffset: 10 }, // 10日後 → 通常表示
    ];

    // ── オーダーID 採番ベース ─────────────────────────────────────────────────
    var orderMaxNum = 0;
    if (ordersLastRow >= 2) {
      var orderIdHeaderName = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
      var orderIdColIdx = ordersAllHeaders.indexOf(orderIdHeaderName);
      if (orderIdColIdx !== -1) {
        var orderIdValues = ordersSheet.getRange(2, orderIdColIdx + 1, ordersLastRow - 1, 1).getValues();
        orderIdValues.forEach(function(row) {
          var m = String(row[0] || '').trim().match(/^OD-(\d+)$/);
          if (m) {
            var n = parseInt(m[1], 10);
            if (n > orderMaxNum) orderMaxNum = n;
          }
        });
      }
    }

    // ── 為替レート取得 ──────────────────────────────────────────────────────
    var exchangeRate = 1;
    try {
      exchangeRate = getCurrentExchangeRate('JPY');
    } catch (e) {
      // JPY がマスタにない場合は 1 を使用
    }

    var now = new Date();

    // ── オーダー管理 書き込みターゲット ──────────────────────────────────────
    var ordersWriteTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
    var ordersHeaderIndexes = ordersWriteTarget.headerIndexes;

    function col(headerKey) {
      var name = getCoreSchemaV1HeaderName('ORDERS', headerKey);
      var idx  = ordersHeaderIndexes[name];
      if (!idx) throw new Error('ORDERS header index not found: ' + headerKey);
      return idx;
    }

    var ordersColCount = ordersSheet.getLastColumn();

    // ── オーダー明細 書き込みターゲット ──────────────────────────────────────
    var linesWriteTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
    var linesSheet = linesWriteTarget.sheet;
    var linesHeaderIndexes = linesWriteTarget.headerIndexes;

    var linesLastRow = linesSheet.getLastRow();
    var lineMaxNum = 0;
    if (linesLastRow >= 2) {
      var lineIdHeaderName = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
      var linesAllHeaders = linesSheet.getRange(1, 1, 1, linesSheet.getLastColumn()).getDisplayValues()[0];
      var lineIdColIdx = linesAllHeaders.indexOf(lineIdHeaderName);
      if (lineIdColIdx !== -1) {
        var lineIdValues = linesSheet.getRange(2, lineIdColIdx + 1, linesLastRow - 1, 1).getValues();
        lineIdValues.forEach(function(row) {
          var m = String(row[0] || '').trim().match(/^ODL-(\d+)$/);
          if (m) {
            var n = parseInt(m[1], 10);
            if (n > lineMaxNum) lineMaxNum = n;
          }
        });
      }
    }

    function lineCol(headerKey) {
      var name = getCoreSchemaV1HeaderName('ORDER_LINES', headerKey);
      var idx  = linesHeaderIndexes[name];
      if (!idx) throw new Error('ORDER_LINES header index not found: ' + headerKey);
      return idx;
    }

    var linesColCount = linesSheet.getLastColumn();

    // ── 3件ループ書き込み ─────────────────────────────────────────────────
    var createdOrders = [];
    for (var i = 0; i < TEST_ORDER_CONFIGS.length; i++) {
      var config = TEST_ORDER_CONFIGS[i];
      var orderId = 'OD-' + ('00000' + (orderMaxNum + 1 + i)).slice(-5);
      var orderLineId = 'ODL-' + ('00000' + (lineMaxNum + 1 + i)).slice(-5);
      var paymentDueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + config.paymentDueDayOffset);

      var orderStatus = calculateOrderStatus(
        { cancellationReason: '', status: '', paymentConfirmedAt: '', invoiceNumber: config.invoiceNumber },
        [], []
      );
      var paymentStatus = calculatePaymentStatus({
        cancellationReason: '', paymentConfirmedAt: '', paymentDueAt: paymentDueAt
      });

      var newOrderRow = new Array(ordersColCount);
      for (var j = 0; j < newOrderRow.length; j++) { newOrderRow[j] = ''; }
      newOrderRow[col('ORDER_ID')                  - 1] = orderId;
      newOrderRow[col('INVOICE_NUMBER')            - 1] = config.invoiceNumber;
      newOrderRow[col('CUSTOMER_ID')               - 1] = customerId;
      newOrderRow[col('SHIPPING_DESTINATION_ID')   - 1] = shippingDestId;
      newOrderRow[col('PAYMENT_DESTINATION_ID')    - 1] = paymentDestId;
      newOrderRow[col('SOURCE_LEAD_ID')            - 1] = sourceLeadId;
      newOrderRow[col('STATUS')                    - 1] = orderStatus;
      newOrderRow[col('CURRENCY')                  - 1] = 'JPY';
      newOrderRow[col('EXCHANGE_RATE')             - 1] = exchangeRate;
      newOrderRow[col('INVOICE_ISSUED_AT')         - 1] = now;
      newOrderRow[col('PAYMENT_DUE_AT')            - 1] = paymentDueAt;
      newOrderRow[col('PAYMENT_CONFIRMED_AT')      - 1] = '';
      newOrderRow[col('PAYMENT_CONFIRMATION_SOURCE') - 1] = '';
      newOrderRow[col('PAYMENT_CONFIRMED_BY_ID')   - 1] = '';
      newOrderRow[col('PAYMENT_STATUS')            - 1] = paymentStatus;
      newOrderRow[col('REGISTERED_AT')             - 1] = now;
      newOrderRow[col('UPDATED_AT')                - 1] = now;
      ordersSheet.appendRow(newOrderRow);

      var newLineRow = new Array(linesColCount);
      for (var k = 0; k < newLineRow.length; k++) { newLineRow[k] = ''; }
      newLineRow[lineCol('ORDER_LINE_ID') - 1] = orderLineId;
      newLineRow[lineCol('ORDER_ID')      - 1] = orderId;
      newLineRow[lineCol('LINE_NUMBER')   - 1] = 1;
      newLineRow[lineCol('PRODUCT_NAME')  - 1] = 'テスト商品';
      newLineRow[lineCol('QUANTITY')      - 1] = 1;
      newLineRow[lineCol('UNIT_PRICE')    - 1] = 10000;
      newLineRow[lineCol('SUBTOTAL')      - 1] = 10000;
      linesSheet.appendRow(newLineRow);

      createdOrders.push({ orderId: orderId, orderLineId: orderLineId });
    }

    return {
      success:    true,
      resultType: 'DEV_TEST_UNPAID_ORDERS_CREATED',
      orders:     createdOrders
    };
  } finally {
    lock.releaseLock();
  }
}
