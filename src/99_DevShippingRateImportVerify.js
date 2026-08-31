/**
 * 99_DevShippingRateImportVerify.js
 *
 * 目的: importShippingRateData("APPLY") 完了後に3マスタの投入内容を検証する。
 *       読み取りのみ・副作用なし。
 *
 * 使い方:
 *   clasp run verifyShippingRateImport
 *
 * 検証項目:
 *   (a) アメリカ / FedEx のゾーン
 *   (b) CN / CN-S それぞれの FedEx ゾーン（期待値: W, K）
 *   (c) 送料表マスタの総行数
 */
function verifyShippingRateImport() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyShippingRateImport は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // --- ZONES シート取得 ---
  var zonesSheet = ss.getSheetByName(getCoreSchemaV1TableName('ZONES'));
  if (!zonesSheet) {
    throw new Error('ZONESシートが見つかりません。importShippingRateData("APPLY") を先に実行してください。');
  }
  var zonesData   = zonesSheet.getDataRange().getValues();
  var zonesHeader = zonesData[0];
  var zonesRows   = zonesData.slice(1);

  // ヘッダーはスキーマの表示名（日本語）で格納されている
  var zonesSchema = getCoreSchemaV1Table('ZONES').headers;
  var zCarrierIdx = zonesHeader.indexOf(zonesSchema['CARRIER_ID']);
  var zCountryIdx = zonesHeader.indexOf(zonesSchema['COUNTRY_CODE']);
  var zZoneIdx    = zonesHeader.indexOf(zonesSchema['ZONE']);

  // --- SHIPPING_RATES シート取得 ---
  var ratesSheet = ss.getSheetByName(getCoreSchemaV1TableName('SHIPPING_RATES'));
  if (!ratesSheet) {
    throw new Error('SHIPPING_RATESシートが見つかりません。');
  }
  var ratesRowCount = Math.max(ratesSheet.getLastRow() - 1, 0);

  // --- (a) アメリカ / FedEx ゾーン ---
  var usZones = zonesRows.filter(function(r) {
    return String(r[zCountryIdx]).trim() === 'US' &&
           String(r[zCarrierIdx]).trim() === 'CAR-0001';
  }).map(function(r) { return String(r[zZoneIdx]).trim(); });

  // --- (b) CN / CN-S FedEx ゾーン ---
  var cnZones = zonesRows.filter(function(r) {
    return String(r[zCountryIdx]).trim() === 'CN' &&
           String(r[zCarrierIdx]).trim() === 'CAR-0001';
  }).map(function(r) { return String(r[zZoneIdx]).trim(); });

  var cnSZones = zonesRows.filter(function(r) {
    return String(r[zCountryIdx]).trim() === 'CN-S' &&
           String(r[zCarrierIdx]).trim() === 'CAR-0001';
  }).map(function(r) { return String(r[zZoneIdx]).trim(); });

  var result = {
    a_US_FedEx_zones:   usZones,
    b_CN_FedEx_zones:   cnZones,
    b_CNS_FedEx_zones:  cnSZones,
    c_rates_total_rows: ratesRowCount
  };

  Logger.log('=== verifyShippingRateImport ===');
  Logger.log('(a) US / FedEx ゾーン: ' + JSON.stringify(usZones));
  Logger.log('(b) CN  / FedEx ゾーン: ' + JSON.stringify(cnZones)  + '  (期待値: ["W"])');
  Logger.log('(b) CN-S / FedEx ゾーン: ' + JSON.stringify(cnSZones) + '  (期待値: ["K"])');
  Logger.log('(c) 送料表総行数: ' + ratesRowCount);

  return result;
}
