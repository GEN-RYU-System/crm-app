/**
 * 見積もりAPIテスト（DEV専用）
 *
 * clasp run testCoreQuoteApiAll で実行する。
 * テスト (1)〜(5) を順番に実行し、失敗したら即座に停止して結果を返す。
 *
 * ★ テストデータは削除しない（残留させる）。
 * ★ 既存データには一切触れない。
 * ★ データ値（顧客名等）は出力しない。
 */

/**
 * 見積もりAPI統合テスト（DEV専用）
 * @returns {Object} テスト結果
 */
function testCoreQuoteApiAll() {
  if (getEnvironment() !== 'development') {
    throw new Error('testCoreQuoteApiAll is available only in development');
  }

  const ss = getSpreadsheet();
  const results = {};

  // ─── セットアップ: 実在する staffId / leadId / sessionId を取得 ───
  const setup = _testCoreQuoteGetSetup(ss);
  results.setup = {
    staffId:      setup.staffId,
    leadIdPrefix: setup.leadId.split('-')[0],
    leadId:       setup.leadId,
    sessionOk:    Boolean(setup.sessionId)
  };
  const { staffId, leadId, sessionId } = setup;

  // ─── (1) create: 明細2行 ───
  // subtotal = 2×1000 + 3×500 = 3500
  // total    = 3500 + 500 - 100 = 3900
  // totalJpy = 3900 × 150 = 585000
  const createInput = {
    leadId:       leadId,
    staffId:      staffId,
    currency:     'USD',
    exchangeRate: 150,
    shippingFee:  500,
    discount:     100,
    note:         'DEV-APIテスト',
    lines: [
      { productName: 'テスト商品A', quantity: 2, unitPrice: 1000 },
      { productName: 'テスト商品B', quantity: 3, unitPrice: 500  }
    ]
  };

  const createResult = createCoreQuoteForFrontend(sessionId, createInput);
  const createdQuoteId = createResult.quoteId;
  results.test1_create = {
    success:            createResult.success,
    quoteId:            createdQuoteId,
    quoteIdMatchFormat: /^QT-\d{5}$/.test(createdQuoteId)
  };
  if (!createResult.success || !results.test1_create.quoteIdMatchFormat) {
    results._stopped = 'test1_create failed';
    return results;
  }

  // ─── (2) get individual ───
  const getResult = getCoreQuoteForFrontend(sessionId, createdQuoteId);
  const EXPECTED_TOTAL       = 3900;
  const EXPECTED_TOTAL_JPY   = 585000;
  results.test2_get = {
    found:              getResult !== null,
    lineCount:          getResult ? getResult.lines.length : null,
    totalAmount:        getResult ? getResult.quote.totalAmount : null,
    totalAmountJpy:     getResult ? getResult.quote.totalAmountJpy : null,
    expectedTotal:      EXPECTED_TOTAL,
    expectedTotalJpy:   EXPECTED_TOTAL_JPY,
    totalAmountMatch:   getResult ? getResult.quote.totalAmount    === EXPECTED_TOTAL     : false,
    totalAmountJpyMatch:getResult ? getResult.quote.totalAmountJpy === EXPECTED_TOTAL_JPY : false
  };
  if (!results.test2_get.found ||
      results.test2_get.lineCount !== 2 ||
      !results.test2_get.totalAmountMatch ||
      !results.test2_get.totalAmountJpyMatch) {
    results._stopped = 'test2_get failed';
    return results;
  }
  const createdAt_original = getResult.quote.createdAt;
  const updatedAt_original = getResult.quote.updatedAt;

  // ─── (3) list ───
  const listResult = getCoreQuotesForFrontend(sessionId);
  results.test3_list = {
    count:         listResult.length,
    expectedCount: 1
  };
  if (listResult.length !== 1) {
    results._stopped = 'test3_list failed (count=' + listResult.length + ')';
    return results;
  }

  // ─── (4) update: 明細3行に変更 ───
  // subtotal = 2×1000 + 3×500 + 1×800 = 4300
  // total    = 4300 + 600 - 200 = 4700
  // totalJpy = 4700 × 148 = 695600
  const updateInput = {
    leadId:       leadId,
    staffId:      staffId,
    currency:     'USD',
    exchangeRate: 148,
    shippingFee:  600,
    discount:     200,
    note:         'DEV-APIテスト更新',
    lines: [
      { productName: 'テスト商品A', quantity: 2, unitPrice: 1000 },
      { productName: 'テスト商品B', quantity: 3, unitPrice: 500  },
      { productName: 'テスト商品C', quantity: 1, unitPrice: 800  }
    ]
  };
  const EXPECTED_TOTAL_U     = 4700;
  const EXPECTED_TOTAL_JPY_U = 695600;

  Utilities.sleep(1100); // UPDATED_AT が変わることを保証する

  const updateResult    = updateCoreQuoteForFrontend(sessionId, createdQuoteId, updateInput);
  const getAfterUpdate  = getCoreQuoteForFrontend(sessionId, createdQuoteId);
  results.test4_update = {
    updateSuccess:       updateResult.success,
    lineCountAfter:      getAfterUpdate ? getAfterUpdate.lines.length : null,
    totalAmountAfter:    getAfterUpdate ? getAfterUpdate.quote.totalAmount    : null,
    totalAmountJpyAfter: getAfterUpdate ? getAfterUpdate.quote.totalAmountJpy : null,
    expectedTotal:       EXPECTED_TOTAL_U,
    expectedTotalJpy:    EXPECTED_TOTAL_JPY_U,
    totalAmountMatch:    getAfterUpdate ? getAfterUpdate.quote.totalAmount    === EXPECTED_TOTAL_U     : false,
    totalAmountJpyMatch: getAfterUpdate ? getAfterUpdate.quote.totalAmountJpy === EXPECTED_TOTAL_JPY_U : false,
    createdAtUnchanged:  getAfterUpdate ? getAfterUpdate.quote.createdAt === createdAt_original : false,
    updatedAtChanged:    getAfterUpdate ? getAfterUpdate.quote.updatedAt !== updatedAt_original : false
  };
  if (!updateResult.success ||
      results.test4_update.lineCountAfter !== 3 ||
      !results.test4_update.totalAmountMatch ||
      !results.test4_update.totalAmountJpyMatch ||
      !results.test4_update.updatedAtChanged) {
    results._stopped = 'test4_update failed';
    return results;
  }

  // ─── (5) 存在しないリードIDで作成を試みる ───
  var test5Exception = false;
  var test5ErrorMessage = null;
  try {
    createCoreQuoteForFrontend(sessionId, {
      leadId:  'LDI-99999',
      staffId: staffId,
      lines:   []
    });
  } catch (e) {
    test5Exception    = true;
    test5ErrorMessage = e.message;
  }
  results.test5_invalid_lead = {
    exceptionThrown: test5Exception,
    errorMessage:    test5ErrorMessage
  };
  if (!test5Exception) {
    results._stopped = 'test5_invalid_lead: exception was not thrown';
    return results;
  }

  results._allPassed = true;
  return results;
}

// ─── セットアップヘルパー ──────────────────────────────────────────────────────

/**
 * テストに使用する staffId / leadId / sessionId を返す（DEV専用）。
 * staffId: deal_edit を持つ最初の有効担当者
 * leadId:  リード管理の最初の有効リード
 * sessionId: 上記担当者で発行したセッション
 */
function _testCoreQuoteGetSetup(spreadsheet) {
  // ── staffId 取得: deal_edit を持つ role の担当者を優先 ──
  const staffTable   = getCoreSchemaV1Table('STAFF');
  const staffSheet   = getCoreSchemaV1Sheet(spreadsheet, 'STAFF');
  const staffHeaders = staffSheet
    .getRange(staffTable.headerRowNumber, 1, 1, staffSheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });

  const staffIdHeader = getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID');
  const statusHeader  = getCoreSchemaV1HeaderName('STAFF', 'STATUS');
  const roleHeader    = getCoreSchemaV1HeaderName('STAFF', 'ROLE');
  const statusActive  = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');

  const staffIdColIdx = staffHeaders.indexOf(staffIdHeader);
  const statusColIdx  = staffHeaders.indexOf(statusHeader);
  const roleColIdx    = staffHeaders.indexOf(roleHeader);

  // deal_edit = true の物理ロール値
  const dealEditRoles = [
    getCoreSchemaV1Value('STAFF', 'ROLE', 'OWNER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'LEADER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'SALES')
  ];

  const staffLastRow  = staffSheet.getLastRow();
  const staffData     = staffSheet
    .getRange(staffTable.headerRowNumber + 1, 1, staffLastRow - staffTable.headerRowNumber, staffSheet.getLastColumn())
    .getValues();

  let selectedStaffId = null;
  for (let i = 0; i < staffData.length; i++) {
    const status = String(staffData[i][statusColIdx] || '').trim();
    const role   = String(staffData[i][roleColIdx]   || '').trim();
    if (status === statusActive && dealEditRoles.indexOf(role) !== -1) {
      const sid = String(staffData[i][staffIdColIdx] || '').trim();
      if (sid) { selectedStaffId = sid; break; }
    }
  }
  if (!selectedStaffId) throw new Error('[SETUP] No active staff with deal_edit role found');

  // ── leadId 取得: リード管理の先頭有効レコード ──
  const leadsTable   = getCoreSchemaV1Table('LEADS');
  const leadsSheet   = getCoreSchemaV1Sheet(spreadsheet, 'LEADS');
  const leadsHeaders = leadsSheet
    .getRange(leadsTable.headerRowNumber, 1, 1, leadsSheet.getLastColumn())
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });
  const leadIdHeader  = getCoreSchemaV1HeaderName('LEADS', 'LEAD_ID');
  const leadIdColIdx  = leadsHeaders.indexOf(leadIdHeader);
  const leadsLastRow  = leadsSheet.getLastRow();
  const dataRowStart  = leadsTable.headerRowNumber + 1;
  const leadsData     = leadsSheet
    .getRange(dataRowStart, leadIdColIdx + 1, leadsLastRow - leadsTable.headerRowNumber, 1)
    .getValues();

  let selectedLeadId = null;
  for (let j = 0; j < leadsData.length; j++) {
    const lid = String(leadsData[j][0] || '').trim();
    if (lid) { selectedLeadId = lid; break; }
  }
  if (!selectedLeadId) throw new Error('[SETUP] No lead found in LEADS sheet');

  // ── セッション発行 ──
  const sessionId = createSession(selectedStaffId);

  return { staffId: selectedStaffId, leadId: selectedLeadId, sessionId: sessionId };
}
