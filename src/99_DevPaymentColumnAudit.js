/**
 * DEV専用: 支払先マスタの全列ヘッダーと各列の空欄件数を返す（読み取り専用）
 * データ値は出力しない。ヘッダー名と空欄件数のみ。
 */
function devAuditPaymentDestinationColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAuditPaymentDestinationColumns is available only in development');
  }
  var spreadsheet = getSpreadsheet();
  var paymentTable = getCoreSchemaV1Table('PAYMENT_DESTINATIONS');
  var sheet = spreadsheet.getSheetByName(paymentTable.sheetName);
  if (!sheet) return { error: 'sheet not found: ' + paymentTable.sheetName };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headerRowNumber = paymentTable.headerRowNumber;
  var dataRowCount = Math.max(0, lastRow - headerRowNumber);

  var headers = lastCol > 0
    ? sheet.getRange(headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
    : [];

  if (dataRowCount === 0) {
    return {
      sheetName: paymentTable.sheetName,
      totalDataRows: 0,
      columns: headers.map(function(h, i) {
        return { colIndex: i + 1, headerName: String(h).trim(), blankCount: 0, filledCount: 0 };
      }),
    };
  }

  var allValues = sheet
    .getRange(headerRowNumber + 1, 1, dataRowCount, lastCol)
    .getValues();

  var blankCounts = new Array(lastCol).fill(0);
  allValues.forEach(function(row) {
    row.forEach(function(cell, colIdx) {
      var v = cell;
      var isEmpty = (v === '' || v === null || v === undefined);
      if (!isEmpty && Object.prototype.toString.call(v) === '[object Date]') isEmpty = false;
      if (isEmpty) blankCounts[colIdx]++;
    });
  });

  var columns = headers.map(function(h, i) {
    return {
      colIndex: i + 1,
      headerName: String(h).trim(),
      blankCount: blankCounts[i],
      filledCount: dataRowCount - blankCounts[i],
    };
  });

  return {
    sheetName: paymentTable.sheetName,
    totalDataRows: dataRowCount,
    columns: columns,
  };
}
