/**
 * GAS CacheService 分割キーユーティリティ
 * JSON データを 90,000 文字チャンクに分割して CacheService に読み書きする共通関数。
 *
 * 呼び出し元がドメイン定数（INDEX/PREFIX/TTL/CHUNK_SIZE）を保持し、
 * この関数群は引数経由で受け取る。
 */

/**
 * キャッシュから分割保存されたデータを読み出す。
 * チャンクが1つでも欠けている場合は null を返す（→シート読み出しにフォールバック）。
 * @param {string} indexKey   チャンク数を保存しているキー
 * @param {string} prefix     各チャンクのキープレフィックス（prefix + 番号）
 * @returns {*|null}
 */
function readCacheChunks_(indexKey, prefix) {
  const cache    = CacheService.getScriptCache();
  const indexVal = cache.get(indexKey);
  if (indexVal === null) return null;

  const chunkCount = parseInt(indexVal, 10);
  if (isNaN(chunkCount) || chunkCount < 1) return null;

  const keys = [];
  for (let i = 0; i < chunkCount; i++) {
    keys.push(prefix + i);
  }

  const all = cache.getAll(keys);
  let json = '';
  for (let j = 0; j < chunkCount; j++) {
    const chunk = all[prefix + j];
    if (chunk === null || chunk === undefined) return null;
    json += chunk;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * データを分割してキャッシュに書き込む。
 * @param {string} indexKey   チャンク数を保存するキー
 * @param {string} prefix     各チャンクのキープレフィックス（prefix + 番号）
 * @param {*}      data       保存するデータ（JSON.stringify 可能）
 * @param {number} ttlSeconds キャッシュ有効期限（秒）
 * @param {number} chunkSize  1チャンクあたりの最大文字数
 */
function writeCacheChunks_(indexKey, prefix, data, ttlSeconds, chunkSize) {
  const cache      = CacheService.getScriptCache();
  const json       = JSON.stringify(data);
  const total      = json.length;
  const chunkCount = Math.ceil(total / chunkSize);

  const map = {};
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    map[prefix + i] = json.slice(start, start + chunkSize);
  }
  map[indexKey] = String(chunkCount);

  cache.putAll(map, ttlSeconds);
}

/**
 * 分割キャッシュを全削除する。INDEX キーが存在しない場合は何もしない。
 * @param {string} indexKey   チャンク数を保存しているキー
 * @param {string} prefix     各チャンクのキープレフィックス（prefix + 番号）
 */
function clearCacheChunks_(indexKey, prefix) {
  const cache    = CacheService.getScriptCache();
  const indexVal = cache.get(indexKey);
  if (indexVal === null) return;

  const chunkCount = parseInt(indexVal, 10);
  if (isNaN(chunkCount) || chunkCount < 1) {
    cache.remove(indexKey);
    return;
  }

  const keys = [indexKey];
  for (let i = 0; i < chunkCount; i++) {
    keys.push(prefix + i);
  }
  cache.removeAll(keys);
}
