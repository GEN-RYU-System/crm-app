/**
 * Meta Messaging - スプレッドシート操作
 *
 * message_log シートへの読み書き
 * カラム順: 受信日時 / プラットフォーム / 送信者ID / 送信者名 /
 *          メッセージ内容 / 方向 / ステータス / メッセージID
 */

// ============================================================
// 書き込み
// ============================================================

/**
 * message_log シートに1行追記
 *
 * @param {Object} msg
 * @param {Date}   msg.timestamp
 * @param {string} msg.platform    - META.PLATFORM.*
 * @param {string} msg.senderId
 * @param {string} msg.senderName
 * @param {string} msg.messageText
 * @param {string} msg.direction   - META.DIR.*
 * @param {string} msg.status      - META.STATUS.*
 * @param {string} msg.messageId
 */
function metaAppendMessageLog(msg) {
  try {
    const ss    = metaGetSpreadsheet();
    let sheet   = ss.getSheetByName(META.SHEET.MESSAGE_LOG);
    if (!sheet) {
      sheet = metaInitMessageLogSheet(ss);
    }

    const jstTime = Utilities.formatDate(
      msg.timestamp || new Date(),
      'Asia/Tokyo',
      'yyyy-MM-dd HH:mm:ss'
    );

    sheet.appendRow([
      jstTime,
      msg.platform    || '',
      msg.senderId    || '',
      msg.senderName  || '',
      msg.messageText || '',
      msg.direction   || META.DIR.IN,
      msg.status      || META.STATUS.RECEIVED,
      msg.messageId   || ''
    ]);

    Logger.log('[Meta] message_log 追記完了: ' + msg.senderName + ' / ' + msg.messageText);
  } catch (err) {
    Logger.log('[Meta] message_log 書き込みエラー: ' + err.message);
  }
}

// ============================================================
// 読み取り
// ============================================================

/**
 * message_log シートの全データを取得（UIから呼び出し）
 *
 * @param {number} [limit=100] - 取得件数上限（最新N件）
 * @returns {Array<Object>} メッセージオブジェクトの配列（新しい順）
 */
function metaGetMessageLog(limit) {
  limit = limit || 100;

  try {
    const ss    = metaGetSpreadsheet();
    const sheet = ss.getSheetByName(META.SHEET.MESSAGE_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows  = lastRow - startRow + 1;

    const data = sheet.getRange(startRow, 1, numRows, META.LOG_HEADERS.length).getValues();

    // 新しい順に並べ替えて返す
    return data.reverse().map(function(row) {
      return {
        timestamp:   row[0] ? row[0].toString() : '',
        platform:    row[1] || '',
        senderId:    row[2] || '',
        senderName:  row[3] || '',
        messageText: row[4] || '',
        direction:   row[5] || '',
        status:      row[6] || '',
        messageId:   row[7] || ''
      };
    });
  } catch (err) {
    Logger.log('[Meta] message_log 読み取りエラー: ' + err.message);
    return [];
  }
}

/**
 * 特定の送信者との会話履歴を取得（UIから呼び出し）
 *
 * @param {string} senderId
 * @param {number} [limit=50]
 * @returns {Array<Object>}
 */
function metaGetConversation(senderId, limit) {
  limit = limit || 50;
  if (!senderId) return [];

  try {
    const ss    = metaGetSpreadsheet();
    const sheet = ss.getSheetByName(META.SHEET.MESSAGE_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();

    const messages = data.slice(1)  // ヘッダー除外
      .filter(row => row[2] === senderId)  // senderId一致
      .slice(-limit)
      .map(function(row) {
        return {
          timestamp:   row[0] ? row[0].toString() : '',
          platform:    row[1] || '',
          senderId:    row[2] || '',
          senderName:  row[3] || '',
          messageText: row[4] || '',
          direction:   row[5] || '',
          status:      row[6] || '',
          messageId:   row[7] || ''
        };
      });

    return messages;
  } catch (err) {
    Logger.log('[Meta] 会話履歴取得エラー: ' + err.message);
    return [];
  }
}

/**
 * 最近の連絡先一覧（ユニーク送信者）を取得（UIサイドバー用）
 *
 * @param {number} [limit=30]
 * @returns {Array<Object>} {senderId, senderName, platform, lastMessage, lastTime}
 */
function metaGetContactList(limit) {
  limit = limit || 30;

  try {
    const ss    = metaGetSpreadsheet();
    const sheet = ss.getSheetByName(META.SHEET.MESSAGE_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    const contactMap = {};

    // inboundのメッセージのみでユニーク連絡先を構築
    data.slice(1).forEach(function(row) {
      const senderId   = row[2];
      const direction  = row[5];
      if (!senderId || direction !== META.DIR.IN) return;

      if (!contactMap[senderId] || row[0] > contactMap[senderId].lastTime) {
        contactMap[senderId] = {
          senderId:    senderId,
          senderName:  row[3] || senderId,
          platform:    row[1] || '',
          lastMessage: row[4] || '',
          lastTime:    row[0] ? row[0].toString() : ''
        };
      }
    });

    // 最終受信時刻の降順でソート
    return Object.values(contactMap)
      .sort((a, b) => b.lastTime > a.lastTime ? 1 : -1)
      .slice(0, limit);
  } catch (err) {
    Logger.log('[Meta] 連絡先一覧取得エラー: ' + err.message);
    return [];
  }
}

// ============================================================
// 送信ログ追記（metaSendMessage 成功後に呼ぶ）
// ============================================================

/**
 * 送信済みメッセージをログに追記
 *
 * @param {string} recipientId  - 送信先 PSID
 * @param {string} recipientName
 * @param {string} messageText
 * @param {string} platform     - META.PLATFORM.*
 * @param {string} status       - META.STATUS.SENT or META.STATUS.ERROR
 */
function metaAppendSentLog(recipientId, recipientName, messageText, platform, status) {
  metaAppendMessageLog({
    timestamp:   new Date(),
    platform:    platform   || META.PLATFORM.MESSENGER,
    senderId:    recipientId,
    senderName:  recipientName,
    messageText: messageText,
    direction:   META.DIR.OUT,
    status:      status     || META.STATUS.SENT,
    messageId:   ''
  });
}
