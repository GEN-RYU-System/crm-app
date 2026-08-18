/**
 * 請求書読み書き API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   getCoreInvoicesForFrontend(sessionId)
 *   getCoreInvoiceForFrontend(sessionId, invoiceId)
 *   createCoreInvoiceForFrontend(sessionId, invoiceData)
 *   updateCoreInvoiceForFrontend(sessionId, invoiceId, invoiceData)
 *
 * 権限キー:
 *   閲覧: lead_view  — 顧客/リード閲覧と同じ権限階層に揃える
 *   書き込み: deal_edit — 請求書は商談編集の一部（営業・リーダー・オーナーが対象）
 */

/** 請求書ID接頭辞: INV-00001 形式 */
const CORE_INVOICE_ID_PREFIX = 'INV-';
/** 請求明細ID接頭辞: INVL-00001 形式 */
const CORE_INVOICE_LINE_ID_PREFIX = 'INVL-';
/** ID の連番部桁数 */
const CORE_INVOICE_ID_DIGITS = 5;

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 請求書管理を全件取得する。
 *
 * @param {string} sessionId
 * @returns {Object[]} 請求書レコードの配列
 */
function getCoreInvoicesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const ss = getSpreadsheet();
  const invoices = coreInvoiceReadTable(ss, 'INVOICES', [
    'INVOICE_ID', 'ORDER_ID', 'CUSTOMER_ID', 'LEAD_ID', 'QUOTE_ID', 'STAFF_ID',
    'ISSUED_DATE', 'DUE_DATE', 'STATUS', 'CURRENCY', 'EXCHANGE_RATE',
    'SUBTOTAL', 'SHIPPING_FEE', 'CUSTOMS_DUTY', 'DISCOUNT',
    'TOTAL_AMOUNT', 'TOTAL_AMOUNT_JPY',
    'PAYMENT_DUE_DATE', 'PAID_DATE', 'PAID_AMOUNT',
    'PDF_URL', 'NOTE', 'CREATED_AT', 'UPDATED_AT'
  ]);

  return invoices.rows
    .filter(function(row) { return coreInvoiceValue(row[invoices.indexes.INVOICE_ID]); })
    .map(function(row) { return coreInvoiceBuildRecord(row, invoices.indexes); });
}

/**
 * 請求書を個別取得する（ヘッダー + 明細行）。
 *
 * @param {string} sessionId
 * @param {string} invoiceId
 * @returns {{ invoice: Object, lines: Object[] } | null}
 */
function getCoreInvoiceForFrontend(sessionId, invoiceId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const normalizedId = coreInvoiceNormalizeId(invoiceId);
  if (!normalizedId) throw new Error('INVOICE_ID_REQUIRED');

  const ss = getSpreadsheet();
  const invoices = coreInvoiceReadTable(ss, 'INVOICES', [
    'INVOICE_ID', 'ORDER_ID', 'CUSTOMER_ID', 'LEAD_ID', 'QUOTE_ID', 'STAFF_ID',
    'ISSUED_DATE', 'DUE_DATE', 'STATUS', 'CURRENCY', 'EXCHANGE_RATE',
    'SUBTOTAL', 'SHIPPING_FEE', 'CUSTOMS_DUTY', 'DISCOUNT',
    'TOTAL_AMOUNT', 'TOTAL_AMOUNT_JPY',
    'PAYMENT_DUE_DATE', 'PAID_DATE', 'PAID_AMOUNT',
    'PDF_URL', 'NOTE', 'CREATED_AT', 'UPDATED_AT'
  ]);

  const invoiceRow = invoices.rows.find(function(row) {
    return coreInvoiceValue(row[invoices.indexes.INVOICE_ID]) === normalizedId;
  });
  if (!invoiceRow) return null;

  const linesData = coreInvoiceReadTable(ss, 'INVOICE_LINES', [
    'INVOICE_LINE_ID', 'INVOICE_ID', 'LINE_NO', 'PRODUCT_ID', 'PRODUCT_NAME',
    'DESCRIPTION', 'QUANTITY', 'UNIT_PRICE', 'AMOUNT', 'NOTE'
  ]);
  const matchedLines = linesData.rows
    .filter(function(row) {
      return coreInvoiceValue(row[linesData.indexes.INVOICE_ID]) === normalizedId;
    })
    .map(function(row) {
      return {
        invoiceLineId: coreInvoiceValue(row[linesData.indexes.INVOICE_LINE_ID]),
        invoiceId:     coreInvoiceValue(row[linesData.indexes.INVOICE_ID]),
        lineNo:        coreInvoiceNumber(row[linesData.indexes.LINE_NO]),
        productId:     coreInvoiceValue(row[linesData.indexes.PRODUCT_ID]),
        productName:   coreInvoiceValue(row[linesData.indexes.PRODUCT_NAME]),
        description:   coreInvoiceValue(row[linesData.indexes.DESCRIPTION]),
        quantity:      coreInvoiceNumber(row[linesData.indexes.QUANTITY]),
        unitPrice:     coreInvoiceNumber(row[linesData.indexes.UNIT_PRICE]),
        amount:        coreInvoiceNumber(row[linesData.indexes.AMOUNT]),
        note:          coreInvoiceValue(row[linesData.indexes.NOTE])
      };
    });

  return {
    invoice: coreInvoiceBuildRecord(invoiceRow, invoices.indexes),
    lines:   matchedLines
  };
}

/**
 * 請求書を新規作成する（明細も同時登録）。
 * 合計金額は明細から自動計算する（フロントの値を信用しない）。
 *
 * @param {string} sessionId
 * @param {{
 *   orderId: string,
 *   customerId: string,
 *   leadId: string,
 *   staffId: string,
 *   quoteId?: string,
 *   issuedDate?: string,
 *   dueDate?: string,
 *   currency?: string,
 *   exchangeRate?: number,
 *   shippingFee?: number,
 *   customsDuty?: number,
 *   discount?: number,
 *   paymentDueDate?: string,
 *   note?: string,
 *   lines?: Array<{productId?,productName?,description?,quantity,unitPrice,note?}>
 * }} invoiceData
 * @returns {{ success: true, invoiceId: string }}
 */
function createCoreInvoiceForFrontend(sessionId, invoiceData) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');
  coreInvoiceAssertRequiredFields(invoiceData);

  const ss = getSpreadsheet();
  coreInvoiceAssertOrderIdExists(ss,    String(invoiceData.orderId    || '').trim());
  coreInvoiceAssertCustomerIdExists(ss, String(invoiceData.customerId || '').trim());
  coreInvoiceAssertLeadIdExists(ss,     String(invoiceData.leadId     || '').trim());

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();

    const { sheet: invoiceSheet, headerIndexes: invoiceHI } =
      validateCoreSchemaV1TableForWrite(ss, 'INVOICES');

    const newInvoiceId = coreInvoiceGenerateNextInvoiceId(invoiceSheet, invoiceHI);
    const lines        = Array.isArray(invoiceData.lines) ? invoiceData.lines : [];
    const totals       = coreInvoiceCalculateTotals(lines, invoiceData);

    invoiceSheet.appendRow(coreInvoiceBuildInvoiceRow(invoiceSheet, invoiceHI, {
      INVOICE_ID:       newInvoiceId,
      ORDER_ID:         String(invoiceData.orderId    || '').trim(),
      CUSTOMER_ID:      String(invoiceData.customerId || '').trim(),
      LEAD_ID:          String(invoiceData.leadId     || '').trim(),
      QUOTE_ID:         String(invoiceData.quoteId    || '').trim(),
      STAFF_ID:         String(invoiceData.staffId    || '').trim(),
      ISSUED_DATE:      invoiceData.issuedDate     || '',
      DUE_DATE:         invoiceData.dueDate        || '',
      STATUS:           getCoreSchemaV1Value('INVOICES', 'STATUS', 'UNSENT'),
      CURRENCY:         String(invoiceData.currency || '').trim(),
      EXCHANGE_RATE:    totals.exchangeRate,
      SUBTOTAL:         totals.subtotal,
      SHIPPING_FEE:     totals.shippingFee,
      CUSTOMS_DUTY:     totals.customsDuty,
      DISCOUNT:         totals.discount,
      TOTAL_AMOUNT:     totals.totalAmount,
      TOTAL_AMOUNT_JPY: totals.totalAmountJpy,
      PAYMENT_DUE_DATE: invoiceData.paymentDueDate || '',
      PAID_DATE:        '',
      PAID_AMOUNT:      '',
      PDF_URL:          '',
      NOTE:             String(invoiceData.note || '').trim(),
      CREATED_AT:       now,
      UPDATED_AT:       now
    }));

    if (lines.length > 0) {
      const { sheet: lineSheet, headerIndexes: lineHI } =
        validateCoreSchemaV1TableForWrite(ss, 'INVOICE_LINES');
      coreInvoiceWriteLines(lineSheet, lineHI, newInvoiceId, lines);
    }

    return { success: true, invoiceId: newInvoiceId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 請求書を更新する。明細は全削除して再登録する方式。
 * 合計金額は明細から自動計算する（フロントの値を信用しない）。
 *
 * @param {string} sessionId
 * @param {string} invoiceId
 * @param {Object} invoiceData - createCoreInvoiceForFrontend と同じ形
 * @returns {{ success: true }}
 */
function updateCoreInvoiceForFrontend(sessionId, invoiceId, invoiceData) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');
  coreInvoiceAssertRequiredFields(invoiceData);

  const normalizedId = coreInvoiceNormalizeId(invoiceId);
  if (!normalizedId) throw new Error('INVOICE_ID_REQUIRED');

  const ss = getSpreadsheet();
  coreInvoiceAssertOrderIdExists(ss,    String(invoiceData.orderId    || '').trim());
  coreInvoiceAssertCustomerIdExists(ss, String(invoiceData.customerId || '').trim());
  coreInvoiceAssertLeadIdExists(ss,     String(invoiceData.leadId     || '').trim());

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();

    const { sheet: invoiceSheet, headerIndexes: invoiceHI } =
      validateCoreSchemaV1TableForWrite(ss, 'INVOICES');

    const targetRow = coreInvoiceFindRowById(invoiceSheet, invoiceHI, normalizedId);
    if (targetRow === -1) throw new Error('INVOICE_NOT_FOUND');

    const lines  = Array.isArray(invoiceData.lines) ? invoiceData.lines : [];
    const totals = coreInvoiceCalculateTotals(lines, invoiceData);

    const updateFields = {
      ORDER_ID:         String(invoiceData.orderId    || '').trim(),
      CUSTOMER_ID:      String(invoiceData.customerId || '').trim(),
      LEAD_ID:          String(invoiceData.leadId     || '').trim(),
      QUOTE_ID:         String(invoiceData.quoteId    || '').trim(),
      STAFF_ID:         String(invoiceData.staffId    || '').trim(),
      ISSUED_DATE:      invoiceData.issuedDate     || '',
      DUE_DATE:         invoiceData.dueDate        || '',
      CURRENCY:         String(invoiceData.currency || '').trim(),
      EXCHANGE_RATE:    totals.exchangeRate,
      SUBTOTAL:         totals.subtotal,
      SHIPPING_FEE:     totals.shippingFee,
      CUSTOMS_DUTY:     totals.customsDuty,
      DISCOUNT:         totals.discount,
      TOTAL_AMOUNT:     totals.totalAmount,
      TOTAL_AMOUNT_JPY: totals.totalAmountJpy,
      PAYMENT_DUE_DATE: invoiceData.paymentDueDate || '',
      NOTE:             String(invoiceData.note || '').trim(),
      UPDATED_AT:       now
    };
    if (invoiceData.status !== undefined) {
      updateFields.STATUS = String(invoiceData.status).trim();
    }
    if (invoiceData.paidDate !== undefined) {
      updateFields.PAID_DATE = invoiceData.paidDate || '';
    }
    if (invoiceData.paidAmount !== undefined) {
      updateFields.PAID_AMOUNT = coreInvoiceNumber(invoiceData.paidAmount) || '';
    }

    Object.keys(updateFields).forEach(function(headerKey) {
      const physicalHeader = getCoreSchemaV1HeaderName('INVOICES', headerKey);
      const colIdx = invoiceHI[physicalHeader];
      if (colIdx) invoiceSheet.getRange(targetRow, colIdx).setValue(updateFields[headerKey]);
    });

    const { sheet: lineSheet, headerIndexes: lineHI } =
      validateCoreSchemaV1TableForWrite(ss, 'INVOICE_LINES');
    coreInvoiceDeleteLines(lineSheet, lineHI, normalizedId);
    if (lines.length > 0) {
      coreInvoiceWriteLines(lineSheet, lineHI, normalizedId, lines);
    }

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * Core Schema V1 テーブルを読み取り、カラムインデックス付きで返す。
 */
function coreInvoiceReadTable(spreadsheet, tableKey, requiredHeaderKeys) {
  const table    = getCoreSchemaV1Table(tableKey);
  const sheet    = getCoreSchemaV1Sheet(spreadsheet, tableKey);
  const colCount = sheet.getLastColumn();
  const headers  = colCount > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, colCount).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];
  const indexes = {};
  requiredHeaderKeys.forEach(function(headerKey) {
    const headerName = getCoreSchemaV1HeaderName(tableKey, headerKey);
    const idx = headers.indexOf(headerName);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + headerKey);
    indexes[headerKey] = idx;
  });
  const dataRowCount = Math.max(0, sheet.getLastRow() - table.headerRowNumber);
  const rows = dataRowCount > 0
    ? sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, colCount).getValues()
    : [];
  return { indexes: indexes, rows: rows };
}

/** orderId / customerId / leadId / staffId の必須チェック */
function coreInvoiceAssertRequiredFields(invoiceData) {
  if (!invoiceData) throw new Error('INVOICE_DATA_REQUIRED');
  if (!String(invoiceData.orderId    || '').trim()) throw new Error('INVOICE_ORDER_ID_REQUIRED');
  if (!String(invoiceData.customerId || '').trim()) throw new Error('INVOICE_CUSTOMER_ID_REQUIRED');
  if (!String(invoiceData.leadId     || '').trim()) throw new Error('INVOICE_LEAD_ID_REQUIRED');
  if (!String(invoiceData.staffId    || '').trim()) throw new Error('INVOICE_STAFF_ID_REQUIRED');
}

/**
 * orderId が ORDERS シートに存在するか検証する。
 * 存在しない場合は INVOICE_ORDER_ID_NOT_FOUND を投げる。
 */
function coreInvoiceAssertOrderIdExists(spreadsheet, orderId) {
  const table      = getCoreSchemaV1Table('ORDERS');
  const sheet      = getCoreSchemaV1Sheet(spreadsheet, 'ORDERS');
  const lastRow    = sheet.getLastRow();
  const dataRowStart = table.headerRowNumber + 1;
  if (lastRow < dataRowStart) throw new Error('INVOICE_ORDER_ID_NOT_FOUND');
  const headers    = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  const idHeader   = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
  const colIdx     = headers.indexOf(idHeader);
  if (colIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ORDER_ID');
  const data = sheet.getRange(dataRowStart, colIdx + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === orderId) return;
  }
  throw new Error('INVOICE_ORDER_ID_NOT_FOUND');
}

/**
 * customerId が CUSTOMERS シートに存在するか検証する。
 * 存在しない場合は INVOICE_CUSTOMER_ID_NOT_FOUND を投げる。
 */
function coreInvoiceAssertCustomerIdExists(spreadsheet, customerId) {
  const table      = getCoreSchemaV1Table('CUSTOMERS');
  const sheet      = getCoreSchemaV1Sheet(spreadsheet, 'CUSTOMERS');
  const lastRow    = sheet.getLastRow();
  const dataRowStart = table.headerRowNumber + 1;
  if (lastRow < dataRowStart) throw new Error('INVOICE_CUSTOMER_ID_NOT_FOUND');
  const headers    = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  const idHeader   = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
  const colIdx     = headers.indexOf(idHeader);
  if (colIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: CUSTOMER_ID');
  const data = sheet.getRange(dataRowStart, colIdx + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === customerId) return;
  }
  throw new Error('INVOICE_CUSTOMER_ID_NOT_FOUND');
}

/**
 * leadId が LEADS シートに存在するか検証する。
 * 存在しない場合は INVOICE_LEAD_ID_NOT_FOUND を投げる。
 */
function coreInvoiceAssertLeadIdExists(spreadsheet, leadId) {
  const table      = getCoreSchemaV1Table('LEADS');
  const sheet      = getCoreSchemaV1Sheet(spreadsheet, 'LEADS');
  const lastRow    = sheet.getLastRow();
  const dataRowStart = table.headerRowNumber + 1;
  if (lastRow < dataRowStart) throw new Error('INVOICE_LEAD_ID_NOT_FOUND');
  const headers    = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  const idHeader   = getCoreSchemaV1HeaderName('LEADS', 'LEAD_ID');
  const colIdx     = headers.indexOf(idHeader);
  if (colIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: LEAD_ID');
  const data = sheet.getRange(dataRowStart, colIdx + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === leadId) return;
  }
  throw new Error('INVOICE_LEAD_ID_NOT_FOUND');
}

/**
 * 明細から合計金額を計算する。
 * AMOUNT = QUANTITY × UNIT_PRICE（フロントの値を使わない）
 * TOTAL_AMOUNT = SUBTOTAL + SHIPPING_FEE + CUSTOMS_DUTY - DISCOUNT
 */
function coreInvoiceCalculateTotals(lines, invoiceData) {
  const subtotal = lines.reduce(function(sum, line) {
    const qty   = coreInvoiceNumber(line.quantity)  || 0;
    const price = coreInvoiceNumber(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const exchangeRate   = coreInvoiceNumber(invoiceData.exchangeRate) || 1;
  const shippingFee    = coreInvoiceNumber(invoiceData.shippingFee)  || 0;
  const customsDuty    = coreInvoiceNumber(invoiceData.customsDuty)  || 0;
  const discount       = coreInvoiceNumber(invoiceData.discount)     || 0;
  const totalAmount    = subtotal + shippingFee + customsDuty - discount;
  const totalAmountJpy = totalAmount * exchangeRate;
  return {
    subtotal:      subtotal,
    exchangeRate:  exchangeRate,
    shippingFee:   shippingFee,
    customsDuty:   customsDuty,
    discount:      discount,
    totalAmount:   totalAmount,
    totalAmountJpy: totalAmountJpy
  };
}

/**
 * 請求書ID（INV-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 */
function coreInvoiceGenerateNextInvoiceId(sheet, headerIndexes) {
  const invoiceIdHeader = getCoreSchemaV1HeaderName('INVOICES', 'INVOICE_ID');
  const colIdx = headerIndexes[invoiceIdHeader];
  let maxNum = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      const id = String(row[0] || '').trim();
      if (id.startsWith(CORE_INVOICE_ID_PREFIX)) {
        const num = parseInt(id.slice(CORE_INVOICE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_INVOICE_ID_PREFIX + String(maxNum + 1).padStart(CORE_INVOICE_ID_DIGITS, '0');
}

/**
 * 請求明細ID（INVL-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 */
function coreInvoiceGenerateNextLineId(sheet, headerIndexes) {
  const lineIdHeader = getCoreSchemaV1HeaderName('INVOICE_LINES', 'INVOICE_LINE_ID');
  const colIdx = headerIndexes[lineIdHeader];
  let maxNum = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      const id = String(row[0] || '').trim();
      if (id.startsWith(CORE_INVOICE_LINE_ID_PREFIX)) {
        const num = parseInt(id.slice(CORE_INVOICE_LINE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_INVOICE_LINE_ID_PREFIX + String(maxNum + 1).padStart(CORE_INVOICE_ID_DIGITS, '0');
}

/**
 * INVOICES シートへ書き込む1行分の配列を構築する。
 * headerKey → getCoreSchemaV1HeaderName で物理名を解決する。
 */
function coreInvoiceBuildInvoiceRow(sheet, headerIndexes, fieldMap) {
  const lastCol = sheet.getLastColumn();
  const rowData = new Array(lastCol).fill('');
  Object.keys(fieldMap).forEach(function(headerKey) {
    const physicalHeader = getCoreSchemaV1HeaderName('INVOICES', headerKey);
    const colIdx = headerIndexes[physicalHeader];
    if (colIdx) rowData[colIdx - 1] = fieldMap[headerKey];
  });
  return rowData;
}

/**
 * INVOICES シートで INVOICE_ID が一致する行番号（1-indexed）を返す。見つからなければ -1。
 */
function coreInvoiceFindRowById(sheet, headerIndexes, invoiceId) {
  const invoiceIdHeader = getCoreSchemaV1HeaderName('INVOICES', 'INVOICE_ID');
  const colIdx = headerIndexes[invoiceIdHeader];
  if (!colIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: INVOICE_ID');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][colIdx - 1] || '').trim() === invoiceId) return i + 2;
  }
  return -1;
}

/**
 * INVOICE_LINES シートに明細行を書き込む。
 * AMOUNT = QUANTITY × UNIT_PRICE で自動計算。
 */
function coreInvoiceWriteLines(sheet, headerIndexes, invoiceId, lines) {
  lines.forEach(function(line, index) {
    const lineId  = coreInvoiceGenerateNextLineId(sheet, headerIndexes);
    const qty     = coreInvoiceNumber(line.quantity)  || 0;
    const price   = coreInvoiceNumber(line.unitPrice) || 0;
    const amount  = qty * price;
    const lastCol = sheet.getLastColumn();
    const rowData = new Array(lastCol).fill('');
    var fieldMap = {
      INVOICE_LINE_ID: lineId,
      INVOICE_ID:      invoiceId,
      LINE_NO:         index + 1,
      PRODUCT_ID:      String(line.productId   || '').trim(),
      PRODUCT_NAME:    String(line.productName || '').trim(),
      DESCRIPTION:     String(line.description || '').trim(),
      QUANTITY:        qty,
      UNIT_PRICE:      price,
      AMOUNT:          amount,
      NOTE:            String(line.note || '').trim()
    };
    Object.keys(fieldMap).forEach(function(headerKey) {
      const physicalHeader = getCoreSchemaV1HeaderName('INVOICE_LINES', headerKey);
      const colIdx = headerIndexes[physicalHeader];
      if (colIdx) rowData[colIdx - 1] = fieldMap[headerKey];
    });
    sheet.appendRow(rowData);
  });
}

/**
 * INVOICE_LINES シートから指定 invoiceId の行をすべて削除する。
 * 行番号のズレを防ぐため、下から順に削除する。
 */
function coreInvoiceDeleteLines(sheet, headerIndexes, invoiceId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const invoiceIdHeader = getCoreSchemaV1HeaderName('INVOICE_LINES', 'INVOICE_ID');
  const colIdx = headerIndexes[invoiceIdHeader];
  if (!colIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: INVOICE_ID');
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const rowsToDelete = [];
  data.forEach(function(row, i) {
    if (String(row[colIdx - 1] || '').trim() === invoiceId) rowsToDelete.push(i + 2);
  });
  for (let j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
}

/** 生データ行を JS オブジェクトに変換する */
function coreInvoiceBuildRecord(row, indexes) {
  return {
    invoiceId:      coreInvoiceValue(row[indexes.INVOICE_ID]),
    orderId:        coreInvoiceValue(row[indexes.ORDER_ID]),
    customerId:     coreInvoiceValue(row[indexes.CUSTOMER_ID]),
    leadId:         coreInvoiceValue(row[indexes.LEAD_ID]),
    quoteId:        coreInvoiceValue(row[indexes.QUOTE_ID]),
    staffId:        coreInvoiceValue(row[indexes.STAFF_ID]),
    issuedDate:     coreInvoiceValue(row[indexes.ISSUED_DATE]),
    dueDate:        coreInvoiceValue(row[indexes.DUE_DATE]),
    status:         coreInvoiceValue(row[indexes.STATUS]),
    currency:       coreInvoiceValue(row[indexes.CURRENCY]),
    exchangeRate:   coreInvoiceNumber(row[indexes.EXCHANGE_RATE]),
    subtotal:       coreInvoiceNumber(row[indexes.SUBTOTAL]),
    shippingFee:    coreInvoiceNumber(row[indexes.SHIPPING_FEE]),
    customsDuty:    coreInvoiceNumber(row[indexes.CUSTOMS_DUTY]),
    discount:       coreInvoiceNumber(row[indexes.DISCOUNT]),
    totalAmount:    coreInvoiceNumber(row[indexes.TOTAL_AMOUNT]),
    totalAmountJpy: coreInvoiceNumber(row[indexes.TOTAL_AMOUNT_JPY]),
    paymentDueDate: coreInvoiceValue(row[indexes.PAYMENT_DUE_DATE]),
    paidDate:       coreInvoiceValue(row[indexes.PAID_DATE]),
    paidAmount:     coreInvoiceNumber(row[indexes.PAID_AMOUNT]),
    pdfUrl:         coreInvoiceValue(row[indexes.PDF_URL]),
    note:           coreInvoiceValue(row[indexes.NOTE]),
    createdAt:      coreInvoiceValue(row[indexes.CREATED_AT]),
    updatedAt:      coreInvoiceValue(row[indexes.UPDATED_AT])
  };
}

/** セル値を文字列に正規化する */
function coreInvoiceValue(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return String(value).trim();
}

/** セル値を数値に変換する。変換不能な場合は null */
function coreInvoiceNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = coreInvoiceValue(value).replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** invoiceId を文字列にトリムする */
function coreInvoiceNormalizeId(value) {
  return String(value || '').trim();
}
