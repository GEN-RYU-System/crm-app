/**
 * パスワード設定・管理のフロントエンドAPI。
 *
 * 依存:
 *   26_StaffCredentialService.js — generateTemporaryPassword / setStaffPassword /
 *                                  changeOwnPassword / isStaffLocked
 *   26_AuthGateway.js            — resolveCurrentUserEmail
 *   27_WebApp.js                 — checkPermission
 *   28_CoreCustomerReadApi.js    — coreCustomerFrontendReadTable / coreCustomerFrontendValue
 *
 * セキュリティ原則:
 *   - 平文パスワードを Logger.log に出力しない
 *   - changeOwnPasswordForFrontend は引数で staffId を受け取らない
 *     （受け取ると他人のパスワードを変更できるため）
 *   - getPasswordStatusForFrontend はハッシュ・ソルトを戻り値に含めない
 *   - 物理ヘッダー名・状態値の直書き禁止
 */

// ─────────────────────────────────────────────
// 公開API
// ─────────────────────────────────────────────

/**
 * 管理者が担当者の一時パスワードを発行する。
 * 発行したパスワードをシート・ログに残さない。
 * 管理者が本人に別経路で伝える前提。
 *
 * @param {string} staffId
 * @returns {{ staffId: string, temporaryPassword: string }}
 */
function issueTemporaryPasswordForFrontend(staffId) {
  checkPermission('staff_manage');

  var tempPassword = generateTemporaryPassword();

  // setStaffPassword が内部で checkPermission / バリデーション / ロックリセットを行う
  setStaffPassword(staffId, tempPassword);

  return {
    staffId:           staffId,
    temporaryPassword: tempPassword
  };
}

/**
 * 本人が自分のパスワードを変更する。
 * staffId は引数で受け取らず、ログイン中のメールアドレスから特定する。
 *
 * @param {string} currentPassword  現在のパスワード（平文・ログ出力禁止）
 * @param {string} newPassword      新しいパスワード（平文・ログ出力禁止）
 * @returns {{ success: true }}
 */
function changeOwnPasswordForFrontend(sessionId, currentPassword, newPassword) {
  setEmailFromSession(sessionId);
  var email = resolveCurrentUserEmail();
  if (!email) throw new Error('認証されていません');

  var staff = coreCustomerFrontendReadTable(getSpreadsheet(), 'STAFF', [
    'STAFF_ID', 'EMAIL'
  ]);

  var staffId = null;
  for (var i = 0; i < staff.rows.length; i++) {
    if (coreCustomerFrontendValue(staff.rows[i][staff.indexes.EMAIL]) === email) {
      staffId = coreCustomerFrontendValue(staff.rows[i][staff.indexes.STAFF_ID]);
      break;
    }
  }
  if (!staffId) throw new Error('担当者として登録されていません');

  // changeOwnPassword が現在PW照合・新旧一致チェック・長さチェックを行う
  changeOwnPassword(staffId, currentPassword, newPassword);
  return { success: true };
}

/**
 * 全担当者のパスワード設定状況を返す（管理者専用）。
 * ハッシュ・ソルトは戻り値に含めない。
 *
 * @returns {Array<{ staffId: string, fullNameJa: string, hasPassword: boolean, isLocked: boolean }>}
 */
function getPasswordStatusForFrontend() {
  checkPermission('staff_manage');

  var staff = coreCustomerFrontendReadTable(getSpreadsheet(), 'STAFF', [
    'STAFF_ID', 'LAST_NAME_JA', 'FIRST_NAME_JA', 'PASSWORD_HASH', 'LOCKED_UNTIL'
  ]);

  var now = new Date();

  return staff.rows
    .filter(function(row) {
      return !!coreCustomerFrontendValue(row[staff.indexes.STAFF_ID]);
    })
    .map(function(row) {
      // LOCKED_UNTIL は生値（Date or ''）を使ってロック判定
      var lockedUntilRaw = row[staff.indexes.LOCKED_UNTIL];
      var isLocked = (lockedUntilRaw instanceof Date) && (now < lockedUntilRaw);

      return {
        staffId:    coreCustomerFrontendValue(row[staff.indexes.STAFF_ID]),
        fullNameJa: [
          coreCustomerFrontendValue(row[staff.indexes.LAST_NAME_JA]),
          coreCustomerFrontendValue(row[staff.indexes.FIRST_NAME_JA])
        ].filter(Boolean).join(' '),
        hasPassword: !!coreCustomerFrontendValue(row[staff.indexes.PASSWORD_HASH]),
        isLocked:    isLocked
      };
    });
}
