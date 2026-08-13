/**
 * DEV CRMの定義済み親子参照を、ID値を返さず件数だけで監査する。
 */
const DEV_REFERENCE_INTEGRITY_AUDIT_LOG_SHEET_NAME = 'DEV参照整合性監査ログ';
const DEV_REFERENCE_INTEGRITY_AUDIT_VERSION = '2';
const DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS = [
  '実行日時',
  '監査バージョン',
  '親タブ',
  '子タブ',
  '親ID見出し',
  '子ID見出し',
  '子実レコード数',
  '参照ID空欄数',
  '親存在参照数',
  '孤立参照数',
  '判定'
];

const DEV_REFERENCE_INTEGRITY_RELATIONSHIPS = [
  ['顧客マスタ', '顧客ID', '配送先マスタ', '顧客ID', 'REQUIRED'],
  ['顧客マスタ', '顧客ID', '支払先マスタ', '顧客ID', 'REQUIRED'],
  ['顧客マスタ', '顧客ID', 'オーダー管理', '顧客ID', 'REQUIRED'],
  ['リード管理', 'リードID', '顧客マスタ', '源流リードID', 'REQUIRED'],
  ['リード管理', 'リードID', 'オーダー管理', '源流リードID', 'REQUIRED'],
  ['オーダー管理', 'オーダーID', 'オーダー明細', 'オーダーID', 'REQUIRED'],
  ['オーダー管理', 'オーダーID', '発送', 'オーダーID', 'REQUIRED'],
  ['オーダー管理', 'オーダーID', '仕入れ', 'オーダーID', 'OPTIONAL'],
  ['担当者マスタ', '担当者ID', 'リード管理', '担当者ID', 'REQUIRED'],
  ['担当者マスタ', '担当者ID', 'オーダー管理', '受注担当ID', 'REQUIRED'],
  ['担当者マスタ', '担当者ID', 'オーダー管理', '営業担当ID', 'REQUIRED'],
  ['担当者マスタ', '担当者ID', 'オーダー管理', '発送担当ID', 'REQUIRED'],
  ['担当者マスタ', '担当者ID', '発送', '発送担当ID', 'REQUIRED'],
  ['担当者マスタ', '担当者ID', '仕入れ', '仕入れ担当ID', 'REQUIRED']
];

function runAndLogDevReferenceIntegrityAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('runAndLogDevReferenceIntegrityAudit is available only in development');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let auditRows;
    try {
      auditRows = buildDevReferenceIntegrityAuditRows(getSpreadsheet());
    } catch (error) {
      return { success: false, errorType: 'REFERENCE_INTEGRITY_AUDIT_FAILED' };
    }

    try {
      const logSheet = getOrCreateDevReferenceIntegrityAuditLogSheet(getSpreadsheet());
      logSheet.getRange(
        logSheet.getLastRow() + 1,
        1,
        auditRows.length,
        DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS.length
      ).setValues(auditRows);
      return {
        success: true,
        resultType: 'REFERENCE_INTEGRITY_AUDIT_LOG_RECORDED',
        logRowCount: auditRows.length
      };
    } catch (error) {
      return { success: false, errorType: 'REFERENCE_INTEGRITY_AUDIT_LOG_WRITE_FAILED' };
    }
  } finally {
    lock.releaseLock();
  }
}

function buildDevReferenceIntegrityAuditRows(spreadsheet) {
  const cache = {};
  const executedAt = new Date();
  const results = DEV_REFERENCE_INTEGRITY_RELATIONSHIPS.map(relation =>
    auditDevReferenceIntegrityRelation(spreadsheet, relation, cache)
  );
  return results.map(result => [
    executedAt,
    DEV_REFERENCE_INTEGRITY_AUDIT_VERSION,
    result.parentSheetName,
    result.childSheetName,
    result.parentIdHeader,
    result.childIdHeader,
    result.childNonEmptyDataRowCount,
    result.emptyReferenceIdCount,
    result.parentPresentReferenceCount,
    result.orphanReferenceCount,
    result.status
  ]);
}

function auditDevReferenceIntegrityRelation(spreadsheet, relation, cache) {
  const parentSheetName = relation[0];
  const parentIdHeader = relation[1];
  const childSheetName = relation[2];
  const childIdHeader = relation[3];
  const emptyReferencePolicy = relation[4];
  const parent = getDevReferenceIntegritySheetData(
    spreadsheet, parentSheetName, parentIdHeader, cache
  );
  const child = getDevReferenceIntegritySheetData(
    spreadsheet, childSheetName, childIdHeader, cache
  );
  const parentIds = new Set();
  parent.rows.forEach(row => {
    const value = row.values[parent.idColumnIndex];
    if (!isEmptyReferenceId(value)) parentIds.add(String(value));
  });

  let emptyReferenceIdCount = 0;
  let parentPresentReferenceCount = 0;
  let orphanReferenceCount = 0;
  child.rows.forEach(row => {
    const value = row.values[child.idColumnIndex];
    if (isEmptyReferenceId(value)) {
      emptyReferenceIdCount += 1;
    } else if (parentIds.has(String(value))) {
      parentPresentReferenceCount += 1;
    } else {
      orphanReferenceCount += 1;
    }
  });

  const childNonEmptyDataRowCount = child.rows.length;
  if (
    childNonEmptyDataRowCount !==
    emptyReferenceIdCount + parentPresentReferenceCount + orphanReferenceCount
  ) {
    throw new Error('Reference integrity totals are invalid');
  }
  return {
    parentSheetName: parentSheetName,
    parentIdHeader: parentIdHeader,
    childSheetName: childSheetName,
    childIdHeader: childIdHeader,
    childNonEmptyDataRowCount: childNonEmptyDataRowCount,
    emptyReferenceIdCount: emptyReferenceIdCount,
    parentPresentReferenceCount: parentPresentReferenceCount,
    orphanReferenceCount: orphanReferenceCount,
    status: getDevReferenceIntegrityStatus(
      emptyReferencePolicy, emptyReferenceIdCount, orphanReferenceCount
    )
  };
}

function getDevReferenceIntegritySheetData(spreadsheet, sheetName, idHeader, cache) {
  const key = sheetName + '\u0000' + idHeader;
  if (cache[key]) return cache[key];
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Reference integrity schema is invalid');
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) throw new Error('Reference integrity schema is invalid');
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  assertUniqueDevReferenceIntegrityHeaders(headers);
  const idColumnIndex = getUniqueDevReferenceIntegrityHeaderIndex(headers, idHeader);
  const range = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn) : null;
  const values = range ? range.getValues() : [];
  const formulas = range ? range.getFormulas() : [];
  const result = {
    idColumnIndex: idColumnIndex,
    rows: values.reduce((rows, row, rowIndex) => {
      if (isNonEmptyDataRecord(row, formulas[rowIndex])) {
        rows.push({ values: row });
      }
      return rows;
    }, [])
  };
  cache[key] = result;
  return result;
}

function assertUniqueDevReferenceIntegrityHeaders(headers) {
  const seen = {};
  headers.forEach(header => {
    if (!header) return;
    if (seen[header]) throw new Error('Reference integrity schema is invalid');
    seen[header] = true;
  });
}

function getUniqueDevReferenceIntegrityHeaderIndex(headers, idHeader) {
  const indexes = headers.reduce((result, header, index) => {
    if (header === idHeader) result.push(index);
    return result;
  }, []);
  if (indexes.length !== 1) throw new Error('Reference integrity schema is invalid');
  return indexes[0];
}

function isEmptyReferenceId(value) {
  return value === '' || value === null || value === undefined;
}

function getDevReferenceIntegrityStatus(policy, emptyCount, orphanCount) {
  if (orphanCount > 0) return 'ORPHAN_REFERENCE_FOUND';
  if (emptyCount > 0 && policy === 'OPTIONAL') return 'EMPTY_REFERENCE_ALLOWED';
  if (emptyCount > 0) return 'EMPTY_REFERENCE_FOUND';
  return 'OK';
}

function getOrCreateDevReferenceIntegrityAuditLogSheet(spreadsheet) {
  const existingSheet = spreadsheet.getSheetByName(
    DEV_REFERENCE_INTEGRITY_AUDIT_LOG_SHEET_NAME
  );
  if (existingSheet) {
    if (!hasDevReferenceIntegrityAuditLogHeaders(existingSheet)) {
      throw new Error('Reference integrity audit log header is invalid');
    }
    return existingSheet;
  }
  const newSheet = spreadsheet.insertSheet(DEV_REFERENCE_INTEGRITY_AUDIT_LOG_SHEET_NAME);
  newSheet.getRange(1, 1, 1, DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS.length)
    .setValues([DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS]);
  return newSheet;
}

function hasDevReferenceIntegrityAuditLogHeaders(sheet) {
  const headers = sheet.getRange(
    1, 1, 1, DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS.length
  ).getDisplayValues()[0];
  return headers.every((header, index) =>
    header === DEV_REFERENCE_INTEGRITY_AUDIT_LOG_HEADERS[index]
  );
}
