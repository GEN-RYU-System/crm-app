/**
 * 認証ゲートウェイ。
 * 「現在の実行者は誰か」を決める唯一の場所。
 * 将来ここにログインID＋パスワード認証の経路を追加する。
 *
 * このファイル以外で Session.getActiveUser() を
 * 直接呼び出してはならない。
 */
function resolveCurrentUserEmail() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return null;
  return email;
}
