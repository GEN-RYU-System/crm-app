/**
 * Meta Webhook ハンドラー
 *
 * doGet()  → metaHandleVerification(e)   で Webhook URL検証
 * doPost() → metaHandleWebhookPost(e)    でメッセージ受信
 *
 * 5秒対応フロー:
 *   doPost() ─ペイロードをmeta_queueシートに書き込み(~200ms)─ 200 OK返却
 *             └─ processMetaQueue() をトリガー経由で実行（1分後）
 */

// ============================================================
// GET: Webhook検証
// ============================================================

/**
 * Meta Webhook検証ハンドラー
 * doGet() 内で hub.mode パラメータがある場合に呼び出す
 *
 * @param {Object} e - doGet イベントオブジェクト
 * @returns {ContentService.TextOutput}
 */
function metaHandleVerification(e) {
  const params    = e.parameter || {};
  const mode      = params['hub.mode'];
  const token     = params['hub.verify_token'];
  const challenge = params['hub.challenge'];

  const verifyToken = metaGetVerifyToken();
  if (!verifyToken) {
    Logger.log('[Meta] META_VERIFY_TOKEN が未設定です');
    return ContentService.createTextOutput('Configuration Error')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  if (mode === 'subscribe' && token === verifyToken) {
    Logger.log('[Meta] Webhook検証成功');
    return ContentService.createTextOutput(challenge)
      .setMimeType(ContentService.MimeType.TEXT);
  }

  Logger.log('[Meta] Webhook検証失敗: mode=' + mode + ', token_match=' + (token === verifyToken));
  return ContentService.createTextOutput('Forbidden')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// POST: Webhookイベント受信（5秒対応 - キュー書き込みのみ）
// ============================================================

/**
 * Meta Webhookペイロードかどうか判定
 *
 * @param {Object} body - パース済みJSONオブジェクト
 * @returns {boolean}
 */
function isMetaWebhookPayload(body) {
  return !!(body && body.object && body.entry && Array.isArray(body.entry));
}

/**
 * Meta Webhookイベント受信ハンドラー
 * ペイロードをキューに積んで即座に 200 EVENT_RECEIVED を返す
 *
 * @param {Object} e - doPost イベントオブジェクト
 * @returns {ContentService.TextOutput}
 */
function metaHandleWebhookPost(e) {
  try {
    const rawBody = e.postData ? e.postData.contents : '';
    if (!rawBody) {
      return ContentService.createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    const body = JSON.parse(rawBody);

    // キューにエンキュー（最速処理、~200ms）
    metaEnqueue(body.object, rawBody);

    // ★ここで即座に200を返す（5秒制限への対応）★
    return ContentService.createTextOutput('EVENT_RECEIVED')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    Logger.log('[Meta] Webhook受信エラー: ' + err.message);
    // エラーでも200を返す（Metaがリトライしないようにするため）
    return ContentService.createTextOutput('EVENT_RECEIVED')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ============================================================
// キューへの書き込み / 読み出し
// ============================================================

/**
 * meta_queue シートにエンキュー
 *
 * @param {string} objectType - 'page' / 'instagram' / 'whatsapp_business_account'
 * @param {string} rawJson    - 生ペイロードJSON文字列
 */
function metaEnqueue(objectType, rawJson) {
  try {
    const ss    = metaGetSpreadsheet();
    let sheet   = ss.getSheetByName(META.SHEET.QUEUE);
    if (!sheet) {
      sheet = metaInitQueueSheet(ss);
    }
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([timestamp, objectType, rawJson, false]);
  } catch (err) {
    Logger.log('[Meta] キュー書き込みエラー: ' + err.message);
  }
}

// ============================================================
// キュー処理（1分トリガーから実行）
// ============================================================

/**
 * meta_queue の未処理行を処理する
 * トリガー: ScriptApp.newTrigger('processMetaQueue').timeBased().everyMinutes(1).create()
 */
function processMetaQueue() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);  // 30秒待機（多重実行防止）
  } catch (e) {
    Logger.log('[Meta] processMetaQueue: ロック取得失敗（別インスタンスが実行中）');
    return;
  }

  try {
    const ss = metaGetSpreadsheet();
    const sheet = ss.getSheetByName(META.SHEET.QUEUE);
    if (!sheet || sheet.getLastRow() < 2) return;

    const data     = sheet.getDataRange().getValues();
    let processed  = 0;

    for (let i = 1; i < data.length; i++) {
      const row       = data[i];
      const isDone    = row[3];
      if (isDone === true || isDone === 'TRUE') continue;  // 処理済みスキップ

      const objectType = row[1];
      const rawJson    = row[2];

      try {
        const payload = JSON.parse(rawJson);
        metaDispatchWebhook(objectType, payload);

        // 処理済みにマーク
        sheet.getRange(i + 1, 4).setValue(true);
        processed++;
      } catch (parseErr) {
        Logger.log('[Meta] キュー処理エラー (行' + (i + 1) + '): ' + parseErr.message);
        sheet.getRange(i + 1, 4).setValue('ERROR: ' + parseErr.message);
      }
    }

    if (processed > 0) {
      Logger.log('[Meta] キュー処理完了: ' + processed + '件');
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * objectTypeに応じてWebhookを振り分ける
 *
 * @param {string} objectType
 * @param {Object} payload
 */
function metaDispatchWebhook(objectType, payload) {
  switch (objectType) {
    case 'page':
      metaProcessMessengerWebhook(payload);
      break;
    case 'instagram':
      // Phase 2: Instagram実装時に追加
      Logger.log('[Meta] Instagram Webhook受信（Phase 2 未実装）');
      break;
    case 'whatsapp_business_account':
      // Phase 3: WhatsApp実装時に追加
      Logger.log('[Meta] WhatsApp Webhook受信（Phase 3 未実装）');
      break;
    default:
      Logger.log('[Meta] 未知のobjectタイプ: ' + objectType);
  }
}

// ============================================================
// Facebook Messenger 処理
// ============================================================

/**
 * Messengerイベントを処理
 *
 * @param {Object} payload - パース済みWebhookペイロード
 */
function metaProcessMessengerWebhook(payload) {
  const entries = payload.entry || [];

  entries.forEach(function(entry) {
    const messagingEvents = entry.messaging || [];

    messagingEvents.forEach(function(event) {
      // テキストメッセージのみ処理
      if (!event.message) return;
      if (event.message.is_echo) return;  // 自分が送ったメッセージのechoは無視

      const senderId   = event.sender.id;
      const msgText    = event.message.text || '[テキスト以外のメッセージ]';
      const messageId  = event.message.mid  || '';
      const timestamp  = event.timestamp ? new Date(event.timestamp) : new Date();

      // 送信者名を取得（失敗時はsenderIdを使用）
      const senderName = metaGetMessengerUserName(senderId);

      const msgData = {
        timestamp:   timestamp,
        platform:    META.PLATFORM.MESSENGER,
        senderId:    senderId,
        senderName:  senderName,
        messageText: msgText,
        direction:   META.DIR.IN,
        status:      META.STATUS.RECEIVED,
        messageId:   messageId
      };

      // スプレッドシートに記録
      metaAppendMessageLog(msgData);

      // Discord通知
      metaNotifyDiscord(msgData);

      Logger.log('[Meta] Messenger受信: ' + senderName + ' -> ' + msgText);
    });
  });
}

// ============================================================
// Meta Graph API: ユーザー名取得
// ============================================================

/**
 * PSIDからMessengerユーザーの表示名を取得
 *
 * @param {string} psid - ページスコープID
 * @returns {string} 表示名（取得失敗時はpsidを返す）
 */
function metaGetMessengerUserName(psid) {
  try {
    const token = metaGetPageToken();
    if (!token) return psid;

    const url = META.GRAPH_API + '/' + psid
      + '?fields=name&access_token=' + encodeURIComponent(token);

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      deadline: 5  // 5秒タイムアウト
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.name || psid;
    }

    Logger.log('[Meta] ユーザー名取得失敗 (HTTP ' + response.getResponseCode() + ')');
  } catch (err) {
    Logger.log('[Meta] ユーザー名取得エラー: ' + err.message);
  }
  return psid;
}

// ============================================================
// トリガー管理
// ============================================================

/**
 * キュー処理トリガーを設定（1分毎）
 */
function metaSetupQueueTrigger() {
  // 既存のトリガーを削除
  metaRemoveQueueTrigger();

  ScriptApp.newTrigger('processMetaQueue')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('[Meta] キュー処理トリガーを設定しました（1分毎）');
  try {
    SpreadsheetApp.getUi().alert('Meta Messagingキュートリガーを設定しました（1分毎実行）');
  } catch (e) { /* UIなし環境では無視 */ }
}

/**
 * キュー処理トリガーを削除
 */
function metaRemoveQueueTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processMetaQueue')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * トリガーを含む完全セットアップ（初回実行用）
 */
function metaFullSetup() {
  metaInitSheets();
  metaSetupQueueTrigger();
  Logger.log('[Meta] フルセットアップ完了');
}
