/**
 * 99_DevOwnMasterApiTest.js
 *
 * getCoreOwnCategories / getCoreOwnWorks / getCoreOwnManufacturers /
 * upsertCoreOwnCategory / upsertCoreOwnWork / upsertCoreOwnManufacturer のDEV動作確認テスト。
 *
 * 実行: clasp run runOwnMasterApiTest
 *
 * ★ DEV環境専用
 * ★ テストデータは削除しない
 */

/* global getEnvironment, getSpreadsheet, createSession,
   getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   getCoreOwnCategoriesForFrontend, getCoreOwnWorksForFrontend, getCoreOwnManufacturersForFrontend,
   upsertCoreOwnCategoryForFrontend, upsertCoreOwnWorkForFrontend, upsertCoreOwnManufacturerForFrontend,
   runCoreSchemaConformanceAuditSilent_ */

/**
 * 自社マスタ API 統合テスト（DEV専用）
 * @returns {Object}
 */
function runOwnMasterApiTest() {
  if (getEnvironment() !== 'development') {
    throw new Error('runOwnMasterApiTest is available only in development');
  }

  var ss = getSpreadsheet();
  var results = {};

  // ─── セッション取得: deal_edit ロールの有効スタッフ ───
  var sessionId = _ownMasterTestGetSession_(ss);
  results.sessionOk = Boolean(sessionId);

  // ─── テスト1: getCoreOwnCategoriesForFrontend ───
  var categories = getCoreOwnCategoriesForFrontend(sessionId);
  results.getCategories = { count: categories.length };

  // ─── テスト2: upsertCoreOwnCategoryForFrontend (新規登録) ───
  var upsertCatResult = upsertCoreOwnCategoryForFrontend(sessionId, {
    nameEn:   'DEV Test Category EN',
    nameJa:   'DEVテスト大分類',
    isActive: 'TRUE'
  });
  results.upsertCategory = upsertCatResult;

  // ─── テスト3: getCoreOwnWorksForFrontend ───
  var works = getCoreOwnWorksForFrontend(sessionId);
  results.getWorks = { count: works.length };

  // ─── テスト4: upsertCoreOwnWorkForFrontend (新規登録) ───
  var upsertWorkResult = upsertCoreOwnWorkForFrontend(sessionId, {
    nameEn:   'DEV Test Work EN',
    nameJa:   'DEVテスト作品',
    isActive: 'TRUE'
  });
  results.upsertWork = upsertWorkResult;

  // ─── テスト5: getCoreOwnManufacturersForFrontend ───
  var manufacturers = getCoreOwnManufacturersForFrontend(sessionId);
  results.getManufacturers = { count: manufacturers.length };

  // ─── テスト6: upsertCoreOwnManufacturerForFrontend (新規登録) ───
  var upsertMfrResult = upsertCoreOwnManufacturerForFrontend(sessionId, {
    nameEn:   'DEV Test Manufacturer EN',
    nameJa:   'DEVテストメーカー',
    isActive: 'TRUE'
  });
  results.upsertManufacturer = upsertMfrResult;

  // ─── テスト7: 登録後の読み取り確認 ───
  var categoriesAfter = getCoreOwnCategoriesForFrontend(sessionId);
  var insertedCat = categoriesAfter.filter(function(r) { return r.categoryId === upsertCatResult.categoryId; })[0] || null;
  results.categoryAfterUpsert = insertedCat ? {
    categoryId: insertedCat.categoryId,
    nameEn:     insertedCat.nameEn,
    nameJa:     insertedCat.nameJa,
    isActive:   insertedCat.isActive
  } : null;

  var worksAfter = getCoreOwnWorksForFrontend(sessionId);
  var insertedWork = worksAfter.filter(function(r) { return r.workId === upsertWorkResult.workId; })[0] || null;
  results.workAfterUpsert = insertedWork ? {
    workId:   insertedWork.workId,
    nameEn:   insertedWork.nameEn,
    nameJa:   insertedWork.nameJa,
    isActive: insertedWork.isActive
  } : null;

  var mfrsAfter = getCoreOwnManufacturersForFrontend(sessionId);
  var insertedMfr = mfrsAfter.filter(function(r) { return r.manufacturerId === upsertMfrResult.manufacturerId; })[0] || null;
  results.manufacturerAfterUpsert = insertedMfr ? {
    manufacturerId: insertedMfr.manufacturerId,
    nameEn:         insertedMfr.nameEn,
    nameJa:         insertedMfr.nameJa,
    isActive:       insertedMfr.isActive
  } : null;

  // ─── テスト8: 異常系 - 存在しないIDで更新 ───
  var errNotFound = null;
  try {
    upsertCoreOwnCategoryForFrontend(sessionId, {
      categoryId: 'OWN-CAT-XXXX',
      nameEn:     'should fail'
    });
    errNotFound = 'NOT_REJECTED';
  } catch (e) {
    errNotFound = e.message.indexOf('OWN_CATEGORY_NOT_FOUND') !== -1 ? 'OWN_CATEGORY_NOT_FOUND' : e.message;
  }
  results.errorNotFound = errNotFound;

  // ─── スキーマ監査 ───
  var audit = runCoreSchemaConformanceAuditSilent_(['OWN_CATEGORIES', 'OWN_WORKS', 'OWN_MANUFACTURERS']);
  results.schemaAudit = { totalMismatches: audit.totalMismatches };

  return results;
}

/**
 * テスト用セッションIDを返す（deal_edit ロールの有効スタッフ）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {string}
 */
function _ownMasterTestGetSession_(ss) {
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
