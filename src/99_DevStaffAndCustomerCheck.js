/**
 * DEV専用: 担当者マスタの全員を読み取り専用で取得する。
 * @returns {string} JSON
 */
function getStaffMasterList() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!sheet || sheet.getLastRow() < 2) {
    return JSON.stringify({ error: '担当者マスタが見つかりません', sheetName: CONFIG.SHEETS.STAFF });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 取得する列名（存在しない列は -1 になる）
  var targetCols = [
    'staff_id', 'last_name_ja', 'first_name_ja', 'full_name_ja',
    'status', '姓', '名', '氏名', 'ステータス'
  ];
  var colIndices = {};
  targetCols.forEach(function(col) {
    colIndices[col] = headers.indexOf(col);
  });

  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var staffList = dataRows.map(function(row, i) {
    var record = { rowNum: i + 2 };
    // 主要列を取得（見つかった列名を使う）
    var staffId = colIndices['staff_id'] !== -1 ? row[colIndices['staff_id']] : null;
    var lastNameJa = colIndices['last_name_ja'] !== -1 ? row[colIndices['last_name_ja']]
                   : colIndices['姓'] !== -1 ? row[colIndices['姓']] : null;
    var firstNameJa = colIndices['first_name_ja'] !== -1 ? row[colIndices['first_name_ja']]
                    : colIndices['名'] !== -1 ? row[colIndices['名']] : null;
    var fullNameJa = colIndices['full_name_ja'] !== -1 ? row[colIndices['full_name_ja']]
                   : colIndices['氏名'] !== -1 ? row[colIndices['氏名']] : null;
    var status = colIndices['status'] !== -1 ? row[colIndices['status']]
               : colIndices['ステータス'] !== -1 ? row[colIndices['ステータス']] : null;

    record.staff_id = staffId;
    record.last_name_ja = lastNameJa;
    record.first_name_ja = firstNameJa;
    record.full_name_ja = fullNameJa;
    record.status = status;
    return record;
  });

  return JSON.stringify({
    sheetName: sheet.getName(),
    totalRows: dataRows.length,
    headers: headers,
    staffList: staffList,
    auditedAt: new Date().toISOString()
  });
}

/**
 * DEV専用: 顧客マスタの 営業担当者列（col10）を全件読み取る。
 * @returns {string} JSON
 */
function getCustomerSalesAssigneeList() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!sheet || sheet.getLastRow() < 2) {
    return JSON.stringify({ error: '顧客マスタが見つかりません', sheetName: CONFIG.SHEETS.CRM_CUSTOMERS });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var salesAssigneeIdx = headers.indexOf('営業担当者');
  if (salesAssigneeIdx === -1) salesAssigneeIdx = headers.indexOf('sales_assignee_name');
  var assigneeIdIdx   = headers.indexOf('担当者ID');
  var customerIdIdx   = headers.indexOf('顧客ID');
  var customerNameIdx = headers.indexOf('顧客名');

  var dataRows = lastRow - 1;
  var rows = sheet.getRange(2, 1, dataRows, lastCol).getValues();

  var result = rows.map(function(row, i) {
    return {
      rowNum: i + 2,
      顧客ID: customerIdIdx !== -1 ? row[customerIdIdx] : null,
      顧客名: customerNameIdx !== -1 ? row[customerNameIdx] : null,
      営業担当者: salesAssigneeIdx !== -1 ? row[salesAssigneeIdx] : '列なし',
      担当者ID: assigneeIdIdx !== -1 ? row[assigneeIdIdx] : '列なし'
    };
  });

  return JSON.stringify({
    sheetName: sheet.getName(),
    totalRows: dataRows,
    salesAssigneeColPosition: salesAssigneeIdx + 1,
    assigneeIdColPosition: assigneeIdIdx + 1,
    rows: result,
    auditedAt: new Date().toISOString()
  });
}
