const DEV_ORDER_INVOICE_SCHEMA_HEADER_DETAIL_V2_VERSION = '2';
const DEV_ORDER_INVOICE_SCHEMA_HEADER_DETAIL_V2_SHEETS = [
  { name: '顧客マスタ', requiredHeaders: ['顧客ID', '源流リードID'] },
  { name: '配送先マスタ', requiredHeaders: ['配送先ID', '顧客ID'] },
  { name: '支払先マスタ', requiredHeaders: ['支払先ID', '顧客ID'] },
  { name: 'オーダー管理', requiredHeaders: ['オーダーID', '請求書番号', '顧客ID', '配送先ID', '支払先ID', '源流リードID'] },
  { name: 'オーダー明細', requiredHeaders: ['明細ID', 'オーダーID', '商品ID'] },
  { name: '請求書作成', requiredHeaders: [] },
  { name: '📊売上データ', requiredHeaders: [] }
];

function auditDevOrderInvoiceSchemaHeaderDetailV2() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevOrderInvoiceSchemaHeaderDetailV2 is available only in development');
  }
  const spreadsheet = getSpreadsheet();
  return {
    success: true,
    resultType: 'DEV_ORDER_INVOICE_SCHEMA_HEADER_DETAIL_AUDIT_V2_SUCCEEDED',
    auditVersion: DEV_ORDER_INVOICE_SCHEMA_HEADER_DETAIL_V2_VERSION,
    actualDataChangeCount: 0,
    sheets: DEV_ORDER_INVOICE_SCHEMA_HEADER_DETAIL_V2_SHEETS.map(specification =>
      buildDevOrderInvoiceSchemaHeaderDetailV2SheetResult(spreadsheet, specification)
    )
  };
}

function buildDevOrderInvoiceSchemaHeaderDetailV2SheetResult(spreadsheet, specification) {
  const sheet = spreadsheet.getSheetByName(specification.name);
  if (!sheet) {
    return {
      sheetName: specification.name,
      exists: false,
      columnCount: 0,
      headerColumns: '',
      nonEmptyHeaderDuplicates: '',
      requiredHeaderStatus: formatDevOrderInvoiceSchemaHeaderDetailV2RequiredHeaders(specification.requiredHeaders, [])
    };
  }
  const columnCount = sheet.getLastColumn();
  const headers = columnCount > 0
    ? sheet.getRange(1, 1, 1, columnCount).getDisplayValues()[0].map(header => String(header).trim())
    : [];
  return {
    sheetName: specification.name,
    exists: true,
    columnCount: columnCount,
    headerColumns: headers.map((header, index) => (index + 1) + ':' + header).join(' | '),
    nonEmptyHeaderDuplicates: formatDevOrderInvoiceSchemaHeaderDetailV2Duplicates(headers),
    requiredHeaderStatus: formatDevOrderInvoiceSchemaHeaderDetailV2RequiredHeaders(specification.requiredHeaders, headers)
  };
}

function formatDevOrderInvoiceSchemaHeaderDetailV2Duplicates(headers) {
  const columnsByHeader = {};
  headers.forEach((header, index) => {
    if (!header) return;
    if (!columnsByHeader[header]) columnsByHeader[header] = [];
    columnsByHeader[header].push(index + 1);
  });
  return Object.keys(columnsByHeader)
    .filter(header => columnsByHeader[header].length > 1)
    .map(header => header + ':' + columnsByHeader[header].join(','))
    .join(' | ');
}

function formatDevOrderInvoiceSchemaHeaderDetailV2RequiredHeaders(requiredHeaders, headers) {
  return requiredHeaders.map(header => header + ':' + (headers.indexOf(header) === -1 ? '不在' : '存在')).join(' | ');
}
