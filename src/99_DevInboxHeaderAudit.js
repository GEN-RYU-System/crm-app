/**
 * DEV専用: 受信箱が依存する実シートのヘッダーを監査する。
 *
 * clasp run の返却型制約に合わせ、JSON文字列だけを返す。ヘッダー名と列数のみを
 * 扱い、行データ・個人情報・シートIDは返さない。将来のConfig整合監査にも残す。
 *
 * @returns {string} JSON.stringify({ conversationLog, leads })
 */
function auditDevInboxSheetHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevInboxSheetHeaders is available only in development');
  }

  var spreadsheet = getSpreadsheet();
  var conversationSheet = resolveConversationLogSheet_(spreadsheet);
  var leadsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.LEADS);

  return JSON.stringify({
    conversationLog: describeDevInboxHeaderSheet_(conversationSheet, CONFIG.SHEETS.CONVERSATION_LOG),
    leads: describeDevInboxHeaderSheet_(leadsSheet, CONFIG.SHEETS.LEADS)
  });
}

/**
 * DEV専用: DEVブック全シートの名前・データ行数・列数を返す（値不返却）。
 *
 * @returns {string} JSON.stringify([{ name, dataRows, cols }, ...])
 */
function listDevSheets() {
  if (getEnvironment() !== 'development') {
    throw new Error('listDevSheets is available only in development');
  }
  var ss = getSpreadsheet();
  var result = ss.getSheets().map(function(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    return {
      name: sh.getName(),
      dataRows: Math.max(lastRow - 1, 0),
      cols: lastCol
    };
  });
  return JSON.stringify(result);
}

/**
 * DEV専用: リード管理シート全64列の充填率（値あり行数 / 総行数）を実測する。
 * 値の中身は返さない。行数のみ。
 *
 * @returns {string} JSON.stringify([{ col, header, filled, total, empty }, ...])
 */
function auditLeadColumnFillRates() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditLeadColumnFillRates is available only in development');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) throw new Error('リード管理 sheet not found');
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return JSON.stringify([]);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var total = data.length;
  var result = headers.map(function(h, i) {
    var filled = data.filter(function(row) {
      return String(row[i] == null ? '' : row[i]).trim() !== '';
    }).length;
    return { col: i + 1, header: String(h).trim(), filled: filled, total: total, empty: total - filled };
  });
  return JSON.stringify(result);
}

function describeDevInboxHeaderSheet_(sheet, expectedSheetName) {
  if (!sheet) {
    return { sheetName: expectedSheetName, headerCount: 0, headers: [], exists: false };
  }

  var headerCount = sheet.getLastColumn();
  var headers = headerCount > 0
    ? sheet.getRange(1, 1, 1, headerCount).getDisplayValues()[0].map(function(header) { return String(header).trim(); })
    : [];
  return { sheetName: sheet.getName(), headerCount: headerCount, headers: headers, exists: true };
}
