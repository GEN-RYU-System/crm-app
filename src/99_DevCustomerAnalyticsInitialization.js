const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS = ['顧客分析', '顧客月次分析', '顧客購入商品分析'];
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED = {
  customerAnalyticsRowCount: 51, customerMonthlyAnalyticsRowCount: 69, customerProductAnalyticsRowCount: 262,
  orderDateEmptyCount: 8, totalOrderAmount: 80139404.5, cancelledOrderAmount: 28776519,
  completedOrderAmount: 47155185.5, unconfirmedOrderAmount: 4207700
};
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_DATA_ROW_WRITE_COUNT = 382;
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_HEADER_ROW_WRITE_COUNT = 3;
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SNAPSHOT = 'INITIALIZATION_PHASE_SNAPSHOT';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_AUDIT = 'INITIALIZATION_PHASE_AUDIT';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_TABLE_BUILD = 'INITIALIZATION_PHASE_TABLE_BUILD';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SOURCE_RECHECK = 'INITIALIZATION_PHASE_SOURCE_RECHECK';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SHEET_CREATE = 'INITIALIZATION_PHASE_SHEET_CREATE';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_HEADER_WRITE = 'INITIALIZATION_PHASE_HEADER_WRITE';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_DATA_WRITE = 'INITIALIZATION_PHASE_DATA_WRITE';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_FORMAT = 'INITIALIZATION_PHASE_FORMAT';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_POST_WRITE_VERIFY = 'INITIALIZATION_PHASE_POST_WRITE_VERIFY';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_ROLLBACK = 'INITIALIZATION_PHASE_ROLLBACK';
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_OUTPUT_EXPECTED = {
  totalOrderCount: 172, cancelledOrderCount: 52, completedOrderCount: 115, unconfirmedOrderCount: 5,
  totalOrderAmount: 80139404.5, cancelledOrderAmount: 28776519,
  completedOrderAmount: 47155185.5, unconfirmedOrderAmount: 4207700,
  monthlyOrderCount: 164, productLineCount: 575
};

function initializeDevCustomerAnalytics() {
  if (getEnvironment() !== 'development') throw new Error('initializeDevCustomerAnalytics is available only in development');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return createDevCustomerAnalyticsInitializationFailure(
    'INITIALIZATION_LOCK_UNAVAILABLE', DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SNAPSHOT
  );
  const created = [];
  let ss;
  let failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SNAPSHOT;
  try {
    ss = getSpreadsheet();
    if (DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS.some(name => ss.getSheetByName(name))) {
      return createDevCustomerAnalyticsInitializationFailure('INITIALIZATION_TARGET_EXISTS', failurePhase);
    }

    // Audit and table materialization consume exactly the same in-memory source snapshot.
    const sourceSnapshot = createDevCustomerAnalyticsMaterializationSourceSnapshot(ss);
    failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_AUDIT;
    const audit = buildDevCustomerAnalyticsMaterializationDryRunFromSnapshot(sourceSnapshot);
    if (!audit.success || !Object.keys(DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED).every(key => audit[key] === DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED[key])) {
      return createDevCustomerAnalyticsInitializationFailure('INITIALIZATION_EXPECTATION_MISMATCH', failurePhase);
    }
    failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_TABLE_BUILD;
    const tables = buildDevCustomerAnalyticsInitializationTables(sourceSnapshot);
    if (tables.customer.length !== 51 || tables.monthly.length !== 69 || tables.product.length !== 262) {
      return createDevCustomerAnalyticsInitializationFailure('INITIALIZATION_TABLE_COUNT_MISMATCH', failurePhase);
    }
    if (!hasDevCustomerAnalyticsInitializationOutputInvariants(tables)) {
      return createDevCustomerAnalyticsInitializationFailure('INITIALIZATION_OUTPUT_INVARIANT_MISMATCH', failurePhase);
    }

    // Re-read immediately before the first insert. Any source change means zero analytics writes.
    failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SOURCE_RECHECK;
    if (!isDevCustomerAnalyticsMaterializationSourceSnapshotUnchanged(
      sourceSnapshot,
      createDevCustomerAnalyticsMaterializationSourceSnapshot(ss)
    )) {
      return createDevCustomerAnalyticsInitializationFailure('INITIALIZATION_SOURCE_CHANGED', failurePhase);
    }

    const specifications = getDevCustomerAnalyticsInitializationSpecifications(tables);
    specifications.forEach(spec => {
      failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_SHEET_CREATE;
      const sh = ss.insertSheet(spec.name);
      created.push(sh);
      failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_HEADER_WRITE;
      sh.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]);
      failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_DATA_WRITE;
      sh.getRange(2, 1, spec.rows.length, spec.headers.length).setValues(spec.rows);
      failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_FORMAT;
      spec.dateColumns.forEach(column => sh.getRange(2, column, spec.rows.length, 1).setNumberFormat('yyyy-MM-dd'));
    });
    failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_POST_WRITE_VERIFY;
    const postWriteResultType = verifyDevCustomerAnalyticsInitializationAfterFlush(ss, specifications);
    if (postWriteResultType) throw createDevCustomerAnalyticsInitializationPostWriteError(postWriteResultType);

    // actualDataChangeCount means analytics output row writes only (header + data), never source CRM changes.
    return {
      success: true,
      resultType: 'INITIALIZATION_SUCCEEDED',
      sourceDataChangeCount: 0,
      analyticsSheetCreateCount: 3,
      analyticsDataRowWriteCount: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_DATA_ROW_WRITE_COUNT,
      analyticsHeaderRowWriteCount: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_HEADER_ROW_WRITE_COUNT,
      actualDataChangeCount: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_DATA_ROW_WRITE_COUNT + DEV_CUSTOMER_ANALYTICS_INITIALIZATION_HEADER_ROW_WRITE_COUNT,
      customerAnalyticsRowCount: 51,
      customerMonthlyAnalyticsRowCount: 69,
      customerProductAnalyticsRowCount: 262
    };
  } catch (e) {
    const originalFailurePhase = failurePhase;
    const fixedResultType = e && e.devCustomerAnalyticsInitializationResultType;
    let rollbackFailed = false;
    failurePhase = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_PHASE_ROLLBACK;
    created.reverse().forEach(sh => {
      try { ss.deleteSheet(sh); } catch (ignored) { rollbackFailed = true; }
    });
    return createDevCustomerAnalyticsInitializationFailure(
      rollbackFailed ? 'INITIALIZATION_ROLLBACK_STATE_UNKNOWN' : (fixedResultType || 'INITIALIZATION_FAILED'),
      rollbackFailed ? failurePhase : originalFailurePhase,
      rollbackFailed ? null : 0,
      rollbackFailed ? 'UNKNOWN' : 'UNCHANGED'
    );
  } finally { lock.releaseLock(); }
}

function createDevCustomerAnalyticsInitializationPostWriteError(resultType) {
  return { devCustomerAnalyticsInitializationResultType: resultType };
}

function verifyDevCustomerAnalyticsInitializationAfterFlush(ss, specifications) {
  try {
    SpreadsheetApp.flush();
    return verifyDevCustomerAnalyticsInitializationSheets(ss, specifications);
  } catch (e) {
    return e && e.devCustomerAnalyticsInitializationResultType
      ? e.devCustomerAnalyticsInitializationResultType
      : 'INITIALIZATION_POST_WRITE_VERIFY_EXCEPTION';
  }
}

function createDevCustomerAnalyticsInitializationFailure(resultType, failurePhase, actualDataChangeCount, dataChangeState) {
  return {
    success: false,
    resultType: resultType,
    failurePhase: failurePhase,
    sourceDataChangeCount: 0,
    actualDataChangeCount: actualDataChangeCount === undefined ? 0 : actualDataChangeCount,
    dataChangeState: dataChangeState || 'UNCHANGED'
  };
}

function getDevCustomerAnalyticsInitializationSpecifications(tables) {
  return [
    { name: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[0], headers: ['顧客ID','初回受注日','初回取引完了日','累計総受注数','累計総受注額','累計キャンセル数','累計キャンセル額','累計完了数','累計完了額','累計未確定数','累計未確定額','受注日未設定注文数'], rows: tables.customer, dateColumns: [2, 3] },
    { name: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[1], headers: ['顧客ID','受注年月','総受注数','総受注額','キャンセル数','キャンセル額','完了数','完了額','未確定数','未確定額'], rows: tables.monthly, dateColumns: [] },
    { name: DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[2], headers: ['顧客ID','商品ID','購入明細行数','購入注文数','キャンセル明細行数','完了明細行数','未確定明細行数'], rows: tables.product, dateColumns: [] }
  ];
}

function verifyDevCustomerAnalyticsInitializationSheets(ss, specifications) {
  specifications.forEach(spec => {
    const sheet = ss.getSheetByName(spec.name);
    if (!sheet) throw createDevCustomerAnalyticsInitializationPostWriteError('INITIALIZATION_POST_WRITE_SHEET_MISSING');
    if (sheet.getLastRow() !== spec.rows.length + 1) throw createDevCustomerAnalyticsInitializationPostWriteError('INITIALIZATION_POST_WRITE_ROW_COUNT_MISMATCH');
    if (sheet.getLastColumn() !== spec.headers.length) throw createDevCustomerAnalyticsInitializationPostWriteError('INITIALIZATION_POST_WRITE_COLUMN_COUNT_MISMATCH');
    const actualHeaders = sheet.getRange(1, 1, 1, spec.headers.length).getDisplayValues()[0];
    if (!isDevCustomerAnalyticsMaterializationEqual(actualHeaders, spec.headers)) {
      throw createDevCustomerAnalyticsInitializationPostWriteError('INITIALIZATION_POST_WRITE_HEADER_MISMATCH');
    }
    const actualRows = spec.rows.length > 0
      ? sheet.getRange(2, 1, spec.rows.length, spec.headers.length).getValues()
      : [];
    if (!isDevCustomerAnalyticsMaterializationEqual(actualRows, spec.rows)) {
      throw createDevCustomerAnalyticsInitializationPostWriteError('INITIALIZATION_POST_WRITE_DATA_MISMATCH');
    }
  });
  return null;
}

function hasDevCustomerAnalyticsInitializationOutputInvariants(tables) {
  const customer = sumDevCustomerAnalyticsInitializationColumns(tables.customer, [3, 4, 5, 6, 7, 8, 9, 10]);
  const monthlyOrderCount = sumDevCustomerAnalyticsInitializationColumns(tables.monthly, [2])[0];
  const product = sumDevCustomerAnalyticsInitializationColumns(tables.product, [2, 4, 5, 6]);
  const expected = DEV_CUSTOMER_ANALYTICS_INITIALIZATION_OUTPUT_EXPECTED;
  return customer[0] === expected.totalOrderCount && customer[1] === expected.totalOrderAmount &&
    customer[2] === expected.cancelledOrderCount && customer[3] === expected.cancelledOrderAmount &&
    customer[4] === expected.completedOrderCount && customer[5] === expected.completedOrderAmount &&
    customer[6] === expected.unconfirmedOrderCount && customer[7] === expected.unconfirmedOrderAmount &&
    monthlyOrderCount === expected.monthlyOrderCount &&
    product[0] === expected.productLineCount &&
    product[0] === product[1] + product[2] + product[3];
}

function sumDevCustomerAnalyticsInitializationColumns(rows, columns) {
  return columns.map(column => rows.reduce((sum, row) => sum + Number(row[column] || 0), 0));
}

function buildDevCustomerAnalyticsInitializationTables(sourceSnapshot) {
  const d = sourceSnapshot.data;
  const customers = {};
  d.customers.rows.forEach(row => {
    const id = String(getDevCustomerAnalyticsMaterializationValue(d.customers, row, '顧客ID'));
    if (id) customers[id] = { id: id, first: '', firstCompleted: '', empty: 0, cancelled: [0, 0], completed: [0, 0], unconfirmed: [0, 0] };
  });
  const orders = {};
  const monthly = {};
  d.orders.rows.forEach(row => {
    const id = String(getDevCustomerAnalyticsMaterializationValue(d.orders, row, 'オーダーID'));
    const customerId = String(getDevCustomerAnalyticsMaterializationValue(d.orders, row, '顧客ID'));
    const customer = customers[customerId];
    if (!id || !customer) return;
    const classification = getDevCustomerAnalyticsMaterializationClassification(getDevCustomerAnalyticsMaterializationValue(d.orders, row, 'ステータス'));
    const date = getDevCustomerAnalyticsMaterializationDateState(getDevCustomerAnalyticsMaterializationValue(d.orders, row, '受注日'), sourceSnapshot.spreadsheetTimeZone);
    const amount = getDevCustomerAnalyticsMaterializationNumberState(getDevCustomerAnalyticsMaterializationValue(d.orders, row, '請求総額'));
    const value = amount.state === 'valid' ? amount.value : 0;
    customer[classification][0]++;
    customer[classification][1] += value;
    if (date.state === 'empty') customer.empty++;
    if (date.state === 'valid') {
      const key = customerId + '|' + date.yearMonth;
      const month = monthly[key] || (monthly[key] = { customerId: customerId, yearMonth: date.yearMonth, cancelled: [0, 0], completed: [0, 0], unconfirmed: [0, 0] });
      month[classification][0]++;
      month[classification][1] += value;
      if (!customer.first || date.date.getTime() < customer.first.getTime()) customer.first = date.date;
      if (classification === 'completed' && (!customer.firstCompleted || date.date.getTime() < customer.firstCompleted.getTime())) customer.firstCompleted = date.date;
    }
    orders[id] = { customerId: customerId, classification: classification };
  });
  const product = {};
  d.lines.rows.forEach(row => {
    const orderId = String(getDevCustomerAnalyticsMaterializationValue(d.lines, row, 'オーダーID'));
    const order = orders[orderId];
    const productId = String(getDevCustomerAnalyticsMaterializationValue(d.lines, row, '商品ID'));
    if (!order || !productId) return;
    const key = order.customerId + '|' + productId;
    const item = product[key] || (product[key] = { customerId: order.customerId, productId: productId, orders: {}, cancelled: 0, completed: 0, unconfirmed: 0, lines: 0 });
    item.lines++;
    item.orders[orderId] = true;
    item[order.classification]++;
  });
  return {
    customer: Object.keys(customers).sort().map(key => {
      const customer = customers[key];
      return [customer.id, customer.first, customer.firstCompleted, customer.cancelled[0] + customer.completed[0] + customer.unconfirmed[0], customer.cancelled[1] + customer.completed[1] + customer.unconfirmed[1], customer.cancelled[0], customer.cancelled[1], customer.completed[0], customer.completed[1], customer.unconfirmed[0], customer.unconfirmed[1], customer.empty];
    }),
    monthly: Object.keys(monthly).sort().map(key => {
      const month = monthly[key];
      return [month.customerId, month.yearMonth, month.cancelled[0] + month.completed[0] + month.unconfirmed[0], month.cancelled[1] + month.completed[1] + month.unconfirmed[1], month.cancelled[0], month.cancelled[1], month.completed[0], month.completed[1], month.unconfirmed[0], month.unconfirmed[1]];
    }),
    product: Object.keys(product).sort().map(key => {
      const item = product[key];
      return [item.customerId, item.productId, item.lines, Object.keys(item.orders).length, item.cancelled, item.completed, item.unconfirmed];
    })
  };
}
