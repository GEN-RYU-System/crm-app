/**
 * DEV専用: 選択肢マスタV2（縦持ち）シートを作成する。
 *
 * 書き込み系操作: スプレッドシートへのシート追加・ヘッダー行書き込み
 * 冪等性: シートが既存の場合はスキップし、列数を検証して返す
 *
 * 新シート仕様:
 *   シート名: 選択肢マスタV2
 *   列: option_id / category / value / sort_order / is_active
 *
 * @returns {string} JSON.stringify({ created, sheetName, columnCount, headers })
 */
function devSetupOptionMasterV2Sheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('devSetupOptionMasterV2Sheet は DEV 環境でのみ実行できます');
  }

  var SHEET_NAME = getCoreSchemaV1TableName('OPTION_MASTER');
  var EXPECTED_HEADERS = ['option_id', 'category', 'value', 'sort_order', 'is_active'];
  var ss = getSpreadsheet();

  var existing = ss.getSheetByName(SHEET_NAME);
  if (existing) {
    var existingColCount = existing.getLastColumn();
    var existingHeaders = existingColCount > 0
      ? existing.getRange(1, 1, 1, existingColCount).getValues()[0].map(function(h) { return String(h).trim(); })
      : [];
    return JSON.stringify({
      created: false,
      sheetName: SHEET_NAME,
      columnCount: existingColCount,
      headers: existingHeaders,
      note: '既存シートをスキップ（再作成しない）'
    });
  }

  var sheet = ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).setValues([EXPECTED_HEADERS]);
  sheet.setFrozenRows(1);

  // 検証
  var actualColCount = sheet.getLastColumn();
  var actualHeaders = sheet.getRange(1, 1, 1, actualColCount).getValues()[0].map(function(h) { return String(h).trim(); });
  var mismatch = EXPECTED_HEADERS.filter(function(h, i) { return actualHeaders[i] !== h; });

  return JSON.stringify({
    created: true,
    sheetName: SHEET_NAME,
    columnCount: actualColCount,
    headers: actualHeaders,
    mismatch: mismatch,
    ok: mismatch.length === 0
  });
}
