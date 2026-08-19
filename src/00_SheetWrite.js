/**
 * シート書き込みの共通ラッパー。
 *
 * - useLock が true のとき LockService.getScriptLock() + waitLock(30000) で排他制御する。
 * - 書き込み成功後、cacheTargets を全て clearCacheChunks_ で無効化する。
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
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}
