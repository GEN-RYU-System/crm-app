const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/99_DevOrderRealityAudit.js', 'utf8');

function createSheet(headers, rows, formulas) {
  return {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : { getValues: () => rows, getFormulas: () => formulas || rows.map(values => values.map(() => '')) }
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({ Set, String, Object }, overrides));
  vm.runInContext(source, context, { filename: '99_DevOrderRealityAudit.js' });
  return context;
}

function spreadsheet() {
  const sheets = {
    'オーダー管理': createSheet(
      ['オーダーID', 'ステータス', '受注日', '請求書番号', '請求書リンク', '請求書発行日', '支払確認日', '発送日'], [
        ['ORDER-A', '受注', '', 'INV-A', 'LINK-A', 'DATE-A', 'PAID-A', 'SHIPPED-A'],
        ['ORDER-B', 'キャンセル', '', '', '', '', '', ''],
        ['ORDER-C', 'UNKNOWN_STATUS', 'DATE-C', 'INV-C', '', '', 'PAID-C', ''],
        ['', '完了', '', 'INV-D', 'LINK-D', 'DATE-D', 'PAID-D', 'SHIPPED-D']
      ]
    ),
    '発送': createSheet(['オーダーID', '発送日'], [
      ['ORDER-A', 'SHIP-DATE-A'], ['ORDER-B', ''], ['UNKNOWN-ORDER', 'SHIP-DATE-X']
    ]),
    '仕入れ': createSheet(['オーダーID'], [['ORDER-A'], ['ORDER-C'], ['']])
  };
  return { getSheetByName: name => sheets[name] || null };
}

{
  let opened = false;
  const context = run({ getEnvironment: () => 'production', getSpreadsheet: () => { opened = true; } });
  assert.throws(() => context.auditDevOrderReality(), /development/);
  assert.equal(opened, false);
}

{
  const context = run({ getEnvironment: () => 'development', getSpreadsheet: spreadsheet });
  const result = JSON.parse(JSON.stringify(context.auditDevOrderReality()));
  assert.equal(result.success, true);
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(result.blankOrderDateEvidence, {
    blankOrderDateOrderCount: 2,
    invoiceNumberPresentCount: 1, invoiceLinkPresentCount: 1, invoiceIssueDatePresentCount: 1,
    paymentConfirmedDatePresentCount: 1, shipmentRecordPresentCount: 2, shipmentDatePresentCount: 1,
    purchaseRecordPresentCount: 1,
    evidenceCombinationCounts: {
      'invoiceNumberPresent|invoiceLinkPresent|invoiceIssueDatePresent|paymentConfirmedDatePresent|shipmentRecordPresent|shipmentDatePresent|purchaseRecordPresent': 1,
      shipmentRecordPresent: 1
    }
  });
  assert.deepEqual(result.allOrderStatusAndEvidence, {
    orderRecordCount: 3, orderReceivedCount: 1, processingCount: 0, shippedCount: 0,
    completedCount: 0, cancelledCount: 1, emptyStatusCount: 0, otherStatusCount: 1,
    paymentConfirmedDatePresentCount: 2, shipmentRecordPresentCount: 2,
    shipmentDatePresentCount: 1, purchaseRecordPresentCount: 2,
    evidenceCombinationCounts: {
      'paymentConfirmedDatePresent|shipmentRecordPresent|shipmentDatePresent|purchaseRecordPresent': 1,
      shipmentRecordPresent: 1,
      'paymentConfirmedDatePresent|purchaseRecordPresent': 1
    }
  });
  const serialized = JSON.stringify(result);
  ['ORDER-A', 'INV-A', 'LINK-A', 'DATE-A', 'PAID-A', 'UNKNOWN_STATUS'].forEach(value => {
    assert.equal(serialized.includes(value), false);
  });
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => ({ getSheetByName: () => createSheet(['オーダーID'], []) })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevOrderReality())), {
    success: false,
    resultType: 'ORDER_REALITY_AUDIT_SCHEMA_INVALID',
    auditVersion: '1',
    actualDataChangeCount: 0
  });
}

['setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV order reality audit unit checks');
