/**
 * Core Schema V1を正本として顧客・配送先・支払先を読み取るReactフロント専用API。
 * 物理シート名・物理ヘッダー名は00_CoreSchemaRegistry.jsから解決する。
 */

function getCoreCustomersForFrontend() {
  checkPermission('lead_view');

  const spreadsheet = getSpreadsheet();
  const customers = coreCustomerFrontendReadTable(spreadsheet, 'CUSTOMERS', [
    'CUSTOMER_ID', 'CUSTOMER_NAME', 'COUNTRY', 'EMAIL', 'PHONE',
    'REGISTERED_AT', 'SALES_ASSIGNEE_NAME', 'CONTACT_TOOL'
  ]);
  const shipping = coreCustomerFrontendReadTable(spreadsheet, 'SHIPPING_DESTINATIONS', ['CUSTOMER_ID']);
  const payments = coreCustomerFrontendReadTable(spreadsheet, 'PAYMENT_DESTINATIONS', ['CUSTOMER_ID']);
  const shippingCounts = coreCustomerFrontendCountByCustomer(shipping, 'CUSTOMER_ID');
  const paymentCounts = coreCustomerFrontendCountByCustomer(payments, 'CUSTOMER_ID');

  return customers.rows.map(function(row) {
    const customerId = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
    return {
      customerId: customerId,
      customerName: coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]),
      emailAddress: coreCustomerFrontendValue(row[customers.indexes.EMAIL]),
      country: coreCustomerFrontendValue(row[customers.indexes.COUNTRY]),
      phone: coreCustomerFrontendValue(row[customers.indexes.PHONE]),
      shippingAddressCount: shippingCounts[customerId] || 0,
      paymentProfileCount: paymentCounts[customerId] || 0,
      salesAssigneeName: coreCustomerFrontendValue(row[customers.indexes.SALES_ASSIGNEE_NAME]),
      contactTool: coreCustomerFrontendValue(row[customers.indexes.CONTACT_TOOL]),
      registeredAt: coreCustomerFrontendValue(row[customers.indexes.REGISTERED_AT])
    };
  });
}

function getCoreCustomerForFrontend(customerId) {
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

function coreCustomerFrontendCountByCustomer(tableData, customerIdHeaderKey) {
  return tableData.rows.reduce(function(counts, row) {
    const customerId = coreCustomerFrontendValue(row[tableData.indexes[customerIdHeaderKey]]);
    if (customerId) counts[customerId] = (counts[customerId] || 0) + 1;
    return counts;
  }, {});
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
