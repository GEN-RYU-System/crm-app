/**
 * 仕入れ書き込み API（Core Schema V1 準拠）
 *
 * 物理ヘッダー名・選択肢値はすべて 00_CoreSchemaRegistry.js から解決する。
 * 物理文字列の直書き禁止。
 *
 * 公開関数:
 *   upsertCorePurchaseForFrontend(sessionId, payload)
 *   getCorePurchaseStatusOptionsForFrontend(sessionId)
 * 権限キー:
 *   書き込み: deal_edit
 *   読み取り: lead_view
 */

/* global getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   validateCoreSchemaV1TableForWrite, setEmailFromSession, checkPermission,
   getSpreadsheet, getSessionUser, recalculateOrderStatusById,
   withSheetWrite_, LockService */

var CORE_PURCHASE_WRITE_ID_PREFIX = 'PC-';
var CORE_PURCHASE_WRITE_ID_DIGITS = 5;

/** ステータス選択肢（スキーマキーの順序） */
var CORE_PURCHASE_STATUS_KEYS = ['NOT_ORDERED', 'ORDERED', 'CONFIRMED', 'PAID'];

// ─── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 仕入れ行を新規追加または更新する。
 *
 * payload のフィールド:
 *   orderId             {string}  必須
 *   purchaseId          {string}  省略時は新規採番
 *   orderedAt           {string}
 *   supplier            {string}
 *   supplierUrl         {string}
 *   quantity            {number|string}
 *   unitPrice           {number|string}
 *   amount              {number|string}
 *   shippingOrAgencyFee {number|string}
 *   carrier             {string}
 *   trackingNumber      {string}
 *   status              {string}  Core Schema V1 の PURCHASES.STATUS 値（日本語）
 *   note                {string}
 *
 * @param {string} sessionId
 * @param {{ orderId: string, purchaseId?: string }} payload
 * @returns {{ success: true, purchaseId: string }}
 */
function upsertCorePurchaseForFrontend(sessionId, payload) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!payload || typeof payload !== 'object') throw new Error('MISSING_PAYLOAD');
  var orderId = String(payload.orderId || '').trim();
  if (!orderId) throw new Error('MISSING_ORDER_ID');

  // ステータスが PAID のとき: 担当者IDをセッションから取得
  var paidStatus = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'PAID');
  var isPaid = String(payload.status || '').trim() === paidStatus;
  var staffId = null;
  if (isPaid) {
    var sessionUser = getSessionUser(sessionId);
    if (!sessionUser || !sessionUser.staffId) {
      throw new Error('STAFF_NOT_FOUND: ステータスが支払済みの場合、担当者IDが必要です。セッションを確認してください。');
    }
    staffId = sessionUser.staffId;
  }

  var now = new Date();
  var purchaseId = String(payload.purchaseId || '').trim();
  var isNew = !purchaseId;

  var resultPurchaseId = withSheetWrite_(
    { useLock: true, cacheTargets: [] },
    function() {
      var ss = getSpreadsheet();
      var result = validateCoreSchemaV1TableForWrite(ss, 'PURCHASES');
      var sheet = result.sheet;
      var hi    = result.headerIndexes;

      function setCell(fieldKey, value) {
        var header = getCoreSchemaV1HeaderName('PURCHASES', fieldKey);
        var colIdx = hi[header];
        if (colIdx) sheet.getRange(targetRow, colIdx).setValue(value);
      }

      var targetRow;

      if (!isNew) {
        // 既存行を PURCHASE_ID 列で特定する
        var pkPhysical = getCoreSchemaV1HeaderName('PURCHASES', 'PURCHASE_ID');
        var pkColIdx = hi[pkPhysical];
        if (!pkColIdx) throw new Error('PURCHASE_ID 列が見つかりません');
        var lastRow = sheet.getLastRow();
        targetRow = -1;
        if (lastRow >= 2) {
          var idValues = sheet.getRange(2, pkColIdx, lastRow - 1, 1).getValues();
          for (var i = 0; i < idValues.length; i++) {
            if (String(idValues[i][0] || '').trim() === purchaseId) {
              targetRow = i + 2;
              break;
            }
          }
        }
        if (targetRow < 0) throw new Error('PURCHASE_NOT_FOUND: ' + purchaseId);
      } else {
        // 新規: ID採番 → appendRow で行追加
        purchaseId = corePurchaseWriteGenerateNextId_(sheet, hi);
        var maxCols = sheet.getLastColumn();
        sheet.appendRow(new Array(maxCols).fill(''));
        targetRow = sheet.getLastRow();
        setCell('PURCHASE_ID',   purchaseId);
        setCell('ORDER_ID',      orderId);
        setCell('REGISTERED_AT', now);
      }

      // 共通フィールドの書き込み
      if (payload.orderedAt           !== undefined) setCell('ORDERED_AT',           corePurchaseWriteValue_(payload.orderedAt));
      if (payload.supplier            !== undefined) setCell('SUPPLIER',             corePurchaseWriteValue_(payload.supplier));
      if (payload.supplierUrl         !== undefined) setCell('SUPPLIER_URL',         corePurchaseWriteValue_(payload.supplierUrl));
      if (payload.quantity            !== undefined) setCell('QUANTITY',             corePurchaseWriteNumeric_(payload.quantity));
      if (payload.unitPrice           !== undefined) setCell('UNIT_PRICE',           corePurchaseWriteNumeric_(payload.unitPrice));
      if (payload.amount              !== undefined) setCell('AMOUNT',               corePurchaseWriteNumeric_(payload.amount));
      if (payload.shippingOrAgencyFee !== undefined) setCell('SHIPPING_OR_AGENCY_FEE', corePurchaseWriteNumeric_(payload.shippingOrAgencyFee));
      if (payload.carrier             !== undefined) setCell('CARRIER',             corePurchaseWriteValue_(payload.carrier));
      if (payload.trackingNumber      !== undefined) setCell('TRACKING_NUMBER',      corePurchaseWriteValue_(payload.trackingNumber));
      if (payload.status              !== undefined) setCell('STATUS',              corePurchaseWriteValue_(payload.status));
      if (payload.note                !== undefined) setCell('NOTE',                corePurchaseWriteValue_(payload.note));

      // PAID のときのみ支払日・支払者IDを記録する
      if (isPaid) {
        setCell('PAID_AT',    now);
        setCell('PAID_BY_ID', staffId);
      }

      setCell('UPDATED_AT', now);

      return purchaseId;
    }
  );

  // ロック解放後にオーダーステータスを再計算する
  recalculateOrderStatusById(orderId);

  return { success: true, purchaseId: resultPurchaseId };
}

/**
 * PURCHASES.STATUS の選択肢一覧を返す。
 * フロントでのハードコードを避けるため GAS 側で解決する。
 *
 * @param {string} sessionId
 * @returns {Array<{ key: string, label: string }>}
 */
function getCorePurchaseStatusOptionsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  return CORE_PURCHASE_STATUS_KEYS.map(function(key) {
    return {
      key:   key,
      label: getCoreSchemaV1Value('PURCHASES', 'STATUS', key)
    };
  });
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * PURCHASES シートの最大連番から次の PC-##### を返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} sheet
 * @param {Object} headerIndexes  1-indexed
 * @returns {string}
 */
function corePurchaseWriteGenerateNextId_(sheet, headerIndexes) {
  var pkPhysical = getCoreSchemaV1HeaderName('PURCHASES', 'PURCHASE_ID');
  var colIdx = headerIndexes[pkPhysical];
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colIdx) {
    sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (id.startsWith(CORE_PURCHASE_WRITE_ID_PREFIX)) {
        var num = parseInt(id.slice(CORE_PURCHASE_WRITE_ID_PREFIX.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return CORE_PURCHASE_WRITE_ID_PREFIX + String(maxNum + 1).padStart(CORE_PURCHASE_WRITE_ID_DIGITS, '0');
}

/**
 * 値を文字列に正規化する。null / undefined / Date は適切に変換する。
 *
 * @param {*} value
 * @returns {string}
 */
function corePurchaseWriteValue_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * 数値フィールドを正規化する。空・NaN は空文字を返す。
 *
 * @param {*} value
 * @returns {number|string}
 */
function corePurchaseWriteNumeric_(value) {
  if (value === null || value === undefined || value === '') return '';
  var n = Number(value);
  return isNaN(n) ? '' : n;
}
