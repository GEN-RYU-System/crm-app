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
