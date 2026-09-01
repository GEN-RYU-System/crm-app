
// V2: 新シート参照に切り替えたためキャッシュキーをバージョンアップ（旧V1キャッシュを無効化）
var LEAD_FORM_OPTIONS_CACHE_INDEX  = 'LEAD_FORM_OPTIONS_V2_CACHE_INDEX';
var LEAD_FORM_OPTIONS_CACHE_PREFIX = 'LEAD_FORM_OPTIONS_V2_CACHE_';
var LEAD_FORM_OPTIONS_CACHE_TTL    = 600;
var LEAD_FORM_OPTIONS_CACHE_CHUNK  = 90000;

/**
 * リード登録フォームで使う選択肢を一括返却する。
 *
 * - 選択肢マスタV2（選択肢マスタV2 シート）から「リード種別」「返信速度」を読む
 * - 国マスタ（国名（表示）列）から有効行のみ表示順で返す
 * - getDropdownOptions / getCountriesForForm には一切手を付けない（旧SPA互換）
 *
 * @param {string} sessionId
 * @returns {{
 *   leadTypes: string[],
 *   responseSpeeds: string[],
 *   countries: { name: string, dialCode: string, stateRequired: boolean, postalRequired: boolean }[],
 *   leadSources: { sourceId: string, name: string, isInbound: boolean, isOutbound: boolean }[]
 * }}
 */
function getLeadFormOptions(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var cached = readCacheChunks_(
    LEAD_FORM_OPTIONS_CACHE_INDEX,
    LEAD_FORM_OPTIONS_CACHE_PREFIX
  );
  if (cached !== null) return cached;

  var ss = getSpreadsheet();

  // ── 選択肢マスタV2（リード種別 / 返信速度）──────────────────────────────
  var allOpts        = getAllOptionsGroupedFromV2_();
  var leadTypes      = allOpts['lead_type']      || [];
  var responseSpeeds = allOpts['response_speed'] || [];

  // ── 国マスタ（有効行のみ・シート表示順）────────────────────────────────
  var countries = [];
  var countrySheet = ss.getSheetByName('国マスタ');
  if (countrySheet && countrySheet.getLastRow() > 1) {
    var cData     = countrySheet.getDataRange().getValues();
    var cH        = cData[0].map(String);
    var nameIdx   = cH.indexOf('display_name');
    var codeIdx   = cH.indexOf('国番号');
    var stateIdx  = cH.indexOf('州必須');
    var postalIdx = cH.indexOf('郵便番号必須');
    var validIdx  = cH.indexOf('有効');
    if (nameIdx < 0) throw new Error('国マスタヘッダー不足: display_name');
    for (var i = 1; i < cData.length; i++) {
      var name  = String(cData[i][nameIdx] != null ? cData[i][nameIdx] : '').trim();
      var valid = validIdx < 0 || String(cData[i][validIdx] || '').toUpperCase() !== 'FALSE';
      if (!name || !valid) continue;
      countries.push({
        name:          name,
        dialCode:      codeIdx  >= 0 ? String(cData[i][codeIdx]  || '').trim() : '',
        stateRequired:  stateIdx  >= 0 && String(cData[i][stateIdx]  || '').toUpperCase() === 'TRUE',
        postalRequired: postalIdx >= 0 && String(cData[i][postalIdx] || '').toUpperCase() === 'TRUE'
      });
    }
  }

  // ── 流入元マスタ（有効行のみ・表示順）──────────────────────────────────
  var leadSources = [];
  var lsTable  = getCoreSchemaV1Table('LEAD_SOURCES');
  var lsSheet  = getCoreSchemaV1Sheet(ss, 'LEAD_SOURCES');
  if (lsSheet && lsSheet.getLastRow() > lsTable.headerRowNumber) {
    var lsData     = lsSheet.getDataRange().getValues();
    var lsH        = lsData[lsTable.headerRowNumber - 1].map(String);
    var lsIdIdx    = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'SOURCE_ID'));
    var lsNameIdx  = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'NAME'));
    var lsInIdx    = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'IS_INBOUND'));
    var lsOutIdx   = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'IS_OUTBOUND'));
    var lsActIdx   = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'IS_ACTIVE'));
    var lsOrdIdx   = lsH.indexOf(getCoreSchemaV1HeaderName('LEAD_SOURCES', 'DISPLAY_ORDER'));
    for (var s = lsTable.headerRowNumber; s < lsData.length; s++) {
      var row      = lsData[s];
      var isActive = lsActIdx < 0 || row[lsActIdx] === true || String(row[lsActIdx] || '').toUpperCase() === 'TRUE';
      if (!isActive) continue;
      var srcId   = String(row[lsIdIdx]   != null ? row[lsIdIdx]   : '').trim();
      var srcName = String(row[lsNameIdx]  != null ? row[lsNameIdx] : '').trim();
      if (!srcId || !srcName) continue;
      leadSources.push({
        sourceId:   srcId,
        name:       srcName,
        isInbound:  lsInIdx  >= 0 && (row[lsInIdx]  === true || String(row[lsInIdx]  || '').toUpperCase() === 'TRUE'),
        isOutbound: lsOutIdx >= 0 && (row[lsOutIdx] === true || String(row[lsOutIdx] || '').toUpperCase() === 'TRUE'),
        _order:     lsOrdIdx >= 0 ? (Number(row[lsOrdIdx]) || 0) : 0
      });
    }
    leadSources.sort(function(a, b) { return a._order - b._order; });
    leadSources = leadSources.map(function(ls) {
      return { sourceId: ls.sourceId, name: ls.name, isInbound: ls.isInbound, isOutbound: ls.isOutbound };
    });
  }

  var result = { leadTypes: leadTypes, responseSpeeds: responseSpeeds, countries: countries, leadSources: leadSources };

  writeCacheChunks_(
    LEAD_FORM_OPTIONS_CACHE_INDEX,
    LEAD_FORM_OPTIONS_CACHE_PREFIX,
    result,
    LEAD_FORM_OPTIONS_CACHE_TTL,
    LEAD_FORM_OPTIONS_CACHE_CHUNK
  );

  return result;
}
