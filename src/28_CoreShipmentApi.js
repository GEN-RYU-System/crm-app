/**
 * Shipment write API (Core Schema V1 compliant)
 *
 * Physical header names and option values are all resolved from 00_CoreSchemaRegistry.js.
 * Direct use of physical strings is prohibited.
 *
 * Public functions:
 *   upsertCoreShipmentForFrontend(sessionId, payload)
 * Permission key:
 *   write: deal_edit
 */

/* global getCoreSchemaV1HeaderName,
   validateCoreSchemaV1TableForWrite, setEmailFromSession, checkPermission,
   getSpreadsheet, getSessionUser, recalculateOrderStatusById,
   withSheetWrite_, LockService */

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
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        targetRow = sheet.getLastRow();
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
