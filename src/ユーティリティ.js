/**
 * シートIDからシートオブジェクトを取得する便利関数
 */
function getSheetById(gid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  return sheets.find(s => s.getSheetId().toString() === gid);
}

/**
 * 管理者かどうかを判定する関数
 */
function checkIsAdmin() {
  const adminEmails = ["admin@example.com"];
  const currentUserEmail = resolveCurrentUserEmail();
  return {
    email: currentUserEmail,
    role: adminEmails.indexOf(currentUserEmail) !== -1 ? "admin" : "staff"
  };
}
