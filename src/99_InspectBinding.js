/**
 * 同名関数のどの定義が有効かを、実行せずに調べる検査用関数。
 * 関数本体の先頭部分を文字列として取り出すだけで、対象関数は呼び出さない。
 */
function inspectInitializeSpreadsheetBinding() {
  const body = initializeSpreadsheet.toString();
  Logger.log('length: ' + body.length);
  Logger.log('head: ' + body.slice(0, 300));
  return body.slice(0, 300);
}
