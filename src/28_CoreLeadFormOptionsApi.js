/**
 * リード登録フォーム用 選択肢API
 *
 * getLeadFormOptions(sessionId) … リード種別 / 返信速度 / 国マスタを一括返却
 */

var LEAD_FORM_OPTIONS_CACHE_INDEX  = 'LEAD_FORM_OPTIONS_CACHE_INDEX';
var LEAD_FORM_OPTIONS_CACHE_PREFIX = 'LEAD_FORM_OPTIONS_CACHE_';
var LEAD_FORM_OPTIONS_CACHE_TTL    = 600;
var LEAD_FORM_OPTIONS_CACHE_CHUNK  = 90000;

/**
 * リード登録フォームで使う選択肢を一括返却する。
 *
 * - 選択肢マスタ（CONFIG.SHEETS.SETTINGS）から「リード種別」「返信速度」を読む
 * - 国マスタ（国名（表示）列）から有効行のみ表示順で返す
 * - getDropdownOptions / getCountriesForForm には一切手を付けない（旧SPA互換）
 *
 * @param {string} sessionId
 * @returns {{
 *   leadTypes: string[],
 *   responseSpeeds: string[],
 *   countries: { name: string, dialCode: string, stateRequired: boolean, postalRequired: boolean }[]
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

  // ── 選択肢マスタ（リード種別 / 返信速度）────────────────────────────────
  var leadTypes      = [];
  var responseSpeeds = [];
  var optSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (optSheet && optSheet.getLastRow() > 1) {
    var optData = optSheet.getDataRange().getValues();
    var optH    = optData[0].map(String);
    var ltIdx   = optH.indexOf('リード種別');
    var rsIdx   = optH.indexOf('返信速度');
    for (var r = 1; r < optData.length; r++) {
      if (ltIdx >= 0) {
        var lt = String(optData[r][ltIdx] != null ? optData[r][ltIdx] : '').trim();
        if (lt) leadTypes.push(lt);
      }
      if (rsIdx >= 0) {
        var rs = String(optData[r][rsIdx] != null ? optData[r][rsIdx] : '').trim();
        if (rs) responseSpeeds.push(rs);
      }
    }
  }

  // ── 国マスタ（有効行のみ・シート表示順）────────────────────────────────
  var countries = [];
  var countrySheet = ss.getSheetByName('国マスタ');
  if (countrySheet && countrySheet.getLastRow() > 1) {
    var cData     = countrySheet.getDataRange().getValues();
    var cH        = cData[0].map(String);
    var nameIdx   = cH.indexOf('国名（表示）');
    var codeIdx   = cH.indexOf('国番号');
    var stateIdx  = cH.indexOf('州必須');
    var postalIdx = cH.indexOf('郵便番号必須');
    var validIdx  = cH.indexOf('有効');
    if (nameIdx < 0) throw new Error('国マスタヘッダー不足: 国名（表示）');
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

  var result = { leadTypes: leadTypes, responseSpeeds: responseSpeeds, countries: countries };

  writeCacheChunks_(
    LEAD_FORM_OPTIONS_CACHE_INDEX,
    LEAD_FORM_OPTIONS_CACHE_PREFIX,
    result,
    LEAD_FORM_OPTIONS_CACHE_TTL,
    LEAD_FORM_OPTIONS_CACHE_CHUNK
  );

  return result;
}
