/**
 * 28_CoreCustomerTaxNumberApi.js
 *
 * Core Schema V1 準拠: 番号種別マスタ（TAX_NUMBER_TYPES）と
 * 顧客税務番号（CUSTOMER_TAX_NUMBERS）の読み書き API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 * 日本語列名の直書き禁止。
 *
 * Public functions:
 *   getCoreTaxNumberTypesForFrontend(sessionId)
 *   getCoreCustomerTaxNumbersForFrontend(sessionId, customerId)
 *   upsertCoreCustomerTaxNumberForFrontend(sessionId, payload)
 *
 * Permission:
 *   read:  lead_view
 *   write: deal_edit
 */

/* global getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName,
   validateCoreSchemaV1TableForWrite,
   setEmailFromSession, checkPermission, getSpreadsheet,
   withSheetWrite_,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

var CTN_ID_PREFIX = 'CTN-';
var CTN_ID_DIGITS = 4;

// ─── Read APIs ────────────────────────────────────────────────────────────────

/**
 * 番号種別マスタの全行を返す。
 * 有効フラグによる絞り込みは行わない（画面側で制御する）。
 *
 * @param {string} sessionId
 * @returns {Array<{typeId:string, nameJa:string, nameEn:string, description:string,
 *                  targetCountry:string, isActive:string}>}
 */
function getCoreTaxNumberTypesForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss   = getSpreadsheet();
  var data = coreCustomerFrontendReadTable(ss, 'TAX_NUMBER_TYPES', [
    'TYPE_ID', 'NAME_JA', 'NAME_EN', 'DESCRIPTION', 'TARGET_COUNTRY', 'ACTIVE'
  ]);

  return data.rows.map(function(row) {
    return {
      typeId:        coreCustomerFrontendValue(row[data.indexes.TYPE_ID]),
      nameJa:        coreCustomerFrontendValue(row[data.indexes.NAME_JA]),
      nameEn:        coreCustomerFrontendValue(row[data.indexes.NAME_EN]),
      description:   coreCustomerFrontendValue(row[data.indexes.DESCRIPTION]),
      targetCountry: coreCustomerFrontendValue(row[data.indexes.TARGET_COUNTRY]),
      isActive:      coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
  }).filter(function(r) { return r.typeId !== ''; });
}

/**
 * 指定顧客の税務番号を全件返す。
 * 番号種別の名称（日本語・英語）を結合して返す。
 * ラベル文字列は GAS では組み立てず、各値を個別フィールドで返す。
 *
 * @param {string} sessionId
 * @param {string} customerId
 * @returns {Array<{taxNumberId:string, customerId:string, typeId:string,
 *                  typeNameJa:string, typeNameEn:string, number:string, isActive:string}>}
 */
function getCoreCustomerTaxNumbersForFrontend(sessionId, customerId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var targetCustomerId = String(customerId || '').trim();
  if (!targetCustomerId) return [];

  var ss = getSpreadsheet();

  // 番号種別マスタ（nameJa/nameEn の結合用）
  var typeData = coreCustomerFrontendReadTable(ss, 'TAX_NUMBER_TYPES', [
    'TYPE_ID', 'NAME_JA', 'NAME_EN'
  ]);
  var typeById = {};
  typeData.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[typeData.indexes.TYPE_ID]);
    if (id) typeById[id] = row;
  });

  // 顧客税務番号
  var ctnData = coreCustomerFrontendReadTable(ss, 'CUSTOMER_TAX_NUMBERS', [
    'TAX_NUMBER_ID', 'CUSTOMER_ID', 'TYPE_ID', 'NUMBER', 'ACTIVE'
  ]);

  return ctnData.rows
    .map(function(row) {
      var cid = coreCustomerFrontendValue(row[ctnData.indexes.CUSTOMER_ID]);
      if (cid !== targetCustomerId) return null;

      var typeId  = coreCustomerFrontendValue(row[ctnData.indexes.TYPE_ID]);
      var typeRow = typeById[typeId] || null;

      return {
        taxNumberId: coreCustomerFrontendValue(row[ctnData.indexes.TAX_NUMBER_ID]),
        customerId:  cid,
        typeId:      typeId,
        typeNameJa:  typeRow ? coreCustomerFrontendValue(typeRow[typeData.indexes.NAME_JA]) : '',
        typeNameEn:  typeRow ? coreCustomerFrontendValue(typeRow[typeData.indexes.NAME_EN]) : '',
        number:      coreCustomerFrontendValue(row[ctnData.indexes.NUMBER]),
        isActive:    coreCustomerFrontendValue(row[ctnData.indexes.ACTIVE])
      };
    })
    .filter(Boolean);
}

// ─── Write API ────────────────────────────────────────────────────────────────

/**
 * 顧客税務番号を1件追加または更新する。
 *
 * ★ PostgreSQL 移行時は UNIQUE (customer_id, type_id) 制約に置き換える。
 *   GAS では制約を張れないため、この関数内の重複チェックで代替している。
 *
 * payload:
 *   taxNumberId  {string}  省略時は新規採番（CTN-0001 形式）
 *   customerId   {string}  必須。CUSTOMERS に実在する顧客ID
 *   typeId       {string}  必須。TAX_NUMBER_TYPES に実在し、有効な種別ID
 *   number       {string}  必須。空文字不可
 *   isActive     {*}       'TRUE' または '' の二値（省略時はそのまま）
 *
 * 検証:
 *   1. customerId が顧客マスタに実在すること
 *   2. typeId が番号種別マスタに実在し、有効（ACTIVE=TRUE）であること
 *   3. number が空でないこと
 *   4. 同じ顧客・同じ種別の行が既にある場合:
 *      - 新規登録なら拒否（DUPLICATE_TAX_NUMBER）
 *      - 更新なら自分自身（taxNumberId が一致する行）を除外して判定
 *   1件でも不正な場合は書き込まずエラーを返す。
 *
 * @param {string} sessionId
 * @param {Object} payload
 * @returns {{ success: true, taxNumberId: string }}
 */
function upsertCoreCustomerTaxNumberForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');

  var now         = new Date();
  var taxNumberId = String(payload.taxNumberId || '').trim();
  var customerId  = String(payload.customerId  || '').trim();
  var typeId      = String(payload.typeId      || '').trim();
  var number      = String(payload.number      || '').trim();
  var isNew       = !taxNumberId;

  // ─── 事前検証（書き込み前に全件チェック）──────────────────────────────────

  if (!customerId) throw new Error('MISSING_CUSTOMER_ID');
  if (!typeId)     throw new Error('MISSING_TYPE_ID');
  if (!number)     throw new Error('MISSING_NUMBER');

  var resultId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();

      // 1. customerId が顧客マスタに実在するか
      if (!coreCtnCheckRefId_(ss, 'CUSTOMERS', 'CUSTOMER_ID', customerId)) {
        throw new Error('CUSTOMER_NOT_FOUND: ' + customerId);
      }

      // 2. typeId が番号種別マスタに実在し、有効か
      if (!coreCtnCheckActiveTypeId_(ss, typeId)) {
        throw new Error('TAX_NUMBER_TYPE_NOT_FOUND_OR_INACTIVE: ' + typeId);
      }

      // 3. 重複チェック（同顧客・同種別）
      var ctnResult = validateCoreSchemaV1TableForWrite(ss, 'CUSTOMER_TAX_NUMBERS');
      var sheet     = ctnResult.sheet;
      var hi        = ctnResult.headerIndexes;

      var dupRow = coreCtnFindDuplicateRow_(sheet, hi, customerId, typeId, isNew ? null : taxNumberId);
      if (dupRow !== -1) {
        throw new Error('DUPLICATE_TAX_NUMBER: customerId=' + customerId + ' typeId=' + typeId);
      }

      // ─── 書き込み ───────────────────────────────────────────────────────────

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        targetRow = coreCtnFindRow_(sheet, hi, taxNumberId);
        if (targetRow < 0) throw new Error('TAX_NUMBER_NOT_FOUND: ' + taxNumberId);
      } else {
        taxNumberId = coreCtnGenerateNextId_(sheet, hi);
        targetRow   = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('TAX_NUMBER_ID', taxNumberId);
        setCell('CUSTOMER_ID',   customerId);
        setCell('REGISTERED_AT', now);
      }

      setCell('TYPE_ID',    typeId);
      setCell('NUMBER',     number);
      if (payload.isActive !== undefined) {
        setCell('ACTIVE', coreCtnFlag_(payload.isActive));
      }
      setCell('UPDATED_AT', now);

      return taxNumberId;
    }
  );

  return { success: true, taxNumberId: resultId };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * 次の CTN-XXXX ID を採番する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @returns {string}  例: 'CTN-0001'
 */
function coreCtnGenerateNextId_(sheet, headerIndexes) {
  var pkPhysical = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', 'TAX_NUMBER_ID');
  var colIdx  = headerIndexes[pkPhysical];
  var maxNum  = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.indexOf(CTN_ID_PREFIX) === 0) {
        var num = parseInt(id.slice(CTN_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CTN_ID_PREFIX + String(maxNum + 1).padStart(CTN_ID_DIGITS, '0');
}

/**
 * TAX_NUMBER_ID 列から対象行の 1-indexed 行番号を返す。見つからなければ -1。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} taxNumberId
 * @returns {number}
 */
function coreCtnFindRow_(sheet, headerIndexes, taxNumberId) {
  var pkPhysical = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', 'TAX_NUMBER_ID');
  var colIdx  = headerIndexes[pkPhysical];
  if (!colIdx) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === taxNumberId) return i + 2;
  }
  return -1;
}

/**
 * 同じ顧客・同じ種別の行が既に存在するかを検索し、見つかった行番号を返す。
 * 見つからなければ -1。
 *
 * 更新時は selfTaxNumberId の行を除外して判定する（自分自身との重複を誤検知しない）。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @param {string} customerId
 * @param {string} typeId
 * @param {string|null} selfTaxNumberId  更新時は自身のID、新規時は null
 * @returns {number}
 */
function coreCtnFindDuplicateRow_(sheet, headerIndexes, customerId, typeId, selfTaxNumberId) {
  var pkPhysical  = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', 'TAX_NUMBER_ID');
  var cidPhysical = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', 'CUSTOMER_ID');
  var tidPhysical = getCoreSchemaV1HeaderName('CUSTOMER_TAX_NUMBERS', 'TYPE_ID');

  var pkCol  = headerIndexes[pkPhysical];
  var cidCol = headerIndexes[cidPhysical];
  var tidCol = headerIndexes[tidPhysical];

  if (!pkCol || !cidCol || !tidCol) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var pkValues  = sheet.getRange(2, pkCol,  lastRow - 1, 1).getValues();
  var cidValues = sheet.getRange(2, cidCol, lastRow - 1, 1).getValues();
  var tidValues = sheet.getRange(2, tidCol, lastRow - 1, 1).getValues();

  for (var i = 0; i < cidValues.length; i++) {
    var rowCid = String(cidValues[i][0] || '').trim();
    var rowTid = String(tidValues[i][0] || '').trim();
    var rowPk  = String(pkValues[i][0]  || '').trim();

    if (rowCid !== customerId || rowTid !== typeId) continue;
    if (selfTaxNumberId && rowPk === selfTaxNumberId) continue;  // 自分自身はスキップ
    return i + 2;
  }
  return -1;
}

/**
 * 指定テーブルに targetId が存在するか確認する。
 * writeAllowed:false のテーブル（CUSTOMERS 等）にも使用可能。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @param {string} idFieldKey  Registry フィールドキー
 * @param {string} targetId
 * @returns {boolean}
 */
function coreCtnCheckRefId_(ss, tableKey, idFieldKey, targetId) {
  var table   = getCoreSchemaV1Table(tableKey);
  var sheet   = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol = sheet.getLastColumn();
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

/**
 * typeId が番号種別マスタに実在し、ACTIVE=TRUE であるかを確認する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} typeId
 * @returns {boolean}
 */
function coreCtnCheckActiveTypeId_(ss, typeId) {
  var table   = getCoreSchemaV1Table('TAX_NUMBER_TYPES');
  var sheet   = getCoreSchemaV1Sheet(ss, 'TAX_NUMBER_TYPES');
  var lastCol = sheet.getLastColumn();
  if (!lastCol) return false;

  var rawHeaders = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  var pkPhysical     = getCoreSchemaV1HeaderName('TAX_NUMBER_TYPES', 'TYPE_ID');
  var activePhysical = getCoreSchemaV1HeaderName('TAX_NUMBER_TYPES', 'ACTIVE');

  var pkCol     = rawHeaders.indexOf(pkPhysical);
  var activeCol = rawHeaders.indexOf(activePhysical);
  if (pkCol < 0 || activeCol < 0) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return false;

  var dataRange = sheet.getRange(table.headerRowNumber + 1, 1, lastRow - table.headerRowNumber, lastCol).getValues();
  for (var i = 0; i < dataRange.length; i++) {
    var rowId     = String(dataRange[i][pkCol]     || '').trim();
    var rowActive = String(dataRange[i][activeCol] || '').trim();
    if (rowId === typeId) {
      return rowActive === 'TRUE' || rowActive === 'true' || rowActive === '1';
    }
  }
  return false;
}

/**
 * フラグフィールドを正規化する。'TRUE' / true / '1' → 'TRUE'、それ以外 → ''。
 *
 * @param {*} value
 * @returns {string}  'TRUE' or ''
 */
function coreCtnFlag_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return (s === 'TRUE' || s === 'true' || s === '1') ? 'TRUE' : '';
}
