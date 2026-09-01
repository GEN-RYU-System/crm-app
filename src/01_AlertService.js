
// ==================== アラートレベル定義 ====================
const ALERT_LEVELS = {
  LEVEL1: {
    name: 'ダッシュボード表示',
    days: 0, // 即時
    action: 'dashboard'
  },
  LEVEL2: {
    name: 'Buddyポップアップ',
    days: 2, // 2日超過
    action: 'popup'
  },
  LEVEL3: {
    name: 'Discord通知',
    days: 3, // 3日超過
    action: 'discord'
  }
};

// ==================== アラートチェック関数 ====================

/**
 * アクション期限超過をチェック
 * @returns {Array} アラートリスト
 */
function checkOverdueActions() {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) {
    return [];
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const alerts = [];

  leads.forEach(lead => {
    // 商談中のもののみチェック
    if (!CONFIG.DEAL_STATUSES.includes(lead['進捗ステータス'])) return;
    if (!lead['next_action_date']) return;

    const actionDate = new Date(lead['next_action_date']);
    if (actionDate >= today) return;

    const overdueDays = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
    const alertLevel = getAlertLevel(overdueDays);

    alerts.push({
      type: 'overdue_action',
      リードID: lead['lead_id'],
      顧客名: lead['customer_name'],
            担当者: lead['担当者'],
      担当者ID: lead['assignee_id'],
      次回アクション: lead['next_action'],
      次回アクション日: lead['next_action_date'],
      超過日数: overdueDays,
      alertLevel: alertLevel,
      message: `「${lead['customer_name']}」のアクション期限が${overdueDays}日超過しています`
    });
  });

  return alerts.sort((a, b) => b.超過日数 - a.超過日数);
}

/**
 * 長期間更新なしをチェック
 * @param {number} thresholdDays - 閾値日数（デフォルト7日）
 * @returns {Array} アラートリスト
 */
function checkLongNoUpdate(thresholdDays) {
  thresholdDays = thresholdDays || 7;

  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) {
    return [];
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();

  const alerts = [];

  leads.forEach(lead => {
    // 商談中のもののみチェック
    if (!CONFIG.DEAL_STATUSES.includes(lead['進捗ステータス'])) return;
    if (!lead['sheet_updated_at']) return;

    const updateDate = new Date(lead['sheet_updated_at']);
    const daysSinceUpdate = Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate < thresholdDays) return;

    const alertLevel = getAlertLevel(daysSinceUpdate - thresholdDays);

    alerts.push({
      type: 'long_no_update',
      リードID: lead['lead_id'],
      顧客名: lead['customer_name'],
            担当者: lead['担当者'],
      担当者ID: lead['assignee_id'],
      シート更新日: lead['sheet_updated_at'],
      未更新日数: daysSinceUpdate,
      alertLevel: alertLevel,
      message: `「${lead['customer_name']}」が${daysSinceUpdate}日間更新されていません`
    });
  });

  return alerts.sort((a, b) => b.未更新日数 - a.未更新日数);
}

/**
 * 高温度リードの停滞チェック
 * @param {number} thresholdDays - 閾値日数（デフォルト3日）
 * @returns {Array} アラートリスト
 */
function checkHotLeadStagnation(thresholdDays) {
  thresholdDays = thresholdDays || 3;

  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) {
    return [];
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();

  const alerts = [];

  leads.forEach(lead => {
    // 商談中かつ温度感「高」のみチェック
    if (!CONFIG.DEAL_STATUSES.includes(lead['進捗ステータス'])) return;
    if (lead['temperature'] !== '高') return;
    if (!lead['sheet_updated_at']) return;

    const updateDate = new Date(lead['sheet_updated_at']);
    const daysSinceUpdate = Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate < thresholdDays) return;

    alerts.push({
      type: 'hot_lead_stagnation',
      リードID: lead['lead_id'],
      顧客名: lead['customer_name'],
            担当者: lead['担当者'],
      担当者ID: lead['assignee_id'],
      温度感: lead['temperature'],
      シート更新日: lead['sheet_updated_at'],
      未更新日数: daysSinceUpdate,
      alertLevel: 'LEVEL2', // 高温度は即座にLEVEL2
      message: `高温度の「${lead['customer_name']}」が${daysSinceUpdate}日間動きがありません`
    });
  });

  return alerts.sort((a, b) => b.未更新日数 - a.未更新日数);
}

/**
 * アラートレベルを判定
 * @param {number} overdueDays - 超過日数
 * @returns {string} アラートレベル
 */
function getAlertLevel(overdueDays) {
  if (overdueDays >= ALERT_LEVELS.LEVEL3.days) return 'LEVEL3';
  if (overdueDays >= ALERT_LEVELS.LEVEL2.days) return 'LEVEL2';
  return 'LEVEL1';
}

/**
 * 全アラートを取得
 * @param {string} staffId - 担当者ID（nullの場合は全員）
 * @returns {Object} アラートデータ
 */
function getAlertList(staffId) {
  const overdueActions = checkOverdueActions();
  const longNoUpdate = checkLongNoUpdate(7);
  const hotLeadStagnation = checkHotLeadStagnation(3);

  let allAlerts = [
    ...overdueActions,
    ...longNoUpdate,
    ...hotLeadStagnation
  ];

  // 担当者でフィルタ
  if (staffId) {
    allAlerts = allAlerts.filter(a => a.担当者ID === staffId);
  }

  // 重複を除去（同じリードIDで複数のアラートがある場合）
  const seen = new Map();
  allAlerts.forEach(alert => {
    const key = alert.リードID + '_' + alert.type;
    if (!seen.has(key) || getAlertPriority(alert.alertLevel) > getAlertPriority(seen.get(key).alertLevel)) {
      seen.set(key, alert);
    }
  });

  const uniqueAlerts = Array.from(seen.values());

  // アラートレベルでソート
  uniqueAlerts.sort((a, b) => getAlertPriority(b.alertLevel) - getAlertPriority(a.alertLevel));

  return {
    alerts: uniqueAlerts,
    summary: {
      total: uniqueAlerts.length,
      level1: uniqueAlerts.filter(a => a.alertLevel === 'LEVEL1').length,
      level2: uniqueAlerts.filter(a => a.alertLevel === 'LEVEL2').length,
      level3: uniqueAlerts.filter(a => a.alertLevel === 'LEVEL3').length
    },
    byType: {
      overdue_action: overdueActions.length,
      long_no_update: longNoUpdate.length,
      hot_lead_stagnation: hotLeadStagnation.length
    },
    lastChecked: new Date().toISOString()
  };
}

/**
 * アラート優先度を取得
 * @param {string} level - アラートレベル
 * @returns {number} 優先度
 */
function getAlertPriority(level) {
  switch (level) {
    case 'LEVEL3': return 3;
    case 'LEVEL2': return 2;
    case 'LEVEL1': return 1;
    default: return 0;
  }
}

// ==================== Buddyポップアップ ====================

/**
 * Buddyポップアップ用アラートを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} ポップアップデータ
 */
function getBuddyAlertPopup(staffId) {
  const alertData = getAlertList(staffId);

  // LEVEL2以上のアラートをフィルタ
  const urgentAlerts = alertData.alerts.filter(a =>
    a.alertLevel === 'LEVEL2' || a.alertLevel === 'LEVEL3'
  );

  if (urgentAlerts.length === 0) {
    return {
      showPopup: false,
      message: null
    };
  }

  // 最も緊急度の高いアラートを選択
  const topAlert = urgentAlerts[0];

  // Buddyメッセージを生成
  let buddyMessage = '';
  if (topAlert.alertLevel === 'LEVEL3') {
    buddyMessage = `ちょっと待って！${topAlert.顧客名}さんのアクションが${topAlert.超過日数 || topAlert.未更新日数}日も止まってるよ。今すぐ確認しよう！`;
  } else {
    buddyMessage = `${topAlert.顧客名}さんの対応が少し遅れてるみたい。時間があるときにチェックしてね。`;
  }

  return {
    showPopup: true,
    alertLevel: topAlert.alertLevel,
    alert: topAlert,
    message: buddyMessage,
    totalUrgent: urgentAlerts.length,
    allUrgentAlerts: urgentAlerts.slice(0, 5) // 最大5件
  };
}

// ==================== Discord通知 ====================

/**
 * Discord通知を送信
 * @param {Object} alert - アラートデータ
 */
function sendAlertToDiscord(alert) {
  const webhookUrl = getRemindWebhook();
  if (!webhookUrl) {
    Logger.log('Discord Webhook URLが設定されていません');
    return;
  }

  const color = alert.alertLevel === 'LEVEL3' ? 0xFF0000 : 0xFFA500;
  const title = alert.alertLevel === 'LEVEL3' ? '緊急アラート' : '注意アラート';

  const payload = {
    embeds: [{
      title: `${title}: ${alert.type === 'overdue_action' ? 'アクション期限超過' : alert.type === 'long_no_update' ? '長期未更新' : '高温度リード停滞'}`,
      color: color,
      fields: [
        { name: 'リードID', value: alert.リードID, inline: true },
        { name: '顧客名', value: alert.顧客名, inline: true },
        { name: '担当者', value: alert.担当者 || '未アサイン', inline: true },
        { name: '詳細', value: alert.message, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    Logger.log('Discord通知を送信しました: ' + alert.リードID);
  } catch (error) {
    Logger.log('Discord通知の送信に失敗しました: ' + error.message);
  }
}

// ==================== トリガー設定 ====================

/**
 * アラートトリガーをセットアップ
 */
function setupAlertTriggers() {
  // 既存のアラートトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const funcName = trigger.getHandlerFunction();
    if (funcName === 'runDailyAlertCheck' || funcName === 'runHourlyAlertCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 毎日朝9時にデイリーアラートチェック
  ScriptApp.newTrigger('runDailyAlertCheck')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  // 毎時アラートチェック（営業時間内: 9-18時）
  ScriptApp.newTrigger('runHourlyAlertCheck')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('アラートトリガーをセットアップしました');
  return { success: true };
}

/**
 * 毎日のアラートチェック（トリガーから呼び出し）
 */
function runDailyAlertCheck() {
  Logger.log('デイリーアラートチェックを開始');

  const alertData = getAlertList(null);

  // LEVEL3アラートをDiscordに通知
  const level3Alerts = alertData.alerts.filter(a => a.alertLevel === 'LEVEL3');

  if (level3Alerts.length > 0) {
    // サマリーを送信
    sendDailySummaryToDiscord(alertData);

    // 個別アラートを送信（最大10件）
    level3Alerts.slice(0, 10).forEach(alert => {
      sendAlertToDiscord(alert);
      Utilities.sleep(500); // レート制限対策
    });
  }

  Logger.log(`デイリーアラートチェック完了: ${alertData.summary.total}件のアラート`);
}

/**
 * 毎時のアラートチェック（トリガーから呼び出し）
 */
function runHourlyAlertCheck() {
  const now = new Date();
  const hour = now.getHours();

  // 営業時間外はスキップ（9時-18時以外）
  if (hour < 9 || hour >= 18) {
    return;
  }

  Logger.log('アワリーアラートチェックを開始');

  const alertData = getAlertList(null);

  // 新しいLEVEL3アラート（本日発生）をチェック
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 通知済みキャッシュを取得
  const cache = CacheService.getScriptCache();
  const notifiedKey = 'NOTIFIED_ALERTS_' + todayStart.toISOString().split('T')[0];
  const notifiedIds = JSON.parse(cache.get(notifiedKey) || '[]');

  const newLevel3Alerts = alertData.alerts.filter(a =>
    a.alertLevel === 'LEVEL3' && !notifiedIds.includes(a.リードID)
  );

  if (newLevel3Alerts.length > 0) {
    newLevel3Alerts.forEach(alert => {
      sendAlertToDiscord(alert);
      notifiedIds.push(alert.リードID);
      Utilities.sleep(500);
    });

    // 通知済みリストを更新
    cache.put(notifiedKey, JSON.stringify(notifiedIds), 86400);
  }

  Logger.log(`アワリーアラートチェック完了: ${newLevel3Alerts.length}件の新規LEVEL3アラート`);
}

/**
 * デイリーサマリーをDiscordに送信
 * @param {Object} alertData - アラートデータ
 */
function sendDailySummaryToDiscord(alertData) {
  const webhookUrl = getRemindWebhook();
  if (!webhookUrl) return;

  const payload = {
    embeds: [{
      title: '📊 デイリーアラートサマリー',
      color: 0x4A86E8,
      fields: [
        { name: '総アラート数', value: String(alertData.summary.total), inline: true },
        { name: 'LEVEL3（緊急）', value: String(alertData.summary.level3), inline: true },
        { name: 'LEVEL2（注意）', value: String(alertData.summary.level2), inline: true },
        { name: '期限超過', value: String(alertData.byType.overdue_action), inline: true },
        { name: '長期未更新', value: String(alertData.byType.long_no_update), inline: true },
        { name: '高温度停滞', value: String(alertData.byType.hot_lead_stagnation), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch (error) {
    Logger.log('サマリー通知の送信に失敗しました: ' + error.message);
  }
}

// ==================== 通知確認機能 ====================

/**
 * アラート確認済みにマーク
 * @param {string} leadId - リードID
 */
function markAlertAsRead(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) return { success: false };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('lead_id');
  const notifyIdx = headers.indexOf('通知確認');

  if (idIdx === -1 || notifyIdx === -1) return { success: false };

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === leadId) {
      sheet.getRange(i + 1, notifyIdx + 1).setValue(new Date());
      return { success: true };
    }
  }

  return { success: false };
}
