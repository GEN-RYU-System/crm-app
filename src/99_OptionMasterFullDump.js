/**
 * 選択肢マスタ全列ダンプ（読み取り専用・調査用）
 *
 * - 書き込み系メソッドは一切使用しない
 * - DEV 環境のみ実行可能
 * - 調査完了後もコードは残す（副作用なし）
 */

var OPTION_MASTER_DUMP_MAX_VALUES = 50;

/**
 * 選択肢マスタ（CONFIG.SHEETS.SETTINGS）の全列を読み取り、
 * 列名・列位置・値の全件・件数 を返す。
 *
 * @returns {{
 *   sheetName: string,
 *   totalColumns: number,
 *   totalRows: number,
 *   columns: Array<{
 *     colIndex: number,
 *     header: string,
 *     valueCount: number,
 *     values: string[],
 *     truncated: boolean,
 *     error: string|null
 *   }>
 * }}
 */
function getOptionMasterFullDump() {
  if (getEnvironment() !== 'development') {
    throw new Error('getOptionMasterFullDump は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheetName = CONFIG.SHEETS.SETTINGS;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return {
      sheetName: sheetName,
      totalColumns: 0,
      totalRows: 0,
      columns: [],
      error: 'シートが見つかりません: ' + sheetName
    };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return {
      sheetName: sheetName,
      totalColumns: lastCol,
      totalRows: lastRow,
      columns: [],
      error: 'シートが空です'
    };
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var columns = [];

  for (var c = 0; c < headers.length; c++) {
    try {
      var header = String(headers[c] != null ? headers[c] : '').trim();
      var values = [];

      for (var r = 1; r < data.length; r++) {
        var cell = data[r][c];
        var cellStr = String(cell != null ? cell : '').trim();
        if (cellStr !== '') {
          values.push(cellStr);
        }
      }

      var truncated = values.length > OPTION_MASTER_DUMP_MAX_VALUES;
      var displayValues = truncated ? values.slice(0, OPTION_MASTER_DUMP_MAX_VALUES) : values;

      columns.push({
        colIndex: c + 1,
        header: header,
        valueCount: values.length,
        values: displayValues,
        truncated: truncated,
        error: null
      });
    } catch (e) {
      columns.push({
        colIndex: c + 1,
        header: String(headers[c] != null ? headers[c] : ''),
        valueCount: 0,
        values: [],
        truncated: false,
        error: String(e)
      });
    }
  }

  return {
    sheetName: sheetName,
    totalColumns: lastCol,
    totalRows: lastRow,
    columns: columns
  };
}
