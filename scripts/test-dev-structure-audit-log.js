const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevSpreadsheetStructureAuditLog.js', 'utf8');

function createContext(overrides) {
  return vm.createContext(Object.assign({ Date }, overrides));
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

function createSpreadsheet(hasExistingLogSheet) {
  const calls = { inserted: 0, headerWrites: 0, logWrites: [] };
  let sheet = hasExistingLogSheet ? createLogSheet(5) : null;

  function createLogSheet(initialLastRow) {
    let lastRow = initialLastRow;
    return {
      getLastRow: () => lastRow,
      getRange: (row, column, rowCount, columnCount) => ({
        setValues: values => {
          if (row === 1 && rowCount === 1) {
            calls.headerWrites += 1;
            lastRow = 1;
            return;
          }
          calls.logWrites.push({ row, column, rowCount, columnCount, values });
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
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: () => { throw new Error('audit failure'); },
    getSpreadsheet: () => { spreadsheetOpened = true; }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: false, errorType: 'AUDIT_FAILED' }
  );
  assert.equal(spreadsheetOpened, false);
}

{
  const spreadsheet = createSpreadsheet(false);
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: true, resultType: 'AUDIT_LOG_RECORDED', logRowCount: 1 }
  );
  assert.equal(spreadsheet.calls.inserted, 1);
  assert.equal(spreadsheet.calls.headerWrites, 1);
  assert.equal(spreadsheet.calls.logWrites.length, 1);
  assert.equal(spreadsheet.calls.logWrites[0].row, 2);
  assert.equal(spreadsheet.calls.logWrites[0].column, 1);
  assert.equal(spreadsheet.calls.logWrites[0].rowCount, 1);
  assert.equal(spreadsheet.calls.logWrites[0].columnCount, 17);
  assert.equal(spreadsheet.calls.logWrites[0].values.length, 1);
}

{
  const spreadsheet = createSpreadsheet(true);
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet
  }));
  context.runAndLogDevSpreadsheetStructureAudit();
  assert.equal(spreadsheet.calls.inserted, 0);
  assert.equal(spreadsheet.calls.headerWrites, 0);
  assert.equal(spreadsheet.calls.logWrites.length, 1);
  assert.equal(spreadsheet.calls.logWrites[0].row, 6);
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

console.log('PASS: DEV structure audit log unit checks');
