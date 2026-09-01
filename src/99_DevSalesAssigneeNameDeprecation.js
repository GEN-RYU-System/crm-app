/**
 * DEV専用: リード管理の削除前バックアップを作成する。
 * @returns {string} JSON
 */
function backupLeadsMasterPreAssigneeWrite() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return JSON.stringify({ success: false, reason: 'リード管理シートが見つかりません' });

  var origRows = sheet.getLastRow();
  var origCols = sheet.getLastColumn();
  var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];

  var newSheet = sheet.copyTo(ss);
  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(ss.getNumSheets());
  newSheet.setName('リード管理_backup_20260901_assign');

  var backupRows = newSheet.getLastRow();
  var backupCols = newSheet.getLastColumn();
  if (backupRows !== origRows || backupCols !== origCols) {
    return JSON.stringify({ success: false, reason: '行数または列数が一致しません',
      origRows: origRows, backupRows: backupRows, origCols: origCols, backupCols: backupCols });
  }
  return JSON.stringify({ success: true, backupName: 'リード管理_backup_20260901_assign',
    rows: origRows, cols: origCols, headers: origHeaders });
}

/**
 * DEV専用: LEADS の sales_assignee_id 全行に EMP-00001 を書き込む dry-run。
 * @returns {string} JSON
 */
function setLeadsSalesAssigneeIdDryRun() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('sales_assignee_id');
  if (targetIdx === -1) return JSON.stringify({ success: false, reason: 'sales_assignee_id 列が見つかりません' });

  var dataRows = lastRow - 1;
  var currentValues = dataRows > 0
    ? sheet.getRange(2, targetIdx + 1, dataRows, 1).getValues()
    : [];

  return JSON.stringify({
    success: true, dryRun: true,
    colPosition: targetIdx + 1, targetColName: 'sales_assignee_id',
    dataRows: dataRows,
    currentValues: currentValues.map(function(r, i) { return { rowNum: i + 2, currentValue: r[0] }; }),
    willWrite: 'EMP-00001'
  });
}

/**
 * DEV専用: LEADS の sales_assignee_id 全行に EMP-00001 を書き込む。
 * @returns {string} JSON
 */
function setLeadsSalesAssigneeId() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('sales_assignee_id');
  if (targetIdx === -1) return JSON.stringify({ success: false, reason: 'sales_assignee_id 列が見つかりません' });

  var dataRows = lastRow - 1;
  if (dataRows <= 0) return JSON.stringify({ success: true, message: 'データ行なし（0行）', dataRows: 0 });

  var beforeSnapshot = sheet.getRange(2, 1, dataRows, lastCol).getValues();
  var writeValues = [];
  for (var i = 0; i < dataRows; i++) writeValues.push(['EMP-00001']);
  sheet.getRange(2, targetIdx + 1, dataRows, 1).setValues(writeValues);
  var afterSnapshot = sheet.getRange(2, 1, dataRows, lastCol).getValues();

  // 検証1: 全行 EMP-00001
  var allWritten = afterSnapshot.every(function(row) { return row[targetIdx] === 'EMP-00001'; });

  // 検証2: 他列変化なし（Date は toISOString で比較）
  function normalize(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }
  var otherColDiffs = [];
  for (var r = 0; r < dataRows; r++) {
    for (var c = 0; c < lastCol; c++) {
      if (c === targetIdx) continue;
      if (normalize(beforeSnapshot[r][c]) !== normalize(afterSnapshot[r][c])) {
        otherColDiffs.push({ row: r + 2, col: c + 1, colName: headers[c] });
      }
    }
  }

  return JSON.stringify({
    success: allWritten && otherColDiffs.length === 0,
    allWritten: allWritten,
    otherColDiffs: otherColDiffs,
    dataRows: dataRows,
    colPosition: targetIdx + 1,
    afterSnapshot: afterSnapshot.map(function(row, i) {
      return { rowNum: i + 2, sales_assignee_id: row[targetIdx] };
    })
  });
}

/**
 * DEV専用: LEADS と CUSTOMERS の sales_assignee_id の充足確認（空行数チェック）。
 * @returns {string} JSON
 */
function checkAssigneeIdCompleteness() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();

  function checkSheet(schemaKey) {
    var sheetName = getCoreSchemaV1TableName(schemaKey);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: sheetName + ' が見つかりません' };
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return { sheetName: sheetName, dataRows: 0, nonEmptyCount: 0, emptyCount: 0 };
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var targetIdx = headers.indexOf('sales_assignee_id');
    if (targetIdx === -1) return { sheetName: sheetName, error: 'sales_assignee_id 列が見つかりません' };
    var dataRows = lastRow - 1;
    var values = sheet.getRange(2, targetIdx + 1, dataRows, 1).getValues();
    var emptyCount = 0;
    var nonEmptyCount = 0;
    values.forEach(function(row) {
      if (row[0] === '' || row[0] === null || row[0] === undefined) emptyCount++;
      else nonEmptyCount++;
    });
    return { sheetName: sheetName, dataRows: dataRows, nonEmptyCount: nonEmptyCount, emptyCount: emptyCount, colPosition: targetIdx + 1 };
  }

  var leadsResult = checkSheet('LEADS');
  var customersResult = checkSheet('CUSTOMERS');

  return JSON.stringify({
    allComplete: (leadsResult.emptyCount === 0) && (customersResult.emptyCount === 0),
    LEADS: leadsResult,
    CUSTOMERS: customersResult,
    auditedAt: new Date().toISOString()
  });
}

/**
 * DEV専用: LEADS と CUSTOMERS の sales_assignee_name 列を削除する前バックアップ。
 * @returns {string} JSON
 */
function backupBeforeNameColDelete() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();

  function backupSheet(schemaKey, backupName) {
    var sheetName = getCoreSchemaV1TableName(schemaKey);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, reason: sheetName + ' が見つかりません' };
    var origRows = sheet.getLastRow();
    var origCols = sheet.getLastColumn();
    var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];
    var newSheet = sheet.copyTo(ss);
    ss.setActiveSheet(newSheet);
    ss.moveActiveSheet(ss.getNumSheets());
    newSheet.setName(backupName);
    var bkRows = newSheet.getLastRow();
    var bkCols = newSheet.getLastColumn();
    if (bkRows !== origRows || bkCols !== origCols) {
      return { success: false, reason: '行数または列数が一致しません', origRows: origRows, bkRows: bkRows, origCols: origCols, bkCols: bkCols };
    }
    return { success: true, backupName: backupName, rows: origRows, cols: origCols, headers: origHeaders };
  }

  var leadsResult   = backupSheet('LEADS',     'リード管理_backup_predelete_name_20260901');
  var customersResult = backupSheet('CUSTOMERS', '顧客マスタ_backup_predelete_name_20260901');

  return JSON.stringify({
    allSuccess: leadsResult.success && customersResult.success,
    LEADS: leadsResult,
    CUSTOMERS: customersResult
  });
}

/**
 * DEV専用: LEADS と CUSTOMERS の sales_assignee_name 列のデータを退避シートに保存する。
 * @returns {string} JSON
 */
function evacuateSalesAssigneeNameCols() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();

  function evacuateSheet(schemaKey, evacuateName) {
    var sheetName = getCoreSchemaV1TableName(schemaKey);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, reason: sheetName + ' が見つかりません' };
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 1) return { success: false, reason: 'シートが空' };
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var targetIdx = headers.indexOf('sales_assignee_name');
    if (targetIdx === -1) {
      // 旧列名も確認
      targetIdx = headers.indexOf('営業担当者');
    }
    if (targetIdx === -1) return { success: false, reason: 'sales_assignee_name / 営業担当者 列が見つかりません' };

    var data = sheet.getRange(1, targetIdx + 1, lastRow, 1).getValues();
    var evSheet = ss.insertSheet(evacuateName);
    evSheet.getRange(1, 1, data.length, 1).setValues(data);

    // 値のチェック（ヘッダー除く）
    var nonEmptyCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== '' && data[i][0] !== null && data[i][0] !== undefined) nonEmptyCount++;
    }

    return { success: true, evacuateName: evacuateName, rows: lastRow, colPosition: targetIdx + 1, headerName: data[0][0], nonEmptyCount: nonEmptyCount };
  }

  var leadsResult     = evacuateSheet('LEADS',     'LEADS_sales_assignee_name_20260901');
  var customersResult = evacuateSheet('CUSTOMERS', 'CUSTOMERS_sales_assignee_name_20260901');

  return JSON.stringify({
    allSuccess: leadsResult.success && customersResult.success,
    LEADS: leadsResult,
    CUSTOMERS: customersResult
  });
}

/**
 * DEV専用: LEADS と CUSTOMERS の sales_assignee_name 列削除 dry-run。
 * @returns {string} JSON
 */
function deleteNameColsDryRun() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();

  function check(schemaKey) {
    var sheetName = getCoreSchemaV1TableName(schemaKey);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: sheetName + ' が見つかりません' };
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var targetIdx = headers.indexOf('sales_assignee_name');
    if (targetIdx === -1) targetIdx = headers.indexOf('営業担当者');
    if (targetIdx === -1) return { found: false, reason: '対象列が見つかりません', headers: headers };
    return { found: true, colPosition: targetIdx + 1, headerName: headers[targetIdx], totalCols: lastCol };
  }

  return JSON.stringify({
    dryRun: true,
    LEADS: check('LEADS'),
    CUSTOMERS: check('CUSTOMERS')
  });
}

/**
 * DEV専用: LEADS と CUSTOMERS の sales_assignee_name 列を削除する。
 * 右端から左へ（位置ずれ防止のため、コルPosition降順で削除）。
 * @returns {string} JSON
 */
function deleteNameCols() {
  if (getEnvironment() !== 'development') throw new Error('DEV環境でのみ実行可能');
  var ss = getSpreadsheet();

  function deleteColFromSheet(schemaKey) {
    var sheetName = getCoreSchemaV1TableName(schemaKey);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, reason: sheetName + ' が見つかりません' };
    var beforeCols = sheet.getLastColumn();
    var beforeRows = sheet.getLastRow();
    var headers = sheet.getRange(1, 1, 1, beforeCols).getValues()[0];
    var targetIdx = headers.indexOf('sales_assignee_name');
    if (targetIdx === -1) targetIdx = headers.indexOf('営業担当者');
    if (targetIdx === -1) return { success: false, reason: '対象列が見つかりません' };

    Logger.log('削除: ' + sheetName + ' col' + (targetIdx + 1) + ' = ' + headers[targetIdx]);
    sheet.deleteColumn(targetIdx + 1);

    var afterCols = sheet.getLastColumn();
    var afterRows = sheet.getLastRow();
    var afterHeaders = afterCols > 0 ? sheet.getRange(1, 1, 1, afterCols).getValues()[0] : [];
    var nameStillExists = afterHeaders.indexOf('sales_assignee_name') !== -1 || afterHeaders.indexOf('営業担当者') !== -1;

    return {
      success: (afterCols === beforeCols - 1) && (afterRows === beforeRows) && !nameStillExists,
      beforeCols: beforeCols, afterCols: afterCols, expectedCols: beforeCols - 1,
      beforeRows: beforeRows, afterRows: afterRows,
      nameStillExists: nameStillExists,
      afterHeaders: afterHeaders
    };
  }

  // LEADS と CUSTOMERS を独立して削除（互いに影響しない）
  var leadsResult     = deleteColFromSheet('LEADS');
  var customersResult = deleteColFromSheet('CUSTOMERS');

  return JSON.stringify({
    allSuccess: leadsResult.success && customersResult.success,
    LEADS: leadsResult,
    CUSTOMERS: customersResult
  });
}
