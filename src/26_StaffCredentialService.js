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
    throw new Error('PASSWORD_MISMATCH');
  }

  // 新旧が同一かチェック（既存ソルトで再ハッシュして比較）
  if (hashPassword(newPassword, storedSalt) === storedHash) {
    throw new Error('PASSWORD_UNCHANGED');
  }

  var newSalt = generatePasswordSalt();
  var newHash = hashPassword(newPassword, newSalt);

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
 * 英大文字・英小文字・数字がそれぞれ1文字以上含まれることを保証する。
 * この関数のみ平文パスワードを返すことが許可されている。
 * @returns {string}
 */
function generateTemporaryPassword() {
  var lower  = 'abcdefghjkmnpqrstuvwxyz'; // 23 chars (i/o/l 除外)
  var upper  = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // 23 chars (I/O 除外)
  var digits = '23456789';                  // 8 chars  (0/1 除外)
  var all    = lower + upper + digits;      // 54 chars

  // 13文字: all charset からランダム生成
  var h1    = Utilities.getUuid().replace(/-/g, ''); // 32 hex chars
  var chars = [];
  for (var i = 0; i < 13; i++) {
    chars.push(all[parseInt(h1.substring(i * 2, i * 2 + 2), 16) % all.length]);
  }

  // 各カテゴリから1文字ずつ必ず追加（合計16文字に）
  var h2 = Utilities.getUuid().replace(/-/g, '');
  chars.push(lower [parseInt(h2.substring(0, 2), 16) % lower.length]);
  chars.push(upper [parseInt(h2.substring(2, 4), 16) % upper.length]);
  chars.push(digits[parseInt(h2.substring(4, 6), 16) % digits.length]);

  // Fisher-Yates シャッフル（位置を均一に分散させる）
  var h3 = Utilities.getUuid().replace(/-/g, '');
  for (var j = 15; j >= 1; j--) {
    var swapIdx = parseInt(h3.substring((15 - j) * 2, (15 - j) * 2 + 2), 16) % (j + 1);
    var tmp = chars[j]; chars[j] = chars[swapIdx]; chars[swapIdx] = tmp;
  }

  return chars.join('');
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
 * 閾値（LOGIN_LOCK_THRESHOLD）に達した場合:
 *   - LOCKED_UNTIL に LOGIN_LOCK_MINUTES 分後をセット
 *   - LOGIN_FAIL_COUNT をリセット（ロック解除後に新鮮なカウントで開始するため）
 * @param {string} staffId
 */
function recordLoginFailure(staffId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = _staffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) return; // 外部に理由を漏らさない

  var data         = sheet.getDataRange().getValues();
  var currentCount = Number(data[rowNum - 1][_staffColIdx(hi, 'LOGIN_FAIL_COUNT')]) || 0;
  var newCount     = currentCount + 1;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (newCount >= LOGIN_LOCK_THRESHOLD) {
      var lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
      sheet.getRange(rowNum, _staffColNum(hi, 'LOCKED_UNTIL')    ).setValue(lockedUntil);
      sheet.getRange(rowNum, _staffColNum(hi, 'LOGIN_FAIL_COUNT')).setValue(0);
    } else {
      sheet.getRange(rowNum, _staffColNum(hi, 'LOGIN_FAIL_COUNT')).setValue(newCount);
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
// DEV専用テストラッパー
// ─────────────────────────────────────────────

/**
 * StaffCredentialService の一貫テスト（DEV専用）。
 * テスト対象: EMP-00008（テスト用・status=無効）のみ。
 * テスト (1)〜(10) を順番に実行し、各ステップの合否と状態を返す。
 * @returns {Object}
 */
function testCredentialServiceAll() {
  if (getEnvironment() !== 'development') {
    throw new Error('testCredentialServiceAll は development 環境でのみ実行可能');
  }

  var TEST_STAFF_ID = 'EMP-00008';
  var results       = [];

  function getCredState() {
    var r  = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
    var sh = r.sheet;
    var hi = r.headerIndexes;
    var rn = _staffFindRowByStaffId(sh, hi, TEST_STAFF_ID);
    if (rn === -1) return null;
    var row = sh.getDataRange().getValues()[rn - 1];
    var lu  = row[_staffColIdx(hi, 'LOCKED_UNTIL')];
    return {
      hasHash:     !!String(row[_staffColIdx(hi, 'PASSWORD_HASH')]).trim(),
      hasSalt:     !!String(row[_staffColIdx(hi, 'PASSWORD_SALT')]).trim(),
      failCount:   Number(row[_staffColIdx(hi, 'LOGIN_FAIL_COUNT')]) || 0,
      lockedUntil: (lu instanceof Date) ? lu.toISOString() : ''
    };
  }

  // ── (1) generateTemporaryPassword x3 ──────────────────────────────────
  var pw1 = generateTemporaryPassword();
  var pw2 = generateTemporaryPassword();
  var pw3 = generateTemporaryPassword();
  var FORBIDDEN = /[0Oo1lI]/;
  function checkPw(pw) {
    return pw.length === 16
      && !FORBIDDEN.test(pw)
      && /[a-z]/.test(pw)
      && /[A-Z]/.test(pw)
      && /[23456789]/.test(pw);
  }
  results.push({
    test:      '(1) generateTemporaryPassword x3',
    pass:      checkPw(pw1) && checkPw(pw2) && checkPw(pw3)
               && pw1 !== pw2 && pw2 !== pw3 && pw1 !== pw3,
    passwords: [pw1, pw2, pw3]  // 使い捨てテスト値のため返却許可
  });

  // ── (2) setStaffPassword(short) → PASSWORD_TOO_SHORT ─────────────────
  try {
    setStaffPassword(TEST_STAFF_ID, 'short');
    results.push({ test: '(2) setStaffPassword(short)', pass: false, detail: '例外が発生しなかった' });
  } catch (e) {
    results.push({
      test:   '(2) setStaffPassword(short)',
      pass:   String(e.message).indexOf('PASSWORD_TOO_SHORT') === 0,
      detail: e.message
    });
  }

  // ── (3) setStaffPassword(valid) ───────────────────────────────────────
  try {
    setStaffPassword(TEST_STAFF_ID, 'TestPassword2026');
    var s3 = getCredState();
    results.push({
      test:  '(3) setStaffPassword(valid)',
      pass:  s3 !== null && s3.hasHash && s3.hasSalt,
      state: s3
    });
  } catch (e) {
    results.push({ test: '(3) setStaffPassword(valid)', pass: false, detail: e.message });
  }

  // ── (4) changeOwnPassword(wrong current) → PASSWORD_MISMATCH ─────────
  try {
    changeOwnPassword(TEST_STAFF_ID, 'wrongpassword', 'NewPassword2026');
    results.push({ test: '(4) changeOwnPassword(wrong current)', pass: false, detail: '例外が発生しなかった' });
  } catch (e) {
    results.push({
      test:   '(4) changeOwnPassword(wrong current)',
      pass:   e.message === 'PASSWORD_MISMATCH',
      detail: e.message
    });
  }

  // ── (5) changeOwnPassword(same) → PASSWORD_UNCHANGED ─────────────────
  try {
    changeOwnPassword(TEST_STAFF_ID, 'TestPassword2026', 'TestPassword2026');
    results.push({ test: '(5) changeOwnPassword(same)', pass: false, detail: '例外が発生しなかった' });
  } catch (e) {
    results.push({
      test:   '(5) changeOwnPassword(same)',
      pass:   e.message === 'PASSWORD_UNCHANGED',
      detail: e.message
    });
  }

  // ── (6) changeOwnPassword(valid) ─────────────────────────────────────
  try {
    changeOwnPassword(TEST_STAFF_ID, 'TestPassword2026', 'NewPassword2026');
    results.push({ test: '(6) changeOwnPassword(valid)', pass: true });
  } catch (e) {
    results.push({ test: '(6) changeOwnPassword(valid)', pass: false, detail: e.message });
  }

  // ── (7) isStaffLocked → false ─────────────────────────────────────────
  var lock7 = isStaffLocked(TEST_STAFF_ID);
  results.push({
    test:   '(7) isStaffLocked (ロック前)',
    pass:   lock7 === false,
    detail: String(lock7)
  });

  // ── (8) recordLoginFailure x5 ─────────────────────────────────────────
  var failAttempts = [];
  for (var fi = 1; fi <= 5; fi++) {
    recordLoginFailure(TEST_STAFF_ID);
    var sf = getCredState();
    failAttempts.push({ attempt: fi, failCount: sf.failCount, lockedUntil: sf.lockedUntil });
  }
  var pass8 =
    failAttempts[0].failCount === 1 && failAttempts[0].lockedUntil === '' &&
    failAttempts[1].failCount === 2 && failAttempts[1].lockedUntil === '' &&
    failAttempts[2].failCount === 3 && failAttempts[2].lockedUntil === '' &&
    failAttempts[3].failCount === 4 && failAttempts[3].lockedUntil === '' &&
    failAttempts[4].failCount === 0 && failAttempts[4].lockedUntil !== '';
  results.push({
    test:     '(8) recordLoginFailure x5',
    pass:     pass8,
    attempts: failAttempts
  });

  // ── (9) isStaffLocked → true ──────────────────────────────────────────
  var lock9 = isStaffLocked(TEST_STAFF_ID);
  results.push({
    test:   '(9) isStaffLocked (ロック後)',
    pass:   lock9 === true,
    detail: String(lock9)
  });

  // ── (10) recordLoginSuccess → isStaffLocked → false ───────────────────
  recordLoginSuccess(TEST_STAFF_ID);
  var lock10 = isStaffLocked(TEST_STAFF_ID);
  var s10    = getCredState();
  results.push({
    test:   '(10) recordLoginSuccess → isStaffLocked',
    pass:   lock10 === false && s10 !== null && s10.failCount === 0 && s10.lockedUntil === '',
    state:  s10,
    locked: lock10
  });

  var allPass = results.every(function (r) { return r.pass; });
  return { allPass: allPass, results: results };
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
