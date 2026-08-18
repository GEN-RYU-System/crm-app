/**
 * 通貨マスタ の React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

/**
 * 有効な通貨の一覧を返す。
 * @param {string} sessionId
 * @returns {{ currencyCode: string, symbol: string, name: string, rateToJpy: number|null }[]}
 */
function getCoreCurrenciesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss       = getSpreadsheet();
  var tableKey = 'CURRENCIES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();
  var lastRow  = sheet.getLastRow();

  var headerNames = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  function indexOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = headerNames.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + headerKey);
    return idx;
  }

  var idxCode     = indexOf('CURRENCY_CODE');
  var idxSymbol   = indexOf('SYMBOL');
  var idxName     = indexOf('NAME');
  var idxRate     = indexOf('RATE_TO_JPY');
  var idxIsActive = indexOf('IS_ACTIVE');

  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) return [];

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  return data
    .filter(function(row) {
      var code     = String(row[idxCode] || '').trim();
      var isActive = row[idxIsActive];
      return code !== '' && isActive === true;
    })
    .map(function(row) {
      var rate    = row[idxRate];
      var rateNum = (typeof rate === 'number' && Number.isFinite(rate)) ? rate : null;
      return {
        currencyCode: String(row[idxCode]).trim(),
        symbol:       String(row[idxSymbol]   || '').trim(),
        name:         String(row[idxName]     || '').trim(),
        rateToJpy:    rateNum
      };
    });
}

/**
 * 指定通貨の現在レートを数値で返す。
 * オーダー作成時に固定値としてコピーする用途。
 * 通貨マスタに存在しない、または無効な場合は例外をスローする。
 * @param {string} currencyCode
 * @returns {number}
 */
function getCurrentExchangeRate(currencyCode) {
  var ss       = getSpreadsheet();
  var tableKey = 'CURRENCIES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();
  var lastRow  = sheet.getLastRow();

  var headerNames = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  function indexOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = headerNames.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + headerKey);
    return idx;
  }

  var idxCode     = indexOf('CURRENCY_CODE');
  var idxRate     = indexOf('RATE_TO_JPY');
  var idxIsActive = indexOf('IS_ACTIVE');

  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) throw new Error('CURRENCY_NOT_FOUND:' + currencyCode);

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  var code  = String(currencyCode || '').trim().toUpperCase();
  var found = null;
  for (var i = 0; i < data.length; i++) {
    var rowCode = String(data[i][idxCode] || '').trim().toUpperCase();
    if (rowCode === code) { found = data[i]; break; }
  }

  if (!found) throw new Error('CURRENCY_NOT_FOUND:' + currencyCode);

  if (found[idxIsActive] !== true) throw new Error('CURRENCY_INACTIVE:' + currencyCode);

  var rate = found[idxRate];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new Error('CURRENCY_RATE_INVALID:' + currencyCode);
  }

  return rate;
}
