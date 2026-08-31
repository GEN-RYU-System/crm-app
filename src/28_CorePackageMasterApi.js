/**
 * 28_CorePackageMasterApi.js
 *
 * Core Schema V1 準拠: サイズ・重量・荷姿マスタの読み書き API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 * 日本語列名の直書き禁止。
 *
 * Public functions:
 *   getCoreSizesForFrontend(sessionId)
 *   getCoreWeightsForFrontend(sessionId)
 *   getCorePackagesForFrontend(sessionId)
 *   upsertCoreSizeForFrontend(sessionId, payload)
 *   upsertCoreWeightForFrontend(sessionId, payload)
 *   upsertCorePackageForFrontend(sessionId, payload)
 *
 * Permission:
 *   read:  lead_view   (荷姿選択肢として受注・出荷担当者が参照する)
 *   write: deal_edit   (upsertCoreShipmentForFrontend と同じ)
 */

/* global getCoreSchemaV1Table, getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

// ─── ID prefix / digits ──────────────────────────────────────────────────────

var CORE_SIZE_ID_PREFIX    = 'SIZ-';
var CORE_WEIGHT_ID_PREFIX  = 'WGT-';
var CORE_PACKAGE_ID_PREFIX = 'PKG-';
var CORE_PACKAGE_ID_DIGITS = 4;

// ─── Read APIs ────────────────────────────────────────────────────────────────

/**
 * サイズマスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{sizeId:string, sizeName:string, length:string,
 *                  width:string, height:string, isActive:string}>}
 */
function getCoreSizesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'SIZES', [
    'SIZE_ID', 'NAME', 'LENGTH', 'WIDTH', 'HEIGHT', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      sizeId:   coreCustomerFrontendValue(row[data.indexes.SIZE_ID]),
      sizeName: coreCustomerFrontendValue(row[data.indexes.NAME]),
      length:   coreCustomerFrontendValue(row[data.indexes.LENGTH]),
      width:    coreCustomerFrontendValue(row[data.indexes.WIDTH]),
      height:   coreCustomerFrontendValue(row[data.indexes.HEIGHT]),
      isActive: coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.sizeId !== ''; });
}

/**
 * 重量マスタの全行を返す。
 *
 * @param {string} sessionId
 * @returns {Array<{weightId:string, weightName:string, weight:string, isActive:string}>}
 */
function getCoreWeightsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'WEIGHTS', [
    'WEIGHT_ID', 'NAME', 'WEIGHT', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      weightId:   coreCustomerFrontendValue(row[data.indexes.WEIGHT_ID]),
      weightName: coreCustomerFrontendValue(row[data.indexes.NAME]),
      weight:     coreCustomerFrontendValue(row[data.indexes.WEIGHT]),
      isActive:   coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.weightId !== ''; });
}

/**
 * 荷姿マスタの全行を返す。
 * サイズ・重量の各フィールドを結合して返す（ラベル合成はフロント側で行う）。
 *
 * 返却フィールド:
 *   packageId / packageName / unit / quantityPerUnit / isActive
 *   sizeId / sizeName / length / width / height
 *   weightId / weightName / weight
 *
 * @param {string} sessionId
 * @returns {Array<Object>}
 */
function getCorePackagesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();

  var pkgData = coreCustomerFrontendReadTable(ss, 'PACKAGES', [
    'PACKAGE_ID', 'NAME', 'UNIT', 'QUANTITY', 'SIZE_ID', 'WEIGHT_ID', 'ACTIVE'
  ]);
  var sizeData = coreCustomerFrontendReadTable(ss, 'SIZES', [
    'SIZE_ID', 'NAME', 'LENGTH', 'WIDTH', 'HEIGHT'
  ]);
  var weightData = coreCustomerFrontendReadTable(ss, 'WEIGHTS', [
    'WEIGHT_ID', 'NAME', 'WEIGHT'
  ]);

  // サイズ・重量を ID でインデックス化
  var sizeById = {};
  sizeData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[sizeData.indexes.SIZE_ID]);
    if (id) sizeById[id] = row;
  });
  var weightById = {};
  weightData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[weightData.indexes.WEIGHT_ID]);
    if (id) weightById[id] = row;
  });

  return pkgData.rows
    .map(function(row) {
      var packageId = coreCustomerFrontendValue(row[pkgData.indexes.PACKAGE_ID]);
      if (!packageId) return null;

      var sizeId   = coreCustomerFrontendValue(row[pkgData.indexes.SIZE_ID]);
      var weightId = coreCustomerFrontendValue(row[pkgData.indexes.WEIGHT_ID]);
      var sizeRow    = sizeById[sizeId]   || null;
      var weightRow  = weightById[weightId] || null;

      return {
        packageId:       packageId,
        packageName:     coreCustomerFrontendValue(row[pkgData.indexes.NAME]),
        unit:            coreCustomerFrontendValue(row[pkgData.indexes.UNIT]),
        quantityPerUnit: coreCustomerFrontendValue(row[pkgData.indexes.QUANTITY]),
        isActive:        coreCustomerFrontendValue(row[pkgData.indexes.ACTIVE]),
        // サイズ情報（未紐付けの場合は空文字）
        sizeId:          sizeId,
        sizeName:        sizeRow ? coreCustomerFrontendValue(sizeRow[sizeData.indexes.NAME])   : '',
        length:          sizeRow ? coreCustomerFrontendValue(sizeRow[sizeData.indexes.LENGTH]) : '',
        width:           sizeRow ? coreCustomerFrontendValue(sizeRow[sizeData.indexes.WIDTH])  : '',
        height:          sizeRow ? coreCustomerFrontendValue(sizeRow[sizeData.indexes.HEIGHT]) : '',
        // 重量情報（未紐付けの場合は空文字）
        weightId:        weightId,
        weightName:      weightRow ? coreCustomerFrontendValue(weightRow[weightData.indexes.NAME])   : '',
        weight:          weightRow ? coreCustomerFrontendValue(weightRow[weightData.indexes.WEIGHT]) : ''
      };
    })
    .filter(Boolean);
}

// ─── Write APIs ───────────────────────────────────────────────────────────────

/**
 * サイズを1件追加または更新する。
 *
 * payload:
 *   sizeId      {string}  省略時は新規採番（SIZ-0001 形式）
 *   sizeName    {string}
 *   length      {number|string}
 *   width       {number|string}
 *   height      {number|string}
 *   isActive    {string}  'TRUE' または '' の二値
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, sizeId: string }}
 */
function upsertCoreSizeForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now    = new Date();
  var sizeId = String(payload.sizeId || '').trim();
  var isNew  = !sizeId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'SIZES');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('SIZES', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        targetRow = corePackageMasterFindRow_(sheet, hi, 'SIZES', 'SIZE_ID', sizeId);
        if (targetRow < 0) throw new Error('SIZE_NOT_FOUND: ' + sizeId);
      } else {
        sizeId   = corePackageMasterGenerateNextId_(sheet, hi, 'SIZES', 'SIZE_ID', CORE_SIZE_ID_PREFIX, CORE_PACKAGE_ID_DIGITS);
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        targetRow = sheet.getLastRow();
        setCell('SIZE_ID',       sizeId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.sizeName !== undefined) setCell('NAME',   String(payload.sizeName || '').trim());
      if (payload.length   !== undefined) setCell('LENGTH', corePackageMasterNumeric_(payload.length));
      if (payload.width    !== undefined) setCell('WIDTH',  corePackageMasterNumeric_(payload.width));
      if (payload.height   !== undefined) setCell('HEIGHT', corePackageMasterNumeric_(payload.height));
      if (payload.isActive !== undefined) setCell('ACTIVE', corePackageMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return sizeId;
    }
  );

  return { success: true, sizeId: resultId };
}

/**
 * 重量を1件追加または更新する。
 *
 * payload:
 *   weightId    {string}  省略時は新規採番（WGT-0001 形式）
 *   weightName  {string}
 *   weight      {number|string}
 *   isActive    {string}  'TRUE' または ''
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, weightId: string }}
 */
function upsertCoreWeightForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now      = new Date();
  var weightId = String(payload.weightId || '').trim();
  var isNew    = !weightId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss     = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'WEIGHTS');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('WEIGHTS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        targetRow = corePackageMasterFindRow_(sheet, hi, 'WEIGHTS', 'WEIGHT_ID', weightId);
        if (targetRow < 0) throw new Error('WEIGHT_NOT_FOUND: ' + weightId);
      } else {
        weightId = corePackageMasterGenerateNextId_(sheet, hi, 'WEIGHTS', 'WEIGHT_ID', CORE_WEIGHT_ID_PREFIX, CORE_PACKAGE_ID_DIGITS);
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        targetRow = sheet.getLastRow();
        setCell('WEIGHT_ID',    weightId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.weightName !== undefined) setCell('NAME',   String(payload.weightName || '').trim());
      if (payload.weight     !== undefined) setCell('WEIGHT', corePackageMasterNumeric_(payload.weight));
      if (payload.isActive   !== undefined) setCell('ACTIVE', corePackageMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return weightId;
    }
  );

  return { success: true, weightId: resultId };
}

/**
 * 荷姿を1件追加または更新する。
 *
 * payload:
 *   packageId      {string}  省略時は新規採番（PKG-0001 形式）
 *   packageName    {string}
 *   unit           {string}  Registry の PACKAGES.values.UNIT に定義された値のみ許可
 *   quantityPerUnit {number|string}
 *   sizeId         {string}  実在する SIZE_ID でなければエラー
 *   weightId       {string}  実在する WEIGHT_ID でなければエラー
 *   isActive       {string}  'TRUE' または ''
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, packageId: string }}
 */
function upsertCorePackageForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  // 単位バリデーション
  if (payload.unit !== undefined) {
    var unitValue = String(payload.unit || '').trim();
    var validUnits = ['CASE', 'BOX', 'PACK'].map(function(key) {
      return getCoreSchemaV1Value('PACKAGES', 'UNIT', key);
    });
    if (validUnits.indexOf(unitValue) === -1) {
      throw new Error('INVALID_UNIT: "' + unitValue + '" は許可されていません。有効値: ' + validUnits.join(', '));
    }
  }

  var now       = new Date();
  var packageId = String(payload.packageId || '').trim();
  var isNew     = !packageId;

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();

      // sizeId の存在確認
      if (payload.sizeId !== undefined) {
        var sizeIdToCheck = String(payload.sizeId || '').trim();
        if (sizeIdToCheck) {
          var sizeResult = validateCoreSchemaV1TableForWrite(ss, 'SIZES');
          var sizeExists = corePackageMasterIdExists_(
            sizeResult.sheet, sizeResult.headerIndexes, 'SIZES', 'SIZE_ID', sizeIdToCheck
          );
          if (!sizeExists) throw new Error('SIZE_NOT_FOUND: ' + sizeIdToCheck);
        }
      }

      // weightId の存在確認
      if (payload.weightId !== undefined) {
        var weightIdToCheck = String(payload.weightId || '').trim();
        if (weightIdToCheck) {
          var weightResult = validateCoreSchemaV1TableForWrite(ss, 'WEIGHTS');
          var weightExists = corePackageMasterIdExists_(
            weightResult.sheet, weightResult.headerIndexes, 'WEIGHTS', 'WEIGHT_ID', weightIdToCheck
          );
          if (!weightExists) throw new Error('WEIGHT_NOT_FOUND: ' + weightIdToCheck);
        }
      }

      var result = validateCoreSchemaV1TableForWrite(ss, 'PACKAGES');
      var sheet  = result.sheet;
      var hi     = result.headerIndexes;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('PACKAGES', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        targetRow = corePackageMasterFindRow_(sheet, hi, 'PACKAGES', 'PACKAGE_ID', packageId);
        if (targetRow < 0) throw new Error('PACKAGE_NOT_FOUND: ' + packageId);
      } else {
        packageId = corePackageMasterGenerateNextId_(sheet, hi, 'PACKAGES', 'PACKAGE_ID', CORE_PACKAGE_ID_PREFIX, CORE_PACKAGE_ID_DIGITS);
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        targetRow = sheet.getLastRow();
        setCell('PACKAGE_ID',   packageId);
        setCell('REGISTERED_AT', now);
      }

      if (payload.packageName    !== undefined) setCell('NAME',      String(payload.packageName || '').trim());
      if (payload.unit           !== undefined) setCell('UNIT',      String(payload.unit || '').trim());
      if (payload.quantityPerUnit !== undefined) setCell('QUANTITY', corePackageMasterNumeric_(payload.quantityPerUnit));
      if (payload.sizeId         !== undefined) setCell('SIZE_ID',   String(payload.sizeId || '').trim());
      if (payload.weightId       !== undefined) setCell('WEIGHT_ID', String(payload.weightId || '').trim());
      if (payload.isActive       !== undefined) setCell('ACTIVE',    corePackageMasterFlag_(payload.isActive));

      setCell('UPDATED_AT', now);

      return packageId;
    }
  );

  return { success: true, packageId: resultId };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * ID列を走査して次の採番 ID を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} tableKey
 * @param {string} idFieldKey     Registry ヘッダーキー
 * @param {string} prefix         例: 'SIZ-'
 * @param {number} digits         例: 4
 * @returns {string}  例: 'SIZ-0001'
 */
function corePackageMasterGenerateNextId_(sheet, headerIndexes, tableKey, idFieldKey, prefix, digits) {
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
function corePackageMasterFindRow_(sheet, headerIndexes, tableKey, idFieldKey, targetId) {
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
 * 指定 ID が対象シートに存在するか確認する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} tableKey
 * @param {string} idFieldKey
 * @param {string} targetId
 * @returns {boolean}
 */
function corePackageMasterIdExists_(sheet, headerIndexes, tableKey, idFieldKey, targetId) {
  return corePackageMasterFindRow_(sheet, headerIndexes, tableKey, idFieldKey, targetId) > 0;
}

/**
 * 数値フィールドを正規化する。空・NaN は空文字を返す。
 *
 * @param {*} value
 * @returns {number|string}
 */
function corePackageMasterNumeric_(value) {
  if (value === null || value === undefined || value === '') return '';
  var n = Number(value);
  return isNaN(n) ? '' : n;
}

/**
 * フラグフィールドを正規化する。'TRUE' / true / '1' → 'TRUE'、それ以外 → ''。
 *
 * @param {*} value
 * @returns {string}  'TRUE' or ''
 */
function corePackageMasterFlag_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return (s === 'TRUE' || s === 'true' || s === '1') ? 'TRUE' : '';
}
