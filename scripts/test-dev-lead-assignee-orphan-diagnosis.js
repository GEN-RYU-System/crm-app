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
      sheet('リード管理', [
        ['担当者ID', 'リード担当者', '営業担当者', '', ''],
        ['ACTIVE_ID', '現　担当', '', '', ''],
        ['ORPHAN_A', '一 意', '', '', ''],
        ['ORPHAN_A', '', '複数候補', '', ''],
        ['ORPHAN_B', '存在しない名前', '', '', ''],
        ['ORPHAN_C', '', '', '', ''],
        ['ORPHAN_D', '過去担当', '', '', '']
      ]),
      sheet('担当者マスタ', [
        ['担当者ID', '苗字（日本語）', '名前（日本語）', '氏名（日本語）'],
        ['ACTIVE_ID', '現', '担当', ''],
        ['STAFF_1', '一', '意', ''],
        ['STAFF_2', '複数', '候補', ''],
        ['STAFF_3', '', '', '複 数　候 補']
      ]),
      sheet('リード_アーカイブ', [['担当者ID', 'リード担当者'], ['ORPHAN_A', '一 意']]),
      sheet('担当者マスタ_旧', [['担当者ID', '氏名（日本語）'], ['ORPHAN_D', '過去担当']]),
      sheet('担当者履歴_空', [['担当者ID', '氏名（日本語）']])
    ])
  });
  const result = JSON.parse(JSON.stringify(context.diagnoseDevLeadAssigneeOrphans()));
  assert.equal(result.success, true);
  assert.equal(result.orphanLeadAssigneeRecordCount, 5);
  assert.equal(result.distinctOrphanLeadAssigneeIdCount, 4);
  assert.deepEqual(result.groups.map(group => group.leadRecordCount), [2, 1, 1, 1]);
  assert.deepEqual(result.groups.map(group => group.supplementalNameBlankCount), [0, 0, 1, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffNameUniqueMatchCount), [1, 0, 0, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffNameAmbiguousMatchCount), [1, 0, 0, 0]);
  assert.deepEqual(result.groups.map(group => group.currentStaffNameMismatchCount), [0, 1, 0, 1]);
  assert.deepEqual(result.groups.map(group => group.historicalStaffIdMatchRecordCount), [0, 0, 0, 1]);
  assert.deepEqual(result.groups.map(group => group.classification), [
    'CURRENT_STAFF_NAME_MATCH_FOUND',
    'INSUFFICIENT_EVIDENCE',
    'INSUFFICIENT_EVIDENCE',
    'HISTORICAL_STAFF_ID_MATCH_FOUND'
  ]);
  assert.equal(result.historicalStaffDataFound, true);
  assert.deepEqual(result.leadAssigneeNameHeaders, ['リード担当者', '営業担当者']);
  const serialized = JSON.stringify(result);
  [
    'ORPHAN_A', 'ORPHAN_B', 'ORPHAN_C', 'ORPHAN_D', 'ACTIVE_ID', 'STAFF_1',
    '一 意', '複数候補', '存在しない名前', '過去担当'
  ].forEach((value, index) => assert.equal(serialized.includes(value), false, 'sensitive fixture ' + index));
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet([
      sheet('リード管理', [['担当者ID', '担当者ID'], ['ORPHAN', 'ORPHAN']]),
      sheet('担当者マスタ', [['担当者ID'], ['CURRENT']])
    ])
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.diagnoseDevLeadAssigneeOrphans())),
    { success: false, errorType: 'LEAD_ASSIGNEE_DIAGNOSIS_FAILED' }
  );
}

{
  const text = source;
  ['setValue', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
    assert.equal(text.includes(token), false, token + ' must not be used');
  });
}

console.log('PASS: DEV lead assignee orphan diagnosis unit checks');
