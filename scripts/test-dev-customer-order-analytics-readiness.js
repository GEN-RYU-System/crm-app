const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevCustomerOrderAnalyticsReadinessAudit.js', 'utf8');

function createSheet(headers, rows, formulas) {
  return {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : { getValues: () => rows, getFormulas: () => formulas || rows.map(values => values.map(() => '')) }
  };
}

function createSpreadsheet(sheets) {
  return { getSheetByName: name => sheets[name] || null };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Date, Set, Number, String, Object, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevCustomerOrderAnalyticsReadinessAudit.js' });
  return context;
}

function validSheets() {
  return {
    'リード管理': createSheet(['リードID'], [['LEAD-A'], ['LEAD-B']]),
    '顧客マスタ': createSheet(['源流リードID', '顧客ID'], [
      ['LEAD-A', 'CUSTOMER-A'], ['ORPHAN-LEAD', 'CUSTOMER-B'],
      ['', 'CUSTOMER-C'], ['LEAD-B', '']
    ]),
    'オーダー管理': createSheet(['オーダーID', '顧客ID', '受注日', '請求総額'], [
      ['ORDER-A', 'CUSTOMER-A', new Date('2026-01-01T00:00:00Z'), 10],
      ['ORDER-B', 'CUSTOMER-B', '', ''],
      ['ORDER-C', 'UNKNOWN-CUSTOMER', 'invalid-date', 'invalid-amount'],
      ['ORDER-D', 'CUSTOMER-A', '2026/02/30', 20],
      ['', 'CUSTOMER-A', new Date('2026-01-02T00:00:00Z'), 30]
    ]),
    'オーダー明細': createSheet(['オーダーID', '商品ID'], [
      ['ORDER-A', 'PRODUCT-A'], ['ORDER-B', 'UNKNOWN-PRODUCT'],
      ['UNKNOWN-ORDER', 'PRODUCT-A'], ['', 'PRODUCT-A'], ['ORDER-A', '']
    ]),
    '商品マスタ同期': createSheet(['product_id'], [['PRODUCT-A']])
  };
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.auditDevCustomerOrderAnalyticsReadiness(), /development/);
  assert.equal(opened, false);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => createSpreadsheet(validSheets()) });
  const result = JSON.parse(JSON.stringify(context.auditDevCustomerOrderAnalyticsReadiness()));
  assert.equal(result.success, true);
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(result.leadToCustomer, {
    customerRecordCount: 4, emptyReferenceCount: 1, parentPresentReferenceCount: 2,
    parentMissingReferenceCount: 1, customerIdEmptyCount: 1
  });
  assert.deepEqual(result.customerToOrder, {
    orderRecordCount: 4, emptyReferenceCount: 0, parentPresentReferenceCount: 3,
    parentMissingReferenceCount: 1
  });
  assert.deepEqual(result.orderToLineToProduct, {
    orderLineRecordCount: 5, emptyReferenceCount: 1, parentPresentReferenceCount: 3,
    parentMissingReferenceCount: 1, productIdEmptyLineCount: 1,
    productMasterPresentLineCount: 3, productMasterMissingLineCount: 1
  });
  assert.deepEqual(result.orderAnalyticsData, {
    validOrderDateCount: 1, emptyOrderDateCount: 1, invalidOrderDateCount: 2,
    validOrderAmountCount: 2, emptyOrderAmountCount: 1, invalidOrderAmountCount: 1,
    fullyValidCustomerDateAmountOrderCount: 1
  });
  assert.deepEqual(result.customerAnalyticsReadiness, {
    eligibleCustomerCount: 3, customersWithValidOrderDateCount: 1,
    customersWithoutValidOrderDateCount: 2
  });
  const serialized = JSON.stringify(result);
  ['LEAD-A', 'CUSTOMER-A', 'ORDER-A', 'PRODUCT-A', 'invalid-date', 'invalid-amount'].forEach(value => {
    assert.equal(serialized.includes(value), false);
  });
}

{
  const sheets = validSheets();
  sheets['オーダー管理'] = createSheet(['オーダーID', '顧客ID', '受注日', '受注日', '請求総額'], []);
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => createSpreadsheet(sheets) });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevCustomerOrderAnalyticsReadiness())), {
    success: false,
    resultType: 'CUSTOMER_ORDER_ANALYTICS_READINESS_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

{
  const sheets = validSheets();
  sheets['オーダー明細'] = createSheet(['オーダーID'], []);
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => createSpreadsheet(sheets) });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevCustomerOrderAnalyticsReadiness())), {
    success: false,
    resultType: 'CUSTOMER_ORDER_ANALYTICS_READINESS_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

['setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV customer order analytics readiness audit unit checks');
