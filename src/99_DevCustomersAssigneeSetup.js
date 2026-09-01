/**
 * DEV専用: 顧客マスタの削除前バックアップを作成する。
 * @returns {string} JSON
 */
function backupCustomersMasterPreChange() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) {
    return JSON.stringify({ success: false, reason: '顧客マスタシートが見つかりません' });
  }

  var origRows = sheet.getLastRow();
  var origCols = sheet.getLastColumn();
  var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];

  var newSheet = sheet.copyTo(ss);
  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(ss.getNumSheets());
  newSheet.setName('顧客マスタ_backup_20260901');

  var backupRows = newSheet.getLastRow();
  var backupCols = newSheet.getLastColumn();
  var backupHeaders = newSheet.getRange(1, 1, 1, backupCols).getValues()[0];

  if (backupRows !== origRows || backupCols !== origCols) {
    return JSON.stringify({
      success: false,
      reason: '行数または列数が一致しません',
      origRows: origRows, backupRows: backupRows,
      origCols: origCols, backupCols: backupCols
    });
  }

  return JSON.stringify({
    success: true,
    backupName: '顧客マスタ_backup_20260901',
    rows: origRows,
    cols: origCols,
    headers: origHeaders
  });
}

/**
 * DEV専用: 顧客マスタの「担当者ID」ヘッダーを「sales_assignee_id」に変更する。
 * ヘッダー行のみ。データ行には一切触れない。
 * @returns {string} JSON
 */
function renameCustomersAssigneeIdHeader() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) {
    return JSON.stringify({ success: false, reason: '顧客マスタシートが見つかりません' });
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('担当者ID');

  if (targetIdx === -1) {
    // すでに sales_assignee_id になっているか確認
    var alreadyRenamed = headers.indexOf('sales_assignee_id');
    if (alreadyRenamed !== -1) {
      return JSON.stringify({ success: true, message: 'すでに sales_assignee_id に変更済み', colPosition: alreadyRenamed + 1 });
    }
    return JSON.stringify({ success: false, reason: '担当者ID 列が見つかりません', headers: headers });
  }

  // ヘッダー行の1セルのみ変更
  sheet.getRange(1, targetIdx + 1).setValue('sales_assignee_id');

  // 検証
  var afterHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var afterRows = sheet.getLastRow();
  var afterCols = sheet.getLastColumn();

  return JSON.stringify({
    success: true,
    colPosition: targetIdx + 1,
    beforeHeader: '担当者ID',
    afterHeader: afterHeaders[targetIdx],
    afterHeaders: afterHeaders,
    afterRows: afterRows,
    afterCols: afterCols
  });
}
