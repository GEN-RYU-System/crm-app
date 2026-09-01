
var CORE_INBOX_CONVERSATIONS_CACHE_INDEX  = 'CORE_INBOX_CONVERSATIONS_CACHE_INDEX_V1';
var CORE_INBOX_CONVERSATIONS_CACHE_PREFIX = 'CORE_INBOX_CONVERSATIONS_CACHE_V1_';
var CORE_INBOX_CONVERSATIONS_CACHE_CHUNK  = 90000;
var CORE_INBOX_CONVERSATIONS_CACHE_TTL    = 600;

/** addConversationLog で withSheetWrite_ に渡すキャッシュターゲット */
var CORE_INBOX_CACHE_TARGETS = [
  { indexKey: CORE_INBOX_CONVERSATIONS_CACHE_INDEX, prefix: CORE_INBOX_CONVERSATIONS_CACHE_PREFIX }
];

// ───────────────────────────────────────────────
// リードステータス → InboxStatus マッピング
// ───────────────────────────────────────────────
var LEAD_STATUS_TO_INBOX_STATUS = {
  '新規リード':   'lead',
  'リード対応中': 'lead',
  'リード対象外': 'archive',
  'アサイン確定': 'deal',
  '商談中':       'deal',
  '商談対象外':   'archive',
  '追客(短期)':   'followup',
  '追客(長期)':   'followup',
  '成約':         'existing',
  '失注':         'archive'
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
    'LEAD_ID', 'CUSTOMER_NAME', 'LEAD_SOURCE', 'LEAD_STATUS', 'LEAD_TYPE',
    'NEXT_ACTION', 'CS_NOTE', 'CONVERSATION_SUMMARY', 'LAST_CONVERSATION_AT',
    'DEAL_RESULT', 'CUSTOMER_ISSUE', 'COMPETITOR_COMPARISON',
    'EMAIL', 'PHONE', 'COUNTRY',
    'ENGLISH_CALL_NAME', 'RESPONSE_SPEED', 'NEXT_ACTION_DATE',
    'HANDLED_TITLE', 'SALES_CHANNEL', 'CUSTOMER_TYPE', 'DEAL_NOTE',
    'MONTHLY_EXPECTED_AMOUNT', 'MESSAGE_URL'
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

  var leadStatus    = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_STATUS]);
  var inboxStatus   = LEAD_STATUS_TO_INBOX_STATUS[leadStatus] || 'lead';
  var customerName  = coreCustomerFrontendValue(leadRow[leads.indexes.CUSTOMER_NAME]);
  var leadSource    = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_SOURCE]);
  var leadType      = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_TYPE]);
  var nextAction    = coreCustomerFrontendValue(leadRow[leads.indexes.NEXT_ACTION]);
  var csNote        = coreCustomerFrontendValue(leadRow[leads.indexes.CS_NOTE]);
  var convSummary   = coreCustomerFrontendValue(leadRow[leads.indexes.CONVERSATION_SUMMARY]);
  var lastConvAt    = coreCustomerFrontendValue(leadRow[leads.indexes.LAST_CONVERSATION_AT]);
  var dealResult      = coreCustomerFrontendValue(leadRow[leads.indexes.DEAL_RESULT]);
  var customerIssue   = coreCustomerFrontendValue(leadRow[leads.indexes.CUSTOMER_ISSUE]);
  var competitor      = coreCustomerFrontendValue(leadRow[leads.indexes.COMPETITOR_COMPARISON]);
  var email           = coreCustomerFrontendValue(leadRow[leads.indexes.EMAIL]);
  var phone           = coreCustomerFrontendValue(leadRow[leads.indexes.PHONE]);
  var country         = coreCustomerFrontendValue(leadRow[leads.indexes.COUNTRY]);
  var englishCallName = coreCustomerFrontendValue(leadRow[leads.indexes.ENGLISH_CALL_NAME]);
  var responseSpeed   = coreCustomerFrontendValue(leadRow[leads.indexes.RESPONSE_SPEED]);
  var nextActionDate  = coreCustomerFrontendValue(leadRow[leads.indexes.NEXT_ACTION_DATE]);
  var handledTitle    = coreCustomerFrontendValue(leadRow[leads.indexes.HANDLED_TITLE]);
  var salesChannel    = coreCustomerFrontendValue(leadRow[leads.indexes.SALES_CHANNEL]);
  var customerType    = coreCustomerFrontendValue(leadRow[leads.indexes.CUSTOMER_TYPE]);
  var dealNote        = coreCustomerFrontendValue(leadRow[leads.indexes.DEAL_NOTE]);
  var monthlyExpectedAmount = coreCustomerFrontendValue(leadRow[leads.indexes.MONTHLY_EXPECTED_AMOUNT]);
  var messageUrl      = coreCustomerFrontendValue(leadRow[leads.indexes.MESSAGE_URL]);

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
    customerName:         customerName,
    company:              customerName,   // リード管理に会社名列なし → 顧客名で代用
    platform:             leadSource,
    status:               leadStatus,
    nextAction:           nextAction,
    note:                 csNote,
    leadType:             leadType,
    dealResult:           dealResult,
    issue:                customerIssue,
    competitorComparison: competitor,
    email:                email,
    phone:                phone,
    country:              country,
    englishCallName:      englishCallName,
    responseSpeed:        responseSpeed,
    nextActionDate:       nextActionDate,
    handledTitle:         handledTitle,
    salesChannel:         salesChannel,
    customerType:         customerType,
    dealNote:             dealNote,
    monthlyExpectedAmount: monthlyExpectedAmount,
    messageUrl:           messageUrl
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
    var leadIdIdx   = convHeaders.indexOf('lead_id');
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
    'LEAD_ID', 'CUSTOMER_NAME', 'LEAD_SOURCE', 'LEAD_STATUS',
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

    var leadStatus   = coreCustomerFrontendValue(leadRow[leads.indexes.LEAD_STATUS]);
    var inboxStatus  = LEAD_STATUS_TO_INBOX_STATUS[leadStatus] || 'lead';
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
  var leadIdIdx   = convHeaders.indexOf('lead_id');
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
  return 'messenger';
}

// ───────────────────────────────────────────────
// DEV専用診断
// ───────────────────────────────────────────────

// ───────────────────────────────────────────────
// まとめ取得（窓方式）
// ───────────────────────────────────────────────

/**
 * 受信箱：一括初期ロード（窓方式）。
 * 会話一覧の上位 maxConversations 件 + 各会話の最新 maxMessagesPerConversation 件のメッセージを
 * 1回のGAS呼び出しで返す。窓サイズは Script Properties で制御（引数で上書き可）。
 *
 * Script Properties:
 *   INBOX_INITIAL_CONVERSATIONS  (デフォルト 20)
 *   INBOX_INITIAL_MESSAGES       (デフォルト 30)
 *
 * @param {string} sessionId
 * @param {number} [maxConversations]  省略時は Script Properties 値
 * @param {number} [maxMessagesPerConversation]  省略時は Script Properties 値
 * @returns {{ conversations: Array<Object>, detailsByConversationId: Object<string, Object> }}
 */
function getInboxBulkInitialLoad(sessionId, maxConversations, maxMessagesPerConversation) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var props = PropertiesService.getScriptProperties();
  var maxConv = maxConversations
    || parseInt(props.getProperty('INBOX_INITIAL_CONVERSATIONS') || '20', 10);
  var maxMsg = maxMessagesPerConversation
    || parseInt(props.getProperty('INBOX_INITIAL_MESSAGES') || '30', 10);

  var ss = getSpreadsheet();

  // ── 1. 会話ログを1回のシート読み込みで取得 ──
  var convSheet = resolveConversationLogSheet_(ss);
  var allMessagesByLead = {};

  if (convSheet) {
    var convData    = convSheet.getDataRange().getValues();
    var convHeaders = convData[0];
    var leadIdIdx   = convHeaders.indexOf('lead_id');
    var logIdIdx    = convHeaders.indexOf('ログID');
    var datetimeIdx = convHeaders.indexOf('日時');
    var bodyIdx     = convHeaders.indexOf('原文');
    var dirIdx      = convHeaders.indexOf('送受信');

    if (leadIdIdx !== -1) {
      for (var r = 1; r < convData.length; r++) {
        var row       = convData[r];
        var rowLeadId = String(row[leadIdIdx] || '').trim();
        if (!rowLeadId) continue;

        var direction = dirIdx !== -1 ? String(row[dirIdx] || '').trim() : '';
        var msgObj = {
          id:     logIdIdx    !== -1 ? String(row[logIdIdx]    || '').trim() : '',
          sender: direction === '受信' ? 'customer' : 'operator',
          body:   bodyIdx     !== -1 ? String(row[bodyIdx]     || '').trim() : '',
          sentAt: datetimeIdx !== -1 ? coreCustomerFrontendValue(row[datetimeIdx]) : ''
        };

        if (!allMessagesByLead[rowLeadId]) allMessagesByLead[rowLeadId] = [];
        allMessagesByLead[rowLeadId].push(msgObj);
      }
    }
  }

  // 各リードのメッセージを日時昇順ソート
  var leadIds = Object.keys(allMessagesByLead);
  for (var k = 0; k < leadIds.length; k++) {
    allMessagesByLead[leadIds[k]].sort(function(a, b) {
      if (a.sentAt < b.sentAt) return -1;
      if (a.sentAt > b.sentAt) return 1;
      return 0;
    });
  }

  // ── 2. 会話一覧（キャッシュ活用） ──
  var conversations = buildInboxConversations_(ss);

  // ── 3. 上位 maxConv 件の詳細を組み立て ──
  var windowConversations = conversations.slice(0, maxConv);
  var detailsByConversationId = {};

  // リード管理（カルテ用）を1回だけ読む
  var leads = coreCustomerFrontendReadTable(ss, 'LEADS', [
    'LEAD_ID', 'CUSTOMER_NAME', 'LEAD_SOURCE', 'LEAD_STATUS', 'LEAD_TYPE',
    'NEXT_ACTION', 'CS_NOTE', 'CONVERSATION_SUMMARY', 'LAST_CONVERSATION_AT',
    'DEAL_RESULT', 'CUSTOMER_ISSUE', 'COMPETITOR_COMPARISON',
    'EMAIL', 'PHONE', 'COUNTRY',
    'ENGLISH_CALL_NAME', 'RESPONSE_SPEED', 'NEXT_ACTION_DATE',
    'HANDLED_TITLE', 'SALES_CHANNEL', 'CUSTOMER_TYPE', 'DEAL_NOTE',
    'MONTHLY_EXPECTED_AMOUNT', 'MESSAGE_URL'
  ]);
  var leadRowById = {};
  for (var li = 0; li < leads.rows.length; li++) {
    var lRow   = leads.rows[li];
    var lId    = coreCustomerFrontendValue(lRow[leads.indexes.LEAD_ID]);
    if (lId) leadRowById[lId] = lRow;
  }

  for (var ci = 0; ci < windowConversations.length; ci++) {
    var conv   = windowConversations[ci];
    var leadId = conv.id;
    var lData  = leadRowById[leadId];
    if (!lData) continue;

    var leadStatus   = coreCustomerFrontendValue(lData[leads.indexes.LEAD_STATUS]);
    var inboxStatus  = LEAD_STATUS_TO_INBOX_STATUS[leadStatus] || 'lead';
    var customerName = coreCustomerFrontendValue(lData[leads.indexes.CUSTOMER_NAME]);
    var leadSource   = coreCustomerFrontendValue(lData[leads.indexes.LEAD_SOURCE]);
    var leadType     = coreCustomerFrontendValue(lData[leads.indexes.LEAD_TYPE]);
    var nextAction   = coreCustomerFrontendValue(lData[leads.indexes.NEXT_ACTION]);
    var csNote       = coreCustomerFrontendValue(lData[leads.indexes.CS_NOTE]);
    var convSummary  = coreCustomerFrontendValue(lData[leads.indexes.CONVERSATION_SUMMARY]);
    var lastConvAt   = coreCustomerFrontendValue(lData[leads.indexes.LAST_CONVERSATION_AT]);
    var dealResult   = coreCustomerFrontendValue(lData[leads.indexes.DEAL_RESULT]);
    var custIssue    = coreCustomerFrontendValue(lData[leads.indexes.CUSTOMER_ISSUE]);
    var competitor   = coreCustomerFrontendValue(lData[leads.indexes.COMPETITOR_COMPARISON]);
    var email        = coreCustomerFrontendValue(lData[leads.indexes.EMAIL]);
    var phone        = coreCustomerFrontendValue(lData[leads.indexes.PHONE]);
    var country      = coreCustomerFrontendValue(lData[leads.indexes.COUNTRY]);
    var engCallName  = coreCustomerFrontendValue(lData[leads.indexes.ENGLISH_CALL_NAME]);
    var respSpeed    = coreCustomerFrontendValue(lData[leads.indexes.RESPONSE_SPEED]);
    var nextActDate  = coreCustomerFrontendValue(lData[leads.indexes.NEXT_ACTION_DATE]);
    var handledTtl   = coreCustomerFrontendValue(lData[leads.indexes.HANDLED_TITLE]);
    var salesCh      = coreCustomerFrontendValue(lData[leads.indexes.SALES_CHANNEL]);
    var custType     = coreCustomerFrontendValue(lData[leads.indexes.CUSTOMER_TYPE]);
    var dealNt       = coreCustomerFrontendValue(lData[leads.indexes.DEAL_NOTE]);
    var monthlyAmt   = coreCustomerFrontendValue(lData[leads.indexes.MONTHLY_EXPECTED_AMOUNT]);
    var msgUrl       = coreCustomerFrontendValue(lData[leads.indexes.MESSAGE_URL]);

    var msgs = allMessagesByLead[leadId] || [];
    // 最新 maxMsg 件のみ（末尾スライス）
    var slicedMsgs = maxMsg > 0 && msgs.length > maxMsg
      ? msgs.slice(msgs.length - maxMsg)
      : msgs;

    var convObj = {
      id:           leadId,
      customerName: customerName,
      platform:     inboxPlatformFromSource_(leadSource),
      status:       inboxStatus,
      summary:      convSummary || (msgs.length > 0 ? msgs[0].body : ''),
      updatedAt:    lastConvAt  || (msgs.length > 0 ? msgs[msgs.length - 1].sentAt : ''),
      unread:       false
    };

    var karte = {
      customerName:         customerName,
      company:              customerName,
      platform:             leadSource,
      status:               leadStatus,
      nextAction:           nextAction,
      note:                 csNote,
      leadType:             leadType,
      dealResult:           dealResult,
      issue:                custIssue,
      competitorComparison: competitor,
      email:                email,
      phone:                phone,
      country:              country,
      englishCallName:      engCallName,
      responseSpeed:        respSpeed,
      nextActionDate:       nextActDate,
      handledTitle:         handledTtl,
      salesChannel:         salesCh,
      customerType:         custType,
      dealNote:             dealNt,
      monthlyExpectedAmount: monthlyAmt,
      messageUrl:           msgUrl
    };

    detailsByConversationId[leadId] = {
      conversation: convObj,
      messages:     slicedMsgs,
      karte:        karte,
      hasMore:      maxMsg > 0 && msgs.length > maxMsg
    };
  }

  return {
    conversations:            conversations,
    detailsByConversationId:  detailsByConversationId
  };
}

/**
 * 受信箱：追加メッセージロード（窓方式 - 続き読み込み用）。
 * 指定会話の offsetIndex 番目以降のメッセージを maxMessages 件返す。
 *
 * Script Properties:
 *   INBOX_LOAD_MORE_MESSAGES (デフォルト 30)
 *
 * @param {string} sessionId
 * @param {string} conversationId
 * @param {number} offsetIndex   既取得件数（スキップ行数）
 * @param {number} [maxMessages]  省略時は Script Properties 値
 * @returns {{ conversationId: string, messages: Array<Object>, hasMore: boolean }}
 */
function getInboxMoreMessages(sessionId, conversationId, offsetIndex, maxMessages) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var props = PropertiesService.getScriptProperties();
  var limit = maxMessages
    || parseInt(props.getProperty('INBOX_LOAD_MORE_MESSAGES') || '30', 10);

  var ss   = getSpreadsheet();
  var msgs = readInboxMessages_(ss, conversationId);

  // 古い順 → offsetIndex から limit 件
  var offset  = offsetIndex || 0;
  var sliced  = msgs.slice(offset, offset + limit);
  var hasMore = (offset + limit) < msgs.length;

  return {
    conversationId: conversationId,
    messages:       sliced,
    hasMore:        hasMore
  };
}

// ───────────────────────────────────────────────
// DEV専用計測ツール
// ───────────────────────────────────────────────

/**
 * DEV専用: Phase 1 データ規模計測。
 * メッセージ数の分布（最大・中央値・合計）と各窓サイズの応答サイズ概算を返す。
 *
 * @returns {{ totalConversations: number, totalMessages: number, maxMessages: number,
 *             medianMessages: number, distribution: Array<{leadId:string, count:number}>,
 *             estimatedResponseKb: Object }}
 */
function measureInboxScale() {
  if (getEnvironment() !== 'development') {
    throw new Error('measureInboxScale は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var convSheet = resolveConversationLogSheet_(ss);
  var countByLead = {};

  if (convSheet) {
    var convData  = convSheet.getDataRange().getValues();
    var headers   = convData[0];
    var leadIdIdx = headers.indexOf('lead_id');
    var bodyIdx   = headers.indexOf('原文');

    if (leadIdIdx !== -1) {
      for (var r = 1; r < convData.length; r++) {
        var lid  = String(convData[r][leadIdIdx] || '').trim();
        var body = bodyIdx !== -1 ? String(convData[r][bodyIdx] || '') : '';
        if (!lid) continue;
        if (!countByLead[lid]) countByLead[lid] = { count: 0, totalBytes: 0 };
        countByLead[lid].count += 1;
        countByLead[lid].totalBytes += body.length * 2; // UTF-16 概算
      }
    }
  }

  var conversations = buildInboxConversations_(ss);
  var allCounts = conversations.map(function(c) {
    return { leadId: c.id, count: (countByLead[c.id] || {}).count || 0 };
  });

  var sorted = allCounts.map(function(x) { return x.count; }).sort(function(a, b) { return a - b; });
  var total  = sorted.reduce(function(s, v) { return s + v; }, 0);
  var maxMsg = sorted[sorted.length - 1] || 0;
  var mid    = Math.floor(sorted.length / 2);
  var median = sorted.length > 0
    ? (sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid])
    : 0;

  // 各窓パターンの推定レスポンスサイズ（JSON概算: 1メッセージ ≈ 200 bytes）
  var BYTES_PER_MSG   = 200;
  var BYTES_PER_CONV  = 150;
  var convCounts  = [10, 20, conversations.length];
  var msgCounts   = [20, 30, 50, 999];
  var estimated   = {};
  for (var ci = 0; ci < convCounts.length; ci++) {
    for (var mi = 0; mi < msgCounts.length; mi++) {
      var nc  = convCounts[ci];
      var nm  = msgCounts[mi];
      var key = 'conv' + nc + '_msg' + (nm === 999 ? 'all' : nm);
      var totalMsgs = Math.min(nm * nc, total);
      estimated[key] = Math.round((nc * BYTES_PER_CONV + totalMsgs * BYTES_PER_MSG) / 1024);
    }
  }

  return {
    totalConversations: conversations.length,
    totalMessages:      total,
    maxMessages:        maxMsg,
    medianMessages:     median,
    distribution:       allCounts,
    estimatedResponseKb: estimated
  };
}

/**
 * DEV専用: 窓方式まとめ取得のタイミング計測。
 * 会話数・メッセージ数の組み合わせで実行時間を計測する。
 *
 * @returns {Array<{conv: number, msg: number, durationMs: number, responseSizeKb: number}>}
 */
function measureInboxBulkTiming() {
  if (getEnvironment() !== 'development') {
    throw new Error('measureInboxBulkTiming は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var conversations = buildInboxConversations_(ss);
  var totalConv = conversations.length;

  var convCounts = [10, 20, totalConv];
  var msgCounts  = [20, 30, 50, 999];
  var results    = [];

  for (var ci = 0; ci < convCounts.length; ci++) {
    for (var mi = 0; mi < msgCounts.length; mi++) {
      var nc = convCounts[ci];
      var nm = msgCounts[mi];

      var t0 = new Date().getTime();

      // ── 窓まとめ取得をシミュレート ──
      var convSheet = resolveConversationLogSheet_(ss);
      var allMessagesByLead = {};
      if (convSheet) {
        var convData    = convSheet.getDataRange().getValues();
        var convHeaders = convData[0];
        var leadIdIdx   = convHeaders.indexOf('lead_id');
        var logIdIdx    = convHeaders.indexOf('ログID');
        var datetimeIdx = convHeaders.indexOf('日時');
        var bodyIdx     = convHeaders.indexOf('原文');
        var dirIdx      = convHeaders.indexOf('送受信');
        if (leadIdIdx !== -1) {
          for (var r = 1; r < convData.length; r++) {
            var row       = convData[r];
            var lid       = String(row[leadIdIdx] || '').trim();
            if (!lid) continue;
            var direction = dirIdx !== -1 ? String(row[dirIdx] || '').trim() : '';
            var msgObj = {
              id:     logIdIdx    !== -1 ? String(row[logIdIdx]    || '').trim() : '',
              sender: direction === '受信' ? 'customer' : 'operator',
              body:   bodyIdx     !== -1 ? String(row[bodyIdx]     || '').trim() : '',
              sentAt: datetimeIdx !== -1 ? coreCustomerFrontendValue(row[datetimeIdx]) : ''
            };
            if (!allMessagesByLead[lid]) allMessagesByLead[lid] = [];
            allMessagesByLead[lid].push(msgObj);
          }
        }
      }

      // 上位 nc 件の詳細を組み立て
      var windowConvs = conversations.slice(0, nc);
      var details = {};
      for (var k = 0; k < windowConvs.length; k++) {
        var leadId = windowConvs[k].id;
        var msgs   = (allMessagesByLead[leadId] || []).slice();
        msgs.sort(function(a, b) {
          if (a.sentAt < b.sentAt) return -1;
          if (a.sentAt > b.sentAt) return 1;
          return 0;
        });
        var sliced = (nm > 0 && nm < 999 && msgs.length > nm)
          ? msgs.slice(msgs.length - nm) : msgs;
        details[leadId] = sliced;
      }

      var t1       = new Date().getTime();
      var duration = t1 - t0;

      // レスポンスサイズ概算（JSON文字列化）
      var payload     = { conversations: windowConvs, details: details };
      var payloadStr  = JSON.stringify(payload);
      var sizeKb      = Math.round(payloadStr.length / 1024);

      results.push({
        conv:          nc,
        msg:           nm === 999 ? 'all' : nm,
        durationMs:    duration,
        responseSizeKb: sizeKb
      });
    }
  }

  return results;
}

// ───────────────────────────────────────────────
// DEV専用: Phase 1 検証
// ───────────────────────────────────────────────

/**
 * DEV専用: Phase 1 合格条件を検証する。
 * - 会話ログシートのユニークリードID数
 * - buildInboxConversations_ が返す件数
 * - 指定リードIDのメッセージ件数
 * セッション認証をバイパスして直接データを読む。
 *
 * @param {string} [sampleLeadId] 例: 'LDI-00002'
 * @returns {{ sheetUniqueLeadCount: number, conversationListCount: number, sampleLeadId: string, sampleMessageCount: number }}
 */
function dryRunVerifyInboxPhase1(sampleLeadId) {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunVerifyInboxPhase1 は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // ── 1. 会話ログシートのユニークリードID数を実測 ──
  var convSheet = resolveConversationLogSheet_(ss);
  var sheetUniqueLeadIds = {};
  if (convSheet) {
    var convData  = convSheet.getDataRange().getValues();
    var headers   = convData[0];
    var leadIdIdx = headers.indexOf('lead_id');
    if (leadIdIdx !== -1) {
      for (var r = 1; r < convData.length; r++) {
        var lid = String(convData[r][leadIdIdx] || '').trim();
        if (lid) sheetUniqueLeadIds[lid] = true;
      }
    }
  }
  var sheetUniqueLeadCount = Object.keys(sheetUniqueLeadIds).length;

  // ── 2. buildInboxConversations_ が返す件数を実測 ──
  var conversations = buildInboxConversations_(ss);

  // ── 3. 指定リードIDのメッセージ件数を実測 ──
  var targetLeadId = sampleLeadId || Object.keys(sheetUniqueLeadIds)[0] || '';
  var messages = targetLeadId ? readInboxMessages_(ss, targetLeadId) : [];

  return {
    sheetUniqueLeadCount:  sheetUniqueLeadCount,
    conversationListCount: conversations.length,
    sampleLeadId:          targetLeadId,
    sampleMessageCount:    messages.length
  };
}

/**
 * DEV専用: 窓方式 Script Properties を一括設定する。
 */
function setInboxWindowProperties() {
  if (getEnvironment() !== 'development') {
    throw new Error('setInboxWindowProperties は DEV 環境でのみ実行できます');
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    INBOX_INITIAL_CONVERSATIONS: '20',
    INBOX_INITIAL_MESSAGES:      '30',
    INBOX_LOAD_MORE_MESSAGES:    '30',
    INBOX_LOAD_MORE_CONVERSATIONS: '20'
  });
  return { ok: true, properties: props.getProperties() };
}

/**
 * DEV専用: 負荷検証用テストデータを投入する。
 * - LEADS シートに「LDI-TEST-001 / 【テスト】負荷検証_100件」を追記（重複時は上書き）
 * - 会話ログシートに 100 件のメッセージを追記（既存テストデータは先に削除）
 * - 受信箱キャッシュをクリアして反映を即時化
 * - LDI-00002 の表示名を返す（オーナーが画面で確認する用）
 *
 * @returns {{ seeded: boolean, testLeadId: string, testLeadName: string,
 *             messageCount: number, ldi00002CustomerName: string }}
 */
function seedInboxTestData100() {
  if (getEnvironment() !== 'development') {
    throw new Error('seedInboxTestData100 は DEV 環境でのみ実行できます');
  }

  var TEST_LEAD_ID   = 'LDI-TEST-001';
  var TEST_LEAD_NAME = '【テスト】負荷検証_100件';
  var ss = getSpreadsheet();

  // ── 1. LDI-00002 の表示名を取得 ──
  var leadsForName = coreCustomerFrontendReadTable(ss, 'LEADS', ['LEAD_ID', 'CUSTOMER_NAME']);
  var ldi00002Name = '（未確認）';
  for (var ni = 0; ni < leadsForName.rows.length; ni++) {
    if (coreCustomerFrontendValue(leadsForName.rows[ni][leadsForName.indexes.LEAD_ID]) === 'LDI-00002') {
      ldi00002Name = coreCustomerFrontendValue(leadsForName.rows[ni][leadsForName.indexes.CUSTOMER_NAME]);
      break;
    }
  }

  // ── 2. LEADS シートにテストリードを追記（重複時は既存行を上書き） ──
  var leadsSheet = getCoreSchemaV1Sheet(ss, 'LEADS');
  var leadsData   = leadsSheet.getDataRange().getValues();
  var leadsHdrs   = leadsData[0];

  var col = function(name) { return leadsHdrs.indexOf(name); };
  var existingLeadRow = -1;
  for (var r = 1; r < leadsData.length; r++) {
    if (String(leadsData[r][col('lead_id')] || '').trim() === TEST_LEAD_ID) {
      existingLeadRow = r + 1; // 1-indexed sheet row
      break;
    }
  }

  var leadRow = new Array(leadsHdrs.length).fill('');
  leadRow[col('lead_id')]           = TEST_LEAD_ID;
  leadRow[col('customer_name')]     = TEST_LEAD_NAME;
  leadRow[col('lead_status')]       = '新規リード';
  leadRow[col('lead_source')]       = 'messenger';
  leadRow[col('conversation_summary')] = '負荷検証用テストデータ（100件）';
  leadRow[col('last_conversation_at')] = '2026-08-26 12:00:00';

  if (existingLeadRow !== -1) {
    leadsSheet.getRange(existingLeadRow, 1, 1, leadsHdrs.length).setValues([leadRow]);
  } else {
    leadsSheet.appendRow(leadRow);
  }

  // ── 3. 会話ログシートに 100 件追記（既存テストデータを先に削除） ──
  var convSheet = resolveConversationLogSheet_(ss);
  if (!convSheet) throw new Error('会話ログシートが見つかりません');

  var convData  = convSheet.getDataRange().getValues();
  var convHdrs  = convData[0];
  var cCol = function(name) { return convHdrs.indexOf(name); };

  // 後ろから削除（行番号がズレないよう逆順）
  for (var dr = convData.length - 1; dr >= 1; dr--) {
    if (String(convData[dr][cCol('リードID')] || '').trim() === TEST_LEAD_ID) {
      convSheet.deleteRow(dr + 1);
    }
  }

  // 100 件生成（1時間ずつ増加）
  var baseMs  = new Date('2026-01-01T00:00:00+09:00').getTime();
  var newRows = [];
  for (var n = 1; n <= 100; n++) {
    var msgDate = new Date(baseMs + (n - 1) * 60 * 60 * 1000);
    var dateStr = Utilities.formatDate(msgDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    var dir     = (n % 2 === 1) ? '受信' : '送信';
    var nStr    = n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n;
    var body    = 'テストメッセージ ' + nStr + ' / 100';

    var row = new Array(convHdrs.length).fill('');
    if (cCol('ログID')    !== -1) row[cCol('ログID')]    = 'LOG-TEST-' + nStr;
    if (cCol('リードID')  !== -1) row[cCol('リードID')]  = TEST_LEAD_ID;
    if (cCol('日時')      !== -1) row[cCol('日時')]      = dateStr;
    if (cCol('送受信')    !== -1) row[cCol('送受信')]    = dir;
    if (cCol('発言者')    !== -1) row[cCol('発言者')]    = dir === '受信' ? 'テスト顧客' : 'テスト担当者';
    if (cCol('原文')      !== -1) row[cCol('原文')]      = body;
    newRows.push(row);
  }

  var lastConvRow = convSheet.getLastRow();
  convSheet.getRange(lastConvRow + 1, 1, newRows.length, convHdrs.length).setValues(newRows);

  // ── 4. 受信箱キャッシュクリア ──
  clearCacheChunks_(CORE_INBOX_CONVERSATIONS_CACHE_INDEX, CORE_INBOX_CONVERSATIONS_CACHE_PREFIX);

  return {
    seeded:               true,
    testLeadId:           TEST_LEAD_ID,
    testLeadName:         TEST_LEAD_NAME,
    messageCount:         100,
    ldi00002CustomerName: ldi00002Name
  };
}

/**
 * DEV専用: 認証バイパスで getInboxBulkInitialLoad の結果を検証する。
 * @returns {{ conversationCount: number, detailCount: number, sampleDetail: Object }}
 */
function dryRunInboxBulkLoad() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunInboxBulkLoad は DEV 環境でのみ実行できます');
  }

  var props = PropertiesService.getScriptProperties();
  var maxConv = parseInt(props.getProperty('INBOX_INITIAL_CONVERSATIONS') || '20', 10);
  var maxMsg  = parseInt(props.getProperty('INBOX_INITIAL_MESSAGES')      || '30', 10);

  var ss = getSpreadsheet();

  // 1回のシート読み込みで全メッセージを取得
  var convSheet = resolveConversationLogSheet_(ss);
  var allMessagesByLead = {};
  if (convSheet) {
    var convData    = convSheet.getDataRange().getValues();
    var convHeaders = convData[0];
    var leadIdIdx   = convHeaders.indexOf('lead_id');
    var logIdIdx    = convHeaders.indexOf('ログID');
    var datetimeIdx = convHeaders.indexOf('日時');
    var bodyIdx     = convHeaders.indexOf('原文');
    var dirIdx      = convHeaders.indexOf('送受信');
    if (leadIdIdx !== -1) {
      for (var r = 1; r < convData.length; r++) {
        var row       = convData[r];
        var lid       = String(row[leadIdIdx] || '').trim();
        if (!lid) continue;
        var direction = dirIdx !== -1 ? String(row[dirIdx] || '').trim() : '';
        var msgObj = {
          id:     logIdIdx    !== -1 ? String(row[logIdIdx]    || '').trim() : '',
          sender: direction === '受信' ? 'customer' : 'operator',
          body:   bodyIdx     !== -1 ? String(row[bodyIdx]     || '').trim() : '',
          sentAt: datetimeIdx !== -1 ? coreCustomerFrontendValue(row[datetimeIdx]) : ''
        };
        if (!allMessagesByLead[lid]) allMessagesByLead[lid] = [];
        allMessagesByLead[lid].push(msgObj);
      }
    }
  }

  var conversations = buildInboxConversations_(ss);
  var windowConvs = conversations.slice(0, maxConv);

  var detailCount = 0;
  var sampleLead = null;
  for (var ci = 0; ci < windowConvs.length; ci++) {
    var leadId = windowConvs[ci].id;
    var msgs   = (allMessagesByLead[leadId] || []).slice();
    msgs.sort(function(a, b) { return a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0; });
    var sliced  = maxMsg > 0 && msgs.length > maxMsg ? msgs.slice(msgs.length - maxMsg) : msgs;
    var hasMore = maxMsg > 0 && msgs.length > maxMsg;
    detailCount += 1;
    if (!sampleLead || leadId === 'LDI-00002') {
      sampleLead = { leadId: leadId, totalMessages: msgs.length, loadedMessages: sliced.length, hasMore: hasMore };
    }
  }

  return {
    conversationCount: conversations.length,
    windowSize:        windowConvs.length,
    detailCount:       detailCount,
    sampleDetail:      sampleLead
  };
}
