/**
 * パスワード設定・ログイン失敗ロック機構。
 *
 * - 物理ヘッダー名の直書き禁止 → getCoreSchemaV1HeaderName 経由
 * - Logger.log でパスワード変数を出力禁止
 * - シートへの書き込みはすべて LockService で保護する
 */

var MIN_PASSWORD_LENGTH   = 12;
var LOGIN_LOCK_THRESHOLD  = 5;
var LOGIN_LOCK_MINUTES    = 15;

// ─────────────────────────────────────────────
// 公開API
// ─────────────────────────────────────────────

/**
 * 管理者が別担当者のパスワードを設定する。
 * staff_manage 権限が必要。
 * @param {string} staffId
 * @param {string} newPassword
 */
function setStaffPassword(staffId, newPassword) {
  checkPermission('staff_manage');
  _validatePasswordLength(newPassword);

  var salt = generatePasswordSalt();
  var hash = hashPassword(newPassword, salt);

  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) throw new Error('STAFF_NOT_FOUND: ' + staffId);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.getRange(rowNum, _staffColNum(hi, 'PASSWORD_HASH')   ).setValue(hash);
    sheet.getRange(rowNum, _staffColNum(hi, 'PASSWORD_SALT')   ).setValue(salt);
    sheet.getRange(rowNum, _staffColNum(hi, 'LOGIN_FAIL_COUNT')).setValue(0);
    sheet.getRange(rowNum, _staffColNum(hi, 'LOCKED_UNTIL')    ).setValue('');
  } finally {
    lock.releaseLock();
  }

  revokeAllSessionsForStaff(staffId);
}

/**
 * 担当者が自分自身のパスワードを変更する。
 * 現在のパスワードが正しいこと・新旧が異なることを検証する。
 * @param {string} staffId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
function changeOwnPassword(staffId, currentPassword, newPassword) {
  _validatePasswordLength(newPassword);

  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) throw new Error('STAFF_NOT_FOUND: ' + staffId);

  var data       = sheet.getDataRange().getValues();
  var row        = data[rowNum - 1];
  var storedHash = String(row[_staffColIdx(hi, 'PASSWORD_HASH')]).trim();
  var storedSalt = String(row[_staffColIdx(hi, 'PASSWORD_SALT')]).trim();

  if (!verifyPassword(currentPassword, storedSalt, storedHash)) {
    throw new Error('INVALID_CURRENT_PASSWORD');
  }

  // 新旧が同一かチェック（既存ソルトで再ハッシュして比較）
  if (hashPassword(newPassword, storedSalt) === storedHash) {
    throw new Error('NEW_PASSWORD_SAME_AS_CURRENT');
  }

  var newSalt  = generatePasswordSalt();
  var newHash  = hashPassword(newPassword, newSalt);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.getRange(rowNum, _staffColNum(hi, 'PASSWORD_HASH')).setValue(newHash);
    sheet.getRange(rowNum, _staffColNum(hi, 'PASSWORD_SALT')).setValue(newSalt);
  } finally {
    lock.releaseLock();
  }

  revokeAllSessionsForStaff(staffId);
}

/**
 * 仮パスワードを生成して返す（16文字）。
 * 紛らわしい文字（0 O o 1 l I）を除外する。
 * この関数のみ平文パスワードを返すことが許可されている。
 * @returns {string}
 */
function generateTemporaryPassword() {
  var charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var hex     = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); // 64 hex chars
  var result  = '';
  for (var i = 0; i < 16; i++) {
    var byteVal = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    result += charset[byteVal % charset.length];
  }
  return result;
}

/**
 * 担当者がロック中かどうかを返す。
 * @param {string} staffId
 * @returns {boolean}
 */
function isStaffLocked(staffId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) return false;

  var data        = sheet.getDataRange().getValues();
  var lockedUntil = data[rowNum - 1][_staffColIdx(hi, 'LOCKED_UNTIL')];

  if (!lockedUntil || !(lockedUntil instanceof Date)) return false;
  return new Date() < lockedUntil;
}

/**
 * ログイン失敗を記録する。
 * 閾値（LOGIN_LOCK_THRESHOLD）に達した場合は LOGIN_LOCK_MINUTES 分間ロックする。
 * @param {string} staffId
 */
function recordLoginFailure(staffId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) return; // 存在しない場合は何もしない（外部に理由を漏らさない）

  var data         = sheet.getDataRange().getValues();
  var currentCount = Number(data[rowNum - 1][_staffColIdx(hi, 'LOGIN_FAIL_COUNT')]) || 0;
  var newCount     = currentCount + 1;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.getRange(rowNum, _staffColNum(hi, 'LOGIN_FAIL_COUNT')).setValue(newCount);
    if (newCount >= LOGIN_LOCK_THRESHOLD) {
      var lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
      sheet.getRange(rowNum, _staffColNum(hi, 'LOCKED_UNTIL')).setValue(lockedUntil);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * ログイン成功を記録する。
 * 連続失敗回数とロック解除時刻をリセットする。
 * @param {string} staffId
 */
function recordLoginSuccess(staffId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) return;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.getRange(rowNum, _staffColNum(hi, 'LOGIN_FAIL_COUNT')).setValue(0);
    sheet.getRange(rowNum, _staffColNum(hi, 'LOCKED_UNTIL')    ).setValue('');
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

/**
 * パスワード長を検証する。
 */
function _validatePasswordLength(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('PASSWORD_TOO_SHORT: minimum ' + MIN_PASSWORD_LENGTH + ' characters required');
  }
}

/**
 * STAFF_ID で担当者行を検索し、1-based 行番号を返す。
 * 見つからない場合は -1。
 */
function _staffFindRowByStaffId(sheet, headerIndexes, staffId) {
  var data          = sheet.getDataRange().getValues();
  var staffIdColIdx = _staffColIdx(headerIndexes, 'STAFF_ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][staffIdColIdx]).trim() === staffId) {
      return i + 1; // 1-based
    }
  }
  return -1;
}

/**
 * headerIndexes から論理キー経由で 0-based 列インデックスを返す。
 */
function _staffColIdx(headerIndexes, logicalKey) {
  var physicalName = getCoreSchemaV1HeaderName('STAFF', logicalKey);
  return headerIndexes[physicalName] - 1;
}

/**
 * headerIndexes から論理キー経由で 1-based 列番号を返す（getRange 用）。
 */
function _staffColNum(headerIndexes, logicalKey) {
  var physicalName = getCoreSchemaV1HeaderName('STAFF', logicalKey);
  return headerIndexes[physicalName];
}
