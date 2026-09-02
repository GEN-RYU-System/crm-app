/**
 * 型混在列の現状確認（読み取り専用）
 * 対象: 配送先マスタ.zip / 支払先マスタ.zip / システム設定.setting_value
 *
 * PostgreSQL 移植対応 — 型混在列の解消 (2026-09-02)
 */

/**
 * 配送先マスタ.zip / 支払先マスタ.zip / システム設定.setting_value
 * の全行の値と型を返す（読み取り専用・変更なし）。
 */
function devInspectZipAndSettingValue() {
  var ss = getSpreadsheet();
  var result = {};

  // 配送先マスタの zip 列
  var shippingSheet = getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS');
  var shippingHeaders = shippingSheet.getRange(1, 1, 1, shippingSheet.getLastColumn()).getValues()[0];
  var zipColIdx = shippingHeaders.indexOf('zip');
  result.shippingZip = [];
  if (zipColIdx >= 0 && shippingSheet.getLastRow() > 1) {
    var shippingData = shippingSheet.getRange(2, 1, shippingSheet.getLastRow() - 1, shippingSheet.getLastColumn()).getValues();
    shippingData.forEach(function(row, i) {
      var v = row[zipColIdx];
      result.shippingZip.push({ row: i + 2, value: v, type: typeof v });
    });
  }

  // 支払先マスタの zip 列
  var paymentSheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');
  var paymentHeaders = paymentSheet.getRange(1, 1, 1, paymentSheet.getLastColumn()).getValues()[0];
  var payZipColIdx = paymentHeaders.indexOf('zip');
  result.paymentZip = [];
  if (payZipColIdx >= 0 && paymentSheet.getLastRow() > 1) {
    var paymentData = paymentSheet.getRange(2, 1, paymentSheet.getLastRow() - 1, paymentSheet.getLastColumn()).getValues();
    paymentData.forEach(function(row, i) {
      var v = row[payZipColIdx];
      result.paymentZip.push({ row: i + 2, value: v, type: typeof v });
    });
  }

  // システム設定の setting_value 列
  var settingsSheet = getCoreSchemaV1Sheet(ss, 'SETTINGS');
  var settingsHeaders = settingsSheet.getRange(1, 1, 1, settingsSheet.getLastColumn()).getValues()[0];
  var svColIdx = settingsHeaders.indexOf('setting_value');
  result.settingValue = [];
  if (svColIdx >= 0 && settingsSheet.getLastRow() > 1) {
    var settingsData = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, settingsSheet.getLastColumn()).getValues();
    settingsData.forEach(function(row, i) {
      var v = row[svColIdx];
      result.settingValue.push({ row: i + 2, value: v, type: typeof v });
    });
  }

  return result;
}
