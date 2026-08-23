/**
 * 発行元マスタ API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   getCoreIssuerForFrontend(sessionId)
 * 権限キー:
 *   dashboard_view — 最低限の権限チェック
 */

/**
 * 発行元マスタから有効な発行元を1件返す
 *
 * @param {string} sessionId
 * @returns {{ success: true, issuer: Object }}
 */
function getCoreIssuerForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('dashboard_view'); // 最低限の権限チェック

  var ss        = getSpreadsheet();
  var tableKey  = 'ISSUER';
  var table     = getCoreSchemaV1Table(tableKey);
  var sheetName = table.sheetName;
  var sheet     = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('発行元マスタシートが見つかりません: ' + sheetName);
  }

  var headerNames = Object.values(table.headers);
  var lastRow     = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('発行元マスタにデータがありません');
  }

  var data = sheet.getRange(2, 1, lastRow - 1, headerNames.length).getValues();

  var isActiveColName = getCoreSchemaV1HeaderName(tableKey, 'IS_ACTIVE');
  var isActiveIdx     = headerNames.indexOf(isActiveColName);

  var activeIssuers = data.filter(function(row) {
    var val = row[isActiveIdx];
    return val === true || val === 'TRUE' || val === '有効';
  });

  if (activeIssuers.length === 0) {
    throw new Error('有効な発行元が存在しません');
  }

  var row    = activeIssuers[0];
  var result = {};
  headerNames.forEach(function(name, i) {
    result[name] = row[i];
  });

  return { success: true, issuer: result };
}
