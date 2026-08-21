/**
 * DEV専用: 支払先マスタの実データを読み取って件数を返す（シート書き込みなし）
 */
function devAuditPaymentDestinations() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAuditPaymentDestinations is available only in development');
  }
  var spreadsheet = getSpreadsheet();
  var sheetName = getCoreSchemaV1Table('PAYMENT_DESTINATIONS').sheetName;
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return { error: 'sheet not found: ' + sheetName };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headerRowNumber = getCoreSchemaV1Table('PAYMENT_DESTINATIONS').headerRowNumber;

  if (lastRow <= headerRowNumber) {
    return { totalDataRows: 0, rowsWithCustomerId: 0, lastRow: lastRow, lastCol: lastCol };
  }

  var headers = sheet.getRange(headerRowNumber, 1, 1, lastCol).getDisplayValues()[0];
  var customerIdColIndex = headers.indexOf('顧客ID');
  if (customerIdColIndex === -1) {
    return { error: '顧客ID column not found', headers: headers };
  }

  var dataRowCount = lastRow - headerRowNumber;
  var customerIdValues = sheet
    .getRange(headerRowNumber + 1, customerIdColIndex + 1, dataRowCount, 1)
    .getDisplayValues()
    .map(function(r) { return String(r[0]).trim(); });

  var rowsWithCustomerId = customerIdValues.filter(function(v) { return v !== ''; }).length;
  var uniqueCustomerIds = Array.from(new Set(customerIdValues.filter(function(v) { return v !== ''; })));

  return {
    totalDataRows:     dataRowCount,
    lastRow:           lastRow,
    lastCol:           lastCol,
    rowsWithCustomerId: rowsWithCustomerId,
    uniqueCustomerIdCount: uniqueCustomerIds.length
  };
}
