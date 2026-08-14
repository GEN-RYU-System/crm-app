/**
 * DEVの未入金注文キャンセル化を、安全な固定期待値のときだけ実行する。
 * ID、氏名、日付、金額、URL、ステータス値、セル値は返却・記録しない。
 */
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_VERSION = '1';
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID =
  'UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID';
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_FAILED =
  'UNPAID_ORDER_CANCELLATION_REPAIR_FAILED';
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SHEET = 'オーダー管理';
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_HEADERS = [
  'オーダーID', 'ステータス', '支払確認日', '受注日'
];
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_CANCELLED_STATUS = 'キャンセル';
const DEV_UNPAID_ORDER_CANCELLATION_REPAIR_EXPECTED = {
  orderRecordCount: 172,
  paymentConfirmedDateValidCount: 124,
  paymentConfirmedDateEmptyCount: 48,
  paymentConfirmedDateInvalidCount: 0,
  existingCancelledCount: 44,
  unpaidExistingCancelledCount: 40,
  newCancellationCandidateCount: 8,
  paidExistingCancelledConflictCount: 4,
  newCancellationCandidateBlankOrderDateOverlapCount: 1,
  blankOrderDateCount: 8
};

function repairDevUnpaidOrderCancellations() {
  if (getEnvironment() !== 'development') {
    throw new Error('repairDevUnpaidOrderCancellations is available only in development');
  }
  let lock;
  let hasLock = false;
  try {
    lock = LockService.getScriptLock();
    hasLock = lock.tryLock(5000);
    if (!hasLock) return createDevUnpaidOrderCancellationRepairFailure('REPAIR_LOCK_UNAVAILABLE');
    return buildDevUnpaidOrderCancellationRepair(getSpreadsheet());
  } catch (error) {
    return createDevUnpaidOrderCancellationRepairFailure(
      isDevUnpaidOrderCancellationRepairSchemaError(error)
        ? DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID
        : DEV_UNPAID_ORDER_CANCELLATION_REPAIR_FAILED
    );
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function buildDevUnpaidOrderCancellationRepair(spreadsheet) {
  const inspection = readDevUnpaidOrderCancellationRepairInspection(spreadsheet);
  const counts = inspectDevUnpaidOrderCancellationRepairOrders(inspection);
  if (!matchesDevUnpaidOrderCancellationRepairExpectation(counts)) {
    return createDevUnpaidOrderCancellationRepairFailure('REPAIR_EXPECTATION_MISMATCH');
  }
  if (inspection.statusFormulas.some(formula => !isDevUnpaidOrderCancellationRepairEmpty(formula))) {
    return createDevUnpaidOrderCancellationRepairFailure('REPAIR_TARGET_FORMULA_FOUND');
  }
  if (!isDevUnpaidOrderCancellationRepairSourceUnchanged(inspection)) {
    return createDevUnpaidOrderCancellationRepairFailure('REPAIR_SOURCE_CHANGED');
  }
  return writeDevUnpaidOrderCancellationRepairStatuses(inspection, counts);
}

function readDevUnpaidOrderCancellationRepairInspection(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SHEET);
  if (!sheet || sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) {
    throw new Error(DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID);
  }
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevUnpaidOrderCancellationRepairHeaderIndexes(headers);
  DEV_UNPAID_ORDER_CANCELLATION_REPAIR_HEADERS.forEach(header =>
    requireDevUnpaidOrderCancellationRepairHeader(indexes, header)
  );
  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(0, lastRow - 1);
  const valuesRange = rowCount > 0 ? sheet.getRange(2, 1, rowCount, lastColumn) : null;
  const values = valuesRange ? valuesRange.getValues() : [];
  const statusIndex = requireDevUnpaidOrderCancellationRepairHeader(indexes, 'ステータス');
  const statusRange = rowCount > 0 ? sheet.getRange(2, statusIndex + 1, rowCount, 1) : null;
  const statusFormulas = statusRange ? statusRange.getFormulas().map(row => row[0]) : [];
  return {
    sheet: sheet,
    indexes: indexes,
    values: values,
    rowCount: rowCount,
    lastColumn: lastColumn,
    statusRange: statusRange,
    statusFormulas: statusFormulas
  };
}

function getDevUnpaidOrderCancellationRepairHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevUnpaidOrderCancellationRepairHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID);
  }
  return indexes[header];
}

function inspectDevUnpaidOrderCancellationRepairOrders(inspection) {
  const counts = createDevUnpaidOrderCancellationRepairCounts();
  const idIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, 'オーダーID');
  const statusIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, 'ステータス');
  const paymentIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, '支払確認日');
  const orderDateIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, '受注日');
  inspection.candidates = [];
  inspection.values.forEach((row, rowIndex) => {
    if (isDevUnpaidOrderCancellationRepairEmpty(row[idIndex])) return;
    const paymentConfirmedDateState = getDevUnpaidOrderCancellationRepairDateState(row[paymentIndex]);
    const isCancelled = String(row[statusIndex] || '').trim() ===
      DEV_UNPAID_ORDER_CANCELLATION_REPAIR_CANCELLED_STATUS;
    const orderDateEmpty = isDevUnpaidOrderCancellationRepairEmpty(row[orderDateIndex]);
    counts.orderRecordCount += 1;
    counts['paymentConfirmedDate' + capitalizeDevUnpaidOrderCancellationRepair(paymentConfirmedDateState) + 'Count'] += 1;
    if (orderDateEmpty) counts.blankOrderDateCount += 1;
    if (isCancelled) counts.existingCancelledCount += 1;
    if (paymentConfirmedDateState === 'empty' && isCancelled) {
      counts.unpaidExistingCancelledCount += 1;
      return;
    }
    if (paymentConfirmedDateState === 'empty' && !isCancelled) {
      counts.newCancellationCandidateCount += 1;
      if (orderDateEmpty) counts.newCancellationCandidateBlankOrderDateOverlapCount += 1;
      inspection.candidates.push({
        rowIndex: rowIndex,
        paymentConfirmedDate: row[paymentIndex],
        status: row[statusIndex]
      });
      return;
    }
    if (paymentConfirmedDateState === 'invalid') {
      counts.pendingCount += 1;
      return;
    }
    if (isCancelled) counts.paidExistingCancelledConflictCount += 1;
  });
  return counts;
}

function createDevUnpaidOrderCancellationRepairCounts() {
  return {
    orderRecordCount: 0,
    paymentConfirmedDateValidCount: 0,
    paymentConfirmedDateEmptyCount: 0,
    paymentConfirmedDateInvalidCount: 0,
    existingCancelledCount: 0,
    unpaidExistingCancelledCount: 0,
    newCancellationCandidateCount: 0,
    paidExistingCancelledConflictCount: 0,
    newCancellationCandidateBlankOrderDateOverlapCount: 0,
    blankOrderDateCount: 0,
    pendingCount: 0
  };
}

function matchesDevUnpaidOrderCancellationRepairExpectation(counts) {
  return Object.keys(DEV_UNPAID_ORDER_CANCELLATION_REPAIR_EXPECTED).every(key =>
    counts[key] === DEV_UNPAID_ORDER_CANCELLATION_REPAIR_EXPECTED[key]
  ) && counts.orderRecordCount ===
    counts.paymentConfirmedDateValidCount + counts.paymentConfirmedDateEmptyCount +
    counts.paymentConfirmedDateInvalidCount && counts.paymentConfirmedDateEmptyCount ===
    counts.unpaidExistingCancelledCount + counts.newCancellationCandidateCount;
}

function isDevUnpaidOrderCancellationRepairSourceUnchanged(inspection) {
  if (inspection.candidates.length === 0) return false;
  const latestValues = inspection.rowCount > 0
    ? inspection.sheet.getRange(2, 1, inspection.rowCount, inspection.lastColumn).getValues()
    : [];
  const statusIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, 'ステータス');
  const paymentIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, '支払確認日');
  return inspection.candidates.every(candidate =>
    areDevUnpaidOrderCancellationRepairValuesEqual(
      latestValues[candidate.rowIndex][paymentIndex], candidate.paymentConfirmedDate
    ) && areDevUnpaidOrderCancellationRepairValuesEqual(
      latestValues[candidate.rowIndex][statusIndex], candidate.status
    )
  );
}

function areDevUnpaidOrderCancellationRepairValuesEqual(left, right) {
  if (Object.prototype.toString.call(left) === '[object Date]' &&
      Object.prototype.toString.call(right) === '[object Date]') {
    return left.getTime() === right.getTime();
  }
  return left === right;
}

function writeDevUnpaidOrderCancellationRepairStatuses(inspection, counts) {
  const statusIndex = requireDevUnpaidOrderCancellationRepairHeader(inspection.indexes, 'ステータス');
  const oldStatuses = inspection.values.map(row => [row[statusIndex]]);
  const updatedStatuses = oldStatuses.map(row => [row[0]]);
  inspection.candidates.forEach(candidate => {
    updatedStatuses[candidate.rowIndex][0] = DEV_UNPAID_ORDER_CANCELLATION_REPAIR_CANCELLED_STATUS;
  });
  try {
    inspection.statusRange.setValues(updatedStatuses);
  } catch (error) {
    try {
      inspection.statusRange.setValues(oldStatuses);
      return createDevUnpaidOrderCancellationRepairFailure('REPAIR_WRITE_FAILED_RESTORED');
    } catch (restoreError) {
      return createDevUnpaidOrderCancellationRepairFailure('REPAIR_WRITE_FAILED_RESTORE_FAILED');
    }
  }
  return {
    success: true,
    resultType: 'REPAIR_SUCCEEDED',
    auditVersion: DEV_UNPAID_ORDER_CANCELLATION_REPAIR_VERSION,
    actualDataChangeCount: counts.newCancellationCandidateCount,
    updatedCancelledCount: counts.existingCancelledCount + counts.newCancellationCandidateCount,
    paidExistingCancelledConflictCount: counts.paidExistingCancelledConflictCount,
    blankOrderDateCount: counts.blankOrderDateCount
  };
}

function createDevUnpaidOrderCancellationRepairFailure(resultType) {
  return {
    success: false,
    resultType: resultType,
    auditVersion: DEV_UNPAID_ORDER_CANCELLATION_REPAIR_VERSION,
    actualDataChangeCount: 0
  };
}

function getDevUnpaidOrderCancellationRepairDateState(value) {
  if (isDevUnpaidOrderCancellationRepairEmpty(value)) return 'empty';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? 'invalid' : 'valid';
  }
  if (typeof value !== 'string') return 'invalid';
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return 'invalid';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day ? 'valid' : 'invalid';
}

function capitalizeDevUnpaidOrderCancellationRepair(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isDevUnpaidOrderCancellationRepairEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined' ||
    (typeof value === 'string' && value.trim() === '');
}

function isDevUnpaidOrderCancellationRepairSchemaError(error) {
  return error && error.message === DEV_UNPAID_ORDER_CANCELLATION_REPAIR_SCHEMA_INVALID;
}
