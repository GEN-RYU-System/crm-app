/**
 * Meta Messaging - Discord通知
 *
 * 既存の sendToDiscord() (17_NotificationService.gs) を利用
 */

// ============================================================
// 受信通知
// ============================================================

/**
 * Meta受信メッセージをDiscordに通知
 *
 * @param {Object} msg
 * @param {string} msg.platform
 * @param {string} msg.senderName
 * @param {string} msg.senderId
 * @param {string} msg.messageText
 * @param {Date}   msg.timestamp
 */
function metaNotifyDiscord(msg) {
  const webhookUrl = metaGetDiscordUrl();
  if (!webhookUrl) {
    Logger.log('[Meta] DISCORD_WEBHOOK_URL が未設定のため通知をスキップ');
    return;
  }

  const platformEmoji = {
    [META.PLATFORM.MESSENGER]: '💬',
    [META.PLATFORM.INSTAGRAM]: '📸',
    [META.PLATFORM.WHATSAPP]:  '📱'
  }[msg.platform] || '📩';

  const platformColor = {
    [META.PLATFORM.MESSENGER]: 0x0099FF,  // Facebook青
    [META.PLATFORM.INSTAGRAM]: 0xE1306C,  // Instagram赤紫
    [META.PLATFORM.WHATSAPP]:  0x25D366   // WhatsApp緑
  }[msg.platform] || 0x888888;

  // メッセージ本文を100文字で切り詰め
  const preview = msg.messageText.length > 100
    ? msg.messageText.substring(0, 100) + '…'
    : msg.messageText;

  const timestamp = msg.timestamp
    ? Utilities.formatDate(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        'Asia/Tokyo', 'MM/dd HH:mm')
    : '';

  const discordMessage = {
    embeds: [{
      title:       platformEmoji + ' 新着メッセージ（' + msg.platform + '）',
      description: '```\n' + preview + '\n```',
      color:       platformColor,
      fields: [
        { name: '送信者',   value: msg.senderName + ' (`' + msg.senderId + '`)', inline: true },
        { name: '受信時刻', value: timestamp,                                    inline: true }
      ],
      footer: {
        text: 'Meta Messaging via CRM'
      },
      timestamp: new Date().toISOString()
    }]
  };

  const success = sendToDiscord(webhookUrl, discordMessage);
  if (!success) {
    Logger.log('[Meta] Discord通知失敗: ' + msg.senderName);
  }
}

// ============================================================
// 送信完了通知
// ============================================================

/**
 * 担当者が返信を送信した際のDiscord通知
 *
 * @param {string} platform
 * @param {string} recipientName
 * @param {string} messageText
 */
function metaNotifyDiscordSent(platform, recipientName, messageText) {
  const webhookUrl = metaGetDiscordUrl();
  if (!webhookUrl) return;

  const preview = messageText.length > 100
    ? messageText.substring(0, 100) + '…'
    : messageText;

  const discordMessage = {
    embeds: [{
      title:       '✅ 返信送信完了（' + platform + '）',
      description: '```\n' + preview + '\n```',
      color:       0x57F287,  // Discord緑
      fields: [
        { name: '送信先', value: recipientName, inline: true },
        { name: '送信者', value: 'オペレーター',  inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  sendToDiscord(webhookUrl, discordMessage);
}

// ============================================================
// 接続テスト
// ============================================================

/**
 * Discord接続テスト（GASエディタから手動実行）
 */
function metaTestDiscordNotify() {
  metaNotifyDiscord({
    platform:    META.PLATFORM.MESSENGER,
    senderName:  'テストユーザー',
    senderId:    'test_psid_12345',
    messageText: 'これはMeta Messaging Discord通知のテストメッセージです。',
    timestamp:   new Date()
  });
  Logger.log('[Meta] テスト通知を送信しました');
}
