/**
 * PMO通知サービス
 * Discord通知機能（作業完了通知、週次レビュー通知）
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

// ============================================
// Discord通知送信
// ============================================

/**
 * Discordにメッセージを送信
 */
function sendToDiscord(webhookUrl, message) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();

    return responseCode >= 200 && responseCode < 300;
  } catch (error) {
    Logger.log('Discord送信エラー: ' + error.message);
    return false;
  }
}

/**
 * PMO Discord Webhook URLを取得
 */
function getPmoWebhook() {
  return getProperty('PMO_DISCORD_WEBHOOK');
}

/**
 * PMO プロジェクトURLを取得
 */
function getPmoProjectUrl() {
  return getProperty('PMO_PROJECT_URL') || 'https://claude.ai/project/019baa4d-0736-72d7-87b0-108c6377ecb0';
}

/**
 * GitHub URLを取得
 */
function getGithubUrl() {
  return getProperty('GITHUB_URL') || 'https://github.com/shingo-ops/sales-ops-with-claude';
}

// ============================================
// 作業完了通知
// ============================================

/**
 * 作業完了通知のダイアログを表示
 */
function promptWorkCompletionNotification() {
  const ui = SpreadsheetApp.getUi();

  // プロジェクト名を入力
  const projectResponse = ui.prompt(
    '作業完了通知',
    'プロジェクト名を入力してください（例: CRM）:',
    ui.ButtonSet.OK_CANCEL
  );
  if (projectResponse.getSelectedButton() !== ui.Button.OK) return;
  const projectName = projectResponse.getResponseText() || 'CRM';

  // 作業タイトルを入力
  const titleResponse = ui.prompt(
    '作業完了通知',
    '作業タイトルを入力してください:',
    ui.ButtonSet.OK_CANCEL
  );
  if (titleResponse.getSelectedButton() !== ui.Button.OK) return;
  const workTitle = titleResponse.getResponseText() || '作業完了';

  // 変更内容を入力
  const changesResponse = ui.prompt(
    '作業完了通知',
    '変更内容を入力してください（カンマ区切りで複数可）:',
    ui.ButtonSet.OK_CANCEL
  );
  if (changesResponse.getSelectedButton() !== ui.Button.OK) return;
  const changes = changesResponse.getResponseText() || '';

  // 更新ファイルを入力
  const filesResponse = ui.prompt(
    '作業完了通知',
    '更新ファイルを入力してください（カンマ区切りで複数可）:',
    ui.ButtonSet.OK_CANCEL
  );
  if (filesResponse.getSelectedButton() !== ui.Button.OK) return;
  const files = filesResponse.getResponseText() || '';

  // 次回タスクを入力
  const nextTasksResponse = ui.prompt(
    '作業完了通知',
    '次回タスクを入力してください（カンマ区切りで複数可、なければ空欄）:',
    ui.ButtonSet.OK_CANCEL
  );
  if (nextTasksResponse.getSelectedButton() !== ui.Button.OK) return;
  const nextTasks = nextTasksResponse.getResponseText() || '';

  // 横展開候補を入力
  const lateralResponse = ui.prompt(
    '作業完了通知',
    '横展開候補を入力してください（なければ空欄）:',
    ui.ButtonSet.OK_CANCEL
  );
  if (lateralResponse.getSelectedButton() !== ui.Button.OK) return;
  const lateral = lateralResponse.getResponseText() || '';

  // 通知を送信
  const result = sendWorkCompletionNotification(projectName, workTitle, changes, files, nextTasks, lateral);

  if (result) {
    ui.alert('作業完了通知を送信しました！');
  } else {
    ui.alert('通知の送信に失敗しました。Webhook URLを確認してください。');
  }
}

/**
 * 作業完了通知を送信
 */
function sendWorkCompletionNotification(projectName, workTitle, changes, files, nextTasks, lateral) {
  const webhook = getPmoWebhook();
  if (!webhook) {
    Logger.log('PMO_DISCORD_WEBHOOK が設定されていません');
    return false;
  }

  const githubUrl = getGithubUrl();

  // 変更内容を箇条書きに変換
  const changesList = changes.split(',').map(c => c.trim()).filter(c => c);
  const changesText = changesList.length > 0
    ? changesList.map(c => `- ${c}`).join('\n')
    : '- なし';

  // 更新ファイルを箇条書きに変換
  const filesList = files.split(',').map(f => f.trim()).filter(f => f);
  const filesText = filesList.length > 0
    ? filesList.map(f => `- ${f}`).join('\n')
    : '- なし';

  // 次回タスクを箇条書きに変換
  const tasksList = nextTasks.split(',').map(t => t.trim()).filter(t => t);
  const tasksText = tasksList.length > 0
    ? tasksList.map(t => `- ${t}`).join('\n')
    : '- なし';

  // 横展開候補
  const lateralText = lateral.trim() || 'なし';

  // PMOコピペ用Markdown
  const pmoMarkdown = `# 作業完了報告

## プロジェクト
${projectName}

## 作業内容
${changesText}

## 更新ファイル
${filesText}

## 次回タスク
${tasksText}

## 横展開候補
- ${lateralText}`;

  // Discord用の変更内容概要
  const summaryText = changesList.length > 0
    ? changesList.slice(0, 3).map(c => `- ${c}`).join('\n') + (changesList.length > 3 ? '\n- ...' : '')
    : '- なし';

  const message = {
    content: `**[${projectName}]: ${workTitle}**`,
    embeds: [{
      title: '作業完了',
      description: `**【変更内容】**\n${summaryText}`,
      color: 5763719, // 緑色
      fields: [
        {
          name: '【PMOへのコピペ用】',
          value: '```markdown\n' + pmoMarkdown + '\n```',
          inline: false
        }
      ],
      footer: {
        text: `GitHub: ${githubUrl}`
      },
      timestamp: new Date().toISOString()
    }]
  };

  return sendToDiscord(webhook, message);
}

// ============================================
// 週次レビュー通知
// ============================================

/**
 * 週次レビューリマインド通知を送信（UI付き）
 */
function sendWeeklyReviewReminder() {
  const result = sendWeeklyReviewReminderSilent();

  try {
    const ui = SpreadsheetApp.getUi();
    if (result) {
      ui.alert('週次レビュー通知を送信しました！');
    } else {
      ui.alert('通知の送信に失敗しました。Webhook URLを確認してください。');
    }
  } catch (e) {
    // トリガーからの実行時はUIがないので無視
  }

  return result;
}

/**
 * 週次レビューリマインド通知を送信（サイレント版）
 */
function sendWeeklyReviewReminderSilent() {
  const webhook = getPmoWebhook();
  if (!webhook) {
    Logger.log('PMO_DISCORD_WEBHOOK が設定されていません');
    return false;
  }

  const pmoUrl = getPmoProjectUrl();

  // 日付計算
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const formatDate = (date) => {
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
  };

  const startDate = formatDate(oneWeekAgo);
  const endDate = formatDate(now);

  // PMOコピペ用Markdown
  const pmoMarkdown = `# PMOレビュー依頼

## 期間
${startDate} 〜 ${endDate}

## 今週の作業サマリー
- [日付] 作業内容を記入
- [日付] 作業内容を記入

## 確認事項
- 横展開候補の有無
- 改善提案
- 次週の優先順位

PMOレポートをお願いします。`;

  const message = {
    content: '**PMO定期レビューのお時間です**',
    embeds: [{
      title: '週次レビュー',
      description: '以下をコピーしてPMOに貼り付けてください：',
      color: 3447003, // 青色
      fields: [
        {
          name: 'コピペ用テンプレート',
          value: '```markdown\n' + pmoMarkdown + '\n```',
          inline: false
        }
      ],
      footer: {
        text: `PMO: ${pmoUrl}`
      },
      timestamp: new Date().toISOString()
    }]
  };

  return sendToDiscord(webhook, message);
}

// ============================================
// スケジュール通知
// ============================================

/**
 * スケジュールされた通知を実行
 */
function runScheduledNotifications() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICATION);

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('通知設定がありません');
    return;
  }

  const webhook = getPmoWebhook();
  if (!webhook) {
    Logger.log('PMO_DISCORD_WEBHOOK が設定されていません');
    return;
  }

  const now = new Date();
  const currentHour = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:00');
  const currentDayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
  const currentDayOfMonth = now.getDate().toString();

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idIdx = headers.indexOf('通知ID');
  const nameIdx = headers.indexOf('通知名');
  const messageIdx = headers.indexOf('メッセージ内容');
  const frequencyIdx = headers.indexOf('頻度');
  const dayIdx = headers.indexOf('曜日');
  const timeIdx = headers.indexOf('時間');
  const enabledIdx = headers.indexOf('有効');

  let sentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 有効チェック
    if (row[enabledIdx] !== true && row[enabledIdx] !== 'TRUE') continue;

    // 時間チェック
    const scheduledTime = row[timeIdx];
    if (!scheduledTime || scheduledTime !== currentHour) continue;

    // 頻度チェック
    const frequency = row[frequencyIdx];
    let shouldSend = false;

    if (frequency === '毎日') {
      shouldSend = true;
    } else if (frequency === '毎週') {
      shouldSend = (row[dayIdx] === currentDayOfWeek);
    } else if (frequency === '毎月') {
      shouldSend = (row[dayIdx] === currentDayOfMonth);
    }

    if (shouldSend) {
      const messageContent = row[messageIdx];

      // 特殊通知タイプのチェック
      if (messageContent === '[PMO_WEEKLY_REVIEW]') {
        if (sendWeeklyReviewReminderSilent()) {
          sentCount++;
          Logger.log(`通知送信: ${row[nameIdx]} (PMO週次レビュー)`);
        }
      } else {
        // 通常通知
        const projectUrl = getPmoProjectUrl();
        const githubUrl = getGithubUrl();

        const message = {
          embeds: [{
            title: row[nameIdx],
            description: messageContent,
            color: 5814783, // 緑色
            fields: [],
            timestamp: new Date().toISOString()
          }]
        };

        if (projectUrl) {
          message.embeds[0].fields.push({ name: 'PMO', value: projectUrl, inline: true });
        }
        if (githubUrl) {
          message.embeds[0].fields.push({ name: 'GitHub', value: githubUrl, inline: true });
        }

        if (sendToDiscord(webhook, message)) {
          sentCount++;
          Logger.log(`通知送信: ${row[nameIdx]}`);
        }
      }
    }
  }

  Logger.log(`${sentCount}件の通知を送信しました`);
}

// ============================================
// テスト通知
// ============================================

/**
 * テスト通知を送信
 */
function sendTestNotification() {
  const webhook = getPmoWebhook();
  if (!webhook) {
    SpreadsheetApp.getUi().alert('エラー: PMO_DISCORD_WEBHOOK が設定されていません。\n\nスクリプトプロパティに以下を設定してください:\n- PMO_DISCORD_WEBHOOK\n- PMO_PROJECT_URL\n- GITHUB_URL');
    return;
  }

  const projectUrl = getPmoProjectUrl();
  const githubUrl = getGithubUrl();

  const message = {
    embeds: [{
      title: 'PMO通知システム - テスト',
      description: 'PMO通知システムが正常に動作しています。',
      color: 3447003, // 青色
      fields: [
        { name: 'PMOプロジェクト', value: projectUrl, inline: true },
        { name: 'GitHub', value: githubUrl, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  const result = sendToDiscord(webhook, message);

  if (result) {
    SpreadsheetApp.getUi().alert('テスト通知を送信しました！');
  } else {
    SpreadsheetApp.getUi().alert('通知の送信に失敗しました。Webhook URLを確認してください。');
  }
}

// ============================================
// 通知トリガー管理
// ============================================

/**
 * 通知トリガーを設定（毎時実行）
 */
function setupNotificationTriggers() {
  // 既存の通知トリガーを削除
  removeNotificationTriggers();

  // 毎時トリガーを設定
  ScriptApp.newTrigger('runScheduledNotifications')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert('通知トリガーを設定しました（毎時実行）');
}

/**
 * 通知トリガーを削除
 */
function removeNotificationTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runScheduledNotifications') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * PMO通知の初期プロパティを設定
 */
function setPmoNotificationProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'PMO_DISCORD_WEBHOOK': 'https://discord.com/api/webhooks/YOUR_WEBHOOK_URL',
    'PMO_PROJECT_URL': 'https://claude.ai/project/019baa4d-0736-72d7-87b0-108c6377ecb0',
    'GITHUB_URL': 'https://github.com/shingo-ops/sales-ops-with-claude'
  });

  SpreadsheetApp.getUi().alert('PMO通知プロパティのテンプレートを設定しました。\n\nGASエディタで「プロジェクトの設定」→「スクリプトプロパティ」から PMO_DISCORD_WEBHOOK を正しい値に変更してください。');
}
