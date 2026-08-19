var SHARED_INVENTORY_CACHE_INDEX      = 'SHARED_INVENTORY_CACHE_INDEX';
var SHARED_INVENTORY_CACHE_PREFIX     = 'SHARED_INVENTORY_CACHE_';
var SHARED_INVENTORY_CACHE_CHUNK_SIZE = 90000;
var SHARED_INVENTORY_CACHE_TTL        = 600;

/**
 * キャッシュから共用在庫行を読み出す。
 * 全チャンクが揃っていない場合は null を返す（→シート読み出しにフォールバック）。
 * @returns {Object[]|null}
 */
function readSharedInventoryFromCache_() {
  var cache     = CacheService.getScriptCache();
  var indexVal  = cache.get(SHARED_INVENTORY_CACHE_INDEX);
  if (indexVal === null) return null;

  var chunkCount = parseInt(indexVal, 10);
  if (isNaN(chunkCount) || chunkCount < 1) return null;

  var keys = [];
  for (var i = 0; i < chunkCount; i++) {
    keys.push(SHARED_INVENTORY_CACHE_PREFIX + i);
  }

  var all = cache.getAll(keys);
  var json = '';
  for (var j = 0; j < chunkCount; j++) {
    var chunk = all[SHARED_INVENTORY_CACHE_PREFIX + j];
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
 * 共用在庫行をキャッシュに書き込む（分割キー方式）。
 * @param {Object[]} rows
 */
function writeSharedInventoryToCache_(rows) {
  var cache = CacheService.getScriptCache();
  var json  = JSON.stringify(rows);
  var total = json.length;
  var chunkCount = Math.ceil(total / SHARED_INVENTORY_CACHE_CHUNK_SIZE);

  var map = {};
  for (var i = 0; i < chunkCount; i++) {
    var start = i * SHARED_INVENTORY_CACHE_CHUNK_SIZE;
    map[SHARED_INVENTORY_CACHE_PREFIX + i] = json.slice(start, start + SHARED_INVENTORY_CACHE_CHUNK_SIZE);
  }
  map[SHARED_INVENTORY_CACHE_INDEX] = String(chunkCount);

  cache.putAll(map, SHARED_INVENTORY_CACHE_TTL);
}

/**
 * スプレッドシートから共用在庫行を組み立てる（純粋データ変換）。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object[]}
 */
function buildSharedInventoryRows_(ss) {
  // ── 商品マスタ同期: product_id → { japaneseTitle, releaseDate, ipId } ──
  var productMap  = {};
  var productSheet = ss.getSheetByName('商品マスタ同期');
  if (productSheet && productSheet.getLastRow() > 1) {
    var pData   = productSheet.getDataRange().getValues();
    var pH      = pData[0].map(String);
    var pidIdx  = pH.indexOf('product_id');
    var jaIdx   = pH.indexOf('Japanese Title');
    var enIdx   = pH.indexOf('English Title');
    var markIdx = pH.indexOf('Mark');
    var rdIdx   = pH.indexOf('Release Date');
    var ipIdx   = pH.indexOf('作品ID');
    if (pidIdx !== -1) {
      for (var i = 1; i < pData.length; i++) {
        var r   = pData[i];
        var pid = String(r[pidIdx] != null ? r[pidIdx] : '').trim();
        if (!pid) continue;
        var releaseDate = '';
        if (rdIdx !== -1 && r[rdIdx] instanceof Date) {
          releaseDate = Utilities.formatDate(r[rdIdx], 'JST', 'yyyy-MM-dd');
        }
        productMap[pid] = {
          japaneseTitle: jaIdx   !== -1 ? String(r[jaIdx]   != null ? r[jaIdx]   : '') : '',
          englishTitle:  enIdx   !== -1 ? String(r[enIdx]   != null ? r[enIdx]   : '') : '',
          mark:          markIdx !== -1 ? String(r[markIdx]  != null ? r[markIdx] : '') : '',
          releaseDate:   releaseDate,
          ipId:          ipIdx   !== -1 ? String(r[ipIdx]   != null ? r[ipIdx]   : '').trim() : ''
        };
      }
    }
  }

  // ── 作品マスタ_共用在庫: ip_id → 表示名（別名優先、空の場合は作品名）──
  var ipMap   = {};
  var ipSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (ipSheet && ipSheet.getLastRow() > 1) {
    var ipData    = ipSheet.getDataRange().getValues();
    var ipH       = ipData[0].map(String);
    var ipIdIdx   = ipH.indexOf('ip_id');
    var ipNameIdx = ipH.indexOf('作品名');
    var ipAltIdx  = ipH.indexOf('別名');
    if (ipIdIdx !== -1 && ipNameIdx !== -1) {
      for (var ii = 1; ii < ipData.length; ii++) {
        var ir      = ipData[ii];
        var id      = String(ir[ipIdIdx] != null ? ir[ipIdIdx] : '').trim();
        if (!id) continue;
        var name    = String(ir[ipNameIdx] != null ? ir[ipNameIdx] : '').trim();
        var altName = ipAltIdx !== -1 ? String(ir[ipAltIdx] != null ? ir[ipAltIdx] : '').trim() : '';
        ipMap[id]   = altName || name;
      }
    }
  }

  // ── 共用在庫: ヘッダー名で列を動的解決 ──────────────────────────────
  var invSheet = ss.getSheetByName('共用在庫');
  if (!invSheet) return [];
  var invData = invSheet.getDataRange().getValues();
  if (invData.length <= 1) return [];

  var headers = invData[0].map(String);
  var col = {
    series:          headers.indexOf('Series'),
    quantity:        headers.indexOf('Quantity'),
    unitPrice:       headers.indexOf('Unit Price'),
    condition:       headers.indexOf('Condition'),
    status:          headers.indexOf('Status'),
    noteJa:          headers.indexOf('Note_JA'),
    noteEn:          headers.indexOf('Note_EN'),
    supplier:        headers.indexOf('提供者'),
    productId:       headers.indexOf('product_id'),
    rawName:         headers.indexOf('raw_name'),
    exclusionReason: headers.indexOf('除外理由')
  };

  var missing = Object.keys(col).filter(function(key) { return col[key] === -1; });
  if (missing.length > 0) {
    throw new Error('共用在庫ヘッダー不足: ' + missing.join(', '));
  }

  var rows = [];
  for (var ri = 1; ri < invData.length; ri++) {
    var row     = invData[ri];
    var rowPid  = String(row[col.productId] != null ? row[col.productId] : '').trim();
    var product = productMap[rowPid] || {};
    var ipId    = product.ipId || '';
    var ipName  = ipId ? (ipMap[ipId] || '') : '';

    rows.push({
      series:          String(row[col.series]          != null ? row[col.series]          : ''),
      quantity:        Number(row[col.quantity])        || 0,
      unitPrice:       Number(row[col.unitPrice])       || 0,
      condition:       String(row[col.condition]        != null ? row[col.condition]        : ''),
      status:          String(row[col.status]           != null ? row[col.status]           : ''),
      noteJa:          String(row[col.noteJa]           != null ? row[col.noteJa]           : ''),
      noteEn:          String(row[col.noteEn]           != null ? row[col.noteEn]           : ''),
      supplier:        String(row[col.supplier]         != null ? row[col.supplier]         : ''),
      productId:       rowPid,
      rawName:         String(row[col.rawName]          != null ? row[col.rawName]          : ''),
      exclusionReason: String(row[col.exclusionReason]  != null ? row[col.exclusionReason]  : ''),
      ipId:            ipId,
      ipName:          ipName,
      releaseDate:     product.releaseDate    || '',
      japaneseTitle:   product.japaneseTitle  || '',
      englishTitle:    product.englishTitle   || '',
      mark:            product.mark           || ''
    });
  }
  return rows;
}

/**
 * 共用在庫一覧をフロントエンド向けに返す
 * 共用在庫 → product_id → 商品マスタ同期 → 作品ID → 作品マスタ_共用在庫 の2段階結合
 * @param {string} sessionId
 * @param {boolean} [forceRefresh]
 */
function getSharedInventoryForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (forceRefresh !== true) {
    var cached = readSharedInventoryFromCache_();
    if (cached !== null) return cached;
  }

  var ss   = getSpreadsheet();
  var rows = buildSharedInventoryRows_(ss);
  writeSharedInventoryToCache_(rows);
  return rows;
}
