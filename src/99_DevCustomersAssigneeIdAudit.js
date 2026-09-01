/**
 * DEV専用: 顧客マスタの「担当者ID」列について
 * データ有無・列位置・サンプル値（先頭10件）を読み取り専用で調査する。
 * @returns {string} JSON
 */
function auditCustomersAssigneeId() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMERS);
  if (!sheet) {
    return JSON.stringify({ error: '顧客マスタシートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return JSON.stringify({ totalRows: 0, assigneeIdExists: false });
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var assigneeIdIdx = headers.indexOf('担当者ID');
  var salesAssigneeIdx = headers.indexOf('sales_assignee_name');
  if (salesAssigneeIdx === -1) salesAssigneeIdx = headers.indexOf('営業担当者');

  var dataRows = lastRow - 1;
  var result = {
    sheetName: sheet.getName(),
    totalRows: dataRows,
    totalCols: lastCol,
    allHeaders: headers,
    assigneeId: {
      exists: assigneeIdIdx !== -1,
      colPosition: assigneeIdIdx !== -1 ? assigneeIdIdx + 1 : -1,
      nonEmptyCount: 0,
      samples: []
    },
    salesAssigneeName: {
      exists: salesAssigneeIdx !== -1,
      colPosition: salesAssigneeIdx !== -1 ? salesAssigneeIdx + 1 : -1
    },
    auditedAt: new Date().toISOString()
  };

  if (assigneeIdIdx !== -1) {
    var colValues = sheet.getRange(2, assigneeIdIdx + 1, dataRows, 1).getValues();
    colValues.forEach(function(row, i) {
      var val = row[0];
      if (val !== '' && val !== null && val !== undefined) {
        result.assigneeId.nonEmptyCount++;
        if (result.assigneeId.samples.length < 10) {
          result.assigneeId.samples.push({ row: i + 2, value: val });
        }
      }
    });
  }

  return JSON.stringify(result);
}
