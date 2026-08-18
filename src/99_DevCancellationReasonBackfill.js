/**
 * キャンセル理由バックフィル（DEV 専用）
 *
 * 対象: ORDERS で STATUS=キャンセル かつ CANCELLATION_REASON が空欄の行
 *
 * dryRunCancellationReasonBackfill  — 対象件数を報告するのみ（書き込みなし）
 * applyCancellationReasonBackfill   — 書き込み実行。DEV 専用、対象38件以外は中断
 *
 * 物理ヘッダー名は getCoreSchemaV1HeaderName / getCoreSchemaV1Value を通じてのみ参照する。
 */

var CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT = 38;
var CANCELLATION_REASON_BACKFILL_VALUE = '未入金';
var CANCELLATION_NOTE_BACKFILL_VALUE   = '2026-08-18 一括設定（支払確認日なしのため）';

/**
 * ステータス=キャンセル かつ キャンセル理由が空欄の行数を数えて返す。
 * 書き込みは一切しない。
 *
 * @returns {string}
 */
function dryRunCancellationReasonBackfill() {
  var result = cancellationReasonBackfillScan_();

  var out = [
    '=== dryRunCancellationReasonBackfill ===',
    '対象件数: ' + result.targetCount + '件',
    '（STATUS=キャンセル かつ キャンセル理由が空欄）',
    '',
    result.targetCount === CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT
      ? '✅ 期待値 ' + CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT + '件 と一致'
      : '❌ 期待値 ' + CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT + '件 と不一致 → 中断してください',
    '',
    '--- DRY RUN 完了（書き込みなし）---'
  ].join('\n');

  Logger.log(out);
  return out;
}

/**
 * キャンセル理由が空欄の行にのみ書き込む。
 * 理由が既にある行・ステータスが非キャンセルの行には触れない。
 * 対象が CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT 件でなければ中断。
 * DEV 専用。LockService で保護。書き込み後に再読み取りして検証。
 *
 * @returns {string}
 */
function applyCancellationReasonBackfill() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyCancellationReasonBackfill は development 環境でのみ実行できます');
  }

  var scan = cancellationReasonBackfillScan_();
  if (scan.targetCount !== CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT) {
    var abortMsg = [
      '=== applyCancellationReasonBackfill 中断 ===',
      '対象件数: ' + scan.targetCount + '件',
      '期待値:   ' + CANCELLATION_REASON_BACKFILL_EXPECTED_COUNT + '件',
      '一致しないため書き込みを行いませんでした。'
    ].join('\n');
    Logger.log(abortMsg);
    return abortMsg;
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var meta   = cancellationReasonBackfillMeta_();
    var sheet  = meta.sheet;
    var data   = meta.data;

    var writtenCount = 0;
    data.targetRows.forEach(function(item) {
      sheet.getRange(item.sheetRow, meta.colCancellationReason).setValue(CANCELLATION_REASON_BACKFILL_VALUE);
      sheet.getRange(item.sheetRow, meta.colCancellationNote).setValue(CANCELLATION_NOTE_BACKFILL_VALUE);
      writtenCount++;
    });

    // 書き込み後に再読み取りして検証
    var verifyMeta = cancellationReasonBackfillMeta_();
    var remaining  = verifyMeta.data.targetRows.length;

    var out = [
      '=== applyCancellationReasonBackfill ===',
      '書き込み件数: ' + writtenCount + '件',
      '',
      '[検証]',
      '再読み取り後の空欄残件数: ' + remaining + '件',
      remaining === 0 ? '✅ 全件書き込み確認済み' : '❌ ' + remaining + '件が未書き込みです',
      '',
      '--- 完了 ---'
    ].join('\n');

    Logger.log(out);
    return out;
  } finally {
    lock.releaseLock();
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

/**
 * 対象件数のみを返す（シートを1回読む）。
 * @returns {{ targetCount: number }}
 */
function cancellationReasonBackfillScan_() {
  var meta = cancellationReasonBackfillMeta_();
  return { targetCount: meta.data.targetRows.length };
}

/**
 * シートのメタデータと対象行情報を返す。
 * @returns {{
 *   sheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   colStatus: number,
 *   colCancellationReason: number,
 *   colCancellationNote: number,
 *   data: { targetRows: Array<{ sheetRow: number }> }
 * }}
 */
function cancellationReasonBackfillMeta_() {
  var tableKey    = 'ORDERS';
  var table       = getCoreSchemaV1Table(tableKey);
  var ss          = getSpreadsheet();
  var sheet       = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol     = sheet.getLastColumn();
  var lastRow     = sheet.getLastRow();

  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return String(h).trim();
  });

  function colOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = rawHeaders.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + headerKey);
    return idx + 1; // 1-based
  }

  var colStatus             = colOf('STATUS');
  var colCancellationReason = colOf('CANCELLATION_REASON');
  var colCancellationNote   = colOf('CANCELLATION_NOTE');
  var colOrderId            = colOf('ORDER_ID');

  var cancelledValue = getCoreSchemaV1Value(tableKey, 'STATUS', 'CANCELLED');

  var dataRowCount = lastRow - table.headerRowNumber;
  if (dataRowCount <= 0) {
    return {
      sheet: sheet,
      colStatus: colStatus,
      colCancellationReason: colCancellationReason,
      colCancellationNote: colCancellationNote,
      data: { targetRows: [] }
    };
  }

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  var targetRows = [];
  data.forEach(function(row, i) {
    var orderId = String(row[colOrderId - 1] || '').trim();
    if (!orderId) return;

    var status             = String(row[colStatus - 1] || '').trim();
    var cancellationReason = String(row[colCancellationReason - 1] || '').trim();

    if (status === cancelledValue && cancellationReason === '') {
      targetRows.push({ sheetRow: table.headerRowNumber + 1 + i });
    }
  });

  return {
    sheet: sheet,
    colStatus: colStatus,
    colCancellationReason: colCancellationReason,
    colCancellationNote: colCancellationNote,
    data: { targetRows: targetRows }
  };
}
