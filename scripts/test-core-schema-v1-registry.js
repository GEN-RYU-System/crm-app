const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/00_CoreSchemaRegistry.js', 'utf8');
const configSource = fs.readFileSync('src/08_Config.js', 'utf8');

function createSheet(headers) {
  return {
    getLastColumn: () => headers.length,
    getRange: () => ({ getDisplayValues: () => [headers] })
  };
}

function run() {
  const context = vm.createContext({ Object, String, Array, Set, Boolean });
  vm.runInContext(source, context, { filename: '00_CoreSchemaRegistry.js' });
  return context;
}

{
  const context = run();
  const expectedTables = {
    LEADS: ['リードID', '担当者ID'],
    CUSTOMERS: ['顧客ID', '源流リードID'],
    SHIPPING_DESTINATIONS: ['配送先ID', '顧客ID'],
    PAYMENT_DESTINATIONS: ['支払先ID', '顧客ID'],
    ORDERS: ['オーダーID', '顧客ID', '配送先ID', '支払先ID', '源流リードID', '受注担当ID', '営業担当ID', '発送担当ID'],
    ORDER_LINES: ['明細ID', 'オーダーID', '商品ID'],
    SHIPMENTS: ['発送ID', 'オーダーID', '発送担当ID'],
    PURCHASES: ['仕入れID', 'オーダーID', '仕入れ担当ID'],
    FORM_TOKENS: ['トークン', 'リードID'],
    PRODUCTS: ['product_id'],
    STAFF: ['担当者ID']
  };
  const tableKeys = vm.runInContext('Object.keys(CORE_SCHEMA_V1_TABLES)', context);
  assert.deepEqual(Array.from(tableKeys).slice(0, 11), Object.keys(expectedTables));
  Object.keys(expectedTables).forEach(tableKey => {
    const table = context.getCoreSchemaV1Table(tableKey);
    assert.deepEqual(Array.from(Object.keys(table.headers).map(key => table.headers[key])), expectedTables[tableKey]);
    assert.equal(Boolean(table.primaryKey), true);
  });
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
}

{
  const context = run();
  vm.runInContext(configSource, context, { filename: '08_Config.js' });
  const configSheets = vm.runInContext('JSON.parse(JSON.stringify(CONFIG.SHEETS))', context);
  assert.equal(configSheets.LEADS, 'リード管理');
  assert.equal(configSheets.CRM_PAYMENT, '支払先マスタ');
  assert.equal(configSheets.SHIPMENT, '発送');
  assert.equal(configSheets.PURCHASE, '仕入れ');
  assert.equal(configSheets.FORM_TOKENS, 'フォームトークン');
}

{
  const context = run();
  const spreadsheet = { getSheetByName: name => name === '発送' ? createSheet(['発送ID', 'オーダーID', '発送担当ID']) : null };
  const result = context.validateCoreSchemaV1TableForWrite(spreadsheet, 'SHIPMENTS');
  assert.equal(result.tableKey, 'SHIPMENTS');
  assert.deepEqual(JSON.parse(JSON.stringify(result.headerIndexes)), { '発送ID': 1, 'オーダーID': 2, '発送担当ID': 3 });
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => null }, 'LEADS'), /CORE_SCHEMA_REQUIRED_TAB_MISSING/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['リードID', 'リードID', '担当者ID']) }, 'LEADS'), /CORE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['リードID']) }, 'LEADS'), /CORE_SCHEMA_REQUIRED_HEADER_MISSING/);
  assert.throws(() => context.validateCoreSchemaV1TableForWrite({ getSheetByName: () => createSheet(['product_id']) }, 'PRODUCTS'), /CORE_SCHEMA_WRITE_NOT_ALLOWED/);
}

assert.equal(/setValue|setValues|appendRow|clear|deleteSheet|insertSheet|PropertiesService|UrlFetchApp/.test(source), false);
console.log('PASS: Core Schema V1 registry unit checks');
