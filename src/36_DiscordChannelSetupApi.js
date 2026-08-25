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

// ============================================================
// 内部ヘルパー: Discord API 呼び出し
// ============================================================

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
    Logger.log('findExistingChannel_: チャンネル一覧取得エラー status=' + result.statusCode);
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
    Logger.log('applyPermissionOverwrites_: @everyone deny 設定エラー status=' + everyoneResult.statusCode);
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
    Logger.log('applyPermissionOverwrites_: Bot allow 設定エラー status=' + botResult.statusCode);
  }
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

    // BotのIDを取得（testDiscordConnectionを利用）
    var connectionResult = testDiscordConnection();
    if (!connectionResult.success || !connectionResult.botInfo) {
      return {
        success: false,
        error: 'Discord Botに接続できませんでした。トークンを確認してください。'
      };
    }
    var botId = connectionResult.botInfo.id;

    // ---- カテゴリ作成 or 既存取得 ----
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
        Logger.log('runDiscordAutoSetup: カテゴリ作成エラー status=' + categoryResult.statusCode);
        return {
          success: false,
          error: 'カテゴリの作成に失敗しました。(status: ' + categoryResult.statusCode + ')'
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
        Logger.log('runDiscordAutoSetup: ticket-startチャンネル作成エラー status=' + ticketResult.statusCode);
        return {
          success: false,
          error: 'ticket-startチャンネルの作成に失敗しました。(status: ' + ticketResult.statusCode + ')'
        };
      }
      ticketChannelId = ticketResult.data.id;
      Logger.log('runDiscordAutoSetup: ticket-startチャンネル作成 id=' + ticketChannelId);
    }

    // ticket-start チャンネルに permission_overwrites 設定
    applyPermissionOverwrites_(botToken, ticketChannelId, guildId, botId);

    // スクリプトプロパティに保存
    scriptProps.setProperty('DISCORD_CATEGORY_ID', categoryId);
    scriptProps.setProperty('DISCORD_TICKET_CHANNEL_ID', ticketChannelId);
    writeSyncSignalDomains_(['discord']);
    Logger.log('runDiscordAutoSetup: セットアップ完了 categoryId=' + categoryId + ' ticketChannelId=' + ticketChannelId);

    return {
      success: true,
      categoryId: categoryId,
      ticketChannelId: ticketChannelId
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
