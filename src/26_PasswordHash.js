/**
 * パスワードハッシュユーティリティ。
 * 保存・検証にのみ使用する。平文パスワードをシートに書かない。
 *
 * アルゴリズム: SHA-256 を HASH_ITERATIONS 回繰り返す（ストレッチング）
 * ソルト: 担当者ごとにランダム生成（generatePasswordSalt）
 */

var HASH_ITERATIONS = 10000;

/**
 * ランダムなソルト文字列を生成する。
 * @returns {string}
 */
function generatePasswordSalt() {
  return Utilities.getUuid();
}

/**
 * パスワードをソルト付きでハッシュ化する。
 * @param {string} password
 * @param {string} salt
 * @returns {string} Base64エンコードされたハッシュ文字列
 */
function hashPassword(password, salt) {
  var value = salt + password;
  for (var i = 0; i < HASH_ITERATIONS; i++) {
    value = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    );
  }
  return value;
}

/**
 * パスワードが保存済みハッシュと一致するか検証する。
 * @param {string} password
 * @param {string} salt
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(password, salt, storedHash) {
  return hashPassword(password, salt) === storedHash;
}
