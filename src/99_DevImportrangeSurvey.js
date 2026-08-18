/**
 * 99_DevImportrangeSurvey.js
 * 調査専用: 集計同期・商品マスタ同期・SCM出力同期 の IMPORTRANGE 数式を確認する
 * 読み取りのみ。書き込みなし。
 */

/**
 * 3シートの1行目・2行目の数式と列数・データ行数を返す
 */
function surveyImportrangeFormulas() {
  const ss = getSpreadsheet();
  const targetSheets = ['集計同期', '商品マスタ同期', 'SCM出力同期'];

  const results = targetSheets.map(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { sheetName: sheetName, exists: false };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // 1行目の数式を全列取得
    const row1Formulas = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getFormulas()[0]
      : [];

    // 2行目の数式を全列取得（データがある場合）
    const row2Formulas = lastRow >= 2 && lastCol > 0
      ? sheet.getRange(2, 1, 1, lastCol).getFormulas()[0]
      : [];

    // 数式セルのみ抽出（スプレッドシートIDをマスク）
    const maskId = function(formula) {
      return formula.replace(/"1[A-Za-z0-9_-]{25,}"/g, '"[SPREADSHEET_ID]"');
    };

    const row1NonEmpty = row1Formulas
      .map(function(f, i) { return f ? { col: i + 1, formula: maskId(f) } : null; })
      .filter(Boolean);

    const row2NonEmpty = row2Formulas
      .map(function(f, i) { return f ? { col: i + 1, formula: maskId(f) } : null; })
      .filter(Boolean);

    return {
      sheetName: sheetName,
      exists: true,
      lastRow: lastRow,
      lastCol: lastCol,
      dataRows: lastRow > 0 ? lastRow - 1 : 0,
      row1FormulaCount: row1NonEmpty.length,
      row1Formulas: row1NonEmpty,
      row2FormulaCount: row2NonEmpty.length,
      row2Formulas: row2NonEmpty
    };
  });

  // clasp の表示上限でネスト配列が [Array] になるため、文字列化して返す
  return { results: JSON.stringify(results) };
}

/**
 * SCM出力同期 の現在のヘッダー行を全件返す（DRY RUN 用）
 * 読み取りのみ。書き込みなし。
 */
function surveyScmOutputHeaders() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('SCM出力同期');
  if (!sheet) {
    return { error: 'SCM出力同期 シートが見つかりません' };
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  const a1Formula = sheet.getRange('A1').getFormula();
  const maskId = function(f) {
    return f.replace(/"1[A-Za-z0-9_-]{25,}"/g, '"[SPREADSHEET_ID]"');
  };

  return JSON.stringify({
    sheetName: 'SCM出力同期',
    lastRow: lastRow,
    lastCol: lastCol,
    dataRows: lastRow > 0 ? lastRow - 1 : 0,
    a1Formula: maskId(a1Formula),
    headers: headers.map(function(name, i) {
      return { col: i + 1, name: String(name) };
    })
  });
}

/**
 * DEV環境のスプレッドシートIDプロパティ名と、ブック名を確認する（読み取りのみ）
 * ID の値は返さない。存在確認とブック名のみ。
 */
function surveyDevSpreadsheetIdentity() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(props).sort();

  // SPREADSHEET_ID 系のキーが存在するか確認（値は返さない）
  const spreadsheetIdKeys = keys.filter(function(k) {
    return k.toUpperCase().indexOf('SPREADSHEET') !== -1 || k.toUpperCase().indexOf('SS_ID') !== -1;
  });

  const ss = getSpreadsheet();
  const name = ss.getName();

  return JSON.stringify({
    allPropertyKeys: keys,
    spreadsheetRelatedKeys: spreadsheetIdKeys,
    spreadsheetName: name,
    isProd: name === 'CRM APP_PROD'
  });
}
