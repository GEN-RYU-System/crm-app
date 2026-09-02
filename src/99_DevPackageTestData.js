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
   _sfcBuildZonesMap, _sfcBuildRatesMap, _sfeProcess_ */

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
 *   { success, boxCount, carriersCount, skipped, reason? }
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

  return JSON.stringify({
    success:       carriersCount > 0,
    boxCount:      built.boxes.length,
    carriersCount: carriersCount,
    successCount:  successCount,
    skipped:       built.skipped
  });
}
