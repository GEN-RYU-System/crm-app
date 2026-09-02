/**
 * 99_DevCustomerTaxNumberApiTest.js
 *
 * 目的: 28_CoreCustomerTaxNumberApi.js の動作検証。
 *       以下のシナリオを順番に実行し、各操作後にスキーマ整合監査を行う。
 *
 *   (a) 既存顧客に US_TAX_ID を1件登録
 *   (b) 同顧客に EORI を1件登録（別種別なので成功するはず）
 *   (c) 同顧客に US_TAX_ID をもう1件登録 → 重複拒否 & 行数が増えていないことを確認
 *   (d) (a) で登録した行を更新（番号を変える） → 自身は除外され成功するはず
 *   (e) 存在しない顧客IDを指定 → 拒否されるか
 *   (f) getCoreCustomerTaxNumbersForFrontend で種別名が結合されて返ることを確認
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 番号種別マスタへの書き込み
 *
 * 使い方:
 *   clasp run devCustomerTaxNumberApiTest
 */

/* global getCoreTaxNumberTypesForFrontend, getCoreCustomerTaxNumbersForFrontend,
   upsertCoreCustomerTaxNumberForFrontend,
   runCoreSchemaConformanceAudit,
   getEnvironment, getSpreadsheet,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

/**
 * 顧客税務番号 API の総合テスト。
 * 実行前に setupTaxNumberMaster(['APPLY']) が完了していること。
 *
 * @returns {Object} テスト結果サマリ
 */
function devCustomerTaxNumberApiTest() {
  if (getEnvironment() !== 'development') {
    throw new Error('devCustomerTaxNumberApiTest は development 環境でのみ実行できます。');
  }

  Logger.log('=== devCustomerTaxNumberApiTest 開始 ===');
  Logger.log('');

  var ss = getSpreadsheet();

  // ── テスト用顧客IDを顧客マスタから取得 ──────────────────────────────────────
  var custData = coreCustomerFrontendReadTable(ss, 'CUSTOMERS', ['CUSTOMER_ID', 'CUSTOMER_NAME']);
  var firstCust = null;
  for (var ci = 0; ci < custData.rows.length; ci++) {
    var cid = coreCustomerFrontendValue(custData.rows[ci][custData.indexes.CUSTOMER_ID]);
    if (cid) {
      firstCust = {
        id:   cid,
        name: coreCustomerFrontendValue(custData.rows[ci][custData.indexes.CUSTOMER_NAME])
      };
      break;
    }
  }
  if (!firstCust) throw new Error('テスト用顧客が見つかりません。顧客マスタが空です。');
  Logger.log('テスト用顧客: ' + firstCust.id + ' (' + firstCust.name + ')');
  Logger.log('');

  var testCustomerId = firstCust.id;
  var registeredIdA  = null;
  var registeredIdB  = null;
  var results        = {};

  // ──────────────────────────────────────────────────────────────────────────────
  // (a) 既存顧客に US_TAX_ID を1件登録
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('--- (a) US_TAX_ID を新規登録 ---');
  var ctnSheetBefore = ss.getSheetByName('顧客税務番号');
  var rowCountBefore = ctnSheetBefore ? ctnSheetBefore.getLastRow() : 1;

  try {
    var resultA = upsertCoreCustomerTaxNumberForFrontend(null, {
      customerId: testCustomerId,
      typeId:     'US_TAX_ID',
      number:     '12-3456789',
      isActive:   'TRUE'
    });
    registeredIdA = resultA.taxNumberId;
    Logger.log('  ✅ 登録成功: ' + registeredIdA);
    results.a = 'PASS';
  } catch (e) {
    Logger.log('  ❌ 予期しない失敗: ' + e.message);
    results.a = 'FAIL: ' + e.message;
  }

  var ctnSheetAfterA = ss.getSheetByName('顧客税務番号');
  var rowCountAfterA = ctnSheetAfterA ? ctnSheetAfterA.getLastRow() : 1;
  Logger.log('  行数: ' + rowCountBefore + ' → ' + rowCountAfterA + '（差分: ' + (rowCountAfterA - rowCountBefore) + '）');
  devCtnAudit_('(a)後');

  // ──────────────────────────────────────────────────────────────────────────────
  // (b) 同顧客に EORI を1件登録（別種別なので成功するはず）
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('--- (b) EORI を新規登録（別種別）---');
  try {
    var resultB = upsertCoreCustomerTaxNumberForFrontend(null, {
      customerId: testCustomerId,
      typeId:     'EORI',
      number:     'GB123456789000',
      isActive:   'TRUE'
    });
    registeredIdB = resultB.taxNumberId;
    Logger.log('  ✅ 登録成功: ' + registeredIdB);
    results.b = 'PASS';
  } catch (e) {
    Logger.log('  ❌ 予期しない失敗: ' + e.message);
    results.b = 'FAIL: ' + e.message;
  }
  devCtnAudit_('(b)後');

  // ──────────────────────────────────────────────────────────────────────────────
  // (c) 同顧客に US_TAX_ID をもう1件 → 重複として拒否されるか
  //     拒否時に行数が増えていないことを確認
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('--- (c) US_TAX_ID 重複登録 → 拒否確認 ---');
  var rowCountBeforeC = ss.getSheetByName('顧客税務番号').getLastRow();
  try {
    upsertCoreCustomerTaxNumberForFrontend(null, {
      customerId: testCustomerId,
      typeId:     'US_TAX_ID',
      number:     '99-9999999'
    });
    Logger.log('  ❌ 重複が通ってしまった（バグ）');
    results.c = 'FAIL: duplicate was accepted';
  } catch (e) {
    if (e.message.indexOf('DUPLICATE_TAX_NUMBER') !== -1) {
      Logger.log('  ✅ 正しく拒否: ' + e.message);
      results.c = 'PASS';
    } else {
      Logger.log('  ❌ 予期しないエラー: ' + e.message);
      results.c = 'FAIL: unexpected error: ' + e.message;
    }
  }
  var rowCountAfterC = ss.getSheetByName('顧客税務番号').getLastRow();
  Logger.log('  行数確認: ' + rowCountBeforeC + ' → ' + rowCountAfterC + '（差分: ' + (rowCountAfterC - rowCountBeforeC) + '）');
  if (rowCountAfterC !== rowCountBeforeC) {
    Logger.log('  ❌ 行数が増えている（拒否後に書き込まれた可能性）');
    results.c = 'FAIL: row count increased after rejection';
  }
  devCtnAudit_('(c)後');

  // ──────────────────────────────────────────────────────────────────────────────
  // (d) (a) で登録した行を更新（番号を変える）→ 自身は重複判定から除外され成功するか
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('--- (d) (a) の行を更新（自身を除外して重複判定）---');
  if (!registeredIdA) {
    Logger.log('  ⚠️  (a) が失敗しているためスキップ');
    results.d = 'SKIP';
  } else {
    try {
      var resultD = upsertCoreCustomerTaxNumberForFrontend(null, {
        taxNumberId: registeredIdA,
        customerId:  testCustomerId,
        typeId:      'US_TAX_ID',
        number:      '98-7654321'
      });
      Logger.log('  ✅ 更新成功: ' + resultD.taxNumberId);
      results.d = 'PASS';
    } catch (e) {
      Logger.log('  ❌ 予期しない失敗: ' + e.message);
      results.d = 'FAIL: ' + e.message;
    }
  }
  devCtnAudit_('(d)後');

  // ──────────────────────────────────────────────────────────────────────────────
  // (e) 存在しない顧客IDを指定 → 拒否されるか
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('--- (e) 存在しない顧客IDで登録 → 拒否確認 ---');
  try {
    upsertCoreCustomerTaxNumberForFrontend(null, {
      customerId: 'GHOST-9999',
      typeId:     'VAT',
      number:     'DE999999999'
    });
    Logger.log('  ❌ 拒否されなかった（バグ）');
    results.e = 'FAIL: invalid customer accepted';
  } catch (e) {
    if (e.message.indexOf('CUSTOMER_NOT_FOUND') !== -1) {
      Logger.log('  ✅ 正しく拒否: ' + e.message);
      results.e = 'PASS';
    } else {
      Logger.log('  ❌ 予期しないエラー: ' + e.message);
      results.e = 'FAIL: unexpected error: ' + e.message;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // (f) getCoreCustomerTaxNumbersForFrontend で種別名が結合されて返るか
  // ──────────────────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('--- (f) 読み取り & 種別名結合確認 ---');
  try {
    var rows = getCoreCustomerTaxNumbersForFrontend(null, testCustomerId);
    Logger.log('  取得件数: ' + rows.length);
    rows.forEach(function(r) {
      Logger.log('  ' + r.taxNumberId + ' | ' + r.typeId + ' | nameJa=' + r.typeNameJa + ' | nameEn=' + r.typeNameEn + ' | number=' + r.number);
    });
    var allHaveNames = rows.every(function(r) { return r.typeNameJa && r.typeNameEn; });
    if (allHaveNames && rows.length >= 2) {
      Logger.log('  ✅ 種別名が結合されて返っている');
      results.f = 'PASS';
    } else if (rows.length < 2) {
      Logger.log('  ⚠️  件数が期待より少ない（前の手順が失敗している可能性）');
      results.f = 'WARN: row count=' + rows.length;
    } else {
      Logger.log('  ❌ 種別名が空の行がある');
      results.f = 'FAIL: some rows missing type name';
    }
  } catch (e) {
    Logger.log('  ❌ 予期しない失敗: ' + e.message);
    results.f = 'FAIL: ' + e.message;
  }

  // ── 最終サマリ ────────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('=== テスト結果サマリ ===');
  Logger.log('  (a) US_TAX_ID 新規登録:  ' + results.a);
  Logger.log('  (b) EORI 新規登録:        ' + results.b);
  Logger.log('  (c) US_TAX_ID 重複拒否:  ' + results.c);
  Logger.log('  (d) US_TAX_ID 更新:       ' + results.d);
  Logger.log('  (e) 不正顧客ID 拒否:      ' + results.e);
  Logger.log('  (f) 読み取り & 名称結合: ' + results.f);
  Logger.log('');

  return results;
}

/**
 * スキーマ整合監査を実行してヘッダーの壊れていないことを確認する（内部ヘルパー）。
 *
 * @param {string} label
 */
function devCtnAudit_(label) {
  try {
    var auditResult = runCoreSchemaConformanceAudit();
    var ctnEntry = auditResult.results
      ? auditResult.results.filter(function(r) { return r.tableKey === 'CUSTOMER_TAX_NUMBERS'; })
      : [];
    var mismatch = ctnEntry.length > 0 ? ctnEntry[0].mismatchCount : '(取得不可)';
    Logger.log('  [監査 ' + label + '] CUSTOMER_TAX_NUMBERS 不一致: ' + mismatch);
  } catch (e) {
    Logger.log('  [監査 ' + label + '] 失敗: ' + e.message);
  }
}
