/**
 * オーダー書き込み API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   createCoreOrderForFrontend(sessionId, payload)
 *   confirmCoreOrderPaymentForFrontend(sessionId, orderId)
 * 権限キー:
 *   書き込み: deal_edit
 */

/* global getCoreSchemaV1HeaderName, getCoreSchemaV1Value, getCoreSchemaV1Sheet, withSheetWrite_,
   validateCoreSchemaV1TableForWrite, setEmailFromSession, checkPermission,
   validateQuoteLineInventory_, calculateOrderStatus, calculatePaymentStatus,
   getCurrentExchangeRate, getSettingValue, getSessionUser, recalculateOrderStatusById,
   readDetailSheet_,
   SpreadsheetApp, getSpreadsheet, LockService */

/** オーダーID接頭辞: OD-00001 形式 */
var CORE_ORDER_WRITE_ID_PREFIX = 'OD-';
/** 明細ID接頭辞: ODL-00001 形式 */
var CORE_ORDER_WRITE_LINE_ID_PREFIX = 'ODL-';
var CORE_ORDER_WRITE_INVOICE_ID_PREFIX = 'INV-';
/** ID の連番部桁数 */
var CORE_ORDER_WRITE_ID_DIGITS = 5;

var CORE_ORDER_WRITE_CACHE_TARGETS = [
  { indexKey: CORE_ORDERS_CACHE_INDEX, prefix: CORE_ORDERS_CACHE_PREFIX }
];

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * オーダーを新規作成する（明細も同時登録）。
 * 金額はサーバーサイドで計算する（フロントの値を信用しない）。
 * 為替レートは通貨マスタから取得する（フロントからの値は使わない）。
 * 受注日・支払期日はサーバー側で自動設定する（フロントから受け取らない）:
 *   - 受注日  : 今日の日付
 *   - 支払期日: 受注日 + 設定値「オーダー支払期日日数」日数（既定値 2）
 *
 * @param {string} sessionId
 * @param {{
 *   customerId: string,
 *   shippingDestinationId: string,
 *   paymentDestinationId: string,
 *   currency: string,
 *   paymentMethod: string,
 *   shippingFee?: string,
 *   duty?: string,
 *   otherFee?: string,
 *   discount?: string,
 *   internalNote?: string,
 *   lines: Array<{
 *     productId: string,
 *     productName: string,
 *     category: string,
 *     status: string,
 *     quantity: string,
 *     unitPrice: string
 *   }>
 * }} payload
 * @returns {{ success: true, orderId: string }}
 */
function createCoreOrderForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  // 必須フィールドのバリデーション
  var customerId = coreOrderWriteValue(payload.customerId);
  var shippingDestinationId = coreOrderWriteValue(payload.shippingDestinationId);
  var paymentDestinationId = coreOrderWriteValue(payload.paymentDestinationId);
  var currency = coreOrderWriteValue(payload.currency);
  var paymentMethod = coreOrderWriteValue(payload.paymentMethod);
  var isDraft = payload.isDraft !== false;
  var requestedInvoiceNumber = coreOrderWriteValue(payload.invoiceNumber);
  var lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!customerId) throw new Error('MISSING_CUSTOMER_ID');
  if (!shippingDestinationId) throw new Error('MISSING_SHIPPING_DESTINATION_ID');
  if (!paymentDestinationId) throw new Error('MISSING_PAYMENT_DESTINATION_ID');
  if (!currency) throw new Error('MISSING_CURRENCY');
  if (!paymentMethod) throw new Error('MISSING_PAYMENT_METHOD');
  if (!lines.length) throw new Error('MISSING_LINES');
  var invoiceIssuedAt = '';
  var invoiceNumber = '';
  if (!isDraft) {
    invoiceIssuedAt = new Date();
    if (paymentMethod.toUpperCase() === 'WISE') invoiceNumber = generateNextInvoiceNumber();
    else if (paymentMethod.toUpperCase() === 'PAYPAL') {
      // 将来は PayPal API から請求書番号を取得する。
      if (!requestedInvoiceNumber) throw new Error('INVOICE_NUMBER_REQUIRED');
      invoiceNumber = requestedInvoiceNumber;
    }
  }

  // 在庫バリデーション（condition / productId が指定された行のみ）
  validateQuoteLineInventory_(lines);

  // 為替レートは通貨マスタからサーバーサイドで取得する（フロントの値を使わない）
  var exchangeRate = getCurrentExchangeRate(currency);
  var shippingFee = coreOrderWriteNormalizeNumeric(payload.shippingFee, 'shippingFee') || 0;
  var duty = coreOrderWriteNormalizeNumeric(payload.duty, 'duty') || 0;
  var otherFee = coreOrderWriteNormalizeNumeric(payload.otherFee, 'otherFee') || 0;
  var discount = coreOrderWriteNormalizeNumeric(payload.discount, 'discount') || 0;
  var shippingNote = coreOrderWriteValue(payload.shippingNote);
  var internalNote = coreOrderWriteValue(payload.internalNote);

  // 明細合計の計算（サーバーサイド）
  var lineTotal = lines.reduce(function(sum, line) {
    var qty = coreOrderWriteNormalizeNumeric(line.quantity, 'quantity') || 0;
    var unitPrice = coreOrderWriteNormalizeNumeric(line.unitPrice, 'unitPrice') || 0;
    return sum + qty * unitPrice;
  }, 0);

  var invoiceTotal = lineTotal + shippingFee + duty + otherFee - discount;
  var invoiceTotalJpy = Math.round(invoiceTotal * exchangeRate);

  // 顧客情報の取得（sourceLeadId のため）
  var ss = getSpreadsheet();
  var sourceLeadId = coreOrderWriteGetSourceLeadId(ss, customerId);

  return withSheetWrite_(
    { useLock: true, cacheTargets: CORE_ORDER_WRITE_CACHE_TARGETS },
    function() {
      var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
      var orderSheet = ordersResult.sheet;
      var orderHI = ordersResult.headerIndexes;

      var linesResult = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
      var lineSheet = linesResult.sheet;
      var lineHI = linesResult.headerIndexes;

      var now = new Date();
      var newOrderId = coreOrderWriteGenerateNextOrderId(orderSheet, orderHI);

      // 受注日・支払期日をサーバー側で自動計算する（フロントの値を使わない）
      var dueDays = parseInt(getSettingValue('オーダー支払期日日数') || '2', 10);
      if (isNaN(dueDays) || dueDays <= 0) dueDays = 2;
      var paymentDueDate = new Date(now.getTime());
      paymentDueDate.setDate(paymentDueDate.getDate() + dueDays);
      var paymentTermsLabel = String(dueDays) + '\u65e5\u5f8c'; // "N日後"

      // 新規作成時のステータス判定（invoiceNumber も paymentConfirmedAt もない → 不明）
      var orderStatus = calculateOrderStatus(
        {
          cancellationReason: '',
          status: '',
          paymentConfirmedAt: '',
          invoiceNumber: ''
        },
        [],
        []
      );

      var paymentStatus = calculatePaymentStatus({
        cancellationReason: '',
        paymentConfirmedAt: '',
        paymentDueAt: paymentDueDate
      });

      // paymentMethod / currency は getCoreSchemaV1Value で解決
      var paymentMethodValue = getCoreSchemaV1Value('ORDERS', 'PAYMENT_METHOD', paymentMethod.toUpperCase());

      // オーダー行の構築
      var maxCols = orderSheet.getLastColumn();
      var orderRow = new Array(maxCols).fill('');

      function setOrderCell(colKey, value) {
        var header = getCoreSchemaV1HeaderName('ORDERS', colKey);
        var idx = orderHI[header];
        if (idx) orderRow[idx - 1] = value;
      }

      setOrderCell('ORDER_ID', newOrderId);
      setOrderCell('CUSTOMER_ID', customerId);
      setOrderCell('SHIPPING_DESTINATION_ID', shippingDestinationId);
      setOrderCell('PAYMENT_DESTINATION_ID', paymentDestinationId);
      setOrderCell('SOURCE_LEAD_ID', sourceLeadId);
      setOrderCell('STATUS', orderStatus);
      setOrderCell('ORDER_DATE', now);
      setOrderCell('CURRENCY', currency);
      setOrderCell('EXCHANGE_RATE', exchangeRate);
      setOrderCell('LINE_TOTAL', lineTotal);
      setOrderCell('SHIPPING_FEE', shippingFee);
      setOrderCell('DUTY', duty);
      setOrderCell('OTHER_FEE', otherFee);
      setOrderCell('DISCOUNT', discount);
      setOrderCell('INVOICE_TOTAL', invoiceTotal);
      setOrderCell('INVOICE_ISSUED_AT', invoiceIssuedAt);
      setOrderCell('INVOICE_NUMBER', invoiceNumber);
      setOrderCell('PAYMENT_METHOD', paymentMethodValue);
      setOrderCell('PAYMENT_DUE_AT', paymentDueDate);
      setOrderCell('PAYMENT_TERMS', paymentTermsLabel);
      setOrderCell('REGISTERED_AT', now);
      setOrderCell('UPDATED_AT', now);
      setOrderCell('PAYMENT_STATUS', paymentStatus);
      setOrderCell('INVOICE_TOTAL_JPY', invoiceTotalJpy);
      setOrderCell('SHIPPING_NOTE', shippingNote);
      setOrderCell('INTERNAL_NOTE', internalNote);

      orderSheet.appendRow(orderRow);

      // 明細行: 全IDを採番してから書き込む
      var nextLineNum = coreOrderWriteGetNextLineMaxNum(lineSheet, lineHI);

      lines.forEach(function(line, i) {
        var qty = coreOrderWriteNormalizeNumeric(line.quantity, 'quantity') || 0;
        var unitPrice = coreOrderWriteNormalizeNumeric(line.unitPrice, 'unitPrice') || 0;
        var subtotal = qty * unitPrice;
        var lineId = CORE_ORDER_WRITE_LINE_ID_PREFIX + String(nextLineNum + i + 1).padStart(CORE_ORDER_WRITE_ID_DIGITS, '0');

        var maxLineCols = lineSheet.getLastColumn();
        var lineRow = new Array(maxLineCols).fill('');

        function setLineCell(colKey, value) {
          var header = getCoreSchemaV1HeaderName('ORDER_LINES', colKey);
          var idx = lineHI[header];
          if (idx) lineRow[idx - 1] = value;
        }

        setLineCell('ORDER_LINE_ID', lineId);
        setLineCell('ORDER_ID', newOrderId);
        setLineCell('LINE_NUMBER', i + 1);
        setLineCell('CATEGORY', coreOrderWriteValue(line.category));
        setLineCell('PRODUCT_NAME', coreOrderWriteValue(line.productName));
        setLineCell('STATUS', coreOrderWriteValue(line.status));
        setLineCell('QUANTITY', qty);
        setLineCell('UNIT_PRICE', unitPrice);
        setLineCell('SUBTOTAL', subtotal);
        setLineCell('PRODUCT_ID', coreOrderWriteValue(line.productId));

        lineSheet.appendRow(lineRow);
      });

      return { success: true, orderId: newOrderId };
    }
  );
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * セル値を文字列に正規化する。
 * @param {*} v
 * @returns {string}
 */
function coreOrderWriteValue(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * 数値フィールドを正規化する。
 * - 全角数字 → 半角変換
 * - 空文字 → null
 * - 不正な値 → エラー
 *
 * @param {*} value
 * @param {string} fieldName
 * @returns {number|null}
 */
function coreOrderWriteNormalizeNumeric(value, fieldName) {
  var s = coreOrderWriteValue(value)
    .replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  if (!s) return null;
  if (!/^[0-9]+(\.[0-9]*)?$/.test(s)) throw new Error('INVALID_NUMERIC_FIELD:' + fieldName);
  var n = Number(s);
  if (!isFinite(n)) throw new Error('INVALID_NUMERIC_FIELD:' + fieldName);
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
function coreOrderWriteGenerateNextOrderId(sheet, headerIndexes) {
  var orderIdHeader = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
  var colIdx = headerIndexes[orderIdHeader];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.startsWith(CORE_ORDER_WRITE_ID_PREFIX)) {
        var num = parseInt(id.slice(CORE_ORDER_WRITE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_ORDER_WRITE_ID_PREFIX + String(maxNum + 1).padStart(CORE_ORDER_WRITE_ID_DIGITS, '0');
}

/**
 * 請求書番号（INV-00001 形式）を採番する。既存の INV- 系のみを対象にする。
 * @returns {string}
 */
function generateNextInvoiceNumber() {
  var ss = getSpreadsheet();
  var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
  var sheet = ordersResult.sheet;
  var invoiceHeader = getCoreSchemaV1HeaderName('ORDERS', 'INVOICE_NUMBER');
  var colIdx = ordersResult.headerIndexes[invoiceHeader];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var value = String(row[0] || '').trim();
      if (!value.startsWith(CORE_ORDER_WRITE_INVOICE_ID_PREFIX)) return;
      var num = parseInt(value.slice(CORE_ORDER_WRITE_INVOICE_ID_PREFIX.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
  }
  return CORE_ORDER_WRITE_INVOICE_ID_PREFIX + String(maxNum + 1).padStart(CORE_ORDER_WRITE_ID_DIGITS, '0');
}

/** テスト用の読み取り専用ラッパー。 */
function testGenerateNextInvoiceNumber() {
  return generateNextInvoiceNumber();
}

/**
 * ORDER_LINES シートの明細ID最大連番を取得する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes
 * @returns {number}
 */
function coreOrderWriteGetNextLineMaxNum(sheet, headerIndexes) {
  var lineIdHeader = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
  var colIdx = headerIndexes[lineIdHeader];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.startsWith(CORE_ORDER_WRITE_LINE_ID_PREFIX)) {
        var num = parseInt(id.slice(CORE_ORDER_WRITE_LINE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return maxNum;
}

/**
 * 顧客ID から源流リードID を取得する。
 * 見つからない場合は空文字列を返す（エラーにしない）。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} customerId
 * @returns {string}
 */
function coreOrderWriteGetSourceLeadId(ss, customerId) {
  var sheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var customerIdHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
  var sourceLeadIdHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'SOURCE_LEAD_ID');
  var cidIdx = headers.indexOf(customerIdHeader);
  var slidIdx = headers.indexOf(sourceLeadIdHeader);
  if (cidIdx < 0 || slidIdx < 0) return '';

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][cidIdx] || '').trim() === customerId) {
      return String(data[i][slidIdx] || '').trim();
    }
  }
  return '';
}

/**
 * オーダーの入金を確認する。
 * STATUS が「支払い待ち」のオーダーにのみ適用する。
 *
 * @param {string} sessionId
 * @param {string} orderId
 * @returns {{ success: true, status: string, paymentStatus: string }
 *          | { success: false, reason: 'INVALID_STATUS' | 'NOT_FOUND' }}
 */
function confirmCoreOrderPaymentForFrontend(sessionId, orderId) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  var ss = getSpreadsheet();

  // 現在のオーダー状態を読む（ロック外）
  var orderData = readDetailSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'PAYMENT_DUE_AT', 'CANCELLATION_REASON'
  ]);
  var orderRow = null;
  for (var i = 0; i < orderData.length; i++) {
    if (String(orderData[i].ORDER_ID || '').trim() === String(orderId || '').trim()) {
      orderRow = orderData[i];
      break;
    }
  }
  if (!orderRow) return { success: false, reason: 'NOT_FOUND' };

  var awaitingPaymentStatus = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');
  if (String(orderRow.STATUS || '').trim() !== awaitingPaymentStatus) {
    return { success: false, reason: 'INVALID_STATUS' };
  }

  // セッションから担当者IDを取得
  var sessionUser = getSessionUser(sessionId);
  if (!sessionUser) throw new Error('SESSION_INVALID');
  var staffId = sessionUser.staffId;

  // ロック外で書き込み値を確定する
  var now = new Date();
  var newPaymentStatus = calculatePaymentStatus({
    cancellationReason: orderRow.CANCELLATION_REASON || '',
    paymentConfirmedAt: now,
    paymentDueAt:       orderRow.PAYMENT_DUE_AT || ''
  });
  var confirmationSource = getCoreSchemaV1Value('ORDERS', 'PAYMENT_CONFIRMATION_SOURCE', 'MANUAL');

  // ロック内で書き込む
  withSheetWrite_(
    { useLock: true, cacheTargets: CORE_ORDER_WRITE_CACHE_TARGETS },
    function() {
      var ordersResult = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
      var orderSheet   = ordersResult.sheet;
      var orderHI      = ordersResult.headerIndexes;

      var orderIdPhysical = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
      var orderIdColIdx   = orderHI[orderIdPhysical];
      if (!orderIdColIdx) throw new Error('ORDER_ID 列が見つかりません');

      var lastRow = orderSheet.getLastRow();
      var targetSheetRow = -1;
      if (lastRow >= 2) {
        var idValues = orderSheet.getRange(2, orderIdColIdx, lastRow - 1, 1).getValues();
        for (var r = 0; r < idValues.length; r++) {
          if (String(idValues[r][0] || '').trim() === String(orderId || '').trim()) {
            targetSheetRow = r + 2;
            break;
          }
        }
      }
      if (targetSheetRow < 0) throw new Error('ORDER_NOT_FOUND: ' + orderId);

      function setOrderCell(colKey, value) {
        var header = getCoreSchemaV1HeaderName('ORDERS', colKey);
        var idx    = orderHI[header];
        if (idx) orderSheet.getRange(targetSheetRow, idx).setValue(value);
      }

      setOrderCell('PAYMENT_CONFIRMED_AT',         now);
      setOrderCell('PAYMENT_CONFIRMED_BY_ID',       staffId);
      setOrderCell('PAYMENT_CONFIRMATION_SOURCE',   confirmationSource);
      setOrderCell('PAYMENT_STATUS',                newPaymentStatus);
      setOrderCell('UPDATED_AT',                    now);
    }
  );

  // ロック解放後にSTATUSを再計算・書き込む
  var newStatus = recalculateOrderStatusById(orderId);

  return { success: true, status: newStatus, paymentStatus: newPaymentStatus };
}
