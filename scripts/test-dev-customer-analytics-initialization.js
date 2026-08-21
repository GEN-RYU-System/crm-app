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
    getSheetByName: name => options.missingSheet === name ? null : (sheets[name] || null),
    insertSheet: name => {
      if (options.failAtName === name) throw new Error('insert failure');
      const events = [];
      let headers = [];
      let dataRows = [];
      const sheet = {
        name,
        events,
        getLastRow: () => dataRows.length + 1 + (options.rowCountMismatch ? 1 : 0),
        getLastColumn: () => headers.length + (options.columnCountMismatch ? 1 : 0),
        getRange: row => ({
          getDisplayValues: () => [options.headerMismatch ? headers.concat('MISMATCH') : headers],
          getValues: () => {
            if (options.corruptAfterWrite && row === 2) {
              return dataRows.map(values => values.slice()).map((values, index) => {
                if (index === 0) values[0] = 'CORRUPTED';
                return values;
              });
            }
            if (options.dataMismatchEntries && row === 2 && (!options.dataMismatchSheet || options.dataMismatchSheet === name)) {
              const copy = dataRows.map(values => values.slice());
              options.dataMismatchEntries.forEach(entry => { copy[entry.row][entry.column] = entry.value; });
              return copy;
            }
            return dataRows;
          },
          setValues: values => {
            if ((row === 1 && options.failHeaderWrite) || (row === 2 && options.failDataWrite)) throw new Error('write failure');
            events.push({ type: 'setValues', values });
            if (row === 1) headers = values[0];
            if (row === 2) dataRows = values;
          },
          setNumberFormat: format => {
            if (options.failFormat) throw new Error('format failure');
            events.push({ type: 'setNumberFormat', format });
          }
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
    Utilities: { formatDate: (date, timeZone, format) => format === 'yyyy-MM-dd' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7) },
    getEnvironment: () => 'development',
    getSpreadsheet: () => spreadsheet,
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { flush: () => {} }
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

function installExpectedTables(context) {
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
}

function installExpectedTablesWithMonthlyDate(context) {
  const monthly = Array.from({ length: 69 }, () => Array(10).fill(''));
  monthly[0][1] = new Date('2026-02-01T00:00:00Z');
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer: Array.from({ length: 51 }, () => Array(12).fill('')),
    monthly,
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
}

function assertFailurePhase(result, phase) {
  assert.equal(result.resultType, 'INITIALIZATION_FAILED');
  assert.equal(result.failurePhase, phase);
  assert.equal(result.sourceDataChangeCount, 0);
  assert.equal(result.actualDataChangeCount, 0);
}

function assertPostWriteFailure(result, resultType) {
  assert.equal(result.resultType, resultType);
  assert.equal(result.failurePhase, 'INITIALIZATION_PHASE_POST_WRITE_VERIFY');
  assert.equal(result.sourceDataChangeCount, 0);
  assert.equal(result.actualDataChangeCount, 0);
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
  assert.ok(tables.monthly[0][1] instanceof Date);
  assert.equal(tables.monthly[0][1].toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(JSON.stringify(tables.customer[0].slice(1)), JSON.stringify([
    new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), 2, 30, 0, 0, 2, 30, 0, 0, 0
  ]));
  assert.equal(JSON.stringify(tables.customer[1].slice(1)), JSON.stringify(['', '', 1, 30, 1, 30, 0, 0, 0, 0, 1]));
  assert.equal(JSON.stringify(tables.monthly[0].slice(1)), JSON.stringify([new Date('2026-01-01T00:00:00Z'), 1, 20, 0, 0, 1, 20, 0, 0]));
  assert.equal(JSON.stringify(tables.product[0].slice(2)), JSON.stringify([2, 2, 0, 2, 0]));
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.createDevCustomerAnalyticsMaterializationSourceSnapshot = () => { throw new Error('snapshot failure'); };
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_SNAPSHOT');
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet, () => { throw new Error('audit failure'); });
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_AUDIT');
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  context.buildDevCustomerAnalyticsInitializationTables = () => { throw new Error('table failure'); };
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_TABLE_BUILD');
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const originalSnapshot = context.createDevCustomerAnalyticsMaterializationSourceSnapshot;
  let calls = 0;
  context.createDevCustomerAnalyticsMaterializationSourceSnapshot = ss => {
    calls++;
    if (calls === 2) throw new Error('source recheck failure');
    return originalSnapshot(ss);
  };
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_SOURCE_RECHECK');
  assert.equal(spreadsheet.created.length, 0);
}

{
  const spreadsheet = createSpreadsheet({ failAtName: '顧客分析' });
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_SHEET_CREATE');
  assert.deepEqual(spreadsheet.deleted, []);
}

{
  const spreadsheet = createSpreadsheet({ failHeaderWrite: true });
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_HEADER_WRITE');
  assert.deepEqual(spreadsheet.deleted, ['顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({ failDataWrite: true });
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_DATA_WRITE');
  assert.deepEqual(spreadsheet.deleted, ['顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({ failFormat: true });
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertFailurePhase(result, 'INITIALIZATION_PHASE_FORMAT');
  assert.deepEqual(spreadsheet.deleted, ['顧客分析']);
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
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_DATA_MISMATCH');
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({
    dataMismatchEntries: [
      { row: 0, column: 0, value: new Date('2026-03-01T00:00:00Z') },
      { row: 0, column: 1, value: 999 },
      { row: 0, column: 2, value: 'ACTUAL_TEXT' },
      { row: 0, column: 3, value: '' }
    ]
  });
  const { context } = run(spreadsheet);
  const customer = Array.from({ length: 51 }, () => Array(12).fill(''));
  customer[0][0] = new Date('2026-02-01T00:00:00Z');
  customer[0][1] = 100;
  customer[0][2] = 'EXPECTED_TEXT';
  customer[0][3] = 'EXPECTED_NONBLANK';
  context.buildDevCustomerAnalyticsInitializationTables = () => ({
    customer,
    monthly: Array.from({ length: 69 }, () => Array(10).fill('')),
    product: Array.from({ length: 262 }, () => Array(7).fill(''))
  });
  context.hasDevCustomerAnalyticsInitializationOutputInvariants = () => true;
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_DATA_MISMATCH');
  assert.equal(result.verificationSheetName, '顧客分析');
  assert.equal(result.mismatchCellCount, 4);
  assert.deepEqual(Array.from(result.mismatchColumnHeaders), ['顧客ID', '初回受注日', '初回取引完了日', '累計総受注数']);
  assert.deepEqual(JSON.parse(JSON.stringify(result.mismatchValueTypeSummary)), { DATE: 1, NUMBER: 1, TEXT: 1, BLANK: 1 });
  assert.equal(JSON.stringify(result).includes('ACTUAL_TEXT'), false);
  assert.equal(JSON.stringify(result).includes('EXPECTED_TEXT'), false);
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({
    dataMismatchSheet: '顧客月次分析',
    dataMismatchEntries: [{ row: 0, column: 1, value: new Date('2026-02-01T00:00:00Z') }]
  });
  const { context } = run(spreadsheet);
  installExpectedTablesWithMonthlyDate(context);
  const result = context.initializeDevCustomerAnalytics();
  assert.equal(result.resultType, 'INITIALIZATION_SUCCEEDED');
  const monthlyFormatEvents = spreadsheet.created[1].events.filter(event => event.type === 'setNumberFormat');
  assert.equal(monthlyFormatEvents.length, 1);
  assert.equal(monthlyFormatEvents[0].format, 'yyyy-MM');
}

{
  const spreadsheet = createSpreadsheet({
    dataMismatchSheet: '顧客月次分析',
    dataMismatchEntries: [{ row: 0, column: 1, value: new Date('2026-02-28T00:00:00Z') }]
  });
  const { context } = run(spreadsheet);
  installExpectedTablesWithMonthlyDate(context);
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_DATA_MISMATCH');
  assert.equal(result.verificationSheetName, '顧客月次分析');
  assert.equal(result.mismatchCellCount, 1);
  assert.deepEqual(Array.from(result.mismatchColumnHeaders), ['受注年月']);
  assert.deepEqual(JSON.parse(JSON.stringify(result.mismatchValueTypeSummary)), { DATE: 1, NUMBER: 0, TEXT: 0, BLANK: 0 });
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({
    dataMismatchSheet: '顧客月次分析',
    dataMismatchEntries: [{ row: 0, column: 1, value: new Date('2026-03-01T00:00:00Z') }]
  });
  const { context } = run(spreadsheet);
  installExpectedTablesWithMonthlyDate(context);
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_DATA_MISMATCH');
  assert.equal(result.verificationSheetName, '顧客月次分析');
  assert.equal(result.mismatchCellCount, 1);
  assert.deepEqual(Array.from(result.mismatchColumnHeaders), ['受注年月']);
  assert.deepEqual(JSON.parse(JSON.stringify(result.mismatchValueTypeSummary)), { DATE: 1, NUMBER: 0, TEXT: 0, BLANK: 0 });
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

{
  const spreadsheet = createSpreadsheet({
    dataMismatchSheet: '顧客月次分析',
    dataMismatchEntries: [{ row: 0, column: 1, value: 'NOT_A_DATE' }]
  });
  const { context } = run(spreadsheet);
  installExpectedTablesWithMonthlyDate(context);
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_DATA_MISMATCH');
  assert.equal(result.verificationSheetName, '顧客月次分析');
  assert.equal(result.mismatchCellCount, 1);
  assert.deepEqual(Array.from(result.mismatchColumnHeaders), ['受注年月']);
  assert.deepEqual(JSON.parse(JSON.stringify(result.mismatchValueTypeSummary)), { DATE: 0, NUMBER: 0, TEXT: 1, BLANK: 0 });
  assert.equal(JSON.stringify(result).includes('NOT_A_DATE'), false);
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

[
  ['INITIALIZATION_POST_WRITE_SHEET_MISSING', { missingSheet: '顧客月次分析' }],
  ['INITIALIZATION_POST_WRITE_ROW_COUNT_MISMATCH', { rowCountMismatch: true }],
  ['INITIALIZATION_POST_WRITE_COLUMN_COUNT_MISMATCH', { columnCountMismatch: true }],
  ['INITIALIZATION_POST_WRITE_HEADER_MISMATCH', { headerMismatch: true }]
].forEach(([resultType, options]) => {
  const spreadsheet = createSpreadsheet(options);
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, resultType);
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
});

{
  const spreadsheet = createSpreadsheet();
  const { context } = run(spreadsheet);
  installExpectedTables(context);
  context.SpreadsheetApp.flush = () => { throw new Error('flush failure'); };
  const result = context.initializeDevCustomerAnalytics();
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_VERIFY_EXCEPTION');
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
  assert.equal(result.failurePhase, 'INITIALIZATION_PHASE_ROLLBACK');
  assert.equal(result.sourceDataChangeCount, 0);
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
  assertPostWriteFailure(result, 'INITIALIZATION_POST_WRITE_VERIFY_EXCEPTION');
  assert.deepEqual(spreadsheet.deleted, ['顧客購入商品分析', '顧客月次分析', '顧客分析']);
}

console.log('PASS: DEV customer analytics initialization unit checks');
