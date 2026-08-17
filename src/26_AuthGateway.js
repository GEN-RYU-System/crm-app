/**
 * 認証ゲートウェイ。
 * 「現在の実行者は誰か」を決める唯一の場所。
 *
 * このファイル以外で Session.getActiveUser() を
 * 直接呼び出してはならない。
 *
 * 認証経路（優先順）:
 *   1. パスワードセッション: setEmailFromSession(sessionId) で
 *      実行スコープに email を注入済みの場合は _executionEmail を返す
 *   2. Google アカウント: Session.getActiveUser().getEmail()（フォールバック）
 */

/** 同一実行コンテキスト内で有効なメールアドレス。実行開始時は null。 */
var _executionEmail = null;

function resolveCurrentUserEmail() {
  if (_executionEmail !== null) return _executionEmail;
  var email = Session.getActiveUser().getEmail();
  return email || null;
}

/**
 * sessionId を検証し、対応する担当者の email を実行スコープに注入する。
 *
 * @param {string|undefined|null} sessionId
 *   - 未指定（null/undefined）: 何もせず Google Auth にフォールバック（移行期間中の後方互換）
 *   - 指定されたが無効: SESSION_INVALID を throw
 */
function setEmailFromSession(sessionId) {
  if (!sessionId) return;
  var user = getSessionUser(sessionId);
  if (!user) throw new Error('SESSION_INVALID');
  _executionEmail = user.email;
}
