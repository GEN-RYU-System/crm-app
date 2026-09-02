/**
 * 28_CoreExportMasterApi.js
 *
 * Core Schema V1 準拠: 品目・HTSコード・素材マスタの読み書き API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 * 日本語列名の直書き禁止。
 *
 * Public functions:
 *   getCoreItemsForFrontend(sessionId)
 *   getCoreHtsCodesForFrontend(sessionId)
 *   getCoreMaterialsForFrontend(sessionId)
 *   upsertCoreItemForFrontend(sessionId, payload)
 *   upsertCoreHtsCodeForFrontend(sessionId, payload)
 *   upsertCoreMaterialForFrontend(sessionId, payload)
 *
 * Permission:
 *   read:  lead_view
 *   write: deal_edit
 */

/* global getCoreSchemaV1HeaderName, validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

// ─── ID prefix / digits ──────────────────────────────────────────────────────

var CORE_ITEM_ID_PREFIX     = 'ITM-';
var CORE_HTS_CODE_ID_PREFIX = 'HTS-';
var CORE_MATERIAL_ID_PREFIX = 'MAT-';
var CORE_EXPORT_MASTER_ID_DIGITS = 4;

// ─── Read APIs ────────────────────────────────────────────────────────────────

/**
 * 品目マスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{itemId:string, nameEn:string, nameJa:string, isActive:string}>}
 */
function getCoreItemsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss   = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'ITEMS', [
    'ITEM_ID', 'NAME_EN', 'NAME_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      itemId:   coreCustomerFrontendValue(row[data.indexes.ITEM_ID]),
      nameEn:   coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      nameJa:   coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      isActive: coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.itemId !== ''; });
}

/**
 * HTSコードマスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{htsCodeId:string, htsCode:string, descriptionEn:string, descriptionJa:string, isActive:string}>}
 */
function getCoreHtsCodesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss   = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'HTS_CODES', [
    'HTS_CODE_ID', 'HTS_CODE', 'DESCRIPTION_EN', 'DESCRIPTION_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      htsCodeId:     coreCustomerFrontendValue(row[data.indexes.HTS_CODE_ID]),
      htsCode:       coreCustomerFrontendValue(row[data.indexes.HTS_CODE]),
      descriptionEn: coreCustomerFrontendValue(row[data.indexes.DESCRIPTION_EN]),
      descriptionJa: coreCustomerFrontendValue(row[data.indexes.DESCRIPTION_JA]),
      isActive:      coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.htsCodeId !== ''; });
}

/**
 * 素材マスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{materialId:string, nameEn:string, nameJa:string, isActive:string}>}
 */
function getCoreMaterialsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss   = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'MATERIALS', [
    'MATERIAL_ID', 'NAME_EN', 'NAME_JA', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      materialId: coreCustomerFrontendValue(row[data.indexes.MATERIAL_ID]),
      nameEn:     coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      nameJa:     coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      isActive:   coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.materialId !== ''; });
}

// ─── Write APIs ───────────────────────────────────────────────────────────────

/**
 * 品目を1件追加または更新する。
 *
 * payload:
 *   itemId    {string}  省略時は新規採番（ITM-0001 形式）
 *   nameEn    {string}
 *   nameJa    {string}
 *   isActive  {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, itemId: string }}
 */
function upsertCoreItemForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now    = new Date();
  var itemId = String(payload.itemId || '').trim();
  var isNew  = !itemId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'ITEMS');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('ITEMS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreExportMasterFindRow_(sheet, hi, 'ITEMS', 'ITEM_ID', itemId);
        if (targetRow < 0) throw new Error('ITEM_NOT_FOUND: ' + itemId);
      } else {
        itemId    = coreExportMasterGenerateNextId_(sheet, hi, 'ITEMS', 'ITEM_ID', CORE_ITEM_ID_PREFIX, CORE_EXPORT_MASTER_ID_DIGITS);
        targetRow = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('ITEM_ID',      itemId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.nameEn   !== undefined) setCell('NAME_EN', String(payload.nameEn  || '').trim());
      if (payload.nameJa   !== undefined) setCell('NAME_JA', String(payload.nameJa  || '').trim());
      if (payload.isActive !== undefined) setCell('ACTIVE',  coreExportMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return itemId;
    }
  );

  return { success: true, itemId: resultId };
}

/**
 * HTSコードを1件追加または更新する。
 *
 * payload:
 *   htsCodeId     {string}  省略時は新規採番（HTS-0001 形式）
 *   htsCode       {string}
 *   descriptionEn {string}
 *   descriptionJa {string}
 *   isActive      {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, htsCodeId: string }}
 */
function upsertCoreHtsCodeForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now       = new Date();
  var htsCodeId = String(payload.htsCodeId || '').trim();
  var isNew     = !htsCodeId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'HTS_CODES');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('HTS_CODES', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreExportMasterFindRow_(sheet, hi, 'HTS_CODES', 'HTS_CODE_ID', htsCodeId);
        if (targetRow < 0) throw new Error('HTS_CODE_NOT_FOUND: ' + htsCodeId);
      } else {
        htsCodeId = coreExportMasterGenerateNextId_(sheet, hi, 'HTS_CODES', 'HTS_CODE_ID', CORE_HTS_CODE_ID_PREFIX, CORE_EXPORT_MASTER_ID_DIGITS);
        targetRow = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('HTS_CODE_ID',  htsCodeId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.htsCode       !== undefined) setCell('HTS_CODE',       String(payload.htsCode       || '').trim());
      if (payload.descriptionEn !== undefined) setCell('DESCRIPTION_EN', String(payload.descriptionEn || '').trim());
      if (payload.descriptionJa !== undefined) setCell('DESCRIPTION_JA', String(payload.descriptionJa || '').trim());
      if (payload.isActive      !== undefined) setCell('ACTIVE',         coreExportMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return htsCodeId;
    }
  );

  return { success: true, htsCodeId: resultId };
}

/**
 * 素材を1件追加または更新する。
 *
 * payload:
 *   materialId  {string}  省略時は新規採番（MAT-0001 形式）
 *   nameEn      {string}
 *   nameJa      {string}
 *   isActive    {*}       'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, materialId: string }}
 */
function upsertCoreMaterialForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now        = new Date();
  var materialId = String(payload.materialId || '').trim();
  var isNew      = !materialId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'MATERIALS');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('MATERIALS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      if (!isNew) {
        targetRow = coreExportMasterFindRow_(sheet, hi, 'MATERIALS', 'MATERIAL_ID', materialId);
        if (targetRow < 0) throw new Error('MATERIAL_NOT_FOUND: ' + materialId);
      } else {
        materialId = coreExportMasterGenerateNextId_(sheet, hi, 'MATERIALS', 'MATERIAL_ID', CORE_MATERIAL_ID_PREFIX, CORE_EXPORT_MASTER_ID_DIGITS);
        targetRow  = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('MATERIAL_ID',  materialId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.nameEn   !== undefined) setCell('NAME_EN', String(payload.nameEn  || '').trim());
      if (payload.nameJa   !== undefined) setCell('NAME_JA', String(payload.nameJa  || '').trim());
      if (payload.isActive !== undefined) setCell('ACTIVE',  coreExportMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return materialId;
    }
  );

  return { success: true, materialId: resultId };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * ID列を走査して次の採番 ID を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} tableKey
 * @param {string} idFieldKey     Registry ヘッダーキー
 * @param {string} prefix         例: 'ITM-'
 * @param {number} digits         例: 4
 * @returns {string}  例: 'ITM-0001'
 */
function coreExportMasterGenerateNextId_(sheet, headerIndexes, tableKey, idFieldKey, prefix, digits) {
  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, idFieldKey);
  var colIdx     = headerIndexes[pkPhysical];
  var maxNum     = 0;
  var lastRow    = sheet.getLastRow();
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
function coreExportMasterFindRow_(sheet, headerIndexes, tableKey, idFieldKey, targetId) {
  var pkPhysical = getCoreSchemaV1HeaderName(tableKey, idFieldKey);
  var colIdx     = headerIndexes[pkPhysical];
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
function coreExportMasterFlag_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return (s === 'TRUE' || s === 'true' || s === '1') ? 'TRUE' : '';
}
