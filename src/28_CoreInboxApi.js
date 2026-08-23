/**
 * 受信箱（Inbox）React フロント専用 API。
 *
 * ■ データソース
 *   - リード管理（CoreSchemaRegistry LEADS） ← カルテ情報・ステータス・会話要約
 *   - 会話ログシート（HEADERS.CONVERSATION_LOG 準拠）← メッセージ一覧
 *     ※ シート名は resolveConversationLogSheet_ で動的解決（'会話ログ' → '会話ログ（商談用）' の順）
 *
 * ■ 権限チェック
 *   既存 inbox ガードと同型: checkPermission('lead_view')
 *
 * ■ キャッシュ
 *   会話一覧のみキャッシュ（TTL 600秒）。詳細はキャッシュしない（頻繁更新のため）。
 */

var CORE_INBOX_CONVERSATIONS_CACHE_INDEX  = 'CORE_INBOX_CONVERSATIONS_CACHE_INDEX_V1';
var CORE_INBOX_CONVERSATIONS_CACHE_PREFIX = 'CORE_INBOX_CONVERSATIONS_CACHE_V1_';
var CORE_INBOX_CONVERSATIONS_CACHE_CHUNK  = 90000;
var CORE_INBOX_CONVERSATIONS_CACHE_TTL    = 600;

// ───────────────────────────────────────────────
// リード進捗 → InboxStatus マッピング
// ───────────────────────────────────────────────
var LEAD_PROGRESS_TO_INBOX_STATUS = {
  '新規': 'lead',
  '対応中': 'lead',
  'アサイン確定': 'deal',
  '商談中': 'deal',
  '見積もり提示': 'deal',
  '成約': 'existing',
  '追客': 'followup',
  'アーカイブ': 'archive',
  '失注': 'archive',
  '対象外': 'archive'
};

// ───────────────────────────────────────────────
// 会話一覧（listConversations に対応）
// ───────────────────────────────────────────────

/**
 * 受信箱：会話一覧を返す。
 * 会話ログをリードID単位に集約し、リード管理の表示用最小情報と結合する。
 *
 * @param {string} sessionId
 * @param {boolean} [forceRefresh=false]
 * @returns {Array<Object>}  InboxConversationDto[]
 */
function getInboxConversationsForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (forceRefresh !== true) {
    var cached = readCacheChunks_(
      CORE_INBOX_CONVERSATIONS_CACHE_INDEX,
      CORE_INBOX_CONVERSATIONS_CACHE_PREFIX
    );
    if (cached !== null) return cached;
  }

  var spreadsheet = getSpreadsheet();
  var rows = buildInboxConversations_(spreadsheet);

  writeCacheChunks_(
    CORE_INBOX_CONVERSATIONS_CACHE_INDEX,
    CORE_INBOX_CONVERSATIONS_CACHE_PREFIX,
    rows,
    CORE_INBOX_CONVERSATIONS_CACHE_TTL,
    CORE_INBOX_CONVERSATIONS_CACHE_CHUNK
  );
  return rows;
}

// ───────────────────────────────────────────────
// 会話詳細（getConversation に対応）
// ───────────────────────────────────────────────

/**
 * 受信箱：1リードの会話詳細を返す。
 * メッセージ一覧（会話ログ全列）+ カルテ（リード管理の該当行）。
 *
 * @param {string} sessionId
 * @param {string} leadId  例: LDI-00001
 * @returns {{ conversation: Object, messages: Array<Object>, karte: Object } | null}
 */
function getInboxConversationDetailForFrontend(sessionId, leadId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (!leadId) return null;

  var spreadsheet = getSpreadsheet();

  // ── リード管理からカルテ情報を取得 ──
  var leads = coreCustomerFrontendReadTable(spreadsheet, 'LEADS', [
    'LEAD_ID', 'CUSTOMER_NAME', 'LEAD_SOURCE', 'LEAD_PROGRESS',
    'NEXT_ACTION', 'CS_NOTE', 'CONVERSATION_SUMMARY', 'LAST_CONVERSATION_AT'
  ]);

  var leadRow = null;
  for (var i = 0; i < leads.rows.length; i++) {
    var rowLeadId = coreCustomerFrontendValue(leads.rows[i][leads.indexes.LEAD_ID]);
    if (rowLeadId === leadId) {
      leadRow = leads.rows[i];
      break;
    }
  }

  if (!leadRow) return null;

  var leadProgress  = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_PROGRESS]);
  var inboxStatus   = LEAD_PROGRESS_TO_INBOX_STATUS[leadProgress] || 'lead';
  var customerName  = coreCustomerFrontendValue(leadRow[leads.indexes.CUSTOMER_NAME]);
  var leadSource    = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_SOURCE]);
  var nextAction    = coreCustomerFrontendValue(leadRow[leads.indexes.NEXT_ACTION]);
  var csNote        = coreCustomerFrontendValue(leadRow[leads.indexes.CS_NOTE]);
  var convSummary   = coreCustomerFrontendValue(leadRow[leads.indexes.CONVERSATION_SUMMARY]);
  var lastConvAt    = coreCustomerFrontendValue(leadRow[leads.indexes.LAST_CONVERSATION_AT]);

  // ── 会話ログからメッセージを取得 ──
  var messages = readInboxMessages_(spreadsheet, leadId);

  var conversation = {
    id:           leadId,
    customerName: customerName,
    platform:     inboxPlatformFromSource_(leadSource),
    status:       inboxStatus,
    summary:      convSummary || (messages.length > 0 ? messages[0].body : ''),
    updatedAt:    lastConvAt || (messages.length > 0 ? messages[messages.length - 1].sentAt : ''),
    unread:       false
  };

  var karte = {
    customerName: customerName,
    company:      customerName,   // リード管理に会社名列なし → 顧客名で代用
    platform:     leadSource,
    status:       leadProgress,
    nextAction:   nextAction,
    note:         csNote
  };

  return {
    conversation: conversation,
    messages:     messages,
    karte:        karte
  };
}

// ───────────────────────────────────────────────
// 内部ヘルパー
// ───────────────────────────────────────────────

/**
 * 会話一覧を構築する。
 * リード管理 + 会話ログを結合し InboxConversationDto[] を返す。
 */
function buildInboxConversations_(spreadsheet) {
  // ── 1. 会話ログを全件読んで leadId ごとに集約 ──
  var convSheet = resolveConversationLogSheet_(spreadsheet);
  var convByLead = {};

  if (convSheet) {
    var convData    = convSheet.getDataRange().getValues();
    var convHeaders = convData[0];
    var leadIdIdx   = convHeaders.indexOf('リードID');
    var datetimeIdx = convHeaders.indexOf('日時');
    var bodyIdx     = convHeaders.indexOf('原文');
    var dirIdx      = convHeaders.indexOf('送受信');
    var logIdIdx    = convHeaders.indexOf('ログID');

    if (leadIdIdx !== -1) {
      for (var r = 1; r < convData.length; r++) {
        var row        = convData[r];
        var rowLeadId  = String(row[leadIdIdx] || '').trim();
        if (!rowLeadId) continue;

        var rowDateStr = coreCustomerFrontendValue(row[datetimeIdx !== -1 ? datetimeIdx : 0]);
        var rowBody    = bodyIdx    !== -1 ? String(row[bodyIdx]    || '').trim() : '';
        var rowDir     = dirIdx     !== -1 ? String(row[dirIdx]     || '').trim() : '';
        var rowLogId   = logIdIdx   !== -1 ? String(row[logIdIdx]   || '').trim() : '';

        if (!convByLead[rowLeadId]) {
          convByLead[rowLeadId] = {
            count:       0,
            latestDate:  '',
            latestBody:  '',
            latestLogId: '',
            latestDir:   ''
          };
        }

        var agg = convByLead[rowLeadId];
        agg.count += 1;

        // 最新メッセージを更新（日時文字列で比較）
        if (!agg.latestDate || rowDateStr > agg.latestDate) {
          agg.latestDate  = rowDateStr;
          agg.latestBody  = rowBody;
          agg.latestLogId = rowLogId;
          agg.latestDir   = rowDir;
        }
      }
    }
  }

  // ── 2. リード管理から会話要約・ステータスを取得 ──
  var leads = coreCustomerFrontendReadTable(spreadsheet, 'LEADS', [
    'LEAD_ID', 'CUSTOMER_NAME', 'LEAD_SOURCE', 'LEAD_PROGRESS',
    'CONVERSATION_SUMMARY', 'LAST_CONVERSATION_AT'
  ]);

  var rows = [];

  for (var i = 0; i < leads.rows.length; i++) {
    var leadRow  = leads.rows[i];
    var leadId   = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_ID]);
    if (!leadId) continue;

    // 会話ログがある、またはリード管理に会話要約がある行のみ返す
    var agg      = convByLead[leadId];
    var summary  = coreCustomerFrontendValue(leadRow[leads.indexes.CONVERSATION_SUMMARY]);
    var lastAt   = coreCustomerFrontendValue(leadRow[leads.indexes.LAST_CONVERSATION_AT]);
    if (!agg && !summary) continue;

    var leadProgress = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_PROGRESS]);
    var inboxStatus  = LEAD_PROGRESS_TO_INBOX_STATUS[leadProgress] || 'lead';
    var leadSource   = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_SOURCE]);
    var customerName = coreCustomerFrontendValue(leadRow[leads.indexes.CUSTOMER_NAME]);

    rows.push({
      id:           leadId,
      customerName: customerName,
      platform:     inboxPlatformFromSource_(leadSource),
      status:       inboxStatus,
      summary:      summary || (agg ? agg.latestBody : ''),
      updatedAt:    lastAt  || (agg ? agg.latestDate  : ''),
      unread:       false
    });
  }

  // updatedAt 降順（新しい順）
  rows.sort(function(a, b) {
    if (a.updatedAt > b.updatedAt) return -1;
    if (a.updatedAt < b.updatedAt) return 1;
    return 0;
  });

  return rows;
}

/**
 * 指定 leadId の会話ログを InboxMessageDto[] で返す。
 * 日時昇順（古い順）。
 */
function readInboxMessages_(spreadsheet, leadId) {
  var convSheet = resolveConversationLogSheet_(spreadsheet);
  if (!convSheet) return [];

  var convData    = convSheet.getDataRange().getValues();
  var convHeaders = convData[0];
  var leadIdIdx   = convHeaders.indexOf('リードID');
  if (leadIdIdx === -1) return [];

  var logIdIdx    = convHeaders.indexOf('ログID');
  var datetimeIdx = convHeaders.indexOf('日時');
  var bodyIdx     = convHeaders.indexOf('原文');
  var dirIdx      = convHeaders.indexOf('送受信');

  var messages = [];
  for (var r = 1; r < convData.length; r++) {
    var row       = convData[r];
    var rowLeadId = String(row[leadIdIdx] || '').trim();
    if (rowLeadId !== leadId) continue;

    var direction = dirIdx !== -1 ? String(row[dirIdx] || '').trim() : '';
    var sender    = direction === '受信' ? 'customer' : 'operator';

    messages.push({
      id:     logIdIdx   !== -1 ? String(row[logIdIdx]   || '').trim() : '',
      sender: sender,
      body:   bodyIdx    !== -1 ? String(row[bodyIdx]    || '').trim() : '',
      sentAt: datetimeIdx !== -1 ? coreCustomerFrontendValue(row[datetimeIdx]) : ''
    });
  }

  // 日時昇順（古い順）
  messages.sort(function(a, b) {
    if (a.sentAt < b.sentAt) return -1;
    if (a.sentAt > b.sentAt) return 1;
    return 0;
  });

  return messages;
}

/**
 * 会話ログシートを動的解決する。
 * '会話ログ' → '会話ログ（商談用）' の順で探す。
 * どちらもなければ null を返す（空結果として処理）。
 */
function resolveConversationLogSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG)
      || spreadsheet.getSheetByName('会話ログ（商談用）')
      || null;
}

/**
 * 流入経路文字列から InboxPlatform を推定する。
 * 完全一致しない場合は 'messenger' をデフォルトとして返す。
 */
function inboxPlatformFromSource_(leadSource) {
  var src = String(leadSource || '').toLowerCase();
  if (src.indexOf('instagram') !== -1) return 'instagram';
  if (src.indexOf('discord')   !== -1) return 'discord';
  return 'messenger';
}
