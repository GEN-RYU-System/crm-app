/**
 * 99_DevProductPackageApiTest.js
 *
 * getCoreSharedProducts / getCoreProductPackages / upsertCoreProductPackage のDEV動作確認テスト。
 *
 * 実行: clasp run runProductPackageApiTest
 *
 * ★ DEV環境専用
 * ★ テストデータは削除しない
 * ★ PRODUCTS への書き込みは行わない
 */

/* global getEnvironment, getSpreadsheet, createSession,
   getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   getCoreSharedProductsForFrontend, getCoreProductPackagesForFrontend,
   upsertCoreProductPackageForFrontend, runCoreSchemaConformanceAuditSilent_ */

/**
 * 商品荷姿 API 統合テスト（DEV専用）
 * @returns {Object}
 */
function runProductPackageApiTest() {
  if (getEnvironment() !== 'development') {
    throw new Error('runProductPackageApiTest is available only in development');
  }

  var ss = getSpreadsheet();
  var results = {};

  // ─── セッション取得: deal_edit ロールの有効スタッフ ───
  var sessionId = _ppTestGetSession_(ss);
  results.sessionOk = Boolean(sessionId);

  // ─── テスト1: getCoreSharedProductsForFrontend ───
  var products = getCoreSharedProductsForFrontend(sessionId);
  results.sharedProducts = {
    count: products.length,
    first3: products.slice(0, 3).map(function(p) {
      return { productId: p.productId, englishTitle: p.englishTitle, japaneseTitle: p.japaneseTitle };
    })
  };

  // ─── テスト2: upsertCoreProductPackageForFrontend (新規登録) ───
  var testProductId = products.length > 0 ? products[0].productId : '';
  var upsertResult = upsertCoreProductPackageForFrontend(sessionId, {
    sharedProductId: testProductId,
    boxPackageId:    'PKG-0001',
    isActive:        'TRUE'
  });
  results.upsertNew = upsertResult;

  // ─── 監査: 登録後にヘッダー破損がないか ───
  var audit1 = runCoreSchemaConformanceAuditSilent_(['PRODUCT_PACKAGES']);
  results.auditAfterUpsert = { mismatches: audit1.totalMismatches };

  // ─── テスト3: getCoreProductPackagesForFrontend (結合確認) ───
  var ppList = getCoreProductPackagesForFrontend(sessionId);
  var inserted = ppList.filter(function(r) { return r.productPackageId === upsertResult.productPackageId; })[0] || null;
  results.getProductPackages = {
    count: ppList.length,
    insertedRecord: inserted ? {
      productPackageId:          inserted.productPackageId,
      sharedProductId:           inserted.sharedProductId,
      sharedProductEnglishTitle: inserted.sharedProductEnglishTitle,
      boxPackageId:              inserted.boxPackageId,
      boxPackageName:            inserted.boxPackageName,
      isActive:                  inserted.isActive
    } : null
  };

  // ─── テスト4: 異常系(a) sharedProductId + ownProductId 同時指定 ───
  var errA = null;
  try {
    upsertCoreProductPackageForFrontend(sessionId, {
      sharedProductId: testProductId,
      ownProductId:    'OWN-0001',
      isActive:        'TRUE'
    });
    errA = 'NOT_REJECTED';
  } catch (e) {
    errA = e.message.indexOf('PRODUCT_ID_CONFLICT') !== -1 ? 'REJECTED_OK' : 'UNEXPECTED_ERROR: ' + e.message;
  }
  results.errorA_bothProductIds = errA;

  // ─── テスト5: 異常系(b) 存在しない荷姿ID ───
  var errB = null;
  try {
    upsertCoreProductPackageForFrontend(sessionId, {
      sharedProductId: testProductId,
      casePackageId:   'PKG-NONEXISTENT-9999',
      isActive:        'TRUE'
    });
    errB = 'NOT_REJECTED';
  } catch (e) {
    errB = e.message.indexOf('PACKAGE_NOT_FOUND') !== -1 ? 'REJECTED_OK' : 'UNEXPECTED_ERROR: ' + e.message;
  }
  results.errorB_nonexistentPackageId = errB;

  return results;
}

/**
 * テスト用セッションIDを返す（deal_edit ロールの有効スタッフ）
 * @returns {string}
 */
function _ppTestGetSession_(ss) {
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
  var rows    = staffSheet.getRange(staffTable.headerRowNumber + 1, 1, lastRow - staffTable.headerRowNumber, lastCol).getValues();

  var staffId = null;
  for (var i = 0; i < rows.length; i++) {
    var status = String(rows[i][statusCol] || '').trim();
    var role   = String(rows[i][roleCol]   || '').trim();
    if (status === statusActive && dealEditRoles.indexOf(role) !== -1) {
      var sid = String(rows[i][idCol] || '').trim();
      if (sid) { staffId = sid; break; }
    }
  }
  if (!staffId) throw new Error('[SETUP] No active staff with deal_edit role found');

  return createSession(staffId);
}

/**
 * 指定テーブルのみの簡易監査（テスト用）
 * @param {string[]} tableKeys
 * @returns {{ totalMismatches: number }}
 */
function runCoreSchemaConformanceAuditSilent_(tableKeys) {
  var ss = getSpreadsheet();
  var total = 0;
  tableKeys.forEach(function(key) {
    try {
      var table  = getCoreSchemaV1Table(key);
      var sheet  = getCoreSchemaV1Sheet(ss, key);
      var lastCol = sheet.getLastColumn();
      if (!lastCol) return;
      var actual  = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) { return String(h).trim(); });
      var defined = Object.values(table.headers);
      defined.forEach(function(h) {
        if (actual.indexOf(h) === -1) total++;
      });
    } catch (e) {
      total++;
    }
  });
  return { totalMismatches: total };
}
