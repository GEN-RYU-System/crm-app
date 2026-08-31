/**
 * 99_DevShippingMasterSetup.js
 *
 * 目的: 発送書類マスタ（品目・HTSコード・素材）をDEVスプレッドシートに新設する。
 *       読み取り専用の DRY_RUN と、実際にシートを作成する APPLY の2モードを持つ。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き
 *   - データ行の書き込み（ヘッダー行のみ作成する）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run setupShippingMasterSheets --params '["DRY_RUN"]'
 *   clasp run setupShippingMasterSheets --params '["APPLY"]'
 */

var SHIPPING_MASTER_TABLE_KEYS = ['ITEMS', 'HTS_CODES', 'MATERIALS'];

/**
 * 発送書類マスタ3シートを DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupShippingMasterSheets(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupShippingMasterSheets は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var existingSheetNames = ss.getSheets().map(function(s) { return s.getName(); });

  var plan = SHIPPING_MASTER_TABLE_KEYS.map(function(tableKey) {
    var table = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;
    var headers = Object.values(table.headers);
    var alreadyExists = existingSheetNames.indexOf(sheetName) !== -1;
    return {
      tableKey: tableKey,
      sheetName: sheetName,
      headers: headers,
      alreadyExists: alreadyExists
    };
  });

  var conflicts = plan.filter(function(p) { return p.alreadyExists; });
  var toCreate = plan.filter(function(p) { return !p.alreadyExists; });

  Logger.log('=== setupShippingMasterSheets (' + mode + ') ===');
  Logger.log('');
  Logger.log('【作成予定シート: ' + toCreate.length + '件】');
  toCreate.forEach(function(p) {
    Logger.log('  ' + p.sheetName + ' (' + p.headers.length + '列)');
    Logger.log('    列: ' + p.headers.join(' / '));
  });

  Logger.log('');
  Logger.log('【既存シートとの衝突: ' + conflicts.length + '件】');
  if (conflicts.length > 0) {
    conflicts.forEach(function(p) {
      Logger.log('  ⚠️  ' + p.sheetName + ' — 既に存在します。スキップします。');
    });
  } else {
    Logger.log('  なし');
  }

  if (mode === 'DRY_RUN') {
    var dryRunResult = {
      mode: 'DRY_RUN',
      toCreateCount: toCreate.length,
      conflictCount: conflicts.length,
      toCreate: toCreate.map(function(p) { return { sheetName: p.sheetName, headers: p.headers }; }),
      conflicts: conflicts.map(function(p) { return p.sheetName; })
    };
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際のシート作成は行っていません。');
    return dryRunResult;
  }

  // APPLY
  var created = [];
  var skipped = [];

  toCreate.forEach(function(p) {
    var newSheet = ss.insertSheet(p.sheetName);
    newSheet.getRange(1, 1, 1, p.headers.length).setValues([p.headers]);
    Logger.log('  ✅ ' + p.sheetName + ' を作成しました。');
    created.push(p.sheetName);
  });

  conflicts.forEach(function(p) {
    Logger.log('  ⏭️  ' + p.sheetName + ' は既に存在するためスキップしました。');
    skipped.push(p.sheetName);
  });

  Logger.log('');
  Logger.log('APPLY 完了。作成: ' + created.length + '件 / スキップ: ' + skipped.length + '件');

  return {
    mode: 'APPLY',
    createdCount: created.length,
    skippedCount: skipped.length,
    created: created,
    skipped: skipped
  };
}
