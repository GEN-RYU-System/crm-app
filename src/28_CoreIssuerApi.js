/**
 * 発行元マスタ API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   getCoreIssuerForFrontend(sessionId)
 *   updateCoreIssuerForFrontend(sessionId, issuerData)
 * 権限キー:
 *   dashboard_view — getCoreIssuerForFrontend（最低限の権限チェック）
 *   issuer_manage  — updateCoreIssuerForFrontend
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

  var lastCol     = sheet.getLastColumn();
  var lastRow     = sheet.getLastRow();

  var headerNames = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  function indexOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = headerNames.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + headerKey);
    return idx;
  }

  var isActiveIdx = indexOf('IS_ACTIVE');

  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) {
    throw new Error('発行元マスタにデータがありません');
  }

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

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

/**
 * 発行元マスタの最初の有効行を更新する
 *
 * @param {string} sessionId
 * @param {Object} issuerData  — { [japaneseName]: value } の形式
 * @returns {{ success: true }}
 */
function updateCoreIssuerForFrontend(sessionId, issuerData) {
  setEmailFromSession(sessionId);
  checkPermission('issuer_manage');

  var ss       = getSpreadsheet();
  var tableKey = 'ISSUER';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = ss.getSheetByName(table.sheetName);

  if (!sheet) {
    throw new Error('発行元マスタシートが見つかりません: ' + table.sheetName);
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastRow <= table.headerRowNumber) {
    throw new Error('発行元マスタにデータがありません');
  }

  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0];

  function colOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = rawHeaders.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + headerKey);
    return idx + 1; // 1-indexed
  }

  var dataRow = table.headerRowNumber + 1;

  var updatableKeys = [
    'COMPANY_NAME', 'CONTACT_NAME',
    'ADDRESS_LINE1', 'ADDRESS_LINE2', 'ADDRESS_LINE3',
    'CITY', 'STATE', 'ZIP', 'COUNTRY',
    'PHONE', 'EMAIL', 'REGISTRATION_NO',
    'PAYEE_NAME', 'PAYMENT_EMAIL', 'PAYMENT_NOTE', 'CLOSING_MESSAGE',
    'IS_ACTIVE'
  ];

  updatableKeys.forEach(function(key) {
    var jaName = getCoreSchemaV1HeaderName(tableKey, key);
    if (issuerData.hasOwnProperty(jaName)) {
      sheet.getRange(dataRow, colOf(key)).setValue(issuerData[jaName]);
    }
  });

  SpreadsheetApp.flush();
  return { success: true };
}
