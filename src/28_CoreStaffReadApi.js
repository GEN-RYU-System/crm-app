/**
 * Core Schema V1 を正本として担当者マスタを読み取る React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

var CORE_STAFF_CACHE_INDEX      = 'CORE_STAFF_CACHE_INDEX';
var CORE_STAFF_CACHE_PREFIX     = 'CORE_STAFF_CACHE_';
var CORE_STAFF_CACHE_CHUNK_SIZE = 90000;
var CORE_STAFF_CACHE_TTL        = 600;

function getCoreStaffForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('staff_manage');

  if (forceRefresh !== true) {
    var cachedStaff = readCacheChunks_(CORE_STAFF_CACHE_INDEX, CORE_STAFF_CACHE_PREFIX);
    if (cachedStaff !== null) return cachedStaff;
  }

  var activeStatus = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');

  const spreadsheet = getSpreadsheet();
  const staff = coreCustomerFrontendReadTable(spreadsheet, 'STAFF', [
    'STAFF_ID', 'LAST_NAME_JA', 'FIRST_NAME_JA', 'ROLE', 'STATUS', 'EMAIL'
  ]);

  var rows = staff.rows
    .filter(function(row) {
      return coreCustomerFrontendValue(row[staff.indexes.STATUS]) === activeStatus;
    })
    .map(function(row) {
      return {
        staffId:    coreCustomerFrontendValue(row[staff.indexes.STAFF_ID]),
        fullNameJa: [
          coreCustomerFrontendValue(row[staff.indexes.LAST_NAME_JA]),
          coreCustomerFrontendValue(row[staff.indexes.FIRST_NAME_JA])
        ].filter(Boolean).join(' '),
        role:       coreCustomerFrontendValue(row[staff.indexes.ROLE]),
        status:     coreCustomerFrontendValue(row[staff.indexes.STATUS]),
        email:      coreCustomerFrontendValue(row[staff.indexes.EMAIL])
      };
    });

  writeCacheChunks_(CORE_STAFF_CACHE_INDEX, CORE_STAFF_CACHE_PREFIX, rows, CORE_STAFF_CACHE_TTL, CORE_STAFF_CACHE_CHUNK_SIZE);
  return rows;
}

function getCoreStaffMemberForFrontend(sessionId, staffId) {
  setEmailFromSession(sessionId);
  checkPermission('staff_manage');

  var normalizedStaffId = coreCustomerFrontendValue(staffId);
  if (!normalizedStaffId) throw new Error('STAFF_ID_REQUIRED');

  const spreadsheet = getSpreadsheet();
  const staff = coreCustomerFrontendReadTable(spreadsheet, 'STAFF', [
    'STAFF_ID', 'LAST_NAME_JA', 'FIRST_NAME_JA',
    'LAST_NAME_KANA', 'FIRST_NAME_KANA', 'LAST_NAME_EN', 'FIRST_NAME_EN',
    'EMAIL', 'ROLE', 'STATUS'
  ]);

  const staffRow = staff.rows.find(function(row) {
    return coreCustomerFrontendValue(row[staff.indexes.STAFF_ID]) === normalizedStaffId;
  });
  if (!staffRow) return null;

  return {
    staffId:       coreCustomerFrontendValue(staffRow[staff.indexes.STAFF_ID]),
    lastNameJa:    coreCustomerFrontendValue(staffRow[staff.indexes.LAST_NAME_JA]),
    firstNameJa:   coreCustomerFrontendValue(staffRow[staff.indexes.FIRST_NAME_JA]),
    fullNameJa:    [
      coreCustomerFrontendValue(staffRow[staff.indexes.LAST_NAME_JA]),
      coreCustomerFrontendValue(staffRow[staff.indexes.FIRST_NAME_JA])
    ].filter(Boolean).join(' '),
    lastNameKana:  coreCustomerFrontendValue(staffRow[staff.indexes.LAST_NAME_KANA]),
    firstNameKana: coreCustomerFrontendValue(staffRow[staff.indexes.FIRST_NAME_KANA]),
    lastNameEn:    coreCustomerFrontendValue(staffRow[staff.indexes.LAST_NAME_EN]),
    firstNameEn:   coreCustomerFrontendValue(staffRow[staff.indexes.FIRST_NAME_EN]),
    email:         coreCustomerFrontendValue(staffRow[staff.indexes.EMAIL]),
    role:          coreCustomerFrontendValue(staffRow[staff.indexes.ROLE]),
    status:        coreCustomerFrontendValue(staffRow[staff.indexes.STATUS])
  };
}
