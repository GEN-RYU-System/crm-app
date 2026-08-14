const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS = ['顧客分析', '顧客月次分析', '顧客購入商品分析'];
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED = {
  customerAnalyticsRowCount: 51, customerMonthlyAnalyticsRowCount: 69, customerProductAnalyticsRowCount: 262,
  orderDateEmptyCount: 8, totalOrderAmount: 80139404.5, cancelledOrderAmount: 28776519,
  completedOrderAmount: 47155185.5, unconfirmedOrderAmount: 4207700
};
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_DATA_ROW_WRITE_COUNT = 382;
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_HEADER_ROW_WRITE_COUNT = 3;

function initializeDevCustomerAnalytics() {
  if (getEnvironment() !== 'development') throw new Error('initializeDevCustomerAnalytics is available only in development');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, resultType: 'INITIALIZATION_LOCK_UNAVAILABLE', actualDataChangeCount: 0 };
  const created = [];
  let ss;
  try {
    ss = getSpreadsheet();
    if (DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS.some(name => ss.getSheetByName(name))) {
      return { success: false, resultType: 'INITIALIZATION_TARGET_EXISTS', actualDataChangeCount: 0 };
    }

    // Audit and table materialization consume exactly the same in-memory source snapshot.
    const sourceSnapshot = createDevCustomerAnalyticsMaterializationSourceSnapshot(ss);
    const audit = buildDevCustomerAnalyticsMaterializationDryRunFromSnapshot(sourceSnapshot);
    if (!audit.success || !Object.keys(DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED).every(key => audit[key] === DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED[key])) {
      return { success: false, resultType: 'INITIALIZATION_EXPECTATION_MISMATCH', actualDataChangeCount: 0 };
    }
    const tables = buildDevCustomerAnalyticsInitializationTables(sourceSnapshot);
    if (tables.customer.length !== 51 || tables.monthly.length !== 69 || tables.product.length !== 262) {
      return { success: false, resultType: 'INITIALIZATION_TABLE_COUNT_MISMATCH', actualDataChangeCount: 0 };
    }

    // Re-read immediately before the first insert. Any source change means zero analytics writes.
    if (!isDevCustomerAnalyticsMaterializationSourceSnapshotUnchanged(
      sourceSnapshot,
      createDevCustomerAnalyticsMaterializationSourceSnapshot(ss)
    )) {
      return { success: false, resultType: 'INITIALIZATION_SOURCE_CHANGED', actualDataChangeCount: 0 };
    }

    const specifications = getDevCustomerAnalyticsInitializationSpecifications(tables);
    specifications.forEach(spec => {
      const sh = ss.insertSheet(spec.name);
      created.push(sh);
      sh.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]);
      sh.getRange(2, 1, spec.rows.length, spec.headers.length).setValues(spec.rows);
      spec.dateColumns.forEach(column => sh.getRange(2, column, spec.rows.length, 1).setNumberFormat('yyyy-MM-dd'));
    });
    verifyDevCustomerAnalyticsInitializationSheets(ss, specifications);

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
    let rollbackFailed = false;
    created.reverse().forEach(sh => {
      try { ss.deleteSheet(sh); } catch (ignored) { rollbackFailed = true; }
    });
    return {
      success: false,
      resultType: rollbackFailed ? 'INITIALIZATION_ROLLBACK_STATE_UNKNOWN' : 'INITIALIZATION_FAILED',
      actualDataChangeCount: rollbackFailed ? null : 0,
      dataChangeState: rollbackFailed ? 'UNKNOWN' : 'UNCHANGED'
    };
  } finally { lock.releaseLock(); }
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
    if (!sheet || sheet.getLastRow() !== spec.rows.length + 1 || sheet.getLastColumn() !== spec.headers.length) {
      throw new Error('INITIALIZATION_WRITE_VERIFICATION_FAILED');
    }
    const actualHeaders = sheet.getRange(1, 1, 1, spec.headers.length).getDisplayValues()[0];
    if (!isDevCustomerAnalyticsMaterializationEqual(actualHeaders, spec.headers)) {
      throw new Error('INITIALIZATION_WRITE_VERIFICATION_FAILED');
    }
  });
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
