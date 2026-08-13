const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevLeadAssigneeOrphanDiagnosis.js', 'utf8');

function sheet(name, values) {
  return {
    getName: () => name,
    getLastColumn: () => values[0].length,
    getRange: () => ({ getValues: () => [values[0]] }),
    getDataRange: () => ({ getValues: () => values })
  };
}

function spreadsheet(sheets) {
  return {
    getSheetByName: name => sheets.find(item => item.getName() === name) || null,
    getSheets: () => sheets
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Date }, overrides));
  vm.runInContext(source, context, { filename: '99_DevLeadAssigneeOrphanDiagnosis.js' });
  return context;
}

{
  let spreadsheetOpened = false;
  const context = run({
    getEnvironment: () => 'production',
    getSpreadsheet: () => { spreadsheetOpened = true; }
  });
  assert.throws(() => context.diagnoseDevLeadAssigneeOrphans(), /development/);
  assert.equal(spreadsheetOpened, false);
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet([
      sheet('リード管理', [['担当者ID', 'リード担当者'], ['CURRENT', 'name-a'], ['ORPHAN_A', 'name-b'], ['ORPHAN_A', 'name-b'], ['ORPHAN_B', '']]),
      sheet('担当者マスタ', [['担当者ID', '苗字（日本語）', '名前（日本語）'], ['CURRENT', 'family', 'given']]),
      sheet('リード_アーカイブ', [['担当者ID', 'リード担当者'], ['ORPHAN_A', 'name-b']]),
      sheet('担当者マスタ_旧', [['担当者ID', '氏名（日本語）'], ['ORPHAN_A', 'former-name']])
    ])
  });
  const result = JSON.parse(JSON.stringify(context.diagnoseDevLeadAssigneeOrphans()));
  assert.equal(result.success, true);
  assert.equal(result.orphanLeadAssigneeRecordCount, 3);
  assert.equal(result.distinctOrphanLeadAssigneeIdCount, 2);
  assert.deepEqual(result.groups.map(group => group.leadRecordCount), [2, 1]);
  assert.deepEqual(result.groups.map(group => group.historicalStaffRecordCount), [1, 0]);
  assert.deepEqual(result.groups.map(group => group.classification), ['HISTORICAL_STAFF_CONFIRMED', 'INSUFFICIENT_EVIDENCE']);
  assert.equal(result.historicalStaffDataFound, true);
  assert.deepEqual(result.leadAssigneeNameHeaders, ['リード担当者']);
  const serialized = JSON.stringify(result);
  ['ORPHAN_A', 'ORPHAN_B', 'CURRENT', 'name-a', 'name-b', 'former-name'].forEach(value => assert.equal(serialized.includes(value), false));
}

{
  const text = source;
  ['setValue', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
    assert.equal(text.includes(token), false, token + ' must not be used');
  });
}

console.log('PASS: DEV lead assignee orphan diagnosis unit checks');
