const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevOrderDateAndAmountClassificationAudit.js', 'utf8');

function createSheet(headers, rows, formulas) {
  return {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : { getValues: () => rows, getFormulas: () => formulas || rows.map(values => values.map(() => '')) }
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Date, Set, Number, String, Object, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevOrderDateAndAmountClassificationAudit.js' });
  return context;
}

function validSpreadsheet() {
  return {
    getSheetByName: name => name === 'オーダー管理' ? createSheet(
      ['オーダーID', 'ステータス', '受注日', '請求書発行日'], [
        ['ORDER-A', 'キャンセル', '', new Date('2026-01-01T00:00:00Z')],
        ['ORDER-B', '', '', ''],
        ['ORDER-C', 'OTHER_STATUS', '', 'invalid-date'],
        ['ORDER-D', 'OTHER_STATUS', new Date('2026-02-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z')],
        ['', 'OTHER_STATUS', '', new Date('2026-03-01T00:00:00Z')]
      ]
    ) : null
  };
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.auditDevOrderDateAndAmountClassification(), /development/);
  assert.equal(opened, false);
}

{
  const spreadsheet = validSpreadsheet();
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet });
  const result = JSON.parse(JSON.stringify(context.auditDevOrderDateAndAmountClassification()));
  assert.equal(result.success, true);
  assert.equal(result.resultType, 'ORDER_COMPLETION_CLASSIFICATION_UNDEFINED');
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(result.orderDateCompletion, {
    blankOrderDateOrderCount: 3,
    candidateDateCounts: { '請求書発行日': { validDateCount: 1, emptyDateCount: 1, invalidDateCount: 1 } },
    multipleCandidateDateDisagreementCount: 0,
    uniquelyResolvableFillCount: 1,
    heldFillCount: 2
  });
  assert.deepEqual(result.amountClassification, {
    orderRecordCount: 4,
    statusEmptyCount: 1,
    existingCodeCancelledOrderCount: 1,
    completionClassifiedOrderCount: 0,
    neitherCancelledNorCompletedOrderCount: 3,
    completionClassificationResultType: 'ORDER_COMPLETION_CLASSIFICATION_UNDEFINED'
  });
  const serialized = JSON.stringify(result);
  ['ORDER-A', 'キャンセル', 'OTHER_STATUS', 'invalid-date', '2026-01-01'].forEach(value => {
    assert.equal(serialized.includes(value), false);
  });
}

{
  const context = run({});
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.classifyDevOrderDateAmountAuditCandidates([
      { state: 'valid', value: new Date('2026-01-01T00:00:00Z') },
      { state: 'valid', value: new Date('2026-01-02T00:00:00Z') }
    ]))),
    { hasMultipleValidDisagreement: true, hasExactlyOneResolvedDate: false }
  );
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => ({ getSheetByName: () => createSheet(['オーダーID', '受注日', '請求書発行日'], []) })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevOrderDateAndAmountClassification())), {
    success: false,
    resultType: 'ORDER_DATE_AND_AMOUNT_CLASSIFICATION_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

['setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV order date and amount classification audit unit checks');
