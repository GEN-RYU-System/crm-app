const DEV_ORDER_INVOICE_SCHEMA_AUDIT_VERSION = '1';
const DEV_ORDER_INVOICE_SCHEMA_AUDIT_SHEETS = [
  { name: 'リード管理', requiredHeaders: [] },
  { name: '顧客マスタ', requiredHeaders: ['顧客ID', '源流リードID'] },
  { name: '配送先マスタ', requiredHeaders: ['配送先ID', '顧客ID'] },
  { name: '支払先マスタ', requiredHeaders: ['支払先ID', '顧客ID'] },
  { name: 'オーダー管理', requiredHeaders: ['オーダーID', '請求書番号', '顧客ID', '配送先ID', '支払先ID', '源流リードID'] },
  { name: 'オーダー明細', requiredHeaders: ['明細ID', 'オーダーID', '商品ID'] },
  { name: '請求書管理', requiredHeaders: ['請求書ID', '請求書番号', 'オーダーID', '顧客ID', 'リードID', '商談ID'] },
  { name: '請求書明細', requiredHeaders: ['明細ID', '請求書ID', '商品ID'] },
  { name: '請求書作成', requiredHeaders: [] },
  { name: '取引状況', requiredHeaders: [] },
  { name: '📊売上データ', requiredHeaders: [] }
];

function auditDevOrderInvoiceSchema() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevOrderInvoiceSchema is available only in development');
  }
  const spreadsheet = getSpreadsheet();
  return {
    success: true,
    resultType: 'DEV_ORDER_INVOICE_SCHEMA_AUDIT_SUCCEEDED',
    auditVersion: DEV_ORDER_INVOICE_SCHEMA_AUDIT_VERSION,
    actualDataChangeCount: 0,
    sheets: DEV_ORDER_INVOICE_SCHEMA_AUDIT_SHEETS.map(specification =>
      buildDevOrderInvoiceSchemaAuditSheetResult(spreadsheet, specification)
    )
  };
}

function buildDevOrderInvoiceSchemaAuditSheetResult(spreadsheet, specification) {
  const sheet = spreadsheet.getSheetByName(specification.name);
  if (!sheet) {
    return {
      sheetName: specification.name,
      exists: false,
      columnCount: 0,
      headers: [],
      nonEmptyHeaderDuplicateCount: 0,
      requiredHeaders: buildDevOrderInvoiceSchemaAuditRequiredHeaders(specification.requiredHeaders, [])
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
    headers: headers,
    nonEmptyHeaderDuplicateCount: countDevOrderInvoiceSchemaAuditNonEmptyHeaderDuplicates(headers),
    requiredHeaders: buildDevOrderInvoiceSchemaAuditRequiredHeaders(specification.requiredHeaders, headers)
  };
}

function buildDevOrderInvoiceSchemaAuditRequiredHeaders(requiredHeaders, headers) {
  return requiredHeaders.map(header => ({ headerName: header, exists: headers.indexOf(header) !== -1 }));
}

function countDevOrderInvoiceSchemaAuditNonEmptyHeaderDuplicates(headers) {
  const seen = {};
  let duplicateCount = 0;
  headers.forEach(header => {
    if (!header) return;
    seen[header] = (seen[header] || 0) + 1;
    if (seen[header] > 1) duplicateCount++;
  });
  return duplicateCount;
}
