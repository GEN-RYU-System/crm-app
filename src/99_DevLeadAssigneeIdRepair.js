/**
 * DEVのリード管理にある孤立担当者IDを、検証済みの現担当者IDへ一括置換する。
 * ID・氏名・セル値はメモリ内だけで扱い、結果には件数のみを返す。
 */
const DEV_LEAD_ASSIGNEE_REPAIR_SHEET = 'リード管理';
const DEV_LEAD_ASSIGNEE_REPAIR_STAFF_SHEET = '担当者マスタ';
const DEV_LEAD_ASSIGNEE_REPAIR_ID_HEADER = '担当者ID';
const DEV_LEAD_ASSIGNEE_REPAIR_NAME_HEADERS = [
  'リード担当者', '営業担当者', '担当者', '担当者名'
];

function repairDevLeadAssigneeIds() {
  if (getEnvironment() !== 'development') {
    throw new Error('repairDevLeadAssigneeIds is available only in development');
  }
  let lock;
  let lockAcquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    lockAcquired = true;
    const plan = buildDevLeadAssigneeIdRepairPlan(getSpreadsheet());
    if (!plan.isSafeToWrite) {
      return buildDevLeadAssigneeRepairResult(false, 'REPAIR_PRECONDITION_FAILED', plan, 0);
    }
    if (!isDevLeadAssigneeRepairSnapshotCurrent(plan)) {
      return buildDevLeadAssigneeRepairResult(false, 'REPAIR_SOURCE_CHANGED', plan, 0);
    }
    try {
      plan.targetRange.setValues(plan.replacementValues);
      return buildDevLeadAssigneeRepairResult(true, 'REPAIR_SUCCEEDED', plan, plan.replaceableCount);
    } catch (error) {
      try {
        plan.targetRange.setValues(plan.originalTargetValues);
        return buildDevLeadAssigneeRepairResult(false, 'REPAIR_WRITE_FAILED_ROLLED_BACK', plan, 0);
      } catch (rollbackError) {
        return buildDevLeadAssigneeRepairResult(false, 'REPAIR_WRITE_FAILED_ROLLBACK_FAILED', plan, 0);
      }
    }
  } catch (error) {
    return { success: false, errorType: 'REPAIR_LOCK_OR_READ_FAILED', actualDataChangeCount: 0 };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function buildDevLeadAssigneeIdRepairPlan(spreadsheet) {
  const leadsSheet = requireDevLeadAssigneeRepairSheet(spreadsheet, DEV_LEAD_ASSIGNEE_REPAIR_SHEET);
  const staffSheet = requireDevLeadAssigneeRepairSheet(spreadsheet, DEV_LEAD_ASSIGNEE_REPAIR_STAFF_SHEET);
  const leadValues = leadsSheet.getDataRange().getValues();
  const staffValues = staffSheet.getDataRange().getValues();
  const leadHeaders = requireDevLeadAssigneeRepairHeaders(leadValues);
  const staffHeaders = requireDevLeadAssigneeRepairHeaders(staffValues);
  const leadIdIndex = requireDevLeadAssigneeRepairHeader(leadHeaders, DEV_LEAD_ASSIGNEE_REPAIR_ID_HEADER);
  const staffIdIndex = requireDevLeadAssigneeRepairHeader(staffHeaders, DEV_LEAD_ASSIGNEE_REPAIR_ID_HEADER);
  const staffByName = buildDevLeadAssigneeRepairStaffByName(staffValues.slice(1), staffHeaders, staffIdIndex);
  const nameIndexes = DEV_LEAD_ASSIGNEE_REPAIR_NAME_HEADERS
    .filter(header => Object.prototype.hasOwnProperty.call(leadHeaders, header))
    .map(header => leadHeaders[header]);
  const rows = leadValues.slice(1);
  const originalTargetValues = rows.map(row => [row[leadIdIndex]]);
  const replacementValues = rows.map(row => [row[leadIdIndex]]);
  const sourceSnapshot = rows.map(row => ({
    id: row[leadIdIndex],
    names: nameIndexes.map(index => row[index])
  }));
  const groupsById = new Map();
  let emptyAssigneeIdCount = 0;
  let currentStaffIdRecordCount = 0;

  rows.forEach((row, rowIndex) => {
    const assigneeId = row[leadIdIndex];
    if (isDevLeadAssigneeRepairEmpty(assigneeId)) {
      emptyAssigneeIdCount += 1;
      return;
    }
    if (staffByName.currentIds.has(String(assigneeId))) {
      currentStaffIdRecordCount += 1;
      return;
    }
    const group = groupsById.get(String(assigneeId)) || createDevLeadAssigneeRepairGroup(groupsById.size + 1);
    group.orphanLeadRecordCount += 1;
    const candidate = resolveDevLeadAssigneeRepairCandidate(row, nameIndexes, staffByName.names);
    if (candidate.status === 'UNIQUE') {
      group.replaceableCount += 1;
      replacementValues[rowIndex] = [candidate.staffId];
    } else {
      group.pendingCount += 1;
      group[candidate.counter] += 1;
    }
    groupsById.set(String(assigneeId), group);
  });

  const groups = Array.from(groupsById.values());
  const orphanLeadAssigneeIdCount = groups.reduce((sum, group) => sum + group.orphanLeadRecordCount, 0);
  const replaceableCount = groups.reduce((sum, group) => sum + group.replaceableCount, 0);
  const pendingCount = groups.reduce((sum, group) => sum + group.pendingCount, 0);
  return {
    leadsSheet: leadsSheet,
    leadIdIndex: leadIdIndex,
    nameIndexes: nameIndexes,
    sourceSnapshot: sourceSnapshot,
    targetRange: leadsSheet.getRange(2, leadIdIndex + 1, rows.length, 1),
    originalTargetValues: originalTargetValues,
    replacementValues: replacementValues,
    leadNonEmptyRecordCount: rows.filter(isDevLeadAssigneeRepairNonEmptyRow).length,
    emptyAssigneeIdCount: emptyAssigneeIdCount,
    currentStaffIdRecordCount: currentStaffIdRecordCount,
    orphanLeadAssigneeIdCount: orphanLeadAssigneeIdCount,
    replaceableCount: replaceableCount,
    pendingCount: pendingCount,
    groups: groups,
    isSafeToWrite: pendingCount === 0 &&
      orphanLeadAssigneeIdCount === replaceableCount &&
      orphanLeadAssigneeIdCount === replaceableCount + pendingCount
  };
}

function buildDevLeadAssigneeRepairStaffByName(rows, headerIndexes, staffIdIndex) {
  const currentIds = new Set();
  const names = new Map();
  const duplicateIds = new Set();
  rows.forEach(row => {
    if (isDevLeadAssigneeRepairEmpty(row[staffIdIndex])) return;
    const staffId = String(row[staffIdIndex]);
    if (currentIds.has(staffId)) duplicateIds.add(staffId);
    currentIds.add(staffId);
    getDevLeadAssigneeRepairStaffNames(row, headerIndexes).forEach(name => {
      const ids = names.get(name) || new Set();
      ids.add(staffId);
      names.set(name, ids);
    });
  });
  if (duplicateIds.size > 0) throw new Error('Staff ID is duplicated');
  return { currentIds: currentIds, names: names };
}

function resolveDevLeadAssigneeRepairCandidate(row, nameIndexes, staffNames) {
  const rawName = nameIndexes.map(index => row[index])
    .find(value => !isDevLeadAssigneeRepairEmpty(value));
  const name = normalizeDevLeadAssigneeRepairName(rawName);
  if (!name) return { status: 'PENDING', counter: 'supplementalNameBlankCount' };
  const ids = staffNames.get(name);
  if (!ids) return { status: 'PENDING', counter: 'currentStaffNameMismatchCount' };
  if (ids.size !== 1) return { status: 'PENDING', counter: 'currentStaffNameAmbiguousMatchCount' };
  return { status: 'UNIQUE', staffId: Array.from(ids)[0] };
}

function isDevLeadAssigneeRepairSnapshotCurrent(plan) {
  const values = plan.leadsSheet.getDataRange().getValues().slice(1);
  if (values.length !== plan.sourceSnapshot.length) return false;
  return values.every((row, index) => {
    const snapshot = plan.sourceSnapshot[index];
    return String(row[plan.leadIdIndex]) === String(snapshot.id) &&
      plan.nameIndexes.every((nameIndex, namePosition) =>
        String(row[nameIndex]) === String(snapshot.names[namePosition])
      );
  });
}

function buildDevLeadAssigneeRepairResult(success, type, plan, actualDataChangeCount) {
  return {
    success: success,
    resultType: type,
    leadNonEmptyRecordCount: plan.leadNonEmptyRecordCount,
    emptyAssigneeIdCount: plan.emptyAssigneeIdCount,
    currentStaffIdRecordCount: plan.currentStaffIdRecordCount,
    orphanLeadAssigneeIdCount: plan.orphanLeadAssigneeIdCount,
    replaceableCount: plan.replaceableCount,
    pendingCount: plan.pendingCount,
    groups: plan.groups,
    orphanCountReconciliation: plan.orphanLeadAssigneeIdCount === plan.replaceableCount + plan.pendingCount,
    actualDataChangeCount: actualDataChangeCount
  };
}

function createDevLeadAssigneeRepairGroup(sequence) {
  return {
    group: 'GROUP_' + String(sequence).padStart(2, '0'),
    orphanLeadRecordCount: 0,
    replaceableCount: 0,
    pendingCount: 0,
    supplementalNameBlankCount: 0,
    currentStaffNameAmbiguousMatchCount: 0,
    currentStaffNameMismatchCount: 0
  };
}

function requireDevLeadAssigneeRepairSheet(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Required repair sheet is missing');
  return sheet;
}

function requireDevLeadAssigneeRepairHeaders(values) {
  if (values.length === 0 || values[0].length === 0) throw new Error('Required repair headers are missing');
  const indexes = {};
  values[0].forEach((header, index) => {
    if (isDevLeadAssigneeRepairEmpty(header)) return;
    if (Object.prototype.hasOwnProperty.call(indexes, header)) throw new Error('Repair header is duplicated');
    indexes[header] = index;
  });
  return indexes;
}

function requireDevLeadAssigneeRepairHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) throw new Error('Required repair header is missing');
  return indexes[header];
}

function getDevLeadAssigneeRepairStaffNames(row, indexes) {
  const names = new Set();
  ['氏名（日本語）', '氏名', '担当者名'].forEach(header => {
    if (Object.prototype.hasOwnProperty.call(indexes, header)) {
      const name = normalizeDevLeadAssigneeRepairName(row[indexes[header]]);
      if (name) names.add(name);
    }
  });
  if (Object.prototype.hasOwnProperty.call(indexes, '苗字（日本語）') && Object.prototype.hasOwnProperty.call(indexes, '名前（日本語）')) {
    const name = normalizeDevLeadAssigneeRepairName(String(row[indexes['苗字（日本語）']] || '') + String(row[indexes['名前（日本語）']] || ''));
    if (name) names.add(name);
  }
  return Array.from(names);
}

function normalizeDevLeadAssigneeRepairName(value) {
  if (isDevLeadAssigneeRepairEmpty(value)) return '';
  return String(value).replace(/[\s　]+/g, '').toLowerCase();
}

function isDevLeadAssigneeRepairEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}

function isDevLeadAssigneeRepairNonEmptyRow(row) {
  return row.some(value => !isDevLeadAssigneeRepairEmpty(value));
}
