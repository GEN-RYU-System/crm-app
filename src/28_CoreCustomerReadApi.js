/**
 * Core Schema V1を正本として顧客・配送先・支払先を読み取るReactフロント専用API。
 * 物理シート名・物理ヘッダー名は00_CoreSchemaRegistry.jsから解決する。
 */

const CUSTOMER_LIST_CACHE_INDEX      = 'CUSTOMER_LIST_CACHE_INDEX';
const CUSTOMER_LIST_CACHE_PREFIX     = 'CUSTOMER_LIST_CACHE_';
const CUSTOMER_LIST_CACHE_CHUNK_SIZE = 90000;
const CUSTOMER_LIST_CACHE_TTL        = 600;

/**
 * キャッシュから顧客一覧を読み出す。
 * 全チャンクが揃っていない場合は null を返す（→シート読み出しにフォールバック）。
 * @returns {Object[]|null}
 */
function readCustomerListFromCache_() {
  const cache    = CacheService.getScriptCache();
  const indexVal = cache.get(CUSTOMER_LIST_CACHE_INDEX);
  if (indexVal === null) return null;

  const chunkCount = parseInt(indexVal, 10);
  if (isNaN(chunkCount) || chunkCount < 1) return null;

  const keys = [];
  for (let i = 0; i < chunkCount; i++) {
    keys.push(CUSTOMER_LIST_CACHE_PREFIX + i);
  }

  const all = cache.getAll(keys);
  let json = '';
  for (let j = 0; j < chunkCount; j++) {
    const chunk = all[CUSTOMER_LIST_CACHE_PREFIX + j];
    if (chunk === null || chunk === undefined) return null;
    json += chunk;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * 顧客一覧をキャッシュに書き込む（分割キー方式）。
 * @param {Object[]} rows
 */
function writeCustomerListToCache_(rows) {
  const cache      = CacheService.getScriptCache();
  const json       = JSON.stringify(rows);
  const total      = json.length;
  const chunkCount = Math.ceil(total / CUSTOMER_LIST_CACHE_CHUNK_SIZE);

  const map = {};
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CUSTOMER_LIST_CACHE_CHUNK_SIZE;
    map[CUSTOMER_LIST_CACHE_PREFIX + i] = json.slice(start, start + CUSTOMER_LIST_CACHE_CHUNK_SIZE);
  }
  map[CUSTOMER_LIST_CACHE_INDEX] = String(chunkCount);

  cache.putAll(map, CUSTOMER_LIST_CACHE_TTL);
}

/**
 * スプレッドシートから顧客一覧行を組み立てる（純粋データ変換）。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @returns {Object[]}
 */
function buildCoreCustomerListRows_(spreadsheet) {
  const customers = coreCustomerFrontendReadTable(spreadsheet, 'CUSTOMERS', [
    'CUSTOMER_ID', 'SOURCE_LEAD_ID', 'CUSTOMER_NAME', 'COUNTRY', 'SALES_ASSIGNEE_NAME'
  ]);
  const leads = coreCustomerFrontendReadTable(spreadsheet, 'LEADS', [
    'LEAD_ID', 'SALES_CHANNEL', 'HANDLED_TITLE'
  ]);
  const orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'CUSTOMER_ID', 'STATUS', 'CURRENCY', 'INVOICE_TOTAL'
  ]);
  const leadsById              = coreCustomerFrontendIndexBy(leads, 'LEAD_ID');
  const transactionsByCustomer = coreCustomerFrontendAggregateTransactions(orders);

  return customers.rows.map(function(row) {
    const customerId   = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
    const sourceLeadId = coreCustomerFrontendValue(row[customers.indexes.SOURCE_LEAD_ID]);
    const sourceLead   = leadsById[sourceLeadId];
    const transactions = transactionsByCustomer[customerId] || { count: 0, amounts: [] };
    return {
      customerId:         customerId,
      customerName:       coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]),
      country:            coreCustomerFrontendValue(row[customers.indexes.COUNTRY]),
      salesChannel:       sourceLead ? coreCustomerFrontendValue(sourceLead[leads.indexes.SALES_CHANNEL])  : '',
      handledTitle:       sourceLead ? coreCustomerFrontendValue(sourceLead[leads.indexes.HANDLED_TITLE])  : '',
      salesAssigneeName:  coreCustomerFrontendValue(row[customers.indexes.SALES_ASSIGNEE_NAME]),
      transactionCount:   transactions.count,
      transactionAmounts: transactions.amounts
    };
  });
}

function getCoreCustomersForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (forceRefresh !== true) {
    const cached = readCustomerListFromCache_();
    if (cached !== null) return cached;
  }

  const spreadsheet = getSpreadsheet();
  const rows = buildCoreCustomerListRows_(spreadsheet);
  writeCustomerListToCache_(rows);
  return rows;
}

function getCoreCustomerForFrontend(sessionId, customerId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');
  const normalizedCustomerId = coreCustomerFrontendValue(customerId);
  if (!normalizedCustomerId) throw new Error('CUSTOMER_ID_REQUIRED');

  const spreadsheet = getSpreadsheet();
  const customers = coreCustomerFrontendReadTable(spreadsheet, 'CUSTOMERS', [
    'CUSTOMER_ID', 'SOURCE_LEAD_ID', 'CUSTOMER_NAME', 'COUNTRY', 'EMAIL', 'PHONE',
    'COUNTRY_CODE', 'FIRST_TRANSACTION_DATE', 'REGISTERED_AT',
    'SALES_ASSIGNEE_NAME', 'CONTACT_TOOL', 'SHIPPING_NOTE'
  ]);
  const customerRow = customers.rows.find(function(row) {
    return coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]) === normalizedCustomerId;
  });
  if (!customerRow) return null;

  const shipping = coreCustomerFrontendReadTable(spreadsheet, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'CUSTOMER_ID', 'RECIPIENT_NAME', 'ADDRESS_LINE_1',
    'ADDRESS_LINE_2', 'ADDRESS_LINE_3', 'CITY', 'STATE', 'ZIP', 'COUNTRY',
    'PHONE', 'EMAIL', 'IS_DEFAULT', 'IS_ACTIVE'
  ]);
  const payments = coreCustomerFrontendReadTable(spreadsheet, 'PAYMENT_DESTINATIONS', [
    'PAYMENT_DESTINATION_ID', 'CUSTOMER_ID', 'BILLING_NAME', 'ADDRESS_LINE_1',
    'ADDRESS_LINE_2', 'ADDRESS_LINE_3', 'CITY', 'STATE', 'ZIP', 'COUNTRY',
    'PAYMENT_METHOD', 'CURRENCY', 'IS_DEFAULT', 'IS_ACTIVE'
  ]);
  const customerShipping = shipping.rows.filter(function(row) {
    return coreCustomerFrontendValue(row[shipping.indexes.CUSTOMER_ID]) === normalizedCustomerId;
  });
  const customerPayments = payments.rows.filter(function(row) {
    return coreCustomerFrontendValue(row[payments.indexes.CUSTOMER_ID]) === normalizedCustomerId;
  });

  return {
    profile: {
      customerId: normalizedCustomerId,
      sourceLeadId: coreCustomerFrontendValue(customerRow[customers.indexes.SOURCE_LEAD_ID]),
      customerName: coreCustomerFrontendValue(customerRow[customers.indexes.CUSTOMER_NAME]),
      country: coreCustomerFrontendValue(customerRow[customers.indexes.COUNTRY]),
      emailAddress: coreCustomerFrontendValue(customerRow[customers.indexes.EMAIL]),
      phone: coreCustomerFrontendValue(customerRow[customers.indexes.PHONE]),
      countryCode: coreCustomerFrontendValue(customerRow[customers.indexes.COUNTRY_CODE]),
      firstTransactionDate: coreCustomerFrontendValue(customerRow[customers.indexes.FIRST_TRANSACTION_DATE]),
      registeredAt: coreCustomerFrontendValue(customerRow[customers.indexes.REGISTERED_AT]),
      salesAssigneeName: coreCustomerFrontendValue(customerRow[customers.indexes.SALES_ASSIGNEE_NAME]),
      contactTool: coreCustomerFrontendValue(customerRow[customers.indexes.CONTACT_TOOL]),
      shippingNote: coreCustomerFrontendValue(customerRow[customers.indexes.SHIPPING_NOTE]),
      shippingAddressCount: customerShipping.length,
      paymentProfileCount: customerPayments.length
    },
    shippingAddresses: customerShipping.map(function(row) {
      return {
        addressId: coreCustomerFrontendValue(row[shipping.indexes.SHIPPING_DESTINATION_ID]),
        recipient: coreCustomerFrontendValue(row[shipping.indexes.RECIPIENT_NAME]),
        country: coreCustomerFrontendValue(row[shipping.indexes.COUNTRY]),
        address: coreCustomerFrontendJoinAddress(row, shipping.indexes),
        phone: coreCustomerFrontendValue(row[shipping.indexes.PHONE]),
        emailAddress: coreCustomerFrontendValue(row[shipping.indexes.EMAIL]),
        isDefault: coreCustomerFrontendValue(row[shipping.indexes.IS_DEFAULT]),
        isActive: coreCustomerFrontendValue(row[shipping.indexes.IS_ACTIVE])
      };
    }),
    paymentProfiles: customerPayments.map(function(row) {
      return {
        paymentProfileId: coreCustomerFrontendValue(row[payments.indexes.PAYMENT_DESTINATION_ID]),
        billingName: coreCustomerFrontendValue(row[payments.indexes.BILLING_NAME]),
        country: coreCustomerFrontendValue(row[payments.indexes.COUNTRY]),
        address: coreCustomerFrontendJoinAddress(row, payments.indexes),
        method: coreCustomerFrontendValue(row[payments.indexes.PAYMENT_METHOD]),
        currency: coreCustomerFrontendValue(row[payments.indexes.CURRENCY]),
        isDefault: coreCustomerFrontendValue(row[payments.indexes.IS_DEFAULT]),
        isActive: coreCustomerFrontendValue(row[payments.indexes.IS_ACTIVE])
      };
    })
  };
}

function coreCustomerFrontendReadTable(spreadsheet, tableKey, requiredHeaderKeys) {
  const table = getCoreSchemaV1Table(tableKey);
  const sheet = getCoreSchemaV1Sheet(spreadsheet, tableKey);
  const columnCount = sheet.getLastColumn();
  const headers = columnCount > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, columnCount).getDisplayValues()[0].map(function(header) { return String(header).trim(); })
    : [];
  const nonEmptyHeaders = headers.filter(function(header) { return header !== ''; });
  if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) {
    throw new Error('CORE_CUSTOMER_READ_DUPLICATE_HEADER:' + tableKey);
  }
  const indexes = {};
  requiredHeaderKeys.forEach(function(headerKey) {
    const headerName = getCoreSchemaV1HeaderName(tableKey, headerKey);
    const index = headers.indexOf(headerName);
    if (index === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING');
    indexes[headerKey] = index;
  });
  const dataRowCount = Math.max(0, sheet.getLastRow() - table.headerRowNumber);
  const rows = dataRowCount > 0
    ? sheet.getRange(table.headerRowNumber + 1, 1, dataRowCount, columnCount).getValues()
    : [];
  return { indexes: indexes, rows: rows };
}

function coreCustomerFrontendIndexBy(tableData, idHeaderKey) {
  return tableData.rows.reduce(function(index, row) {
    const id = coreCustomerFrontendValue(row[tableData.indexes[idHeaderKey]]);
    if (id) index[id] = row;
    return index;
  }, {});
}

function coreCustomerFrontendAggregateTransactions(orders) {
  const completedStatus = getCoreSchemaV1Value('ORDERS', 'STATUS', 'COMPLETED');
  const aggregates = orders.rows.reduce(function(index, row) {
    const orderId    = coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    const customerId = coreCustomerFrontendValue(row[orders.indexes.CUSTOMER_ID]);
    if (!orderId || !customerId) return index;
    const status = coreCustomerFrontendValue(row[orders.indexes.STATUS]);
    if (status !== completedStatus) return index;
    if (!index[customerId]) index[customerId] = { count: 0, amountsByCurrency: {} };
    index[customerId].count += 1;
    const amount = coreCustomerFrontendNumber(row[orders.indexes.INVOICE_TOTAL]);
    if (amount !== null) {
      const currency = coreCustomerFrontendValue(row[orders.indexes.CURRENCY]).toUpperCase();
      index[customerId].amountsByCurrency[currency] = (index[customerId].amountsByCurrency[currency] || 0) + amount;
    }
    return index;
  }, {});
  return Object.keys(aggregates).reduce(function(result, customerId) {
    const aggregate = aggregates[customerId];
    result[customerId] = {
      count: aggregate.count,
      amounts: Object.keys(aggregate.amountsByCurrency).sort().map(function(currency) {
        return { currency: currency, amount: aggregate.amountsByCurrency[currency] };
      })
    };
    return result;
  }, {});
}

function coreCustomerFrontendNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = coreCustomerFrontendValue(value).replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function coreCustomerFrontendJoinAddress(row, indexes) {
  return ['ADDRESS_LINE_1', 'ADDRESS_LINE_2', 'ADDRESS_LINE_3', 'CITY', 'STATE', 'ZIP']
    .map(function(headerKey) { return coreCustomerFrontendValue(row[indexes[headerKey]]); })
    .filter(Boolean)
    .join(', ');
}

function coreCustomerFrontendValue(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return String(value).trim();
}
