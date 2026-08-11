// ============================================================
// Phase 7-A-2: "Box"164件の正体調査（読み取り専用）
// ============================================================

/**
 * phase7aBoxInvestigation
 * 状態分類 "Box" となった行を掘り下げる
 * 1. 全件列挙（ユニーク商品名 + 件数）+ オーダーID / 請求書番号
 * 2. Sealed/Damaged/No shrink が含まれないことの確認
 *    同商品名で "Sealed box" 表記が別行に存在するか照合
 * 3. 状態列（col6）の全ユニーク値と件数
 */
function phase7aBoxInvestigation() {
  var ss    = getSpreadsheet();
  var lines = ['=== Phase 7-A-2: "Box" 164件の正体調査 ===', ''];

  var olSh = ss.getSheetByName(CONFIG.SHEETS.ORDER_LINES);
  var omSh = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!olSh || !omSh) {
    lines.push('[ERROR] シートが見つかりません');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  // ── OM: オーダーID → 請求書番号 ──
  var omLast = omSh.getLastRow();
  var omData = omLast >= 2 ? omSh.getRange(2, 1, omLast - 1, 2).getValues() : [];
  var invByOdId = {};
  omData.forEach(function(row) {
    var odId  = String(row[0] || '').trim();
    var invNo = String(row[1] || '').trim();
    if (odId) invByOdId[odId] = invNo;
  });

  // ── OL 全件読み込み ──
  var olLast = olSh.getLastRow();
  var data   = olLast >= 2 ? olSh.getRange(2, 1, olLast - 1, 10).getValues() : [];

  // ── 検出ロジック（phase7aDryRun と同じ） ──
  function normStr(s) {
    return String(s || '').toLowerCase()
      .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e');
  }

  var COND_DEFS = [
    { key: 'Damaged sealed box', tests: ['damaged sealed box'] },
    { key: 'Damaged box',        tests: ['damaged box', '(box damaged)', 'box damaged'] },
    { key: 'No shrink box',      tests: ['no shrink box', 'no-shrink box', '(no shrink)', 'no shrink)'] },
    { key: 'Sealed box',         tests: ['sealed box'] },
    { key: 'Single&Promo',       tests: ['[b grade]', 'promo card', 'promo pack', 'loose pack'] },
    { key: 'Bulk',               tests: ['bulk'] },
    { key: 'Case',               tests: [' case', '/case', '(case)'] },
    { key: 'Deck',               tests: [' deck', '(deck)'] },
    { key: 'Singles',            tests: ['singles', 'single card'] },
    { key: 'Box',                tests: [' box', ' boxes', '(box)'] }
  ];

  function extractCond(name) {
    var n = normStr(name);
    for (var i = 0; i < COND_DEFS.length; i++) {
      for (var j = 0; j < COND_DEFS[i].tests.length; j++) {
        if (n.indexOf(COND_DEFS[i].tests[j]) >= 0) return COND_DEFS[i].key;
      }
    }
    return null;
  }

  // ── Box行を抽出、Sealed box行を別収集 ──
  var boxRows    = [];  // 状態 = "Box" の行
  var sealedNames = {}; // "Sealed box" 行の 正規化商品名 Set

  data.forEach(function(row) {
    var pname = String(row[4] || '').trim();
    var cond  = extractCond(pname);
    if (cond === 'Sealed box') {
      // Sealed box 行の商品名を収集（照合用）
      // 商品名から "sealed box" を除いたベース名で格納
      var base = normStr(pname).replace(/\s*sealed\s*box\s*$/, '').trim();
      sealedNames[base] = true;
    }
    if (cond === 'Box') {
      var odId  = String(row[1] || '').trim();
      var invNo = invByOdId[odId] || '';
      boxRows.push({
        odlId: String(row[0] || '').trim(),
        odId:  odId,
        invNo: invNo,
        name:  pname,
        col6:  String(row[5] || '').trim()
      });
    }
  });

  lines.push('Box 分類件数: ' + boxRows.length + '件');
  lines.push('');

  // ── [1] ユニーク商品名 × 件数 ──
  // {name → {count, col6vals[], odIds[]}}
  var nameMap = {};
  boxRows.forEach(function(r) {
    if (!nameMap[r.name]) nameMap[r.name] = { count: 0, col6vals: {}, odInvs: [] };
    nameMap[r.name].count++;
    nameMap[r.name].col6vals[r.col6 || '（空）'] =
      (nameMap[r.name].col6vals[r.col6 || '（空）'] || 0) + 1;
    nameMap[r.name].odInvs.push(r.odId + (r.invNo ? '[' + r.invNo + ']' : ''));
  });

  var nameEntries = Object.keys(nameMap).map(function(n) {
    return { name: n, info: nameMap[n] };
  }).sort(function(a, b) {
    return b.info.count - a.info.count || a.name.localeCompare(b.name);
  });

  lines.push('────────────────────────────────────');
  lines.push('[1] ユニーク商品名 × 件数（全件）');
  lines.push('────────────────────────────────────');

  nameEntries.forEach(function(e) {
    var n    = e.name;
    var info = e.info;
    var nl   = normStr(n);

    // Sealed/Damaged/No shrink が商品名に含まれるか確認
    var hasSealed   = nl.indexOf('sealed')   >= 0;
    var hasDamaged  = nl.indexOf('damaged')  >= 0;
    var hasNoShrink = nl.indexOf('no shrink') >= 0 || nl.indexOf('no-shrink') >= 0;
    var qualCheck   = (hasSealed || hasDamaged || hasNoShrink)
      ? '[!] Sealed/Damaged/NoShrink含む → 検出漏れの可能性'
      : '修飾語なし';

    // 同商品の "Sealed box" 表記が存在するか
    var baseNorm = nl.replace(/\s*(box|boxes)\s*$/, '').trim();
    var hasSealedSibling = sealedNames[baseNorm] ? '✔ あり（省略表記の可能性）' : '✘ なし（単独）';

    // col6 内訳
    var col6Summary = Object.keys(info.col6vals).map(function(v) {
      return v + '×' + info.col6vals[v];
    }).join(', ');

    lines.push('  [' + info.count + '件] "' + n + '"');
    lines.push('    ' + qualCheck);
    lines.push('    同名Sealed box行: ' + hasSealedSibling);
    lines.push('    col6: ' + col6Summary);
    lines.push('    オーダー: ' + info.odInvs.join(' / '));
  });
  lines.push('');

  // ── [2] Sealed/Damaged/No shrink 含有確認サマリ ──
  var qualIssues = nameEntries.filter(function(e) {
    var nl = normStr(e.name);
    return nl.indexOf('sealed') >= 0 || nl.indexOf('damaged') >= 0
        || nl.indexOf('no shrink') >= 0 || nl.indexOf('no-shrink') >= 0;
  });
  lines.push('────────────────────────────────────');
  lines.push('[2] 修飾語あり → 検出漏れ確認');
  lines.push('────────────────────────────────────');
  if (qualIssues.length === 0) {
    lines.push('  全件: Sealed/Damaged/No shrink を含まない（正常）');
  } else {
    qualIssues.forEach(function(e) {
      lines.push('  [!] "' + e.name + '" (' + e.info.count + '件)');
    });
  }
  lines.push('');

  // ── [3] 状態列（col6）全ユニーク値 × 件数（オーダー明細 全体） ──
  var col6All = {};
  data.forEach(function(row) {
    var v = String(row[5] || '').trim() || '（空）';
    col6All[v] = (col6All[v] || 0) + 1;
  });
  lines.push('────────────────────────────────────');
  lines.push('[3] 状態列（col6）全ユニーク値 × 件数（全595行）');
  lines.push('────────────────────────────────────');
  Object.keys(col6All).sort(function(a, b) {
    return col6All[b] - col6All[a];
  }).forEach(function(v) {
    lines.push('  "' + v + '": ' + col6All[v] + '件');
  });

  lines.push('');
  lines.push('=== 調査完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// Phase 7-A: カテゴリ・状態の抽出 DRY RUN v2
// 対象: オーダー明細シートの「商品名」列（col5）
// 書き込みなし
// ============================================================

/**
 * phase7aDryRun
 * 1. 状態の抽出（商品名から検出・全パターン）
 * 2. カテゴリの抽出（商品名から検出）
 * 3. 商品マスタ原型（カテゴリ + 本体）のユニーク一覧
 * 4. SKU → 商品名 対応件数
 */
function phase7aDryRun() {
  var ss    = getSpreadsheet();
  var lines = ['=== Phase 7-A: カテゴリ・状態 抽出 DRY RUN v2 ===', ''];

  var olSh = ss.getSheetByName(CONFIG.SHEETS.ORDER_LINES);
  if (!olSh) {
    lines.push('[ERROR] オーダー明細シートが見つかりません: ' + CONFIG.SHEETS.ORDER_LINES);
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  var lastRow = olSh.getLastRow();
  if (lastRow < 2) {
    lines.push('[ERROR] データがありません（lastRow=' + lastRow + '）');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  // col1=明細ID, col2=オーダーID, col3=行番号, col4=カテゴリ,
  // col5=商品名, col6=状態, col7=SKU, col8=数量, col9=単価, col10=小計
  var data = olSh.getRange(2, 1, lastRow - 1, 10).getValues();
  lines.push('オーダー明細 データ行数: ' + data.length);
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 共通ヘルパー
  // ────────────────────────────────────────────────────────
  // Pokémon/Pokemon 正規化（é → e）してから比較
  function normStr(s) {
    return String(s || '').toLowerCase()
      .replace(/\u00e9/g, 'e')   // é → e
      .replace(/\u00c9/g, 'e');  // É → e
  }

  // ────────────────────────────────────────────────────────
  // 1. 状態の抽出
  // ────────────────────────────────────────────────────────
  // 優先順位順（長い/具体的なものを先に）
  // key: 表示名, tests: 商品名（正規化済）に含まれるかチェックする文字列配列
  var COND_DEFS = [
    { key: 'Damaged sealed box', tests: ['damaged sealed box'] },
    { key: 'Damaged box',        tests: ['damaged box', '(box damaged)', 'box damaged'] },
    { key: 'No shrink box',      tests: ['no shrink box', 'no-shrink box', '(no shrink)', 'no shrink)'] },
    { key: 'Sealed box',         tests: ['sealed box'] },
    { key: 'Single&Promo',       tests: ['[b grade]', 'promo card', 'promo pack', 'loose pack'] },
    { key: 'Bulk',               tests: ['bulk'] },
    { key: 'Case',               tests: [' case', '/case', '(case)'] },
    { key: 'Deck',               tests: [' deck', '(deck)'] },
    { key: 'Singles',            tests: ['singles', 'single card'] },
    { key: 'Box',                tests: [' box', ' boxes', '(box)'] }
  ];

  function extractCond(name) {
    var n = normStr(name);
    for (var i = 0; i < COND_DEFS.length; i++) {
      var tests = COND_DEFS[i].tests;
      for (var j = 0; j < tests.length; j++) {
        if (n.indexOf(tests[j]) >= 0) {
          return COND_DEFS[i].key;
        }
      }
    }
    return null; // 未検出
  }

  var condCount   = {};  // パターン別件数（商品名から）
  var condNoMatch = [];  // 未検出行

  data.forEach(function(row) {
    var odlId = String(row[0] || '').trim();
    var odId  = String(row[1] || '').trim();
    var pname = String(row[4] || '').trim();
    var col6c = String(row[5] || '').trim();

    var detected = extractCond(pname);
    if (detected) {
      condCount[detected] = (condCount[detected] || 0) + 1;
    } else {
      condNoMatch.push({ odlId: odlId, odId: odId, name: pname, col6: col6c });
    }
  });

  lines.push('────────────────────────────────────');
  lines.push('[1] 状態の抽出（商品名から検出）');
  lines.push('────────────────────────────────────');
  var condDetected = 0;
  // 件数の多い順に出力
  var condKeys = Object.keys(condCount).sort(function(a, b) {
    return condCount[b] - condCount[a];
  });
  condKeys.forEach(function(k) {
    condDetected += condCount[k];
    lines.push('  ' + k + ': ' + condCount[k] + '件');
  });
  lines.push('  ─────');
  lines.push('  商品名から検出 計: ' + condDetected + '件');
  lines.push('  未検出: ' + condNoMatch.length + '件');
  lines.push('');
  lines.push('--- 状態 未検出の商品名（全件）---');
  if (condNoMatch.length === 0) {
    lines.push('  （全件検出済み）');
  } else {
    condNoMatch.forEach(function(r) {
      lines.push('  ' + r.odlId + ' [' + r.odId + '] 商品名="' + r.name + '"'
        + (r.col6 ? ' col6="' + r.col6 + '"' : ''));
    });
  }
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 2. カテゴリの抽出
  // ────────────────────────────────────────────────────────
  // Pokemon/Pokémon → "Pokemon"に統一
  // 先頭一致を優先、次に部分一致
  var CAT_DEFS = [
    { key: 'Pokemon',     tests: ['pokemon'] },   // Pokémon も normStr で pokemon に変換済み
    { key: 'One Piece',   tests: ['one piece'] },
    { key: 'Dragon Ball', tests: ['dragon ball'] }
  ];

  function extractCat(name) {
    var n = normStr(name);
    // 先頭一致
    for (var i = 0; i < CAT_DEFS.length; i++) {
      for (var j = 0; j < CAT_DEFS[i].tests.length; j++) {
        if (n.indexOf(CAT_DEFS[i].tests[j]) === 0) {
          return CAT_DEFS[i].key;
        }
      }
    }
    // 部分一致（先頭外）
    for (var i = 0; i < CAT_DEFS.length; i++) {
      for (var j = 0; j < CAT_DEFS[i].tests.length; j++) {
        if (n.indexOf(CAT_DEFS[i].tests[j]) >= 0) {
          return CAT_DEFS[i].key + '（先頭外）';
        }
      }
    }
    return null;
  }

  var catCount   = {};
  var catNoMatch = [];

  data.forEach(function(row) {
    var odlId = String(row[0] || '').trim();
    var odId  = String(row[1] || '').trim();
    var pname = String(row[4] || '').trim();
    var col4c = String(row[3] || '').trim();

    var detected = extractCat(pname);
    if (detected) {
      catCount[detected] = (catCount[detected] || 0) + 1;
    } else {
      catNoMatch.push({ odlId: odlId, odId: odId, name: pname, col4: col4c });
    }
  });

  // col4 実値の収集
  var existingCatSet = {};
  data.forEach(function(row) {
    var c = String(row[3] || '').trim();
    if (c) existingCatSet[c] = (existingCatSet[c] || 0) + 1;
  });

  lines.push('────────────────────────────────────');
  lines.push('[2] カテゴリの抽出（商品名から検出）');
  lines.push('────────────────────────────────────');
  var catDetected = 0;
  var catKeys = Object.keys(catCount).sort(function(a, b) {
    return catCount[b] - catCount[a];
  });
  catKeys.forEach(function(k) {
    catDetected += catCount[k];
    lines.push('  ' + k + ': ' + catCount[k] + '件');
  });
  lines.push('  ─────');
  lines.push('  商品名から検出 計: ' + catDetected + '件');
  lines.push('  未検出: ' + catNoMatch.length + '件');
  lines.push('');
  lines.push('  col4(カテゴリ列)の実値:');
  Object.keys(existingCatSet).sort().forEach(function(k) {
    lines.push('    "' + k + '": ' + existingCatSet[k] + '件');
  });
  lines.push('');
  lines.push('--- カテゴリ 判定できなかった商品名（全件）---');
  if (catNoMatch.length === 0) {
    lines.push('  （全件検出済み）');
  } else {
    catNoMatch.forEach(function(r) {
      lines.push('  ' + r.odlId + ' [' + r.odId + '] 商品名="' + r.name + '"'
        + (r.col4 ? ' col4="' + r.col4 + '"' : ''));
    });
  }
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 3. 商品マスタ原型（カテゴリ + 本体）ユニーク一覧
  // ────────────────────────────────────────────────────────
  // カテゴリを商品名先頭から除去、状態を末尾から除去 → 本体

  function normCatStr(name) {
    // カテゴリ正規化（先頭一致）: return {cat, rest}
    var n = normStr(name);
    var CAT_PREFIXES = [
      { norm: 'pokemon card ',     key: 'Pokemon', len: 13 },
      { norm: 'pokemon card',      key: 'Pokemon', len: 12 },
      { norm: 'pokemon ',          key: 'Pokemon', len: 8  },
      { norm: 'one piece card ',   key: 'One Piece', len: 15 },
      { norm: 'one piece ',        key: 'One Piece', len: 10 },
      { norm: 'dragon ball ',      key: 'Dragon Ball', len: 12 }
    ];
    for (var i = 0; i < CAT_PREFIXES.length; i++) {
      if (n.indexOf(CAT_PREFIXES[i].norm) === 0) {
        return {
          cat:  CAT_PREFIXES[i].key,
          rest: name.slice(CAT_PREFIXES[i].len).replace(/^[\s\/]+/, '').trim()
        };
      }
    }
    // Pokemon/Pokémon 部分一致（先頭外）
    if (n.indexOf('pokemon') >= 0 || n.indexOf('one piece') >= 0 || n.indexOf('dragon ball') >= 0) {
      var cat = extractCat(name);
      if (cat) {
        return { cat: cat.replace('（先頭外）', ''), rest: name.trim() };
      }
    }
    return { cat: 'その他', rest: name.trim() };
  }

  function stripCondFromBody(body) {
    var n = normStr(body);
    // 末尾側から状態パターンを除去（最長一致優先）
    var STRIP_SUFFIXES = [
      'damaged sealed box', 'no shrink box', 'no-shrink box', 'sealed box',
      'damaged box', '(box damaged)', 'box damaged',
      ' case', ' deck', ' singles', ' bulk', ' box', ' boxes', ' pack'
    ];
    for (var i = 0; i < STRIP_SUFFIXES.length; i++) {
      var s = STRIP_SUFFIXES[i];
      var idx = n.lastIndexOf(s);
      if (idx >= 0) {
        // 実際のbodyから同じ位置の文字列を除去
        var origIdx = body.toLowerCase().replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e').lastIndexOf(s);
        if (origIdx >= 0) {
          body = body.slice(0, origIdx).replace(/[\s\/\-\(\)]+$/, '').trim();
          n    = normStr(body);
        }
        break;
      }
    }
    return body;
  }

  var masterMap = {}; // "カテゴリ|本体" → {cat, body, count, skus[]}

  data.forEach(function(row) {
    var pname = String(row[4] || '').trim();
    var col4c = String(row[3] || '').trim();
    var sku   = String(row[6] || '').trim();

    var cr   = normCatStr(pname);
    var cat  = cr.cat;
    var body = stripCondFromBody(cr.rest);
    if (!body) body = cr.rest; // フォールバック: 本体が空になった場合は除去なし
    var key  = cat + ' | ' + body;

    if (!masterMap[key]) masterMap[key] = { cat: cat, body: body, count: 0, skus: [] };
    masterMap[key].count++;
    if (sku && masterMap[key].skus.indexOf(sku) < 0) {
      masterMap[key].skus.push(sku);
    }
  });

  var masterEntries = Object.keys(masterMap).map(function(k) { return masterMap[k]; });
  masterEntries.sort(function(a, b) {
    if (a.cat < b.cat) return -1;
    if (a.cat > b.cat) return 1;
    if (normStr(a.body) < normStr(b.body)) return -1;
    if (normStr(a.body) > normStr(b.body)) return 1;
    return 0;
  });

  lines.push('────────────────────────────────────');
  lines.push('[3] 商品マスタ原型（カテゴリ + 本体）ユニーク一覧 計: ' + masterEntries.length + '種');
  lines.push('────────────────────────────────────');
  masterEntries.forEach(function(e) {
    lines.push('  [' + e.count + '件] ' + e.cat + ' / ' + e.body
      + '  SKU=[' + (e.skus.length > 0 ? e.skus.join(', ') : 'なし') + ']');
  });
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 4. SKU → 商品名 対応
  // ────────────────────────────────────────────────────────
  var skuToNames = {};  // sku → [商品名]
  var nameToSkus = {};  // 商品名 → [sku]
  var noSkuCount = 0;

  data.forEach(function(row) {
    var pname = String(row[4] || '').trim();
    var sku   = String(row[6] || '').trim();

    if (!sku) { noSkuCount++; return; }

    if (!skuToNames[sku]) skuToNames[sku] = [];
    if (skuToNames[sku].indexOf(pname) < 0) skuToNames[sku].push(pname);

    if (!nameToSkus[pname]) nameToSkus[pname] = [];
    if (nameToSkus[pname].indexOf(sku) < 0) nameToSkus[pname].push(sku);
  });

  var multiSkuNames = Object.keys(nameToSkus).filter(function(n) {
    return nameToSkus[n].length > 1;
  });
  var multiNameSkus = Object.keys(skuToNames).filter(function(s) {
    return skuToNames[s].length > 1;
  });

  lines.push('────────────────────────────────────');
  lines.push('[4] SKU ↔ 商品名 対応');
  lines.push('────────────────────────────────────');
  lines.push('  SKUあり: ' + (data.length - noSkuCount) + '件 / SKUなし: ' + noSkuCount + '件');
  lines.push('  ユニーク商品名: ' + Object.keys(nameToSkus).length + '種');
  lines.push('  ユニークSKU: ' + Object.keys(skuToNames).length + '種');
  lines.push('');
  lines.push('  同一商品名に複数SKUが付いているケース: ' + multiSkuNames.length + '件');
  multiSkuNames.sort().forEach(function(n) {
    lines.push('    商品名="' + n + '" → SKU=[' + nameToSkus[n].join(', ') + ']');
  });
  lines.push('');
  lines.push('  同一SKUが複数商品名に使われているケース: ' + multiNameSkus.length + '件');
  multiNameSkus.sort().forEach(function(s) {
    lines.push('    SKU="' + s + '" → [' + skuToNames[s].join(' / ') + ']');
  });
  lines.push('');

  lines.push('=== DRY RUN v2 完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
