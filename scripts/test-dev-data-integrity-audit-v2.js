const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const structureSource = fs.readFileSync('src/99_DevSpreadsheetStructureAudit.js', 'utf8');
const referenceSource = fs.readFileSync('src/99_DevReferenceIntegrityAudit.js', 'utf8');

function load(overrides) {
  const context = vm.createContext(Object.assign({ Date }, overrides));
  vm.runInContext(structureSource, context, { filename: '99_DevSpreadsheetStructureAudit.js' });
  vm.runInContext(referenceSource, context, { filename: '99_DevReferenceIntegrityAudit.js' });
  return context;
}

function mockSheet(headers, values, formulas) {
  return {
    getLastRow: () => values.length + 1,
    getLastColumn: () => headers.length,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : {
        getValues: () => values,
        getFormulas: () => formulas
      }
  };
}

{
  const context = load({});
  const sheet = Object.assign(mockSheet(
    ['担当者ID', '表示名'],
    [['STAFF-A', 'record'], ['', 'record'], ['', '']],
    [['', ''], ['', ''], ['', '']]
  ), {
    getName: () => '担当者マスタ',
    getFilter: () => null,
    getProtections: () => [],
    getRange: (row, column, rowCount) => {
      if (row === 1 && rowCount === 1) return { getDisplayValues: () => [['担当者ID', '表示名']] };
      if (row === 2) return {
        getValues: () => [['STAFF-A', 'record'], ['', 'record'], ['', '']],
        getFormulas: () => [['', ''], ['', ''], ['', '']]
      };
      return {
        getFormulas: () => [['', ''], ['', ''], ['', '']],
        getDataValidations: () => [[null, null], [null, null], [null, null]]
      };
    }
  });
  context.SpreadsheetApp = { ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' } };
  const result = context.auditDevSpreadsheetSheet(sheet);
  assert.equal(result.nonEmptyDataRowCount, 2);
  assert.equal(result.completelyEmptyDataRowCount, 1);
  assert.equal(result.idHeaderIntegrity[0].emptyCount, 1);
  assert.equal(JSON.stringify(result).includes('STAFF-A'), false);
  assert.equal(JSON.stringify(result).includes('record'), false);
}

{
  const sheets = {
    Parent: mockSheet(['親ID', '補助列'], [['INTERNAL_PARENT_ID_VALUE', 'record']], [['', '']]),
    Child: mockSheet(
      ['親ID', '補助列'],
      [
        ['INTERNAL_PARENT_ID_VALUE', 'record'],
        ['', 'record'],
        ['INTERNAL_ORPHAN_ID_VALUE', 'record'],
        ['', '']
      ],
      [['', ''], ['', ''], ['', ''], ['', '']]
    )
  };
  const context = load({});
  const result = context.auditDevReferenceIntegrityRelation(
    { getSheetByName: name => sheets[name] },
    ['Parent', '親ID', 'Child', '親ID', 'REQUIRED'],
    {}
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    parentSheetName: 'Parent',
    parentIdHeader: '親ID',
    childSheetName: 'Child',
    childIdHeader: '親ID',
    childNonEmptyDataRowCount: 3,
    emptyReferenceIdCount: 1,
    parentPresentReferenceCount: 1,
    orphanReferenceCount: 1,
    status: 'ORPHAN_REFERENCE_FOUND'
  });
  assert.equal(
    result.childNonEmptyDataRowCount,
    result.emptyReferenceIdCount + result.parentPresentReferenceCount + result.orphanReferenceCount
  );
  assert.equal(JSON.stringify(result).includes('INTERNAL_PARENT_ID_VALUE'), false);
  assert.equal(JSON.stringify(result).includes('INTERNAL_ORPHAN_ID_VALUE'), false);
}

{
  const context = load({});
  assert.throws(
    () => context.getUniqueDevReferenceIntegrityHeaderIndex(['親ID', '親ID'], '親ID'),
    /schema is invalid/
  );
}

{
  let spreadsheetOpened = false;
  const context = load({
    getEnvironment: () => 'production',
    getSpreadsheet: () => { spreadsheetOpened = true; },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) }
  });
  assert.throws(() => context.runAndLogDevReferenceIntegrityAudit(), /development/);
  assert.equal(spreadsheetOpened, false);
}

{
  const calls = { headerWrites: 0, auditWrites: 0, releases: 0 };
  const logSheet = {
    getLastRow: () => 1,
    getRange: (row, column, rowCount) => ({
      setValues: () => {
        if (row === 1 && rowCount === 1) calls.headerWrites += 1;
        else calls.auditWrites += 1;
      },
      getDisplayValues: () => [[]]
    })
  };
  const spreadsheet = {
    getSheetByName: () => null,
    insertSheet: () => logSheet
  };
  const context = load({
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { calls.releases += 1; } }) }
  });
  context.buildDevReferenceIntegrityAuditRows = () => [[
    new Date(), '2', '親タブ', '子タブ', '親ID', '子ID', 1, 0, 1, 0, 'OK'
  ]];
  const result = JSON.parse(JSON.stringify(context.runAndLogDevReferenceIntegrityAudit()));
  assert.deepEqual(result, {
    success: true,
    resultType: 'REFERENCE_INTEGRITY_AUDIT_LOG_RECORDED',
    logRowCount: 1
  });
  assert.deepEqual(calls, { headerWrites: 1, auditWrites: 1, releases: 1 });
}

assert.equal(/Logger\.log|console\.log/.test(referenceSource), false);
assert.equal(/UrlFetchApp|DriveApp|PropertiesService|ScriptApp/.test(referenceSource), false);
console.log('PASS: DEV data integrity audit V2 unit checks');
