/**
 * 【読み取り専用 / 計測用】シート getValues() の所要時間を計測する
 * 認証なし・書き込みなし・checkPermission なし
 * 各シートを RUNS 回 getDataRange().getValues() し、平均ミリ秒を返す
 *
 * 計測グループ:
 *   1. 共用在庫グループ（getSharedInventoryForFrontend の読み取り順）
 *      - 共用在庫 / 商品マスタ同期 / 作品マスタ_共用在庫
 *   2. 顧客グループ
 *      - 顧客マスタ / 配送先マスタ / 支払先マスタ
 *   3. リード管理
 *
 * 使い方: clasp run benchSheetReadMs
 */
function benchSheetReadMs() {
  var ss   = getSpreadsheet();
  var RUNS = 3;

  // 計測対象: [表示ラベル, シート名]
  // シート名は Core Schema V1 テーブルは getCoreSchemaV1TableName() 経由で解決する
  var targets = [
    // ─── 共用在庫グループ ───────────────────────────────
    ['共用在庫',            '共用在庫'],
    ['商品マスタ同期',      '商品マスタ同期'],
    ['作品マスタ_共用在庫', '作品マスタ_共用在庫'],
    // ─── 顧客グループ ────────────────────────────────────
    ['顧客マスタ',          getCoreSchemaV1TableName('CUSTOMERS')],
    ['配送先マスタ',        getCoreSchemaV1TableName('SHIPPING_DESTINATIONS')],
    ['支払先マスタ',        getCoreSchemaV1TableName('PAYMENT_DESTINATIONS')],
    // ─── リード管理 ───────────────────────────────────────
    ['リード管理',          getCoreSchemaV1TableName('LEADS')]
  ];

  var out = [
    '=== benchSheetReadMs ===',
    '実行: ' + new Date().toISOString(),
    '試行回数: ' + RUNS + ' 回/シート',
    ''
  ];

  for (var t = 0; t < targets.length; t++) {
    var label     = targets[t][0];
    var sheetName = targets[t][1];
    var sh        = ss.getSheetByName(sheetName);

    if (!sh) {
      out.push(label + ' [' + sheetName + '] → [NOT FOUND]');
      out.push('');
      continue;
    }

    var rows  = sh.getLastRow();
    var cols  = sh.getLastColumn();
    var times = [];

    for (var i = 0; i < RUNS; i++) {
      var t0 = Date.now();
      sh.getDataRange().getValues();
      times.push(Date.now() - t0);
    }

    var sum = 0;
    for (var j = 0; j < times.length; j++) sum += times[j];
    var avg = Math.round(sum / RUNS);

    out.push(label + ' [' + sheetName + '] ' + rows + '行 x ' + cols + '列');
    out.push('  試行: ' + times.join('ms, ') + 'ms');
    out.push('  平均: ' + avg + 'ms');
    out.push('');
  }

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【キャッシュ書き込みのみ / シート書き込みなし】CacheService の実効性を検証する
 *
 * 1. 在庫3シートを結合して JSON 化し、バイト数を報告
 * 2. CacheService.getScriptCache().put() の成否と所要時間
 * 3. get() を3回実行し所要時間・データ一致を確認
 * 4. ASCII ダミー文字列でサイズ上限を実測（段階的 put 試行）
 *
 * 使い方: clasp run benchCacheService
 */
function benchCacheService() {
  var ss  = getSpreadsheet();
  var out = [
    '=== benchCacheService ===',
    '実行: ' + new Date().toISOString(),
    ''
  ];

  // ── 1. 在庫結合データの生成 ──────────────────────────────────
  out.push('=== 1. 在庫結合データの生成 ===');
  var genStart = Date.now();

  // 商品マスタ同期: product_id → { japaneseTitle, releaseDate, ipId }
  var productMap = {};
  var productSheet = ss.getSheetByName('商品マスタ同期');
  if (productSheet && productSheet.getLastRow() > 1) {
    var pData  = productSheet.getDataRange().getValues();
    var pH     = pData[0].map(String);
    var pidIdx = pH.indexOf('product_id');
    var jaIdx  = pH.indexOf('Japanese Title');
    var rdIdx  = pH.indexOf('Release Date');
    var ipIdx  = pH.indexOf('作品ID');
    if (pidIdx !== -1) {
      for (var pi = 1; pi < pData.length; pi++) {
        var pr  = pData[pi];
        var pid = String(pr[pidIdx] || '').trim();
        if (!pid) continue;
        var releaseDate = '';
        if (rdIdx !== -1 && pr[rdIdx] instanceof Date) {
          releaseDate = Utilities.formatDate(pr[rdIdx], 'JST', 'yyyy-MM-dd');
        }
        productMap[pid] = {
          japaneseTitle: jaIdx !== -1 ? String(pr[jaIdx] || '') : '',
          releaseDate:   releaseDate,
          ipId:          ipIdx !== -1 ? String(pr[ipIdx] || '').trim() : ''
        };
      }
    }
  }

  // 作品マスタ_共用在庫: ip_id → 表示名（別名優先）
  var ipMap = {};
  var ipSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (ipSheet && ipSheet.getLastRow() > 1) {
    var ipData    = ipSheet.getDataRange().getValues();
    var ipH       = ipData[0].map(String);
    var ipIdIdx   = ipH.indexOf('ip_id');
    var ipNameIdx = ipH.indexOf('作品名');
    var ipAltIdx  = ipH.indexOf('別名');
    if (ipIdIdx !== -1 && ipNameIdx !== -1) {
      for (var ii = 1; ii < ipData.length; ii++) {
        var ir  = ipData[ii];
        var id  = String(ir[ipIdIdx] || '').trim();
        if (!id) continue;
        var ipName   = String(ir[ipNameIdx] || '').trim();
        var ipAlt    = ipAltIdx !== -1 ? String(ir[ipAltIdx] || '').trim() : '';
        ipMap[id] = ipAlt || ipName;
      }
    }
  }

  // 共用在庫: ヘッダー名で列を動的解決して結合
  var invRows = [];
  var invSheet = ss.getSheetByName('共用在庫');
  if (invSheet && invSheet.getLastRow() > 1) {
    var invData = invSheet.getDataRange().getValues();
    var ih = invData[0].map(String);
    var col = {
      series:          ih.indexOf('Series'),
      quantity:        ih.indexOf('Quantity'),
      unitPrice:       ih.indexOf('Unit Price'),
      condition:       ih.indexOf('Condition'),
      status:          ih.indexOf('Status'),
      noteJa:          ih.indexOf('Note_JA'),
      noteEn:          ih.indexOf('Note_EN'),
      supplier:        ih.indexOf('提供者'),
      productId:       ih.indexOf('product_id'),
      rawName:         ih.indexOf('raw_name'),
      exclusionReason: ih.indexOf('除外理由')
    };
    for (var ri = 1; ri < invData.length; ri++) {
      var row  = invData[ri];
      var rpid = String(row[col.productId] || '').trim();
      var prd  = productMap[rpid] || {};
      var ipId = prd.ipId || '';
      invRows.push({
        series:          String(row[col.series]          || ''),
        quantity:        Number(row[col.quantity])        || 0,
        unitPrice:       Number(row[col.unitPrice])       || 0,
        condition:       String(row[col.condition]        || ''),
        status:          String(row[col.status]           || ''),
        noteJa:          String(row[col.noteJa]           || ''),
        noteEn:          String(row[col.noteEn]           || ''),
        supplier:        String(row[col.supplier]         || ''),
        productId:       rpid,
        rawName:         String(row[col.rawName]          || ''),
        exclusionReason: String(row[col.exclusionReason]  || ''),
        ipId:            ipId,
        ipName:          ipId ? (ipMap[ipId] || '') : '',
        releaseDate:     prd.releaseDate   || '',
        japaneseTitle:   prd.japaneseTitle || ''
      });
    }
  }

  var jsonStr   = JSON.stringify(invRows);
  var charCount = jsonStr.length;
  var byteCount = Utilities.newBlob(jsonStr).getBytes().length;
  var genMs     = Date.now() - genStart;

  out.push('結合行数: ' + invRows.length + '件');
  out.push('JSON 文字数: ' + charCount + ' chars');
  out.push('JSON バイト数: ' + byteCount + ' bytes (' + (byteCount / 1024).toFixed(1) + ' KB)');
  out.push('生成所要時間: ' + genMs + 'ms');
  out.push('');

  // ── 2. CacheService.put() ────────────────────────────────────
  out.push('=== 2. CacheService.put() ===');
  var cache      = CacheService.getScriptCache();
  var INV_KEY    = 'bench_inv_v1';
  var putSuccess = false;
  var putMs      = -1;
  var tPut       = Date.now();
  try {
    cache.put(INV_KEY, jsonStr, 300);
    putMs      = Date.now() - tPut;
    putSuccess = true;
    out.push('結果: 成功');
    out.push('所要時間: ' + putMs + 'ms');
  } catch (e) {
    putMs = Date.now() - tPut;
    out.push('結果: 失敗');
    out.push('所要時間: ' + putMs + 'ms');
    out.push('エラー: ' + e.message);
  }
  out.push('');

  // ── 3. CacheService.get() × 3 ───────────────────────────────
  out.push('=== 3. CacheService.get() × 3 ===');
  if (putSuccess) {
    var getTimes = [];
    var allMatch = true;
    for (var gi = 0; gi < 3; gi++) {
      var tGet   = Date.now();
      var cached = cache.get(INV_KEY);
      var getMs  = Date.now() - tGet;
      getTimes.push(getMs);
      var match = (cached === jsonStr);
      if (!match) allMatch = false;
      out.push('試行 ' + (gi + 1) + ': ' + getMs + 'ms / データ一致: ' + (match ? 'OK' : 'NG'));
    }
    var getSum = 0;
    for (var ki = 0; ki < getTimes.length; ki++) getSum += getTimes[ki];
    out.push('平均 get(): ' + Math.round(getSum / getTimes.length) + 'ms');
    out.push('全試行データ一致: ' + (allMatch ? 'OK' : 'NG'));
  } else {
    out.push('（put が失敗したため get はスキップ）');
  }
  out.push('');

  // ── 4. サイズ上限の実測 ──────────────────────────────────────
  out.push('=== 4. CacheService サイズ上限の実測 ===');
  out.push('（ASCII 1文字 = 1byte のダミー文字列で段階的に put を試行）');
  out.push('');

  // 倍増法で効率的にダミー文字列を生成
  function buildDummyString(bytes) {
    var s = 'a';
    while (s.length < bytes) s += s;
    return s.substring(0, bytes);
  }

  var SIZE_KEY    = 'bench_size_v1';
  var testSizesKb = [10, 50, 75, 90, 95, 98, 99, 100, 101, 102, 105, 110, 200];
  var lastPassKb  = -1;
  var firstFailKb = -1;

  for (var si = 0; si < testSizesKb.length; si++) {
    var sizeKb    = testSizesKb[si];
    var sizeBytes = sizeKb * 1024;
    var testStr   = buildDummyString(sizeBytes);
    try {
      cache.put(SIZE_KEY, testStr, 60);
      out.push('  ' + sizeKb + 'KB (' + sizeBytes + 'B): OK');
      lastPassKb = sizeKb;
    } catch (e) {
      out.push('  ' + sizeKb + 'KB (' + sizeBytes + 'B): FAIL — ' + e.message);
      if (firstFailKb < 0) firstFailKb = sizeKb;
    }
  }

  out.push('');
  if (lastPassKb > 0 && firstFailKb > 0) {
    out.push('境界: ' + lastPassKb + 'KB (' + (lastPassKb * 1024) + 'B) は成功');
    out.push('      ' + firstFailKb + 'KB (' + (firstFailKb * 1024) + 'B) は失敗');
  } else if (lastPassKb < 0) {
    out.push('境界: テスト範囲の全サイズで失敗');
  } else {
    out.push('境界: テスト範囲内（最大 ' + lastPassKb + 'KB）では全て成功');
  }

  // クリーンアップ（キャッシュのみ。シート書き込みなし）
  try { cache.remove(INV_KEY);  } catch (ignore) {}
  try { cache.remove(SIZE_KEY); } catch (ignore) {}

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
