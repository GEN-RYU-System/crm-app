/**
 * DEVリード担当者割当ルールの影響を、書き込まず件数のみで確認する。
 */
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_SHEET = 'リード管理';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_LEAD_ID_HEADER = 'リードID';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ID_HEADER = '担当者ID';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADERS = [
  'リード担当者', '営業担当者', '担当者', '担当者名'
];
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_EMPTY_TARGET = 'EMP-00001';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_TARGET = 'EMP-00007';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_NAME = '阿部';
const DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADER_MISSING =
  'LEAD_ASSIGNEE_POLICY_NAME_HEADER_MISSING';

function dryRunDevLeadAssigneeAssignmentPolicy() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunDevLeadAssigneeAssignmentPolicy is available only in development');
  }
  try {
    return buildDevLeadAssigneePolicyDryRun(getSpreadsheet());
  } catch (error) {
    if (error && error.message === DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADER_MISSING) {
      return { success: false, errorType: DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADER_MISSING };
    }
    return { success: false, errorType: 'LEAD_ASSIGNEE_POLICY_DRY_RUN_FAILED' };
  }
}

function buildDevLeadAssigneePolicyDryRun(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_SHEET);
  if (!sheet) throw new Error('Required policy dry-run sheet is missing');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerIndexes = getDevLeadAssigneePolicyDryRunHeaderIndexes(headers);
  const leadIdIndex = requireDevLeadAssigneePolicyDryRunHeader(
    headerIndexes, DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_LEAD_ID_HEADER
  );
  const assigneeIdIndex = requireDevLeadAssigneePolicyDryRunHeader(
    headerIndexes, DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ID_HEADER
  );
  const nameIndexes = DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADERS
    .filter(header => Object.prototype.hasOwnProperty.call(headerIndexes, header))
    .map(header => headerIndexes[header]);
  if (nameIndexes.length === 0) {
    throw new Error(DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_NAME_HEADER_MISSING);
  }
  const lastRow = sheet.getLastRow();
  const recordCount = Math.max(lastRow - 1, 0);
  const leadIds = readDevLeadAssigneePolicyDryRunColumn(sheet, leadIdIndex, recordCount);
  const assigneeIds = readDevLeadAssigneePolicyDryRunColumn(
    sheet, assigneeIdIndex, recordCount
  );
  const nameColumns = nameIndexes.map(index => readDevLeadAssigneePolicyDryRunColumn(
    sheet, index, recordCount
  ));
  const counts = {
    leadNonEmptyRecordCount: 0,
    emptyAssigneeIdCount: 0,
    abeExactMatchCount: 0,
    abePartialOnlyMatchCount: 0,
    emptyAndAbeExactMatchCount: 0,
    emptyRuleMatchCount: 0,
    abeExactRuleMatchCount: 0,
    abeExactAlreadyEmp00007Count: 0,
    abeExactNeedsEmp00007Count: 0,
    alreadyEmp00001Count: 0,
    alreadyEmp00007Count: 0,
    neitherRuleMatchCount: 0
  };

  for (let rowIndex = 0; rowIndex < recordCount; rowIndex += 1) {
    if (isDevLeadAssigneePolicyDryRunEmpty(leadIds[rowIndex])) continue;
    const assigneeId = assigneeIds[rowIndex];
    const names = nameColumns.map(column => column[rowIndex]);
    counts.leadNonEmptyRecordCount += 1;
    const isEmpty = isDevLeadAssigneePolicyDryRunEmpty(assigneeId);
    const nameMatch = classifyDevLeadAssigneePolicyDryRunAbe(names);
    if (isEmpty) counts.emptyAssigneeIdCount += 1;
    if (nameMatch.exact) counts.abeExactMatchCount += 1;
    if (nameMatch.partialOnly) counts.abePartialOnlyMatchCount += 1;
    if (isEmpty && nameMatch.exact) counts.emptyAndAbeExactMatchCount += 1;
    if (isEmpty) counts.emptyRuleMatchCount += 1;
    if (nameMatch.exact) {
      counts.abeExactRuleMatchCount += 1;
      if (String(assigneeId) === DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_TARGET) {
        counts.abeExactAlreadyEmp00007Count += 1;
      } else {
        counts.abeExactNeedsEmp00007Count += 1;
      }
    }
    if (String(assigneeId) === DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_EMPTY_TARGET) {
      counts.alreadyEmp00001Count += 1;
    }
    if (String(assigneeId) === DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_TARGET) {
      counts.alreadyEmp00007Count += 1;
    }
    if (!isEmpty && !nameMatch.exact) counts.neitherRuleMatchCount += 1;
  }

  return Object.assign({ success: true, actualDataChangeCount: 0 }, counts);
}

function readDevLeadAssigneePolicyDryRunColumn(sheet, columnIndex, recordCount) {
  if (recordCount === 0) return [];
  return sheet.getRange(2, columnIndex + 1, recordCount, 1)
    .getValues()
    .map(row => row[0]);
}

function classifyDevLeadAssigneePolicyDryRunAbe(names) {
  const normalizedNames = names.map(normalizeDevLeadAssigneePolicyDryRunName)
    .filter(name => name !== '');
  const exact = normalizedNames.some(name => name === DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_NAME);
  const partial = normalizedNames.some(name =>
    name.includes(DEV_LEAD_ASSIGNEE_POLICY_DRY_RUN_ABE_NAME)
  );
  return { exact: exact, partialOnly: partial && !exact };
}

function getDevLeadAssigneePolicyDryRunHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    if (isDevLeadAssigneePolicyDryRunEmpty(header)) return;
    if (Object.prototype.hasOwnProperty.call(indexes, header)) {
      throw new Error('Policy dry-run header is duplicated');
    }
    indexes[header] = index;
  });
  return indexes;
}

function requireDevLeadAssigneePolicyDryRunHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error('Required policy dry-run header is missing');
  }
  return indexes[header];
}

function normalizeDevLeadAssigneePolicyDryRunName(value) {
  if (isDevLeadAssigneePolicyDryRunEmpty(value)) return '';
  return String(value).replace(/[\s　]+/g, '');
}

function isDevLeadAssigneePolicyDryRunEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}
