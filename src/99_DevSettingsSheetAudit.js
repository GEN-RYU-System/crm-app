/**
 * DEV専用: システム設定シートの全列・全データを読み取り専用で監査する。
 * 書き込み系操作: なし（getValues / getDisplayValues のみ）
 * @returns {string} JSON文字列
 */
function auditSettingsSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditSettingsSheet は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');

  if (!sheet) {
    return JSON.stringify({ error: 'システム設定シートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1) {
    return JSON.stringify({ error: 'シートが空です', lastRow: lastRow, lastCol: lastCol });
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var dataRows = Math.max(0, lastRow - 1);

  var columnDetails = [];

  for (var c = 0; c < lastCol; c++) {
    var colName = headers[c];
    var isEmpty = (colName === '' || colName === null || colName === undefined);

    var nonEmptyValues = [];
    if (dataRows > 0) {
      var colVals = sheet.getRange(2, c + 1, dataRows, 1).getDisplayValues();
      colVals.forEach(function(row, rowIdx) {
        var val = row[0];
        if (val !== '' && val !== null) {
          nonEmptyValues.push({ row: rowIdx + 2, value: val });
        }
      });
      // 最大50件に絞る
      if (nonEmptyValues.length > 50) {
        nonEmptyValues = nonEmptyValues.slice(0, 50);
      }
    }

    columnDetails.push({
      colPosition: c + 1,
      columnName: colName,
      isEmptyName: isEmpty,
      nonEmptyCount: nonEmptyValues.length,
      values: nonEmptyValues
    });
  }

  return JSON.stringify({
    sheetName: 'システム設定',
    auditedAt: new Date().toISOString(),
    totalRows: lastRow,
    dataRows: dataRows,
    totalCols: lastCol,
    columns: columnDetails
  });
}
