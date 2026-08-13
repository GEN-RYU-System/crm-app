/**
 * DEVのリード担当者ID孤立を、値を出さず件数だけで診断する。
 * 結果は戻り値のみで、シート・プロパティ・トリガーを変更しない。
 */
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_LEADS_SHEET = 'リード管理';
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_STAFF_SHEET = '担当者マスタ';
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER = '担当者ID';
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_NAME_HEADERS = [
  'リード担当者', '営業担当者', '担当者', '担当者名'
];
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_STAFF_NAME_HEADERS = [
  '氏名（日本語）', '苗字（日本語）', '名前（日本語）', '氏名', '担当者名'
];
const DEV_LEAD_ASSIGNEE_DIAGNOSIS_HISTORY_NAME_PATTERN =
  /(担当者|スタッフ|staff).*(履歴|退職|アーカイブ|バックアップ|旧|archive|backup|history)|(履歴|退職|アーカイブ|バックアップ|旧|archive|backup|history).*(担当者|スタッフ|staff)/i;

function diagnoseDevLeadAssigneeOrphans() {
  if (getEnvironment() !== 'development') {
    throw new Error('diagnoseDevLeadAssigneeOrphans is available only in development');
  }

  try {
    return buildDevLeadAssigneeOrphanDiagnosis(getSpreadsheet());
  } catch (error) {
    return { success: false, errorType: 'LEAD_ASSIGNEE_DIAGNOSIS_FAILED' };
  }
}

function buildDevLeadAssigneeOrphanDiagnosis(spreadsheet) {
  const leads = getDevLeadAssigneeDiagnosisSheetData(
    spreadsheet,
    DEV_LEAD_ASSIGNEE_DIAGNOSIS_LEADS_SHEET,
    [DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER]
  );
  const staff = getDevLeadAssigneeDiagnosisSheetData(
    spreadsheet,
    DEV_LEAD_ASSIGNEE_DIAGNOSIS_STAFF_SHEET,
    [DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER]
  );
  const currentStaffIds = new Set(
    staff.rows
      .map(row => row[staff.headerIndexes[DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER]])
      .filter(value => !isDevLeadAssigneeDiagnosisEmpty(value))
      .map(value => String(value))
  );
  const leadIdIndex = leads.headerIndexes[DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER];
  const orphanGroupsById = new Map();
  const leadAssigneeNameHeaders = DEV_LEAD_ASSIGNEE_DIAGNOSIS_NAME_HEADERS
    .filter(header => Object.prototype.hasOwnProperty.call(leads.headerIndexes, header));
  const currentStaffIdsByNormalizedName = buildDevLeadAssigneeCurrentStaffNameIndex(staff);

  leads.rows.forEach(row => {
    const id = row[leadIdIndex];
    if (isDevLeadAssigneeDiagnosisEmpty(id) || currentStaffIds.has(String(id))) return;
    const group = orphanGroupsById.get(String(id)) || {
      id: String(id),
      leadRecordCount: 0,
      supplementalNameBlankCount: 0,
      currentStaffNameUniqueMatchCount: 0,
      currentStaffNameAmbiguousMatchCount: 0,
      currentStaffNameMismatchCount: 0
    };
    group.leadRecordCount += 1;
    classifyDevLeadAssigneeSupplementalName(
      row,
      leads.headerIndexes,
      leadAssigneeNameHeaders,
      currentStaffIdsByNormalizedName,
      group
    );
    orphanGroupsById.set(String(id), group);
  });

  const historySheets = findDevLeadAssigneeHistorySheets(spreadsheet);
  const historyIds = new Map();
  historySheets.forEach(historySheet => {
    historySheet.rows.forEach(row => {
      const id = row[historySheet.headerIndexes[DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER]];
      if (isDevLeadAssigneeDiagnosisEmpty(id)) return;
      const key = String(id);
      const record = historyIds.get(key) || { recordCount: 0, sheetCount: 0, sheets: new Set() };
      record.recordCount += 1;
      record.sheets.add(historySheet.name);
      record.sheetCount = record.sheets.size;
      historyIds.set(key, record);
    });
  });

  const groups = [];
  orphanGroupsById.forEach(group => {
    const history = historyIds.get(group.id);
    groups.push({
      group: 'GROUP_' + String(groups.length + 1).padStart(2, '0'),
      leadRecordCount: group.leadRecordCount,
      supplementalNameBlankCount: group.supplementalNameBlankCount,
      currentStaffNameUniqueMatchCount: group.currentStaffNameUniqueMatchCount,
      currentStaffNameAmbiguousMatchCount: group.currentStaffNameAmbiguousMatchCount,
      currentStaffNameMismatchCount: group.currentStaffNameMismatchCount,
      historicalStaffIdMatchRecordCount: history ? history.recordCount : 0,
      classification: history
        ? 'HISTORICAL_STAFF_ID_MATCH_FOUND'
        : group.currentStaffNameUniqueMatchCount > 0
          ? 'CURRENT_STAFF_NAME_MATCH_FOUND'
          : 'INSUFFICIENT_EVIDENCE'
    });
  });

  return {
    success: true,
    orphanLeadAssigneeRecordCount: groups.reduce((sum, group) => sum + group.leadRecordCount, 0),
    distinctOrphanLeadAssigneeIdCount: groups.length,
    groups: groups,
    historicalStaffDataFound: historySheets.length > 0,
    historicalStaffDataSheetCount: historySheets.length,
    leadAssigneeNameHeaders: leadAssigneeNameHeaders,
    overallClassification: groups.length === 0
      ? 'NO_ORPHAN_LEAD_ASSIGNEE_IDS'
      : groups.every(group => group.classification === 'HISTORICAL_STAFF_ID_MATCH_FOUND')
        ? 'HISTORICAL_STAFF_ID_MATCH_FOUND'
        : 'INSUFFICIENT_EVIDENCE'
  };
}

function buildDevLeadAssigneeCurrentStaffNameIndex(staff) {
  const index = new Map();
  const idIndex = staff.headerIndexes[DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER];
  staff.rows.forEach(row => {
    const id = row[idIndex];
    if (isDevLeadAssigneeDiagnosisEmpty(id)) return;
    getDevLeadAssigneeStaffNormalizedNames(row, staff.headerIndexes).forEach(name => {
      const ids = index.get(name) || new Set();
      ids.add(String(id));
      index.set(name, ids);
    });
  });
  return index;
}

function getDevLeadAssigneeStaffNormalizedNames(row, headerIndexes) {
  const names = new Set();
  ['氏名（日本語）', '氏名', '担当者名'].forEach(header => {
    if (Object.prototype.hasOwnProperty.call(headerIndexes, header)) {
      const normalized = normalizeDevLeadAssigneeName(row[headerIndexes[header]]);
      if (normalized) names.add(normalized);
    }
  });
  if (
    Object.prototype.hasOwnProperty.call(headerIndexes, '苗字（日本語）') &&
    Object.prototype.hasOwnProperty.call(headerIndexes, '名前（日本語）')
  ) {
    const normalized = normalizeDevLeadAssigneeName(
      String(row[headerIndexes['苗字（日本語）']] || '') +
      String(row[headerIndexes['名前（日本語）']] || '')
    );
    if (normalized) names.add(normalized);
  }
  return Array.from(names);
}

function classifyDevLeadAssigneeSupplementalName(
  row,
  headerIndexes,
  nameHeaders,
  currentStaffIdsByNormalizedName,
  group
) {
  const rawName = nameHeaders.map(header => row[headerIndexes[header]])
    .find(value => !isDevLeadAssigneeDiagnosisEmpty(value));
  const normalizedName = normalizeDevLeadAssigneeName(rawName);
  if (!normalizedName) {
    group.supplementalNameBlankCount += 1;
    return;
  }
  const candidateIds = currentStaffIdsByNormalizedName.get(normalizedName);
  if (!candidateIds) {
    group.currentStaffNameMismatchCount += 1;
  } else if (candidateIds.size === 1) {
    group.currentStaffNameUniqueMatchCount += 1;
  } else {
    group.currentStaffNameAmbiguousMatchCount += 1;
  }
}

function normalizeDevLeadAssigneeName(value) {
  if (isDevLeadAssigneeDiagnosisEmpty(value)) return '';
  return String(value).replace(/[\s　]+/g, '').toLowerCase();
}

function findDevLeadAssigneeHistorySheets(spreadsheet) {
  return spreadsheet.getSheets().reduce((historySheets, sheet) => {
    if (!DEV_LEAD_ASSIGNEE_DIAGNOSIS_HISTORY_NAME_PATTERN.test(sheet.getName())) {
      return historySheets;
    }
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerIndexes = getDevLeadAssigneeDiagnosisHeaderIndexes(headers);
    if (!Object.prototype.hasOwnProperty.call(
      headerIndexes,
      DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER
    )) {
      return historySheets;
    }
    const hasStaffNameHeader = DEV_LEAD_ASSIGNEE_DIAGNOSIS_STAFF_NAME_HEADERS
      .some(header => Object.prototype.hasOwnProperty.call(headerIndexes, header));
    if (hasStaffNameHeader) {
      historySheets.push(getDevLeadAssigneeDiagnosisSheetDataFromSheet(sheet, [
        DEV_LEAD_ASSIGNEE_DIAGNOSIS_ID_HEADER
      ]));
    }
    return historySheets;
  }, []);
}

function getDevLeadAssigneeDiagnosisSheetData(spreadsheet, sheetName, requiredHeaders) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Required diagnosis sheet is missing');
  return getDevLeadAssigneeDiagnosisSheetDataFromSheet(sheet, requiredHeaders);
}

function getDevLeadAssigneeDiagnosisSheetDataFromSheet(sheet, requiredHeaders) {
  const values = sheet.getDataRange().getValues();
  if (values.length === 0 || values[0].length === 0) {
    throw new Error('Required diagnosis headers are missing');
  }
  const headerIndexes = getDevLeadAssigneeDiagnosisHeaderIndexes(values[0]);
  requiredHeaders.forEach(header => {
    if (!Object.prototype.hasOwnProperty.call(headerIndexes, header)) {
      throw new Error('Required diagnosis header is missing');
    }
  });
  return {
    name: sheet.getName(),
    headerIndexes: headerIndexes,
    rows: values.slice(1).filter(row => row.some(value => !isDevLeadAssigneeDiagnosisEmpty(value)))
  };
}

function getDevLeadAssigneeDiagnosisHeaderIndexes(headers) {
  const headerIndexes = {};
  headers.forEach((header, index) => {
    if (isDevLeadAssigneeDiagnosisEmpty(header)) return;
    if (Object.prototype.hasOwnProperty.call(headerIndexes, header)) {
      throw new Error('Diagnosis header is duplicated');
    }
    headerIndexes[header] = index;
  });
  return headerIndexes;
}

function isDevLeadAssigneeDiagnosisEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined';
}
