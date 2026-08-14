/**
 * DEVの注文金額を、ステータス別に読み取り分類する。
 * ID、氏名、注文内容、金額明細、URL、セル値は返却・記録しない。
 */
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_VERSION = '1';
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID =
  'ORDER_AMOUNT_CLASSIFICATION_SCHEMA_INVALID';
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_FAILED =
  'ORDER_AMOUNT_CLASSIFICATION_AUDIT_FAILED';
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SHEET = 'オーダー管理';
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_HEADERS = [
  'オーダーID', 'ステータス', '請求総額'
];
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_CANCELLED_STATUS = 'キャンセル';
const DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_COMPLETED_STATUS = '完了';

function auditDevOrderAmountClassification() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevOrderAmountClassification is available only in development');
  }
  try {
    return buildDevOrderAmountClassificationAudit(getSpreadsheet());
  } catch (error) {
    return {
      success: false,
      resultType: isDevOrderAmountClassificationAuditSchemaError(error)
        ? DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID
        : DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_FAILED,
      auditVersion: DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_VERSION,
      actualDataChangeCount: 0
    };
  }
}

function buildDevOrderAmountClassificationAudit(spreadsheet) {
  const orders = readDevOrderAmountClassificationAuditOrders(spreadsheet);
  const counts = createDevOrderAmountClassificationAuditCounts();
  orders.forEach(order => countDevOrderAmountClassificationAuditOrder(counts, order));
  return Object.assign({
    success: true,
    resultType: counts.invoiceTotalInvalidCount > 0
      ? 'ORDER_AMOUNT_CLASSIFICATION_INVALID_AMOUNT_FOUND'
      : 'ORDER_AMOUNT_CLASSIFICATION_COMPLETED',
    auditVersion: DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_VERSION,
    actualDataChangeCount: 0,
    amountReconciliationPassed: counts.totalOrderAmount ===
      counts.cancelledOrderAmount + counts.completedOrderAmount + counts.unconfirmedOrderAmount,
    orderCountReconciliationPassed: counts.orderRecordCount ===
      counts.cancelledOrderCount + counts.completedOrderCount + counts.unconfirmedOrderCount
  }, counts);
}

function readDevOrderAmountClassificationAuditOrders(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SHEET);
  if (!sheet || sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) {
    throw new Error(DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID);
  }
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevOrderAmountClassificationAuditHeaderIndexes(headers);
  DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_HEADERS.forEach(header =>
    requireDevOrderAmountClassificationAuditHeader(indexes, header)
  );
  const lastRow = sheet.getLastRow();
  if (lastRow === 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const idIndex = requireDevOrderAmountClassificationAuditHeader(indexes, 'オーダーID');
  const statusIndex = requireDevOrderAmountClassificationAuditHeader(indexes, 'ステータス');
  const amountIndex = requireDevOrderAmountClassificationAuditHeader(indexes, '請求総額');
  return values.filter(row => !isDevOrderAmountClassificationAuditEmpty(row[idIndex])).map(row => ({
    classification: getDevOrderAmountClassificationAuditStatusClassification(row[statusIndex]),
    amount: getDevOrderAmountClassificationAuditNumberState(row[amountIndex])
  }));
}

function getDevOrderAmountClassificationAuditHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevOrderAmountClassificationAuditHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID);
  }
  return indexes[header];
}

function getDevOrderAmountClassificationAuditStatusClassification(status) {
  const normalized = String(status || '').trim();
  if (normalized === DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_CANCELLED_STATUS) return 'cancelled';
  if (normalized === DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_COMPLETED_STATUS) return 'completed';
  return 'unconfirmed';
}

function getDevOrderAmountClassificationAuditNumberState(value) {
  if (isDevOrderAmountClassificationAuditEmpty(value)) return { state: 'empty' };
  if (typeof value === 'number' && isFinite(value)) return { state: 'valid', value: value };
  if (typeof value !== 'string') return { state: 'invalid' };
  const normalized = value.trim();
  if (!/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) return { state: 'invalid' };
  const parsed = Number(normalized);
  return isFinite(parsed) ? { state: 'valid', value: parsed } : { state: 'invalid' };
}

function createDevOrderAmountClassificationAuditCounts() {
  return {
    orderRecordCount: 0,
    invoiceTotalValidCount: 0,
    invoiceTotalEmptyCount: 0,
    invoiceTotalInvalidCount: 0,
    cancelledOrderCount: 0,
    completedOrderCount: 0,
    unconfirmedOrderCount: 0,
    totalOrderAmount: 0,
    cancelledOrderAmount: 0,
    completedOrderAmount: 0,
    unconfirmedOrderAmount: 0
  };
}

function countDevOrderAmountClassificationAuditOrder(counts, order) {
  counts.orderRecordCount += 1;
  counts[order.classification + 'OrderCount'] += 1;
  counts['invoiceTotal' + capitalizeDevOrderAmountClassificationAudit(order.amount.state) + 'Count'] += 1;
  if (order.amount.state !== 'valid') return;
  counts.totalOrderAmount += order.amount.value;
  counts[order.classification + 'OrderAmount'] += order.amount.value;
}

function capitalizeDevOrderAmountClassificationAudit(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isDevOrderAmountClassificationAuditEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined' ||
    (typeof value === 'string' && value.trim() === '');
}

function isDevOrderAmountClassificationAuditSchemaError(error) {
  return error && error.message === DEV_ORDER_AMOUNT_CLASSIFICATION_AUDIT_SCHEMA_INVALID;
}
