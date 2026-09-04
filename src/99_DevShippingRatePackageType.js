/**
 * 99_DevShippingRatePackageType.js
 *
 * 目的: 送料表マスタ（SHIPPING_RATES）に「荷姿区分」列（PACKAGE_TYPE）を末尾に追加し、
 *       既存全行に 'BOX' を設定する。
 *
 * 設計意図:
 *   - eLogi FedEx IP はエンベロープ・パック・箱で料金が違うため、
 *     配送会社を分けるのではなく区分列で表す。
 *   - 配送会社を分けると地帯マスタのゾーンが重複し、
 *     比較画面にも多数の選択肢が並ぶため。
 *   - 既存 3社（FedEx / DHL / UPS）はすべて箱前提の料金。
 *     全行 'BOX' 設定で動作は変わらない。
 *   - PostgreSQL 移行時の想定:
 *     UNIQUE (carrier_id, zone, package_type, min_weight, max_weight)
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 既存列（料金等）の変更
 *
 * 使い方:
 *   clasp run addPackageTypeColumn --params '["DRY_RUN"]'
 *   clasp run addPackageTypeColumn --params '["APPLY"]'
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addPackageTypeColumn(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('addPackageTypeColumn は development 環境でのみ実行できます。');
  }

  var tableKey    = 'SHIPPING_RATES';
  var columnKey   = 'PACKAGE_TYPE';
  var backfillVal = CORE_SCHEMA_V1_TABLES[tableKey].values.PACKAGE_TYPE.BOX; // 'BOX'
  var table       = getCoreSchemaV1Table(tableKey);
  var ss          = getSpreadsheet();
  var sheet       = getCoreSchemaV1Sheet(ss, tableKey);
  var displayName = table.headers[columnKey];

  if (!displayName) {
    throw new Error('Registry に ' + columnKey + ' が定義されていません。');
  }

  // 現在のシートヘッダーを取得
  var lastCol    = sheet.getLastColumn();
  var curHeaders = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  var alreadyExists = curHeaders.indexOf(displayName) !== -1;

  // 既存データ行数
  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);

  Logger.log('=== addPackageTypeColumn (' + mode + ') ===');
  Logger.log('テーブル: ' + tableKey + ' (' + table.sheetName + ')');
  Logger.log('追加列: ' + displayName + ' (key=' + columnKey + ')');
  Logger.log('追加位置: 末尾（現在 ' + curHeaders.length + ' 列目の次）');
  Logger.log('列追加予定: ' + (alreadyExists ? '0件（既に存在するためスキップ）' : '1件'));
  Logger.log('データ行数: ' + dataRowCount);
  Logger.log('バックフィル値: ' + backfillVal + ' × ' + dataRowCount + ' 行');

  if (mode === 'DRY_RUN') {
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:               'DRY_RUN',
      tableKey:           tableKey,
      columnKey:          columnKey,
      displayName:        displayName,
      currentColumnCount: curHeaders.length,
      addColumnCount:     alreadyExists ? 0 : 1,
      skipped:            alreadyExists,
      dataRowCount:       dataRowCount,
      backfillValue:      backfillVal,
      backfillRowCount:   alreadyExists ? 0 : dataRowCount
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('⏭️  ' + displayName + ' 列はすでに存在するためスキップしました。');
    return {
      mode:      'APPLY',
      added:     0,
      skipped:   true,
      tableKey:  tableKey,
      columnKey: columnKey
    };
  }

  // 列ヘッダーを末尾に追加
  var newColIndex = lastCol + 1;
  sheet.getRange(table.headerRowNumber, newColIndex).setValue(displayName);
  Logger.log('✅ ' + displayName + ' 列を追加しました（列番号: ' + newColIndex + '）。');

  // 既存全行に 'BOX' を setValues で一括書き込み（1行ずつは実行時間上限に達する可能性がある）
  var backfilledCount = 0;
  if (dataRowCount > 0) {
    var startRow = table.headerRowNumber + 1;
    var values   = [];
    for (var i = 0; i < dataRowCount; i++) {
      values.push([backfillVal]);
    }
    sheet.getRange(startRow, newColIndex, dataRowCount, 1).setValues(values);
    backfilledCount = dataRowCount;
    Logger.log('✅ ' + backfilledCount + ' 行に ' + backfillVal + ' を設定しました。');
  }

  return {
    mode:           'APPLY',
    added:          1,
    skipped:        false,
    tableKey:       tableKey,
    columnKey:      columnKey,
    displayName:    displayName,
    newColumnIndex: newColIndex,
    dataRowCount:   dataRowCount,
    backfilledCount: backfilledCount,
    backfillValue:  backfillVal
  };
}
