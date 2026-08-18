/**
 * キャンセル理由の誤り修正（DEV専用）
 *
 * 対象: CANCELLATION_REASON='未入金' かつ PAYMENT_CONFIRMED_AT に値がある行
 *       （2026-08-18 の一括バックフィルで誤って「未入金」が書き込まれた行）
 *
 * dryRunFixCancellationReason  — 対象件数を報告するのみ（書き込みなし）
 * applyFixCancellationReason   — 対象が2件であることを確認してから修正を書き込む
 *
 * 書き込む値:
 *   CANCELLATION_REASON: '要確認'
 *   CANCELLATION_NOTE:   '2026-08-18 一括設定の誤り。入金済みのため要確認'
 *
 * 物理ヘッダー名は getCoreSchemaV1HeaderName 経由のみ参照する。
 */

var FIX_CANCELLATION_EXPECTED_COUNT       = 2;
var FIX_CANCELLATION_WRONG_REASON         = '未入金';
var FIX_CANCELLATION_CORRECT_REASON       = '要確認';
var FIX_CANCELLATION_CORRECT_NOTE         = '2026-08-18 一括設定の誤り。入金済みのため要確認';

/**
 * 対象件数を報告する。書き込みなし。
 * @returns {string}
 */
function dryRunFixCancellationReason() {
  var meta = fixCancellationReasonMeta_();

  var out = [
    '=== dryRunFixCancellationReason ===',
    '対象件数: ' + meta.targetRows.length + '件',
    '（キャンセル理由=「' + FIX_CANCELLATION_WRONG_REASON + '」 かつ 支払確認日あり）',
    '',
    meta.targetRows.length === FIX_CANCELLATION_EXPECTED_COUNT
      ? '✅ 期待値 ' + FIX_CANCELLATION_EXPECTED_COUNT + '件 と一致'
      : '❌ 期待値 ' + FIX_CANCELLATION_EXPECTED_COUNT + '件 と不一致 → 中断してください',
    '',
    '--- DRY RUN 完了（書き込みなし）---'
  ].join('\n');

  Logger.log(out);
  return out;
}

/**
 * 対象2件のキャンセル理由・メモを修正する。
 * 対象が2件でなければ中断。DEV専用。LockService で保護。
 * @returns {string}
 */
function applyFixCancellationReason() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyFixCancellationReason は development 環境でのみ実行できます');
  }

  var meta = fixCancellationReasonMeta_();
  if (meta.targetRows.length !== FIX_CANCELLATION_EXPECTED_COUNT) {
    var abortMsg = [
      '=== applyFixCancellationReason 中断 ===',
      '対象件数: ' + meta.targetRows.length + '件',
      '期待値:   ' + FIX_CANCELLATION_EXPECTED_COUNT + '件',
      '一致しないため書き込みを行いませんでした。'
    ].join('\n');
    Logger.log(abortMsg);
    return abortMsg;
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    meta.targetRows.forEach(function(item) {
      meta.sheet.getRange(item.sheetRow, meta.colCancellationReason).setValue(FIX_CANCELLATION_CORRECT_REASON);
      meta.sheet.getRange(item.sheetRow, meta.colCancellationNote).setValue(FIX_CANCELLATION_CORRECT_NOTE);
    });

    // 書き込み後に再読み取りして検証
    var verify = fixCancellationReasonMeta_();
    var remaining = verify.targetRows.length;

    var out = [
      '=== applyFixCancellationReason ===',
      '修正件数: ' + FIX_CANCELLATION_EXPECTED_COUNT + '件',
      '',
      '[検証]',
      '再読み取り後の残件数（「' + FIX_CANCELLATION_WRONG_REASON + '」×確認日あり）: ' + remaining + '件',
      remaining === 0 ? '✅ 全件修正確認済み' : '❌ ' + remaining + '件が未修正です',
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
 * シートを読み取って対象行情報を返す。
 * @returns {{
 *   sheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   colCancellationReason: number,
 *   colCancellationNote: number,
 *   targetRows: Array<{ sheetRow: number }>
 * }}
 */
function fixCancellationReasonMeta_() {
  var tableKey = 'ORDERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var ss       = getSpreadsheet();
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();
  var lastRow  = sheet.getLastRow();

  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return String(h).trim();
  });

  function colOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = rawHeaders.indexOf(name);
    if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + headerKey);
    return idx + 1; // 1-based
  }

  var colOrderId            = colOf('ORDER_ID');
  var colCancellationReason = colOf('CANCELLATION_REASON');
  var colCancellationNote   = colOf('CANCELLATION_NOTE');
  var colPaymentConfirmedAt = colOf('PAYMENT_CONFIRMED_AT');

  var dataRowCount = lastRow - table.headerRowNumber;
  if (dataRowCount <= 0) {
    return { sheet: sheet, colCancellationReason: colCancellationReason, colCancellationNote: colCancellationNote, targetRows: [] };
  }

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  var targetRows = [];
  data.forEach(function(row, i) {
    var orderId = String(row[colOrderId - 1] || '').trim();
    if (!orderId) return;

    var reason    = String(row[colCancellationReason - 1] || '').trim();
    var confirmed = String(row[colPaymentConfirmedAt - 1] || '').trim();

    if (reason === FIX_CANCELLATION_WRONG_REASON && confirmed !== '') {
      targetRows.push({ sheetRow: table.headerRowNumber + 1 + i });
    }
  });

  return {
    sheet: sheet,
    colCancellationReason: colCancellationReason,
    colCancellationNote: colCancellationNote,
    targetRows: targetRows
  };
}
