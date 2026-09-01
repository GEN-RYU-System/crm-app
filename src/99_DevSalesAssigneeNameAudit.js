/**
 * DEV専用: sales_assignee_name（営業担当者）列を持つ全シートのデータ現状を読み取る。
 * @returns {string} JSON
 */
function auditSalesAssigneeNameData() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }

  var ss = getSpreadsheet();
  var allSheets = ss.getSheets();

  // 調査対象の列名
  var TARGET_HEADERS = ['sales_assignee_name', '営業担当者'];

  var results = [];

  allSheets.forEach(function(sheet) {
    var sheetName = sheet.getName();
    // バックアップシートは除外
    if (sheetName.indexOf('backup') !== -1 || sheetName.indexOf('_backup') !== -1) return;
    // 退避シートは除外
    if (sheetName.indexOf('deleted_columns') !== -1) return;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) return;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    var foundCols = [];
    TARGET_HEADERS.forEach(function(targetHeader) {
      var idx = headers.indexOf(targetHeader);
      if (idx !== -1) {
        foundCols.push({ headerName: targetHeader, colPosition: idx + 1 });
      }
    });

    if (foundCols.length === 0) return;

    // 各対象列のデータを取得
    var colResults = foundCols.map(function(col) {
      if (lastRow < 2) {
        return {
          headerName: col.headerName,
          colPosition: col.colPosition,
          dataRows: 0,
          nonEmptyCount: 0,
          distinctValues: []
        };
      }
      var values = sheet.getRange(2, col.colPosition, lastRow - 1, 1).getValues();
      var nonEmptyCount = 0;
      var distinctValues = {};
      values.forEach(function(row) {
        var v = row[0];
        if (v !== '' && v !== null && v !== undefined) {
          nonEmptyCount++;
          distinctValues[String(v)] = true;
        }
      });
      return {
        headerName: col.headerName,
        colPosition: col.colPosition,
        dataRows: lastRow - 1,
        nonEmptyCount: nonEmptyCount,
        distinctValues: Object.keys(distinctValues)
      };
    });

    // sales_assignee_id 列の有無も確認
    var hasAssigneeIdCol = headers.indexOf('sales_assignee_id') !== -1 ||
                           headers.indexOf('SALES_ASSIGNEE_ID') !== -1 ||
                           headers.indexOf('営業担当ID') !== -1;

    results.push({
      sheetName: sheetName,
      cols: colResults,
      hasSalesAssigneeIdCol: hasAssigneeIdCol
    });
  });

  return JSON.stringify({
    auditedAt: new Date().toISOString(),
    sheetsWithTarget: results.length,
    results: results
  });
}
