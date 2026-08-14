const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevLeadAssigneeAssignmentPolicyDryRun.js', 'utf8');

function createSpreadsheet(values) {
  const sheet = {
    getLastColumn: () => values[0].length,
    getLastRow: () => values.length,
    getRange: (row, column, rowCount, columnCount) => ({
      getValues: () => values.slice(row - 1, row - 1 + rowCount)
        .map(input => input.slice(column - 1, column - 1 + columnCount))
    })
  };
  return { getSheetByName: name => name === 'リード管理' ? sheet : null };
}

function run(overrides) {
  const context = vm.createContext(overrides);
  vm.runInContext(source, context, { filename: '99_DevLeadAssigneeAssignmentPolicyDryRun.js' });
  return context;
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.dryRunDevLeadAssigneeAssignmentPolicy(), /development/);
  assert.equal(opened, false);
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => createSpreadsheet([
      ['リードID', '担当者ID', 'リード担当者', '営業担当者', '対象外'],
      ['LEAD-001', '', ' 阿　部 ', '', 'unread'],
      ['LEAD-002', '', '山田阿部', '', 'unread'],
      ['LEAD-003', 'EMP-00001', '阿部', '', 'unread'],
      ['LEAD-004', 'EMP-00007', '', '阿部', 'unread'],
      ['LEAD-005', 'OTHER', '別名', '', 'unread'],
      ['LEAD-006', '', '', '', 'unread'],
      ['', '', '阿部', '', 'unread']
    ])
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevLeadAssigneeAssignmentPolicy()));
  assert.equal(result.success, true);
  assert.equal(result.leadNonEmptyRecordCount, 6);
  assert.equal(result.emptyAssigneeIdCount, 3);
  assert.equal(result.abeExactMatchCount, 3);
  assert.equal(result.abePartialOnlyMatchCount, 1);
  assert.equal(result.emptyAndAbeExactMatchCount, 1);
  assert.equal(result.emptyRuleMatchCount, 3);
  assert.equal(result.abeExactRuleMatchCount, 3);
  assert.equal(result.alreadyEmp00001Count, 1);
  assert.equal(result.alreadyEmp00007Count, 1);
  assert.equal(result.neitherRuleMatchCount, 1);
  assert.equal(result.actualDataChangeCount, 0);
  const serialized = JSON.stringify(result);
  ['LEAD-001', '阿部', '山田阿部', 'EMP-00001', 'EMP-00007', 'OTHER', 'unread'].forEach((value, index) => {
    assert.equal(serialized.includes(value), false, 'sensitive fixture ' + index);
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => createSpreadsheet([['リードID', '担当者ID', '担当者ID'], ['', '', '']])
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.dryRunDevLeadAssigneeAssignmentPolicy())), {
    success: false, errorType: 'LEAD_ASSIGNEE_POLICY_DRY_RUN_FAILED'
  });
}

['setValue', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV lead assignee policy dry-run unit checks');
