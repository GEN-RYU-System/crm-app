/**
 * 支払いステータス算出・バックフィルサービス
 *
 * 書き込みは applyPaymentStatusBackfill のみ。DEV 環境専用。
 * calculatePaymentStatus は純粋な計算のみ（書き込みなし）。
 * dryRunPaymentStatusBackfill は算出結果の件数報告のみ（書き込みなし）。
 */

/**
 * 1オーダー分のデータから支払いステータスを返す。
 * シートへの書き込みは行わない。
 *
 * 判定の優先順位（上から最初に該当したものを返す）:
 *   1. キャンセル : CANCELLATION_REASON に値がある
 *   2. 入金済み   : PAYMENT_CONFIRMED_AT に値がある
 *   3. 遅延       : PAYMENT_DUE_AT が今日より前（過去）
 *   4. 未入金     : 上記以外
 *
 * ※ 一部入金・保留は手動設定のみ。この関数では返さない。
 *
 * @param {{ cancellationReason: *, paymentConfirmedAt: *, paymentDueAt: * }} orderRow
 * @returns {string} Core Schema V1 ORDERS.PAYMENT_STATUS の値
 */
function calculatePaymentStatus(orderRow) {
  var cancelledValue = getCoreSchemaV1Value('ORDERS', 'PAYMENT_STATUS', 'CANCELLED');
  var paidValue      = getCoreSchemaV1Value('ORDERS', 'PAYMENT_STATUS', 'PAID');
  var overdueValue   = getCoreSchemaV1Value('ORDERS', 'PAYMENT_STATUS', 'OVERDUE');
  var unpaidValue    = getCoreSchemaV1Value('ORDERS', 'PAYMENT_STATUS', 'UNPAID');

  // 1. キャンセル
  if (!paymentStatusIsEmpty_(orderRow.cancellationReason)) {
    return cancelledValue;
  }

  // 2. 入金済み
  if (!paymentStatusIsEmpty_(orderRow.paymentConfirmedAt)) {
    return paidValue;
  }

  // 3. 遅延: 支払期日が今日より前
  if (!paymentStatusIsEmpty_(orderRow.paymentDueAt)) {
    var dueDate = new Date(orderRow.paymentDueAt);
    var today   = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(dueDate.getTime()) && dueDate < today) {
      return overdueValue;
    }
  }

  // 4. 未入金
  return unpaidValue;
}

/**
 * 全オーダーについて支払いステータスの算出結果を件数で報告する。
 * 書き込みは一切しない。
 *
 * @returns {string}
 */
function dryRunPaymentStatusBackfill() {
  var ss = getSpreadsheet();
  var ordersMeta = readPaymentStatusServiceSheet_(ss, [
    'ORDER_ID', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'PAYMENT_DUE_AT', 'PAYMENT_STATUS'
  ]);

  var counts = {};
  var totalCount = 0;

  ordersMeta.rows.forEach(function(row) {
    var orderId = String(row.ORDER_ID || '').trim();
    if (!orderId) return;
    totalCount++;

    var status = calculatePaymentStatus({
      cancellationReason: row.CANCELLATION_REASON,
      paymentConfirmedAt: row.PAYMENT_CONFIRMED_AT,
      paymentDueAt:       row.PAYMENT_DUE_AT
    });

    counts[status] = (counts[status] || 0) + 1;
  });

  var out = [
    '=== dryRunPaymentStatusBackfill ===',
    '総件数: ' + totalCount + '件',
    '',
    '[算出結果内訳]'
  ];

  Object.keys(counts).sort().forEach(function(status) {
    out.push('  ' + status + ': ' + counts[status] + '件');
  });

  out.push('');
  out.push('--- DRY RUN 完了（書き込みなし）---');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 支払いステータスが空欄の行にのみ算出値を書き込む。
 * 既に値がある行には触れない。
 * DEV 環境専用。LockService で保護。
 *
 * @returns {string}
 */
function applyPaymentStatusBackfill() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyPaymentStatusBackfill は development 環境でのみ実行できます');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var ss          = getSpreadsheet();
    var tableKey    = 'ORDERS';
    var table       = getCoreSchemaV1Table(tableKey);
    var sheet       = getCoreSchemaV1Sheet(ss, tableKey);
    var lastCol     = sheet.getLastColumn();
    var lastRow     = sheet.getLastRow();

    if (lastRow < 2 || lastCol < 1) {
      lock.releaseLock();
      return '書き込み対象行なし（データが空）';
    }

    var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
      return String(h).trim();
    });

    function colOf(headerKey) {
      var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
      var idx  = rawHeaders.indexOf(name);
      if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + headerKey);
      return idx + 1; // 1-based
    }

    var colOrderId           = colOf('ORDER_ID');
    var colCancellationReason = colOf('CANCELLATION_REASON');
    var colPaymentConfirmedAt = colOf('PAYMENT_CONFIRMED_AT');
    var colPaymentDueAt       = colOf('PAYMENT_DUE_AT');
    var colPaymentStatus      = colOf('PAYMENT_STATUS');

    var dataRowCount = lastRow - table.headerRowNumber;
    var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

    var writtenCount = 0;
    var skippedCount = 0;

    data.forEach(function(row, i) {
      var orderId = String(row[colOrderId - 1] || '').trim();
      if (!orderId) return;

      var currentPaymentStatus = String(row[colPaymentStatus - 1] || '').trim();
      if (currentPaymentStatus !== '') {
        skippedCount++;
        return; // 既に値がある行は触れない
      }

      var newStatus = calculatePaymentStatus({
        cancellationReason: row[colCancellationReason - 1],
        paymentConfirmedAt: row[colPaymentConfirmedAt - 1],
        paymentDueAt:       row[colPaymentDueAt - 1]
      });

      var dataRow = table.headerRowNumber + 1 + i;
      sheet.getRange(dataRow, colPaymentStatus).setValue(newStatus);
      writtenCount++;
    });

    var result = [
      '=== applyPaymentStatusBackfill ===',
      '書き込み件数: ' + writtenCount + '件',
      'スキップ件数（既存値あり）: ' + skippedCount + '件',
      '--- 完了 ---'
    ].join('\n');

    Logger.log(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * PAYMENT_STATUS 列を実際に読み、書き込み結果を検証する。
 * 書き込みは一切しない。オーダーID・顧客名は出力しない。
 *
 * 報告内容:
 *   総件数 / 空欄件数 / 値ごとの件数 / 未定義値件数
 *   calculatePaymentStatus との一致件数・不一致件数
 *
 * @returns {string}
 */
function verifyPaymentStatusBackfill() {
  var tableKey = 'ORDERS';

  // 定義済み値の一覧を Schema から取得する
  var definedValues = {};
  ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'ON_HOLD', 'CANCELLED'].forEach(function(key) {
    definedValues[getCoreSchemaV1Value(tableKey, 'PAYMENT_STATUS', key)] = true;
  });

  var ordersMeta = readPaymentStatusServiceSheet_(getSpreadsheet(), [
    'ORDER_ID', 'CANCELLATION_REASON', 'PAYMENT_CONFIRMED_AT', 'PAYMENT_DUE_AT', 'PAYMENT_STATUS'
  ]);

  var totalCount     = 0;
  var blankCount     = 0;
  var undefinedCount = 0;
  var valueCounts    = {};
  var matchCount     = 0;
  var mismatchCount  = 0;

  ordersMeta.rows.forEach(function(row) {
    var orderId = String(row.ORDER_ID || '').trim();
    if (!orderId) return;
    totalCount++;

    var actual = String(row.PAYMENT_STATUS || '').trim();

    // 空欄チェック
    if (actual === '') {
      blankCount++;
    }

    // 値ごとの件数
    if (actual !== '') {
      valueCounts[actual] = (valueCounts[actual] || 0) + 1;
    }

    // 未定義値チェック（空欄は除く）
    if (actual !== '' && !definedValues[actual]) {
      undefinedCount++;
    }

    // calculatePaymentStatus との比較
    var expected = calculatePaymentStatus({
      cancellationReason: row.CANCELLATION_REASON,
      paymentConfirmedAt: row.PAYMENT_CONFIRMED_AT,
      paymentDueAt:       row.PAYMENT_DUE_AT
    });

    if (actual === expected) {
      matchCount++;
    } else {
      mismatchCount++;
    }
  });

  var out = [
    '=== verifyPaymentStatusBackfill ===',
    '',
    '[実データ集計]',
    '総件数:     ' + totalCount + '件',
    '空欄件数:   ' + blankCount + '件',
    '未定義値:   ' + undefinedCount + '件',
    '',
    '[値ごとの件数]'
  ];

  Object.keys(valueCounts).sort().forEach(function(v) {
    out.push('  ' + v + ': ' + valueCounts[v] + '件');
  });
  if (Object.keys(valueCounts).length === 0) {
    out.push('  （値なし）');
  }

  out = out.concat([
    '',
    '[calculatePaymentStatus との比較]',
    '  一致:   ' + matchCount + '件',
    '  不一致: ' + mismatchCount + '件',
    '',
    blankCount === 0 && undefinedCount === 0 && mismatchCount === 0
      ? '✅ 全合格条件クリア'
      : '❌ 要確認項目あり',
    '',
    '--- 検証完了（書き込みなし）---'
  ]);

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

// ─── private helpers ─────────────────────────────────────────────────────────

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string[]} fieldKeys
 * @returns {{ rows: Array<Object> }}
 */
function readPaymentStatusServiceSheet_(ss, fieldKeys) {
  var tableKey = 'ORDERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);
  var lastRow  = sheet.getLastRow();
  var lastCol  = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return { rows: [] };

  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0];
  var headerToIdx = {};
  rawHeaders.forEach(function(h, i) {
    var key = String(h).trim();
    if (key) headerToIdx[key] = i;
  });

  var fieldIdxMap = {};
  fieldKeys.forEach(function(fieldKey) {
    var physicalName = getCoreSchemaV1HeaderName(tableKey, fieldKey);
    if (headerToIdx[physicalName] !== undefined) {
      fieldIdxMap[fieldKey] = headerToIdx[physicalName];
    }
  });

  var dataRowCount = lastRow - table.headerRowNumber;
  var data = sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, lastCol).getValues();

  return {
    rows: data.map(function(row) {
      var obj = {};
      fieldKeys.forEach(function(fieldKey) {
        var idx = fieldIdxMap[fieldKey];
        obj[fieldKey] = (idx !== undefined) ? row[idx] : '';
      });
      return obj;
    })
  };
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function paymentStatusIsEmpty_(value) {
  return value === null || value === undefined || value === '';
}
