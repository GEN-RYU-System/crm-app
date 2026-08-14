const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevUnpaidOrderCancellationRepair.js', 'utf8');

const headers = ['オーダーID', 'ステータス', '支払確認日', '受注日', '対象外列'];

function createRows() {
  const rows = [];
  for (let index = 0; index < 120; index += 1) {
    rows.push(['ORDER-VALID-' + index, 'ACTIVE', new Date('2026-01-01'), new Date('2026-01-02'), 'UNCHANGED']);
  }
  for (let index = 0; index < 4; index += 1) {
    rows.push(['ORDER-CONFLICT-' + index, 'キャンセル', new Date('2026-01-03'), new Date('2026-01-04'), 'UNCHANGED']);
  }
  for (let index = 0; index < 40; index += 1) {
    rows.push(['ORDER-CANCELLED-' + index, 'キャンセル', '', new Date('2026-01-05'), 'UNCHANGED']);
  }
  for (let index = 0; index < 8; index += 1) {
    rows.push([
      'ORDER-CANDIDATE-' + index,
      'ACTIVE',
      '',
      index === 0 ? '' : new Date('2026-01-06'),
      'UNCHANGED'
    ]);
  }
  for (let index = 0; index < 7; index += 1) rows[index][3] = '';
  return rows;
}

function createSheet(rows, options) {
  const settings = Object.assign({
    formulas: [], failWrites: 0, mutateBeforeSecondDataRead: false, mutateColumn: 1,
    mutateRowIndex: 164, postWriteMismatch: false, customHeaders: headers,
    changedLastRowAtRead: 0, changedLastRowValue: 0, failWriteAt: []
  }, options);
  let dataReadCount = 0;
  let writeCount = 0;
  let lastRowReadCount = 0;
  return {
    rows: rows,
    getLastColumn: () => settings.customHeaders.length,
    getLastRow: () => {
      lastRowReadCount += 1;
      if (settings.changedLastRowAtRead === lastRowReadCount) return settings.changedLastRowValue;
      return rows.length + 1;
    },
    getRange: (row, column, numRows, numColumns) => {
      if (row === 1) return { getDisplayValues: () => [settings.customHeaders] };
      const start = row - 2;
      return {
        getValues: () => {
          if (column === 1 && numColumns === settings.customHeaders.length) {
            dataReadCount += 1;
            if (settings.mutateBeforeSecondDataRead && dataReadCount === 2) {
              rows[settings.mutateRowIndex][settings.mutateColumn] = 'CHANGED';
            }
          }
          if (settings.postWriteMismatch && writeCount === 1 && column === 2 && numColumns === 1) {
            rows[0][1] = 'CHANGED';
          }
          return rows.slice(start, start + numRows).map(values => values.slice(column - 1, column - 1 + numColumns));
        },
        getFormulas: () => rows.slice(start, start + numRows).map((values, index) => [
          (settings.formulas[start + index] || '')
        ]),
        setValues: values => {
          writeCount += 1;
          if (writeCount <= settings.failWrites || settings.failWriteAt.includes(writeCount)) {
            throw new Error('WRITE_FAILED');
          }
          values.forEach((value, index) => { rows[start + index][column - 1] = value[0]; });
        }
      };
    },
    getWriteCount: () => writeCount
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Date, Number, Object, String, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevUnpaidOrderCancellationRepair.js' });
  return context;
}

function createLock(available) {
  let released = 0;
  return {
    getScriptLock: () => ({
      tryLock: () => available,
      releaseLock: () => { released += 1; }
    }),
    getReleased: () => released
  };
}

function execute(rows, options) {
  const sheet = createSheet(rows, options);
  const lock = createLock(true);
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => ({ getSheetByName: () => sheet }),
    LockService: lock
  });
  return { result: JSON.parse(JSON.stringify(context.repairDevUnpaidOrderCancellations())), sheet, lock };
}

{
  let opened = false;
  const lock = createLock(true);
  const context = run({
    getEnvironment: () => 'production',
    getSpreadsheet: () => { opened = true; },
    LockService: lock
  });
  assert.throws(() => context.repairDevUnpaidOrderCancellations(), /development/);
  assert.equal(opened, false);
  assert.equal(lock.getReleased(), 0);
}

{
  let opened = false;
  const lock = createLock(false);
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => { opened = true; },
    LockService: lock
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.repairDevUnpaidOrderCancellations())), {
    success: false,
    resultType: 'REPAIR_LOCK_UNAVAILABLE',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
  assert.equal(opened, false);
  assert.equal(lock.getReleased(), 0);
}

{
  const rows = createRows();
  const nonStatusBefore = rows.map(row => [row[0], row[2], row[3], row[4]]);
  const execution = execute(rows);
  assert.deepEqual(execution.result, {
    success: true,
    resultType: 'REPAIR_SUCCEEDED',
    auditVersion: '1',
    actualDataChangeCount: 8,
    updatedCancelledCount: 52,
    paidExistingCancelledConflictCount: 4,
    blankOrderDateCount: 8
  });
  assert.equal(execution.sheet.getWriteCount(), 1);
  assert.equal(execution.lock.getReleased(), 1);
  assert.deepEqual(rows.map(row => [row[0], row[2], row[3], row[4]]), nonStatusBefore);
  assert.equal(rows.filter(row => row[1] === 'キャンセル').length, 52);
}

{
  const rows = createRows();
  rows.pop();
  const execution = execute(rows);
  assert.equal(execution.result.resultType, 'REPAIR_EXPECTATION_MISMATCH');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const formulas = rows.map(() => '');
  formulas[0] = '=FORMULA';
  const execution = execute(rows, { formulas });
  assert.equal(execution.result.resultType, 'REPAIR_TARGET_FORMULA_FOUND');
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, { mutateBeforeSecondDataRead: true, mutateRowIndex: 0 });
  assert.equal(execution.result.resultType, 'REPAIR_SOURCE_CHANGED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, {
    mutateBeforeSecondDataRead: true, mutateRowIndex: 0, mutateColumn: 2
  });
  assert.equal(execution.result.resultType, 'REPAIR_SOURCE_CHANGED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, {
    changedLastRowAtRead: 3,
    changedLastRowValue: rows.length + 2
  });
  assert.equal(execution.result.resultType, 'REPAIR_SOURCE_CHANGED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, {
    changedLastRowAtRead: 3,
    changedLastRowValue: rows.length
  });
  assert.equal(execution.result.resultType, 'REPAIR_SOURCE_CHANGED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, {
    customHeaders: ['オーダーID', 'ステータス', '支払確認日', '支払確認日', '受注日']
  });
  assert.equal(execution.result.resultType, 'UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 0);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const beforeStatuses = rows.map(row => row[1]);
  const execution = execute(rows, { failWrites: 1 });
  assert.equal(execution.result.resultType, 'REPAIR_WRITE_FAILED_RESTORED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 2);
  assert.deepEqual(rows.map(row => row[1]), beforeStatuses);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const beforeStatuses = rows.map(row => row[1]);
  const execution = execute(rows, { postWriteMismatch: true });
  assert.equal(execution.result.resultType, 'REPAIR_POST_WRITE_VERIFICATION_FAILED_RESTORED');
  assert.equal(execution.result.actualDataChangeCount, 0);
  assert.equal(execution.sheet.getWriteCount(), 2);
  assert.deepEqual(rows.map(row => row[1]), beforeStatuses);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, { failWrites: 2 });
  assert.equal(execution.result.resultType, 'REPAIR_WRITE_FAILED_RESTORE_FAILED');
  assert.equal(execution.result.actualDataChangeCount, null);
  assert.equal(execution.result.dataChangeState, 'UNKNOWN');
  assert.equal(execution.sheet.getWriteCount(), 2);
  assert.equal(execution.lock.getReleased(), 1);
}

{
  const rows = createRows();
  const execution = execute(rows, { postWriteMismatch: true, failWriteAt: [2] });
  assert.equal(execution.result.resultType, 'REPAIR_POST_WRITE_VERIFICATION_FAILED_RESTORE_FAILED');
  assert.equal(execution.result.actualDataChangeCount, null);
  assert.equal(execution.result.dataChangeState, 'UNKNOWN');
  assert.equal(execution.lock.getReleased(), 1);
}

[
  '.setValue(', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService',
  'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'
].forEach(token => assert.equal(source.includes(token), false, token + ' must not be used'));

console.log('PASS: DEV unpaid order cancellation repair unit checks');
