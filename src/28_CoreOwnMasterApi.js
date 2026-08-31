/**
 * 28_CoreOwnMasterApi.js
 *
 * Core Schema V1 準拠: 自社大分類・自社作品・自社メーカーマスタの読み書き API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 * 日本語列名の直書き禁止。
 *
 * Public functions:
 *   getCoreOwnCategoriesForFrontend(sessionId)
 *   getCoreOwnWorksForFrontend(sessionId)
 *   getCoreOwnManufacturersForFrontend(sessionId)
 *   upsertCoreOwnCategoryForFrontend(sessionId, payload)
 *   upsertCoreOwnWorkForFrontend(sessionId, payload)
 *   upsertCoreOwnManufacturerForFrontend(sessionId, payload)
 *   getCoreOwnProductsForFrontend(sessionId)
 *   upsertCoreOwnProductWithPackageForFrontend(sessionId, payload)
 *
 * Permission:
 *   read:  lead_view
 *   write: deal_edit
 */

/* global getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName,
   validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue,
   corePackageMasterGenerateNextId_, corePackageMasterFindRow_ */

// ─── ID prefix / digits ──────────────────────────────────────────────────────

var CORE_OWN_CATEGORY_ID_PREFIX     = 'OWN-CAT-';
var CORE_OWN_WORK_ID_PREFIX         = 'OWN-WRK-';
var CORE_OWN_MANUFACTURER_ID_PREFIX = 'OWN-MFR-';
var CORE_OWN_PRODUCT_ID_PREFIX      = 'OWN-';
var CORE_OWN_MASTER_ID_DIGITS       = 4;

// ─── Read APIs ────────────────────────────────────────────────────────────────

/**
 * 自社大分類マスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{categoryId:string, nameEn:string, nameJa:string, isActive:string}>}
 */
function getCoreOwnCategoriesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'OWN_CATEGORIES', [
    'OWN_CATEGORY_ID', 'NAME_EN', 'NAME_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      categoryId: coreCustomerFrontendValue(row[data.indexes.OWN_CATEGORY_ID]),
      nameEn:     coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      nameJa:     coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      isActive:   coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.categoryId !== ''; });
}

/**
 * 自社作品マスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{workId:string, nameEn:string, nameJa:string, isActive:string}>}
 */
function getCoreOwnWorksForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'OWN_WORKS', [
    'OWN_WORK_ID', 'NAME_EN', 'NAME_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      workId:   coreCustomerFrontendValue(row[data.indexes.OWN_WORK_ID]),
      nameEn:   coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      nameJa:   coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      isActive: coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.workId !== ''; });
}

/**
 * 自社メーカーマスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{manufacturerId:string, nameEn:string, nameJa:string, isActive:string}>}
 */
function getCoreOwnManufacturersForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'OWN_MANUFACTURERS', [
    'OWN_MANUFACTURER_ID', 'NAME_EN', 'NAME_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      manufacturerId: coreCustomerFrontendValue(row[data.indexes.OWN_MANUFACTURER_ID]),
      nameEn:         coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      nameJa:         coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      isActive:       coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.manufacturerId !== ''; });
}

// ─── Write APIs ───────────────────────────────────────────────────────────────

/**
 * 自社大分類を1件追加または更新する。
 *
 * payload:
 *   categoryId  {string}  省略時は新規採番（OWN-CAT-0001 形式）
 *   nameEn      {string}
 *   nameJa      {string}
 *   isActive    {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, categoryId: string }}
 */
function upsertCoreOwnCategoryForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now        = new Date();
  var categoryId = String(payload.categoryId || '').trim();
  var isNew      = !categoryId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'OWN_CATEGORIES');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('OWN_CATEGORIES', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreOwnMasterFindRow_(sheet, hi, 'OWN_CATEGORIES', 'OWN_CATEGORY_ID', categoryId);
        if (targetRow < 0) throw new Error('OWN_CATEGORY_NOT_FOUND: ' + categoryId);
      } else {
        categoryId = coreOwnMasterGenerateNextId_(sheet, hi, 'OWN_CATEGORIES', 'OWN_CATEGORY_ID', CORE_OWN_CATEGORY_ID_PREFIX, CORE_OWN_MASTER_ID_DIGITS);
        targetRow  = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('OWN_CATEGORY_ID', categoryId);
        setCell('REGISTERED_AT',   now);
      }

      if (payload.nameEn   !== undefined) setCell('NAME_EN', String(payload.nameEn  || '').trim());
      if (payload.nameJa   !== undefined) setCell('NAME_JA', String(payload.nameJa  || '').trim());
      if (payload.isActive !== undefined) setCell('ACTIVE',  coreOwnMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return categoryId;
    }
  );

  return { success: true, categoryId: resultId };
}

/**
 * 自社作品を1件追加または更新する。
 *
 * payload:
 *   workId    {string}  省略時は新規採番（OWN-WRK-0001 形式）
 *   nameEn    {string}
 *   nameJa    {string}
 *   isActive  {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, workId: string }}
 */
function upsertCoreOwnWorkForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now    = new Date();
  var workId = String(payload.workId || '').trim();
  var isNew  = !workId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'OWN_WORKS');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('OWN_WORKS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreOwnMasterFindRow_(sheet, hi, 'OWN_WORKS', 'OWN_WORK_ID', workId);
        if (targetRow < 0) throw new Error('OWN_WORK_NOT_FOUND: ' + workId);
      } else {
        workId    = coreOwnMasterGenerateNextId_(sheet, hi, 'OWN_WORKS', 'OWN_WORK_ID', CORE_OWN_WORK_ID_PREFIX, CORE_OWN_MASTER_ID_DIGITS);
        targetRow = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('OWN_WORK_ID',   workId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.nameEn   !== undefined) setCell('NAME_EN', String(payload.nameEn  || '').trim());
      if (payload.nameJa   !== undefined) setCell('NAME_JA', String(payload.nameJa  || '').trim());
      if (payload.isActive !== undefined) setCell('ACTIVE',  coreOwnMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return workId;
    }
  );

  return { success: true, workId: resultId };
}

/**
 * 自社メーカーを1件追加または更新する。
 *
 * payload:
 *   manufacturerId  {string}  省略時は新規採番（OWN-MFR-0001 形式）
 *   nameEn          {string}
 *   nameJa          {string}
 *   isActive        {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, manufacturerId: string }}
 */
function upsertCoreOwnManufacturerForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now            = new Date();
  var manufacturerId = String(payload.manufacturerId || '').trim();
  var isNew          = !manufacturerId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'OWN_MANUFACTURERS');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('OWN_MANUFACTURERS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreOwnMasterFindRow_(sheet, hi, 'OWN_MANUFACTURERS', 'OWN_MANUFACTURER_ID', manufacturerId);
        if (targetRow < 0) throw new Error('OWN_MANUFACTURER_NOT_FOUND: ' + manufacturerId);
      } else {
        manufacturerId = coreOwnMasterGenerateNextId_(sheet, hi, 'OWN_MANUFACTURERS', 'OWN_MANUFACTURER_ID', CORE_OWN_MANUFACTURER_ID_PREFIX, CORE_OWN_MASTER_ID_DIGITS);
        targetRow      = sheet.getLastRow() + 1;
        var maxCols    = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('OWN_MANUFACTURER_ID', manufacturerId);
        setCell('REGISTERED_AT',       now);
      }

      if (payload.nameEn   !== undefined) setCell('NAME_EN', String(payload.nameEn  || '').trim());
      if (payload.nameJa   !== undefined) setCell('NAME_JA', String(payload.nameJa  || '').trim());
      if (payload.isActive !== undefined) setCell('ACTIVE',  coreOwnMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return manufacturerId;
    }
  );

  return { success: true, manufacturerId: resultId };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * ID列を走査して次の採番 ID を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} tableKey
 * @param {string} idFieldKey     Registry ヘッダーキー
 * @param {string} prefix         例: 'OWN-CAT-'
 * @param {number} digits         例: 4
 * @returns {string}  例: 'OWN-CAT-0001'
 */
function coreOwnMasterGenerateNextId_(sheet, headerIndexes, tableKey, idFieldKey, prefix, digits) {
  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, idFieldKey);
  var colIdx = headerIndexes[pkPhysical];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(prefix) === 0) {
        var num = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return prefix + String(maxNum + 1).padStart(digits, '0');
}

/**
 * ID列を走査して対象行の 1-indexed 行番号を返す。見つからなければ -1。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} tableKey
 * @param {string} idFieldKey
 * @param {string} targetId
 * @returns {number}
 */
function coreOwnMasterFindRow_(sheet, headerIndexes, tableKey, idFieldKey, targetId) {
  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, idFieldKey);
  var colIdx = headerIndexes[pkPhysical];
  if (!colIdx) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetId) return i + 2;
  }
  return -1;
}

/**
 * フラグフィールドを正規化する。'TRUE' / true / '1' → 'TRUE'、それ以外 → ''。
 *
 * @param {*} value
 * @returns {string}  'TRUE' or ''
 */
function coreOwnMasterFlag_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return (s === 'TRUE' || s === 'true' || s === '1') ? 'TRUE' : '';
}

// ─── Own Product APIs ─────────────────────────────────────────────────────────

/**
 * 自社商品マスタ（OWN_PRODUCTS）の全行を、参照先名称を結合して返す。
 *
 * 結合先:
 *   OWN_CATEGORY_ID     → OWN_CATEGORIES (nameEn / nameJa)
 *   OWN_WORK_ID         → OWN_WORKS (nameEn / nameJa)
 *   OWN_MANUFACTURER_ID → OWN_MANUFACTURERS (nameEn / nameJa)
 *   SHARED_PRODUCT_ID   → PRODUCTS (englishTitle / japaneseTitle)
 *
 * ラベル文字列は GAS で合成せず、各値を個別に返す。
 *
 * @param {string} sessionId
 * @returns {Array<Object>}
 */
function getCoreOwnProductsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();

  // 自社商品マスタ
  var ownData = coreCustomerFrontendReadTable(ss, 'OWN_PRODUCTS', [
    'OWN_PRODUCT_ID', 'SHARED_PRODUCT_ID', 'NAME_EN', 'NAME_JA',
    'OWN_CATEGORY_ID', 'OWN_WORK_ID', 'OWN_MANUFACTURER_ID', 'MEMO', 'ACTIVE'
  ]);

  // 自社大分類マスタ
  var catData = coreCustomerFrontendReadTable(ss, 'OWN_CATEGORIES', [
    'OWN_CATEGORY_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var catById = {};
  catData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[catData.indexes.OWN_CATEGORY_ID]);
    if (id) catById[id] = row;
  });

  // 自社作品マスタ
  var workData = coreCustomerFrontendReadTable(ss, 'OWN_WORKS', [
    'OWN_WORK_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var workById = {};
  workData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[workData.indexes.OWN_WORK_ID]);
    if (id) workById[id] = row;
  });

  // 自社メーカーマスタ
  var mfrData = coreCustomerFrontendReadTable(ss, 'OWN_MANUFACTURERS', [
    'OWN_MANUFACTURER_ID', 'NAME_EN', 'NAME_JA'
  ]);
  var mfrById = {};
  mfrData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[mfrData.indexes.OWN_MANUFACTURER_ID]);
    if (id) mfrById[id] = row;
  });

  // 共用商品マスタ（PRODUCTS: writeAllowed:false のため読み取りのみ）
  var prodData = coreCustomerFrontendReadTable(ss, 'PRODUCTS', [
    'PRODUCT_ID', 'ENGLISH_TITLE', 'JAPANESE_TITLE'
  ]);
  var productById = {};
  prodData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[prodData.indexes.PRODUCT_ID]);
    if (id) productById[id] = row;
  });

  return ownData.rows
    .map(function(row) {
      var ownProductId = coreCustomerFrontendValue(row[ownData.indexes.OWN_PRODUCT_ID]);
      if (!ownProductId) return null;

      var ownCategoryId    = coreCustomerFrontendValue(row[ownData.indexes.OWN_CATEGORY_ID]);
      var ownWorkId        = coreCustomerFrontendValue(row[ownData.indexes.OWN_WORK_ID]);
      var ownManufacturerId = coreCustomerFrontendValue(row[ownData.indexes.OWN_MANUFACTURER_ID]);
      var sharedProductId  = coreCustomerFrontendValue(row[ownData.indexes.SHARED_PRODUCT_ID]);

      var catRow  = catById[ownCategoryId]     || null;
      var workRow = workById[ownWorkId]         || null;
      var mfrRow  = mfrById[ownManufacturerId]  || null;
      var prodRow = productById[sharedProductId] || null;

      return {
        ownProductId:              ownProductId,
        sharedProductId:           sharedProductId,
        sharedProductEnglishTitle: prodRow ? coreCustomerFrontendValue(prodRow[prodData.indexes.ENGLISH_TITLE])   : '',
        sharedProductJapaneseTitle: prodRow ? coreCustomerFrontendValue(prodRow[prodData.indexes.JAPANESE_TITLE]) : '',
        nameEn:                    coreCustomerFrontendValue(row[ownData.indexes.NAME_EN]),
        nameJa:                    coreCustomerFrontendValue(row[ownData.indexes.NAME_JA]),
        ownCategoryId:             ownCategoryId,
        categoryNameEn:            catRow  ? coreCustomerFrontendValue(catRow[catData.indexes.NAME_EN])  : '',
        categoryNameJa:            catRow  ? coreCustomerFrontendValue(catRow[catData.indexes.NAME_JA])  : '',
        ownWorkId:                 ownWorkId,
        workNameEn:                workRow ? coreCustomerFrontendValue(workRow[workData.indexes.NAME_EN]) : '',
        workNameJa:                workRow ? coreCustomerFrontendValue(workRow[workData.indexes.NAME_JA]) : '',
        ownManufacturerId:         ownManufacturerId,
        manufacturerNameEn:        mfrRow  ? coreCustomerFrontendValue(mfrRow[mfrData.indexes.NAME_EN])  : '',
        manufacturerNameJa:        mfrRow  ? coreCustomerFrontendValue(mfrRow[mfrData.indexes.NAME_JA])  : '',
        note:                      coreCustomerFrontendValue(row[ownData.indexes.MEMO]),
        isActive:                  coreCustomerFrontendValue(row[ownData.indexes.ACTIVE])
      };
    })
    .filter(Boolean);
}

/**
 * 自社商品と荷姿割り当てをまとめて登録・更新する。
 *
 * ★ GAS では LockService により商品書き込みと荷姿割り当て書き込みを一連で行うが、
 *   途中で例外が発生すると商品のみ登録された状態が残りうる。
 *   戻り値の failedStep で失敗箇所を識別できる。
 *   SQL 移行時は BEGIN 〜 COMMIT のトランザクションに置き換えること。
 *
 * payload:
 *   product: {
 *     ownProductId       {string}  省略時は新規採番（OWN-0001 形式）
 *     sharedProductId    {string}  共用商品ID（PRODUCTS に存在すること）
 *     nameEn             {string}
 *     nameJa             {string}
 *     ownCategoryId      {string}  OWN_CATEGORIES に存在すること
 *     ownWorkId          {string}  OWN_WORKS に存在すること
 *     ownManufacturerId  {string}  OWN_MANUFACTURERS に存在すること
 *     note               {string}
 *     isActive           {*}       'TRUE' または '' の二値
 *   }
 *   package: {  ※ 省略可。省略時は商品情報のみ保存する
 *     productPackageId  {string}  省略時は新規採番（PPK-0001 形式）
 *     casePackageId     {string}  PACKAGES に存在すること
 *     boxPackageId      {string}  PACKAGES に存在すること
 *     packPackageId     {string}  PACKAGES に存在すること
 *     itemId            {string}  ITEMS に存在すること
 *     htsCodeId         {string}  HTS_CODES に存在すること
 *     materialId        {string}  MATERIALS に存在すること
 *   }
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, ownProductId: string, productPackageId: string|null, failedStep: null }}
 */
function upsertCoreOwnProductWithPackageForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');
  if (!payload.product || typeof payload.product !== 'object') throw new Error('MISSING_PRODUCT_PAYLOAD');

  var productPayload = payload.product;
  var packagePayload = payload.package && typeof payload.package === 'object' ? payload.package : null;

  var now              = new Date();
  var ownProductId     = String(productPayload.ownProductId || '').trim();
  var isNewProduct     = !ownProductId;
  var productPackageId = packagePayload ? String(packagePayload.productPackageId || '').trim() : null;
  var isNewPackage     = packagePayload ? !productPackageId : null;

  var resultOwnProductId     = null;
  var resultProductPackageId = null;

  withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();

      // ─── 1. 全入力値の事前検証（1件でも不正なら書き込み不実施）───────────

      // 自社大分類
      var ownCategoryId = String(productPayload.ownCategoryId || '').trim();
      if (ownCategoryId) {
        if (!coreOwnProductCheckRefId_(ss, 'OWN_CATEGORIES', 'OWN_CATEGORY_ID', ownCategoryId)) {
          throw new Error('OWN_CATEGORY_NOT_FOUND: ' + ownCategoryId);
        }
      }

      // 自社作品
      var ownWorkId = String(productPayload.ownWorkId || '').trim();
      if (ownWorkId) {
        if (!coreOwnProductCheckRefId_(ss, 'OWN_WORKS', 'OWN_WORK_ID', ownWorkId)) {
          throw new Error('OWN_WORK_NOT_FOUND: ' + ownWorkId);
        }
      }

      // 自社メーカー
      var ownManufacturerId = String(productPayload.ownManufacturerId || '').trim();
      if (ownManufacturerId) {
        if (!coreOwnProductCheckRefId_(ss, 'OWN_MANUFACTURERS', 'OWN_MANUFACTURER_ID', ownManufacturerId)) {
          throw new Error('OWN_MANUFACTURER_NOT_FOUND: ' + ownManufacturerId);
        }
      }

      // 共用商品（PRODUCTS: writeAllowed:false のため getCoreSchemaV1Sheet で直接確認）
      var sharedProductId = String(productPayload.sharedProductId || '').trim();
      if (sharedProductId) {
        if (!coreOwnProductCheckRefId_(ss, 'PRODUCTS', 'PRODUCT_ID', sharedProductId)) {
          throw new Error('SHARED_PRODUCT_NOT_FOUND: ' + sharedProductId);
        }
      }

      // 荷姿・品目・HTS・素材（package が指定されている場合のみ）
      if (packagePayload) {
        var casePackageId = String(packagePayload.casePackageId || '').trim();
        var boxPackageId  = String(packagePayload.boxPackageId  || '').trim();
        var packPackageId = String(packagePayload.packPackageId || '').trim();
        var itemId        = String(packagePayload.itemId        || '').trim();
        var htsCodeId     = String(packagePayload.htsCodeId     || '').trim();
        var materialId    = String(packagePayload.materialId    || '').trim();

        if (casePackageId) {
          if (!coreOwnProductCheckRefId_(ss, 'PACKAGES',  'PACKAGE_ID',  casePackageId)) throw new Error('PACKAGE_NOT_FOUND: ' + casePackageId);
        }
        if (boxPackageId) {
          if (!coreOwnProductCheckRefId_(ss, 'PACKAGES',  'PACKAGE_ID',  boxPackageId))  throw new Error('PACKAGE_NOT_FOUND: ' + boxPackageId);
        }
        if (packPackageId) {
          if (!coreOwnProductCheckRefId_(ss, 'PACKAGES',  'PACKAGE_ID',  packPackageId)) throw new Error('PACKAGE_NOT_FOUND: ' + packPackageId);
        }
        if (itemId) {
          if (!coreOwnProductCheckRefId_(ss, 'ITEMS',     'ITEM_ID',     itemId))     throw new Error('ITEM_NOT_FOUND: ' + itemId);
        }
        if (htsCodeId) {
          if (!coreOwnProductCheckRefId_(ss, 'HTS_CODES', 'HTS_CODE_ID', htsCodeId)) throw new Error('HTS_CODE_NOT_FOUND: ' + htsCodeId);
        }
        if (materialId) {
          if (!coreOwnProductCheckRefId_(ss, 'MATERIALS', 'MATERIAL_ID', materialId)) throw new Error('MATERIAL_NOT_FOUND: ' + materialId);
        }
      }

      // ─── 2. 自社商品マスタに書く ─────────────────────────────────────────

      var prodResult = validateCoreSchemaV1TableForWrite(ss, 'OWN_PRODUCTS');
      var prodSheet  = prodResult.sheet;
      var prodHi     = prodResult.headerIndexes;

      function setProdCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('OWN_PRODUCTS', fieldKey);
        var colIdx = prodHi[header];
        if (colIdx) prodSheet.getRange(prodTargetRow, colIdx).setValue(value);
      }

      var prodTargetRow;

      if (!isNewProduct) {
        prodTargetRow = coreOwnMasterFindRow_(prodSheet, prodHi, 'OWN_PRODUCTS', 'OWN_PRODUCT_ID', ownProductId);
        if (prodTargetRow < 0) throw new Error('OWN_PRODUCT_NOT_FOUND: ' + ownProductId);
      } else {
        ownProductId  = coreOwnMasterGenerateNextId_(prodSheet, prodHi, 'OWN_PRODUCTS', 'OWN_PRODUCT_ID', CORE_OWN_PRODUCT_ID_PREFIX, CORE_OWN_MASTER_ID_DIGITS);
        prodTargetRow = prodSheet.getLastRow() + 1;
        var prodMaxCols = prodSheet.getLastColumn();
        prodSheet.appendRow(new Array(prodMaxCols).fill(''));
        setProdCell('OWN_PRODUCT_ID',  ownProductId);
        setProdCell('REGISTERED_AT',   now);
      }

      if (productPayload.sharedProductId    !== undefined) setProdCell('SHARED_PRODUCT_ID',   sharedProductId);
      if (productPayload.nameEn             !== undefined) setProdCell('NAME_EN',              String(productPayload.nameEn  || '').trim());
      if (productPayload.nameJa             !== undefined) setProdCell('NAME_JA',              String(productPayload.nameJa  || '').trim());
      if (productPayload.ownCategoryId      !== undefined) setProdCell('OWN_CATEGORY_ID',      ownCategoryId);
      if (productPayload.ownWorkId          !== undefined) setProdCell('OWN_WORK_ID',          ownWorkId);
      if (productPayload.ownManufacturerId  !== undefined) setProdCell('OWN_MANUFACTURER_ID',  ownManufacturerId);
      if (productPayload.note               !== undefined) setProdCell('MEMO',                 String(productPayload.note    || '').trim());
      if (productPayload.isActive           !== undefined) setProdCell('ACTIVE',               coreOwnMasterFlag_(productPayload.isActive));

      setProdCell('UPDATED_AT', now);
      resultOwnProductId = ownProductId;

      // ─── 3. 商品荷姿マスタに書く（package が指定されている場合のみ）──────

      if (!packagePayload) {
        resultProductPackageId = null;
        return;
      }

      var pkgResult = validateCoreSchemaV1TableForWrite(ss, 'PRODUCT_PACKAGES');
      var pkgSheet  = pkgResult.sheet;
      var pkgHi     = pkgResult.headerIndexes;

      function setPkgCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('PRODUCT_PACKAGES', fieldKey);
        var colIdx = pkgHi[header];
        if (colIdx) pkgSheet.getRange(pkgTargetRow, colIdx).setValue(value);
      }

      var pkgTargetRow;

      if (!isNewPackage) {
        pkgTargetRow = corePackageMasterFindRow_(pkgSheet, pkgHi, 'PRODUCT_PACKAGES', 'PRODUCT_PACKAGE_ID', productPackageId);
        if (pkgTargetRow < 0) throw new Error('PRODUCT_PACKAGE_NOT_FOUND: ' + productPackageId);
      } else {
        productPackageId = corePackageMasterGenerateNextId_(pkgSheet, pkgHi, 'PRODUCT_PACKAGES', 'PRODUCT_PACKAGE_ID', 'PPK-', 4);
        pkgTargetRow     = pkgSheet.getLastRow() + 1;
        var pkgMaxCols   = pkgSheet.getLastColumn();
        pkgSheet.appendRow(new Array(pkgMaxCols).fill(''));
        setPkgCell('PRODUCT_PACKAGE_ID', productPackageId);
        setPkgCell('REGISTERED_AT',      now);
      }

      // 自社商品IDは常にセット（新規・更新どちらも）
      setPkgCell('OWN_PRODUCT_ID', resultOwnProductId);

      var casePackageId2 = String(packagePayload.casePackageId || '').trim();
      var boxPackageId2  = String(packagePayload.boxPackageId  || '').trim();
      var packPackageId2 = String(packagePayload.packPackageId || '').trim();
      var itemId2        = String(packagePayload.itemId        || '').trim();
      var htsCodeId2     = String(packagePayload.htsCodeId     || '').trim();
      var materialId2    = String(packagePayload.materialId    || '').trim();

      if (packagePayload.casePackageId  !== undefined) setPkgCell('CASE_PACKAGE_ID',  casePackageId2);
      if (packagePayload.boxPackageId   !== undefined) setPkgCell('BOX_PACKAGE_ID',   boxPackageId2);
      if (packagePayload.packPackageId  !== undefined) setPkgCell('PACK_PACKAGE_ID',  packPackageId2);
      if (packagePayload.itemId         !== undefined) setPkgCell('ITEM_ID',          itemId2);
      if (packagePayload.htsCodeId      !== undefined) setPkgCell('HTS_CODE_ID',      htsCodeId2);
      if (packagePayload.materialId     !== undefined) setPkgCell('MATERIAL_ID',      materialId2);
      if (packagePayload.isActive       !== undefined) setPkgCell('ACTIVE',           coreOwnMasterFlag_(packagePayload.isActive));

      setPkgCell('UPDATED_AT', now);
      resultProductPackageId = productPackageId;
    }
  );

  return {
    success:          true,
    ownProductId:     resultOwnProductId,
    productPackageId: resultProductPackageId,
    failedStep:       null
  };
}

// ─── Own Product internal helpers ─────────────────────────────────────────────

/**
 * 指定テーブルに targetId が存在するか確認する。
 * writeAllowed:false のテーブル（PRODUCTS 等）にも使用可能。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @param {string} idFieldKey  Registry フィールドキー
 * @param {string} targetId
 * @returns {boolean}
 */
function coreOwnProductCheckRefId_(ss, tableKey, idFieldKey, targetId) {
  var table      = getCoreSchemaV1Table(tableKey);
  var sheet      = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol    = sheet.getLastColumn();
  if (!lastCol) return false;

  var headers = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, idFieldKey);
  var colIdx     = headers.indexOf(pkPhysical);
  if (colIdx < 0) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return false;

  var values = sheet.getRange(table.headerRowNumber + 1, colIdx + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetId) return true;
  }
  return false;
}
