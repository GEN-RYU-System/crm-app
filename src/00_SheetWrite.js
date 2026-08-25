/**
 * シート書き込みの共通ラッパー。
 *
 * - useLock が true のとき LockService.getScriptLock() + waitLock(30000) で排他制御する。
 * - 書き込み成功後、cacheTargets を全て clearCacheChunks_ で無効化する。
 * - キャッシュ削除後、同期シグナルを CacheService に記録する（writeSyncSignals_）。
 * - useLock が true なら finally で releaseLock する。
 * - writeFn の戻り値をそのまま返す。
 *
 * 依存: 00_CacheChunks.js — clearCacheChunks_
 *
 * @param {{
 *   useLock: boolean,
 *   cacheTargets: Array<{ indexKey: string, prefix: string }>
 * }} options
 * @param {function(): *} writeFn
 * @returns {*}
 */
function withSheetWrite_(options, writeFn) {
  const lock = options.useLock ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(30000);
  try {
    const result = writeFn();
    for (const target of options.cacheTargets) {
      clearCacheChunks_(target.indexKey, target.prefix);
    }
    writeSyncSignals_(options.cacheTargets);
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * cacheTargets から同期シグナルを CacheService に記録する。
 * キー: SYNC_SIGNAL_{種別}  値: Date.now() 文字列  TTL: 21600s(6時間)
 *
 * 種別は indexKey から導出する。ルール:
 *   LEADS_CACHE_INDEX_ALL → "leads"
 *   LEADS_CACHE_INDEX_INBOUND → "leads"
 *   LEADS_CACHE_INDEX_OUTBOUND → "leads"
 *   CORE_ORDERS_CACHE_INDEX → "orders"
 *   CORE_QUOTES_CACHE_INDEX → "quotes"
 *   SHARED_INVENTORY_CACHE_INDEX(_*) → "inventory"
 *   その他 → indexKey を小文字化して使用
 *
 * @param {Array<{indexKey: string, prefix: string}>} cacheTargets
 */
function writeSyncSignals_(cacheTargets) {
  if (!cacheTargets || !cacheTargets.length) return;
  var domains = cacheTargets.map(function(target) {
    return cacheTargetToDomain_(target.indexKey);
  });
  writeSyncSignalDomains_(domains);
}

/**
 * 指定ドメインの同期シグナルを記録する。
 * シート以外（Script Properties、外部受信）の書き込み成功後も
 * withSheetWrite_ と同じ CacheService 契約で通知するために使用する。
 *
 * @param {string[]} domains
 */
function writeSyncSignalDomains_(domains) {
  if (!domains || !domains.length) return;
  try {
    var cache = CacheService.getScriptCache();
    var props = {};
    var now = String(Date.now());
    var added = {};
    domains.forEach(function(domain) {
      domain = String(domain || '').trim();
      if (!domain) return;
      if (!added[domain]) {
        props['SYNC_SIGNAL_' + domain] = now;
        added[domain] = true;
      }
    });
    if (Object.keys(props).length) cache.putAll(props, 21600);
  } catch (e) {
    // シグナル記録失敗は書き込み成功に影響させない
  }
}

/**
 * @param {string} indexKey
 * @returns {string}
 */
function cacheTargetToDomain_(indexKey) {
  var k = String(indexKey || '');
  if (k.indexOf('LEADS') !== -1) return 'leads';
  if (k.indexOf('ORDERS') !== -1) return 'orders';
  if (k.indexOf('QUOTES') !== -1) return 'quotes';
  if (k.indexOf('INVENTORY') !== -1 || k.indexOf('SHARED') !== -1) return 'inventory';
  if (k.indexOf('INBOX') !== -1) return 'inbox';
  return k.toLowerCase().replace(/_cache_index.*$/, '').replace(/_/g, '');
}
