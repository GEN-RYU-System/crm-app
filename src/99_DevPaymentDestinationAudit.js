/**
 * DEV専用: 支払先マスタの実データを読み取って件数を返す（シート書き込みなし）
 */
function devAuditPaymentDestinations() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAuditPaymentDestinations is available only in development');
  }
  var spreadsheet = getSpreadsheet();
  var paymentTable = getCoreSchemaV1Table('PAYMENT_DESTINATIONS');
  var sheet = spreadsheet.getSheetByName(paymentTable.sheetName);
  if (!sheet) return { error: 'sheet not found: ' + paymentTable.sheetName };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headerRowNumber = paymentTable.headerRowNumber;

  if (lastRow <= headerRowNumber) {
    return { totalDataRows: 0, rowsWithCustomerId: 0, lastRow: lastRow, lastCol: lastCol };
  }

  var headers = sheet.getRange(headerRowNumber, 1, 1, lastCol).getDisplayValues()[0];
  var customerIdColIndex = headers.indexOf(getCoreSchemaV1HeaderName('PAYMENT_DESTINATIONS', 'CUSTOMER_ID'));
  if (customerIdColIndex === -1) {
    return { error: 'CUSTOMER_ID column not found', headers: headers };
  }

  var dataRowCount = lastRow - headerRowNumber;
  var customerIdValues = sheet
    .getRange(headerRowNumber + 1, customerIdColIndex + 1, dataRowCount, 1)
    .getDisplayValues()
    .map(function(r) { return String(r[0]).trim(); });

  var rowsWithCustomerId = customerIdValues.filter(function(v) { return v !== ''; }).length;
  var countsByCustomerId = {};
  customerIdValues.forEach(function(id) {
    if (id) countsByCustomerId[id] = (countsByCustomerId[id] || 0) + 1;
  });

  return {
    totalDataRows:          dataRowCount,
    lastRow:                lastRow,
    lastCol:                lastCol,
    rowsWithCustomerId:     rowsWithCustomerId,
    uniqueCustomerIdCount:  Object.keys(countsByCustomerId).length,
    countsByCustomerId:     countsByCustomerId,
  };
}

/**
 * DEV専用: 顧客名から支払先マスタの行数を確認する（シート書き込みなし）
 * 引数の名前はルックアップにのみ使用し、出力には顧客IDのみ記載する
 *
 * @param {string[]} customerNames - 顧客名の配列（CUSTOMER_NAME 列の値と完全一致）
 * @return {Object[]} 各顧客IDと支払先行数 / 'notFound' の配列
 */
function devCheckPaymentRowsByCustomerName(customerNames) {
  if (getEnvironment() !== 'development') {
    throw new Error('devCheckPaymentRowsByCustomerName is available only in development');
  }
  if (!Array.isArray(customerNames) || customerNames.length === 0) {
    throw new Error('customerNames must be a non-empty array');
  }

  var spreadsheet = getSpreadsheet();

  // 1. 顧客マスタから顧客ID を取得
  var custTable   = getCoreSchemaV1Table('CUSTOMERS');
  var custSheet   = spreadsheet.getSheetByName(custTable.sheetName);
  if (!custSheet) return [{ error: 'CUSTOMERS sheet not found' }];

  var custLastCol = custSheet.getLastColumn();
  var custHeaders = custSheet.getRange(custTable.headerRowNumber, 1, 1, custLastCol).getDisplayValues()[0];
  var custIdColIdx   = custHeaders.indexOf(getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID'));
  var custNameColIdx = custHeaders.indexOf(getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_NAME'));
  if (custIdColIdx === -1 || custNameColIdx === -1) {
    return [{ error: 'CUSTOMER_ID or CUSTOMER_NAME column not found in CUSTOMERS' }];
  }

  var custDataRows = custSheet.getLastRow() - custTable.headerRowNumber;
  var custData = custDataRows > 0
    ? custSheet.getRange(custTable.headerRowNumber + 1, 1, custDataRows, custLastCol).getDisplayValues()
    : [];

  // name → id mapping (name NOT stored after lookup)
  var nameToId = {};
  customerNames.forEach(function(name) { nameToId[name] = null; });
  custData.forEach(function(row) {
    var id   = String(row[custIdColIdx]).trim();
    var name = String(row[custNameColIdx]).trim();
    if (Object.prototype.hasOwnProperty.call(nameToId, name)) {
      nameToId[name] = id;
    }
  });

  // 2. 支払先マスタの行数を集計（前関数の結果を再利用）
  var auditResult = devAuditPaymentDestinations();
  var countsByCustomerId = auditResult.countsByCustomerId || {};

  // 3. 結果を返す（名前は出力しない）
  return customerNames.map(function(name, index) {
    var id = nameToId[name];
    if (!id) return { index: index + 1, customerId: null, status: 'notFound' };
    return {
      index: index + 1,
      customerId: id,
      paymentRows: countsByCustomerId[id] || 0,
    };
  });
}
