/**
 * Core Schema V1 を正本として担当者マスタに書き込む React フロント専用 API。
 * 物理ヘッダー名・選択肢値は 00_CoreSchemaRegistry.js から解決する。
 * 読み取り側は 28_CoreStaffReadApi.js 参照。
 *
 * 編集可能項目:
 *   LAST_NAME_JA / FIRST_NAME_JA
 *   LAST_NAME_KANA / FIRST_NAME_KANA
 *   LAST_NAME_EN / FIRST_NAME_EN
 *   EMAIL / DISCORD_ID / ROLE / STATUS
 *
 * 書き込まない項目:
 *   FULL_NAME_JA  — 姓名分割列を正とするため
 *   col14〜20 の表示設定（ダークモード等）— 別途対応
 */

/** 編集可能フィールド: camelCase 入力キー → 論理ヘッダーキー */
const CORE_STAFF_WRITE_EDITABLE_FIELDS = {
  lastNameJa:    'LAST_NAME_JA',
  firstNameJa:   'FIRST_NAME_JA',
  lastNameKana:  'LAST_NAME_KANA',
  firstNameKana: 'FIRST_NAME_KANA',
  lastNameEn:    'LAST_NAME_EN',
  firstNameEn:   'FIRST_NAME_EN',
  email:         'EMAIL',
  discordId:     'DISCORD_ID',
  role:          'ROLE',
  status:        'STATUS'
};

/**
 * 担当者を新規登録する
 * @param {Object} staffData - camelCase フィールドのオブジェクト
 * @returns {{ success: true, staffId: string }}
 */
function createCoreStaffForFrontend(staffData) {
  checkPermission('staff_manage');

  const ss = getSpreadsheet();
  const { sheet, headerIndexes } = validateCoreSchemaV1TableForWrite(ss, 'STAFF');

  // EMAIL 必須チェック
  const email = staffData.email ? String(staffData.email).trim() : '';
  if (!email) throw new Error('STAFF_EMAIL_REQUIRED');

  // ROLE / STATUS 検証（指定がある場合のみ）
  if (staffData.role    !== undefined) coreStaffAssertValidEnum('ROLE',   staffData.role);
  if (staffData.status  !== undefined) coreStaffAssertValidEnum('STATUS', staffData.status);

  // EMAIL 重複チェック（自己除外なし: 新規登録のため）
  coreStaffAssertNoDuplicateEmail(sheet, headerIndexes, email, null);

  // STAFF_ID は generateNextStaffId() で採番（引数では受け取らない）
  const newStaffId = generateNextStaffId();

  // 全列を空文字で初期化し、スキーマ定義列を埋める
  const lastCol = sheet.getLastColumn();
  const rowData = new Array(lastCol).fill('');

  const staffIdHeader = getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID');
  rowData[headerIndexes[staffIdHeader] - 1] = newStaffId;

  Object.keys(CORE_STAFF_WRITE_EDITABLE_FIELDS).forEach(inputKey => {
    if (staffData[inputKey] === undefined) return;
    const logicalKey    = CORE_STAFF_WRITE_EDITABLE_FIELDS[inputKey];
    const physicalHeader = getCoreSchemaV1HeaderName('STAFF', logicalKey);
    const colIdx        = headerIndexes[physicalHeader];
    if (colIdx) rowData[colIdx - 1] = String(staffData[inputKey]).trim();
  });

  sheet.appendRow(rowData);
  return { success: true, staffId: newStaffId };
}

/**
 * 担当者情報を更新する
 * @param {string} staffId  - STAFF_ID（変更不可）
 * @param {Object} staffData - 変更するフィールドのみ含む camelCase オブジェクト
 * @returns {{ success: true }}
 */
function updateCoreStaffForFrontend(staffId, staffData) {
  checkPermission('staff_manage');

  const normalizedStaffId = staffId ? String(staffId).trim() : '';
  if (!normalizedStaffId) throw new Error('STAFF_ID_REQUIRED');

  const ss = getSpreadsheet();
  const { sheet, headerIndexes } = validateCoreSchemaV1TableForWrite(ss, 'STAFF');

  // 対象行を特定
  const targetRow = coreStaffFindRowByStaffId(sheet, headerIndexes, normalizedStaffId);
  if (targetRow === -1) throw new Error('STAFF_NOT_FOUND');

  // ROLE / STATUS 検証（指定がある場合のみ）
  if (staffData.role    !== undefined) coreStaffAssertValidEnum('ROLE',   staffData.role);
  if (staffData.status  !== undefined) coreStaffAssertValidEnum('STATUS', staffData.status);

  // EMAIL 変更時: 必須チェック + 他行との重複チェック（自行は除外）
  if (staffData.email !== undefined) {
    const email = String(staffData.email).trim();
    if (!email) throw new Error('STAFF_EMAIL_REQUIRED');
    coreStaffAssertNoDuplicateEmail(sheet, headerIndexes, email, normalizedStaffId);
  }

  // 編集可能フィールドを1列ずつ書き込む（undefinedはスキップ）
  Object.keys(CORE_STAFF_WRITE_EDITABLE_FIELDS).forEach(inputKey => {
    if (staffData[inputKey] === undefined) return;
    const logicalKey     = CORE_STAFF_WRITE_EDITABLE_FIELDS[inputKey];
    const physicalHeader = getCoreSchemaV1HeaderName('STAFF', logicalKey);
    const colIdx         = headerIndexes[physicalHeader];
    if (!colIdx) return;
    sheet.getRange(targetRow, colIdx).setValue(String(staffData[inputKey]).trim());
  });

  return { success: true };
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * STAFF テーブルの values グループで入力値を検証する。
 * 定義外の値は例外を投げる。
 */
function coreStaffAssertValidEnum(logicalGroupKey, value) {
  const strValue = String(value).trim();
  const table    = getCoreSchemaV1Table('STAFF');
  const group    = table.values && table.values[logicalGroupKey];
  if (!group) throw new Error('CORE_SCHEMA_VALUE_GROUP_NOT_FOUND: ' + logicalGroupKey);
  const validValues = Object.keys(group).map(k => group[k]);
  if (validValues.indexOf(strValue) === -1) {
    throw new Error('STAFF_INVALID_' + logicalGroupKey + ': ' + strValue);
  }
}

/**
 * EMAIL の重複を検証する。
 * excludeStaffId を指定すると、その担当者の行は除外する（自己更新時）。
 */
function coreStaffAssertNoDuplicateEmail(sheet, headerIndexes, email, excludeStaffId) {
  const emailHeader   = getCoreSchemaV1HeaderName('STAFF', 'EMAIL');
  const staffIdHeader = getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID');
  const emailColIdx   = headerIndexes[emailHeader];
  const staffIdColIdx = headerIndexes[staffIdHeader];
  if (!emailColIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: EMAIL');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data           = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const normalizedEmail = email.toLowerCase();

  for (let i = 0; i < data.length; i++) {
    const rowEmail = String(data[i][emailColIdx - 1] || '').trim().toLowerCase();
    if (rowEmail !== normalizedEmail) continue;
    if (excludeStaffId) {
      const rowStaffId = String(data[i][staffIdColIdx - 1] || '').trim();
      if (rowStaffId === excludeStaffId) continue;
    }
    throw new Error('STAFF_EMAIL_DUPLICATE');
  }
}

/**
 * STAFF_ID で対象行番号（1-indexed）を返す。見つからなければ -1。
 */
function coreStaffFindRowByStaffId(sheet, headerIndexes, staffId) {
  const staffIdHeader = getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID');
  const staffIdColIdx = headerIndexes[staffIdHeader];
  if (!staffIdColIdx) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: STAFF_ID');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][staffIdColIdx - 1] || '').trim() === staffId) {
      return i + 2; // 1-indexed: i=0 → row 2
    }
  }
  return -1;
}
