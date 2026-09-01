/**
 * Phase 2 商談結果自動連携 検証テスト（DEV環境専用）
 *
 * 使用方法:
 *   clasp run runPhase2ApiPathVerification   — API経由3ケース検証
 *   clasp run runPhase2OnEditVerification    — onEdit擬似実行3ケース検証
 *
 * 前提: syncDealResultByStatus_ が GAS に配備済みであること（PR #627 merge後）
 * テスト対象リード: LDI-TEST-001（DEV専用テストリード・空データ）
 */

/**
 * リード管理シートのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 * PR-1（デュアルサポート期）専用。PR-3 で削除する。
 */
function _leadsHeaderIdx(headers, newName, oldName) {
  var idx = headers.indexOf(newName);
  return idx !== -1 ? idx : headers.indexOf(oldName);
}

var PHASE2_TEST_LEAD_ID = 'LDI-TEST-001';

/**
 * テストリードの現在値を取得するヘルパー
 */
function _getPhase2TestState_() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var idIdx         = _leadsHeaderIdx(headers, 'lead_id', 'リードID');
  var statusIdx     = _leadsHeaderIdx(headers, 'lead_status', 'リードステータス');
  var dealResultIdx = _leadsHeaderIdx(headers, 'deal_result', '商談結果');
  var archiveDateIdx = _leadsHeaderIdx(headers, 'archived_at', 'アーカイブ日');
  var archiveRsnIdx  = _leadsHeaderIdx(headers, 'archive_reason', 'アーカイブ理由');
  var updateDateIdx  = _leadsHeaderIdx(headers, 'sheet_updated_at', 'シート更新日');

  var testRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][idIdx] === PHASE2_TEST_LEAD_ID) { testRow = i + 1; break; }
  }
  if (testRow === -1) throw new Error(PHASE2_TEST_LEAD_ID + ' が見つかりません');

  return {
    sheet, headers,
    idIdx, statusIdx, dealResultIdx, archiveDateIdx, archiveRsnIdx, updateDateIdx,
    testRow,
    original: {
      status:      data[testRow - 1][statusIdx],
      dealResult:  data[testRow - 1][dealResultIdx],
      archiveDate: data[testRow - 1][archiveDateIdx],
      archiveRsn:  data[testRow - 1][archiveRsnIdx],
      updateDate:  data[testRow - 1][updateDateIdx]
    }
  };
}

/**
 * テストリードを元の状態に戻すヘルパー
 */
function _restorePhase2TestLead_(ctx) {
  var row = ctx.sheet.getDataRange().getValues()[ctx.testRow - 1].slice();
  row[ctx.statusIdx]      = ctx.original.status;
  row[ctx.dealResultIdx]  = ctx.original.dealResult;
  if (ctx.archiveDateIdx !== -1) row[ctx.archiveDateIdx] = ctx.original.archiveDate;
  if (ctx.archiveRsnIdx  !== -1) row[ctx.archiveRsnIdx]  = ctx.original.archiveRsn;
  if (ctx.updateDateIdx  !== -1) row[ctx.updateDateIdx]   = ctx.original.updateDate;
  ctx.sheet.getRange(ctx.testRow, 1, 1, ctx.headers.length).setValues([row]);
}

// ────────────────────────────────────────────────────────────────
// テスト A: API 経由パス（syncDealResultByStatus_ の直接呼び出し）
//   updateLead() のコアロジック（setValues + syncDealResultByStatus_）を
//   session/permission を迂回して再現する
// ────────────────────────────────────────────────────────────────

/**
 * API経由パスの3ケース検証
 * @returns {Object} 検証結果
 */
function runPhase2ApiPathVerification() {
  var ctx = _getPhase2TestState_();
  var results = [];

  function runCase(statusToSet, expectedDealResult, label) {
    // updateLead() のコアを再現: setValues → syncDealResultByStatus_
    var row = ctx.sheet.getDataRange().getValues()[ctx.testRow - 1].slice();
    row[ctx.statusIdx] = statusToSet;
    if (ctx.archiveDateIdx !== -1) row[ctx.archiveDateIdx] = '';
    if (ctx.archiveRsnIdx  !== -1) row[ctx.archiveRsnIdx]  = '';
    row[ctx.dealResultIdx] = '';  // リセット
    ctx.sheet.getRange(ctx.testRow, 1, 1, ctx.headers.length).setValues([row]);

    // Phase 2 の追加ロジック（updateLead に追加済み）
    syncDealResultByStatus_(ctx.sheet, ctx.headers, ctx.testRow, statusToSet);

    var actual = ctx.sheet.getRange(ctx.testRow, ctx.dealResultIdx + 1).getValue();
    var pass = actual === expectedDealResult;
    results.push({ label: label, statusSet: statusToSet, expected: expectedDealResult, actual: actual, pass: pass });
  }

  try {
    runCase('成約',      '成約', '[API] 成約 → 商談結果=成約');
    runCase('失注',      '失注', '[API] 失注 → 商談結果=失注');
    runCase('追客(短期)', '',    '[API] 追客(短期) → 商談結果不変（空のまま）');
  } finally {
    _restorePhase2TestLead_(ctx);
  }

  return {
    path:      'API経由（syncDealResultByStatus_ + setValues）',
    testLead:  PHASE2_TEST_LEAD_ID,
    original:  ctx.original,
    results:   results,
    allPassed: results.every(function(r) { return r.pass; })
  };
}

// ────────────────────────────────────────────────────────────────
// テスト B: onEdit 擬似実行パス
//   archiveOnStatusChange() に擬似イベントオブジェクトを渡して実行
//   ※ SpreadsheetApp.getActiveSpreadsheet().toast() は clasp run から
//     取得できないため、エラー扱いせず cell 値で合否判定する
// ────────────────────────────────────────────────────────────────

/**
 * onEdit経路の3ケース検証（擬似イベント）
 * @returns {Object} 検証結果
 */
function runPhase2OnEditVerification() {
  var ctx = _getPhase2TestState_();
  var results = [];

  var statusColForEvent = ctx.statusIdx + 1; // 1-indexed column

  function makeEvent(statusValue) {
    // onEdit イベントを実物と同形で構築
    // e.source.getActiveSheet() → 実シート参照
    // e.range.getRow()          → テストリードの行
    // e.range.getColumn()       → リードステータス列
    // e.value                   → 変更後の値
    return {
      source: {
        getActiveSheet: function() { return ctx.sheet; }
      },
      range: {
        getRow:    function() { return ctx.testRow; },
        getColumn: function() { return statusColForEvent; }
      },
      value: statusValue
    };
  }

  function runCase(statusToSet, expectedDealResult, label) {
    // テストリードをリセット
    var row = ctx.sheet.getDataRange().getValues()[ctx.testRow - 1].slice();
    row[ctx.dealResultIdx] = '';
    if (ctx.archiveDateIdx !== -1) row[ctx.archiveDateIdx] = '';
    if (ctx.archiveRsnIdx  !== -1) row[ctx.archiveRsnIdx]  = '';
    ctx.sheet.getRange(ctx.testRow, 1, 1, ctx.headers.length).setValues([row]);

    var toastError = null;
    try {
      archiveOnStatusChange(makeEvent(statusToSet));
    } catch(e) {
      // toast() が clasp run 環境で失敗する場合があるが、
      // それより前に syncDealResultByStatus_ は実行済み
      toastError = e.message;
    }

    var actual = ctx.sheet.getRange(ctx.testRow, ctx.dealResultIdx + 1).getValue();
    var pass = actual === expectedDealResult;
    var entry = {
      label:     label,
      statusSet: statusToSet,
      expected:  expectedDealResult,
      actual:    actual,
      pass:      pass
    };
    if (toastError) entry.toastError = toastError;
    results.push(entry);
  }

  try {
    runCase('成約',      '成約', '[onEdit] 成約 → 商談結果=成約');
    runCase('失注',      '失注', '[onEdit] 失注 → 商談結果=失注');
    runCase('追客(短期)', '',    '[onEdit] 追客(短期) → 商談結果不変（空のまま）');
  } finally {
    _restorePhase2TestLead_(ctx);
  }

  return {
    path:      'onEdit擬似実行（archiveOnStatusChange + 擬似イベント）',
    testLead:  PHASE2_TEST_LEAD_ID,
    original:  ctx.original,
    results:   results,
    allPassed: results.every(function(r) { return r.pass; }),
    note:      'toastError は clasp run 環境での SpreadsheetApp.getActiveSpreadsheet() 未サポートによる想定内エラー'
  };
}

/**
 * 両パスをまとめて実行
 */
function runPhase2AllVerifications() {
  var apiResult    = runPhase2ApiPathVerification();
  var onEditResult = runPhase2OnEditVerification();

  return {
    timestamp:    new Date().toISOString(),
    prNumber:     627,
    apiPath:      apiResult,
    onEditPath:   onEditResult,
    overallPass:  apiResult.allPassed && onEditResult.allPassed
  };
}
