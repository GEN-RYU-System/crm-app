/**
 * 99_DevOwnProductApiTest.js
 *
 * getCoreOwnProductsForFrontend / upsertCoreOwnProductWithPackageForFrontend の DEV 動作確認テスト。
 *
 * 実行: clasp run runOwnProductApiTest
 *
 * ★ DEV環境専用
 * ★ テストデータは削除しない
 */

/* global getEnvironment, getSpreadsheet, createSession,
   getCoreSchemaV1Table, getCoreSchemaV1Sheet, getCoreSchemaV1HeaderName, getCoreSchemaV1Value,
   getCoreOwnCategoriesForFrontend, getCoreOwnWorksForFrontend, getCoreOwnManufacturersForFrontend,
   getCoreOwnProductsForFrontend, upsertCoreOwnProductWithPackageForFrontend,
   runCoreSchemaConformanceAuditSilent_ */

/**
 * 自社商品 API 統合テスト（DEV専用）
 * @returns {Object}
 */
function runOwnProductApiTest() {
  if (getEnvironment() !== 'development') {
    throw new Error('runOwnProductApiTest is available only in development');
  }

  var ss = getSpreadsheet();
  var results = {};

  // ─── セッション取得: deal_edit ロールの有効スタッフ ───
  var sessionId = _ownProductTestGetSession_(ss);
  results.sessionOk = Boolean(sessionId);

  // ─── 参照ID を動的に取得 ───
  var refIds = _ownProductTestGetRefIds_(ss, sessionId);
  results.refIds = refIds;

  // ─── 事前行数確認 ───
  var productsBefore = getCoreOwnProductsForFrontend(sessionId);
  var countBefore = productsBefore.length;
  results.countBefore = countBefore;

  var pkgCountBefore = _ownProductTestGetSheetLastRow_(ss, 'PRODUCT_PACKAGES');
  results.pkgCountBefore = pkgCountBefore;

  // ─────────────────────────────────────────────────────────────────────
  // テスト(a): 商品のみ登録（package 省略）→ OWN-XXXX が作られるか
  // ─────────────────────────────────────────────────────────────────────
  var upsertA = upsertCoreOwnProductWithPackageForFrontend(sessionId, {
    product: {
      nameEn:           'DEV Test Own Product EN-A',
      nameJa:           'DEVテスト自社商品A',
      ownCategoryId:    refIds.ownCategoryId,
      ownWorkId:        refIds.ownWorkId,
      ownManufacturerId: refIds.ownManufacturerId,
      note:             'DEV test note A',
      isActive:         'TRUE'
    }
    // package 省略
  });
  results.upsertA = {
    success:          upsertA.success,
    ownProductId:     upsertA.ownProductId,
    productPackageId: upsertA.productPackageId,
    failedStep:       upsertA.failedStep
  };

  // 監査(a)
  var auditA = runCoreSchemaConformanceAuditSilent_(['OWN_PRODUCTS', 'PRODUCT_PACKAGES']);
  results.auditAfterA = { mismatches: auditA.totalMismatches };

  // 読み取り確認(a)
  var productsAfterA = getCoreOwnProductsForFrontend(sessionId);
  var insertedA = productsAfterA.filter(function(r) {
    return r.ownProductId === upsertA.ownProductId;
  })[0] || null;
  results.readBackA = insertedA ? {
    ownProductId:       insertedA.ownProductId,
    nameEn:             insertedA.nameEn,
    nameJa:             insertedA.nameJa,
    ownCategoryId:      insertedA.ownCategoryId,
    categoryNameEn:     insertedA.categoryNameEn,
    ownWorkId:          insertedA.ownWorkId,
    workNameEn:         insertedA.workNameEn,
    ownManufacturerId:  insertedA.ownManufacturerId,
    manufacturerNameEn: insertedA.manufacturerNameEn,
    isActive:           insertedA.isActive
  } : null;
  results.countAfterA = productsAfterA.length;
  results.pkgCountAfterA = _ownProductTestGetSheetLastRow_(ss, 'PRODUCT_PACKAGES');

  // ─────────────────────────────────────────────────────────────────────
  // テスト(b): 商品＋荷姿割り当てをまとめて登録 → 両方に書かれるか
  // ─────────────────────────────────────────────────────────────────────
  var upsertB = upsertCoreOwnProductWithPackageForFrontend(sessionId, {
    product: {
      nameEn:           'DEV Test Own Product EN-B',
      nameJa:           'DEVテスト自社商品B',
      ownCategoryId:    refIds.ownCategoryId,
      ownWorkId:        refIds.ownWorkId,
      ownManufacturerId: refIds.ownManufacturerId,
      isActive:         'TRUE'
    },
    package: {
      casePackageId: refIds.casePackageId,
      isActive:      'TRUE'
    }
  });
  results.upsertB = {
    success:          upsertB.success,
    ownProductId:     upsertB.ownProductId,
    productPackageId: upsertB.productPackageId,
    failedStep:       upsertB.failedStep
  };

  // 監査(b)
  var auditB = runCoreSchemaConformanceAuditSilent_(['OWN_PRODUCTS', 'PRODUCT_PACKAGES']);
  results.auditAfterB = { mismatches: auditB.totalMismatches };

  // 読み取り確認(b)
  var productsAfterB = getCoreOwnProductsForFrontend(sessionId);
  var insertedB = productsAfterB.filter(function(r) {
    return r.ownProductId === upsertB.ownProductId;
  })[0] || null;
  results.readBackB = insertedB ? {
    ownProductId:      insertedB.ownProductId,
    nameEn:            insertedB.nameEn,
    productPackageId:  upsertB.productPackageId
  } : null;
  results.countAfterB = productsAfterB.length;
  results.pkgCountAfterB = _ownProductTestGetSheetLastRow_(ss, 'PRODUCT_PACKAGES');

  // ─────────────────────────────────────────────────────────────────────
  // テスト(c): 登録済み商品の更新（(a) で作成したものを nameJa 変更）
  // ─────────────────────────────────────────────────────────────────────
  var upsertC = upsertCoreOwnProductWithPackageForFrontend(sessionId, {
    product: {
      ownProductId: upsertA.ownProductId,
      nameJa:       'DEVテスト自社商品A（更新済み）',
      isActive:     'TRUE'
    }
  });
  results.upsertC = {
    success:      upsertC.success,
    ownProductId: upsertC.ownProductId,
    failedStep:   upsertC.failedStep
  };

  // 監査(c)
  var auditC = runCoreSchemaConformanceAuditSilent_(['OWN_PRODUCTS', 'PRODUCT_PACKAGES']);
  results.auditAfterC = { mismatches: auditC.totalMismatches };

  // 読み取り確認(c)
  var productsAfterC = getCoreOwnProductsForFrontend(sessionId);
  var updatedC = productsAfterC.filter(function(r) {
    return r.ownProductId === upsertA.ownProductId;
  })[0] || null;
  results.readBackC = updatedC ? {
    ownProductId: updatedC.ownProductId,
    nameJa:       updatedC.nameJa
  } : null;
  results.countAfterC = productsAfterC.length;

  // ─────────────────────────────────────────────────────────────────────
  // テスト(d): 異常系 — 存在しない ownCategoryId → 拒否・書き込みなし
  // ─────────────────────────────────────────────────────────────────────
  var countBeforeD = _ownProductTestGetSheetLastRow_(ss, 'OWN_PRODUCTS');
  var errD = null;
  try {
    upsertCoreOwnProductWithPackageForFrontend(sessionId, {
      product: {
        nameEn:        'should fail D',
        ownCategoryId: 'OWN-CAT-NONEXISTENT-9999',
        isActive:      'TRUE'
      }
    });
    errD = 'NOT_REJECTED';
  } catch (e) {
    errD = e.message.indexOf('OWN_CATEGORY_NOT_FOUND') !== -1 ? 'REJECTED_OK' : 'UNEXPECTED_ERROR: ' + e.message;
  }
  var countAfterD = _ownProductTestGetSheetLastRow_(ss, 'OWN_PRODUCTS');
  results.errorD_badCategoryId = {
    result:        errD,
    rowsUnchanged: (countAfterD === countBeforeD)
  };

  // ─────────────────────────────────────────────────────────────────────
  // テスト(e): 異常系 — 存在しない casePackageId → 拒否・書き込みなし（商品行も増えない）
  // ─────────────────────────────────────────────────────────────────────
  var prodCountBeforeE = _ownProductTestGetSheetLastRow_(ss, 'OWN_PRODUCTS');
  var pkgCountBeforeE  = _ownProductTestGetSheetLastRow_(ss, 'PRODUCT_PACKAGES');
  var errE = null;
  try {
    upsertCoreOwnProductWithPackageForFrontend(sessionId, {
      product: {
        nameEn:   'should fail E',
        isActive: 'TRUE'
      },
      package: {
        casePackageId: 'PKG-NONEXISTENT-9999',
        isActive:      'TRUE'
      }
    });
    errE = 'NOT_REJECTED';
  } catch (e) {
    errE = e.message.indexOf('PACKAGE_NOT_FOUND') !== -1 ? 'REJECTED_OK' : 'UNEXPECTED_ERROR: ' + e.message;
  }
  var prodCountAfterE = _ownProductTestGetSheetLastRow_(ss, 'OWN_PRODUCTS');
  var pkgCountAfterE  = _ownProductTestGetSheetLastRow_(ss, 'PRODUCT_PACKAGES');
  results.errorE_badPackageId = {
    result:              errE,
    prodRowsUnchanged:   (prodCountAfterE === prodCountBeforeE),
    pkgRowsUnchanged:    (pkgCountAfterE  === pkgCountBeforeE)
  };

  // ─────────────────────────────────────────────────────────────────────
  // 最終スキーマ監査
  // ─────────────────────────────────────────────────────────────────────
  var finalAudit = runCoreSchemaConformanceAuditSilent_(['OWN_PRODUCTS', 'PRODUCT_PACKAGES']);
  results.finalAudit = { mismatches: finalAudit.totalMismatches };

  return results;
}

// ─── テスト用内部ヘルパー ─────────────────────────────────────────────────────

/**
 * テスト用セッションIDを返す（deal_edit ロールの有効スタッフ）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {string}
 */
function _ownProductTestGetSession_(ss) {
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
 * テストで使う参照IDを動的に取得する。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} sessionId
 * @returns {{ ownCategoryId: string, ownWorkId: string, ownManufacturerId: string, casePackageId: string }}
 */
function _ownProductTestGetRefIds_(ss, sessionId) {
  // 自社大分類・作品・メーカーは Frontend API 経由
  var categories    = getCoreOwnCategoriesForFrontend(sessionId);
  var works         = getCoreOwnWorksForFrontend(sessionId);
  var manufacturers = getCoreOwnManufacturersForFrontend(sessionId);

  var ownCategoryId    = categories.length    > 0 ? categories[0].categoryId       : '';
  var ownWorkId        = works.length         > 0 ? works[0].workId                : '';
  var ownManufacturerId = manufacturers.length > 0 ? manufacturers[0].manufacturerId : '';

  // PACKAGES は直接シートから先頭IDを取得
  var casePackageId = '';
  try {
    var pkgTable  = getCoreSchemaV1Table('PACKAGES');
    var pkgSheet  = getCoreSchemaV1Sheet(ss, 'PACKAGES');
    var pkgLastCol = pkgSheet.getLastColumn();
    if (pkgLastCol > 0) {
      var pkgHeaders = pkgSheet
        .getRange(pkgTable.headerRowNumber, 1, 1, pkgLastCol)
        .getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); });
      var pkgIdColName = getCoreSchemaV1HeaderName('PACKAGES', 'PACKAGE_ID');
      var pkgIdColIdx  = pkgHeaders.indexOf(pkgIdColName);
      if (pkgIdColIdx >= 0) {
        var pkgLastRow = pkgSheet.getLastRow();
        if (pkgLastRow > pkgTable.headerRowNumber) {
          var pkgIdVal = pkgSheet.getRange(pkgTable.headerRowNumber + 1, pkgIdColIdx + 1).getValue();
          casePackageId = String(pkgIdVal || '').trim();
        }
      }
    }
  } catch (e) {
    // PACKAGES が未実装の場合はスキップ
    casePackageId = '';
  }

  return {
    ownCategoryId:    ownCategoryId,
    ownWorkId:        ownWorkId,
    ownManufacturerId: ownManufacturerId,
    casePackageId:    casePackageId
  };
}

/**
 * 指定テーブルのシートの getLastRow() を返す（データ行数の変化確認用）。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @returns {number}
 */
function _ownProductTestGetSheetLastRow_(ss, tableKey) {
  try {
    var sheet = getCoreSchemaV1Sheet(ss, tableKey);
    return sheet.getLastRow();
  } catch (e) {
    return -1;
  }
}
