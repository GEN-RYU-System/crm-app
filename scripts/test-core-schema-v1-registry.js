const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/00_CoreSchemaRegistry.js', 'utf8');
const configSource = fs.readFileSync('src/08_Config.js', 'utf8');

function createSheet(headers, expectedHeaderRow) {
  return {
    getLastColumn: () => headers.length,
    getRange: (row, column, rows, columns) => {
      if (expectedHeaderRow !== undefined) assert.equal(row, expectedHeaderRow);
      assert.equal(column, 1);
      assert.equal(rows, 1);
      assert.equal(columns, headers.length);
      return { getDisplayValues: () => [headers] };
    }
  };
}

function createContext() {
  return vm.createContext({ Object, String, Array, Set, Boolean });
}

function run() {
  const context = createContext();
  vm.runInContext(source, context, { filename: '00_CoreSchemaRegistry.js' });
  return context;
}

{
  const context = run();
  const expectedHeaderCounts = {
    LEADS: 62, CUSTOMERS: 19, SHIPPING_DESTINATIONS: 16, PAYMENT_DESTINATIONS: 15,
    ORDERS: 38, ORDER_LINES: 11, SHIPMENTS: 20, PURCHASES: 17, FORM_TOKENS: 4,
    PRODUCTS: 24, STAFF: 20
  };
  const tableKeys = vm.runInContext('Object.keys(CORE_SCHEMA_V1_TABLES)', context);
  assert.deepEqual(Array.from(tableKeys).slice(0, 11), Object.keys(expectedHeaderCounts));
  Object.keys(expectedHeaderCounts).forEach(tableKey => {
    const table = context.getCoreSchemaV1Table(tableKey);
    assert.equal(Object.keys(table.headers).length, expectedHeaderCounts[tableKey]);
    assert.equal(table.headerRowNumber, 1);
    assert.equal(Boolean(table.primaryKey), true);
    Object.keys(table.headers).forEach(headerKey => {
      assert.equal(context.getCoreSchemaV1HeaderName(tableKey, headerKey), table.headers[headerKey]);
    });
  });
  assert.equal(context.getCoreSchemaV1Table('LEGACY_INPUT').headerRowNumber, 1);
  assert.equal(context.getCoreSchemaV1Table('LEGACY_SALES').headerRowNumber, 4);
  assert.equal(context.getCoreSchemaV1TableName('PAYMENT_DESTINATIONS'), '支払先マスタ');
  assert.equal(context.getCoreSchemaV1TableName('発送'), '発送');
  assert.equal(context.getCoreSchemaV1TableName('発送管理'), '発送');
  assert.equal(context.getCoreSchemaV1TableName('仕入れ'), '仕入れ');
  assert.equal(context.getCoreSchemaV1TableName('仕入れ管理'), '仕入れ');
  assert.equal(context.getCoreSchemaV1Table('LEGACY_INPUT').writeAllowed, false);
  assert.equal(context.getCoreSchemaV1Table('LEGACY_SALES').writeAllowed, false);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getCoreSchemaV1Table('ORDER_LINES').referenceIds)), [
    { headerKey: 'ORDER_ID', targetTableKey: 'ORDERS' },
    { headerKey: 'PRODUCT_ID', targetTableKey: 'PRODUCTS' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getCoreSchemaV1Table('LEADS').referenceIds)), [
    { headerKey: 'ASSIGNEE_ID', targetTableKey: 'STAFF' },
    { headerKey: 'LAST_RESPONDER_ID', targetTableKey: 'STAFF' },
    { headerKey: 'DUPLICATE_SOURCE_LEAD_ID', targetTableKey: 'LEADS' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getCoreSchemaV1Table('PRODUCTS').unmanagedReferenceIds)), [
    { headerKey: 'MAJOR_CATEGORY_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
    { headerKey: 'WORK_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
    { headerKey: 'MANUFACTURER_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
    { headerKey: 'PRODUCT_CATEGORY_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getCoreSchemaV1Table('STAFF').unmanagedReferenceIds)), [
    { headerKey: 'SOURCE_CANDIDATE_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' }
  ]);
}

{
  const context = createContext();
  vm.runInContext(configSource, context, { filename: '08_Config.js' });
  assert.equal(vm.runInContext('Object.keys(CONFIG.SHEETS).length > 0', context), true);
  vm.runInContext(source, context, { filename: '00_CoreSchemaRegistry.js' });
  const configSheets = vm.runInContext('JSON.parse(JSON.stringify(CONFIG.SHEETS))', context);
  assert.equal(configSheets.LEADS, 'リード管理');
  assert.equal(configSheets.CRM_PAYMENT, '支払先マスタ');
  assert.equal(configSheets.SHIPMENT, '発送');
  assert.equal(configSheets.PURCHASE, '仕入れ');
  assert.equal(configSheets.FORM_TOKENS, 'フォームトークン');
}

{
  const context = run();
  const shipmentHeaders = Object.keys(context.getCoreSchemaV1Table('SHIPMENTS').headers)
    .map(headerKey => context.getCoreSchemaV1HeaderName('SHIPMENTS', headerKey));
  const spreadsheet = { getSheetByName: name => name === '発送' ? createSheet(shipmentHeaders, 1) : null };
  const result = context.validateCoreSchemaV1TableForWrite(spreadsheet, 'SHIPMENTS');
  assert.equal(result.tableKey, 'SHIPMENTS');
  const headerIndexes = JSON.parse(JSON.stringify(result.headerIndexes));
  assert.equal(headerIndexes['発送ID'], 1);
  assert.equal(headerIndexes['オーダーID'], 2);
  assert.equal(headerIndexes['発送担当ID'], 17);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => null }, 'LEADS'), /CORE_SCHEMA_REQUIRED_TAB_MISSING/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['リードID', 'リードID', '担当者ID'], 1) }, 'LEADS'), /CORE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['リードID'], 1) }, 'LEADS'), /CORE_SCHEMA_REQUIRED_HEADER_MISSING/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['product_id']) }, 'PRODUCTS'), /CORE_SCHEMA_WRITE_NOT_ALLOWED/);
}

{
  const context = run();
  const leads = context.getCoreSchemaV1Table('LEADS');
  leads.headerRowNumber = 3;
  const leadHeaders = Object.keys(leads.headers).map(headerKey => leads.headers[headerKey]);
  const spreadsheet = { getSheetByName: name => name === 'リード管理' ? createSheet(leadHeaders, 3) : null };
  const result = context.validateCoreSchemaV1TableForWrite(spreadsheet, 'LEADS');
  assert.equal(result.tableKey, 'LEADS');
}

assert.equal(/setValue|setValues|appendRow|clear|deleteSheet|insertSheet|PropertiesService|UrlFetchApp/.test(source), false);
console.log('PASS: Core Schema V1 registry unit checks');
