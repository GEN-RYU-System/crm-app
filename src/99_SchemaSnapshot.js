/**
 * 99_SchemaSnapshot.js
 *
 * 目的: SQL 移行に向け、スプレッドシートの現物から列ヘッダーを機械的に記録する。
 *       読み取り専用。書き込み系メソッドは一切使用しない。
 *
 * 追加日: 2026-08-30
 */

/**
 * アクティブなスプレッドシートの全シートのヘッダー情報を取得する。
 *
 * 読み取り専用: 書き込み・構造変更系のメソッドは一切使用しない。
 *
 * @returns {string} JSON 文字列。各シートの情報を配列で返す。
 */
function dumpAllSheetHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var result = [];

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = '';
    var sheetId = null;
    var headers = [];
    var lastCol = 0;
    var lastRow = 0;
    var hidden = false;

    try {
      sheetName = sheet.getName();
      sheetId = sheet.getSheetId();
      lastCol = sheet.getLastColumn();
      lastRow = sheet.getLastRow();
      hidden = sheet.isSheetHidden();

      // ヘッダー行（1行目）を取得
      // 列数が0の場合（空シート）は空配列を返す
      if (lastCol > 0) {
        var headerRange = sheet.getRange(1, 1, 1, lastCol);
        var headerValues = headerRange.getValues();
        headers = headerValues[0];
      }

      result.push({
        name: sheetName,
        gid: sheetId,
        lastColumn: lastCol,
        lastRow: lastRow,
        hidden: hidden,
        headers: headers
      });

    } catch (e) {
      result.push({
        name: sheetName || '(取得失敗)',
        gid: sheetId,
        lastColumn: lastCol,
        lastRow: lastRow,
        hidden: hidden,
        headers: headers,
        error: e.message
      });
    }
  }

  return JSON.stringify(result, null, 2);
}
