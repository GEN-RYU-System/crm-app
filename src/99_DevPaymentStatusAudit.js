/**
 * 支払いステータス分類の検証（読み取り専用・DEV専用）
 *
 * investigatePaymentStatusClassification()
 *   - 書き込みは一切しない
 *   - オーダーID・顧客名などのデータ値は出力しない（件数のみ）
 */

function investigatePaymentStatusClassification() {
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
    return idx; // 0-based for array access
  }

  var idxOrderId            = colOf('ORDER_ID');
  var idxCancellationReason = colOf('CANCELLATION_REASON');
  var idxPaymentConfirmedAt = colOf('PAYMENT_CONFIRMED_AT');
  var idxPaymentDueAt       = colOf('PAYMENT_DUE_AT');

  var dataRowCount = lastRow - table.headerRowNumber;
  if (dataRowCount <= 0) {
    return '対象データなし';
  }

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  // 集計変数
  var combo = {
    reasonAndConfirmed:    0,  // キャンセル理由あり かつ 支払確認日あり
    reasonNoConfirmed:     0,  // キャンセル理由あり かつ 支払確認日なし
    noReasonAndConfirmed:  0,  // キャンセル理由なし かつ 支払確認日あり
    noReasonNoConfirmed:   0   // キャンセル理由なし かつ 支払確認日なし
  };
  var reasonValuesWhenConfirmed = {}; // キャンセル理由あり かつ 支払確認日あり の理由別件数
  var overdueCount = 0;              // 調査項目3

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  data.forEach(function(row) {
    var orderId = String(row[idxOrderId] || '').trim();
    if (!orderId) return;

    var cancellationReason = String(row[idxCancellationReason] || '').trim();
    var paymentConfirmedAt = String(row[idxPaymentConfirmedAt] || '').trim();
    var paymentDueAt       = row[idxPaymentDueAt];

    var hasReason    = cancellationReason !== '';
    var hasConfirmed = paymentConfirmedAt !== '';

    // 1. 4パターンの組み合わせ
    if (hasReason && hasConfirmed)    { combo.reasonAndConfirmed++; }
    if (hasReason && !hasConfirmed)   { combo.reasonNoConfirmed++; }
    if (!hasReason && hasConfirmed)   { combo.noReasonAndConfirmed++; }
    if (!hasReason && !hasConfirmed)  { combo.noReasonNoConfirmed++; }

    // 2. 「キャンセル理由あり かつ 支払確認日あり」の理由の種類と件数
    if (hasReason && hasConfirmed) {
      reasonValuesWhenConfirmed[cancellationReason] = (reasonValuesWhenConfirmed[cancellationReason] || 0) + 1;
    }

    // 3. 支払期日が今日より前 かつ 支払確認日なし かつ キャンセル理由なし
    if (!hasReason && !hasConfirmed) {
      var dueDate = new Date(paymentDueAt);
      if (!isNaN(dueDate.getTime()) && dueDate < today) {
        overdueCount++;
      }
    }
  });

  var out = [
    '=== investigatePaymentStatusClassification ===',
    '',
    '[1] キャンセル理由 × 支払確認日 の組み合わせ件数',
    '  理由あり × 確認日あり: ' + combo.reasonAndConfirmed + '件',
    '  理由あり × 確認日なし: ' + combo.reasonNoConfirmed + '件',
    '  理由なし × 確認日あり: ' + combo.noReasonAndConfirmed + '件',
    '  理由なし × 確認日なし: ' + combo.noReasonNoConfirmed + '件',
    '  合計: ' + (combo.reasonAndConfirmed + combo.reasonNoConfirmed + combo.noReasonAndConfirmed + combo.noReasonNoConfirmed) + '件',
    '',
    '[2] 「理由あり × 確認日あり」のキャンセル理由の内訳'
  ];

  if (combo.reasonAndConfirmed === 0) {
    out.push('  該当なし');
  } else {
    Object.keys(reasonValuesWhenConfirmed).sort().forEach(function(reason) {
      out.push('  「' + reason + '」: ' + reasonValuesWhenConfirmed[reason] + '件');
    });
  }

  out = out.concat([
    '',
    '[3] 支払期日が今日より前 かつ 支払確認日なし かつ キャンセル理由なし（実遅延）',
    '  件数: ' + overdueCount + '件',
    '',
    '--- 調査完了（書き込みなし）---'
  ]);

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * ORDERS.PAYMENT_METHOD（決済手段）の値の種類と件数を調査する。
 * 書き込みなし。顧客名・オーダーIDは出力しない。
 * @returns {string}
 */
function investigatePaymentMethod() {
  var tableKey = 'ORDERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var ss       = getSpreadsheet();
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastCol  = sheet.getLastColumn();
  var lastRow  = sheet.getLastRow();

  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idxOrderId       = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'ORDER_ID'));
  var idxPaymentMethod = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'PAYMENT_METHOD'));

  if (idxPaymentMethod === -1) throw new Error('PAYMENT_METHOD ヘッダーが見つかりません');

  var dataRowCount = lastRow - table.headerRowNumber;
  if (dataRowCount <= 0) return '対象データなし';

  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  var totalCount = 0;
  var blankCount = 0;
  var valueCounts = {};

  data.forEach(function(row) {
    var orderId = String(row[idxOrderId] || '').trim();
    if (!orderId) return;
    totalCount++;

    var method = String(row[idxPaymentMethod] || '').trim();
    if (method === '') {
      blankCount++;
    } else {
      valueCounts[method] = (valueCounts[method] || 0) + 1;
    }
  });

  var out = [
    '=== investigatePaymentMethod ===',
    '総件数:   ' + totalCount + '件',
    '空欄件数: ' + blankCount + '件',
    '',
    '[値の種類と件数]'
  ];

  Object.keys(valueCounts).sort().forEach(function(method) {
    out.push('  「' + method + '」: ' + valueCounts[method] + '件');
  });

  out.push('');
  out.push('--- 調査完了（書き込みなし）---');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
