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
