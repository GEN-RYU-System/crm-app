/**
 * 一時確認用。Script Properties の値は返却・ログ出力しない。
 */
function getConfiguredSpreadsheetFileNamesForVerification() {
  return {
    devFileName: DriveApp.getFileById(getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID')).getName(),
    erpFileName: DriveApp.getFileById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID')).getName()
  };
}
