/**
 * Discord OAuth Bot招待フローAPI
 * - Bot招待用OAuthURL生成
 * - Guild連携状態確認
 *
 * セキュリティ制約:
 * - 全関数に checkPermission('admin_access') でガード
 * - Logger.log に CLIENT_ID・guild_id を渡さない
 * - CLIENT_IDはフロントエンドに返さない
 *
 * permissions値: 805432400（KICK_MEMBERS/BAN_MEMBERSを除外済み）
 * 内訳: MANAGE_CHANNELS + ADD_REACTIONS + VIEW_CHANNEL + SEND_MESSAGES +
 *        MANAGE_MESSAGES + EMBED_LINKS + ATTACH_FILES + READ_MESSAGE_HISTORY +
 *        MANAGE_ROLES + MANAGE_WEBHOOKS
 */

// ============================================================
// Discord Bot招待OAuthURL生成
// ============================================================

var DISCORD_OAUTH_PERMISSIONS = '805432400';

/**
 * Discord Bot招待用OAuthURLを生成する
 * @param {string} sessionId - セッションID
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
function generateDiscordOAuthUrl(sessionId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');

    var clientId = PropertiesService.getScriptProperties().getProperty('DISCORD_CLIENT_ID');
    if (!clientId) {
      return { success: false, error: 'CLIENT_ID_NOT_SET' };
    }

    var url =
      'https://discord.com/api/oauth2/authorize' +
      '?client_id=' + encodeURIComponent(clientId) +
      '&permissions=' + DISCORD_OAUTH_PERMISSIONS +
      '&scope=bot%20applications.commands';

    return { success: true, url: url };
  } catch (error) {
    Logger.log('generateDiscordOAuthUrl error: ' + error.message);
    return { success: false, error: error.message || 'URLの生成に失敗しました' };
  }
}

// ============================================================
// Guild連携状態確認
// ============================================================

/**
 * Discordサーバー（Guild）連携状態を取得する
 * @param {string} sessionId - セッションID
 * @returns {{ status: string, guildId: string | null, guilds: Array, error?: string }}
 */
function getDiscordOAuthStatus(sessionId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');
    var guildsResult = getDiscordBotGuilds_();
    if (!guildsResult.success) {
      return { status: 'error', guildId: null, guilds: [], error: guildsResult.error };
    }

    var guilds = guildsResult.guilds;
    if (guilds.length === 0) {
      return { status: 'unlinked', guildId: null, guilds: [] };
    }
    if (guilds.length === 1) {
      var guildId = guilds[0].id;
      PropertiesService.getScriptProperties().setProperty('DISCORD_GUILD_ID', guildId);
      return { status: 'linked', guildId: guildId, guilds: guilds };
    }
    return { status: 'multiple', guildId: null, guilds: guilds };
  } catch (error) {
    Logger.log('getDiscordOAuthStatus error: ' + error.message);
    return { status: 'error', guildId: null, guilds: [], error: error.message || '連携状態の取得に失敗しました' };
  }
}

/**
 * Bot が参加しているGuildをDiscord REST APIから取得する。
 * @returns {{ success: boolean, guilds?: Array, error?: string }}
 */
function getDiscordBotGuilds_() {
  var botToken = PropertiesService.getScriptProperties().getProperty('DISCORD_BOT_TOKEN');
  if (!botToken) return { success: false, error: 'BOT_TOKEN_NOT_SET' };

  var response = UrlFetchApp.fetch('https://discord.com/api/v10/users/@me/guilds', {
    method: 'get',
    headers: { Authorization: 'Bot ' + botToken },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    return { success: false, error: 'GUILD_LIST_FETCH_FAILED' };
  }

  var parsed = JSON.parse(response.getContentText());
  if (!Array.isArray(parsed)) return { success: false, error: 'GUILD_LIST_INVALID' };
  var guilds = parsed
    .filter(function(guild) { return guild && /^\d{17,19}$/.test(String(guild.id || '')); })
    .map(function(guild) { return { id: String(guild.id), name: String(guild.name || '') }; });
  return { success: true, guilds: guilds };
}

/**
 * 選択したGuildが現在Botの参加先であることを確認して保存する。
 * @param {string} sessionId - セッションID
 * @param {string} guildId - Guild ID
 * @returns {{ success: boolean, error?: string }}
 */
function saveDiscordGuildId(sessionId, guildId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');
    if (!/^\d{17,19}$/.test(String(guildId || ''))) return { success: false, error: 'INVALID_GUILD_ID' };
    var guildsResult = getDiscordBotGuilds_();
    if (!guildsResult.success) return { success: false, error: guildsResult.error };
    var exists = guildsResult.guilds.some(function(guild) { return guild.id === String(guildId); });
    if (!exists) return { success: false, error: 'GUILD_NOT_FOUND' };
    PropertiesService.getScriptProperties().setProperty('DISCORD_GUILD_ID', String(guildId));
    return { success: true };
  } catch (error) {
    Logger.log('saveDiscordGuildId error: ' + error.message);
    return { success: false, error: error.message || 'Guild IDの保存に失敗しました' };
  }
}
