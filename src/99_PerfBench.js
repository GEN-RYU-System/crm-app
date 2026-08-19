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

/**
 * 【キャッシュ書き込みのみ / シート書き込みなし】
 * CacheService の上限が「文字数」か「バイト数」かを実測で確定する
 *
 * 方法:
 *   1. ASCII文字列（1文字=1byte）で境界を特定
 *   2. 日本語全角文字列（'あ'、1文字=3bytes UTF-8）で同じことを行う
 *   3. 両者の「文字数」「バイト数」を比較して判定
 *
 * 判定ロジック:
 *   - ASCII成功最大文字数 ≈ 日本語成功最大文字数  → 文字数判定
 *   - ASCII成功最大バイト数 ≈ 日本語成功最大バイト数 → バイト数判定
 *
 * 使い方: clasp run benchCacheLimitUnit
 */
function benchCacheLimitUnit() {
  var cache = CacheService.getScriptCache();
  var KEY   = 'bench_limit_unit_v1';
  var out   = ['=== benchCacheLimitUnit ===', '実行: ' + new Date().toISOString(), ''];

  // 倍増法でダミー文字列を生成
  function buildStr(ch, n) {
    var s = ch;
    while (s.length < n) s += s;
    return s.substring(0, n);
  }

  function tryPut(str) {
    try {
      cache.put(KEY, str, 60);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  // ── 0. 前提確認: 'あ' のバイト数を実測 ──────────────────────
  var jaBytesPerChar = Utilities.newBlob('あ').getBytes().length;
  out.push('前提確認: "あ" = ' + jaBytesPerChar + ' bytes/char (UTF-8)');
  out.push('');

  // ── 1. ASCII文字列（'a'、1文字=1byte）で境界を特定 ──────────
  // benchCacheService で 100KB(102400chars) OK / 101KB(103424chars) FAIL
  // → 97〜102 KB を 1KB刻みで再確認
  out.push('=== 1. ASCII文字列（\'a\' × N、1文字=1byte）===');

  var asciiSizesKb = [97, 98, 99, 100, 101, 102];
  var asciiLastPass  = -1;
  var asciiFirstFail = -1;

  for (var i = 0; i < asciiSizesKb.length; i++) {
    var nAscii   = asciiSizesKb[i] * 1024;
    var sAscii   = buildStr('a', nAscii);
    var bAscii   = nAscii; // ASCII: chars = bytes
    var rAscii   = tryPut(sAscii);
    var tagAscii = rAscii.ok ? 'OK' : ('FAIL — ' + rAscii.msg);
    out.push('  ' + nAscii + ' chars / ' + bAscii + ' bytes: ' + tagAscii);
    if (rAscii.ok && asciiLastPass < nAscii) asciiLastPass = nAscii;
    if (!rAscii.ok && asciiFirstFail < 0)   asciiFirstFail = nAscii;
  }

  out.push('');
  out.push('ASCII 成功最大: ' + asciiLastPass  + ' chars = ' + asciiLastPass  + ' bytes');
  out.push('ASCII 失敗最小: ' + asciiFirstFail + ' chars = ' + asciiFirstFail + ' bytes');
  out.push('');

  // ── 2. 日本語全角文字列（'あ'、1文字=' + jaBytesPerChar + 'bytes）────
  out.push('=== 2. 日本語全角文字列（\'あ\' × N、1文字=' + jaBytesPerChar + 'bytes UTF-8）===');
  out.push('  仮説A 文字数判定: 日本語の境界も ~' + asciiLastPass + ' chars のはず');
  out.push('  仮説B バイト数判定: 日本語の境界は ~' + Math.floor(asciiLastPass / jaBytesPerChar) + ' chars のはず');
  out.push('');

  // 仮説Bの境界: ~34K chars（102400 / 3 ≈ 34133）付近を細かく
  // 仮説Aの境界: ~102K chars（ASCII境界と同文字数）付近も確認
  var jaTests = [
    30000, 33000, 33500, 34000, 34100, 34133, 34200, 35000,  // 仮説B付近
    95000, 99000, 100000, 101000, 102000, 103000              // 仮説A付近
  ];

  var jaLastPass  = null;
  var jaFirstFail = null;

  for (var j = 0; j < jaTests.length; j++) {
    var nJa  = jaTests[j];
    var sJa  = buildStr('あ', nJa);
    var bJa  = nJa * jaBytesPerChar; // 'あ' は必ず jaBytesPerChar bytes
    var rJa  = tryPut(sJa);
    var tagJa = rJa.ok ? 'OK' : ('FAIL — ' + rJa.msg);
    out.push('  ' + nJa + ' chars / ' + bJa + ' bytes: ' + tagJa);
    if (rJa.ok) jaLastPass = { chars: nJa, bytes: bJa };
    if (!rJa.ok && !jaFirstFail) jaFirstFail = { chars: nJa, bytes: bJa };
  }

  out.push('');
  if (jaLastPass)  out.push('日本語 成功最大: ' + jaLastPass.chars  + ' chars = ' + jaLastPass.bytes  + ' bytes');
  if (jaFirstFail) out.push('日本語 失敗最小: ' + jaFirstFail.chars + ' chars = ' + jaFirstFail.bytes + ' bytes');
  out.push('');

  // ── 3. 判定 ─────────────────────────────────────────────────
  out.push('=== 3. 判定 ===');

  if (asciiLastPass < 0 || asciiFirstFail < 0 || !jaLastPass || !jaFirstFail) {
    out.push('【未確定】境界の特定に必要なデータが得られなかった');
    if (asciiLastPass < 0 || asciiFirstFail < 0) out.push('  ASCII: 境界未特定');
    if (!jaLastPass || !jaFirstFail)              out.push('  日本語: 境界未特定');
  } else {
    out.push('比較:');
    out.push('  ASCII   成功最大: ' + asciiLastPass       + ' chars / ' + asciiLastPass       + ' bytes');
    out.push('  日本語  成功最大: ' + jaLastPass.chars     + ' chars / ' + jaLastPass.bytes     + ' bytes');
    out.push('');

    var charDiff = Math.abs(asciiLastPass - jaLastPass.chars);
    var byteDiff = Math.abs(asciiLastPass - jaLastPass.bytes); // ASCIIのbytes=chars

    // 誤差5%以内を「一致」と判定
    var threshold = asciiLastPass * 0.05;

    out.push('  文字数差: ' + charDiff + ' chars（閾値 ' + Math.round(threshold) + '）');
    out.push('  バイト数差: ' + byteDiff + ' bytes（閾値 ' + Math.round(threshold) + '）');
    out.push('');

    var charMatch = charDiff <= threshold;
    var byteMatch = byteDiff <= threshold;

    if (charMatch && !byteMatch) {
      out.push('【結論】文字数（char）で上限が決まっている');
      out.push('  上限: 約 ' + asciiLastPass + ' chars');
      out.push('  日本語では ' + jaLastPass.bytes + ' bytes（' + (jaLastPass.bytes / 1024).toFixed(1) + ' KB）まで許容された');
    } else if (byteMatch && !charMatch) {
      out.push('【結論】バイト数（byte）で上限が決まっている');
      out.push('  上限: 約 ' + asciiLastPass + ' bytes');
      out.push('  日本語では ' + jaLastPass.chars + ' chars に制限された');
    } else if (charMatch && byteMatch) {
      out.push('【未確定】文字数・バイト数いずれも誤差内で一致（ASCII/日本語の差が小さすぎて判別不能）');
    } else {
      out.push('【未確定】文字数・バイト数いずれも一致しない');
      out.push('  文字数差: ' + charDiff + '（閾値超過）');
      out.push('  バイト数差: ' + byteDiff + '（閾値超過）');
    }
  }

  try { cache.remove(KEY); } catch (ignore) {}

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【キャッシュ書き込みのみ / シート書き込みなし】
 * putAll / getAll を使った複数キー取得の速度を実測する
 *
 * 在庫結合JSONを 90,000 chars ごとに分割して putAll で保存し、
 * getAll × 3 回の所要ミリ秒と、単一キー get() 43ms との差を報告する。
 *
 * 使い方: clasp run benchCacheMultiKey
 */
function benchCacheMultiKey() {
  var ss  = getSpreadsheet();
  var out = ['=== benchCacheMultiKey ===', '実行: ' + new Date().toISOString(), ''];

  var SINGLE_KEY_GET_MS = 43; // benchCacheService の実測値（参照値）
  var CHUNK_SIZE        = 90000; // chars/キー

  // ── 在庫結合データの生成（benchCacheService と同一処理）────────
  out.push('=== 在庫結合データの生成 ===');
  var genStart = Date.now();

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
        var ipName = String(ir[ipNameIdx] || '').trim();
        var ipAlt  = ipAltIdx !== -1 ? String(ir[ipAltIdx] || '').trim() : '';
        ipMap[id] = ipAlt || ipName;
      }
    }
  }

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

  var jsonStr = JSON.stringify(invRows);
  var genMs   = Date.now() - genStart;
  out.push('結合行数: ' + invRows.length + '件');
  out.push('JSON 文字数: ' + jsonStr.length + ' chars');
  out.push('生成所要時間: ' + genMs + 'ms');
  out.push('');

  // ── 1. 分割 ─────────────────────────────────────────────────
  out.push('=== 1. 分割 ===');
  var chunks = [];
  for (var ci = 0; ci < jsonStr.length; ci += CHUNK_SIZE) {
    chunks.push(jsonStr.substring(ci, ci + CHUNK_SIZE));
  }
  var KEY_PREFIX = 'bench_multi_inv_v1_';
  var keys   = [];
  var putMap = {};
  for (var ki = 0; ki < chunks.length; ki++) {
    var key = KEY_PREFIX + ki;
    keys.push(key);
    putMap[key] = chunks[ki];
  }
  out.push('チャンクサイズ: ' + CHUNK_SIZE + ' chars/キー');
  out.push('分割数: ' + chunks.length + ' キー');
  for (var di = 0; di < chunks.length; di++) {
    out.push('  キー[' + di + ']: ' + chunks[di].length + ' chars');
  }
  out.push('');

  // ── 2. putAll ────────────────────────────────────────────────
  out.push('=== 2. putAll ===');
  var cache = CacheService.getScriptCache();
  var putMs = -1;
  var putOk = false;
  var tPut  = Date.now();
  try {
    cache.putAll(putMap, 300);
    putMs = Date.now() - tPut;
    putOk = true;
    out.push('結果: 成功');
    out.push('所要時間: ' + putMs + 'ms');
  } catch (e) {
    putMs = Date.now() - tPut;
    out.push('結果: 失敗');
    out.push('所要時間: ' + putMs + 'ms');
    out.push('エラー: ' + e.message);
  }
  out.push('');

  // ── 3. getAll × 3 ────────────────────────────────────────────
  out.push('=== 3. getAll × 3 ===');
  if (!putOk) {
    out.push('（putAll が失敗したため getAll はスキップ）');
    out.push('');
  } else {
    var getTimes = [];
    var lastData = null;
    var allHit   = true;
    for (var gi = 0; gi < 3; gi++) {
      var tGet    = Date.now();
      var got     = cache.getAll(keys);
      var getMs   = Date.now() - tGet;
      getTimes.push(getMs);
      var missCount = 0;
      for (var mk = 0; mk < keys.length; mk++) {
        if (got[keys[mk]] === null || got[keys[mk]] === undefined) missCount++;
      }
      if (missCount > 0) allHit = false;
      lastData = got;
      out.push('試行 ' + (gi + 1) + ': ' + getMs + 'ms（ミスキー: ' + missCount + '/' + keys.length + '）');
    }
    var getSum = 0;
    for (var ti = 0; ti < getTimes.length; ti++) getSum += getTimes[ti];
    var getAvg = Math.round(getSum / getTimes.length);
    out.push('平均 getAll(): ' + getAvg + 'ms');
    out.push('全キーヒット: ' + (allHit ? 'OK' : 'NG'));
    out.push('');

    // ── 4. 結合・データ一致確認 ──────────────────────────────
    out.push('=== 4. 結合・データ一致確認 ===');
    var parts = [];
    for (var pi2 = 0; pi2 < keys.length; pi2++) {
      parts.push(lastData[keys[pi2]] || '');
    }
    var reassembled = parts.join('');
    var match = (reassembled === jsonStr);
    out.push('再結合文字数: ' + reassembled.length + ' chars');
    out.push('元データと一致: ' + (match ? 'OK' : 'NG'));
    out.push('');

    // ── 5. 比較 ─────────────────────────────────────────────
    out.push('=== 5. 比較: 単一キー get() vs getAll ===');
    out.push('単一キー get()        : ' + SINGLE_KEY_GET_MS + 'ms（benchCacheService 実測参照値）');
    out.push('getAll(' + keys.length + 'キー)       : ' + getAvg + 'ms');
    var diff  = getAvg - SINGLE_KEY_GET_MS;
    var ratio = (getAvg / SINGLE_KEY_GET_MS).toFixed(2);
    out.push('差分                  : ' + (diff >= 0 ? '+' : '') + diff + 'ms');
    out.push('倍率                  : ' + ratio + 'x');
  }

  // クリーンアップ（キャッシュのみ）
  try { cache.removeAll(keys); } catch (ignore) {}

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【一時計測用 / 認証なし / シート書き込みなし】
 * getSharedInventoryForFrontend のキャッシュ効果を実測する
 *
 * 処理順:
 *   0. INDEX キーを削除してキャッシュをクリア（フォールバック確定）
 *   1回目: readSharedInventoryFromCache_() → null
 *          buildSharedInventoryRows_() + writeSharedInventoryToCache_() を実行
 *   2回目: readSharedInventoryFromCache_() → キャッシュヒット
 *   3回目: readSharedInventoryFromCache_() → キャッシュヒット
 *
 * 使い方: clasp run benchInventoryCache
 */
function benchInventoryCache() {
  var ss  = getSpreadsheet();
  var out = ['=== benchInventoryCache ===', '実行: ' + new Date().toISOString(), ''];

  // ── 0. キャッシュクリア ───────────────────────────────────────
  clearCacheChunks_(SHARED_INVENTORY_CACHE_INDEX, SHARED_INVENTORY_CACHE_PREFIX);
  out.push('キャッシュクリア: ' + SHARED_INVENTORY_CACHE_INDEX + ' を削除');
  out.push('');

  // ── 1回目: キャッシュミス → シート読み出し + キャッシュ書き込み ─
  var t0   = Date.now();
  var hit1 = readCacheChunks_(SHARED_INVENTORY_CACHE_INDEX, SHARED_INVENTORY_CACHE_PREFIX);
  if (hit1 === null) {
    var rows = buildSharedInventoryRows_(ss);
    writeCacheChunks_(SHARED_INVENTORY_CACHE_INDEX, SHARED_INVENTORY_CACHE_PREFIX, rows, SHARED_INVENTORY_CACHE_TTL, SHARED_INVENTORY_CACHE_CHUNK_SIZE);
  }
  var ms1 = Date.now() - t0;
  out.push('1回目 (キャッシュミス → シート読み + キャッシュ書き込み)');
  out.push('  キャッシュミス確認: ' + (hit1 === null ? 'OK（null）' : 'NG（hit1 が null でない）'));
  out.push('  所要時間: ' + ms1 + 'ms');
  out.push('');

  // ── 2回目: キャッシュヒット ─────────────────────────────────
  var t1   = Date.now();
  var hit2 = readCacheChunks_(SHARED_INVENTORY_CACHE_INDEX, SHARED_INVENTORY_CACHE_PREFIX);
  var ms2  = Date.now() - t1;
  out.push('2回目 (キャッシュヒット)');
  out.push('  キャッシュヒット確認: ' + (Array.isArray(hit2) ? 'OK（' + hit2.length + '件）' : 'NG（null）'));
  out.push('  所要時間: ' + ms2 + 'ms');
  out.push('');

  // ── 3回目: キャッシュヒット ─────────────────────────────────
  var t2   = Date.now();
  var hit3 = readCacheChunks_(SHARED_INVENTORY_CACHE_INDEX, SHARED_INVENTORY_CACHE_PREFIX);
  var ms3  = Date.now() - t2;
  out.push('3回目 (キャッシュヒット)');
  out.push('  キャッシュヒット確認: ' + (Array.isArray(hit3) ? 'OK（' + hit3.length + '件）' : 'NG（null）'));
  out.push('  所要時間: ' + ms3 + 'ms');
  out.push('');

  // ── サマリ ──────────────────────────────────────────────────
  out.push('=== サマリ ===');
  out.push('1回目 (シート読み): ' + ms1 + 'ms');
  out.push('2回目 (キャッシュ): ' + ms2 + 'ms');
  out.push('3回目 (キャッシュ): ' + ms3 + 'ms');
  if (ms1 > 0 && ms2 > 0) {
    out.push('高速化率: ' + (ms1 / ms2).toFixed(1) + 'x');
  }

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【調査用 / 認証なし / 書き込みなし】
 * getCoreCustomersForFrontend の読み取り部分を計測し、
 * 顧客キャッシュ実装前の基準値を取得する。
 *
 * 計測内容:
 *   - CUSTOMERS / LEADS / ORDERS の3テーブル読み取り + 結合 × 3回
 *   - 結合後の件数・JSON文字数・チャンク数（90,000 chars/チャンク）
 *
 * 使い方: clasp run benchCustomerListMs
 */
function benchCustomerListMs() {
  var ss   = getSpreadsheet();
  var RUNS = 3;
  var out  = ['=== benchCustomerListMs ===', '実行: ' + new Date().toISOString(), ''];

  var times    = [];
  var lastRows = [];

  for (var run = 0; run < RUNS; run++) {
    var t0 = Date.now();

    var customers = coreCustomerFrontendReadTable(ss, 'CUSTOMERS', [
      'CUSTOMER_ID', 'SOURCE_LEAD_ID', 'CUSTOMER_NAME', 'COUNTRY', 'SALES_ASSIGNEE_NAME'
    ]);
    var leads = coreCustomerFrontendReadTable(ss, 'LEADS', [
      'LEAD_ID', 'SALES_CHANNEL', 'HANDLED_TITLE'
    ]);
    var orders = coreCustomerFrontendReadTable(ss, 'ORDERS', [
      'ORDER_ID', 'CUSTOMER_ID', 'STATUS', 'CURRENCY', 'INVOICE_TOTAL'
    ]);
    var leadsById              = coreCustomerFrontendIndexBy(leads, 'LEAD_ID');
    var transactionsByCustomer = coreCustomerFrontendAggregateTransactions(orders);

    var rows = customers.rows.map(function(row) {
      var customerId   = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
      var sourceLeadId = coreCustomerFrontendValue(row[customers.indexes.SOURCE_LEAD_ID]);
      var sourceLead   = leadsById[sourceLeadId];
      var transactions = transactionsByCustomer[customerId] || { count: 0, amounts: [] };
      return {
        customerId:         customerId,
        customerName:       coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]),
        country:            coreCustomerFrontendValue(row[customers.indexes.COUNTRY]),
        salesChannel:       sourceLead ? coreCustomerFrontendValue(sourceLead[leads.indexes.SALES_CHANNEL])  : '',
        handledTitle:       sourceLead ? coreCustomerFrontendValue(sourceLead[leads.indexes.HANDLED_TITLE])  : '',
        salesAssigneeName:  coreCustomerFrontendValue(row[customers.indexes.SALES_ASSIGNEE_NAME]),
        transactionCount:   transactions.count,
        transactionAmounts: transactions.amounts
      };
    });

    var ms = Date.now() - t0;
    times.push(ms);
    lastRows = rows;
    out.push('試行 ' + (run + 1) + ': ' + ms + 'ms');
  }

  var sum = 0;
  for (var i = 0; i < times.length; i++) sum += times[i];
  var avg = Math.round(sum / times.length);

  var jsonStr    = JSON.stringify(lastRows);
  var charCount  = jsonStr.length;
  var CHUNK_SIZE = 90000;
  var chunkCount = Math.ceil(charCount / CHUNK_SIZE);

  out.push('');
  out.push('平均: ' + avg + 'ms');
  out.push('');
  out.push('=== データサイズ ===');
  out.push('件数: ' + lastRows.length + '件');
  out.push('JSON 文字数: ' + charCount + ' chars');
  out.push('90,000 chars/チャンク での分割: ' + chunkCount + ' チャンク');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【一時計測用 / 認証なし / シート書き込みなし】
 * getCoreCustomersForFrontend のキャッシュ効果を実測する
 *
 * 使い方: clasp run benchCustomerCache
 */
function benchCustomerCache() {
  var ss  = getSpreadsheet();
  var out = ['=== benchCustomerCache ===', '実行: ' + new Date().toISOString(), ''];

  clearCacheChunks_(CUSTOMER_LIST_CACHE_INDEX, CUSTOMER_LIST_CACHE_PREFIX);
  out.push('キャッシュクリア: ' + CUSTOMER_LIST_CACHE_INDEX + ' を削除');
  out.push('');

  var t0   = Date.now();
  var hit1 = readCacheChunks_(CUSTOMER_LIST_CACHE_INDEX, CUSTOMER_LIST_CACHE_PREFIX);
  if (hit1 === null) {
    var rows = buildCoreCustomerListRows_(ss);
    writeCacheChunks_(CUSTOMER_LIST_CACHE_INDEX, CUSTOMER_LIST_CACHE_PREFIX, rows, CUSTOMER_LIST_CACHE_TTL, CUSTOMER_LIST_CACHE_CHUNK_SIZE);
  }
  var ms1 = Date.now() - t0;
  out.push('1回目 (キャッシュミス → シート読み + キャッシュ書き込み)');
  out.push('  キャッシュミス確認: ' + (hit1 === null ? 'OK（null）' : 'NG'));
  out.push('  所要時間: ' + ms1 + 'ms');
  out.push('');

  var t1   = Date.now();
  var hit2 = readCacheChunks_(CUSTOMER_LIST_CACHE_INDEX, CUSTOMER_LIST_CACHE_PREFIX);
  var ms2  = Date.now() - t1;
  out.push('2回目 (キャッシュヒット)');
  out.push('  キャッシュヒット確認: ' + (Array.isArray(hit2) ? 'OK（' + hit2.length + '件）' : 'NG（null）'));
  out.push('  所要時間: ' + ms2 + 'ms');
  out.push('');

  var t2   = Date.now();
  var hit3 = readCacheChunks_(CUSTOMER_LIST_CACHE_INDEX, CUSTOMER_LIST_CACHE_PREFIX);
  var ms3  = Date.now() - t2;
  out.push('3回目 (キャッシュヒット)');
  out.push('  キャッシュヒット確認: ' + (Array.isArray(hit3) ? 'OK（' + hit3.length + '件）' : 'NG（null）'));
  out.push('  所要時間: ' + ms3 + 'ms');
  out.push('');

  out.push('=== サマリ ===');
  out.push('1回目 (シート読み): ' + ms1 + 'ms');
  out.push('2回目 (キャッシュ): ' + ms2 + 'ms');
  out.push('3回目 (キャッシュ): ' + ms3 + 'ms');
  if (ms1 > 0 && ms2 > 0) {
    out.push('高速化率: ' + (ms1 / ms2).toFixed(1) + 'x');
  }

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【計測用 / 認証なし / 書き込みなし】
 * getLeadsByType の3タブ分（全件 / インバウンド / アウトバウンド）を計測する。
 *
 * フロントエンドの呼び出しパターン:
 *   - 'all' タブ   → getLeadsByType(sessionId, undefined)  ← leadType が undefined
 *   - 'インバウンド' → getLeadsByType(sessionId, 'インバウンド')
 *   - 'アウトバウンド'→ getLeadsByType(sessionId, 'アウトバウンド')
 *
 * getLeads() は checkPermission() を持つため clasp run から呼べない。
 * ここではシートを直接読み、同等のフィルタ（リード種別 + LEAD_STATUSES）を
 * 手動で適用して実データ件数・サイズ・所要時間を計測する。
 *
 * 各タブで:
 *   - 件数 / JSON文字数 / 90,000文字チャンク分割数
 *   - 3回計測 → 各回と平均
 *
 * 使い方: clasp run benchLeadsByType
 */
function benchLeadsByType() {
  var RUNS       = 3;
  var CHUNK_SIZE = 90000;
  var out        = ['=== benchLeadsByType ===', '実行: ' + new Date().toISOString(), ''];

  // CONFIG.LEAD_STATUSES はシート由来で動的に解決されるため、
  // getStatusSettings() 経由で取得する（認証不要）
  var leadStatuses = [];
  try {
    var cfg = getStatusSettings();
    if (cfg && Array.isArray(cfg.LEAD_STATUSES)) {
      if (cfg.LEAD_STATUSES.length > 0 && typeof cfg.LEAD_STATUSES[0] === 'object') {
        // オブジェクト配列の場合: { value, order, description }
        leadStatuses = cfg.LEAD_STATUSES.map(function(s) { return s.value || s; });
      } else {
        leadStatuses = cfg.LEAD_STATUSES;
      }
    }
  } catch (e) {
    out.push('LEAD_STATUSES 取得失敗: ' + e.message + ' → フォールバック値を使用');
    leadStatuses = ['新規リード', 'リード対応中', 'リード対象外'];
  }
  out.push('使用 LEAD_STATUSES: ' + JSON.stringify(leadStatuses));
  out.push('');

  var ss         = getSpreadsheet();
  var leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadsSheet || leadsSheet.getLastRow() < 2) {
    out.push('【エラー】リード管理シートにデータがありません');
    var r = out.join('\n'); Logger.log(r); return r;
  }

  // 1回だけシート全読みしてキャッシュ（計測対象外）
  var data     = leadsSheet.getDataRange().getValues();
  var headers  = data[0];
  var typeIdx  = headers.indexOf('リード種別');
  var statIdx  = headers.indexOf('リードステータス');
  var archIdx  = headers.indexOf('アーカイブ日');

  out.push('シート行数: ' + (data.length - 1) + '行 / ヘッダー列数: ' + headers.length);
  out.push('リード種別列: ' + typeIdx + ' / ステータス列: ' + statIdx);
  out.push('');

  var targets = [
    { label: '全件 (leadType=undefined / all タブ)', expectedType: '' },
    { label: 'インバウンド',                          expectedType: 'インバウンド' },
    { label: 'アウトバウンド',                        expectedType: 'アウトバウンド' }
  ];

  for (var t = 0; t < targets.length; t++) {
    var label        = targets[t].label;
    var expectedType = targets[t].expectedType;

    out.push('--- ' + label + ' ---');

    var times    = [];
    var lastRows = null;

    for (var run = 0; run < RUNS; run++) {
      var t0   = Date.now();

      // getLeads('lead', leadType) と同等のフィルタ（認証なし）
      var rows = [];
      for (var i = 1; i < data.length; i++) {
        var row    = data[i];
        var type   = typeIdx  >= 0 && row[typeIdx]  ? row[typeIdx].toString().trim()  : '';
        var status = statIdx  >= 0 && row[statIdx]  ? row[statIdx].toString().trim()  : '';

        if (!type) continue;
        if (expectedType && type !== expectedType) continue;
        if (!leadStatuses.includes(status)) continue;

        var lead = {};
        for (var h = 0; h < headers.length; h++) {
          var v = row[h];
          lead[headers[h]] = (v instanceof Date) ? v.toISOString() : v;
        }
        rows.push(lead);
      }

      var ms = Date.now() - t0;
      times.push(ms);
      lastRows = rows;
      out.push('  試行 ' + (run + 1) + ': ' + ms + 'ms');
    }

    var sum = 0;
    for (var i = 0; i < times.length; i++) sum += times[i];
    var avg = Math.round(sum / RUNS);

    var jsonStr    = lastRows ? JSON.stringify(lastRows) : '[]';
    var charCount  = jsonStr.length;
    var chunkCount = Math.ceil(charCount / CHUNK_SIZE);

    out.push('  平均: ' + avg + 'ms');
    out.push('  件数: ' + (lastRows ? lastRows.length : 0) + '件');
    out.push('  JSON文字数: ' + charCount + ' chars');
    out.push('  チャンク数 (90,000 chars/チャンク): ' + chunkCount);
    out.push('');
  }

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
