/**
 * Discord OAuth Bot招待フローAPI
 * - Bot招待用OAuthURL生成
 * - Guild連携状態確認
 * - doGet側のコールバック処理（27_WebApp.js に統合済み）
 *
 * セキュリティ制約:
 * - 全関数に checkPermission('admin_access') でガード
 * - Logger.log に CLIENT_ID・state・guild_id を渡さない
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
  try {
    checkPermission('admin_access');

    var clientId = PropertiesService.getScriptProperties().getProperty('DISCORD_CLIENT_ID');
    if (!clientId) {
      return { success: false, error: 'CLIENT_ID_NOT_SET' };
    }

    var state = Utilities.getUuid();
    CacheService.getScriptCache().put(state, sessionId || 'unknown', 3600);

    var redirectUri = ScriptApp.getService().getUrl();

    var url =
      'https://discord.com/api/oauth2/authorize' +
      '?client_id=' + encodeURIComponent(clientId) +
      '&permissions=' + DISCORD_OAUTH_PERMISSIONS +
      '&scope=bot%20applications.commands' +
      '&response_type=code' +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&state=' + encodeURIComponent(state);

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
 * @returns {{ guildId: string | null }}
 */
function getDiscordOAuthStatus(sessionId) {
  try {
    checkPermission('admin_access');

    var guildId = PropertiesService.getScriptProperties().getProperty('DISCORD_GUILD_ID');
    return { guildId: guildId || null };
  } catch (error) {
    Logger.log('getDiscordOAuthStatus error: ' + error.message);
    return { guildId: null };
  }
}

// ============================================================
// doGet コールバック処理（27_WebApp.js の doGet から呼ばれる）
// ============================================================

/**
 * Discord OAuth コールバックを処理してHTMLレスポンスを返す
 * state検証・one-time消費・guild_idフォーマット確認・スクリプトプロパティ保存を行う
 * @param {Object} params - e.parameter
 * @returns {HtmlOutput}
 */
function handleDiscordOAuthCallback(params) {
  var state = params.state;
  var guildId = params.guild_id;

  // state検証（one-time消費）
  var cache = CacheService.getScriptCache();
  var storedSessionId = cache.get(state);
  if (!storedSessionId) {
    return HtmlService.createHtmlOutput(createDiscordCallbackHtml(
      'エラー',
      '無効なstateです。リンクの有効期限が切れているか、不正なアクセスです。',
      false
    ))
      .setTitle('Discord連携エラー')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  cache.remove(state);

  // guild_idフォーマット検証（Snowflake: 17〜19桁の数字）
  if (!guildId || !/^\d{17,19}$/.test(guildId)) {
    return HtmlService.createHtmlOutput(createDiscordCallbackHtml(
      'エラー',
      '無効なguild_idです。正しいDiscordサーバーから招待してください。',
      false
    ))
      .setTitle('Discord連携エラー')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // guild_id保存
  PropertiesService.getScriptProperties().setProperty('DISCORD_GUILD_ID', guildId);

  return HtmlService.createHtmlOutput(createDiscordCallbackHtml(
    '連携完了',
    'DiscordとCRMが連携されました。このページを閉じてください。',
    true
  ))
    .setTitle('Discord連携完了')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Discord OAuthコールバック用HTMLを生成する
 * @param {string} title - ページタイトル
 * @param {string} message - 表示メッセージ
 * @param {boolean} success - 成功かどうか
 * @returns {string} HTML文字列
 */
function createDiscordCallbackHtml(title, message, success) {
  var color = success ? '#27ae60' : '#c0392b';
  var icon = success ? '✓' : '⚠';
  return '<!DOCTYPE html>' +
    '<html lang="ja">' +
    '<head>' +
    '<base target="_top">' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + title + '</title>' +
    '<style>' +
    'body{font-family:-apple-system,sans-serif;background:#f5f5f5;min-height:100vh;' +
    'display:flex;align-items:center;justify-content:center;padding:20px;}' +
    '.box{background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.12);' +
    'max-width:480px;width:100%;padding:40px 32px;text-align:center;}' +
    '.icon{font-size:48px;margin-bottom:16px;color:' + color + ';}' +
    'h2{color:' + color + ';margin-bottom:12px;font-size:20px;}' +
    'p{color:#555;line-height:1.6;font-size:14px;}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="box">' +
    '<div class="icon">' + icon + '</div>' +
    '<h2>' + title + '</h2>' +
    '<p>' + message + '</p>' +
    '</div>' +
    '</body>' +
    '</html>';
}
