/**
 * 99_DevPackageTestData.js
 *
 * 目的: 送料計算テスト用の荷姿・商品荷姿データ登録を補助する DEV 専用関数。
 *
 * 【重要制約】
 *   - PROD 環境での実行を禁止
 *   - 読み取り専用: devFindProductByTitle, devTestShippingFeeForLines
 *   - セッション取得: devCreateDealEditSession
 *     （既存 upsert API を clasp run で呼ぶためのセッション発行専用）
 *
 * 使い方:
 *   1. clasp run devFindProductByTitle --params '["キミを待つ島"]'
 *   2. clasp run devCreateDealEditSession  → sessionId を取得
 *   3. 取得した sessionId で既存 upsert API を呼ぶ:
 *      clasp run upsertCoreSizeForFrontend --params '["SESSION_ID", {...}]'
 *   4. clasp run devTestShippingFeeForLines --params '[{"lines":[...],"countryCode":"US"}]'
 */

/* global getEnvironment, getSpreadsheet, getCoreSchemaV1HeaderName,
   getCoreSchemaV1Sheet, getCoreSchemaV1Table, getCoreSchemaV1Value,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue,
   createSession, buildBoxesFromLines_, _sfcLoadCarriers,
   _sfcBuildZonesMap, _sfcBuildRatesMap, _sfeProcess_,
   getCoreSchemaV1TableName, SFC_WEIGHT_STEP_BOUNDARY */

// ─── 1. 商品検索（読み取り専用）─────────────────────────────────────────────

/**
 * 商品名（英語 or 日本語）で PRODUCTS シートと QUOTE_LINES シートを検索し、
 * 一致する商品の productId を返す。
 *
 * 書き込み一切なし。
 *
 * @param {string} title  検索する商品名（部分一致）
 * @returns {string} JSON: { productsHits, quoteLinesHits }
 */
function devFindProductByTitle(title) {
  if (getEnvironment() !== 'development') {
    throw new Error('devFindProductByTitle は development 環境でのみ実行できます。');
  }
  if (!title) throw new Error('title を指定してください。');

  var ss = getSpreadsheet();

  // ── PRODUCTS シートを検索 ──
  var prodData = coreCustomerFrontendReadTable(ss, 'PRODUCTS', [
    'PRODUCT_ID', 'ENGLISH_TITLE', 'JAPANESE_TITLE'
  ]);
  var productsHits = prodData.rows
    .filter(function(r) {
      var en = coreCustomerFrontendValue(r[prodData.indexes.ENGLISH_TITLE])  || '';
      var ja = coreCustomerFrontendValue(r[prodData.indexes.JAPANESE_TITLE]) || '';
      return en.indexOf(title) !== -1 || ja.indexOf(title) !== -1;
    })
    .map(function(r) {
      return {
        productId:    coreCustomerFrontendValue(r[prodData.indexes.PRODUCT_ID]),
        englishTitle: coreCustomerFrontendValue(r[prodData.indexes.ENGLISH_TITLE]),
        japaneseTitle:coreCustomerFrontendValue(r[prodData.indexes.JAPANESE_TITLE])
      };
    });

  // ── QUOTE_LINES シートを検索（PRODUCT_NAME 列）──
  var qlData = coreCustomerFrontendReadTable(ss, 'QUOTE_LINES', [
    'QUOTE_LINE_ID', 'QUOTE_ID', 'PRODUCT_ID', 'PRODUCT_NAME'
  ]);
  var seenIds = {};
  var quoteLinesHits = [];
  qlData.rows.forEach(function(r) {
    var name = coreCustomerFrontendValue(r[qlData.indexes.PRODUCT_NAME]) || '';
    if (name.indexOf(title) !== -1) {
      var pid = coreCustomerFrontendValue(r[qlData.indexes.PRODUCT_ID]);
      if (!seenIds[pid]) {
        seenIds[pid] = true;
        quoteLinesHits.push({
          quoteId:     coreCustomerFrontendValue(r[qlData.indexes.QUOTE_ID]),
          quoteLineId: coreCustomerFrontendValue(r[qlData.indexes.QUOTE_LINE_ID]),
          productId:   pid,
          productName: name
        });
      }
    }
  });

  return JSON.stringify({
    searchTitle:    title,
    productsHits:   productsHits,
    quoteLinesHits: quoteLinesHits
  });
}

// ─── 2. セッション取得（upsert API 呼び出し用）───────────────────────────────

/**
 * deal_edit ロールを持つアクティブなスタッフのセッションを発行する。
 * clasp run 経由で既存 upsert API を呼ぶためのセッション取得専用。
 *
 * 書き込み: LOGIN_SESSIONS への1行追加のみ。
 *
 * @returns {string} JSON: { success, sessionId, staffId }
 */
function devCreateDealEditSession() {
  if (getEnvironment() !== 'development') {
    throw new Error('devCreateDealEditSession は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var staffTable  = getCoreSchemaV1Table('STAFF');
  var staffSheet  = getCoreSchemaV1Sheet(ss, 'STAFF');
  var staffLastCol = staffSheet.getLastColumn();
  var staffHeaders = staffSheet
    .getRange(staffTable.headerRowNumber, 1, 1, staffLastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  var staffIdCol     = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID'));
  var staffStatusCol = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STATUS'));
  var staffRoleCol   = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'ROLE'));
  var staffLastRow   = staffSheet.getLastRow();

  if (staffLastRow < staffTable.headerRowNumber + 1) {
    return JSON.stringify({ success: false, reason: 'NO_STAFF_DATA' });
  }

  var staffRows = staffSheet
    .getRange(staffTable.headerRowNumber + 1, 1, staffLastRow - staffTable.headerRowNumber, staffLastCol)
    .getValues();

  var statusActive  = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  var dealEditRoles = [
    getCoreSchemaV1Value('STAFF', 'ROLE', 'OWNER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'LEADER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'SALES')
  ];

  var staffId = null;
  for (var i = 0; i < staffRows.length; i++) {
    var status = String(staffRows[i][staffStatusCol] || '').trim();
    var role   = String(staffRows[i][staffRoleCol]   || '').trim();
    if (status === statusActive && dealEditRoles.indexOf(role) !== -1) {
      var sid = String(staffRows[i][staffIdCol] || '').trim();
      if (sid) { staffId = sid; break; }
    }
  }

  if (!staffId) {
    return JSON.stringify({ success: false, reason: 'NO_ACTIVE_STAFF_WITH_DEAL_EDIT_ROLE' });
  }

  var sessionId = createSession(staffId);
  return JSON.stringify({ success: true, sessionId: sessionId, staffId: staffId });
}

// ─── 3. 送料計算検証（読み取り専用）─────────────────────────────────────────

/**
 * 明細配列から箱を組み立て、送料算出を試みる（保存なし）。
 *
 * @param {Object} payload
 *   payload.lines         {Array<{productId, condition, quantity}>}
 *   payload.countryCode   {string} ISO2 国コード（例: 'US'）
 *   payload.postalCode    {string} 郵便番号（任意）
 * @returns {string} JSON:
 *   { success, boxCount, carriersCount, successCount, carrierSummary, skipped, reason? }
 *   ★ 送料金額は含まない
 */
function devTestShippingFeeForLines(payload) {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestShippingFeeForLines は development 環境でのみ実行できます。');
  }
  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var lines       = Array.isArray(payload.lines) ? payload.lines : [];
  var countryCode = String(payload.countryCode || '').trim().toUpperCase();
  var postalCode  = String(payload.postalCode  || '').trim();

  if (!countryCode) return JSON.stringify({ success: false, reason: 'MISSING_COUNTRY_CODE' });

  var ss = getSpreadsheet();

  // 箱を組み立て
  var built = buildBoxesFromLines_(lines, ss);

  if (built.boxes.length === 0) {
    return JSON.stringify({
      success:  false,
      reason:   'NO_BOXES',
      boxCount: 0,
      skipped:  built.skipped
    });
  }

  // 送料算出（_sfeProcess_ を直接呼ぶ: 保存なし）
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  var results = _sfeProcess_(ss, carriers, zonesMap, ratesMap, {
    countryCode: countryCode,
    postalCode:  postalCode,
    boxes:       built.boxes,
    linkType:    'QUOTE'
  });

  var carriersCount = Array.isArray(results) ? results.length : 0;
  var successCount  = Array.isArray(results)
    ? results.filter(function(r) { return !r.error; }).length
    : 0;

  // キャリアごとの成否と理由コード（金額は含まない）
  var carrierSummary = Array.isArray(results)
    ? results.map(function(r) {
        return {
          carrierId:   r.carrierId,
          carrierName: r.carrierName,
          ok:          !r.error,
          error:       r.error || null
        };
      })
    : [];

  return JSON.stringify({
    success:        carriersCount > 0 && successCount > 0,
    boxCount:       built.boxes.length,
    carriersCount:  carriersCount,
    successCount:   successCount,
    carrierSummary: carrierSummary,
    skipped:        built.skipped
  });
}

// ─── 4. 荷姿・サイズ・重量の数値確認（読み取り専用）────────────────────────────

/**
 * 指定荷姿IDのサイズ・重量数値と、指定商品荷姿IDの各荷姿IDを返す。
 * WEIGHT_EXCEEDS_MAX 原因調査用。書き込み一切なし。
 *
 * @param {string} packageId        荷姿ID（例: 'PKG-0001'）
 * @param {string} productPackageId 商品荷姿ID（例: 'PPK-0005'）
 * @returns {string} JSON: { package, size, weight, volumetricWeight_kg, productPackage }
 */
function devInspectPackageDimensions(packageId, productPackageId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devInspectPackageDimensions は development 環境でのみ実行できます。');
  }
  if (!packageId) throw new Error('packageId を指定してください。');

  var ss = getSpreadsheet();

  // ── PACKAGES シートから packageId を検索 ──
  var pkgSheetName = getCoreSchemaV1TableName('PACKAGES');
  var pkgSheet = ss.getSheetByName(pkgSheetName);
  if (!pkgSheet) throw new Error('PACKAGES シートが見つかりません: ' + pkgSheetName);

  var pkgData = pkgSheet.getDataRange().getValues();
  var pkgHeaders = pkgData[0].map(function(h) { return String(h).trim(); });

  var pkgIdCol      = pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'PACKAGE_ID'));
  var pkgNameCol    = pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'NAME'));
  var pkgUnitCol    = pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'UNIT'));
  var pkgQtyCol     = pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'QUANTITY'));
  var pkgSizeIdCol  = pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'SIZE_ID'));
  var pkgWeightIdCol= pkgHeaders.indexOf(getCoreSchemaV1HeaderName('PACKAGES', 'WEIGHT_ID'));

  var pkg = null;
  for (var i = 1; i < pkgData.length; i++) {
    if (String(pkgData[i][pkgIdCol]).trim() === packageId) {
      pkg = {
        packageId: String(pkgData[i][pkgIdCol]).trim(),
        name:      String(pkgData[i][pkgNameCol]).trim(),
        unit:      String(pkgData[i][pkgUnitCol]).trim(),
        quantity:  pkgData[i][pkgQtyCol],
        sizeId:    String(pkgData[i][pkgSizeIdCol]).trim(),
        weightId:  String(pkgData[i][pkgWeightIdCol]).trim()
      };
      break;
    }
  }
  if (!pkg) return JSON.stringify({ error: 'PACKAGE_NOT_FOUND', packageId: packageId });

  // ── SIZES シートから size を検索 ──
  var sizeSheetName = getCoreSchemaV1TableName('SIZES');
  var sizeSheet = ss.getSheetByName(sizeSheetName);
  if (!sizeSheet) throw new Error('SIZES シートが見つかりません: ' + sizeSheetName);

  var sizeData = sizeSheet.getDataRange().getValues();
  var sizeHeaders = sizeData[0].map(function(h) { return String(h).trim(); });

  var sizeIdCol  = sizeHeaders.indexOf(getCoreSchemaV1HeaderName('SIZES', 'SIZE_ID'));
  var sizeNameCol= sizeHeaders.indexOf(getCoreSchemaV1HeaderName('SIZES', 'NAME'));
  var lenCol     = sizeHeaders.indexOf(getCoreSchemaV1HeaderName('SIZES', 'LENGTH'));
  var widCol     = sizeHeaders.indexOf(getCoreSchemaV1HeaderName('SIZES', 'WIDTH'));
  var hgtCol     = sizeHeaders.indexOf(getCoreSchemaV1HeaderName('SIZES', 'HEIGHT'));

  var size = null;
  for (var j = 1; j < sizeData.length; j++) {
    if (String(sizeData[j][sizeIdCol]).trim() === pkg.sizeId) {
      size = {
        sizeId: String(sizeData[j][sizeIdCol]).trim(),
        name:   String(sizeData[j][sizeNameCol]).trim(),
        length: sizeData[j][lenCol],
        width:  sizeData[j][widCol],
        height: sizeData[j][hgtCol]
      };
      break;
    }
  }

  // ── WEIGHTS シートから weight を検索 ──
  var wgtSheetName = getCoreSchemaV1TableName('WEIGHTS');
  var wgtSheet = ss.getSheetByName(wgtSheetName);
  if (!wgtSheet) throw new Error('WEIGHTS シートが見つかりません: ' + wgtSheetName);

  var wgtData = wgtSheet.getDataRange().getValues();
  var wgtHeaders = wgtData[0].map(function(h) { return String(h).trim(); });

  var wgtIdCol    = wgtHeaders.indexOf(getCoreSchemaV1HeaderName('WEIGHTS', 'WEIGHT_ID'));
  var wgtNameCol  = wgtHeaders.indexOf(getCoreSchemaV1HeaderName('WEIGHTS', 'NAME'));
  var wgtValCol   = wgtHeaders.indexOf(getCoreSchemaV1HeaderName('WEIGHTS', 'WEIGHT'));

  var weight = null;
  for (var k = 1; k < wgtData.length; k++) {
    if (String(wgtData[k][wgtIdCol]).trim() === pkg.weightId) {
      weight = {
        weightId: String(wgtData[k][wgtIdCol]).trim(),
        name:     String(wgtData[k][wgtNameCol]).trim(),
        weight_kg: wgtData[k][wgtValCol]
      };
      break;
    }
  }

  // ── 容積重量計算（cm → m³ 換算: ÷ 5000, 単位 cm³ → kg） ──
  var volumetricWeight_kg = null;
  var exceedsMax68kg = null;
  if (size) {
    volumetricWeight_kg = (Number(size.length) * Number(size.width) * Number(size.height)) / 5000;
    exceedsMax68kg = volumetricWeight_kg > 68;
  }

  // ── PRODUCT_PACKAGES シートから productPackageId を検索 ──
  var ppkResult = null;
  if (productPackageId) {
    var ppkSheetName = getCoreSchemaV1TableName('PRODUCT_PACKAGES');
    var ppkSheet = ss.getSheetByName(ppkSheetName);
    if (ppkSheet) {
      var ppkData = ppkSheet.getDataRange().getValues();
      var ppkHeaders = ppkData[0].map(function(h) { return String(h).trim(); });

      var ppkIdCol   = ppkHeaders.indexOf(getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'PRODUCT_PACKAGE_ID'));
      var ppkCaseCol = ppkHeaders.indexOf(getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'CASE_PACKAGE_ID'));
      var ppkBoxCol  = ppkHeaders.indexOf(getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'BOX_PACKAGE_ID'));
      var ppkPackCol = ppkHeaders.indexOf(getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'PACK_PACKAGE_ID'));
      var ppkProdCol = ppkHeaders.indexOf(getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'OWN_PRODUCT_ID'));

      for (var m = 1; m < ppkData.length; m++) {
        if (String(ppkData[m][ppkIdCol]).trim() === productPackageId) {
          ppkResult = {
            productPackageId: String(ppkData[m][ppkIdCol]).trim(),
            ownProductId:     String(ppkData[m][ppkProdCol]).trim(),
            casePackageId:    String(ppkData[m][ppkCaseCol]).trim(),
            boxPackageId:     String(ppkData[m][ppkBoxCol]).trim(),
            packPackageId:    String(ppkData[m][ppkPackCol]).trim()
          };
          break;
        }
      }
    }
  }

  return JSON.stringify({
    package:              pkg,
    size:                 size,
    weight:               weight,
    volumetricWeight_kg:  volumetricWeight_kg,
    exceedsMax68kg:       exceedsMax68kg,
    productPackage:       ppkResult
  });
}

// ─── 5. 送料ゾーン・重量帯 診断（読み取り専用）──────────────────────────────────

/**
 * 指定国コードについて全キャリアのゾーン照合・課金重量計算・重量帯マッチングを返す。
 * RATE_NOT_FOUND / ZONE_NOT_FOUND の原因特定用。
 * 金額（rate）は返さない。
 *
 * @param {string} countryCode  ISO2 国コード（例: 'US'）
 * @param {number} length_cm    箱の長さ(cm)
 * @param {number} width_cm     箱の幅(cm)
 * @param {number} height_cm    箱の高さ(cm)
 * @param {number} actualWeight_kg  実重量(kg)
 * @returns {string} JSON: { carriers: [{carrierId, carrierName, maxWeight, divisor,
 *   stepSmall, stepLarge, zone, volumetricWeight_kg, chargeableWeight_kg,
 *   exceedsMaxWeight, rateBands: [{minWeight,maxWeight}], matchedBand, error}] }
 */
function devInspectShippingRateAvailability(countryCode, length_cm, width_cm, height_cm, actualWeight_kg) {
  if (getEnvironment() !== 'development') {
    throw new Error('devInspectShippingRateAvailability は development 環境でのみ実行できます。');
  }
  if (!countryCode) throw new Error('countryCode を指定してください。');

  var ss       = getSpreadsheet();
  var carriers = _sfcLoadCarriers(ss);
  var zonesMap = _sfcBuildZonesMap(ss);
  var ratesMap = _sfcBuildRatesMap(ss);

  var L = Number(length_cm);
  var W = Number(width_cm);
  var H = Number(height_cm);
  var actualW = Number(actualWeight_kg);

  var country = String(countryCode).trim().toUpperCase();

  var result = carriers.map(function(carrier) {
    var zone = zonesMap[carrier.id + '|' + country] || null;

    if (!zone) {
      return {
        carrierId:   carrier.id,
        carrierName: carrier.name,
        maxWeight:   carrier.maxWeight,
        divisor:     carrier.divisor,
        stepSmall:   carrier.stepSmall,
        stepLarge:   carrier.stepLarge,
        zone:        null,
        error:       'ZONE_NOT_FOUND'
      };
    }

    // 課金重量計算（_sfcCalculateBox と同じロジック）
    var ceilL = Math.ceil(L);
    var ceilW = Math.ceil(W);
    var ceilH = Math.ceil(H);
    var volW  = (ceilL * ceilW * ceilH) / carrier.divisor;
    var rawChargeable = Math.max(actualW, volW);
    var step  = rawChargeable <= SFC_WEIGHT_STEP_BOUNDARY ? carrier.stepSmall : carrier.stepLarge;
    var chargeableW = Math.ceil(rawChargeable / step) * step;

    var exceedsMax = chargeableW > carrier.maxWeight;

    // 重量帯一覧（金額なし）
    var rateKey = carrier.id + '|' + zone;
    var bands   = (ratesMap[rateKey] || []).map(function(b) {
      return { minWeight: b.minWeight, maxWeight: b.maxWeight };
    });

    // マッチング判定（minWeight < chargeableWeight <= maxWeight）
    var matchedBand = null;
    var matched = bands.filter(function(b) {
      return b.minWeight < chargeableW && chargeableW <= b.maxWeight;
    });
    if (matched.length > 0) matchedBand = matched[0];

    var error = null;
    if (exceedsMax)        error = 'WEIGHT_EXCEEDS_MAX';
    else if (!matchedBand) error = 'RATE_NOT_FOUND';

    return {
      carrierId:            carrier.id,
      carrierName:          carrier.name,
      maxWeight:            carrier.maxWeight,
      divisor:              carrier.divisor,
      stepSmall:            carrier.stepSmall,
      stepLarge:            carrier.stepLarge,
      zone:                 zone,
      volumetricWeight_kg:  Math.round(volW * 1000) / 1000,
      chargeableWeight_kg:  chargeableW,
      exceedsMaxWeight:     exceedsMax,
      rateBandCount:        bands.length,
      rateBands:            bands,
      matchedBand:          matchedBand,
      error:                error
    };
  });

  return JSON.stringify({
    countryCode:     country,
    boxDimensions:   { length_cm: L, width_cm: W, height_cm: H },
    actualWeight_kg: actualW,
    carriers:        result
  });
}
