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

function createSpreadsheet() {
  const calls = { inserted: 0, headers: 0, appended: 0 };
  let sheet = null;
  return {
    calls,
    getSheetByName: () => sheet,
    insertSheet: () => {
      calls.inserted += 1;
      sheet = {
        getRange: () => ({
          setValues: () => { calls.headers += 1; },
          getDisplayValues: () => [[
            '実行日時', '監査バージョン', 'タブ名', '監査対象行数', '完全空行数',
            '実レコード数', '列数', 'ヘッダー重複数', '数式セル数', 'フィルタ有無',
            'シート保護数', '範囲保護数', 'データ検証セル数', 'ID系ヘッダー名',
            'ID空欄数', 'ID重複値行数', '成功種別'
          ]]
        }),
        appendRow: () => { calls.appended += 1; }
      };
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
  const spreadsheet = createSpreadsheet();
  const context = load(createContext({
    getEnvironment: () => 'development',
    auditDevSpreadsheetStructure: auditResult,
    getSpreadsheet: () => spreadsheet
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.runAndLogDevSpreadsheetStructureAudit())),
    { success: true, resultType: 'AUDIT_LOG_RECORDED', logRowCount: 1 }
  );
  assert.deepEqual(spreadsheet.calls, { inserted: 1, headers: 1, appended: 1 });
}

console.log('PASS: DEV structure audit log unit checks');
