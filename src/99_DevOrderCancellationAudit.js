/**
 * 【読み取り専用 / DEV専用】
 * オーダー管理のキャンセル関連データ整合性を調査する。
 * データ値（ID・氏名・理由テキスト等）は出力しない。件数のみ報告する。
 */
function auditOrderCancellationConsistency() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditOrderCancellationConsistency is available only in development');
  }

  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return '[ERROR] オーダー管理にデータなし';
  }

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var statusHeader             = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
  var cancellationReasonHeader = getCoreSchemaV1HeaderName('ORDERS', 'CANCELLATION_REASON');
  var cancellationNoteHeader   = getCoreSchemaV1HeaderName('ORDERS', 'CANCELLATION_NOTE');
  var orderIdHeader            = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');

  var statusIdx             = rawHeaders.indexOf(statusHeader);
  var cancellationReasonIdx = rawHeaders.indexOf(cancellationReasonHeader);
  var cancellationNoteIdx   = rawHeaders.indexOf(cancellationNoteHeader);
  var orderIdIdx            = rawHeaders.indexOf(orderIdHeader);

  if ([statusIdx, cancellationReasonIdx, cancellationNoteIdx, orderIdIdx].some(function(i) { return i < 0; })) {
    return '[ERROR] 必要な列が見つかりません';
  }

  var cancelledValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'CANCELLED');

  var dataRowCount = lastRow - 1;
  var data = sheet.getRange(2, 1, dataRowCount, lastCol).getValues();

  // 集計カウンタ
  var totalRecords           = 0;
  var cancelledCount         = 0;
  var reasonFilledCount      = 0;
  var noteFilledCount        = 0;

  // クロス集計
  var cancelledWithReason    = 0;
  var cancelledWithoutReason = 0;
  var notCancelledWithReason = 0;
  var notCancelledWithoutReason = 0;

  // 「ステータス=キャンセル かつ 理由なし」行のメモ有無
  var cancelledNoReasonWithNote    = 0;
  var cancelledNoReasonWithoutNote = 0;

  data.forEach(function(row) {
    var orderId = row[orderIdIdx];
    if (orderId === '' || orderId === null || orderId === undefined) return;
    totalRecords++;

    var status = String(row[statusIdx] || '').trim();
    var reason = row[cancellationReasonIdx];
    var note   = row[cancellationNoteIdx];

    var isCancelled = status === cancelledValue;
    var hasReason   = reason !== '' && reason !== null && reason !== undefined;
    var hasNote     = note   !== '' && note   !== null && note   !== undefined;

    if (isCancelled) cancelledCount++;
    if (hasReason)   reasonFilledCount++;
    if (hasNote)     noteFilledCount++;

    if (isCancelled && hasReason)   cancelledWithReason++;
    if (isCancelled && !hasReason)  cancelledWithoutReason++;
    if (!isCancelled && hasReason)  notCancelledWithReason++;
    if (!isCancelled && !hasReason) notCancelledWithoutReason++;

    if (isCancelled && !hasReason) {
      if (hasNote) {
        cancelledNoReasonWithNote++;
      } else {
        cancelledNoReasonWithoutNote++;
      }
    }
  });

  var out = [
    '=== auditOrderCancellationConsistency ===',
    '',
    '[1. ステータス]',
    '  総件数: ' + totalRecords + '件',
    '  ステータス = "' + cancelledValue + '": ' + cancelledCount + '件',
    '',
    '[2. キャンセル理由 / キャンセルメモ]',
    '  ' + cancellationReasonHeader + ' に値あり: ' + reasonFilledCount + '件',
    '  ' + cancellationNoteHeader   + ' に値あり: ' + noteFilledCount   + '件',
    '',
    '[3. ステータス × キャンセル理由 クロス集計]',
    '  ステータス=キャンセル かつ 理由あり:    ' + cancelledWithReason    + '件',
    '  ステータス=キャンセル かつ 理由なし:    ' + cancelledWithoutReason + '件',
    '  ステータス≠キャンセル かつ 理由あり:   ' + notCancelledWithReason + '件',
    '  ステータス≠キャンセル かつ 理由なし:   ' + notCancelledWithoutReason + '件',
    '  （合計: ' + (cancelledWithReason + cancelledWithoutReason + notCancelledWithReason + notCancelledWithoutReason) + '件）',
    '',
    '[4. ステータス=キャンセル かつ 理由なし の行: メモ有無]',
    '  キャンセルメモあり: ' + cancelledNoReasonWithNote    + '件',
    '  キャンセルメモなし: ' + cancelledNoReasonWithoutNote + '件',
    '',
    '--- 調査完了（書き込みなし）---'
  ];

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
