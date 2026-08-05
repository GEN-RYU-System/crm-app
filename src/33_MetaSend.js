/**
 * Meta Send API - メッセージ送信
 *
 * 対応プラットフォーム:
 *   - Facebook Messenger (実装済み)
 *   - Instagram DM      (Phase 2)
 *   - WhatsApp          (Phase 3)
 */

// ============================================================
// メイン送信インターフェース（doPost action='metaSendMessage' から呼ぶ）
// ============================================================

/**
 * プラットフォームに応じたメッセージ送信
 * UIのsendボタン → doPost(action:'metaSendMessage') → この関数
 *
 * @param {Object} params
 * @param {string} params.platform    - META.PLATFORM.*
 * @param {string} params.recipientId - 送信先ID（PSID / IGSID / WA電話番号）
 * @param {string} params.messageText - 送信テキスト
 * @param {string} params.senderName  - 送信先表示名（ログ用）
 * @returns {Object} {success, messageId, error}
 */
function metaSendMessage(params) {
  const platform    = params.platform    || META.PLATFORM.MESSENGER;
  const recipientId = params.recipientId || '';
  const messageText = params.messageText || '';
  const senderName  = params.senderName  || recipientId;

  if (!recipientId || !messageText) {
    return { success: false, error: '送信先IDとメッセージ本文は必須です' };
  }

  let result;

  switch (platform) {
    case META.PLATFORM.MESSENGER:
      result = metaSendMessengerMessage(recipientId, messageText);
      break;
    case META.PLATFORM.INSTAGRAM:
      // Phase 2: Instagram実装時に追加
      result = { success: false, error: 'Instagram送信はPhase 2で実装予定です' };
      break;
    case META.PLATFORM.WHATSAPP:
      // Phase 3: WhatsApp実装時に追加
      result = { success: false, error: 'WhatsApp送信はPhase 3で実装予定です' };
      break;
    default:
      result = { success: false, error: '未知のプラットフォーム: ' + platform };
  }

  // 送信ログをスプレッドシートに追記
  const logStatus = result.success ? META.STATUS.SENT : META.STATUS.ERROR;
  metaAppendSentLog(recipientId, senderName, messageText, platform, logStatus);

  return result;
}

// ============================================================
// Facebook Messenger 送信
// ============================================================

/**
 * Messenger Send APIでテキストメッセージを送信
 *
 * @param {string} recipientPsid - 送信先ページスコープID
 * @param {string} text          - メッセージ本文
 * @returns {Object} {success, messageId, error}
 */
function metaSendMessengerMessage(recipientPsid, text) {
  const token = metaGetPageToken();
  if (!token) {
    return { success: false, error: 'META_PAGE_ACCESS_TOKEN が未設定です' };
  }

  const url = META.GRAPH_API + '/me/messages?access_token=' + encodeURIComponent(token);

  const payload = {
    recipient:      { id: recipientPsid },
    message:        { text: text },
    messaging_type: 'RESPONSE'  // ユーザーの最後のメッセージから24時間以内の返信
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method:          'post',
      contentType:     'application/json',
      payload:         JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code       = response.getResponseCode();
    const responseText = response.getContentText();

    if (code === 200) {
      const data = JSON.parse(responseText);
      Logger.log('[Meta] Messenger送信成功: messageId=' + data.message_id);
      return { success: true, messageId: data.message_id };
    }

    // エラー詳細をパース
    let errorMsg = 'HTTP ' + code;
    try {
      const errData = JSON.parse(responseText);
      errorMsg = errData.error ? errData.error.message : errorMsg;
    } catch (e) { /* パース失敗は無視 */ }

    Logger.log('[Meta] Messenger送信失敗: ' + errorMsg);
    return { success: false, error: errorMsg };

  } catch (err) {
    Logger.log('[Meta] Messenger送信エラー: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Phase 2: Instagram DM 送信（スタブ）
// ============================================================

/**
 * Instagram Messaging APIでテキストメッセージを送信
 * Phase 2実装用スタブ
 *
 * @param {string} recipientIgsid - Instagram Scoped ID
 * @param {string} text
 * @returns {Object} {success, messageId, error}
 */
function metaSendInstagramMessage(recipientIgsid, text) {
  // TODO: Phase 2
  // エンドポイント: POST /v19.0/me/messages
  // トークン: Instagram Business AccountのアクセストークンをMETA_IG_ACCESS_TOKENに追加
  // ペイロード形式はMessengerとほぼ同じ
  return { success: false, error: 'Phase 2 未実装' };
}

// ============================================================
// Phase 3: WhatsApp 送信（スタブ）
// ============================================================

/**
 * WhatsApp Business APIでテキストメッセージを送信
 * Phase 3実装用スタブ
 *
 * @param {string} recipientPhone - E.164形式の電話番号（例: +819012345678）
 * @param {string} text
 * @returns {Object} {success, messageId, error}
 */
function metaSendWhatsAppMessage(recipientPhone, text) {
  // TODO: Phase 3
  // エンドポイント: POST /v19.0/{phone-number-id}/messages
  // トークン: META_WA_ACCESS_TOKEN を追加
  // ペイロード形式は Messenger と異なる（type: 'text', text: { body: ... }）
  return { success: false, error: 'Phase 3 未実装' };
}

// ============================================================
// テスト用関数
// ============================================================

// ============================================================
// UI（meta_inbox.html）からの google.script.run 呼び出し用ラッパー
// ============================================================

/**
 * meta_inbox.html の google.script.run から直接呼ばれる公開関数
 * 戻り値は文字列（JSON.stringify済み）で返す
 *
 * @param {string} platform
 * @param {string} recipientId
 * @param {string} messageText
 * @param {string} senderName
 * @returns {string} JSON文字列 {success, messageId, error}
 */
function metaSendMessageFromUI(platform, recipientId, messageText, senderName) {
  const result = metaSendMessage({
    platform:    platform,
    recipientId: recipientId,
    messageText: messageText,
    senderName:  senderName || recipientId
  });
  // 送信成功時はDiscord通知
  if (result.success) {
    metaNotifyDiscordSent(platform, senderName || recipientId, messageText);
  }
  return JSON.stringify(result);
}

// ============================================================
// テスト用関数
// ============================================================

/**
 * Messengerメッセージ送信テスト
 * GASエディタから手動実行でテスト
 */
function metaTestSendMessage() {
  const testPsid = 'YOUR_TEST_PSID_HERE';  // テスト送信先PSIDに変更
  const result = metaSendMessengerMessage(testPsid, '[テスト送信] Meta Messaging API接続確認');
  Logger.log(JSON.stringify(result));
}
