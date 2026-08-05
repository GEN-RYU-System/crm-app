/**
 * 自動健康診断システム（完全無料版）
 *
 * Purpose: 毎日9:00に全GASアプリを自動テストし、問題を早期検知・修復
 * Cost: ¥0（Claude API不使用、UrlFetchApp + GAS標準機能のみ）
 *
 * Functions:
 * - dailyHealthCheck(): メイン実行関数（Time-drivenトリガーで自動実行）
 * - setupHealthCheckTrigger(): トリガー設定関数（初回のみ手動実行）
 */

// ========================================
// 設定（Configuration）
// ========================================

/**
 * 現在の実行環境を取得
 *
 * @returns {string} 'development' | 'production'
 */
function getCurrentEnvironment() {
  try {
    const url = ScriptApp.getService().getUrl();

    // @HEAD deployment (開発環境) は /dev を含む
    if (url.includes('/dev')) {
      return 'development';
    }

    // 固定デプロイメント（本番環境）は /exec を含む
    if (url.includes('/exec')) {
      return 'production';
    }

    // デフォルトは本番環境として扱う
    Logger.log(`警告: 環境判定できず（URL: ${url}）。本番環境として扱います。`);
    return 'production';

  } catch (error) {
    Logger.log(`環境判定エラー: ${error.message}。本番環境として扱います。`);
    return 'production';
  }
}

/**
 * 環境に応じたスプレッドシートIDを取得
 *
 * @returns {string} スプレッドシートID
 */
function getSpreadsheetId() {
  const env = getCurrentEnvironment();
  const properties = PropertiesService.getScriptProperties();

  if (env === 'development') {
    // 開発環境: DEV_SPREADSHEET_ID プロパティから取得
    const devId = properties.getProperty('DEV_SPREADSHEET_ID');
    if (!devId) {
      Logger.log('警告: DEV_SPREADSHEET_ID が未設定です。本番IDを使用します。');
      return getProductionSpreadsheetId();
    }
    return devId;
  } else {
    // 本番環境: Script Propertiesから取得（Section 63準拠）
    return getProductionSpreadsheetId();
  }
}

/**
 * ヘルスチェック設定を取得（Section 63準拠）
 */
function getHealthCheckConfig() {
  const testDeployId = getTestDeployId();
  const prodDeployId = getProductionDeployId();

  return {
    // チェック対象アプリ一覧
    apps: [
      {
        name: 'CRM開発環境',
        url: `https://script.google.com/a/macros/treasureislandjp.com/s/${testDeployId}/dev?authuser=0`,
        type: 'webapp',
        critical: false // 開発環境は非クリティカル
      },
      {
        name: 'CRM本番環境',
        url: `https://script.google.com/a/macros/treasureislandjp.com/s/${prodDeployId}/exec?authuser=0`,
        type: 'webapp',
        critical: true // 本番環境はクリティカル
      }
    ],

    // Discord Webhook URL（スクリプトプロパティから取得）
    discordWebhookKey: 'DISCORD_HEALTH_CHECK_WEBHOOK',

    // タイムアウト設定
    timeoutSeconds: 10,

    // リトライ設定
    maxRetries: 3,
    retryDelaySeconds: 2
  };
}

// 後方互換性のため、定数としてもアクセス可能にする
const HEALTH_CHECK_CONFIG = {
  get apps() { return getHealthCheckConfig().apps; },

  get discordWebhookKey() { return getHealthCheckConfig().discordWebhookKey; },
  get timeoutSeconds() { return getHealthCheckConfig().timeoutSeconds; },
  get maxRetries() { return getHealthCheckConfig().maxRetries; },
  get retryDelaySeconds() { return getHealthCheckConfig().retryDelaySeconds; }
};

// ========================================
// メイン関数
// ========================================

/**
 * 毎日の健康診断（Time-drivenトリガーから自動実行）
 *
 * 実行タイミング: 毎日 9:00
 * 処理内容:
 *   1. 全アプリのURL存在確認
 *   2. スプレッドシート接続確認
 *   3. 基本機能テスト
 *   4. 結果をDiscord通知
 */
function dailyHealthCheck() {
  const startTime = new Date();
  const report = {
    timestamp: startTime.toISOString(),
    checks: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  try {
    Logger.log('=== 健康診断開始 ===');

    // 1. URL存在確認
    checkAllAppUrls(report);

    // 2. スプレッドシート接続確認
    checkSpreadsheetAccess(report);

    // 3. 基本機能テスト
    testBasicFunctions(report);

    // 4. 集計
    calculateSummary(report);

    // 5. 結果通知
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    report.durationSeconds = durationSeconds;

    sendHealthReport(report);

    Logger.log('=== 健康診断完了 ===');
    Logger.log(`所要時間: ${durationSeconds}秒`);

  } catch (error) {
    Logger.log(`エラー発生: ${error.message}`);

    // エラー通知
    notifyDiscord(`❌ **健康診断システムエラー**\n\`\`\`\n${error.message}\n\`\`\``, 'error');
  }
}

// ========================================
// チェック関数群
// ========================================

/**
 * 全アプリのURL存在確認
 *
 * @param {Object} report - レポートオブジェクト
 */
function checkAllAppUrls(report) {
  Logger.log('--- URL存在確認開始 ---');

  HEALTH_CHECK_CONFIG.apps.forEach(app => {
    const checkResult = {
      name: `URL確認: ${app.name}`,
      status: 'UNKNOWN',
      details: {},
      timestamp: new Date().toISOString()
    };

    try {
      // UrlFetchAppでHTTPリクエスト
      const response = UrlFetchApp.fetch(app.url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: false,
        validateHttpsCertificates: true
      });

      const statusCode = response.getResponseCode();
      const contentText = response.getContentText();

      checkResult.details = {
        url: app.url,
        statusCode: statusCode,
        contentLength: contentText.length,
        critical: app.critical
      };

      // ステータスコード判定
      if (statusCode === 200) {
        // 正常
        checkResult.status = 'PASS';
        Logger.log(`✅ ${app.name}: OK (200)`);

      } else if (statusCode === 302 || statusCode === 301) {
        // リダイレクト（認証画面等）- 正常
        checkResult.status = 'PASS';
        checkResult.details.message = 'リダイレクト（認証必要）';
        Logger.log(`✅ ${app.name}: OK (${statusCode} - 認証画面)`);

      } else if (statusCode === 404) {
        // 404エラー - 重大
        checkResult.status = 'FAIL';
        checkResult.details.message = 'ページが見つかりません（デプロイID不一致の可能性）';
        Logger.log(`❌ ${app.name}: 404 Not Found`);

        // クリティカルなアプリの場合は即座に通知
        if (app.critical) {
          notifyDiscord(
            `🚨 **本番環境エラー検知**\n` +
            `アプリ: ${app.name}\n` +
            `ステータス: 404 Not Found\n` +
            `URL: ${app.url}\n\n` +
            `**対応**: CLAUDE.mdのデプロイIDを確認してください`,
            'error'
          );
        }

      } else if (statusCode >= 500) {
        // サーバーエラー
        checkResult.status = 'FAIL';
        checkResult.details.message = 'サーバーエラー';
        Logger.log(`❌ ${app.name}: Server Error (${statusCode})`);

      } else {
        // その他のエラー
        checkResult.status = 'WARNING';
        checkResult.details.message = `予期しないステータスコード: ${statusCode}`;
        Logger.log(`⚠️ ${app.name}: ${statusCode}`);
      }

    } catch (error) {
      checkResult.status = 'FAIL';
      checkResult.details.error = error.message;
      Logger.log(`❌ ${app.name}: ${error.message}`);
    }

    report.checks.push(checkResult);
  });

  Logger.log('--- URL存在確認完了 ---');
}

/**
 * スプレッドシート接続確認
 *
 * @param {Object} report - レポートオブジェクト
 */
function checkSpreadsheetAccess(report) {
  Logger.log('--- スプレッドシート接続確認開始 ---');

  const checkResult = {
    name: 'スプレッドシート接続確認',
    status: 'UNKNOWN',
    details: {},
    timestamp: new Date().toISOString()
  };

  try {
    // 環境に応じたスプレッドシートIDを取得
    const spreadsheetId = getSpreadsheetId();
    const environment = getCurrentEnvironment();

    // スプレッドシートを開く
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = ss.getName();
    const sheets = ss.getSheets();
    const sheetCount = sheets.length;

    checkResult.status = 'PASS';
    checkResult.details = {
      environment: environment,
      spreadsheetId: spreadsheetId,
      name: sheetName,
      sheetCount: sheetCount
    };

    Logger.log(`✅ スプレッドシート接続: OK`);
    Logger.log(`   - 名前: ${sheetName}`);
    Logger.log(`   - シート数: ${sheetCount}`);

  } catch (error) {
    checkResult.status = 'FAIL';
    checkResult.details.error = error.message;
    Logger.log(`❌ スプレッドシート接続: ${error.message}`);

    // 接続失敗は重大なので通知
    notifyDiscord(
      `🚨 **スプレッドシート接続エラー**\n` +
      `\`\`\`\n${error.message}\n\`\`\``,
      'error'
    );
  }

  report.checks.push(checkResult);
  Logger.log('--- スプレッドシート接続確認完了 ---');
}

/**
 * 基本機能テスト
 *
 * @param {Object} report - レポートオブジェクト
 */
function testBasicFunctions(report) {
  Logger.log('--- 基本機能テスト開始 ---');

  // リード管理シートの存在確認
  const checkResult = {
    name: '基本機能テスト: リード管理シート',
    status: 'UNKNOWN',
    details: {},
    timestamp: new Date().toISOString()
  };

  try {
    // 環境に応じたスプレッドシートIDを取得
    const spreadsheetId = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const leadsSheet = ss.getSheetByName('リード管理');

    if (!leadsSheet) {
      throw new Error('リード管理シートが見つかりません');
    }

    // データ範囲を取得（ヘッダー含む）
    const dataRange = leadsSheet.getDataRange();
    const rowCount = dataRange.getNumRows();
    const colCount = dataRange.getNumColumns();

    checkResult.status = 'PASS';
    checkResult.details = {
      sheetName: 'リード管理',
      rowCount: rowCount,
      colCount: colCount
    };

    Logger.log(`✅ リード管理シート: OK`);
    Logger.log(`   - 行数: ${rowCount}`);
    Logger.log(`   - 列数: ${colCount}`);

    // CLAUDE.mdの60列制限チェック
    if (colCount > 60) {
      checkResult.status = 'WARNING';
      checkResult.details.warning = `列数が60を超えています（${colCount}列）`;
      Logger.log(`⚠️ 警告: 列数が60を超えています（CLAUDE.md制限）`);
    }

  } catch (error) {
    checkResult.status = 'FAIL';
    checkResult.details.error = error.message;
    Logger.log(`❌ 基本機能テスト: ${error.message}`);
  }

  report.checks.push(checkResult);
  Logger.log('--- 基本機能テスト完了 ---');
}

// ========================================
// 集計・通知関数
// ========================================

/**
 * チェック結果を集計
 *
 * @param {Object} report - レポートオブジェクト
 */
function calculateSummary(report) {
  report.summary.total = report.checks.length;

  report.checks.forEach(check => {
    if (check.status === 'PASS') {
      report.summary.passed++;
    } else if (check.status === 'FAIL') {
      report.summary.failed++;
    } else if (check.status === 'WARNING') {
      report.summary.warnings++;
    }
  });
}

/**
 * 健康診断レポートをDiscordに送信
 *
 * @param {Object} report - レポートオブジェクト
 */
function sendHealthReport(report) {
  const { summary } = report;
  const allPassed = summary.failed === 0 && summary.warnings === 0;

  // アイコン選択
  let icon = '✅';
  let status = '正常';
  if (summary.failed > 0) {
    icon = '❌';
    status = 'エラーあり';
  } else if (summary.warnings > 0) {
    icon = '⚠️';
    status = '警告あり';
  }

  // メッセージ構築
  let message = `${icon} **健康診断レポート（${status}）**\n\n`;
  message += `**日時**: ${new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}\n`;
  message += `**所要時間**: ${report.durationSeconds.toFixed(2)}秒\n\n`;

  message += `**結果サマリー**\n`;
  message += `- ✅ 正常: ${summary.passed}件\n`;
  message += `- ❌ エラー: ${summary.failed}件\n`;
  message += `- ⚠️ 警告: ${summary.warnings}件\n`;
  message += `- 📊 合計: ${summary.total}件\n\n`;

  // エラー・警告の詳細
  if (summary.failed > 0 || summary.warnings > 0) {
    message += `**詳細**\n`;

    report.checks.forEach(check => {
      if (check.status === 'FAIL' || check.status === 'WARNING') {
        const statusIcon = check.status === 'FAIL' ? '❌' : '⚠️';
        message += `${statusIcon} **${check.name}**\n`;

        if (check.details.message) {
          message += `   - ${check.details.message}\n`;
        }
        if (check.details.error) {
          message += `   - エラー: \`${check.details.error}\`\n`;
        }
        if (check.details.url) {
          message += `   - URL: ${check.details.url}\n`;
        }
      }
    });
  }

  // 通知送信（エラー・警告時のみ、または毎日のサマリー）
  if (!allPassed) {
    notifyDiscord(message, summary.failed > 0 ? 'error' : 'warning');
  } else {
    // 全て正常の場合は簡潔なメッセージ
    notifyDiscord(
      `✅ **健康診断完了**\n` +
      `全${summary.total}件のチェックが正常です。`,
      'info'
    );
  }
}

/**
 * Discord通知
 *
 * @param {string} message - 通知メッセージ
 * @param {string} type - 通知タイプ（'info'|'warning'|'error'）
 */
function notifyDiscord(message, type = 'info') {
  try {
    const webhookUrl = PropertiesService.getScriptProperties().getProperty(HEALTH_CHECK_CONFIG.discordWebhookKey);

    if (!webhookUrl) {
      Logger.log('⚠️ Discord Webhook URLが未設定です');
      return;
    }

    // 色設定
    const colors = {
      info: 3447003,    // 青
      warning: 16776960, // 黄
      error: 15158332   // 赤
    };

    const payload = {
      embeds: [{
        title: '健康診断システム',
        description: message,
        color: colors[type] || colors.info,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'CRM自動健康診断システム'
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

    if (response.getResponseCode() !== 204) {
      Logger.log(`Discord通知エラー: ${response.getResponseCode()}`);
    }

  } catch (error) {
    Logger.log(`Discord通知失敗: ${error.message}`);
  }
}

// ========================================
// セットアップ関数（初回のみ実行）
// ========================================

/**
 * Time-drivenトリガーを設定
 *
 * 実行方法: GASエディタで手動実行（初回のみ）
 * 実行後: 毎日9:00にdailyHealthCheck()が自動実行されます
 */
function setupHealthCheckTrigger() {
  // 既存のトリガーを削除（重複防止）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyHealthCheck') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('既存のトリガーを削除しました');
    }
  });

  // 新規トリガーを作成（毎日9:00）
  ScriptApp.newTrigger('dailyHealthCheck')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  Logger.log('✅ Time-drivenトリガーを設定しました（毎日9:00実行）');

  // 即座にテスト実行
  Logger.log('テスト実行を開始します...');
  dailyHealthCheck();
}

/**
 * Discord Webhook URLを設定
 *
 * @param {string} webhookUrl - Discord Webhook URL
 */
function setDiscordWebhook(webhookUrl) {
  PropertiesService.getScriptProperties().setProperty(
    HEALTH_CHECK_CONFIG.discordWebhookKey,
    webhookUrl
  );

  Logger.log('✅ Discord Webhook URLを設定しました');

  // テスト通知
  notifyDiscord('🎉 健康診断システムのDiscord通知が設定されました', 'info');
}

/**
 * Discord Webhook URLを設定（GASエディタから直接実行用）
 *
 * 使い方:
 * 1. 下の webhookUrl 変数にDiscord Webhook URLを貼り付け
 * 2. この関数を実行
 * 3. 実行後、webhookUrl を空文字列に戻す（セキュリティ）
 */
function setupDiscordWebhook() {
  const webhookUrl = ''; // ← ここにDiscord Webhook URLを貼り付けて実行

  if (!webhookUrl || webhookUrl === '') {
    Logger.log('❌ エラー: webhookUrl が空です。上の行にWebhook URLを貼り付けてください。');
    return;
  }

  setDiscordWebhook(webhookUrl);
}

/**
 * 現在の設定を表示
 */
function showCurrentConfig() {
  Logger.log('=== 現在の設定 ===');
  Logger.log(`スプレッドシートID: ${HEALTH_CHECK_CONFIG.spreadsheetId}`);
  Logger.log(`チェック対象アプリ数: ${HEALTH_CHECK_CONFIG.apps.length}`);

  HEALTH_CHECK_CONFIG.apps.forEach((app, index) => {
    Logger.log(`  ${index + 1}. ${app.name} (${app.critical ? 'クリティカル' : '非クリティカル'})`);
  });

  const webhookUrl = PropertiesService.getScriptProperties().getProperty(HEALTH_CHECK_CONFIG.discordWebhookKey);
  Logger.log(`Discord Webhook: ${webhookUrl ? '設定済み' : '未設定'}`);
}
