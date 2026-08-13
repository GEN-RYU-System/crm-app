const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevLeadAssigneeIdRepair.js', 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSpreadsheet(options = {}) {
  const leadValues = clone(options.leadValues || [
    ['担当者ID', 'リード担当者', '対象外列'],
    ['ORPHAN_1', '一意', 'unchanged-a'],
    ['ORPHAN_2', '一意', 'unchanged-b']
  ]);
  const staffValues = clone(options.staffValues || [
    ['担当者ID', '苗字（日本語）', '名前（日本語）'],
    ['CURRENT_1', '一', '意']
  ]);
  const calls = { writes: [], releases: 0 };
  const leadSheet = {
    getDataRange: () => ({ getValues: () => clone(leadValues) }),
    getRange: (row, column, rowCount, columnCount) => ({
      getFormulas: () => Array.from({ length: rowCount }, (_, index) => [
        options.targetFormulaRow === index ? '=FORMULA' : ''
      ]),
      setValues: values => {
        calls.writes.push({ row, column, rowCount, columnCount, values: clone(values) });
        if (options.failWrite && calls.writes.length === 1) throw new Error('write failed');
        if (options.failRollback && calls.writes.length === 2) throw new Error('rollback failed');
        values.forEach((value, index) => { leadValues[row - 1 + index][column - 1] = value[0]; });
      }
    })
  };
  let staffReadCount = 0;
  const staffSheet = { getDataRange: () => ({ getValues: () => {
    staffReadCount += 1;
    const values = clone(staffValues);
    if (staffReadCount === 2 && options.changeStaffIdBeforeWrite) values[1][0] = 'changed-staff-id';
    if (staffReadCount === 2 && options.changeStaffNameBeforeWrite) values[1][1] = 'changed-staff-name';
    return values;
  }}) };
  if (options.changeBeforeWrite) {
    const original = leadSheet.getDataRange;
    let callsToData = 0;
    leadSheet.getDataRange = () => ({ getValues: () => {
      callsToData += 1;
      const values = original().getValues();
      if (callsToData === 2) values[1][1] = 'changed-name';
      return values;
    }});
  }
  return {
    calls,
    leadValues,
    getSheetByName: name => name === 'リード管理' ? leadSheet : name === '担当者マスタ' ? staffSheet : null
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) }
  }, overrides));
  vm.runInContext(source, context, { filename: '99_DevLeadAssigneeIdRepair.js' });
  return context;
}

function assertNoSensitiveValues(result) {
  const serialized = JSON.stringify(result);
  ['ORPHAN_1', 'ORPHAN_2', 'CURRENT_1', '一意', 'unchanged-a'].forEach((value, index) => {
    assert.equal(serialized.includes(value), false, 'sensitive fixture ' + index);
  });
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.repairDevLeadAssigneeIds(), /development/);
  assert.equal(opened, false);
}

{
  const spreadsheet = createSpreadsheet();
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { spreadsheet.calls.releases += 1; } }) }
  });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.success, true);
  assert.equal(result.replaceableCount, 2);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.actualDataChangeCount, 2);
  assert.equal(spreadsheet.calls.writes.length, 1);
  assert.deepEqual(spreadsheet.calls.writes[0], { row: 2, column: 1, rowCount: 2, columnCount: 1, values: [['CURRENT_1'], ['CURRENT_1']] });
  assert.deepEqual(spreadsheet.leadValues.map(row => row[2]), ['対象外列', 'unchanged-a', 'unchanged-b']);
  assert.equal(spreadsheet.calls.releases, 1);
  assertNoSensitiveValues(result);
}

{
  const spreadsheet = createSpreadsheet({ targetFormulaRow: 0 });
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.success, false);
  assert.equal(result.resultType, 'REPAIR_TARGET_FORMULA_FOUND');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.calls.writes.length, 0);
}

{
  const leadValues = [['担当者ID', 'リード担当者']];
  for (let index = 0; index < 59; index += 1) leadValues.push(['ORPHAN_' + index, '一意']);
  const spreadsheet = createSpreadsheet({
    leadValues: leadValues,
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '一意']]
  });
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.success, true);
  assert.equal(result.orphanLeadAssigneeIdCount, 59);
  assert.equal(result.replaceableCount, 59);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.actualDataChangeCount, 59);
  assert.equal(spreadsheet.calls.writes.length, 1);
}

[
  {
    name: 'blank',
    leadValues: [['担当者ID', 'リード担当者'], ['ORPHAN_1', '']],
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '一意']]
  },
  {
    name: 'ambiguous',
    leadValues: [['担当者ID', 'リード担当者'], ['ORPHAN_1', '同名']],
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '同名'], ['CURRENT_2', '同名']]
  },
  {
    name: 'mismatch',
    leadValues: [['担当者ID', 'リード担当者'], ['ORPHAN_1', '不一致']],
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '一意']]
  },
  {
    name: 'duplicate-header',
    leadValues: [['担当者ID', '担当者ID'], ['ORPHAN_1', 'ORPHAN_1']],
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '一意']]
  },
  {
    name: 'duplicate-staff-id',
    leadValues: [['担当者ID', 'リード担当者'], ['ORPHAN_1', '一意']],
    staffValues: [['担当者ID', '氏名（日本語）'], ['CURRENT_1', '一意'], ['CURRENT_1', '別名']]
  }
].forEach(testCase => {
  const spreadsheet = createSpreadsheet(testCase);
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { spreadsheet.calls.releases += 1; } }) }
  });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.success, false, testCase.name);
  assert.equal(result.actualDataChangeCount, 0, testCase.name);
  assert.equal(spreadsheet.calls.writes.length, 0, testCase.name);
  assert.equal(spreadsheet.calls.releases, 1, testCase.name);
});

{
  const spreadsheet = createSpreadsheet({ failWrite: true });
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { spreadsheet.calls.releases += 1; } }) }
  });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.resultType, 'REPAIR_WRITE_FAILED_ROLLED_BACK');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.calls.writes.length, 2);
  assert.deepEqual(spreadsheet.calls.writes[1].values, [['ORPHAN_1'], ['ORPHAN_2']]);
  assert.equal(spreadsheet.calls.releases, 1);
}

{
  const spreadsheet = createSpreadsheet({ changeBeforeWrite: true });
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.resultType, 'REPAIR_SOURCE_CHANGED');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.calls.writes.length, 0);
}

['changeStaffIdBeforeWrite', 'changeStaffNameBeforeWrite'].forEach(option => {
  const spreadsheet = createSpreadsheet({ [option]: true });
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => spreadsheet });
  const result = JSON.parse(JSON.stringify(context.repairDevLeadAssigneeIds()));
  assert.equal(result.resultType, 'REPAIR_SOURCE_CHANGED', option);
  assert.equal(result.actualDataChangeCount, 0, option);
  assert.equal(spreadsheet.calls.writes.length, 0, option);
});

['appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV lead assignee ID repair unit checks');
