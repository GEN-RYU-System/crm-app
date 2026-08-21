/**
 * パスワードハッシュユーティリティ。
 * 保存・検証にのみ使用する。平文パスワードをシートに書かない。
 *
 * アルゴリズム: SHA-256 を HASH_ITERATIONS 回繰り返す（ストレッチング）
 * ソルト: 担当者ごとにランダム生成（generatePasswordSalt）
 */

var HASH_ITERATIONS = 500;

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

// ─────────────────────────────────────────────
// DEV専用テストラッパー
// ─────────────────────────────────────────────

/**
 * hashPassword / verifyPassword の動作確認（DEV専用）。
 * テストパラメータ: password='test1234', salt='fixed-salt-for-test'
 *
 * @returns {{
 *   hash1: string, hash2: string, hashesMatch: boolean,
 *   elapsed1Ms: number, elapsed2Ms: number,
 *   verifyCorrect: boolean, verifyWrong: boolean
 * }}
 */
function testHashPasswordAndVerify() {
  if (getEnvironment() !== 'development') {
    throw new Error('testHashPasswordAndVerify は development 環境でのみ実行可能');
  }
  var password = 'test1234';
  var salt = 'fixed-salt-for-test';

  var t1 = Date.now();
  var hash1 = hashPassword(password, salt);
  var elapsed1 = Date.now() - t1;

  var t2 = Date.now();
  var hash2 = hashPassword(password, salt);
  var elapsed2 = Date.now() - t2;

  return {
    hash1: hash1,
    hash2: hash2,
    hashesMatch: hash1 === hash2,
    elapsed1Ms: elapsed1,
    elapsed2Ms: elapsed2,
    verifyCorrect: verifyPassword(password, salt, hash1),
    verifyWrong: verifyPassword('wrong', salt, hash1)
  };
}

/**
 * generatePasswordSalt の動作確認（DEV専用）。
 * @returns {{ salt1: string, salt2: string, different: boolean }}
 */
function testGeneratePasswordSalt() {
  if (getEnvironment() !== 'development') {
    throw new Error('testGeneratePasswordSalt は development 環境でのみ実行可能');
  }
  var salt1 = generatePasswordSalt();
  var salt2 = generatePasswordSalt();
  return { salt1: salt1, salt2: salt2, different: salt1 !== salt2 };
}
