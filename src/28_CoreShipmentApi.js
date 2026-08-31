/**
 * Shipment write API (Core Schema V1 compliant)
 *
 * Physical header names and option values are all resolved from 00_CoreSchemaRegistry.js.
 * Direct use of physical strings is prohibited.
 *
 * Public functions:
 *   upsertCoreShipmentForFrontend(sessionId, payload)
 *   advanceCoreShipmentStageForFrontend(sessionId, orderId)
 * Permission key:
 *   write: deal_edit
 */

/* global getCoreSchemaV1HeaderName,
   validateCoreSchemaV1TableForWrite, setEmailFromSession, checkPermission,
   getSpreadsheet, getSessionUser, recalculateOrderStatusById,
   withSheetWrite_, LockService,
   DriveApp, Utilities, getShipmentFileFolderId */

var CORE_SHIPMENT_WRITE_ID_PREFIX = 'SH-';
var CORE_SHIPMENT_WRITE_ID_DIGITS = 4;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a new shipment row or update an existing one.
 *
 * payload fields:
 *   orderId                  {string}         required
 *   shipmentId               {string}         optional; new ID is assigned when omitted
 *   boxNumber                {number|string}
 *   shippingMethod           {string}
 *   shippedAt                {string}
 *   trackingNumber           {string}
 *   length                   {number|string}
 *   width                    {number|string}
 *   height                   {number|string}
 *   weight                   {number|string}
 *   estimatedShippingFee     {number|string}
 *   inspection               {string}  'TRUE' or ''
 *   packing                  {string}  'TRUE' or ''
 *   storage                  {string}  'TRUE' or ''
 *   pickupRequest            {string}  'TRUE' or ''
 *   notification             {string}  'TRUE' or ''
 *   note                     {string}
 *
 * Auto-set:
 *   registeredAt  (new rows only)
 *   updatedAt     (always)
 *   shippingAssigneeId  (from session)
 *
 * @param {string} sessionId
 * @param {{ orderId: string, shipmentId?: string }} payload
 * @returns {{ success: true, shipmentId: string }}
 */
function upsertCoreShipmentForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');
  var orderId = String(payload.orderId || '').trim();
  if (!orderId) throw new Error('MISSING_ORDER_ID');

  // Resolve shipping assignee from session
  var sessionUser = getSessionUser(sessionId);
  if (!sessionUser || !sessionUser.staffId) {
    throw new Error('STAFF_NOT_FOUND: session must have a valid staffId.');
  }
  var staffId = sessionUser.staffId;

  var now = new Date();
  var shipmentId = String(payload.shipmentId || '').trim();
  var isNew = !shipmentId;

  var resultShipmentId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'SHIPMENTS');
      var sheet = result.sheet;
      var hi    = result.headerIndexes;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('SHIPMENTS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        // Locate the existing row by SHIPMENT_ID
        var pkPhysical = getCoreSchemaV1HeaderName('SHIPMENTS', 'SHIPMENT_ID');
        var pkColIdx = hi[pkPhysical];
        if (!pkColIdx) throw new Error('SHIPMENT_ID column not found');
        var lastRow = sheet.getLastRow();
        targetRow = -1;
        if (lastRow >= 2) {
          var idValues = sheet.getRange(2, pkColIdx, lastRow - 1, 1).getValues();
          for (var i = 0; i < idValues.length; i++) {
            if (String(idValues[i][0] || '').trim() === shipmentId) {
              targetRow = i + 2;
              break;
            }
          }
        }
        if (targetRow < 0) throw new Error('SHIPMENT_NOT_FOUND: ' + shipmentId);
      } else {
        // New row: assign ID, append blank row
        shipmentId = coreShipmentWriteGenerateNextId_(sheet, hi);
        targetRow = sheet.getLastRow() + 1;
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        setCell('SHIPMENT_ID',   shipmentId);
        setCell('ORDER_ID',      orderId);
        setCell('REGISTERED_AT', now);
      }

      // Common field writes
      if (payload.boxNumber            !== undefined) setCell('BOX_NUMBER',            coreShipmentWriteNumeric_(payload.boxNumber));
      if (payload.shippingMethod       !== undefined) setCell('SHIPPING_METHOD',       coreShipmentWriteValue_(payload.shippingMethod));
      if (payload.shippedAt            !== undefined) setCell('SHIPPED_AT',            coreShipmentWriteValue_(payload.shippedAt));
      if (payload.trackingNumber       !== undefined) setCell('TRACKING_NUMBER',       coreShipmentWriteValue_(payload.trackingNumber));
      if (payload.length               !== undefined) setCell('LENGTH',                coreShipmentWriteNumeric_(payload.length));
      if (payload.width                !== undefined) setCell('WIDTH',                 coreShipmentWriteNumeric_(payload.width));
      if (payload.height               !== undefined) setCell('HEIGHT',                coreShipmentWriteNumeric_(payload.height));
      if (payload.weight               !== undefined) setCell('WEIGHT',                coreShipmentWriteNumeric_(payload.weight));
      if (payload.estimatedShippingFee !== undefined) setCell('ESTIMATED_SHIPPING_FEE', coreShipmentWriteNumeric_(payload.estimatedShippingFee));
      if (payload.inspection           !== undefined) setCell('INSPECTION',            coreShipmentWriteFlag_(payload.inspection));
      if (payload.packing              !== undefined) setCell('PACKING',               coreShipmentWriteFlag_(payload.packing));
      if (payload.storage              !== undefined) setCell('STORAGE',               coreShipmentWriteFlag_(payload.storage));
      if (payload.pickupRequest        !== undefined) setCell('PICKUP_REQUEST',        coreShipmentWriteFlag_(payload.pickupRequest));
      if (payload.notification         !== undefined) setCell('NOTIFICATION',          coreShipmentWriteFlag_(payload.notification));
      if (payload.note                 !== undefined) setCell('NOTE',                  coreShipmentWriteValue_(payload.note));

      // Always set assignee and updatedAt
      setCell('SHIPPING_ASSIGNEE_ID', staffId);
      setCell('UPDATED_AT', now);

      return shipmentId;
    }
  );

  // Recalculate order status after lock release
  recalculateOrderStatusById(orderId);

  return { success: true, shipmentId: resultShipmentId };
}

/**
 * 発送段階を1ステップ前進させる。
 *
 * 段階判定ルール（PACKING・STORAGE は使用しない）:
 *   PREPARING    : INSPECTION が空
 *   LABELING     : INSPECTION あり、TRACKING_NUMBER が空
 *   AWAITING_PICKUP : TRACKING_NUMBER あり、PICKUP_REQUEST が空
 *   SHIPPED      : PICKUP_REQUEST あり、NOTIFICATION が空
 *   DONE         : NOTIFICATION あり
 *
 * @param {string} sessionId
 * @param {string} orderId
 * @returns {{ success: true, newStage: string, needsInput?: true }
 *           | { success: false, error: string }}
 */
function advanceCoreShipmentStageForFrontend(sessionId, orderId) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  orderId = String(orderId || '').trim();
  if (!orderId) throw new Error('MISSING_ORDER_ID');

  // ヘッダー名を Registry から取得
  var orderIdHeader      = getCoreSchemaV1HeaderName('SHIPMENTS', 'ORDER_ID');
  var inspectionHeader   = getCoreSchemaV1HeaderName('SHIPMENTS', 'INSPECTION');
  var trackingHeader     = getCoreSchemaV1HeaderName('SHIPMENTS', 'TRACKING_NUMBER');
  var pickupHeader       = getCoreSchemaV1HeaderName('SHIPMENTS', 'PICKUP_REQUEST');
  var notificationHeader = getCoreSchemaV1HeaderName('SHIPMENTS', 'NOTIFICATION');
  var updatedAtHeader    = getCoreSchemaV1HeaderName('SHIPMENTS', 'UPDATED_AT');

  var STAGE_PRIORITY = ['NOT_STARTED', 'PREPARING', 'LABELING', 'AWAITING_PICKUP', 'SHIPPED', 'DONE'];

  /** 発送行1行の段階と対象列インデックスを返す */
  function resolveRowStageAndTarget(row, hi) {
    var inspection   = String(row[hi[inspectionHeader]   - 1] || '').trim();
    var tracking     = String(row[hi[trackingHeader]     - 1] || '').trim();
    var pickup       = String(row[hi[pickupHeader]       - 1] || '').trim();
    var notification = String(row[hi[notificationHeader] - 1] || '').trim();

    if (notification) return { stage: 'DONE',            writeHeader: null };
    if (pickup)       return { stage: 'SHIPPED',         writeHeader: notificationHeader };
    if (tracking)     return { stage: 'AWAITING_PICKUP', writeHeader: pickupHeader };
    if (inspection)   return { stage: 'LABELING',        writeHeader: trackingHeader };
    return           { stage: 'PREPARING',               writeHeader: inspectionHeader };
  }

  var result = withSheetWrite_(
    { useLock: true, cacheTargets: [{ indexKey: 'CORE_ORDERS_CACHE_INDEX_V4', prefix: 'CORE_ORDERS_CACHE_V4_' }] },
    function() {
      var ss = getSpreadsheet();
      var validated = validateCoreSchemaV1TableForWrite(ss, 'SHIPMENTS');
      var sheet = validated.sheet;
      var hi    = validated.headerIndexes; // 1-indexed

      var pkPhysical = getCoreSchemaV1HeaderName('SHIPMENTS', 'SHIPMENT_ID');
      var orderIdColIdx = hi[orderIdHeader];
      if (!orderIdColIdx) throw new Error('ORDER_ID column not found in SHIPMENTS');

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return { success: false, error: 'No shipment rows' };
      }

      // ORDER_ID 列を全件読み、対象行インデックスを収集
      var orderIdValues = sheet.getRange(2, orderIdColIdx, lastRow - 1, 1).getValues();
      var targetRowIndexes = [];
      for (var i = 0; i < orderIdValues.length; i++) {
        if (String(orderIdValues[i][0] || '').trim() === orderId) {
          targetRowIndexes.push(i + 2); // 1-indexed シート行番号
        }
      }

      if (targetRowIndexes.length === 0) {
        return { success: false, error: 'No shipment rows' };
      }

      // 全列を読み、段階を判定
      var lastCol = sheet.getLastColumn();
      var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      var minStageIdx = STAGE_PRIORITY.length - 1;
      var minSheetRow = -1;

      for (var j = 0; j < targetRowIndexes.length; j++) {
        var sheetRow = targetRowIndexes[j];
        var rowData  = allData[sheetRow - 2];
        var stageResult = resolveRowStageAndTarget(rowData, hi);
        var stageIdx = STAGE_PRIORITY.indexOf(stageResult.stage);
        if (stageIdx < minStageIdx) {
          minStageIdx = stageIdx;
          minSheetRow = sheetRow;
        }
      }

      var currentStage = STAGE_PRIORITY[minStageIdx];

      if (currentStage === 'DONE') {
        return { success: false, error: 'Already DONE' };
      }
      if (currentStage === 'NOT_STARTED') {
        return { success: false, error: 'No shipment rows' };
      }

      // LABELING は入力が必要（TRACKING_NUMBER はユーザー入力）
      if (currentStage === 'LABELING') {
        return { success: true, needsInput: true, newStage: 'LABELING' };
      }

      // 書き込み対象行の段階を再取得
      var minRowData    = allData[minSheetRow - 2];
      var minStageInfo  = resolveRowStageAndTarget(minRowData, hi);
      var writeHeader   = minStageInfo.writeHeader;

      if (!writeHeader) {
        return { success: false, error: 'No writable field for stage: ' + currentStage };
      }

      var writeColIdx = hi[writeHeader];
      if (!writeColIdx) {
        throw new Error('Column not found: ' + writeHeader);
      }

      // INSPECTION / PICKUP_REQUEST / NOTIFICATION に 'TRUE' を書き込む
      sheet.getRange(minSheetRow, writeColIdx).setValue('TRUE');

      // UPDATED_AT を更新
      var updatedAtColIdx = hi[updatedAtHeader];
      if (updatedAtColIdx) {
        sheet.getRange(minSheetRow, updatedAtColIdx).setValue(new Date());
      }

      var nextStage;
      if (currentStage === 'PREPARING')       nextStage = 'LABELING';
      else if (currentStage === 'AWAITING_PICKUP') nextStage = 'SHIPPED';
      else if (currentStage === 'SHIPPED')    nextStage = 'DONE';
      else nextStage = currentStage;

      return { success: true, newStage: nextStage };
    }
  );

  if (result.success && !result.needsInput) {
    // ロック解放後にオーダーステータスを再計算
    recalculateOrderStatusById(orderId);
  }

  return result;
}

/**
 * Upload a PDF file (ラベル or インボイス) to Google Drive and write the URL
 * to the corresponding SHIPMENTS column.
 *
 * payload fields:
 *   shipmentId   {string}  required
 *   fileType     {string}  'label' | 'invoice'  required
 *   fileBase64   {string}  required  base64-encoded PDF data
 *
 * Prerequisites:
 *   - TRACKING_NUMBER must be non-empty
 *   - SHIPMENT_FILE_FOLDER_ID must be set in Script Properties
 *
 * Side effect:
 *   If both LABEL_URL and INVOICE_URL are filled after writing, sets STORAGE='TRUE'.
 *
 * @param {string} sessionId
 * @param {{ shipmentId: string, fileType: string, fileBase64: string }} payload
 * @returns {{ success: true, url: string }}
 */
function uploadCoreShipmentFileForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');
  var shipmentId = String(payload.shipmentId || '').trim();
  if (!shipmentId) throw new Error('MISSING_SHIPMENT_ID');
  var fileType = String(payload.fileType || '').trim().toLowerCase();
  if (fileType !== 'label' && fileType !== 'invoice') {
    throw new Error('INVALID_FILE_TYPE: must be label or invoice');
  }
  var fileBase64 = String(payload.fileBase64 || '').trim();
  if (!fileBase64) throw new Error('MISSING_FILE_DATA');

  var folderId = getShipmentFileFolderId();
  if (!folderId) throw new Error('SHIPMENT_FILE_FOLDER_ID not configured');

  var fileUrl = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'SHIPMENTS');
      var sheet = result.sheet;
      var hi    = result.headerIndexes;

      var targetRow;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('SHIPMENTS', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      function getCell(fieldKey) {
        var header = getCoreSchemaV1HeaderName('SHIPMENTS', fieldKey);
        var colIdx = hi[header];
        if (!colIdx) return '';
        return String(sheet.getRange(targetRow, colIdx).getValue() || '').trim();
      }

      // Locate the row by SHIPMENT_ID
      var pkPhysical = getCoreSchemaV1HeaderName('SHIPMENTS', 'SHIPMENT_ID');
      var pkColIdx = hi[pkPhysical];
      if (!pkColIdx) throw new Error('SHIPMENT_ID column not found');
      var lastRow = sheet.getLastRow();
      targetRow = -1;
      if (lastRow >= 2) {
        var idValues = sheet.getRange(2, pkColIdx, lastRow - 1, 1).getValues();
        for (var i = 0; i < idValues.length; i++) {
          if (String(idValues[i][0] || '').trim() === shipmentId) {
            targetRow = i + 2;
            break;
          }
        }
      }
      if (targetRow < 0) throw new Error('SHIPMENT_NOT_FOUND: ' + shipmentId);

      // TRACKING_NUMBER must be present before uploading files
      var trackingNumber = getCell('TRACKING_NUMBER');
      if (!trackingNumber) {
        throw new Error('TRACKING_NUMBER_REQUIRED: set a tracking number before uploading files');
      }

      var orderId = getCell('ORDER_ID');

      // File name: {orderId}_{trackingNumber}_{label|invoice}.pdf
      var rawName = orderId + '_' + trackingNumber + '_' + fileType + '.pdf';
      var safeName = rawName.replace(/[/\\?%*:|"<>]/g, '_');

      // Upload to Drive
      var blob = Utilities.newBlob(Utilities.base64Decode(fileBase64), 'application/pdf', safeName);
      var folder = DriveApp.getFolderById(folderId);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var url = file.getUrl();

      // Write URL to LABEL_URL or INVOICE_URL
      var urlFieldKey = fileType === 'label' ? 'LABEL_URL' : 'INVOICE_URL';
      setCell(urlFieldKey, url);

      // If both URLs are now filled, set STORAGE='TRUE'
      var labelUrl   = fileType === 'label'   ? url : getCell('LABEL_URL');
      var invoiceUrl = fileType === 'invoice' ? url : getCell('INVOICE_URL');
      if (labelUrl && invoiceUrl) {
        setCell('STORAGE', 'TRUE');
      }

      setCell('UPDATED_AT', new Date());

      return url;
    }
  );

  return { success: true, url: fileUrl };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the next SH-#### ID by scanning the maximum existing sequence number.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @returns {string}
 */
function coreShipmentWriteGenerateNextId_(sheet, headerIndexes) {
  var pkPhysical = getCoreSchemaV1HeaderName('SHIPMENTS', 'SHIPMENT_ID');
  var colIdx = headerIndexes[pkPhysical];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.startsWith(CORE_SHIPMENT_WRITE_ID_PREFIX)) {
        var num = parseInt(id.slice(CORE_SHIPMENT_WRITE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_SHIPMENT_WRITE_ID_PREFIX + String(maxNum + 1).padStart(CORE_SHIPMENT_WRITE_ID_DIGITS, '0');
}

/**
 * Normalizes a value to a string. null / undefined / Date are converted appropriately.
 *
 * @param {*} value
 * @returns {string}
 */
function coreShipmentWriteValue_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * Normalizes a numeric field. Empty or NaN returns an empty string.
 *
 * @param {*} value
 * @returns {number|string}
 */
function coreShipmentWriteNumeric_(value) {
  if (value === null || value === undefined || value === '') return '';
  var n = Number(value);
  return isNaN(n) ? '' : n;
}

/**
 * Normalizes a two-value flag field. Accepts 'TRUE', true, or any truthy
 * non-empty string as true; everything else is stored as ''.
 *
 * @param {*} value
 * @returns {string}  'TRUE' or ''
 */
function coreShipmentWriteFlag_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return (s === 'TRUE' || s === 'true' || s === '1') ? 'TRUE' : '';
}
