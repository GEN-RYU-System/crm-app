/**
 * 99_DevShippingFeeCalcTest.js
 *
 * 目的: calculateShippingFeeForFrontend の計算ロジックをセッション認証なしで
 *       テストする DEV 専用ラッパー。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 料金の値をログに出力すること（契約料金のため）
 *   - シートへの書き込み（読み取り専用）
 *
 * 使い方:
 *   clasp run devTestShippingFeeCalc
 */

/**
 * calculateShippingFeeForFrontend の内部ロジックを
 * セッション認証なしで呼び出し、テストケース (a)〜(e) を検証する。
 * ★ 料金の値は出力しない。「取得できた / できない」のみ報告する。
 *
 * @returns {Object} テスト結果サマリー
 */
function devTestShippingFeeCalc() {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestShippingFeeCalc は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  var results = {};

  // --- (a) US / 1箱 (30×20×15cm / 1.2kg) ---
  // 容積重量 = 30×20×15÷5000 = 1.8kg > 1.2kg → 課金重量 2.0kg
  results.a = _devRunCalc(carriers, 'US', '', [
    { length: 30, width: 20, height: 15, actualWeight: 1.2 }
  ], zonesMap, ratesMap);

  // --- (b) US / 2箱 (a と同じ箱を2つ) ---
  results.b = _devRunCalc(carriers, 'US', '', [
    { length: 30, width: 20, height: 15, actualWeight: 1.2 },
    { length: 30, width: 20, height: 15, actualWeight: 1.2 }
  ], zonesMap, ratesMap);

  // --- (c) CN / 郵便番号 510001（広東省 → CN-S のゾーンを使う） ---
  results.c = _devRunCalc(carriers, 'CN', '510001', [
    { length: 30, width: 20, height: 15, actualWeight: 1.2 }
  ], zonesMap, ratesMap);

  // --- (d) CN / 郵便番号 100000（北京 → CN のゾーンを使う） ---
  results.d = _devRunCalc(carriers, 'CN', '100000', [
    { length: 30, width: 20, height: 15, actualWeight: 1.2 }
  ], zonesMap, ratesMap);

  // --- (e) US / 1箱 (100×100×100cm / 5kg) ---
  // 容積重量 = 100×100×100÷5000 = 200kg → 68kg 上限超過エラー
  results.e = _devRunCalc(carriers, 'US', '', [
    { length: 100, width: 100, height: 100, actualWeight: 5 }
  ], zonesMap, ratesMap);

  Logger.log('=== devTestShippingFeeCalc ===');
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * セッションなしで計算を実行し、料金を除いたサマリーを返す。
 * ★ 料金の値（fee / totalFee の数値）は報告しない。
 *
 * @param {Array} carriers
 * @param {string} countryCode
 * @param {string} postalCode
 * @param {Array} boxes
 * @param {Object} zonesMap
 * @param {Object} ratesMap
 * @returns {Array} 各社の { carrierId, carrierName, zone, error, boxes, feeObtained }
 */
function _devRunCalc(carriers, countryCode, postalCode, boxes, zonesMap, ratesMap) {
  var effectiveCode = _sfcResolveCountryCode(
    countryCode.toUpperCase(),
    postalCode
  );

  return carriers.map(function(carrier) {
    var res = _sfcCalculateForCarrier(carrier, effectiveCode, boxes, zonesMap, ratesMap);
    // 料金の値を除いてサマリーだけ返す
    return {
      carrierId:         res.carrierId,
      carrierName:       res.carrierName,
      effectiveCountry:  effectiveCode,
      zone:              res.zone,
      error:             res.error || null,
      errorDetail:       res.errorDetail || null,
      boxCount:          res.boxes ? res.boxes.length : 0,
      chargeableWeights: res.boxes ? res.boxes.map(function(b) { return b.chargeableWeight; }) : [],
      feeObtained:       !res.error && res.totalFee !== null
    };
  });
}

// ============================================================
// devTestShippingFeeEstimate — _sfeProcess_ の単体検証
// ============================================================

/**
 * _sfeProcess_ の計算ロジックをセッション認証なしで検証する。
 * estimateShippingFeeForFrontend の内部ロジック（API フォールバック込み）を
 * linkType / linkId を渡しながらテストする。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 料金の値をログに出力すること
 *   - シートへの書き込み（save=false で動作確認する）
 *
 * テストケース:
 *   (a) QUOTE linkType / US / 1箱 → feeType=ESTIMATE
 *   (b) SHIPMENT linkType / US / 1箱 → feeType=ACTUAL
 *   (c) QUOTE linkType / CN-S（郵便番号 510001）/ 1箱 → feeType=ESTIMATE
 *   (d) saveShippingFeeEstimate_ の単独呼び出し（シート書き込み）
 *       ★ (d) のみシートに1行書き込む
 *
 * @returns {Object} テスト結果サマリー
 */
function devTestShippingFeeEstimate() {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestShippingFeeEstimate は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  var results = {};

  // --- (a) QUOTE / US / 1箱 (30×20×15cm / 1.2kg) → feeType=ESTIMATE ---
  results.a = _devRunEstimate(ss, carriers, zonesMap, ratesMap, {
    countryCode: 'US', postalCode: '', boxes: [
      { length: 30, width: 20, height: 15, actualWeight: 1.2 }
    ], linkType: 'QUOTE', linkId: 'QT-DEV-001'
  });

  // --- (b) SHIPMENT / US / 1箱 → feeType=ACTUAL ---
  results.b = _devRunEstimate(ss, carriers, zonesMap, ratesMap, {
    countryCode: 'US', postalCode: '', boxes: [
      { length: 30, width: 20, height: 15, actualWeight: 1.2 }
    ], linkType: 'SHIPMENT', linkId: 'SH-DEV-001'
  });

  // --- (c) QUOTE / CN-S（広東省 510001）/ 1箱 → feeType=ESTIMATE ---
  results.c = _devRunEstimate(ss, carriers, zonesMap, ratesMap, {
    countryCode: 'CN', postalCode: '510001', boxes: [
      { length: 30, width: 20, height: 15, actualWeight: 1.2 }
    ], linkType: 'QUOTE', linkId: 'QT-DEV-001'
  });

  // --- (d) saveShippingFeeEstimate_ の単独呼び出し（実際にシートへ書き込む） ---
  results.d = _devTestSave(ss, carriers, zonesMap, ratesMap);

  Logger.log('=== devTestShippingFeeEstimate ===');
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * _sfeProcess_ を呼び出し、料金を除いたサマリーを返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Array}  carriers
 * @param {Object} zonesMap
 * @param {Object} ratesMap
 * @param {{
 *   countryCode: string, postalCode: string, boxes: Array,
 *   linkType: string, linkId: string
 * }} payload
 * @returns {Array}
 */
function _devRunEstimate(ss, carriers, zonesMap, ratesMap, payload) {
  var estimates = _sfeProcess_(ss, carriers, zonesMap, ratesMap, payload);
  return estimates.map(function(r) {
    var totalChargeableWeight = r.boxes
      ? r.boxes.reduce(function(sum, b) { return sum + b.chargeableWeight; }, 0)
      : null;
    return {
      carrierId:             r.carrierId,
      carrierName:           r.carrierName,
      zone:                  r.zone,
      error:                 r.error || null,
      errorDetail:           r.errorDetail || null,
      calcSource:            r.calcSource,
      feeType:               r.feeType,
      boxCount:              r.boxes ? r.boxes.length : 0,
      totalChargeableWeight: totalChargeableWeight,
      chargeableWeights:     r.boxes ? r.boxes.map(function(b) { return b.chargeableWeight; }) : [],
      feeObtained:           !r.error && r.totalFee !== null
    };
  });
}

/**
 * saveShippingFeeEstimate_ を単独で呼び出し、書き込み動作を確認する。
 * MASTER 計算の1件目のキャリア・1箱結果を使って SFE-NNNN レコードを1行追記する。
 * ★ DEV 環境でのみ実行。実際にシートへ書き込む。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Array}  carriers
 * @param {Object} zonesMap
 * @param {Object} ratesMap
 * @returns {{ sfeId: string } | { error: string }}
 */
function _devTestSave(ss, carriers, zonesMap, ratesMap) {
  var feeTypeValues = CORE_SCHEMA_V1_TABLES.SHIPPING_FEE_ESTIMATES.values.FEE_TYPE;
  var calcSourceValues = CORE_SCHEMA_V1_TABLES.SHIPPING_FEE_ESTIMATES.values.CALC_SOURCE;

  // US / 1箱 で最初のキャリアの結果を使う
  var effectiveCode = _sfcResolveCountryCode('US', '');
  var carrier = carriers[0];
  if (!carrier) return { error: 'NO_CARRIER_LOADED' };

  var res = _sfcCalculateForCarrier(carrier, effectiveCode, [
    { length: 30, width: 20, height: 15, actualWeight: 1.2 }
  ], zonesMap, ratesMap);

  if (res.error) return { error: 'CARRIER_CALC_ERROR: ' + res.error };

  var totalChargeableWeight = res.boxes.reduce(function(sum, b) { return sum + b.chargeableWeight; }, 0);

  try {
    var saveResult = saveShippingFeeEstimate_({
      quoteId:               'QT-DEV-SAVE-TEST',
      invoiceId:             '',
      shipmentId:            '',
      carrierId:             res.carrierId,
      zone:                  res.zone,
      totalChargeableWeight: totalChargeableWeight,
      boxCount:              res.boxes.length,
      shippingFee:           res.totalFee,
      calcSource:            calcSourceValues.MASTER,
      feeType:               feeTypeValues.ESTIMATE,
      calculatedAt:          new Date()
    });
    return { saved: true, sfeId: saveResult.sfeId };
  } catch (e) {
    return { error: e.message };
  }
}
