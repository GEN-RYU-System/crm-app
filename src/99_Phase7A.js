// ============================================================
// Phase 7-A: カテゴリ・状態の抽出 DRY RUN
// 対象: オーダー明細シートの「商品名」列（col5）
// 書き込みなし
// ============================================================

/**
 * phase7aDryRun
 * 1. 状態の抽出（末尾パターン検出）
 * 2. カテゴリの抽出（先頭パターン検出）
 * 3. 商品マスタ原型（カテゴリ + 本体）のユニーク一覧
 * 4. SKU → 商品名 対応件数
 */
function phase7aDryRun() {
  var ss     = getSpreadsheet();
  var lines  = ['=== Phase 7-A: カテゴリ・状態 抽出 DRY RUN ===', ''];

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
  // 1. 状態の抽出（末尾パターン）
  // ────────────────────────────────────────────────────────
  // 検出パターン（大文字小文字無視、末尾 or 末尾寄り）
  var COND_PATTERNS = [
    'Damaged sealed box',
    'No shrink box',
    'Sealed box',
    'Singles',
    'Case',
    'Deck'
  ];

  // 各商品名に対して状態を抽出
  // 優先順位: Damaged sealed box > No shrink box > Sealed box > その他順
  function extractCond(name) {
    var n = name.toLowerCase();
    for (var i = 0; i < COND_PATTERNS.length; i++) {
      if (n.indexOf(COND_PATTERNS[i].toLowerCase()) >= 0) {
        return COND_PATTERNS[i];
      }
    }
    return null; // 未検出
  }

  // col6(状態) にある実際の値も全収集（マスタ外パターン発見用）
  var existingCondSet = {};
  data.forEach(function(row) {
    var c = String(row[5] || '').trim();
    if (c) existingCondSet[c] = (existingCondSet[c] || 0) + 1;
  });

  var condCountFromName = {};  // パターン別件数（商品名から）
  var condNoMatch       = [];  // 未検出行（商品名・col6状態・odlId）

  data.forEach(function(row) {
    var odlId  = String(row[0] || '').trim();
    var odId   = String(row[1] || '').trim();
    var pname  = String(row[4] || '').trim();
    var col6c  = String(row[5] || '').trim(); // 既存状態

    var detected = extractCond(pname);

    if (detected) {
      condCountFromName[detected] = (condCountFromName[detected] || 0) + 1;
    } else {
      // 商品名からは未検出 — col6の既存値も記録
      condNoMatch.push({ odlId: odlId, odId: odId, name: pname, col6: col6c });
    }
  });

  lines.push('────────────────────────────────────');
  lines.push('[1] 状態の抽出（商品名から検出）');
  lines.push('────────────────────────────────────');
  var condDetected = 0;
  COND_PATTERNS.forEach(function(p) {
    var cnt = condCountFromName[p] || 0;
    condDetected += cnt;
    lines.push('  ' + p + ': ' + cnt + '件');
  });
  // COND_PATTERNS以外でcol6に値があるものをチェック
  Object.keys(existingCondSet).forEach(function(k) {
    var alreadyListed = COND_PATTERNS.some(function(p) { return p.toLowerCase() === k.toLowerCase(); });
    if (!alreadyListed && k) {
      lines.push('  【col6実値・未リスト】' + k + ': ' + existingCondSet[k] + '件');
    }
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
      lines.push('  ' + r.odlId + ' [' + r.odId + '] 商品名="' + r.name + '" col6="' + r.col6 + '"');
    });
  }
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 2. カテゴリの抽出（先頭パターン）
  // ────────────────────────────────────────────────────────
  var CAT_PATTERNS = [
    'Pokemon',
    'One Piece',
    'Dragon Ball'
  ];

  function extractCat(name) {
    var n = name.toLowerCase();
    // col4の既存値も参照せず、純粋に商品名の先頭から判定
    for (var i = 0; i < CAT_PATTERNS.length; i++) {
      if (n.indexOf(CAT_PATTERNS[i].toLowerCase()) === 0) {
        return CAT_PATTERNS[i];
      }
    }
    // 先頭一致しない場合は含まれるかチェック
    for (var j = 0; j < CAT_PATTERNS.length; j++) {
      if (n.indexOf(CAT_PATTERNS[j].toLowerCase()) >= 0) {
        return CAT_PATTERNS[j] + '（先頭外）';
      }
    }
    return null;
  }

  var catCountFromName = {};
  var catNoMatch       = [];

  data.forEach(function(row) {
    var odlId  = String(row[0] || '').trim();
    var odId   = String(row[1] || '').trim();
    var pname  = String(row[4] || '').trim();
    var col4c  = String(row[3] || '').trim(); // 既存カテゴリ

    var detected = extractCat(pname);

    if (detected) {
      catCountFromName[detected] = (catCountFromName[detected] || 0) + 1;
    } else {
      catNoMatch.push({ odlId: odlId, odId: odId, name: pname, col4: col4c });
    }
  });

  // col4の実際の値も収集
  var existingCatSet = {};
  data.forEach(function(row) {
    var c = String(row[3] || '').trim();
    if (c) existingCatSet[c] = (existingCatSet[c] || 0) + 1;
  });

  lines.push('────────────────────────────────────');
  lines.push('[2] カテゴリの抽出（商品名から検出）');
  lines.push('────────────────────────────────────');
  var catDetected = 0;
  // リスト済みパターンの件数
  var allKeys = Object.keys(catCountFromName).sort();
  allKeys.forEach(function(k) {
    catDetected += catCountFromName[k];
    lines.push('  ' + k + ': ' + catCountFromName[k] + '件');
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
      lines.push('  ' + r.odlId + ' [' + r.odId + '] 商品名="' + r.name + '" col4="' + r.col4 + '"');
    });
  }
  lines.push('');

  // ────────────────────────────────────────────────────────
  // 3. 商品マスタ原型（カテゴリ + 本体）ユニーク一覧
  // ────────────────────────────────────────────────────────
  // 本体 = 商品名から、先頭のカテゴリと末尾の状態を除いた部分
  function stripCatCond(name) {
    var result = name.trim();

    // カテゴリを先頭から除去（大文字小文字無視）
    for (var i = 0; i < CAT_PATTERNS.length; i++) {
      var cp = CAT_PATTERNS[i];
      if (result.toLowerCase().indexOf(cp.toLowerCase()) === 0) {
        result = result.slice(cp.length).replace(/^[\s\/\-]+/, '');
        break;
      }
    }

    // 状態を末尾から除去
    for (var j = 0; j < COND_PATTERNS.length; j++) {
      var cd = COND_PATTERNS[j];
      var idx = result.toLowerCase().lastIndexOf(cd.toLowerCase());
      if (idx >= 0 && idx === result.length - cd.length) {
        result = result.slice(0, idx).replace(/[\s\/\-]+$/, '');
        break;
      }
    }

    return result.trim();
  }

  // カテゴリ正規化（先頭一致のみ、先頭外は col4 を使用）
  function normCat(name, col4) {
    for (var i = 0; i < CAT_PATTERNS.length; i++) {
      if (name.toLowerCase().indexOf(CAT_PATTERNS[i].toLowerCase()) === 0) {
        return CAT_PATTERNS[i];
      }
    }
    return col4 || 'その他';
  }

  var masterMap = {}; // "カテゴリ|本体" → {count, skus[]}

  data.forEach(function(row) {
    var pname  = String(row[4] || '').trim();
    var col4c  = String(row[3] || '').trim();
    var col6c  = String(row[5] || '').trim();
    var sku    = String(row[6] || '').trim();

    var cat    = normCat(pname, col4c);
    var body   = stripCatCond(pname);
    var key    = cat + ' | ' + body;

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
    if (a.body < b.body) return -1;
    if (a.body > b.body) return 1;
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
  // 4. SKU → 商品名 対応（同商品名に複数SKUが付いている実態確認）
  // ────────────────────────────────────────────────────────
  var skuToNames  = {};  // sku → Set of 商品名
  var nameToSkus  = {};  // 商品名 → Set of sku
  var noSkuCount  = 0;

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
    lines.push('    SKU="' + s + '" → 商品名=[' + skuToNames[s].join(' / ') + ']');
  });
  lines.push('');

  lines.push('=== DRY RUN 完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
