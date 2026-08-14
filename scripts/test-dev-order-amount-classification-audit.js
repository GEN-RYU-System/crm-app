const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevOrderAmountClassificationAudit.js', 'utf8');

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
  const context = vm.createContext(Object.assign({ Number, Object, String, isFinite }, overrides));
  vm.runInContext(source, context, { filename: '99_DevOrderAmountClassificationAudit.js' });
  return context;
}

function spreadsheet(headers, rows) {
  return { getSheetByName: () => createSheet(headers, rows) };
}

const headers = ['オーダーID', 'ステータス', '請求総額'];

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.auditDevOrderAmountClassification(), /development/);
  assert.equal(opened, false);
}

{
  const rows = [
    ['ORDER-A', 'キャンセル', 100],
    ['ORDER-B', '完了', '200'],
    ['ORDER-C', 'OTHER_STATUS', 300],
    ['ORDER-D', '完了', ''],
    ['ORDER-E', 'キャンセル', 'NOT_A_NUMBER'],
    ['', '完了', 400]
  ];
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet(headers, rows) });
  const result = JSON.parse(JSON.stringify(context.auditDevOrderAmountClassification()));
  assert.deepEqual(result, {
    success: true,
    resultType: 'ORDER_AMOUNT_CLASSIFICATION_INVALID_AMOUNT_FOUND',
    auditVersion: '1',
    actualDataChangeCount: 0,
    amountReconciliationPassed: true,
    orderCountReconciliationPassed: true,
    orderRecordCount: 5,
    invoiceTotalValidCount: 3,
    invoiceTotalEmptyCount: 1,
    invoiceTotalInvalidCount: 1,
    cancelledOrderCount: 2,
    completedOrderCount: 2,
    unconfirmedOrderCount: 1,
    totalOrderAmount: 600,
    cancelledOrderAmount: 100,
    completedOrderAmount: 200,
    unconfirmedOrderAmount: 300
  });
  const serialized = JSON.stringify(result);
  ['ORDER-A', 'OTHER_STATUS', 'NOT_A_NUMBER'].forEach(value => assert.equal(serialized.includes(value), false));
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet(['オーダーID'], [])
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevOrderAmountClassification())), {
    success: false,
    resultType: 'ORDER_AMOUNT_CLASSIFICATION_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet(['オーダーID', 'ステータス', '請求総額', '請求総額'], [])
  });
  assert.equal(
    JSON.parse(JSON.stringify(context.auditDevOrderAmountClassification())).resultType,
    'ORDER_AMOUNT_CLASSIFICATION_SCHEMA_INVALID'
  );
}

[
  'setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet',
  'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'
].forEach(token => assert.equal(source.includes(token), false, token + ' must not be used'));

console.log('PASS: DEV order amount classification audit unit checks');
