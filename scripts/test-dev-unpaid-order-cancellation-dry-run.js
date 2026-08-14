const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevUnpaidOrderCancellationDryRun.js', 'utf8');

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
  const context = vm.createContext(Object.assign({ Date, Number, Object, String, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevUnpaidOrderCancellationDryRun.js' });
  return context;
}

function spreadsheet(headers, rows) {
  return { getSheetByName: () => createSheet(headers, rows) };
}

const requiredHeaders = ['オーダーID', 'ステータス', '支払確認日', '受注日'];

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.dryRunDevUnpaidOrderCancellation(), /development/);
  assert.equal(opened, false);
}

{
  const rows = [
    ['ORDER-A', 'ACTIVE', new Date('2026-01-01'), new Date('2026-01-02')],
    ['ORDER-B', 'ACTIVE', '', ''],
    ['ORDER-C', 'キャンセル', '', new Date('2026-01-03')],
    ['ORDER-D', 'ACTIVE', 'INVALID-DATE', new Date('2026-01-04')],
    ['ORDER-E', 'キャンセル', new Date('2026-01-05'), new Date('2026-01-06')],
    ['ORDER-F', 'ACTIVE', '', new Date('2026-01-07')],
    ['', 'ACTIVE', '', '']
  ];
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet(requiredHeaders, rows)
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevUnpaidOrderCancellation()));
  assert.deepEqual(result, {
    success: true,
    resultType: 'UNPAID_ORDER_CANCELLATION_DRY_RUN_COMPLETED',
    auditVersion: '1',
    actualDataChangeCount: 0,
    orderRecordCount: 6,
    paymentConfirmedDateValidCount: 2,
    paymentConfirmedDateEmptyCount: 3,
    paymentConfirmedDateInvalidCount: 1,
    existingCancelledCount: 2,
    unpaidExistingCancelledCount: 1,
    newCancellationCandidateCount: 2,
    paidExistingCancelledConflictCount: 1,
    newCancellationCandidateBlankOrderDateOverlapCount: 1,
    pendingCount: 1
  });
  const serialized = JSON.stringify(result);
  ['ORDER-A', 'ACTIVE', 'INVALID-DATE'].forEach(value => assert.equal(serialized.includes(value), false));
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet(['オーダーID'], [])
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.dryRunDevUnpaidOrderCancellation())), {
    success: false,
    resultType: 'UNPAID_ORDER_CANCELLATION_DRY_RUN_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet(
      ['オーダーID', 'ステータス', '支払確認日', '支払確認日', '受注日'], []
    )
  });
  assert.equal(
    JSON.parse(JSON.stringify(context.dryRunDevUnpaidOrderCancellation())).resultType,
    'UNPAID_ORDER_CANCELLATION_DRY_RUN_SCHEMA_INVALID'
  );
}

[
  'setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet',
  'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'
].forEach(token => assert.equal(source.includes(token), false, token + ' must not be used'));

console.log('PASS: DEV unpaid order cancellation dry-run unit checks');
