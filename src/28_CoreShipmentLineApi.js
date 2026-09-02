/**
 * 28_CoreShipmentLineApi.js
 *
 * Core Schema V1 準拠: 発送明細の読み書き API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 * 日本語列名の直書き禁止。
 *
 * Public functions:
 *   getCoreShipmentLinesForFrontend(sessionId, shipmentId)
 *   getProductExportDefaultsForFrontend(sessionId, payload)
 *   upsertCoreShipmentLineForFrontend(sessionId, payload)
 *
 * Permission:
 *   read:  lead_view
 *   write: deal_edit
 */

/* global getCoreSchemaV1HeaderName, validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue,
   coreOwnProductCheckRefId_,
   corePackageMasterGenerateNextId_, corePackageMasterFindRow_ */

// ─── ID prefix / digits ──────────────────────────────────────────────────────

var CORE_SHIPMENT_LINE_ID_PREFIX           = 'SL-';
var CORE_SHIPMENT_LINE_ID_DIGITS           = 4;
var CORE_SHIPMENT_LINE_DEFAULT_ORIGIN_COUNTRY = 'JP';

// ─── Read APIs ────────────────────────────────────────────────────────────────

/**
 * 発送明細の全件を、参照先名称を結合して返す。
 *
 * 結合先:
 *   SHARED_PRODUCT_ID → PRODUCTS (englishTitle / japaneseTitle)
 *   OWN_PRODUCT_ID    → OWN_PRODUCTS (nameEn / nameJa)
 *   ITEM_ID           → ITEMS (nameEn / nameJa)
 *   HTS_CODE_ID       → HTS_CODES (htsCode / descriptionEn / descriptionJa)
 *   MATERIAL_ID       → MATERIALS (nameEn / nameJa)
 *   ORIGIN_COUNTRY    → COUNTRIES (displayName / nameJa)
 *
 * ラベル文字列は GAS で合成せず、各値を個別に返す。
 *
 * @param {string} sessionId
 * @param {string} shipmentId  絞り込む発送ID（必須）
 * @returns {Array<Object>}
 */
function getCoreShipmentLinesForFrontend(sessionId, shipmentId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (!shipmentId) throw new Error('MISSING_SHIPMENT_ID');
  shipmentId = String(shipmentId).trim();

  var ss = getSpreadsheet();

  // 発送明細
  var slData = coreCustomerFrontendReadTable(ss, 'SHIPMENT_LINES', [
    'SHIPMENT_LINE_ID', 'SHIPMENT_ID', 'ORDER_LINE_ID', 'LINE_NUMBER',
    'SHARED_PRODUCT_ID', 'OWN_PRODUCT_ID', 'ITEM_ID', 'HTS_CODE_ID',
    'MATERIAL_ID', 'ORIGIN_COUNTRY', 'QUANTITY', 'REGISTERED_AT', 'UPDATED_AT'
  ]);

  var targetRows = slData.rows.filter(function(row) {
    return coreCustomerFrontendValue(row[slData.indexes.SHIPMENT_ID]) === shipmentId;
  });

  if (targetRows.length === 0) return [];

  // 参照テーブル読み込み
  var prodData = coreCustomerFrontendReadTable(ss, 'PRODUCTS', [
    'PRODUCT_ID', 'ENGLISH_TITLE', 'JAPANESE_TITLE'
  ]);
  var prodById = {};
  prodData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[prodData.indexes.PRODUCT_ID]);
    if (id) prodById[id] = row;
  });

  var ownProdData = coreCustomerFrontendReadTable(ss, 'OWN_PRODUCTS', [
    'OWN_PRODUCT_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var ownProdById = {};
  ownProdData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[ownProdData.indexes.OWN_PRODUCT_ID]);
    if (id) ownProdById[id] = row;
  });

  var itemData = coreCustomerFrontendReadTable(ss, 'ITEMS', [
    'ITEM_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var itemById = {};
  itemData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[itemData.indexes.ITEM_ID]);
    if (id) itemById[id] = row;
  });

  var htsData = coreCustomerFrontendReadTable(ss, 'HTS_CODES', [
    'HTS_CODE_ID', 'HTS_CODE', 'DESCRIPTION_EN', 'DESCRIPTION_JA'
  ]);
  var htsById = {};
  htsData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[htsData.indexes.HTS_CODE_ID]);
    if (id) htsById[id] = row;
  });

  var matData = coreCustomerFrontendReadTable(ss, 'MATERIALS', [
    'MATERIAL_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var matById = {};
  matData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[matData.indexes.MATERIAL_ID]);
    if (id) matById[id] = row;
  });

  var countryData = coreCustomerFrontendReadTable(ss, 'COUNTRIES', [
    'COUNTRY_CODE', 'DISPLAY_NAME', 'NAME_JA'
  ]);
  var countryByCode = {};
  countryData.rows.forEach(function(row) {
    var code = coreCustomerFrontendValue(row[countryData.indexes.COUNTRY_CODE]);
    if (code) countryByCode[code] = row;
  });

  return targetRows.map(function(row) {
    var sharedProductId = coreCustomerFrontendValue(row[slData.indexes.SHARED_PRODUCT_ID]);
    var ownProductId    = coreCustomerFrontendValue(row[slData.indexes.OWN_PRODUCT_ID]);
    var itemId          = coreCustomerFrontendValue(row[slData.indexes.ITEM_ID]);
    var htsCodeId       = coreCustomerFrontendValue(row[slData.indexes.HTS_CODE_ID]);
    var materialId      = coreCustomerFrontendValue(row[slData.indexes.MATERIAL_ID]);
    var originCountry   = coreCustomerFrontendValue(row[slData.indexes.ORIGIN_COUNTRY]);

    var prodRow    = prodById[sharedProductId]    || null;
    var ownRow     = ownProdById[ownProductId]    || null;
    var itemRow    = itemById[itemId]             || null;
    var htsRow     = htsById[htsCodeId]           || null;
    var matRow     = matById[materialId]          || null;
    var countryRow = countryByCode[originCountry] || null;

    return {
      shipmentLineId:             coreCustomerFrontendValue(row[slData.indexes.SHIPMENT_LINE_ID]),
      shipmentId:                 coreCustomerFrontendValue(row[slData.indexes.SHIPMENT_ID]),
      orderLineId:                coreCustomerFrontendValue(row[slData.indexes.ORDER_LINE_ID]),
      lineNumber:                 coreCustomerFrontendValue(row[slData.indexes.LINE_NUMBER]),
      sharedProductId:            sharedProductId,
      sharedProductEnglishTitle:  prodRow ? coreCustomerFrontendValue(prodRow[prodData.indexes.ENGLISH_TITLE])    : '',
      sharedProductJapaneseTitle: prodRow ? coreCustomerFrontendValue(prodRow[prodData.indexes.JAPANESE_TITLE])   : '',
      ownProductId:               ownProductId,
      ownProductNameEn:           ownRow  ? coreCustomerFrontendValue(ownRow[ownProdData.indexes.NAME_EN])        : '',
      ownProductNameJa:           ownRow  ? coreCustomerFrontendValue(ownRow[ownProdData.indexes.NAME_JA])        : '',
      itemId:                     itemId,
      itemNameEn:                 itemRow ? coreCustomerFrontendValue(itemRow[itemData.indexes.NAME_EN])          : '',
      itemNameJa:                 itemRow ? coreCustomerFrontendValue(itemRow[itemData.indexes.NAME_JA])          : '',
      htsCodeId:                  htsCodeId,
      htsCode:                    htsRow  ? coreCustomerFrontendValue(htsRow[htsData.indexes.HTS_CODE])           : '',
      htsCodeDescriptionEn:       htsRow  ? coreCustomerFrontendValue(htsRow[htsData.indexes.DESCRIPTION_EN])    : '',
      htsCodeDescriptionJa:       htsRow  ? coreCustomerFrontendValue(htsRow[htsData.indexes.DESCRIPTION_JA])    : '',
      materialId:                 materialId,
      materialNameEn:             matRow  ? coreCustomerFrontendValue(matRow[matData.indexes.NAME_EN])            : '',
      materialNameJa:             matRow  ? coreCustomerFrontendValue(matRow[matData.indexes.NAME_JA])            : '',
      originCountry:              originCountry,
      originCountryDisplayName:   countryRow ? coreCustomerFrontendValue(countryRow[countryData.indexes.DISPLAY_NAME]) : '',
      originCountryNameJa:        countryRow ? coreCustomerFrontendValue(countryRow[countryData.indexes.NAME_JA])      : '',
      quantity:                   coreCustomerFrontendValue(row[slData.indexes.QUANTITY]),
      registeredAt:               coreCustomerFrontendValue(row[slData.indexes.REGISTERED_AT]),
      updatedAt:                  coreCustomerFrontendValue(row[slData.indexes.UPDATED_AT])
    };
  });
}

/**
 * 商品荷姿マスタから輸出情報デフォルト値を取得する。
 *
 * payload.sharedProductId または payload.ownProductId のいずれかで検索する。
 * 登録がなければ found: false を含む空オブジェクトを返す。
 * originCountry が空の場合は 'JP' を既定値として返す。
 *
 * @param {string} sessionId
 * @param {{ sharedProductId?: string, ownProductId?: string }} payload
 * @returns {{ found: boolean, itemId: string, htsCodeId: string, materialId: string, originCountry: string }}
 */
function getProductExportDefaultsForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var sharedProductId = String(payload.sharedProductId || '').trim();
  var ownProductId    = String(payload.ownProductId    || '').trim();

  if (!sharedProductId && !ownProductId) throw new Error('MISSING_PRODUCT_ID');

  var ss = getSpreadsheet();
  var pkgData = coreCustomerFrontendReadTable(ss, 'PRODUCT_PACKAGES', [
    'SHARED_PRODUCT_ID', 'OWN_PRODUCT_ID',
    'ITEM_ID', 'HTS_CODE_ID', 'MATERIAL_ID', 'ORIGIN_COUNTRY'
  ]);

  var foundRow = null;
  for (var i = 0; i < pkgData.rows.length; i++) {
    var row = pkgData.rows[i];
    if (sharedProductId) {
      var rowSharedId = coreCustomerFrontendValue(row[pkgData.indexes.SHARED_PRODUCT_ID]);
      if (rowSharedId === sharedProductId) { foundRow = row; break; }
    }
    if (ownProductId) {
      var rowOwnId = coreCustomerFrontendValue(row[pkgData.indexes.OWN_PRODUCT_ID]);
      if (rowOwnId === ownProductId) { foundRow = row; break; }
    }
  }

  if (!foundRow) {
    return {
      found:         false,
      itemId:        '',
      htsCodeId:     '',
      materialId:    '',
      originCountry: CORE_SHIPMENT_LINE_DEFAULT_ORIGIN_COUNTRY
    };
  }

  var originCountry = coreCustomerFrontendValue(foundRow[pkgData.indexes.ORIGIN_COUNTRY]);
  if (!originCountry) originCountry = CORE_SHIPMENT_LINE_DEFAULT_ORIGIN_COUNTRY;

  return {
    found:         true,
    itemId:        coreCustomerFrontendValue(foundRow[pkgData.indexes.ITEM_ID]),
    htsCodeId:     coreCustomerFrontendValue(foundRow[pkgData.indexes.HTS_CODE_ID]),
    materialId:    coreCustomerFrontendValue(foundRow[pkgData.indexes.MATERIAL_ID]),
    originCountry: originCountry
  };
}

// ─── Write API ────────────────────────────────────────────────────────────────

/**
 * 発送明細を1件追加または更新する。
 *
 * ★ GAS では LockService により発送明細書き込みと商品荷姿マスタ書き込みを一連で行うが、
 *   途中で例外が発生すると発送明細のみ登録された状態が残りうる。
 *   戻り値の failedStep で失敗箇所を識別できる。
 *   SQL 移行時は BEGIN 〜 COMMIT のトランザクションに置き換えること。
 *
 * payload:
 *   shipmentLineId    {string}   省略時は新規採番（SL-0001 形式）
 *   shipmentId        {string}   必須
 *   orderLineId       {string}
 *   lineNumber        {string|number}
 *   sharedProductId   {string}   ownProductId と同時指定不可
 *   ownProductId      {string}   sharedProductId と同時指定不可
 *   itemId            {string}
 *   htsCodeId         {string}
 *   materialId        {string}
 *   originCountry     {string}
 *   quantity          {string|number}
 *   saveToProductMaster {boolean} 省略時 false。true の場合、商品荷姿マスタにも保存する
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, shipmentLineId: string, savedToProductMaster: boolean, failedStep: string|null }}
 */
function upsertCoreShipmentLineForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now            = new Date();
  var shipmentLineId = String(payload.shipmentLineId || '').trim();
  var isNew          = !shipmentLineId;
  var saveToProductMaster = payload.saveToProductMaster === true;

  var resultShipmentLineId       = null;
  var resultSavedToProductMaster = false;
  var resultFailedStep           = null;

  withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();

      // ─── 1. 入力値の事前検証（1件でも不正なら書き込まずエラーを返す）──────

      var shipmentId = String(payload.shipmentId || '').trim();
      if (!shipmentId) throw new Error('MISSING_SHIPMENT_ID');

      var sharedProductId = String(payload.sharedProductId || '').trim();
      var ownProductId    = String(payload.ownProductId    || '').trim();

      if (sharedProductId && ownProductId) {
        throw new Error('BOTH_PRODUCT_IDS_SET: sharedProductId と ownProductId を同時に指定できません。');
      }

      if (!coreOwnProductCheckRefId_(ss, 'SHIPMENTS', 'SHIPMENT_ID', shipmentId)) {
        throw new Error('SHIPMENT_NOT_FOUND: ' + shipmentId);
      }

      var orderLineId = String(payload.orderLineId || '').trim();
      if (orderLineId) {
        if (!coreOwnProductCheckRefId_(ss, 'ORDER_LINES', 'ORDER_LINE_ID', orderLineId)) {
          throw new Error('ORDER_LINE_NOT_FOUND: ' + orderLineId);
        }
      }

      if (sharedProductId) {
        if (!coreOwnProductCheckRefId_(ss, 'PRODUCTS', 'PRODUCT_ID', sharedProductId)) {
          throw new Error('SHARED_PRODUCT_NOT_FOUND: ' + sharedProductId);
        }
      }

      if (ownProductId) {
        if (!coreOwnProductCheckRefId_(ss, 'OWN_PRODUCTS', 'OWN_PRODUCT_ID', ownProductId)) {
          throw new Error('OWN_PRODUCT_NOT_FOUND: ' + ownProductId);
        }
      }

      var itemId = String(payload.itemId || '').trim();
      if (itemId) {
        if (!coreOwnProductCheckRefId_(ss, 'ITEMS', 'ITEM_ID', itemId)) {
          throw new Error('ITEM_NOT_FOUND: ' + itemId);
        }
      }

      var htsCodeId = String(payload.htsCodeId || '').trim();
      if (htsCodeId) {
        if (!coreOwnProductCheckRefId_(ss, 'HTS_CODES', 'HTS_CODE_ID', htsCodeId)) {
          throw new Error('HTS_CODE_NOT_FOUND: ' + htsCodeId);
        }
      }

      var materialId = String(payload.materialId || '').trim();
      if (materialId) {
        if (!coreOwnProductCheckRefId_(ss, 'MATERIALS', 'MATERIAL_ID', materialId)) {
          throw new Error('MATERIAL_NOT_FOUND: ' + materialId);
        }
      }

      var originCountry = String(payload.originCountry || '').trim();
      if (originCountry) {
        if (!coreOwnProductCheckRefId_(ss, 'COUNTRIES', 'COUNTRY_CODE', originCountry)) {
          throw new Error('COUNTRY_NOT_FOUND: ' + originCountry);
        }
      }

      // ─── 2. 発送明細に書く ─────────────────────────────────────────────────

      var slResult = validateCoreSchemaV1TableForWrite(ss, 'SHIPMENT_LINES');
      var slSheet  = slResult.sheet;
      var slHi     = slResult.headerIndexes;

      var slTargetRow;

      function setSlCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('SHIPMENT_LINES', fieldKey);
        var colIdx = slHi[header];
        if (colIdx) slSheet.getRange(slTargetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        slTargetRow = corePackageMasterFindRow_(slSheet, slHi, 'SHIPMENT_LINES', 'SHIPMENT_LINE_ID', shipmentLineId);
        if (slTargetRow < 0) throw new Error('SHIPMENT_LINE_NOT_FOUND: ' + shipmentLineId);
      } else {
        shipmentLineId = corePackageMasterGenerateNextId_(slSheet, slHi, 'SHIPMENT_LINES', 'SHIPMENT_LINE_ID', CORE_SHIPMENT_LINE_ID_PREFIX, CORE_SHIPMENT_LINE_ID_DIGITS);
        slTargetRow = slSheet.getLastRow() + 1;
        var slMaxCols = slSheet.getLastColumn();
        slSheet.appendRow(new Array(slMaxCols).fill(''));
        setSlCell('SHIPMENT_LINE_ID', shipmentLineId);
        setSlCell('REGISTERED_AT',   now);
      }

      setSlCell('SHIPMENT_ID', shipmentId);
      if (payload.orderLineId    !== undefined) setSlCell('ORDER_LINE_ID',     orderLineId);
      if (payload.lineNumber     !== undefined) setSlCell('LINE_NUMBER',        payload.lineNumber);
      if (payload.sharedProductId !== undefined) setSlCell('SHARED_PRODUCT_ID', sharedProductId);
      if (payload.ownProductId    !== undefined) setSlCell('OWN_PRODUCT_ID',    ownProductId);
      if (payload.itemId         !== undefined) setSlCell('ITEM_ID',           itemId);
      if (payload.htsCodeId      !== undefined) setSlCell('HTS_CODE_ID',       htsCodeId);
      if (payload.materialId     !== undefined) setSlCell('MATERIAL_ID',       materialId);
      if (payload.originCountry  !== undefined) setSlCell('ORIGIN_COUNTRY',    originCountry);
      if (payload.quantity       !== undefined) setSlCell('QUANTITY',          payload.quantity);

      setSlCell('UPDATED_AT', now);
      resultShipmentLineId = shipmentLineId;

      // ─── 3. 商品荷姿マスタに保存（saveToProductMaster が true の場合のみ）──

      if (!saveToProductMaster || (!sharedProductId && !ownProductId)) {
        resultSavedToProductMaster = false;
        return;
      }

      try {
        var pkgResult = validateCoreSchemaV1TableForWrite(ss, 'PRODUCT_PACKAGES');
        var pkgSheet  = pkgResult.sheet;
        var pkgHi     = pkgResult.headerIndexes;

        var pkgTargetRow = coreShipmentLineFindPkgRowByProductId_(pkgSheet, pkgHi, sharedProductId, ownProductId);
        var isNewPkg     = pkgTargetRow < 0;

        function setPkgCell(fieldKey, value) {
          var header = getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', fieldKey);
          var colIdx = pkgHi[header];
          if (colIdx) pkgSheet.getRange(pkgTargetRow, colIdx).setValue(value);
        }

        if (isNewPkg) {
          var newPkgId  = corePackageMasterGenerateNextId_(pkgSheet, pkgHi, 'PRODUCT_PACKAGES', 'PRODUCT_PACKAGE_ID', 'PPK-', 4);
          pkgTargetRow  = pkgSheet.getLastRow() + 1;
          var pkgMaxCols = pkgSheet.getLastColumn();
          pkgSheet.appendRow(new Array(pkgMaxCols).fill(''));
          setPkgCell('PRODUCT_PACKAGE_ID', newPkgId);
          setPkgCell('REGISTERED_AT',      now);
          if (sharedProductId) setPkgCell('SHARED_PRODUCT_ID', sharedProductId);
          if (ownProductId)    setPkgCell('OWN_PRODUCT_ID',    ownProductId);
        }

        if (payload.itemId        !== undefined) setPkgCell('ITEM_ID',        itemId);
        if (payload.htsCodeId     !== undefined) setPkgCell('HTS_CODE_ID',    htsCodeId);
        if (payload.materialId    !== undefined) setPkgCell('MATERIAL_ID',    materialId);
        if (payload.originCountry !== undefined) setPkgCell('ORIGIN_COUNTRY', originCountry);

        setPkgCell('UPDATED_AT', now);
        resultSavedToProductMaster = true;
      } catch (pkgErr) {
        // 発送明細への書き込みは完了済み。商品荷姿マスタへの保存で失敗した。
        resultFailedStep = 'PRODUCT_PACKAGE';
      }
    }
  );

  return {
    success:              true,
    shipmentLineId:       resultShipmentLineId,
    savedToProductMaster: resultSavedToProductMaster,
    failedStep:           resultFailedStep
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * 商品荷姿マスタから SHARED_PRODUCT_ID または OWN_PRODUCT_ID で行を検索する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} pkgSheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} sharedProductId  空文字の場合は無視
 * @param {string} ownProductId     空文字の場合は無視
 * @returns {number}  1-indexed 行番号。見つからなければ -1
 */
function coreShipmentLineFindPkgRowByProductId_(pkgSheet, headerIndexes, sharedProductId, ownProductId) {
  var lastRow = pkgSheet.getLastRow();
  if (lastRow < 2) return -1;

  var sharedColName = getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'SHARED_PRODUCT_ID');
  var ownColName    = getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', 'OWN_PRODUCT_ID');
  var sharedColIdx  = headerIndexes[sharedColName] || 0;
  var ownColIdx     = headerIndexes[ownColName]    || 0;

  if (!sharedColIdx && !ownColIdx) return -1;

  var dataCount    = lastRow - 1;
  var sharedValues = sharedColIdx ? pkgSheet.getRange(2, sharedColIdx, dataCount, 1).getValues() : null;
  var ownValues    = ownColIdx    ? pkgSheet.getRange(2, ownColIdx,    dataCount, 1).getValues() : null;

  for (var i = 0; i < dataCount; i++) {
    if (sharedProductId && sharedValues) {
      if (String(sharedValues[i][0] || '').trim() === sharedProductId) return i + 2;
    }
    if (ownProductId && ownValues) {
      if (String(ownValues[i][0] || '').trim() === ownProductId) return i + 2;
    }
  }
  return -1;
}
