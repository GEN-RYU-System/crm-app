const DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_VERSION = '3';
const DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_SHEETS = [
  { name: 'リード管理', headerRowNumber: 1, requiredIdHeaders: ['リードID', '担当者ID'] },
  { name: '顧客マスタ', headerRowNumber: 1, requiredIdHeaders: ['顧客ID', '源流リードID'] },
  { name: '配送先マスタ', headerRowNumber: 1, requiredIdHeaders: ['配送先ID', '顧客ID'] },
  { name: '支払先マスタ', headerRowNumber: 1, requiredIdHeaders: ['支払先ID', '顧客ID'] },
  { name: 'オーダー管理', headerRowNumber: 1, requiredIdHeaders: ['オーダーID', '顧客ID', '配送先ID', '支払先ID', '源流リードID', '受注担当ID', '営業担当ID', '発送担当ID'] },
  { name: 'オーダー明細', headerRowNumber: 1, requiredIdHeaders: ['明細ID', 'オーダーID', '商品ID'] },
  { name: '発送', headerRowNumber: 1, requiredIdHeaders: ['shipment_id', 'order_id', 'shipping_assignee_id'] },
  { name: '仕入れ', headerRowNumber: 1, requiredIdHeaders: ['仕入れID', 'オーダーID', '仕入れ担当ID'] },
  { name: 'フォームトークン', headerRowNumber: 1, requiredIdHeaders: ['トークン', 'リードID'] },
  { name: '商品マスタ同期', headerRowNumber: 1, requiredIdHeaders: ['product_id'] },
  { name: '担当者マスタ', headerRowNumber: 1, requiredIdHeaders: ['assignee_id'] }
];
const DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_LEGACY_INPUT = {
  name: '請求書作成',
  headerRowNumber: 1,
  currentInvoiceHeaders: ['カテゴリ', '状態', '商品名', '個数', '請求書項目', '価格', '合計']
};
const DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_LEGACY_SALES = {
  name: '📊売上データ',
  headerRowNumber: 4,
  currentInvoiceHeaders: [
    '取引状況商品名', '取引状況数量', '取引状況単価', '取引状況合計',
    '取引状況KEY', '取引状況請求書番号', '取引状況請求書リンク',
    '発送情報$内容品単価', '発送情報為替レート', '取引状況送料', '取引状況関税',
    '取引状況通貨', '取引状況決済', '取引状況取引先名', '取引状況受注担当者',
    '発送情報品目', '発送情報HSコード', '取引状況カテゴリ', '取引状況状態',
    '取引状況請求書内容', '取引状況請求書発行日', '取引状況支払期日',
    '取引状況為替レート', '発送情報受取人氏名', '発送情報電話番号',
    '発送情報メールアドレス', '発送情報TAX Number', '発送情報住所1',
    '発送情報住所2', '発送情報住所3', '発送情報都市名', '発送情報州',
    '発送情報ZIP CODE', '発送情報国名', '発送情報FedEx ID', '発送情報顧客ID',
    '発送情報Tax ID', '取引状況支払い名義', '取引状況営業担当者'
  ]
};

function auditDevCoreSchemaV1HeaderDetailV3() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevCoreSchemaV1HeaderDetailV3 is available only in development');
  }
  const spreadsheet = getSpreadsheet();
  return {
    success: true,
    resultType: 'DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_SUCCEEDED',
    auditVersion: DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_VERSION,
    actualDataChangeCount: 0,
    schemaReportText: buildDevCoreSchemaV1HeaderDetailAuditV3SchemaReportText(spreadsheet)
  };
}

function buildDevCoreSchemaV1HeaderDetailAuditV3SchemaReportText(spreadsheet) {
  const coreReports = DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_SHEETS.map(specification =>
    buildDevCoreSchemaV1HeaderDetailAuditV3CoreReportLine(spreadsheet, specification)
  );
  return coreReports.concat([
    buildDevCoreSchemaV1HeaderDetailAuditV3LegacyReportLine(
      spreadsheet,
      DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_LEGACY_INPUT,
      'LEGACY_INPUT'
    ),
    buildDevCoreSchemaV1HeaderDetailAuditV3LegacyReportLine(
      spreadsheet,
      DEV_CORE_SCHEMA_V1_HEADER_DETAIL_AUDIT_V3_LEGACY_SALES,
      'LEGACY_SALES'
    )
  ]).join('\n');
}

function buildDevCoreSchemaV1HeaderDetailAuditV3CoreReportLine(spreadsheet, specification) {
  const sheet = spreadsheet.getSheetByName(specification.name);
  return buildDevCoreSchemaV1HeaderDetailAuditV3ReportLine(
    'CORE_SCHEMA',
    sheet,
    specification,
    'requiredIdHeaderStatus',
    specification.requiredIdHeaders
  );
}

function buildDevCoreSchemaV1HeaderDetailAuditV3LegacyReportLine(spreadsheet, specification, sectionName) {
  return buildDevCoreSchemaV1HeaderDetailAuditV3ReportLine(
    sectionName,
    spreadsheet.getSheetByName(specification.name),
    specification,
    'currentInvoiceRequiredHeaderStatus',
    specification.currentInvoiceHeaders
  );
}

function buildDevCoreSchemaV1HeaderDetailAuditV3ReportLine(sectionName, sheet, specification, statusProperty, requiredHeaders) {
  if (!sheet) {
    return formatDevCoreSchemaV1HeaderDetailAuditV3ReportLine(
      sectionName, specification, false, 0, '', '', statusProperty,
      formatDevCoreSchemaV1HeaderDetailAuditV3HeaderStatus(requiredHeaders, [])
    );
  }
  const columnCount = sheet.getLastColumn();
  const headers = columnCount > 0
    ? sheet.getRange(specification.headerRowNumber, 1, 1, columnCount).getDisplayValues()[0].map(header => String(header).trim())
    : [];
  return formatDevCoreSchemaV1HeaderDetailAuditV3ReportLine(
    sectionName,
    specification,
    true,
    columnCount,
    headers.map((header, index) => (index + 1) + ':' + header).join(' | '),
    formatDevCoreSchemaV1HeaderDetailAuditV3Duplicates(headers),
    statusProperty,
    formatDevCoreSchemaV1HeaderDetailAuditV3HeaderStatus(requiredHeaders, headers)
  );
}

function formatDevCoreSchemaV1HeaderDetailAuditV3ReportLine(sectionName, specification, exists, columnCount, headerColumns, duplicates, statusProperty, status) {
  return sectionName +
    ' | sheetName=' + specification.name +
    ' | headerRowNumber=' + specification.headerRowNumber +
    ' | exists=' + exists +
    ' | columnCount=' + columnCount +
    ' | headerColumns=' + headerColumns +
    ' | nonEmptyHeaderDuplicates=' + duplicates +
    ' | ' + statusProperty + '=' + status;
}

function formatDevCoreSchemaV1HeaderDetailAuditV3Duplicates(headers) {
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

function formatDevCoreSchemaV1HeaderDetailAuditV3HeaderStatus(requiredHeaders, headers) {
  return requiredHeaders.map(header => header + ':' + (headers.indexOf(header) === -1 ? '不在' : '存在')).join(' | ');
}
