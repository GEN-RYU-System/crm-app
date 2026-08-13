/**
 * Meta Messaging API 設定・定数
 *
 * 必要なスクリプトプロパティ（GASエディタ > プロジェクトの設定 > スクリプトプロパティ）:
 *   META_VERIFY_TOKEN       : Webhookトークン（任意の文字列、Meta側と一致させる）
 *   META_APP_SECRET         : Metaアプリシークレット（現在はログのみ。GASはHTTPヘッダーを読めないため未使用）
 *   META_PAGE_ACCESS_TOKEN  : Facebookページアクセストークン
 *   META_PAGE_ID            : FacebookページID
 *   DISCORD_WEBHOOK_URL     : Discord Webhook URL（既存プロパティを共用可）
 *   SPREADSHEET_ID          : スプレッドシートID（必須。未設定時は停止）
 */

const META = {
  // シート名
  SHEET: {
    MESSAGE_LOG: 'message_log',
    QUEUE:       'meta_queue'    // 受信バッファ（5秒対応のための非同期キュー）
  },

  // Meta Graph API エンドポイント
  GRAPH_API: 'https://graph.facebook.com/v19.0',

  // プラットフォーム識別子
  PLATFORM: {
    MESSENGER: 'Messenger',
    INSTAGRAM: 'Instagram',   // Phase 2
    WHATSAPP:  'WhatsApp'     // Phase 3
  },

  // メッセージ方向
  DIR: {
    IN:  'inbound',
    OUT: 'outbound'
  },

  // ステータス
  STATUS: {
    RECEIVED: '受信済み',
    SENT:     '送信済み',
    ERROR:    'エラー',
    QUEUED:   'キュー中'
  },

  // message_log シートのカラム定義（A列から）
  LOG_HEADERS: [
    '受信日時',      // A
    'プラットフォーム', // B
    '送信者ID',      // C
    '送信者名',      // D
    'メッセージ内容', // E
    '方向',          // F
    'ステータス',    // G
    'メッセージID'   // H
  ],

  // meta_queue シートのカラム定義
  QUEUE_HEADERS: [
    '受信日時',    // A: キューに積まれた時刻
    'object',      // B: Meta objectタイプ（page / instagram / whatsapp_business_account）
    'raw_payload', // C: 生JSONペイロード
    '処理済み'     // D: TRUE = 処理済み
  ]
};

// ============================================================
// スクリプトプロパティ取得ヘルパー
// ============================================================

function metaGetVerifyToken()   { return getProperty('META_VERIFY_TOKEN')        || ''; }
function metaGetAppSecret()     { return getProperty('META_APP_SECRET')           || ''; }
function metaGetPageToken()     { return getProperty('META_PAGE_ACCESS_TOKEN')    || ''; }
function metaGetPageId()        { return getProperty('META_PAGE_ID')              || ''; }
function metaGetDiscordUrl()    { return getProperty('DISCORD_WEBHOOK_URL')       || ''; }
function metaGetSpreadsheetId() { return getRequiredScriptProperty('SPREADSHEET_ID'); }

/**
 * Meta用スプレッドシート取得
 * SPREADSHEET_IDプロパティが必須。未設定時は停止する。
 */
function metaGetSpreadsheet() {
  getEnvironment();
  return SpreadsheetApp.openById(metaGetSpreadsheetId());
}

// ============================================================
// 初期セットアップ
// ============================================================

/**
 * Meta Messaging用シートを初期化（メニューまたはテストから実行）
 */
function metaInitSheets() {
  const ss = metaGetSpreadsheet();
  metaInitMessageLogSheet(ss);
  metaInitQueueSheet(ss);
  Logger.log('Meta Messagingシートを初期化しました');
}

function metaInitMessageLogSheet(ss) {
  let sheet = ss.getSheetByName(META.SHEET.MESSAGE_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(META.SHEET.MESSAGE_LOG);
  }
  if (sheet.getLastRow() === 0) {
    const headerRange = sheet.getRange(1, 1, 1, META.LOG_HEADERS.length);
    headerRange.setValues([META.LOG_HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1877F2');  // Facebook青
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, META.LOG_HEADERS.length);
  }
  return sheet;
}

function metaInitQueueSheet(ss) {
  let sheet = ss.getSheetByName(META.SHEET.QUEUE);
  if (!sheet) {
    sheet = ss.insertSheet(META.SHEET.QUEUE);
  }
  if (sheet.getLastRow() === 0) {
    const headerRange = sheet.getRange(1, 1, 1, META.QUEUE_HEADERS.length);
    headerRange.setValues([META.QUEUE_HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#555555');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(3, 600);  // raw_payload 列を広く
  }
  return sheet;
}

/**
 * スクリプトプロパティのテンプレートを設定（初回セットアップ用）
 * 実行後にGASエディタで実際の値に書き換えること
 */
function metaSetupProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'META_VERIFY_TOKEN':       'YOUR_VERIFY_TOKEN_HERE',
    'META_APP_SECRET':         'YOUR_APP_SECRET_HERE',
    'META_PAGE_ACCESS_TOKEN':  'YOUR_PAGE_ACCESS_TOKEN_HERE',
    'META_PAGE_ID':            'YOUR_PAGE_ID_HERE'
  });
  Logger.log('Metaプロパティのテンプレートを設定しました。GASエディタのスクリプトプロパティで実際の値に更新してください。');
}

/**
 * 処理済みキュー行を週次クリア（トリガー設定推奨）
 */
function metaCleanProcessedQueue() {
  const ss = metaGetSpreadsheet();
  const sheet = ss.getSheetByName(META.SHEET.QUEUE);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][3] === true || data[i][3] === 'TRUE') {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(row => sheet.deleteRow(row));
  Logger.log('処理済みキュー行を' + rowsToDelete.length + '件削除しました');
}
