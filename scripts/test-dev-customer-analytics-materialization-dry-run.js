const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevCustomerAnalyticsMaterializationDryRun.js', 'utf8');

function createSheet(headers, rows) {
  return {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : { getValues: () => rows }
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Date, Number, Object, Set, String, isFinite, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevCustomerAnalyticsMaterializationDryRun.js' });
  return context;
}

function spreadsheet(lineRows) {
  const sheets = {
    '顧客マスタ': createSheet(['顧客ID'], [['CUSTOMER-A'], ['CUSTOMER-B']]),
    'オーダー管理': createSheet(
      ['オーダーID', '顧客ID', 'ステータス', '受注日', '請求総額'], [
        ['ORDER-A', 'CUSTOMER-A', '完了', new Date('2026-01-01'), 100],
        ['ORDER-B', 'CUSTOMER-A', 'キャンセル', '', 50],
        ['ORDER-C', 'CUSTOMER-B', 'UNKNOWN_STATUS', '2026/02/01', '200']
      ]
    ),
    'オーダー明細': createSheet(['オーダーID', '商品ID'], lineRows),
    '商品マスタ同期': createSheet(['product_id'], [['PRODUCT-A'], ['PRODUCT-B']])
  };
  return { getSheetByName: name => sheets[name] || null };
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.dryRunDevCustomerAnalyticsMaterialization(), /development/);
  assert.equal(opened, false);
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet([
      ['ORDER-A', 'PRODUCT-A'], ['ORDER-B', 'PRODUCT-A'], ['ORDER-C', 'PRODUCT-B']
    ])
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevCustomerAnalyticsMaterialization()));
  assert.deepEqual(result, {
    success: true,
    resultType: 'CUSTOMER_ANALYTICS_MATERIALIZATION_DRY_RUN_COMPLETED',
    auditVersion: '1',
    actualDataChangeCount: 0,
    amountReconciliationPassed: true,
    orderCountReconciliationPassed: true,
    customerIdRecordCount: 2, customerIdEmptyCount: 0, customerIdDuplicateCount: 0,
    productIdRecordCount: 2, productIdEmptyCount: 0, productIdDuplicateCount: 0,
    orderRecordCount: 3, orderIdEmptyCount: 0, orderIdDuplicateCount: 0, lineRecordCount: 3,
    orderCustomerIdEmptyCount: 0, orderCustomerParentFoundCount: 3, orderCustomerParentMissingCount: 0,
    lineOrderIdEmptyCount: 0, lineOrderParentFoundCount: 3, lineOrderParentMissingCount: 0,
    lineProductIdEmptyCount: 0, lineProductParentFoundCount: 3, lineProductParentMissingCount: 0,
    orderDateValidCount: 2, orderDateEmptyCount: 1, orderDateInvalidCount: 0,
    invoiceTotalValidCount: 3, invoiceTotalEmptyCount: 0, invoiceTotalInvalidCount: 0,
    cancelledOrderCount: 1, completedOrderCount: 1, unconfirmedOrderCount: 1,
    totalOrderAmount: 350, cancelledOrderAmount: 50, completedOrderAmount: 100, unconfirmedOrderAmount: 200,
    customerAnalyticsRowCount: 2, customerMonthlyAnalyticsRowCount: 2, customerProductAnalyticsRowCount: 2,
    customersWithEmptyOrderDateCount: 1, customersWithValidOrderDateCount: 2,
    customersWithCompletedValidOrderDateCount: 1
  });
  const serialized = JSON.stringify(result);
  ['CUSTOMER-A', 'ORDER-A', 'PRODUCT-A', 'UNKNOWN_STATUS'].forEach(value => {
    assert.equal(serialized.includes(value), false);
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet([['MISSING-ORDER', 'PRODUCT-A']])
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevCustomerAnalyticsMaterialization()));
  assert.equal(result.success, false);
  assert.equal(result.resultType, 'CUSTOMER_ANALYTICS_MATERIALIZATION_REFERENCE_INVALID');
  assert.equal(result.lineOrderParentMissingCount, 1);
  assert.equal(result.actualDataChangeCount, 0);
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => ({ getSheetByName: () => createSheet(['顧客ID'], []) })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.dryRunDevCustomerAnalyticsMaterialization())), {
    success: false,
    resultType: 'CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

[
  'setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet',
  'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'
].forEach(token => assert.equal(source.includes(token), false, token + ' must not be used'));

console.log('PASS: DEV customer analytics materialization dry-run unit checks');
