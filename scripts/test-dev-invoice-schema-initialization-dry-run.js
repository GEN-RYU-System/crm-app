const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const registrySource = fs.readFileSync('src/00_CoreSchemaRegistry.js', 'utf8');
const source = fs.readFileSync('src/99_DevInvoiceSchemaInitializationDryRun.js', 'utf8');

function createSheet(headers) {
  return {
    getLastColumn: () => headers.length,
    getRange: () => ({ getDisplayValues: () => [headers.slice()] })
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Object, String, Array, Set }, overrides));
  vm.runInContext(registrySource, context, { filename: '00_CoreSchemaRegistry.js' });
  vm.runInContext(source, context, { filename: '99_DevInvoiceSchemaInitializationDryRun.js' });
  return context;
}

function headersFor(context, tableKey) {
  const table = context.getCoreSchemaV1Table(tableKey);
  return Object.keys(table.headers).map(headerKey => table.headers[headerKey]);
}

function formatHeaders(headers) {
  return headers.map((header, index) => (index + 1) + ':' + header).join(' | ');
}

function spreadsheet(context, invoiceHeaders, invoiceLineHeaders) {
  const sheets = {};
  if (invoiceHeaders) sheets[context.getCoreSchemaV1TableName('INVOICES')] = createSheet(invoiceHeaders);
  if (invoiceLineHeaders) sheets[context.getCoreSchemaV1TableName('INVOICE_LINES')] = createSheet(invoiceLineHeaders);
  return { getSheetByName: name => sheets[name] || null };
}

function execute(options) {
  let opened = false;
  const context = run({
    getEnvironment: () => (options && options.environment) || 'development',
    getSpreadsheet: () => {
      opened = true;
      return spreadsheet(context, options && options.invoiceHeaders, options && options.invoiceLineHeaders);
    }
  });
  return { context, opened, result: JSON.parse(JSON.stringify(context.dryRunDevInvoiceSchemaInitialization())) };
}

{
  const execution = execute({ environment: 'production' });
  assert.equal(execution.opened, false);
  assert.deepEqual(execution.result, {
    success: false,
    resultType: 'DEV_INVOICE_SCHEMA_DEVELOPMENT_REQUIRED',
    auditVersion: '1',
    invoiceSheetExists: false,
    invoiceLineSheetExists: false,
    invoicePlannedColumnCount: 29,
    invoiceLinePlannedColumnCount: 15,
    invoicePlannedHeaderColumns: formatHeaders(headersFor(execution.context, 'INVOICES')),
    invoiceLinePlannedHeaderColumns: formatHeaders(headersFor(execution.context, 'INVOICE_LINES')),
    invoiceActualColumnCount: 0,
    invoiceLineActualColumnCount: 0,
    invoiceHeaderColumns: '',
    invoiceLineHeaderColumns: '',
    plannedSheetCreateCount: 0,
    sourceDataChangeCount: 0,
    actualDataChangeCount: 0
  });
}

{
  let opened = false;
  const context = run({
    getEnvironment: () => { throw new Error('UNAVAILABLE'); },
    getSpreadsheet: () => { opened = true; }
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevInvoiceSchemaInitialization()));
  assert.equal(opened, false);
  assert.equal(result.resultType, 'DEV_INVOICE_SCHEMA_DEVELOPMENT_REQUIRED');
  assert.equal(result.actualDataChangeCount, 0);
}

{
  const execution = execute();
  assert.equal(execution.result.success, true);
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_DRY_RUN_READY');
  assert.equal(execution.result.plannedSheetCreateCount, 2);
  assert.equal(execution.result.invoicePlannedColumnCount, 29);
  assert.equal(execution.result.invoiceLinePlannedColumnCount, 15);
  assert.match(execution.result.invoicePlannedHeaderColumns, /^1:請求書ID \| 2:請求書番号 \| 3:オーダーID/);
  assert.match(execution.result.invoiceLinePlannedHeaderColumns, /^1:明細ID \| 2:請求書ID \| 3:商品ID/);
  assert.equal(execution.result.invoiceHeaderColumns, '');
  assert.equal(execution.result.invoiceLineHeaderColumns, '');
  assert.equal(Object.values(execution.result).some(Array.isArray), false);
  assert.equal(execution.result.actualDataChangeCount, 0);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => null });
  const invoices = headersFor(context, 'INVOICES');
  const invoiceLines = headersFor(context, 'INVOICE_LINES');
  [
    { invoiceHeaders: invoices, invoiceLineHeaders: null },
    { invoiceHeaders: null, invoiceLineHeaders: invoiceLines }
  ].forEach(input => {
    const execution = execute(input);
    assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_PARTIAL_STATE');
    assert.equal(execution.result.plannedSheetCreateCount, 0);
    assert.equal(execution.result.actualDataChangeCount, 0);
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => { throw new Error('UNAVAILABLE'); }
  });
  const result = JSON.parse(JSON.stringify(context.dryRunDevInvoiceSchemaInitialization()));
  assert.equal(result.resultType, 'DEV_INVOICE_SCHEMA_DRY_RUN_FAILED');
  assert.equal(result.sourceDataChangeCount, 0);
  assert.equal(result.actualDataChangeCount, 0);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => null });
  const execution = execute({
    invoiceHeaders: headersFor(context, 'INVOICES'),
    invoiceLineHeaders: headersFor(context, 'INVOICE_LINES')
  });
  assert.equal(execution.result.success, true);
  assert.equal(execution.result.resultType, 'DEV_INVOICE_SCHEMA_ALREADY_INITIALIZED');
  assert.equal(execution.result.plannedSheetCreateCount, 0);
  assert.equal(typeof execution.result.invoicePlannedHeaderColumns, 'string');
  assert.equal(typeof execution.result.invoiceLinePlannedHeaderColumns, 'string');
  assert.equal(typeof execution.result.invoiceHeaderColumns, 'string');
  assert.equal(typeof execution.result.invoiceLineHeaderColumns, 'string');
  assert.equal(Object.values(execution.result).some(Array.isArray), false);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: () => null });
  const invoices = headersFor(context, 'INVOICES');
  const invoiceLines = headersFor(context, 'INVOICE_LINES');
  assert.equal(execute({ invoiceHeaders: invoices.slice(1), invoiceLineHeaders: invoiceLines }).result.resultType, 'DEV_INVOICE_SCHEMA_COLUMN_COUNT_MISMATCH');
  const reordered = invoices.slice();
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(execute({ invoiceHeaders: reordered, invoiceLineHeaders: invoiceLines }).result.resultType, 'DEV_INVOICE_SCHEMA_HEADER_MISMATCH');
  const missingRequired = invoices.slice();
  missingRequired[0] = '';
  assert.equal(execute({ invoiceHeaders: missingRequired, invoiceLineHeaders: invoiceLines }).result.resultType, 'DEV_INVOICE_SCHEMA_HEADER_MISMATCH');
  const duplicate = invoiceLines.slice();
  duplicate[1] = duplicate[0];
  assert.equal(execute({ invoiceHeaders: invoices, invoiceLineHeaders: duplicate }).result.resultType, 'DEV_INVOICE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE');
  const blank = invoiceLines.slice();
  blank[0] = '';
  blank[1] = '';
  assert.equal(execute({ invoiceHeaders: invoices, invoiceLineHeaders: blank }).result.resultType, 'DEV_INVOICE_SCHEMA_HEADER_MISMATCH');
}

const forbiddenTokens = [
  'setValue', 'setValues', 'appendRow', 'clear', 'deleteSheet', 'insertSheet',
  'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'DriveApp', 'GmailApp', 'Logger.', 'console.'
];
forbiddenTokens.forEach(token => assert.equal(source.includes(token), false, token + ' must not be used'));
assert.equal(/error\.message|error\.stack/.test(source), false);
console.log('PASS: DEV invoice schema initialization dry-run unit checks');

