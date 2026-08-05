/**
 * 48時間リマインドチェック
 * 時間主導型トリガー（1時間ごと）で実行
 */
function checkAndRemind() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) return;

  const webhook = getRemindWebhook();
  if (!webhook) {
    Logger.log('リマインド用Webhook URLが未設定です。');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const colIndex = {
    進捗ステータス: headers.indexOf('進捗ステータス'),
    シート更新日: headers.indexOf('シート更新日'),
    顧客名: headers.indexOf('顧客名'),
    担当者ID: headers.indexOf('担当者ID'),
    リードID: headers.indexOf('リードID'),
    担当者: headers.indexOf('担当者')
  };

  const now = new Date();
  const threshold = CONFIG.REMIND_THRESHOLD_HOURS * 60 * 60 * 1000;

  let remindCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[colIndex.進捗ステータス];
    const lastUpdate = row[colIndex.シート更新日];
    const customerName = row[colIndex.顧客名] || '不明';
    const staffId = row[colIndex.担当者ID] || '';
    const staffName = row[colIndex.担当者] || '';
    const leadId = row[colIndex.リードID] || '';
    
    // 対応中ステータスかつ48時間経過
    if (CONFIG.ACTIVE_STATUSES.includes(status) && lastUpdate instanceof Date) {
      if (now.getTime() - lastUpdate.getTime() > threshold) {
        sendRemindNotification(webhook, i + 1, customerName, staffId, staffName, leadId, status);
        remindCount++;
      }
    }
  }
  
  if (remindCount > 0) {
    Logger.log(`${remindCount}件のリマインド通知を送信しました。`);
  }
}

/**
 * リマインド通知をDiscordに送信
 */
function sendRemindNotification(webhook, rowNum, customerName, staffId, staffName, leadId, status) {
  const mention = staffId ? `<@${staffId}>\n` : (staffName ? `${staffName}さん\n` : '');
  
  const payload = {
    content: `${mention}⏰ **リマインド**\n**${customerName}** 様（${leadId}）の商談が「${status}」のまま48時間経過しています。\n状況を確認して対応をお願いします🤲`
  };
  
  try {
    UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('リマインド通知エラー: ' + e.message);
  }
}

/**
 * 次回アクション日リマインド（Phase 2用）
 * 期限当日の朝に通知
 */
function checkActionDateRemind() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) return;

  const webhook = getRemindWebhook();
  if (!webhook) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const colIndex = {
    次回アクション日: headers.indexOf('次回アクション日'),
    次回アクション: headers.indexOf('次回アクション'),
    顧客名: headers.indexOf('顧客名'),
    担当者ID: headers.indexOf('担当者ID'),
    リードID: headers.indexOf('リードID'),
    進捗ステータス: headers.indexOf('進捗ステータス')
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const actionDate = row[colIndex.次回アクション日];
    const action = row[colIndex.次回アクション];
    const status = row[colIndex.進捗ステータス];

    // 完了ステータスはスキップ
    if (CONFIG.CLOSED_STATUSES.includes(status)) continue;
    
    if (actionDate instanceof Date) {
      const checkDate = new Date(actionDate);
      checkDate.setHours(0, 0, 0, 0);
      
      if (checkDate.getTime() === today.getTime()) {
        const customerName = row[colIndex.顧客名] || '不明';
        const staffId = row[colIndex.担当者ID] || '';
        const leadId = row[colIndex.リードID] || '';
        
        sendActionDateNotification(webhook, customerName, staffId, leadId, action);
      }
    }
  }
}

/**
 * アクション日通知をDiscordに送信
 */
function sendActionDateNotification(webhook, customerName, staffId, leadId, action) {
  const mention = staffId ? `<@${staffId}>\n` : '';
  const actionText = action || '（アクション未設定）';
  
  const payload = {
    content: `${mention}📅 **本日のアクション**\n**${customerName}** 様（${leadId}）\n→ ${actionText}`
  };
  
  try {
    UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('アクション日通知エラー: ' + e.message);
  }
}
