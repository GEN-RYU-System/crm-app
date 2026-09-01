/**
 * 99_DevShippingRateMasterSetup.js
 *
 * 目的: 送料計算用マスタ（配送会社・地帯・送料表）を
 *       DEVスプレッドシートに新設する。
 *       読み取り専用の DRY_RUN と、実際にシートを作成する APPLY の2モードを持つ。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き（addCarrierColumns の列追加を除く）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run setupShippingRateMasterSheets --params '["DRY_RUN"]'
 *   clasp run setupShippingRateMasterSheets --params '["APPLY"]'
 *   clasp run addCarrierColumns --params '["DRY_RUN"]'
 *   clasp run addCarrierColumns --params '["APPLY"]'
 */

/**
 * 配送会社マスタに追加する4列のヘッダーキー（Registry に定義済み）。
 * 既存7列の末尾に追加する。
 */
var CARRIER_NEW_COLUMN_KEYS = ['DIM_ROUNDING', 'WEIGHT_STEP_SMALL', 'WEIGHT_STEP_LARGE', 'MAX_WEIGHT'];

/**
 * 追加列に書き込む値（3社とも同じ値）。
 * 出典: 各社公式料金表および PR-T3a で実測した重量帯。
 */
var CARRIER_COLUMN_DEFAULTS = {
  DIM_ROUNDING:      'CEIL',
  WEIGHT_STEP_SMALL: 0.5,
  WEIGHT_STEP_LARGE: 1.0,
  MAX_WEIGHT:        68
};

var SHIPPING_RATE_MASTER_TABLE_KEYS = ['CARRIERS', 'ZONES', 'SHIPPING_RATES'];

/**
 * 配送会社・地帯・送料表の3シートを DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupShippingRateMasterSheets(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupShippingRateMasterSheets は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var existingSheetNames = ss.getSheets().map(function(s) { return s.getName(); });

  var plan = SHIPPING_RATE_MASTER_TABLE_KEYS.map(function(tableKey) {
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

  Logger.log('=== setupShippingRateMasterSheets (' + mode + ') ===');
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

/**
 * 配送会社マスタシートに4列（寸法端数処理/重量刻み小/重量刻み大/最大対応重量）を
 * 追加し、既存3行に値を書き込む。
 * ★ DEV 環境専用。PROD では実行不可。
 * ★ 二重実行防止: 4列がすでに存在する場合はスキップ。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addCarrierColumns(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('addCarrierColumns は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var tableKey = 'CARRIERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

  // 現在のシートヘッダーを取得
  var lastCol    = sheet.getLastColumn();
  var curHeaders = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  // 追加すべき列を特定（Registry 定義の表示名で照合）
  var toAdd = CARRIER_NEW_COLUMN_KEYS.filter(function(key) {
    return curHeaders.indexOf(table.headers[key]) === -1;
  });

  // 既存データ行
  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);

  Logger.log('=== addCarrierColumns (' + mode + ') ===');
  Logger.log('現在の列数: ' + curHeaders.length);
  Logger.log('追加予定列: ' + toAdd.length + '件');
  toAdd.forEach(function(key) {
    Logger.log('  + ' + table.headers[key] + ' = ' + JSON.stringify(CARRIER_COLUMN_DEFAULTS[key]));
  });
  Logger.log('対象データ行数: ' + dataRowCount);

  if (mode === 'DRY_RUN') {
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:               'DRY_RUN',
      currentColumnCount: curHeaders.length,
      toAdd:              toAdd.map(function(key) {
        return { headerKey: key, displayName: table.headers[key], value: CARRIER_COLUMN_DEFAULTS[key] };
      }),
      dataRowCount:       dataRowCount
    };
  }

  // APPLY
  if (toAdd.length === 0) {
    Logger.log('追加すべき列がありません。すでに完了済みです。');
    return { mode: 'APPLY', added: 0, updated: 0 };
  }

  // 部分追加チェック: 一部だけ存在する場合は異常
  var alreadyPresent = CARRIER_NEW_COLUMN_KEYS.filter(function(key) {
    return curHeaders.indexOf(table.headers[key]) !== -1;
  });
  if (alreadyPresent.length > 0 && alreadyPresent.length < CARRIER_NEW_COLUMN_KEYS.length) {
    throw new Error(
      'PARTIAL_COLUMNS_DETECTED: ' + alreadyPresent.length + '/' + CARRIER_NEW_COLUMN_KEYS.length +
      ' 列が既に存在します。シートを手動確認してください。'
    );
  }

  // ヘッダー行に新列を一括追加
  var startCol = curHeaders.length + 1;
  toAdd.forEach(function(key, i) {
    sheet.getRange(table.headerRowNumber, startCol + i).setValue(table.headers[key]);
  });
  Logger.log(toAdd.length + '列のヘッダーを追加しました（列 ' + startCol + '〜' + (startCol + toAdd.length - 1) + '）。');

  // データ行に値を一括書き込み
  if (dataRowCount === 0) {
    Logger.log('データ行がありません。値の書き込みをスキップします。');
    return { mode: 'APPLY', added: toAdd.length, updated: 0 };
  }

  var values = [];
  for (var r = 0; r < dataRowCount; r++) {
    values.push(toAdd.map(function(key) { return CARRIER_COLUMN_DEFAULTS[key]; }));
  }
  sheet.getRange(table.headerRowNumber + 1, startCol, dataRowCount, toAdd.length).setValues(values);
  Logger.log(dataRowCount + '行に値を書き込みました。');

  return { mode: 'APPLY', added: toAdd.length, updated: dataRowCount };
}
