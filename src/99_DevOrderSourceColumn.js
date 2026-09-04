/**
 * 99_DevOrderSourceColumn.js
 *
 * 目的: オーダー管理シートに「注文種類」列（ORDER_SOURCE）を末尾に追加する。
 *       eLogi CSV の1列目「注文種類」は必須フィールドであり、
 *       本列の追加が eLogi CSV 連携の前提条件となる。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 既存データへの値の書き込み（空のまま追加のみ。バックフィルは別タスク）
 *   - 既存列の変更・削除
 *
 * 許容値（eLogi 仕様固定 — 独自追加不可）:
 *   ebay / amazon / rakuten / yahoo / その他
 *   SQL 移行後は ENUM または CHECK 制約になる想定。
 *
 * 使い方:
 *   clasp run addOrderSourceColumn --params '["DRY_RUN"]'
 *   clasp run addOrderSourceColumn --params '["APPLY"]'
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addOrderSourceColumn(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('addOrderSourceColumn は development 環境でのみ実行できます。');
  }

  var tableKey    = 'ORDERS';
  var columnKey   = 'ORDER_SOURCE';
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

  Logger.log('=== addOrderSourceColumn (' + mode + ') ===');
  Logger.log('テーブル: ' + tableKey + ' (' + table.sheetName + ')');
  Logger.log('追加列: ' + displayName + ' (key=' + columnKey + ')');
  Logger.log('現在の列数: ' + curHeaders.length);
  Logger.log('列追加予定: ' + (alreadyExists ? '0件（既に存在するためスキップ）' : '1件'));
  Logger.log('対象データ行数: ' + dataRowCount);

  if (mode === 'DRY_RUN') {
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:               'DRY_RUN',
      tableKey:           tableKey,
      columnKey:          columnKey,
      displayName:        displayName,
      currentColumnCount: curHeaders.length,
      toAdd:              alreadyExists ? 0 : 1,
      skipped:            alreadyExists,
      dataRowCount:       dataRowCount
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('⏭️  ' + displayName + ' 列はすでに存在するためスキップしました。');
    return {
      mode:     'APPLY',
      added:    0,
      skipped:  true,
      tableKey: tableKey,
      columnKey: columnKey
    };
  }

  // 末尾に列ヘッダーを追加（データ行には何も書かない）
  var newColIndex = lastCol + 1;
  sheet.getRange(table.headerRowNumber, newColIndex).setValue(displayName);

  Logger.log('✅ ' + displayName + ' 列を追加しました（列番号: ' + newColIndex + '）。');
  Logger.log('既存データ行への書き込みは行っていません。');

  return {
    mode:           'APPLY',
    added:          1,
    skipped:        false,
    tableKey:       tableKey,
    columnKey:      columnKey,
    displayName:    displayName,
    newColumnIndex: newColIndex,
    dataRowCount:   dataRowCount
  };
}
