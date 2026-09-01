/**
 * 29_ShippingFeeCalculator.js
 *
 * 目的: 配送会社マスタ・地帯マスタ・送料表マスタから
 *       3社（FedEx/DHL/UPS）の送料を計算して返す。
 *
 * 禁止事項:
 *   - 料金の値をログに出力すること（契約料金のため）
 *   - シートへの書き込み（読み取り専用）
 *   - 日本語エラーメッセージ（エラーはコード文字列で返す）
 *
 * 使い方:
 *   GAS から google.script.run.calculateShippingFeeForFrontend(sessionId, payload)
 */

// ============================================================
// 定数
// ============================================================

/**
 * 中国南部（CN-S）と判定する郵便番号範囲（最小・最大）。
 * 出典: FedEx 公式料金表（郵便番号帯による地域定義）。
 * ★ 料金表の値であり電話番号ではない。
 */
var SFC_CN_SOUTH_POSTAL_RANGES = [
  { min: 350000, max: 369999 }, // Fujian Province
  { min: 510000, max: 529999 }  // Guangdong Province
];

/**
 * 重量刻み切替境界 (kg)。
 * 実測した重量帯（PR-T3a）: 0〜21kg は刻み小、21kg超は刻み大。
 */
var SFC_WEIGHT_STEP_BOUNDARY = 21;

// ============================================================
// エントリポイント
// ============================================================

/**
 * 荷姿（寸法・重量）と配送先から 3社分の送料を計算して返す。
 * 読み取り専用。シートへの書き込みは一切しない。
 *
 * @param {string} sessionId
 * @param {{
 *   countryCode: string,
 *   postalCode?: string,
 *   boxes: Array<{ length: number, width: number, height: number, actualWeight: number }>
 * }} payload
 * @returns {{
 *   results?: Array<{
 *     carrierId: string, carrierName: string, zone: string|null,
 *     totalFee: number|null,
 *     boxes: Array<{ chargeableWeight: number, fee: number }>,
 *     error: string|null, errorDetail?: *
 *   }>,
 *   error?: string
 * }}
 */
function calculateShippingFeeForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  // --- ペイロード検証 ---
  if (!payload || !payload.countryCode) {
    return { error: 'COUNTRY_CODE_REQUIRED' };
  }
  if (!Array.isArray(payload.boxes) || payload.boxes.length === 0) {
    return { error: 'BOXES_REQUIRED' };
  }

  var countryCode = String(payload.countryCode).trim().toUpperCase();
  var postalCode  = payload.postalCode ? String(payload.postalCode).trim() : '';
  var boxes       = payload.boxes;

  // --- 実効国コード解決（CN → CN-S 判定） ---
  var effectiveCode = _sfcResolveCountryCode(countryCode, postalCode);

  // --- マスタデータ読み込み ---
  var ss       = getSpreadsheet();
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  // --- 各社の送料計算 ---
  var results = carriers.map(function(carrier) {
    return _sfcCalculateForCarrier(carrier, effectiveCode, boxes, zonesMap, ratesMap);
  });

  return { results: results };
}

// ============================================================
// 国コード解決
// ============================================================

/**
 * CN + CN-S 郵便番号範囲に合致する場合は 'CN-S' を返す。
 * それ以外は元の countryCode をそのまま返す。
 *
 * @param {string} countryCode
 * @param {string} postalCode
 * @returns {string}
 */
function _sfcResolveCountryCode(countryCode, postalCode) {
  if (countryCode !== 'CN' || !postalCode) return countryCode;
  var code = parseInt(postalCode, 10);
  if (isNaN(code)) return countryCode;
  var isSouth = SFC_CN_SOUTH_POSTAL_RANGES.some(function(r) {
    return code >= r.min && code <= r.max;
  });
  return isSouth ? 'CN-S' : countryCode;
}

// ============================================================
// データ読み込み
// ============================================================

/**
 * CARRIERS テーブルから配送会社情報を読み込む。
 * 4列（寸法端数処理/重量刻み小/重量刻み大/最大対応重量）が必須。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Array<{ id, name, divisor, dimRounding, stepSmall, stepLarge, maxWeight }>}
 */
function _sfcLoadCarriers(ss) {
  var tableKey = 'CARRIERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();

  var headers = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  function hIdx(key) {
    var name = getCoreSchemaV1HeaderName(tableKey, key);
    var idx  = headers.indexOf(name);
    if (idx < 0) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + key);
    return idx;
  }

  var iId          = hIdx('CARRIER_ID');
  var iName        = hIdx('NAME');
  var iDivisor     = hIdx('VOLUMETRIC_DIVISOR');
  var iDimRounding = hIdx('DIM_ROUNDING');
  var iStepSmall   = hIdx('WEIGHT_STEP_SMALL');
  var iStepLarge   = hIdx('WEIGHT_STEP_LARGE');
  var iMaxWeight   = hIdx('MAX_WEIGHT');
  var iActive      = hIdx('ACTIVE');

  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) return [];

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  return data
    .filter(function(row) {
      return _sfcIsActive(row[iActive]);
    })
    .map(function(row) {
      return {
        id:          String(row[iId]          || '').trim(),
        name:        String(row[iName]        || '').trim(),
        divisor:     Number(row[iDivisor]),
        dimRounding: String(row[iDimRounding] || '').trim().toUpperCase(),
        stepSmall:   Number(row[iStepSmall]),
        stepLarge:   Number(row[iStepLarge]),
        maxWeight:   Number(row[iMaxWeight])
      };
    });
}

/**
 * ZONES テーブルから {carrierId|countryCode → zone} のマップを構築する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sfcBuildZonesMap(ss) {
  var tableKey = 'ZONES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();

  var headers = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  function hIdx(key) {
    var name = getCoreSchemaV1HeaderName(tableKey, key);
    var idx  = headers.indexOf(name);
    if (idx < 0) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + key);
    return idx;
  }

  var iCarrier = hIdx('CARRIER_ID');
  var iCountry = hIdx('COUNTRY_CODE');
  var iZone    = hIdx('ZONE');
  var iActive  = hIdx('ACTIVE');

  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) return {};

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();
  var map  = {};

  data.forEach(function(row) {
    if (!_sfcIsActive(row[iActive])) return;

    var carrierId   = String(row[iCarrier] || '').trim();
    var countryCode = String(row[iCountry] || '').trim();
    var zone        = String(row[iZone]    || '').trim();

    if (!carrierId || !countryCode || !zone) return;
    map[carrierId + '|' + countryCode] = zone;
  });

  return map;
}

/**
 * SHIPPING_RATES テーブルから {carrierId|zone → [{minWeight, maxWeight, rate}]} のマップを構築する。
 * ★ rate の値をログに出力しない。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sfcBuildRatesMap(ss) {
  var tableKey = 'SHIPPING_RATES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();

  var headers = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  function hIdx(key) {
    var name = getCoreSchemaV1HeaderName(tableKey, key);
    var idx  = headers.indexOf(name);
    if (idx < 0) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING:' + key);
    return idx;
  }

  var iCarrier = hIdx('CARRIER_ID');
  var iZone    = hIdx('ZONE');
  var iMin     = hIdx('MIN_WEIGHT');
  var iMax     = hIdx('MAX_WEIGHT');
  var iRate    = hIdx('RATE');
  var iActive  = hIdx('ACTIVE');

  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);
  if (dataRowCount === 0) return {};

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();
  var map  = {};

  data.forEach(function(row) {
    if (!_sfcIsActive(row[iActive])) return;

    var carrierId = String(row[iCarrier] || '').trim();
    var zone      = String(row[iZone]    || '').trim();
    var minW      = Number(row[iMin]);
    var maxW      = Number(row[iMax]);
    var rate      = Number(row[iRate]);

    if (!carrierId || !zone || isNaN(minW) || isNaN(maxW) || isNaN(rate)) return;

    var key = carrierId + '|' + zone;
    if (!map[key]) map[key] = [];
    map[key].push({ minWeight: minW, maxWeight: maxW, rate: rate });
  });

  return map;
}

// ============================================================
// 送料計算
// ============================================================

/**
 * 1社分の送料を計算する。
 *
 * @param {{ id, name, divisor, dimRounding, stepSmall, stepLarge, maxWeight }} carrier
 * @param {string} countryCode
 * @param {Array<{ length, width, height, actualWeight }>} boxes
 * @param {Object} zonesMap
 * @param {Object} ratesMap
 * @returns {{ carrierId, carrierName, zone, totalFee, boxes, error, errorDetail? }}
 */
function _sfcCalculateForCarrier(carrier, countryCode, boxes, zonesMap, ratesMap) {
  var result = {
    carrierId:   carrier.id,
    carrierName: carrier.name,
    zone:        null,
    totalFee:    null,
    boxes:       [],
    error:       null
  };

  // ゾーン照合
  var zone = zonesMap[carrier.id + '|' + countryCode] || null;
  if (!zone) {
    result.error = 'ZONE_NOT_FOUND';
    return result;
  }
  result.zone = zone;

  // 箱ごとに計算
  var boxResults = [];
  for (var i = 0; i < boxes.length; i++) {
    var boxResult = _sfcCalculateBox(carrier, zone, boxes[i], ratesMap);
    if (boxResult.error) {
      result.error       = boxResult.error;
      result.errorDetail = boxResult.errorDetail !== undefined ? boxResult.errorDetail : null;
      return result;
    }
    boxResults.push({ chargeableWeight: boxResult.chargeableWeight, fee: boxResult.fee });
  }

  result.totalFee = boxResults.reduce(function(sum, b) { return sum + b.fee; }, 0);
  result.boxes    = boxResults;
  return result;
}

/**
 * 1箱の請求重量と料金を計算する。
 * ★ 料金の値をログに出力しない。
 *
 * @param {{ divisor, dimRounding, stepSmall, stepLarge, maxWeight }} carrier
 * @param {string} zone
 * @param {{ length, width, height, actualWeight }} box
 * @param {Object} ratesMap
 * @returns {{ chargeableWeight: number, fee: number } | { error: string, errorDetail?: * }}
 */
function _sfcCalculateBox(carrier, zone, box, ratesMap) {
  var L = Number(box.length);
  var W = Number(box.width);
  var H = Number(box.height);
  var actualWeight = Number(box.actualWeight);

  if (isNaN(L) || isNaN(W) || isNaN(H) || isNaN(actualWeight)) {
    return { error: 'INVALID_BOX_DIMENSIONS' };
  }

  // 寸法端数処理
  var ceilL, ceilW, ceilH;
  if (carrier.dimRounding === 'CEIL') {
    ceilL = Math.ceil(L);
    ceilW = Math.ceil(W);
    ceilH = Math.ceil(H);
  } else {
    return { error: 'UNSUPPORTED_DIM_ROUNDING', errorDetail: carrier.dimRounding };
  }

  // 容積重量
  var volumetricWeight = (ceilL * ceilW * ceilH) / carrier.divisor;

  // 課金重量（丸め前）
  var rawChargeable = Math.max(actualWeight, volumetricWeight);

  // 重量刻みを決定して切り上げ
  var step = rawChargeable <= SFC_WEIGHT_STEP_BOUNDARY
    ? carrier.stepSmall
    : carrier.stepLarge;
  var chargeableWeight = _sfcRoundUpToStep(rawChargeable, step);

  // 最大対応重量チェック
  if (chargeableWeight > carrier.maxWeight) {
    return {
      error:       'WEIGHT_EXCEEDS_MAX',
      errorDetail: { chargeableWeight: chargeableWeight, maxWeight: carrier.maxWeight }
    };
  }

  // 料金表照合: minWeight < chargeableWeight <= maxWeight
  var rateKey = carrier.id + '|' + zone;
  var bands   = ratesMap[rateKey] || [];
  var band    = null;
  for (var j = 0; j < bands.length; j++) {
    if (bands[j].minWeight < chargeableWeight && chargeableWeight <= bands[j].maxWeight) {
      band = bands[j];
      break;
    }
  }

  if (!band) {
    return {
      error:       'RATE_NOT_FOUND',
      errorDetail: { zone: zone, chargeableWeight: chargeableWeight }
    };
  }

  return { chargeableWeight: chargeableWeight, fee: band.rate };
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * weight を step 単位で切り上げる。
 * 例: _sfcRoundUpToStep(1.8, 0.5) → 2.0
 *
 * @param {number} weight
 * @param {number} step
 * @returns {number}
 */
function _sfcRoundUpToStep(weight, step) {
  if (step <= 0) return weight;
  return Math.ceil(weight / step) * step;
}

/**
 * ACTIVE 列の値（boolean または文字列）を真偽値に変換する。
 *
 * @param {*} value
 * @returns {boolean}
 */
function _sfcIsActive(value) {
  if (typeof value === 'boolean') return value;
  return String(value).trim().toUpperCase() === 'TRUE';
}
