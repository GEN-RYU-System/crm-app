/**
 * 配送可能な国のリストを取得
 */
function getCountryList() {
  const sZones = getSheetByConfig(ERP_CONFIG.SHEETS.ZONES);
  if (!sZones) return [];
  // 重複排除してソートして返す
  return [...new Set(sZones.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()))].filter(Boolean).sort();
}

/**
 * 3社の送料見積もり計算
 */
function getLiveShippingEstimates(country, weight) {
  const results = {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const carriers = [
    { name: "FedEx", config: ERP_CONFIG.SHEETS.SHIPPING_FEDEX },
    { name: "DHL", config: ERP_CONFIG.SHEETS.SHIPPING_DHL },
    { name: "UPS", config: ERP_CONFIG.SHEETS.SHIPPING_UPS }
  ];

  const zoneSheet = getSheetByConfig(ERP_CONFIG.SHEETS.ZONES);
  if (!zoneSheet) return null;
  const zData = zoneSheet.getDataRange().getValues();

  carriers.forEach(carrier => {
    const rateSheet = getSheetByConfig(carrier.config);
    if (!rateSheet) { results[carrier.name] = null; return; }

    const rData = rateSheet.getDataRange().getValues();

    // 1. Zone特定 (Country, Carrier)
    const zoneRow = zData.find(r =>
      String(r[0]).toLowerCase() === country.toLowerCase() &&
      String(r[2]).toLowerCase() === carrier.name.toLowerCase()
    );

    if (!zoneRow) { results[carrier.name] = null; return; }
    const zoneName = String(zoneRow[1]);

    // 2. Rate特定 (Carrier, Zone, Weight range)
    // RateSheet [Carrier, Zone, MinWeight, MaxWeight, Price]
    const match = rData.slice(1).find(r =>
      String(r[1]) === zoneName &&
      weight >= parseFloat(r[2]) &&
      weight < parseFloat(r[3])
    );

    results[carrier.name] = match ? parseFloat(match[4]) : null;
  });

  return results;
}