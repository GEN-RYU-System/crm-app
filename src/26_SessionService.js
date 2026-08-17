/**
 * ログインセッション管理。
 * セッションIDとその有効状態をシートで管理する。
 *
 * 物理ヘッダー名・状態値は Core Schema V1 から解決する。
 * 直書き禁止。
 *
 * シートへの書き込みはすべて LockService で保護する。
 */

var SESSION_LIFETIME_HOURS = 12;

// ─────────────────────────────────────────────
// 公開API
// ─────────────────────────────────────────────

/**
 * セッションを発行し、セッションIDを返す。
 * @param {string} staffId
 * @returns {string} セッションID
 */
function createSession(staffId) {
  var sessionId = Utilities.getUuid() + Utilities.getUuid();
  var now = new Date();
  var expiresAt = new Date(now.getTime() + SESSION_LIFETIME_HOURS * 60 * 60 * 1000);

  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'LOGIN_SESSIONS');
  var sheet = result.sheet;
  var hi = result.headerIndexes;

  var statusActive = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'ACTIVE');

  var maxCol = Object.keys(hi).length;
  var row = new Array(maxCol);

  row[_sessionColIdx(hi, 'SESSION_ID')  ] = sessionId;
  row[_sessionColIdx(hi, 'STAFF_ID')    ] = staffId;
  row[_sessionColIdx(hi, 'ISSUED_AT')   ] = now;
  row[_sessionColIdx(hi, 'LAST_USED_AT')] = now;
  row[_sessionColIdx(hi, 'EXPIRES_AT')  ] = expiresAt;
  row[_sessionColIdx(hi, 'STATUS')      ] = statusActive;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  return sessionId;
}

/**
 * セッションIDを検証し、有効であれば担当者IDを返す。
 * 無効・期限切れ・存在しない場合はすべて null を返す。
 * （どちらの理由かを外部に知らせない）
 * @param {string} sessionId
 * @returns {string|null} staffId or null
 */
function validateSession(sessionId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'LOGIN_SESSIONS');
  var sheet = result.sheet;
  var hi = result.headerIndexes;

  var statusActive  = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'ACTIVE');
  var statusExpired = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'EXPIRED');

  var sessionIdHeader  = getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'SESSION_ID');
  var statusColIdx     = _sessionColIdx(hi, 'STATUS');
  var expiresAtColIdx  = _sessionColIdx(hi, 'EXPIRES_AT');
  var staffIdColIdx    = _sessionColIdx(hi, 'STAFF_ID');
  var lastUsedColIdx   = _sessionColIdx(hi, 'LAST_USED_AT');

  var data = sheet.getDataRange().getValues();
  var sessionIdColIdx = _sessionColIdx(hi, 'SESSION_ID');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sessionIdColIdx]).trim() !== sessionId) continue;

    // 見つかった
    var status    = String(data[i][statusColIdx]).trim();
    var expiresAt = data[i][expiresAtColIdx];
    var staffId   = String(data[i][staffIdColIdx]).trim();
    var rowNum    = i + 1;

    // 状態が ACTIVE でない → null
    if (status !== statusActive) return null;

    // 有効期限チェック
    var now = new Date();
    if (expiresAt instanceof Date && now > expiresAt) {
      _updateSessionStatus(sheet, rowNum, statusColIdx, statusExpired);
      return null;
    }

    // 有効 → 最終利用日時を更新して担当者IDを返す
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet.getRange(rowNum, lastUsedColIdx + 1).setValue(now);
    } finally {
      lock.releaseLock();
    }

    return staffId;
  }

  // 見つからなかった
  return null;
}

/**
 * セッションを即時失効させる（ログアウト）。
 * @param {string} sessionId
 */
function revokeSession(sessionId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'LOGIN_SESSIONS');
  var sheet = result.sheet;
  var hi = result.headerIndexes;

  var statusRevoked    = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'REVOKED');
  var sessionIdColIdx  = _sessionColIdx(hi, 'SESSION_ID');
  var statusColIdx     = _sessionColIdx(hi, 'STATUS');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sessionIdColIdx]).trim() !== sessionId) continue;
    _updateSessionStatus(sheet, i + 1, statusColIdx, statusRevoked);
    return;
  }
}

/**
 * 指定担当者の ACTIVE セッションをすべて失効させる。
 * パスワード変更・アカウント無効化時に呼び出す。
 * @param {string} staffId
 */
function revokeAllSessionsForStaff(staffId) {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'LOGIN_SESSIONS');
  var sheet = result.sheet;
  var hi = result.headerIndexes;

  var statusActive  = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'ACTIVE');
  var statusRevoked = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'REVOKED');
  var staffIdColIdx = _sessionColIdx(hi, 'STAFF_ID');
  var statusColIdx  = _sessionColIdx(hi, 'STATUS');

  var data = sheet.getDataRange().getValues();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][staffIdColIdx]).trim() !== staffId) continue;
      if (String(data[i][statusColIdx]).trim() !== statusActive) continue;
      sheet.getRange(i + 1, statusColIdx + 1).setValue(statusRevoked);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 失効日時を過ぎた ACTIVE 行を EXPIRED に一括更新する。
 * 行の削除は行わない。
 */
function cleanupExpiredSessions() {
  var result = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'LOGIN_SESSIONS');
  var sheet = result.sheet;
  var hi = result.headerIndexes;

  var statusActive  = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'ACTIVE');
  var statusExpired = getCoreSchemaV1Value('LOGIN_SESSIONS', 'STATUS', 'EXPIRED');
  var statusColIdx    = _sessionColIdx(hi, 'STATUS');
  var expiresAtColIdx = _sessionColIdx(hi, 'EXPIRES_AT');

  var now = new Date();
  var data = sheet.getDataRange().getValues();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][statusColIdx]).trim() !== statusActive) continue;
      var expiresAt = data[i][expiresAtColIdx];
      if (expiresAt instanceof Date && now > expiresAt) {
        sheet.getRange(i + 1, statusColIdx + 1).setValue(statusExpired);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
// シートセットアップ
// ─────────────────────────────────────────────

/**
 * ログインセッションシートを作成する（初回セットアップ用）。
 * 既存タブがある場合は何もせず 'ALREADY_EXISTS' を返す。
 * @returns {string} 'CREATED' or 'ALREADY_EXISTS'
 */
function setupLoginSessionSheet() {
  var sheetName = getCoreSchemaV1TableName('LOGIN_SESSIONS');
  var ss = getSpreadsheet();

  if (ss.getSheetByName(sheetName)) {
    return 'ALREADY_EXISTS';
  }

  var headers = [
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'SESSION_ID'),
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'STAFF_ID'),
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'ISSUED_AT'),
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'LAST_USED_AT'),
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'EXPIRES_AT'),
    getCoreSchemaV1HeaderName('LOGIN_SESSIONS', 'STATUS')
  ];

  var sheet;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (ss.getSheetByName(sheetName)) {
      return 'ALREADY_EXISTS';
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a5568');
  headerRange.setFontColor('#ffffff');

  return 'CREATED: ' + sheetName;
}

// ─────────────────────────────────────────────
// DEV専用テストラッパー
// ─────────────────────────────────────────────

/**
 * セッション機能の一貫テスト（DEV専用）。
 * 5つのシナリオを順に実行し、各ステップの合否と
 * シートの行数・状態一覧を返す。
 * セッションIDの値そのものは返さない。
 *
 * @returns {Object}
 */
function testSessionServiceAll() {
  if (getEnvironment() !== 'development') {
    throw new Error('testSessionServiceAll は development 環境でのみ実行可能');
  }

  var results = [];

  function sheetSnapshot() {
    var ss = getSpreadsheet();
    var result = validateCoreSchemaV1TableForWrite(ss, 'LOGIN_SESSIONS');
    var sheet = result.sheet;
    var hi = result.headerIndexes;
    var statusColIdx = _sessionColIdx(hi, 'STATUS');
    var staffIdColIdx = _sessionColIdx(hi, 'STAFF_ID');
    var data = sheet.getDataRange().getValues();
    var rows = data.slice(1).filter(function(r) { return String(r[0]).trim(); });
    return {
      rowCount: rows.length,
      statuses: rows.map(function(r) {
        return { staffId: String(r[staffIdColIdx]).trim(), status: String(r[statusColIdx]).trim() };
      })
    };
  }

  // (1) createSession('EMP-00001') → セッションIDが返る
  var sid1 = createSession('EMP-00001');
  results.push({
    test: '(1) createSession',
    pass: typeof sid1 === 'string' && sid1.length > 30,
    detail: 'sessionId length=' + sid1.length,
    sheet: sheetSnapshot()
  });

  // (2) validateSession(sid1) → 'EMP-00001' が返る
  var v2 = validateSession(sid1);
  results.push({
    test: '(2) validateSession(有効ID)',
    pass: v2 === 'EMP-00001',
    detail: 'returned=' + v2,
    sheet: sheetSnapshot()
  });

  // (3) validateSession('存在しないID') → null
  var v3 = validateSession('nonexistent-id');
  results.push({
    test: '(3) validateSession(存在しないID)',
    pass: v3 === null,
    detail: 'returned=' + v3,
    sheet: sheetSnapshot()
  });

  // (4) revokeSession(sid1) → validateSession → null
  revokeSession(sid1);
  var v4 = validateSession(sid1);
  results.push({
    test: '(4) revokeSession → validateSession',
    pass: v4 === null,
    detail: 'returned=' + v4,
    sheet: sheetSnapshot()
  });

  // (5) createSession → revokeAllSessionsForStaff → validateSession → null
  var sid5 = createSession('EMP-00001');
  revokeAllSessionsForStaff('EMP-00001');
  var v5 = validateSession(sid5);
  results.push({
    test: '(5) revokeAllSessionsForStaff → validateSession',
    pass: v5 === null,
    detail: 'returned=' + v5,
    sheet: sheetSnapshot()
  });

  var allPass = results.every(function(r) { return r.pass; });
  return { allPass: allPass, results: results };
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

/**
 * headerIndexes（物理ヘッダー名 → 1-based列番号）から
 * 論理キー経由で 0-based列インデックスを返す。
 */
function _sessionColIdx(headerIndexes, logicalKey) {
  var physicalName = getCoreSchemaV1HeaderName('LOGIN_SESSIONS', logicalKey);
  return headerIndexes[physicalName] - 1;
}

/**
 * 状態列を LockService で保護しながら更新する。
 */
function _updateSessionStatus(sheet, rowNum, statusColIdx, newStatus) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet.getRange(rowNum, statusColIdx + 1).setValue(newStatus);
  } finally {
    lock.releaseLock();
  }
}
