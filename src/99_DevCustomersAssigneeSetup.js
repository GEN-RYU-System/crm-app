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
