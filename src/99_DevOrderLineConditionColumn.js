/**
 * 99_DevOrderLineConditionColumn.js
 *
 * 目的: オーダー明細（ORDER_LINES）に CONDITION 列を追加する DEV 専用セットアップ。
 *       読み取り専用の DRY_RUN と、実際に列を追加する APPLY の2モードを持つ。
 *
 * 【設計意図】
 *   - 見積もりなしで直接受注する経路があるため、
 *     請求書明細（ORDER_LINES）にも CONDITION が必要。
 *   - CONDITION はコンディションマスタ（CONDITIONS）を参照し、
 *     そこから対応単位（ケース/ボックス/パック）を引く。
 *   - 列名は 'コンディション'。ORDER_LINES の既存 STATUS 列が '状態' を使用しており、
 *     重複を避けるため 'コンディション' を採用した。
 *     見積もり明細（QUOTE_LINES）の CONDITION は引き続き '状態' のまま。
 *   - SQL 移行時は CONDITIONS への外部キーになる。
 *
 * 禁止事項:
 *   - 既存データ行への値の書き込み（新列は空のまま）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run addOrderLineConditionColumn --params '["DRY_RUN"]'
 *   clasp run addOrderLineConditionColumn --params '["APPLY"]'
 */

var ORDER_LINE_CONDITION_TABLE_KEY = 'ORDER_LINES';
var ORDER_LINE_CONDITION_HEADER_KEY = 'CONDITION';

/**
 * オーダー明細に CONDITION 列を DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addOrderLineConditionColumn(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('addOrderLineConditionColumn は development 環境でのみ実行できます。');
  }

  var ss    = getSpreadsheet();
  var table = getCoreSchemaV1Table(ORDER_LINE_CONDITION_TABLE_KEY);
  var sheet = getCoreSchemaV1Sheet(ss, ORDER_LINE_CONDITION_TABLE_KEY);

  // 追加する列の表示名を Registry から取得
  var newHeaderName = table.headers[ORDER_LINE_CONDITION_HEADER_KEY];

  // 現在のシートヘッダーを取得
  var lastCol    = sheet.getLastColumn();
  var curHeaders = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  var alreadyExists = curHeaders.indexOf(newHeaderName) !== -1;
  var dataRowCount  = Math.max(0, sheet.getLastRow() - table.headerRowNumber);

  Logger.log('=== addOrderLineConditionColumn (' + mode + ') ===');
  Logger.log('対象シート  : ' + table.sheetName);
  Logger.log('追加列      : ' + newHeaderName + ' (headerKey=' + ORDER_LINE_CONDITION_HEADER_KEY + ')');
  Logger.log('現在の列数  : ' + curHeaders.length);
  Logger.log('列の存在    : ' + (alreadyExists ? '既存（スキップ対象）' : 'なし（追加予定）'));
  Logger.log('既存データ行: ' + dataRowCount + '件（新列は空のまま）');

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:            'DRY_RUN',
      toAddCount:      alreadyExists ? 0 : 1,
      skipCount:       alreadyExists ? 1 : 0,
      newHeaderName:   newHeaderName,
      currentColumns:  curHeaders.length,
      dataRowCount:    dataRowCount
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('  ⏭️  ' + newHeaderName + ' 列は既に存在します。スキップしました。');
    return {
      mode:      'APPLY',
      addedCount: 0,
      skipCount:  1,
      skipped:   [newHeaderName]
    };
  }

  // ヘッダー行に新列を追加（末尾）
  var targetCol = curHeaders.length + 1;
  sheet.getRange(table.headerRowNumber, targetCol).setValue(newHeaderName);
  Logger.log('  ✅ ' + newHeaderName + ' 列を追加しました（列 ' + targetCol + '）。');
  Logger.log('  既存データ行 ' + dataRowCount + '件 は空のまま（書き込みなし）。');

  return {
    mode:       'APPLY',
    addedCount: 1,
    skipCount:  0,
    added:      [newHeaderName],
    addedColumn: targetCol
  };
}
