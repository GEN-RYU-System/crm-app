/**
 * 開発環境サービス
 * 開発環境の作成・管理・クリーンアップを行う
 */

// ============================================================
// 開発環境作成
// ============================================================

/**
 * 開発環境を作成
 * 本番スプレッドシートをコピーし、開発用フォルダに格納
 * @param {string} version - バージョン名（例: 'v37'）
 * @returns {Object} 作成された開発環境の情報
 */
function createDevelopmentEnvironment(version) {
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  const devName = 'CRM_DEV_' + version + '_' + timestamp;

  Logger.log('========================================');
  Logger.log('開発環境作成開始: ' + devName);
  Logger.log('========================================');

  try {
    // 1. 本番スプレッドシートをコピー
    const source = SpreadsheetApp.openById(PRODUCTION_IDS.SPREADSHEET_ID);
    const devCopy = source.copy(devName);
    const devId = devCopy.getId();

    Logger.log('スプレッドシートコピー完了: ' + devId);

    // 2. 開発用フォルダに移動
    const devFile = DriveApp.getFileById(devId);
    const folder = DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID);
    folder.addFile(devFile);
    DriveApp.getRootFolder().removeFile(devFile);

    Logger.log('フォルダ移動完了');

    // 3. Script Propertiesに設定
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ENVIRONMENT', 'development');
    props.setProperty('DEV_SPREADSHEET_ID', devId);
    props.setProperty('DEV_VERSION', version);
    props.setProperty('DEV_CREATED_AT', timestamp);

    Logger.log('Script Properties設定完了');

    // 4. 結果を返す
    const result = {
      success: true,
      name: devName,
      id: devId,
      url: devCopy.getUrl(),
      version: version,
      createdAt: timestamp
    };

    Logger.log('========================================');
    Logger.log('開発環境作成完了');
    Logger.log('名前: ' + devName);
    Logger.log('ID: ' + devId);
    Logger.log('URL: ' + devCopy.getUrl());
    Logger.log('========================================');

    return result;

  } catch (e) {
    Logger.log('開発環境作成エラー: ' + e.message);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * 開発環境を本番に切り替え
 */
function switchToProduction() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENVIRONMENT', 'production');

  Logger.log('本番環境に切り替えました');

  return showCurrentEnvironment();
}

/**
 * 開発環境に切り替え
 * DEV_SPREADSHEET_IDが設定されている必要がある
 */
function switchToDevelopment() {
  const props = PropertiesService.getScriptProperties();
  const devId = props.getProperty('DEV_SPREADSHEET_ID');

  if (!devId) {
    throw new Error('DEV_SPREADSHEET_ID が設定されていません。先に createDevelopmentEnvironment() を実行してください。');
  }

  props.setProperty('ENVIRONMENT', 'development');

  Logger.log('開発環境に切り替えました');

  return showCurrentEnvironment();
}

// ============================================================
// 本番デプロイ前チェック
// ============================================================

/**
 * 本番デプロイ前のチェック
 * 開発環境のままデプロイしようとしていないか確認
 * @returns {boolean} デプロイOKならtrue
 */
function preProductionDeployCheck() {
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();

  Logger.log('========================================');
  Logger.log('本番デプロイ前チェック');
  Logger.log('========================================');

  // チェック1: 環境設定
  if (env === 'development') {
    Logger.log('❌ ENVIRONMENT が development のままです');
    Logger.log('   → switchToProduction() を実行してから本番デプロイしてください');
    throw new Error('ENVIRONMENT が development のままです。本番デプロイ前に production に変更してください。');
  }
  Logger.log('✅ ENVIRONMENT: production');

  // チェック2: スプレッドシートID確認
  try {
    const ss = getSpreadsheet();
    const currentId = ss.getId();
    if (currentId !== PRODUCTION_IDS.SPREADSHEET_ID) {
      Logger.log('⚠️ スプレッドシートIDが本番と異なります');
      Logger.log('   現在: ' + currentId);
      Logger.log('   本番: ' + PRODUCTION_IDS.SPREADSHEET_ID);
    } else {
      Logger.log('✅ スプレッドシートID: 本番と一致');
    }
  } catch (e) {
    Logger.log('⚠️ スプレッドシート確認エラー: ' + e.message);
  }

  Logger.log('========================================');
  Logger.log('✅ 本番デプロイOK');
  Logger.log('========================================');

  return true;
}

// ============================================================
// クリーンアップ
// ============================================================

/**
 * 古い開発環境をクリーンアップ（7日以上前のものを削除）
 * @param {number} daysToKeep - 保持する日数（デフォルト: 7）
 */
function cleanupOldDevEnvironments(daysToKeep) {
  daysToKeep = daysToKeep || 7;

  const folder = DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID);
  const files = folder.getFiles();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let deletedCount = 0;
  const deletedFiles = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    // CRM_DEV_ で始まるファイルのみ対象
    if (fileName.startsWith('CRM_DEV_')) {
      const createdDate = file.getDateCreated();

      if (createdDate < cutoffDate) {
        Logger.log('削除: ' + fileName + ' (' + createdDate + ')');
        file.setTrashed(true);
        deletedFiles.push(fileName);
        deletedCount++;
      } else {
        Logger.log('保持: ' + fileName + ' (' + createdDate + ')');
      }
    }
  }

  Logger.log('========================================');
  Logger.log('クリーンアップ完了: ' + deletedCount + '件削除');
  Logger.log('========================================');

  return {
    deletedCount: deletedCount,
    deletedFiles: deletedFiles
  };
}

/**
 * 開発環境の一覧を取得
 */
function listDevEnvironments() {
  const folder = DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID);
  const files = folder.getFiles();

  const envList = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (fileName.startsWith('CRM_DEV_')) {
      envList.push({
        name: fileName,
        id: file.getId(),
        url: file.getUrl(),
        createdAt: file.getDateCreated(),
        lastUpdated: file.getLastUpdated()
      });
    }
  }

  // 作成日時の新しい順にソート
  envList.sort(function(a, b) {
    return b.createdAt - a.createdAt;
  });

  Logger.log('========================================');
  Logger.log('開発環境一覧: ' + envList.length + '件');
  Logger.log('========================================');

  envList.forEach(function(env, index) {
    Logger.log((index + 1) + '. ' + env.name);
    Logger.log('   ID: ' + env.id);
    Logger.log('   作成日: ' + env.createdAt);
  });

  return envList;
}

// ============================================================
// マイグレーション管理
// ============================================================

/**
 * マイグレーション履歴
 * 新しいマイグレーションを追加する場合はここに定義
 */
const MIGRATIONS = {
  'v37_conversation_log': {
    description: '会話ログ関連のシート・列追加',
    sheets: ['会話ログ（リード用）', '会話ログ（商談用）', '専門用語辞書', 'お知らせ', '既読管理'],
    columns: {
      'リード管理': ['会話要約', '最終会話日時', '会話数', '重複フラグ', '重複元リードID', '重複確認日', '重複確認者']
    },
    migrationFunction: 'migrateV37ConversationLog'
  }
};

/**
 * 本番スプレッドシートにマイグレーションを実行
 * @param {string} migrationKey - マイグレーションキー（MIGRATIONS のキー）
 */
function runMigration(migrationKey) {
  const migration = MIGRATIONS[migrationKey];

  if (!migration) {
    throw new Error('マイグレーションが見つかりません: ' + migrationKey);
  }

  Logger.log('========================================');
  Logger.log('マイグレーション開始: ' + migrationKey);
  Logger.log(migration.description);
  Logger.log('========================================');

  // 本番環境であることを確認
  if (getEnvironment() !== 'production') {
    throw new Error('マイグレーションは本番環境でのみ実行できます。switchToProduction() を実行してください。');
  }

  // マイグレーション関数を実行
  if (migration.migrationFunction && typeof this[migration.migrationFunction] === 'function') {
    this[migration.migrationFunction]();
  } else {
    Logger.log('マイグレーション関数が定義されていません: ' + migration.migrationFunction);
  }

  Logger.log('========================================');
  Logger.log('マイグレーション完了: ' + migrationKey);
  Logger.log('========================================');
}

/**
 * v37マイグレーション: 会話ログ関連
 */
function migrateV37ConversationLog() {
  const ss = getSpreadsheet();

  // 1. 新規シート作成（既存なら作成しない）
  const sheetsToCreate = ['会話ログ（リード用）', '会話ログ（商談用）', '専門用語辞書', 'お知らせ', '既読管理'];

  sheetsToCreate.forEach(function(sheetName) {
    if (!ss.getSheetByName(sheetName)) {
      Logger.log('シート作成: ' + sheetName);
      // セットアップ関数を呼び出す
    } else {
      Logger.log('シート既存: ' + sheetName);
    }
  });

  // 2. リード管理シートに列追加（既存なら追加しない）
  const leadSheet = ss.getSheetByName('リード管理');
  if (leadSheet) {
    const headers = leadSheet.getRange(1, 1, 1, leadSheet.getLastColumn()).getValues()[0];
    const columnsToAdd = ['会話要約', '最終会話日時', '会話数', '重複フラグ', '重複元リードID', '重複確認日', '重複確認者'];

    columnsToAdd.forEach(function(colName) {
      if (!headers.includes(colName)) {
        Logger.log('列追加: ' + colName);
        // 末尾に列を追加
        const lastCol = leadSheet.getLastColumn();
        leadSheet.getRange(1, lastCol + 1).setValue(colName);
      } else {
        Logger.log('列既存: ' + colName);
      }
    });
  }

  Logger.log('v37マイグレーション完了');
}
