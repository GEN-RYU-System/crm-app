/**
 * ログイン・ログアウト・セッション取得。
 *
 * 依存:
 *   26_StaffCredentialService.js — isStaffLocked / recordLoginFailure / recordLoginSuccess
 *   26_SessionService.js         — createSession / revokeSession / validateSession
 *   26_PasswordHash.js           — verifyPassword
 *   00_CoreSchemaRegistry.js     — validateCoreSchemaV1TableForWrite / getCoreSchemaV1* 系
 *   28_CoreStaffWriteApi.js      — coreStaffFindRowByStaffId
 *
 * セキュリティ原則:
 *   - 存在しないID / PW不一致 / 無効アカウント / PW未設定 → すべて LOGIN_FAILED で統一
 *   - ロック中のみ LOGIN_LOCKED（残り分数付き）
 *   - ロック判定は PW照合より前（処理時間差による情報漏洩防止）
 *   - 物理ヘッダー名・状態値の直書き禁止
 *   - 戻り値にハッシュ・ソルトを含めない
 *   - Logger.log にパスワード変数を渡さない
 */

// ─────────────────────────────────────────────
// 公開API
// ─────────────────────────────────────────────

/**
 * パスワードでログインし、セッションを発行する。
 *
 * @param {string} staffId
 * @param {string} password  平文パスワード（ログ出力禁止）
 * @returns {{ sessionId: string, staffId: string, fullNameJa: string, role: string }}
 * @throws {Error} 'LOGIN_FAILED'  — 認証失敗（理由を外部に開示しない）
 * @throws {Error} 'LOGIN_LOCKED: あと N 分後に解除されます'
 */
function loginWithPassword(staffId, password) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  // ── 1. staffId で行を特定 ───────────────────────────────────────────────
  var rowNum = coreStaffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) throw new Error('LOGIN_FAILED');

  var data = sheet.getDataRange().getValues();
  var row  = data[rowNum - 1];

  // ── 2. ロック確認（PW照合より先に行う）────────────────────────────────────
  if (isStaffLocked(staffId)) {
    var lockedUntil  = row[_lsColIdx(hi, 'LOCKED_UNTIL')];
    var remainingMin = (lockedUntil instanceof Date)
      ? Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000))
      : LOGIN_LOCK_MINUTES;
    throw new Error('LOGIN_LOCKED: あと ' + remainingMin + ' 分後に解除されます');
  }

  // ── 3. STATUS が ACTIVE か ──────────────────────────────────────────────
  var statusActive = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  if (String(row[_lsColIdx(hi, 'STATUS')]).trim() !== statusActive) {
    throw new Error('LOGIN_FAILED');
  }

  // ── 4. パスワード設定済みか ─────────────────────────────────────────────
  var storedHash = String(row[_lsColIdx(hi, 'PASSWORD_HASH')]).trim();
  var storedSalt = String(row[_lsColIdx(hi, 'PASSWORD_SALT')]).trim();
  if (!storedHash || !storedSalt) throw new Error('LOGIN_FAILED');

  // ── 5. パスワード照合 ───────────────────────────────────────────────────
  if (!verifyPassword(password, storedSalt, storedHash)) {
    recordLoginFailure(staffId);
    throw new Error('LOGIN_FAILED');
  }

  // ── 6. 成功 ─────────────────────────────────────────────────────────────
  recordLoginSuccess(staffId);
  var sessionId = createSession(staffId);

  return {
    sessionId:  sessionId,
    staffId:    staffId,
    fullNameJa: String(row[_lsColIdx(hi, 'FULL_NAME_JA')]).trim(),
    role:       String(row[_lsColIdx(hi, 'ROLE')]).trim()
  };
}

/**
 * セッションを失効させてログアウトする。
 * @param {string} sessionId
 * @returns {{ success: true }}
 */
function logout(sessionId) {
  revokeSession(sessionId);
  return { success: true };
}

/**
 * セッションIDからログイン中の担当者情報を取得する。
 * セッション無効・期限切れ・STATUS非ACTIVE の場合は null を返す。
 * @param {string} sessionId
 * @returns {{ staffId: string, fullNameJa: string, role: string, email: string } | null}
 */
function getSessionUser(sessionId) {
  var staffId = validateSession(sessionId);
  if (!staffId) return null;

  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var sheet  = result.sheet;
  var hi     = result.headerIndexes;

  var rowNum = coreStaffFindRowByStaffId(sheet, hi, staffId);
  if (rowNum === -1) return null;

  var data = sheet.getDataRange().getValues();
  var row  = data[rowNum - 1];

  var statusActive = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  if (String(row[_lsColIdx(hi, 'STATUS')]).trim() !== statusActive) return null;

  return {
    staffId:    staffId,
    fullNameJa: String(row[_lsColIdx(hi, 'FULL_NAME_JA')]).trim(),
    role:       String(row[_lsColIdx(hi, 'ROLE')]).trim(),
    email:      String(row[_lsColIdx(hi, 'EMAIL')]).trim()
  };
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

/**
 * STAFF テーブルの論理キーから 0-based 列インデックスを返す。
 * 物理ヘッダー名は getCoreSchemaV1HeaderName 経由で解決する。
 */
function _lsColIdx(headerIndexes, logicalKey) {
  var physicalName = getCoreSchemaV1HeaderName('STAFF', logicalKey);
  return headerIndexes[physicalName] - 1;
}
