/**
 * 99_DevPackageMasterSetup.js
 *
 * 目的: 荷姿関連マスタ（サイズ・重量・荷姿・商品荷姿）を
 *       DEVスプレッドシートに新設する。
 *       読み取り専用の DRY_RUN と、実際にシートを作成する APPLY の2モードを持つ。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き（deleteCorruptedSizesWeights を除く）
 *   - データ行の書き込み（ヘッダー行のみ作成する）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run setupPackageMasterSheets --params '["DRY_RUN"]'
 *   clasp run setupPackageMasterSheets --params '["APPLY"]'
 *   clasp run deleteCorruptedSizesWeights
 */

var PACKAGE_MASTER_TABLE_KEYS = ['SIZES', 'WEIGHTS', 'PACKAGES', 'PRODUCT_PACKAGES'];

/**
 * サイズマスタ・重量マスタを削除する（ヘッダー破損からの復旧用）。
 *
 * 対象シートのみを削除する。他のシートは変更しない。
 * 荷姿マスタ・商品荷姿マスタは対象外。
 * development 環境でのみ実行可能。
 *
 * 使い方:
 *   clasp run deleteCorruptedSizesWeights
 *
 * @returns {Object} 削除結果
 */
function deleteCorruptedSizesWeights() {
  if (getEnvironment() !== 'development') {
    throw new Error('deleteCorruptedSizesWeights は development 環境でのみ実行できます。');
  }

  var TARGET_SHEET_NAMES = [
    getCoreSchemaV1TableName('SIZES'),
    getCoreSchemaV1TableName('WEIGHTS')
  ];

  var ss = getSpreadsheet();
  var deleted = [];
  var notFound = [];

  TARGET_SHEET_NAMES.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.deleteSheet(sheet);
      Logger.log('  🗑️  ' + name + ' を削除しました。');
      deleted.push(name);
    } else {
      Logger.log('  ⚠️  ' + name + ' は存在しません。スキップしました。');
      notFound.push(name);
    }
  });

  Logger.log('削除完了: ' + deleted.length + '件 / 不在: ' + notFound.length + '件');

  return {
    deleted: deleted,
    notFound: notFound,
    deletedCount: deleted.length,
    notFoundCount: notFound.length
  };
}

/**
 * 荷姿関連4シートを DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupPackageMasterSheets(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupPackageMasterSheets は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var existingSheetNames = ss.getSheets().map(function(s) { return s.getName(); });

  var plan = PACKAGE_MASTER_TABLE_KEYS.map(function(tableKey) {
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

  Logger.log('=== setupPackageMasterSheets (' + mode + ') ===');
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
