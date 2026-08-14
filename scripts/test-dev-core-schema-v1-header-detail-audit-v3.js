const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/99_DevCoreSchemaV1HeaderDetailAuditV3.js', 'utf8');

function createSheet(headers, expectedHeaderRow) {
  return {
    getLastColumn: () => headers.length,
    getRange: (row, column, rows, columns) => {
      assert.equal(row, expectedHeaderRow);
      assert.equal(column, 1);
      assert.equal(rows, 1);
      assert.equal(columns, headers.length);
      return { getDisplayValues: () => [headers] };
    }
  };
}

function run(environment, sheets, getSpreadsheet) {
  let spreadsheetCalls = 0;
  const context = vm.createContext({
    Object, String, Array,
    getEnvironment: () => environment,
    getSpreadsheet: () => {
      spreadsheetCalls++;
      return getSpreadsheet || { getSheetByName: name => sheets[name] || null };
    }
  });
  vm.runInContext(source, context, { filename: '99_DevCoreSchemaV1HeaderDetailAuditV3.js' });
  return { context, getSpreadsheetCalls: () => spreadsheetCalls };
}

{
  const runtime = run('development', {
    'リード管理': createSheet(['リードID', '担当者ID'], 1),
    '請求書作成': createSheet(['説明', '', '説明'], 1),
    '📊売上データ': createSheet(['unused', '取引状況KEY', '取引状況商品名'], 4)
  });
  const result = runtime.context.auditDevCoreSchemaV1HeaderDetailV3();
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('[Array]'), false);
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(Array.isArray(result.schemaReportText), false);
  const reportLines = result.schemaReportText.split('\n');
  assert.equal(reportLines.length, 13);
  const lead = reportLines.find(line => line.includes('sheetName=リード管理'));
  assert.equal(lead.includes('headerColumns=1:リードID | 2:担当者ID'), true);
  assert.equal(lead.includes('requiredIdHeaderStatus=リードID:存在 | 担当者ID:存在'), true);
  const orders = reportLines.find(line => line.includes('sheetName=オーダー管理'));
  assert.equal(orders.includes('exists=false'), true);
  assert.equal(orders.includes('オーダーID:不在'), true);
  const shipment = reportLines.find(line => line.includes('sheetName=発送'));
  assert.equal(shipment.includes('発送ID:不在 | オーダーID:不在 | 発送担当ID:不在'), true);
  const legacyInput = reportLines.find(line => line.includes('LEGACY_INPUT'));
  assert.equal(legacyInput.includes('sheetName=請求書作成'), true);
  assert.equal(legacyInput.includes('説明:1,3'), true);
  assert.equal(legacyInput.includes('カテゴリ:不在'), true);
  const legacySales = reportLines.find(line => line.includes('LEGACY_SALES'));
  assert.equal(legacySales.includes('headerRowNumber=4'), true);
  assert.equal(legacySales.includes('headerColumns=1:unused | 2:取引状況KEY | 3:取引状況商品名'), true);
  assert.equal(legacySales.includes('取引状況KEY:存在'), true);
  assert.equal(legacySales.includes('取引状況数量:不在'), true);
  assert.equal(serialized.includes('CUSTOMER-'), false);
}

{
  const runtime = run('production', {});
  assert.throws(() => runtime.context.auditDevCoreSchemaV1HeaderDetailV3(), /development/);
  assert.equal(runtime.getSpreadsheetCalls(), 0);
}

assert.equal(/setValue|setValues|appendRow|clear|deleteSheet|insertSheet|PropertiesService|ScriptApp|UrlFetchApp/.test(source), false);
console.log('PASS: DEV Core Schema V1 header detail audit V3 unit checks');
