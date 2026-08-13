const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevSpreadsheetStructureAuditLog.js', 'utf8');

function createContext(overrides) {
  return vm.createContext(Object.assign({
    Date,
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
    }
  }, overrides));
}

function load(context) {
  vm.runInContext(source, context, { filename: '99_DevSpreadsheetStructureAuditLog.js' });
  return context;
}

function auditResult() {
  return {
    sheets: [{
      name: '監査対象',
      scannedDataRowCount: 2,
      completelyEmptyDataRowCount: 0,
      nonEmptyDataRowCount: 2,
      columnCount: 3,
      duplicateHeaderCount: 0,
      formulaCellCount: 0,
      hasFilter: false,
      sheetProtectionCount: 0,
      rangeProtectionCount: 0,
      dataValidationCellCount: 0,
      idHeaderIntegrity: [{
        header: '顧客ID',
        emptyCount: 0,
        duplicateValueRowCount: 0
      }]
    }]
  };
}

const auditLogHeaders = [
  '実行日時', '監査バージョン', 'タブ名', '監査対象行数', '完全空行数',
  '実レコード数', '列数', 'ヘッダー重複数', '数式セル数', 'フィルタ有無',
  'シート保護数', '範囲保護数', 'データ検証セル数', 'ID系ヘッダー名',
  'ID空欄数', 'ID重複値行数', '成功種別'
];

function createSpreadsheet(mode) {
  const calls = { inserted: 0, deleted: 0, setValuesCalls: [] };
  let sheet = mode.startsWith('existing') ? createLogSheet(5) : null;

  function createLogSheet(initialLastRow) {
    let lastRow = initialLastRow;
    return {
      getLastRow: () => lastRow,
      getRange: (row, column, rowCount, columnCount) => ({
        setValues: values => {
          calls.setValuesCalls.push({ row, column, rowCount, columnCount, values });
          if (mode.endsWith('failure')) throw new Error('write failure');
          lastRow += rowCount;
        },
        getDisplayValues: () => [auditLogHeaders]
      })
    };
  }

  return {
    calls,
    getSheetByName: () => sheet,
    insertSheet: () => {
      calls.inserted += 1;
      sheet = createLogSheet(0);
      return sheet;
    },
    deleteSheet: deletedSheet => {
      assert.equal(deletedSheet, sheet);
      calls.deleted += 1;
    }
  };
}

{
  const context = load(createContext({
    getEnvironment: () => 'production',
    auditDevSpreadsheetStructure: () => { throw new Error('must not audit'); },
    getSpreadsheet: () => { throw new Error('must not open spreadsheet'); }
  }));
  assert.throws(() => context.runAndLogDevSpreadsheetStructureAudit(), /development/);
}

{
  let spreadsheetOpened = false;
  let releases = 0;
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: () => { throw new Error('audit failure'); },
    getSpreadsheet: () => { spreadsheetOpened = true; },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { releases += 1; } })
    }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'AUDIT_FAILED' }
  );
  assert.equal(spreadsheetOpened, false);
  assert.equal(releases, 1);
}

{
  const spreadsheet = createSpreadsheet('new');
  let releases = 0;
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet,
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { releases += 1; } })
    }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: true, resultType: 'AUDIT_LOG_RECORDED', logRowCount: 1 }
  );
  assert.equal(spreadsheet.calls.inserted, 1);
  assert.equal(spreadsheet.calls.deleted, 0);
  assert.equal(spreadsheet.calls.setValuesCalls.length, 1);
  assert.equal(spreadsheet.calls.setValuesCalls[0].row, 1);
  assert.equal(spreadsheet.calls.setValuesCalls[0].rowCount, 2);
  assert.equal(spreadsheet.calls.setValuesCalls[0].columnCount, 17);
  assert.equal(releases, 1);
}

{
  const spreadsheet = createSpreadsheet('existing');
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet
  }));
  context.runAndLogDevSpreadsheetStructureAudit();
  assert.equal(spreadsheet.calls.inserted, 0);
  assert.equal(spreadsheet.calls.deleted, 0);
  assert.equal(spreadsheet.calls.setValuesCalls.length, 1);
  assert.equal(spreadsheet.calls.setValuesCalls[0].row, 6);
  assert.equal(spreadsheet.calls.setValuesCalls[0].rowCount, 1);
}

{
  const spreadsheet = createSpreadsheet('new-failure');
  let releases = 0;
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet,
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { releases += 1; } })
    }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'AUDIT_LOG_WRITE_FAILED' }
  );
  assert.equal(spreadsheet.calls.inserted, 1);
  assert.equal(spreadsheet.calls.deleted, 1);
  assert.equal(spreadsheet.calls.setValuesCalls.length, 1);
  assert.equal(releases, 1);
}

{
  const spreadsheet = createSpreadsheet('existing-failure');
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'AUDIT_LOG_WRITE_FAILED' }
  );
  assert.equal(spreadsheet.calls.inserted, 0);
  assert.equal(spreadsheet.calls.deleted, 0);
  assert.equal(spreadsheet.calls.setValuesCalls.length, 1);
  assert.equal(spreadsheet.calls.setValuesCalls[0].row, 6);
}

{
  let spreadsheetOpened = false;
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: () => ({ sheets: [] }),
    getSpreadsheet: () => { spreadsheetOpened = true; }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'NO_AUDIT_ROWS' }
  );
  assert.equal(spreadsheetOpened, false);
}

{
  let audited = false;
  let spreadsheetOpened = false;
  let released = false;
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: () => { audited = true; },
    getSpreadsheet: () => { spreadsheetOpened = true; },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { throw new Error('lock unavailable'); },
        releaseLock: () => { released = true; }
      })
    }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'AUDIT_LOCK_UNAVAILABLE' }
  );
  assert.equal(audited, false);
  assert.equal(spreadsheetOpened, false);
  assert.equal(released, false);
}

console.log('PASS: DEV structure audit log unit checks');
