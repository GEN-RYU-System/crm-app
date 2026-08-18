/**
 * 通貨マスタ の検証（読み取り専用・DEV専用）
 *
 * devAuditCurrencyMaster()
 *   - セッション認証なしでシートを直読みする
 *   - 書き込みなし
 *   - getCoreCurrenciesForFrontend() が返す内容と同等の情報を出力する
 */

function devAuditCurrencyMaster() {
  var tableKey = 'CURRENCIES';
  var table    = getCoreSchemaV1Table(tableKey);
  var ss       = getSpreadsheet();
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
  if (dataRowCount === 0) {
    Logger.log('データなし');
    return [];
  }

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  var results = data
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
        rateToJpy:    rateNum,
        rateRawType:  typeof rate
      };
    });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}
