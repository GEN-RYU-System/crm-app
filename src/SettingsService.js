/**
 * 設定管理サービス
 *
 * Purpose: WebアプリからデプロイID・環境設定を表示・管理
 * Features:
 * - 現在のデプロイID取得
 * - CLAUDE.md整合性チェック
 * - Discord通知でClaude Codeに修正依頼
 */

// ========================================
// デプロイ情報取得
// ========================================

/**
 * 現在のデプロイメント情報を取得
 *
 * @returns {Object} デプロイメント情報
 */
function getDeploymentInfo() {
  try {
    // ScriptApp.getService()は使用不可（WebアプリのURLを返すのみ）
    // Apps Script APIを使用する必要があるが、OAuth設定が複雑
    // 代替案: スクリプトプロパティに保存された情報を返す

    const properties = PropertiesService.getScriptProperties();
    const scriptId = ScriptApp.getScriptId();

    const info = {
      scriptId: scriptId,
      deployments: {
        dev: {
          id: properties.getProperty('DEV_DEPLOYMENT_ID') || '未設定',
          url: properties.getProperty('DEV_URL') || '未設定',
          lastChecked: properties.getProperty('DEV_LAST_CHECKED') || '未確認'
        },
        prod: {
          id: properties.getProperty('PROD_DEPLOYMENT_ID') || '未設定',
          url: properties.getProperty('PROD_URL') || '未設定',
          lastChecked: properties.getProperty('PROD_LAST_CHECKED') || '未確認'
        }
      },
      claudeMd: {
        devId: getTestDeployId(), // Section 63準拠: Script Propertiesから取得
        prodId: getProductionDeployId() // Section 63準拠: Script Propertiesから取得
      },
      consistency: {
        dev: checkConsistency('dev'),
        prod: checkConsistency('prod')
      }
    };

    return info;

  } catch (error) {
    Logger.log(`getDeploymentInfo error: ${error.message}`);
    throw new Error('デプロイ情報の取得に失敗しました');
  }
}

/**
 * 整合性チェック
 *
 * @param {string} env - 環境（'dev'|'prod'）
 * @returns {Object} 整合性情報
 */
function checkConsistency(env) {
  const properties = PropertiesService.getScriptProperties();
  const propKey = env === 'dev' ? 'DEV_DEPLOYMENT_ID' : 'PROD_DEPLOYMENT_ID';
  const actualId = properties.getProperty(propKey);

  // Section 63準拠: Script Propertiesから取得
  let claudeMdId;
  if (env === 'dev') {
    claudeMdId = getTestDeployId();
  } else {
    claudeMdId = getProductionDeployId();
  }

  const isConsistent = actualId && actualId === claudeMdId;

  return {
    isConsistent: isConsistent,
    actualId: actualId || '未設定',
    claudeMdId: claudeMdId,
    message: isConsistent ? '✅ 整合性OK' : '⚠️ 不整合検知'
  };
}

// ========================================
// 手動デプロイID更新
// ========================================

/**
 * デプロイIDを手動で登録
 *
 * @param {string} env - 環境（'dev'|'prod'）
 * @param {string} deploymentId - デプロイID
 * @param {string} url - デプロイURL
 */
function registerDeploymentId(env, deploymentId, url) {
  const properties = PropertiesService.getScriptProperties();

  if (env === 'dev') {
    properties.setProperty('DEV_DEPLOYMENT_ID', deploymentId);
    properties.setProperty('DEV_URL', url);
    properties.setProperty('DEV_LAST_CHECKED', new Date().toISOString());
  } else if (env === 'prod') {
    properties.setProperty('PROD_DEPLOYMENT_ID', deploymentId);
    properties.setProperty('PROD_URL', url);
    properties.setProperty('PROD_LAST_CHECKED', new Date().toISOString());
  }

  Logger.log(`✅ ${env}環境のデプロイIDを登録しました: ${deploymentId}`);
}

// ========================================
// Discord通知でClaude Codeに修正依頼
// ========================================

/**
 * CLAUDE.md修正依頼をDiscordに送信
 *
 * @param {string} env - 環境（'dev'|'prod'）
 * @param {Object} consistency - 整合性情報
 * @returns {boolean} 送信成功/失敗
 */
function requestClaudeMdFix(env, consistency) {
  try {
    const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_HEALTH_CHECK_WEBHOOK');

    if (!webhookUrl) {
      throw new Error('Discord Webhook URLが未設定です');
    }

    const message = `🔧 **CLAUDE.md修正依頼**\n\n` +
      `**環境**: ${env === 'dev' ? '開発' : '本番'}\n` +
      `**検知内容**: デプロイID不整合\n\n` +
      `**詳細**:\n` +
      `- 実際のデプロイID: \`${consistency.actualId}\`\n` +
      `- CLAUDE.md記載ID: \`${consistency.claudeMdId}\`\n\n` +
      `**対応依頼**: Claude Codeは以下を実行してください\n` +
      `1. \`cd /Users/tanizawashingo/sales-ops-with-claude/02_apps/01_crm/prod\`\n` +
      `2. \`clasp deployments\` で最新のデプロイID一覧を確認\n` +
      `3. CLAUDE.md Section 4.1 のデプロイIDを \`${consistency.actualId}\` に更新\n` +
      `4. git commit & push\n\n` +
      `**ユーザー操作**: 不要（Claude Codeが自動対応）`;

    const payload = {
      embeds: [{
        title: 'CLAUDE.md修正依頼（ゼロコードUI）',
        description: message,
        color: 16776960, // 黄色
        timestamp: new Date().toISOString(),
        footer: {
          text: 'CRM設定管理UI'
        }
      }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(webhookUrl, options);

    if (response.getResponseCode() === 204) {
      Logger.log('✅ Claude Codeに修正依頼を送信しました');
      return true;
    } else {
      Logger.log(`Discord通知エラー: ${response.getResponseCode()}`);
      return false;
    }

  } catch (error) {
    Logger.log(`requestClaudeMdFix error: ${error.message}`);
    return false;
  }
}

// ========================================
// 初回セットアップ
// ========================================

/**
 * 開発環境デプロイIDを登録（初回のみ実行）
 *
 * 実行方法: GASエディタで手動実行
 */
function setupDevDeploymentId() {
  registerDeploymentId(
    'dev',
    'AKfycbzQHSxvclub_8ye620_dVzrVnwwueMMAc9HdGsTpGH-',
    'https://script.google.com/a/macros/treasureislandjp.com/s/AKfycbzQHSxvclub_8ye620_dVzrVnwwueMMAc9HdGsTpGH-/dev?authuser=0'
  );

  Logger.log('初回セットアップ完了');
}
