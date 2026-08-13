const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevLeadAssigneeIdRepairDryRun.js', 'utf8');

function sheet(name, values) {
  return { getDataRange: () => ({ getValues: () => values }) };
}

function run(overrides) {
  const context = vm.createContext(overrides);
  vm.runInContext(source, context, { filename: '99_DevLeadAssigneeIdRepairDryRun.js' });
  return context;
}

function testSpreadsheet() {
  const sheets = {
    'リード管理': sheet('リード管理', [
      ['担当者ID', 'リード担当者', '', ''],
      ['ACTIVE', '現担当', '', ''],
      ['ORPHAN_ONE', '一 意', '', ''],
      ['ORPHAN_MULTI', '複数候補', '', ''],
      ['ORPHAN_MISMATCH', '不一致', '', ''],
      ['ORPHAN_BLANK', '', '', ''],
      ['ORPHAN_UNKNOWN', '未確定', '', ''],
      ['', '空ID', '', ''],
      ['', '', '', '']
    ]),
    '担当者マスタ': sheet('担当者マスタ', [
      ['担当者ID', '苗字（日本語）', '名前（日本語）'],
      ['ACTIVE', '現', '担当'],
      ['STAFF_ONE', '一', '意'],
      ['STAFF_MULTI_A', '複数', '候補'],
      ['STAFF_MULTI_B', '複 数', '候補'],
      ['', '未', '確定']
    ])
  };
  return { getSheetByName: name => sheets[name] || null };
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.dryRunDevLeadAssigneeIdRepair(), /development/);
  assert.equal(opened, false);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: testSpreadsheet });
  const result = JSON.parse(JSON.stringify(context.dryRunDevLeadAssigneeIdRepair()));
  assert.equal(result.success, true);
  assert.equal(result.leadNonEmptyRecordCount, 7);
  assert.equal(result.emptyAssigneeIdCount, 1);
  assert.equal(result.currentStaffIdRecordCount, 1);
  assert.equal(result.orphanLeadAssigneeIdCount, 5);
  assert.equal(result.replaceableCount, 1);
  assert.equal(result.pendingCount, 4);
  assert.equal(result.orphanCountReconciliation, true);
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(result.groups.map(group => group.replaceableCount), [1, 0, 0, 0, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffNameAmbiguousMatchCount), [0, 1, 0, 0, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffNameMismatchCount), [0, 0, 1, 0, 0]);
  assert.deepEqual(result.groups.map(group => group.supplementalNameBlankCount), [0, 0, 0, 1, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffIdUnresolvedCount), [0, 0, 0, 0, 1]);
  const serialized = JSON.stringify(result);
  ['ORPHAN_ONE', 'ORPHAN_MULTI', 'ORPHAN_MISMATCH', 'ORPHAN_BLANK', 'ORPHAN_UNKNOWN', '一 意', '複数候補', '不一致', '未確定'].forEach((value, index) => {
    assert.equal(serialized.includes(value), false, 'sensitive fixture ' + index);
  });
}

{
  const sheets = {
    'リード管理': sheet('リード管理', [['担当者ID', '担当者ID'], ['ORPHAN', 'ORPHAN']]),
    '担当者マスタ': sheet('担当者マスタ', [['担当者ID'], ['ACTIVE']])
  };
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => ({ getSheetByName: name => sheets[name] }) });
  assert.deepEqual(JSON.parse(JSON.stringify(context.dryRunDevLeadAssigneeIdRepair())), {
    success: false, errorType: 'LEAD_ASSIGNEE_ID_REPAIR_DRY_RUN_FAILED'
  });
}

['setValue', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV lead assignee ID repair dry-run unit checks');
