/**
 * DEV CRMの顧客・注文分析に必要な参照と注文データを、件数だけで監査する。
 * ID、氏名、顧客名、商品名、金額、日付、URL、セル値は返却・記録しない。
 */
const DEV_CUSTOMER_ORDER_ANALYTICS_AUDIT_VERSION = '1';
const DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID =
  'CUSTOMER_ORDER_ANALYTICS_READINESS_SCHEMA_INVALID';
const DEV_CUSTOMER_ORDER_ANALYTICS_FAILED =
  'CUSTOMER_ORDER_ANALYTICS_READINESS_FAILED';
const DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS = {
  leads: { sheet: 'リード管理', headers: ['リードID'] },
  customers: { sheet: '顧客マスタ', headers: ['源流リードID', '顧客ID'] },
  orders: { sheet: 'オーダー管理', headers: ['オーダーID', '顧客ID', '受注日', '請求総額'] },
  lines: { sheet: 'オーダー明細', headers: ['オーダーID', '商品ID'] },
  products: { sheet: '商品マスタ同期', headers: ['product_id'] }
};

function auditDevCustomerOrderAnalyticsReadiness() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevCustomerOrderAnalyticsReadiness is available only in development');
  }
  try {
    return buildDevCustomerOrderAnalyticsReadiness(getSpreadsheet());
  } catch (error) {
    return {
      success: false,
      resultType: isDevCustomerOrderAnalyticsSchemaError(error)
        ? DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID
        : DEV_CUSTOMER_ORDER_ANALYTICS_FAILED,
      auditVersion: DEV_CUSTOMER_ORDER_ANALYTICS_AUDIT_VERSION,
      actualDataChangeCount: 0
    };
  }
}

function buildDevCustomerOrderAnalyticsReadiness(spreadsheet) {
  const data = {
    leads: readDevCustomerOrderAnalyticsSheet(spreadsheet, DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS.leads),
    customers: readDevCustomerOrderAnalyticsSheet(spreadsheet, DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS.customers),
    orders: readDevCustomerOrderAnalyticsSheet(spreadsheet, DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS.orders),
    lines: readDevCustomerOrderAnalyticsSheet(spreadsheet, DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS.lines),
    products: readDevCustomerOrderAnalyticsSheet(spreadsheet, DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMAS.products)
  };
  const leadIds = getDevCustomerOrderAnalyticsIds(data.leads, 'リードID');
  const customerIds = getDevCustomerOrderAnalyticsIds(data.customers, '顧客ID');
  const orderIds = getDevCustomerOrderAnalyticsIds(data.orders, 'オーダーID');
  const productIds = getDevCustomerOrderAnalyticsIds(data.products, 'product_id');
  const leadToCustomer = auditDevCustomerOrderAnalyticsCustomerSources(data.customers, leadIds);
  const orderRows = data.orders.rows.filter(row =>
    !isDevCustomerOrderAnalyticsEmpty(getDevCustomerOrderAnalyticsValue(data.orders, row, 'オーダーID'))
  );
  const customerToOrder = auditDevCustomerOrderAnalyticsOrderCustomers(data.orders, orderRows, customerIds);
  const orderAnalyticsData = auditDevCustomerOrderAnalyticsOrderData(data.orders, orderRows, customerIds);
  const orderToLineToProduct = auditDevCustomerOrderAnalyticsOrderLines(
    data.lines, orderIds, productIds
  );
  const customerAnalyticsReadiness = auditDevCustomerOrderAnalyticsCustomerReadiness(
    customerIds, data.orders, orderRows
  );

  return {
    success: true,
    resultType: 'CUSTOMER_ORDER_ANALYTICS_READINESS_AUDITED',
    auditVersion: DEV_CUSTOMER_ORDER_ANALYTICS_AUDIT_VERSION,
    actualDataChangeCount: 0,
    leadToCustomer: leadToCustomer,
    customerToOrder: customerToOrder,
    orderToLineToProduct: orderToLineToProduct,
    orderAnalyticsData: orderAnalyticsData,
    customerAnalyticsReadiness: customerAnalyticsReadiness
  };
}

function readDevCustomerOrderAnalyticsSheet(spreadsheet, schema) {
  const sheet = spreadsheet.getSheetByName(schema.sheet);
  if (!sheet) throw new Error(DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID);
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn < 1 || lastRow < 1) throw new Error(DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevCustomerOrderAnalyticsHeaderIndexes(headers);
  schema.headers.forEach(header => requireDevCustomerOrderAnalyticsHeader(indexes, header));
  const range = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn) : null;
  const values = range ? range.getValues() : [];
  const formulas = range ? range.getFormulas() : [];
  return {
    indexes: indexes,
    rows: values.reduce((result, valuesRow, index) => {
      if (isDevCustomerOrderAnalyticsRecord(valuesRow, formulas[index])) {
        result.push(valuesRow);
      }
      return result;
    }, [])
  };
}

function getDevCustomerOrderAnalyticsHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevCustomerOrderAnalyticsHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID);
  }
  return indexes[header];
}

function isDevCustomerOrderAnalyticsRecord(values, formulas) {
  return values.some((value, index) =>
    !isDevCustomerOrderAnalyticsEmpty(value) || !isDevCustomerOrderAnalyticsEmpty(formulas[index])
  );
}

function getDevCustomerOrderAnalyticsValue(data, row, header) {
  return row[requireDevCustomerOrderAnalyticsHeader(data.indexes, header)];
}

function getDevCustomerOrderAnalyticsIds(data, header) {
  return new Set(data.rows.reduce((result, row) => {
    const value = getDevCustomerOrderAnalyticsValue(data, row, header);
    if (!isDevCustomerOrderAnalyticsEmpty(value)) result.push(String(value));
    return result;
  }, []));
}

function auditDevCustomerOrderAnalyticsCustomerSources(customers, leadIds) {
  const counts = createDevCustomerOrderAnalyticsReferenceCounts('customerRecordCount');
  let customerIdEmptyCount = 0;
  customers.rows.forEach(row => {
    counts.customerRecordCount += 1;
    countDevCustomerOrderAnalyticsReference(
      counts, getDevCustomerOrderAnalyticsValue(customers, row, '源流リードID'), leadIds
    );
    if (isDevCustomerOrderAnalyticsEmpty(getDevCustomerOrderAnalyticsValue(customers, row, '顧客ID'))) {
      customerIdEmptyCount += 1;
    }
  });
  return Object.assign(counts, { customerIdEmptyCount: customerIdEmptyCount });
}

function auditDevCustomerOrderAnalyticsOrderCustomers(orders, orderRows, customerIds) {
  const counts = createDevCustomerOrderAnalyticsReferenceCounts('orderRecordCount');
  orderRows.forEach(row => {
    counts.orderRecordCount += 1;
    countDevCustomerOrderAnalyticsReference(
      counts, getDevCustomerOrderAnalyticsValue(orders, row, '顧客ID'), customerIds
    );
  });
  return counts;
}

function auditDevCustomerOrderAnalyticsOrderLines(lines, orderIds, productIds) {
  const orderCounts = createDevCustomerOrderAnalyticsReferenceCounts('orderLineRecordCount');
  let productIdEmptyLineCount = 0;
  let productMasterPresentLineCount = 0;
  let productMasterMissingLineCount = 0;
  lines.rows.forEach(row => {
    orderCounts.orderLineRecordCount += 1;
    countDevCustomerOrderAnalyticsReference(
      orderCounts, getDevCustomerOrderAnalyticsValue(lines, row, 'オーダーID'), orderIds
    );
    const productId = getDevCustomerOrderAnalyticsValue(lines, row, '商品ID');
    if (isDevCustomerOrderAnalyticsEmpty(productId)) {
      productIdEmptyLineCount += 1;
    } else if (productIds.has(String(productId))) {
      productMasterPresentLineCount += 1;
    } else {
      productMasterMissingLineCount += 1;
    }
  });
  return Object.assign(orderCounts, {
    productIdEmptyLineCount: productIdEmptyLineCount,
    productMasterPresentLineCount: productMasterPresentLineCount,
    productMasterMissingLineCount: productMasterMissingLineCount
  });
}

function auditDevCustomerOrderAnalyticsOrderData(orders, orderRows, customerIds) {
  let validOrderDateCount = 0;
  let emptyOrderDateCount = 0;
  let invalidOrderDateCount = 0;
  let validOrderAmountCount = 0;
  let emptyOrderAmountCount = 0;
  let invalidOrderAmountCount = 0;
  let fullyValidCustomerDateAmountOrderCount = 0;
  orderRows.forEach(row => {
    const customerId = getDevCustomerOrderAnalyticsValue(orders, row, '顧客ID');
    const dateState = getDevCustomerOrderAnalyticsDateState(
      getDevCustomerOrderAnalyticsValue(orders, row, '受注日')
    );
    const amountState = getDevCustomerOrderAnalyticsNumberState(
      getDevCustomerOrderAnalyticsValue(orders, row, '請求総額')
    );
    if (dateState === 'valid') validOrderDateCount += 1;
    if (dateState === 'empty') emptyOrderDateCount += 1;
    if (dateState === 'invalid') invalidOrderDateCount += 1;
    if (amountState === 'valid') validOrderAmountCount += 1;
    if (amountState === 'empty') emptyOrderAmountCount += 1;
    if (amountState === 'invalid') invalidOrderAmountCount += 1;
    if (
      customerIds.has(String(customerId)) && dateState === 'valid' && amountState === 'valid'
    ) {
      fullyValidCustomerDateAmountOrderCount += 1;
    }
  });
  return {
    validOrderDateCount: validOrderDateCount,
    emptyOrderDateCount: emptyOrderDateCount,
    invalidOrderDateCount: invalidOrderDateCount,
    validOrderAmountCount: validOrderAmountCount,
    emptyOrderAmountCount: emptyOrderAmountCount,
    invalidOrderAmountCount: invalidOrderAmountCount,
    fullyValidCustomerDateAmountOrderCount: fullyValidCustomerDateAmountOrderCount
  };
}

function auditDevCustomerOrderAnalyticsCustomerReadiness(customerIds, orders, orderRows) {
  const customersWithValidOrderDate = new Set();
  orderRows.forEach(row => {
    const customerId = getDevCustomerOrderAnalyticsValue(orders, row, '顧客ID');
    if (
      customerIds.has(String(customerId)) &&
      getDevCustomerOrderAnalyticsDateState(
        getDevCustomerOrderAnalyticsValue(orders, row, '受注日')
      ) === 'valid'
    ) {
      customersWithValidOrderDate.add(String(customerId));
    }
  });
  return {
    eligibleCustomerCount: customerIds.size,
    customersWithValidOrderDateCount: customersWithValidOrderDate.size,
    customersWithoutValidOrderDateCount:
      customerIds.size - customersWithValidOrderDate.size
  };
}

function createDevCustomerOrderAnalyticsReferenceCounts(recordCountKey) {
  return {
    [recordCountKey]: 0,
    emptyReferenceCount: 0,
    parentPresentReferenceCount: 0,
    parentMissingReferenceCount: 0
  };
}

function countDevCustomerOrderAnalyticsReference(counts, value, parentIds) {
  if (isDevCustomerOrderAnalyticsEmpty(value)) {
    counts.emptyReferenceCount += 1;
  } else if (parentIds.has(String(value))) {
    counts.parentPresentReferenceCount += 1;
  } else {
    counts.parentMissingReferenceCount += 1;
  }
}

function getDevCustomerOrderAnalyticsDateState(value) {
  if (isDevCustomerOrderAnalyticsEmpty(value)) return 'empty';
  if (value instanceof Date) return isNaN(value.getTime()) ? 'invalid' : 'valid';
  if (typeof value !== 'string') return 'invalid';
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return 'invalid';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]) ? 'valid' : 'invalid';
}

function getDevCustomerOrderAnalyticsNumberState(value) {
  if (isDevCustomerOrderAnalyticsEmpty(value)) return 'empty';
  if (typeof value === 'number') return Number.isFinite(value) ? 'valid' : 'invalid';
  if (typeof value !== 'string' || value.trim() === '') return 'invalid';
  const number = Number(value.trim());
  return Number.isFinite(number) ? 'valid' : 'invalid';
}

function isDevCustomerOrderAnalyticsEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}

function isDevCustomerOrderAnalyticsSchemaError(error) {
  return error && error.message === DEV_CUSTOMER_ORDER_ANALYTICS_SCHEMA_INVALID;
}
