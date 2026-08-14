/**
 * DEV請求書2表の初期化前状態を、書込みなしで確認する。
 * セル値・ID値・例外本文は返却・記録しない。
 */
const DEV_INVOICE_SCHEMA_DRY_RUN_VERSION = '1';
const DEV_INVOICE_SCHEMA_DRY_RUN_TABLE_KEYS = ['INVOICES', 'INVOICE_LINES'];
const DEV_INVOICE_SCHEMA_DRY_RUN_DEVELOPMENT_REQUIRED =
  'DEV_INVOICE_SCHEMA_DEVELOPMENT_REQUIRED';
const DEV_INVOICE_SCHEMA_DRY_RUN_READY = 'DEV_INVOICE_SCHEMA_DRY_RUN_READY';
const DEV_INVOICE_SCHEMA_ALREADY_INITIALIZED =
  'DEV_INVOICE_SCHEMA_ALREADY_INITIALIZED';
const DEV_INVOICE_SCHEMA_PARTIAL_STATE = 'DEV_INVOICE_SCHEMA_PARTIAL_STATE';
const DEV_INVOICE_SCHEMA_COLUMN_COUNT_MISMATCH =
  'DEV_INVOICE_SCHEMA_COLUMN_COUNT_MISMATCH';
const DEV_INVOICE_SCHEMA_HEADER_MISMATCH = 'DEV_INVOICE_SCHEMA_HEADER_MISMATCH';
const DEV_INVOICE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE =
  'DEV_INVOICE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE';
const DEV_INVOICE_SCHEMA_DRY_RUN_FAILED = 'DEV_INVOICE_SCHEMA_DRY_RUN_FAILED';

function dryRunDevInvoiceSchemaInitialization() {
  let environment;
  try {
    environment = getEnvironment();
  } catch (error) {
    return createDevInvoiceSchemaDryRunResult_(
      DEV_INVOICE_SCHEMA_DRY_RUN_DEVELOPMENT_REQUIRED
    );
  }
  if (environment !== 'development') {
    return createDevInvoiceSchemaDryRunResult_(
      DEV_INVOICE_SCHEMA_DRY_RUN_DEVELOPMENT_REQUIRED
    );
  }
  try {
    return inspectDevInvoiceSchemaInitialization_(getSpreadsheet());
  } catch (error) {
    return createDevInvoiceSchemaDryRunResult_(DEV_INVOICE_SCHEMA_DRY_RUN_FAILED);
  }
}

function inspectDevInvoiceSchemaInitialization_(spreadsheet) {
  const tables = DEV_INVOICE_SCHEMA_DRY_RUN_TABLE_KEYS.map(tableKey =>
    readDevInvoiceSchemaDryRunTable_(spreadsheet, tableKey)
  );
  const invoices = tables[0];
  const invoiceLines = tables[1];
  const baseResult = createDevInvoiceSchemaDryRunResult_(null, invoices, invoiceLines);

  if (!invoices.exists && !invoiceLines.exists) {
    return Object.assign(baseResult, {
      success: true,
      resultType: DEV_INVOICE_SCHEMA_DRY_RUN_READY,
      plannedSheetCreateCount: 2
    });
  }
  if (!invoices.exists || !invoiceLines.exists) {
    return Object.assign(baseResult, {
      success: false,
      resultType: DEV_INVOICE_SCHEMA_PARTIAL_STATE,
      plannedSheetCreateCount: 0
    });
  }

  const resultType = getDevInvoiceSchemaDryRunExistingStateResultType_(tables);
  return Object.assign(baseResult, {
    success: resultType === DEV_INVOICE_SCHEMA_ALREADY_INITIALIZED,
    resultType: resultType,
    plannedSheetCreateCount: 0
  });
}

function readDevInvoiceSchemaDryRunTable_(spreadsheet, tableKey) {
  const table = getCoreSchemaV1Table(tableKey);
  const expectedHeaders = Object.keys(table.headers)
    .map(headerKey => getCoreSchemaV1HeaderName(tableKey, headerKey));
  const sheetName = getCoreSchemaV1TableName(tableKey);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return createDevInvoiceSchemaDryRunTableState_(tableKey, table, expectedHeaders, false, 0, '');
  }
  const columnCount = sheet.getLastColumn();
  const headers = columnCount > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, columnCount).getDisplayValues()[0]
      .map(header => String(header).trim())
    : [];
  return createDevInvoiceSchemaDryRunTableState_(
    tableKey,
    table,
    expectedHeaders,
    true,
    columnCount,
    formatDevInvoiceSchemaDryRunHeaders_(headers)
  );
}

function createDevInvoiceSchemaDryRunTableState_(tableKey, table, expectedHeaders, exists, columnCount, headerColumns) {
  return {
    tableKey: tableKey,
    exists: exists,
    expectedColumnCount: expectedHeaders.length,
    actualColumnCount: columnCount,
    expectedHeaders: expectedHeaders,
    headerColumns: headerColumns,
    headerRowNumber: table.headerRowNumber
  };
}

function getDevInvoiceSchemaDryRunExistingStateResultType_(tables) {
  if (tables.some(table => table.actualColumnCount !== table.expectedColumnCount)) {
    return DEV_INVOICE_SCHEMA_COLUMN_COUNT_MISMATCH;
  }
  if (tables.some(table => hasDevInvoiceSchemaDryRunNonEmptyHeaderDuplicate_(table.headerColumns))) {
    return DEV_INVOICE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE;
  }
  if (tables.some(table => table.headerColumns !== formatDevInvoiceSchemaDryRunHeaders_(table.expectedHeaders))) {
    return DEV_INVOICE_SCHEMA_HEADER_MISMATCH;
  }
  return DEV_INVOICE_SCHEMA_ALREADY_INITIALIZED;
}

function formatDevInvoiceSchemaDryRunHeaders_(headers) {
  return headers.map((header, index) => (index + 1) + ':' + header).join(' | ');
}

function hasDevInvoiceSchemaDryRunNonEmptyHeaderDuplicate_(headerColumns) {
  const headers = headerColumns.split(' | ').map(column => column.slice(column.indexOf(':') + 1)).filter(Boolean);
  return new Set(headers).size !== headers.length;
}

function createDevInvoiceSchemaDryRunResult_(resultType, invoices, invoiceLines) {
  const invoiceTable = invoices || createDevInvoiceSchemaDryRunDefaultTable_('INVOICES');
  const invoiceLineTable = invoiceLines || createDevInvoiceSchemaDryRunDefaultTable_('INVOICE_LINES');
  return {
    success: false,
    resultType: resultType,
    auditVersion: DEV_INVOICE_SCHEMA_DRY_RUN_VERSION,
    invoiceSheetExists: invoiceTable.exists,
    invoiceLineSheetExists: invoiceLineTable.exists,
    invoicePlannedColumnCount: invoiceTable.expectedColumnCount,
    invoiceLinePlannedColumnCount: invoiceLineTable.expectedColumnCount,
    invoicePlannedHeaderColumns: formatDevInvoiceSchemaDryRunHeaders_(invoiceTable.expectedHeaders),
    invoiceLinePlannedHeaderColumns: formatDevInvoiceSchemaDryRunHeaders_(invoiceLineTable.expectedHeaders),
    invoiceActualColumnCount: invoiceTable.actualColumnCount,
    invoiceLineActualColumnCount: invoiceLineTable.actualColumnCount,
    invoiceHeaderColumns: invoiceTable.headerColumns,
    invoiceLineHeaderColumns: invoiceLineTable.headerColumns,
    plannedSheetCreateCount: 0,
    sourceDataChangeCount: 0,
    actualDataChangeCount: 0
  };
}

function createDevInvoiceSchemaDryRunDefaultTable_(tableKey) {
  const table = getCoreSchemaV1Table(tableKey);
  const headers = Object.keys(table.headers)
    .map(headerKey => getCoreSchemaV1HeaderName(tableKey, headerKey));
  return createDevInvoiceSchemaDryRunTableState_(
    tableKey,
    table,
    headers,
    false,
    0,
    ''
  );
}

