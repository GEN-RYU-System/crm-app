/**
 * Discordチャンネルセットアップ API
 * カテゴリ・ticket-startチャンネルの自動作成をフロントエンドに提供
 *
 * セキュリティ制約:
 * - 全関数に checkPermission('admin_access') でガード
 * - Logger.log に DISCORD_BOT_TOKEN の値を渡さない（絶対禁止）
 * - フロントエンドにトークン本体を返さない
 */

// ============================================================
// 内部定数
// ============================================================

var DISCORD_SETUP_CATEGORY_NAME = 'GEN-RYU CRM';
var DISCORD_SETUP_TICKET_CHANNEL_NAME = 'crm-tickets';
var DISCORD_API_BASE = 'https://discord.com/api/v10';

// カテゴリ/ロール名: 顧客規模値と1対1で対応
var DISCORD_CUSTOMER_CATEGORY_NAME = 'Customer';
var DISCORD_PARTNER_CATEGORY_NAME = 'Partner';
var DISCORD_CUSTOMER_ROLE_NAME = 'Customer';
var DISCORD_PARTNER_ROLE_NAME = 'Partner';

// ============================================================
// 内部ヘルパー: Discord API 呼び出し
// ============================================================

/**
 * Discord APIエラーレスポンスから安全なサマリ文字列を作る（機密値を含まない）
 * @param {any} data - discordRequest_ の data フィールド
 * @returns {string} e.g. " [discord_code=50013: Missing Permissions]"
 */
function discordErrorDetail_(data) {
  if (data && typeof data === 'object' && data.code !== undefined) {
    return ' [discord_code=' + data.code + ': ' + (data.message || '') + ']';
  }
  if (typeof data === 'string' && data.length > 0 && data.length < 300) {
    return ' [body: ' + data + ']';
  }
  return '';
}

/**
 * @param {string} botToken
 * @param {string} method  - 'get' | 'post' | 'patch'
 * @param {string} path    - '/guilds/...' など
 * @param {Object|null} body
 * @returns {{ statusCode: number, data: any }}
 */
function discordRequest_(botToken, method, path, body) {
  var options = {
    method: method,
    headers: {
      'Authorization': 'Bot ' + botToken,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  if (body !== null && body !== undefined) {
    options.payload = JSON.stringify(body);
  }
  var response = UrlFetchApp.fetch(DISCORD_API_BASE + path, options);
  var statusCode = response.getResponseCode();
  var data = null;
  try {
    data = JSON.parse(response.getContentText());
  } catch (e) {
    data = response.getContentText();
  }
  return { statusCode: statusCode, data: data };
}

// ============================================================
// 内部ヘルパー: 既存チャンネル検索
// ============================================================

/**
 * ギルドのチャンネル一覧から名前・typeが一致するものを返す
 * @param {string} botToken
 * @param {string} guildId
 * @param {string} name
 * @param {number} type  - 0=text, 4=category
 * @returns {{ id: string }|null}
 */
function findExistingChannel_(botToken, guildId, name, type) {
  var result = discordRequest_(botToken, 'get', '/guilds/' + guildId + '/channels', null);
  if (result.statusCode !== 200) {
    Logger.log('findExistingChannel_: チャンネル一覧取得エラー status=' + result.statusCode + discordErrorDetail_(result.data));
    return null;
  }
  var channels = result.data;
  if (!Array.isArray(channels)) return null;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].name === name && channels[i].type === type) {
      return channels[i];
    }
  }
  return null;
}

// ============================================================
// 内部ヘルパー: permission_overwrites を設定
// ============================================================

/**
 * チャンネルに @everyone deny / Bot allow のpermission_overwritesを設定
 * VIEW_CHANNEL=1024, SEND_MESSAGES=2048, READ_MESSAGE_HISTORY=65536
 * @param {string} botToken
 * @param {string} channelId
 * @param {string} guildId   - @everyoneのrole_id = guild_id
 * @param {string} botId
 */
function applyPermissionOverwrites_(botToken, channelId, guildId, botId) {
  var VIEW_CHANNEL = 1024;
  var SEND_MESSAGES = 2048;
  var READ_MESSAGE_HISTORY = 65536;

  // @everyone: VIEW_CHANNEL deny
  var everyoneResult = discordRequest_(
    botToken,
    'put',
    '/channels/' + channelId + '/permissions/' + guildId,
    {
      type: 0,
      allow: '0',
      deny: String(VIEW_CHANNEL)
    }
  );
  if (everyoneResult.statusCode !== 204) {
    Logger.log('applyPermissionOverwrites_: @everyone deny 設定エラー status=' + everyoneResult.statusCode + discordErrorDetail_(everyoneResult.data));
  }

  // Bot: VIEW_CHANNEL + SEND_MESSAGES + READ_MESSAGE_HISTORY allow
  var botAllow = VIEW_CHANNEL + SEND_MESSAGES + READ_MESSAGE_HISTORY;
  var botResult = discordRequest_(
    botToken,
    'put',
    '/channels/' + channelId + '/permissions/' + botId,
    {
      type: 1,
      allow: String(botAllow),
      deny: '0'
    }
  );
  if (botResult.statusCode !== 204) {
    Logger.log('applyPermissionOverwrites_: Bot allow 設定エラー status=' + botResult.statusCode + discordErrorDetail_(botResult.data));
  }
}

// ============================================================
// 内部ヘルパー: Discordロール検索・作成
// ============================================================

/**
 * ギルドのロール一覧から同名ロールを返す
 * @param {string} botToken
 * @param {string} guildId
 * @param {string} name
 * @returns {{ id: string }|null}
 */
function findExistingRole_(botToken, guildId, name) {
  var result = discordRequest_(botToken, 'get', '/guilds/' + guildId + '/roles', null);
  if (result.statusCode !== 200) {
    Logger.log('findExistingRole_: ロール一覧取得エラー status=' + result.statusCode + discordErrorDetail_(result.data));
    return null;
  }
  var roles = result.data;
  if (!Array.isArray(roles)) return null;
  for (var i = 0; i < roles.length; i++) {
    if (roles[i].name === name) return roles[i];
  }
  return null;
}

/**
 * 顧客マスタシートに「顧客規模」列が存在しない場合、末尾に追加する（冪等）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function ensureCustomerScaleColumn_(ss) {
  var scalHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_SCALE');
  var sheet = ss.getSheetByName('顧客マスタ');
  if (!sheet) {
    Logger.log('ensureCustomerScaleColumn_: 顧客マスタシートが見つかりません');
    return;
  }
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf(scalHeader) !== -1) return; // 既存
  sheet.getRange(1, lastCol + 1).setValue(scalHeader);
  Logger.log('ensureCustomerScaleColumn_: 顧客規模列を追加しました (col=' + (lastCol + 1) + ')');
}

/**
 * 顧客マスタに顧客規模列を追加するスキーママイグレーション（冪等・clasp run 用）
 * Core Schema V1 CUSTOMERS.CUSTOMER_SCALE が実シートに存在しない場合に手動実行する
 */
function runEnsureCustomerScaleColumn() {
  ensureCustomerScaleColumn_(getSpreadsheet());
  return 'done';
}

// ============================================================
// runDiscordAutoSetup
// ============================================================

/**
 * Discord カテゴリ・ticket-start チャンネルを自動作成する
 * 冪等: 同名の既存チャンネル/カテゴリがある場合はそのIDを使用
 * @param {string} sessionId
 * @returns {{ success: boolean, categoryId?: string, ticketChannelId?: string, error?: string }}
 */
function runDiscordAutoSetup(sessionId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');

    var scriptProps = PropertiesService.getScriptProperties();

    var guildId = scriptProps.getProperty('DISCORD_GUILD_ID');
    if (!guildId) {
      return {
        success: false,
        error: 'guild_idが未設定です。先にBot招待を完了してください。'
      };
    }

    var botToken = scriptProps.getProperty('DISCORD_BOT_TOKEN');
    if (!botToken) {
      return {
        success: false,
        error: 'Botトークンが未設定です。'
      };
    }

    // ---- 顧客規模列の自動追加（冪等）----
    ensureCustomerScaleColumn_(getSpreadsheet());

    // BotのIDを取得（testDiscordConnectionを利用）
    var connectionResult = testDiscordConnection();
    if (!connectionResult.success || !connectionResult.botInfo) {
      return {
        success: false,
        error: 'Discord Botに接続できませんでした。トークンを確認してください。'
      };
    }
    var botId = connectionResult.botInfo.id;

    // ---- GEN-RYU CRM カテゴリ作成 or 既存取得 ----
    var categoryId;
    var existingCategory = findExistingChannel_(botToken, guildId, DISCORD_SETUP_CATEGORY_NAME, 4);
    if (existingCategory) {
      categoryId = existingCategory.id;
      Logger.log('runDiscordAutoSetup: 既存カテゴリを使用 id=' + categoryId);
    } else {
      var categoryResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/channels', {
        name: DISCORD_SETUP_CATEGORY_NAME,
        type: 4
      });
      if (categoryResult.statusCode !== 200 && categoryResult.statusCode !== 201) {
        var catDetail = discordErrorDetail_(categoryResult.data);
        Logger.log('runDiscordAutoSetup: カテゴリ作成エラー status=' + categoryResult.statusCode + catDetail);
        return {
          success: false,
          error: 'カテゴリの作成に失敗しました。(status: ' + categoryResult.statusCode + catDetail + ')'
        };
      }
      categoryId = categoryResult.data.id;
      Logger.log('runDiscordAutoSetup: カテゴリ作成 id=' + categoryId);
    }

    // カテゴリに permission_overwrites 設定
    applyPermissionOverwrites_(botToken, categoryId, guildId, botId);

    // ---- ticket-start チャンネル作成 or 既存取得 ----
    var ticketChannelId;
    var existingTicket = findExistingChannel_(botToken, guildId, DISCORD_SETUP_TICKET_CHANNEL_NAME, 0);
    if (existingTicket) {
      ticketChannelId = existingTicket.id;
      Logger.log('runDiscordAutoSetup: 既存ticket-startチャンネルを使用 id=' + ticketChannelId);
    } else {
      var ticketResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/channels', {
        name: DISCORD_SETUP_TICKET_CHANNEL_NAME,
        type: 0,
        parent_id: categoryId
      });
      if (ticketResult.statusCode !== 200 && ticketResult.statusCode !== 201) {
        var ticketDetail = discordErrorDetail_(ticketResult.data);
        Logger.log('runDiscordAutoSetup: ticket-startチャンネル作成エラー status=' + ticketResult.statusCode + ticketDetail);
        return {
          success: false,
          error: 'ticket-startチャンネルの作成に失敗しました。(status: ' + ticketResult.statusCode + ticketDetail + ')'
        };
      }
      ticketChannelId = ticketResult.data.id;
      Logger.log('runDiscordAutoSetup: ticket-startチャンネル作成 id=' + ticketChannelId);
    }

    // ticket-start チャンネルに permission_overwrites 設定
    applyPermissionOverwrites_(botToken, ticketChannelId, guildId, botId);

    // ---- Customer カテゴリ作成 or 既存取得 ----
    var customerCategoryId;
    var existingCustomerCat = findExistingChannel_(botToken, guildId, DISCORD_CUSTOMER_CATEGORY_NAME, 4);
    if (existingCustomerCat) {
      customerCategoryId = existingCustomerCat.id;
      Logger.log('runDiscordAutoSetup: 既存 Customer カテゴリを使用');
    } else {
      var custCatResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/channels', { name: DISCORD_CUSTOMER_CATEGORY_NAME, type: 4 });
      if (custCatResult.statusCode !== 200 && custCatResult.statusCode !== 201) {
        var ccDetail = discordErrorDetail_(custCatResult.data);
        Logger.log('runDiscordAutoSetup: Customer カテゴリ作成エラー status=' + custCatResult.statusCode + ccDetail);
        return { success: false, error: 'Customerカテゴリの作成に失敗しました。(status: ' + custCatResult.statusCode + ccDetail + ')' };
      }
      customerCategoryId = custCatResult.data.id;
      Logger.log('runDiscordAutoSetup: Customer カテゴリ作成完了');
    }

    // ---- Partner カテゴリ作成 or 既存取得 ----
    var partnerCategoryId;
    var existingPartnerCat = findExistingChannel_(botToken, guildId, DISCORD_PARTNER_CATEGORY_NAME, 4);
    if (existingPartnerCat) {
      partnerCategoryId = existingPartnerCat.id;
      Logger.log('runDiscordAutoSetup: 既存 Partner カテゴリを使用');
    } else {
      var ptnCatResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/channels', { name: DISCORD_PARTNER_CATEGORY_NAME, type: 4 });
      if (ptnCatResult.statusCode !== 200 && ptnCatResult.statusCode !== 201) {
        var pcDetail = discordErrorDetail_(ptnCatResult.data);
        Logger.log('runDiscordAutoSetup: Partner カテゴリ作成エラー status=' + ptnCatResult.statusCode + pcDetail);
        return { success: false, error: 'Partnerカテゴリの作成に失敗しました。(status: ' + ptnCatResult.statusCode + pcDetail + ')' };
      }
      partnerCategoryId = ptnCatResult.data.id;
      Logger.log('runDiscordAutoSetup: Partner カテゴリ作成完了');
    }

    // ---- Customer ロール作成 or 既存取得 ----
    var customerRoleId;
    var existingCustomerRole = findExistingRole_(botToken, guildId, DISCORD_CUSTOMER_ROLE_NAME);
    if (existingCustomerRole) {
      customerRoleId = existingCustomerRole.id;
      Logger.log('runDiscordAutoSetup: 既存 Customer ロールを使用');
    } else {
      var custRoleResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/roles', { name: DISCORD_CUSTOMER_ROLE_NAME });
      if (custRoleResult.statusCode !== 200 && custRoleResult.statusCode !== 201) {
        var crDetail = discordErrorDetail_(custRoleResult.data);
        Logger.log('runDiscordAutoSetup: Customer ロール作成エラー status=' + custRoleResult.statusCode + crDetail);
        return { success: false, error: 'Customerロールの作成に失敗しました。(status: ' + custRoleResult.statusCode + crDetail + ')' };
      }
      customerRoleId = custRoleResult.data.id;
      Logger.log('runDiscordAutoSetup: Customer ロール作成完了');
    }

    // ---- Partner ロール作成 or 既存取得 ----
    var partnerRoleId;
    var existingPartnerRole = findExistingRole_(botToken, guildId, DISCORD_PARTNER_ROLE_NAME);
    if (existingPartnerRole) {
      partnerRoleId = existingPartnerRole.id;
      Logger.log('runDiscordAutoSetup: 既存 Partner ロールを使用');
    } else {
      var ptnRoleResult = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/roles', { name: DISCORD_PARTNER_ROLE_NAME });
      if (ptnRoleResult.statusCode !== 200 && ptnRoleResult.statusCode !== 201) {
        var prDetail = discordErrorDetail_(ptnRoleResult.data);
        Logger.log('runDiscordAutoSetup: Partner ロール作成エラー status=' + ptnRoleResult.statusCode + prDetail);
        return { success: false, error: 'Partnerロールの作成に失敗しました。(status: ' + ptnRoleResult.statusCode + prDetail + ')' };
      }
      partnerRoleId = ptnRoleResult.data.id;
      Logger.log('runDiscordAutoSetup: Partner ロール作成完了');
    }

    // スクリプトプロパティに保存
    scriptProps.setProperty('DISCORD_CATEGORY_ID', categoryId);
    scriptProps.setProperty('DISCORD_TICKET_CHANNEL_ID', ticketChannelId);
    scriptProps.setProperty('DISCORD_CUSTOMER_CATEGORY_ID', customerCategoryId);
    scriptProps.setProperty('DISCORD_PARTNER_CATEGORY_ID', partnerCategoryId);
    scriptProps.setProperty('DISCORD_CUSTOMER_ROLE_ID', customerRoleId);
    scriptProps.setProperty('DISCORD_PARTNER_ROLE_ID', partnerRoleId);
    writeSyncSignalDomains_(['discord']);
    Logger.log('runDiscordAutoSetup: セットアップ完了');

    return {
      success: true,
      categoryId: categoryId,
      ticketChannelId: ticketChannelId,
      customerCategoryId: customerCategoryId,
      partnerCategoryId: partnerCategoryId,
      customerRoleId: customerRoleId,
      partnerRoleId: partnerRoleId
    };
  } catch (error) {
    Logger.log('runDiscordAutoSetup error: ' + error.message);
    return {
      success: false,
      error: error.message || 'セットアップ中にエラーが発生しました'
    };
  }
}

// ============================================================
// getDiscordSetupStatus
// ============================================================

/**
 * Discordチャンネルセットアップ状態を返す
 * @param {string} sessionId
 * @returns {{ guildId: string|null, categoryId: string|null, ticketChannelId: string|null }}
 */
function getDiscordSetupStatus(sessionId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');

    var scriptProps = PropertiesService.getScriptProperties();

    return {
      guildId: scriptProps.getProperty('DISCORD_GUILD_ID') || null,
      categoryId: scriptProps.getProperty('DISCORD_CATEGORY_ID') || null,
      ticketChannelId: scriptProps.getProperty('DISCORD_TICKET_CHANNEL_ID') || null
    };
  } catch (error) {
    Logger.log('getDiscordSetupStatus error: ' + error.message);
    return {
      guildId: null,
      categoryId: null,
      ticketChannelId: null
    };
  }
}

// ============================================================
// 顧客規模オプション取得
// ============================================================

/**
 * 顧客規模の選択肢をフロントエンドに返す（Registry由来）
 * @param {string} sessionId
 * @returns {Array<{ key: string, label: string }>}
 */
function getDiscordCustomerScaleOptionsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('admin_access');

  var values = CORE_SCHEMA_V1_TABLES.CUSTOMERS.values.CUSTOMER_SCALE;
  return Object.keys(values).map(function(key) {
    return { key: key, label: values[key] };
  });
}

// ============================================================
// 顧客規模更新
// ============================================================

/**
 * 顧客の規模を更新する
 * @param {string} sessionId
 * @param {string} customerId
 * @param {string} scaleKey - 'SMALL' | 'LARGE' | '' (空=未設定)
 * @returns {{ success: boolean, error?: string }}
 */
function updateDiscordCustomerScale(sessionId, customerId, scaleKey) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');

    var normalizedId = String(customerId || '').trim();
    if (!normalizedId) return { success: false, error: '顧客IDを指定してください。' };

    var normalizedKey = String(scaleKey || '').trim();
    if (normalizedKey !== '') {
      var validKeys = Object.keys(CORE_SCHEMA_V1_TABLES.CUSTOMERS.values.CUSTOMER_SCALE);
      if (validKeys.indexOf(normalizedKey) === -1) {
        return { success: false, error: '無効な顧客規模キーです: ' + normalizedKey };
      }
    }

    var table = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'CUSTOMERS');
    var idHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
    var scaleHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_SCALE');
    var count = Math.max(0, table.sheet.getLastRow() - 1);
    if (!count) return { success: false, error: '顧客が見つかりません。' };
    var rows = table.sheet.getRange(2, 1, count, table.sheet.getLastColumn()).getValues();
    var index = rows.findIndex(function(row) {
      return String(row[table.headerIndexes[idHeader] - 1] || '').trim() === normalizedId;
    });
    if (index === -1) return { success: false, error: '顧客が見つかりません: ' + normalizedId };

    var labelValue = normalizedKey === '' ? '' : CORE_SCHEMA_V1_TABLES.CUSTOMERS.values.CUSTOMER_SCALE[normalizedKey];
    table.sheet.getRange(index + 2, table.headerIndexes[scaleHeader]).setValue(labelValue);
    Logger.log('updateDiscordCustomerScale: 更新完了 customerId=' + normalizedId);
    return { success: true };
  } catch (error) {
    Logger.log('updateDiscordCustomerScale error: ' + error.message);
    return { success: false, error: error.message || '顧客規模の更新に失敗しました。' };
  }
}
