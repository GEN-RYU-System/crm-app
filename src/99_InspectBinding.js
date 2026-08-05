/**
 * 重複定義されている関数のどの実装が有効かを一括検査する。
 * 対象関数は呼び出さず、toString() で定義の先頭部分を文字列として取得するだけ。
 */
function inspectDuplicateBindings() {
  var names = [
    'addConversationLog',
    'addStaff',
    'archiveOnStatusChange',
    'checkCurrentEnvironment',
    'createConversationLogSheet',
    'createDealReportSheet',
    'deleteRole',
    'deleteStaff',
    'exportConversationLogSampleCSV',
    'exportCustomerMasterSampleCSV',
    'exportLeadsSampleCSV',
    'generateConversationLogId',
    'generateNextLeadId',
    'generateNextLogId',
    'generateQuoteId',
    'generateQuotePDF',
    'generateReportId',
    'getGoals',
    'getHeaderIndexMap',
    'getSheetByGid',
    'getStaffFullName',
    'getStaffList',
    'getWebAppUrl',
    'include',
    'initializeGoalsSheet',
    'initializeGoalsSheetFromMenu',
    'initializePermissionsSheet',
    'initializePermissionsSheetFromMenu',
    'initializeSettingsSheet',
    'initializeSpreadsheet',
    'menuRunAssignMigration',
    'saveBuddyDialogLog',
    'saveDealReport',
    'saveWeeklyReport',
    'sendDiscordNotification',
    'translateAndAddLog',
    'updateStaff'
  ];
  var out = [];
  names.forEach(function(n) {
    try {
      var body = this[n] ? this[n].toString() : eval(n).toString();
      out.push(n + ' :: ' + body.replace(/\s+/g, ' ').slice(0, 120));
    } catch (e) {
      out.push(n + ' :: (取得失敗) ' + e.message);
    }
  });
  return out.join('\n');
}
