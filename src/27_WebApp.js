/**
 * Webアプリ - GET リクエスト処理（React SPA統一版）
 * 常に ReactPoc（React SPA）を返す。
 * 認証はフロントエンドのログイン画面が担う。
 *
 * 特殊クエリパラメータ:
 * - ?page=order-form&token=<TOKEN> : 顧客登録フォーム（認証不要・token 必須）
 * - ?action=insertTestData&key=<TEST_DATA_KEY> : テストデータ投入
 * - ?action=removeTestData&key=<TEST_DATA_KEY> : テストデータ削除
 *   TEST_DATA_KEY はスクリプトプロパティで設定。未設定時は実行不可。
 */

/**
 * リード管理シートのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 * PR-1（デュアルサポート期）専用。PR-3 で削除する。
 */
function doGet(e) {
  const params = e.parameter || {};

  // 顧客登録フォーム（認証不要・token 必須）← React SPA より前に配置
  if (params.page === 'order-form') {
    const token = params.token || '';
    const validation = validateFormToken(token);
    if (!validation.valid) {
      return createOrderFormErrorPage('Registration Form Access Denied', validation.error);
    }
    const tmpl = HtmlService.createTemplateFromFile('order_form');
    tmpl.token     = token;
    tmpl.countries = JSON.stringify(getCountriesForForm());
    return tmpl.evaluate()
      .setTitle('Customer Registration Form')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // テストデータ操作（checkPermission('force_reset') でガード済み）
  if (params.action) {
    const testDataKey = PropertiesService.getScriptProperties().getProperty('TEST_DATA_KEY');
    if (testDataKey && params.key === testDataKey) {
      try {
        checkPermission('force_reset');
      } catch (authError) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: authError.message }, null, 2)
        ).setMimeType(ContentService.MimeType.JSON);
      }
      let result;
      if (params.action === 'insertTestData') {
        result = insertBadgeTestData();
        return ContentService.createTextOutput(JSON.stringify(result, null, 2))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (params.action === 'removeTestData') {
        result = removeTestData();
        return ContentService.createTextOutput(JSON.stringify(result, null, 2))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  // 旧画面プレビュー（移植作業の参考用・移植完了後に削除すること）
  if (params.page === 'legacy') {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('CRM (Legacy)')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 常に React SPA を返す
  return HtmlService.createHtmlOutputFromFile('ReactPoc')
    .setTitle('CRM Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 顧客登録フォーム専用エラーページ
 * @param {string} title
 * @param {string} message
 * @returns {HtmlOutput}
 */
function createOrderFormErrorPage(title, message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Error</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 20px; }
    .box { background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.12);
           max-width: 480px; width: 100%; padding: 40px 32px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #c0392b; margin-bottom: 12px; font-size: 20px; }
    p  { color: #555; line-height: 1.6; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚠️</div>
    <h2>${title}</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
  return HtmlService.createHtmlOutput(html)
    .setTitle('Access Error')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * アクセス拒否ページを生成
 * @param {string} title - エラータイトル
 * @param {string} message - エラーメッセージ
 * @param {string} email - ユーザーのメールアドレス（オプション）
 * @returns {HtmlOutput} アクセス拒否ページ
 */
function createAccessDeniedPage(title, message, email) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>アクセス拒否 - CRM</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 24px;
          color: #2d3748;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #718096;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .email-info {
          background: #f7fafc;
          border-left: 4px solid #667eea;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 24px;
          text-align: left;
        }
        .email-label {
          font-size: 12px;
          color: #718096;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .email-value {
          font-size: 14px;
          color: #2d3748;
          font-family: 'Courier New', monospace;
          word-break: break-all;
        }
        .help-text {
          font-size: 14px;
          color: #a0aec0;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
        }
        .help-text strong {
          color: #4a5568;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🚫</div>
        <h1>${title}</h1>
        <div class="message">${message}</div>
        ${email ? `
        <div class="email-info">
          <div class="email-label">アクセス試行されたアカウント</div>
          <div class="email-value">${email}</div>
        </div>
        ` : ''}
        <div class="help-text">
          <strong>アクセスするには:</strong><br>
          担当者マスタに登録されているメールアドレスでログインしてください。<br>
          登録が必要な場合は、システム管理者にお問い合わせください。
        </div>
      </div>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html)
    .setTitle('アクセス拒否 - CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Webアプリ - POST リクエスト処理
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch (action) {
      case 'getLeads':
        result = getLeads(data.sheetName);
        break;
      case 'getDeals':
        result = getLeads('deal');  // 商談段階のリードを取得
        break;
      case 'getStaff':
        result = getStaffList();
        break;
      case 'addLead':
        result = addNewLead(data.sheetName, data.leadData);
        break;
      case 'updateLead':
        result = updateLead(data.sheetName, data.leadId, data.updateData);
        break;
      case 'getDropdownOptions':
        result = DROPDOWN_OPTIONS;
        break;
      case 'getStockData':
        result = getStockData();
        break;
      case 'calculateShippingCost':
        result = calculateShippingCostForQuote(data.country, data.shippingMethod, data.items);
        break;
      case 'getAllCustomersForQuote':
        result = getAllCustomersForQuote();
        break;
      case 'getAvailableStatuses':
        result = getAvailableStatuses();
        break;
      case 'getAvailableConditionsForProduct':
        result = getAvailableConditionsForProduct(data.category, data.mark);
        break;
      case 'getAllProductConditionsMap':
        result = getAllProductConditionsMap();
        break;
      case 'getAllProductPricesMap':
        result = getAllProductPricesMap();
        break;
      case 'getAllProductQuantitiesMap':
        result = getAllProductQuantitiesMap();
        break;
      case 'getAllProductWeightsMap':
        result = getAllProductWeightsMap();
        break;
      case 'getAllQuotes':
        result = getAllQuotes();
        break;
      case 'deleteQuote':
        result = deleteQuote(data.quoteId);
        break;
      case 'getQuotePDFUrl':
        result = getQuotePDFUrl(data.quoteId);
        break;
      case 'updateQuotePDFUrl':
        result = updateQuotePDFUrl(data.quoteId, data.pdfUrl);
        break;
      case 'getUserSidebarPreference':
        result = getUserSidebarPreference(data.userEmail);
        break;
      case 'updateUserSidebarPreference':
        result = updateUserSidebarPreference(data.userEmail, data.sidebarOpen);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTMLファイルをインクルード
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ダッシュボード用のKPIデータを取得（統合シート版）
 */
function getDashboardKPIs(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('dashboard_view');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      leadsIn: 0, leadsOut: 0, totalLeads: 0, activeDeals: 0,
      wonDeals: 0, lostDeals: 0, totalRevenue: 0, statusCounts: {}, conversionRate: 0
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const typeIdx = headers.indexOf('lead_type');
  const statusIdx = headers.indexOf('lead_status');
  const revenueIdx = headers.indexOf('first_transaction_amount');

  let leadsIn = 0, leadsOut = 0, activeDeals = 0, wonDeals = 0, lostDeals = 0, totalRevenue = 0;
  const statusCounts = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[typeIdx];
    const status = row[statusIdx];

    // リード種別でカウント
    if (type === 'インバウンド') leadsIn++;
    else if (type === 'アウトバウンド') leadsOut++;

    // ステータス別カウント
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // 商談中（アクティブ）
    if (CONFIG.DEAL_STATUSES.includes(status)) activeDeals++;

    // 成約
    if (status === CONFIG.PROGRESS_STATUSES.WON) {
      wonDeals++;
      totalRevenue += parseFloat(row[revenueIdx]) || 0;
    }

    // 失注
    if (status === CONFIG.PROGRESS_STATUSES.LOST) lostDeals++;
  }

  const closedDeals = wonDeals + lostDeals;

  return {
    leadsIn, leadsOut,
    totalLeads: leadsIn + leadsOut,
    activeDeals, wonDeals, lostDeals, totalRevenue, statusCounts,
    conversionRate: closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0
  };
}

/**
 * リード一覧を取得（統合シート版）
 * @param {string} filter - 'lead'（リード段階）, 'deal'（商談段階）, 'closed'（完了）, 'all'
 * @param {string} leadType - 'インバウンド', 'アウトバウンド', null（全て）
 */
function getLeads(filter, leadType) {
  console.log('getLeads START: filter=' + filter + ', leadType=' + leadType);

  try {
    checkPermission(); // 認証のみチェック（権限は不要 - フロントエンドでメニュー表示権限をチェック済み）
  } catch (e) {
    console.log('getLeads: checkPermission failed - ' + e.message);
    // 権限エラーでも空配列を返す（エラーはログのみ）
    return [];
  }

  const ss = getSpreadsheet();
  if (!ss) {
    console.log('getLeads: スプレッドシートが取得できません');
    return [];
  }

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.LEADS);

  const lastRow = sheet.getLastRow();
  console.log('getLeads: lastRow=' + lastRow);
  if (lastRow < 2) {
    console.log('getLeads: データ行がありません - lastRow=' + lastRow);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const typeIdx = headers.indexOf('lead_type');
  const statusIdx = headers.indexOf('lead_status');
  const archivedAtIdx = headers.indexOf('archived_at');
  const sourceIdIdx = headers.indexOf('lead_source_id');
  const ipIdsIdx    = headers.indexOf('ip_ids');

  // 流入元ID → 名称変換マップ（流入元ID列が存在する場合のみ取得）
  const sourceIdMap  = sourceIdIdx >= 0 ? getLeadSourceIdMap_()  : {};
  // 作品ID → 表示名変換マップ（作品ID列が存在する場合のみ取得）
  const ipMasterMap  = ipIdsIdx    >= 0 ? getIpMasterMap_()      : {};

  console.log('getLeads: typeIdx=' + typeIdx + ', statusIdx=' + statusIdx);
  console.log('getLeads: LEAD_STATUSES=' + JSON.stringify(CONFIG.LEAD_STATUSES));
  console.log('getLeads: leadType param="' + leadType + '" (length=' + (leadType ? leadType.length : 0) + ')');

  const leads = [];
  let debugSkipReasons = { typeFilter: 0, statusFilter: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // trim()で前後の空白を除去し、toString()で文字列化
    const type = row[typeIdx] ? row[typeIdx].toString().trim() : '';
    const status = row[statusIdx] ? row[statusIdx].toString().trim() : '';
    const expectedType = leadType ? leadType.toString().trim() : '';

    // 最初の5行は詳細ログ
    if (i <= 5) {
      const typeMatch = (type === expectedType);
      console.log('getLeads Row ' + i + ': type="' + type + '" (len=' + type.length + '), status="' + status + '"');
      console.log('  typeMatch=' + typeMatch + ', statusMatch=' + CONFIG.LEAD_STATUSES.includes(status));
      // 文字コード比較（エンコーディング問題検出）
      if (type && expectedType && !typeMatch) {
        const typeChars = type.split('').map(c => c.charCodeAt(0)).join(',');
        const expectedChars = expectedType.split('').map(c => c.charCodeAt(0)).join(',');
        console.log('  CharCodes: actual=[' + typeChars + '] expected=[' + expectedChars + ']');
      }
    }

    // リード種別フィルタ（空の行はスキップ）
    if (!type) {
      if (i <= 5) console.log('  -> SKIPPED (empty type)');
      continue;
    }
    if (expectedType && type !== expectedType) {
      debugSkipReasons.typeFilter++;
      if (i <= 5) console.log('  -> SKIPPED (type filter)');
      continue;
    }

    // ステータスフィルタ
    if (filter === 'lead' && !CONFIG.LEAD_STATUSES.includes(status)) {
      debugSkipReasons.statusFilter++;
      if (i <= 5) console.log('getLeads: Row ' + i + ' skipped - status=' + status + ' not in LEAD_STATUSES');
      continue;
    }
    if (filter === 'deal' && !CONFIG.DEAL_STATUSES.includes(status)) continue;
    if (filter === 'closed') {
      const isArchived = archivedAtIdx >= 0 && row[archivedAtIdx];
      if (!CONFIG.CLOSED_STATUSES.includes(status) && !isArchived) continue;
    }

    const lead = {};
    headers.forEach((header, index) => {
      let value = row[index];
      // Date オブジェクトは ISO 文字列に変換（google.script.run シリアライズ対策）
      if (value instanceof Date) {
        value = value.toISOString();
      }
      lead[header] = value;
    });

    // 流入元ID → 流入経路（名称）変換（移行期互換ルール）
    // - 流入元IDが入っている行: マスタから名称に変換して流入経路フィールドを上書き
    // - 流入元IDが空欄の行: 流入経路列の値をそのまま返す（テストデータ・未移行分）
    if (sourceIdIdx >= 0) {
      const rawId = String(lead['lead_source_id'] || '').trim();
      if (rawId && sourceIdMap[rawId]) {
        lead['lead_source'] = sourceIdMap[rawId];
      }
    }

    // ip_ids → handled_title（名称）変換（移行期互換ルール）
    // - 作品IDが入っている行: マスタから名称に変換して取り扱いタイトルフィールドを上書き
    //   表示名は別名優先、空の場合は作品名（在庫ページのタブと同じ規則）
    //   カンマ+空白で再結合（例: "ポケモン, ワンピース"）
    // - 作品IDが空欄の行: handled_title列の値をそのまま返す（未変換分）
    if (ipIdsIdx >= 0) {
      const rawIds = String(lead['ip_ids'] || '').trim();
      if (rawIds) {
        const names = rawIds.split(',').map(function(id) {
          const trimmed = id.trim();
          return ipMasterMap[trimmed] || trimmed;
        });
        lead['handled_title'] = names.join(', ');
      }
    }

    leads.push(lead);
  }

  console.log('getLeads RESULT: ' + leads.length + '件 (filter=' + filter + ', type=' + leadType + ')');
  console.log('getLeads SKIP: typeFilter=' + debugSkipReasons.typeFilter + ', statusFilter=' + debugSkipReasons.statusFilter);
  return leads;
}

// ─── リードキャッシュ定数 ────────────────────────────────────────────────────
const LEADS_CACHE_INDEX_ALL       = 'LEADS_CACHE_INDEX_ALL';
const LEADS_CACHE_PREFIX_ALL      = 'LEADS_CACHE_ALL_';
const LEADS_CACHE_INDEX_INBOUND   = 'LEADS_CACHE_INDEX_INBOUND';
const LEADS_CACHE_PREFIX_INBOUND  = 'LEADS_CACHE_INBOUND_';
const LEADS_CACHE_INDEX_OUTBOUND  = 'LEADS_CACHE_INDEX_OUTBOUND';
const LEADS_CACHE_PREFIX_OUTBOUND = 'LEADS_CACHE_OUTBOUND_';
const LEADS_CACHE_CHUNK_SIZE      = 90000;
const LEADS_CACHE_TTL             = 600;

/** createLead / updateLead が無効化すべきキャッシュ一覧 */
const LEADS_CACHE_TARGETS = [
  { indexKey: LEADS_CACHE_INDEX_ALL,      prefix: LEADS_CACHE_PREFIX_ALL },
  { indexKey: LEADS_CACHE_INDEX_INBOUND,  prefix: LEADS_CACHE_PREFIX_INBOUND },
  { indexKey: LEADS_CACHE_INDEX_OUTBOUND, prefix: LEADS_CACHE_PREFIX_OUTBOUND }
];

// ─── 流入元マスタキャッシュ定数 ──────────────────────────────────────────────
const LEAD_SOURCES_CACHE_INDEX      = 'LEAD_SOURCES_CACHE_INDEX';
const LEAD_SOURCES_CACHE_PREFIX     = 'LEAD_SOURCES_CACHE_';
const LEAD_SOURCES_CACHE_TTL        = 600;
const LEAD_SOURCES_CACHE_CHUNK_SIZE = 90000;

// ─── 作品マスタキャッシュ定数 ────────────────────────────────────────────────
const IP_MASTER_CACHE_INDEX      = 'IP_MASTER_CACHE_INDEX';
const IP_MASTER_CACHE_PREFIX     = 'IP_MASTER_CACHE_';
const IP_MASTER_CACHE_TTL        = 600;
const IP_MASTER_CACHE_CHUNK_SIZE = 90000;

/**
 * 流入元マスタから source_id → 名称 のマップを返す（キャッシュ対応、TTL 600秒）。
 * キャッシュヒット時はシートを読まない。
 *
 * @returns {Object.<string, string>}  例: { SRC001: 'Instagram', SRC002: 'Facebook', ... }
 */
function getLeadSourceIdMap_() {
  const cached = readCacheChunks_(LEAD_SOURCES_CACHE_INDEX, LEAD_SOURCES_CACHE_PREFIX);
  if (cached !== null) return cached;

  const ss    = getSpreadsheet();
  const table = getCoreSchemaV1Table('LEAD_SOURCES');
  const sheet = getCoreSchemaV1Sheet(ss, 'LEAD_SOURCES');
  const lastRow = sheet.getLastRow();

  if (lastRow <= table.headerRowNumber) {
    writeCacheChunks_(LEAD_SOURCES_CACHE_INDEX, LEAD_SOURCES_CACHE_PREFIX, {}, LEAD_SOURCES_CACHE_TTL, LEAD_SOURCES_CACHE_CHUNK_SIZE);
    return {};
  }

  const headers = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const idIdx   = headers.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'SOURCE_ID'));
  const nameIdx = headers.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'NAME'));

  if (idIdx < 0 || nameIdx < 0) return {};

  const rows  = sheet.getRange(table.headerRowNumber + 1, 1, lastRow - table.headerRowNumber, sheet.getLastColumn()).getValues();
  const idMap = {};
  rows.forEach(function(row) {
    const id   = String(row[idIdx]   || '').trim();
    const name = String(row[nameIdx] || '').trim();
    if (id && name) idMap[id] = name;
  });

  writeCacheChunks_(LEAD_SOURCES_CACHE_INDEX, LEAD_SOURCES_CACHE_PREFIX, idMap, LEAD_SOURCES_CACHE_TTL, LEAD_SOURCES_CACHE_CHUNK_SIZE);
  return idMap;
}

/**
 * 作品マスタ_共用在庫から ip_id → 表示名 のマップを返す（キャッシュ対応、TTL 600秒）。
 * 表示名は別名優先、空の場合は作品名（在庫ページのタブと同じ規則）。
 * キャッシュヒット時はシートを読まない。
 *
 * @returns {Object.<string, string>}  例: { IP001: 'ポケモン', IP002: 'ワンピース', ... }
 */
function getIpMasterMap_() {
  const cached = readCacheChunks_(IP_MASTER_CACHE_INDEX, IP_MASTER_CACHE_PREFIX);
  if (cached !== null) return cached;

  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName('作品マスタ_共用在庫');

  if (!sheet || sheet.getLastRow() <= 1) {
    writeCacheChunks_(IP_MASTER_CACHE_INDEX, IP_MASTER_CACHE_PREFIX, {}, IP_MASTER_CACHE_TTL, IP_MASTER_CACHE_CHUNK_SIZE);
    return {};
  }

  const data     = sheet.getDataRange().getValues();
  const headers  = data[0].map(String);
  const ipIdIdx  = headers.indexOf('ip_id');
  const nameIdx  = headers.indexOf('title')  >= 0 ? headers.indexOf('title')  : headers.indexOf('作品名');
  const aliasIdx = headers.indexOf('alias')  >= 0 ? headers.indexOf('alias')  : headers.indexOf('別名');

  if (ipIdIdx < 0 || nameIdx < 0) {
    writeCacheChunks_(IP_MASTER_CACHE_INDEX, IP_MASTER_CACHE_PREFIX, {}, IP_MASTER_CACHE_TTL, IP_MASTER_CACHE_CHUNK_SIZE);
    return {};
  }

  const ipMap = {};
  for (let i = 1; i < data.length; i++) {
    const id    = String(data[i][ipIdIdx]  || '').trim();
    const name  = String(data[i][nameIdx]  || '').trim();
    const alias = aliasIdx >= 0 ? String(data[i][aliasIdx] || '').trim() : '';
    if (id) ipMap[id] = alias || name;
  }

  writeCacheChunks_(IP_MASTER_CACHE_INDEX, IP_MASTER_CACHE_PREFIX, ipMap, IP_MASTER_CACHE_TTL, IP_MASTER_CACHE_CHUNK_SIZE);
  return ipMap;
}

/**
 * leadType からキャッシュキーペアを返す。
 * undefined / '' / 'all' → ALL キー。
 * 未知の種別は null（キャッシュ対象外）。
 */
function leadsGetCacheKeyPair_(leadType) {
  const normalized = leadType ? String(leadType).trim() : '';
  if (!normalized || normalized === 'all') {
    return { indexKey: LEADS_CACHE_INDEX_ALL, prefix: LEADS_CACHE_PREFIX_ALL };
  }
  if (normalized === 'インバウンド') {
    return { indexKey: LEADS_CACHE_INDEX_INBOUND, prefix: LEADS_CACHE_PREFIX_INBOUND };
  }
  if (normalized === 'アウトバウンド') {
    return { indexKey: LEADS_CACHE_INDEX_OUTBOUND, prefix: LEADS_CACHE_PREFIX_OUTBOUND };
  }
  return null;
}

/**
 * リード種別でフィルタリングしたリードを取得（キャッシュ対応）。
 * @param {string} sessionId
 * @param {string|undefined} leadType  'インバウンド' | 'アウトバウンド' | undefined
 * @param {boolean} [forceRefresh]  true のときキャッシュを無視してシートから再取得
 */
function getLeadsByType(sessionId, leadType, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission(); // 認証のみチェック（キャッシュ返却前に必ず実行）

  const pair = leadsGetCacheKeyPair_(leadType);

  if (pair !== null && forceRefresh !== true) {
    const cached = readCacheChunks_(pair.indexKey, pair.prefix);
    if (cached !== null) return cached;
  }

  const rows = getLeads('lead', leadType);

  if (pair !== null) {
    writeCacheChunks_(pair.indexKey, pair.prefix, rows, LEADS_CACHE_TTL, LEADS_CACHE_CHUNK_SIZE);
  }

  return rows;
}

/**
 * リード一覧（全件）とフォーム選択肢を1回のGAS呼び出しでまとめて返す。
 * getLeadsByType + getLeadFormOptions の固定オーバーヘッドを削減する。
 *
 * @param {string}  sessionId
 * @param {boolean} [forceRefresh]
 * @returns {{ leads: Object[], formOptions: Object }}
 */
function getLeadsBatchForFrontend(sessionId, forceRefresh) {
  // 各関数が内部で setEmailFromSession / checkPermission を呼ぶ
  const leads      = getLeadsByType(sessionId, undefined, forceRefresh);
  const formOptions = getLeadFormOptions(sessionId);
  return { leads: leads, formOptions: formOptions };
}

/**
 * 見積もりフォームのリード候補表示用。LEAD_ID と顧客名のみを返す（全列取得を避けて転送量を最小化）。
 * @param {string} sessionId
 * @returns {{ leadId: string, customerName: string }[]}
 */
function getLeadOptionsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission();
  } catch (e) {
    return [];
  }
  const ss = getSpreadsheet();
  if (!ss) return [];

  const leadsSheet = getCoreSchemaV1Sheet(ss, 'LEADS');
  const leadsTable = getCoreSchemaV1Table('LEADS');
  const lastRow    = leadsSheet.getLastRow();
  const dataStart  = leadsTable.headerRowNumber + 1;
  if (lastRow < dataStart) return [];

  const headers = leadsSheet
    .getRange(leadsTable.headerRowNumber, 1, 1, leadsSheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  const leadIdColName       = getCoreSchemaV1HeaderName('LEADS', 'LEAD_ID');
  const customerNameColName = getCoreSchemaV1HeaderName('LEADS', 'CUSTOMER_NAME');
  const leadIdColIdx        = headers.indexOf(leadIdColName);
  const customerNameColIdx  = headers.indexOf(customerNameColName);

  if (leadIdColIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: LEAD_ID');
  if (customerNameColIdx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: CUSTOMER_NAME');

  const rowCount      = lastRow - leadsTable.headerRowNumber;
  const leadIdValues  = leadsSheet.getRange(dataStart, leadIdColIdx + 1, rowCount, 1).getDisplayValues();
  const nameValues    = leadsSheet.getRange(dataStart, customerNameColIdx + 1, rowCount, 1).getDisplayValues();

  // CUSTOMERS シートから SOURCE_LEAD_ID → COUNTRY マップを構築
  var leadCountryMap = {};
  try {
    const custSheet   = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
    const custTable   = getCoreSchemaV1Table('CUSTOMERS');
    const custLastRow = custSheet.getLastRow();
    const custDataStart = custTable.headerRowNumber + 1;
    if (custLastRow >= custDataStart) {
      const custHeaders = custSheet
        .getRange(custTable.headerRowNumber, 1, 1, custSheet.getLastColumn())
        .getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); });
      const srcLeadColName = getCoreSchemaV1HeaderName('CUSTOMERS', 'SOURCE_LEAD_ID');
      const countryColName = getCoreSchemaV1HeaderName('CUSTOMERS', 'COUNTRY');
      const srcLeadColIdx  = custHeaders.indexOf(srcLeadColName);
      const countryColIdx  = custHeaders.indexOf(countryColName);
      if (srcLeadColIdx >= 0 && countryColIdx >= 0) {
        const custRowCount = custLastRow - custTable.headerRowNumber;
        const srcLeadVals  = custSheet.getRange(custDataStart, srcLeadColIdx + 1, custRowCount, 1).getDisplayValues();
        const countryVals  = custSheet.getRange(custDataStart, countryColIdx + 1, custRowCount, 1).getDisplayValues();
        for (var ci = 0; ci < srcLeadVals.length; ci++) {
          const srcLead = String(srcLeadVals[ci][0] || '').trim();
          const country = String(countryVals[ci][0] || '').trim();
          if (srcLead) leadCountryMap[srcLead] = country;
        }
      }
    }
  } catch (e) {
    // CUSTOMERS 読み込み失敗は致命的でない（countryCode は空文字で返す）
  }

  var results = [];
  for (var i = 0; i < leadIdValues.length; i++) {
    var leadId       = String(leadIdValues[i][0] || '').trim();
    var customerName = String(nameValues[i][0] || '').trim();
    if (leadId) results.push({ leadId: leadId, customerName: customerName, countryCode: leadCountryMap[leadId] || '' });
  }
  return results;
}

/**
 * 特定のリードの詳細情報を取得
 * @param {string} leadId - リードID
 * @returns {Object|null} リード情報オブジェクト、見つからない場合はnull
 */
function getLeadDetail(sessionId, leadId) {
  setEmailFromSession(sessionId);
  console.log('getLeadDetail START: leadId=' + leadId);

  try {
    checkPermission(); // 認証のみチェック（権限は不要 - フロントエンドでメニュー表示権限をチェック済み）
  } catch (e) {
    console.log('getLeadDetail: checkPermission failed - ' + e.message);
    return null;
  }

  const ss = getSpreadsheet();
  if (!ss) {
    console.log('getLeadDetail: スプレッドシートが取得できません');
    return null;
  }

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) {
    console.log('getLeadDetail: リード管理シートが見つかりません');
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    console.log('getLeadDetail: データ行がありません');
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('lead_id');

  if (idIndex === -1) {
    console.log('getLeadDetail: リードID列が見つかりません');
    return null;
  }

  // リードIDで行を検索
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === leadId) {
      const lead = {};
      headers.forEach((header, index) => {
        let value = data[i][index];
        // Date オブジェクトは ISO 文字列に変換
        if (value instanceof Date) {
          value = value.toISOString();
        }
        lead[header] = value;
      });
      console.log('getLeadDetail SUCCESS: leadId=' + leadId);
      return lead;
    }
  }

  console.log('getLeadDetail: リードが見つかりません - ' + leadId);
  return null;
}

/**
 * 現在のユーザーに割り当てられたリード一覧を取得
 * @returns {Array} リード一覧
 */
function getMyLeads() {
  console.log('getMyLeads START');

  try {
    checkPermission(); // 認証のみチェック（権限は不要 - フロントエンドでメニュー表示権限をチェック済み）
  } catch (e) {
    console.log('getMyLeads: checkPermission failed - ' + e.message);
    return [];
  }

  const userEmail = resolveCurrentUserEmail();
  console.log('getMyLeads: userEmail=' + userEmail);

  const ss = getSpreadsheet();
  if (!ss) {
    console.log('getMyLeads: スプレッドシートが取得できません');
    return [];
  }

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) {
    console.log('getMyLeads: リード管理シートが見つかりません');
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    console.log('getMyLeads: データ行がありません');
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const assigneeIdIndex = headers.indexOf('assignee_id');

  if (assigneeIdIndex === -1) {
    console.log('getMyLeads: 担当者ID列が見つかりません');
    return [];
  }

  // 現在のユーザーの担当者IDを取得
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!staffSheet) {
    console.log('getMyLeads: 担当者マスタシートが見つかりません');
    return [];
  }

  const staffData = staffSheet.getDataRange().getValues();
  const staffHeaders = staffData[0];
  const staffEmailIndex = staffHeaders.indexOf('email');
  const staffIdIndex = staffHeaders.indexOf('staff_id');

  let currentStaffId = null;
  for (let i = 1; i < staffData.length; i++) {
    if (staffData[i][staffEmailIndex] === userEmail) {
      currentStaffId = staffData[i][staffIdIndex];
      break;
    }
  }

  if (!currentStaffId) {
    console.log('getMyLeads: 現在のユーザーの担当者IDが見つかりません');
    return [];
  }

  console.log('getMyLeads: currentStaffId=' + currentStaffId);

  // 担当者IDでフィルタリング
  const myLeads = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[assigneeIdIndex] === currentStaffId) {
      const lead = {};
      headers.forEach((header, index) => {
        let value = row[index];
        // Date オブジェクトは ISO 文字列に変換
        if (value instanceof Date) {
          value = value.toISOString();
        }
        lead[header] = value;
      });
      myLeads.push(lead);
    }
  }

  console.log('getMyLeads SUCCESS: ' + myLeads.length + '件');
  return myLeads;
}

/**
 * 新規リードを追加
 */
function addNewLead(leadType, leadData) {
  // 統合シートにリードを追加
  return addIntegratedLead(leadData, leadType);
}

/**
 * 新規リードを作成
 */
function createLead(sessionId, leadData) {
  setEmailFromSession(sessionId);
  checkPermission('lead_add');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    throw new Error('リード管理シートが見つかりません');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // リード種別を決定（デフォルトはインバウンド）
  const leadType = leadData['lead_type'] || 'インバウンド';

  // リードIDを生成
  const leadId = generateNextLeadId(leadType);

  // 現在のユーザー情報を取得
  const userEmail = resolveCurrentUserEmail();
  const userInfo = getUserInfoByEmail(userEmail);
  const currentUserName = userInfo ? userInfo.staffName : '';

  // 新しい行のデータを作成
  const newRow = [];
  headers.forEach(header => {
    if (header === 'lead_id') {
      newRow.push(leadId);
    } else if (header === 'registered_at') {
      newRow.push(new Date());
    } else if (header === 'sheet_updated_at') {
      newRow.push(new Date());
    } else if (header === 'lead_type') {
      newRow.push(leadType);
    } else if (header === 'lead_status') {
      // 新規リード作成時は必ず「新規リード」を設定
      newRow.push('新規リード');
    } else if (header === 'lead_assignee_name') {
      // 新規リード作成時は現在のユーザー名を設定
      newRow.push(leadData[header] || currentUserName);
    } else if (header === '担当者') {
      // 営業担当者は空白（後でアサイン時に設定）
      newRow.push(leadData[header] || '');
    } else {
      newRow.push(leadData[header] || '');
    }
  });

  return withSheetWrite_(
    { useLock: true, cacheTargets: LEADS_CACHE_TARGETS },
    () => {
      sheet.appendRow(newRow);
      return {
        success: true,
        leadId: leadId,
        message: '新規リードを作成しました'
      };
    }
  );
}

/**
 * リードを更新
 */
function updateLead(sessionId, sheetName, leadId, updateData) {
  setEmailFromSession(sessionId);
  checkPermission('lead_edit');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('シートにデータがありません');
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('lead_id');

  if (idIndex === -1) {
    throw new Error('リードID列が見つかりません');
  }

  // リードIDで行を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === leadId) {
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error('リードが見つかりません: ' + leadId);
  }

  return withSheetWrite_(
    { useLock: true, cacheTargets: LEADS_CACHE_TARGETS },
    () => {
      // 既存行をクローンして更新値を上書きし、setValues 1回で書き込む
      const rowValues = data[targetRow - 1].slice();

      Object.entries(updateData).forEach(([key, value]) => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          rowValues[colIndex] = value;
        }
      });

      // 更新日を設定
      const updateDateIndex = headers.indexOf('sheet_updated_at');
      if (updateDateIndex !== -1) {
        rowValues[updateDateIndex] = new Date();
      }

      sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);

      // lead_statusが成約/失注の場合は商談結果を連携（onEdit経路と共通関数を使用）
      syncDealResultByStatus_(sheet, headers, targetRow, updateData['lead_status'] || '');

      return leadId;
    }
  );
}

/**
 * リードの単一フィールドを更新
 * @param {string} leadId - リードID
 * @param {string} field - フィールド名
 * @param {*} value - 新しい値
 * @return {Object} 更新結果
 */
function updateLeadField(leadId, field, value) {
  try {
    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadsSheet || leadsSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'シートにデータがありません'
      };
    }

    const data = leadsSheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('lead_id');
    const fieldIndex = headers.indexOf(field);

    if (idIndex === -1) {
      return {
        success: false,
        error: 'リードID列が見つかりません'
      };
    }

    if (fieldIndex === -1) {
      return {
        success: false,
        error: `フィールド "${field}" が見つかりません`
      };
    }

    // リードIDで行を検索
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === leadId) {
        targetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        error: 'リードが見つかりません: ' + leadId
      };
    }

    // フィールドを更新
    leadsSheet.getRange(targetRow, fieldIndex + 1).setValue(value);

    // シート更新日を更新
    const updateDateIndex = headers.indexOf('sheet_updated_at');
    if (updateDateIndex !== -1) {
      leadsSheet.getRange(targetRow, updateDateIndex + 1).setValue(new Date());
    }

    return {
      success: true,
      message: `フィールド "${field}" を更新しました`
    };
  } catch (error) {
    Logger.log('❌ Error in updateLeadField: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 商談ステータス（進捗ステータス）を更新
 * @param {string} leadId - リードID
 * @param {string} newStatus - 新しいステータス
 * @returns {Object} {success: boolean, leadId: string}
 */
function updateDealStatus(leadId, newStatus) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('シートにデータがありません');
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('lead_id');
  const statusIndex = headers.indexOf('進捗ステータス');
  const updateDateIndex = headers.indexOf('sheet_updated_at');

  if (idIndex === -1 || statusIndex === -1) {
    throw new Error('必要な列が見つかりません');
  }

  // リードIDで行を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === leadId) {
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error('リードが見つかりません: ' + leadId);
  }

  // ステータスを更新
  sheet.getRange(targetRow, statusIndex + 1).setValue(newStatus);

  // 更新日を設定
  if (updateDateIndex !== -1) {
    sheet.getRange(targetRow, updateDateIndex + 1).setValue(new Date());
  }

  return { success: true, leadId: leadId };
}

/**
 * リードを営業チームにアサイン
 * @param {string} leadId - リードID
 * @returns {Object} {success: boolean, message: string}
 */
function assignLeadToSales(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, message: 'シートにデータがありません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 必要な列インデックスを取得
  const idIndex = headers.indexOf('lead_id');
  const assignDateIndex = headers.indexOf('assigned_at');
  const assigneeIndex = headers.indexOf('担当者');
  const assigneeIdIndex = headers.indexOf('assignee_id');
  const customerNameIndex = headers.indexOf('customer_name');
  const updateDateIndex = headers.indexOf('sheet_updated_at');

  if (idIndex === -1) {
    return { success: false, message: 'リードID列が見つかりません' };
  }

  // リードIDで行を検索
  let targetRow = -1;
  let customerName = '';
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === leadId) {
      targetRow = i + 1; // 1-indexed
      customerName = customerNameIndex !== -1 ? data[i][customerNameIndex] : '';
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: 'リードが見つかりません: ' + leadId };
  }

  // 現在のユーザー情報を取得
  const currentUser = resolveCurrentUserEmail();

  // 各列を更新
  const leadStatusIndex = headers.indexOf('lead_status');
  if (leadStatusIndex !== -1) {
    sheet.getRange(targetRow, leadStatusIndex + 1).setValue('アサイン確定');
  }
  if (assignDateIndex !== -1) {
    sheet.getRange(targetRow, assignDateIndex + 1).setValue(new Date());
  }
  if (assigneeIndex !== -1) {
    sheet.getRange(targetRow, assigneeIndex + 1).setValue(currentUser);
  }
  if (assigneeIdIndex !== -1) {
    // 担当者IDは簡易的にメールアドレスの@前を使用
    const userId = currentUser ? currentUser.split('@')[0] : '';
    sheet.getRange(targetRow, assigneeIdIndex + 1).setValue(userId);
  }
  if (updateDateIndex !== -1) {
    sheet.getRange(targetRow, updateDateIndex + 1).setValue(new Date());
  }

  return { success: true, message: 'アサインが完了しました' };
}

/**
 * リードをアーカイブ
 * @param {string} leadId - リードID
 * @returns {Object} {success: boolean, message: string}
 */
function archiveLeadToArchive(leadId) {
  const ss = getSpreadsheet();
  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  // アーカイブシートを取得（存在しない場合は作成）
  let archiveSheet = ss.getSheetByName('リード_アーカイブ');
  if (!archiveSheet) {
    // アーカイブシートを作成し、ヘッダーをコピー
    archiveSheet = ss.insertSheet('リード_アーカイブ');
    const headers = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getValues();
    archiveSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  }

  if (!leadsSheet || leadsSheet.getLastRow() < 2) {
    return { success: false, message: 'リード管理シートにデータがありません' };
  }

  const data = leadsSheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('lead_id');

  if (idIndex === -1) {
    return { success: false, message: 'リードID列が見つかりません' };
  }

  // リードIDで行を検索
  let targetRow = -1;
  let targetData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === leadId) {
      targetRow = i + 1; // 1-indexed
      targetData = data[i];
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: 'リードが見つかりません: ' + leadId };
  }

  // アーカイブシートに追加
  archiveSheet.appendRow(targetData);

  // リード管理シートから削除
  leadsSheet.deleteRow(targetRow);

  return { success: true, message: 'アーカイブが完了しました' };
}

/**
 * 「対応開始」処理 - アサイン確定→商談中に変更
 * @param {string} leadId - リードID
 * @returns {Object} {success: boolean, leadId: string}
 */
function startDealResponse(leadId) {
  return updateDealStatus(leadId, '商談中');
}

/**
 * 担当者一覧を取得
 */
function getStaffList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffList = [];

  for (let i = 1; i < data.length; i++) {
    const staff = {};
    headers.forEach((header, index) => {
      let value = data[i][index];
      // Date オブジェクトは ISO 文字列に変換（google.script.run シリアライズ対策）
      if (value instanceof Date) {
        value = value.toISOString();
      }
      staff[header] = value;
    });

    // 有効なスタッフのみ
    if (staff['ステータス'] === '有効') {
      staffList.push(staff);
    }
  }

  return staffList;
}

/**
 * デバッグ用: 担当者マスタの全データを取得
 * @returns {Array} 担当者マスタの全データ
 */
function debugGetStaffMasterData() {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    return { error: '担当者マスタシートが見つかりません' };
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = data[i][index];
    });
    rows.push(row);
  }

  return {
    headers: headers,
    rows: rows
  };
}

/**
 * 現在ログイン中のユーザー情報を取得
 * @returns {Object} {success: boolean, name: string, role: string, email: string}
 */
/**
 * 現在ログイン中のユーザー情報と権限を取得
 * @returns {Object} {success: boolean, name: string, role: string, email: string, permissions: Object}
 */
function getCurrentUser(sessionId) {
  setEmailFromSession(sessionId);
  try {
    const email = resolveCurrentUserEmail();
    Logger.log('getCurrentUser: email = ' + email);

    const userInfo = getCurrentUserPermissions(email);
    Logger.log('getCurrentUser: userInfo.success = ' + userInfo.success);
    Logger.log('getCurrentUser: userInfo.error = ' + userInfo.error);

    if (userInfo.user) {
      Logger.log('getCurrentUser: userInfo.user.name = ' + userInfo.user.name);
      Logger.log('getCurrentUser: userInfo.user.role = ' + userInfo.user.role);
    }

    if (!userInfo.success) {
      return {
        success: false,
        name: userInfo.user ? userInfo.user.name : 'Unknown',
        role: 'Guest',
        email: email,
        permissions: {}
      };
    }

    return {
      success: true,
      name: userInfo.user.name || 'Unknown',
      role: userInfo.user.role || 'Guest',
      email: email,
      staffId: userInfo.user.staffId || '',
      permissions: userInfo.permissions || {}
    };
  } catch (error) {
    Logger.log('getCurrentUser error: ' + error);
    return {
      success: false,
      name: 'Unknown',
      role: 'Guest',
      email: '',
      permissions: {}
    };
  }
}

/**
 * アサイン用の担当者一覧を取得
 * @returns {Array} [{id, name, discordId}, ...]
 */
function getStaffListForAssign() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.STAFF);
  if (sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('staff_id');
  const roleCol = headers.indexOf('staff_role');
  const statusCol = headers.indexOf('status');

  // 新形式と旧形式の両方に対応
  const familyNameJaCol = headers.indexOf('last_name_ja');
  const givenNameJaCol = headers.indexOf('first_name_ja');
  const oldNameCol = headers.indexOf('full_name_ja');

  const staffList = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];
    const role = row[roleCol];

    // 有効な担当者のみ（営業、リーダー、オーナー）
    if (status !== '有効') continue;
    if (role !== '営業' && role !== 'リーダー' && role !== 'オーナー') continue;

    // スタッフ名を取得（新形式 → 旧形式）
    let staffName = '';
    if (familyNameJaCol >= 0 && givenNameJaCol >= 0) {
      const family = row[familyNameJaCol] || '';
      const given = row[givenNameJaCol] || '';
      if (family || given) {
        staffName = (family + ' ' + given).trim();
      }
    }
    if (!staffName && oldNameCol >= 0) {
      staffName = row[oldNameCol] || '';
    }

    if (row[idCol] && staffName) {
      staffList.push({
        id: row[idCol],
        name: staffName
      });
    }
  }

  return staffList;
}

/**
 * アーカイブ理由リストを取得
 * @returns {Array<string>} アーカイブ理由の配列
 */
function getArchiveReasons() {
  return getOptionsByCategory_('archive_reason');
}

/**
 * リードに担当者をアサイン
 * @param {string} leadId - リードID
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @returns {Object} {success: boolean, error?: string}
 */
function assignLead(leadId, staffId, staffName) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('lead_id');
    const staffCol = headers.indexOf('担当者');
    const staffIdCol = headers.indexOf('assignee_id');
    const assignDateCol = headers.indexOf('assigned_at');
    const statusCol = headers.indexOf('進捗ステータス');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === leadId) {
        const rowNum = i + 1;
        if (staffCol >= 0) sheet.getRange(rowNum, staffCol + 1).setValue(staffName);
        if (staffIdCol >= 0) sheet.getRange(rowNum, staffIdCol + 1).setValue(staffId);
        if (assignDateCol >= 0) sheet.getRange(rowNum, assignDateCol + 1).setValue(new Date());
        if (statusCol >= 0) sheet.getRange(rowNum, statusCol + 1).setValue('アサイン確定');

        return { success: true };
      }
    }

    return { success: false, error: 'リードが見つかりません' };
  } catch (e) {
    console.error('assignLead error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 営業担当者リストを取得（role="営業" または "オーナー" のスタッフ）
 * @returns {Array} 営業担当者リスト [{staffId, staffName, role}, ...]
 */
function getSalesStaffList() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 必要な列インデックスを取得
    const staffIdIdx = headers.indexOf('staff_id');
    const lastNameJpIdx = headers.indexOf('last_name_ja');
    const firstNameJpIdx = headers.indexOf('first_name_ja');
    const roleIdx = headers.indexOf('staff_role'); // 実際のシートでは「ロール」
    const statusIdx = headers.indexOf('status');

    const salesStaffList = [];

    for (let i = 1; i < data.length; i++) {
      const role = data[i][roleIdx];
      const status = data[i][statusIdx];

      // role="営業" または "オーナー" かつ ステータス="有効" のスタッフのみ
      if ((role === '営業' || role === 'オーナー') && status === '有効') {
        const staffId = data[i][staffIdIdx];
        const lastName = data[i][lastNameJpIdx] || '';
        const firstName = data[i][firstNameJpIdx] || '';
        const staffName = lastName + ' ' + firstName;

        salesStaffList.push({
          staffId: staffId,
          staffName: staffName.trim(),
          role: role
        });
      }
    }

    return salesStaffList;
  } catch (error) {
    console.error('getSalesStaffList error:', error);
    return [];
  }
}

/**
 * メールアドレスからユーザー情報を取得
 * @param {string} email - メールアドレス
 * @returns {Object|null} {staffId: string, staffName: string, role: string} or null
 */
function getUserInfoByEmail(email) {
  try {
    if (!email) {
      return null;
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!sheet || sheet.getLastRow() < 2) {
      return null;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 必要な列インデックスを取得
    const emailIdx = headers.indexOf('email');
    const staffIdIdx = headers.indexOf('staff_id');
    const lastNameJpIdx = headers.indexOf('last_name_ja');
    const firstNameJpIdx = headers.indexOf('first_name_ja');
    const roleIdx = headers.indexOf('staff_role');
    const statusIdx = headers.indexOf('status');

    // メールアドレス列が見つからない場合
    if (emailIdx === -1) {
      console.error('メールアドレス列が見つかりません');
      return null;
    }

    // メールアドレスで検索
    for (let i = 1; i < data.length; i++) {
      const rowEmail = data[i][emailIdx];

      if (rowEmail && rowEmail.toString().toLowerCase() === email.toLowerCase()) {
        const status = data[i][statusIdx];

        // ステータスが有効なスタッフのみ
        if (status === '有効') {
          const staffId = data[i][staffIdIdx];
          const lastName = data[i][lastNameJpIdx] || '';
          const firstName = data[i][firstNameJpIdx] || '';
          const staffName = (lastName + ' ' + firstName).trim();
          const role = data[i][roleIdx];

          return {
            staffId: staffId,
            staffName: staffName,
            role: role
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('getUserInfoByEmail error:', error);
    return null;
  }
}

/**
 * リードを営業担当者にアサイン
 * @param {string} leadId - リードID
 * @param {string} staffId - 担当者ID
 * @returns {Object} {success: boolean, message?: string}
 */
function assignLeadToStaff(leadId, staffId) {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
    if (!staffSheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.STAFF);
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (!leadsSheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.LEADS);

    // 1. 担当者情報を取得
    const staffData = staffSheet.getDataRange().getValues();
    const staffHeaders = staffData[0];
    const staffIdIdx = staffHeaders.indexOf('staff_id');
    const lastNameJpIdx = staffHeaders.indexOf('last_name_ja');
    const firstNameJpIdx = staffHeaders.indexOf('first_name_ja');
    let staffName = '';

    for (let i = 1; i < staffData.length; i++) {
      if (staffData[i][staffIdIdx] === staffId) {
        const lastName = staffData[i][lastNameJpIdx] || '';
        const firstName = staffData[i][firstNameJpIdx] || '';
        staffName = (lastName + ' ' + firstName).trim();
        break;
      }
    }

    if (!staffName) {
      return { success: false, message: '担当者が見つかりません' };
    }

    // 2. リードシートを更新
    const leadsData = leadsSheet.getDataRange().getValues();
    const leadsHeaders = leadsData[0];
    const leadIdIdx = leadsHeaders.indexOf('lead_id');
    const leadStatusIdx = leadsHeaders.indexOf('lead_status');
    const staffNameIdx = leadsHeaders.indexOf('sales_assignee_name');
    const staffIdColIdx = leadsHeaders.indexOf('assignee_id');
    const assignDateIdx = leadsHeaders.indexOf('assigned_at');
    const updateDateIdx = leadsHeaders.indexOf('sheet_updated_at');
    const customerNameIdx = leadsHeaders.indexOf('customer_name');

    let leadRowNum = -1;
    let customerName = '';

    for (let i = 1; i < leadsData.length; i++) {
      if (leadsData[i][leadIdIdx] === leadId) {
        leadRowNum = i + 1;
        customerName = leadsData[i][customerNameIdx] || '';
        break;
      }
    }

    if (leadRowNum === -1) {
      return { success: false, message: 'リードが見つかりません' };
    }

    // リードシートを更新
    const now = new Date();
    if (leadStatusIdx >= 0) leadsSheet.getRange(leadRowNum, leadStatusIdx + 1).setValue('アサイン確定');
    if (staffNameIdx >= 0) leadsSheet.getRange(leadRowNum, staffNameIdx + 1).setValue(staffName);
    if (staffIdColIdx >= 0) leadsSheet.getRange(leadRowNum, staffIdColIdx + 1).setValue(staffId);
    if (assignDateIdx >= 0) leadsSheet.getRange(leadRowNum, assignDateIdx + 1).setValue(now);
    if (updateDateIdx >= 0) leadsSheet.getRange(leadRowNum, updateDateIdx + 1).setValue(now);

    return {
      success: true,
      message: staffName + 'にアサインしました'
    };

  } catch (error) {
    console.error('assignLeadToStaff error:', error);
    return { success: false, message: 'アサイン処理中にエラーが発生しました: ' + error.message };
  }
}

/**
 * リードをアーカイブする（アーカイブ理由付き）
 * @param {string} leadId - リードID
 * @param {string} archiveReason - アーカイブ理由
 * @returns {Object} { success: boolean, message: string }
 */
function archiveLeadWithReason(leadId, archiveReason) {
  try {
    Logger.log('🔍 archiveLeadWithReason開始: leadId=' + leadId + ', archiveReason=' + archiveReason);

    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (!leadsSheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.LEADS);

    Logger.log('✅ シート取得成功: ' + leadsSheet.getName());

    // リードシートのデータを取得
    const leadsData = leadsSheet.getDataRange().getValues();
    const leadsHeaders = leadsData[0];

    Logger.log('📊 ヘッダー取得: ' + leadsHeaders.length + '列');

    const leadIdIdx = leadsHeaders.indexOf('lead_id');
    const archiveReasonIdx = leadsHeaders.indexOf('archive_reason');
    const archiveDateIdx = leadsHeaders.indexOf('archived_at');
    const updateDateIdx = leadsHeaders.indexOf('sheet_updated_at');

    Logger.log('📍 列インデックス: リードID=' + leadIdIdx + ', アーカイブ理由=' + archiveReasonIdx + ', アーカイブ日=' + archiveDateIdx + ', シート更新日=' + updateDateIdx);

    if (leadIdIdx === -1) {
      Logger.log('❌ リードID列が見つかりません');
      return { success: false, error: 'リードID列が見つかりません' };
    }

    let leadRowNum = -1;

    // リードIDで行を検索
    for (let i = 1; i < leadsData.length; i++) {
      if (leadsData[i][leadIdIdx] === leadId) {
        leadRowNum = i + 1; // スプレッドシートの行番号（1始まり）
        Logger.log('✅ リード発見: 行番号=' + leadRowNum + ', 顧客名=' + leadsData[i][leadsHeaders.indexOf('customer_name')]);
        break;
      }
    }

    if (leadRowNum === -1) {
      Logger.log('❌ リードが見つかりません: ' + leadId);
      return { success: false, error: 'リードが見つかりません: ' + leadId };
    }

    // リードシートを更新
    const now = new Date();

    // アーカイブ日・アーカイブ理由で管理する

    if (archiveReasonIdx >= 0) {
      leadsSheet.getRange(leadRowNum, archiveReasonIdx + 1).setValue(archiveReason);
      Logger.log('✅ アーカイブ理由を更新: ' + archiveReason);
    }

    if (archiveDateIdx >= 0) {
      leadsSheet.getRange(leadRowNum, archiveDateIdx + 1).setValue(now);
      Logger.log('✅ アーカイブ日を更新: ' + now);
    }

    if (updateDateIdx >= 0) {
      leadsSheet.getRange(leadRowNum, updateDateIdx + 1).setValue(now);
      Logger.log('✅ シート更新日を更新: ' + now);
    }

    Logger.log('✅ archiveLeadWithReason完了');

    return {
      success: true,
      message: 'アーカイブしました（理由: ' + archiveReason + '）'
    };

  } catch (error) {
    Logger.log('❌ archiveLeadWithReason error: ' + error.message);
    Logger.log('❌ Stack trace: ' + error.stack);
    console.error('archiveLeadWithReason error:', error);
    return { success: false, error: 'アーカイブ処理中にエラーが発生しました: ' + error.message };
  }
}

/**
 * 新規アサインリストを取得（status="アサイン確定"のリード）
 * @returns {Array} 新規アサインリスト
 */
function getNewAssigns() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    // 現在のユーザー情報を取得
    const userEmail = resolveCurrentUserEmail();
    const userInfo = getUserInfoByEmail(userEmail);

    if (!userInfo || !userInfo.staffId) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 必要な列インデックスを取得
    const statusIdx = headers.indexOf('lead_status');
    const staffIdIdx = headers.indexOf('assignee_id');

    const newAssigns = [];

    for (let i = 1; i < data.length; i++) {
      const status = data[i][statusIdx];
      const assignedStaffId = data[i][staffIdIdx];

      // status="アサイン確定" かつ 自分が担当者
      if (status === 'アサイン確定' && assignedStaffId === userInfo.staffId) {
        const lead = {};
        headers.forEach((header, index) => {
          let value = data[i][index];
          // Date オブジェクトは ISO 文字列に変換
          if (value instanceof Date) {
            value = value.toISOString();
          }
          lead[header] = value;
        });
        newAssigns.push(lead);
      }
    }

    return newAssigns;
  } catch (error) {
    console.error('getNewAssigns error:', error);
    return [];
  }
}

/**
 * リードの対応を開始（status: アサイン確定 → 対応中）
 * @param {string} leadId - リードID
 * @returns {Object} {success: boolean, message?: string}
 */
function startDeal(leadId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const leadIdIdx = headers.indexOf('lead_id');
    const leadStatusIdx = headers.indexOf('lead_status');
    const updateDateIdx = headers.indexOf('sheet_updated_at');

    let leadRowNum = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][leadIdIdx] === leadId) {
        leadRowNum = i + 1;
        break;
      }
    }

    if (leadRowNum === -1) {
      return { success: false, message: 'リードが見つかりません' };
    }

    // ステータスを更新
    const now = new Date();
    if (leadStatusIdx >= 0) sheet.getRange(leadRowNum, leadStatusIdx + 1).setValue('商談中');
    if (updateDateIdx >= 0) sheet.getRange(leadRowNum, updateDateIdx + 1).setValue(now);

    return {
      success: true,
      message: '対応を開始しました'
    };

  } catch (error) {
    console.error('startDeal error:', error);
    return { success: false, message: 'ステータス更新中にエラーが発生しました: ' + error.message };
  }
}

/**
 * リードをアーカイブ（リード管理シート内でアーカイブ日を設定）
 * @param {string} leadId - リードID
 * @param {string} reason - アーカイブ理由
 * @param {string} csMemo - CSメモ
 * @returns {Object} {success: boolean, error?: string}
 */
function archiveLeadToDropped(leadId, reason, csMemo) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet) {
      return { success: false, error: 'シートが見つかりません' };
    }

    // リードデータを取得
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('lead_id');
    const archiveDateCol = headers.indexOf('archived_at');
    const archiveReasonCol = headers.indexOf('archive_reason');
    const statusCol = headers.indexOf('進捗ステータス');
    const lastHandlerCol = headers.indexOf('last_responder_id');
    const csMemoCol = headers.indexOf('cs_note');
    const updateDateCol = headers.indexOf('sheet_updated_at');

    let leadRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === leadId) {
        leadRowIndex = i + 1;
        break;
      }
    }

    if (leadRowIndex === -1) {
      return { success: false, error: 'リードが見つかりません' };
    }

    // 現在のユーザー情報を取得
    const currentUser = getCurrentUserWithPermissions();
    const lastHandler = currentUser.staffId || '';
    const now = new Date();

    // アーカイブ情報を更新
    if (archiveDateCol >= 0) {
      sheet.getRange(leadRowIndex, archiveDateCol + 1).setValue(now);
    }
    if (archiveReasonCol >= 0) {
      sheet.getRange(leadRowIndex, archiveReasonCol + 1).setValue(reason);
    }
    if (statusCol >= 0) {
      sheet.getRange(leadRowIndex, statusCol + 1).setValue('アーカイブ');
    }
    if (lastHandlerCol >= 0) {
      sheet.getRange(leadRowIndex, lastHandlerCol + 1).setValue(lastHandler);
    }
    if (csMemoCol >= 0 && csMemo) {
      const existingMemo = sheet.getRange(leadRowIndex, csMemoCol + 1).getValue() || '';
      const newMemo = existingMemo ? existingMemo + '\n---\n' + csMemo : csMemo;
      sheet.getRange(leadRowIndex, csMemoCol + 1).setValue(newMemo);
    }
    if (updateDateCol >= 0) {
      sheet.getRange(leadRowIndex, updateDateCol + 1).setValue(now);
    }

    return { success: true };
  } catch (e) {
    console.error('archiveLeadToDropped error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 商談一覧を取得（統合シート版：商談段階のリードを取得）
 */
function getDeals() {
  const user = checkPermission(); // 認証のみチェック
  // deal_view_all または deal_view_own のいずれかが必要
  if (!user.permissions.deal_view_all && !user.permissions.deal_view_own) {
    throw new Error('商談閲覧の権限がありません');
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusIdx = headers.indexOf('lead_status');
  const staffIdx = headers.indexOf('担当者');
  const deals = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIdx];

    // 商談段階のみ（アサイン確定、商談中、見積もり提示）
    if (!CONFIG.DEAL_STATUSES.includes(status)) continue;

    // deal_view_own の場合は自分の商談のみ
    if (!user.permissions.deal_view_all && user.permissions.deal_view_own) {
      if (row[staffIdx] !== user.staffName) continue;
    }

    const deal = {};
    headers.forEach((header, index) => {
      let value = row[index];
      // Date オブジェクトは ISO 文字列に変換（google.script.run シリアライズ対策）
      if (value instanceof Date) {
        value = value.toISOString();
      }
      deal[header] = value;
    });
    deals.push(deal);
  }

  return deals;
}

// ========== 管理者設定API ==========

/**
 * 管理者設定を取得
 */
function getAdminSettings() {
  checkPermission('admin_access');
  const props = PropertiesService.getScriptProperties();

  return {
    pmoUrl: props.getProperty('PMO_PROJECT_URL') || '',
    githubUrl: props.getProperty('GITHUB_URL') || '',
    hasPassword: !!props.getProperty('ADMIN_PASSWORD')
  };
}

/**
 * 通知設定を保存
 */
function saveNotificationSettings(settings) {
  checkPermission('admin_access');
  const props = PropertiesService.getScriptProperties();

  if (settings.pmoUrl !== undefined) {
    props.setProperty('PMO_PROJECT_URL', settings.pmoUrl);
  }
  if (settings.githubUrl !== undefined) {
    props.setProperty('GITHUB_URL', settings.githubUrl);
  }

  return { success: true };
}

/**
 * 管理者パスワードを保存
 */
function saveAdminPassword(password) {
  if (!password || password.length < 4) {
    throw new Error('パスワードは4文字以上で設定してください。');
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_PASSWORD', password);

  return { success: true };
}

/**
 * 管理者パスワードを検証
 */
function verifyAdminPassword(password) {
  const props = PropertiesService.getScriptProperties();
  const storedPassword = props.getProperty('ADMIN_PASSWORD');

  // パスワード未設定の場合は検証不要
  if (!storedPassword) {
    return { valid: true, noPassword: true };
  }

  return { valid: password === storedPassword };
}

/**
 * パスワード検証後に設定シートを強制リセット
 */
function forceResetWithPassword(password) {
  checkPermission('force_reset');
  const props = PropertiesService.getScriptProperties();
  const storedPassword = props.getProperty('ADMIN_PASSWORD');

  // パスワードが設定されている場合は検証
  if (storedPassword && password !== storedPassword) {
    return { success: false, message: 'パスワードが正しくありません。' };
  }

  try {
    const ss = getSpreadsheet();
    forceResetSettingsSheet(ss);
    setDataValidations(ss);

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ========== 権限管理API ==========

/**
 * 権限項目の定義を取得
 */
function getPermissionDefinitions() {
  return PERMISSION_DEFINITIONS;
}

/**
 * 役割一覧を取得
 */
function getRoles() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const roles = [];

  for (let i = 1; i < data.length; i++) {
    const role = {
      name: data[i][0],
      permissions: {}
    };

    headers.forEach((header, index) => {
      if (header !== '役割名') {
        role.permissions[header] = data[i][index] === true || data[i][index] === 'TRUE';
      }
    });

    roles.push(role);
  }

  return roles;
}

/**
 * 役割を保存（新規/更新）
 */
function saveRole(roleData) {
  checkPermission('admin_access');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

  if (!sheet) {
    throw new Error('権限設定シートが見つかりません');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();

  // 既存の役割を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === roleData.originalName || data[i][0] === roleData.name) {
      targetRow = i + 1;
      break;
    }
  }

  // 行データを作成
  const rowData = headers.map(header => {
    if (header === '役割名') {
      return roleData.name;
    }
    return roleData.permissions[header] || false;
  });

  if (targetRow > 0) {
    // 更新
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // 新規追加
    sheet.appendRow(rowData);
  }

  return { success: true };
}

/**
 * 役割を削除
 */
function deleteRole(roleName) {
  checkPermission('admin_access');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

  if (!sheet) {
    throw new Error('権限設定シートが見つかりません');
  }

  // オーナー役割は削除不可
  if (roleName === 'オーナー') {
    return { success: false, message: 'オーナー役割は削除できません。' };
  }

  const data = sheet.getDataRange().getValues();

  // 役割を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === roleName) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow < 0) {
    return { success: false, message: '役割が見つかりません。' };
  }

  sheet.deleteRow(targetRow);
  return { success: true };
}

// ========== 担当者管理API ==========

/**
 * 担当者一覧を取得（全員、役割情報含む）
 */
function getStaffWithRoles() {
  checkPermission('staff_manage');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffList = [];

  for (let i = 1; i < data.length; i++) {
    const staff = {};
    headers.forEach((header, index) => {
      staff[header] = data[i][index];
    });
    staffList.push(staff);
  }

  return staffList;
}

/**
 * 役割名一覧を取得（権限設定シートから）
 */
function getRoleNames() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

  if (!sheet || sheet.getLastRow() < 2) {
    // デフォルト役割を返す（オブジェクト形式対応）
    return Object.keys(DEFAULT_ROLES);
  }

  const data = sheet.getDataRange().getValues();
  const roleNames = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      roleNames.push(data[i][0]);
    }
  }

  return roleNames;
}

/**
 * 次の担当者IDを生成
 */
function generateNextStaffId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  let maxNum = 0;

  if (sheet && sheet.getLastRow() >= 2) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('担当者ID');

    if (idIndex !== -1) {
      for (let i = 1; i < data.length; i++) {
        const id = data[i][idIndex];
        if (id && typeof id === 'string' && id.startsWith(CONFIG.STAFF_ID_PREFIX)) {
          const numPart = parseInt(id.replace(CONFIG.STAFF_ID_PREFIX, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return CONFIG.STAFF_ID_PREFIX + String(nextNum).padStart(5, '0');
}

/**
 * 担当者を追加
 */
function addStaff(staffData) {
  checkPermission('staff_manage');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet) {
    return { success: false, message: '担当者マスタシートが見つかりません' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newStaffId = generateNextStaffId();

  // 行データを作成
  const rowData = headers.map(header => {
    if (header === '担当者ID') {
      return newStaffId;
    }
    return staffData[header] || '';
  });

  sheet.appendRow(rowData);

  return { success: true, staffId: newStaffId };
}

/**
 * 担当者を更新
 */
function updateStaff(staffId, staffData) {
  checkPermission('staff_manage');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, message: '担当者マスタシートにデータがありません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('担当者ID');

  if (idIndex === -1) {
    return { success: false, message: '担当者ID列が見つかりません' };
  }

  // 担当者IDで行を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === staffId) {
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: '担当者が見つかりません: ' + staffId };
  }

  // 更新データを適用
  Object.entries(staffData).forEach(([key, value]) => {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1 && key !== '担当者ID') {
      sheet.getRange(targetRow, colIndex + 1).setValue(value);
    }
  });

  return { success: true };
}

/**
 * 担当者を削除
 */
function deleteStaff(staffId) {
  checkPermission('staff_manage');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, message: '担当者マスタシートにデータがありません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('担当者ID');
  const roleIndex = headers.indexOf('役割');

  if (idIndex === -1) {
    return { success: false, message: '担当者ID列が見つかりません' };
  }

  // 担当者IDで行を検索
  let targetRow = -1;
  let targetRole = '';
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === staffId) {
      targetRow = i + 1;
      targetRole = roleIndex !== -1 ? data[i][roleIndex] : '';
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: '担当者が見つかりません: ' + staffId };
  }

  // オーナー役割の担当者は削除不可
  if (targetRole === 'オーナー') {
    return { success: false, message: 'オーナー役割の担当者は削除できません。' };
  }

  sheet.deleteRow(targetRow);
  return { success: true };
}

// ========== 目標管理API ==========

/**
 * 目標一覧取得
 */
function getGoals(staffId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const goals = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // 目標IDが空の行はスキップ

    const goal = {};
    headers.forEach((header, index) => {
      goal[header] = row[index];
    });

    // staffIdが指定されている場合はフィルタ
    if (staffId && goal['assignee_id'] !== staffId) {
      continue;
    }

    goals.push(goal);
  }

  return goals;
}

/**
 * 目標ID自動採番
 */
function generateNextGoalId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet || sheet.getLastRow() <= 1) {
    return 'GOAL-001';
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const match = String(row[0]).match(/GOAL-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return 'GOAL-' + String(maxNum + 1).padStart(3, '0');
}

/**
 * 目標追加
 */
function addGoal(goalData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet) {
    initializeGoalsSheet(ss);
    sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
  }

  // 目標ID自動採番
  const goalId = generateNextGoalId();
  const now = new Date();

  const newRow = [
    goalId,
    goalData.staffId,
    goalData.staffName,
    goalData.periodType,
    goalData.period,
    goalData.dealTarget || 0,
    goalData.wonTarget || 0,
    goalData.rateTarget || 0,
    goalData.salesTarget || 0,
    goalData.memo || '',
    now,
    now
  ];

  sheet.appendRow(newRow);

  return { success: true, goalId: goalId };
}

/**
 * 目標更新
 */
function updateGoal(goalId, goalData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet) {
    return { success: false, message: '目標設定シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === goalId) {
      const rowNum = i + 1;

      // 更新
      if (goalData.dealTarget !== undefined) {
        const colIdx = headers.indexOf('商談数目標');
        if (colIdx !== -1) sheet.getRange(rowNum, colIdx + 1).setValue(goalData.dealTarget);
      }
      if (goalData.wonTarget !== undefined) {
        const colIdx = headers.indexOf('成約数目標');
        if (colIdx !== -1) sheet.getRange(rowNum, colIdx + 1).setValue(goalData.wonTarget);
      }
      if (goalData.rateTarget !== undefined) {
        const colIdx = headers.indexOf('成約率目標');
        if (colIdx !== -1) sheet.getRange(rowNum, colIdx + 1).setValue(goalData.rateTarget);
      }
      if (goalData.salesTarget !== undefined) {
        const colIdx = headers.indexOf('売上目標');
        if (colIdx !== -1) sheet.getRange(rowNum, colIdx + 1).setValue(goalData.salesTarget);
      }
      if (goalData.memo !== undefined) {
        const colIdx = headers.indexOf('メモ');
        if (colIdx !== -1) sheet.getRange(rowNum, colIdx + 1).setValue(goalData.memo);
      }

      // 更新日
      const updateDateIdx = headers.indexOf('更新日');
      if (updateDateIdx !== -1) {
        sheet.getRange(rowNum, updateDateIdx + 1).setValue(new Date());
      }

      return { success: true };
    }
  }

  return { success: false, message: '目標が見つかりません' };
}

/**
 * 目標削除
 */
function deleteGoal(goalId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, message: '目標設定シートにデータがありません' };
  }

  const data = sheet.getDataRange().getValues();

  // 目標IDで行を検索
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === goalId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, message: '目標が見つかりません: ' + goalId };
}

// ========== ユーザー認証API ==========

/**
 * 現在のユーザーの役割を取得
 */
function getCurrentUserRole() {
  const email = resolveCurrentUserEmail();

  if (!email) {
    return { role: null, staffId: null, staffName: null, email: '', error: 'ログインが必要です' };
  }

  // 担当者マスタからメールアドレスで検索
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    return { role: null, staffId: null, staffName: null, error: '担当者マスタが見つかりません' };
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  const roleCol = headers.indexOf('staff_role');
  const idCol = headers.indexOf('staff_id');

  // 新形式（苗字/名前分離）と旧形式（氏名統合）の両方に対応
  const familyNameJaCol = headers.indexOf('last_name_ja');
  const givenNameJaCol = headers.indexOf('first_name_ja');
  const oldNameCol = headers.indexOf('full_name_ja');

  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      // スタッフ名を取得（新形式 → 旧形式の順で試行）
      let staffName = '';
      if (familyNameJaCol >= 0 && givenNameJaCol >= 0) {
        const family = data[i][familyNameJaCol] || '';
        const given = data[i][givenNameJaCol] || '';
        if (family || given) {
          staffName = (family + ' ' + given).trim();
        }
      }
      // 新形式で取得できなかった場合は旧形式を試す
      if (!staffName && oldNameCol >= 0) {
        staffName = data[i][oldNameCol] || '';
      }

      return {
        role: data[i][roleCol],
        staffId: data[i][idCol],
        staffName: staffName,
        email: email
      };
    }
  }

  // 担当者マスタに登録がない場合
  return { role: null, staffId: null, staffName: null, email: email, error: '担当者として登録されていません' };
}

/**
 * 役割に応じた権限を取得
 */
function getPermissionsByRole(role) {
  // 権限設定シートから取得
  const ss = getSpreadsheet();
  const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

  if (!permSheet || permSheet.getLastRow() < 2) {
    // シートがない場合はデフォルト権限を使用
    return DEFAULT_ROLES[role] || {};
  }

  const data = permSheet.getDataRange().getValues();
  const headers = data[0];
  const roleCol = headers.indexOf('役割名');

  for (let i = 1; i < data.length; i++) {
    if (data[i][roleCol] === role) {
      const permissions = {};
      headers.forEach((header, index) => {
        if (header !== '役割名') {
          permissions[header] = data[i][index] === true || data[i][index] === 'TRUE';
        }
      });
      return permissions;
    }
  }

  return {};
}

/**
 * ユーザー情報と権限をまとめて取得
 */
function getCurrentUserWithPermissions() {
  const userInfo = getCurrentUserRole();

  if (userInfo.error || !userInfo.role) {
    return {
      ...userInfo,
      permissions: {},
      isAuthenticated: false
    };
  }

  const permissions = getPermissionsByRole(userInfo.role);

  return {
    ...userInfo,
    permissions: permissions,
    isAuthenticated: true
  };
}

// ========== 権限チェック ==========

/**
 * 権限チェック（各API関数の先頭で呼び出す）
 * @param {string} requiredPermission - 必要な権限キー（省略可）
 * @returns {Object} ユーザー情報
 * @throws {Error} 認証・権限エラー
 */
function checkPermission(requiredPermission) {
  const user = getCurrentUserWithPermissions();

  if (!user.isAuthenticated) {
    throw new Error('認証されていません。担当者マスタに登録されていません。');
  }

  if (requiredPermission && !user.permissions[requiredPermission]) {
    throw new Error(`権限がありません: ${requiredPermission}`);
  }

  return user;
}

// ========== リードKPI API ==========

/**
 * リードKPIを取得（IN/OUT共通）
 * @param {string} leadType - 'インバウンド' or 'アウトバウンド'
 * @returns {Object} { total, todayNew, unassigned, inProgress }
 */
function getLeadsKPI(leadType) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { total: 0, todayNew: 0, unassigned: 0, inProgress: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const typeIdx = headers.indexOf('lead_type');
  const statusIdx = headers.indexOf('lead_status');
  const assignIdx = headers.indexOf('担当者');
  const regDateIdx = headers.indexOf('registered_at');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let total = 0, todayNew = 0, unassigned = 0, inProgress = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[typeIdx];
    const status = row[statusIdx];

    // リード種別フィルタ
    if (type !== leadType) continue;

    // リード段階のみ
    if (!CONFIG.LEAD_STATUSES.includes(status)) continue;

    total++;

    // 今日の新規
    const regDate = row[regDateIdx];
    if (regDate) {
      const regDateObj = new Date(regDate);
      if (regDateObj >= today) todayNew++;
    }

    // 未アサイン
    const assignee = row[assignIdx];
    if (!assignee || assignee === '') unassigned++;

    // 対応中
    if (status === 'リード対応中') inProgress++;
  }

  return { total, todayNew, unassigned, inProgress };
}

// ========== CSダッシュボードAPI ==========

/**
 * CS用KPIメトリクスを取得（統合シート版）
 */
function getCSMetrics() {
  checkPermission('dashboard_cs');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { todayNewLeads: 0, waitingAssign: 0, weekAssigned: 0, totalLeads: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const regDateIdx = headers.indexOf('registered_at');
  const assignIdx = headers.indexOf('担当者');
  const assignDateIdx = headers.indexOf('assigned_at');
  const statusIdx = headers.indexOf('lead_status');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  let todayNewLeads = 0, waitingAssign = 0, weekAssigned = 0, totalLeads = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIdx];

    // リード段階のみカウント
    if (!CONFIG.LEAD_STATUSES.includes(status)) continue;

    totalLeads++;

    // 今日の新規
    const regDate = row[regDateIdx];
    if (regDate) {
      const regDateObj = new Date(regDate);
      if (regDateObj >= today) todayNewLeads++;
    }

    // 担当者未設定
    const assignee = row[assignIdx];
    if (!assignee || assignee === '') waitingAssign++;

    // 今週アサイン
    const assignDate = row[assignDateIdx];
    if (assignDate && assignee) {
      const assignDateObj = new Date(assignDate);
      if (assignDateObj >= weekAgo && assignDateObj <= now) weekAssigned++;
    }
  }

  return { todayNewLeads, waitingAssign, weekAssigned, totalLeads };
}

// ========== 営業ダッシュボードAPI ==========

/**
 * 営業用メトリクスを取得（統合シート版）
 */
function getSalesMetrics(staffId) {
  checkPermission('dashboard_sales');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      totalDeals: 0, wonDeals: 0, lostDeals: 0, pendingDeals: 0,
      winRate: 0, totalSales: 0, todayActions: [],
      lastUpdated: new Date().toLocaleString('ja-JP')
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffCol = headers.indexOf('担当者');
  const statusCol = headers.indexOf('進捗ステータス');
  const amountCol = headers.indexOf('monthly_expected_amount');
  const nextActionCol = headers.indexOf('next_action');
  const nextActionDateCol = headers.indexOf('next_action_date');
  const customerCol = headers.indexOf('customer_name');
  const leadIdCol = headers.indexOf('lead_id');
  const messageUrlCol = headers.indexOf('message_url');

  let totalDeals = 0, wonDeals = 0, lostDeals = 0, pendingDeals = 0, totalSales = 0;
  const todayActions = [];
  const reminderActions = []; // 依存性UI用の拡張リマインダー
  const activeDeals = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];

    // 商談段階以降のみ
    if (!CONFIG.DEAL_STATUSES.includes(status) &&
        status !== CONFIG.PROGRESS_STATUSES.WON &&
        status !== CONFIG.PROGRESS_STATUSES.LOST) continue;

    // staffIdフィルタ
    if (staffId && row[staffCol] !== staffId) continue;

    totalDeals++;

    if (status === CONFIG.PROGRESS_STATUSES.WON) {
      wonDeals++;
      totalSales += Number(row[amountCol]) || 0;
    } else if (status === CONFIG.PROGRESS_STATUSES.LOST || status === CONFIG.PROGRESS_STATUSES.ON_HOLD) {
      lostDeals++;
    } else {
      pendingDeals++;
      // 進行中の案件をactiveDealsに追加
      activeDeals.push({
        leadId: row[leadIdCol] || '',
        customerName: row[customerCol] || '-',
        staffName: row[staffCol] || '-',
        status: status,
        amount: Number(row[amountCol]) || 0,
        nextAction: row[nextActionCol] || '-',
        nextActionDate: row[nextActionDateCol] ? Utilities.formatDate(new Date(row[nextActionDateCol]), 'Asia/Tokyo', 'M/d') : '-',
        messageUrl: row[messageUrlCol] || ''
      });
    }

    // 今日・明日のアクション + 依存性UI用リマインダー
    if (nextActionDateCol >= 0 && row[nextActionDateCol]) {
      // パイプ区切りの特殊値を処理（例: 2026-01-15|waiting_reply）
      const dateValue = String(row[nextActionDateCol]);
      const datePart = dateValue.split('|')[0];
      const typePart = dateValue.includes('|') ? dateValue.split('|')[1] : null;

      const actionDate = new Date(datePart);
      actionDate.setHours(0, 0, 0, 0);

      // 期限超過
      if (actionDate.getTime() < today.getTime()) {
        const daysOverdue = Math.floor((today.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24));
        reminderActions.push({
          leadId: row[leadIdCol] || '',
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: daysOverdue + '日超過',
          priority: 'overdue',
          sortOrder: 0, // 最優先
          daysUntil: -daysOverdue,
          waitingType: typePart
        });
      } else if (actionDate.getTime() === today.getTime()) {
        todayActions.push({
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: '今日',
          priority: 'high'
        });
        reminderActions.push({
          leadId: row[leadIdCol] || '',
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: typePart === 'waiting_reply' ? '返信待ち' : typePart === 'waiting_confirm' ? '確認待ち' : '今日',
          priority: 'today',
          sortOrder: 1,
          daysUntil: 0,
          waitingType: typePart
        });
      } else if (actionDate.getTime() === tomorrow.getTime()) {
        todayActions.push({
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: '明日',
          priority: 'medium'
        });
        reminderActions.push({
          leadId: row[leadIdCol] || '',
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: typePart === 'waiting_reply' ? '返信待ち' : typePart === 'waiting_confirm' ? '確認待ち' : '明日',
          priority: 'tomorrow',
          sortOrder: 2,
          daysUntil: 1,
          waitingType: typePart
        });
      } else if (actionDate.getTime() <= weekLater.getTime()) {
        const daysUntil = Math.floor((actionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        reminderActions.push({
          leadId: row[leadIdCol] || '',
          customer: row[customerCol] || '-',
          action: row[nextActionCol] || '-',
          date: typePart === 'waiting_reply' ? '返信待ち' : typePart === 'waiting_confirm' ? '確認待ち' : daysUntil + '日後',
          priority: typePart ? 'pending' : 'week',
          sortOrder: typePart ? 4 : 3,
          daysUntil: daysUntil,
          waitingType: typePart
        });
      }
    }
  }

  const closedDeals = wonDeals + lostDeals;

  // リマインダーを優先度順にソート
  reminderActions.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.daysUntil - b.daysUntil;
  });

  return {
    totalDeals, wonDeals, lostDeals, pendingDeals,
    winRate: closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0,
    totalSales,
    todayActions: todayActions.slice(0, 5),
    reminderActions: reminderActions.slice(0, 10), // 依存性UI用
    activeDeals: activeDeals.slice(0, 10),
    lastUpdated: new Date().toLocaleString('ja-JP')
  };
}

/**
 * チーム成績を取得（統合シート版）
 */
function getTeamStats() {
  checkPermission('team_stats');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || !staffSheet) {
    return [];
  }

  // 担当者一覧を取得
  const staffData = staffSheet.getDataRange().getValues();
  const staffHeaders = staffData[0];
  const staffIdCol = staffHeaders.indexOf('staff_id');
  const roleCol = staffHeaders.indexOf('staff_role');

  // 新形式と旧形式の両方に対応
  const familyNameJaCol = staffHeaders.indexOf('last_name_ja');
  const givenNameJaCol = staffHeaders.indexOf('first_name_ja');
  const oldNameCol = staffHeaders.indexOf('full_name_ja');

  const staffMap = {};
  for (let i = 1; i < staffData.length; i++) {
    const role = staffData[i][roleCol];
    if (role === '営業' || role === 'リーダー' || role === 'オーナー') {
      const staffId = staffData[i][staffIdCol];

      // スタッフ名を取得（新形式 → 旧形式）
      let staffName = '';
      if (familyNameJaCol >= 0 && givenNameJaCol >= 0) {
        const family = staffData[i][familyNameJaCol] || '';
        const given = staffData[i][givenNameJaCol] || '';
        if (family || given) {
          staffName = (family + ' ' + given).trim();
        }
      }
      if (!staffName && oldNameCol >= 0) {
        staffName = staffData[i][oldNameCol] || '';
      }

      if (staffId && staffName) {
        staffMap[staffName] = { staffId, name: staffName, deals: 0, won: 0, sales: 0 };
      }
    }
  }

  // リードデータを集計（商談段階以降）
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dStaffCol = headers.indexOf('担当者');
  const dStatusCol = headers.indexOf('進捗ステータス');
  const dAmountCol = headers.indexOf('monthly_expected_amount');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[dStatusCol];
    const staffName = row[dStaffCol];

    // 商談段階以降のみ
    if (!CONFIG.DEAL_STATUSES.includes(status) &&
        status !== CONFIG.PROGRESS_STATUSES.WON &&
        status !== CONFIG.PROGRESS_STATUSES.LOST) continue;

    if (staffMap[staffName]) {
      staffMap[staffName].deals++;
      if (status === CONFIG.PROGRESS_STATUSES.WON) {
        staffMap[staffName].won++;
        staffMap[staffName].sales += Number(row[dAmountCol]) || 0;
      }
    }
  }

  // 配列に変換してソート（売上順）
  const result = Object.values(staffMap).map(data => ({
    staffId: data.staffId,
    name: data.name,
    deals: data.deals,
    won: data.won,
    winRate: data.deals > 0 ? Math.round((data.won / data.deals) * 100) : 0,
    sales: data.sales
  }));

  result.sort((a, b) => b.sales - a.sales);

  return result;
}

// ========== リーダーダッシュボードAPI ==========

/**
 * リーダー用メトリクスを取得（統合シート版）
 */
function getLeaderMetrics() {
  checkPermission('dashboard_leader');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      cs: { totalLeads: 0, todayNewLeads: 0, waitingAssign: 0 },
      sales: { totalDeals: 0, wonDeals: 0, lostDeals: 0, pendingDeals: 0, winRate: 0, totalSales: 0 },
      salesRanking: [],
      lastUpdated: new Date().toLocaleString('ja-JP')
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const regDateIdx = headers.indexOf('registered_at');
  const assignIdx = headers.indexOf('担当者');
  const statusIdx = headers.indexOf('lead_status');
  const amountIdx = headers.indexOf('monthly_expected_amount');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // CS部門
  let totalLeads = 0, todayNewLeads = 0, waitingAssign = 0;
  // 営業部門
  let totalDeals = 0, wonDeals = 0, lostDeals = 0, pendingDeals = 0, totalSales = 0;
  // スタッフ別集計
  const staffMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIdx];
    const assignee = row[assignIdx];

    // CS部門集計（リード段階）
    if (CONFIG.LEAD_STATUSES.includes(status)) {
      totalLeads++;

      const regDate = row[regDateIdx];
      if (regDate) {
        const regDateObj = new Date(regDate);
        if (regDateObj >= today) todayNewLeads++;
      }

      if (!assignee || assignee === '') waitingAssign++;
    }

    // 営業部門集計（商談段階以降）
    if (CONFIG.DEAL_STATUSES.includes(status) ||
        status === CONFIG.PROGRESS_STATUSES.WON ||
        status === CONFIG.PROGRESS_STATUSES.LOST) {
      totalDeals++;

      if (status === CONFIG.PROGRESS_STATUSES.WON) {
        wonDeals++;
        totalSales += Number(row[amountIdx]) || 0;
      } else if (status === CONFIG.PROGRESS_STATUSES.LOST || status === CONFIG.PROGRESS_STATUSES.ON_HOLD) {
        lostDeals++;
      } else {
        pendingDeals++;
      }

      // スタッフ別
      if (assignee) {
        if (!staffMap[assignee]) {
          staffMap[assignee] = { name: assignee, deals: 0, won: 0, sales: 0 };
        }
        staffMap[assignee].deals++;
        if (status === CONFIG.PROGRESS_STATUSES.WON) {
          staffMap[assignee].won++;
          staffMap[assignee].sales += Number(row[amountIdx]) || 0;
        }
      }
    }
  }

  const closedDeals = wonDeals + lostDeals;
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

  // ランキング作成
  const salesRanking = Object.values(staffMap).map(s => ({
    name: s.name,
    deals: s.deals,
    won: s.won,
    winRate: s.deals > 0 ? Math.round((s.won / s.deals) * 100) : 0,
    sales: s.sales
  }));
  salesRanking.sort((a, b) => b.sales - a.sales);

  return {
    cs: { totalLeads, todayNewLeads, waitingAssign },
    sales: { totalDeals, wonDeals, lostDeals, pendingDeals, winRate, totalSales },
    salesRanking: salesRanking.slice(0, 5),
    lastUpdated: new Date().toLocaleString('ja-JP')
  };
}

// ========== Buddy API ==========

/**
 * Buddyデータを取得（統合シート版）
 */
function getBuddyData(staffName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  // 時間帯に応じた挨拶
  const hour = new Date().getHours();
  let greeting = '';
  if (hour < 12) {
    greeting = 'おはよう、' + staffName + 'さん。今日もよろしく。';
  } else if (hour < 18) {
    greeting = 'お疲れさま、' + staffName + 'さん。調子はどう？';
  } else {
    greeting = 'こんばんは、' + staffName + 'さん。今日も頑張ったね。';
  }

  const todayActions = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const staffCol = headers.indexOf('担当者');
    const customerCol = headers.indexOf('customer_name');
    const nextActionCol = headers.indexOf('next_action');
    const nextActionDateCol = headers.indexOf('next_action_date');
    const statusCol = headers.indexOf('進捗ステータス');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[staffCol] !== staffName) continue;
      // 商談段階のみ
      if (!CONFIG.DEAL_STATUSES.includes(row[statusCol])) continue;

      if (nextActionDateCol >= 0 && row[nextActionDateCol]) {
        const actionDate = new Date(row[nextActionDateCol]);
        actionDate.setHours(0, 0, 0, 0);

        if (actionDate.getTime() === today.getTime()) {
          todayActions.push({
            customer: row[customerCol] || '-',
            action: row[nextActionCol] || '-',
            urgent: true
          });
        } else if (actionDate.getTime() < today.getTime()) {
          todayActions.push({
            customer: row[customerCol] || '-',
            action: row[nextActionCol] || '（期限超過）',
            urgent: true
          });
        }
      }
    }
  }

  if (todayActions.length > 0) {
    greeting += '\n\n今日のアクションが' + todayActions.length + '件あるよ。一緒に確認しよう。';
  } else {
    greeting += '\n\n何か相談したいことがあれば、いつでも話してね。';
  }

  return { greeting, todayActions };
}

/**
 * Buddyの応答を取得（Gemini API使用、フォールバックあり）
 */
function getBuddyResponse(userMessage, staffName) {
  const props = PropertiesService.getScriptProperties();
  const geminiApiKey = props.getProperty('GEMINI_API_KEY');

  // Gemini APIキーが設定されていない場合はフォールバック
  if (!geminiApiKey) {
    return getBuddyFallbackResponse(userMessage);
  }

  try {
    const systemPrompt = `あなたは「Buddy」という営業コーチAIです。

【キャラクター】
- 頼れる先輩、パートナー
- フレンドリーだがプロフェッショナル
- 包容力があり、聞き上手
- 一人称は「僕」

【絶対ルール】
- 事実（データ）に基づいた発言のみ行う
- 予測や主観的評価は禁止
- 質問を中心に相手に考えさせる
- 答えを教えず、気づきを促す
- 共感は許可（「大変だったね」「お疲れさま」等）
- 「さすが」「すごい」「頑張って」は使わない

【コミュニケーションスタイル】
- 聞いてから話す
- 押し付けない（「〜してみたら？」「〜はどう？」）
- 具体的なアドバイス
- 「一緒に」の姿勢

担当者名: ${staffName || '不明'}

ユーザーの発言に対し、2-3文で簡潔に返答してください。`;

    const response = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiApiKey,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nユーザー: ' + userMessage }] }
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7
          }
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      return result.candidates[0].content.parts[0].text;
    }

    return getBuddyFallbackResponse(userMessage);
  } catch (error) {
    console.error('Gemini API error:', error);
    return getBuddyFallbackResponse(userMessage);
  }
}

/**
 * Buddyのフォールバック応答
 */
function getBuddyFallbackResponse(userMessage) {
  const message = userMessage.toLowerCase();

  if (message.includes('困') || message.includes('うまくいかない') || message.includes('難しい')) {
    return '大変な状況なんだね。もう少し詳しく聞かせてもらえる？一緒に考えよう。';
  }

  if (message.includes('成約') || message.includes('決まった') || message.includes('成功')) {
    return 'それは良かったね！何が良かったと思う？次に活かせるポイントを振り返ってみよう。';
  }

  if (message.includes('相談') || message.includes('アドバイス')) {
    return 'なるほど。どんなことで悩んでいる？具体的に教えてもらえると、一緒に考えやすいよ。';
  }

  return 'うん、聞いてるよ。もう少し詳しく聞かせて。';
}

// ========== 商談レポートAPI ==========

/**
 * 商談レポートを保存
 */
function saveDealReport(reportData) {
  const ss = getSpreadsheet();

  // 商談レポートシートを取得（または作成）- LockService使用（TROUBLE-018対応）
  let reportSheet = ss.getSheetByName('商談レポート');
  if (!reportSheet) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      // ロック取得後に再確認
      reportSheet = ss.getSheetByName('商談レポート');
      if (!reportSheet) {
        reportSheet = ss.insertSheet('商談レポート');
        reportSheet.appendRow([
          'レポートID', '担当者ID', '担当者名', '商談ID', '顧客名',
          '商談日', '手応え', '良かった点', '改善したい点', '次のアクション',
          'Buddyフォロー', '作成日時'
        ]);
      }
    } finally {
      lock.releaseLock();
    }
  }

  // 顧客名を取得
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  let customerName = '-';
  if (leadSheet && leadSheet.getLastRow() > 1) {
    const leadData = leadSheet.getDataRange().getValues();
    const headers = leadData[0];
    const idCol = headers.indexOf('lead_id');
    const nameCol = headers.indexOf('customer_name');

    for (let i = 1; i < leadData.length; i++) {
      if (leadData[i][idCol] === reportData.dealId) {
        customerName = leadData[i][nameCol] || '-';
        break;
      }
    }
  }

  // レポートID生成
  const reportId = 'RPT-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');

  // Buddyフォローを生成
  let buddyFollow = '';
  if (reportData.improvements && reportData.improvements.trim()) {
    buddyFollow = getBuddyReportFollow(reportData.improvements);
  }

  // 保存
  reportSheet.appendRow([
    reportId,
    reportData.staffId,
    reportData.staffName,
    reportData.dealId,
    customerName,
    reportData.date,
    reportData.feeling,
    reportData.goodPoints,
    reportData.improvements,
    reportData.nextAction,
    buddyFollow,
    new Date()
  ]);

  return {
    success: true,
    reportId: reportId,
    buddyFollow: buddyFollow
  };
}

/**
 * レポートに対するBuddyフォローを生成
 */
function getBuddyReportFollow(improvements) {
  const props = PropertiesService.getScriptProperties();
  const geminiApiKey = props.getProperty('GEMINI_API_KEY');

  if (!geminiApiKey) {
    return '商談レポートありがとう。改善したい点について、次回どう対応するか考えてみよう。';
  }

  try {
    const prompt = `あなたは営業コーチのBuddyです。
担当者が商談レポートで「改善したい点」として以下を書きました。

「${improvements}」

この内容に対して、リフレクティング（内容を反映）と質問で返答してください。
- 2文以内で簡潔に
- 押し付けない
- 「さすが」「頑張って」は使わない`;

    const response = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiApiKey,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.7 }
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      return result.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    console.error('Gemini API error:', error);
  }

  return '商談レポートありがとう。改善したい点について、次回どう対応するか考えてみよう。';
}

// ========== ログイン/ログアウト記録API ==========

/**
 * ログインを記録
 */
function recordLogin(staffId) {
  const ss = getSpreadsheet();

  // ログイン履歴シートを取得（または作成）- LockService使用（TROUBLE-018対応）
  let logSheet = ss.getSheetByName('ログイン履歴');
  if (!logSheet) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      logSheet = ss.getSheetByName('ログイン履歴');
      if (!logSheet) {
        logSheet = ss.insertSheet('ログイン履歴');
        logSheet.appendRow([
          'ログID', '担当者ID', 'ログイン日時', 'ログアウト日時', '稼働時間（分）', '最終ハートビート'
        ]);
      }
    } finally {
      lock.releaseLock();
    }
  }

  const logId = 'LLOG-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  const now = new Date();

  logSheet.appendRow([
    logId,
    staffId,
    now,
    '', // ログアウト日時は後で記録
    '',
    now
  ]);

  return { success: true, logId: logId };
}

/**
 * ハートビートを記録
 */
function recordHeartbeat(staffId) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('ログイン履歴');

  if (!logSheet || logSheet.getLastRow() < 2) return;

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdCol = headers.indexOf('担当者ID');
  const logoutCol = headers.indexOf('ログアウト日時');
  const heartbeatCol = headers.indexOf('最終ハートビート');

  // 最新のログインレコードを検索（ログアウト日時が空のもの）
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][staffIdCol] === staffId && !data[i][logoutCol]) {
      logSheet.getRange(i + 1, heartbeatCol + 1).setValue(new Date());
      return;
    }
  }
}

/**
 * 非アクティブユーザーをチェック（時間主導トリガーで実行）
 */
function checkInactiveUsers() {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('ログイン履歴');

  if (!logSheet || logSheet.getLastRow() < 2) return;

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const logoutCol = headers.indexOf('ログアウト日時');
  const heartbeatCol = headers.indexOf('最終ハートビート');
  const loginCol = headers.indexOf('ログイン日時');
  const workTimeCol = headers.indexOf('稼働時間（分）');

  const now = new Date();
  const threshold = 30 * 60 * 1000; // 30分

  for (let i = 1; i < data.length; i++) {
    // ログアウト日時が空のレコード
    if (!data[i][logoutCol]) {
      const lastHeartbeat = new Date(data[i][heartbeatCol]);
      const elapsed = now.getTime() - lastHeartbeat.getTime();

      // 30分以上非アクティブ
      if (elapsed > threshold) {
        const loginTime = new Date(data[i][loginCol]);
        const workMinutes = Math.round((lastHeartbeat.getTime() - loginTime.getTime()) / (1000 * 60));

        logSheet.getRange(i + 1, logoutCol + 1).setValue(lastHeartbeat);
        logSheet.getRange(i + 1, workTimeCol + 1).setValue(workMinutes);
      }
    }
  }
}

// ========== アラート機能 ==========

/**
 * ネクストアクション未設定/期限超過をチェック（統合シート版）
 */
function checkNextActionAlerts() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) return { noNextAction: [], overdue: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('lead_id');
  const customerCol = headers.indexOf('customer_name');
  const staffCol = headers.indexOf('担当者');
  const nextActionDateCol = headers.indexOf('next_action_date');
  const statusCol = headers.indexOf('進捗ステータス');

  const alerts = { noNextAction: [], overdue: [] };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];

    // 商談段階のみチェック
    if (!CONFIG.DEAL_STATUSES.includes(status)) continue;

    const nextActionDate = row[nextActionDateCol];

    if (!nextActionDate) {
      alerts.noNextAction.push({
        dealId: row[idCol],
        customer: row[customerCol],
        staff: row[staffCol]
      });
    } else {
      const actionDate = new Date(nextActionDate);
      actionDate.setHours(0, 0, 0, 0);

      if (actionDate < twoDaysAgo) {
        const daysOverdue = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
        alerts.overdue.push({
          dealId: row[idCol],
          customer: row[customerCol],
          staff: row[staffCol],
          daysOverdue
        });
      }
    }
  }

  return alerts;
}

/**
 * 滞留案件をチェック（統合シート版）
 */
function checkStagnantDeals(days) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('lead_id');
  const customerCol = headers.indexOf('customer_name');
  const staffCol = headers.indexOf('担当者');
  const statusCol = headers.indexOf('進捗ステータス');
  const updateCol = headers.indexOf('sheet_updated_at');

  const stagnantDeals = [];
  const today = new Date();
  const threshold = days * 24 * 60 * 60 * 1000;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];

    // 商談段階のみチェック
    if (!CONFIG.DEAL_STATUSES.includes(status)) continue;

    const updateDate = row[updateCol];
    if (updateDate) {
      const elapsed = today.getTime() - new Date(updateDate).getTime();
      if (elapsed > threshold) {
        const daysStagnant = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        stagnantDeals.push({
          dealId: row[idCol],
          customer: row[customerCol],
          staff: row[staffCol],
          status,
          daysStagnant
        });
      }
    }
  }

  return stagnantDeals;
}

/**
 * 日次アラートバッチ（毎日9時に実行）
 */
function dailyAlertBatch() {
  const nextActionAlerts = checkNextActionAlerts();
  const stagnantAlerts = checkStagnantDeals(7);

  // Discord通知
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('DISCORD_ALERT_WEBHOOK') || props.getProperty('PMO_DISCORD_WEBHOOK');

  if (!webhookUrl) return;

  let message = '';

  // ネクストアクション未設定
  if (nextActionAlerts.noNextAction.length > 0) {
    message += '**⚠️ ネクストアクション未設定: ' + nextActionAlerts.noNextAction.length + '件**\n';
    nextActionAlerts.noNextAction.slice(0, 5).forEach(a => {
      message += '・' + a.customer + '（担当: ' + a.staff + '）\n';
    });
    message += '\n';
  }

  // 期限超過
  if (nextActionAlerts.overdue.length > 0) {
    message += '**⏰ 期限超過: ' + nextActionAlerts.overdue.length + '件**\n';
    nextActionAlerts.overdue.slice(0, 5).forEach(a => {
      message += '・' + a.customer + '（担当: ' + a.staff + '）' + a.daysOverdue + '日経過\n';
    });
    message += '\n';
  }

  // 滞留案件
  if (stagnantAlerts.length > 0) {
    message += '**📋 滞留案件（7日以上）: ' + stagnantAlerts.length + '件**\n';
    stagnantAlerts.slice(0, 5).forEach(a => {
      message += '・' + a.customer + '（' + a.status + '）' + a.daysStagnant + '日経過\n';
    });
  }

  if (message) {
    sendDiscordNotification(webhookUrl, '【CRM日次アラート】\n\n' + message);
  }
}

/**
 * Discord通知を送信
 */
function sendDiscordNotification(webhookUrl, message) {
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ content: message }),
      muteHttpExceptions: true
    });
  } catch (error) {
    console.error('Discord通知エラー:', error);
  }
}

// ========== 離脱リード・重複検知API ==========

/**
 * リードの重複をチェック
 * @param {Object} params - { email, messageUrl, customerName, source }
 * @returns {Object} 重複情報
 */
function checkLeadDuplicate(params) {
  const email = params.email || '';
  const messageUrl = params.messageUrl || '';
  const customerName = params.customerName || '';
  const source = params.source || '';

  return checkDuplicateLead(email, messageUrl, customerName, source);
}

/**
 * リードを離脱リードとしてアーカイブ
 * @param {Object} params - { leadId, dropReason, csMemo }
 * @returns {Object} { success: boolean, message: string }
 */
function archiveDroppedLead(params) {
  const leadId = params.leadId;
  const dropReason = params.dropReason;
  const csMemo = params.csMemo;

  // バリデーションエラーはそのままthrow（archiveToDroppedLeadで処理）
  return archiveToDroppedLead(leadId, dropReason, csMemo);
}

/**
 * 離脱理由の選択肢を取得
 * @returns {Array} 離脱理由リスト
 */
function getDropReasons() {
  return CONFIG.DROP_REASONS || ['無返信', '価格NG', '対象外', '競合流出', 'その他'];
}

/**
 * アーカイブ済みリード一覧を取得
 * （リード管理シート内で進捗ステータスが「アーカイブ」のリード）
 * @returns {Array} アーカイブ済みリードリスト
 */
function getArchivedLeads() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('進捗ステータス');
  const leads = [];

  for (let i = 1; i < data.length; i++) {
    const status = data[i][statusCol];
    // 進捗ステータスが「アーカイブ」のリードのみ
    if (status !== 'アーカイブ') continue;

    const lead = {};
    headers.forEach((header, index) => {
      let value = data[i][index];
      // Date オブジェクトは ISO 文字列に変換
      if (value instanceof Date) {
        value = value.toISOString();
      }
      lead[header] = value;
    });
    leads.push(lead);
  }

  return leads;
}

/**
 * アーカイブからリードを復元（アーカイブ情報をクリア）
 * @param {string} leadId - リードID
 * @param {string} newStatus - 復元後のステータス（デフォルト: 追客）
 * @returns {Object} {success: boolean, error?: string}
 */
function restoreLeadFromArchive(leadId, newStatus) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet) {
      return { success: false, error: 'シートが見つかりません' };
    }

    // リードデータを取得
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('lead_id');
    const archiveDateCol = headers.indexOf('archived_at');
    const archiveReasonCol = headers.indexOf('archive_reason');
    const leadStaffCol = headers.indexOf('lead_assignee_name'); // 追加
    const staffIdCol = headers.indexOf('assignee_id'); // 追加
    const assignDateCol = headers.indexOf('assigned_at'); // 追加
    const updateDateCol = headers.indexOf('sheet_updated_at');

    let leadRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === leadId) {
        leadRowIndex = i + 1;
        break;
      }
    }

    if (leadRowIndex === -1) {
      return { success: false, error: 'リードが見つかりません' };
    }

    const now = new Date();

    Logger.log('📍 復元処理開始: leadRowIndex=' + leadRowIndex);
    Logger.log('📍 列インデックス: archiveDateCol=' + archiveDateCol + ', archiveReasonCol=' + archiveReasonCol);
    Logger.log('📍 列インデックス: leadStaffCol=' + leadStaffCol + ', staffIdCol=' + staffIdCol + ', assignDateCol=' + assignDateCol);

    // アーカイブ情報をクリアし、リードステータスを復元
    try {
      if (archiveDateCol >= 0) {
        Logger.log('🔄 Clearing archiveDate at row=' + leadRowIndex + ', col=' + (archiveDateCol + 1));
        sheet.getRange(leadRowIndex, archiveDateCol + 1).clearContent();
      }
      if (archiveReasonCol >= 0) {
        Logger.log('🔄 Clearing archiveReason at row=' + leadRowIndex + ', col=' + (archiveReasonCol + 1));
        sheet.getRange(leadRowIndex, archiveReasonCol + 1).clearContent();
      }
      const leadStatusCol = headers.indexOf('lead_status');
      if (leadStatusCol >= 0) {
        Logger.log('🔄 Setting leadStatus to "リード対応中" at row=' + leadRowIndex + ', col=' + (leadStatusCol + 1));
        sheet.getRange(leadRowIndex, leadStatusCol + 1).setValue('リード対応中');
        Logger.log('✅ leadStatus updated successfully');
      }
      // リード担当者をクリア（新規状態に戻すため）
      if (leadStaffCol >= 0) {
        Logger.log('🔄 Clearing leadStaff at row=' + leadRowIndex + ', col=' + (leadStaffCol + 1));
        sheet.getRange(leadRowIndex, leadStaffCol + 1).clearContent();
      }
      if (staffIdCol >= 0) {
        Logger.log('🔄 Clearing staffId at row=' + leadRowIndex + ', col=' + (staffIdCol + 1));
        sheet.getRange(leadRowIndex, staffIdCol + 1).clearContent();
      }
      if (assignDateCol >= 0) {
        Logger.log('🔄 Clearing assignDate at row=' + leadRowIndex + ', col=' + (assignDateCol + 1));
        sheet.getRange(leadRowIndex, assignDateCol + 1).clearContent();
      }
      if (updateDateCol >= 0) {
        Logger.log('🔄 Setting updateDate at row=' + leadRowIndex + ', col=' + (updateDateCol + 1));
        sheet.getRange(leadRowIndex, updateDateCol + 1).setValue(now);
      }
    } catch (error) {
      Logger.log('❌ Error during cell update: ' + error.message);
      throw error;
    }

    Logger.log('✅ リードをアーカイブから復元: ' + leadId + ' → リードステータス: リード対応中, リード担当者: クリア');
    return { success: true };
  } catch (e) {
    console.error('restoreLeadFromArchive error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * リードのCSメモを取得
 * @param {string} leadId - リードID
 * @returns {string} CSメモ
 */
function getLeadCsMemo(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return '';
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('lead_id');
  const csMemoIdx = headers.indexOf('cs_note');

  if (leadIdIdx === -1 || csMemoIdx === -1) {
    return '';
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      return data[i][csMemoIdx] || '';
    }
  }

  return '';
}

// ========== デバッグ関数 ==========
/**
 * リードページのデータ取得をテスト
 * GASエディタから直接実行してログを確認
 */
function debugLeadsPage() {
  Logger.log('===== debugLeadsPage START =====');

  // シート確認
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  Logger.log('シート名: ' + CONFIG.SHEETS.LEADS);
  Logger.log('シート存在: ' + (sheet ? 'あり' : 'なし'));

  if (!sheet) {
    Logger.log('ERROR: シートが見つかりません');
    return;
  }

  const lastRow = sheet.getLastRow();
  Logger.log('lastRow: ' + lastRow);

  if (lastRow < 2) {
    Logger.log('ERROR: データ行がありません');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  Logger.log('ヘッダー: ' + headers.join(', '));

  const typeIdx = headers.indexOf('lead_type');
  const statusIdx = headers.indexOf('lead_status');
  Logger.log('リード種別の列インデックス: ' + typeIdx);
  Logger.log('進捗ステータスの列インデックス: ' + statusIdx);
  Logger.log('CONFIG.LEAD_STATUSES: ' + JSON.stringify(CONFIG.LEAD_STATUSES));

  // 期待される値の文字コード
  const expectedType = 'インバウンド';
  const expectedTypeChars = expectedType.split('').map(c => c.charCodeAt(0)).join(',');
  Logger.log('期待値 "' + expectedType + '" の文字コード: [' + expectedTypeChars + ']');

  // 最初の5行のデータを表示
  Logger.log('--- 最初の5行のデータ ---');
  for (let i = 1; i < Math.min(6, data.length); i++) {
    const row = data[i];
    const actualType = row[typeIdx] ? row[typeIdx].toString() : '';
    const actualStatus = row[statusIdx] ? row[statusIdx].toString() : '';
    const typeMatch = (actualType === expectedType);

    Logger.log('Row ' + i + ': リード種別="' + actualType + '", 進捗ステータス="' + actualStatus + '"');
    Logger.log('  リード種別一致=' + typeMatch + ', ステータス含む=' + CONFIG.LEAD_STATUSES.includes(actualStatus));

    if (actualType && !typeMatch) {
      const actualChars = actualType.split('').map(c => c.charCodeAt(0)).join(',');
      Logger.log('  文字コード比較: actual=[' + actualChars + '] expected=[' + expectedTypeChars + ']');
    }
  }

  // getLeadsを呼び出し
  Logger.log('--- getLeads("lead", "インバウンド") 呼び出し ---');
  try {
    const result = getLeads('lead', 'インバウンド');
    Logger.log('結果: ' + result.length + '件');
    if (result.length > 0) {
      Logger.log('最初のリード: ' + JSON.stringify(result[0]));
    } else {
      Logger.log('データが0件です - フィルタ条件を確認してください');
    }
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }

  Logger.log('===== debugLeadsPage END =====');
}

/**
 * フィルタなしで全リードを取得（デバッグ用）
 * クライアントから呼び出し可能
 */
function getAllLeadsNoFilter() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { error: 'シートが見つからないかデータがありません', leads: [] };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const typeIdx = headers.indexOf('lead_type');
  const statusIdx = headers.indexOf('lead_status');

  const leads = [];
  const stats = { total: 0, inbound: 0, outbound: 0, newStatus: 0, inProgressStatus: 0, other: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[typeIdx] ? row[typeIdx].toString() : '';
    const status = row[statusIdx] ? row[statusIdx].toString() : '';

    stats.total++;
    if (type === 'インバウンド') stats.inbound++;
    else if (type === 'アウトバウンド') stats.outbound++;
    if (status === '新規') stats.newStatus++;
    else if (status === '対応中') stats.inProgressStatus++;
    else stats.other++;

    // 最初の5件だけ詳細を返す
    if (leads.length < 5) {
      leads.push({
        row: i + 1,
        リード種別: type,
        リード種別_length: type.length,
        進捗ステータス: status,
        進捗ステータス_length: status.length
      });
    }
  }

  return {
    stats: stats,
    sampleLeads: leads,
    headerIndexes: { typeIdx: typeIdx, statusIdx: statusIdx },
    expectedValues: {
      インバウンド_length: 'インバウンド'.length,
      新規_length: '新規'.length,
      対応中_length: '対応中'.length
    }
  };
}

/**
 * getLeadsの動作テスト（フロントエンドから呼び出し可能）
 */
function testGetLeads() {
  console.log('testGetLeads START');
  try {
    const result = getLeads('lead', 'インバウンド');
    console.log('testGetLeads: result type=' + typeof result);
    console.log('testGetLeads: is array=' + Array.isArray(result));
    console.log('testGetLeads: length=' + (result ? result.length : 'null'));

    return {
      success: true,
      type: typeof result,
      isArray: Array.isArray(result),
      length: result ? result.length : 0,
      sample: result && result.length > 0 ? result[0] : null
    };
  } catch (e) {
    console.log('testGetLeads ERROR: ' + e.message);
    return {
      success: false,
      error: e.message,
      stack: e.stack
    };
  }
}

/**
 * 診断用: シンプルな配列を返すテスト
 * google.script.runの通信を確認
 */
function diagnosticSimpleArray() {
  return ['test1', 'test2', 'test3'];
}

/**
 * 診断用: シート構造を確認（GASエディタから実行）
 */
function diagnoseSheetsStructure() {
  const ss = getSpreadsheet();
  Logger.log('=== シート構造診断 ===');
  Logger.log('スプレッドシート名: ' + ss.getName());
  Logger.log('スプレッドシートID: ' + ss.getId());

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) {
    Logger.log('ERROR: リード管理シートが見つかりません');
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  Logger.log('リード管理シート: 行数=' + lastRow + ', 列数=' + lastCol);

  // ヘッダー取得
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log('ヘッダー数: ' + headers.length);
  Logger.log('期待する列数: 60');

  // 重要な列のインデックス確認
  const checkColumns = ['lead_id', 'lead_type', '進捗ステータス', 'customer_name', '担当者'];
  checkColumns.forEach(col => {
    const idx = headers.indexOf(col);
    Logger.log('  ' + col + ': index=' + idx + (idx === -1 ? ' *** NOT FOUND ***' : ''));
  });

  // 列数の差分
  if (headers.length !== 60) {
    Logger.log('*** 警告: 列数が60ではありません ***');
    Logger.log('不足/余剰列数: ' + (headers.length - 60));
  }

  // データ行の確認
  if (lastRow >= 2) {
    const firstDataRow = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
    const typeIdx = headers.indexOf('lead_type');
    const statusIdx = headers.indexOf('lead_status');
    Logger.log('最初のデータ行:');
    Logger.log('  リード種別: "' + (typeIdx >= 0 ? firstDataRow[typeIdx] : 'N/A') + '"');
    Logger.log('  進捗ステータス: "' + (statusIdx >= 0 ? firstDataRow[statusIdx] : 'N/A') + '"');
  }

  Logger.log('=== 診断完了 ===');
}

/**
 * 診断用: 全ヘッダーを列番号付きで出力
 */
function diagnoseAllHeaders() {
  const ss = getSpreadsheet();
  Logger.log('=== 全ヘッダー診断 ===');
  Logger.log('スプレッドシート名: ' + ss.getName());

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) {
    Logger.log('ERROR: リード管理シートが見つかりません');
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log('総列数: ' + lastCol);
  Logger.log('');
  Logger.log('列番号 | 列文字 | ヘッダー名');
  Logger.log('-------|--------|------------');

  for (let i = 0; i < headers.length; i++) {
    const colNum = i + 1;
    const colLetter = getColumnLetter(colNum);
    const header = headers[i] || '(空)';
    Logger.log(colNum.toString().padStart(2, ' ') + '     | ' + colLetter.padEnd(6, ' ') + ' | ' + header);
  }

  // 重複チェック
  Logger.log('');
  Logger.log('=== 重複ヘッダーチェック ===');
  const headerCount = {};
  headers.forEach((h, idx) => {
    if (h) {
      if (!headerCount[h]) headerCount[h] = [];
      headerCount[h].push(idx + 1);
    }
  });

  let hasDuplicate = false;
  Object.keys(headerCount).forEach(h => {
    if (headerCount[h].length > 1) {
      hasDuplicate = true;
      Logger.log('重複: "' + h + '" → 列 ' + headerCount[h].join(', '));
    }
  });

  if (!hasDuplicate) {
    Logger.log('重複なし');
  }

  Logger.log('=== 診断完了 ===');
}

/**
 * 列番号から列文字を取得（A, B, ... Z, AA, AB...）
 */
function getColumnLetter(colNum) {
  let letter = '';
  while (colNum > 0) {
    const mod = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}

/**
 * 診断用: getLeadsの各ステップを検証
 */
function diagnosticGetLeadsSteps() {
  const results = {
    step1_start: true,
    step2_permission: null,
    step3_spreadsheet: null,
    step4_sheet: null,
    step5_data: null,
    step6_result: null,
    error: null
  };

  try {
    // Step 2: 権限チェック
    try {
      const user = getCurrentUserWithPermissions();
      results.step2_permission = {
        isAuthenticated: user.isAuthenticated,
        hasPermission: user.permissions && user.permissions.lead_view,
        email: user.email,
        role: user.role
      };
    } catch (e) {
      results.step2_permission = { error: e.message };
    }

    // Step 3: スプレッドシート取得
    const ss = getSpreadsheet();
    results.step3_spreadsheet = ss ? 'OK' : 'FAILED';

    if (!ss) return results;

    // Step 4: シート取得
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    results.step4_sheet = sheet ? 'OK (' + sheet.getLastRow() + ' rows)' : 'FAILED';

    if (!sheet) return results;

    // Step 5: データ取得（最初の行のみ）
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const firstRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
      results.step5_data = {
        headerCount: headers.length,
        sampleHeaders: headers.slice(0, 5),
        typeIdx: headers.indexOf('lead_type'),
        statusIdx: headers.indexOf('進捗ステータス'),
        firstRowType: firstRow[headers.indexOf('lead_type')],
        firstRowStatus: firstRow[headers.indexOf('進捗ステータス')]
      };
    } else {
      results.step5_data = 'NO_DATA';
    }

    // Step 6: getLeads実行
    const leads = getLeads('lead', 'インバウンド');
    results.step6_result = {
      type: typeof leads,
      isArray: Array.isArray(leads),
      length: leads ? leads.length : 0
    };

  } catch (e) {
    results.error = e.message + ' | ' + e.stack;
  }

  return results;
}

/**
 * 緊急診断用: getLeadsの動作確認
 * GASエディタから実行してログを確認
 */
function debugGetLeads() {
  console.log('=== getLeads診断開始 ===');

  const startTime = new Date();

  try {
    const ss = getSpreadsheet();
    if (!ss) {
      console.log('ERROR: スプレッドシートが取得できません');
      return;
    }

    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (!sheet) {
      console.log('ERROR: リード管理シートが見つかりません');
      return;
    }

    console.log('シート取得完了: ' + (new Date() - startTime) + 'ms');

    const lastRow = sheet.getLastRow();
    console.log('データ行数: ' + lastRow);

    if (lastRow < 2) {
      console.log('ERROR: データ行がありません');
      return;
    }

    const data = sheet.getDataRange().getValues();
    console.log('データ取得完了: ' + (new Date() - startTime) + 'ms');

    const headers = data[0];
    const typeIdx = headers.indexOf('lead_type');
    const statusIdx = headers.indexOf('lead_status');
    const idIdx = headers.indexOf('lead_id');

    console.log('リード種別列: ' + typeIdx);
    console.log('進捗ステータス列: ' + statusIdx);
    console.log('CONFIG.LEAD_STATUSES: ' + JSON.stringify(CONFIG.LEAD_STATUSES));

    // 最初の5行のデータを確認
    console.log('--- 最初の5行のデータ ---');
    for (let i = 1; i < Math.min(6, data.length); i++) {
      const leadId = data[i][idIdx] || '';
      const type = data[i][typeIdx] || '';
      const status = data[i][statusIdx] || '';

      console.log('行' + i + ' リードID: ' + leadId + ', 種別: "' + type + '", ステータス: "' + status + '"');

      // 文字列の長さと文字コードを確認
      if (type) {
        const typeChars = type.toString().split('').map(c => c.charCodeAt(0));
        console.log('  種別の文字コード: [' + typeChars.join(',') + ']');
      }
      if (status) {
        const statusChars = status.toString().split('').map(c => c.charCodeAt(0));
        console.log('  ステータスの文字コード: [' + statusChars.join(',') + ']');
      }
    }

    // 各種別・ステータスのカウント
    let inboundCount = 0, outboundCount = 0, otherTypeCount = 0;
    let newCount = 0, inProgressCount = 0, otherStatusCount = 0;

    for (let i = 1; i < data.length; i++) {
      const type = (data[i][typeIdx] || '').toString().trim();
      const status = (data[i][statusIdx] || '').toString().trim();

      if (type === 'インバウンド') inboundCount++;
      else if (type === 'アウトバウンド') outboundCount++;
      else otherTypeCount++;

      if (status === '新規リード') newCount++;
      else if (status === 'リード対応中') inProgressCount++;
      else otherStatusCount++;
    }

    console.log('--- 集計結果 ---');
    console.log('インバウンド: ' + inboundCount + '件');
    console.log('アウトバウンド: ' + outboundCount + '件');
    console.log('その他種別: ' + otherTypeCount + '件');
    console.log('新規: ' + newCount + '件');
    console.log('対応中: ' + inProgressCount + '件');
    console.log('その他ステータス: ' + otherStatusCount + '件');

    console.log('=== 診断完了: ' + (new Date() - startTime) + 'ms ===');

  } catch (e) {
    console.log('エラー: ' + e.message);
    console.log('スタック: ' + e.stack);
  }
}

// ============================================================
// 会話ログ・お知らせ・重複検知 API
// ============================================================

/**
 * 未読お知らせを取得（フロントエンド用）
 */
function getUnreadNoticesForUser(staffId) {
  return getUnreadNotices(staffId);
}

/**
 * 全お知らせを取得（履歴用）
 */
function getAllNoticesForUser(staffId) {
  return getAllNotices(staffId);
}

/**
 * 会話ログを取得
 */
function getConversationLogsForLead(leadId, type) {
  // 10_ConversationLogService.gs の getConversationLogs を呼び出す
  const result = getConversationLogs(leadId, type);

  // エラーチェック
  if (!result.success) {
    return {
      success: false,
      error: result.error || '会話ログの取得に失敗しました'
    };
  }

  const logs = result.data || [];

  // Date型を文字列に変換（google.script.runでのシリアライズ問題を回避）
  if (logs.length > 0) {
    const serializedLogs = logs.map(log => {
      const serializedLog = {};
      for (const key in log) {
        const value = log[key];
        if (value instanceof Date) {
          serializedLog[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        } else {
          serializedLog[key] = value;
        }
      }
      return serializedLog;
    });

    return {
      success: true,
      data: serializedLogs,
      count: serializedLogs.length
    };
  }

  return {
    success: true,
    data: [],
    count: 0
  };
}

/**
 * 会話ログを追加（翻訳あり）
 */
function addConversationLog(data) {
  // 現在のユーザー情報を取得
  const currentUser = getCurrentUserWithPermissions();

  // フロントエンドからの日本語フィールドを英語に変換
  const convertedData = {
    leadId: data['lead_id'] || data.leadId,
    direction: data['送受信'] || data.direction,
    speaker: data['発言者'] || data.speaker,
    originalText: data['原文'] || data.originalText,
    translatedText: data['翻訳文'] || data.translatedText || '',
    recorderId: currentUser.staffId, // 担当者IDを使用
    datetime: new Date()
  };

  // 翻訳文が空の場合は自動翻訳
  if (!convertedData.translatedText) {
    Logger.log('🔄 Auto-translating message...');
    const translateResult = translateMessage(convertedData.originalText, 'auto');
    if (translateResult.success) {
      convertedData.translatedText = translateResult.translation;
      Logger.log('✅ Translation complete: ' + convertedData.translatedText);
    } else {
      Logger.log('⚠️ Translation failed, using original text');
      convertedData.translatedText = convertedData.originalText;
    }
  }

  // ログ追加
  const result = addConversationLogInternal(convertedData);

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'ログの保存に失敗しました'
    };
  }

  // 追加されたログデータを取得（全ログを再取得せずに効率的）
  const logData = result.data;

  if (!logData) {
    return {
      success: false,
      error: 'ログデータの取得に失敗しました'
    };
  }

  // Date型を文字列に変換（google.script.runでのシリアライズ問題を回避）
  const serializedLog = {};
  for (const key in logData) {
    const value = logData[key];
    if (value instanceof Date) {
      serializedLog[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    } else {
      serializedLog[key] = value;
    }
  }

  return {
    success: true,
    data: serializedLog,
    logId: result.logId
  };
}

/**
 * 会話ログを追加（翻訳あり）
 */
function translateAndAddLog(data) {
  // 現在のユーザー情報を取得
  const currentUser = getCurrentUserWithPermissions();

  // フロントエンドからの日本語フィールドを英語に変換
  const convertedData = {
    leadId: data['lead_id'] || data.leadId,
    direction: data['送受信'] || data.direction,
    speaker: data['発言者'] || data.speaker,
    originalText: data['原文'] || data.originalText,
    recorderId: currentUser.staffId, // 担当者IDを使用
    datetime: new Date()
  };

  // 翻訳方向を自動判定
  const translationDirection = 'auto';

  // 翻訳実行（言語自動判定）
  const translateResult = translateMessage(convertedData.originalText, translationDirection);

  if (translateResult.success) {
    convertedData.translatedText = translateResult.translation;
  } else {
    convertedData.translatedText = '⚠️ 翻訳失敗: ' + (translateResult.error || '不明なエラー');
  }

  // ログ追加
  const result = addConversationLogInternal(convertedData);

  if (!result.success) {
    return null;
  }

  // 追加されたログを取得して返す
  const logs = getConversationLogsForLead(convertedData.leadId);
  const newLog = logs.find(log => log['ログID'] === result.logId);

  return newLog || null;
}

/**
 * 会話ログを追加（翻訳あり・旧名）
 */
function addConversationLogWithTranslate(data) {
  return translateAndAddLog(data);
}

/**
 * 内部用：会話ログを追加
 */
function addConversationLogInternal(data) {
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { success: false, error: 'シートが見つかりません: ' + sheetName };
  }

  const logId = generateNextLogId(sheetName);
  const now = new Date();

  // directionを日本語に変換（send → 送信, receive → 受信）
  let direction = data.direction;
  if (direction === 'send') {
    direction = '送信';
  } else if (direction === 'receive') {
    direction = '受信';
  }

  // 原文の言語を自動判定
  const originalLanguage = detectLanguage(data.originalText);

  // オブジェクト形式でデータを準備（ヘッダー名をキーとして使用）
  const logData = {
    'ログID': logId,
    'リードID': data.leadId,
    '日時': data.datetime || now,
    '送受信': direction,
    '発言者': data.speaker || '',
    '原文': data.originalText,
    '原文言語': originalLanguage,
    '翻訳文': data.translatedText || '',
    '記録者ID': data.recorderId,
    '記録日時': now
  };

  // ヘッダー順序に従って配列に変換（列順序の変更に自動対応）
  const row = convertObjectToRowArray(logData, HEADERS.CONVERSATION_LOG);

  sheet.appendRow(row);

  // リード管理シートの会話関連列を更新
  updateLeadConversationInfo(data.leadId);

  // 作成したログデータを返す（フロントエンドでの即時反映に必要）
  return { success: true, logId: logId, data: logData };
}

/**
 * メッセージを翻訳
 */
function translateMessageApi(text, direction) {
  return translateMessage(text, direction);
}

/**
 * 会話要約を生成
 */
function generateSummary(leadId) {
  return generateConversationSummary(leadId);
}

/**
 * 重複情報を取得
 */
function getDuplicateInfoForLead(leadId) {
  return getDuplicateInfo(leadId);
}

/**
 * 重複フラグをクリア
 */
function clearDuplicateFlagForLead(leadId) {
  return clearDuplicateFlag(leadId);
}

/**
 * 診断用: ダッシュボード表示問題の調査
 */
function diagnoseDashboardData() {
  Logger.log('=== ダッシュボードデータ診断 ===');

  const ss = getSpreadsheet();
  Logger.log('スプレッドシート: ' + ss.getName());

  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadSheet) {
    Logger.log('ERROR: リード管理シートが見つかりません');
    return;
  }

  // 全データ取得
  const lastRow = leadSheet.getLastRow();
  const lastCol = leadSheet.getLastColumn();
  Logger.log('シート: 行数=' + lastRow + ', 列数=' + lastCol);

  if (lastRow < 2) {
    Logger.log('データ行がありません');
    return;
  }

  const headers = leadSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = leadSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // 重要な列のインデックス
  const statusIdx = headers.indexOf('lead_status');
  const staffIdx = headers.indexOf('担当者');
  const staffIdIdx = headers.indexOf('assignee_id');
  const customerIdx = headers.indexOf('customer_name');

  Logger.log('');
  Logger.log('列インデックス:');
  Logger.log('  進捗ステータス: ' + statusIdx);
  Logger.log('  担当者: ' + staffIdx);
  Logger.log('  担当者ID: ' + staffIdIdx);
  Logger.log('  顧客名: ' + customerIdx);

  // CONFIG.DEAL_STATUSES確認
  Logger.log('');
  Logger.log('CONFIG.DEAL_STATUSES: ' + JSON.stringify(CONFIG.DEAL_STATUSES));

  // 各行のデータ確認
  Logger.log('');
  Logger.log('=== データ行の確認 ===');
  data.forEach((row, i) => {
    const status = row[statusIdx] || '(空)';
    const staff = row[staffIdx] || '(空)';
    const staffId = row[staffIdIdx] || '(空)';
    const customer = row[customerIdx] || '(空)';
    const isDealStatus = CONFIG.DEAL_STATUSES.includes(status);

    Logger.log('行' + (i + 2) + ': ' +
      '顧客=' + customer + ', ' +
      'ステータス=' + status + ', ' +
      '担当者=' + staff + ', ' +
      '担当者ID=' + staffId + ', ' +
      '商談対象=' + (isDealStatus ? '✅' : '❌'));
  });

  Logger.log('');
  Logger.log('=== 診断完了 ===');
}

/**
 * 診断用: ユーザー情報とマッチングの確認
 */
function diagnoseUserMatching() {
  Logger.log('=== ユーザーマッチング診断 ===');

  // 1. 現在のユーザー情報
  const userInfo = getCurrentUserRole();
  Logger.log('');
  Logger.log('【1. getCurrentUserRole() の結果】');
  Logger.log('  email: ' + userInfo.email);
  Logger.log('  role: ' + userInfo.role);
  Logger.log('  staffId: ' + userInfo.staffId);
  Logger.log('  staffName: "' + userInfo.staffName + '"');
  Logger.log('  staffName.length: ' + (userInfo.staffName ? userInfo.staffName.length : 0));
  if (userInfo.error) {
    Logger.log('  error: ' + userInfo.error);
  }

  // 2. 担当者マスタの確認
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  Logger.log('');
  Logger.log('【2. 担当者マスタ】');
  if (!staffSheet) {
    Logger.log('  ERROR: 担当者マスタシートが見つかりません');
    return;
  }

  const staffData = staffSheet.getDataRange().getValues();
  const staffHeaders = staffData[0];
  Logger.log('  ヘッダー: ' + staffHeaders.join(', '));

  const emailCol = staffHeaders.indexOf('email');
  const familyCol = staffHeaders.indexOf('last_name_ja');
  const givenCol = staffHeaders.indexOf('first_name_ja');
  const oldNameCol = staffHeaders.indexOf('full_name_ja');

  Logger.log('  メール列: ' + emailCol);
  Logger.log('  苗字列: ' + familyCol);
  Logger.log('  名前列: ' + givenCol);
  Logger.log('  氏名列: ' + oldNameCol);

  Logger.log('');
  Logger.log('【3. 担当者マスタのデータ】');
  for (let i = 1; i < staffData.length; i++) {
    const row = staffData[i];
    const family = familyCol >= 0 ? row[familyCol] : '';
    const given = givenCol >= 0 ? row[givenCol] : '';
    const oldName = oldNameCol >= 0 ? row[oldNameCol] : '';
    const constructedName = (family + ' ' + given).trim();

    Logger.log('  行' + (i+1) + ': ' +
      'メール=' + (row[emailCol] || '(空)') + ', ' +
      '苗字="' + family + '", ' +
      '名前="' + given + '", ' +
      '構築名="' + constructedName + '", ' +
      '旧氏名="' + oldName + '"');
  }

  // 3. リード管理の担当者と比較
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (leadSheet && leadSheet.getLastRow() >= 2) {
    const leadData = leadSheet.getDataRange().getValues();
    const leadHeaders = leadData[0];
    const staffCol = leadHeaders.indexOf('担当者');

    Logger.log('');
    Logger.log('【4. リード管理の担当者値】');
    for (let i = 1; i < leadData.length; i++) {
      const leadStaff = leadData[i][staffCol] || '(空)';
      const match = leadStaff === userInfo.staffName;
      Logger.log('  行' + (i+1) + ': "' + leadStaff + '" (マッチ: ' + (match ? '✅' : '❌') + ')');
    }
  }

  Logger.log('');
  Logger.log('=== 診断完了 ===');
}

/**
 * 診断用: getSalesMetrics の結果を確認
 */
function diagnoseGetSalesMetrics() {
  Logger.log('=== getSalesMetrics 診断 ===');

  const userInfo = getCurrentUserRole();
  Logger.log('staffName: "' + userInfo.staffName + '"');

  // getSalesMetrics を呼び出し
  try {
    const result = getSalesMetrics(userInfo.staffName);
    Logger.log('');
    Logger.log('【getSalesMetrics の結果】');
    Logger.log('  totalDeals: ' + result.totalDeals);
    Logger.log('  wonDeals: ' + result.wonDeals);
    Logger.log('  lostDeals: ' + result.lostDeals);
    Logger.log('  pendingDeals: ' + result.pendingDeals);
    Logger.log('  winRate: ' + result.winRate);
    Logger.log('  totalSales: ' + result.totalSales);
    Logger.log('  todayActions.length: ' + (result.todayActions ? result.todayActions.length : 0));
    Logger.log('  activeDeals.length: ' + (result.activeDeals ? result.activeDeals.length : 0));

    if (result.activeDeals && result.activeDeals.length > 0) {
      Logger.log('');
      Logger.log('【activeDeals の内容】');
      result.activeDeals.forEach((deal, i) => {
        Logger.log('  [' + i + '] ' + JSON.stringify(deal));
      });
    }
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }

  Logger.log('');
  Logger.log('=== 診断完了 ===');
}

/**
 * 診断用: 権限設定シートを確認
 */
function diagnosePermissions() {
  Logger.log('=== 権限設定診断 ===');

  const ss = getSpreadsheet();
  Logger.log('スプレッドシート: ' + ss.getName());

  // 権限設定シートを確認
  const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  Logger.log('');
  Logger.log('【権限設定シート】');
  Logger.log('  CONFIG.SHEETS.PERMISSIONS: ' + CONFIG.SHEETS.PERMISSIONS);

  if (!permSheet) {
    Logger.log('  ❌ 権限設定シートが見つかりません');
    Logger.log('');
    Logger.log('【デフォルト権限を使用】');
    Logger.log('  DEFAULT_ROLES: ' + JSON.stringify(DEFAULT_ROLES, null, 2));
    return;
  }

  Logger.log('  ✅ シート存在');
  const data = permSheet.getDataRange().getValues();
  Logger.log('  行数: ' + data.length);
  Logger.log('  ヘッダー: ' + data[0].join(', '));

  Logger.log('');
  Logger.log('【権限データ】');
  for (let i = 1; i < data.length; i++) {
    Logger.log('  行' + (i+1) + ': ' + JSON.stringify(data[i]));
  }

  // 現在のユーザーの権限を取得
  const userInfo = getCurrentUserRole();
  Logger.log('');
  Logger.log('【現在のユーザー】');
  Logger.log('  role: ' + userInfo.role);

  const permissions = getPermissionsByRole(userInfo.role);
  Logger.log('  取得した権限: ' + JSON.stringify(permissions));
  Logger.log('  dashboard_sales: ' + (permissions.dashboard_sales ? '✅' : '❌'));

  Logger.log('');
  Logger.log('=== 診断完了 ===');
}

// WebApp.gs - 統合シート専用版

// ============================================================
// ★Phase 4: ERP統合APIエンドポイント★
// ============================================================

/**
 * 統一エラーレスポンス
 * @param {string} message - エラーメッセージ
 * @returns {Object} エラーレスポンス
 */
function errorResponse(message) {
  return {
    success: false,
    error: message,
    timestamp: new Date()
  };
}

/**
 * 統一成功レスポンス
 * @param {*} data - レスポンスデータ
 * @param {string} message - メッセージ（オプション）
 * @returns {Object} 成功レスポンス
 */
function successResponse(data, message) {
  return {
    success: true,
    data: data,
    message: message || '',
    timestamp: new Date()
  };
}

// ============================================================
// 見積書API（11_Quote.jsの関数を呼び出す）
// ============================================================

/**
 * 全見積書を取得（WebApp用ラッパー）
 * @returns {Array} 見積書一覧
 */
function getQuotes() {
  try {
    Logger.log('[WebApp] getQuotes() 呼び出し');
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.QUOTES);

    if (!sheet) {
      Logger.log('[WebApp] 見積書管理シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const quotes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // QuoteIDが空ならスキップ

      const quote = {};
      headers.forEach((header, index) => {
        let value = row[index];
        // Date オブジェクトは ISO 文字列に変換
        if (value instanceof Date) {
          value = value.toISOString();
        }
        quote[header] = value;
      });
      quotes.push(quote);
    }

    Logger.log('[WebApp] 見積書取得完了: ' + quotes.length + '件');
    return quotes;
  } catch (error) {
    Logger.log('[WebApp] getQuotes error: ' + error.message);
    throw new Error('見積書の取得に失敗しました: ' + error.message);
  }
}

/**
 * 見積書詳細取得（getQuote関数は11_Quote.jsで実装済み）
 * WebAppから呼び出し可能
 */
// getQuote(quoteId) - 11_Quote.jsで実装済み

/**
 * 見積書作成（createQuote関数は11_Quote.jsで実装済み）
 * WebAppから呼び出し可能
 */
// createQuote(quoteData) - 11_Quote.jsで実装済み

/**
 * 見積書更新（updateQuote関数は11_Quote.jsで実装済み）
 * WebAppから呼び出し可能
 */
// updateQuote(quoteId, updates) - 11_Quote.jsで実装済み

/**
 * 商談別見積書一覧取得（getQuotesByDeal関数は11_Quote.jsで実装済み）
 * WebAppから呼び出し可能
 */
// getQuotesByDeal(dealId) - 11_Quote.jsで実装済み

/**
 * 商品検索（オートコンプリート用）
 * @param {string} query - 検索クエリ
 * @returns {Array} 商品一覧
 */
function searchProducts(query) {
  try {
    Logger.log('[WebApp] searchProducts() 呼び出し: ' + query);

    if (!query || query.length < 2) {
      return [];
    }

    // 14_StockSync.jsのgetAvailableStock()を使用
    const stockData = getAvailableStock();

    if (stockData.error) {
      Logger.log('[WebApp] 在庫データ取得エラー: ' + stockData.error);
      return [];
    }

    const queryLower = query.toLowerCase();
    const results = stockData.data.filter(item => {
      const enTitle = (item.enTitle || '').toLowerCase();
      const jaTitle = (item.jaTitle || '');
      const mark = (item.mark || '').toLowerCase();

      return enTitle.includes(queryLower) ||
             jaTitle.includes(query) ||
             mark.includes(queryLower);
    });

    Logger.log('[WebApp] 商品検索結果: ' + results.length + '件');
    return results.slice(0, 20); // 最大20件まで
  } catch (error) {
    Logger.log('[WebApp] searchProducts error: ' + error.message);
    return [];
  }
}

// ============================================================
// 請求書API（12_Invoice.jsの関数を呼び出す）
// ============================================================

/**
 * 全請求書を取得（WebApp用ラッパー）
 * @returns {Array} 請求書一覧
 */
function getInvoices() {
  try {
    Logger.log('[WebApp] getInvoices() 呼び出し');
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);

    if (!sheet) {
      Logger.log('[WebApp] 請求書管理シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const invoices = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // InvoiceIDが空ならスキップ

      const invoice = {};
      headers.forEach((header, index) => {
        let value = row[index];
        // Date オブジェクトは ISO 文字列に変換
        if (value instanceof Date) {
          value = value.toISOString();
        }
        invoice[header] = value;
      });
      invoices.push(invoice);
    }

    Logger.log('[WebApp] 請求書取得完了: ' + invoices.length + '件');
    return invoices;
  } catch (error) {
    Logger.log('[WebApp] getInvoices error: ' + error.message);
    throw new Error('請求書の取得に失敗しました: ' + error.message);
  }
}

/**
 * 請求書詳細取得（getInvoice関数は15_ERPSync.jsで実装済み）
 * WebAppから呼び出し可能
 */
// getInvoice(invoiceId) - 15_ERPSync.jsで実装済み

/**
 * 請求書作成（createInvoice関数は12_Invoice.jsで実装予定）
 * @param {Object} invoiceData - 請求書データ
 * @returns {Object} { success, invoiceId, message }
 */
function createInvoiceApi(invoiceData) {
  try {
    Logger.log('[WebApp] createInvoiceApi() 呼び出し');
    // TODO: 12_Invoice.jsで実装予定
    return errorResponse('請求書作成機能は実装中です');
  } catch (error) {
    Logger.log('[WebApp] createInvoiceApi error: ' + error.message);
    return errorResponse('請求書の作成に失敗しました: ' + error.message);
  }
}

/**
 * 請求書更新（updateInvoice関数は12_Invoice.jsで実装予定）
 * @param {string} invoiceId - 請求書ID
 * @param {Object} updates - 更新データ
 * @returns {Object} { success, message }
 */
function updateInvoiceApi(invoiceId, updates) {
  try {
    Logger.log('[WebApp] updateInvoiceApi() 呼び出し: ' + invoiceId);
    // TODO: 12_Invoice.jsで実装予定
    return errorResponse('請求書更新機能は実装中です');
  } catch (error) {
    Logger.log('[WebApp] updateInvoiceApi error: ' + error.message);
    return errorResponse('請求書の更新に失敗しました: ' + error.message);
  }
}

/**
 * 入金記録（recordPayment関数は12_Invoice.jsで実装予定）
 * @param {string} invoiceId - 請求書ID
 * @param {number} amount - 入金額
 * @param {Date} paymentDate - 入金日
 * @returns {Object} { success, message }
 */
function recordPaymentApi(invoiceId, amount, paymentDate) {
  try {
    Logger.log('[WebApp] recordPaymentApi() 呼び出し: ' + invoiceId);
    // TODO: 12_Invoice.jsで実装予定
    return errorResponse('入金記録機能は実装中です');
  } catch (error) {
    Logger.log('[WebApp] recordPaymentApi error: ' + error.message);
    return errorResponse('入金記録に失敗しました: ' + error.message);
  }
}

/**
 * 商談別請求書一覧取得（getInvoicesByDeal関数は12_Invoice.jsで実装予定）
 * @param {string} dealId - 商談ID
 * @returns {Object} { success, invoices }
 */
function getInvoicesByDealApi(dealId) {
  try {
    Logger.log('[WebApp] getInvoicesByDealApi() 呼び出し: ' + dealId);
    // TODO: 12_Invoice.jsで実装予定
    return errorResponse('商談別請求書取得機能は実装中です');
  } catch (error) {
    Logger.log('[WebApp] getInvoicesByDealApi error: ' + error.message);
    return errorResponse('請求書一覧の取得に失敗しました: ' + error.message);
  }
}

/**
 * 見積書→請求書変換（convertQuoteToInvoice関数は実装予定）
 * @param {string} quoteId - 見積書ID
 * @param {string} paymentMethod - 決済方法
 * @param {Date} dueDate - 支払期限
 * @returns {Object} { success, invoiceId, message }
 */
function convertQuoteToInvoiceApi(quoteId, paymentMethod, dueDate) {
  try {
    Logger.log('[WebApp] convertQuoteToInvoiceApi() 呼び出し: ' + quoteId);
    // TODO: 11_Quote.js/12_Invoice.jsで実装予定
    return errorResponse('見積書→請求書変換機能は実装中です');
  } catch (error) {
    Logger.log('[WebApp] convertQuoteToInvoiceApi error: ' + error.message);
    return errorResponse('見積書変換に失敗しました: ' + error.message);
  }
}

/**
 * ERP出力（exportToERP関数は15_ERPSync.jsで実装済み）
 * WebAppから呼び出し可能
 */
// exportToERP(invoiceId) - 15_ERPSync.jsで実装済み

// ============================================================
// 在庫API（14_StockSync.jsの関数を呼び出す）
// ============================================================

/**
 * 在庫データ取得（getAvailableStock関数は14_StockSync.jsで実装済み）
 * WebAppから呼び出し可能
 */
// getAvailableStock() - 14_StockSync.jsで実装済み

/**
 * 在庫確認（checkInventory関数は14_StockSync.jsで実装済み）
 * WebAppから呼び出し可能
 */
// checkInventory(productId, quantity) - 14_StockSync.jsで実装済み

// ============================================================
// 配送API（13_Shipping.jsの関数を呼び出す）
// ============================================================

/**
 * 配送料計算（calculateShippingFee関数は13_Shipping.jsで実装済み）
 * WebAppから呼び出し可能
 */
// calculateShippingFee(country, weight, carrier) - 13_Shipping.jsで実装済み

/**
 * 配送料金一覧取得
 * @param {string} country - 国名
 * @returns {Object} { FedEx: number, DHL: number, UPS: number }
 */
function getShippingRates(country) {
  try {
    Logger.log('[WebApp] getShippingRates() 呼び出し: ' + country);

    if (!country) {
      return errorResponse('国名が指定されていません');
    }

    // 1kgでの料金を取得（サンプル）
    const result = calculateShippingFee(country, 1, 'auto');

    if (result.error) {
      return errorResponse(result.error);
    }

    return successResponse(result.allRates, '配送料金一覧取得完了');
  } catch (error) {
    Logger.log('[WebApp] getShippingRates error: ' + error.message);
    return errorResponse('配送料金の取得に失敗しました: ' + error.message);
  }
}

// ============================================================
// 顧客API（16_Customer.jsの関数を呼び出す）
// ============================================================

/**
 * 全顧客取得（getAllCustomers関数は16_Customer.jsで実装済み）
 * WebAppから呼び出し可能
 * @returns {Array} 顧客一覧
 */
function getCustomers() {
  try {
    Logger.log('[WebApp] getCustomers() 呼び出し');
    const result = getAllCustomers('Active');

    if (!result.success) {
      Logger.log('[WebApp] 顧客取得エラー: ' + result.message);
      return [];
    }

    Logger.log('[WebApp] 顧客取得完了: ' + result.customers.length + '件');
    return result.customers;
  } catch (error) {
    Logger.log('[WebApp] getCustomers error: ' + error.message);
    return [];
  }
}

/**
 * 顧客詳細取得（getCustomer関数は16_Customer.jsで実装済み）
 * WebAppから呼び出し可能
 */
// getCustomer(customerId) - 16_Customer.jsで実装済み

/**
 * 顧客作成（createCustomer関数は16_Customer.jsで実装済み）
 * WebAppから呼び出し可能
 */
// createCustomer(customerData) - 16_Customer.jsで実装済み

// ============================================================
// 営業ダッシュボードAPI
// ============================================================

/**
 * 営業統計データを取得
 * @returns {Object} 営業統計データ
 */
function getSalesStats() {
  try {
    const user = getCurrentUser();
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return {
        activeDeals: 0,
        thisMonthWon: 0,
        winRate: 0,
        totalCustomers: 0,
        orderCount: 0,
        totalSales: 0
      };
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const statusIdx = headers.indexOf('lead_status');
    const tradeDateIdx = headers.indexOf('first_transaction_date');
    const tradeAmountIdx = headers.indexOf('first_transaction_amount');
    const cumulativeAmountIdx = headers.indexOf('cumulative_transaction_amount');
    const updateDateIdx = headers.indexOf('sheet_updated_at');

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let activeDeals = 0;
    let thisMonthWon = 0;
    let thisMonthLost = 0;
    let totalCustomers = 0;
    let orderCount = 0;
    let totalSales = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // 空行スキップ

      const staff = row[staffIdx];
      const status = row[statusIdx];

      // 自分が担当している案件のみ
      if (staff !== user.name) continue;

      // 進行中の商談数（アサイン確定、商談中）
      if (status === 'アサイン確定' || status === '商談中' || status === '見積もり提示') {
        activeDeals++;
      }

      // 成約済み顧客数
      if (status === '成約') {
        totalCustomers++;
        orderCount++;

        // 累計取引金額
        const cumulativeAmount = parseFloat(row[cumulativeAmountIdx]) || 0;
        totalSales += cumulativeAmount;
      }

      // 今月の成約・失注
      if (status === '成約') {
        const tradeDate = row[tradeDateIdx];
        if (tradeDate) {
          const date = new Date(tradeDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            thisMonthWon++;
          }
        }
      } else if (status === '失注') {
        const updateDate = row[updateDateIdx];
        if (updateDate) {
          const date = new Date(updateDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            thisMonthLost++;
          }
        }
      }
    }

    // 成約率計算
    const closedTotal = thisMonthWon + thisMonthLost;
    const winRate = closedTotal > 0 ? Math.round((thisMonthWon / closedTotal) * 100) : 0;

    return {
      activeDeals: activeDeals,
      thisMonthWon: thisMonthWon,
      winRate: winRate,
      totalCustomers: totalCustomers,
      orderCount: orderCount,
      totalSales: totalSales
    };
  } catch (error) {
    Logger.log('[WebApp] getSalesStats error: ' + error.message);
    return {
      activeDeals: 0,
      thisMonthWon: 0,
      winRate: 0,
      totalCustomers: 0,
      orderCount: 0,
      totalSales: 0
    };
  }
}

/**
 * リマインドリストを取得（次回アクション日が7日以内の案件）
 * @returns {Array} リマインドリスト
 */
function getReminders() {
  try {
    const user = getCurrentUser();
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const statusIdx = headers.indexOf('lead_status');
    const nextActionDateIdx = headers.indexOf('next_action_date');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const reminders = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const staff = row[staffIdx];
      const status = row[statusIdx];
      const nextActionDate = row[nextActionDateIdx];

      // 自分が担当している進行中の案件のみ
      if (staff !== user.name) continue;
      if (status !== 'アサイン確定' && status !== '商談中' && status !== '見積もり提示') continue;
      if (!nextActionDate) continue;

      const actionDate = new Date(nextActionDate);
      if (actionDate >= today && actionDate <= sevenDaysLater) {
        const leadData = {};
        headers.forEach((header, index) => {
          leadData[header] = row[index];
        });
        reminders.push(leadData);
      }
    }

    // 日付順にソート
    reminders.sort((a, b) => {
      const dateA = new Date(a['next_action_date']);
      const dateB = new Date(b['next_action_date']);
      return dateA - dateB;
    });

    return reminders.slice(0, 10); // 最大10件
  } catch (error) {
    Logger.log('[WebApp] getReminders error: ' + error.message);
    return [];
  }
}

/**
 * 追客リストを取得（商談結果が「追客」の顧客）
 * @returns {Array} 追客リスト
 */
function getFollowUps() {
  try {
    const user = getCurrentUser();
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const dealResultIdx = headers.indexOf('deal_result');

    const followUps = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const staff = row[staffIdx];
      const dealResult = row[dealResultIdx];

      // 自分が担当している追客対象のみ
      if (staff !== user.name) continue;
      if (dealResult !== '追客') continue;

      const leadData = {};
      headers.forEach((header, index) => {
        leadData[header] = row[index];
      });
      followUps.push(leadData);
    }

    return followUps;
  } catch (error) {
    Logger.log('[WebApp] getFollowUps error: ' + error.message);
    return [];
  }
}

/**
 * 商談中の新規顧客を取得
 * @returns {Array} 新規顧客リスト
 */
function getNewCustomers() {
  try {
    const user = getCurrentUser();
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const statusIdx = headers.indexOf('lead_status');

    const newCustomers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const staff = row[staffIdx];
      const status = row[statusIdx];

      // 自分が担当している商談中の案件のみ
      if (staff !== user.name) continue;
      if (status !== 'アサイン確定' && status !== '商談中' && status !== '見積もり提示') continue;

      const leadData = {};
      headers.forEach((header, index) => {
        leadData[header] = row[index];
      });
      newCustomers.push(leadData);
    }

    return newCustomers;
  } catch (error) {
    Logger.log('[WebApp] getNewCustomers error: ' + error.message);
    return [];
  }
}

/**
 * 成約済み担当顧客を取得
 * @returns {Array} ルート顧客リスト
 */
function getRouteCustomers() {
  try {
    const user = getCurrentUser();
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const statusIdx = headers.indexOf('lead_status');
    const tradeDateIdx = headers.indexOf('first_transaction_date');

    const routeCustomers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const staff = row[staffIdx];
      const status = row[statusIdx];

      // 自分が担当している成約済みの顧客のみ
      if (staff !== user.name) continue;
      if (status !== '成約') continue;

      const leadData = {};
      headers.forEach((header, index) => {
        leadData[header] = row[index];
      });
      routeCustomers.push(leadData);
    }

    // 初回取引日の新しい順にソート
    routeCustomers.sort((a, b) => {
      const dateA = a['first_transaction_date'] ? new Date(a['first_transaction_date']) : new Date(0);
      const dateB = b['first_transaction_date'] ? new Date(b['first_transaction_date']) : new Date(0);
      return dateB - dateA;
    });

    return routeCustomers;
  } catch (error) {
    Logger.log('[WebApp] getRouteCustomers error: ' + error.message);
    return [];
  }
}

// ============================================================
// 商談管理API（全担当者）
// ============================================================

/**
 * 全体の商談統計データを取得（担当者フィルタなし）
 * @returns {Object} 全体統計データ
 */
function getAllDealsStats() {
  try {
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return {
        totalActiveDeals: 0,
        thisMonthWon: 0,
        winRate: 0,
        totalCustomers: 0,
        orderCount: 0,
        totalSales: 0
      };
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const statusIdx = headers.indexOf('lead_status');
    const tradeDateIdx = headers.indexOf('first_transaction_date');
    const cumulativeAmountIdx = headers.indexOf('cumulative_transaction_amount');
    const updateDateIdx = headers.indexOf('sheet_updated_at');

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let totalActiveDeals = 0;
    let thisMonthWon = 0;
    let thisMonthLost = 0;
    let totalCustomers = 0;
    let orderCount = 0;
    let totalSales = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const status = row[statusIdx];

      // 進行中の商談数（全担当者）
      if (status === 'アサイン確定' || status === '商談中' || status === '見積もり提示') {
        totalActiveDeals++;
      }

      // 成約済み顧客数（全担当者）
      if (status === '成約') {
        totalCustomers++;
        orderCount++;

        // 累計取引金額
        const cumulativeAmount = parseFloat(row[cumulativeAmountIdx]) || 0;
        totalSales += cumulativeAmount;
      }

      // 今月の成約・失注
      if (status === '成約') {
        const tradeDate = row[tradeDateIdx];
        if (tradeDate) {
          const date = new Date(tradeDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            thisMonthWon++;
          }
        }
      } else if (status === '失注') {
        const updateDate = row[updateDateIdx];
        if (updateDate) {
          const date = new Date(updateDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            thisMonthLost++;
          }
        }
      }
    }

    // 成約率計算
    const closedTotal = thisMonthWon + thisMonthLost;
    const winRate = closedTotal > 0 ? Math.round((thisMonthWon / closedTotal) * 100) : 0;

    return {
      totalActiveDeals: totalActiveDeals,
      thisMonthWon: thisMonthWon,
      winRate: winRate,
      totalCustomers: totalCustomers,
      orderCount: orderCount,
      totalSales: totalSales
    };
  } catch (error) {
    Logger.log('[WebApp] getAllDealsStats error: ' + error.message);
    return {
      totalActiveDeals: 0,
      thisMonthWon: 0,
      winRate: 0,
      totalCustomers: 0,
      orderCount: 0,
      totalSales: 0
    };
  }
}

/**
 * 担当者別サマリーを取得
 * @returns {Array} 担当者別サマリー
 */
function getStaffSummary() {
  try {
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdx = headers.indexOf('担当者');
    const statusIdx = headers.indexOf('lead_status');
    const tradeDateIdx = headers.indexOf('first_transaction_date');
    const tradeAmountIdx = headers.indexOf('first_transaction_amount');
    const updateDateIdx = headers.indexOf('sheet_updated_at');

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const staffMap = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const staff = row[staffIdx];
      const status = row[statusIdx];

      if (!staff) continue;

      // 担当者ごとに初期化
      if (!staffMap[staff]) {
        staffMap[staff] = {
          staffName: staff,
          activeDeals: 0,
          thisMonthWon: 0,
          thisMonthLost: 0,
          thisMonthSales: 0
        };
      }

      // 進行中の商談数
      if (status === 'アサイン確定' || status === '商談中' || status === '見積もり提示') {
        staffMap[staff].activeDeals++;
      }

      // 今月の成約
      if (status === '成約') {
        const tradeDate = row[tradeDateIdx];
        if (tradeDate) {
          const date = new Date(tradeDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            staffMap[staff].thisMonthWon++;
            const amount = parseFloat(row[tradeAmountIdx]) || 0;
            staffMap[staff].thisMonthSales += amount;
          }
        }
      } else if (status === '失注') {
        const updateDate = row[updateDateIdx];
        if (updateDate) {
          const date = new Date(updateDate);
          if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
            staffMap[staff].thisMonthLost++;
          }
        }
      }
    }

    // 配列に変換して成約率を計算
    const summary = Object.values(staffMap).map(staff => {
      const closedTotal = staff.thisMonthWon + staff.thisMonthLost;
      const winRate = closedTotal > 0 ? Math.round((staff.thisMonthWon / closedTotal) * 100) : 0;
      return {
        staffName: staff.staffName,
        activeDeals: staff.activeDeals,
        thisMonthWon: staff.thisMonthWon,
        winRate: winRate,
        thisMonthSales: staff.thisMonthSales
      };
    });

    // 今月売上の多い順にソート
    summary.sort((a, b) => b.thisMonthSales - a.thisMonthSales);

    return summary;
  } catch (error) {
    Logger.log('[WebApp] getStaffSummary error: ' + error.message);
    return [];
  }
}

/**
 * 商談中の全新規顧客を取得（担当者フィルタなし）
 * @returns {Array} 全新規顧客リスト
 */
function getAllNewCustomers() {
  try {
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const statusIdx = headers.indexOf('lead_status');

    const allNewCustomers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const status = row[statusIdx];

      // 商談中の案件のみ（全担当者）
      if (status !== 'アサイン確定' && status !== '商談中' && status !== '見積もり提示') continue;

      const leadData = {};
      headers.forEach((header, index) => {
        leadData[header] = row[index];
      });
      allNewCustomers.push(leadData);
    }

    return allNewCustomers;
  } catch (error) {
    Logger.log('[WebApp] getAllNewCustomers error: ' + error.message);
    return [];
  }
}

/**
 * 成約済み全ルート顧客を取得（担当者フィルタなし）
 * @returns {Array} 全ルート顧客リスト
 */
function getAllRouteCustomers() {
  try {
    const ss = getSpreadsheet();
    const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadSheet) {
      return [];
    }

    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];

    const statusIdx = headers.indexOf('lead_status');
    const tradeDateIdx = headers.indexOf('first_transaction_date');

    const allRouteCustomers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const status = row[statusIdx];

      // 成約済みの顧客のみ（全担当者）
      if (status !== '成約') continue;

      const leadData = {};
      headers.forEach((header, index) => {
        leadData[header] = row[index];
      });
      allRouteCustomers.push(leadData);
    }

    // 初回取引日の新しい順にソート
    allRouteCustomers.sort((a, b) => {
      const dateA = a['first_transaction_date'] ? new Date(a['first_transaction_date']) : new Date(0);
      const dateB = b['first_transaction_date'] ? new Date(b['first_transaction_date']) : new Date(0);
      return dateB - dateA;
    });

    return allRouteCustomers;
  } catch (error) {
    Logger.log('[WebApp] getAllRouteCustomers error: ' + error.message);
    return [];
  }
}

// ============================================================
// CSV エクスポート機能
// ============================================================

/**
 * リード管理サンプルCSVを生成
 * @returns {Object} CSVコンテンツとファイル名
 */
function exportLeadsSampleCSV() {
  try {
    const headers = HEADERS.LEADS;

    // サンプルデータ（2行・51列スキーマ準拠）
    const sampleData = [
      [
        'LDI-00001',                              // 1: リードID
        '2026-01-27',                             // 2: 登録日
        'ABC Trading',                            // 3: 顧客名
        '',                                       // 4: 商談結果
        'ABC',                                    // 5: 呼び方（英語）
        'United States',                          // 6: 国
        new Date(),                               // 7: シート更新日
        '谷澤 伸吾',                               // 8: リード担当者
        'インバウンド',                            // 9: リード種別
        'Instagram',                              // 10: 流入経路
        '',                                       // 11: 流入元ID
        'https://wa.me/1234567890',               // 12: メッセージURL
        'Pokemon',                                // 13: 取り扱いタイトル
        '',                                       // 14: 作品ID
        '既存顧客として登録。対応良好。',           // 15: CSメモ
        'abc@example.com',                        // 16: メール
        '+1-234-567-8900',                        // 17: 電話番号
        'WhatsApp',                               // 18: 連絡手段
        '高',                                     // 19: 温度感
        '大口',                                   // 20: 想定規模
        '24h以内',                                // 21: 返信速度
        0,                                        // 22: 問い合わせ回数
        '',                                       // 23: アーカイブ日
        '',                                       // 24: アーカイブ理由
        '2026-01-21',                             // 25: アサイン日
        '谷澤 伸吾',                               // 26: 営業担当者
        'EMP-001',                                // 27: 担当者ID
        '信頼重視',                               // 28: 顧客タイプ
        'EMP-001',                                // 29: 最終対応者ID
        '85',                                     // 30: 見込度
        '価格表送付',                              // 31: 次回アクション
        '2026-01-28',                             // 32: 次回アクション日
        '初回ヒアリング完了。ポケモンカード大口取引希望。', // 33: 商談メモ
        '安定した仕入先を探している',              // 34: 相手の課題
        'EC',                                     // 35: 販売形態
        500000,                                   // 36: 月間見込み金額
        'いいえ',                                  // 37: 競合比較中
        '',                                       // 38: アラート確認日
        '',                                       // 39: 対象外理由
        '',                                       // 40: 失注理由
        '',                                       // 41: 初回取引日
        0,                                        // 42: 初回取引金額
        0,                                        // 43: 累計取引金額
        '',                                       // 44: 会話要約
        '',                                       // 45: 最終会話日時
        0,                                        // 46: 会話数
        'FALSE',                                  // 47: 重複フラグ
        '',                                       // 48: 重複元リードID
        '',                                       // 49: 重複確認日
        '',                                       // 50: 重複確認者
        'アサイン確定'                             // 51: リードステータス
      ],
      [
        'LDO-00001',                              // 1: リードID
        '2026-01-26',                             // 2: 登録日
        'XYZ Corporation',                        // 3: 顧客名
        '',                                       // 4: 商談結果
        'XYZ',                                    // 5: 呼び方（英語）
        'Japan',                                  // 6: 国
        new Date(),                               // 7: シート更新日
        '',                                       // 8: リード担当者
        'アウトバウンド',                          // 9: リード種別
        'テレアポ',                               // 10: 流入経路
        '',                                       // 11: 流入元ID
        '',                                       // 12: メッセージURL
        '',                                       // 13: 取り扱いタイトル
        '',                                       // 14: 作品ID
        'テレアポでの新規開拓。',                  // 15: CSメモ
        'sample@example.com',                     // 16: メール
        '000-0000-0000',                          // 17: 電話番号
        'メール',                                  // 18: 連絡手段
        '中',                                     // 19: 温度感
        '中規模',                                  // 20: 想定規模
        '48h以内',                                // 21: 返信速度
        0,                                        // 22: 問い合わせ回数
        '',                                       // 23: アーカイブ日
        '',                                       // 24: アーカイブ理由
        '',                                       // 25: アサイン日
        '',                                       // 26: 営業担当者
        '',                                       // 27: 担当者ID
        '価格重視',                               // 28: 顧客タイプ
        '',                                       // 29: 最終対応者ID
        '',                                       // 30: 見込度
        '',                                       // 31: 次回アクション
        '',                                       // 32: 次回アクション日
        '',                                       // 33: 商談メモ
        '',                                       // 34: 相手の課題
        '',                                       // 35: 販売形態
        0,                                        // 36: 月間見込み金額
        '',                                       // 37: 競合比較中
        '',                                       // 38: アラート確認日
        '',                                       // 39: 対象外理由
        '',                                       // 40: 失注理由
        '',                                       // 41: 初回取引日
        0,                                        // 42: 初回取引金額
        0,                                        // 43: 累計取引金額
        '',                                       // 44: 会話要約
        '',                                       // 45: 最終会話日時
        0,                                        // 46: 会話数
        'FALSE',                                  // 47: 重複フラグ
        '',                                       // 48: 重複元リードID
        '',                                       // 49: 重複確認日
        '',                                       // 50: 重複確認者
        '新規リード'                               // 51: リードステータス
      ]
    ];

    // CSV生成
    const csvRows = [headers];
    csvRows.push(...sampleData);

    const csvContent = csvRows.map(row =>
      row.map(cell => {
        // CSV エスケープ処理
        let value = cell;
        if (cell instanceof Date) {
          value = Utilities.formatDate(cell, 'JST', 'yyyy-MM-dd HH:mm:ss');
        }
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',')
    ).join('\n');

    // UTF-8 BOM付き（Excel対応）
    const csvWithBOM = '\uFEFF' + csvContent;

    return {
      content: csvWithBOM,
      filename: 'リード管理_サンプル.csv',
      mimeType: 'text/csv'
    };
  } catch (error) {
    Logger.log('[WebApp] exportLeadsSampleCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 会話ログサンプルCSVを生成
 * @returns {Object} CSVコンテンツとファイル名
 */
function exportConversationLogSampleCSV() {
  try {
    const headers = HEADERS.CONVERSATION_LOG;

    // サンプルデータ（3行）
    const sampleData = [
      [
        'LOG-00001',                           // ログID
        'LDI-00001',                          // リードID
        '2026-01-20 10:30:00',                // 日時
        '受信',                                // 送受信
        'ABC Trading',                        // 発言者
        'Hello, I\'m interested in Pokemon cards',  // 原文
        'en',                                 // 原文言語
        'こんにちは、ポケモンカードに興味があります',   // 翻訳文
        'STF-00001',                          // 記録者ID
        '2026-01-27 15:00:00'                 // 記録日時
      ],
      [
        'LOG-00002',                           // ログID
        'LDI-00001',                          // リードID
        '2026-01-20 10:35:00',                // 日時
        '送信',                                // 送受信
        '谷澤 伸吾',                           // 発言者
        'ありがとうございます。幅広い品揃えがございます。',  // 原文
        'ja',                                 // 原文言語
        'Thank you. We have a wide selection.',  // 翻訳文
        'STF-00001',                          // 記録者ID
        '2026-01-27 15:00:00'                 // 記録日時
      ],
      [
        'LOG-00003',                           // ログID
        'LDI-00001',                          // リードID
        '2026-01-20 10:40:00',                // 日時
        '受信',                                // 送受信
        'ABC Trading',                        // 発言者
        'Do you have Scarlet & Violet boxes?', // 原文
        'en',                                 // 原文言語
        'スカーレット＆バイオレットのボックスはありますか？',  // 翻訳文
        'STF-00001',                          // 記録者ID
        '2026-01-27 15:00:00'                 // 記録日時
      ]
    ];

    // CSV生成
    const csvRows = [headers];
    csvRows.push(...sampleData);

    const csvContent = csvRows.map(row =>
      row.map(cell => {
        // CSV エスケープ処理
        const value = String(cell);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',')
    ).join('\n');

    // UTF-8 BOM付き（Excel対応）
    const csvWithBOM = '\uFEFF' + csvContent;

    return {
      content: csvWithBOM,
      filename: '会話ログ_サンプル.csv',
      mimeType: 'text/csv'
    };
  } catch (error) {
    Logger.log('[WebApp] exportConversationLogSampleCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 顧客マスタサンプルCSVをエクスポート
 *
 * @returns {Object} CSV data object with content, filename, and mimeType
 */
function exportCustomerMasterSampleCSV() {
  try {
    const headers = HEADERS.CUSTOMER_MASTER;

    // サンプルデータ（2行）
    const sampleData = [
      [
        'CT-00001',                           // 顧客ID
        '2026-01-20',                         // 登録日
        'ABC Trading LLC',                    // Billing Name
        '+1-234-567-8900',                    // Billing Phone
        'billing@example.com',                // Billing Email
        '12-3456789',                         // Business ID
        '123 Main Street',                    // Billing Address 1
        'Suite 100',                          // Billing Address 2
        'New York',                           // Billing City
        'NY',                                 // Billing State
        '10001',                              // Billing ZIP
        'United States',                      // Billing Country
        'ABC Trading Warehouse',              // Delivery Name
        '+1-234-567-8901',                    // Delivery Phone
        '456 Warehouse Rd',                   // Delivery Address 1
        'Building A',                         // Delivery Address 2
        'Los Angeles',                        // Delivery City
        'CA',                                 // Delivery State
        '90001',                              // Delivery ZIP
        'United States',                      // Delivery Country
        'Active',                             // ステータス
        '2026-02-01',                         // 初回取引日
        '150000',                             // 累計取引金額
        '2026-03-15',                         // 最終取引日
        '5',                                  // 取引回数
        'ポケモンカード専門',                  // 備考
        '2026-03-15 10:30:00',                // 更新日
        'リード成約'                          // 登録経路
      ],
      [
        'CT-00002',                           // 顧客ID
        '2026-01-25',                         // 登録日
        'XYZ Corporation',                    // Billing Name
        '000-0000-0000',                      // Billing Phone
        'contact@example.com',                // Billing Email
        'GB123456789',                        // Business ID
        '789 High Street',                    // Billing Address 1
        'Floor 3',                            // Billing Address 2
        'London',                             // Billing City
        '',                                   // Billing State
        'SW1A 1AA',                           // Billing ZIP
        'United Kingdom',                     // Billing Country
        'XYZ Corporation',                    // Delivery Name
        '000-0000-0000',                      // Delivery Phone
        '789 High Street',                    // Delivery Address 1
        'Floor 3',                            // Delivery Address 2
        'London',                             // Delivery City
        '',                                   // Delivery State
        'SW1A 1AA',                           // Delivery ZIP
        'United Kingdom',                     // Delivery Country
        'Active',                             // ステータス
        '2026-03-01',                         // 初回取引日
        '85000',                              // 累計取引金額
        '2026-03-10',                         // 最終取引日
        '2',                                  // 取引回数
        'ワンピースカード中心',                // 備考
        '2026-03-10 14:20:00',                // 更新日
        'リード成約'                          // 登録経路
      ]
    ];

    // CSV生成
    const csvRows = [headers];
    csvRows.push(...sampleData);

    const csvContent = csvRows.map(row =>
      row.map(cell => {
        // CSV エスケープ処理
        const value = String(cell);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',')
    ).join('\n');

    // UTF-8 BOM付き（Excel対応）
    const csvWithBOM = '\uFEFF' + csvContent;

    return {
      content: csvWithBOM,
      filename: '顧客マスタ_サンプル.csv',
      mimeType: 'text/csv'
    };
  } catch (error) {
    Logger.log('[WebApp] exportCustomerMasterSampleCSV error: ' + error.message);
    throw error;
  }
}

// ============================================================
// 見積もり作業シート管理（ユーザー別）
// ============================================================

/**
 * 「見積もり作成」シートを取得
 * 単一シート方式（全ユーザー共通）
 *
 * @returns {Sheet} 見積もり作成シート
 */
function getQuoteCreationSheet() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('見積もり作成');

    if (!sheet) {
      throw new Error('見積もり作成シートが見つかりません。先にシートを作成してください。');
    }

    return sheet;
  } catch (error) {
    Logger.log('[getQuoteCreationSheet] エラー: ' + error.message);
    throw error;
  }
}

/**
 * 「見積もり作成」シートからデータを読み込む（フロントエンド初期化用）
 *
 * @returns {Object} { success, data }
 */
function loadQuoteDataFromCreationSheet() {
  try {
    const sheet = getQuoteCreationSheet();

    // J列・K列から顧客情報・集計を読み取り
    const customerName = sheet.getRange(1, 11).getValue() || '';      // K1
    const country = sheet.getRange(2, 11).getValue() || '';           // K2
    const paymentMethod = sheet.getRange(3, 11).getValue() || '';     // K3
    const shippingMethod = sheet.getRange(4, 11).getValue() || '';    // K4
    const totalWeight = Number(sheet.getRange(5, 11).getValue()) || 0; // K5
    const subtotal = Number(sheet.getRange(18, 11).getValue()) || 0;  // K18
    const shipping = Number(sheet.getRange(19, 11).getValue()) || 0;  // K19
    const tax = Number(sheet.getRange(20, 11).getValue()) || 0;       // K20
    const total = Number(sheet.getRange(21, 11).getValue()) || 0;     // K21

    // 商品明細を読み取り（2行目から21行目まで）
    const itemsData = sheet.getRange(2, 1, 20, 9).getValues();
    const items = [];

    for (let i = 0; i < itemsData.length; i++) {
      const row = itemsData[i];

      // No.がある行のみ処理（空行をスキップ）
      if (!row[0]) continue;

      items.push({
        no: row[0] || '',                     // 列1: No.
        category: row[1] || '',               // 列2: カテゴリ
        status: row[2] || '',                 // 列3: コンディション
        productNameWithMark: row[3] || '',    // 列4: 商品名/マーク
        quantity: Number(row[4]) || 0,        // 列5: 個数
        weight: Number(row[5]) || 0,          // 列6: 重量(kg)
        unitPrice: Number(row[6]) || 0,       // 列7: 単価
        subtotal: Number(row[7]) || 0,        // 列8: 合計
        maxQuantity: row[8] || ''             // 列9: 在庫数
      });
    }

    Logger.log('[loadQuoteDataFromCreationSheet] データ読み込み成功 - 顧客: ' + customerName + ', 商品数: ' + items.length);

    return {
      success: true,
      data: {
        customerName: customerName,
        country: country,
        paymentMethod: paymentMethod,
        shippingMethod: shippingMethod,
        totalWeight: totalWeight,
        subtotal: subtotal,
        shipping: shipping,
        tax: tax,
        total: total,
        items: items
      }
    };
  } catch (error) {
    Logger.log('[loadQuoteDataFromCreationSheet] エラー: ' + error.message);
    return {
      success: false,
      message: error.message,
      data: null
    };
  }
}

/**
 * フロントエンドの商品データを「見積もり作成」シートに即時書き込み
 *
 * @param {number} rowIndex - 商品行インデックス（0始まり）
 * @param {Object} itemData - 商品データ
 * @returns {Object} { success: boolean }
 */
function syncQuoteItemToCreationSheet(rowIndex, itemData) {
  try {
    const sheet = getQuoteCreationSheet();
    const sheetRow = 2 + rowIndex;  // データは2行目から開始（1行目はヘッダー）

    // 商品名/マークの結合
    const productNameWithMark = itemData.mark && itemData.enTitle
      ? `${itemData.mark} - ${itemData.enTitle}`
      : (itemData.enTitle || '');

    // 小計計算
    const subtotal = (itemData.quantity || 0) * (itemData.unitPrice || 0);

    // 列構造に合わせてデータを設定（18列構造）
    // 列1: No., 列2: カテゴリ, 列3: コンディション, 列4: 商品名/マーク
    // 列5: 個数, 列6: 重量(kg), 列7: 単価, 列8: 合計, 列9: 在庫数
    sheet.getRange(sheetRow, 1, 1, 9).setValues([[
      rowIndex + 1,                    // 列1: No.
      itemData.category || '',         // 列2: カテゴリ
      itemData.status || '',           // 列3: コンディション
      productNameWithMark,             // 列4: 商品名/マーク
      itemData.quantity || 0,          // 列5: 個数
      itemData.weight || 0,            // 列6: 重量(kg)
      itemData.unitPrice || 0,         // 列7: 単価
      subtotal,                        // 列8: 合計
      itemData.maxQuantity || ''       // 列9: 在庫数
    ]]);

    Logger.log('[syncQuoteItemToCreationSheet] 同期完了 - 行: ' + sheetRow + ', 商品: ' + productNameWithMark + ', 重量: ' + (itemData.weight || 0) + 'kg');

    return { success: true };
  } catch (error) {
    Logger.log('[syncQuoteItemToCreationSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * フロントエンドのヘッダー情報（顧客名・配送先など）を「見積もり作成」シートに書き込み
 * J列・K列形式に対応
 *
 * @param {Object} headerData - ヘッダーデータ
 * @returns {Object} { success: boolean }
 */
function syncQuoteHeaderToCreationSheet(headerData) {
  try {
    const sheet = getQuoteCreationSheet();

    // J列・K列形式でデータを設定
    // 行1: 顧客名
    sheet.getRange(1, 11).setValue(headerData.customerName || '');  // K1

    // 行2: 国
    sheet.getRange(2, 11).setValue(headerData.country || '');  // K2

    // 行3: 支払い方法
    sheet.getRange(3, 11).setValue(headerData.paymentMethod || '');  // K3

    // 行4: 発送方法
    sheet.getRange(4, 11).setValue(headerData.shippingMethod || '');  // K4

    // 行5: 総重量
    sheet.getRange(5, 11).setValue(headerData.totalWeight || 0);  // K5

    // 行18: 小計
    sheet.getRange(18, 11).setValue(headerData.subtotal || 0);  // K18

    // 行19: 送料
    sheet.getRange(19, 11).setValue(headerData.shipping || 0);  // K19

    // 行20: 関税
    sheet.getRange(20, 11).setValue(headerData.tax || 0);  // K20

    // 行21: 合計
    sheet.getRange(21, 11).setValue(headerData.total || 0);  // K21

    Logger.log('[syncQuoteHeaderToCreationSheet] 同期完了 - 顧客: ' + (headerData.customerName || '') + ', 総重量: ' + (headerData.totalWeight || 0) + 'kg');

    return { success: true };
  } catch (error) {
    Logger.log('[syncQuoteHeaderToCreationSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 「見積もり作成」シートからデータを読み取って見積書を保存
 * J列・K列形式に対応
 *
 * @returns {Object} { success, quoteId, message }
 */
function saveQuoteFromCreationSheet() {
  try {
    const userEmail = resolveCurrentUserEmail();
    const sheet = getQuoteCreationSheet();

    // 1. ヘッダー情報をJ列・K列から読み取り
    const customerName = sheet.getRange(1, 11).getValue();      // K1: 顧客名
    const country = sheet.getRange(2, 11).getValue();           // K2: 国
    const paymentMethod = sheet.getRange(3, 11).getValue();     // K3: 支払い方法
    const shippingMethod = sheet.getRange(4, 11).getValue();    // K4: 発送方法

    const shipping = Number(sheet.getRange(19, 11).getValue()) || 0;  // K19: 送料
    const tax = Number(sheet.getRange(20, 11).getValue()) || 0;       // K20: 関税

    // 2. 商品明細を読み取り（最大20行、2行目から21行目まで）
    const itemsData = sheet.getRange(2, 1, 20, 9).getValues();
    const items = [];

    for (let i = 0; i < itemsData.length; i++) {
      const row = itemsData[i];

      // カテゴリ、コンディション、個数が空なら無視
      if (!row[1] || !row[2] || !row[4]) continue;

      // 商品名/マークを分解
      const productNameWithMark = row[3] || '';
      const parts = productNameWithMark.split(' - ');
      const mark = parts.length > 1 ? parts[0] : '';
      const productName = parts.length > 1 ? parts[1] : productNameWithMark;

      items.push({
        productId: '',
        productName: productName,
        productNameJp: '',
        category: row[1] || '',           // 列2: カテゴリ
        condition: row[2] || '',          // 列3: コンディション
        quantity: Number(row[4]) || 0,    // 列5: 個数
        unitPrice: Number(row[6]) || 0,   // 列7: 単価
        weight: Number(row[5]) || 0,      // 列6: 重量(kg)
        mark: mark,
        releaseDate: '',
        stockQuantity: row[8] || '',      // 列9: 在庫数
        itemNotes: ''
      });
    }

    if (items.length === 0) {
      return { success: false, message: '商品が選択されていません' };
    }

    // 3. createQuote()を呼び出し
    const quoteData = {
      dealId: null,
      customerId: '',
      customerName: customerName || '',
      currency: 'JPY',
      items: items,
      deliveryCountry: country || '',
      deliveryAddress: '',
      notes: `支払い方法: ${paymentMethod}\n発送方法: ${shippingMethod}`.trim(),
      validUntil: '',
      creatorId: userEmail,
      creatorName: ''
    };

    const result = createQuote(quoteData);

    // 4. 成功したら作業シートをクリア
    if (result.success) {
      const sheet = getQuoteCreationSheet();
      clearQuoteCreationSheet(sheet);
    }

    return result;

  } catch (error) {
    Logger.log('[saveQuoteFromCreationSheet] エラー: ' + error.message);
    return { success: false, message: '見積もりの保存に失敗しました: ' + error.message };
  }
}

// 【削除】古い clearQuoteCreationSheet() 関数
// 新しいバージョン（Line 7616）に統一しました

/**
 * ユーザー専用の見積もり作業シートを取得または作成
 *
 * 各ユーザーが独立した作業シートを持つことで：
 * - 複数ユーザーの同時作業でも競合しない
 * - ブラウザを閉じてもデータが残る
 * - スプレッドシート上で直接確認・編集可能
 *
 * @returns {Sheet} ユーザー専用の作業シート
 */
/**
 * ログイン中の担当者の氏名を取得
 *
 * @returns {string} 担当者の氏名
 */
function getStaffFullName() {
  try {
    const userEmail = resolveCurrentUserEmail() || '';
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet) {
      Logger.log('[getStaffFullName] 担当者マスタが見つかりません');
      return userEmail; // フォールバック
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];

    // 「氏名」列のインデックスを取得
    const nameIndex = headers.indexOf('氏名');
    const emailIndex = headers.indexOf('email');

    if (nameIndex === -1 || emailIndex === -1) {
      Logger.log('[getStaffFullName] 氏名列またはメールアドレス列が見つかりません');
      Logger.log('[getStaffFullName] nameIndex: ' + nameIndex + ', emailIndex: ' + emailIndex);
      Logger.log('[getStaffFullName] Headers: ' + JSON.stringify(headers));
      return userEmail; // フォールバック
    }

    // メールアドレスで担当者を検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === userEmail) {
        const fullName = data[i][nameIndex];
        Logger.log('[getStaffFullName] 担当者氏名取得: ' + fullName);
        return fullName || userEmail;
      }
    }

    Logger.log('[getStaffFullName] 担当者が見つかりません: ' + userEmail);
    return userEmail; // フォールバック

  } catch (error) {
    Logger.log('[getStaffFullName] エラー: ' + error.message);
    return resolveCurrentUserEmail() || ''; // フォールバック
  }
}

function getUserQuoteWorkSheet() {
  try {
    const ss = getSpreadsheet();
    const staffName = getStaffFullName();
    const sheetName = '見積もり作成_' + staffName;

    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // シートが存在しない場合は作成
      Logger.log('[getUserQuoteWorkSheet] 新規シート作成: ' + sheetName);
      sheet = ss.insertSheet(sheetName);

      // ヘッダー情報エリア（A1:B10）
      sheet.getRange('A1').setValue('顧客名');
      sheet.getRange('A2').setValue('顧客ID');
      sheet.getRange('A3').setValue('配送先国');
      sheet.getRange('A4').setValue('支払い方法');
      sheet.getRange('A5').setValue('発送方法');
      sheet.getRange('A6').setValue('備考');

      // ヘッダーのスタイル設定
      sheet.getRange('A1:A6').setFontWeight('bold');
      sheet.getRange('A1:B6').setBackground('#f3f4f6');

      // 空行
      sheet.getRange('A11').setValue('');

      // 商品明細ヘッダー（A12行目）
      const itemHeaders = [[
        'カテゴリ', '商品マーク', '商品名（英語）', '商品名（日本語）',
        'コンディション', '数量', '単価', '小計', '重量', '在庫数'
      ]];
      sheet.getRange('A12:J12').setValues(itemHeaders);
      sheet.getRange('A12:J12').setFontWeight('bold');
      sheet.getRange('A12:J12').setBackground('#dbeafe');

      // 金額集計エリア（L12以降）
      sheet.getRange('L12').setValue('商品小計');
      sheet.getRange('L13').setValue('配送料');
      sheet.getRange('L14').setValue('税金');
      sheet.getRange('L15').setValue('合計金額');
      sheet.getRange('L12:L15').setFontWeight('bold');
      sheet.getRange('L12:L15').setBackground('#fef3c7');

      // 数式を設定（M列に自動計算）
      sheet.getRange('M12').setFormula('=SUM(H13:H1000)');  // 商品小計
      sheet.getRange('M15').setFormula('=M12+M13+M14');     // 合計金額

      // 列幅を調整
      sheet.setColumnWidth(1, 100);  // カテゴリ
      sheet.setColumnWidth(2, 100);  // 商品マーク
      sheet.setColumnWidth(3, 200);  // 商品名（英語）
      sheet.setColumnWidth(4, 200);  // 商品名（日本語）
      sheet.setColumnWidth(5, 120);  // コンディション
      sheet.setColumnWidth(6, 80);   // 数量
      sheet.setColumnWidth(7, 100);  // 単価
      sheet.setColumnWidth(8, 100);  // 小計
      sheet.setColumnWidth(9, 80);   // 重量
      sheet.setColumnWidth(10, 80);  // 在庫数

      Logger.log('[getUserQuoteWorkSheet] シート初期化完了');
    }

    return sheet;
  } catch (error) {
    Logger.log('[getUserQuoteWorkSheet] エラー: ' + error.message);
    throw error;
  }
}

/**
 * フロントエンドの商品データを作業シートに即時書き込み
 *
 * @param {number} rowIndex - 商品行インデックス（0始まり）
 * @param {Object} itemData - 商品データ
 * @param {string} itemData.category - カテゴリ
 * @param {string} itemData.mark - 商品マーク
 * @param {string} itemData.enTitle - 商品名（英語）
 * @param {string} itemData.jaTitle - 商品名（日本語）
 * @param {string} itemData.status - コンディション
 * @param {number} itemData.quantity - 数量
 * @param {number} itemData.unitPrice - 単価
 * @param {number} itemData.subtotal - 小計
 * @param {number} itemData.weight - 重量
 * @param {number} itemData.maxQuantity - 在庫数
 * @returns {Object} { success: boolean }
 */
function syncQuoteItemToSheet(rowIndex, itemData) {
  try {
    const sheet = getUserQuoteWorkSheet();
    const sheetRow = 13 + rowIndex;  // 商品明細は13行目から開始

    sheet.getRange(sheetRow, 1, 1, 10).setValues([[
      itemData.category || '',
      itemData.mark || '',
      itemData.enTitle || '',
      itemData.jaTitle || '',
      itemData.status || '',
      itemData.quantity || 0,
      itemData.unitPrice || 0,
      itemData.subtotal || 0,
      itemData.weight || 0,
      itemData.maxQuantity || ''
    ]]);

    Logger.log('[syncQuoteItemToSheet] 同期完了 - 行: ' + sheetRow + ', 商品: ' + itemData.enTitle);

    return { success: true };
  } catch (error) {
    Logger.log('[syncQuoteItemToSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * ヘッダー情報（顧客名、国など）を作業シートに書き込み
 *
 * @param {Object} headerData - ヘッダーデータ
 * @param {string} headerData.customerName - 顧客名
 * @param {string} headerData.customerId - 顧客ID
 * @param {string} headerData.country - 配送先国
 * @param {string} headerData.paymentMethod - 支払い方法
 * @param {string} headerData.shippingMethod - 発送方法
 * @param {string} headerData.notes - 備考
 * @param {number} headerData.shipping - 配送料
 * @param {number} headerData.tax - 税金
 * @returns {Object} { success: boolean }
 */
function syncQuoteHeaderToSheet(headerData) {
  try {
    const sheet = getUserQuoteWorkSheet();

    sheet.getRange('B1').setValue(headerData.customerName || '');
    sheet.getRange('B2').setValue(headerData.customerId || '');
    sheet.getRange('B3').setValue(headerData.country || '');
    sheet.getRange('B4').setValue(headerData.paymentMethod || '');
    sheet.getRange('B5').setValue(headerData.shippingMethod || '');
    sheet.getRange('B6').setValue(headerData.notes || '');

    // 金額集計
    sheet.getRange('M13').setValue(headerData.shipping || 0);
    sheet.getRange('M14').setValue(headerData.tax || 0);

    Logger.log('[syncQuoteHeaderToSheet] ヘッダー同期完了 - 顧客: ' + headerData.customerName);

    return { success: true };
  } catch (error) {
    Logger.log('[syncQuoteHeaderToSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 作業シートのデータを読み取り、見積書管理・明細シートに転記
 *
 * フロー:
 * 1. ユーザー専用シートからヘッダー情報と商品明細を読み取り
 * 2. createQuote()を呼び出して見積書を作成
 * 3. 成功したら作業シートをクリア
 *
 * @returns {Object} { success: boolean, quoteId?: string, message: string }
 */
function saveQuoteFromWorkSheet() {
  try {
    const userEmail = resolveCurrentUserEmail();
    const sheet = getUserQuoteWorkSheet();

    Logger.log('[saveQuoteFromWorkSheet] 保存開始 - ユーザー: ' + userEmail);

    // 1. ヘッダー情報を読み取り
    const customerName = sheet.getRange('B1').getValue();
    const customerId = sheet.getRange('B2').getValue();
    const country = sheet.getRange('B3').getValue();
    const paymentMethod = sheet.getRange('B4').getValue();
    const shippingMethod = sheet.getRange('B5').getValue();
    const notes = sheet.getRange('B6').getValue();
    const shipping = Number(sheet.getRange('M13').getValue()) || 0;
    const tax = Number(sheet.getRange('M14').getValue()) || 0;

    // 2. 商品明細を読み取り（最大100行まで）
    const itemsData = sheet.getRange('A13:J112').getValues();
    const items = [];

    for (let i = 0; i < itemsData.length; i++) {
      const row = itemsData[i];

      // カテゴリ・コンディション・数量が空なら無視
      if (!row[0] || !row[4] || !row[5]) continue;

      items.push({
        productId: '',
        productName: row[2] || '',       // 商品名（英語）
        productNameJp: row[3] || '',     // 商品名（日本語）
        category: row[0] || '',          // カテゴリ
        condition: row[4] || '',         // コンディション
        quantity: Number(row[5]) || 0,   // 数量
        unitPrice: Number(row[6]) || 0,  // 単価
        weight: Number(row[8]) || 0,     // 重量
        mark: row[1] || '',              // マーク
        releaseDate: '',
        stockQuantity: row[9] || '',     // 在庫数
        itemNotes: ''
      });
    }

    if (items.length === 0) {
      Logger.log('[saveQuoteFromWorkSheet] 商品が選択されていません');
      return { success: false, message: '商品が選択されていません' };
    }

    Logger.log('[saveQuoteFromWorkSheet] 商品明細: ' + items.length + '件');

    // 3. createQuote()用のデータ構造を構築
    let notesText = '';
    if (paymentMethod) notesText += '支払い方法: ' + paymentMethod + '\n';
    if (shippingMethod) notesText += '発送方法: ' + shippingMethod + '\n';
    if (notes) notesText += notes;

    const quoteData = {
      dealId: null,                      // 任意項目
      customerId: customerId || '',
      customerName: customerName || '',
      currency: 'JPY',
      items: items,
      deliveryCountry: country || '',
      deliveryAddress: '',               // 将来対応
      notes: notesText.trim(),
      validUntil: '',                    // デフォルト30日後
      creatorId: userEmail,
      creatorName: ''
    };

    // 4. createQuote()を呼び出し
    const result = createQuote(quoteData);

    // 5. 成功したら作業シートをクリア
    if (result.success) {
      clearUserQuoteWorkSheet();
      Logger.log('[saveQuoteFromWorkSheet] 保存完了 - 見積書ID: ' + result.quoteId);
    } else {
      Logger.log('[saveQuoteFromWorkSheet] 保存失敗: ' + result.message);
    }

    return result;

  } catch (error) {
    Logger.log('[saveQuoteFromWorkSheet] エラー: ' + error.message);
    Logger.log('[saveQuoteFromWorkSheet] スタック: ' + error.stack);
    return {
      success: false,
      message: '見積もりの保存に失敗しました: ' + error.message
    };
  }
}

/**
 * 作業シートをクリア（次回用）
 *
 * @returns {Object} { success: boolean }
 */
function clearUserQuoteWorkSheet() {
  try {
    const sheet = getUserQuoteWorkSheet();

    // ヘッダー情報をクリア
    sheet.getRange('B1:B6').clearContent();

    // 商品明細をクリア（最大100行）
    sheet.getRange('A13:J112').clearContent();

    // 金額集計をクリア
    sheet.getRange('M13:M14').clearContent();

    Logger.log('[clearUserQuoteWorkSheet] 作業シートクリア完了');

    return { success: true };
  } catch (error) {
    Logger.log('[clearUserQuoteWorkSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 見積もりテンプレートを取得
 *
 * @returns {Object} { Japan: string, UnitedStates: string, Other: string }
 */
function getQuoteTemplates() {
  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.QUOTE_TEMPLATES || '見積もりテンプレート';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('[getQuoteTemplates] テンプレートシートが見つかりません: ' + sheetName);
      // デフォルトテンプレートを返す
      return getDefaultQuoteTemplates();
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // ヘッダーから列インデックスを取得
    const countryIndex = headers.indexOf('国');
    const templateIndex = headers.indexOf('テンプレート');

    if (countryIndex === -1 || templateIndex === -1) {
      Logger.log('[getQuoteTemplates] 必須列が見つかりません');
      return getDefaultQuoteTemplates();
    }

    const templates = {};

    // データ行をループ（1行目はヘッダーなので2行目から）
    for (let i = 1; i < data.length; i++) {
      const country = data[i][countryIndex];
      const template = data[i][templateIndex];

      if (country && template) {
        templates[country] = template;
      }
    }

    Logger.log('[getQuoteTemplates] テンプレート読み込み成功: ' + Object.keys(templates).length + '件');

    // 必須の国がない場合はデフォルトを追加
    if (!templates['Japan']) templates['Japan'] = getDefaultQuoteTemplates().Japan;
    if (!templates['United States']) templates['United States'] = getDefaultQuoteTemplates().UnitedStates;
    if (!templates['Other']) templates['Other'] = getDefaultQuoteTemplates().Other;

    return templates;
  } catch (error) {
    Logger.log('[getQuoteTemplates] エラー: ' + error.message);
    return getDefaultQuoteTemplates();
  }
}

/**
 * デフォルトテンプレートを返す
 *
 * @returns {Object}
 */
function getDefaultQuoteTemplates() {
  return {
    'Japan': `Please find below the quotation for your recent order:
{items}

Sub total:{subtotal}
Shipping:{shipping}
TAX:{tax}

Total:{total} (Including Taxes)

Payment Method: {paymentMethod}
Payment Currency: JPY
Shipping Method: {shippingMethod}

Shipping: Your order will be shipped within 1–2 business days after payment confirmation.
Delivery: Estimated delivery within 2–3 days after shipment.
If you confirm that everything is in order, we will promptly prepare and send you the invoice for your first order.

We truly appreciate the opportunity to start our business relationship with you, and we look forward to working together.`,

    'United States': `Please find below the quotation for your recent order:
{items}

Sub total:{subtotal}
Shipping:{shipping}

TAX:{customsDuty}
MPF fee:{mpfFee}
DDP fee:{ddpFee}
Total Duty Amount:{totalTax}

Total:{total} (Including Duties and Taxes)

Payment Method: {paymentMethod}
Payment Currency: JPY
Shipping Method: {shippingMethod}

Shipping: Your order will be shipped within 1–2 business days after payment confirmation.
Delivery: Estimated delivery within 2–3 days after shipment.

Please note: For shipments to the US, our quoted prices are inclusive of import duties and taxes. We will handle customs clearance and pay the duties on your behalf, so there will be no additional charges upon delivery.
If you confirm that everything is in order, we will promptly prepare and send you the invoice for your first order.

We truly appreciate the opportunity to start our business relationship with you, and we look forward to working together.`,

    'Other': `Please find below the quotation for your recent order:
{items}

Sub total:{subtotal}
Shipping:{shipping}

Total:{total}

Payment Method: {paymentMethod}
Payment Currency: JPY
Shipping Method: {shippingMethod}

Shipping: Your order will be shipped within 1–2 business days after payment confirmation.
Delivery: Estimated delivery within 2–3 days after shipment.
If you confirm that everything is in order, we will promptly prepare and send you the invoice for your first order.

We truly appreciate the opportunity to start our business relationship with you, and we look forward to working together.`
  };
}

/**
 * ユーザー専用の請求書作成シートを取得または作成
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getUserInvoiceWorkSheet() {
  try {
    const ss = getSpreadsheet();
    const staffName = getStaffFullName();
    const sheetName = '請求書作成_' + staffName;

    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // シートが存在しない場合は作成
      Logger.log('[getUserInvoiceWorkSheet] 新規シート作成: ' + sheetName);
      sheet = ss.insertSheet(sheetName);

      // ヘッダー情報エリア（A1:B10）
      sheet.getRange('A1').setValue('顧客名');
      sheet.getRange('A2').setValue('顧客ID');
      sheet.getRange('A3').setValue('配送先国');
      sheet.getRange('A4').setValue('支払い方法');
      sheet.getRange('A5').setValue('発送方法');
      sheet.getRange('A6').setValue('備考');

      // ヘッダーのスタイル設定
      sheet.getRange('A1:A6').setFontWeight('bold');
      sheet.getRange('A1:B6').setBackground('#f3f4f6');

      // 空行
      sheet.getRange('A11').setValue('');

      // 商品明細ヘッダー（A12行目）
      const itemHeaders = [[
        'カテゴリ', '商品マーク', '商品名（英語）', '商品名（日本語）',
        'コンディション', '数量', '単価', '小計', '重量', '在庫数'
      ]];
      sheet.getRange('A12:J12').setValues(itemHeaders);
      sheet.getRange('A12:J12').setFontWeight('bold');
      sheet.getRange('A12:J12').setBackground('#dbeafe');

      // 金額集計エリア（L12以降）
      sheet.getRange('L12').setValue('商品小計');
      sheet.getRange('L13').setValue('配送料');
      sheet.getRange('L14').setValue('税金');
      sheet.getRange('L15').setValue('合計金額');
      sheet.getRange('L12:L15').setFontWeight('bold');
      sheet.getRange('L12:L15').setBackground('#fef3c7');

      // 数式を設定（M列に自動計算）
      sheet.getRange('M12').setFormula('=SUM(H13:H1000)');  // 商品小計
      sheet.getRange('M15').setFormula('=M12+M13+M14');     // 合計金額

      // 列幅を調整
      sheet.setColumnWidth(1, 100);  // カテゴリ
      sheet.setColumnWidth(2, 100);  // 商品マーク
      sheet.setColumnWidth(3, 200);  // 商品名（英語）
      sheet.setColumnWidth(4, 200);  // 商品名（日本語）
      sheet.setColumnWidth(5, 120);  // コンディション
      sheet.setColumnWidth(6, 80);   // 数量
      sheet.setColumnWidth(7, 100);  // 単価
      sheet.setColumnWidth(8, 100);  // 小計
      sheet.setColumnWidth(9, 80);   // 重量
      sheet.setColumnWidth(10, 80);  // 在庫数

      Logger.log('[getUserInvoiceWorkSheet] シート初期化完了');
    }

    return sheet;
  } catch (error) {
    Logger.log('[getUserInvoiceWorkSheet] エラー: ' + error.message);
    throw error;
  }
}

/**
 * フロントエンドの商品データを請求書作業シートに即時書き込み
 *
 * @param {number} rowIndex - 商品行インデックス（0始まり）
 * @param {Object} itemData - 商品データ
 * @returns {Object} { success: boolean }
 */
function syncInvoiceItemToSheet(rowIndex, itemData) {
  try {
    const sheet = getUserInvoiceWorkSheet();
    const sheetRow = 13 + rowIndex;  // 商品明細は13行目から開始

    sheet.getRange(sheetRow, 1, 1, 10).setValues([[
      itemData.category || '',
      itemData.mark || '',
      itemData.enTitle || '',
      itemData.jaTitle || '',
      itemData.status || '',
      itemData.quantity || 0,
      itemData.unitPrice || 0,
      itemData.subtotal || 0,
      itemData.weight || 0,
      itemData.maxQuantity || ''
    ]]);

    Logger.log('[syncInvoiceItemToSheet] 同期完了 - 行: ' + sheetRow + ', 商品: ' + itemData.enTitle);

    return { success: true };
  } catch (error) {
    Logger.log('[syncInvoiceItemToSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * ヘッダー情報を請求書作業シートに書き込み
 *
 * @param {Object} headerData - ヘッダーデータ
 * @returns {Object} { success: boolean }
 */
function syncInvoiceHeaderToSheet(headerData) {
  try {
    const sheet = getUserInvoiceWorkSheet();

    sheet.getRange('B1').setValue(headerData.customerName || '');
    sheet.getRange('B2').setValue(headerData.customerId || '');
    sheet.getRange('B3').setValue(headerData.country || '');
    sheet.getRange('B4').setValue(headerData.paymentMethod || '');
    sheet.getRange('B5').setValue(headerData.shippingMethod || '');
    sheet.getRange('B6').setValue(headerData.notes || '');

    // 金額集計
    sheet.getRange('M13').setValue(headerData.shipping || 0);
    sheet.getRange('M14').setValue(headerData.tax || 0);

    Logger.log('[syncInvoiceHeaderToSheet] ヘッダー同期完了 - 顧客: ' + headerData.customerName);

    return { success: true };
  } catch (error) {
    Logger.log('[syncInvoiceHeaderToSheet] エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 請求書PDFを生成してGoogle Driveに保存
 *
 * @returns {Object} { success: boolean, pdfData: string, filename: string, mimeType: string, driveFileId: string, driveFileUrl: string }
 */
/**
 * 見積もり・請求書の専用シートを初期化
 * ログイン中の担当者専用のシートを作成
 *
 * @returns {Object} { success: boolean, staffName: string, quoteSheetName: string, invoiceSheetName: string }
 */
function initializePersonalWorkSheets() {
  try {
    Logger.log('[initializePersonalWorkSheets] 専用シート初期化開始');

    const staffName = getStaffFullName();

    // 見積もり作成シートを取得/作成
    const quoteSheet = getUserQuoteWorkSheet();
    const quoteSheetName = quoteSheet.getName();

    // 請求書作成シートを取得/作成
    const invoiceSheet = getUserInvoiceWorkSheet();
    const invoiceSheetName = invoiceSheet.getName();

    Logger.log('[initializePersonalWorkSheets] 初期化完了');
    Logger.log('  担当者: ' + staffName);
    Logger.log('  見積もりシート: ' + quoteSheetName);
    Logger.log('  請求書シート: ' + invoiceSheetName);

    return {
      success: true,
      staffName: staffName,
      quoteSheetName: quoteSheetName,
      invoiceSheetName: invoiceSheetName
    };

  } catch (error) {
    Logger.log('[initializePersonalWorkSheets] エラー: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 見積もりPDFを生成してGoogle Driveに保存
 *
 * @returns {Object} { success: boolean, pdfData: string, filename: string, mimeType: string, driveFileId: string, driveFileUrl: string }
 */
function generateQuotePDF() {
  try {
    Logger.log('[generateQuotePDF] PDF生成開始');

    const ss = getSpreadsheet();
    const pdfSheet = ss.getSheetByName('見積もり_PDF出力');

    if (!pdfSheet) {
      Logger.log('[generateQuotePDF] 見積もり_PDF出力シートが見つかりません');
      return {
        success: false,
        message: '見積もり_PDF出力シートが見つかりません'
      };
    }

    // 顧客名を取得（ファイル名用）
    const customerName = pdfSheet.getRange('B9').getValue() || 'Quote';
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');

    // PDFのエクスポートURLを構築
    const spreadsheetId = ss.getId();
    const sheetId = pdfSheet.getSheetId();

    // PDFエクスポートのURLパラメータ
    // 余白：上1cm、左右0cm、下0.5cm（インチ単位）
    const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export' +
      '?format=pdf' +
      '&gid=' + sheetId +
      '&portrait=true' +  // 縦向き
      '&size=A4' +        // A4サイズ
      '&fitw=true' +      // 幅に合わせる
      '&gridlines=false' + // グリッド線なし
      '&printtitle=false' + // タイトル行なし
      '&sheetnames=false' + // シート名なし
      '&pagenum=false' +   // ページ番号なし
      '&attachment=false' + // インライン表示
      '&top_margin=0.39' +    // 上余白 1cm
      '&bottom_margin=0.20' + // 下余白 0.5cm
      '&left_margin=0' +      // 左余白 0cm
      '&right_margin=0';      // 右余白 0cm

    // OAuthトークンを取得
    const token = ScriptApp.getOAuthToken();

    // PDFをフェッチ
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    // PDFをBase64エンコード
    const pdfBlob = response.getBlob();
    const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    // ファイル名を生成
    const filename = 'Quote_' + customerName + '_' + timestamp + '.pdf';

    // PDFをGoogle Driveに保存
    Logger.log('[generateQuotePDF] PDFをGoogle Driveに保存中...');

    pdfBlob.setName(filename);
    const folderId = getQuotationFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const driveFile = folder.createFile(pdfBlob);

    const driveFileId = driveFile.getId();
    const driveFileUrl = driveFile.getUrl();

    Logger.log('[generateQuotePDF] PDF保存成功: ' + driveFileUrl);
    Logger.log('[generateQuotePDF] PDF生成成功: ' + filename);

    return {
      success: true,
      pdfData: pdfBase64,
      filename: filename,
      mimeType: 'application/pdf',
      size: pdfBlob.getBytes().length,
      driveFileId: driveFileId,
      driveFileUrl: driveFileUrl
    };

  } catch (error) {
    Logger.log('[generateQuotePDF] エラー: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 見積もり_PDF出力シートの構造データを取得（デバッグ用）
 */
function getQuotePDFSheetStructure() {
  return exportQuotePDFSheetData();
}

/**
 * クライアント側で生成されたPDFをGoogle Driveにアップロード
 *
 * @param {string} pdfBase64 - Base64エンコードされたPDFデータ
 * @param {string} filename - PDFファイル名
 * @returns {Object} { success: boolean, driveFileUrl: string, driveFileId: string, filename: string }
 */
function uploadQuotePDFToDrive(pdfBase64, filename) {
  try {
    Logger.log('[uploadQuotePDFToDrive] PDF保存開始: ' + filename);

    // Base64デコード
    const bytes = Utilities.base64Decode(pdfBase64);
    const blob = Utilities.newBlob(bytes, 'application/pdf', filename);

    // Google Driveに保存
    const folderId = getQuotationFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    const driveFileId = file.getId();
    const driveFileUrl = file.getUrl();

    Logger.log('[uploadQuotePDFToDrive] 保存成功: ' + driveFileUrl);

    return {
      success: true,
      driveFileUrl: driveFileUrl,
      driveFileId: driveFileId,
      filename: filename
    };

  } catch (error) {
    Logger.log('[uploadQuotePDFToDrive] エラー: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * GIDでシートを取得
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {number} gid - シートID (GID)
 * @returns {Sheet} シートオブジェクト
 */
function getSheetByGid(ss, gid) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) {
      return sheets[i];
    }
  }
  throw new Error('GID ' + gid + ' のシートが見つかりません');
}

/**
 * 見積もり作成シートにデータを書き込み、PDFを生成
 *
 * @param {Object} quoteData - 見積もりデータ
 * @returns {Object} { success: boolean, pdfUrl: string, pdfFilename: string, message: string }
 */
function writeQuoteToSheetAndGeneratePDF(quoteData) {
  try {
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 開始');
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 受信データ: ' + JSON.stringify(quoteData).substring(0, 200));

    // GID値をログ出力
    const env = getEnvironment();
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 環境: ' + env);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] QUOTE_CREATION_SHEET_GID: ' + PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] QUOTE_PDF_OUTPUT_SHEET_GID: ' + PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID);

    // 環境に応じた正しいスプレッドシートを取得
    const ss = getSpreadsheet();
    Logger.log('[writeQuoteToSheetAndGeneratePDF] スプレッドシート取得成功: ' + ss.getName() + ' (ID: ' + ss.getId() + ')');

    // GIDでシートを取得
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 見積もり作成シートを取得中...');
    const quoteSheet = getSheetByGid(ss, PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 見積もり作成シート取得成功: ' + (quoteSheet ? quoteSheet.getName() : 'null'));

    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF出力シートを取得中...');
    const pdfSheet = getSheetByGid(ss, PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF出力シート取得成功: ' + (pdfSheet ? pdfSheet.getName() : 'null'));

    // ★ ヘッダーマッピングを取得（列順序に依存しない）
    const cols = getQuoteCreationColumns(quoteSheet);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 列マッピング取得完了');

    // 1. 見積もり作成シートをクリア（既存データを削除）
    clearQuoteCreationSheet(quoteSheet);

    // 2. 商品データを書き込み（2行目から）
    if (quoteData.items && quoteData.items.length > 0) {
      Logger.log(`[writeQuoteToSheetAndGeneratePDF] 商品データ書き込み開始: ${quoteData.items.length}件`);

      const maxItems = 20; // 最大20行
      for (let i = 0; i < Math.min(quoteData.items.length, maxItems); i++) {
        const item = quoteData.items[i];
        const row = QUOTE_ITEMS_START_ROW + i;

        Logger.log(`[商品${i + 1}/${quoteData.items.length}] 処理中 - category: ${item.category}, mark: ${item.mark}, status: ${item.status}, qty: ${item.quantity}`);

        // No.
        quoteSheet.getRange(row, cols.NO).setValue(i + 1);

        // カテゴリ
        if (item.category) {
          quoteSheet.getRange(row, cols.CATEGORY).setValue(item.category);
        }

        // コンディション
        if (item.status) {
          quoteSheet.getRange(row, cols.CONDITION).setValue(item.status);
        }

        // 商品マーク
        const mark = item.mark || null;
        if (mark) {
          quoteSheet.getRange(row, cols.PRODUCT_MARK).setValue(mark);
          Logger.log(`[商品${i + 1}] 商品マーク: "${mark}"`);
        }

        // 商品英語名
        const enTitle = item.productName || null;
        if (enTitle) {
          quoteSheet.getRange(row, cols.PRODUCT_EN_TITLE).setValue(enTitle);
          Logger.log(`[商品${i + 1}] 商品英語名: "${enTitle}"`);
        }

        // Description列（見積もり用商品名: カテゴリ マーク 英語名 コンディション）
        const category = item.category || '';
        const condition = item.status || '';
        if (category || mark || enTitle || condition) {
          const description = `${category} ${mark} ${enTitle} ${condition}`.trim();
          quoteSheet.getRange(row, cols.DESCRIPTION).setValue(description);
          Logger.log(`[商品${i + 1}] Description: "${description}"`);
        }

        // 個数
        if (item.quantity) {
          quoteSheet.getRange(row, cols.QUANTITY).setValue(item.quantity);
        }

        // 重量
        if (item.weight) {
          quoteSheet.getRange(row, cols.WEIGHT).setValue(item.weight);
        }

        // 単価
        if (item.unitPrice) {
          quoteSheet.getRange(row, cols.UNIT_PRICE).setValue(item.unitPrice);
        }

        // 小計（合計）
        if (item.subtotal) {
          quoteSheet.getRange(row, cols.SUBTOTAL).setValue(item.subtotal);
        }

        // 在庫数
        if (item.maxQuantity) {
          quoteSheet.getRange(row, cols.STOCK_QUANTITY).setValue(item.maxQuantity);
        }

        Logger.log(`[商品${i + 1}] 書き込み完了`);
      }

      Logger.log(`[writeQuoteToSheetAndGeneratePDF] 商品データ書き込み完了: ${Math.min(quoteData.items.length, maxItems)}件`);
    }

    // 4. 設定データを書き込み（設定項目・値列）
    // 顧客名
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.CUSTOMER_NAME, cols.SETTING_KEY).setValue('顧客名');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.CUSTOMER_NAME, cols.SETTING_VALUE).setValue(quoteData.customerName || '');

    // 国
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.COUNTRY, cols.SETTING_KEY).setValue('国');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.COUNTRY, cols.SETTING_VALUE).setValue(quoteData.country || '');

    // 支払い方法
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_METHOD, cols.SETTING_KEY).setValue('支払い方法');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_METHOD, cols.SETTING_VALUE).setValue(quoteData.paymentMethod || '');

    // 発送方法
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SHIPPING_METHOD, cols.SETTING_KEY).setValue('発送方法');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SHIPPING_METHOD, cols.SETTING_VALUE).setValue(quoteData.shippingMethod || '');

    // 小計
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SUBTOTAL, cols.SETTING_KEY).setValue('小計');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SUBTOTAL, cols.SETTING_VALUE).setValue(quoteData.subtotal || 0);

    // 送料
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SHIPPING, cols.SETTING_KEY).setValue('送料');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.SHIPPING, cols.SETTING_VALUE).setValue(quoteData.shipping || 0);

    // 税
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.TAX, cols.SETTING_KEY).setValue('税');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.TAX, cols.SETTING_VALUE).setValue(quoteData.tax || 0);

    // 合計
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.TOTAL, cols.SETTING_KEY).setValue('合計');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.TOTAL, cols.SETTING_VALUE).setValue(quoteData.total || 0);

    // 支払い通貨
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_CURRENCY, cols.SETTING_KEY).setValue('支払い通貨');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_CURRENCY, cols.SETTING_VALUE).setValue(quoteData.paymentCurrency || 'JPY');

    // 為替レート（通貨マスタから取得）
    var legacyQuoteCurrency = String(quoteData.paymentCurrency || 'JPY').trim().toUpperCase();
    var legacyQuoteRate = getCurrentExchangeRate(legacyQuoteCurrency);
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.EXCHANGE_RATE, cols.SETTING_KEY).setValue('為替レート');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.EXCHANGE_RATE, cols.SETTING_VALUE).setValue(legacyQuoteRate);

    // 請求書発行日（本日）
    const today = new Date();
    const issueDateStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy年MM月dd日');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.ISSUE_DATE, cols.SETTING_KEY).setValue('請求書発行日');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.ISSUE_DATE, cols.SETTING_VALUE).setValue(issueDateStr);

    // 支払い期日（2日後）
    const dueDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dueDateStr = Utilities.formatDate(dueDate, 'Asia/Tokyo', 'yyyy年MM月dd日');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_DUE_DATE, cols.SETTING_KEY).setValue('支払い期日');
    quoteSheet.getRange(QUOTE_SETTINGS_ROWS.PAYMENT_DUE_DATE, cols.SETTING_VALUE).setValue(dueDateStr);

    Logger.log('[writeQuoteToSheetAndGeneratePDF] 設定データ書き込み完了（支払い通貨: ' + legacyQuoteCurrency + ', 為替レート: ' + legacyQuoteRate + ', 発行日: ' + issueDateStr + ', 支払期日: ' + dueDateStr + '）');

    // スプレッドシートの再計算を待つ
    Logger.log('[writeQuoteToSheetAndGeneratePDF] スプレッドシート再計算待機中...');
    SpreadsheetApp.flush();
    Utilities.sleep(2000); // 2秒待機
    Logger.log('[writeQuoteToSheetAndGeneratePDF] 再計算完了');

    // 5. PDF出力シートをPDFとして出力
    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF生成開始');
    const customerName = quoteData.customerName || 'Customer';
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
    const pdfFilename = 'Quote_' + customerName + '_' + timestamp + '.pdf';

    // 特定のシート（見積もり_PDF出力）をPDFとしてエクスポート
    // 環境に応じたスプレッドシートIDを使用
    const ssId = ss.getId();
    const sheetGid = PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID;

    // PDF出力用のURLを構築
    const pdfUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=pdf&gid=' + sheetGid +
      '&size=A4' +           // A4サイズ
      '&portrait=true' +     // 縦向き
      '&fitw=true' +         // 幅に合わせる
      '&gridlines=false' +   // グリッド線を非表示
      '&printtitle=false' +  // タイトル行を印刷しない
      '&pagenum=CENTER' +    // ページ番号を中央に
      '&attachment=false';   // ブラウザで開く

    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF URL: ' + pdfUrl);

    // OAuth2トークンを取得してPDFをダウンロード
    Logger.log('[writeQuoteToSheetAndGeneratePDF] OAuth2トークン取得中...');
    const token = ScriptApp.getOAuthToken();
    Logger.log('[writeQuoteToSheetAndGeneratePDF] トークン取得成功、PDFダウンロード中...');

    const response = UrlFetchApp.fetch(pdfUrl, {
      headers: {
        'Authorization': 'Bearer ' + token
      },
      muteHttpExceptions: true
    });

    Logger.log('[writeQuoteToSheetAndGeneratePDF] レスポンス受信: ' + response.getResponseCode());

    if (response.getResponseCode() !== 200) {
      Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF生成エラー: ' + response.getContentText());
      throw new Error('PDF生成失敗: ' + response.getContentText());
    }

    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF Blob作成中...');
    const pdfBlob = response.getBlob().setName(pdfFilename);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF Blob作成成功: ' + pdfFilename);

    // Google Driveに保存
    const folderId = getQuotationFolderId();
    Logger.log('[writeQuoteToSheetAndGeneratePDF] Google Driveフォルダ取得中: ' + folderId);
    const folder = DriveApp.getFolderById(folderId);
    Logger.log('[writeQuoteToSheetAndGeneratePDF] フォルダ取得成功、PDFファイル作成中...');

    const pdfFile = folder.createFile(pdfBlob);
    const pdfFileId = pdfFile.getId();

    // ブラウザで直接PDF表示するための /preview URL
    const pdfPreviewUrl = 'https://drive.google.com/file/d/' + pdfFileId + '/preview';
    // 管理用のビューURL（念のため残す）
    const pdfViewUrl = pdfFile.getUrl();

    Logger.log('[writeQuoteToSheetAndGeneratePDF] PDF生成成功');
    Logger.log('  - Preview URL: ' + pdfPreviewUrl);
    Logger.log('  - View URL: ' + pdfViewUrl);

    return {
      success: true,
      pdfUrl: pdfPreviewUrl,  // ブラウザ直接表示用URL
      pdfViewUrl: pdfViewUrl, // 管理用URL
      pdfFileId: pdfFileId,
      pdfFilename: pdfFilename,
      message: 'PDFを生成しました'
    };

  } catch (error) {
    Logger.log('[writeQuoteToSheetAndGeneratePDF] エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 見積もり作成シートをクリア
 * @param {Sheet} sheet - 見積もり作成シート
 */
function clearQuoteCreationSheet(sheet) {
  // クリア範囲をS列（19列目：発送情報_値）までに限定
  // T列U列以降は保護される（追加情報保存用）
  const clearMaxRow = 21; // 21行目まで（22行目以降はカウンター保存用）

  // A列〜S列を全てクリア（見積書はO列・R列の項目名書き出し不要）
  // 2026-02-12更新: 3列追加（L列:品目、M列:HSコード、N列:素材）のため、16列→19列に変更
  sheet.getRange(2, 1, clearMaxRow - 1, 19).clearContent();

  Logger.log('[clearQuoteCreationSheet] クリア範囲: A2:S21 (T列U列以降・22行目以降は保護)');
}

// ============================================================
// 見積もり履歴管理API
// ============================================================

/**
 * 見積もり保存API（フロントエンド用）
 *
 * @param {Object} quoteFormData フロントエンドからの見積もりフォームデータ
 * @return {Object} 保存結果
 */
function saveQuoteFromForm(quoteFormData) {
  try {
    Logger.log('[saveQuoteFromForm] 見積もり保存開始');

    // フロントエンドのデータ形式をバックエンド形式に変換
    const quoteData = {
      customerName: quoteFormData.customerName || '',
      leadId: quoteFormData.leadId || '',
      country: quoteFormData.country || '',
      shippingMethod: quoteFormData.shippingMethod || '',
      paymentMethod: quoteFormData.paymentMethod || '',
      subtotal: quoteFormData.subtotal || 0,
      shipping: quoteFormData.shipping || 0,
      total: quoteFormData.total || 0,
      totalWeight: quoteFormData.totalWeight || 0,
      exchangeRate: getCurrentExchangeRate(String(quoteFormData.paymentCurrency || quoteFormData.currency || 'JPY').trim().toUpperCase()),
      memo: quoteFormData.memo || '',
      items: []
    };

    // 商品明細を変換
    Logger.log('[saveQuoteFromForm] 受信した商品数: ' + quoteFormData.items.length);

    quoteFormData.items.forEach((item, index) => {
      // デバッグログ: 各商品の状態を確認
      Logger.log(`[商品${index + 1}] product: ${!!item.product}, status: "${item.status}", quantity: ${item.quantity}`);

      // 商品が選択されている行のみ
      if (item.product && item.status && item.quantity > 0) {
        quoteData.items.push({
          category: item.category || item.product.category,
          productName: item.product.mark + '-' + item.product.enTitle,
          productMark: item.product.mark,        // 追加: markを別フィールドで保存
          productEnTitle: item.product.enTitle,  // 追加: enTitleを別フィールドで保存
          condition: item.status,
          quantity: item.quantity,
          weight: item.weight || 0,
          unitPrice: item.unitPrice || 0,
          subtotal: item.subtotal || 0
        });
        Logger.log(`  ✅ 商品${index + 1}を保存: ${item.product.mark}-${item.product.enTitle}`);
      } else {
        Logger.log(`  ❌ 商品${index + 1}をスキップ`);
      }
    });

    Logger.log('[saveQuoteFromForm] 保存する商品数: ' + quoteData.items.length);

    if (quoteData.items.length === 0) {
      return {
        success: false,
        message: '商品が選択されていません'
      };
    }

    // 見積もり保存サービスを呼び出し
    const result = saveQuote(quoteData);

    return result;

  } catch (error) {
    Logger.log('[saveQuoteFromForm] エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もり読み込みAPI（フロントエンド用）
 *
 * @param {string} quoteId 見積書ID
 * @return {Object} 見積もりデータ（フロントエンド形式）
 */
function loadQuoteForForm(quoteId) {
  try {
    Logger.log('[loadQuoteForForm] 見積もり読み込み: ' + quoteId);

    const result = getQuoteById(quoteId);

    if (!result.success) {
      return result;
    }

    const quote = result.quote;

    // バックエンド形式からフロントエンド形式に変換
    const formData = {
      customerName: quote.customerName,
      leadId: quote.leadId,
      country: quote.country,
      shippingMethod: quote.shippingMethod,
      paymentMethod: quote.paymentMethod,
      subtotal: quote.subtotal,
      shipping: quote.shipping,
      total: quote.total,
      totalWeight: quote.totalWeight,
      exchangeRate: quote.exchangeRate,
      memo: quote.memo,
      items: []
    };

    // 全商品のコンディションマップを取得（一度だけ）
    const productConditionsMap = getAllProductConditionsMap();

    // 商品明細を変換
    quote.items.forEach(item => {
      // 新フォーマット: productMark と productEnTitle が分離されている
      const mark = item.productMark || '';
      const enTitle = item.productEnTitle || '';

      // productSearch を構築（mark + " - " + enTitle）
      const productSearch = mark && enTitle ? `${mark} - ${enTitle}` : (mark || enTitle);

      // この商品の利用可能なコンディションを取得
      const key = item.category + '-' + mark + '-' + String(enTitle).trim();
      const availableStatuses = productConditionsMap[key] || [item.condition];

      Logger.log('[loadQuoteForForm] 商品: ' + key + ', availableStatuses: ' + JSON.stringify(availableStatuses));

      formData.items.push({
        category: item.category,
        product: {
          category: item.category,
          mark: mark,
          enTitle: enTitle
        },
        productSearch: productSearch,
        status: item.condition,
        quantity: item.quantity,
        weight: item.weight,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        availableStatuses: availableStatuses,
        maxQuantity: null,
        quantityError: false
      });
    });

    // Date型を文字列に変換（google.script.run のシリアライゼーション対策）
    const createdDateStr = quote.createdDate instanceof Date ? quote.createdDate.toISOString() : quote.createdDate;
    const expiryDateStr = quote.expiryDate instanceof Date ? quote.expiryDate.toISOString() : quote.expiryDate;

    return {
      success: true,
      quote: formData,
      quoteId: quoteId,
      createdDate: createdDateStr,
      expiryDate: expiryDateStr
    };

  } catch (error) {
    Logger.log('[loadQuoteForForm] エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もり一覧取得API（フロントエンド用）
 *
 * @param {Object} options オプション {limit, offset, leadId}
 * @return {Object} 見積もり一覧
 */
function getQuotesForList(options) {
  try {
    Logger.log('[getQuotesForList] 見積もり一覧取得開始');
    Logger.log('[getQuotesForList] options: ' + JSON.stringify(options));

    const result = getAllQuotes(options);

    if (result === null || result === undefined) {
      Logger.log('[getQuotesForList] ⚠️ getAllQuotes returned null or undefined!');
      return {
        success: false,
        error: 'getAllQuotes returned null'
      };
    }

    if (!result.success) {
      Logger.log('[getQuotesForList] ⚠️ getAllQuotes returned error: ' + result.error);
      return result;
    }

    // Date型を文字列に変換（google.script.run のシリアライゼーション対策）
    if (result.quotes && result.quotes.length > 0) {
      result.quotes = result.quotes.map(quote => {
        const serializedQuote = {};
        for (const key in quote) {
          const value = quote[key];
          if (value instanceof Date) {
            // Date型を ISO 8601 形式の文字列に変換
            serializedQuote[key] = value.toISOString();
          } else {
            serializedQuote[key] = value;
          }
        }
        return serializedQuote;
      });
      Logger.log('[getQuotesForList] ✅ Date型をシリアライズしました');
    }

    Logger.log('[getQuotesForList] ✅ 正常終了 - quotes: ' + result.quotes.length + '件');
    return result;

  } catch (error) {
    Logger.log('[getQuotesForList] ❌ エラー: ' + error.message);
    Logger.log('[getQuotesForList] スタック: ' + error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// 請求書PDF生成API（フロントエンド用）
// ============================================================

/**
 * 請求書PDFを生成（フロントエンド用）
 *
 * @param {Object} invoiceFormData - フロントエンドからの請求書フォームデータ
 * @returns {Object} { success, pdfUrl, pdfFilename, message }
 */
function generateInvoicePDFFromForm(invoiceFormData) {
  try {
    Logger.log('[generateInvoicePDFFromForm] 請求書PDF生成開始');
    Logger.log('[generateInvoicePDFFromForm] 受信データ - 顧客名: ' + invoiceFormData.customerName);
    Logger.log('[generateInvoicePDFFromForm] 受信データ - 支払い名義: ' + invoiceFormData.paymentName);
    Logger.log('[generateInvoicePDFFromForm] 受信データ - リードID: ' + invoiceFormData.leadId);
    Logger.log('[generateInvoicePDFFromForm] 受信データ - 営業担当者: ' + invoiceFormData.salesRep);
    Logger.log('[generateInvoicePDFFromForm] 受信データ - 顧客発送時メモ: ' + invoiceFormData.customerShippingMemo);

    // フロントエンドデータをバックエンド形式に変換
    const invoiceData = {
      invoiceId: invoiceFormData.invoiceId || null,
      customerName: invoiceFormData.customerName || '',
      leadId: invoiceFormData.leadId || '',
      country: invoiceFormData.country || '',
      shippingMethod: invoiceFormData.shippingMethod || '',
      paymentMethod: invoiceFormData.paymentMethod || '',
      subtotal: invoiceFormData.subtotal || 0,
      shipping: invoiceFormData.shipping || 0,
      tax: invoiceFormData.tax || 0,
      total: invoiceFormData.total || 0,
      totalWeight: invoiceFormData.totalWeight || 0,
      exchangeRate: getCurrentExchangeRate(String(invoiceFormData.paymentCurrency || invoiceFormData.currency || 'JPY').trim().toUpperCase()),
      memo: invoiceFormData.memo || '',
      // 顧客マスタ連携項目（L16-L19）を追加
      paymentName: invoiceFormData.paymentName || '',
      salesRep: invoiceFormData.salesRep || '',
      customerShippingMemo: invoiceFormData.customerShippingMemo || '',
      items: [],
      // 発送先情報を追加
      shippingInfo: invoiceFormData.shippingInfo || {
        recipientName: '',
        phone: '',
        email: '',
        taxNumber: '',
        address1: '',
        address2: '',
        address3: '',
        city: '',
        state: '',
        zipCode: '',
        shippingMemo: ''
      }
    };

    // 商品明細を変換
    Logger.log('[generateInvoicePDFFromForm] 受信した商品数: ' + invoiceFormData.items.length);

    invoiceFormData.items.forEach((item, index) => {
      Logger.log(`[商品${index + 1}] product: ${!!item.product}, status: "${item.status}", quantity: ${item.quantity}`);

      // 商品が選択されている行のみ
      if (item.product && item.status && item.quantity > 0) {
        invoiceData.items.push({
          category: item.category || item.product.category,
          mark: item.product.mark,
          productName: item.product.enTitle,
          status: item.status,
          quantity: item.quantity,
          weight: item.weight || 0,
          unitPrice: item.unitPrice || 0,
          subtotal: item.subtotal || 0,
          maxQuantity: item.maxQuantity || null
        });
        Logger.log(`  ✅ 商品${index + 1}を変換: ${item.product.mark}-${item.product.enTitle}`);
      } else {
        Logger.log(`  ❌ 商品${index + 1}をスキップ`);
      }
    });

    Logger.log('[generateInvoicePDFFromForm] 変換後の商品数: ' + invoiceData.items.length);

    if (invoiceData.items.length === 0) {
      return {
        success: false,
        message: '商品が選択されていません'
      };
    }

    // 請求書シートに書き込み、PDF生成
    const result = writeInvoiceToSheetAndGeneratePDF(invoiceData);

    return result;

  } catch (error) {
    Logger.log('[generateInvoicePDFFromForm] エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 会話ログの翻訳文を更新
 * @param {string} logId - ログID
 * @param {string} newTranslation - 新しい翻訳文
 * @return {Object} 結果オブジェクト
 */
function updateConversationLogTranslation(logId, newTranslation) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      throw new Error('スプレッドシートが取得できません');
    }

    const sheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);
    if (!sheet) {
      throw new Error('会話ログシートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 列インデックス取得
    const logIdIdx = headers.indexOf('ログID');
    const translationIdx = headers.indexOf('翻訳文');

    if (logIdIdx === -1 || translationIdx === -1) {
      throw new Error('必要な列が見つかりません');
    }

    // ログIDで行を検索
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][logIdIdx] === logId) {
        targetRow = i + 1; // スプレッドシートの行番号（1始まり）
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('ログID: ' + logId + ' が見つかりません');
    }

    // 翻訳文を更新
    sheet.getRange(targetRow, translationIdx + 1).setValue(newTranslation);

    Logger.log('[updateConversationLogTranslation] ログID: ' + logId + ' の翻訳文を更新しました');

    return {
      success: true,
      message: '翻訳文を更新しました',
      logId: logId
    };

  } catch (error) {
    Logger.log('[updateConversationLogTranslation] エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * メッセージテンプレート一覧を取得（フロントエンド公開用）
 * @returns {Array} テンプレート配列
 */
function getMessageTemplates() {
  return getMessageTemplates_service();
}

/**
 * メッセージテンプレート全件取得（管理ページ用・有効フラグ問わず）
 * @returns {Array} 全テンプレート配列
 */
function getAllMessageTemplates() {
  return getAllMessageTemplates_service();
}

/**
 * メッセージテンプレートを新規作成
 * @param {Object} data - テンプレートデータ
 * @returns {Object} { success, templateId, message }
 */
function createTemplate(data) {
  return createTemplate_service(data);
}

/**
 * メッセージテンプレートを更新
 * @param {string} id - テンプレートID
 * @param {Object} data - 更新データ
 * @returns {Object} { success, message }
 */
function updateTemplate(id, data) {
  return updateTemplate_service(id, data);
}

/**
 * メッセージテンプレートを削除
 * @param {string} id - テンプレートID
 * @returns {Object} { success, message }
 */
function deleteTemplate(id) {
  return deleteTemplate_service(id);
}
// ========== 権限管理 API ==========

/**
 * 全役割の権限設定を取得
 * @returns {Object} 権限設定データ
 */
function getPermissions() {
  return getAllPermissions();
}

/**
 * 役割の権限を更新
 * @param {string} roleName - 役割名
 * @param {Object} permissions - 権限オブジェクト
 * @returns {Object} 更新結果
 */
function saveRolePermissions(roleName, permissions) {
  return updateRolePermissions(roleName, permissions);
}

/**
 * 新しい役割を追加
 * @param {string} roleName - 役割名
 * @returns {Object} 追加結果
 */
function addRole(roleName) {
  return addNewRole(roleName);
}

/**
 * 役割を削除
 * @param {string} roleName - 役割名
 * @returns {Object} 削除結果
 */
function removeRole(roleName) {
  return deleteRole(roleName);
}

// ========== デバッグ関数 ==========

/**
 * デバッグ: 在庫データのカテゴリ取得状況を確認
 */
function testDebugStockCategories() {
  try {
    const result = getStockData();
    Logger.log('✅ getStockData()の結果:');
    Logger.log('データ件数: ' + result.data.length);
    Logger.log('カテゴリ数: ' + result.categories.length);
    Logger.log('カテゴリ一覧: ' + JSON.stringify(result.categories));

    Logger.log('');
    Logger.log('📦 最初の10件のデータ:');
    for (var i = 0; i < Math.min(10, result.data.length); i++) {
      var item = result.data[i];
      Logger.log('  ' + (i + 1) + '. Category: "' + item.category + '", Mark: "' + item.mark + '", Title: "' + item.enTitle + '"');
    }

    return {
      success: true,
      dataCount: result.data.length,
      categories: result.categories,
      categoriesCount: result.categories.length
    };
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    Logger.log(e.stack);
    return { success: false, error: e.message, stack: e.stack };
  }
}

/**
 * デバッグ: IMPORTRANGE数式を確認
 */
function checkImportRangeFormula() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var syncSheet = ss.getSheetByName(CONFIG.SHEETS.SCM_STOCK_SYNC);

    if (!syncSheet) {
      Logger.log('❌ 集計同期シートが見つかりません');
      return { success: false, error: '集計同期シートが見つかりません' };
    }

    // A1セルの数式を取得
    var a1Formula = syncSheet.getRange('A1').getFormula();
    Logger.log('📋 A1セルの数式:');
    Logger.log(a1Formula);

    // ヘッダー行を取得
    var lastColumn = syncSheet.getLastColumn();
    var headers = syncSheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    Logger.log('');
    Logger.log('📊 集計同期シートのヘッダー (' + lastColumn + '列):');
    for (var i = 0; i < headers.length; i++) {
      var colLetter = String.fromCharCode(65 + (i % 26));
      if (i >= 26) {
        colLetter = String.fromCharCode(64 + Math.floor(i / 26)) + colLetter;
      }
      Logger.log('  ' + colLetter + '列 (' + (i + 1) + '): "' + headers[i] + '"');
    }

    // Categoryカラムを探す
    var categoryIdx = -1;
    var categoryTargets = ['Category', 'カテゴリ', '分類'];
    for (var j = 0; j < categoryTargets.length; j++) {
      categoryIdx = headers.findIndex(function(h) {
        return String(h).toLowerCase().trim() === categoryTargets[j].toLowerCase();
      });
      if (categoryIdx !== -1) {
        Logger.log('');
        Logger.log('✅ Categoryカラム見つかりました: 列' + (categoryIdx + 1) + ' ("' + headers[categoryIdx] + '")');
        break;
      }
    }

    if (categoryIdx === -1) {
      Logger.log('');
      Logger.log('❌ Categoryカラムが見つかりません！');
    }

    // データのサンプル確認（最初の5行）
    Logger.log('');
    Logger.log('📦 データサンプル（最初の5行）:');
    var dataRange = syncSheet.getRange(2, 1, Math.min(5, syncSheet.getLastRow() - 1), lastColumn);
    var data = dataRange.getValues();

    for (var row = 0; row < data.length; row++) {
      Logger.log('  行' + (row + 2) + ':');
      for (var col = 0; col < Math.min(5, data[row].length); col++) {
        Logger.log('    ' + headers[col] + ': "' + data[row][col] + '"');
      }
      if (categoryIdx !== -1) {
        Logger.log('    [Category]: "' + data[row][categoryIdx] + '"');
      }
    }

    return {
      success: true,
      formula: a1Formula,
      headers: headers,
      headerCount: lastColumn,
      categoryIndex: categoryIdx,
      categoryFound: categoryIdx !== -1
    };

  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    Logger.log(e.stack);
    return { success: false, error: e.message, stack: e.stack };
  }
}

/**
 * GAS呼び出し固定コスト計測用（[TEMP] 計測後に削除）。
 * 認証なし・シート読み込みなし・即 return。
 */
function pingForLatencyCheck() {
  return { ok: true, serverTs: Date.now() };
}
