var SHARED_INVENTORY_CACHE_INDEX      = 'SHARED_INVENTORY_CACHE_INDEX';
var SHARED_INVENTORY_CACHE_PREFIX     = 'SHARED_INVENTORY_CACHE_';
var SHARED_INVENTORY_CACHE_CHUNK_SIZE = 90000;
var SHARED_INVENTORY_CACHE_TTL        = 600;

/**
 * スプレッドシートから共用在庫行を組み立てる（純粋データ変換）。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object[]}
 */
function buildSharedInventoryRows_(ss) {
  // ── 商品マスタ同期: product_id → { japaneseTitle, releaseDate, ipId, boxWeight, caseWeight } ──
  var productMap  = {};
  var productSheet = ss.getSheetByName('商品マスタ同期');
  if (productSheet && productSheet.getLastRow() > 1) {
    var pData   = productSheet.getDataRange().getValues();
    var pH      = pData[0].map(String);
    var pidIdx       = pH.indexOf('product_id');
    var jaIdx        = pH.indexOf('Japanese Title');
    var enIdx        = pH.indexOf('English Title');
    var markIdx      = pH.indexOf('Mark');
    var rdIdx        = pH.indexOf('Release Date');
    var ipIdx        = pH.indexOf('作品ID');
    var boxWeightIdx  = pH.indexOf('Box重量');
    var caseWeightIdx = pH.indexOf('Case重量');
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
          ipId:          ipIdx        !== -1 ? String(r[ipIdx]        != null ? r[ipIdx]        : '').trim() : '',
          boxWeight:     boxWeightIdx  !== -1 ? (Number(r[boxWeightIdx])  || 0) : 0,
          caseWeight:    caseWeightIdx !== -1 ? (Number(r[caseWeightIdx]) || 0) : 0
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
    var ipNameIdx = ipH.indexOf('title');
    var ipAltIdx  = ipH.indexOf('alias');
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

  var CONDITION_CASE = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'].values.CONDITION.CASE;

  var rows = [];
  for (var ri = 1; ri < invData.length; ri++) {
    var row       = invData[ri];
    var rowPid    = String(row[col.productId] != null ? row[col.productId] : '').trim();
    var product   = productMap[rowPid] || {};
    var ipId      = product.ipId || '';
    var ipName    = ipId ? (ipMap[ipId] || '') : '';
    var condition = String(row[col.condition] != null ? row[col.condition] : '');
    var unitWeight = (condition === CONDITION_CASE)
      ? (product.caseWeight || 0)
      : (product.boxWeight  || 0);

    rows.push({
      series:          String(row[col.series]          != null ? row[col.series]          : ''),
      quantity:        Number(row[col.quantity])        || 0,
      unitPrice:       Number(row[col.unitPrice])       || 0,
      condition:       condition,
      unitWeight:      unitWeight,
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
 * 表示設定マスタから在庫画面の display_mode を読む。
 * 設定シートが存在しない・ヘッダーが見つからない等の例外は 'all' にフォールバックする。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {string} 'cheapest_one' | 'all'
 */
function readInventoryDisplayMode_(ss) {
  try {
    var tableKey = 'DISPLAY_SETTINGS';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheet    = ss.getSheetByName(table.sheetName);
    if (!sheet || sheet.getLastRow() <= table.headerRowNumber) return 'all';
    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(String);
    var colKey    = headers.indexOf(getCoreSchemaV1HeaderName(tableKey, 'SETTING_KEY'));
    var colValue  = headers.indexOf(getCoreSchemaV1HeaderName(tableKey, 'SETTING_VALUE'));
    var colScreen = headers.indexOf(getCoreSchemaV1HeaderName(tableKey, 'TARGET_SCREEN'));
    if (colKey === -1 || colValue === -1 || colScreen === -1) return 'all';
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (String(r[colScreen]).trim() === 'inventory' && String(r[colKey]).trim() === 'display_mode') {
        var v = String(r[colValue]).trim();
        return v || 'all';
      }
    }
    return 'all';
  } catch (e) {
    Logger.log('[readInventoryDisplayMode_] 設定読み取りエラー、all にフォールバック: ' + e.message);
    return 'all';
  }
}

/**
 * display_mode に従って在庫行を集約する。
 * cheapest_one: product_id × Condition ごとに Unit Price 最安の1行を採用。
 * all:          集約しない（元の rows をそのまま返す）。
 * @param {Object[]} rows buildSharedInventoryRows_ の返却値
 * @param {string}   displayMode
 * @returns {Object[]}
 */
function applyInventoryDisplayMode_(rows, displayMode) {
  if (displayMode !== 'cheapest_one') return rows;
  var groups = {};
  rows.forEach(function(row) {
    var key      = row.productId + '\x00' + row.condition;
    var existing = groups[key];
    if (!existing || row.unitPrice < existing.unitPrice) {
      groups[key] = row;
    }
  });
  return Object.keys(groups).map(function(k) { return groups[k]; });
}

/**
 * 共用在庫一覧と商品オプション一覧を1回のシート読み取りでまとめて返す。
 * getSharedInventoryForFrontend + getInventoryProductOptions の固定オーバーヘッドを削減する。
 *
 * キャッシュ: SHARED_INVENTORY_CACHE_INDEX (在庫) と INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX (商品オプション)
 * の両方がヒットすればシート読み取りなしで返す。
 *
 * @param {string}  sessionId
 * @param {boolean} [forceRefresh]
 * @returns {{ inventory: Object[], productOptions: Object[] }}
 */
function getInventoryBatchForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss          = getSpreadsheet();
  var displayMode = readInventoryDisplayMode_(ss);
  var invCacheIndex  = SHARED_INVENTORY_CACHE_INDEX + '_' + displayMode;
  var invCachePrefix = SHARED_INVENTORY_CACHE_PREFIX + displayMode + '_';

  if (forceRefresh !== true) {
    var cachedInv  = readCacheChunks_(invCacheIndex, invCachePrefix);
    var cachedOpts = readCacheChunks_(INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX, INVENTORY_PRODUCT_OPTIONS_CACHE_PREFIX);
    if (cachedInv !== null && cachedOpts !== null) {
      return { inventory: cachedInv, productOptions: cachedOpts };
    }
  }

  // ── 商品マスタ同期: product_id → meta (在庫行用 + 商品オプション用) ──
  var productMap  = {};
  var productOrder = []; // product_id の出現順（商品オプションの並び保証用）
  var productSheet = ss.getSheetByName('商品マスタ同期');
  if (productSheet && productSheet.getLastRow() > 1) {
    var pData        = productSheet.getDataRange().getValues();
    var pH           = pData[0].map(String);
    var pidIdx       = pH.indexOf('product_id');
    var jaIdx        = pH.indexOf('Japanese Title');
    var enIdx        = pH.indexOf('English Title');
    var markIdx      = pH.indexOf('Mark');
    var rdIdx        = pH.indexOf('Release Date');
    var ipIdx        = pH.indexOf('作品ID');
    var boxWeightIdx = pH.indexOf('Box重量');
    var cwtIdx       = pH.indexOf('Case重量');
    var prodSchema   = CORE_SCHEMA_V1_TABLES['PRODUCTS'];
    var catIdx       = pH.indexOf(prodSchema.headers['CATEGORY']);
    if (pidIdx !== -1) {
      for (var pi = 1; pi < pData.length; pi++) {
        var pr   = pData[pi];
        var ppid = String(pr[pidIdx] != null ? pr[pidIdx] : '').trim();
        if (!ppid) continue;
        var releaseDate = '';
        if (rdIdx !== -1 && pr[rdIdx] instanceof Date) {
          releaseDate = Utilities.formatDate(pr[rdIdx], 'JST', 'yyyy-MM-dd');
        }
        productMap[ppid] = {
          japaneseTitle: jaIdx   !== -1 ? String(pr[jaIdx]   != null ? pr[jaIdx]   : '') : '',
          englishTitle:  enIdx   !== -1 ? String(pr[enIdx]   != null ? pr[enIdx]   : '') : '',
          mark:          markIdx !== -1 ? String(pr[markIdx]  != null ? pr[markIdx] : '') : '',
          releaseDate:   releaseDate,
          ipId:          ipIdx    !== -1 ? String(pr[ipIdx]   != null ? pr[ipIdx]   : '').trim() : '',
          boxWeight:     boxWeightIdx !== -1 ? (Number(pr[boxWeightIdx]) || 0) : 0,
          caseWeight:    cwtIdx       !== -1 ? (Number(pr[cwtIdx])       || 0) : 0,
          category:      catIdx       !== -1 ? String(pr[catIdx]         != null ? pr[catIdx] : '').trim() : ''
        };
        productOrder.push(ppid);
      }
    }
  }

  // ── 作品マスタ_共用在庫: ip_id → 表示名 ──
  var ipMap   = {};
  var ipSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (ipSheet && ipSheet.getLastRow() > 1) {
    var ipData    = ipSheet.getDataRange().getValues();
    var ipH       = ipData[0].map(String);
    var ipIdIdx   = ipH.indexOf('ip_id');
    var ipNameIdx = ipH.indexOf('title');
    var ipAltIdx  = ipH.indexOf('alias');
    if (ipIdIdx !== -1 && ipNameIdx !== -1) {
      for (var ii = 1; ii < ipData.length; ii++) {
        var ir      = ipData[ii];
        var ipid    = String(ir[ipIdIdx] != null ? ir[ipIdIdx] : '').trim();
        if (!ipid) continue;
        var ipname  = String(ir[ipNameIdx] != null ? ir[ipNameIdx] : '').trim();
        var ipalt   = ipAltIdx !== -1 ? String(ir[ipAltIdx] != null ? ir[ipAltIdx] : '').trim() : '';
        ipMap[ipid] = ipalt || ipname;
      }
    }
  }

  // ── 共用在庫: 在庫行 + 商品オプション用の hasQty マップを同時構築 ──
  var invSheet = ss.getSheetByName('共用在庫');
  var invRows  = [];
  var hasQty   = {};
  if (invSheet && invSheet.getLastRow() > 1) {
    var invData = invSheet.getDataRange().getValues();
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
    var missing = Object.keys(col).filter(function(k) { return col[k] === -1; });
    if (missing.length > 0) throw new Error('共用在庫ヘッダー不足: ' + missing.join(', '));

    var CONDITION_CASE = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'].values.CONDITION.CASE;
    for (var ri = 1; ri < invData.length; ri++) {
      var row       = invData[ri];
      var rowPid    = String(row[col.productId] != null ? row[col.productId] : '').trim();
      var product   = productMap[rowPid] || {};
      var ipId      = product.ipId || '';
      var ipName    = ipId ? (ipMap[ipId] || '') : '';
      var condition = String(row[col.condition] != null ? row[col.condition] : '');
      var unitWeight = (condition === CONDITION_CASE) ? (product.caseWeight || 0) : (product.boxWeight || 0);
      var qty = Number(row[col.quantity]) || 0;
      invRows.push({
        series:          String(row[col.series]          != null ? row[col.series]          : ''),
        quantity:        qty,
        unitPrice:       Number(row[col.unitPrice])       || 0,
        condition:       condition,
        unitWeight:      unitWeight,
        status:          String(row[col.status]           != null ? row[col.status]           : ''),
        noteJa:          String(row[col.noteJa]           != null ? row[col.noteJa]           : ''),
        noteEn:          String(row[col.noteEn]           != null ? row[col.noteEn]           : ''),
        supplier:        String(row[col.supplier]         != null ? row[col.supplier]         : ''),
        productId:       rowPid,
        rawName:         String(row[col.rawName]          != null ? row[col.rawName]          : ''),
        exclusionReason: String(row[col.exclusionReason]  != null ? row[col.exclusionReason]  : ''),
        ipId:            ipId,
        ipName:          ipName,
        releaseDate:     product.releaseDate   || '',
        japaneseTitle:   product.japaneseTitle || '',
        englishTitle:    product.englishTitle  || '',
        mark:            product.mark          || ''
      });
      if (qty > 0 && rowPid && productMap[rowPid]) hasQty[rowPid] = true;
    }
  }

  // 在庫行に display_mode を適用
  var inventoryResult = applyInventoryDisplayMode_(invRows, displayMode);

  // 商品オプション: product_id の出現順を維持（getInventoryProductOptions と同じロジック）
  var productOptions = [];
  for (var oi = 0; oi < productOrder.length; oi++) {
    var opid = productOrder[oi];
    if (!hasQty[opid]) continue;
    var p = productMap[opid];
    productOptions.push({ productId: opid, productName: p.japaneseTitle, category: p.category });
  }

  writeCacheChunks_(invCacheIndex, invCachePrefix, inventoryResult, SHARED_INVENTORY_CACHE_TTL, SHARED_INVENTORY_CACHE_CHUNK_SIZE);
  writeCacheChunks_(INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX, INVENTORY_PRODUCT_OPTIONS_CACHE_PREFIX, productOptions, INVENTORY_PRODUCT_OPTIONS_CACHE_TTL, INVENTORY_PRODUCT_OPTIONS_CACHE_CHUNK);

  return { inventory: inventoryResult, productOptions: productOptions };
}

/**
 * 共用在庫一覧をフロントエンド向けに返す
 * 共用在庫 → product_id → 商品マスタ同期 → 作品ID → 作品マスタ_共用在庫 の2段階結合
 * display_mode に従って集約済みの行を返す。キャッシュは display_mode 別に保持する。
 * @param {string} sessionId
 * @param {boolean} [forceRefresh]
 */
function getSharedInventoryForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss          = getSpreadsheet();
  var displayMode = readInventoryDisplayMode_(ss);
  var cacheIndex  = SHARED_INVENTORY_CACHE_INDEX + '_' + displayMode;
  var cachePrefix = SHARED_INVENTORY_CACHE_PREFIX + displayMode + '_';

  if (forceRefresh !== true) {
    var cached = readCacheChunks_(cacheIndex, cachePrefix);
    if (cached !== null) return cached;
  }

  var rows   = buildSharedInventoryRows_(ss);
  var result = applyInventoryDisplayMode_(rows, displayMode);
  writeCacheChunks_(cacheIndex, cachePrefix, result, SHARED_INVENTORY_CACHE_TTL, SHARED_INVENTORY_CACHE_CHUNK_SIZE);
  return result;
}
