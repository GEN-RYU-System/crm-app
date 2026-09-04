/**
 * 99_DevSharedInventoryFormulaCheck.js
 *
 * 目的: 共用在庫（SHARED_INVENTORY）シートに数式（IMPORTRANGE 等）が
 *       存在するかどうかを確認する（DEV 専用 / 読み取り専用）。
 *
 * 禁止事項:
 *   - シートへの書き込み（setValue / setValues / appendRow 等）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run checkSharedInventoryFormulas
 */

/**
 * 共用在庫シートの全セルに数式が含まれるかを確認する（読み取り専用）。
 *
 * @returns {{
 *   sheetName: string,
 *   lastRow: number,
 *   lastCol: number,
 *   formulasInRow1: string[],
 *   formulaCount: number,
 *   formulaSamples: Array<{ cell: string, formula: string }>,
 *   hasImportrange: boolean
 * }}
 */
function checkSharedInventoryFormulas() {
  if (getEnvironment() !== 'development') {
    throw new Error('checkSharedInventoryFormulas は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var tableDef = getCoreSchemaV1Table('SHARED_INVENTORY');
  var sheet    = ss.getSheetByName(tableDef.sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + tableDef.sheetName);
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    var empty = {
      sheetName:       tableDef.sheetName,
      lastRow:         lastRow,
      lastCol:         lastCol,
      formulasInRow1:  [],
      formulaCount:    0,
      formulaSamples:  [],
      hasImportrange:  false
    };
    Logger.log(JSON.stringify(empty, null, 2));
    return empty;
  }

  // 1行目の数式を取得（IMPORTRANGE は通常 A1 に設定される）
  var row1Formulas = sheet.getRange(1, 1, 1, lastCol).getFormulas()[0];
  var nonEmptyRow1 = row1Formulas.filter(function(f) { return f !== ''; });

  // 全体の数式を確認（最大 50 行でサンプリング）
  var sampleRows   = Math.min(lastRow, 50);
  var allFormulas  = sheet.getRange(1, 1, sampleRows, lastCol).getFormulas();
  var formulaSamples = [];
  var formulaCount = 0;

  for (var r = 0; r < allFormulas.length; r++) {
    for (var c = 0; c < allFormulas[r].length; c++) {
      var f = allFormulas[r][c];
      if (f !== '') {
        formulaCount++;
        if (formulaSamples.length < 10) {
          var colLetter = columnToLetter_(c + 1);
          formulaSamples.push({ cell: colLetter + (r + 1), formula: f });
        }
      }
    }
  }

  var hasImportrange = formulaSamples.some(function(s) {
    return s.formula.toUpperCase().indexOf('IMPORTRANGE') !== -1;
  }) || nonEmptyRow1.some(function(f) {
    return f.toUpperCase().indexOf('IMPORTRANGE') !== -1;
  });

  var result = {
    sheetName:      tableDef.sheetName,
    lastRow:        lastRow,
    lastCol:        lastCol,
    formulasInRow1: nonEmptyRow1,
    formulaCount:   formulaCount,
    formulaSamples: formulaSamples,
    hasImportrange: hasImportrange
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * 列番号（1始まり）をアルファベット列名に変換する。
 * @param {number} colNum
 * @returns {string}
 */
function columnToLetter_(colNum) {
  var letter = '';
  while (colNum > 0) {
    var mod = (colNum - 1) % 26;
    letter  = String.fromCharCode(65 + mod) + letter;
    colNum  = Math.floor((colNum - 1) / 26);
  }
  return letter;
}
