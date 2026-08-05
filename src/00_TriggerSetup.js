/**
 * トリガーセットアップ
 *
 * このファイルには、プロジェクトで使用する全てのトリガーの作成・管理機能が含まれます。
 *
 * 重要: clasp run ではトリガー作成関数を実行できません。
 * 以下のいずれかの方法で実行してください：
 * 1. カスタムメニュー「🔧 管理」→「📊 トリガーをセットアップ」
 * 2. GAS エディタで関数を選択して実行
 */

// ==========================================
// トリガーセットアップ
// ==========================================

/**
 * 全トリガーをセットアップ
 *
 * カスタムメニューまたは GAS エディタから実行してください。
 * clasp run では実行できません。
 */
function setupAllTriggers() {
  try {
    // 既存トリガーを削除
    deleteAllTriggers();

    // 環境を確認
    const env = getERPEnvironment();
    Logger.log('環境: ' + env);

    if (env === 'development') {
      // テスト環境: テスト用トリガーのみ
      setupTestTriggers();
    } else {
      // 本番環境: 本番用トリガーを作成
      setupProductionTriggers();
    }

    Logger.log('========================================');
    Logger.log('トリガーセットアップ完了');
    Logger.log('========================================');

    // ユーザーに通知
    if (typeof SpreadsheetApp !== 'undefined') {
      SpreadsheetApp.getUi().alert('トリガーをセットアップしました。\n\n「🔧 管理」→「📋 トリガー一覧を表示」で確認してください。');
    }
  } catch (e) {
    Logger.log('エラー: ' + e.message);
    Logger.log('スタックトレース: ' + e.stack);
    throw e;
  }
}

/**
 * テスト環境用トリガー
 */
function setupTestTriggers() {
  Logger.log('テスト環境用トリガーを作成中...');

  // テスト用: 1時間ごとに環境確認
  safeCreateTrigger(
    'testEnvironmentCheck',
    ScriptApp.newTrigger('testEnvironmentCheck')
      .timeBased()
      .everyHours(1)
  );

  Logger.log('テスト環境用トリガー作成完了');
}

/**
 * 本番環境用トリガー
 */
function setupProductionTriggers() {
  Logger.log('本番環境用トリガーを作成中...');

  // ==========================================
  // 業務トリガー（既存機能）
  // ==========================================

  // onEditトリガー（インストーラブル）
  safeCreateTrigger(
    'onEditTrigger',
    ScriptApp.newTrigger('onEditTrigger')
      .forSpreadsheet(getSpreadsheet())
      .onEdit()
  );

  // 48時間リマインド（1時間ごと）
  safeCreateTrigger(
    'checkAndRemind',
    ScriptApp.newTrigger('checkAndRemind')
      .timeBased()
      .everyHours(1)
  );

  // 月次アーカイブ（毎月1日AM3:00）
  safeCreateTrigger(
    'runMonthlyArchive',
    ScriptApp.newTrigger('runMonthlyArchive')
      .timeBased()
      .onMonthDay(1)
      .atHour(3)
      .inTimezone('Asia/Tokyo')
  );

  // データ量監視（毎日AM6:00）
  safeCreateTrigger(
    'checkDataVolume',
    ScriptApp.newTrigger('checkDataVolume')
      .timeBased()
      .atHour(6)
      .everyDays(1)
      .inTimezone('Asia/Tokyo')
  );

  // ==========================================
  // レポートトリガー（新機能）
  // ==========================================

  // 日次レポート（毎日午前9時）
  safeCreateTrigger(
    'generateDailyReport',
    ScriptApp.newTrigger('generateDailyReport')
      .timeBased()
      .atHour(9)
      .everyDays(1)
      .inTimezone('Asia/Tokyo')
  );

  // 週次レポート（毎週月曜日午前10時）
  safeCreateTrigger(
    'generateWeeklyReport',
    ScriptApp.newTrigger('generateWeeklyReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(10)
      .inTimezone('Asia/Tokyo')
  );

  // バックアップ（毎日午前3時）
  safeCreateTrigger(
    'backupData',
    ScriptApp.newTrigger('backupData')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .inTimezone('Asia/Tokyo')
  );

  Logger.log('本番環境用トリガー作成完了（業務トリガー4件 + レポートトリガー3件）');
}

/**
 * 安全にトリガーを作成
 *
 * @param {string} functionName - トリガーで実行する関数名
 * @param {TriggerBuilder} triggerBuilder - トリガービルダー
 */
function safeCreateTrigger(functionName, triggerBuilder) {
  try {
    // 既存トリガーをチェック
    if (checkIfTriggerExists(functionName)) {
      Logger.log('⚠️ トリガーは既に存在: ' + functionName);
      return;
    }

    // トリガー作成
    triggerBuilder.create();
    Logger.log('✅ トリガー作成成功: ' + functionName);
  } catch (e) {
    Logger.log('❌ トリガー作成失敗: ' + functionName);
    Logger.log('エラー: ' + e.message);
  }
}

/**
 * トリガーが存在するかチェック
 *
 * @param {string} functionName - 関数名
 * @returns {boolean} 存在する場合 true
 */
function checkIfTriggerExists(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  return triggers.some(trigger =>
    trigger.getHandlerFunction() === functionName
  );
}

// ==========================================
// トリガー削除
// ==========================================

/**
 * 全トリガーを削除
 *
 * カスタムメニューまたは GAS エディタから実行してください。
 */
function deleteAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    if (triggers.length === 0) {
      Logger.log('削除するトリガーはありません');
      return;
    }

    triggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      ScriptApp.deleteTrigger(trigger);
      Logger.log('削除: ' + functionName);
    });

    Logger.log('========================================');
    Logger.log('全トリガーを削除しました（' + triggers.length + '件）');
    Logger.log('========================================');

    // ユーザーに通知
    if (typeof SpreadsheetApp !== 'undefined') {
      SpreadsheetApp.getUi().alert('全トリガーを削除しました（' + triggers.length + '件）');
    }
  } catch (e) {
    Logger.log('エラー: ' + e.message);
    throw e;
  }
}

/**
 * 特定の関数のトリガーを削除
 *
 * @param {string} functionName - 関数名
 */
function deleteTriggerByFunction(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  let deleteCount = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
      deleteCount++;
      Logger.log('削除: ' + functionName);
    }
  });

  Logger.log('削除件数: ' + deleteCount);
}

// ==========================================
// トリガー情報表示
// ==========================================

/**
 * トリガー一覧を表示
 *
 * カスタムメニューまたは GAS エディタから実行してください。
 */
function listAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    if (triggers.length === 0) {
      Logger.log('トリガーはありません');

      if (typeof SpreadsheetApp !== 'undefined') {
        SpreadsheetApp.getUi().alert('トリガーはありません');
      }
      return;
    }

    Logger.log('========================================');
    Logger.log('トリガー一覧（' + triggers.length + '件）');
    Logger.log('========================================');

    const triggerInfo = triggers.map((trigger, index) => {
      const info = {
        番号: index + 1,
        関数名: trigger.getHandlerFunction(),
        イベントタイプ: getEventTypeLabel(trigger.getEventType()),
        トリガーソース: getTriggerSourceLabel(trigger.getTriggerSource()),
        ID: trigger.getUniqueId()
      };

      Logger.log('--- トリガー ' + (index + 1) + ' ---');
      Logger.log('関数名: ' + info.関数名);
      Logger.log('イベントタイプ: ' + info.イベントタイプ);
      Logger.log('トリガーソース: ' + info.トリガーソース);
      Logger.log('ID: ' + info.ID);

      return info;
    });

    Logger.log('========================================');

    // ユーザーに通知
    if (typeof SpreadsheetApp !== 'undefined') {
      const message = triggerInfo.map(info =>
        info.番号 + '. ' + info.関数名 + ' (' + info.イベントタイプ + ')'
      ).join('\n');

      SpreadsheetApp.getUi().alert('トリガー一覧（' + triggers.length + '件）\n\n' + message);
    }

    return triggerInfo;
  } catch (e) {
    Logger.log('エラー: ' + e.message);
    throw e;
  }
}

/**
 * イベントタイプのラベルを取得
 *
 * @param {ScriptApp.EventType} eventType - イベントタイプ
 * @returns {string} ラベル
 */
function getEventTypeLabel(eventType) {
  const labels = {
    [ScriptApp.EventType.CLOCK]: '時間ベース',
    [ScriptApp.EventType.ON_OPEN]: 'オープン時',
    [ScriptApp.EventType.ON_EDIT]: '編集時',
    [ScriptApp.EventType.ON_CHANGE]: '変更時',
    [ScriptApp.EventType.ON_FORM_SUBMIT]: 'フォーム送信時'
  };
  return labels[eventType] || eventType.toString();
}

/**
 * トリガーソースのラベルを取得
 *
 * @param {ScriptApp.TriggerSource} triggerSource - トリガーソース
 * @returns {string} ラベル
 */
function getTriggerSourceLabel(triggerSource) {
  const labels = {
    [ScriptApp.TriggerSource.CLOCK]: '時計',
    [ScriptApp.TriggerSource.SPREADSHEETS]: 'スプレッドシート',
    [ScriptApp.TriggerSource.DOCUMENTS]: 'ドキュメント',
    [ScriptApp.TriggerSource.FORMS]: 'フォーム'
  };
  return labels[triggerSource] || triggerSource.toString();
}

// ==========================================
// テスト関数
// ==========================================

/**
 * テスト環境チェック
 *
 * テスト環境で1時間ごとに実行される関数。
 */
function testEnvironmentCheck() {
  const env = getERPEnvironment();
  const spreadsheetId = getERPSpreadsheetId();

  Logger.log('========================================');
  Logger.log('テスト環境チェック');
  Logger.log('実行日時: ' + new Date());
  Logger.log('環境: ' + env);
  Logger.log('スプレッドシートID: ' + spreadsheetId);
  Logger.log('========================================');
}

/**
 * 日次レポート生成
 *
 * @trigger time-driven
 * @frequency daily
 * @hour 9
 */
function generateDailyReport() {
  Logger.log('========================================');
  Logger.log('日次レポート生成');
  Logger.log('実行日時: ' + new Date());
  Logger.log('========================================');

  // TODO: 実装
  Logger.log('日次レポート生成機能は未実装');
}

/**
 * 週次レポート生成
 *
 * @trigger time-driven
 * @frequency weekly
 * @day Monday
 * @hour 10
 */
function generateWeeklyReport() {
  Logger.log('========================================');
  Logger.log('週次レポート生成');
  Logger.log('実行日時: ' + new Date());
  Logger.log('========================================');

  // TODO: 実装
  Logger.log('週次レポート生成機能は未実装');
}

/**
 * バックアップ
 *
 * @trigger time-driven
 * @frequency daily
 * @hour 3
 */
function backupData() {
  Logger.log('========================================');
  Logger.log('データバックアップ');
  Logger.log('実行日時: ' + new Date());
  Logger.log('========================================');

  // TODO: 実装
  Logger.log('バックアップ機能は未実装');
}
