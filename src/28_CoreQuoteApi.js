/**
 * 見積もり読み書き API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   getCoreQuotesForFrontend(sessionId)
 *   getCoreQuoteForFrontend(sessionId, quoteId)
 *   createCoreQuoteForFrontend(sessionId, quoteData, isDraft)
 *   updateCoreQuoteForFrontend(sessionId, quoteId, quoteData, isDraft)
 *   setupQuoteExpirySetting()
 *
 * 権限キー:
 *   閲覧: lead_view  — 顧客/リード閲覧と同じ権限階層に揃える
 *   書き込み: deal_edit — 見積もりは商談編集の一部（営業・リーダー・オーナーが対象）
 */

/** 見積書ID接頭辞: QT-00001 形式 */
const CORE_QUOTE_ID_PREFIX = 'QT-';
/** 見積明細ID接頭辞: QTL-00001 形式 */
const CORE_QUOTE_LINE_ID_PREFIX = 'QTL-';
/** ID の連番部桁数 */
const CORE_QUOTE_ID_DIGITS = 5;

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 見積もり管理を全件取得する。
 *
 * @param {string} sessionId
 * @returns {Object[]} 見積もりレコードの配列
 */
function getCoreQuotesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const ss = getSpreadsheet();

  // 顧客マスタを1回だけ読み、CUSTOMER_ID → 顧客名 の対応表を作る
  const customers = coreQuoteReadTable(ss, 'CUSTOMERS', ['CUSTOMER_ID', 'CUSTOMER_NAME']);
  const customerNameById = customers.rows.reduce(function(map, row) {
    const id   = coreQuoteValue(row[customers.indexes.CUSTOMER_ID]);
    const name = coreQuoteValue(row[customers.indexes.CUSTOMER_NAME]);
    if (id) map[id] = name;
    return map;
  }, {});

  // リード管理を1回だけ読み、LEAD_ID → 顧客名 の対応表を作る（CUSTOMER_ID が空の見積もりに使う）
  const leads = coreQuoteReadTable(ss, 'LEADS', ['LEAD_ID', 'CUSTOMER_NAME']);
  const customerNameByLeadId = leads.rows.reduce(function(map, row) {
    const id   = coreQuoteValue(row[leads.indexes.LEAD_ID]);
    const name = coreQuoteValue(row[leads.indexes.CUSTOMER_NAME]);
    if (id) map[id] = name;
    return map;
  }, {});

  const quotes = coreQuoteReadTable(ss, 'QUOTES', [
    'QUOTE_ID', 'LEAD_ID', 'CUSTOMER_ID', 'ORDER_ID', 'STAFF_ID',
    'ISSUED_DATE', 'EXPIRY_DATE', 'STATUS', 'CURRENCY', 'EXCHANGE_RATE',
    'SUBTOTAL', 'SHIPPING_FEE', 'DISCOUNT', 'TOTAL_AMOUNT', 'TOTAL_AMOUNT_JPY',
    'PDF_URL', 'NOTE', 'CREATED_AT', 'UPDATED_AT'
  ]);

  return quotes.rows
    .filter(function(row) { return coreQuoteValue(row[quotes.indexes.QUOTE_ID]); })
    .map(function(row) {
      const record = coreQuoteBuildRecord(row, quotes.indexes);
      const customerName =
        (record.customerId && customerNameById[record.customerId]) ||
        (record.leadId     && customerNameByLeadId[record.leadId])  ||
        '';
      return Object.assign({}, record, { customerName: customerName });
    });
}

/**
 * 見積もりを個別取得する（ヘッダー + 明細行）。
 *
 * @param {string} sessionId
 * @param {string} quoteId
 * @returns {{ quote: Object, lines: Object[] } | null}
 */
function getCoreQuoteForFrontend(sessionId, quoteId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const normalizedId = coreQuoteNormalizeId(quoteId);
  if (!normalizedId) throw new Error('QUOTE_ID_REQUIRED');

  const ss = getSpreadsheet();
  const quotes = coreQuoteReadTable(ss, 'QUOTES', [
    'QUOTE_ID', 'LEAD_ID', 'CUSTOMER_ID', 'ORDER_ID', 'STAFF_ID',
    'ISSUED_DATE', 'EXPIRY_DATE', 'STATUS', 'CURRENCY', 'EXCHANGE_RATE',
    'SUBTOTAL', 'SHIPPING_FEE', 'DISCOUNT', 'TOTAL_AMOUNT', 'TOTAL_AMOUNT_JPY',
    'PDF_URL', 'NOTE', 'CREATED_AT', 'UPDATED_AT'
  ]);

  const quoteRow = quotes.rows.find(function(row) {
    return coreQuoteValue(row[quotes.indexes.QUOTE_ID]) === normalizedId;
  });
  if (!quoteRow) return null;

  const linesData = coreQuoteReadTable(ss, 'QUOTE_LINES', [
    'QUOTE_LINE_ID', 'QUOTE_ID', 'LINE_NO', 'PRODUCT_ID', 'PRODUCT_NAME',
    'DESCRIPTION', 'QUANTITY', 'UNIT_PRICE', 'AMOUNT', 'NOTE'
  ]);
  const matchedLines = linesData.rows
    .filter(function(row) {
      return coreQuoteValue(row[linesData.indexes.QUOTE_ID]) === normalizedId;
    })
    .map(function(row) {
      return {
        quoteLineId:  coreQuoteValue(row[linesData.indexes.QUOTE_LINE_ID]),
        quoteId:      coreQuoteValue(row[linesData.indexes.QUOTE_ID]),
        lineNo:       coreQuoteNumber(row[linesData.indexes.LINE_NO]),
        productId:    coreQuoteValue(row[linesData.indexes.PRODUCT_ID]),
        productName:  coreQuoteValue(row[linesData.indexes.PRODUCT_NAME]),
        description:  coreQuoteValue(row[linesData.indexes.DESCRIPTION]),
        quantity:     coreQuoteNumber(row[linesData.indexes.QUANTITY]),
        unitPrice:    coreQuoteNumber(row[linesData.indexes.UNIT_PRICE]),
        amount:       coreQuoteNumber(row[linesData.indexes.AMOUNT]),
        note:         coreQuoteValue(row[linesData.indexes.NOTE])
      };
    });

  return {
    quote: coreQuoteBuildRecord(quoteRow, quotes.indexes),
    lines: matchedLines
  };
}

/**
 * 見積もりを新規作成する（明細も同時登録）。
 * 合計金額は明細から自動計算する（フロントの値を信用しない）。
 * staffId はセッションから自動解決する。
 * issuedDate / expiryDate はサーバー側で自動計算する。
 *
 * 以下はサーバー側で自動設定する（フロントから受け取らない）:
 *   - staffId   : セッションから取得
 *   - issuedDate: 今日の日付
 *   - expiryDate: 発行日 + 設定値「見積もり有効期限日数」日数
 *
 * @param {string} sessionId
 * @param {{
 *   leadId: string,
 *   currency?: string,
 *   shippingFee?: string,
 *   discount?: string,
 *   note?: string,
 *   lines?: Array<{productName?,description?,quantity,unitPrice}>
 * }} quoteData
 * @param {boolean} isDraft  true → 下書き / false → 発行済み
 * @returns {{ success: true, quoteId: string }}
 */
function createCoreQuoteForFrontend(sessionId, quoteData, isDraft) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');
  coreQuoteAssertRequiredFields(quoteData);

  const sessionUser = getSessionUser(sessionId);
  if (!sessionUser) throw new Error('SESSION_INVALID');
  const staffId = sessionUser.staffId;

  const ss = getSpreadsheet();
  coreQuoteAssertLeadIdExists(ss, String(quoteData.leadId || '').trim());

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();

    // 発行日・有効期限を自動計算する
    var issuedDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
    var expiryDays = parseInt(getSettingValue('見積もり有効期限日数') || '30', 10);
    if (isNaN(expiryDays) || expiryDays <= 0) expiryDays = 30;
    var expiryDate = new Date(now.getTime());
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    var expiryDateStr = Utilities.formatDate(expiryDate, 'Asia/Tokyo', 'yyyy-MM-dd');

    var status = isDraft
      ? getCoreSchemaV1Value('QUOTES', 'STATUS', 'DRAFT')
      : getCoreSchemaV1Value('QUOTES', 'STATUS', 'ISSUED');

    const { sheet: quoteSheet, headerIndexes: quoteHI } =
      validateCoreSchemaV1TableForWrite(ss, 'QUOTES');

    const newQuoteId = coreQuoteGenerateNextQuoteId(quoteSheet, quoteHI);
    const lines      = Array.isArray(quoteData.lines) ? quoteData.lines : [];
    const totals     = coreQuoteCalculateTotals(lines, quoteData);

    quoteSheet.appendRow(coreQuoteBuildQuoteRow(quoteSheet, quoteHI, {
      QUOTE_ID:         newQuoteId,
      LEAD_ID:          String(quoteData.leadId    || '').trim(),
      CUSTOMER_ID:      String(quoteData.customerId || '').trim(),
      ORDER_ID:         String(quoteData.orderId    || '').trim(),
      STAFF_ID:         staffId,
      ISSUED_DATE:      issuedDate,
      EXPIRY_DATE:      expiryDateStr,
      STATUS:           status,
      CURRENCY:         String(quoteData.currency  || 'JPY').trim(),
      EXCHANGE_RATE:    totals.exchangeRate,
      SUBTOTAL:         totals.subtotal,
      SHIPPING_FEE:     totals.shippingFee,
      DISCOUNT:         totals.discount,
      TOTAL_AMOUNT:     totals.totalAmount,
      TOTAL_AMOUNT_JPY: totals.totalAmountJpy,
      PDF_URL:          '',
      NOTE:             String(quoteData.note || '').trim(),
      CREATED_AT:       now,
      UPDATED_AT:       now
    }));

    if (lines.length > 0) {
      const { sheet: lineSheet, headerIndexes: lineHI } =
        validateCoreSchemaV1TableForWrite(ss, 'QUOTE_LINES');
      coreQuoteWriteLines(lineSheet, lineHI, newQuoteId, lines);
    }

    return { success: true, quoteId: newQuoteId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 見積もりを更新する。明細は全削除して再登録する方式。
 * 合計金額は明細から自動計算する（フロントの値を信用しない）。
 * STAFF_ID / ISSUED_DATE / EXPIRY_DATE は作成時のまま維持する。
 *
 * 以下はサーバー側で自動管理する（フロントから上書きしない）:
 *   - staffId   : 既存値を維持
 *   - issuedDate: 既存値を維持
 *   - expiryDate: 既存値を維持
 *
 * @param {string} sessionId
 * @param {string} quoteId
 * @param {Object} quoteData
 * @param {boolean} isDraft  true → 下書き / false → 発行済み
 * @returns {{ success: true }}
 */
function updateCoreQuoteForFrontend(sessionId, quoteId, quoteData, isDraft) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');
  coreQuoteAssertRequiredFields(quoteData);

  const normalizedId = coreQuoteNormalizeId(quoteId);
  if (!normalizedId) throw new Error('QUOTE_ID_REQUIRED');

  const ss = getSpreadsheet();
  coreQuoteAssertLeadIdExists(ss, String(quoteData.leadId || '').trim());

  var status = isDraft
    ? getCoreSchemaV1Value('QUOTES', 'STATUS', 'DRAFT')
    : getCoreSchemaV1Value('QUOTES', 'STATUS', 'ISSUED');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();

    const { sheet: quoteSheet, headerIndexes: quoteHI } =
      validateCoreSchemaV1TableForWrite(ss, 'QUOTES');

    const targetRow = coreQuoteFindRowById(quoteSheet, quoteHI, normalizedId);
    if (targetRow === -1) throw new Error('QUOTE_NOT_FOUND');

    const lines  = Array.isArray(quoteData.lines) ? quoteData.lines : [];
    const totals = coreQuoteCalculateTotals(lines, quoteData);

    // STAFF_ID / ISSUED_DATE / EXPIRY_DATE は変更しない
    const updateFields = {
      LEAD_ID:          String(quoteData.leadId    || '').trim(),
      CUSTOMER_ID:      String(quoteData.customerId || '').trim(),
      ORDER_ID:         String(quoteData.orderId    || '').trim(),
      STATUS:           status,
      CURRENCY:         String(quoteData.currency  || 'JPY').trim(),
      EXCHANGE_RATE:    totals.exchangeRate,
      SUBTOTAL:         totals.subtotal,
      SHIPPING_FEE:     totals.shippingFee,
      DISCOUNT:         totals.discount,
      TOTAL_AMOUNT:     totals.totalAmount,
      TOTAL_AMOUNT_JPY: totals.totalAmountJpy,
      NOTE:             String(quoteData.note || '').trim(),
      UPDATED_AT:       now
    };

    Object.keys(updateFields).forEach(function(headerKey) {
      const physicalHeader = getCoreSchemaV1HeaderName('QUOTES', headerKey);
      const colIdx = quoteHI[physicalHeader];
      if (colIdx) quoteSheet.getRange(targetRow, colIdx).setValue(updateFields[headerKey]);
    });

    const { sheet: lineSheet, headerIndexes: lineHI } =
      validateCoreSchemaV1TableForWrite(ss, 'QUOTE_LINES');
    coreQuoteDeleteLines(lineSheet, lineHI, normalizedId);
    if (lines.length > 0) {
      coreQuoteWriteLines(lineSheet, lineHI, normalizedId, lines);
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
function coreQuoteReadTable(spreadsheet, tableKey, requiredHeaderKeys) {
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

/** leadId のみ必須チェック（staffId はサーバー側で自動解決） */
function coreQuoteAssertRequiredFields(quoteData) {
  if (!quoteData) throw new Error('QUOTE_DATA_REQUIRED');
  if (!String(quoteData.leadId || '').trim()) throw new Error('QUOTE_LEAD_ID_REQUIRED');
}

/**
 * leadId が LEADS シートに存在するか検証する。
 * 存在しない場合は QUOTE_LEAD_ID_NOT_FOUND を投げる。
 */
function coreQuoteAssertLeadIdExists(spreadsheet, leadId) {
  const leadsTable   = getCoreSchemaV1Table('LEADS');
  const leadsSheet   = getCoreSchemaV1Sheet(spreadsheet, 'LEADS');
  const lastRow      = leadsSheet.getLastRow();
  const dataRowStart = leadsTable.headerRowNumber + 1;
  if (lastRow < dataRowStart) throw new Error('QUOTE_LEAD_ID_NOT_FOUND');
  const headers    = leadsSheet.getRange(leadsTable.headerRowNumber, 1, 1, leadsSheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  const leadIdHeader = getCoreSchemaV1HeaderName('LEADS', 'LEAD_ID');
  const colIdx     = headers.indexOf(leadIdHeader);
  if (colIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: LEAD_ID');
  const data = leadsSheet.getRange(dataRowStart, colIdx + 1, lastRow - leadsTable.headerRowNumber, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === leadId) return;
  }
  throw new Error('QUOTE_LEAD_ID_NOT_FOUND');
}

/**
 * 明細から合計金額を計算する。
 * AMOUNT = QUANTITY × UNIT_PRICE（フロントの値を使わない）
 */
function coreQuoteCalculateTotals(lines, quoteData) {
  const subtotal = lines.reduce(function(sum, line) {
    const qty   = coreQuoteNormalizeNumericField(line.quantity,  'quantity')  || 0;
    const price = coreQuoteNormalizeNumericField(line.unitPrice, 'unitPrice') || 0;
    return sum + qty * price;
  }, 0);
  const currency       = String(quoteData.currency || 'JPY').trim().toUpperCase();
  const exchangeRate   = getCurrentExchangeRate(currency);
  const shippingFee    = coreQuoteNormalizeNumericField(quoteData.shippingFee, 'shippingFee') || 0;
  const discount       = coreQuoteNormalizeNumericField(quoteData.discount, 'discount') || 0;
  const totalAmount    = subtotal + shippingFee - discount;
  const totalAmountJpy = totalAmount * exchangeRate;
  return { subtotal: subtotal, exchangeRate: exchangeRate, shippingFee: shippingFee,
           discount: discount, totalAmount: totalAmount, totalAmountJpy: totalAmountJpy };
}

/**
 * 数値フィールドを正規化する。
 * - 全角数字 → 半角変換
 * - 空文字 → null（省略可能フィールド）
 * - 数値として不正 → INVALID_NUMERIC_FIELD エラー
 * - 正常数値文字列 → Number(s) を返す
 *
 * @param {*} value
 * @param {string} fieldName
 * @returns {number|null}
 */
function coreQuoteNormalizeNumericField(value, fieldName) {
  var s = coreQuoteValue(value)
    .replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  if (!s) return null;
  if (!/^[0-9]+(\.[0-9]*)?$/.test(s)) throw new Error('INVALID_NUMERIC_FIELD:' + fieldName);
  var n = Number(s);
  if (!isFinite(n)) throw new Error('INVALID_NUMERIC_FIELD:' + fieldName);
  return n;
}

/**
 * 見積書ID（QT-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 */
function coreQuoteGenerateNextQuoteId(sheet, headerIndexes) {
  const quoteIdHeader = getCoreSchemaV1HeaderName('QUOTES', 'QUOTE_ID');
  const colIdx = headerIndexes[quoteIdHeader];
  let maxNum = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      const id = String(row[0] || '').trim();
      if (id.startsWith(CORE_QUOTE_ID_PREFIX)) {
        const num = parseInt(id.slice(CORE_QUOTE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_QUOTE_ID_PREFIX + String(maxNum + 1).padStart(CORE_QUOTE_ID_DIGITS, '0');
}

/**
 * 見積明細ID（QTL-00001 形式）を採番する。
 * 既存の最大番号 + 1。
 */
function coreQuoteGenerateNextLineId(sheet, headerIndexes) {
  const lineIdHeader = getCoreSchemaV1HeaderName('QUOTE_LINES', 'QUOTE_LINE_ID');
  const colIdx = headerIndexes[lineIdHeader];
  let maxNum = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      const id = String(row[0] || '').trim();
      if (id.startsWith(CORE_QUOTE_LINE_ID_PREFIX)) {
        const num = parseInt(id.slice(CORE_QUOTE_LINE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_QUOTE_LINE_ID_PREFIX + String(maxNum + 1).padStart(CORE_QUOTE_ID_DIGITS, '0');
}

/**
 * QUOTES シートへ書き込む1行分の配列を構築する。
 * headerKey → getCoreSchemaV1HeaderName で物理名を解決する。
 */
function coreQuoteBuildQuoteRow(sheet, headerIndexes, fieldMap) {
  const lastCol = sheet.getLastColumn();
  const rowData = new Array(lastCol).fill('');
  Object.keys(fieldMap).forEach(function(headerKey) {
    const physicalHeader = getCoreSchemaV1HeaderName('QUOTES', headerKey);
    const colIdx = headerIndexes[physicalHeader];
    if (colIdx) rowData[colIdx - 1] = fieldMap[headerKey];
  });
  return rowData;
}

/**
 * QUOTES シートで QUOTE_ID が一致する行番号（1-indexed）を返す。見つからなければ -1。
 */
function coreQuoteFindRowById(sheet, headerIndexes, quoteId) {
  const quoteIdHeader = getCoreSchemaV1HeaderName('QUOTES', 'QUOTE_ID');
  const colIdx = headerIndexes[quoteIdHeader];
  if (!colIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: QUOTE_ID');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][colIdx - 1] || '').trim() === quoteId) return i + 2;
  }
  return -1;
}

/**
 * QUOTE_LINES シートに明細行を書き込む。
 * AMOUNT = QUANTITY × UNIT_PRICE で自動計算。
 * quantity / unitPrice は coreQuoteNormalizeNumericField で正規化する。
 */
function coreQuoteWriteLines(sheet, headerIndexes, quoteId, lines) {
  lines.forEach(function(line, index) {
    const lineId  = coreQuoteGenerateNextLineId(sheet, headerIndexes);
    const qty     = coreQuoteNormalizeNumericField(line.quantity,  'quantity')  || 0;
    const price   = coreQuoteNormalizeNumericField(line.unitPrice, 'unitPrice') || 0;
    const amount  = qty * price;
    const lastCol = sheet.getLastColumn();
    const rowData = new Array(lastCol).fill('');
    var fieldMap = {
      QUOTE_LINE_ID: lineId,
      QUOTE_ID:      quoteId,
      LINE_NO:       index + 1,
      PRODUCT_ID:    String(line.productId   || '').trim(),
      PRODUCT_NAME:  String(line.productName || '').trim(),
      DESCRIPTION:   String(line.description || '').trim(),
      QUANTITY:      qty,
      UNIT_PRICE:    price,
      AMOUNT:        amount,
      NOTE:          String(line.note || '').trim()
    };
    Object.keys(fieldMap).forEach(function(headerKey) {
      const physicalHeader = getCoreSchemaV1HeaderName('QUOTE_LINES', headerKey);
      const colIdx = headerIndexes[physicalHeader];
      if (colIdx) rowData[colIdx - 1] = fieldMap[headerKey];
    });
    sheet.appendRow(rowData);
  });
}

/**
 * QUOTE_LINES シートから指定 quoteId の行をすべて削除する。
 * 行番号のズレを防ぐため、下から順に削除する。
 */
function coreQuoteDeleteLines(sheet, headerIndexes, quoteId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const quoteIdHeader = getCoreSchemaV1HeaderName('QUOTE_LINES', 'QUOTE_ID');
  const colIdx = headerIndexes[quoteIdHeader];
  if (!colIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: QUOTE_ID');
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const rowsToDelete = [];
  data.forEach(function(row, i) {
    if (String(row[colIdx - 1] || '').trim() === quoteId) rowsToDelete.push(i + 2);
  });
  for (let j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
}

/** 生データ行を JS オブジェクトに変換する */
function coreQuoteBuildRecord(row, indexes) {
  return {
    quoteId:        coreQuoteValue(row[indexes.QUOTE_ID]),
    leadId:         coreQuoteValue(row[indexes.LEAD_ID]),
    customerId:     coreQuoteValue(row[indexes.CUSTOMER_ID]),
    orderId:        coreQuoteValue(row[indexes.ORDER_ID]),
    staffId:        coreQuoteValue(row[indexes.STAFF_ID]),
    issuedDate:     coreQuoteValue(row[indexes.ISSUED_DATE]),
    expiryDate:     coreQuoteValue(row[indexes.EXPIRY_DATE]),
    status:         coreQuoteValue(row[indexes.STATUS]),
    currency:       coreQuoteValue(row[indexes.CURRENCY]),
    exchangeRate:   coreQuoteNumber(row[indexes.EXCHANGE_RATE]),
    subtotal:       coreQuoteNumber(row[indexes.SUBTOTAL]),
    shippingFee:    coreQuoteNumber(row[indexes.SHIPPING_FEE]),
    discount:       coreQuoteNumber(row[indexes.DISCOUNT]),
    totalAmount:    coreQuoteNumber(row[indexes.TOTAL_AMOUNT]),
    totalAmountJpy: coreQuoteNumber(row[indexes.TOTAL_AMOUNT_JPY]),
    pdfUrl:         coreQuoteValue(row[indexes.PDF_URL]),
    note:           coreQuoteValue(row[indexes.NOTE]),
    createdAt:      coreQuoteValue(row[indexes.CREATED_AT]),
    updatedAt:      coreQuoteValue(row[indexes.UPDATED_AT])
  };
}

/** セル値を文字列に正規化する */
function coreQuoteValue(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return String(value).trim();
}

/** セル値を数値に変換する。変換不能な場合は null */
function coreQuoteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = coreQuoteValue(value).replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** quoteId を文字列にトリムする */
function coreQuoteNormalizeId(value) {
  return String(value || '').trim();
}

// ─── 設定セットアップ ──────────────────────────────────────────────────────────

/**
 * 選択肢マスタに「見積もり有効期限日数」設定を追加する（初回のみ実行）。
 *
 * - 既に設定キーが存在する場合は何もしない
 * - 設定キー列・設定値列が存在しない場合はエラーを返す
 * - LockService で保護する
 *
 * 設定値はデフォルト 30 日。変更はシートで直接行うこと。
 *
 * @returns {{ status: 'ADDED'|'ALREADY_EXISTS'|'COLUMN_NOT_FOUND', key: string }}
 */
function setupQuoteExpirySetting() {
  const SETTING_KEY = '見積もり有効期限日数';
  const DEFAULT_VALUE = '30';

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
    if (!sheet || sheet.getLastRow() < 1) {
      return { status: 'COLUMN_NOT_FOUND', key: SETTING_KEY };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var keyCol = headers.indexOf('設定キー');
    var valCol = headers.indexOf('設定値');

    if (keyCol < 0 || valCol < 0) {
      Logger.log('[setupQuoteExpirySetting] 設定キー/設定値 列が見つかりません');
      return { status: 'COLUMN_NOT_FOUND', key: SETTING_KEY };
    }

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][keyCol]) === SETTING_KEY) {
        Logger.log('[setupQuoteExpirySetting] ' + SETTING_KEY + ' は既に存在します');
        return { status: 'ALREADY_EXISTS', key: SETTING_KEY };
      }
    }

    var newRow = new Array(headers.length).fill('');
    newRow[keyCol] = SETTING_KEY;
    newRow[valCol] = DEFAULT_VALUE;
    sheet.appendRow(newRow);

    Logger.log('[setupQuoteExpirySetting] 追加完了: ' + SETTING_KEY + ' = ' + DEFAULT_VALUE);
    return { status: 'ADDED', key: SETTING_KEY };
  } finally {
    lock.releaseLock();
  }
}

// ─── マイグレーション ──────────────────────────────────────────────────────────

/**
 * 既存の「送付済み」ステータスを「発行済み」に書き換える（1回限り実行）。
 *
 * QUOTES.values.STATUS が SENT:'送付済み' から ISSUED:'発行済み' に変更されたため、
 * スプレッドシート上の既存データを新しい値に合わせる。
 *
 * @returns {{ updated: number, skipped: number }}
 */
function migrateCoreQuoteSentToIssued() {
  // MIGRATION ONLY: raw literal required because this value was removed from the schema
  // and can no longer be resolved via getCoreSchemaV1Value.
  const OLD_VALUE = '\u9001\u4ed8\u6e08\u307f'; // '送付済み'
  const NEW_VALUE = getCoreSchemaV1Value('QUOTES', 'STATUS', 'ISSUED');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet();
    const table = getCoreSchemaV1Table('QUOTES');
    const sheet = getCoreSchemaV1Sheet(ss, 'QUOTES');
    const lastRow = sheet.getLastRow();
    if (lastRow < table.headerRowNumber + 1) {
      Logger.log('[migrateCoreQuoteSentToIssued] データ行なし。スキップ。');
      return { updated: 0, skipped: 0 };
    }

    const headers = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
    const statusHeader = getCoreSchemaV1HeaderName('QUOTES', 'STATUS');
    const statusColIdx = headers.indexOf(statusHeader);
    if (statusColIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: STATUS');

    const dataRowStart = table.headerRowNumber + 1;
    const dataRowCount = lastRow - table.headerRowNumber;
    const statusColOneBased = statusColIdx + 1;
    const statusRange = sheet.getRange(dataRowStart, statusColOneBased, dataRowCount, 1);
    const values = statusRange.getValues();

    let updated = 0;
    let skipped = 0;
    const newValues = values.map(function(row) {
      if (String(row[0]).trim() === OLD_VALUE) {
        updated++;
        return [NEW_VALUE];
      }
      skipped++;
      return row;
    });

    // 一括書き込みで N+1 を回避する
    if (updated > 0) {
      statusRange.setValues(newValues);
    }

    Logger.log('[migrateCoreQuoteSentToIssued] 完了: updated=' + updated + ', skipped=' + skipped);
    return { updated: updated, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}
