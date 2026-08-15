const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const registrySource = fs.readFileSync('src/00_CoreSchemaRegistry.js', 'utf8');
const source = fs.readFileSync('src/99_DevInvoiceSchemaInitialization.js', 'utf8');

function createSpreadsheet(options = {}) {
  const sheets = Object.assign({}, options.existingSheets || {});
  const created = [];
  const deleted = [];
  let nextSheetId = 100;
  let absentReadCount = 0;

  function makeSheet(name) {
    let headers = [];
    let maxColumns = options.initialMaxColumns || 26;
    const sheetId = nextSheetId++;
    return {
      name,
      sheetId,
      getSheetId: () => sheetId,
      getMaxColumns: () => maxColumns,
      insertColumnsAfter: (afterPosition, howMany) => {
        if (options.failGridExpansion) throw new Error('grid expansion failure');
        assert.equal(afterPosition, maxColumns);
        maxColumns += howMany;
      },
      getLastRow: () => options.postWriteRowMismatch ? 2 : (headers.length ? 1 : 0),
      getLastColumn: () => options.postWriteColumnMismatch ? headers.length + 1 : headers.length,
      getRange: () => ({
        setValues: values => {
          if (options.failHeaderWrite) throw new Error('header write failure');
          headers = values[0].slice();
        },
        getDisplayValues: () => [
          options.postWriteHeaderMismatch
            ? headers.map((value, index) => index === 0 ? 'MISMATCH' : value)
            : headers.slice()
        ]
      })
    };
  }

  return {
    created,
    deleted,
    getSheetByName: name => {
      if (options.sourceAppearsBeforeWrite && !sheets[name]) {
        absentReadCount++;
        if (absentReadCount > 2) return { name, getSheetId: () => 999 };
      }
      if (options.postWriteMissing && created.length === 2 && name === created[1].name) return null;
      if (options.postWriteDifferentSheet && created.length === 2 && name === created[1].name) {
        return Object.assign({}, created[1], { getSheetId: () => 999 });
      }
      return sheets[name] || null;
    },
    insertSheet: name => {
      if (options.failSecondInsert && created.length === 1) throw new Error('insert failure');
      const sheet = makeSheet(name);
      sheets[name] = sheet;
      created.push(sheet);
      return sheet;
    },
    deleteSheet: sheet => {
      if (options.deleteFails) throw new Error('delete failure');
      deleted.push(sheet.name);
      if (sheets[sheet.name] === sheet) delete sheets[sheet.name];
    }
  };
}

function run(options = {}) {
  let spreadsheetOpened = false;
  let lockRequested = false;
  const lock = {
    released: false,
    tryLock: timeout => {
      assert.equal(timeout, 5000);
      return options.lockAvailable !== false;
    },
    releaseLock: () => { lock.released = true; }
  };
  const spreadsheet = options.spreadsheet || createSpreadsheet(options);
  const context = vm.createContext({
    Object, String, Array, Set,
    getEnvironment: () => {
      if (options.environmentThrows) throw new Error('environment unavailable');
      return options.environment || 'development';
    },
    getSpreadsheet: () => {
      spreadsheetOpened = true;
      return spreadsheet;
    },
    LockService: {
      getScriptLock: () => {
        lockRequested = true;
        return lock;
      }
    },
    SpreadsheetApp: {
      flush: () => {
        if (options.flushFails) throw new Error('flush failure');
      }
    }
  });
  vm.runInContext(registrySource, context, { filename: '00_CoreSchemaRegistry.js' });
  vm.runInContext(source, context, { filename: '99_DevInvoiceSchemaInitialization.js' });
  const result = JSON.parse(JSON.stringify(context.initializeDevInvoiceSchema()));
  return { context, result, spreadsheet, lock, spreadsheetOpened, lockRequested };
}

function expectedHeaders(context, tableKey) {
  const table = context.getCoreSchemaV1Table(tableKey);
  return Object.keys(table.headers).map(key => context.getCoreSchemaV1HeaderName(tableKey, key));
}

{
  const execution = run({ environment: 'production' });
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_DEVELOPMENT_REQUIRED');
  assert.equal(execution.spreadsheetOpened, false);
  assert.equal(execution.lockRequested, false);
  assert.equal(execution.result.actualDataChangeCount, 0);
}

{
  const execution = run({ environmentThrows: true });
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_DEVELOPMENT_REQUIRED');
  assert.equal(execution.spreadsheetOpened, false);
  assert.equal(execution.lockRequested, false);
}

{
  const execution = run({ lockAvailable: false });
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_LOCK_UNAVAILABLE');
  assert.equal(execution.spreadsheetOpened, false);
  assert.equal(execution.lock.released, false);
}

{
  const existing = { existing: { getSheetId: () => 1 } };
  const execution = run({ existingSheets: existing });
  const invoiceName = execution.context.getCoreSchemaV1TableName('INVOICES');
  const rerun = run({ existingSheets: { [invoiceName]: existing.existing } });
  assert.equal(rerun.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_TARGET_EXISTS');
  assert.equal(rerun.spreadsheet.created.length, 0);
  assert.equal(rerun.lock.released, true);
}

{
  const execution = run({ sourceAppearsBeforeWrite: true });
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_SOURCE_CHANGED');
  assert.equal(execution.spreadsheet.created.length, 0);
  assert.equal(execution.lock.released, true);
}

{
  const execution = run();
  const invoiceHeaders = expectedHeaders(execution.context, 'INVOICES');
  const invoiceLineHeaders = expectedHeaders(execution.context, 'INVOICE_LINES');
  assert.equal(execution.result.success, true);
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_SUCCEEDED');
  assert.equal(execution.result.createdSheetCount, 2);
  assert.equal(execution.result.headerRowWriteCount, 2);
  assert.equal(execution.result.headerCellWriteCount, 44);
  assert.equal(execution.result.insertedColumnCount, 3);
  assert.equal(execution.result.invoiceColumnCount, 29);
  assert.equal(execution.result.invoiceLineColumnCount, 15);
  assert.equal(execution.result.sourceDataChangeCount, 0);
  assert.equal(execution.result.actualDataChangeCount, 2);
  assert.equal(execution.result.actualDataChangeUnit, 'HEADER_ROWS');
  assert.equal(execution.result.dataChangeState, 'CHANGED');
  assert.equal(execution.spreadsheet.created.length, 2);
  assert.deepEqual(
    execution.spreadsheet.created.map(sheet => sheet.name),
    [
      execution.context.getCoreSchemaV1TableName('INVOICES'),
      execution.context.getCoreSchemaV1TableName('INVOICE_LINES')
    ]
  );
  assert.deepEqual(
    execution.spreadsheet.created[0].getRange().getDisplayValues()[0],
    Array.from(invoiceHeaders)
  );
  assert.deepEqual(
    execution.spreadsheet.created[1].getRange().getDisplayValues()[0],
    Array.from(invoiceLineHeaders)
  );
  assert.equal(execution.lock.released, true);
}

[
  ['failSecondInsert', 'DEV_INVOICE_SCHEMA_INITIALIZATION_FAILED'],
  ['failGridExpansion', 'DEV_INVOICE_SCHEMA_INITIALIZATION_FAILED'],
  ['failHeaderWrite', 'DEV_INVOICE_SCHEMA_INITIALIZATION_FAILED'],
  ['postWriteMissing', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_SHEET_MISMATCH'],
  ['postWriteDifferentSheet', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_SHEET_MISMATCH'],
  ['postWriteRowMismatch', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_ROW_COUNT_MISMATCH'],
  ['postWriteColumnMismatch', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_COLUMN_COUNT_MISMATCH'],
  ['postWriteHeaderMismatch', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_HEADER_MISMATCH'],
  ['flushFails', 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_VERIFY_EXCEPTION']
].forEach(([option, resultType]) => {
  const execution = run({ [option]: true });
  assert.equal(execution.result.resultType, resultType, option);
  assert.equal(execution.result.actualDataChangeCount, 0, option);
  assert.equal(execution.result.dataChangeState, 'UNCHANGED', option);
  assert.equal(execution.spreadsheet.deleted.length, execution.spreadsheet.created.length, option);
  assert.equal(execution.lock.released, true, option);
});

{
  const execution = run({ failSecondInsert: true, deleteFails: true });
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_INITIALIZATION_ROLLBACK_STATE_UNKNOWN');
  assert.equal(execution.result.failurePhase, 'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ROLLBACK');
  assert.equal(execution.result.actualDataChangeCount, null);
  assert.equal(execution.result.dataChangeState, 'UNKNOWN');
  assert.equal(execution.lock.released, true);
}

assert.equal(source.includes('請求書管理'), false);
assert.equal(source.includes('請求書明細'), false);
assert.equal(source.includes('請求書ID'), false);
assert.equal(source.includes('商品ID'), false);
assert.equal(source.includes('LEGACY_INPUT'), false);
assert.equal(source.includes('LEGACY_SALES'), false);
assert.equal(/error\.message|error\.stack|Logger\.|console\./.test(source), false);
console.log('PASS: DEV invoice schema initialization unit checks');
