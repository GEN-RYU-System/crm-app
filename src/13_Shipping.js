/**
 * 配送料金計算ロジック (13_Shipping.js)
 *
 * 機能:
 * - 国・重量・キャリアから配送料金を計算
 * - FedEx/DHL/UPSの3社に対応
 * - 最安値自動選択機能
 *
 * 依存:
 * - CONFIG.SHEETS (08_Config.js)
 * - IMPORTRANGE同期シート: M_Zones同期, FedEx_ShippingRates同期, DHL_ShippingRates同期, UPS_ShippingRates同期
 */

/**
 * 配送料金を計算する関数
 *
 * @param {string} country - 配送先国名（例: "United States"）
 * @param {number} weight - 総重量（kg）
 * @param {string} carrier - 'FedEx' | 'DHL' | 'UPS' | 'auto'（autoの場合は最安値）
 * @returns {Object} 配送料金情報
 *
 * 返却値の形式:
 * {
 *   carrier: 'FedEx',
 *   fee: 5000,
 *   zone: 'Zone 1',
 *   weight: 2.5,
 *   allRates: { FedEx: 5000, DHL: 5500, UPS: 5200 }
 * }
 */
function calculateShippingFee(country, weight, carrier = 'auto') {
  // バリデーション
  if (!country || !weight || weight <= 0) {
    return {
      error: '国名と重量は必須です',
      carrier: null,
      fee: null,
      zone: null,
      weight: weight,
      allRates: null
    };
  }

  // 1. 国からゾーン番号を取得
  const zone = getZoneByCountry(country);
  if (!zone) {
    return {
      error: `国「${country}」のゾーン情報が見つかりません`,
      carrier: null,
      fee: null,
      zone: null,
      weight: weight,
      allRates: null
    };
  }

  // 2. 各キャリアの料金を取得
  const fedexRate = getFedExRate(weight, zone);
  const dhlRate = getDHLRate(weight, zone);
  const upsRate = getUPSRate(weight, zone);

  const allRates = {
    FedEx: fedexRate,
    DHL: dhlRate,
    UPS: upsRate
  };

  // 3. carrier='auto'の場合は最安値を選択
  if (carrier === 'auto') {
    const validRates = Object.entries(allRates)
      .filter(([_, rate]) => rate !== null && !isNaN(rate))
      .sort((a, b) => a[1] - b[1]);

    if (validRates.length === 0) {
      return {
        error: `重量${weight}kgに対応する料金が見つかりません`,
        carrier: null,
        fee: null,
        zone: zone,
        weight: weight,
        allRates: allRates
      };
    }

    const [cheapestCarrier, cheapestFee] = validRates[0];
    return {
      carrier: cheapestCarrier,
      fee: cheapestFee,
      zone: zone,
      weight: weight,
      allRates: allRates
    };
  }

  // 4. 指定キャリアの料金を返却
  const selectedRate = allRates[carrier];
  if (selectedRate === null || selectedRate === undefined) {
    return {
      error: `キャリア「${carrier}」の料金情報が見つかりません`,
      carrier: carrier,
      fee: null,
      zone: zone,
      weight: weight,
      allRates: allRates
    };
  }

  return {
    carrier: carrier,
    fee: selectedRate,
    zone: zone,
    weight: weight,
    allRates: allRates
  };
}

/**
 * 国名からゾーン番号を取得
 *
 * @param {string} country - 国名（例: "United States"）
 * @returns {string|null} ゾーン番号（例: "Zone 1"）、見つからない場合はnull
 */
function getZoneByCountry(country) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ZONES_SYNC);

    if (!sheet) {
      Logger.log('M_Zones同期シートが見つかりません');
      return null;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('M_Zones同期シートにデータがありません');
      return null;
    }

    // 国名でゾーンを検索（大文字小文字を無視）
    const countryLower = String(country).toLowerCase().trim();
    const zoneRow = data.slice(1).find(row => {
      const rowCountry = String(row[0] || '').toLowerCase().trim();
      return rowCountry === countryLower;
    });

    if (!zoneRow) {
      Logger.log(`国「${country}」がM_Zones同期シートに見つかりません`);
      return null;
    }

    // ゾーン番号を取得（2列目）
    return String(zoneRow[1] || '').trim();

  } catch (e) {
    Logger.log(`getZoneByCountryエラー: ${e.message}`);
    return null;
  }
}

/**
 * FedEx料金表から料金取得
 *
 * @param {number} weight - 重量（kg）
 * @param {string} zone - ゾーン番号（例: "Zone 1"）
 * @returns {number|null} 料金、見つからない場合はnull
 */
function getFedExRate(weight, zone) {
  return getShippingRate(CONFIG.SHEETS.FEDEX_RATES_SYNC, weight, zone);
}

/**
 * DHL料金表から料金取得
 *
 * @param {number} weight - 重量（kg）
 * @param {string} zone - ゾーン番号（例: "Zone 1"）
 * @returns {number|null} 料金、見つからない場合はnull
 */
function getDHLRate(weight, zone) {
  return getShippingRate(CONFIG.SHEETS.DHL_RATES_SYNC, weight, zone);
}

/**
 * UPS料金表から料金取得
 *
 * @param {number} weight - 重量（kg）
 * @param {string} zone - ゾーン番号（例: "Zone 1"）
 * @returns {number|null} 料金、見つからない場合はnull
 */
function getUPSRate(weight, zone) {
  return getShippingRate(CONFIG.SHEETS.UPS_RATES_SYNC, weight, zone);
}

/**
 * 配送料金表シート検索の共通ロジック（内部ヘルパー関数）
 *
 * 料金表の想定フォーマット:
 * [Carrier, Zone, MinWeight, MaxWeight, Price]
 * 例: ["FedEx", "Zone 1", 0, 0.5, 3000]
 *
 * @param {string} sheetName - シート名
 * @param {number} weight - 重量（kg）
 * @param {string} zone - ゾーン番号（例: "Zone 1"）
 * @returns {number|null} 料金、見つからない場合はnull
 */
function getShippingRate(sheetName, weight, zone) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`${sheetName}シートが見つかりません`);
      return null;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log(`${sheetName}シートにデータがありません`);
      return null;
    }

    // ゾーンと重量範囲に該当する行を検索
    // フォーマット: [Carrier, Zone, MinWeight, MaxWeight, Price]
    const matchRow = data.slice(1).find(row => {
      const rowZone = String(row[1] || '').trim();
      const minWeight = parseFloat(row[2]);
      const maxWeight = parseFloat(row[3]);

      // ゾーンが一致し、重量が範囲内かチェック
      return rowZone === zone &&
             weight >= minWeight &&
             weight < maxWeight;
    });

    if (!matchRow) {
      // 該当する重量帯がない場合は、最も近い上の重量帯を使用
      const upperWeightRow = data.slice(1)
        .filter(row => {
          const rowZone = String(row[1] || '').trim();
          const minWeight = parseFloat(row[2]);
          return rowZone === zone && weight < minWeight;
        })
        .sort((a, b) => parseFloat(a[2]) - parseFloat(b[2]))[0];

      if (upperWeightRow) {
        Logger.log(`${sheetName}: 重量${weight}kgに該当する範囲がないため、最も近い上の重量帯を使用`);
        return parseFloat(upperWeightRow[4]);
      }

      Logger.log(`${sheetName}: ゾーン${zone}、重量${weight}kgに該当する料金が見つかりません`);
      return null;
    }

    // 料金を返却（5列目）
    const price = parseFloat(matchRow[4]);
    return isNaN(price) ? null : price;

  } catch (e) {
    Logger.log(`getShippingRate(${sheetName})エラー: ${e.message}`);
    return null;
  }
}

/**
 * テスト関数: 配送料金計算のテスト
 */
function testCalculateShippingFee() {
  Logger.log('========== 配送料金計算テスト ==========');

  // テストケース1: 米国向け、2.5kg、自動選択
  const test1 = calculateShippingFee('United States', 2.5, 'auto');
  Logger.log('テスト1 (米国, 2.5kg, auto):');
  Logger.log(JSON.stringify(test1, null, 2));

  // テストケース2: カナダ向け、1kg、FedEx指定
  const test2 = calculateShippingFee('Canada', 1, 'FedEx');
  Logger.log('テスト2 (カナダ, 1kg, FedEx):');
  Logger.log(JSON.stringify(test2, null, 2));

  // テストケース3: 存在しない国
  const test3 = calculateShippingFee('Unknown Country', 1, 'auto');
  Logger.log('テスト3 (存在しない国):');
  Logger.log(JSON.stringify(test3, null, 2));

  // テストケース4: 無効な重量
  const test4 = calculateShippingFee('United States', 0, 'auto');
  Logger.log('テスト4 (無効な重量):');
  Logger.log(JSON.stringify(test4, null, 2));

  Logger.log('========================================');
}

/**
 * テスト関数: ゾーン取得のテスト
 */
function testGetZoneByCountry() {
  Logger.log('========== ゾーン取得テスト ==========');

  const countries = ['United States', 'Canada', 'United Kingdom', 'Japan', 'Unknown'];
  countries.forEach(country => {
    const zone = getZoneByCountry(country);
    Logger.log(`${country}: ${zone || '見つかりません'}`);
  });

  Logger.log('====================================');
}

/**
 * テスト関数: 各キャリアの料金取得テスト
 */
function testGetCarrierRates() {
  Logger.log('========== キャリア料金取得テスト ==========');

  const zone = 'Zone 1';
  const weight = 2.5;

  Logger.log(`ゾーン: ${zone}, 重量: ${weight}kg`);
  Logger.log(`FedEx: ${getFedExRate(weight, zone)}`);
  Logger.log(`DHL: ${getDHLRate(weight, zone)}`);
  Logger.log(`UPS: ${getUPSRate(weight, zone)}`);

  Logger.log('==========================================');
}
