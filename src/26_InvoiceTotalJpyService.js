/**
 * ORDERS.INVOICE_TOTAL_JPY バックフィルサービス。
 * 既存オーダー行の円換算請求総額（INVOICE_TOTAL × EXCHANGE_RATE）を計算・書き込む。
 * apply 系は DEV 環境のみ実行可能。
 */

function dryRunInvoiceTotalJpyBackfill() {
  var spreadsheet = getSpreadsheet();
  var orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'CURRENCY', 'INVOICE_TOTAL', 'EXCHANGE_RATE', 'INVOICE_TOTAL_JPY'
  ]);

  var totalCount    = 0;
  var alreadyHasValue = 0;
  var emptyCount    = 0;
  var skipNoRate    = 0;
  var currencyCounts = {};
  var preview       = [];

  orders.rows.forEach(function(row) {
    var orderId = coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    if (!orderId) return;

    totalCount++;
    var currency     = coreCustomerFrontendValue(row[orders.indexes.CURRENCY]);
    var invoiceTotal = coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]);
    var exchangeRate = coreCustomerFrontendValue(row[orders.indexes.EXCHANGE_RATE]);
    var existingJpy  = coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL_JPY]);

    currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;

    if (existingJpy !== '' && existingJpy !== null && existingJpy !== undefined) {
      alreadyHasValue++;
      return;
    }

    var totalNum = Number(String(invoiceTotal).replace(/,/g, '').trim());
    var rateNum  = Number(String(exchangeRate).replace(/,/g, '').trim());

    if (!Number.isFinite(totalNum) || totalNum === 0) {
      emptyCount++;
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum === 0) {
      skipNoRate++;
      return;
    }

    var jpyValue = Math.round(totalNum * rateNum);
    emptyCount++;
    if (preview.length < 5) {
      preview.push({ orderId: orderId, currency: currency, invoiceTotal: totalNum, exchangeRate: rateNum, jpyValue: jpyValue });
    }
  });

  return {
    totalCount:     totalCount,
    alreadyHasValue: alreadyHasValue,
    emptyCount:     emptyCount,
    skipNoRate:     skipNoRate,
    currencyCounts: currencyCounts,
    preview:        preview
  };
}

function applyInvoiceTotalJpyBackfill() {
  if (getEnvironment() !== 'development') {
    throw new Error('applyInvoiceTotalJpyBackfill は DEV 環境のみ実行できます');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var spreadsheet = getSpreadsheet();
    var sheetName   = getCoreSchemaV1TableName('ORDERS');
    var sheet       = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('シートが見つかりません: ' + sheetName);

    var orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
      'ORDER_ID', 'CURRENCY', 'INVOICE_TOTAL', 'EXCHANGE_RATE', 'INVOICE_TOTAL_JPY'
    ]);

    var jpyColIndex = orders.indexes.INVOICE_TOTAL_JPY;
    var headerRow   = sheet.getFrozenRows() || 1;
    var dataStartRow = headerRow + 1;

    var written      = 0;
    var alreadySet   = 0;
    var skippedRate  = 0;

    orders.rows.forEach(function(row, i) {
      var orderId = coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
      if (!orderId) return;

      var existingJpy = coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL_JPY]);
      if (existingJpy !== '' && existingJpy !== null && existingJpy !== undefined) {
        alreadySet++;
        return;
      }

      var invoiceTotal = coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]);
      var exchangeRate = coreCustomerFrontendValue(row[orders.indexes.EXCHANGE_RATE]);

      var totalNum = Number(String(invoiceTotal).replace(/,/g, '').trim());
      var rateNum  = Number(String(exchangeRate).replace(/,/g, '').trim());

      if (!Number.isFinite(totalNum) || totalNum === 0 || !Number.isFinite(rateNum) || rateNum === 0) {
        skippedRate++;
        return;
      }

      var jpyValue  = Math.round(totalNum * rateNum);
      var sheetRow  = dataStartRow + i;
      var sheetCol  = jpyColIndex + 1;
      sheet.getRange(sheetRow, sheetCol).setValue(jpyValue);
      written++;
    });

    return { status: 'APPLIED', written: written, alreadySet: alreadySet, skippedRate: skippedRate };
  } finally {
    lock.releaseLock();
  }
}
