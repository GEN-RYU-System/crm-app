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
  // 荷姿区分: 省略時は 'BOX'（既存の呼び出しを壊さない）
  var packageType = payload.packageType ? String(payload.packageType).trim().toUpperCase() : 'BOX';

  // --- 実効国コード解決（CN → CN-S 判定） ---
  var effectiveCode = _sfcResolveCountryCode(countryCode, postalCode);

  // --- マスタデータ読み込み ---
  var ss       = getSpreadsheet();
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  // --- 各社の送料計算 ---
  var results = carriers.map(function(carrier) {
    return _sfcCalculateForCarrier(carrier, effectiveCode, boxes, zonesMap, ratesMap, packageType);
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
 * API接続設定3列（API有効/APIエンドポイント/API認証キー名）は省略可能（なければ無効扱い）。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Array<{
 *   id, name, divisor, dimRounding, stepSmall, stepLarge, maxWeight,
 *   apiEnabled, apiEndpoint, apiAuthKeyName
 * }>}
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

  // API接続設定列（オプション。列が存在しない場合は -1 → デフォルト値を使用）
  var iApiEnabled     = headers.indexOf(table.headers['API_ENABLED']      || '');
  var iApiEndpoint    = headers.indexOf(table.headers['API_ENDPOINT']     || '');
  var iApiAuthKeyName = headers.indexOf(table.headers['API_AUTH_KEY_NAME'] || '');

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
        id:            String(row[iId]          || '').trim(),
        name:          String(row[iName]        || '').trim(),
        divisor:       Number(row[iDivisor]),
        dimRounding:   String(row[iDimRounding] || '').trim().toUpperCase(),
        stepSmall:     Number(row[iStepSmall]),
        stepLarge:     Number(row[iStepLarge]),
        maxWeight:     Number(row[iMaxWeight]),
        apiEnabled:    iApiEnabled     >= 0 ? _sfcIsActive(row[iApiEnabled])              : false,
        apiEndpoint:   iApiEndpoint    >= 0 ? String(row[iApiEndpoint]    || '').trim()  : '',
        apiAuthKeyName: iApiAuthKeyName >= 0 ? String(row[iApiAuthKeyName] || '').trim() : ''
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
 * SHIPPING_RATES テーブルから {carrierId|zone|packageType → [{minWeight, maxWeight, rate}]} のマップを構築する。
 * ★ rate の値をログに出力しない。
 * ★ PACKAGE_TYPE 列は addPackageTypeColumn APPLY 実行後に存在する。
 *   列が存在しない場合は全行 'BOX' 扱いとし、既存の呼び出しを壊さない。
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

  // PACKAGE_TYPE はオプション列（addPackageTypeColumn APPLY 実行後に存在する）
  // 列が存在しない場合は -1 → 全行 'BOX' 扱い（既存の呼び出しを壊さない）
  var pkgTypeName = getCoreSchemaV1HeaderName(tableKey, 'PACKAGE_TYPE');
  var iPkgType    = headers.indexOf(pkgTypeName);

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
    var pkgType   = iPkgType >= 0
      ? (String(row[iPkgType] || '').trim() || 'BOX')
      : 'BOX';

    if (!carrierId || !zone || isNaN(minW) || isNaN(maxW) || isNaN(rate)) return;

    var key = carrierId + '|' + zone + '|' + pkgType;
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
 * @param {string} [packageType] - 荷姿区分（省略時は 'BOX'）
 * @returns {{ carrierId, carrierName, zone, totalFee, boxes, error, errorDetail? }}
 */
function _sfcCalculateForCarrier(carrier, countryCode, boxes, zonesMap, ratesMap, packageType) {
  var pkgType = packageType || 'BOX';
  var result = {
    carrierId:   carrier.id,
    carrierName: carrier.name,
    zone:        null,
    totalFee:    null,
    boxes:       [],
    error:       null
  };

  // ゾーン照合
  // 地帯マスタで「-」はその配送会社の取扱いがないことを示す慣習値。
  // 2026-09-01 時点: US 向けは FedEx のみ契約（DHL / UPS は「-」）。
  // 契約内容確認中。回答が得られたら地帯マスタを更新する可能性がある。
  var zone = zonesMap[carrier.id + '|' + countryCode] || null;
  if (!zone) {
    result.error = 'ZONE_NOT_FOUND';
    return result;
  }
  if (zone.trim() === '-') {
    result.error = 'CARRIER_NOT_AVAILABLE';
    return result;
  }
  result.zone = zone;

  // 箱ごとに計算
  var boxResults = [];
  for (var i = 0; i < boxes.length; i++) {
    var boxResult = _sfcCalculateBox(carrier, zone, boxes[i], ratesMap, pkgType);
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
 * @param {string} [packageType] - 荷姿区分（省略時は 'BOX'）
 * @returns {{ chargeableWeight: number, fee: number } | { error: string, errorDetail?: * }}
 */
function _sfcCalculateBox(carrier, zone, box, ratesMap, packageType) {
  var pkgType = packageType || 'BOX';
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
  var rateKey = carrier.id + '|' + zone + '|' + pkgType;
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

// ============================================================
// 送料見積履歴 API  (SHIPPING_FEE_ESTIMATES)
// ============================================================

var SFE_ID_PREFIX = 'SFE-';
var SFE_ID_DIGITS = 4;

/**
 * 配送先・荷姿から全キャリアの送料を見積もり、結果を保存して返す。
 *
 * payload:
 *   countryCode {string}  必須
 *   postalCode  {string}  省略可
 *   boxes       {Array}   必須  [{ length, width, height, actualWeight }]
 *   linkType    {string}  必須  'QUOTE' | 'INVOICE' | 'SHIPMENT'
 *   linkId      {string}  必須
 *   save        {boolean} 省略可（デフォルト true）
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, results: Array }}
 */
function estimateShippingFeeForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var countryCode = String(payload.countryCode || '').trim().toUpperCase();
  if (!countryCode) throw new Error('MISSING_COUNTRY_CODE');

  if (!Array.isArray(payload.boxes) || payload.boxes.length === 0) {
    throw new Error('MISSING_BOXES');
  }
  var boxes = payload.boxes;

  var linkType = String(payload.linkType || '').trim().toUpperCase();
  if (['QUOTE', 'INVOICE', 'SHIPMENT'].indexOf(linkType) < 0) {
    throw new Error('INVALID_LINK_TYPE: must be QUOTE, INVOICE, or SHIPMENT');
  }

  var linkId = String(payload.linkId || '').trim();
  if (!linkId) throw new Error('MISSING_LINK_ID');

  var postalCode = String(payload.postalCode || '').trim();
  var doSave = payload.save !== false; // default true

  var ss = getSpreadsheet();

  // linkId の存在確認（INVOICE は CoreSchemaRegistry 未登録のためスキップ）
  _sfeValidateLinkId_(ss, linkType, linkId);

  // マスタデータ読み込み
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  // 見積計算
  var estimates = _sfeProcess_(ss, carriers, zonesMap, ratesMap, {
    countryCode: countryCode,
    postalCode:  postalCode,
    boxes:       boxes,
    linkType:    linkType,
    linkId:      linkId
  });

  // 保存
  if (doSave) {
    var now = new Date();
    estimates.forEach(function(r) {
      if (!r.error) {
        var totalChargeableWeight = r.boxes.reduce(function(sum, b) {
          return sum + b.chargeableWeight;
        }, 0);
        var linkCols = _sfeBuildLinkColumns_(linkType, linkId);
        saveShippingFeeEstimate_({
          quoteId:               linkCols.quoteId,
          invoiceId:             linkCols.invoiceId,
          shipmentId:            linkCols.shipmentId,
          carrierId:             r.carrierId,
          zone:                  r.zone,
          totalChargeableWeight: totalChargeableWeight,
          boxCount:              r.boxes.length,
          shippingFee:           r.totalFee,
          calcSource:            r.calcSource,
          feeType:               r.feeType,
          calculatedAt:          now
        });
      }
    });
  }

  return { success: true, results: estimates };
}

/**
 * セッションなしで見積計算を実行する（DEV テスト・内部呼び出し用）。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss   未使用（将来の拡張用）
 * @param {Array}  carriers
 * @param {Object} zonesMap
 * @param {Object} ratesMap
 * @param {{
 *   countryCode: string,
 *   postalCode:  string,
 *   boxes:       Array,
 *   linkType:    string
 * }} payload
 * @returns {Array} 各キャリアの計算結果（calcSource / feeType を追加済み）
 */
function _sfeProcess_(ss, carriers, zonesMap, ratesMap, payload) { // eslint-disable-line no-unused-vars
  var effectiveCode = _sfcResolveCountryCode(
    payload.countryCode.toUpperCase(),
    payload.postalCode || ''
  );

  var feeTypeValues = CORE_SCHEMA_V1_TABLES.SHIPPING_FEE_ESTIMATES.values.FEE_TYPE;
  var calcSourceValues = CORE_SCHEMA_V1_TABLES.SHIPPING_FEE_ESTIMATES.values.CALC_SOURCE;
  var feeType = payload.linkType === 'SHIPMENT'
    ? feeTypeValues.ACTUAL
    : feeTypeValues.ESTIMATE;

  return carriers.map(function(carrier) {
    var calcSource = calcSourceValues.MASTER;
    var res;

    if (carrier.apiEnabled) {
      var apiResult = callCarrierRateApi_(carrier, {
        countryCode: payload.countryCode,
        postalCode:  payload.postalCode || '',
        boxes:       payload.boxes
      });
      if (apiResult && apiResult.supported) {
        res = apiResult;
        calcSource = calcSourceValues.API;
      }
    }

    if (!res) {
      var pkgType = payload.packageType ? String(payload.packageType).trim().toUpperCase() : 'BOX';
      res = _sfcCalculateForCarrier(carrier, effectiveCode, payload.boxes, zonesMap, ratesMap, pkgType);
      calcSource = calcSourceValues.MASTER;
    }

    res.calcSource = calcSource;
    res.feeType    = feeType;
    return res;
  });
}

/**
 * キャリア API を呼び出して送料を取得する。
 * ★ 現時点では実装の骨格のみ。常に { supported: false } を返す。
 *
 * @param {{ id: string, name: string, apiEndpoint: string, apiAuthKeyName: string }} carrier
 * @param {{ countryCode: string, postalCode: string, boxes: Array }} apiPayload
 * @returns {{ supported: false }}
 */
function callCarrierRateApi_(carrier, apiPayload) { // eslint-disable-line no-unused-vars
  // TODO: 実際の API 接続を実装する
  return { supported: false };
}

/**
 * 送料見積結果を SHIPPING_FEE_ESTIMATES シートに保存する。
 * - LockService で排他制御する
 * - ID は SFE-0001 形式（4桁連番）で採番する
 * - quoteId / invoiceId / shipmentId のうち2つ以上が非空なら拒否する
 * - 日本語列名の直書き禁止（getCoreSchemaV1HeaderName を使う）
 *
 * @param {{
 *   quoteId:               string,
 *   invoiceId:             string,
 *   shipmentId:            string,
 *   carrierId:             string,
 *   zone:                  string,
 *   totalChargeableWeight: number,
 *   boxCount:              number,
 *   shippingFee:           number,
 *   calcSource:            string,
 *   feeType:               string,
 *   calculatedAt:          Date
 * }} record
 * @returns {{ sfeId: string }}
 */
function saveShippingFeeEstimate_(record) {
  // 3つのID列のうち2列以上に値があれば拒否
  var filledLinkIds = [record.quoteId, record.invoiceId, record.shipmentId]
    .filter(function(v) { return v && String(v).trim() !== ''; });
  if (filledLinkIds.length > 1) {
    throw new Error('MULTIPLE_LINK_IDS: quoteId / invoiceId / shipmentId は1つだけ指定してください。');
  }

  return withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();
      var validated = validateCoreSchemaV1TableForWrite(ss, 'SHIPPING_FEE_ESTIMATES');
      var sheet = validated.sheet;
      var hi    = validated.headerIndexes; // 1-indexed

      function h(fieldKey) {
        return getCoreSchemaV1HeaderName('SHIPPING_FEE_ESTIMATES', fieldKey);
      }
      function setCell(fieldKey, value) {
        var colIdx = hi[h(fieldKey)];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      // ID 採番（ロック内で行う）
      var sfeId = _sfeGenerateNextId_(sheet, hi);

      // targetRow を appendRow の前に確定する
      var targetRow = sheet.getLastRow() + 1;
      var maxCols   = sheet.getLastColumn();
      sheet.appendRow(new Array(maxCols).fill(''));

      var now = new Date();
      setCell('SHIPPING_FEE_ESTIMATE_ID', sfeId);
      setCell('QUOTE_ID',                 record.quoteId    || '');
      setCell('INVOICE_ID',               record.invoiceId  || '');
      setCell('SHIPMENT_ID',              record.shipmentId || '');
      setCell('CARRIER_ID',               record.carrierId);
      setCell('ZONE',                     record.zone);
      setCell('TOTAL_CHARGEABLE_WEIGHT',  record.totalChargeableWeight);
      setCell('BOX_COUNT',                record.boxCount);
      setCell('SHIPPING_FEE',             record.shippingFee);
      setCell('CALC_SOURCE',              record.calcSource);
      setCell('FEE_TYPE',                 record.feeType);
      setCell('CALCULATED_AT',            record.calculatedAt || now);
      setCell('ACTIVE',                   true);
      setCell('REGISTERED_AT',            now);
      setCell('UPDATED_AT',               now);

      return { sfeId: sfeId };
    }
  );
}

/**
 * linkId が対象シートに存在するか確認する。
 * INVOICE は CoreSchemaRegistry 未登録のためスキップする。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} linkType  'QUOTE' | 'INVOICE' | 'SHIPMENT'
 * @param {string} linkId
 * @throws {Error} LINK_ID_NOT_FOUND
 */
function _sfeValidateLinkId_(ss, linkType, linkId) {
  if (linkType === 'INVOICE') {
    // INVOICES は CoreSchemaRegistry 未登録。バリデーションをスキップする。
    return;
  }

  var tableKey = linkType === 'QUOTE' ? 'QUOTES' : 'SHIPMENTS';
  var pkKey    = linkType === 'QUOTE' ? 'QUOTE_ID' : 'SHIPMENT_ID';

  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, pkKey);
  var sheet = ss.getSheets().filter(function(s) {
    return s.getName() === CORE_SCHEMA_V1_TABLES[tableKey].sheetName;
  })[0];
  if (!sheet) throw new Error('SHEET_NOT_FOUND: ' + CORE_SCHEMA_V1_TABLES[tableKey].sheetName);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('LINK_ID_NOT_FOUND: ' + linkId);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIdx  = headers.indexOf(pkPhysical);
  if (colIdx < 0) throw new Error('PK_COLUMN_NOT_FOUND: ' + pkPhysical);

  var ids = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === linkId) return;
  }
  throw new Error('LINK_ID_NOT_FOUND: ' + linkId);
}

/**
 * linkType に応じた3列（QUOTE_ID / INVOICE_ID / SHIPMENT_ID）の値を返す。
 *
 * @param {string} linkType  'QUOTE' | 'INVOICE' | 'SHIPMENT'
 * @param {string} linkId
 * @returns {{ quoteId: string, invoiceId: string, shipmentId: string }}
 */
function _sfeBuildLinkColumns_(linkType, linkId) {
  return {
    quoteId:    linkType === 'QUOTE'    ? linkId : '',
    invoiceId:  linkType === 'INVOICE'  ? linkId : '',
    shipmentId: linkType === 'SHIPMENT' ? linkId : ''
  };
}

/**
 * SHIPPING_FEE_ESTIMATES シートの最大連番を読み取り、次の SFE-NNNN を返す。
 * ロック内で呼び出すこと。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  validateCoreSchemaV1TableForWrite が返す hi（1-indexed）
 * @returns {string}  例: 'SFE-0001'
 */
function _sfeGenerateNextId_(sheet, headerIndexes) {
  var pkPhysical = getCoreSchemaV1HeaderName('SHIPPING_FEE_ESTIMATES', 'SHIPPING_FEE_ESTIMATE_ID');
  var colIdx = headerIndexes[pkPhysical];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(SFE_ID_PREFIX) === 0) {
        var num = parseInt(id.slice(SFE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return SFE_ID_PREFIX + String(maxNum + 1).padStart(SFE_ID_DIGITS, '0');
}
