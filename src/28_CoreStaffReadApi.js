/**
 * Core Schema V1 を正本として担当者マスタを読み取る React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

function getCoreStaffForFrontend() {
  checkPermission('staff_manage');

  var activeStatus = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');

  const spreadsheet = getSpreadsheet();
  const staff = coreCustomerFrontendReadTable(spreadsheet, 'STAFF', [
    'STAFF_ID', 'LAST_NAME_JA', 'FIRST_NAME_JA', 'ROLE', 'STATUS', 'EMAIL', 'DISCORD_ID'
  ]);

  return staff.rows
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
        email:      coreCustomerFrontendValue(row[staff.indexes.EMAIL]),
        discordId:  coreCustomerFrontendValue(row[staff.indexes.DISCORD_ID])
      };
    });
}

function getCoreStaffMemberForFrontend(staffId) {
  checkPermission('staff_manage');

  var normalizedStaffId = coreCustomerFrontendValue(staffId);
  if (!normalizedStaffId) throw new Error('STAFF_ID_REQUIRED');

  const spreadsheet = getSpreadsheet();
  const staff = coreCustomerFrontendReadTable(spreadsheet, 'STAFF', [
    'STAFF_ID', 'LAST_NAME_JA', 'FIRST_NAME_JA',
    'LAST_NAME_KANA', 'FIRST_NAME_KANA', 'LAST_NAME_EN', 'FIRST_NAME_EN',
    'EMAIL', 'DISCORD_ID', 'ROLE', 'STATUS'
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
    discordId:     coreCustomerFrontendValue(staffRow[staff.indexes.DISCORD_ID]),
    role:          coreCustomerFrontendValue(staffRow[staff.indexes.ROLE]),
    status:        coreCustomerFrontendValue(staffRow[staff.indexes.STATUS])
  };
}
