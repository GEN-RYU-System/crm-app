/**
 * Discord連携設定API
 * Botトークン・チャンネルIDの保存・取得をフロントエンドに提供
 *
 * セキュリティ制約:
 * - 全関数に checkPermission('admin_access') でガード
 * - Logger.log にトークン変数を渡さない（絶対禁止）
 * - フロントエンドにトークン本体を返さない
 */

// ============================================================
// Botトークン保存
// ============================================================

/**
 * Discord Botトークンをスクリプトプロパティに保存
 * @param {string} sessionId - セッションID
 * @param {string} token - Discord Botトークン
 * @returns {Object} { success: boolean, error?: string }
 */
function saveDiscordBotToken(sessionId, token) {
  try {
    checkPermission('admin_access');

    if (!token || typeof token !== 'string' || token.trim() === '') {
      return { success: false, error: 'トークンが空です' };
    }

    PropertiesService.getScriptProperties().setProperty('DISCORD_BOT_TOKEN', token.trim());
    Logger.log('saveDiscordBotToken: Botトークンを保存しました');

    return { success: true };
  } catch (error) {
    Logger.log('saveDiscordBotToken error: ' + error.message);
    return { success: false, error: error.message || 'トークンの保存に失敗しました' };
  }
}

// ============================================================
// 接続状態取得（フロントエンド向け）
// ============================================================

/**
 * Discord接続状態をフロントエンド向けに返す
 * トークン本体は返さず、末尾4文字のマスク表示のみ返す
 * @param {string} sessionId - セッションID
 * @returns {Object} { isTokenSet, tokenMask, botName, botId, connected }
 */
function getDiscordConnectionStatusForFrontend(sessionId) {
  try {
    checkPermission('admin_access');

    const token = PropertiesService.getScriptProperties().getProperty('DISCORD_BOT_TOKEN');

    if (!token) {
      return {
        isTokenSet: false,
        tokenMask: '未設定',
        botName: '',
        botId: '',
        connected: false
      };
    }

    // 末尾4文字マスク表示（トークン本体は返さない）
    const tokenMask = '••••••••' + token.slice(-4);

    // Discord接続テスト
    const connectionResult = testDiscordConnection();

    if (connectionResult.success && connectionResult.botInfo) {
      return {
        isTokenSet: true,
        tokenMask: tokenMask,
        botName: connectionResult.botInfo.username || '',
        botId: connectionResult.botInfo.id || '',
        connected: true
      };
    }

    return {
      isTokenSet: true,
      tokenMask: tokenMask,
      botName: '',
      botId: '',
      connected: false
    };
  } catch (error) {
    Logger.log('getDiscordConnectionStatusForFrontend error: ' + error.message);
    return {
      isTokenSet: false,
      tokenMask: '未設定',
      botName: '',
      botId: '',
      connected: false
    };
  }
}

// ============================================================
// チャンネルID管理
// ============================================================

/**
 * 監視対象DiscordチャンネルIDをスクリプトプロパティに保存
 * @param {string} sessionId - セッションID
 * @param {string[]} channelIds - チャンネルIDの配列
 * @returns {Object} { success: boolean, error?: string }
 */
function saveDiscordChannels(sessionId, channelIds) {
  try {
    checkPermission('admin_access');

    if (!Array.isArray(channelIds)) {
      return { success: false, error: 'channelIdsは配列で指定してください' };
    }

    PropertiesService.getScriptProperties().setProperty(
      'DISCORD_CHANNEL_IDS',
      JSON.stringify(channelIds)
    );
    Logger.log('saveDiscordChannels: ' + channelIds.length + '件のチャンネルIDを保存しました');

    return { success: true };
  } catch (error) {
    Logger.log('saveDiscordChannels error: ' + error.message);
    return { success: false, error: error.message || 'チャンネルIDの保存に失敗しました' };
  }
}

/**
 * 監視対象DiscordチャンネルIDを取得
 * @param {string} sessionId - セッションID
 * @returns {Object} { channels: string[], error?: string }
 */
function getDiscordChannelsForFrontend(sessionId) {
  try {
    checkPermission('admin_access');

    const raw = PropertiesService.getScriptProperties().getProperty('DISCORD_CHANNEL_IDS');

    if (!raw) {
      return { channels: [] };
    }

    let channels;
    try {
      channels = JSON.parse(raw);
    } catch (parseError) {
      Logger.log('getDiscordChannelsForFrontend: JSON parse error - ' + parseError.message);
      return { channels: [] };
    }

    if (!Array.isArray(channels)) {
      return { channels: [] };
    }

    return { channels: channels };
  } catch (error) {
    Logger.log('getDiscordChannelsForFrontend error: ' + error.message);
    return { channels: [] };
  }
}
