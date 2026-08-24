/**
 * 開発環境セットアップ
 *
 * このファイルの関数を実行して、開発環境の設定を行います。
 */

/**
 * 開発環境を設定
 *
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. 関数選択 → setupDevelopmentEnvironment
 * 3. 実行ボタン（▶️）をクリック
 */
function setupDevelopmentEnvironment() {
  const props = PropertiesService.getScriptProperties();

  // 環境を'development'に設定
  props.setProperty('ENVIRONMENT', 'development');
  Logger.log('✓ 環境を development に設定しました');

  // 開発用スプレッドシートIDを設定
  const devSpreadsheetId = getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID');
  props.setProperty('DEV_SPREADSHEET_ID', devSpreadsheetId);
  Logger.log('✓ 開発用スプレッドシートIDの設定を確認しました');

  // 確認
  Logger.log('\n========================================');
  Logger.log('開発環境セットアップ完了');
  Logger.log('========================================');
  Logger.log('環境: ' + props.getProperty('ENVIRONMENT'));
  Logger.log('開発用スプレッドシートID: ' + props.getProperty('DEV_SPREADSHEET_ID'));
  Logger.log('');
  Logger.log('次のステップ:');
  Logger.log('1. runAllSetupTests() で動作確認');
}

/**
 * 本番環境を設定
 *
 * 本番環境に切り替える場合に使用
 */
function setupProductionEnvironment() {
  const props = PropertiesService.getScriptProperties();

  // 環境を'production'に設定
  props.setProperty('ENVIRONMENT', 'production');
  Logger.log('✓ 環境を production に設定しました');

  // 確認
  Logger.log('\n========================================');
  Logger.log('本番環境セットアップ完了');
  Logger.log('========================================');
  Logger.log('環境: ' + props.getProperty('ENVIRONMENT'));
  Logger.log('本番用スプレッドシートID: [configured via PRODUCTION_SPREADSHEET_ID]');
  Logger.log('');
  Logger.log('注意: 本番環境での作業は慎重に行ってください');
}

/**
 * 現在の環境設定を確認
 */
function checkCurrentEnvironment() {
  const props = PropertiesService.getScriptProperties();
  const env = props.getProperty('ENVIRONMENT') || 'production (デフォルト)';
  const devId = props.getProperty('DEV_SPREADSHEET_ID') || '未設定';

  Logger.log('========================================');
  Logger.log('現在の環境設定');
  Logger.log('========================================');
  Logger.log('環境: ' + env);
  Logger.log('開発用スプレッドシートID: ' + devId);
  Logger.log('本番用スプレッドシートID: [configured via PRODUCTION_SPREADSHEET_ID]');
  Logger.log('');

  // getSpreadsheet()で実際に取得されるスプレッドシートを確認
  try {
    const ss = getSpreadsheet();
    Logger.log('getSpreadsheet()が返すスプレッドシート:');
    Logger.log('  名前: ' + ss.getName());
    Logger.log('  ID: ' + ss.getId());
  } catch (e) {
    Logger.log('getSpreadsheet()エラー: ' + e.message);
  }
}

/**
 * 環境設定をリセット（デフォルトに戻す）
 */
function resetEnvironment() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('ENVIRONMENT');
  props.deleteProperty('DEV_SPREADSHEET_ID');

  Logger.log('✓ 環境設定をリセットしました');
  Logger.log('デフォルト環境（production）に戻りました');
}
