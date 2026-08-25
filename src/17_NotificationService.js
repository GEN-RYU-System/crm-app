/**
 * PMO通知サービス
 * Discord連携廃止により通知送信機能は削除。
 * 通知設定シートの初期化のみ残置。
 */

// ============================================
// 通知設定シート初期化
// ============================================

/**
 * 通知設定シートを初期化
 */
function initializeNotificationSheet(ss) {
  ss = ss || getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICATION);

  if (!sheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICATION);
      if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEETS.NOTIFICATION);
      }
    } finally {
      lock.releaseLock();
    }
  }

  // 既にデータがある場合はスキップ
  if (sheet.getLastRow() > 1) {
    Logger.log('通知設定シートは既にデータがあるためスキップ');
    return;
  }

  // ヘッダー設定
  const headers = ['通知ID', '通知名', 'メッセージ内容', '頻度', '曜日', '時間', '有効'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // サンプルデータ
  const sampleData = [
    ['N001', '朝会リマインド', '本日の朝会を開始します。PMOプロジェクトを確認してください。', '毎日', '', '09:00', 'TRUE'],
    ['N002', 'PMO週次レビュー', '[PMO_WEEKLY_REVIEW]', '毎週', '金', '17:00', 'TRUE'],
    ['N003', '月次振り返り', '今月の振り返りを行いましょう。IMPROVEMENT_LOG.mdを更新してください。', '毎月', '1', '10:00', 'FALSE']
  ];

  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);

  // 入力規則
  const frequencyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['毎日', '毎週', '毎月'], true)
    .build();
  sheet.getRange(2, 4, 100, 1).setDataValidation(frequencyRule);

  const dayOfWeekRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['月', '火', '水', '木', '金', '土', '日'], true)
    .build();
  sheet.getRange(2, 5, 100, 1).setDataValidation(dayOfWeekRule);

  const enabledRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .build();
  sheet.getRange(2, 7, 100, 1).setDataValidation(enabledRule);

  // 列幅調整
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('通知設定シートを初期化しました');
}
