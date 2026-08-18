/**
 * DEV専用: ステータス=キャンセル かつ キャンセル理由が空欄の行に
 *          理由・メモを一括補完する。
 *
 * 対象: repairDevUnpaidOrderCancellations が CANCELLATION_REASON を書かずに
 *       ステータスのみ「キャンセル」に設定した 38件。
 *
 * ★ dryRunCancellationReasonBackfill で 38件を確認してから
 *    applyCancellationReasonBackfill を実行すること。
 */

var CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT = 38;
var CANCELLATION_REASON_BACKFILL_REASON = '未入金';
var CANCELLATION_REASON_BACKFILL_NOTE   = '2026-08-18 一括設定（支払確認日なしのため）';

// ─────────────────────────────────────────────────────────────────────────────
// 【1】ドライラン（書き込みなし）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 対象件数を確認する。書き込みは一切しない。DEV 専用。
 *
 * 合格条件: 対象件数 = 38件
 * 38件以外なら ABORT と報告する。
 *
 * @returns {string}
 */
function dryRunCancellationReasonBackfill() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunCancellationReasonBackfill is available only in development');
  }

  var inspection = inspectCancellationReasonBackfillTargets_(getSpreadsheet());
  var count = inspection.targetCount;
  var isExpected = count === CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT;

  var out = [
    '=== dryRunCancellationReasonBackfill ===',
    '対象件数（ステータス=キャンセル かつ キャンセル理由空欄）: ' + count + '件',
    isExpected
      ? '判定: OK（期待値 ' + CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT + '件 と一致）'
      : '判定: ABORT（期待値 ' + CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT + '件 と不一致。書き込み禁止）',
    '',
    '--- DRY RUN 完了（書き込みなし）---'
  ];

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 【2】書き込み実行
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ステータス=キャンセル かつ キャンセル理由が空欄の行に
 * キャンセル理由とキャンセルメモを書き込む。DEV 専用。
 *
 * 要件:
 *   - 対象件数が 38件以外なら中断する
 *   - ステータス列は変更しない
 *   - 既に理由が入っている行には触れない
 *   - LockService で保護する
 *   - 書き込み後に再読み取りして検証する
 *
 * @returns {Object}
 */
function applyCancellationReasonBackfill() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyCancellationReasonBackfill is available only in development');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return executeCancellationReasonBackfill_(getSpreadsheet());
  } finally {
    lock.releaseLock();
  }
}

function executeCancellationReasonBackfill_(ss) {
  var inspection = inspectCancellationReasonBackfillTargets_(ss);

  if (inspection.targetCount !== CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT) {
    return {
      success: false,
      resultType: 'BACKFILL_EXPECTATION_MISMATCH',
      expectedCount: CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT,
      actualCount: inspection.targetCount
    };
  }

  var sheet        = inspection.sheet;
  var dataRowCount = inspection.dataRowCount;
  var reasonColNum = inspection.reasonColNum;
  var noteColNum   = inspection.noteColNum;
  var targetIdxs   = inspection.targetDataRowIndexes;

  // 現在の全行の理由・メモ列を読み込む（既存値を保護するため）
  var reasonValues = sheet.getRange(2, reasonColNum, dataRowCount, 1).getValues();
  var noteValues   = sheet.getRange(2, noteColNum,   dataRowCount, 1).getValues();

  // 対象行のみ上書き
  targetIdxs.forEach(function(idx) {
    reasonValues[idx][0] = CANCELLATION_REASON_BACKFILL_REASON;
    noteValues[idx][0]   = CANCELLATION_REASON_BACKFILL_NOTE;
  });

  // 書き込み（列単位で一括）
  sheet.getRange(2, reasonColNum, dataRowCount, 1).setValues(reasonValues);
  sheet.getRange(2, noteColNum,   dataRowCount, 1).setValues(noteValues);

  // 書き込み後の検証（再読み取り → 対象行全件の値を確認）
  var verifiedReason = sheet.getRange(2, reasonColNum, dataRowCount, 1).getValues();
  var verifiedNote   = sheet.getRange(2, noteColNum,   dataRowCount, 1).getValues();

  var verifiedCount = 0;
  var verificationFailed = false;
  targetIdxs.forEach(function(idx) {
    var r = String(verifiedReason[idx][0] || '').trim();
    var n = String(verifiedNote[idx][0]   || '').trim();
    if (r === CANCELLATION_REASON_BACKFILL_REASON && n === CANCELLATION_REASON_BACKFILL_NOTE) {
      verifiedCount++;
    } else {
      verificationFailed = true;
    }
  });

  if (verificationFailed) {
    return {
      success: false,
      resultType: 'BACKFILL_POST_WRITE_VERIFICATION_FAILED',
      verifiedCount: verifiedCount,
      expectedCount: CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT
    };
  }

  return {
    success: true,
    resultType: 'BACKFILL_SUCCEEDED',
    actualDataChangeCount: inspection.targetCount,
    verifiedCount: verifiedCount
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ステータス=キャンセル かつ CANCELLATION_REASON が空欄の行を収集する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{
 *   sheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   dataRowCount: number,
 *   targetCount: number,
 *   targetDataRowIndexes: number[],
 *   reasonColNum: number,
 *   noteColNum: number
 * }}
 */
function inspectCancellationReasonBackfillTargets_(ss) {
  var sheet   = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    throw new Error('BACKFILL_SCHEMA_INVALID: no data');
  }

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var statusHeader  = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
  var reasonHeader  = getCoreSchemaV1HeaderName('ORDERS', 'CANCELLATION_REASON');
  var noteHeader    = getCoreSchemaV1HeaderName('ORDERS', 'CANCELLATION_NOTE');
  var orderIdHeader = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');

  var statusIdx  = rawHeaders.indexOf(statusHeader);
  var reasonIdx  = rawHeaders.indexOf(reasonHeader);
  var noteIdx    = rawHeaders.indexOf(noteHeader);
  var orderIdIdx = rawHeaders.indexOf(orderIdHeader);

  if ([statusIdx, reasonIdx, noteIdx, orderIdIdx].some(function(i) { return i < 0; })) {
    throw new Error('BACKFILL_SCHEMA_INVALID: required header missing');
  }

  var cancelledValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'CANCELLED');

  var dataRowCount = lastRow - 1;
  var data = sheet.getRange(2, 1, dataRowCount, lastCol).getValues();

  var targetDataRowIndexes = [];
  data.forEach(function(row, idx) {
    var orderId = row[orderIdIdx];
    if (orderId === '' || orderId === null || orderId === undefined) return;

    var isCancelled = String(row[statusIdx] || '').trim() === cancelledValue;
    var hasReason   = row[reasonIdx] !== '' && row[reasonIdx] !== null && row[reasonIdx] !== undefined;

    if (isCancelled && !hasReason) {
      targetDataRowIndexes.push(idx);
    }
  });

  return {
    sheet:                sheet,
    dataRowCount:         dataRowCount,
    targetCount:          targetDataRowIndexes.length,
    targetDataRowIndexes: targetDataRowIndexes,
    reasonColNum:         reasonIdx + 1,
    noteColNum:           noteIdx   + 1
  };
}
