const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const dryRunSource = fs.readFileSync('src/99_DevCustomerAnalyticsMaterializationDryRun.js', 'utf8');
const initializationSource = fs.readFileSync('src/99_DevCustomerAnalyticsInitialization.js', 'utf8');

function createSourceSheet(headers, rows) {
  return {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: row => row === 1
      ? { getDisplayValues: () => [headers] }
      : { getValues: () => rows }
  };
}

function createSpreadsheet(options = {}) {
  const sheets = {
    '顧客マスタ': createSourceSheet(['顧客ID'], [['CUSTOMER-A'], ['CUSTOMER-B']]),
    'オーダー管理': createSourceSheet(
      ['オーダーID', '顧客ID', 'ステータス', '受注日', '請求総額'], [
        ['ORDER-1', 'CUSTOMER-A', '完了', new Date('2026-02-01T00:00:00Z'), 10],
        ['ORDER-2', 'CUSTOMER-A', '完了', new Date('2026-01-01T00:00:00Z'), 20],
        ['ORDER-3', 'CUSTOMER-B', 'キャンセル', '', 30]
      ]
    ),
    'オーダー明細': createSourceSheet(['オーダーID', '商品ID'], [
      ['ORDER-1', 'PRODUCT-A'], ['ORDER-2', 'PRODUCT-A'], ['ORDER-3', 'PRODUCT-B']
    ]),
    '商品マスタ同期': createSourceSheet(['product_id'], [['PRODUCT-A'], ['PRODUCT-B']])
  };
  const created = [];
  const deleted = [];
  return {
    created,
    deleted,
    getSpreadsheetTimeZone: () => 'Asia/Tokyo',
    getSheetByName: name => sheets[name] || null,
    insertSheet: name => {
      if (options.failAtName === name) throw new Error('insert failure');
      const events = [];
      let headers = [];
      let dataRows = [];
      const sheet = {
        name,
        events,
        getLastRow: () => dataRows.length + 1,
        getLastColumn: () => headers.length,
        getRange: row => ({
          getDisplayValues: () => [headers],
          getValues: () => options.corruptAfterWrite && row === 2
            ? dataRows.map(values => values.slice()).map((values, index) => index === 0 ? values.concat('CORRUPTED') : values)
            : dataRows,
          setValues: values => {
            events.push({ type: 'setValues', values });
            if (row === 1) headers = values[0];
            if (row === 2) dataRows = values;
          },
          setNumberFormat: format => { events.push({ type: 'setNumberFormat', format }); }
        })
      };
      sheets[name] = sheet;
      created.push(sheet);
      return sheet;
    },
    deleteSheet: sheet => {
      if (options.deleteFails) throw new Error('delete failure');
      deleted.push(sheet.name);
      delete sheets[sheet.name];
    }
  };
}

function run(spreadsheet, auditOverride) {
  const lock = { released: false, tryLock: () => true, releaseLock: () => { lock.released = true; } };
  const context = vm.createContext({
    Date, Number, Object, String, Array, Set, isFinite, isNaN,
    Utilities: { formatDate: date => date.toISOString().slice(0, 7) },
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => lock }
  });
  vm.runInContext(dryRunSource, context, { filename: '99_DevCustomerAnalyticsMaterializationDryRun.js' });
  vm.runInContext(initializationSource, context, { filename: '99_DevCustomerAnalyticsInitialization.js' });
  context.buildDevCustomerAnalyticsMaterializationDryRunFromSnapshot = auditOverride || (() => ({
    success: true,
    customerAnalyticsRowCount: 51,
    customerMonthlyAnalyticsRowCount: 69,
    customerProductAnalyticsRowCount: 262,
    orderDateEmptyCount: 8,
    totalOrderAmount: 80139404.5,
    cancelledOrderAmount: 28776519,
    completedOrderAmount: 47155185.5,
    unconfirmedOrderAmount: 4207700
  }));
  return { context, lock };
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  const tables = context.buildDevCustomerAnalyticsInitializationTables(
    context.createDevCustomerAnalyticsMaterializationSourceSnapshot(spreadsheet)
  );
  assert.ok(tables.customer[0][1] instanceof Date);
  assert.equal(tables.customer[0][1].toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(tables.customer[0][2].toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(tables.customer[1][1], '');
  assert.equal(tables.customer[1][2], '');
  assert.equal(tables.monthly.length, 2);
  assert.equal(JSON.stringify(tables.customer[0].slice(1)), JSON.stringify([
    new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), 2, 30, 0, 0, 2, 30, 0, 0, 0
  ]));
  assert.equal(JSON.stringify(tables.customer[1].slice(1)), JSON.stringify(['', '', 1, 30, 1, 30, 0, 0, 0, 0, 1]));
  assert.equal(JSON.stringify(tables.monthly[0].slice(1)), JSON.stringify(['2026-01', 1, 20, 0, 0, 1, 20, 0, 0]));
  assert.equal(JSON.stringify(tables.product[0].slice(2)), JSON.stringify([2, 2, 0, 2, 0]));
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill(0)),
    monthly: Array.from({ length: 69 }, () => Array(10).fill(0)),
    product: Array.from({ length: 262 }, () => Array(7).fill(0))
  });
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_OUTPUT_INVARIANT_MISMATCH');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet();
  const { context, lock } = run(spreadsheet);
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_TABLE_COUNT_MISMATCH');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.created.length, 0);
  assert.equal(lock.released, true);
}

{
  const spreadsheet = createSpreadsheet({ corruptAfterWrite: true });
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_FAILED');
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_SUCCEEDED');
  assert.equal(spreadsheet.created.length, 3);
  assert.equal(spreadsheet.created[0].events.filter(event => event.type === 'setNumberFormat').length, 2);
  assert.equal(result.sourceDataChangeCount, 0);
  assert.equal(result.analyticsSheetCreateCount, 3);
  assert.equal(result.analyticsDataRowWriteCount, 382);
  assert.equal(result.analyticsHeaderRowWriteCount, 3);
}

{
  const spreadsheet = createSpreadsheet();
  spreadsheet.insertSheet('顧客分析');
  const { context } = run(spreadsheet);
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_TARGET_EXISTS');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.created.length, 1);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet, () => ({ success: false }));
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_EXPECTATION_MISMATCH');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const originalSnapshot = context.createDevCustomerAnalyticsMaterializationSourceSnapshot;
  let callCount = 0;
  context.createDevCustomerAnalyticsMaterializationSourceSnapshot = ss => {
    const snapshot = originalSnapshot(ss);
    callCount++;
    if (callCount === 2) snapshot.data.orders.sourceRequiredValues[0][0] = 'CHANGED';
    return snapshot;
  };
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_SOURCE_CHANGED');
  assert.equal(result.actualDataChangeCount, 0);
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet({ failAtName: '顧客月次分析' });
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_FAILED');
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(spreadsheet.deleted, ['顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({ failAtName: '顧客月次分析', deleteFails: true });
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_ROLLBACK_STATE_UNKNOWN');
  assert.equal(result.actualDataChangeCount, null);
  assert.equal(result.dataChangeState, 'UNKNOWN');
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  context.verifyDevCustomerAnalyticsInitializationSheets = () => {
    throw new Error('verification failure');
  };
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_FAILED');
  assert.equal(result.actualDataChangeCount, 0);
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

console.log('PASS: DEV customer analytics initialization unit checks');
