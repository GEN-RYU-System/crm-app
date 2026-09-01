/**
 * 99_DevSharedInventoryConditionReader.js
 *
 * 目的: 共用在庫（SHARED_INVENTORY）の CONDITION 列に存在する値を
 *       重複なしで一覧表示する（DEV 専用 / 読み取り専用）
 *
 * 禁止事項:
 *   - シートへの書き込み（setValue / setValues / appendRow 等）
 *   - PROD 環境での実行
 *   - CONDITION 以外の列（商品名・単価・提供者等）の出力
 *
 * 使い方:
 *   clasp run readSharedInventoryConditions
 */

/**
 * 共用在庫シートの CONDITION 列に存在する値と件数を返す。
 * CONDITION 以外の列は一切読み取らず、返却値にも含めない。
 *
 * @returns {{
 *   sheetName: string,
 *   totalDataRows: number,
 *   conditionCounts: Array<{ value: string, count: number }>,
 *   emptyCount: number
 * }}
 */
function readSharedInventoryConditions() {
  if (getEnvironment() !== 'development') {
    throw new Error('readSharedInventoryConditions は development 環境でのみ実行できます。');
  }

  var ss        = getSpreadsheet();
  var tableDef  = getCoreSchemaV1Table('SHARED_INVENTORY');
  var sheetName = tableDef.sheetName; // '共用在庫'
  var sheet     = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    var empty = {
      sheetName: sheetName,
      totalDataRows: 0,
      conditionCounts: [],
      emptyCount: 0
    };
    Logger.log(JSON.stringify(empty, null, 2));
    return empty;
  }

  // ヘッダー行から CONDITION 列の位置を特定（列番号の直書き禁止）
  var headerRow   = sheet.getRange(tableDef.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0];
  var condColName = getCoreSchemaV1HeaderName('SHARED_INVENTORY', 'CONDITION');
  var condIdx     = headerRow.indexOf(condColName);

  if (condIdx === -1) {
    throw new Error(
      'CONDITION 列（ヘッダー名: "' + condColName + '"）が見つかりません。' +
      ' 実シートのヘッダー: ' + JSON.stringify(headerRow)
    );
  }

  // データ行を全件取得（CONDITION 列のみ）
  var dataRows   = lastRow - tableDef.headerRowNumber;
  var condRange  = sheet.getRange(tableDef.headerRowNumber + 1, condIdx + 1, dataRows, 1);
  var condValues = condRange.getDisplayValues(); // [[val], [val], ...]

  // 重複を除いた件数集計
  var counts     = {};
  var emptyCount = 0;

  condValues.forEach(function(row) {
    var val = String(row[0] || '').trim();
    if (val === '') {
      emptyCount++;
    } else {
      counts[val] = (counts[val] || 0) + 1;
    }
  });

  // 件数降順でソート
  var conditionCounts = Object.keys(counts)
    .map(function(v) { return { value: v, count: counts[v] }; })
    .sort(function(a, b) { return b.count - a.count; });

  var result = {
    sheetName:       sheetName,
    totalDataRows:   dataRows,
    conditionCounts: conditionCounts,
    emptyCount:      emptyCount
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
