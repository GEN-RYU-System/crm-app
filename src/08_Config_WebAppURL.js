/**
 * WebアプリURL管理（環境別）
 */

/**
 * 現在の環境に応じたWebアプリURLを取得
 * @returns {string} WebアプリURL
 */
function getWebAppUrl() {
  const env = getEnvironment();
  const scriptId = ScriptApp.getScriptId();

  if (env === 'development') {
    // 開発環境: /dev エンドポイント（テストデプロイ）
    return `https://script.google.com/macros/s/${scriptId}/dev`;
  } else {
    // 本番環境: /exec エンドポイント（本番デプロイ）
    return ScriptApp.getService().getUrl();
  }
}

/**
 * Webアプリを開く（環境対応版）
 * gas/07_Code.js のopenWebApp関数を置き換える
 */
function openWebApp_EnvAware() {
  const url = getWebAppUrl();
  const env = getEnvironment();
  const ui = SpreadsheetApp.getUi();

  const envLabel = env === 'development' ? '【開発環境】' : '【本番環境】';

  const result = ui.alert(
    'Web App URL ' + envLabel,
    'URLをコピーしてブラウザで開いてください:\n\n' + url + '?authuser=0\n\n環境: ' + env,
    ui.ButtonSet.OK
  );
}

/**
 * 現在の環境とWebアプリURLを確認（デバッグ用）
 */
function showWebAppInfo() {
  const env = getEnvironment();
  const url = getWebAppUrl();
  const scriptId = ScriptApp.getScriptId();

  Logger.log('========================================');
  Logger.log('WebアプリURL情報');
  Logger.log('========================================');
  Logger.log('環境: ' + env);
  Logger.log('Script ID: ' + scriptId);
  Logger.log('WebアプリURL: ' + url);
  Logger.log('========================================');

  return {
    environment: env,
    scriptId: scriptId,
    webAppUrl: url
  };
}
