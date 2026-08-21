/**
 * 認証ゲートウェイ。
 * 「現在の実行者は誰か」を決める唯一の場所。
 *
 * このファイル以外で Session.getActiveUser() を
 * 直接呼び出してはならない。
 *
 * 認証経路:
 *   setEmailFromSession(sessionId) で実行スコープに email を注入済みの場合のみ
 *   有効なメールアドレスを返す。未注入時は null。
 */

/** 同一実行コンテキスト内で有効なメールアドレス。実行開始時は null。 */
var _executionEmail = null;

function resolveCurrentUserEmail() {
  return _executionEmail;
}

/**
 * sessionId を検証し、対応する担当者の email を実行スコープに注入する。
 *
 * @param {string|null|undefined} sessionId - セッションID（必須）
 * @throws {Error} SESSION_REQUIRED - sessionId が未指定
 * @throws {Error} SESSION_INVALID - sessionId が無効（セッション切れ等）
 */
function setEmailFromSession(sessionId) {
  if (!sessionId) throw new Error('SESSION_REQUIRED');
  var user = getSessionUser(sessionId);
  if (!user) throw new Error('SESSION_INVALID');
  _executionEmail = user.email;
}
