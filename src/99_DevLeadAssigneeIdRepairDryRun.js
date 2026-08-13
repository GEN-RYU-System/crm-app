/**
 * DEVのリード担当者ID置換候補を、書き込まず件数だけで確認する。
 */
const DEV_LEAD_ASSIGNEE_DRY_RUN_LEADS_SHEET = 'リード管理';
const DEV_LEAD_ASSIGNEE_DRY_RUN_STAFF_SHEET = '担当者マスタ';
const DEV_LEAD_ASSIGNEE_DRY_RUN_ID_HEADER = '担当者ID';
const DEV_LEAD_ASSIGNEE_DRY_RUN_NAME_HEADERS = [
  'リード担当者', '営業担当者', '担当者', '担当者名'
];

function dryRunDevLeadAssigneeIdRepair() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunDevLeadAssigneeIdRepair is available only in development');
  }
  try {
    return buildDevLeadAssigneeDryRun(getSpreadsheet());
  } catch (error) {
    return { success: false, errorType: 'LEAD_ASSIGNEE_ID_REPAIR_DRY_RUN_FAILED' };
  }
}

function buildDevLeadAssigneeDryRun(spreadsheet) {
  const leads = getDevLeadAssigneeDryRunSheetData(
    spreadsheet, DEV_LEAD_ASSIGNEE_DRY_RUN_LEADS_SHEET
  );
  const staff = getDevLeadAssigneeDryRunSheetData(
    spreadsheet, DEV_LEAD_ASSIGNEE_DRY_RUN_STAFF_SHEET
  );
  const leadIdIndex = requireDevLeadAssigneeDryRunHeader(
    leads.headerIndexes, DEV_LEAD_ASSIGNEE_DRY_RUN_ID_HEADER
  );
  const staffIdIndex = requireDevLeadAssigneeDryRunHeader(
    staff.headerIndexes, DEV_LEAD_ASSIGNEE_DRY_RUN_ID_HEADER
  );
  const currentStaffIds = new Set();
  const currentStaffNames = new Map();
  staff.rows.forEach(row => {
    const staffId = row[staffIdIndex];
    getDevLeadAssigneeDryRunStaffNames(row, staff.headerIndexes).forEach(name => {
      const candidates = currentStaffNames.get(name) || { ids: new Set(), unresolved: false };
      if (isDevLeadAssigneeDryRunEmpty(staffId)) {
        candidates.unresolved = true;
      } else {
        candidates.ids.add(String(staffId));
        currentStaffIds.add(String(staffId));
      }
      currentStaffNames.set(name, candidates);
    });
    if (!isDevLeadAssigneeDryRunEmpty(staffId)) currentStaffIds.add(String(staffId));
  });
  const nameHeaders = DEV_LEAD_ASSIGNEE_DRY_RUN_NAME_HEADERS
    .filter(header => Object.prototype.hasOwnProperty.call(leads.headerIndexes, header));
  const groupsById = new Map();
  let emptyAssigneeIdCount = 0;
  let currentStaffIdRecordCount = 0;

  leads.rows.forEach(row => {
    const assigneeId = row[leadIdIndex];
    if (isDevLeadAssigneeDryRunEmpty(assigneeId)) {
      emptyAssigneeIdCount += 1;
      return;
    }
    if (currentStaffIds.has(String(assigneeId))) {
      currentStaffIdRecordCount += 1;
      return;
    }
    const group = groupsById.get(String(assigneeId)) || createDevLeadAssigneeDryRunGroup(groupsById.size + 1);
    group.orphanLeadRecordCount += 1;
    classifyDevLeadAssigneeDryRunCandidate(
      row, leads.headerIndexes, nameHeaders, currentStaffNames, group
    );
    groupsById.set(String(assigneeId), group);
  });

  const groups = Array.from(groupsById.values());
  const orphanLeadAssigneeIdCount = groups.reduce(
    (sum, group) => sum + group.orphanLeadRecordCount, 0
  );
  const replaceableCount = groups.reduce((sum, group) => sum + group.replaceableCount, 0);
  const pendingCount = groups.reduce((sum, group) => sum + group.pendingCount, 0);
  return {
    success: true,
    leadNonEmptyRecordCount: leads.rows.length,
    emptyAssigneeIdCount: emptyAssigneeIdCount,
    currentStaffIdRecordCount: currentStaffIdRecordCount,
    orphanLeadAssigneeIdCount: orphanLeadAssigneeIdCount,
    replaceableCount: replaceableCount,
    pendingCount: pendingCount,
    groups: groups,
    orphanCountReconciliation: orphanLeadAssigneeIdCount === replaceableCount + pendingCount,
    actualDataChangeCount: 0
  };
}

function createDevLeadAssigneeDryRunGroup(sequence) {
  return {
    group: 'GROUP_' + String(sequence).padStart(2, '0'),
    orphanLeadRecordCount: 0,
    replaceableCount: 0,
    pendingCount: 0,
    supplementalNameBlankCount: 0,
    currentStaffNameUniqueMatchCount: 0,
    currentStaffNameAmbiguousMatchCount: 0,
    currentStaffNameMismatchCount: 0,
    currentStaffIdUnresolvedCount: 0
  };
}

function classifyDevLeadAssigneeDryRunCandidate(row, headerIndexes, nameHeaders, names, group) {
  const rawName = nameHeaders.map(header => row[headerIndexes[header]])
    .find(value => !isDevLeadAssigneeDryRunEmpty(value));
  const normalizedName = normalizeDevLeadAssigneeDryRunName(rawName);
  if (!normalizedName) {
    group.supplementalNameBlankCount += 1;
    group.pendingCount += 1;
    return;
  }
  const candidates = names.get(normalizedName);
  if (!candidates) {
    group.currentStaffNameMismatchCount += 1;
    group.pendingCount += 1;
  } else if (candidates.unresolved && candidates.ids.size === 0) {
    group.currentStaffIdUnresolvedCount += 1;
    group.pendingCount += 1;
  } else if (candidates.unresolved || candidates.ids.size > 1) {
    group.currentStaffNameAmbiguousMatchCount += 1;
    group.pendingCount += 1;
  } else {
    group.currentStaffNameUniqueMatchCount += 1;
    group.replaceableCount += 1;
  }
}

function getDevLeadAssigneeDryRunStaffNames(row, headerIndexes) {
  const names = new Set();
  ['氏名（日本語）', '氏名', '担当者名'].forEach(header => {
    if (Object.prototype.hasOwnProperty.call(headerIndexes, header)) {
      const normalized = normalizeDevLeadAssigneeDryRunName(row[headerIndexes[header]]);
      if (normalized) names.add(normalized);
    }
  });
  if (
    Object.prototype.hasOwnProperty.call(headerIndexes, '苗字（日本語）') &&
    Object.prototype.hasOwnProperty.call(headerIndexes, '名前（日本語）')
  ) {
    const normalized = normalizeDevLeadAssigneeDryRunName(
      String(row[headerIndexes['苗字（日本語）']] || '') +
      String(row[headerIndexes['名前（日本語）']] || '')
    );
    if (normalized) names.add(normalized);
  }
  return Array.from(names);
}

function getDevLeadAssigneeDryRunSheetData(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Required repair dry-run sheet is missing');
  const values = sheet.getDataRange().getValues();
  if (values.length === 0 || values[0].length === 0) {
    throw new Error('Required repair dry-run headers are missing');
  }
  return {
    headerIndexes: getDevLeadAssigneeDryRunHeaderIndexes(values[0]),
    rows: values.slice(1).filter(row => row.some(value => !isDevLeadAssigneeDryRunEmpty(value)))
  };
}

function getDevLeadAssigneeDryRunHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    if (isDevLeadAssigneeDryRunEmpty(header)) return;
    if (Object.prototype.hasOwnProperty.call(indexes, header)) {
      throw new Error('Repair dry-run header is duplicated');
    }
    indexes[header] = index;
  });
  return indexes;
}

function requireDevLeadAssigneeDryRunHeader(headerIndexes, header) {
  if (!Object.prototype.hasOwnProperty.call(headerIndexes, header)) {
    throw new Error('Required repair dry-run header is missing');
  }
  return headerIndexes[header];
}

function normalizeDevLeadAssigneeDryRunName(value) {
  if (isDevLeadAssigneeDryRunEmpty(value)) return '';
  return String(value).replace(/[\s　]+/g, '').toLowerCase();
}

function isDevLeadAssigneeDryRunEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}
