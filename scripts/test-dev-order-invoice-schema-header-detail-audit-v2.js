const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevOrderInvoiceSchemaHeaderDetailAuditV2.js', 'utf8');

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
  vm.runInContext(source, context, { filename: '99_DevOrderInvoiceSchemaHeaderDetailAuditV2.js' });
  return context;
}

{
  const context = run('development', {
    '顧客マスタ': createSheet(['顧客ID', '源流リードID']),
    '請求書作成': createSheet(['説明', '', '説明'])
  });
  const result = context.auditDevOrderInvoiceSchemaHeaderDetailV2();
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('[Array]'), false);
  assert.equal(result.actualDataChangeCount, 0);
  const customer = result.sheets.find(sheet => sheet.sheetName === '顧客マスタ');
  assert.equal(customer.headerColumns, '1:顧客ID | 2:源流リードID');
  assert.equal(customer.requiredHeaderStatus, '顧客ID:存在 | 源流リードID:存在');
  const invoiceInput = result.sheets.find(sheet => sheet.sheetName === '請求書作成');
  assert.equal(invoiceInput.nonEmptyHeaderDuplicates, '説明:1,3');
  const missing = result.sheets.find(sheet => sheet.sheetName === '請求書管理');
  assert.equal(missing, undefined);
  const order = result.sheets.find(sheet => sheet.sheetName === 'オーダー管理');
  assert.equal(order.exists, false);
  assert.equal(order.requiredHeaderStatus, 'オーダーID:不在 | 請求書番号:不在 | 顧客ID:不在 | 配送先ID:不在 | 支払先ID:不在 | 源流リードID:不在');
  assert.equal(serialized.includes('CUSTOMER-'), false);
}

{
  const context = run('production', {});
  assert.throws(() => context.auditDevOrderInvoiceSchemaHeaderDetailV2(), /development/);
}

assert.equal(/setValue|setValues|appendRow|clear|deleteSheet|insertSheet|PropertiesService|ScriptApp|UrlFetchApp/.test(source), false);
console.log('PASS: DEV order invoice schema header detail audit V2 unit checks');
