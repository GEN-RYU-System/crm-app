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
  const context = vm.createContext(Object.assign({ Date, Number, Object, Set, String, isNaN }, overrides));
  vm.runInContext(source, context, { filename: '99_DevOrderRealityAudit.js' });
  return context;
}

function spreadsheet() {
  const sheets = {
    'オーダー管理': createSheet(
        ['オーダーID', 'ステータス', '受注日', '請求書番号', '請求書リンク', '請求書発行日', '支払確認日', '発送日'], [
        ['ORDER-A', '受注', '', 'INV-A', 'LINK-A', new Date('2026-01-01'), new Date('2026-01-02'), new Date('2026-01-03')],
        ['ORDER-B', 'キャンセル', '', '', '', '', '', ''],
        ['ORDER-C', 'UNKNOWN_STATUS', new Date('2026-01-04'), 'INV-C', '', '', new Date('2026-01-05'), 'INVALID-DATE'],
        ['', '完了', '', 'INV-D', 'LINK-D', new Date('2026-01-06'), new Date('2026-01-07'), new Date('2026-01-08')]
      ]
    ),
    '発送': createSheet(['オーダーID', '発送日'], [
      ['ORDER-A', new Date('2026-01-09')], ['ORDER-B', 'INVALID-SHIPMENT-DATE'], ['UNKNOWN-ORDER', new Date('2026-01-10')]
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
    invoiceIssueDateValidCount: 1, invoiceIssueDateEmptyCount: 1, invoiceIssueDateInvalidCount: 0,
    paymentConfirmedDateValidCount: 1, paymentConfirmedDateEmptyCount: 1, paymentConfirmedDateInvalidCount: 0,
    orderShippingDateValidCount: 1, orderShippingDateEmptyCount: 1, orderShippingDateInvalidCount: 0,
    shipmentDateValidCount: 1, shipmentDateEmptyCount: 0, shipmentDateInvalidCount: 1,
    invoiceNumberRecordedCount: 1, invoiceLinkRecordedCount: 1,
    shipmentRecordPresentCount: 2,
    purchaseRecordPresentCount: 1,
    evidenceCombinationCounts: {
      'invoiceNumberRecorded|invoiceLinkRecorded|invoiceIssueDateValid|paymentConfirmedDateValid|orderShippingDateValid|shipmentRecordPresent|shipmentDateValid|purchaseRecordPresent': 1,
      shipmentRecordPresent: 1
    }
  });
  assert.deepEqual(result.allOrderStatusAndEvidence, {
    orderRecordCount: 3, orderReceivedCount: 1, processingCount: 0, shippedCount: 0,
    completedCount: 0, cancelledCount: 1, emptyStatusCount: 0, otherStatusCount: 1,
    invoiceIssueDateValidCount: 1, invoiceIssueDateEmptyCount: 2, invoiceIssueDateInvalidCount: 0,
    paymentConfirmedDateValidCount: 2, paymentConfirmedDateEmptyCount: 1, paymentConfirmedDateInvalidCount: 0,
    orderShippingDateValidCount: 1, orderShippingDateEmptyCount: 1, orderShippingDateInvalidCount: 1,
    shipmentDateValidCount: 1, shipmentDateEmptyCount: 1, shipmentDateInvalidCount: 1,
    invoiceNumberRecordedCount: 2, invoiceLinkRecordedCount: 1, shipmentRecordPresentCount: 2,
    purchaseRecordPresentCount: 2,
    evidenceCombinationCounts: {
      'invoiceNumberRecorded|invoiceLinkRecorded|invoiceIssueDateValid|paymentConfirmedDateValid|orderShippingDateValid|shipmentRecordPresent|shipmentDateValid|purchaseRecordPresent': 1,
      shipmentRecordPresent: 1,
      'invoiceNumberRecorded|paymentConfirmedDateValid|purchaseRecordPresent': 1
    }
  });
  const serialized = JSON.stringify(result);
  ['ORDER-A', 'INV-A', 'LINK-A', 'INVALID-DATE', 'INVALID-SHIPMENT-DATE', 'UNKNOWN_STATUS'].forEach(value => {
    assert.equal(serialized.includes(value), false);
  });
  assert.equal(context.getDevOrderRealityDateState('2026/02/30'), 'invalid');
  assert.equal(context.getDevOrderRealityDateState('2026/02/28'), 'valid');
}

{
  const context = run({
    getEnvironment: () => 'development',
    getSpreadsheet: () => ({ getSheetByName: () => createSheet(['オーダーID'], []) })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.auditDevOrderReality())), {
    success: false,
    resultType: 'ORDER_REALITY_AUDIT_SCHEMA_INVALID',
    auditVersion: '2',
    actualDataChangeCount: 0
  });
}

['setValue', 'setValues', 'appendRow', 'clear', 'deleteRow', 'insertSheet', 'PropertiesService', 'ScriptApp', 'UrlFetchApp', 'Logger.', 'console.'].forEach(token => {
  assert.equal(source.includes(token), false, token + ' must not be used');
});

console.log('PASS: DEV order reality audit unit checks');
