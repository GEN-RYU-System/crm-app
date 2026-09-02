/**
 * 99_DevShipmentLineApiTest.js
 *
 * getCoreShipmentLinesForFrontend / getProductExportDefaultsForFrontend /
 * upsertCoreShipmentLineForFrontend の DEV 動作確認テスト。
 *
 * 実行: clasp run runShipmentLineApiTest
 *
 * ★ DEV環境専用
 * ★ テストデータは削除しない
 */

/* global getEnvironment, getSpreadsheet, createSession,
   getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   getCoreShipmentLinesForFrontend, getProductExportDefaultsForFrontend,
   upsertCoreShipmentLineForFrontend */

/**
 * 発送明細 API 統合テスト（DEV専用）
 * @returns {Object}
 */
function runShipmentLineApiTest() {
  if (getEnvironment() !== 'development') {
    throw new Error('runShipmentLineApiTest は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var results = {};

  // ─── セッション取得 ────────────────────────────────────────────────────
  var sessionId = _slTestGetSession_(ss);
  results.sessionOk = Boolean(sessionId);

  // ─── テスト準備: 既存の発送IDと商品IDを取得 ────────────────────────────
  var shipmentId = _slTestGetFirstShipmentId_(ss);
  var ownProductId = _slTestGetFirstOwnProductId_(ss);
  results.setup = { shipmentId: shipmentId, ownProductId: ownProductId };

  if (!shipmentId || !ownProductId) {
    results.error = 'SETUP_FAILED: 発送または自社商品データが存在しません';
    return results;
  }

  // ─── テスト(a): upsertCoreShipmentLineForFrontend（saveToProductMaster=false）────
  var rowCountBefore = _slTestGetShipmentLineCount_(ss);
  var upsertA = upsertCoreShipmentLineForFrontend(sessionId, {
    shipmentId:     shipmentId,
    ownProductId:   ownProductId,
    quantity:       1,
    saveToProductMaster: false
  });
  var rowCountAfterA = _slTestGetShipmentLineCount_(ss);
  results.testA_upsertNoMaster = {
    success:              upsertA.success,
    shipmentLineId:       upsertA.shipmentLineId,
    savedToProductMaster: upsertA.savedToProductMaster,
    failedStep:           upsertA.failedStep,
    rowCountBefore:       rowCountBefore,
    rowCountAfter:        rowCountAfterA,
    rowAdded:             rowCountAfterA - rowCountBefore
  };

  // 監査（a後）
  results.auditAfterA = { mismatches: _slTestAudit_(ss, ['SHIPMENT_LINES', 'PRODUCT_PACKAGES']) };

  // ─── テスト(b): getCoreShipmentLinesForFrontend（名称結合確認）────────────
  var lines = getCoreShipmentLinesForFrontend(sessionId, shipmentId);
  var insertedLine = lines.filter(function(l) { return l.shipmentLineId === upsertA.shipmentLineId; })[0] || null;
  results.testB_getLines = {
    totalCount:    lines.length,
    insertedLine:  insertedLine ? {
      shipmentLineId:  insertedLine.shipmentLineId,
      ownProductId:    insertedLine.ownProductId,
      ownProductNameEn: insertedLine.ownProductNameEn,
      ownProductNameJa: insertedLine.ownProductNameJa,
      quantity:        insertedLine.quantity
    } : null,
    namesJoined: insertedLine ? (insertedLine.ownProductNameEn !== '' || insertedLine.ownProductNameJa !== '') : false
  };

  // ─── テスト(c): getProductExportDefaultsForFrontend ──────────────────────
  var defaults = getProductExportDefaultsForFrontend(sessionId, { ownProductId: ownProductId });
  results.testC_exportDefaults = {
    found:         defaults.found,
    itemId:        defaults.itemId,
    htsCodeId:     defaults.htsCodeId,
    materialId:    defaults.materialId,
    originCountry: defaults.originCountry
  };

  // ─── テスト(d): upsertCoreShipmentLineForFrontend（saveToProductMaster=true）────
  var upsertD = upsertCoreShipmentLineForFrontend(sessionId, {
    shipmentId:     shipmentId,
    ownProductId:   ownProductId,
    originCountry:  'JP',
    quantity:       2,
    saveToProductMaster: true
  });
  results.testD_upsertWithMaster = {
    success:              upsertD.success,
    shipmentLineId:       upsertD.shipmentLineId,
    savedToProductMaster: upsertD.savedToProductMaster,
    failedStep:           upsertD.failedStep
  };

  // 監査（d後）
  results.auditAfterD = { mismatches: _slTestAudit_(ss, ['SHIPMENT_LINES', 'PRODUCT_PACKAGES']) };

  // ─── テスト(e): sharedProductId と ownProductId 両方指定 → 拒否確認 ─────
  var rowCountBeforeE = _slTestGetShipmentLineCount_(ss);
  var errE = null;
  try {
    upsertCoreShipmentLineForFrontend(sessionId, {
      shipmentId:     shipmentId,
      sharedProductId: 'PRODUCT_NONEXISTENT_TEST',
      ownProductId:   ownProductId,
      quantity:       1
    });
    errE = 'NOT_REJECTED';
  } catch (e) {
    errE = e.message.indexOf('BOTH_PRODUCT_IDS_SET') !== -1 ? 'REJECTED_OK' : 'UNEXPECTED_ERROR: ' + e.message;
  }
  var rowCountAfterE = _slTestGetShipmentLineCount_(ss);
  results.testE_bothProductIdsRejected = {
    result:        errE,
    rowCountBefore: rowCountBeforeE,
    rowCountAfter:  rowCountAfterE,
    rowsUnchanged:  rowCountAfterE === rowCountBeforeE
  };

  // 監査（e後）
  results.auditAfterE = { mismatches: _slTestAudit_(ss, ['SHIPMENT_LINES', 'PRODUCT_PACKAGES']) };

  return results;
}

// ─── テスト補助関数 ───────────────────────────────────────────────────────────

function _slTestGetSession_(ss) {
  var staffTable  = getCoreSchemaV1Table('STAFF');
  var staffSheet  = getCoreSchemaV1Sheet(ss, 'STAFF');
  var lastCol     = staffSheet.getLastColumn();
  var headers     = staffSheet
    .getRange(staffTable.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  var idCol     = headers.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID'));
  var statusCol = headers.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STATUS'));
  var roleCol   = headers.indexOf(getCoreSchemaV1HeaderName('STAFF', 'ROLE'));

  var statusActive  = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  var dealEditRoles = [
    getCoreSchemaV1Value('STAFF', 'ROLE', 'OWNER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'LEADER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'SALES')
  ];

  var lastRow = staffSheet.getLastRow();
  var rows    = staffSheet
    .getRange(staffTable.headerRowNumber + 1, 1, lastRow - staffTable.headerRowNumber, lastCol)
    .getValues();

  var staffId = null;
  for (var i = 0; i < rows.length; i++) {
    var status = String(rows[i][statusCol] || '').trim();
    var role   = String(rows[i][roleCol]   || '').trim();
    if (status === statusActive && dealEditRoles.indexOf(role) !== -1) {
      var sid = String(rows[i][idCol] || '').trim();
      if (sid) { staffId = sid; break; }
    }
  }
  if (!staffId) throw new Error('[SETUP] Active staff with deal_edit role not found');
  return createSession(staffId);
}

function _slTestGetFirstShipmentId_(ss) {
  var table   = getCoreSchemaV1Table('SHIPMENTS');
  var sheet   = getCoreSchemaV1Sheet(ss, 'SHIPMENTS');
  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return null;
  var lastCol = sheet.getLastColumn();
  var headers = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  var idColName = getCoreSchemaV1HeaderName('SHIPMENTS', 'SHIPMENT_ID');
  var idCol = headers.indexOf(idColName);
  if (idCol < 0) return null;
  var values = sheet.getRange(table.headerRowNumber + 1, idCol + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    if (id) return id;
  }
  return null;
}

function _slTestGetFirstOwnProductId_(ss) {
  var table   = getCoreSchemaV1Table('OWN_PRODUCTS');
  var sheet   = getCoreSchemaV1Sheet(ss, 'OWN_PRODUCTS');
  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return null;
  var lastCol = sheet.getLastColumn();
  var headers = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  var idColName = getCoreSchemaV1HeaderName('OWN_PRODUCTS', 'OWN_PRODUCT_ID');
  var idCol = headers.indexOf(idColName);
  if (idCol < 0) return null;
  var values = sheet.getRange(table.headerRowNumber + 1, idCol + 1, lastRow - table.headerRowNumber, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    if (id) return id;
  }
  return null;
}

function _slTestGetShipmentLineCount_(ss) {
  var sheet = getCoreSchemaV1Sheet(ss, 'SHIPMENT_LINES');
  var lastRow = sheet.getLastRow();
  var headerRow = getCoreSchemaV1Table('SHIPMENT_LINES').headerRowNumber;
  return Math.max(0, lastRow - headerRow);
}

function _slTestAudit_(ss, tableKeys) {
  var total = 0;
  tableKeys.forEach(function(key) {
    try {
      var table   = getCoreSchemaV1Table(key);
      var sheet   = getCoreSchemaV1Sheet(ss, key);
      var lastCol = sheet.getLastColumn();
      if (!lastCol) return;
      var actual  = sheet
        .getRange(table.headerRowNumber, 1, 1, lastCol)
        .getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); });
      Object.values(table.headers).forEach(function(h) {
        if (actual.indexOf(h) === -1) total++;
      });
    } catch (e) {
      total++;
    }
  });
  return total;
}
