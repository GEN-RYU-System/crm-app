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
 *
 * Permission:
 *   read:  lead_view
 *   write: deal_edit
 */

/* global getCoreSchemaV1HeaderName,
   validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

// ─── ID prefix / digits ──────────────────────────────────────────────────────

var CORE_OWN_CATEGORY_ID_PREFIX     = 'OWN-CAT-';
var CORE_OWN_WORK_ID_PREFIX         = 'OWN-WRK-';
var CORE_OWN_MANUFACTURER_ID_PREFIX = 'OWN-MFR-';
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
