/**
 * DEV顧客分析台帳を作成できる前提を、値を出さずに読み取り監査する。
 */
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_VERSION = '1';
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID =
  'CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID';
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_REFERENCE_INVALID =
  'CUSTOMER_ANALYTICS_MATERIALIZATION_REFERENCE_INVALID';
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_FAILED =
  'CUSTOMER_ANALYTICS_MATERIALIZATION_FAILED';
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMAS = {
  customers: { sheet: '顧客マスタ', headers: ['顧客ID'] },
  orders: { sheet: 'オーダー管理', headers: ['オーダーID', '顧客ID', 'ステータス', '受注日', '請求総額'] },
  lines: { sheet: 'オーダー明細', headers: ['オーダーID', '商品ID'] },
  products: { sheet: '商品マスタ同期', headers: ['product_id'] }
};
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_CANCELLED = 'キャンセル';
const DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_COMPLETED = '完了';

function dryRunDevCustomerAnalyticsMaterialization() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunDevCustomerAnalyticsMaterialization is available only in development');
  }
  try {
    return buildDevCustomerAnalyticsMaterializationDryRun(getSpreadsheet());
  } catch (error) {
    return {
      success: false,
      resultType: isDevCustomerAnalyticsMaterializationSchemaError(error)
        ? DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID
        : DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_FAILED,
      auditVersion: DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_VERSION,
      actualDataChangeCount: 0
    };
  }
}

function buildDevCustomerAnalyticsMaterializationDryRun(spreadsheet) {
  const data = {};
  Object.keys(DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMAS).forEach(key => {
    data[key] = readDevCustomerAnalyticsMaterializationSheet(
      spreadsheet, DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMAS[key]
    );
  });
  const counts = createDevCustomerAnalyticsMaterializationCounts();
  const customers = createDevCustomerAnalyticsMaterializationParentMap(
    data.customers, '顧客ID', counts, 'customerId'
  );
  counts.customerAnalyticsRowCount = counts.customerIdRecordCount;
  const products = createDevCustomerAnalyticsMaterializationParentMap(
    data.products, 'product_id', counts, 'productId'
  );
  const orders = inspectDevCustomerAnalyticsMaterializationOrders(data.orders, customers, counts);
  inspectDevCustomerAnalyticsMaterializationLines(data.lines, orders, products, counts);
  const referenceInvalid = hasDevCustomerAnalyticsMaterializationReferenceInvalid(counts);
  return Object.assign({
    success: !referenceInvalid,
    resultType: referenceInvalid
      ? DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_REFERENCE_INVALID
      : 'CUSTOMER_ANALYTICS_MATERIALIZATION_DRY_RUN_COMPLETED',
    auditVersion: DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_VERSION,
    actualDataChangeCount: 0,
    amountReconciliationPassed: counts.totalOrderAmount ===
      counts.cancelledOrderAmount + counts.completedOrderAmount + counts.unconfirmedOrderAmount,
    orderCountReconciliationPassed: counts.orderRecordCount ===
      counts.cancelledOrderCount + counts.completedOrderCount + counts.unconfirmedOrderCount
  }, counts);
}

function readDevCustomerAnalyticsMaterializationSheet(spreadsheet, schema) {
  const sheet = spreadsheet.getSheetByName(schema.sheet);
  if (!sheet || sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) {
    throw new Error(DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID);
  }
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevCustomerAnalyticsMaterializationHeaderIndexes(headers);
  schema.headers.forEach(header => requireDevCustomerAnalyticsMaterializationHeader(indexes, header));
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues() : [];
  return { indexes: indexes, rows: rows.filter(isDevCustomerAnalyticsMaterializationRecord) };
}

function getDevCustomerAnalyticsMaterializationHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevCustomerAnalyticsMaterializationHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID);
  }
  return indexes[header];
}

function getDevCustomerAnalyticsMaterializationValue(data, row, header) {
  return row[requireDevCustomerAnalyticsMaterializationHeader(data.indexes, header)];
}

function isDevCustomerAnalyticsMaterializationRecord(row) {
  return row.some(value => !isDevCustomerAnalyticsMaterializationEmpty(value));
}

function createDevCustomerAnalyticsMaterializationParentMap(data, idHeader, counts, countPrefix) {
  const map = {};
  data.rows.forEach(row => {
    const value = getDevCustomerAnalyticsMaterializationValue(data, row, idHeader);
    if (isDevCustomerAnalyticsMaterializationEmpty(value)) {
      counts[countPrefix + 'EmptyCount'] += 1;
      return;
    }
    const key = String(value);
    if (map[key]) {
      counts[countPrefix + 'DuplicateCount'] += 1;
      return;
    }
    map[key] = true;
  });
  counts[countPrefix + 'RecordCount'] = Object.keys(map).length;
  return map;
}

function inspectDevCustomerAnalyticsMaterializationOrders(data, customers, counts) {
  const map = {};
  const monthlyKeys = new Set();
  const validDateCustomerIds = new Set();
  const completedValidDateCustomerIds = new Set();
  const emptyDateCustomerIds = new Set();
  data.rows.forEach(row => {
    const id = getDevCustomerAnalyticsMaterializationValue(data, row, 'オーダーID');
    if (isDevCustomerAnalyticsMaterializationEmpty(id)) {
      counts.orderIdEmptyCount += 1;
      return;
    }
    const orderId = String(id);
    if (map[orderId]) {
      counts.orderIdDuplicateCount += 1;
      return;
    }
    const customerId = getDevCustomerAnalyticsMaterializationValue(data, row, '顧客ID');
    const classification = getDevCustomerAnalyticsMaterializationClassification(
      getDevCustomerAnalyticsMaterializationValue(data, row, 'ステータス')
    );
    const date = getDevCustomerAnalyticsMaterializationDateState(
      getDevCustomerAnalyticsMaterializationValue(data, row, '受注日')
    );
    const amount = getDevCustomerAnalyticsMaterializationNumberState(
      getDevCustomerAnalyticsMaterializationValue(data, row, '請求総額')
    );
    counts.orderRecordCount += 1;
    counts[classification + 'OrderCount'] += 1;
    counts['orderDate' + capitalizeDevCustomerAnalyticsMaterialization(date.state) + 'Count'] += 1;
    counts['invoiceTotal' + capitalizeDevCustomerAnalyticsMaterialization(amount.state) + 'Count'] += 1;
    let customerParentFound = false;
    if (isDevCustomerAnalyticsMaterializationEmpty(customerId)) {
      counts.orderCustomerIdEmptyCount += 1;
    } else if (customers[String(customerId)]) {
      counts.orderCustomerParentFoundCount += 1;
      customerParentFound = true;
    } else {
      counts.orderCustomerParentMissingCount += 1;
    }
    if (amount.state === 'valid') {
      counts.totalOrderAmount += amount.value;
      counts[classification + 'OrderAmount'] += amount.value;
    }
    if (customerParentFound && date.state === 'valid') {
      validDateCustomerIds.add(String(customerId));
      monthlyKeys.add(String(customerId) + '|' + date.yearMonth);
      if (classification === 'completed') completedValidDateCustomerIds.add(String(customerId));
    }
    if (customerParentFound && date.state === 'empty') emptyDateCustomerIds.add(String(customerId));
    map[orderId] = { customerId: customerParentFound ? String(customerId) : '', customerParentFound: customerParentFound };
  });
  counts.customerMonthlyAnalyticsRowCount = monthlyKeys.size;
  counts.customersWithValidOrderDateCount = validDateCustomerIds.size;
  counts.customersWithCompletedValidOrderDateCount = completedValidDateCustomerIds.size;
  counts.customersWithEmptyOrderDateCount = emptyDateCustomerIds.size;
  return map;
}

function inspectDevCustomerAnalyticsMaterializationLines(data, orders, products, counts) {
  const customerProductKeys = new Set();
  data.rows.forEach(row => {
    counts.lineRecordCount += 1;
    const orderId = getDevCustomerAnalyticsMaterializationValue(data, row, 'オーダーID');
    const productId = getDevCustomerAnalyticsMaterializationValue(data, row, '商品ID');
    let orderParent;
    if (isDevCustomerAnalyticsMaterializationEmpty(orderId)) {
      counts.lineOrderIdEmptyCount += 1;
    } else if (orders[String(orderId)]) {
      counts.lineOrderParentFoundCount += 1;
      orderParent = orders[String(orderId)];
    } else {
      counts.lineOrderParentMissingCount += 1;
    }
    let productParentFound = false;
    if (isDevCustomerAnalyticsMaterializationEmpty(productId)) {
      counts.lineProductIdEmptyCount += 1;
    } else if (products[String(productId)]) {
      counts.lineProductParentFoundCount += 1;
      productParentFound = true;
    } else {
      counts.lineProductParentMissingCount += 1;
    }
    if (orderParent && orderParent.customerParentFound && productParentFound) {
      customerProductKeys.add(orderParent.customerId + '|' + String(productId));
    }
  });
  counts.customerProductAnalyticsRowCount = customerProductKeys.size;
}

function createDevCustomerAnalyticsMaterializationCounts() {
  return {
    customerIdRecordCount: 0,
    customerIdEmptyCount: 0,
    customerIdDuplicateCount: 0,
    productIdRecordCount: 0,
    productIdEmptyCount: 0,
    productIdDuplicateCount: 0,
    orderRecordCount: 0,
    orderIdEmptyCount: 0,
    orderIdDuplicateCount: 0,
    lineRecordCount: 0,
    orderCustomerIdEmptyCount: 0,
    orderCustomerParentFoundCount: 0,
    orderCustomerParentMissingCount: 0,
    lineOrderIdEmptyCount: 0,
    lineOrderParentFoundCount: 0,
    lineOrderParentMissingCount: 0,
    lineProductIdEmptyCount: 0,
    lineProductParentFoundCount: 0,
    lineProductParentMissingCount: 0,
    orderDateValidCount: 0,
    orderDateEmptyCount: 0,
    orderDateInvalidCount: 0,
    invoiceTotalValidCount: 0,
    invoiceTotalEmptyCount: 0,
    invoiceTotalInvalidCount: 0,
    cancelledOrderCount: 0,
    completedOrderCount: 0,
    unconfirmedOrderCount: 0,
    totalOrderAmount: 0,
    cancelledOrderAmount: 0,
    completedOrderAmount: 0,
    unconfirmedOrderAmount: 0,
    customerAnalyticsRowCount: 0,
    customerMonthlyAnalyticsRowCount: 0,
    customerProductAnalyticsRowCount: 0,
    customersWithEmptyOrderDateCount: 0,
    customersWithValidOrderDateCount: 0,
    customersWithCompletedValidOrderDateCount: 0
  };
}

function hasDevCustomerAnalyticsMaterializationReferenceInvalid(counts) {
  return [
    'customerIdEmptyCount', 'customerIdDuplicateCount', 'productIdEmptyCount', 'productIdDuplicateCount',
    'orderIdEmptyCount', 'orderIdDuplicateCount', 'orderCustomerIdEmptyCount', 'orderCustomerParentMissingCount',
    'lineOrderIdEmptyCount', 'lineOrderParentMissingCount', 'lineProductIdEmptyCount', 'lineProductParentMissingCount'
  ].some(key => counts[key] > 0);
}

function getDevCustomerAnalyticsMaterializationClassification(status) {
  const normalized = String(status || '').trim();
  if (normalized === DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_CANCELLED) return 'cancelled';
  if (normalized === DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_COMPLETED) return 'completed';
  return 'unconfirmed';
}

function getDevCustomerAnalyticsMaterializationDateState(value) {
  if (isDevCustomerAnalyticsMaterializationEmpty(value)) return { state: 'empty' };
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return { state: 'valid', yearMonth: value.getFullYear() + '-' + (value.getMonth() + 1) };
  }
  if (typeof value !== 'string') return { state: 'invalid' };
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return { state: 'invalid' };
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 ||
      parsed.getUTCDate() !== Number(match[3])) return { state: 'invalid' };
  return { state: 'valid', yearMonth: match[1] + '-' + Number(match[2]) };
}

function getDevCustomerAnalyticsMaterializationNumberState(value) {
  if (isDevCustomerAnalyticsMaterializationEmpty(value)) return { state: 'empty' };
  if (typeof value === 'number' && isFinite(value)) return { state: 'valid', value: value };
  if (typeof value !== 'string' || !/^-?(?:\d+|\d*\.\d+)$/.test(value.trim())) {
    return { state: 'invalid' };
  }
  const parsed = Number(value.trim());
  return isFinite(parsed) ? { state: 'valid', value: parsed } : { state: 'invalid' };
}

function capitalizeDevCustomerAnalyticsMaterialization(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isDevCustomerAnalyticsMaterializationEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined' ||
    (typeof value === 'string' && value.trim() === '');
}

function isDevCustomerAnalyticsMaterializationSchemaError(error) {
  return error && error.message === DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMA_INVALID;
}
