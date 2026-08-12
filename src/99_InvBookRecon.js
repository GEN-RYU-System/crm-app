// ============================================================
// 在庫ブック構造調査（読み取り専用）
// ============================================================

var INV_BOOK_ID = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';

// 機密キーワード（列名に含まれたら機密とみなす）
var SENSITIVE_KEYWORDS = [
  '原価', 'cost', 'Cost', '仕入', '仕入元', 'supplier', 'Supplier',
  '在庫', 'stock', 'Stock', '取引先', '利益', 'margin', 'profit',
  '買付', '卸値', '業者', 'vendor', 'Vendor', 'wholesale',
  '数量', 'quantity', 'Quantity', 'qty', 'Qty'
];

/**
 * investigateInventoryBook
 * 在庫ブックのマスタ構造を読み取り専用で調査する
 */
function investigateInventoryBook() {
  var lines = ['=== 在庫ブック構造調査 ===', ''];

  var ss;
  try {
    ss = SpreadsheetApp.openById(INV_BOOK_ID);
    lines.push('ブック名: ' + ss.getName());
    lines.push('ID: ' + INV_BOOK_ID);
  } catch (e) {
    lines.push('[ERROR] ブックを開けません: ' + e.message);
    Logger.log(lines.join('\n')); return lines.join('\n');
  }
  lines.push('');

  var sheets = ss.getSheets();

  // ────────────────────────────────────
  // [1] 全タブ一覧
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[1] 全タブ一覧 (' + sheets.length + 'タブ)');
  lines.push('────────────────────────────────────');
  sheets.forEach(function(sh, idx) {
    lines.push('  [' + (idx + 1) + '] "' + sh.getName() + '"'
      + '  rows=' + sh.getLastRow()
      + '  cols=' + sh.getLastColumn());
  });
  lines.push('');

  // ────────────────────────────────────
  // [2] 商品マスタ候補タブを特定して詳細調査
  // ────────────────────────────────────
  var MASTER_KEYWORDS = ['product', 'Product', '商品', 'M_Product', 'master', 'Master', 'マスタ', 'catalog', 'Catalog'];

  lines.push('────────────────────────────────────');
  lines.push('[2] 商品マスタ候補タブの詳細');
  lines.push('────────────────────────────────────');

  var masterSheets = sheets.filter(function(sh) {
    var n = sh.getName().toLowerCase();
    return MASTER_KEYWORDS.some(function(k) { return sh.getName().indexOf(k) >= 0; });
  });

  if (masterSheets.length === 0) {
    // キーワードなし → 全タブを候補として報告（最初の3タブだけ詳細）
    lines.push('  ※ 商品マスタキーワード一致なし。全タブを確認します。');
    masterSheets = sheets.slice(0, Math.min(5, sheets.length));
  }

  masterSheets.forEach(function(sh) {
    lines.push('');
    lines.push('  ▼ タブ: "' + sh.getName() + '"');
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 1 || lastCol < 1) {
      lines.push('  (データなし)');
      return;
    }

    // ヘッダー
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    lines.push('  ヘッダー (' + lastCol + '列):');
    headers.forEach(function(h, i) {
      lines.push('    col' + (i + 1) + ': "' + h + '"');
    });

    // 先頭5行
    var dataRows = Math.min(5, lastRow - 1);
    lines.push('  先頭' + dataRows + '行:');
    if (dataRows > 0) {
      var data5 = sh.getRange(2, 1, dataRows, lastCol).getValues();
      data5.forEach(function(row, ri) {
        var rowStr = row.map(function(v, ci) {
          var s = (v instanceof Date)
            ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd')
            : String(v === null || v === undefined ? '' : v);
          return 'col' + (ci + 1) + '="' + s.slice(0, 40) + '"';
        }).join(' | ');
        lines.push('    row' + (ri + 2) + ': ' + rowStr);
      });
    }

    // PM-**** の件数・最大値・欠番
    var pmColIdx = -1;
    headers.forEach(function(h, i) {
      var hn = String(h).toLowerCase();
      if (hn === 'product_id' || hn === 'pm' || hn === 'id' || hn.indexOf('product') >= 0 || hn.indexOf('商品id') >= 0) {
        if (pmColIdx < 0) pmColIdx = i;
      }
    });
    // col1 も候補（先頭列がIDの場合が多い）
    if (pmColIdx < 0) pmColIdx = 0;

    if (lastRow >= 2) {
      var idVals = sh.getRange(2, pmColIdx + 1, lastRow - 1, 1).getValues();
      var pmNums = [];
      idVals.forEach(function(r) {
        var m = String(r[0] || '').match(/PM[-_]?(\d+)/i);
        if (m) pmNums.push(parseInt(m[1], 10));
      });
      if (pmNums.length > 0) {
        pmNums.sort(function(a, b) { return a - b; });
        var pmMax = pmNums[pmNums.length - 1];
        var missing = [];
        for (var i = pmNums[0]; i <= pmMax; i++) {
          if (pmNums.indexOf(i) < 0) missing.push(i);
        }
        lines.push('  PM-**** 件数: ' + pmNums.length
          + '  最大値: PM-' + ('0000' + pmMax).slice(-4)
          + '  欠番: ' + (missing.length === 0 ? 'なし' : missing.length + '件 [' + missing.slice(0, 10).join(',') + (missing.length > 10 ? '...' : '') + ']'));
      } else {
        lines.push('  (PM-**** 形式のIDが col' + (pmColIdx + 1) + ' にありません — col1の値: "' + sh.getRange(2, 1).getValue() + '")');
      }
    }

    // 1商品1行か判定（col1の値の重複チェック）
    if (lastRow >= 2) {
      var col1Vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      var col1Set = {}, col1Dupes = 0;
      col1Vals.forEach(function(r) {
        var v = String(r[0] || '').trim();
        if (!v) return;
        if (col1Set[v]) col1Dupes++;
        else col1Set[v] = true;
      });
      var uniqCount = Object.keys(col1Set).length;
      lines.push('  col1ユニーク: ' + uniqCount + '種 / データ行: ' + (lastRow - 1)
        + '  → ' + (col1Dupes === 0 ? '1ID=1行（ID重複なし）' : '重複あり(' + col1Dupes + '件) — 商品×状態で行が分かれている可能性'));
    }
  });
  lines.push('');

  // ────────────────────────────────────
  // [3] Condition の値（全タブ走査）
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[3] Condition の値（全タブ走査）');
  lines.push('────────────────────────────────────');
  _collectColValues(ss, sheets, ['condition', 'Condition', '状態', 'cond', 'Cond'], lines, true);

  // ────────────────────────────────────
  // [4] Category の値（全タブ走査）
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[4] Category の値（全タブ走査）');
  lines.push('────────────────────────────────────');
  _collectColValues(ss, sheets, ['category', 'Category', 'カテゴリ', 'cat', 'Cat'], lines, true);

  // ────────────────────────────────────
  // [5] Series 列（全タブ走査）
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[5] Series 列（全タブ走査）');
  lines.push('────────────────────────────────────');
  _collectColValues(ss, sheets, ['series', 'Series', 'シリーズ', 'expansion', 'Expansion', 'set', 'Set'], lines, true);

  // ────────────────────────────────────
  // [6] 機密列の一覧（全タブ走査）
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[6] 機密候補列（配信APIで返さない項目）');
  lines.push('────────────────────────────────────');
  sheets.forEach(function(sh) {
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) return;
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var sensitives = [];
    headers.forEach(function(h, i) {
      var hs = String(h);
      if (SENSITIVE_KEYWORDS.some(function(k) {
        return hs.toLowerCase().indexOf(k.toLowerCase()) >= 0;
      })) {
        sensitives.push('col' + (i + 1) + ':"' + hs + '"');
      }
    });
    if (sensitives.length > 0) {
      lines.push('  タブ "' + sh.getName() + '": ' + sensitives.join(' / '));
    }
  });
  lines.push('');
  lines.push('=== 調査完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// 在庫ブック詳細調査 v2（読み取り専用）
// ============================================================

/**
 * investigateInvBookRecon2
 * [1] 状態マスタ・単位マスタ 全行全列
 * [2] 名寄せ試算: CRMオーダー明細 × 在庫ブック商品マスタ
 * [3] 仕入元マスタ全行 + CRM仕入れタブ 仕入元 突合
 */
function investigateInvBookRecon2() {
  var INV_BOOK_ID = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';
  var lines = ['=== 在庫ブック詳細調査 v2 ===', ''];

  var invSS, crmSS;
  try {
    invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  } catch (e) {
    lines.push('[ERROR] 在庫ブックを開けません: ' + e.message);
    Logger.log(lines.join('\n')); return lines.join('\n');
  }
  try {
    crmSS = getSpreadsheet();
  } catch (e) {
    lines.push('[ERROR] CRMスプレッドシートを開けません: ' + e.message);
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  // ────────────────────────────────────
  // [1] 状態マスタ・単位マスタ 全行全列
  // ────────────────────────────────────
  lines.push('────────────────────────────────────');
  lines.push('[1] 状態マスタ 全行全列');
  lines.push('────────────────────────────────────');
  _ibDumpAllRows(invSS.getSheetByName('状態マスタ'), lines);

  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[1b] 単位マスタ 全行全列');
  lines.push('────────────────────────────────────');
  _ibDumpAllRows(invSS.getSheetByName('単位マスタ'), lines);

  // ────────────────────────────────────
  // [2] 名寄せ試算
  // ────────────────────────────────────
  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[2] 名寄せ試算（CRMオーダー明細 vs 在庫ブック商品マスタ）');
  lines.push('────────────────────────────────────');

  // 商品マスタ読み込み
  var pmSh = invSS.getSheetByName('商品マスタ');
  var pmLastRow = pmSh.getLastRow();
  var pmRaw = pmSh.getRange(2, 1, pmLastRow - 1, 20).getValues();
  var pmList = pmRaw.map(function(r) {
    return {
      id:        String(r[0]  || '').trim(),
      jpnTitle:  String(r[3]  || '').trim(),  // col4
      engTitle:  String(r[4]  || '').trim(),  // col5
      keywords:  String(r[11] || '').trim(),  // col12
      reqOutput: String(r[15] || '').trim()   // col16
    };
  });

  // オーダー明細読み込み（col5=商品名）
  var olSh = crmSS.getSheetByName('オーダー明細');
  if (!olSh) {
    lines.push('[ERROR] オーダー明細シートが見つかりません');
  } else {
    var olLastRow = olSh.getLastRow();
    var olData = olLastRow > 1 ? olSh.getRange(2, 1, olLastRow - 1, 10).getValues() : [];
    lines.push('CRMオーダー明細 データ行数: ' + olData.length);

    var matchedCount    = 0;
    var matchedPmIds    = {};
    var unmatchedNames  = {};
    var fuzzyExamples   = [];

    olData.forEach(function(row) {
      var crmName = String(row[4] || '').trim(); // col5
      if (!crmName) return;
      var res = _ibMatchPm(crmName, pmList);
      if (res.matched) {
        matchedCount++;
        matchedPmIds[res.pmId] = true;
        if (res.fuzzy && fuzzyExamples.length < 5) {
          fuzzyExamples.push(res);
        }
      } else {
        unmatchedNames[crmName] = (unmatchedNames[crmName] || 0) + 1;
      }
    });

    lines.push('一致件数: ' + matchedCount + ' / ' + olData.length + '行');
    lines.push('一致商品ID種類数: ' + Object.keys(matchedPmIds).length + '種');
    lines.push('');

    var unmatchedKeys = Object.keys(unmatchedNames).sort(function(a, b) {
      return unmatchedNames[b] - unmatchedNames[a];
    });
    lines.push('一致しなかったCRM側の商品名（' + unmatchedKeys.length + '種・件数降順）:');
    unmatchedKeys.forEach(function(k) {
      lines.push('  "' + k + '": ' + unmatchedNames[k] + '件');
    });
    lines.push('');

    lines.push('表記ゆれで拾えた例（最大5件）:');
    if (fuzzyExamples.length === 0) {
      lines.push('  (なし — 全一致は完全一致またはサブストリング一致)');
    } else {
      fuzzyExamples.forEach(function(ex) {
        lines.push('  "' + ex.crmName + '" → ' + ex.pmId
          + ' [' + ex.field + '] "' + ex.matchedVal + '"');
      });
    }
  }

  // ────────────────────────────────────
  // [3] 仕入元マスタ全行 + CRM仕入れタブ 仕入元 突合
  // ────────────────────────────────────
  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[3] 仕入元マスタ 全行全列（SP0001〜）');
  lines.push('────────────────────────────────────');
  var spSh = invSS.getSheetByName('仕入元マスタ');
  _ibDumpAllRows(spSh, lines);

  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[3b] CRM仕入れタブ 仕入元 突合');
  lines.push('────────────────────────────────────');
  var purSh = crmSS.getSheetByName('仕入れ');
  if (!purSh) {
    lines.push('[ERROR] 仕入れシートが見つかりません');
  } else {
    var purLastRow = purSh.getLastRow();
    lines.push('CRM仕入れ データ行数: ' + (purLastRow > 1 ? purLastRow - 1 : 0));

    // 仕入元マスタの LINE名/別名 → SP_ID マップ
    var spLastRow = spSh.getLastRow();
    var spData    = spLastRow > 1 ? spSh.getRange(2, 1, spLastRow - 1, 15).getValues() : [];
    var spLookup  = {}; // normalized → SP_ID
    spData.forEach(function(r) {
      var lineName = String(r[0]  || '').trim();
      var spId     = String(r[9]  || '').trim();
      var alias    = String(r[10] || '').trim();
      if (lineName) spLookup[_ibNorm(lineName)] = spId;
      if (alias) {
        alias.split(/[,、]/).forEach(function(a) {
          var an = _ibNorm(a.trim());
          if (an) spLookup[an] = spId;
        });
      }
    });

    // CRM 仕入れ col6 = 仕入元
    var purSuppliers = {};
    if (purLastRow > 1) {
      var purCol6 = purSh.getRange(2, 6, purLastRow - 1, 1).getValues();
      purCol6.forEach(function(r) {
        var v = String(r[0] || '').trim();
        if (!v) return;
        purSuppliers[v] = (purSuppliers[v] || 0) + 1;
      });
    }

    var matchedSp   = [];
    var unmatchedSp = [];
    Object.keys(purSuppliers).sort().forEach(function(name) {
      var spId = spLookup[_ibNorm(name)];
      if (spId) {
        matchedSp.push({ name: name, count: purSuppliers[name], spId: spId });
      } else {
        unmatchedSp.push({ name: name, count: purSuppliers[name] });
      }
    });

    lines.push('CRM 仕入元 ユニーク: ' + Object.keys(purSuppliers).length + '種');
    lines.push('一致: ' + matchedSp.length + '種 / 不一致: ' + unmatchedSp.length + '種');
    lines.push('');
    lines.push('一致した仕入元:');
    matchedSp.forEach(function(m) {
      lines.push('  "' + m.name + '": ' + m.count + '件 → ' + m.spId);
    });
    lines.push('');
    lines.push('一致しなかったCRM側の仕入元（全件）:');
    if (unmatchedSp.length === 0) {
      lines.push('  (なし)');
    } else {
      unmatchedSp.forEach(function(m) {
        lines.push('  "' + m.name + '": ' + m.count + '件');
      });
    }
  }

  lines.push('');
  lines.push('=== 調査完了 ===');
  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ── 内部ヘルパー: 全行全列ダンプ ──
function _ibDumpAllRows(sh, lines) {
  if (!sh) { lines.push('  (シートが見つかりません)'); return; }
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) { lines.push('  (データなし)'); return; }
  var all = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = all[0];
  lines.push('  ヘッダー: '
    + headers.map(function(h, i) { return 'col' + (i + 1) + '="' + h + '"'; }).join(' | '));
  for (var r = 1; r < lastRow; r++) {
    var rowStr = all[r].map(function(v, i) {
      var s = (v instanceof Date)
        ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd')
        : String(v === null || v === undefined ? '' : v);
      return 'col' + (i + 1) + '="' + s.slice(0, 80) + '"';
    }).join(' | ');
    lines.push('  row' + (r + 1) + ': ' + rowStr);
  }
}

// ── 内部ヘルパー: 文字列正規化（照合用） ──
function _ibNorm(s) {
  return String(s || '').toLowerCase()
    .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e')
    .replace(/[\s\u3000]+/g, ' ').trim();
}

// ── 内部ヘルパー: 商品名照合 ──
// pmList: Array of {id, jpnTitle, engTitle, keywords, reqOutput}
function _ibMatchPm(crmName, pmList) {
  var cn    = _ibNorm(crmName);
  var cnRaw = crmName.toLowerCase().trim();

  for (var i = 0; i < pmList.length; i++) {
    var pm = pmList[i];

    // English Title
    var et = _ibNorm(pm.engTitle);
    if (et.length >= 5 && (cn === et || cn.indexOf(et) >= 0)) {
      var etRaw = pm.engTitle.toLowerCase().trim();
      var fuzzy = !(cnRaw === etRaw || cnRaw.indexOf(etRaw) >= 0);
      return { matched: true, pmId: pm.id, field: 'EnglishTitle',
               matchedVal: pm.engTitle, crmName: crmName, fuzzy: fuzzy };
    }

    // Japanese Title
    var jt = _ibNorm(pm.jpnTitle);
    if (jt.length >= 4 && (cn === jt || cn.indexOf(jt) >= 0)) {
      return { matched: true, pmId: pm.id, field: 'JapaneseTitle',
               matchedVal: pm.jpnTitle, crmName: crmName, fuzzy: false };
    }

    // REQUIRED_OUTPUT_VALUE（EnglishTitle・JapaneseTitleと重複しない場合のみ）
    var ro = _ibNorm(pm.reqOutput);
    if (ro.length >= 5 && ro !== et && ro !== jt && (cn === ro || cn.indexOf(ro) >= 0)) {
      return { matched: true, pmId: pm.id, field: 'RequiredOutputValue',
               matchedVal: pm.reqOutput, crmName: crmName, fuzzy: false };
    }

    // Search Keywords（カンマ区切り・各キーワード5文字以上）
    var kws = pm.keywords.split(',');
    for (var k = 0; k < kws.length; k++) {
      var kw = _ibNorm(kws[k]);
      if (kw.length >= 5 && (cn === kw || cn.indexOf(kw) >= 0)) {
        return { matched: true, pmId: pm.id, field: 'SearchKeyword',
                 matchedVal: kws[k].trim(), crmName: crmName, fuzzy: false };
      }
    }
  }
  return { matched: false };
}

// ────────────────────────────────────
// 内部ヘルパー: 指定列名のユニーク値を全タブから収集
// ────────────────────────────────────
function _collectColValues(ss, sheets, colNameVariants, lines, showCount) {
  var found = false;
  sheets.forEach(function(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    headers.forEach(function(h, ci) {
      var hs = String(h);
      var match = colNameVariants.some(function(v) {
        return hs.toLowerCase() === v.toLowerCase();
      });
      if (!match) return;

      found = true;
      var vals = sh.getRange(2, ci + 1, lastRow - 1, 1).getValues();
      var freq = {};
      vals.forEach(function(r) {
        var v = String(r[0] === null || r[0] === undefined ? '' : r[0]).trim() || '（空）';
        freq[v] = (freq[v] || 0) + 1;
      });
      var keys = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
      lines.push('  タブ "' + sh.getName() + '" col' + (ci + 1) + ':"' + hs + '" (' + keys.length + '種):');
      keys.forEach(function(k) {
        lines.push('    "' + k + '": ' + freq[k] + '件');
      });
    });
  });
  if (!found) lines.push('  (該当列なし)');
  lines.push('');
}

// ============================================================
// 在庫ブック詳細調査 v3（名寄せ強化・読み取り専用）
// ============================================================

/**
 * investigateInvBookRecon3
 * [1] 名寄せ試算 v3: 正規化強化 + 状態語除去 + 編集距離2以内候補
 * [2] 商品マスタ追加候補（[B grade]・非商品行・fuzzy候補を除外）
 * [3] 仕入元再突合（敬称除去）
 */
function investigateInvBookRecon3() {
  var INV_BOOK_ID = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';
  var lines = ['=== 在庫ブック詳細調査 v3（名寄せ強化） ===', ''];

  var invSS, crmSS;
  try {
    invSS = SpreadsheetApp.openById(INV_BOOK_ID);
    crmSS = getSpreadsheet();
  } catch (e) {
    lines.push('[ERROR] ' + e.message);
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  // ── 商品マスタ 読み込み + 事前正規化 ──
  var pmSh = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  var pmList = pmRaw.map(function(r) {
    return {
      id: String(r[0] || '').trim(),
      engTitle:  String(r[4]  || '').trim(),  // col5
      jpnTitle:  String(r[3]  || '').trim(),  // col4
      keywords:  String(r[11] || '').trim(),  // col12
      reqOutput: String(r[15] || '').trim(),  // col16
      relSeries: String(r[13] || '').trim()   // col14
    };
  });

  var pmEntries = pmList.map(function(pm) {
    var kws = pm.keywords.split(',');
    // 直接照合ノーム（4フィールド）
    var directNorms = [
      { v: _v3n(pm.engTitle),  label: 'EnglishTitle'   },
      { v: _v3n(pm.jpnTitle),  label: 'JapaneseTitle'  },
      { v: _v3n(pm.reqOutput), label: 'RequiredOutput' },
      { v: _v3n(pm.relSeries), label: 'RelatedSeries'  }
    ].filter(function(x) { return x.v.length >= 4; });
    // キーワードノーム
    var kwNorms = kws.map(function(k) {
      return { v: _v3n(k.trim()), raw: k.trim() };
    }).filter(function(x) { return x.v.length >= 5; });
    // ベース名（状態語除去後）
    var rawFields = [pm.engTitle, pm.jpnTitle, pm.reqOutput, pm.relSeries]
      .concat(kws);
    var seenB = {};
    var bases = rawFields.map(_v3b).filter(function(b) {
      if (!b || b.length < 3 || seenB[b]) return false;
      seenB[b] = true; return true;
    });
    return { id: pm.id, directNorms: directNorms, kwNorms: kwNorms, bases: bases };
  });

  // ── オーダー明細 照合 ──
  var olSh = crmSS.getSheetByName('オーダー明細');
  var olLastRow = olSh.getLastRow();
  var olData = olLastRow > 1
    ? olSh.getRange(2, 1, olLastRow - 1, 10).getValues() : [];
  lines.push('CRMオーダー明細 データ行数: ' + olData.length);

  var confirmed = 0, confirmedIds = {}, fuzzyMap = {}, unmatchedMap = {};

  olData.forEach(function(row) {
    var crmName = String(row[4] || '').trim();
    if (!crmName) return;
    var res = _v3match(crmName, pmEntries);
    if (res.matched && !res.fuzzy) {
      confirmed++;
      confirmedIds[res.pmId] = true;
    } else {
      unmatchedMap[crmName] = (unmatchedMap[crmName] || 0) + 1;
      if (res.matched && res.fuzzy) {
        var fk = crmName + '\x00' + res.pmId;
        if (!fuzzyMap[fk]) fuzzyMap[fk] = res;
      }
    }
  });

  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[1] 名寄せ試算 v3 結果');
  lines.push('────────────────────────────────────');
  lines.push('確定一致件数: ' + confirmed + ' / ' + olData.length + '行');
  lines.push('確定一致商品ID種類数: ' + Object.keys(confirmedIds).length + '種');
  lines.push('');

  var fkeys = Object.keys(fuzzyMap);
  lines.push('編集距離2以内の候補（確定なし・参考のみ）: ' + fkeys.length + '件');
  fkeys.sort().forEach(function(fk) {
    var f = fuzzyMap[fk];
    lines.push('  "' + f.crmName + '"');
    lines.push('    → ' + f.pmId + ' [' + f.field + '] base:"' + f.matchedVal + '" dist=' + f.dist);
  });
  lines.push('');

  var unmatchedKeys = Object.keys(unmatchedMap).sort(function(a, b) {
    return unmatchedMap[b] - unmatchedMap[a];
  });
  lines.push('未一致の商品名（' + unmatchedKeys.length + '種）:');
  unmatchedKeys.forEach(function(k) {
    var base = _v3b(k);
    lines.push('  "' + k + '": ' + unmatchedMap[k] + '件'
      + (base && base.length >= 3 ? ' [base:"' + base + '"]' : ''));
  });

  // ────────────────────────────────────
  // [2] 商品マスタ追加候補
  // ────────────────────────────────────
  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[2] 商品マスタに追加が必要なもの');
  lines.push('　　（[B grade]・非商品行・fuzzy候補を除外）');
  lines.push('────────────────────────────────────');

  var EXCL = [
    /\[b\s*grade\]/i,
    /^shipping\b/i, /^discount\b/i, /^special\s+discount\b/i,
    /^customs\s+duties\b/i, /^mpf\b/i, /^ddp\b/i,
    /retro\s+card\s+bulk/i
  ];
  var fuzzyNames = {};
  fkeys.forEach(function(fk) { fuzzyNames[fuzzyMap[fk].crmName] = true; });

  var needsAdd = unmatchedKeys.filter(function(k) {
    if (fuzzyNames[k]) return false;
    return !EXCL.some(function(re) { return re.test(k); });
  });

  lines.push('追加候補: ' + needsAdd.length + '種');
  needsAdd.forEach(function(k) {
    var base = _v3b(k);
    lines.push('  "' + k + '": ' + unmatchedMap[k] + '件'
      + (base && base.length >= 3 ? ' [base:"' + base + '"]' : ''));
  });

  // ────────────────────────────────────
  // [3] 仕入元 再突合
  // ────────────────────────────────────
  lines.push('');
  lines.push('────────────────────────────────────');
  lines.push('[3] 仕入元 再突合（敬称除去・正規化）');
  lines.push('────────────────────────────────────');

  var spSh = invSS.getSheetByName('仕入元マスタ');
  var spData = spSh.getLastRow() > 1
    ? spSh.getRange(2, 1, spSh.getLastRow() - 1, 15).getValues() : [];
  var spLookup = {};
  spData.forEach(function(r) {
    var name  = String(r[0]  || '').trim();
    var spId  = String(r[9]  || '').trim();
    var alias = String(r[10] || '').trim();
    if (name) spLookup[_v3ns(name)] = spId;
    if (alias) alias.split(/[,、]/).forEach(function(a) {
      var an = _v3ns(a.trim()); if (an) spLookup[an] = spId;
    });
  });

  var purSh = crmSS.getSheetByName('仕入れ');
  var purLastRow = purSh.getLastRow();
  var purData = purLastRow > 1
    ? purSh.getRange(2, 6, purLastRow - 1, 1).getValues() : [];
  var purMap = {};
  purData.forEach(function(r) {
    var v = String(r[0] || '').trim(); if (v) purMap[v] = (purMap[v] || 0) + 1;
  });

  var matchedSp = [], unmatchedSp = [];
  Object.keys(purMap).sort().forEach(function(name) {
    var norm = _v3ns(name);
    var spId = spLookup[norm];
    if (spId) matchedSp.push({ name: name, norm: norm, count: purMap[name], spId: spId });
    else       unmatchedSp.push({ name: name, norm: norm, count: purMap[name] });
  });

  lines.push('CRM 仕入元 ユニーク: ' + Object.keys(purMap).length + '種');
  lines.push('一致: ' + matchedSp.length + '種 / 不一致: ' + unmatchedSp.length + '種');
  lines.push('');
  lines.push('一致した仕入元:');
  matchedSp.sort(function(a, b) { return b.count - a.count; }).forEach(function(m) {
    lines.push('  "' + m.name + '" → norm:"' + m.norm + '" → ' + m.spId + ' (' + m.count + '件)');
  });
  lines.push('');
  lines.push('なお一致しない仕入元（全件・件数降順）:');
  unmatchedSp.sort(function(a, b) { return b.count - a.count; }).forEach(function(m) {
    lines.push('  "' + m.name + '" → norm:"' + m.norm + '" (' + m.count + '件)');
  });

  lines.push('');
  lines.push('=== 調査完了 ===');
  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ─────────────────────────────────────────
// v3 専用ヘルパー
// ─────────────────────────────────────────

// 全角ASCII → 半角
function _v3fw(s) {
  return String(s || '')
    .replace(/[\uff01-\uff5e]/g, function(c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, ' ');
}

// 基本正規化: アクセント+全角→半角+小文字+空白
function _v3n(s) {
  return _v3fw(String(s || ''))
    .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// 状態語リスト（特定順・長い方を先に）
var _V3C = [
  'damaged sealed box', 'no shrink box', 'no-shrink box', 'no shrink',
  'damaged case', 'damaged box', 'sealed box', 'opened box', 'unsealed box',
  'unsealed', 'unsearched pack',
  'promo card', 'promo pack', 'promo',
  'case in \\d+ boxes',
  'bulk', 'singles', 'single card',
  'sealed', 'case', 'box', 'boxes', 'pack', 'deck'
];

// ベース名: 正規化 + 括弧除去 + "pokemon card" 除去 + 状態語除去
function _v3b(s) {
  var n = _v3n(s);
  n = n.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  n = n.replace(/(pokemon\s+card\s+)+/g, ' ');
  _V3C.forEach(function(w) {
    try { n = n.replace(new RegExp('(?:^|\\s)' + w + '(?=\\s|$)', 'gi'), ' '); }
    catch(e) {}
  });
  return n.replace(/\s+/g, ' ').trim();
}

// Levenshtein 距離（長さ差 > 4 は 99 で即return）
function _v3lev(a, b) {
  var la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 4) return 99;
  if (!la) return lb; if (!lb) return la;
  var p = [], c = [], t;
  for (var j = 0; j <= lb; j++) p[j] = j;
  for (var i = 1; i <= la; i++) {
    c[0] = i;
    for (var j = 1; j <= lb; j++) {
      c[j] = a[i-1] === b[j-1] ? p[j-1] : 1 + Math.min(p[j], c[j-1], p[j-1]);
    }
    t = p; p = c; c = t;
  }
  return p[lb];
}

// 商品名照合（v3強化版）
function _v3match(crmName, pmEntries) {
  var cn  = _v3n(crmName);
  // 括弧除去後のノーム（[SV2a] 等を除去して照合）
  var cnNb = cn.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
               .replace(/\s+/g, ' ').trim();
  var cb  = _v3b(crmName);

  for (var i = 0; i < pmEntries.length; i++) {
    var pe = pmEntries[i];

    // 直接フィールド照合（cn と括弧除去版 cnNb の両方で試行）
    for (var f = 0; f < pe.directNorms.length; f++) {
      var fv = pe.directNorms[f].v;
      if (cn.indexOf(fv) >= 0 || cnNb.indexOf(fv) >= 0) {
        return { matched: true, pmId: pe.id, field: pe.directNorms[f].label,
                 matchedVal: fv, crmName: crmName, fuzzy: false };
      }
    }
    // キーワード照合
    for (var k = 0; k < pe.kwNorms.length; k++) {
      var kv = pe.kwNorms[k].v;
      if (cn.indexOf(kv) >= 0 || cnNb.indexOf(kv) >= 0) {
        return { matched: true, pmId: pe.id, field: 'SearchKeyword',
                 matchedVal: pe.kwNorms[k].raw, crmName: crmName, fuzzy: false };
      }
    }
    // ベース名照合（双方向サブストリング）
    if (cb.length >= 4) {
      for (var b = 0; b < pe.bases.length; b++) {
        var pb = pe.bases[b];
        if (pb.length >= 3 && (cb === pb || cb.indexOf(pb) >= 0 || pb.indexOf(cb) >= 0)) {
          return { matched: true, pmId: pe.id, field: 'BaseName',
                   matchedVal: pb, crmName: crmName, fuzzy: false };
        }
      }
    }
  }

  // 編集距離 fuzzy（cb が5文字以上の場合のみ）
  if (cb.length >= 5) {
    var bestD = 3, bestId = null, bestBase = null;
    for (var ii = 0; ii < pmEntries.length; ii++) {
      for (var bb = 0; bb < pmEntries[ii].bases.length; bb++) {
        var pb2 = pmEntries[ii].bases[bb];
        if (pb2.length < 4 || Math.abs(cb.length - pb2.length) > 4) continue;
        var d = _v3lev(cb, pb2);
        if (d > 0 && d < bestD) { bestD = d; bestId = pmEntries[ii].id; bestBase = pb2; }
      }
    }
    if (bestId) {
      return { matched: true, pmId: bestId, field: 'FuzzyBase',
               matchedVal: bestBase, crmName: crmName, fuzzy: true, dist: bestD };
    }
  }
  return { matched: false };
}

// 仕入元正規化: 末尾の様/さん除去 + 空白除去 + lowercase
function _v3ns(s) {
  return String(s || '').trim()
    .replace(/\s*(様|さん)\s*$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

// ============================================================
// investigateInvBookRecon4: 商品マスタ228件全リスト + 特定商品検索 + ギャップ分析
// ============================================================
function investigateInvBookRecon4() {
  var out = [];
  function L(s) { out.push(s); Logger.log(s); }

  var IB_ID = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';
  var ss = SpreadsheetApp.openById(IB_ID);
  var pmSheet = ss.getSheetByName('商品マスタ');
  var data = pmSheet.getDataRange().getValues();

  // Column indices (0-based)
  var COL_ID  = 0;  // product_id
  var COL_CAT = 1;  // Category
  var COL_JA  = 3;  // Japanese Title
  var COL_EN  = 4;  // English Title
  var COL_KW  = 11; // Search Keywords
  var COL_ROV = 15; // REQUIRED_OUTPUT_VALUE
  var COL_SER = 13; // Related Series

  // ── [1] 全行読み込み ─────────────────────────────────────────
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[COL_ID]) continue;
    rows.push({
      id:  String(r[COL_ID]  || '').trim(),
      cat: String(r[COL_CAT] || '').trim(),
      ja:  String(r[COL_JA]  || '').trim(),
      en:  String(r[COL_EN]  || '').trim(),
      kw:  String(r[COL_KW]  || '').trim(),
      rov: String(r[COL_ROV] || '').trim(),
      ser: String(r[COL_SER] || '').trim()
    });
  }

  L('=== [1] 商品マスタ全行 (計' + rows.length + '件) ===');
  L('product_id\tCategory\tJapanese Title\tEnglish Title\tSearch Keywords\tREQUIRED_OUTPUT_VALUE\tRelated Series');
  rows.forEach(function(r) {
    L(r.id + '\t' + r.cat + '\t' + r.ja + '\t' + r.en + '\t' + r.kw + '\t' + r.rov + '\t' + r.ser);
  });

  // ── [2] 特定商品検索 ─────────────────────────────────────────
  var TARGETS = [
    { label: 'Mega Symphonia / メガシンフォニア',    tokens: ['mega symphonia', 'megasymphonia', 'メガシンフォニア'] },
    { label: 'Retro card / レトロ',                  tokens: ['retro', 'レトロ'] },
    { label: 'Mega Premium Trainer Box',              tokens: ['mega premium trainer', 'mega premium'] },
    { label: 'Shiny V / シャイニーV',                tokens: ['shiny v', 'シャイニーv', 'シャイニーＶ', 'shiny vstar'] },
    { label: 'Tohoku Specialty / 東北 / トウホク',   tokens: ['tohoku', '東北', 'トウホク', 'とうほく'] },
    { label: 'Victini / ビクティニ',                 tokens: ['victini', 'ビクティニ'] },
    { label: 'Bandai Pokemon Kids / ポケモンキッズ',  tokens: ['pokemon kids', 'ポケモンキッズ', 'bandai pokemon', 'pokemonkids'] },
    { label: 'Takara Tomy Poke-nade / ポケネード',   tokens: ['poke-nade', 'pokenade', 'ポケネード', 'takara tomy poke'] },
    { label: 'Weiss / ヴァイス',                     tokens: ['weiss', 'ヴァイス', 'ヴァイスシュヴァルツ', 'weiss schwarz'] }
  ];

  function _r4norm(s) {
    return String(s || '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e')
      .toLowerCase();
  }

  L('');
  L('=== [2] 特定商品検索 ===');
  TARGETS.forEach(function(tgt) {
    var hits = [];
    rows.forEach(function(r) {
      var hay = _r4norm([r.id, r.cat, r.ja, r.en, r.kw, r.rov, r.ser].join(' '));
      if (tgt.tokens.some(function(tok) { return hay.indexOf(_r4norm(tok)) !== -1; })) {
        hits.push(r);
      }
    });
    if (hits.length === 0) {
      L('[' + tgt.label + '] → NOT FOUND');
    } else {
      L('[' + tgt.label + '] → ' + hits.length + '件:');
      hits.forEach(function(r) {
        L('  ' + r.id + ' | ' + r.cat + ' | JA=' + r.ja + ' | EN=' + r.en + ' | KW=' + r.kw + ' | ROV=' + r.rov + ' | SER=' + r.ser);
      });
    }
  });

  // ── [3] ギャップ分析 ─────────────────────────────────────────
  var emptyEn = [], jaOnly = [], emptyKw = [];
  rows.forEach(function(r) {
    if (!r.en) emptyEn.push(r.id + '|' + r.ja);
    if (r.ja && !r.en) jaOnly.push(r.id + '|' + r.ja);
    if (!r.kw) emptyKw.push(r.id + '|' + (r.en || r.ja));
  });

  L('');
  L('=== [3] ギャップ分析 ===');
  L('English Title 空欄: ' + emptyEn.length + '件');
  L('  ' + emptyEn.join(' / '));
  L('Japanese Title のみ (EN空欄): ' + jaOnly.length + '件');
  L('  ' + jaOnly.join(' / '));
  L('Search Keywords 空欄: ' + emptyKw.length + '件');
  L('  ' + emptyKw.join(' / '));

  L('');
  L('=== investigateInvBookRecon4 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateInvBookReconV4: 名寄せ再試算
//   - PM0174 Symphonia 修正反映
//   - レアリティ略号含む商品名は fuzzy 除外
// ============================================================
function investigateInvBookReconV4() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }

  var INV_BOOK_ID = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';
  var invSS, crmSS;
  try {
    invSS = SpreadsheetApp.openById(INV_BOOK_ID);
    crmSS = getSpreadsheet();
  } catch (e) {
    L('[ERROR] ' + e.message); return out.join('\n');
  }

  // ── PM228 読み込み ─────────────────────────────────────────
  var pmSh   = invSS.getSheetByName('商品マスタ');
  var pmRaw  = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  var pmList = pmRaw.map(function(r) {
    return {
      id:        String(r[0]  || '').trim(),
      engTitle:  String(r[4]  || '').trim(),
      jpnTitle:  String(r[3]  || '').trim(),
      keywords:  String(r[11] || '').trim(),
      reqOutput: String(r[15] || '').trim(),
      relSeries: String(r[13] || '').trim()
    };
  }).filter(function(p) { return p.id; });

  var pmEntries = pmList.map(function(pm) {
    var kws = pm.keywords.split(',');
    var directNorms = [
      { v: _v3n(pm.engTitle),  label: 'EnglishTitle'   },
      { v: _v3n(pm.jpnTitle),  label: 'JapaneseTitle'  },
      { v: _v3n(pm.reqOutput), label: 'RequiredOutput' },
      { v: _v3n(pm.relSeries), label: 'RelatedSeries'  }
    ].filter(function(x) { return x.v.length >= 4; });
    var kwNorms = kws.map(function(k) {
      return { v: _v3n(k.trim()), raw: k.trim() };
    }).filter(function(x) { return x.v.length >= 5; });
    var rawFields = [pm.engTitle, pm.jpnTitle, pm.reqOutput, pm.relSeries].concat(kws);
    var seenB = {};
    var bases = rawFields.map(_v3b).filter(function(b) {
      if (!b || b.length < 3 || seenB[b]) return false;
      seenB[b] = true; return true;
    });
    return { id: pm.id, directNorms: directNorms, kwNorms: kwNorms, bases: bases };
  });

  // ── レアリティ略号チェック ──────────────────────────────────
  // スペース・スラッシュ・ドット区切りでトークン化し、略号と完全一致するか判定
  var RARITY_TOKENS = ['ar', 'sr', 'sar', 'rr', 'rrr', 'ur', 'chr', 'hr', 'ssr', 'tr', 'csr', 'acr'];
  function _hasRarityToken(name) {
    var tokens = _v3n(name).split(/[\s\/.,、＆&]+/);
    return tokens.some(function(t) { return RARITY_TOKENS.indexOf(t) !== -1; });
  }

  // ── CRM オーダー明細 照合 ──────────────────────────────────
  var olSh      = crmSS.getSheetByName('オーダー明細');
  var olLastRow = olSh.getLastRow();
  var olData    = olLastRow > 1 ? olSh.getRange(2, 1, olLastRow - 1, 10).getValues() : [];
  L('CRMオーダー明細 データ行数: ' + olData.length);

  var confirmed = 0, confirmedIds = {};
  var fuzzyMap = {}, rarityExcMap = {}, unmatchedMap = {};

  olData.forEach(function(row) {
    var crmName = String(row[4] || '').trim();
    if (!crmName) return;

    var res = _v3match(crmName, pmEntries);

    if (res.matched && !res.fuzzy) {
      // 確定一致
      confirmed++;
      confirmedIds[res.pmId] = true;
    } else {
      unmatchedMap[crmName] = (unmatchedMap[crmName] || 0) + 1;
      if (res.matched && res.fuzzy) {
        if (_hasRarityToken(crmName)) {
          // 新ルール: レアリティ略号含む → fuzzy 除外
          var ek = crmName + '\x00' + res.pmId;
          if (!rarityExcMap[ek]) rarityExcMap[ek] = res;
        } else {
          var fk = crmName + '\x00' + res.pmId;
          if (!fuzzyMap[fk]) fuzzyMap[fk] = res;
        }
      }
    }
  });

  // ── [1] 集計結果 ──────────────────────────────────────────
  L('');
  L('════════════════════════════════════');
  L('[1] 名寄せ試算 v4 集計');
  L('════════════════════════════════════');
  L('確定一致件数: ' + confirmed + ' 件 （v3比較: 389件）');
  L('確定一致商品ID種類: ' + Object.keys(confirmedIds).length + ' 種 （v3比較: 59種）');
  L('');

  // レアリティ除外されたfuzzy候補
  var rkeys = Object.keys(rarityExcMap).sort();
  L('★ レアリティ除外により fuzzy → 未一致に変更された候補: ' + rkeys.length + '種');
  rkeys.forEach(function(ek) {
    var f = rarityExcMap[ek];
    L('  除外: "' + f.crmName + '" → ' + f.pmId + ' [base:"' + f.matchedVal + '" dist=' + f.dist + ']');
  });
  L('');

  // 残存fuzzy（レアリティなし）
  var fkeys = Object.keys(fuzzyMap).sort();
  L('残存 fuzzy 候補（rarity除外後・確定外）: ' + fkeys.length + '件');
  fkeys.forEach(function(fk) {
    var f = fuzzyMap[fk];
    L('  "' + f.crmName + '" → ' + f.pmId + ' [base:"' + f.matchedVal + '" dist=' + f.dist + ']');
  });

  // ── [2] 未一致 全件（件数降順） ──────────────────────────
  L('');
  L('════════════════════════════════════');
  L('[2] 未一致の商品名 全件（件数降順）');
  L('════════════════════════════════════');
  var unmatchedKeys = Object.keys(unmatchedMap).sort(function(a, b) {
    return unmatchedMap[b] - unmatchedMap[a];
  });
  L('未一致総種類数: ' + unmatchedKeys.length + '種');
  unmatchedKeys.forEach(function(k) {
    var base    = _v3b(k);
    var rTag    = _hasRarityToken(k) ? ' [rarity]' : '';
    var baseTag = (base && base.length >= 3) ? ' [base:"' + base + '"]' : '';
    L('  ' + unmatchedMap[k] + '件  "' + k + '"' + rTag + baseTag);
  });

  L('');
  L('=== investigateInvBookReconV4 完了 ===');
  return out.join('\n');
}

// ============================================================
// 商品名正規化: DRY_RUN / EXEC
// ============================================================

var _NPN_RULES = [
  { label: 'Black Volt->Black Bolt',                pat: 'Black Volt',           to: 'Black Bolt'        },
  { label: 'Mega Sinfonia->Mega Symphonia',          pat: 'Mega Sinfonia',        to: 'Mega Symphonia'    },
  { label: 'Stella Miracle->Stellar Miracle',        pat: 'Stella Miracle',       to: 'Stellar Miracle'   },
  { label: 'Crimzon Haze->Crimson Haze',             pat: 'Crimzon Haze',         to: 'Crimson Haze'      },
  { label: 'Infernno X->Inferno X',                 pat: 'Infernno X',           to: 'Inferno X'         },
  { label: 'Elaectric Breaker->Electric Breaker',    pat: 'Elaectric Breaker',    to: 'Electric Breaker'  },
  { label: 'Electric Braker->Electric Breaker',      pat: 'Electric Braker',      to: 'Electric Breaker'  },
  { label: 'Preimum Treaner->Premium Trainer',       pat: 'Preimum Treaner',      to: 'Premium Trainer'   },
  { label: 'Shiny Treasures EX->Shiny Treasure ex',  pat: 'Shiny Treasures EX',   to: 'Shiny Treasure ex' },
  { label: 'Weiss Shawarz->Weiss Schwarz',           pat: 'Weiss Shawarz',        to: 'Weiss Schwarz'     },
  { label: 'Pokemon(e-accent)->Pokemon',             pat: 'Pok\u00e9mon',         to: 'Pokemon'           }
];

// 全ルールを順番に適用して置換後文字列を返す
function _npnApply(s) {
  _NPN_RULES.forEach(function(r) {
    s = s.replace(new RegExp(r.pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), r.to);
  });
  return s;
}

// PM228 を pmEntries 形式で構築（再照合用）
function _npnBuildPmEntries(invSS) {
  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  return pmRaw.map(function(r) {
    var pm = {
      id:        String(r[0]  || '').trim(),
      engTitle:  String(r[4]  || '').trim(),
      jpnTitle:  String(r[3]  || '').trim(),
      keywords:  String(r[11] || '').trim(),
      reqOutput: String(r[15] || '').trim(),
      relSeries: String(r[13] || '').trim()
    };
    if (!pm.id) return null;
    var kws = pm.keywords.split(',');
    var directNorms = [
      { v: _v3n(pm.engTitle),  label: 'EnglishTitle'   },
      { v: _v3n(pm.jpnTitle),  label: 'JapaneseTitle'  },
      { v: _v3n(pm.reqOutput), label: 'RequiredOutput' },
      { v: _v3n(pm.relSeries), label: 'RelatedSeries'  }
    ].filter(function(x) { return x.v.length >= 4; });
    var kwNorms = kws.map(function(k) {
      return { v: _v3n(k.trim()), raw: k.trim() };
    }).filter(function(x) { return x.v.length >= 5; });
    var rawFields = [pm.engTitle, pm.jpnTitle, pm.reqOutput, pm.relSeries].concat(kws);
    var seenB = {};
    var bases = rawFields.map(_v3b).filter(function(b) {
      if (!b || b.length < 3 || seenB[b]) return false;
      seenB[b] = true; return true;
    });
    return { id: pm.id, directNorms: directNorms, kwNorms: kwNorms, bases: bases };
  }).filter(Boolean);
}

// ヘッダー配列からバリアント名で列インデックスを返す
function _npnFindCol(headers, variants) {
  var r = -1;
  headers.forEach(function(h, i) {
    if (r >= 0) return;
    var hn = String(h).toLowerCase().replace(/[\s_]/g, '');
    if (variants.some(function(v) { return hn === v.toLowerCase().replace(/[\s_]/g, ''); })) r = i;
  });
  return r;
}

// ──────────────────────────────────────────────────────────
// DRY RUN: 置換対象の全件とルール別件数を報告。書き込みなし
// ──────────────────────────────────────────────────────────
function normalizeProductNamesDryRun() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== normalizeProductNamesDryRun (読み取り専用) ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmEntries = _npnBuildPmEntries(invSS);

  var olSh      = crmSS.getSheetByName('オーダー明細');
  var olLastRow = olSh.getLastRow();
  var numCols   = olSh.getLastColumn();
  var headers   = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });

  L('ヘッダー: ' + headers.join(' | '));

  var CI_DETAIL   = _npnFindCol(headers, ['明細ID','detailid','detail_id','明細行ID','行ID']);
  var CI_ORDER    = _npnFindCol(headers, ['オーダーID','orderid','order_id','注文ID','受注ID']);
  var CI_NAME     = _npnFindCol(headers, ['商品名','productname','product_name','商品名称','itemname']);
  var CI_QTY      = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_SUBTOTAL = _npnFindCol(headers, ['小計','subtotal','sub_total']);

  if (CI_NAME < 0) { CI_NAME = 4; L('[WARN] 商品名列ヘッダー未発見 -> col5(idx4) を使用'); }
  L('列: 明細ID=' + (CI_DETAIL+1) + ' オーダーID=' + (CI_ORDER+1)
    + ' 商品名=' + (CI_NAME+1) + ' 数量=' + (CI_QTY+1) + ' 小計=' + (CI_SUBTOTAL+1));

  var olData = olLastRow > 1 ? olSh.getRange(2, 1, olLastRow - 1, numCols).getValues() : [];
  L('データ行数: ' + olData.length);

  // ── 置換収集 ──
  var changes = [];
  var ruleCounts = {};
  _NPN_RULES.forEach(function(r) { ruleCounts[r.label] = 0; });

  olData.forEach(function(row, ri) {
    var before  = String(row[CI_NAME] || '').trim();
    if (!before) return;
    var current = before;
    var applied = [];
    _NPN_RULES.forEach(function(r) {
      var re   = new RegExp(r.pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      var next = current.replace(re, r.to);
      if (next !== current) { ruleCounts[r.label]++; applied.push(r.label); }
      current = next;
    });
    if (current !== before) {
      changes.push({
        sheetRow: ri + 2,
        detailId: CI_DETAIL >= 0 ? String(row[CI_DETAIL] || '') : '?',
        orderId:  CI_ORDER  >= 0 ? String(row[CI_ORDER]  || '') : '?',
        before:   before,
        after:    current,
        rules:    applied
      });
    }
  });

  // ── [1] ルール別件数 ──
  L('');
  L('════════════════════════════════════');
  L('[1] ルール別 置換件数（計' + changes.length + '行対象）');
  L('════════════════════════════════════');
  _NPN_RULES.forEach(function(r) {
    L('  ' + ruleCounts[r.label] + '件  ' + r.label);
  });

  // ── [2] 全件明細 ──
  L('');
  L('════════════════════════════════════');
  L('[2] 置換対象 全件');
  L('════════════════════════════════════');
  changes.forEach(function(c) {
    L('  [row' + c.sheetRow + '] 明細=' + c.detailId + ' order=' + c.orderId);
    L('    before: ' + c.before);
    L('    after:  ' + c.after);
    L('    rules:  ' + c.rules.join(' ; '));
  });

  // ── [3] 再照合試算 ──
  var afterMap = {};
  changes.forEach(function(c) { afterMap[c.sheetRow] = c.after; });

  var confBefore = 0, confAfter = 0, idsAfter = {};
  var newlyMatched = [];
  olData.forEach(function(row, ri) {
    var before = String(row[CI_NAME] || '').trim();
    if (!before) return;
    var after  = afterMap[ri + 2] || before;
    var rB = _v3match(before, pmEntries);
    if (rB.matched && !rB.fuzzy) confBefore++;
    var rA = _v3match(after, pmEntries);
    if (rA.matched && !rA.fuzzy) {
      confAfter++;
      idsAfter[rA.pmId] = true;
      if (!(rB.matched && !rB.fuzzy)) {
        newlyMatched.push({ before: before, after: after, pmId: rA.pmId });
      }
    }
  });

  L('');
  L('════════════════════════════════════');
  L('[3] 置換後 再照合試算');
  L('════════════════════════════════════');
  L('現在の確定一致（本関数内再計算）: ' + confBefore + '件');
  L('置換後の確定一致: '               + confAfter  + '件');
  L('増分: +'                         + (confAfter - confBefore) + '件');
  L('確定一致ID種類: '                 + Object.keys(idsAfter).length + '種');
  L('');
  L('新規マッチとなる行（' + newlyMatched.length + '件）:');
  newlyMatched.forEach(function(m) {
    L('  before="' + m.before + '"');
    L('  after= "' + m.after  + '"  -> ' + m.pmId);
  });

  L('');
  L('=== DRY RUN 完了。書き込みなし。GO後に normalizeProductNamesExec を実行 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// EXEC: GO確認後に実行。置換 + 検証レポート
// ──────────────────────────────────────────────────────────
function normalizeProductNamesExec() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== normalizeProductNamesExec (書き込みあり) ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmEntries = _npnBuildPmEntries(invSS);

  var olSh      = crmSS.getSheetByName('オーダー明細');
  var olLastRow = olSh.getLastRow();
  var numCols   = olSh.getLastColumn();
  var headers   = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });

  var CI_NAME     = _npnFindCol(headers, ['商品名','productname','product_name','商品名称','itemname']);
  var CI_QTY      = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_SUBTOTAL = _npnFindCol(headers, ['小計','subtotal','sub_total']);
  if (CI_NAME < 0) CI_NAME = 4;

  var olData = olLastRow > 1 ? olSh.getRange(2, 1, olLastRow - 1, numCols).getValues() : [];

  // 置換前スナップショット（金額変化なし証明用）
  var totalQtyBefore = 0, totalSubBefore = 0;
  if (CI_QTY      >= 0) olData.forEach(function(r){ totalQtyBefore += Number(r[CI_QTY])      || 0; });
  if (CI_SUBTOTAL >= 0) olData.forEach(function(r){ totalSubBefore += Number(r[CI_SUBTOTAL]) || 0; });

  // 置換対象特定
  var updates = [];
  olData.forEach(function(row, ri) {
    var before = String(row[CI_NAME] || '').trim();
    if (!before) return;
    var after = _npnApply(before);
    if (after !== before) updates.push({ sheetRow: ri + 2, colIdx: CI_NAME + 1, before: before, after: after });
  });

  L('置換対象: ' + updates.length + '行');

  // 書き込み
  updates.forEach(function(u) {
    olSh.getRange(u.sheetRow, u.colIdx).setValue(u.after);
  });
  L('書き込み完了');
  updates.forEach(function(u) {
    L('  row' + u.sheetRow + ': "' + u.before + '" -> "' + u.after + '"');
  });

  // 書き込み後再取得して検証
  var olDataAfter = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  var emptyNames = 0, totalQtyAfter = 0, totalSubAfter = 0;
  olDataAfter.forEach(function(r) {
    if (!String(r[CI_NAME] || '').trim()) emptyNames++;
    if (CI_QTY      >= 0) totalQtyAfter += Number(r[CI_QTY])      || 0;
    if (CI_SUBTOTAL >= 0) totalSubAfter += Number(r[CI_SUBTOTAL]) || 0;
  });

  // 再照合
  var confAfter = 0, idsAfter = {};
  olDataAfter.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!name) return;
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) { confAfter++; idsAfter[res.pmId] = true; }
  });

  L('');
  L('════════════════════════════════════');
  L('[CONFIRM] 検証結果');
  L('════════════════════════════════════');
  L('置換件数: '      + updates.length                             + '行');
  L('確定一致件数: '  + confAfter + '件  (v4の407からの増分: +'   + (confAfter - 407) + ')');
  L('一致ID種類: '    + Object.keys(idsAfter).length              + '種');
  L('空商品名行: '    + emptyNames                                 + '行  (0であること)');
  L('行数: '         + olDataAfter.length                         + '行  (595であること)');
  L('数量合計 before=' + totalQtyBefore + ' after=' + totalQtyAfter
    + '  一致=' + (totalQtyBefore === totalQtyAfter));
  L('小計合計 before=' + totalSubBefore.toFixed(2) + ' after=' + totalSubAfter.toFixed(2)
    + '  一致=' + (Math.abs(totalSubBefore - totalSubAfter) < 0.01));

  L('');
  L('=== normalizeProductNamesExec 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// 補足調査: 空商品名15行の pre-existing 確認 + OD-00095 詳細
// ──────────────────────────────────────────────────────────
function investigatePostNormalize() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigatePostNormalize ===');

  var crmSS;
  try { crmSS = getSpreadsheet(); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var olData  = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  var CI_DETAIL   = _npnFindCol(headers, ['明細ID','detailid','detail_id','明細行ID','行ID']);
  var CI_ORDER    = _npnFindCol(headers, ['オーダーID','orderid','order_id','注文ID','受注ID']);
  var CI_ROW      = _npnFindCol(headers, ['行番号','rowno','row_no','行No']);
  var CI_NAME     = _npnFindCol(headers, ['商品名','productname','product_name','商品名称','itemname']);
  var CI_STATUS   = _npnFindCol(headers, ['状態','status','ステータス']);
  var CI_SKU      = _npnFindCol(headers, ['SKU','sku']);
  var CI_QTY      = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_PRICE    = _npnFindCol(headers, ['単価','unitprice','unit_price','price']);
  var CI_SUBTOTAL = _npnFindCol(headers, ['小計','subtotal','sub_total']);
  if (CI_NAME < 0) CI_NAME = 4;

  // ── [A] 空商品名行の全件 ──
  L('');
  L('════════════════════════════════════');
  L('[A] 空商品名行の全件（pre-existing 確認）');
  L('════════════════════════════════════');
  var emptyRows = [];
  olData.forEach(function(row, ri) {
    if (!String(row[CI_NAME] || '').trim()) {
      emptyRows.push({
        sheetRow: ri + 2,
        detailId: CI_DETAIL >= 0 ? String(row[CI_DETAIL] || '') : '?',
        orderId:  CI_ORDER  >= 0 ? String(row[CI_ORDER]  || '') : '?',
        status:   CI_STATUS >= 0 ? String(row[CI_STATUS] || '') : '?',
        sku:      CI_SKU    >= 0 ? String(row[CI_SKU]    || '') : '?',
        qty:      CI_QTY    >= 0 ? String(row[CI_QTY]    || '') : '?',
        sub:      CI_SUBTOTAL >= 0 ? String(row[CI_SUBTOTAL] || '') : '?'
      });
    }
  });
  L('空商品名行数: ' + emptyRows.length);
  emptyRows.forEach(function(r) {
    L('  row' + r.sheetRow + ' 明細=' + r.detailId + ' order=' + r.orderId
      + ' status=' + r.status + ' sku=' + r.sku + ' qty=' + r.qty + ' sub=' + r.sub);
  });

  // ── [B] OD-00095 全明細（点4: Preimum Treaner Box の特定） ──
  L('');
  L('════════════════════════════════════');
  L('[B] OD-00095 の全明細（日付・単価・数量）');
  L('════════════════════════════════════');
  var od0095 = [];
  olData.forEach(function(row, ri) {
    var orderId = CI_ORDER >= 0 ? String(row[CI_ORDER] || '').trim() : '';
    if (orderId === 'OD-00095') {
      od0095.push({
        sheetRow: ri + 2,
        detailId: CI_DETAIL >= 0 ? String(row[CI_DETAIL] || '') : '?',
        rowNo:    CI_ROW    >= 0 ? String(row[CI_ROW]    || '') : '?',
        name:     String(row[CI_NAME] || ''),
        sku:      CI_SKU    >= 0 ? String(row[CI_SKU]    || '') : '?',
        qty:      CI_QTY    >= 0 ? row[CI_QTY]    : '?',
        price:    CI_PRICE  >= 0 ? row[CI_PRICE]  : '?',
        subtotal: CI_SUBTOTAL >= 0 ? row[CI_SUBTOTAL] : '?'
      });
    }
  });
  L('OD-00095 明細件数: ' + od0095.length);
  od0095.forEach(function(r) {
    L('  [row' + r.sheetRow + '] ' + r.detailId + ' 行No=' + r.rowNo);
    L('    商品名: ' + r.name);
    L('    SKU=' + r.sku + ' 数量=' + r.qty + ' 単価=' + r.price + ' 小計=' + r.subtotal);
  });

  // ── [C] オーダーマスタから OD-00095 の日付を取得 ──
  L('');
  L('════════════════════════════════════');
  L('[C] オーダーマスタ OD-00095 の日付');
  L('════════════════════════════════════');
  // オーダーシート候補を探す
  var orderSheetNames = ['オーダー', 'Orders', 'Order', '注文', '受注', 'オーダーマスタ', 'OrderMaster'];
  var orderSh = null;
  orderSheetNames.forEach(function(name) {
    if (!orderSh) orderSh = crmSS.getSheetByName(name);
  });
  if (!orderSh) {
    // シート一覧を出力
    var allSheets = crmSS.getSheets().map(function(s){ return s.getName(); });
    L('オーダーマスタシートが見つかりません。シート一覧: ' + allSheets.join(' / '));
  } else {
    var ohLastRow = orderSh.getLastRow();
    var ohNumCols = orderSh.getLastColumn();
    var ohHeaders = orderSh.getRange(1, 1, 1, ohNumCols).getValues()[0].map(function(h){ return String(h).trim(); });
    L('シート: "' + orderSh.getName() + '" ヘッダー: ' + ohHeaders.join(' | '));
    var OCI_ID   = _npnFindCol(ohHeaders, ['オーダーID','orderid','order_id','注文ID','受注ID','ID']);
    var OCI_DATE = _npnFindCol(ohHeaders, ['日付','date','注文日','受注日','オーダー日','order_date','orderdate','created_at','作成日']);
    var ohData   = ohLastRow > 1 ? orderSh.getRange(2, 1, ohLastRow - 1, ohNumCols).getValues() : [];
    var found = false;
    ohData.forEach(function(row) {
      var oid = OCI_ID >= 0 ? String(row[OCI_ID] || '').trim() : '';
      if (oid === 'OD-00095') {
        found = true;
        L('OD-00095 発見:');
        ohHeaders.forEach(function(h, i) {
          L('  ' + h + ': ' + String(row[i] || ''));
        });
      }
    });
    if (!found) L('OD-00095 がオーダーマスタに見つかりません');
  }

  L('');
  L('=== investigatePostNormalize 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// 確定調査: OD-00095 受注日 + PM Release Date 比較 + Black Bolt ID確定
// ──────────────────────────────────────────────────────────
function investigateProductDates() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateProductDates ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  // ── [A] 商品マスタから対象PMの詳細（Release Date 含む）──
  // col1=product_id, col4=JA Title, col5=EN Title, col11=Release Date
  var COL_RD = 10; // Release Date (0-based index)
  var TARGET_IDS = ['PM0093', 'PM0175', 'PM0165', 'PM0166', 'PM0167', 'PM0168'];

  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();

  L('');
  L('════════════════════════════════════');
  L('[A] 商品マスタ 対象PM の Release Date');
  L('════════════════════════════════════');
  var pmInfo = {};
  pmRaw.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (TARGET_IDS.indexOf(id) < 0) return;
    var rd = r[COL_RD];
    var rdStr = (rd instanceof Date) ? rd.toISOString().slice(0, 10)
              : String(rd || '').trim();
    pmInfo[id] = { ja: String(r[3]||'').trim(), en: String(r[4]||'').trim(), releaseDate: rdStr };
    L('  ' + id + ' | JA=' + pmInfo[id].ja + ' | EN=' + pmInfo[id].en + ' | ReleaseDate=' + rdStr);
  });

  // ── [B] オーダー管理から OD-00095 の受注日・請求書発行日 ──
  L('');
  L('════════════════════════════════════');
  L('[B] オーダー管理シート: OD-00095 全フィールド');
  L('════════════════════════════════════');
  var omSh = crmSS.getSheetByName('オーダー管理');
  if (!omSh) {
    L('[ERROR] "オーダー管理" シートが見つかりません');
  } else {
    var omLastRow = omSh.getLastRow();
    var omNumCols = omSh.getLastColumn();
    var omHeaders = omSh.getRange(1, 1, 1, omNumCols).getValues()[0].map(function(h){ return String(h).trim(); });
    L('ヘッダー: ' + omHeaders.join(' | '));

    var OCI_ID = _npnFindCol(omHeaders, ['オーダーID','orderid','order_id','注文ID','受注ID','ID']);
    L('オーダーID列: col' + (OCI_ID + 1));

    var omData = omLastRow > 1 ? omSh.getRange(2, 1, omLastRow - 1, omNumCols).getValues() : [];
    var found = false;
    omData.forEach(function(row) {
      var oid = OCI_ID >= 0 ? String(row[OCI_ID] || '').trim() : '';
      if (oid !== 'OD-00095') return;
      found = true;
      L('OD-00095 発見 — 全フィールド:');
      omHeaders.forEach(function(h, i) {
        var v = row[i];
        var vs = (v instanceof Date) ? v.toISOString().slice(0, 10) : String(v === null || v === undefined ? '' : v).trim();
        L('  [' + h + ']: ' + vs);
      });
    });
    if (!found) {
      L('OD-00095 は オーダー管理 に見つかりませんでした');
      // OD番号の探し方が違う場合のため、先頭5行を出力
      L('先頭5行のオーダーID列:');
      for (var i = 0; i < Math.min(5, omData.length); i++) {
        L('  row' + (i+2) + ': "' + (OCI_ID >= 0 ? String(omData[i][OCI_ID] || '') : '(col不明)') + '"');
      }
    }
  }

  // ── [C] Black Bolt / ブラックボルト 全マッチを商品マスタから検索 ──
  L('');
  L('════════════════════════════════════');
  L('[C] 商品マスタ "Black Bolt" / "ブラックボルト" 全件');
  L('════════════════════════════════════');
  var bbTokens = ['black bolt', 'ブラックボルト'];
  pmRaw.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (!id) return;
    var ja = String(r[3] || '').trim();
    var en = String(r[4] || '').trim();
    var kw = String(r[11] || '').trim();
    var hay = (id + ' ' + ja + ' ' + en + ' ' + kw).toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    var hit = bbTokens.some(function(t){ return hay.indexOf(t) >= 0; });
    if (!hit) return;
    var rd = r[COL_RD];
    var rdStr = (rd instanceof Date) ? rd.toISOString().slice(0, 10) : String(rd || '').trim();
    L('  ' + id + ' | JA=' + ja + ' | EN=' + en + ' | ReleaseDate=' + rdStr);
    L('    KW=' + kw);
  });

  L('');
  L('=== investigateProductDates 完了 ===');
  return out.join('\n');
}
