/**
 * Discord統合サービス
 * Discordサーバーから会話履歴を取得し、CRM会話ログシートに保存
 */

// ============================================================
// 定数定義
// ============================================================

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_MAX_MESSAGES_PER_REQUEST = 100; // Discord APIの制限
const DISCORD_RATE_LIMIT_DELAY = 1000; // レート制限対策: 1秒待機

// ============================================================
// Discord API 接続テスト
// ============================================================

/**
 * Discord API接続テスト
 * Bot Tokenが正しく設定されているか確認
 * @returns {Object} { success: boolean, message: string }
 */
function testDiscordConnection() {
  try {
    // DISCORD_BOT_TOKEN または DISCORD_MESSAGEFORWARDING_BOT_TOKEN を取得
    let botToken = PropertiesService.getScriptProperties().getProperty('DISCORD_BOT_TOKEN');

    // フォールバック: 既存のプロパティ名も確認
    if (!botToken) {
      botToken = PropertiesService.getScriptProperties().getProperty('DISCORD_MESSAGEFORWARDING_BOT_TOKEN');
    }

    if (!botToken) {
      return {
        success: false,
        error: 'DISCORD_BOT_TOKEN または DISCORD_MESSAGEFORWARDING_BOT_TOKEN がスクリプトプロパティに設定されていません。',
        helpUrl: 'DISCORD_SETUP.md を参照してください'
      };
    }

    // Bot情報を取得してAPI接続を確認
    const url = DISCORD_API_BASE_URL + '/users/@me';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bot ' + botToken,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      const botInfo = JSON.parse(response.getContentText());
      return {
        success: true,
        message: 'Discord APIに正常に接続できました',
        botInfo: {
          username: botInfo.username,
          id: botInfo.id,
          discriminator: botInfo.discriminator
        }
      };
    } else if (statusCode === 401) {
      return {
        success: false,
        error: '認証エラー: Bot Tokenが無効です',
        statusCode: statusCode
      };
    } else {
      return {
        success: false,
        error: 'Discord API エラー: ' + response.getContentText(),
        statusCode: statusCode
      };
    }
  } catch (error) {
    Logger.log('testDiscordConnection error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

// ============================================================
// メッセージ取得（基本）
// ============================================================

/**
 * Discordチャンネルからメッセージを取得
 * @param {string} channelId - Discord Channel ID
 * @param {number} limit - 取得件数（1-100、デフォルト100）
 * @param {string} beforeMessageId - このメッセージID以前のメッセージを取得（ページネーション用）
 * @returns {Object} { success: boolean, messages: Array, count: number }
 */
function fetchDiscordMessages(channelId, limit = 100, beforeMessageId = null) {
  try {
    // DISCORD_BOT_TOKEN または DISCORD_MESSAGEFORWARDING_BOT_TOKEN を取得
    let botToken = PropertiesService.getScriptProperties().getProperty('DISCORD_BOT_TOKEN');

    // フォールバック: 既存のプロパティ名も確認
    if (!botToken) {
      botToken = PropertiesService.getScriptProperties().getProperty('DISCORD_MESSAGEFORWARDING_BOT_TOKEN');
    }

    if (!botToken) {
      return {
        success: false,
        error: 'DISCORD_BOT_TOKEN が設定されていません'
      };
    }

    // 制限値チェック
    if (limit < 1 || limit > DISCORD_MAX_MESSAGES_PER_REQUEST) {
      limit = DISCORD_MAX_MESSAGES_PER_REQUEST;
    }

    // URL構築
    let url = DISCORD_API_BASE_URL + '/channels/' + channelId + '/messages?limit=' + limit;

    if (beforeMessageId) {
      url += '&before=' + beforeMessageId;
    }

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bot ' + botToken,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      const messages = JSON.parse(response.getContentText());
      return {
        success: true,
        messages: messages,
        count: messages.length,
        channelId: channelId
      };
    } else if (statusCode === 429) {
      // レート制限
      const headers = response.getAllHeaders();
      const retryAfter = headers['Retry-After'] || headers['retry-after'] || '5';
      return {
        success: false,
        error: 'レート制限に達しました。' + retryAfter + '秒後に再試行してください',
        statusCode: statusCode,
        retryAfter: parseInt(retryAfter, 10)
      };
    } else if (statusCode === 403) {
      const errorBody = response.getContentText();
      Logger.log('Discord 403 Error: ' + errorBody);
      return {
        success: false,
        error: '権限不足: ボットに Read Message History 権限があるか確認してください',
        statusCode: statusCode,
        details: errorBody
      };
    } else if (statusCode === 404) {
      return {
        success: false,
        error: 'チャンネルが見つかりません: Channel ID = ' + channelId,
        statusCode: statusCode
      };
    } else {
      return {
        success: false,
        error: 'Discord API エラー: ' + response.getContentText(),
        statusCode: statusCode
      };
    }
  } catch (error) {
    Logger.log('fetchDiscordMessages error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

// ============================================================
// メッセージ取得（ページネーション対応）
// ============================================================

/**
 * Discordチャンネルから大量のメッセージを取得（ページネーション対応）
 * @param {string} channelId - Discord Channel ID
 * @param {number} maxMessages - 最大取得件数（デフォルト1000）
 * @param {Object} options - オプション { onProgress: function(current, total) }
 * @returns {Object} { success: boolean, messages: Array, totalCount: number }
 */
function fetchAllDiscordMessages(channelId, maxMessages = 1000, options = {}) {
  try {
    let allMessages = [];
    let oldestMessageId = null;
    let iterationCount = 0;
    const maxIterations = Math.ceil(maxMessages / DISCORD_MAX_MESSAGES_PER_REQUEST);

    Logger.log('Discord メッセージ取得開始: Channel ID = ' + channelId + ', 最大件数 = ' + maxMessages);

    while (allMessages.length < maxMessages && iterationCount < maxIterations) {
      iterationCount++;

      // メッセージ取得
      const result = fetchDiscordMessages(channelId, DISCORD_MAX_MESSAGES_PER_REQUEST, oldestMessageId);

      if (!result.success) {
        // エラー発生
        Logger.log('fetchAllDiscordMessages エラー: ' + result.error);

        // レート制限エラーの場合は待機して再試行
        if (result.retryAfter) {
          Logger.log('レート制限エラー。' + result.retryAfter + '秒待機します...');
          Utilities.sleep(result.retryAfter * 1000);
          continue; // 再試行
        }

        return {
          success: false,
          error: result.error,
          partialMessages: allMessages,
          partialCount: allMessages.length
        };
      }

      if (result.messages.length === 0) {
        // これ以上メッセージがない
        Logger.log('すべてのメッセージを取得しました');
        break;
      }

      // メッセージを追加
      allMessages = allMessages.concat(result.messages);

      // 最も古いメッセージIDを記録（次のページネーション用）
      oldestMessageId = result.messages[result.messages.length - 1].id;

      Logger.log('取得進捗: ' + allMessages.length + ' / ' + maxMessages + ' 件');

      // 進捗コールバック
      if (options.onProgress && typeof options.onProgress === 'function') {
        options.onProgress(allMessages.length, maxMessages);
      }

      // レート制限対策: 各リクエスト間に待機
      if (allMessages.length < maxMessages && result.messages.length === DISCORD_MAX_MESSAGES_PER_REQUEST) {
        Utilities.sleep(DISCORD_RATE_LIMIT_DELAY);
      }
    }

    Logger.log('Discord メッセージ取得完了: 合計 ' + allMessages.length + ' 件');

    return {
      success: true,
      messages: allMessages,
      totalCount: allMessages.length,
      channelId: channelId
    };
  } catch (error) {
    Logger.log('fetchAllDiscordMessages error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

// ============================================================
// Discord ユーザー → リードID 紐付け
// ============================================================

/**
 * DiscordユーザーIDまたはユーザー名からリードIDを検索
 * @param {string} discordUserId - Discord User ID
 * @param {string} discordUsername - Discord Username
 * @returns {Object} { success: boolean, leadId: string, matchType: string }
 */
function findLeadByDiscordUser(discordUserId, discordUsername) {
  try {
    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadsSheet || leadsSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'リード管理シートが見つかりません'
      };
    }

    const data = leadsSheet.getDataRange().getValues();
    const headers = data[0];

    // Discord関連の列インデックスを取得
    const discordIdIdx = headers.indexOf('Discord ユーザーID');
    const leadIdIdx = headers.indexOf('リードID');
    const customerNameIdx = headers.indexOf('顧客名');

    // Discord User IDで検索（最優先）
    if (discordIdIdx !== -1 && discordUserId) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][discordIdIdx]) === String(discordUserId)) {
          return {
            success: true,
            leadId: data[i][leadIdIdx],
            matchType: 'discord_user_id',
            customerName: data[i][customerNameIdx]
          };
        }
      }
    }

    // 顧客名での部分一致検索（フォールバック）
    if (customerNameIdx !== -1 && discordUsername) {
      for (let i = 1; i < data.length; i++) {
        const customerName = String(data[i][customerNameIdx]).toLowerCase();
        const username = String(discordUsername).toLowerCase();

        if (customerName.includes(username) || username.includes(customerName)) {
          return {
            success: true,
            leadId: data[i][leadIdIdx],
            matchType: 'customer_name_partial',
            customerName: data[i][customerNameIdx],
            warning: '顧客名での部分一致です。正確性を確認してください。'
          };
        }
      }
    }

    // 見つからない
    return {
      success: false,
      error: 'リードが見つかりません: Discord User = ' + discordUsername + ' (ID: ' + discordUserId + ')'
    };
  } catch (error) {
    Logger.log('findLeadByDiscordUser error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

// ============================================================
// 会話ログシートへの保存
// ============================================================

/**
 * Discordメッセージを会話ログシートに保存
 * @param {string} channelId - Discord Channel ID
 * @param {string} leadId - リードID（指定する場合）
 * @param {number} maxMessages - 最大取得件数
 * @param {Object} options - オプション { autoLinkLead: boolean }
 * @returns {Object} { success: boolean, savedCount: number }
 */
function syncDiscordToConversationLog(channelId, leadId = null, maxMessages = 1000, options = {}) {
  try {
    const ss = getSpreadsheet();
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);

    if (!logSheet) {
      return {
        success: false,
        error: '会話ログシートが見つかりません'
      };
    }

    // Discordメッセージ取得
    Logger.log('Discord メッセージ取得中...');
    const result = fetchAllDiscordMessages(channelId, maxMessages);

    if (!result.success) {
      return {
        success: false,
        error: 'Discord メッセージの取得に失敗しました: ' + result.error
      };
    }

    const messages = result.messages;
    Logger.log('取得したメッセージ数: ' + messages.length);

    if (messages.length === 0) {
      return {
        success: true,
        savedCount: 0,
        message: '新しいメッセージはありません'
      };
    }

    // メッセージを古い順にソート（Discordは新しい順で返す）
    messages.reverse();

    // 会話ログに変換
    const logObjects = [];
    const unmatchedUsers = []; // リードが見つからなかったユーザー

    messages.forEach((msg, index) => {
      let targetLeadId = leadId;

      // リードIDの自動紐付け
      if (!targetLeadId && options.autoLinkLead) {
        const linkResult = findLeadByDiscordUser(msg.author.id, msg.author.username);
        if (linkResult.success) {
          targetLeadId = linkResult.leadId;
        } else {
          // リードが見つからない場合は記録してスキップ
          if (!unmatchedUsers.includes(msg.author.username)) {
            unmatchedUsers.push(msg.author.username);
          }
          Logger.log('リードが見つかりません: ' + msg.author.username + ' (ID: ' + msg.author.id + ')');
          return; // このメッセージはスキップ
        }
      }

      // ログIDを生成
      const logId = generateConversationLogId();

      // 送受信の判定（Botからのメッセージは「送信」、それ以外は「受信」）
      const sendReceive = msg.author.bot ? '送信' : '受信';

      // 日時をフォーマット
      const timestamp = new Date(msg.timestamp);

      // 原文の言語を自動判定
      const originalLanguage = detectLanguage(msg.content || '');

      // オブジェクト形式でログデータを準備（ヘッダー名をキーとして使用）
      const logData = {
        'ログID': logId,
        'リードID': targetLeadId || '',
        '日時': timestamp,
        '送受信': sendReceive,
        '発言者': msg.author.username,
        '原文': msg.content || '',
        '原文言語': originalLanguage,
        '翻訳文': '',  // 翻訳なし
        '記録者ID': Session.getActiveUser().getEmail(),
        '記録日時': new Date()
      };

      logObjects.push(logData);
    });

    // 会話ログシートに一括保存（ヘッダー駆動の一括保存関数を使用）
    if (logObjects.length > 0) {
      const savedCount = bulkSaveConversationLogs(logObjects, logSheet);
      Logger.log('会話ログに保存しました: ' + savedCount + ' 件');
    }

    return {
      success: true,
      savedCount: logObjects.length,
      totalMessages: messages.length,
      skippedCount: messages.length - logObjects.length,
      unmatchedUsers: unmatchedUsers,
      message: logObjects.length + ' 件の会話ログを保存しました'
    };
  } catch (error) {
    Logger.log('syncDiscordToConversationLog error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 会話ログIDを生成
 * @returns {string} LOG-XXXXX
 */
function generateConversationLogId() {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);

  if (!logSheet || logSheet.getLastRow() < 2) {
    return 'LOG-00001';
  }

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const logIdIdx = headers.indexOf('ログID');

  if (logIdIdx === -1) {
    return 'LOG-00001';
  }

  // 最大のログIDを取得
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const currentId = String(data[i][logIdIdx]);
    if (currentId.startsWith('LOG-')) {
      const num = parseInt(currentId.replace('LOG-', ''), 10);
      if (num > maxId) {
        maxId = num;
      }
    }
  }

  const newId = 'LOG-' + String(maxId + 1).padStart(5, '0');
  return newId;
}

// ============================================================
// 複数チャンネル一括同期
// ============================================================

/**
 * 複数のDiscordチャンネルから会話履歴を一括同期
 * @param {Array<Object>} channels - チャンネル情報の配列 [{ channelId, leadId, name }]
 * @param {number} maxMessagesPerChannel - 各チャンネルの最大取得件数
 * @returns {Object} { success: boolean, results: Array, summary: Object }
 */
function syncMultipleDiscordChannels(channels, maxMessagesPerChannel = 1000) {
  try {
    const results = [];
    let totalSaved = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    Logger.log('複数チャンネル同期開始: ' + channels.length + ' チャンネル');

    channels.forEach((channel, index) => {
      Logger.log('[' + (index + 1) + '/' + channels.length + '] ' + channel.name + ' (Channel ID: ' + channel.channelId + ')');

      try {
        const result = syncDiscordToConversationLog(
          channel.channelId,
          channel.leadId || null,
          maxMessagesPerChannel,
          { autoLinkLead: !channel.leadId }
        );

        if (result.success) {
          totalSaved += result.savedCount || 0;
          totalSkipped += result.skippedCount || 0;
        } else {
          totalErrors++;
        }

        results.push({
          channelName: channel.name,
          channelId: channel.channelId,
          leadId: channel.leadId,
          success: result.success,
          savedCount: result.savedCount || 0,
          skippedCount: result.skippedCount || 0,
          error: result.error || null
        });

        // レート制限対策: チャンネル間で少し待機
        if (index < channels.length - 1) {
          Utilities.sleep(2000); // 2秒待機
        }
      } catch (error) {
        totalErrors++;
        results.push({
          channelName: channel.name,
          channelId: channel.channelId,
          leadId: channel.leadId,
          success: false,
          error: error.message || error.toString()
        });
      }
    });

    Logger.log('複数チャンネル同期完了: 合計保存 ' + totalSaved + ' 件');

    return {
      success: true,
      results: results,
      summary: {
        totalChannels: channels.length,
        totalSaved: totalSaved,
        totalSkipped: totalSkipped,
        totalErrors: totalErrors,
        successRate: Math.round((channels.length - totalErrors) / channels.length * 100) + '%'
      }
    };
  } catch (error) {
    Logger.log('syncMultipleDiscordChannels error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * CONFIG.DISCORD.CHANNELSから全チャンネルを同期
 * @param {number} maxMessagesPerChannel - 各チャンネルの最大取得件数
 * @returns {Object} 同期結果
 */
function syncAllConfiguredDiscordChannels(maxMessagesPerChannel = 1000) {
  try {
    const channels = [];

    // CONFIG.DISCORD.CHANNELSから設定を読み込み
    Object.keys(CONFIG.DISCORD.CHANNELS).forEach(channelId => {
      const config = CONFIG.DISCORD.CHANNELS[channelId];
      channels.push({
        channelId: channelId,
        leadId: config.leadId || null,
        name: config.name || channelId
      });
    });

    if (channels.length === 0) {
      return {
        success: false,
        error: 'CONFIG.DISCORD.CHANNELSにチャンネル設定がありません。08_Config.gsを確認してください。'
      };
    }

    Logger.log('設定済みチャンネル数: ' + channels.length);

    return syncMultipleDiscordChannels(channels, maxMessagesPerChannel);
  } catch (error) {
    Logger.log('syncAllConfiguredDiscordChannels error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 顧客マスタから全Discord チャンネル情報を取得
 * @returns {Array<Object>} チャンネル情報の配列 [{ channelId, leadId, customerName }]
 */
function getAllDiscordChannelsFromCustomerMaster() {
  try {
    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName('顧客マスタ');

    if (!customerSheet || customerSheet.getLastRow() < 2) {
      return {
        success: false,
        error: '顧客マスタシートが見つかりません'
      };
    }

    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];

    // 必要な列のインデックスを取得
    const channelIdIdx = headers.indexOf('Discord チャンネルID');
    const userIdIdx = headers.indexOf('Discord ユーザーID');
    const leadIdIdx = headers.indexOf('リードID');
    const customerNameIdx = headers.indexOf('B Name');

    if (channelIdIdx === -1) {
      return {
        success: false,
        error: '顧客マスタに「Discord チャンネルID」列が見つかりません'
      };
    }

    const channels = [];

    // 各行をチェック
    for (let i = 1; i < data.length; i++) {
      const channelId = String(data[i][channelIdIdx]).trim();
      const leadId = data[i][leadIdIdx];
      const customerName = data[i][customerNameIdx];

      // チャンネルIDが存在する行のみ追加
      if (channelId && channelId !== '' && channelId !== 'undefined') {
        channels.push({
          channelId: channelId,
          leadId: leadId || null,
          customerName: customerName || '不明',
          discordUserId: userIdIdx !== -1 ? data[i][userIdIdx] : null
        });
      }
    }

    return {
      success: true,
      channels: channels,
      totalCount: channels.length
    };
  } catch (error) {
    Logger.log('getAllDiscordChannelsFromCustomerMaster error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 顧客マスタから全Discord チャンネルの会話履歴を一括同期
 * @param {number} maxMessagesPerChannel - 各チャンネルの最大取得件数（デフォルト1000）
 * @returns {Object} 同期結果
 */
function syncAllDiscordChannelsFromCustomerMaster(maxMessagesPerChannel = 1000) {
  try {
    Logger.log('顧客マスタからDiscordチャンネル情報を取得中...');

    // 顧客マスタから全チャンネル情報を取得
    const result = getAllDiscordChannelsFromCustomerMaster();

    if (!result.success) {
      return result;
    }

    const channels = result.channels;

    if (channels.length === 0) {
      return {
        success: false,
        error: '顧客マスタにDiscord チャンネルIDが設定されている顧客が見つかりません'
      };
    }

    Logger.log('取得したチャンネル数: ' + channels.length);

    // チャンネル情報を整形
    const formattedChannels = channels.map(ch => ({
      channelId: ch.channelId,
      leadId: ch.leadId,
      name: ch.customerName + ' (' + ch.channelId.substring(0, 8) + '...)'
    }));

    // 一括同期実行
    return syncMultipleDiscordChannels(formattedChannels, maxMessagesPerChannel);
  } catch (error) {
    Logger.log('syncAllDiscordChannelsFromCustomerMaster error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}
