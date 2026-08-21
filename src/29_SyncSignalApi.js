/**
 * 同期シグナル確認 API
 *
 * クライアントがポーリングで呼び出し、更新があった種別を検知するために使用する。
 * 時刻情報のみを返すため権限チェックは行わない（認証のみ）。
 *
 * 公開関数:
 *   checkSyncSignals(sessionId)
 */

/* global setEmailFromSession, CacheService */

var SYNC_SIGNAL_DOMAINS = ['leads', 'quotes', 'orders', 'inventory', 'staff', 'customers'];

/**
 * 全種別の同期シグナルを1回の getAll で取得して返す。
 *
 * @param {string} sessionId
 * @returns {Object.<string, string|null>}
 *   例: { leads: "1755000000000", quotes: null, orders: "1755000001234", ... }
 */
function checkSyncSignals(sessionId) {
  setEmailFromSession(sessionId);
  // 権限チェック不要: 時刻情報のみ、データを含まない

  var cache = CacheService.getScriptCache();
  try { cache.put('LAST_CHECK_SYNC_SIGNALS', String(Date.now()), 21600); } catch (e) {}
  var keys = SYNC_SIGNAL_DOMAINS.map(function(d) { return 'SYNC_SIGNAL_' + d; });
  var values = cache.getAll(keys);

  var result = {};
  SYNC_SIGNAL_DOMAINS.forEach(function(d) {
    result[d] = values['SYNC_SIGNAL_' + d] || null;
  });
  return result;
}
