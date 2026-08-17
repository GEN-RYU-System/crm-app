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

  var lastNameJa  = String(row[_lsColIdx(hi, 'LAST_NAME_JA')]).trim();
  var firstNameJa = String(row[_lsColIdx(hi, 'FIRST_NAME_JA')]).trim();

  return {
    sessionId:  sessionId,
    staffId:    staffId,
    fullNameJa: [lastNameJa, firstNameJa].filter(Boolean).join(' '),
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

  var lastNameJa  = String(row[_lsColIdx(hi, 'LAST_NAME_JA')]).trim();
  var firstNameJa = String(row[_lsColIdx(hi, 'FIRST_NAME_JA')]).trim();

  return {
    staffId:    staffId,
    fullNameJa: [lastNameJa, firstNameJa].filter(Boolean).join(' '),
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

// ─────────────────────────────────────────────
// DEV専用テストラッパー
// ─────────────────────────────────────────────

/**
 * LoginService の一貫テスト（DEV専用）。
 * テスト対象: EMP-00008（テスト用・status=無効）のみ。
 * (1)〜(9) を順番に実行し、失敗したら即座に停止して報告する。
 * パスワードの平文はログ出力しない。
 * @returns {Object}
 */
function testLoginServiceAll() {
  if (getEnvironment() !== 'development') {
    throw new Error('testLoginServiceAll は development 環境でのみ実行可能');
  }

  var TEST_STAFF_ID  = 'EMP-00008';
  var TEST_PW        = 'NewPassword2026';
  var statusActive   = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  var statusInactive = getCoreSchemaV1Value('STAFF', 'STATUS', 'INACTIVE');
  var capturedSessionId = null;
  var r = {};

  // ── (0) 前処理: STATUS=無効・残存セッション失効（冪等化）─────────────────
  try {
    updateCoreStaffForFrontend(TEST_STAFF_ID, { status: statusInactive });
    revokeAllSessionsForStaff(TEST_STAFF_ID);
    r.r0_pass = true;
  } catch (e) {
    return { stoppedAt: '(0)', reason: '前処理失敗: ' + e.message };
  }

  // ── (1) loginWithPassword (STATUS=無効) → LOGIN_FAILED ─────────────────
  try {
    loginWithPassword(TEST_STAFF_ID, TEST_PW);
    return { stoppedAt: '(1)', reason: '例外が発生しなかった' };
  } catch (e) {
    r.r1_exception = e.message;
    if (e.message !== 'LOGIN_FAILED') {
      return { stoppedAt: '(1)', reason: 'LOGIN_FAILED を期待したが: ' + e.message };
    }
  }
  r.r1_pass = true;

  // ── (2) STATUS を '有効' に変更 ──────────────────────────────────────────
  try {
    updateCoreStaffForFrontend(TEST_STAFF_ID, { status: statusActive });
    r.r2_pass = true;
  } catch (e) {
    return { stoppedAt: '(2)', reason: e.message };
  }

  // ── (3) loginWithPassword → success ──────────────────────────────────────
  try {
    var login3         = loginWithPassword(TEST_STAFF_ID, TEST_PW);
    capturedSessionId  = login3.sessionId;
    var noHashSalt3    = !login3.hash && !login3.salt &&
                         !login3.passwordHash && !login3.passwordSalt &&
                         !login3.storedHash   && !login3.storedSalt;
    r.r3_sessionIdLen  = login3.sessionId.length;
    r.r3_staffId       = login3.staffId;
    r.r3_fullNameJa    = login3.fullNameJa;
    r.r3_role          = login3.role;
    r.r3_hasNoHashSalt = noHashSalt3;
    r.r3_pass          = login3.sessionId.length === 72
                         && login3.staffId === TEST_STAFF_ID
                         && !!login3.fullNameJa
                         && !!login3.role
                         && noHashSalt3;
    if (!r.r3_pass) {
      return { stoppedAt: '(3)', reason: 'loginWithPassword の戻り値が期待外', r3: r };
    }
  } catch (e) {
    return { stoppedAt: '(3)', reason: e.message };
  }

  // ── (4) getSessionUser ────────────────────────────────────────────────────
  var user4 = getSessionUser(capturedSessionId);
  if (!user4) {
    return { stoppedAt: '(4)', reason: 'getSessionUser が null を返した' };
  }
  r.r4_staffId    = user4.staffId;
  r.r4_fullNameJa = user4.fullNameJa;
  r.r4_role       = user4.role;
  r.r4_email      = user4.email;
  r.r4_pass       = !!user4.staffId && !!user4.fullNameJa && !!user4.role && !!user4.email;
  if (!r.r4_pass) {
    return { stoppedAt: '(4)', reason: '期待フィールドが欠けている', r4: r };
  }

  // ── (5) loginWithPassword 存在しないID → LOGIN_FAILED ─────────────────
  try {
    loginWithPassword('EMP-99999', 'anything');
    return { stoppedAt: '(5)', reason: '例外が発生しなかった' };
  } catch (e) {
    r.r5_exception = e.message;
    r.r5_sameAsR1  = e.message === r.r1_exception;
    r.r5_pass      = e.message === 'LOGIN_FAILED' && r.r5_sameAsR1;
    if (!r.r5_pass) {
      return { stoppedAt: '(5)', reason: '期待と異なる: ' + e.message };
    }
  }

  // ── (6) loginWithPassword x5 wrongpassword ───────────────────────────────
  var r6detail = [];
  for (var i = 1; i <= 5; i++) {
    try {
      loginWithPassword(TEST_STAFF_ID, 'wrongpassword');
      return { stoppedAt: '(6)', reason: '試行 ' + i + ' 回目: 例外が発生しなかった' };
    } catch (e) {
      r6detail.push(i + '回目: ' + e.message);
      if (e.message !== 'LOGIN_FAILED') {
        return { stoppedAt: '(6)', reason: '試行 ' + i + ' 回目: 期待外: ' + e.message };
      }
    }
  }
  r.r6_pass    = true;
  r.r6_detail  = r6detail.join(' | ');

  // ── (7) loginWithPassword ロック中 → LOGIN_LOCKED ────────────────────────
  try {
    loginWithPassword(TEST_STAFF_ID, TEST_PW);
    return { stoppedAt: '(7)', reason: '例外が発生しなかった' };
  } catch (e) {
    r.r7_exception = e.message;
    r.r7_pass      = e.message.indexOf('LOGIN_LOCKED') === 0 && /\d/.test(e.message);
    if (!r.r7_pass) {
      return { stoppedAt: '(7)', reason: '期待外: ' + e.message };
    }
  }

  // ── (8) logout → getSessionUser → null ───────────────────────────────────
  var lo8 = logout(capturedSessionId);
  var u8  = getSessionUser(capturedSessionId);
  r.r8_logoutSuccess  = lo8.success === true;
  r.r8_userAfterLogout = (u8 === null) ? 'null' : String(u8);
  r.r8_pass = r.r8_logoutSuccess && u8 === null;
  if (!r.r8_pass) {
    return { stoppedAt: '(8)', reason: 'ログアウト後にセッションが残っている: ' + r.r8_userAfterLogout };
  }

  // ── (9) EMP-00008 を '無効' に戻す + ロック・カウントリセット ──────────
  try {
    updateCoreStaffForFrontend(TEST_STAFF_ID, { status: statusInactive });
    setStaffPassword(TEST_STAFF_ID, 'ResetTestPass26');  // ロック・カウントもリセット
    r.r9_pass = true;
  } catch (e) {
    return { stoppedAt: '(9)', reason: e.message };
  }

  r.allPass = true;
  return r;
}
