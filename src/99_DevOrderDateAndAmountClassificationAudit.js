/**
 * DEVの受注日補完可否と受注額分類の前提を、値を返さず件数だけで監査する。
 */
const DEV_ORDER_DATE_AMOUNT_AUDIT_VERSION = '1';
const DEV_ORDER_DATE_AMOUNT_AUDIT_SHEET = 'オーダー管理';
const DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_ID_HEADER = 'オーダーID';
const DEV_ORDER_DATE_AMOUNT_AUDIT_STATUS_HEADER = 'ステータス';
const DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_DATE_HEADER = '受注日';
// 既存コードの受注日補完処理が明示する唯一の補完元。
const DEV_ORDER_DATE_AMOUNT_AUDIT_DATE_CANDIDATE_HEADERS = ['請求書発行日'];
const DEV_ORDER_DATE_AMOUNT_AUDIT_CANCELLED_STATUS = 'キャンセル';
const DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID =
  'ORDER_DATE_AND_AMOUNT_CLASSIFICATION_SCHEMA_INVALID';
const DEV_ORDER_DATE_AMOUNT_AUDIT_COMPLETION_UNDEFINED =
  'ORDER_COMPLETION_CLASSIFICATION_UNDEFINED';
const DEV_ORDER_DATE_AMOUNT_AUDIT_FAILED = 'ORDER_DATE_AND_AMOUNT_CLASSIFICATION_FAILED';

function auditDevOrderDateAndAmountClassification() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevOrderDateAndAmountClassification is available only in development');
  }
  try {
    return buildDevOrderDateAndAmountClassification(getSpreadsheet());
  } catch (error) {
    return {
      success: false,
      resultType: isDevOrderDateAmountSchemaError(error)
        ? DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID
        : DEV_ORDER_DATE_AMOUNT_AUDIT_FAILED,
      auditVersion: DEV_ORDER_DATE_AMOUNT_AUDIT_VERSION,
      actualDataChangeCount: 0
    };
  }
}

function buildDevOrderDateAndAmountClassification(spreadsheet) {
  const orders = readDevOrderDateAmountAuditOrders(spreadsheet);
  const orderRows = orders.rows.filter(row =>
    !isDevOrderDateAmountAuditEmpty(getDevOrderDateAmountAuditValue(
      orders, row, DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_ID_HEADER
    ))
  );
  const orderDateCompletion = auditDevOrderDateAmountCompletion(orders, orderRows);
  const amountClassification = auditDevOrderDateAmountClassification(orders, orderRows);
  return {
    success: true,
    resultType: DEV_ORDER_DATE_AMOUNT_AUDIT_COMPLETION_UNDEFINED,
    auditVersion: DEV_ORDER_DATE_AMOUNT_AUDIT_VERSION,
    actualDataChangeCount: 0,
    orderDateCompletion: orderDateCompletion,
    amountClassification: amountClassification
  };
}

function readDevOrderDateAmountAuditOrders(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(DEV_ORDER_DATE_AMOUNT_AUDIT_SHEET);
  if (!sheet || sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) {
    throw new Error(DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID);
  }
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevOrderDateAmountAuditHeaderIndexes(headers);
  [
    DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_ID_HEADER,
    DEV_ORDER_DATE_AMOUNT_AUDIT_STATUS_HEADER,
    DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_DATE_HEADER
  ].concat(DEV_ORDER_DATE_AMOUNT_AUDIT_DATE_CANDIDATE_HEADERS)
    .forEach(header => requireDevOrderDateAmountAuditHeader(indexes, header));
  const range = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn) : null;
  const values = range ? range.getValues() : [];
  const formulas = range ? range.getFormulas() : [];
  return {
    indexes: indexes,
    rows: values.reduce((result, row, index) => {
      if (isDevOrderDateAmountAuditRecord(row, formulas[index])) result.push(row);
      return result;
    }, [])
  };
}

function getDevOrderDateAmountAuditHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevOrderDateAmountAuditHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID);
  }
  return indexes[header];
}

function getDevOrderDateAmountAuditValue(orders, row, header) {
  return row[requireDevOrderDateAmountAuditHeader(orders.indexes, header)];
}

function isDevOrderDateAmountAuditRecord(row, formulas) {
  return row.some((value, index) =>
    !isDevOrderDateAmountAuditEmpty(value) || !isDevOrderDateAmountAuditEmpty(formulas[index])
  );
}

function auditDevOrderDateAmountCompletion(orders, orderRows) {
  const candidateCounts = {};
  DEV_ORDER_DATE_AMOUNT_AUDIT_DATE_CANDIDATE_HEADERS.forEach(header => {
    candidateCounts[header] = {
      validDateCount: 0,
      emptyDateCount: 0,
      invalidDateCount: 0
    };
  });
  let blankOrderDateOrderCount = 0;
  let multipleCandidateDateDisagreementCount = 0;
  let uniquelyResolvableFillCount = 0;
  let heldFillCount = 0;
  orderRows.forEach(row => {
    if (getDevOrderDateAmountAuditDateState(
      getDevOrderDateAmountAuditValue(orders, row, DEV_ORDER_DATE_AMOUNT_AUDIT_ORDER_DATE_HEADER)
    ) !== 'empty') return;
    blankOrderDateOrderCount += 1;
    const candidates = DEV_ORDER_DATE_AMOUNT_AUDIT_DATE_CANDIDATE_HEADERS.map(header => {
      const value = getDevOrderDateAmountAuditValue(orders, row, header);
      const state = getDevOrderDateAmountAuditDateState(value);
      candidateCounts[header][state + 'DateCount'] += 1;
      return { state: state, value: value };
    });
    const candidateResult = classifyDevOrderDateAmountAuditCandidates(candidates);
    if (candidateResult.hasMultipleValidDisagreement) {
      multipleCandidateDateDisagreementCount += 1;
      heldFillCount += 1;
    } else if (candidateResult.hasExactlyOneResolvedDate) {
      uniquelyResolvableFillCount += 1;
    } else {
      heldFillCount += 1;
    }
  });
  return {
    blankOrderDateOrderCount: blankOrderDateOrderCount,
    candidateDateCounts: candidateCounts,
    multipleCandidateDateDisagreementCount: multipleCandidateDateDisagreementCount,
    uniquelyResolvableFillCount: uniquelyResolvableFillCount,
    heldFillCount: heldFillCount
  };
}

function classifyDevOrderDateAmountAuditCandidates(candidates) {
  const validTimes = candidates.filter(candidate => candidate.state === 'valid')
    .map(candidate => getDevOrderDateAmountAuditDateTime(candidate.value));
  const distinctValidTimes = new Set(validTimes);
  return {
    hasMultipleValidDisagreement: distinctValidTimes.size > 1,
    hasExactlyOneResolvedDate: distinctValidTimes.size === 1
  };
}

function auditDevOrderDateAmountClassification(orders, orderRows) {
  let statusEmptyCount = 0;
  let existingCodeCancelledOrderCount = 0;
  let completionClassifiedOrderCount = 0;
  let neitherCancelledNorCompletedOrderCount = 0;
  orderRows.forEach(row => {
    const status = getDevOrderDateAmountAuditValue(
      orders, row, DEV_ORDER_DATE_AMOUNT_AUDIT_STATUS_HEADER
    );
    if (isDevOrderDateAmountAuditEmpty(status) || String(status).trim() === '') {
      statusEmptyCount += 1;
    }
    if (String(status).trim() === DEV_ORDER_DATE_AMOUNT_AUDIT_CANCELLED_STATUS) {
      existingCodeCancelledOrderCount += 1;
    } else {
      // 現行コードにオーダー完了を判定する条件がないため、推測で分類しない。
      neitherCancelledNorCompletedOrderCount += 1;
    }
  });
  return {
    orderRecordCount: orderRows.length,
    statusEmptyCount: statusEmptyCount,
    existingCodeCancelledOrderCount: existingCodeCancelledOrderCount,
    completionClassifiedOrderCount: completionClassifiedOrderCount,
    neitherCancelledNorCompletedOrderCount: neitherCancelledNorCompletedOrderCount,
    completionClassificationResultType: DEV_ORDER_DATE_AMOUNT_AUDIT_COMPLETION_UNDEFINED
  };
}

function getDevOrderDateAmountAuditDateState(value) {
  if (isDevOrderDateAmountAuditEmpty(value)) return 'empty';
  return getDevOrderDateAmountAuditDateTime(value) === null ? 'invalid' : 'valid';
}

function getDevOrderDateAmountAuditDateTime(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime()
    : null;
}

function isDevOrderDateAmountAuditEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}

function isDevOrderDateAmountSchemaError(error) {
  return error && error.message === DEV_ORDER_DATE_AMOUNT_AUDIT_SCHEMA_INVALID;
}
