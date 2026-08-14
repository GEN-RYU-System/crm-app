const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevOrderInvoiceSchemaAudit.js', 'utf8');

function createSheet(headers) {
  return {
    getLastColumn: () => headers.length,
    getRange: () => ({ getDisplayValues: () => [headers] })
  };
}

function run(environment, sheets) {
  const context = vm.createContext({
    Object, String, Array,
    getEnvironment: () => environment,
    getSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null })
  });
  vm.runInContext(source, context, { filename: '99_DevOrderInvoiceSchemaAudit.js' });
  return context;
}

{
  const context = run('development', {
    '顧客マスタ': createSheet(['顧客ID', '源流リードID']),
    '配送先マスタ': createSheet(['配送先ID', '顧客ID', '顧客ID']),
    'オーダー管理': createSheet(['オーダーID', '請求書番号', '顧客ID', '配送先ID', '支払先ID', '源流リードID'])
  });
  const result = context.auditDevOrderInvoiceSchema();
  assert.equal(result.success, true);
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(result.sheets.length, 11);
  const customer = result.sheets.find(sheet => sheet.sheetName === '顧客マスタ');
  assert.deepEqual(JSON.parse(JSON.stringify(customer.requiredHeaders)), [
    { headerName: '顧客ID', exists: true }, { headerName: '源流リードID', exists: true }
  ]);
  const shipping = result.sheets.find(sheet => sheet.sheetName === '配送先マスタ');
  assert.equal(shipping.nonEmptyHeaderDuplicateCount, 1);
  const missing = result.sheets.find(sheet => sheet.sheetName === '請求書管理');
  assert.equal(missing.exists, false);
  assert.equal(missing.columnCount, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(missing.headers)), []);
}

{
  const context = run('production', {});
  assert.throws(() => context.auditDevOrderInvoiceSchema(), /development/);
}

assert.equal(/setValue|setValues|appendRow|clear|deleteSheet|insertSheet|PropertiesService|ScriptApp|UrlFetchApp/.test(source), false);
console.log('PASS: DEV order invoice schema audit unit checks');
