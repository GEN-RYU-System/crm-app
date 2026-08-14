const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const registrySource = fs.readFileSync('src/00_CoreSchemaRegistry.js', 'utf8');
const registrationSource = fs.readFileSync('src/18_CustomerRegistration.js', 'utf8');
const TABLE_KEYS = ['CUSTOMERS', 'SHIPPING_DESTINATIONS', 'PAYMENT_DESTINATIONS', 'FORM_TOKENS'];

function createSheet(name, headers, rows, writes) {
  const data = [headers].concat(rows || []);
  return {
    getDataRange: () => ({ getValues: () => data.map(row => row.slice()) }),
    getLastColumn: () => headers.length,
    getLastRow: () => data.length,
    getRange: (row, column, rowCount, columnCount) => {
      if (row === 1 && column === 1 && rowCount === 1 && columnCount === headers.length) {
        return { getDisplayValues: () => [headers.slice()] };
      }
      const range = {
        setNumberFormats: () => range,
        setValues: values => {
          writes.push({ name, api: 'setValues', row, column, rowCount, columnCount, valueCount: values.length });
          return range;
        },
        setValue: () => {
          writes.push({ name, api: 'setValue', row, column, rowCount, columnCount });
          return range;
        }
      };
      return range;
    }
  };
}

function createRuntime(options) {
  const writes = [];
  const lockState = { waitCount: 0, releaseCount: 0 };
  const sheets = {};
  const context = vm.createContext({
    Object, String, Array, Set, RegExp, Math, Date,
    Utilities: { formatDate: () => 'DATE' },
    LockService: { getScriptLock: () => ({
      waitLock: () => {
        lockState.waitCount += 1;
        if (options && options.lockFailure) throw new Error('LOCK_UNAVAILABLE');
        if (options && options.afterLock) options.afterLock(sheets, context, writes);
      },
      releaseLock: () => { lockState.releaseCount += 1; }
    }) },
    normalizePhone: () => ({ value: '', national: '', dialCode: '', flag: '空欄' }),
    HEADERS: { CRM_CUSTOMERS: [], CRM_SHIPPING: [], CRM_PAYMENT: [] }
  });
  vm.runInContext(registrySource, context, { filename: '00_CoreSchemaRegistry.js' });

  TABLE_KEYS.forEach(tableKey => {
    const table = context.getCoreSchemaV1Table(tableKey);
    const headers = Object.keys(table.headers).map(key => table.headers[key]);
    sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
  });
  const tokenHeaders = Object.keys(context.getCoreSchemaV1Table('FORM_TOKENS').headers)
    .map(key => context.getCoreSchemaV1Table('FORM_TOKENS').headers[key]);
  sheets['フォームトークン'] = createSheet('フォームトークン', tokenHeaders, [['TOKEN', 'LEAD', '', '']], writes);
  sheets['国マスタ'] = createSheet('国マスタ', ['国名（表示）', '州必須', '郵便番号必須'], [['Japan', 'FALSE', 'FALSE']], writes);

  if (options && options.missingTable) delete sheets[context.getCoreSchemaV1Table(options.missingTable).sheetName];
  if (options && options.duplicateTable) {
    const table = context.getCoreSchemaV1Table(options.duplicateTable);
    const headers = Object.keys(table.headers).map(key => table.headers[key]);
    headers.push(headers[0]);
    sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
  }
  if (options && options.missingHeaderTable) {
    const table = context.getCoreSchemaV1Table(options.missingHeaderTable);
    const headers = Object.keys(table.headers).map(key => table.headers[key]).slice(1);
    sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
  }
  if (options && options.reorderedTable) {
    const table = context.getCoreSchemaV1Table(options.reorderedTable);
    const headers = Object.keys(table.headers).map(key => table.headers[key]);
    [headers[0], headers[1]] = [headers[1], headers[0]];
    sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
  }

  context.HEADERS.CRM_CUSTOMERS = Object.keys(context.getCoreSchemaV1Table('CUSTOMERS').headers).map(key => context.getCoreSchemaV1Table('CUSTOMERS').headers[key]);
  context.HEADERS.CRM_SHIPPING = Object.keys(context.getCoreSchemaV1Table('SHIPPING_DESTINATIONS').headers).map(key => context.getCoreSchemaV1Table('SHIPPING_DESTINATIONS').headers[key]);
  context.HEADERS.CRM_PAYMENT = Object.keys(context.getCoreSchemaV1Table('PAYMENT_DESTINATIONS').headers).map(key => context.getCoreSchemaV1Table('PAYMENT_DESTINATIONS').headers[key]);
  context.getSpreadsheet = () => ({ getSheetByName: name => sheets[name] || null });
  vm.runInContext(registrationSource, context, { filename: '18_CustomerRegistration.js' });
  return { context, writes, sheets, lockState };
}

function payload() {
  return {
    token: 'TOKEN',
    billing: { name: 'N', phone: 'P', addr1: 'A', city: 'C', country: 'Japan', email: 'E' },
    shipping: null
  };
}

{
  const runtime = createRuntime();
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.equal(result.success, true);
  assert.deepEqual(runtime.writes.map(write => [write.name, write.api, write.column, write.columnCount]), [
    ['顧客マスタ', 'setValues', 1, 19],
    ['配送先マスタ', 'setValues', 1, 16],
    ['支払先マスタ', 'setValues', 1, 15],
    ['フォームトークン', 'setValue', 4, undefined]
  ]);
  assert.deepEqual(runtime.lockState, { waitCount: 1, releaseCount: 1 });
}

['CUSTOMERS', 'SHIPPING_DESTINATIONS', 'PAYMENT_DESTINATIONS', 'FORM_TOKENS'].forEach(tableKey => {
  const runtime = createRuntime({ missingTable: tableKey });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.equal(result.success, false);
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REQUIRED_TAB_MISSING']);
  assert.equal(runtime.writes.length, 0);
});

{
  const runtime = createRuntime({ missingHeaderTable: 'PAYMENT_DESTINATIONS' });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REQUIRED_HEADER_MISSING']);
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({ duplicateTable: 'SHIPPING_DESTINATIONS' });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE']);
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({ reorderedTable: 'CUSTOMERS' });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REGISTRATION_HEADER_ORDER_MISMATCH']);
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({
    afterLock: (sheets, context, writes) => {
      const table = context.getCoreSchemaV1Table('CUSTOMERS');
      const headers = Object.keys(table.headers).map(key => table.headers[key]);
      headers[0] = 'CHANGED_HEADER';
      sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
    }
  });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REGISTRATION_SOURCE_CHANGED']);
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.lockState.releaseCount, 1);
}

{
  const runtime = createRuntime({
    afterLock: (sheets, context, writes) => {
      const table = context.getCoreSchemaV1Table('PAYMENT_DESTINATIONS');
      const headers = Object.keys(table.headers).map(key => table.headers[key]);
      sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
    }
  });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REGISTRATION_SOURCE_CHANGED']);
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.lockState.releaseCount, 1);
}

{
  const runtime = createRuntime({
    afterLock: (sheets, context, writes) => {
      const table = context.getCoreSchemaV1Table('SHIPPING_DESTINATIONS');
      const headers = Object.keys(table.headers).map(key => table.headers[key]).concat(['EXTRA_HEADER']);
      sheets[table.sheetName] = createSheet(table.sheetName, headers, [], writes);
    }
  });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.deepEqual(Array.from(result.errors), ['CORE_SCHEMA_REGISTRATION_SOURCE_CHANGED']);
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.lockState.releaseCount, 1);
}

{
  const runtime = createRuntime({ lockFailure: true });
  const result = runtime.context.registerCustomerFromForm(payload());
  assert.equal(result.success, false);
  assert.equal(runtime.writes.length, 0);
  assert.deepEqual(runtime.lockState, { waitCount: 1, releaseCount: 0 });
}

assert.equal(/console\.log|Logger\.log/.test(registrationSource.slice(registrationSource.indexOf('function registerCustomerFromForm'))), false);
assert.equal(registrationSource.indexOf('coreSchemaTables = lockedCoreSchemaTables') > registrationSource.indexOf('lockedCoreSchemaTables = resolveCustomerRegistrationCoreSchemaWriteContext_'), true);
console.log('PASS: customer registration Core Schema V1 resolution checks');
