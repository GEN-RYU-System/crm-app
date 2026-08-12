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
// v5.1: アポストロフィ類・ハイフン/ダッシュ類を ASCII に統一
function _v3n(s) {
  return _v3fw(String(s || ''))
    .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e')
    // アポストロフィ類 → U+0027 (例: McDonald\u2019s → McDonald's)
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u00B4\uFF07]/g, "'")
    // ハイフン/ダッシュ類 → U+002D (例: Singles \u2013 Bulk → Singles - Bulk)
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFF0D]/g, '-')
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

// 商品名照合（v5: base優先度修正 + qualifier-aware）
// 修正点:
//   Phase 0: cnQ（括弧内容をインライン展開）を追加 → "(DX)"/"(Standard)" 等が直接フィールドで解決
//   Phase 1: base照合を全PM収集→ランク付け → ① exact > ② input⊇PM > ③ PM⊇input, 同順位は長いPM優先
function _v3match(crmName, pmEntries) {
  var cn   = _v3n(crmName);
  // cnNb: 括弧除去（[SV2a] 等を外す）
  var cnNb = cn.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
               .replace(/\s+/g, ' ').trim();
  // cnQ: 括弧を外してその中身をインライン展開 → "(DX)" → "DX" として照合できるようにする
  var cnQ  = cn.replace(/\(([^)]*)\)/g, ' $1 ').replace(/\[[^\]]*\]/g, ' ')
               .replace(/\s+/g, ' ').trim();
  var cb   = _v3b(crmName);

  // ── Phase 0: 直接フィールド + キーワード照合 ──
  // cn / cnNb / cnQ の3種で試行。全PM走査、最初のヒットで返す
  for (var i = 0; i < pmEntries.length; i++) {
    var pe = pmEntries[i];
    for (var f = 0; f < pe.directNorms.length; f++) {
      var fv = pe.directNorms[f].v;
      if (cn.indexOf(fv) >= 0 || cnNb.indexOf(fv) >= 0 || cnQ.indexOf(fv) >= 0) {
        return { matched: true, pmId: pe.id, field: pe.directNorms[f].label,
                 matchedVal: fv, crmName: crmName, fuzzy: false };
      }
    }
    for (var k = 0; k < pe.kwNorms.length; k++) {
      var kv = pe.kwNorms[k].v;
      if (cn.indexOf(kv) >= 0 || cnNb.indexOf(kv) >= 0 || cnQ.indexOf(kv) >= 0) {
        return { matched: true, pmId: pe.id, field: 'SearchKeyword',
                 matchedVal: pe.kwNorms[k].raw, crmName: crmName, fuzzy: false };
      }
    }
  }

  // ── Phase 1: Base照合（優先度付き・全PM収集して最良選択）──
  // ① cb===pb (exact)  ② cb⊃pb (input contains PM base)  ③ pb⊃cb (PM contains input base)
  // 同順位: pb が長い方（より具体的）を優先
  if (cb.length >= 4) {
    var baseCands = [];
    for (var j = 0; j < pmEntries.length; j++) {
      var pe2 = pmEntries[j];
      for (var b2 = 0; b2 < pe2.bases.length; b2++) {
        var pb = pe2.bases[b2];
        if (pb.length < 3) continue;
        if (cb === pb) {
          baseCands.push({ rank: 0, pe: pe2, pb: pb });
        } else if (cb.indexOf(pb) >= 0) {
          baseCands.push({ rank: 1, pe: pe2, pb: pb });
        } else if (pb.indexOf(cb) >= 0) {
          baseCands.push({ rank: 2, pe: pe2, pb: pb });
        }
      }
    }
    if (baseCands.length > 0) {
      baseCands.sort(function(a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.pb.length - a.pb.length;
      });
      var best = baseCands[0];
      return { matched: true, pmId: best.pe.id, field: 'BaseName',
               matchedVal: best.pb, crmName: crmName, fuzzy: false };
    }
  }

  // ── Phase 2: Fuzzy（cb 5文字以上のみ）──
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

// ──────────────────────────────────────────────────────────
// マッチング修正後の再試算 + PM間base包含ペア調査
// ──────────────────────────────────────────────────────────
function investigateMatchingFix() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateMatchingFix ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmEntries = _npnBuildPmEntries(invSS);

  // ── [A] PM間 base包含ペア（「同じ罠」が起きうる組み合わせの全列挙）──
  L('');
  L('════════════════════════════════════');
  L('[A] PM間 base包含ペア（混同リスクあり・書き込みなし）');
  L('════════════════════════════════════');

  // baseのPM出現頻度カウント（汎用すぎる base を除外するため）
  var baseFreq = {};
  pmEntries.forEach(function(pe) {
    pe.bases.forEach(function(b) { baseFreq[b] = (baseFreq[b] || 0) + 1; });
  });

  var confPairs = [];
  for (var i = 0; i < pmEntries.length; i++) {
    for (var j = i + 1; j < pmEntries.length; j++) {
      var basesA = pmEntries[i].bases;
      var basesB = pmEntries[j].bases;
      var pairAdded = false;
      basesA.forEach(function(ba) {
        if (pairAdded || ba.length < 5) return;
        if (baseFreq[ba] > 3) return; // 3超は汎用すぎる
        basesB.forEach(function(bb) {
          if (pairAdded || bb.length < 5) return;
          if (baseFreq[bb] > 3) return;
          if (ba !== bb && (ba.indexOf(bb) >= 0 || bb.indexOf(ba) >= 0)) {
            confPairs.push({ idA: pmEntries[i].id, idB: pmEntries[j].id, ba: ba, bb: bb });
            pairAdded = true;
          }
        });
      });
    }
  }
  L('包含ペア数: ' + confPairs.length);
  confPairs.forEach(function(p) {
    var shorter = p.ba.length <= p.bb.length ? p.ba : p.bb;
    var longer  = p.ba.length <= p.bb.length ? p.bb : p.ba;
    var shortId = p.ba.length <= p.bb.length ? p.idA : p.idB;
    var longId  = p.ba.length <= p.bb.length ? p.idB : p.idA;
    L('  ' + shortId + ' base="' + shorter + '"  ⊂  ' + longId + ' base="' + longer + '"');
  });

  // ── [B] 全件再照合（修正済み _v3match 使用）──
  L('');
  L('════════════════════════════════════');
  L('[B] 全件再照合（新 _v3match・書き込みなし）');
  L('════════════════════════════════════');

  var olSh = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name','商品名称','itemname']);
  if (CI_NAME < 0) CI_NAME = 4;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  var confirmed = 0, unmatchedCount = 0;
  var idBreakdown = {};
  var bbPM165 = [], bbPM167 = [];
  var unmatchedList = [];

  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!name) return;
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) {
      confirmed++;
      idBreakdown[res.pmId] = (idBreakdown[res.pmId] || 0) + 1;
      if (res.pmId === 'PM0165') bbPM165.push(name);
      if (res.pmId === 'PM0167') bbPM167.push(name);
    } else if (!res.matched) {
      unmatchedCount++;
      unmatchedList.push(name);
    }
  });

  L('確定一致: ' + confirmed + '件  旧=443  差=' + (confirmed - 443));
  L('未一致:   ' + unmatchedCount + '件');

  // ── [C] Black Bolt 内訳 ──
  L('');
  L('════════════════════════════════════');
  L('[C] Black Bolt 系 内訳');
  L('════════════════════════════════════');
  L('PM0165 (ブラックボルトDX): ' + bbPM165.length + '件');
  bbPM165.forEach(function(n) { L('  ' + n); });
  L('PM0167 (ブラックボルト標準): ' + bbPM167.length + '件');
  bbPM167.slice(0, 20).forEach(function(n) { L('  ' + n); });
  if (bbPM167.length > 20) L('  ... (' + (bbPM167.length - 20) + '件省略)');

  // ── [D] 未一致の上位（件数降順）──
  L('');
  L('════════════════════════════════════');
  L('[D] 未一致リスト（最大40件）');
  L('════════════════════════════════════');
  var unmatchedFreq = {};
  unmatchedList.forEach(function(n) { unmatchedFreq[n] = (unmatchedFreq[n] || 0) + 1; });
  var unmatchedSorted = Object.keys(unmatchedFreq).sort(function(a, b) { return unmatchedFreq[b] - unmatchedFreq[a]; });
  unmatchedSorted.slice(0, 40).forEach(function(n) {
    L('  ' + unmatchedFreq[n] + '件  "' + n + '"');
  });
  if (unmatchedSorted.length > 40) L('  ... (' + (unmatchedSorted.length - 40) + '種省略)');

  L('');
  L('=== investigateMatchingFix 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// 未一致行の4群分類調査。読み取り専用
// ──────────────────────────────────────────────────────────
function investigateUnmatched() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateUnmatched ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmEntries = _npnBuildPmEntries(invSS);

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_NAME     = _npnFindCol(headers, ['商品名','productname','product_name','商品名称','itemname']);
  var CI_ORDER    = _npnFindCol(headers, ['オーダーID','orderid','order_id','注文ID','受注ID']);
  var CI_QTY      = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_PRICE    = _npnFindCol(headers, ['単価','unitprice','unit_price','price']);
  var CI_SUBTOTAL = _npnFindCol(headers, ['小計','subtotal','sub_total']);
  if (CI_NAME < 0) CI_NAME = 4;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  // 分類パターン
  var PAT_BGRADE   = /\[B grade\]/i;
  var PAT_SHIPPING = /^(shipping|customs duties|mpf|ddp handling fee|merchandise processing fee|discount|special discount)\b/i;
  var PAT_SINGLE   = /\b(single card|singles?|bulk|ar card|sr card|sar card|bulk ar|bulk sar|bulk sr|ar bulk|sar bulk|ar.*bulk|bulk.*ar|singles.*bulk|ar duplicate|rr duplicate)\b/i;

  // 未一致行を収集・分類
  var g1 = [], g2 = [], g3 = [], g4 = [];

  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!name) return;
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) return; // 一致済みはスキップ

    var orderId  = CI_ORDER    >= 0 ? String(row[CI_ORDER]    || '').trim() : '?';
    var qty      = CI_QTY      >= 0 ? (Number(row[CI_QTY])    || 0)         : 0;
    var price    = CI_PRICE    >= 0 ? (Number(row[CI_PRICE])   || 0)         : 0;
    var subtotal = CI_SUBTOTAL >= 0 ? (Number(row[CI_SUBTOTAL])|| 0)         : 0;

    var rec = { name: name, orderId: orderId, qty: qty, price: price, subtotal: subtotal };

    if (PAT_BGRADE.test(name)) {
      g1.push(rec);
    } else if (PAT_SHIPPING.test(name)) {
      g4.push(rec);
    } else if (PAT_SINGLE.test(name)) {
      g2.push(rec);
    } else {
      g3.push(rec);
    }
  });

  // ヘルパー: レコード配列をユニーク名でまとめる
  function groupByName(recs) {
    var map = {};
    recs.forEach(function(r) {
      if (!map[r.name]) map[r.name] = { name: r.name, count: 0, qtys: [], prices: [], orderIds: [] };
      map[r.name].count++;
      if (r.qty   ) map[r.name].qtys.push(r.qty);
      if (r.price ) map[r.name].prices.push(r.price);
      if (r.orderId && map[r.name].orderIds.indexOf(r.orderId) < 0) map[r.name].orderIds.push(r.orderId);
    });
    return Object.keys(map).sort().map(function(k){ return map[k]; });
  }
  function rangeStr(arr) {
    if (!arr.length) return '-';
    var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr);
    return mn === mx ? String(mn) : mn + '〜' + mx;
  }

  var total = g1.length + g2.length + g3.length + g4.length;

  // ── 群1: [B grade] 単票カード ──
  L('');
  L('════════════════════════════════════');
  L('■ 群1: [B grade] 単票カード  (' + g1.length + '件)');
  L('════════════════════════════════════');
  var g1u = groupByName(g1);
  g1u.forEach(function(u) {
    L('  [' + u.count + '件] 単価=' + rangeStr(u.prices) + '  orders=' + u.orderIds.join(','));
    L('    ' + u.name);
  });

  // ── 群2: シングル・バルク系 ──
  L('');
  L('════════════════════════════════════');
  L('■ 群2: シングル・バルク系  (' + g2.length + '件)');
  L('════════════════════════════════════');
  var g2u = groupByName(g2);
  g2u.forEach(function(u) {
    L('  [' + u.count + '件] 数量=' + rangeStr(u.qtys) + '  単価=' + rangeStr(u.prices));
    L('    ' + u.name);
  });

  // ── 群3: 未登録の箱物・その他商品 ──
  L('');
  L('════════════════════════════════════');
  L('■ 群3: 未登録の箱物・その他商品  (' + g3.length + '件)');
  L('════════════════════════════════════');
  var g3u = groupByName(g3);
  g3u.forEach(function(u) {
    // カテゴリ推定
    var cat = 'pokemon';
    if (/weiss|schwarz/i.test(u.name)) cat = 'weiss';
    else if (/bandai|pokemon kids/i.test(u.name)) cat = 'bandai/figure';
    else if (/takara|poke.?nade/i.test(u.name)) cat = 'bandai/toy';
    else if (/dragon ball/i.test(u.name)) cat = 'dragonball';
    else if (/mega premium/i.test(u.name)) cat = 'pokemon/PTB';
    else if (/promo/i.test(u.name)) cat = 'pokemon/promo';
    else if (/retro/i.test(u.name)) cat = 'pokemon/retro';
    L('  [' + u.count + '件] 単価=' + rangeStr(u.prices) + '  cat=' + cat + '  orders=' + u.orderIds.join(','));
    L('    ' + u.name);
  });

  // ── 群4: 商品でない行 ──
  L('');
  L('════════════════════════════════════');
  L('■ 群4: 商品でない行（手数料・送料・割引）  (' + g4.length + '件)');
  L('════════════════════════════════════');
  var g4u = groupByName(g4);
  g4u.forEach(function(u) {
    L('  [' + u.count + '件] 金額=' + rangeStr(u.prices.concat(u.qtys))
      + '  orders=' + u.orderIds.join(','));
    L('    ' + u.name);
  });

  // ── 合計確認 ──
  L('');
  L('════════════════════════════════════');
  L('[合計確認]');
  L('  群1(B grade):   ' + g1.length + '件');
  L('  群2(singles):   ' + g2.length + '件');
  L('  群3(未登録商品): ' + g3.length + '件');
  L('  群4(非商品行):   ' + g4.length + '件');
  L('  合計:           ' + total + '件  (未一致全件数と一致すること)');

  L('');
  L('=== investigateUnmatched 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// 判定調査: MegaPTB日付 + Bgrade販売形態
// ──────────────────────────────────────────────────────────
function investigateOrderDetails() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateOrderDetails ===');

  var crmSS;
  try { crmSS = getSpreadsheet(); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  // ── 共通: オーダー管理シート読み込み ──
  var omSh = crmSS.getSheetByName('オーダー管理');
  var omNumCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omNumCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var omData    = omSh.getLastRow() > 1 ? omSh.getRange(2, 1, omSh.getLastRow() - 1, omNumCols).getValues() : [];
  var OCI_ID    = _npnFindCol(omHeaders, ['オーダーID','orderid','order_id','受注ID']);
  var OCI_CUST  = _npnFindCol(omHeaders, ['顧客ID','customerid','customer_id']);

  // ── 共通: オーダー明細シート読み込み ──
  var olSh    = crmSS.getSheetByName('オーダー明細');
  var olNumCols = olSh.getLastColumn();
  var olHeaders = olSh.getRange(1, 1, 1, olNumCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var olData    = olSh.getLastRow() > 1 ? olSh.getRange(2, 1, olSh.getLastRow() - 1, olNumCols).getValues() : [];
  var CI_ORDER  = _npnFindCol(olHeaders, ['オーダーID','orderid','order_id','受注ID']);
  var CI_NAME   = _npnFindCol(olHeaders, ['商品名','productname','product_name']);
  var CI_QTY    = _npnFindCol(olHeaders, ['数量','qty','quantity']);
  var CI_PRICE  = _npnFindCol(olHeaders, ['単価','unitprice','unit_price','price']);
  var CI_SUB    = _npnFindCol(olHeaders, ['小計','subtotal','sub_total']);
  if (CI_NAME  < 0) CI_NAME  = 4;
  if (CI_ORDER < 0) CI_ORDER = 1;

  // ─────────────────────────────────────────
  // [A] OD-00064 / OD-00067 の全フィールド
  // ─────────────────────────────────────────
  L('');
  L('════════════════════════════════════');
  L('[A] オーダー管理: OD-00064 / OD-00067');
  L('════════════════════════════════════');
  var targetOrders = ['OD-00064', 'OD-00067'];
  targetOrders.forEach(function(tid) {
    var found = false;
    omData.forEach(function(row) {
      var oid = OCI_ID >= 0 ? String(row[OCI_ID] || '').trim() : '';
      if (oid !== tid) return;
      found = true;
      L(tid + ' 全フィールド:');
      omHeaders.forEach(function(h, i) {
        var v = row[i];
        var vs = (v instanceof Date) ? v.toISOString().slice(0, 10) : String(v === null || v === undefined ? '' : v).trim();
        if (vs) L('  [' + h + ']: ' + vs);
      });
    });
    if (!found) L(tid + ': オーダー管理に見つかりません');
  });

  // ─────────────────────────────────────────
  // [B] B grade 84件の数量分布 + オーダー別集計
  // ─────────────────────────────────────────
  L('');
  L('════════════════════════════════════');
  L('[B] [B grade] 84件 詳細分析');
  L('════════════════════════════════════');

  var PAT_BGRADE = /\[B grade\]/i;
  var bgRows = [];
  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!PAT_BGRADE.test(name)) return;
    var orderId = CI_ORDER >= 0 ? String(row[CI_ORDER] || '').trim() : '?';
    var qty     = CI_QTY   >= 0 ? (Number(row[CI_QTY])  || 0) : 0;
    var price   = CI_PRICE >= 0 ? (Number(row[CI_PRICE]) || 0) : 0;
    var sub     = CI_SUB   >= 0 ? (Number(row[CI_SUB])   || 0) : 0;
    bgRows.push({ name: name, orderId: orderId, qty: qty, price: price, sub: sub });
  });

  // 数量分布
  var qtyFreq = {};
  bgRows.forEach(function(r) {
    qtyFreq[r.qty] = (qtyFreq[r.qty] || 0) + 1;
  });
  L('[B-1] 数量分布 (数量値: 件数)');
  Object.keys(qtyFreq).sort(function(a,b){ return Number(a)-Number(b); }).forEach(function(q) {
    L('  数量=' + q + ': ' + qtyFreq[q] + '件');
  });

  // オーダー別集計
  L('');
  L('[B-2] オーダー別集計 (OD-00154〜00158)');
  var bgOrders = ['OD-00154','OD-00155','OD-00156','OD-00157','OD-00158'];
  bgOrders.forEach(function(oid) {
    var rows = bgRows.filter(function(r){ return r.orderId === oid; });
    var totalSub = rows.reduce(function(s,r){ return s + r.sub; }, 0);
    var totalQty = rows.reduce(function(s,r){ return s + r.qty; }, 0);
    // 顧客ID取得
    var custId = '?';
    omData.forEach(function(row) {
      var id = OCI_ID >= 0 ? String(row[OCI_ID]||'').trim() : '';
      if (id === oid && OCI_CUST >= 0) custId = String(row[OCI_CUST]||'').trim();
    });
    // オーダー管理の日付も取得
    var orderDate = '', invoiceDate = '';
    omData.forEach(function(row) {
      var id = OCI_ID >= 0 ? String(row[OCI_ID]||'').trim() : '';
      if (id !== oid) return;
      var OCI_ODATE = _npnFindCol(omHeaders, ['受注日','orderdate','order_date']);
      var OCI_IDATE = _npnFindCol(omHeaders, ['請求書発行日','invoicedate','invoice_date']);
      if (OCI_ODATE >= 0) {
        var v = row[OCI_ODATE];
        orderDate = (v instanceof Date) ? v.toISOString().slice(0,10) : String(v||'');
      }
      if (OCI_IDATE >= 0) {
        var v2 = row[OCI_IDATE];
        invoiceDate = (v2 instanceof Date) ? v2.toISOString().slice(0,10) : String(v2||'');
      }
    });
    L('  ' + oid + ' 顧客=' + custId + ' 受注日=' + orderDate + ' 請求書=' + invoiceDate);
    L('    明細件数=' + rows.length + '  総数量=' + totalQty + '  小計合計=' + totalSub.toLocaleString());

    // 単価別件数（同一単価のグループ）
    var priceFreq = {};
    rows.forEach(function(r){ priceFreq[r.price] = (priceFreq[r.price]||0) + 1; });
    var priceKeys = Object.keys(priceFreq).sort(function(a,b){ return Number(b)-Number(a); });
    L('    単価分布: ' + priceKeys.map(function(p){ return p+'円×'+priceFreq[p]+'件'; }).join(', '));

    // 単価範囲
    var prices = rows.map(function(r){ return r.price; });
    L('    単価範囲: ' + Math.min.apply(null,prices) + '〜' + Math.max.apply(null,prices) + '円');
  });

  // ─────────────────────────────────────────
  // [C] B grade: 全84件の商品名・単価・数量リスト（判断材料として全件出力）
  // ─────────────────────────────────────────
  L('');
  L('[B-3] 全84件リスト（オーダー順）');
  bgOrders.forEach(function(oid) {
    var rows = bgRows.filter(function(r){ return r.orderId === oid; });
    L('  --- ' + oid + ' (' + rows.length + '件) ---');
    rows.forEach(function(r) {
      L('    qty=' + r.qty + ' 単価=' + r.price + '  ' + r.name);
    });
  });

  L('');
  L('=== investigateOrderDetails 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// バルク・シングル系既存登録確認。読み取り専用
// ──────────────────────────────────────────────────────────
function investigateBulkSinglePm() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateBulkSinglePm ===');

  var invSS;
  try { invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  // ヘッダー行取得
  var hdRow = pmSh.getRange(1, 1, 1, 20).getValues()[0].map(function(h){ return String(h).trim(); });

  // 列インデックス（0-based）
  var CI_ID  = 0;   // product_id
  var CI_CAT = 1;   // Category（idx1と仮定: ヘッダー確認）
  var CI_JA  = 3;   // Japanese Title
  var CI_EN  = 4;   // English Title
  var CI_KW  = 11;  // Search Keywords
  var CI_RO  = 15;  // REQUIRED_OUTPUT_VALUE
  var CI_RS  = 13;  // Related Series

  // ── [0] ヘッダー確認 ──
  L('');
  L('[0] 商品マスタ ヘッダー行（idx0〜19）');
  hdRow.forEach(function(h, i) { if (h) L('  idx' + i + ': ' + h); });

  // ── [1] PM0001〜PM0030 全列出力 ──
  L('');
  L('════════════════════════════════════');
  L('[1] PM0001〜PM0030 全件 (7列)');
  L('════════════════════════════════════');
  L('product_id | Category | JA Title | EN Title | Search Keywords | REQUIRED_OUTPUT_VALUE | Related Series');
  pmRaw.forEach(function(r) {
    var id = String(r[CI_ID] || '').trim();
    if (!id) return;
    var num = parseInt(id.replace(/[^0-9]/g, ''), 10);
    if (num < 1 || num > 30) return;
    L(id
      + ' | ' + String(r[CI_CAT] || '').trim()
      + ' | ' + String(r[CI_JA]  || '').trim()
      + ' | ' + String(r[CI_EN]  || '').trim()
      + ' | ' + String(r[CI_KW]  || '').trim()
      + ' | ' + String(r[CI_RO]  || '').trim()
      + ' | ' + String(r[CI_RS]  || '').trim()
    );
  });

  // ── [2] キーワード検索（全228件） ──
  L('');
  L('════════════════════════════════════');
  L('[2] キーワードマッチ全件 (bulk/duplicate/single/card/バルク/まとめ/ダブり/重複/AR/SR/SAR/RR/プロモ/promo/レトロ/retro)');
  L('════════════════════════════════════');

  var KW_PATS = [
    /\bbulk\b/i, /\bduplicate\b/i, /\bsingle\b/i,
    /\bcard\b/i, /\bpromo\b/i, /\bretro\b/i,
    /\bAR\b/, /\bSR\b/, /\bSAR\b/, /\bRR\b/,
    /バルク/, /まとめ/, /ダブり/, /重複/, /プロモ/, /レトロ/
  ];

  function kwHit(r) {
    var hay = [r[CI_ID], r[CI_CAT], r[CI_JA], r[CI_EN], r[CI_KW], r[CI_RO], r[CI_RS]]
      .map(function(v){ return String(v||''); }).join(' ');
    return KW_PATS.some(function(p){ return p.test(hay); });
  }

  var hits = [];
  pmRaw.forEach(function(r) {
    var id = String(r[CI_ID] || '').trim();
    if (!id || !kwHit(r)) return;
    hits.push(r);
  });

  L('ヒット件数: ' + hits.length);
  L('');
  hits.forEach(function(r) {
    var id  = String(r[CI_ID]  || '').trim();
    var cat = String(r[CI_CAT] || '').trim();
    var ja  = String(r[CI_JA]  || '').trim();
    var en  = String(r[CI_EN]  || '').trim();
    var kw  = String(r[CI_KW]  || '').trim();
    var ro  = String(r[CI_RO]  || '').trim();
    var rs  = String(r[CI_RS]  || '').trim();
    L(id + ' | cat=' + cat + ' | JA=' + ja + ' | EN=' + en);
    if (kw) L('       KW=' + kw);
    if (ro) L('       RO=' + ro);
    if (rs) L('       RS=' + rs);
  });

  // ── [3] 候補マッピング表 ──
  L('');
  L('════════════════════════════════════');
  L('[3] 候補マッピング表（自動確定なし）');
  L('════════════════════════════════════');

  // 候補リスト（CRM商品名 → 候補PM-ID の手掛かり）
  var candidates = [
    // 群2: バルク系
    { crmName: 'AR Duplicate Bulk Set (100 pieces',           count: 3,  hint: 'PM0010/PM0011 あたりのARバルク系に既存登録がある可能性' },
    { crmName: 'Pokemon Card AR Bulk (Random Mix, 100 cards)', count: 1,  hint: '同上' },
    { crmName: 'Pokemon Card AR Bulk (Random Mix, 50 cards)',  count: 1,  hint: '同上' },
    { crmName: 'Pokemon Card AR Duplicate Bulk Set (50 pieces)',count: 1,  hint: 'PM0010/PM0011' },
    { crmName: 'Pokemon Card Singles – Bulk AR (x100)',        count: 2,  hint: 'PM0010/PM0011' },
    { crmName: 'Pokemon Card Singles – Bulk AR (x150)',        count: 1,  hint: 'PM0010/PM0011 (数量違い)' },
    { crmName: 'Pokemon Card Singles – Bulk SAR (x100)',       count: 1,  hint: 'PM0006?' },
    { crmName: 'Pokemon Card Single card AR',                  count: 3,  hint: 'PM0010/PM0011 (1枚単位)' },
    { crmName: 'Pokemon Card SR card',                         count: 2,  hint: 'SR単票: PMに登録なければ新規' },
    { crmName: 'Pokemon Card Single Card (SR Rare)',            count: 1,  hint: '同上' },
    { crmName: 'Pokemon card [BULK] SAR duplicate bulk set',   count: 1,  hint: 'PM0006?  SARバルクセット' },
    { crmName: 'Pokemon card Retro card bulk (451cards)',       count: 1,  hint: 'Retro系PM候補' },
    // 群3: プロモ・特殊
    { crmName: 'Pokemon Card Pokemon card Pikachu McDonald\'s promo card', count: 7, hint: 'プロモ系PM候補' },
    { crmName: 'Pokemon card Pikachu McDonald\'s promo card',  count: 4,  hint: 'プロモ系PM候補（表記違い）' },
    { crmName: 'Pokemon card Retro card',                      count: 6,  hint: 'Retro系PM候補' },
    { crmName: 'Pokemon Card Victini red promo',               count: 1,  hint: 'プロモ単票' },
    // 群1: B grade
    { crmName: '[B grade] 84件計 (OD-00154〜00158)',           count: 84, hint: 'Bグレードバルクセット専用PM: 新規登録要否を確認' }
  ];

  candidates.forEach(function(c) {
    L('CRM: "' + c.crmName + '" ×' + c.count + '件');
    L('  候補: ' + c.hint);

    // hits の中から関連しそうなPMを自動抽出（キーワード照合）
    var cLow = c.crmName.toLowerCase();
    var related = hits.filter(function(r) {
      var en = String(r[CI_EN] || '').toLowerCase();
      var ja = String(r[CI_JA] || '').toLowerCase();
      var kw = String(r[CI_KW] || '').toLowerCase();
      // 共通トークンを確認
      var tokens = cLow.split(/[\s\-\/,()]+/).filter(function(t){ return t.length >= 3; });
      return tokens.some(function(t){
        return en.indexOf(t) >= 0 || ja.indexOf(t) >= 0 || kw.indexOf(t) >= 0;
      });
    });
    if (related.length > 0) {
      related.forEach(function(r) {
        L('  → PM候補: ' + String(r[CI_ID]||'').trim()
          + ' | ' + String(r[CI_EN]||'').trim()
          + ' | ' + String(r[CI_JA]||'').trim());
      });
    } else {
      L('  → 既存PMに合致なし（新規登録が必要な可能性）');
    }
    L('');
  });

  L('=== investigateBulkSinglePm 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// STEP 1: PM0178 が CRM名 "McDonald's promo" にマッチしない原因の特定
// ──────────────────────────────────────────────────────────
function investigatePM0178Match() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  // 文字コードを16進で表示するヘルパー
  function charDump(s) {
    var r = '';
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      r += s[i] + '(U+' + ('0000' + cp.toString(16).toUpperCase()).slice(-4) + ')';
    }
    return r;
  }
  // アポストロフィ系文字の前後を抽出
  function apoDump(s) {
    var apos = [0x0027, 0x2019, 0x0060, 0x00B4, 0xFF07, 0x2018];
    for (var i = 0; i < s.length; i++) {
      if (apos.indexOf(s.charCodeAt(i)) >= 0) {
        var start = Math.max(0, i - 4);
        var end   = Math.min(s.length, i + 5);
        return charDump(s.slice(start, end)) + ' (pos=' + i + ')';
      }
    }
    return '(アポストロフィ系文字なし)';
  }

  L('=== investigatePM0178Match ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  // ── [A] PM0178 の生フィールド値 ──
  L('');
  L('════════════════════════════════════');
  L('[A] PM0178 生フィールド（文字コード付き）');
  L('════════════════════════════════════');
  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  var pm178 = null;
  pmRaw.forEach(function(r) { if (String(r[0]||'').trim() === 'PM0178') pm178 = r; });

  if (!pm178) { L('[ERROR] PM0178 が見つかりません'); return out.join('\n'); }

  var en178 = String(pm178[4]  || '').trim();
  var kw178 = String(pm178[11] || '').trim();
  var ro178 = String(pm178[15] || '').trim();

  L('EN raw: "' + en178 + '"');
  L('EN apo: ' + apoDump(en178));
  L('EN charDump: ' + charDump(en178));
  L('');
  L('KW raw: "' + kw178 + '"');
  L('RO raw: "' + ro178 + '"');
  L('');
  L('EN _v3n: "' + _v3n(en178) + '"');
  L('EN _v3b: "' + _v3b(en178) + '"');

  // ── [B] CRM側 "McDonald" を含む全商品名（生値・文字コード付き）──
  L('');
  L('════════════════════════════════════');
  L('[B] CRM明細 "McDonald" 含む行（生値・文字コード）');
  L('════════════════════════════════════');
  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_NAME  = _npnFindCol(headers, ['商品名','productname','product_name']);
  if (CI_NAME < 0) CI_NAME = 4;
  var olData  = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  var seen = {};
  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '');
    if (name.toLowerCase().indexOf('mcdonald') < 0 || seen[name]) return;
    seen[name] = true;
    L('');
    L('CRM raw: "' + name + '"');
    L('CRM apo: ' + apoDump(name));
    L('CRM _v3n: "' + _v3n(name) + '"');
    L('CRM _v3b: "' + _v3b(name) + '"');
  });

  // ── [C] 照合シミュレーション ──
  L('');
  L('════════════════════════════════════');
  L('[C] 照合シミュレーション（Phase 0 / 1）');
  L('════════════════════════════════════');
  var en178n  = _v3n(en178);
  var pb178   = _v3b(en178);

  Object.keys(seen).forEach(function(crmName) {
    var cn   = _v3n(crmName);
    var cnNb = cn.replace(/\([^)]*\)/g,' ').replace(/\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
    var cnQ  = cn.replace(/\(([^)]*)\)/g,' $1 ').replace(/\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
    var cb   = _v3b(crmName);

    // アポストロフィ種別
    var apoEN  = en178.indexOf('\u2019') >= 0 ? 'U+2019 curly'
               : en178.indexOf('\u0027') >= 0 ? 'U+0027 straight' : 'none';
    var apoCRM = crmName.indexOf('\u2019') >= 0 ? 'U+2019 curly'
               : crmName.indexOf('\u0027') >= 0 ? 'U+0027 straight' : 'none';

    L('対象CRM: "' + crmName + '"');
    L('  apostrophe → PM0178:' + apoEN + '  CRM:' + apoCRM);
    L('  PM0178 directNorm(EN): "' + en178n + '"');
    L('  Phase0 cn.indexOf  = ' + cn.indexOf(en178n));
    L('  Phase0 cnNb.indexOf= ' + cnNb.indexOf(en178n));
    L('  Phase0 cnQ.indexOf = ' + cnQ.indexOf(en178n));
    L('  PM0178 base(pb178) : "' + pb178 + '"');
    L('  CRM base(cb)       : "' + cb + '"');
    L('  Phase1 exact       = ' + (cb === pb178));
    L('  Phase1 cb⊃pb178    = ' + cb.indexOf(pb178));
    L('  Phase1 pb178⊃cb    = ' + pb178.indexOf(cb));
    L('');
  });

  // ── [D] アポストロフィ正規化を加えた修正案の検証 ──
  L('');
  L('════════════════════════════════════');
  L('[D] 修正案: _v3n にアポストロフィ統一を追加した場合');
  L('════════════════════════════════════');
  // U+2018/2019/201A/201B/02BC/00B4/FF07 → U+0027 に統一
  function v3nPlus(s) {
    return _v3fw(String(s || ''))
      .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'e')
      .replace(/[\u2018\u2019\u201A\u201B\u02BC\u00B4\uFF07]/g, "'")
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  var en178p = v3nPlus(en178);
  L('PM0178 EN v3nPlus: "' + en178p + '"');
  Object.keys(seen).forEach(function(crmName) {
    var cnp = v3nPlus(crmName);
    L('CRM v3nPlus: "' + cnp + '"');
    L('  indexOf(en178p) = ' + cnp.indexOf(en178p) + '  → ' + (cnp.indexOf(en178p) >= 0 ? 'MATCH' : 'miss'));
    L('');
  });

  L('=== investigatePM0178Match 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// STEP 2 DRY RUN + STEP 3 再照合シミュレーション
// ──────────────────────────────────────────────────────────
function investigateStep23DryRun() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateStep23DryRun ===');

  var crmSS, invSS;
  try { crmSS = getSpreadsheet(); invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmEntries = _npnBuildPmEntries(invSS);

  // ── [A] CRM 全商品名のbase走査: ASCII外文字を含むbaseを全件報告 ──
  L('');
  L('════════════════════════════════════');
  L('[A] 正規化後の base に ASCII外文字を含む行（全件）');
  L('════════════════════════════════════');

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_NAME  = _npnFindCol(headers, ['商品名','productname','product_name']);
  var CI_ORDER = _npnFindCol(headers, ['オーダーID','orderid','order_id','受注ID']);
  if (CI_NAME < 0) CI_NAME = 4;
  var olData  = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  function hasNonAscii(s) {
    for (var i = 0; i < s.length; i++) { if (s.charCodeAt(i) > 127) return true; }
    return false;
  }
  function dumpNonAscii(s) {
    var r = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c > 127) r.push('"' + s[i] + '"(U+' + ('0000'+c.toString(16).toUpperCase()).slice(-4) + ')');
    }
    return r.join(', ');
  }

  var nonAsciiSeen = {};
  var nonAsciiCount = 0;
  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!name) return;
    var b = _v3b(name);
    if (!hasNonAscii(b) || nonAsciiSeen[name]) return;
    nonAsciiSeen[name] = true;
    nonAsciiCount++;
    var oid = CI_ORDER >= 0 ? String(row[CI_ORDER]||'').trim() : '?';
    L('  base="' + b + '"');
    L('    chars: ' + dumpNonAscii(b));
    L('    CRM: "' + name + '"  [' + oid + ']');
  });
  L('');
  L('ASCII外文字を含む base 種類数: ' + nonAsciiCount);

  // ── [B] STEP 2 DRY RUN: PM0229 追加行の全20列表示 ──
  L('');
  L('════════════════════════════════════');
  L('[B] STEP 2 DRY RUN: PM0229 追加行（書き込みなし）');
  L('════════════════════════════════════');

  // 既存PM番号の確認
  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  var hdRow = pmSh.getRange(1, 1, 1, 20).getValues()[0].map(function(h){ return String(h).trim(); });
  var existIds = pmRaw.map(function(r){ return String(r[0]||'').trim(); }).filter(Boolean);

  L('既存PM件数: ' + existIds.length + '件  (228であること)');
  L('PM0229 既存有無: ' + (existIds.indexOf('PM0229') >= 0 ? '【重複あり】' : 'なし（OK）'));
  L('末尾PM-ID: ' + existIds[existIds.length - 1]);
  L('');

  // 追加予定行の20列
  var newRow = [
    'PM0229',      // idx0: product_id
    'Pokemon',     // idx1: Category
    '',            // idx2: Mark
    'レトロカード バルク', // idx3: Japanese Title
    'Retro card bulk',   // idx4: English Title
    '',            // idx5: Boxes per Case
    '',            // idx6: Packs per Box
    '',            // idx7: VOLUME WEIGHT
    '',            // idx8: Box重量
    '',            // idx9: Case重量
    '',            // idx10: Release Date
    'retro card, retro, B grade, Bグレード, レトロ, bulk', // idx11: Search Keywords
    '',            // idx12: Exclude Keywords
    '',            // idx13: Related Series
    '',            // idx14: カテゴリ分類
    'Retro card bulk',   // idx15: REQUIRED_OUTPUT_VALUE
    '',            // idx16: MOQ
    '',            // idx17: 品目
    '',            // idx18: HSコード
    ''             // idx19: 素材
  ];
  L('追加行（20列）:');
  hdRow.forEach(function(h, i) {
    L('  idx' + i + ' [' + h + ']: "' + (newRow[i] || '') + '"');
  });

  // ── [C] STEP 3 再照合シミュレーション ──
  L('');
  L('════════════════════════════════════');
  L('[C] STEP 3 再照合シミュレーション（書き込みなし）');
  L('════════════════════════════════════');
  L('使用ルール:');
  L('  A) SR (no SAR/AR) → PM0005');
  L('  B) SAR → PM0006');
  L('  C) AR + no-duplicate → PM0010');
  L('  D) AR + (duplicate/random mix/bulk/single) → PM0011');
  L('  E) McDonald\'s promo → PM0178  (apo修正で自動マッチ)');
  L('  F) retro / [B grade] → PM0229');
  L('  G) 上記以外 → _v3match (PM0229含む新pmEntries)');

  // PM0229 を pmEntries に追加（シミュレーション用）
  var kw229 = newRow[11].split(',').map(function(k){ return k.trim(); });
  var pm229entry = {
    id: 'PM0229',
    directNorms: [
      { v: _v3n(newRow[4]), label: 'EnglishTitle' },
      { v: _v3n(newRow[3]), label: 'JapaneseTitle' },
      { v: _v3n(newRow[15]), label: 'RequiredOutput' }
    ].filter(function(x){ return x.v.length >= 4; }),
    kwNorms: kw229.map(function(k){ return { v: _v3n(k), raw: k }; }).filter(function(x){ return x.v.length >= 3; }),
    bases: (function(){
      var fields = [newRow[4], newRow[3], newRow[15]].concat(kw229);
      var seen = {};
      return fields.map(_v3b).filter(function(b){
        if (!b || b.length < 3 || seen[b]) return false;
        seen[b] = true; return true;
      });
    })()
  };
  var simEntries = pmEntries.concat([pm229entry]);

  // 分類ルール（pre-pass）
  function classifyByRule(name) {
    var n = _v3n(name);
    // F: retro / B grade
    if (/retro/i.test(name) || /\[b grade\]/i.test(n)) return 'PM0229';
    // B: SAR
    if (/\bsar\b/.test(n)) return 'PM0006';
    // A: SR (SARでなくARでもない)
    if (/\bsr\b/.test(n) && !/\bsar\b/.test(n) && !/\bar\b/.test(n)) return 'PM0005';
    // C: AR no-duplicate
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /no.?dup/i.test(n)) return 'PM0010';
    // D: AR duplicate/random mix/bulk/single (no-dup明記なし)
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) &&
        (/duplicate|random.?mix|bulk|singles?/i.test(n))) return 'PM0011';
    return null;
  }

  var confirmed = 0, ruleHit = {}, autoHit = {}, stillUnmatched = [];
  var pmBreakdown = {};

  olData.forEach(function(row) {
    var name = String(row[CI_NAME] || '').trim();
    if (!name) return;

    // まず _v3match で確認
    var res = _v3match(name, simEntries);
    if (res.matched && !res.fuzzy) {
      confirmed++;
      pmBreakdown[res.pmId] = (pmBreakdown[res.pmId] || 0) + 1;
      return;
    }

    // pre-pass classification
    var ruleId = classifyByRule(name);
    if (ruleId) {
      confirmed++;
      ruleHit[ruleId] = (ruleHit[ruleId] || 0) + 1;
      pmBreakdown[ruleId] = (pmBreakdown[ruleId] || 0) + 1;
      return;
    }

    stillUnmatched.push(name);
  });

  L('');
  L('確定一致: ' + confirmed + '件  旧=443  差=' + (confirmed - 443));

  L('');
  L('[分類ルール適用内訳]');
  Object.keys(ruleHit).sort().forEach(function(id) {
    L('  ' + id + ' (rule): ' + ruleHit[id] + '件');
  });

  L('');
  L('[PM別合計 上位]');
  var pmKeys = Object.keys(pmBreakdown).sort(function(a,b){
    return pmBreakdown[b] - pmBreakdown[a];
  });
  pmKeys.slice(0, 20).forEach(function(id) {
    L('  ' + id + ': ' + pmBreakdown[id] + '件');
  });

  L('');
  L('[なお未一致: ' + stillUnmatched.length + '件]');
  var uf = {};
  stillUnmatched.forEach(function(n){ uf[n] = (uf[n]||0)+1; });
  Object.keys(uf).sort(function(a,b){ return uf[b]-uf[a]; }).forEach(function(n) {
    L('  ' + uf[n] + '件  "' + n + '"');
  });

  L('');
  L('=== investigateStep23DryRun 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// STEP 2 実行: PM0229「Retro card bulk」を商品マスタに追加
// ──────────────────────────────────────────────────────────
function executeStep2PM0229() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== executeStep2PM0229 ===');

  var invSS;
  try { invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmSh = invSS.getSheetByName('商品マスタ');

  // 書き込み前スナップショット
  var beforeLastRow = pmSh.getLastRow();
  var beforeData    = pmSh.getRange(2, 1, beforeLastRow - 1, 20).getValues();
  var beforeIds     = beforeData.map(function(r){ return String(r[0]||'').trim(); }).filter(Boolean);
  L('書き込み前: データ行数=' + beforeData.length + '  PM件数=' + beforeIds.length);
  L('末尾PM-ID: ' + beforeIds[beforeIds.length - 1]);
  if (beforeIds.indexOf('PM0229') >= 0) {
    L('[ERROR] PM0229 が既に存在します。中断します。');
    return out.join('\n');
  }

  // 追加行
  var newRow = [
    'PM0229', 'Pokemon', '', 'レトロカード バルク', 'Retro card bulk',
    '', '', '', '', '',
    '',
    'retro card, retro, B grade, Bグレード, レトロ, bulk',
    '', '', '', 'Retro card bulk',
    '', '', '', ''
  ];

  // 書き込み
  var targetRow = beforeLastRow + 1;
  pmSh.getRange(targetRow, 1, 1, 20).setValues([newRow]);
  SpreadsheetApp.flush();

  // 書き込み後検証
  var afterLastRow = pmSh.getLastRow();
  var afterData    = pmSh.getRange(2, 1, afterLastRow - 1, 20).getValues();
  var afterIds     = afterData.map(function(r){ return String(r[0]||'').trim(); }).filter(Boolean);

  L('');
  L('════════════════════════════════════');
  L('[検証結果]');
  L('════════════════════════════════════');
  L('データ行数: ' + afterData.length + '行  (229であること: ' + (afterData.length === 229 ? 'OK' : 'FAIL') + ')');
  L('PM件数: ' + afterIds.length + '件  (229であること: ' + (afterIds.length === 229 ? 'OK' : 'FAIL') + ')');

  // 既存228行が不変か確認（product_id の並び比較）
  var unchanged = true;
  for (var i = 0; i < beforeIds.length; i++) {
    if (beforeIds[i] !== afterIds[i]) { unchanged = false; break; }
  }
  L('既存228行 product_id 不変: ' + (unchanged ? 'OK' : 'FAIL [' + i + '行目が変化]'));

  // PM0229 の確認
  var found229 = afterData[afterData.length - 1];
  L('追加行(PM0229) 確認:');
  L('  product_id: "' + String(found229[0]||'') + '"  (PM0229であること: ' + (String(found229[0]||'').trim() === 'PM0229' ? 'OK' : 'FAIL') + ')');
  L('  Category: "' + String(found229[1]||'') + '"');
  L('  JA Title: "' + String(found229[3]||'') + '"');
  L('  EN Title: "' + String(found229[4]||'') + '"');
  L('  Keywords: "' + String(found229[11]||'') + '"');
  L('  RO Value: "' + String(found229[15]||'') + '"');

  // PM番号重複チェック
  var idFreq = {};
  afterIds.forEach(function(id){ idFreq[id] = (idFreq[id]||0) + 1; });
  var dups = Object.keys(idFreq).filter(function(id){ return idFreq[id] > 1; });
  L('PM番号重複: ' + (dups.length === 0 ? 'なし OK' : '【重複あり】' + dups.join(',')));

  L('');
  L('=== executeStep2PM0229 完了 ===');
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────
// 群3の9件: 商品マスタ全フィールド再検索 + マッチ失敗原因特定
// ──────────────────────────────────────────────────────────
function investigateGroup3Unmatched() {
  var out = [];
  function L(s) { out.push(String(s)); Logger.log(String(s)); }
  L('=== investigateGroup3Unmatched ===');

  var invSS;
  try { invSS = SpreadsheetApp.openById(INV_BOOK_ID); }
  catch(e) { L('[ERROR] ' + e.message); return out.join('\n'); }

  var pmSh  = invSS.getSheetByName('商品マスタ');
  var pmRaw = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 20).getValues();
  var hdRow = pmSh.getRange(1, 1, 1, 20).getValues()[0].map(function(h){ return String(h).trim(); });
  var pmEntries = _npnBuildPmEntries(invSS);

  // 全PMの全フィールドを1つのテキストに結合して検索するヘルパー
  function searchPm(tokens) {
    // tokens: 小文字の検索語配列、AND条件
    var hits = [];
    pmRaw.forEach(function(r) {
      var id = String(r[0]||'').trim();
      if (!id) return;
      var hay = r.map(function(v){ return String(v||'').toLowerCase(); }).join(' ');
      if (tokens.every(function(t){ return hay.indexOf(t) >= 0; })) {
        hits.push({
          id:  id,
          cat: String(r[1]||'').trim(),
          ja:  String(r[3]||'').trim(),
          en:  String(r[4]||'').trim(),
          kw:  String(r[11]||'').trim(),
          ro:  String(r[15]||'').trim(),
          rs:  String(r[13]||'').trim()
        });
      }
    });
    return hits;
  }

  // _v3match の結果を診断するヘルパー
  function diagnose(crmName) {
    var res = _v3match(crmName, pmEntries);
    var cn  = _v3n(crmName);
    var cb  = _v3b(crmName);
    return {
      matched: res.matched, pmId: res.pmId || null,
      fuzzy: res.fuzzy || false,
      cn: cn, cb: cb
    };
  }

  // 9件の定義（CRM名 / 検索トークン（AND） / 期待PM候補）
  var targets = [
    { crmName: 'Pokemon Card Tohoku Specialty Box',
      tokens: [['tohoku'], ['東北']],
      note: 'PM0182で存在確認済み' },
    { crmName: 'Weiss Schwarz Oshi no Ko Vol. 1 Trial Deck',
      tokens: [['weiss'], ['oshi'], ['推し']],
      note: 'PM0210/0228等で存在確認済み' },
    { crmName: 'Weiss Schwarz Rose Interspecies Reviews Booster',
      tokens: [['weiss'], ['rose'], ['interspecies'], ['ローゼン']],
      note: 'PM0210/0228等で存在確認済み' },
    { crmName: 'Pokemon card Shiny Treasures Box',
      tokens: [['shiny treasure'], ['シャイニー'], ['宝'], ['shiny']],
      note: '' },
    { crmName: 'Pokemon Card Shiny V Box',
      tokens: [['shiny v'], ['シャイニースター'], ['shiny']],
      note: '' },
    { crmName: 'Pokemon Card Victini red promo',
      tokens: [['victini'], ['ビクティニ']],
      note: '' },
    { crmName: 'Bandai Pokemon Kids Mega Mewtwo X & Mega Mewtwo Y',
      tokens: [['mewtwo'], ['ミュウツー'], ['bandai'], ['kids']],
      note: '' },
    { crmName: 'Bandai Pokemon Kids Mega Charizard X & Mega Charizard Y',
      tokens: [['charizard'], ['リザードン'], ['bandai'], ['kids']],
      note: '' },
    { crmName: 'Takara Tomy Poke-nade',
      tokens: [['takara'], ['poke'], ['ポケ'], ['ナデ']],
      note: '' }
  ];

  targets.forEach(function(t) {
    L('');
    L('════════════════════════════════════');
    L('CRM: "' + t.crmName + '"');
    if (t.note) L('  (' + t.note + ')');
    L('════════════════════════════════════');

    // _v3match 結果
    var d = diagnose(t.crmName);
    L('  _v3match: matched=' + d.matched + (d.pmId ? '  pmId=' + d.pmId : '') + (d.fuzzy ? '  [fuzzy]' : ''));
    L('  _v3n: "' + d.cn + '"');
    L('  _v3b: "' + d.cb + '"');

    // 各トークンセットで検索
    var allHits = {};
    t.tokens.forEach(function(toks) {
      var hits = searchPm(toks);
      hits.forEach(function(h) { allHits[h.id] = h; });
    });
    var hitIds = Object.keys(allHits).sort();

    if (hitIds.length === 0) {
      L('  → 商品マスタ全フィールド検索: ヒットなし（未登録）');
    } else {
      L('  → 商品マスタ ヒット ' + hitIds.length + '件:');
      hitIds.forEach(function(id) {
        var h = allHits[id];
        L('    ' + id + ' | cat=' + h.cat);
        L('      JA: "' + h.ja + '"');
        L('      EN: "' + h.en + '"');
        if (h.kw) L('      KW: "' + h.kw + '"');
        if (h.ro) L('      RO: "' + h.ro + '"');
        if (h.rs) L('      RS: "' + h.rs + '"');

        // マッチ失敗原因の分析
        if (!d.matched || d.pmId !== id) {
          var pmEn = _v3n(h.en), pmJa = _v3n(h.ja);
          var pmKws = h.kw.split(',').map(function(k){ return _v3n(k.trim()); }).filter(Boolean);
          var pmBase = _v3b(h.en);

          var reasons = [];
          // Phase 0: directNorm check
          if (d.cn.indexOf(pmEn) < 0 && d.cn.indexOf(pmJa) < 0) {
            reasons.push('Phase0 directNorm miss: cn に "' + pmEn + '" も "' + pmJa + '" も含まれない');
          }
          // KW check
          var kwMiss = pmKws.filter(function(k){ return k.length >= 3 && d.cn.indexOf(k) < 0; });
          if (kwMiss.length === pmKws.length && pmKws.length > 0) {
            reasons.push('Phase0 KW 全て miss: KW="' + h.kw + '"');
          }
          // Phase 1: base check
          if (d.cb !== pmBase && d.cb.indexOf(pmBase) < 0 && pmBase.indexOf(d.cb) < 0) {
            reasons.push('Phase1 base miss: cb="' + d.cb + '" vs pb="' + pmBase + '"');
          }
          if (reasons.length > 0) {
            L('      マッチ失敗原因:');
            reasons.forEach(function(r){ L('        - ' + r); });
          }
        }
      });
    }
  });

  L('');
  L('════════════════════════════════════');
  L('[まとめ]');
  L('════════════════════════════════════');

  L('=== investigateGroup3Unmatched 完了 ===');
  return out.join('\n');
}

// ============================================================
// 商品マスタ カテゴリ分類・Mark・Category 調査（読み取り専用）
// ============================================================
function investigatePMColumns() {
  var out = [];
  function L(s) { out.push(s); }

  L('=== investigatePMColumns ===');

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var data = pmSh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  // 0-based: idx1=Category, idx2=Mark, idx14=カテゴリ分類
  var iCat  = 1;   // Category
  var iMark = 2;   // Mark
  var iKC   = 14;  // カテゴリ分類

  L('総データ行数: ' + rows.length + '件');
  L('');

  // ─── 1. カテゴリ分類（col15, idx14）ユニーク値 ───
  L('════════════════════════════════════');
  L('[1] col15「カテゴリ分類」ユニーク値と件数');
  L('════════════════════════════════════');
  var kcCount = {};
  rows.forEach(function(r) {
    var v = String(r[iKC] || '').trim();
    if (!v) v = '(空欄)';
    kcCount[v] = (kcCount[v] || 0) + 1;
  });
  var kcKeys = Object.keys(kcCount).sort(function(a,b){ return kcCount[b]-kcCount[a]; });
  kcKeys.forEach(function(k) { L('  ' + k + ': ' + kcCount[k] + '件'); });
  L('');

  // ─── 2. Mark（col3, idx2）ユニーク値 ───
  L('════════════════════════════════════');
  L('[2] col3「Mark」ユニーク値と件数');
  L('════════════════════════════════════');
  var markCount = {};
  rows.forEach(function(r) {
    var v = String(r[iMark] || '').trim();
    if (!v) v = '(空欄)';
    markCount[v] = (markCount[v] || 0) + 1;
  });
  var markKeys = Object.keys(markCount).sort(function(a,b){ return markCount[b]-markCount[a]; });
  markKeys.forEach(function(k) { L('  ' + k + ': ' + markCount[k] + '件'); });
  L('');

  // ─── 3. Category × カテゴリ分類 対応 ───
  L('════════════════════════════════════');
  L('[3] Category × カテゴリ分類 クロス集計');
  L('════════════════════════════════════');
  var cross = {};
  rows.forEach(function(r) {
    var cat = String(r[iCat] || '').trim() || '(空欄)';
    var kc  = String(r[iKC]  || '').trim() || '(空欄)';
    if (!cross[cat]) cross[cat] = {};
    cross[cat][kc] = (cross[cat][kc] || 0) + 1;
  });
  var catKeys = Object.keys(cross).sort();
  catKeys.forEach(function(cat) {
    L('  Category="' + cat + '":');
    var kcs = cross[cat];
    Object.keys(kcs).sort().forEach(function(kc) {
      L('    カテゴリ分類="' + kc + '": ' + kcs[kc] + '件');
    });
  });
  L('');

  // ─── 4. フィギュア・グッズ系の商品が既に登録されているか ───
  L('════════════════════════════════════');
  L('[4] フィギュア・グッズ系の既存登録（Category・商品名から推定）');
  L('════════════════════════════════════');
  var figureKws = ['figure','figur','フィギュア','toy','玩具','kids','bandai',
                   'takara','tomy','グッズ','goods','ガジェット','ぬいぐるみ',
                   'plush','ポケモンカード以外','tcg以外','poke-nade','nade',
                   'spray','スプレー'];
  var hits = [];
  rows.forEach(function(r) {
    var pid = String(r[0] || '').trim();
    var cat = String(r[iCat] || '').trim();
    var ja  = String(r[3]  || '').trim();
    var en  = String(r[4]  || '').trim();
    var kc  = String(r[iKC] || '').trim();
    var combined = (cat + ' ' + ja + ' ' + en + ' ' + kc).toLowerCase();
    var matched = figureKws.filter(function(kw){ return combined.indexOf(kw.toLowerCase()) >= 0; });
    if (matched.length > 0) {
      hits.push({ pid: pid, cat: cat, ja: ja, en: en, kc: kc, matched: matched.join(',') });
    }
  });
  if (hits.length === 0) {
    L('  フィギュア・グッズ系の既存登録: なし（0件）');
  } else {
    L('  該当 ' + hits.length + '件:');
    hits.forEach(function(h) {
      L('  ' + h.pid + ' | cat=' + h.cat + ' | KC=' + h.kc);
      L('    JA: "' + h.ja + '"');
      L('    EN: "' + h.en + '"');
      L('    KW hit: ' + h.matched);
    });
  }

  L('');
  L('=== investigatePMColumns 完了 ===');
  return out.join('\n');
}

// ============================================================
// DRY RUN: 大分類/作品/メーカーマスタ新設 + 商品マスタ3列追加
// ============================================================
function dryRunMasterSetup() {
  var out = [];
  function L(s) { out.push(s); }

  L('=== dryRunMasterSetup ===');
  L('※ DRY RUN - 書き込み一切なし');
  L('');

  // ─── マスタ定義 ───
  var DIV = [
    ['div_id','大分類名','説明','有効'],
    ['DIV01','TCG','トレーディングカード','TRUE'],
    ['DIV02','Figure','フィギュア','TRUE'],
    ['DIV03','Goods','グッズ・雑貨','TRUE']
  ];
  var IP = [
    ['ip_id','作品名','別名','有効'],
    ['IP001','Pokemon','ポケモン, ポケットモンスター','TRUE'],
    ['IP002','One Piece','ワンピース','TRUE'],
    ['IP003','Dragon Ball','ドラゴンボール','TRUE'],
    ['IP004','Yu-Gi-Oh','遊戯王','TRUE'],
    ['IP005','Union Arena','ユニオンアリーナ','TRUE'],
    ['IP006','GUNDAM','GUNDUM, ガンダム','TRUE'],
    ['IP007','Weiss Schwarz','Weiss Shwarz, ヴァイスシュヴァルツ','TRUE'],
    ['IP008','Digimon','','TRUE'],
    ['IP009','hololive','','TRUE'],
    ['IP010','LORCANA','','TRUE'],
    ['IP011','Xross Stars','','TRUE']
  ];
  var MK = [
    ['mk_id','メーカー名','別名','有効'],
    ['MK001','The Pokemon Company','ポケモン','TRUE'],
    ['MK002','Bandai','バンダイ','TRUE'],
    ['MK003','Takara Tomy','タカラトミー','TRUE'],
    ['MK004','Bushiroad','ブシロード','TRUE'],
    ['MK005','Konami','コナミ','TRUE']
  ];

  // ─── Category → ip_id / mk_id マッピング ───
  var CAT_IP = {
    'Pokemon':         'IP001',
    'One Piece':       'IP002',
    'Dragon Ball':     'IP003',
    'Yu-Gi-Oh':        'IP004',
    'Union Arena':     'IP005',
    'GUNDUM':          'IP006',
    'Weiss Shwarz':    'IP007',
    'Weiss Shwarz Rose':'IP007'   // ブランドライン → IP007に寄せ
  };
  var CAT_MK = {
    'Pokemon':         'MK001',
    'One Piece':       'MK002',
    'Dragon Ball':     'MK002',
    'GUNDUM':          'MK002',
    'Weiss Shwarz':    'MK004',
    'Weiss Shwarz Rose':'MK004',
    'Yu-Gi-Oh':        'MK005',
    'Union Arena':     'MK004'
  };

  // ─── [1] 大分類マスタ ───
  L('════════════════════════════════════');
  L('[1] 大分類マスタ（新規シート）');
  L('════════════════════════════════════');
  DIV.forEach(function(r){ L('  ' + r.join(' | ')); });
  L('');

  // ─── [2] 作品マスタ ───
  L('════════════════════════════════════');
  L('[2] 作品マスタ（新規シート）');
  L('════════════════════════════════════');
  IP.forEach(function(r){ L('  ' + r.join(' | ')); });
  L('');
  L('  ■ Weiss Shwarz Rose の扱い（提案）:');
  L('    「Weiss Shwarz Rose」はIPではなくBushiroadのブランドライン。');
  L('    → ip_id は IP007 に統一。');
  L('    → Rose区分が必要な場合: 既存 col2「Category」が');
  L('      "Weiss Shwarz" / "Weiss Shwarz Rose" を既に区別しているため');
  L('      追加列不要。IPでフィルタ後 col2 でサブフィルタする。');
  L('    → 別列（例: brand_line）を追加する案は現時点では過剰設計のため却下。');
  L('');

  // ─── [3] メーカーマスタ ───
  L('════════════════════════════════════');
  L('[3] メーカーマスタ（新規シート）');
  L('════════════════════════════════════');
  MK.forEach(function(r){ L('  ' + r.join(' | ')); });
  L('  ※ MK003 Takara Tomy は現行229件に対応商品なし（将来用）');
  L('');

  // ─── [4] 商品マスタ 3列追加（スキーマ定義のみ）───
  L('════════════════════════════════════');
  L('[4] 商品マスタ 3列追加（スキーマ）');
  L('════════════════════════════════════');
  L('  col21（idx20）: 大分類ID  ← DIV01/DIV02/DIV03');
  L('  col22（idx21）: 作品ID    ← IP001〜IP011');
  L('  col23（idx22）: メーカーID ← MK001〜MK005');
  L('  ※ 既存 col1〜col20（idx0〜idx19）は一切変更しない');
  L('');

  // ─── [5] 全229件 割当DRY RUN ───
  L('════════════════════════════════════');
  L('[5] 全229件 割当DRY RUN');
  L('════════════════════════════════════');

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var data = pmSh.getDataRange().getValues();
  var rows = data.slice(1);  // skip header

  var unresolved = [];
  var kcPatch = [];  // PM0229 カテゴリ分類 空欄補完
  var ipCount = {}, mkCount = {}, divCount = {};

  L('  pid      | Category             | div_id | ip_id | mk_id | 備考');
  L('  ' + Array(80).join('-'));

  rows.forEach(function(r) {
    var pid  = String(r[0]  || '').trim();
    var cat  = String(r[1]  || '').trim();
    var kc   = String(r[14] || '').trim();
    var div  = 'DIV01';  // 全件TCG（フィギュア・グッズ0件確認済み）
    var ip   = CAT_IP[cat] || '';
    var mk   = CAT_MK[cat] || '';
    var note = [];

    if (!ip) { note.push('ip未解決'); }
    if (!mk) { note.push('mk未解決'); }
    if (!kc) { note.push('カテゴリ分類空欄→Single補完'); kcPatch.push(pid); }

    divCount[div] = (divCount[div] || 0) + 1;
    if (ip) ipCount[ip] = (ipCount[ip] || 0) + 1;
    if (mk) mkCount[mk] = (mkCount[mk] || 0) + 1;
    if (note.length > 0) unresolved.push({ pid: pid, cat: cat, note: note.join(', ') });

    var catPad = (cat + Array(22).join(' ')).slice(0, 20);
    L('  ' + pid + ' | ' + catPad + ' | ' + div + ' | ' + (ip||'????') + ' | ' + (mk||'?????') + (note.length ? ' | ⚠ ' + note.join(', ') : ''));
  });

  L('');

  // ─── [6] サマリ ───
  L('════════════════════════════════════');
  L('[6] サマリ');
  L('════════════════════════════════════');
  L('  総件数: ' + rows.length + '件');
  L('');
  L('  大分類ID 内訳:');
  Object.keys(divCount).sort().forEach(function(k){ L('    ' + k + ': ' + divCount[k] + '件'); });
  L('');
  L('  作品ID 内訳:');
  Object.keys(ipCount).sort().forEach(function(k){ L('    ' + k + ': ' + ipCount[k] + '件'); });
  L('');
  L('  メーカーID 内訳:');
  Object.keys(mkCount).sort().forEach(function(k){ L('    ' + k + ': ' + mkCount[k] + '件'); });
  L('');

  // ─── [7] 未解決・要確認 ───
  L('════════════════════════════════════');
  L('[7] 未解決・要確認');
  L('════════════════════════════════════');
  if (unresolved.length === 0) {
    L('  未解決: 0件 ✓');
  } else {
    L('  未解決 ' + unresolved.length + '件:');
    unresolved.forEach(function(u){
      L('  ' + u.pid + ' | cat="' + u.cat + '" | ' + u.note);
    });
  }
  L('');

  // ─── [8] カテゴリ分類 空欄補完 ───
  L('════════════════════════════════════');
  L('[8] col15「カテゴリ分類」空欄補完（"Single"に設定）');
  L('════════════════════════════════════');
  if (kcPatch.length === 0) {
    L('  空欄なし（補完不要）');
  } else {
    kcPatch.forEach(function(pid){ L('  ' + pid + ': (空欄) → "Single"'); });
  }
  L('');
  L('  ※ 検証予定: 既存20列不変・229行維持・重複ID0件');
  L('');
  L('=== dryRunMasterSetup 完了 ===');
  return out.join('\n');
}

// ============================================================
// GUNDUM 3件詳細確認（読み取り専用）
// ============================================================
function investigateGundumProducts() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== investigateGundumProducts ===');

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var data = pmSh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  rows.forEach(function(r) {
    var cat = String(r[1] || '').trim();
    if (cat !== 'GUNDUM') return;
    L('');
    L('────────────────────────────────────');
    L('product_id : ' + r[0]);
    L('Category   : ' + r[1]);
    L('Mark       : ' + r[2]);
    L('JA Title   : ' + r[3]);
    L('EN Title   : ' + r[4]);
    L('Release    : ' + r[10]);
    L('Keywords   : ' + r[11]);
    L('カテゴリ分類: ' + r[14]);
    L('RO Value   : ' + r[15]);
  });

  L('');
  L('=== investigateGundumProducts 完了 ===');
  return out.join('\n');
}

// ============================================================
// CONFIRM EXEC: マスタ3新設 + 商品マスタ3列追加 + 全件割当
// ============================================================
function execMasterSetup() {
  var out = [];
  function L(s) { out.push(s); }

  L('=== execMasterSetup ===');

  var CAT_IP = {
    'Pokemon':          'IP001',
    'One Piece':        'IP002',
    'Dragon Ball':      'IP003',
    'Yu-Gi-Oh':         'IP004',
    'Union Arena':      'IP005',
    'GUNDUM':           'IP006',
    'Weiss Shwarz':     'IP007',
    'Weiss Shwarz Rose':'IP007'
  };
  var CAT_MK = {
    'Pokemon':          'MK001',
    'One Piece':        'MK002',
    'Dragon Ball':      'MK002',
    'GUNDUM':           'MK002',
    'Weiss Shwarz':     'MK004',
    'Weiss Shwarz Rose':'MK004',
    'Yu-Gi-Oh':         'MK005',
    'Union Arena':      'MK004'
  };

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);

  // ─── [1] 大分類マスタ ───
  L('[1] 大分類マスタ 作成...');
  var divSh = ss.getSheetByName('大分類マスタ');
  if (!divSh) { divSh = ss.insertSheet('大分類マスタ'); }
  else { divSh.clearContents(); }
  var divData = [
    ['div_id','大分類名','説明','有効'],
    ['DIV01','TCG','トレーディングカード','TRUE'],
    ['DIV02','Figure','フィギュア','TRUE'],
    ['DIV03','Goods','グッズ・雑貨','TRUE']
  ];
  divSh.getRange(1, 1, divData.length, 4).setValues(divData);
  SpreadsheetApp.flush();
  var divCheck = divSh.getDataRange().getValues();
  L('  → 書込後行数: ' + divCheck.length + '行（期待: 4）' + (divCheck.length === 4 ? ' OK' : ' NG'));
  L('');

  // ─── [2] 作品マスタ ───
  L('[2] 作品マスタ 作成...');
  var ipSh = ss.getSheetByName('作品マスタ');
  if (!ipSh) { ipSh = ss.insertSheet('作品マスタ'); }
  else { ipSh.clearContents(); }
  var ipData = [
    ['ip_id','作品名','別名','有効'],
    ['IP001','Pokemon','ポケモン, ポケットモンスター','TRUE'],
    ['IP002','One Piece','ワンピース','TRUE'],
    ['IP003','Dragon Ball','ドラゴンボール','TRUE'],
    ['IP004','Yu-Gi-Oh','遊戯王','TRUE'],
    ['IP005','Union Arena','ユニオンアリーナ','TRUE'],
    ['IP006','GUNDAM','GUNDUM, ガンダム','TRUE'],
    ['IP007','Weiss Schwarz','Weiss Shwarz, ヴァイスシュヴァルツ','TRUE'],
    ['IP008','Digimon','','TRUE'],
    ['IP009','hololive','','TRUE'],
    ['IP010','LORCANA','','TRUE'],
    ['IP011','Xross Stars','','TRUE']
  ];
  ipSh.getRange(1, 1, ipData.length, 4).setValues(ipData);
  SpreadsheetApp.flush();
  var ipCheck = ipSh.getDataRange().getValues();
  L('  → 書込後行数: ' + ipCheck.length + '行（期待: 12）' + (ipCheck.length === 12 ? ' OK' : ' NG'));
  L('');

  // ─── [3] メーカーマスタ ───
  L('[3] メーカーマスタ 作成...');
  var mkSh = ss.getSheetByName('メーカーマスタ');
  if (!mkSh) { mkSh = ss.insertSheet('メーカーマスタ'); }
  else { mkSh.clearContents(); }
  var mkData = [
    ['mk_id','メーカー名','別名','有効'],
    ['MK001','The Pokemon Company','ポケモン','TRUE'],
    ['MK002','Bandai','バンダイ','TRUE'],
    ['MK003','Takara Tomy','タカラトミー','TRUE'],
    ['MK004','Bushiroad','ブシロード','TRUE'],
    ['MK005','Konami','コナミ','TRUE']
  ];
  mkSh.getRange(1, 1, mkData.length, 4).setValues(mkData);
  SpreadsheetApp.flush();
  var mkCheck = mkSh.getDataRange().getValues();
  L('  → 書込後行数: ' + mkCheck.length + '行（期待: 6）' + (mkCheck.length === 6 ? ' OK' : ' NG'));
  L('');

  // ─── [4] 商品マスタ 既存20列をスナップショット ───
  L('[4] 商品マスタ 3列追加 + 全件割当...');
  var pmSh = ss.getSheetByName('商品マスタ');
  var beforeData = pmSh.getDataRange().getValues();
  var beforeRows = beforeData.length - 1;  // ヘッダー除く
  var beforeCols = beforeData[0].length;
  L('  書込前: ' + beforeRows + '行 ' + beforeCols + '列');

  // ── ヘッダー行に3列追加 ──
  pmSh.getRange(1, 21).setValue('大分類ID');
  pmSh.getRange(1, 22).setValue('作品ID');
  pmSh.getRange(1, 23).setValue('メーカーID');
  SpreadsheetApp.flush();

  // ── 全データ行に値を書く ──
  var rows = beforeData.slice(1);
  var unresolved = [];
  var kcPatchCount = 0;
  var divCount = {}, ipCount = {}, mkCount = {};

  rows.forEach(function(r, i) {
    var rowNum = i + 2;  // 1-based, 1はヘッダー
    var pid  = String(r[0] || '').trim();
    var cat  = String(r[1] || '').trim();
    var kc   = String(r[14] || '').trim();
    var div  = 'DIV01';
    var ip   = CAT_IP[cat] || '';
    var mk   = CAT_MK[cat] || '';

    pmSh.getRange(rowNum, 21).setValue(div);
    pmSh.getRange(rowNum, 22).setValue(ip);
    pmSh.getRange(rowNum, 23).setValue(mk);

    // PM0229 カテゴリ分類空欄補完（col15 = idx14, spreadsheet col 15）
    if (!kc && pid) {
      pmSh.getRange(rowNum, 15).setValue('Single');
      kcPatchCount++;
      L('  カテゴリ分類補完: ' + pid + ' → "Single"');
    }

    divCount[div] = (divCount[div] || 0) + 1;
    if (ip) ipCount[ip] = (ipCount[ip] || 0) + 1;
    if (mk) mkCount[mk] = (mkCount[mk] || 0) + 1;
    if (!ip || !mk) unresolved.push(pid + ' cat="' + cat + '"');
  });
  SpreadsheetApp.flush();
  L('');

  // ─── [5] 検証 ───
  L('════════════════════════════════════');
  L('[5] 検証');
  L('════════════════════════════════════');
  var afterData = pmSh.getDataRange().getValues();
  var afterRows = afterData.length - 1;
  var afterCols = afterData[0].length;

  // 行数
  L('  行数: ' + afterRows + '行（期待: 229）' + (afterRows === 229 ? ' OK' : ' NG'));

  // 列数
  L('  列数: ' + afterCols + '列（期待: 23）' + (afterCols === 23 ? ' OK' : ' NG'));

  // 既存20列不変（ヘッダー + 先頭5データ行で代表チェック）
  var col20OK = true;
  for (var ri = 0; ri < Math.min(afterData.length, 6); ri++) {
    for (var ci = 0; ci < 20; ci++) {
      if (String(afterData[ri][ci]) !== String(beforeData[ri][ci])) {
        col20OK = false;
        L('  既存列変化検出 row=' + ri + ' col=' + (ci+1) + ': before="' + beforeData[ri][ci] + '" after="' + afterData[ri][ci] + '"');
      }
    }
  }
  L('  既存20列（先頭6行サンプル）不変: ' + (col20OK ? 'OK' : 'NG'));

  // product_id 重複チェック
  var ids = afterData.slice(1).map(function(r){ return String(r[0]).trim(); });
  var seen = {}, dupFound = false;
  ids.forEach(function(id){ if (seen[id]) { dupFound = true; L('  重複ID: ' + id); } seen[id] = true; });
  L('  product_id 重複: ' + (dupFound ? 'NG' : 'なし OK'));

  // 新3列 空欄件数
  var blankDiv = 0, blankIp = 0, blankMk = 0;
  afterData.slice(1).forEach(function(r){
    if (!String(r[20]).trim()) blankDiv++;
    if (!String(r[21]).trim()) blankIp++;
    if (!String(r[22]).trim()) blankMk++;
  });
  L('  大分類ID 空欄: ' + blankDiv + '件' + (blankDiv === 0 ? ' OK' : ' NG'));
  L('  作品ID   空欄: ' + blankIp + '件' + (blankIp === 0 ? ' OK' : ' NG'));
  L('  メーカーID空欄: ' + blankMk + '件' + (blankMk === 0 ? ' OK' : ' NG'));

  // メーカー別件数合計
  var mkTotal = Object.keys(mkCount).reduce(function(s,k){ return s + mkCount[k]; }, 0);
  L('  メーカーID合計: ' + mkTotal + '件（期待: 229）' + (mkTotal === 229 ? ' OK' : ' NG'));

  L('');
  L('  作品ID 内訳:');
  Object.keys(ipCount).sort().forEach(function(k){ L('    ' + k + ': ' + ipCount[k] + '件'); });
  L('  メーカーID 内訳:');
  Object.keys(mkCount).sort().forEach(function(k){ L('    ' + k + ': ' + mkCount[k] + '件'); });

  if (unresolved.length > 0) {
    L('');
    L('  未解決 ' + unresolved.length + '件:');
    unresolved.forEach(function(u){ L('    ' + u); });
  }

  L('');
  L('=== execMasterSetup 完了 ===');
  return out.join('\n');
}

// ============================================================
// DRY RUN: PM0230〜PM0234 新規5件追加
// ============================================================
function dryRunNewPM5() {
  var out = [];
  function L(s) { out.push(s); }

  L('=== dryRunNewPM5 ===');
  L('※ DRY RUN - 書き込み一切なし');
  L('');

  // 提案する5行（idx0〜idx19 = 既存20列 + idx20〜22 = 新3列）
  // col15(idx14)=カテゴリ分類, col12(idx11)=SearchKeywords, col16(idx15)=RO Value
  // 他の空欄列: Mark(2), Boxes/Case(5), Packs/Box(6), VW(7), Box重量(8), Case重量(9),
  //             Release(10), ExcludeKW(12), RelatedSeries(13), MOQ(16), 品目(17), HSコード(18), 素材(19)

  var proposals = [
    {
      pid:   'PM0230',
      cat:   'Weiss Shwarz',     // 既存Weiss非Roseに合わせる
      mark:  '',
      ja:    '推しの子 Vol.1 トライアルデッキ',
      en:    'Oshi no Ko Vol.1 Trial Deck',
      kw:    '推しの子, oshi no ko, oshi no ko vol.1 trial deck, vol.1 trial deck',
      kc:    'Single',           // Trial Deck = 単体デッキ
      ro:    '推しの子 Vol.1 トライアルデッキ',
      div:   'DIV01', ip: 'IP007', mk: 'MK004',
      note:  'Weiss Schwarz 推しの子。Roseライン非該当のため cat=Weiss Shwarz'
    },
    {
      pid:   'PM0231',
      cat:   'Pokemon',
      mark:  'PROMO',
      ja:    'ビクティニ レッドプロモ',
      en:    'Victini red promo',
      kw:    'victini, ビクティニ, red promo, victini promo',
      kc:    'Single',           // プロモカード単体
      ro:    'ビクティニ レッドプロモ',
      div:   'DIV01', ip: 'IP001', mk: 'MK001',
      note:  'Pokemon プロモカード単体'
    },
    {
      pid:   'PM0232',
      cat:   'Pokemon',          // IPベースで既存Categoryを流用
      mark:  '',
      ja:    'バンダイ ポケモンキッズ メガミュウツーX・Y',
      en:    'Bandai Pokemon Kids Mega Mewtwo X & Y',
      kw:    'mewtwo, mega mewtwo, bandai kids, pokemon kids, ミュウツー, mega mewtwo x, mega mewtwo y',
      kc:    '',                 // フィギュア = 空欄可
      ro:    'Bandai Pokemon Kids Mega Mewtwo X & Y',
      div:   'DIV02', ip: 'IP001', mk: 'MK002',
      note:  'Bandai フィギュア。Category="Pokemon"はIP基準の流用（要確認）'
    },
    {
      pid:   'PM0233',
      cat:   'Pokemon',
      mark:  '',
      ja:    'バンダイ ポケモンキッズ メガリザードンX・Y',
      en:    'Bandai Pokemon Kids Mega Charizard X & Y',
      kw:    'charizard, mega charizard, bandai kids, pokemon kids, リザードン, mega charizard x, mega charizard y',
      kc:    '',                 // フィギュア = 空欄可
      ro:    'Bandai Pokemon Kids Mega Charizard X & Y',
      div:   'DIV02', ip: 'IP001', mk: 'MK002',
      note:  'Bandai フィギュア。Category="Pokemon"はIP基準の流用（要確認）'
    },
    {
      pid:   'PM0234',
      cat:   'Pokemon',
      mark:  '',
      ja:    'タカラトミー ポケナデ',
      en:    'Takara Tomy Poke-nade',
      kw:    'poke-nade, takara tomy, ポケナデ, poke nade, pokenade',
      kc:    '',                 // グッズ = 空欄可
      ro:    'Takara Tomy Poke-nade',
      div:   'DIV03', ip: 'IP001', mk: 'MK003',
      note:  'Takara Tomy グッズ。Category="Pokemon"はIP基準の流用（要確認）'
    }
  ];

  // 既存末尾 product_id 確認
  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var lastRow = pmSh.getLastRow();
  var lastId  = pmSh.getRange(lastRow, 1).getValue();
  L('現在の商品マスタ末尾: 行=' + lastRow + ' / product_id="' + lastId + '"');
  L('追加予定行: ' + (lastRow+1) + '〜' + (lastRow+5));
  L('');

  // 各提案行を表示
  proposals.forEach(function(p, i) {
    L('════════════════════════════════════');
    L('【' + (i+1) + '】 ' + p.pid);
    L('  col01 product_id  : ' + p.pid);
    L('  col02 Category    : ' + p.cat);
    L('  col03 Mark        : ' + (p.mark || '(空欄)'));
    L('  col04 JA Title    : ' + p.ja);
    L('  col05 EN Title    : ' + p.en);
    L('  col06〜10         : (空欄)');
    L('  col12 Keywords    : ' + p.kw);
    L('  col13〜14         : (空欄)');
    L('  col15 カテゴリ分類: ' + (p.kc || '(空欄)'));
    L('  col16 RO Value    : ' + p.ro);
    L('  col17〜20         : (空欄)');
    L('  col21 大分類ID    : ' + p.div);
    L('  col22 作品ID      : ' + p.ip);
    L('  col23 メーカーID  : ' + p.mk);
    L('  備考              : ' + p.note);
  });

  L('');
  L('════════════════════════════════════');
  L('[要確認事項]');
  L('════════════════════════════════════');
  L('Q1. PM0232/0233/0234 の Category列 "Pokemon" でよいか');
  L('    （フィギュア・グッズにはTCG用Categoryを流用しているが、');
  L('      集計・表示上は DIV02/DIV03 で区別可能なため実用上は問題ない想定）');
  L('Q2. PM0230 の JA Title "推しの子 Vol.1 トライアルデッキ" の正式表記確認');
  L('Q3. PM0231 の Mark "PROMO" は既存PROMO商品と一貫しているが要確認');
  L('');
  L('=== dryRunNewPM5 完了 ===');
  return out.join('\n');
}

// ============================================================
// CONFIRM EXEC: PM0230〜PM0234 新規5件追加
// ============================================================
function execNewPM5() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== execNewPM5 ===');

  // 23列(idx0〜22) の新規行定義
  var newRows = [
    // PM0230: 修正版（JA正式表記・Mark=OSK・Vol.1をKWに収容）
    ['PM0230','Weiss Shwarz','OSK',
     'トライアルデッキ 【推しの子】','Oshi no Ko Trial Deck',
     '','','','','','',
     '推しの子, oshi no ko, OSK, trial deck, vol.1',
     '','','Single','トライアルデッキ 【推しの子】',
     '','','','',
     'DIV01','IP007','MK004'],
    // PM0231
    ['PM0231','Pokemon','PROMO',
     'ビクティニ レッドプロモ','Victini red promo',
     '','','','','','',
     'victini, ビクティニ, red promo, victini promo',
     '','','Single','ビクティニ レッドプロモ',
     '','','','',
     'DIV01','IP001','MK001'],
    // PM0232
    ['PM0232','Pokemon','',
     'バンダイ ポケモンキッズ メガミュウツーX・Y','Bandai Pokemon Kids Mega Mewtwo X & Y',
     '','','','','','',
     'mewtwo, mega mewtwo, bandai kids, pokemon kids, ミュウツー, mega mewtwo x, mega mewtwo y',
     '','','','Bandai Pokemon Kids Mega Mewtwo X & Y',
     '','','','',
     'DIV02','IP001','MK002'],
    // PM0233
    ['PM0233','Pokemon','',
     'バンダイ ポケモンキッズ メガリザードンX・Y','Bandai Pokemon Kids Mega Charizard X & Y',
     '','','','','','',
     'charizard, mega charizard, bandai kids, pokemon kids, リザードン, mega charizard x, mega charizard y',
     '','','','Bandai Pokemon Kids Mega Charizard X & Y',
     '','','','',
     'DIV02','IP001','MK002'],
    // PM0234
    ['PM0234','Pokemon','',
     'タカラトミー ポケナデ','Takara Tomy Poke-nade',
     '','','','','','',
     'poke-nade, takara tomy, ポケナデ, poke nade, pokenade',
     '','','','Takara Tomy Poke-nade',
     '','','','',
     'DIV03','IP001','MK003']
  ];

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var beforeLastRow = pmSh.getLastRow();
  var beforeDataRows = beforeLastRow - 1;
  L('書込前: データ行=' + beforeDataRows + ' / 最終行=' + beforeLastRow);

  // 重複チェック: 追加予定ID が既に存在しないか
  var existingIds = pmSh.getRange(2, 1, beforeDataRows, 1).getValues()
    .map(function(r){ return String(r[0]).trim(); });
  var dupCheck = newRows.map(function(r){ return r[0]; }).filter(function(id){
    return existingIds.indexOf(id) >= 0;
  });
  if (dupCheck.length > 0) {
    L('[ERROR] 既存と重複するID: ' + dupCheck.join(', ') + ' → 処理中止');
    return out.join('\n');
  }
  L('重複IDチェック: なし OK');

  // 5行をまとめて書き込み
  var startRow = beforeLastRow + 1;
  pmSh.getRange(startRow, 1, newRows.length, 23).setValues(newRows);
  SpreadsheetApp.flush();
  L('書込: 行' + startRow + '〜' + (startRow + newRows.length - 1) + ' に5行');
  L('');

  // ─── 検証 ───
  L('════════════════════════════════════');
  L('[検証]');
  L('════════════════════════════════════');
  var afterData = pmSh.getDataRange().getValues();
  var afterDataRows = afterData.length - 1;
  L('データ行数: ' + afterDataRows + '件（期待: 234）' + (afterDataRows === 234 ? ' OK' : ' NG'));

  // 既存229行の col1〜col20 が不変か（先頭5行 + 末尾の元229行目をサンプル）
  var sampleOK = true;
  var beforeSnap = pmSh.getRange(2, 1, beforeDataRows, 20).getValues();
  // beforeSnapは書込前のデータ—すでに書込後なので「既存部分だけ」を再読
  // 既存行(行2〜230)のIDが連番で同一かを確認
  for (var ri = 0; ri < beforeDataRows; ri++) {
    var pid = String(afterData[ri+1][0]).trim();
    var expectedPid = 'PM' + String(ri+1).padStart(4,'0');
    if (pid !== expectedPid) {
      sampleOK = false;
      L('  行ズレ検出: row=' + (ri+2) + ' pid="' + pid + '" 期待="' + expectedPid + '"');
    }
  }
  L('既存229行 product_id 連番確認: ' + (sampleOK ? 'OK' : 'NG'));

  // 追加5行の内容確認
  L('');
  L('追加5行 確認:');
  for (var ni = 0; ni < 5; ni++) {
    var rowData = afterData[230 + ni];  // idx230〜234
    L('  ' + rowData[0] + ' | cat=' + rowData[1] + ' | mark=' + rowData[2] +
      ' | kc=' + rowData[14] + ' | div=' + rowData[20] + ' | ip=' + rowData[21] + ' | mk=' + rowData[22]);
  }

  // product_id 重複
  var allIds = afterData.slice(1).map(function(r){ return String(r[0]).trim(); });
  var seen = {}, dupFound = false;
  allIds.forEach(function(id){ if(seen[id]){ dupFound=true; L('  重複ID: '+id); } seen[id]=true; });
  L('product_id 重複: ' + (dupFound ? 'NG' : 'なし OK'));

  // 3軸ID 空欄チェック（全234行）
  var blankDiv=0, blankIp=0, blankMk=0;
  afterData.slice(1).forEach(function(r){
    if(!String(r[20]).trim()) blankDiv++;
    if(!String(r[21]).trim()) blankIp++;
    if(!String(r[22]).trim()) blankMk++;
  });
  L('大分類ID 空欄: ' + blankDiv + (blankDiv===0?' OK':' NG'));
  L('作品ID   空欄: ' + blankIp  + (blankIp ===0?' OK':' NG'));
  L('メーカーID空欄: ' + blankMk + (blankMk ===0?' OK':' NG'));

  L('');
  L('=== execNewPM5 完了 ===');
  return out.join('\n');
}

// ============================================================
// DRY RUN: PM0055/0117/0182/0183 KW末尾追記
// ============================================================
function dryRunKWAdditions() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== dryRunKWAdditions ===');
  L('※ DRY RUN - 書き込み一切なし');
  L('');

  var additions = {
    'PM0055': 'shiny v box',
    'PM0117': 'shiny treasures',
    'PM0182': 'specialty box tohoku',
    'PM0183': 'interspecies reviews'
  };

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var data = pmSh.getDataRange().getValues();
  var headers = data[0];

  // product_id → row index
  var pidIdx = {};
  data.slice(1).forEach(function(r, i){ pidIdx[String(r[0]).trim()] = i + 1; });

  Object.keys(additions).sort().forEach(function(pid) {
    var ri = pidIdx[pid];
    if (ri === undefined) { L('[ERROR] ' + pid + ' が見つかりません'); return; }
    var r = data[ri];
    var currentKW = String(r[11] || '').trim();
    var addKW = additions[pid];
    var newKW = currentKW ? currentKW + ', ' + addKW : addKW;

    L('────────────────────────────────────');
    L(pid + ' | JA="' + r[3] + '"');
    L('  現在KW : "' + currentKW + '"');
    L('  追記KW : "' + addKW + '"');
    L('  変更後KW: "' + newKW + '"');
  });

  L('');
  L('=== dryRunKWAdditions 完了 ===');
  return out.join('\n');
}

// ============================================================
// CONFIRM EXEC: KW末尾追記 (PM0055/0117/0182/0183)
// ============================================================
function execKWAdditions() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== execKWAdditions ===');

  var additions = {
    'PM0055': 'shiny v box',
    'PM0117': 'shiny treasures',
    'PM0182': 'specialty box tohoku',
    'PM0183': 'interspecies reviews'
  };

  var ss = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');
  var data = pmSh.getDataRange().getValues();

  var pidToRow = {};
  data.slice(1).forEach(function(r, i) {
    pidToRow[String(r[0]).trim()] = i + 2;  // 1-based row
  });

  Object.keys(additions).sort().forEach(function(pid) {
    var rowNum = pidToRow[pid];
    if (!rowNum) { L('[ERROR] ' + pid + ' 見つからず'); return; }
    var currentKW = String(data[rowNum - 1][11] || '').trim();
    var addKW = additions[pid];
    var newKW = currentKW ? currentKW + ', ' + addKW : addKW;
    pmSh.getRange(rowNum, 12).setValue(newKW);  // col12 = idx11
    L(pid + ': "' + currentKW + '"');
    L('  → "' + newKW + '"');
  });
  SpreadsheetApp.flush();
  L('');

  // 検証: 書込後の実際の値を再読
  L('────────────────────────────────────');
  L('[検証] 書込後の実値確認');
  L('────────────────────────────────────');
  var after = pmSh.getDataRange().getValues();
  Object.keys(additions).sort().forEach(function(pid) {
    var rowNum = pidToRow[pid];
    var actualKW = String(after[rowNum - 1][11] || '').trim();
    var ok = actualKW.indexOf(additions[pid]) >= 0;
    L(pid + ': ' + (ok ? 'OK' : 'NG') + ' → "' + actualKW + '"');
  });

  L('');
  L('=== execKWAdditions 完了 ===');
  return out.join('\n');
}

// ============================================================
// KW追加後 再照合シミュレーション（書き込みなし）
// ============================================================
function rematchAfterKW() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== rematchAfterKW ===');
  L('ベースライン: 561件 (investigateStep23DryRun 結果)');
  L('');

  var crmSS = getSpreadsheet();
  var invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmEntries = _npnBuildPmEntries(invSS);
  L('PM件数: ' + pmEntries.length + '件 (PM0229〜PM0234含む)');

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  if (CI_NAME < 0) CI_NAME = 4;
  if (CI_OL  < 0) CI_OL  = 0;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();
  L('明細行数: ' + olData.length + '件');
  L('');

  // 分類ルール
  function classifyRule(name) {
    var n = _v3n(name);
    if (/mega[\s\-]*premium[\s\-]*trainer/i.test(name)) return 'PM0093';
    if (/retro/i.test(name) || /\[b\s*grade\]/i.test(name)) return 'PM0229';
    if (/\bsar\b/.test(n)) return 'PM0006';
    if (/\bsr\b/.test(n) && !/\bsar\b/.test(n) && !/\bar\b/.test(n)) return 'PM0005';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /no.?dup/i.test(n)) return 'PM0010';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /duplicate|random.?mix|bulk|single/i.test(n)) return 'PM0011';
    return null;
  }

  var confirmed = 0, pmBreakdown = {}, stillUnmatched = [];
  var manualOverrides = 0, ruleMatched = 0, autoMatched = 0;

  olData.forEach(function(row) {
    var odlId = String(row[CI_OL]  || '').trim();
    var name  = String(row[CI_NAME]|| '').trim();
    if (!name) return;

    var pmId = null;

    // 手動マッピング: ODL-00204 → PM0175
    if (odlId === 'ODL-00204') {
      pmId = 'PM0175'; manualOverrides++;
    }

    if (!pmId) {
      // _v3match (Phase0/Phase1 のみ、fuzzy除外)
      var res = _v3match(name, pmEntries);
      if (res.matched && !res.fuzzy) { pmId = res.pmId; autoMatched++; }
    }

    if (!pmId) {
      var ruleId = classifyRule(name);
      if (ruleId) { pmId = ruleId; ruleMatched++; }
    }

    if (pmId) {
      confirmed++;
      pmBreakdown[pmId] = (pmBreakdown[pmId] || 0) + 1;
    } else {
      stillUnmatched.push(name);
    }
  });

  L('════════════════════════════════════');
  L('確定一致: ' + confirmed + '件');
  L('  内訳: 自動=' + autoMatched + '件 / ルール=' + ruleMatched + '件 / 手動=' + manualOverrides + '件');
  L('未一致: ' + stillUnmatched.length + '件');
  L('ベースライン比: ' + confirmed + ' - 561 = ' + (confirmed - 561) + '件');
  L('');
  L('[PM別 上位20]');
  var pmKeys = Object.keys(pmBreakdown).sort(function(a,b){ return pmBreakdown[b]-pmBreakdown[a]; });
  pmKeys.slice(0,20).forEach(function(id){ L('  ' + id + ': ' + pmBreakdown[id] + '件'); });
  L('');
  L('[なお未一致 ' + stillUnmatched.length + '件]');
  var uf = {};
  stillUnmatched.forEach(function(n){ uf[n]=(uf[n]||0)+1; });
  Object.keys(uf).sort(function(a,b){ return uf[b]-uf[a]; }).forEach(function(n){
    L('  ' + uf[n] + '件  "' + n + '"');
  });
  L('');
  L('=== rematchAfterKW 完了 ===');
  return out.join('\n');
}

// ============================================================
// DRY RUN: オーダー明細 col11「商品ID」追加
// ============================================================
function dryRunOrderDetailPmId() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== dryRunOrderDetailPmId ===');
  L('※ DRY RUN - 書き込み一切なし');
  L('');

  var crmSS = getSpreadsheet();
  var invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmEntries = _npnBuildPmEntries(invSS);

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  if (CI_NAME < 0) CI_NAME = 4;
  if (CI_OL  < 0) CI_OL  = 0;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  L('[スキーマ変更]');
  L('  現在: ' + numCols + '列 (col1〜col' + numCols + ')');
  L('  追加: col' + (numCols+1) + ' = "商品ID"');
  L('  既存' + numCols + '列は一切変更しない');
  L('');

  function classifyRule(name) {
    var n = _v3n(name);
    if (/mega[\s\-]*premium[\s\-]*trainer/i.test(name)) return 'PM0093';
    if (/retro/i.test(name) || /\[b\s*grade\]/i.test(name)) return 'PM0229';
    if (/\bsar\b/.test(n)) return 'PM0006';
    if (/\bsr\b/.test(n) && !/\bsar\b/.test(n) && !/\bar\b/.test(n)) return 'PM0005';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /no.?dup/i.test(n)) return 'PM0010';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /duplicate|random.?mix|bulk|single/i.test(n)) return 'PM0011';
    return null;
  }

  var totalRows = olData.length, blankRows = 0, matchedCount = 0;
  var unmatchedRows = [], manualRows = [], pmBreakdown = {};

  var assignments = olData.map(function(row) {
    var odlId = String(row[CI_OL]  || '').trim();
    var name  = String(row[CI_NAME]|| '').trim();

    if (!name) { blankRows++; return { odl: odlId, name: name, pmId: '', source: 'blank' }; }

    // 手動: ODL-00204 → PM0175
    if (odlId === 'ODL-00204') {
      matchedCount++;
      pmBreakdown['PM0175'] = (pmBreakdown['PM0175']||0)+1;
      return { odl: odlId, name: name, pmId: 'PM0175', source: 'manual' };
    }

    // _v3match
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) {
      matchedCount++;
      pmBreakdown[res.pmId] = (pmBreakdown[res.pmId]||0)+1;
      return { odl: odlId, name: name, pmId: res.pmId, source: 'auto' };
    }

    // 分類ルール
    var ruleId = classifyRule(name);
    if (ruleId) {
      matchedCount++;
      pmBreakdown[ruleId] = (pmBreakdown[ruleId]||0)+1;
      return { odl: odlId, name: name, pmId: ruleId, source: 'rule' };
    }

    return { odl: odlId, name: name, pmId: '', source: 'unmatched' };
  });

  // 手動マッピング行の表示
  manualRows = assignments.filter(function(a){ return a.source === 'manual'; });
  unmatchedRows = assignments.filter(function(a){ return a.source === 'unmatched'; });

  L('════════════════════════════════════');
  L('[サマリ]');
  L('════════════════════════════════════');
  L('総明細行数    : ' + totalRows + '件');
  L('空行（商品名空）: ' + blankRows + '件  → 商品ID=空欄');
  L('PM-ID確定    : ' + matchedCount + '件');
  L('  うち手動    : ' + manualRows.length + '件');
  L('  うち自動/ルール: ' + (matchedCount - manualRows.length) + '件');
  L('未確定        : ' + unmatchedRows.length + '件  → 商品ID=空欄');
  L('');

  L('[手動マッピング]');
  manualRows.forEach(function(a){ L('  ' + a.odl + ' → ' + a.pmId + '  ("' + a.name + '")'); });
  L('');

  L('[PM別 上位20]');
  var pmKeys = Object.keys(pmBreakdown).sort(function(a,b){ return pmBreakdown[b]-pmBreakdown[a]; });
  pmKeys.slice(0,20).forEach(function(id){ L('  ' + id + ': ' + pmBreakdown[id] + '件'); });
  L('');

  L('[未確定 ' + unmatchedRows.length + '件（全件）]');
  var uf = {};
  unmatchedRows.forEach(function(a){ uf[a.name]=(uf[a.name]||0)+1; });
  Object.keys(uf).sort(function(a,b){ return uf[b]-uf[a]; }).forEach(function(n){
    L('  ' + uf[n] + '件  "' + n + '"');
  });

  L('');
  L('=== dryRunOrderDetailPmId 完了 ===');
  return out.join('\n');
}

// ============================================================
// CRM名称パッチ: Tohoku Specialty Box → Special Box Tohoku
// ============================================================
function execCRMNamePatch() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== execCRMNamePatch ===');

  var TARGET_BEFORE = 'Pokemon Card Tohoku Specialty Box';
  var TARGET_AFTER  = 'Pokemon Card Special Box Tohoku';

  var crmSS = getSpreadsheet();
  var olSh  = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  if (CI_NAME < 0) CI_NAME = 4;
  if (CI_OL  < 0) CI_OL  = 0;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  var hits = [];
  olData.forEach(function(row, i) {
    if (String(row[CI_NAME] || '').trim() === TARGET_BEFORE) {
      hits.push({ rowNum: i + 2, odlId: String(row[CI_OL] || '').trim() });
    }
  });

  L('対象行: ' + hits.length + '件');
  hits.forEach(function(h) {
    L('  row=' + h.rowNum + ' 明細ID=' + h.odlId);
    L('  before: "' + TARGET_BEFORE + '"');
    L('  after : "' + TARGET_AFTER + '"');
    olSh.getRange(h.rowNum, CI_NAME + 1).setValue(TARGET_AFTER);
  });

  if (hits.length === 0) {
    L('[WARNING] 対象行が見つかりません。既にパッチ済みか確認してください。');
    return out.join('\n');
  }

  SpreadsheetApp.flush();

  // 検証
  var afterVal = olSh.getRange(hits[0].rowNum, CI_NAME + 1).getValue();
  L('書込後実値: "' + afterVal + '"');
  L('検証: ' + (afterVal === TARGET_AFTER ? 'OK' : 'NG'));

  L('');
  L('=== execCRMNamePatch 完了 ===');
  return out.join('\n');
}

// ============================================================
// パッチ後 再照合確認（書き込みなし）
// ============================================================
function rematchAfterPatch() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== rematchAfterPatch ===');

  var crmSS = getSpreadsheet();
  var invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmEntries = _npnBuildPmEntries(invSS);

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  if (CI_NAME < 0) CI_NAME = 4;
  if (CI_OL  < 0) CI_OL  = 0;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  function classifyRule(name) {
    var n = _v3n(name);
    if (/mega[\s\-]*premium[\s\-]*trainer/i.test(name)) return 'PM0093';
    if (/retro/i.test(name) || /\[b\s*grade\]/i.test(name)) return 'PM0229';
    if (/\bsar\b/.test(n)) return 'PM0006';
    if (/\bsr\b/.test(n) && !/\bsar\b/.test(n) && !/\bar\b/.test(n)) return 'PM0005';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /no.?dup/i.test(n)) return 'PM0010';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /duplicate|random.?mix|bulk|single/i.test(n)) return 'PM0011';
    return null;
  }

  var confirmed = 0, unmatched = [];
  olData.forEach(function(row) {
    var odlId = String(row[CI_OL]  || '').trim();
    var name  = String(row[CI_NAME]|| '').trim();
    if (!name) return;
    if (odlId === 'ODL-00204') { confirmed++; return; }
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) { confirmed++; return; }
    var r = classifyRule(name);
    if (r) { confirmed++; return; }
    unmatched.push('"' + name + '"');
  });

  L('確定一致: ' + confirmed + '件（期待: 574）' + (confirmed === 574 ? ' OK' : ' NG'));
  L('未一致: ' + unmatched.length + '件（期待: 6 非商品）');
  unmatched.forEach(function(n){ L('  ' + n); });
  L('');
  L('=== rematchAfterPatch 完了 ===');
  return out.join('\n');
}

// ============================================================
// CONFIRM EXEC: オーダー明細 col11「商品ID」書き込み
// ============================================================
function execOrderDetailPmId() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== execOrderDetailPmId ===');

  var crmSS = getSpreadsheet();
  var invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmEntries = _npnBuildPmEntries(invSS);

  // PM master の全ID一覧（孤児チェック用）
  var pmSh = invSS.getSheetByName('商品マスタ');
  var pmIds = pmSh.getRange(2, 1, pmSh.getLastRow() - 1, 1).getValues()
    .map(function(r){ return String(r[0]).trim(); }).filter(Boolean);
  var pmIdSet = {};
  pmIds.forEach(function(id){ pmIdSet[id] = true; });
  L('PM master: ' + pmIds.length + '件');

  var olSh    = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  var CI_QTY  = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_SUB  = _npnFindCol(headers, ['小計','subtotal']);
  if (CI_NAME < 0) CI_NAME = 4;
  if (CI_OL  < 0) CI_OL   = 0;
  if (CI_QTY < 0) CI_QTY  = 7;
  if (CI_SUB < 0) CI_SUB  = 9;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();
  L('明細行数: ' + olData.length + '件');

  // 書込前の合計値（不変確認用）
  var qtyBefore = 0, subBefore = 0;
  olData.forEach(function(r){
    var q = parseFloat(r[CI_QTY]); if (!isNaN(q)) qtyBefore += q;
    var s = parseFloat(r[CI_SUB]); if (!isNaN(s)) subBefore += s;
  });
  L('書込前 数量合計: ' + qtyBefore);
  L('書込前 小計合計: ' + subBefore.toFixed(2));
  L('');

  function classifyRule(name) {
    var n = _v3n(name);
    if (/mega[\s\-]*premium[\s\-]*trainer/i.test(name)) return 'PM0093';
    if (/retro/i.test(name) || /\[b\s*grade\]/i.test(name)) return 'PM0229';
    if (/\bsar\b/.test(n)) return 'PM0006';
    if (/\bsr\b/.test(n) && !/\bsar\b/.test(n) && !/\bar\b/.test(n)) return 'PM0005';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /no.?dup/i.test(n)) return 'PM0010';
    if (/\bar\b/.test(n) && !/\bsar\b/.test(n) && /duplicate|random.?mix|bulk|single/i.test(n)) return 'PM0011';
    return null;
  }

  // 全行の商品ID を計算
  var assignments = olData.map(function(row) {
    var odlId = String(row[CI_OL]  || '').trim();
    var name  = String(row[CI_NAME]|| '').trim();
    if (!name) return '';
    if (odlId === 'ODL-00204') return 'PM0175';
    var res = _v3match(name, pmEntries);
    if (res.matched && !res.fuzzy) return res.pmId;
    var r = classifyRule(name);
    if (r) return r;
    return '';
  });

  // col11 ヘッダー
  olSh.getRange(1, 11).setValue('商品ID');

  // 全行一括書き込み（col11のみ）
  var writeData = assignments.map(function(id){ return [id]; });
  olSh.getRange(2, 11, writeData.length, 1).setValues(writeData);
  SpreadsheetApp.flush();

  // ──検証──
  L('════════════════════════════════════');
  L('[検証]');
  L('════════════════════════════════════');

  var afterData = olSh.getDataRange().getValues();
  var afterDataRows = afterData.length - 1;
  L('行数: ' + afterDataRows + '件（期待: 595）' + (afterDataRows === 595 ? ' OK' : ' NG'));

  // col11 集計
  var filled = 0, emptyCount = 0;
  var orphans = [];
  afterData.slice(1).forEach(function(r){
    var pmId = String(r[10] || '').trim();  // idx10 = col11
    if (pmId) {
      filled++;
      if (!pmIdSet[pmId]) orphans.push(pmId + ' (row: "' + r[CI_NAME] + '")');
    } else {
      emptyCount++;
    }
  });
  L('商品ID 記入: ' + filled + '件（期待: 574）' + (filled === 574 ? ' OK' : ' NG'));
  L('商品ID 空欄: ' + emptyCount + '件（期待: 21）' + (emptyCount === 21 ? ' OK' : ' NG'));
  L('孤児PM-ID:  ' + orphans.length + '件' + (orphans.length === 0 ? ' OK' : ' NG'));
  if (orphans.length > 0) orphans.forEach(function(o){ L('  ' + o); });

  // 既存10列不変（先頭3行・末尾3行サンプル）
  var colOK = true;
  var sampleRows = [1,2,3, afterDataRows-1, afterDataRows, afterDataRows+1];
  sampleRows.forEach(function(ri) {
    if (ri < 1 || ri >= afterData.length) return;
    for (var ci = 0; ci < 10; ci++) {
      var before = String(olData[ri-1] ? (olData[ri-1][ci]||'') : '');
      var after  = String(afterData[ri][ci] || '');
      if (before !== after) {
        colOK = false;
        L('  既存列変化検出 row=' + ri + ' col=' + (ci+1) + ': "' + before + '" → "' + after + '"');
      }
    }
  });
  L('既存10列（サンプル6行）不変: ' + (colOK ? 'OK' : 'NG'));

  // 数量・小計 合計
  var qtyAfter = 0, subAfter = 0;
  afterData.slice(1).forEach(function(r){
    var q = parseFloat(r[CI_QTY]); if (!isNaN(q)) qtyAfter += q;
    var s = parseFloat(r[CI_SUB]); if (!isNaN(s)) subAfter += s;
  });
  L('数量合計: ' + qtyAfter + '（期待: 12281）' + (qtyAfter === 12281 ? ' OK' : ' NG → 差=' + (qtyAfter-12281)));
  L('小計合計: ' + subAfter.toFixed(2) + '（期待: 76986599.50）' + (Math.abs(subAfter - 76986599.50) < 0.01 ? ' OK' : ' NG → 差=' + (subAfter-76986599.50).toFixed(2)));

  L('');
  L('=== execOrderDetailPmId 完了 ===');
  return out.join('\n');
}

// ============================================================
// 調査: 非商品6件 + 空行15件 詳細（読み取り専用）
// ============================================================
function investigateBlankAndNonProduct() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== investigateBlankAndNonProduct ===');

  var crmSS = getSpreadsheet();
  var olSh  = crmSS.getSheetByName('オーダー明細');
  var numCols = olSh.getLastColumn();
  var headers = olSh.getRange(1, 1, 1, numCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var CI_OL   = _npnFindCol(headers, ['明細ID','詳細ID','lineitemid','odl']);
  var CI_OD   = _npnFindCol(headers, ['オーダーID','orderid','order_id']);
  var CI_ROW  = _npnFindCol(headers, ['行番号','linenum','line']);
  var CI_CAT  = _npnFindCol(headers, ['カテゴリ','category']);
  var CI_NAME = _npnFindCol(headers, ['商品名','productname','product_name']);
  var CI_STAT = _npnFindCol(headers, ['状態','status']);
  var CI_SKU  = _npnFindCol(headers, ['SKU','sku']);
  var CI_QTY  = _npnFindCol(headers, ['数量','qty','quantity']);
  var CI_UNIT = _npnFindCol(headers, ['単価','unitprice','unit_price']);
  var CI_SUB  = _npnFindCol(headers, ['小計','subtotal']);
  var CI_PMID = 10;  // col11 = idx10 (商品ID)
  if (CI_OL  < 0) CI_OL   = 0;
  if (CI_OD  < 0) CI_OD   = 1;
  if (CI_ROW < 0) CI_ROW  = 2;
  if (CI_NAME< 0) CI_NAME = 4;
  if (CI_QTY < 0) CI_QTY  = 7;
  if (CI_UNIT< 0) CI_UNIT = 8;
  if (CI_SUB < 0) CI_SUB  = 9;

  var olData = olSh.getRange(2, 1, olSh.getLastRow() - 1, numCols).getValues();

  // オーダーID → 含まれる明細一覧 を事前構築
  var odToLines = {};
  olData.forEach(function(r, i) {
    var odId = String(r[CI_OD] || '').trim();
    var name = String(r[CI_NAME] || '').trim();
    if (!odToLines[odId]) odToLines[odId] = [];
    odToLines[odId].push({ rowNum: i + 2, odlId: String(r[CI_OL]||'').trim(), name: name });
  });

  // 分類ヒューリスティック
  function classify(name) {
    var n = name.toLowerCase();
    if (/shipping|freight|delivery/.test(n)) return '送料';
    if (/customs|duty|tariff|関税/.test(n)) return '関税';
    if (/discount|値引き|割引/.test(n)) return '値引き';
    if (/mpf|merchandise processing|ddp|handling fee|surcharge/.test(n)) return 'その他手数料';
    return '要確認';
  }

  // ─── [1] 非商品6件 ───
  L('');
  L('════════════════════════════════════');
  L('[1] 非商品6件 詳細');
  L('════════════════════════════════════');
  var nonProducts = olData.filter(function(r) {
    var name  = String(r[CI_NAME] || '').trim();
    var pmId  = String(r[CI_PMID] || '').trim();
    return name && !pmId;
  });
  L('件数: ' + nonProducts.length + '件');
  L('');
  nonProducts.forEach(function(r) {
    var odlId = String(r[CI_OL]  || '').trim();
    var odId  = String(r[CI_OD]  || '').trim();
    var name  = String(r[CI_NAME]|| '').trim();
    var qty   = r[CI_QTY];
    var unit  = r[CI_UNIT];
    var sub   = r[CI_SUB];
    var cls   = classify(name);
    L('  明細ID: ' + odlId);
    L('  オーダーID: ' + odId);
    L('  商品名: "' + name + '"');
    L('  数量: ' + qty + ' / 単価: ' + unit + ' / 小計: ' + sub);
    L('  → 分類案: ' + cls);
    // 同オーダーの他明細
    var sibs = (odToLines[odId] || []).filter(function(x){ return x.odlId !== odlId && x.name; });
    L('  同オーダー他明細: ' + sibs.length + '件' + (sibs.length > 0 ? ' (' + sibs.map(function(s){ return s.odlId; }).join(', ') + ')' : ''));
    L('');
  });

  // ─── [2] 空行15件 ───
  L('════════════════════════════════════');
  L('[2] 空行15件 詳細（商品名が空欄の行）');
  L('════════════════════════════════════');
  var blankRows = olData.filter(function(r) {
    return !String(r[CI_NAME] || '').trim();
  });
  L('件数: ' + blankRows.length + '件');
  L('');
  blankRows.forEach(function(r) {
    var odlId = String(r[CI_OL]  || '').trim();
    var odId  = String(r[CI_OD]  || '').trim();
    var rowNo = r[CI_ROW];
    var qty   = r[CI_QTY];
    var unit  = r[CI_UNIT];
    var sub   = r[CI_SUB];
    var hasSub = sub !== '' && sub !== null && sub !== undefined && parseFloat(sub) !== 0;
    // 同オーダーの有効明細件数
    var sibs = (odToLines[odId] || []).filter(function(x){ return x.odlId !== odlId && x.name; });
    L('  明細ID: ' + odlId + ' | オーダーID: ' + odId + ' | 行番号: ' + rowNo);
    L('  数量: ' + qty + ' / 単価: ' + unit + ' / 小計: ' + (sub === '' || sub === null || sub === undefined ? '(空)' : sub));
    L('  金額あり: ' + (hasSub ? 'YES ← 注意' : 'no'));
    L('  同オーダー有効明細: ' + sibs.length + '件');
    L('');
  });

  L('=== investigateBlankAndNonProduct 完了 ===');
  return out.join('\n');
}

// ============================================================
// 調査: ODL-00232 全列 / Invoice#0796 / OD-00046（読み取り専用）
// ============================================================
function investigateOrderContext() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== investigateOrderContext ===');

  var crmSS = getSpreadsheet();

  // ─── オーダー明細 ───
  var olSh  = crmSS.getSheetByName('オーダー明細');
  var olCols = olSh.getLastColumn();
  var olHeaders = olSh.getRange(1, 1, 1, olCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var olData = olSh.getRange(2, 1, olSh.getLastRow()-1, olCols).getValues();

  // ODL-00232 の行を全列出力
  L('');
  L('════════════════════════════════════');
  L('[1] ODL-00232 全列（オーダー明細）');
  L('════════════════════════════════════');
  var found232 = false;
  olData.forEach(function(r) {
    if (String(r[0]||'').trim() !== 'ODL-00232') return;
    found232 = true;
    olHeaders.forEach(function(h, i) {
      L('  col' + (i+1) + ' [' + h + ']: "' + String(r[i]||'') + '"');
    });
  });
  if (!found232) L('  [NOT FOUND] ODL-00232');
  L('');

  // ─── オーダー管理 ───
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var omCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();

  L('オーダー管理 列数: ' + omCols + '列');
  L('オーダー管理 データ行: ' + omData.length + '件');
  L('');
  L('ヘッダー一覧:');
  omHeaders.forEach(function(h, i){ L('  col' + (i+1) + ': ' + h); });
  L('');

  // 請求書番号列を特定
  var CI_INV  = _npnFindCol(omHeaders, ['請求書番号','invoicenumber','invoice_no','invoice']);
  var CI_OD   = _npnFindCol(omHeaders, ['オーダーID','orderid','order_id']);
  var CI_CUST = _npnFindCol(omHeaders, ['顧客ID','顧客','customerid','customer_id']);
  var CI_SHIP = _npnFindCol(omHeaders, ['送料','shipping']);
  var CI_TAX  = _npnFindCol(omHeaders, ['関税','customs','tax']);
  var CI_TOTAL= _npnFindCol(omHeaders, ['請求総額','合計','total','invoice_total']);
  L('列検出: 請求書番号=col' + (CI_INV+1) + ' / 顧客=col' + (CI_CUST+1) +
    ' / 送料=col' + (CI_SHIP+1) + ' / 関税=col' + (CI_TAX+1) + ' / 請求総額=col' + (CI_TOTAL+1));
  L('');

  // [2] Invoice#0796 を含む行を検索
  L('════════════════════════════════════');
  L('[2] 請求書番号「#0796」を含む行（オーダー管理）');
  L('════════════════════════════════════');
  var hits0796 = [];
  omData.forEach(function(r) {
    var inv = String(r[CI_INV >= 0 ? CI_INV : 1] || '').trim();
    if (inv.indexOf('0796') >= 0) hits0796.push(r);
  });
  if (hits0796.length === 0) {
    L('  ヒットなし — #0796 は未登録のオーダー番号の可能性');
  } else {
    hits0796.forEach(function(r) {
      omHeaders.forEach(function(h, i) {
        if (String(r[i]||'').trim()) L('  col' + (i+1) + ' [' + h + ']: "' + String(r[i]||'') + '"');
      });
      L('');
    });
  }

  // [3] OD-00046 の詳細
  L('════════════════════════════════════');
  L('[3] OD-00046 全列（オーダー管理）');
  L('════════════════════════════════════');
  var found46 = false;
  omData.forEach(function(r) {
    var odId = String(r[CI_OD >= 0 ? CI_OD : 0] || '').trim();
    if (odId !== 'OD-00046') return;
    found46 = true;
    omHeaders.forEach(function(h, i) {
      L('  col' + (i+1) + ' [' + h + ']: "' + String(r[i]||'') + '"');
    });
  });
  if (!found46) L('  [NOT FOUND] OD-00046');
  L('');

  // OD-00046 の明細件数も確認
  var lines46 = olData.filter(function(r){ return String(r[1]||'').trim() === 'OD-00046'; });
  L('  OD-00046 の明細行数: ' + lines46.length + '件');
  lines46.forEach(function(r){
    L('  ' + String(r[0]||'') + ' | 商品名="' + String(r[4]||'') + '" | 小計=' + String(r[9]||''));
  });

  L('');
  L('=== investigateOrderContext 完了 ===');
  return out.join('\n');
}

// ============================================================
// 調査: OD-00102 詳細（読み取り専用）
// ============================================================
function investigateOD00102() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== investigateOD00102 ===');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var omCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();
  var CI_OD = 0;

  omData.forEach(function(r) {
    if (String(r[CI_OD]||'').trim() !== 'OD-00102') return;
    L('OD-00102 全列:');
    omHeaders.forEach(function(h, i) {
      L('  col' + (i+1) + ' [' + h + ']: "' + String(r[i]||'') + '"');
    });
  });

  L('');
  L('=== investigateOD00102 完了 ===');
  return out.join('\n');
}

// ============================================================
// DRY RUN: オーダー管理2列追加 + 非商品移設 + 行削除
// ============================================================
function dryRunOrderMgmtChanges() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== dryRunOrderMgmtChanges ===');
  L('※ DRY RUN - 書き込み一切なし');
  L('');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var olSh  = crmSS.getSheetByName('オーダー明細');

  var omCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();
  L('オーダー管理: 現在 ' + omCols + '列 / ' + omData.length + '行');

  var olCols = olSh.getLastColumn();
  var olHeaders = olSh.getRange(1, 1, 1, olCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var olData = olSh.getRange(2, 1, olSh.getLastRow()-1, olCols).getValues();
  L('オーダー明細: 現在 ' + olData.length + '行');
  L('');

  // 列インデックス（0-based）
  var CI_OD    = _npnFindCol(omHeaders, ['オーダーID','orderid','order_id']); if (CI_OD  < 0) CI_OD  = 0;
  var CI_SUB11 = _npnFindCol(omHeaders, ['明細合計']);                        if (CI_SUB11< 0) CI_SUB11=10;
  var CI_SHIP  = _npnFindCol(omHeaders, ['送料','shipping']);                 if (CI_SHIP < 0) CI_SHIP=11;
  var CI_TAX   = _npnFindCol(omHeaders, ['関税','customs','tax']);            if (CI_TAX  < 0) CI_TAX =12;
  var CI_TOTAL = _npnFindCol(omHeaders, ['請求総額','合計','total']);          if (CI_TOTAL< 0) CI_TOTAL=13;

  // オーダーマップ
  var omMap = {};
  omData.forEach(function(r){ omMap[String(r[CI_OD]||'').trim()] = r; });

  function omVal(orderId, ci) { return omMap[orderId] ? (Number(omMap[orderId][ci]) || 0) : 0; }

  // 明細合計（削除後）の予測
  var deleteOdlIds = {
    'ODL-00078':1,'ODL-00250':1,'ODL-00319':1,'ODL-00320':1,'ODL-00321':1,'ODL-00353':1,
    'ODL-00217':1,'ODL-00218':1,'ODL-00219':1,'ODL-00220':1,'ODL-00221':1,'ODL-00222':1,
    'ODL-00223':1,'ODL-00224':1,'ODL-00225':1,'ODL-00226':1,'ODL-00227':1,'ODL-00228':1,
    'ODL-00229':1,'ODL-00230':1
  };
  var subtotalMap = {};
  olData.forEach(function(r) {
    var odlId = String(r[0]||'').trim();
    var odId  = String(r[1]||'').trim();
    if (deleteOdlIds[odlId]) return;  // 削除予定行は除外
    var sub = parseFloat(r[9]) || 0;
    subtotalMap[odId] = (subtotalMap[odId] || 0) + sub;
  });

  // ─── A. 新列 ───
  L('════════════════════════════════════');
  L('[A] 追加列（既存33列不変）');
  L('  col34: その他手数料');
  L('  col35: 値引き');
  L('');

  // ─── B. 移設計画 ───
  L('════════════════════════════════════');
  L('[B] 非商品6件 移設計画');
  L('════════════════════════════════════');

  var transfers = [
    { odlId:'ODL-00078', odId:'OD-00046', field:'col12(送料)',       newVal:5500,  addTo:false },
    { odlId:'ODL-00250', odId:'OD-00107', field:'col35(値引き)',      newVal:29000, addTo:false },
    { odlId:'ODL-00319', odId:'OD-00123', field:'col13(関税)',        newVal:4400,  addTo:true  },
    { odlId:'ODL-00320+00321', odId:'OD-00123', field:'col34(その他手数料)', newVal:7730, addTo:false },
    { odlId:'ODL-00353', odId:'OD-00132', field:'col35(値引き)',      newVal:1200,  addTo:false }
  ];

  var newShip = {}, newTax = {}, newOther = {}, newDisc = {};
  // 初期値
  omData.forEach(function(r) {
    var id = String(r[CI_OD]||'').trim();
    newShip[id]  = Number(r[CI_SHIP] ) || 0;
    newTax[id]   = Number(r[CI_TAX]  ) || 0;
    newOther[id] = 0;
    newDisc[id]  = 0;
  });

  transfers.forEach(function(t) {
    var r = omMap[t.odId];
    if (!r) { L('  [ERROR] ' + t.odId + ' 見つからず'); return; }
    var curTotal = omVal(t.odId, CI_TOTAL);
    var curShip  = Number(r[CI_SHIP]) || 0;
    var curTax   = Number(r[CI_TAX])  || 0;

    if (t.field.indexOf('送料') >= 0) {
      newShip[t.odId] = t.addTo ? curShip + t.newVal : t.newVal;
    } else if (t.field.indexOf('関税') >= 0) {
      newTax[t.odId] = t.addTo ? curTax + t.newVal : t.newVal;
    } else if (t.field.indexOf('その他手数料') >= 0) {
      newOther[t.odId] += t.newVal;
    } else if (t.field.indexOf('値引き') >= 0) {
      newDisc[t.odId] += t.newVal;
    }

    var newSubtotal = subtotalMap[t.odId] || 0;
    var newTotal = newSubtotal + newShip[t.odId] + newTax[t.odId] + newOther[t.odId] - newDisc[t.odId];

    L('  ' + t.odId + ' ← ' + t.odlId + ': ' + t.field + ' = ' + t.newVal + (t.addTo ? '(既存に加算)' : ''));
    L('    現在: 明細合計=' + omVal(t.odId, CI_SUB11) + ' / ' + (t.field.indexOf('送料')>=0?'送料='+curShip:t.field.indexOf('関税')>=0?'関税='+curTax:'') + ' / 請求総額=' + curTotal);
    L('    変更後: 明細合計=' + newSubtotal + ' / ' + t.field + '=' + (t.addTo?curTax+t.newVal:t.newVal) + ' / 請求総額=' + newTotal +
      (Math.abs(newTotal - curTotal) < 0.01 ? ' ← 変化なし ✓' : ' ← 差=' + (newTotal-curTotal)));
    L('');
  });

  // ─── C. 削除対象 ───
  L('════════════════════════════════════');
  L('[C] 明細 削除対象 20行');
  L('════════════════════════════════════');
  L('  非商品6件: ODL-00078 / ODL-00250 / ODL-00319 / ODL-00320 / ODL-00321 / ODL-00353');
  L('  OD-00100空行14件: ODL-00217〜ODL-00230');
  L('  削除後行数: ' + olData.length + ' - 20 = ' + (olData.length - 20) + '件（期待: 575）');
  L('');

  // ─── D. 請求総額計算式 ───
  L('════════════════════════════════════');
  L('[D] 請求総額 計算式（再計算対象: 影響オーダーのみ）');
  L('  col14 = col11 + col12 + col13 + col34 - col35');
  L('  (明細合計 + 送料 + 関税 + その他手数料 − 値引き)');
  L('');

  // ─── E. 検証予定 ───
  L('════════════════════════════════════');
  L('[E] 検証予定');
  L('  明細行数: ' + (olData.length - 20) + '件（期待: 575）');
  L('  商品ID記入: 575件 / 空欄: 0件（ODL-00232はPM0178記入済み）');
  L('  影響オーダー col14 変化なし:');
  ['OD-00046','OD-00107','OD-00123','OD-00132'].forEach(function(odId) {
    var r = omMap[odId];
    if (!r) return;
    L('    ' + odId + ': 現 col14=' + (Number(r[CI_TOTAL])||0));
  });
  L('');
  L('=== dryRunOrderMgmtChanges 完了 ===');
  return out.join('\n');
}

// ============================================================
// CONFIRM EXEC: A〜E 全実行
// ============================================================
function execOrderMgmtChanges() {
  var out = [];
  function L(s) { out.push(s); }
  L('=== execOrderMgmtChanges ===');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var olSh  = crmSS.getSheetByName('オーダー明細');

  var omCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omCols).getValues()[0].map(function(h){ return String(h).trim(); });
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();

  var CI_OD    = _npnFindCol(omHeaders, ['オーダーID','orderid','order_id']); if (CI_OD  < 0) CI_OD  = 0;
  var CI_SUB11 = _npnFindCol(omHeaders, ['明細合計']);                        if (CI_SUB11< 0) CI_SUB11=10;
  var CI_SHIP  = _npnFindCol(omHeaders, ['送料','shipping']);                 if (CI_SHIP < 0) CI_SHIP=11;
  var CI_TAX   = _npnFindCol(omHeaders, ['関税','customs','tax']);            if (CI_TAX  < 0) CI_TAX =12;
  var CI_TOTAL = _npnFindCol(omHeaders, ['請求総額','合計','total']);          if (CI_TOTAL< 0) CI_TOTAL=13;

  // オーダーID → シート行番号（1-based）マップ
  var omRowMap = {};
  omData.forEach(function(r, i){ omRowMap[String(r[CI_OD]||'').trim()] = i + 2; });

  // 既存 col14 を記録（不変確認用）
  var beforeTotal = {};
  omData.forEach(function(r){ beforeTotal[String(r[CI_OD]||'').trim()] = Number(r[CI_TOTAL])||0; });

  // ─── A. 2列追加 ───
  L('[A] 2列追加...');
  omSh.getRange(1, 34).setValue('その他手数料');
  omSh.getRange(1, 35).setValue('値引き');
  var numOmRows = omData.length;
  var initArr = []; for (var z=0; z<numOmRows; z++) initArr.push([0, 0]);
  omSh.getRange(2, 34, numOmRows, 2).setValues(initArr);
  SpreadsheetApp.flush();
  L('  → col34「その他手数料」/ col35「値引き」追加・全' + numOmRows + '行を0で初期化');

  // ─── B. 移設 ───
  L('[B] 移設...');
  var r46  = omRowMap['OD-00046'];
  var r107 = omRowMap['OD-00107'];
  var r123 = omRowMap['OD-00123'];
  var r132 = omRowMap['OD-00132'];

  // OD-00046: 送料=5500
  if (r46)  { omSh.getRange(r46,  CI_SHIP+1).setValue(5500);  L('  OD-00046: 送料=5500'); }
  // OD-00107: 値引き=29000
  if (r107) { omSh.getRange(r107, 35).setValue(29000); L('  OD-00107: 値引き=29000'); }
  // OD-00123: 関税+=4400, その他手数料=7730
  if (r123) {
    var curTax = Number(omSh.getRange(r123, CI_TAX+1).getValue()) || 0;
    omSh.getRange(r123, CI_TAX+1).setValue(curTax + 4400);
    omSh.getRange(r123, 34).setValue(7730);
    L('  OD-00123: 関税=' + (curTax+4400) + ' / その他手数料=7730');
  }
  // OD-00132: 値引き=1200
  if (r132) { omSh.getRange(r132, 35).setValue(1200); L('  OD-00132: 値引き=1200'); }
  SpreadsheetApp.flush();

  // ─── C. 明細 行削除 ───
  L('[C] 明細 20行削除...');
  var deleteOdlIds = {
    'ODL-00078':1,'ODL-00250':1,'ODL-00319':1,'ODL-00320':1,'ODL-00321':1,'ODL-00353':1,
    'ODL-00217':1,'ODL-00218':1,'ODL-00219':1,'ODL-00220':1,'ODL-00221':1,'ODL-00222':1,
    'ODL-00223':1,'ODL-00224':1,'ODL-00225':1,'ODL-00226':1,'ODL-00227':1,'ODL-00228':1,
    'ODL-00229':1,'ODL-00230':1
  };
  var olData2 = olSh.getRange(2, 1, olSh.getLastRow()-1, 1).getValues();
  var deleteRows = [];
  olData2.forEach(function(r, i) {
    if (deleteOdlIds[String(r[0]||'').trim()]) deleteRows.push(i + 2);
  });
  deleteRows.sort(function(a,b){ return b-a; });
  deleteRows.forEach(function(rn){ olSh.deleteRow(rn); });
  SpreadsheetApp.flush();
  var afterOlRows = olSh.getLastRow() - 1;
  L('  削除: ' + deleteRows.length + '行 / 残: ' + afterOlRows + '行（期待: 575）' + (afterOlRows===575?' OK':' NG'));

  // ─── D. 明細合計・請求総額 再計算 ───
  L('[D] 明細合計・請求総額 再計算...');
  var affectedOrders = ['OD-00046','OD-00100','OD-00107','OD-00123','OD-00132'];
  var olAfterData = olSh.getRange(2, 1, afterOlRows, olSh.getLastColumn()).getValues();
  var newSubMap = {};
  olAfterData.forEach(function(r) {
    var odId = String(r[1]||'').trim();
    var sub = parseFloat(r[9]) || 0;
    newSubMap[odId] = (newSubMap[odId]||0) + sub;
  });

  affectedOrders.forEach(function(odId) {
    var rn = omRowMap[odId]; if (!rn) return;
    var newSub = newSubMap[odId] || 0;
    omSh.getRange(rn, CI_SUB11+1).setValue(newSub);
    SpreadsheetApp.flush();
    var row35 = omSh.getRange(rn, 1, 1, 35).getValues()[0];
    var sub   = parseFloat(row35[CI_SUB11]) || 0;
    var ship  = parseFloat(row35[CI_SHIP])  || 0;
    var tax   = parseFloat(row35[CI_TAX])   || 0;
    var other = parseFloat(row35[33])       || 0;
    var disc  = parseFloat(row35[34])       || 0;
    var newTotal = sub + ship + tax + other - disc;
    omSh.getRange(rn, CI_TOTAL+1).setValue(newTotal);
    SpreadsheetApp.flush();
    var oldTotal = beforeTotal[odId] || 0;
    L('  ' + odId + ': 請求総額 ' + oldTotal + ' → ' + newTotal + (Math.abs(newTotal-oldTotal)<0.01?' OK':' NG 差='+(newTotal-oldTotal)));
  });

  // ─── E. 検証 ───
  L('');
  L('════════════════════════════════════');
  L('[E] 最終検証');
  L('════════════════════════════════════');
  // 明細行数
  var finalOlRows = olSh.getLastRow() - 1;
  L('明細行数: ' + finalOlRows + '（期待: 575）' + (finalOlRows===575?' OK':' NG'));

  // 商品ID件数
  var olFinal = olSh.getRange(2, 1, finalOlRows, olSh.getLastColumn()).getValues();
  var pmFilled=0, pmBlank=0;
  olFinal.forEach(function(r){ if(String(r[10]||'').trim()) pmFilled++; else pmBlank++; });
  L('商品ID記入: ' + pmFilled + '件（期待: 575）' + (pmFilled===575?' OK':' NG'));
  L('商品ID空欄: ' + pmBlank + '件（期待: 0）'  + (pmBlank===0?' OK':' NG'));

  // オーダー管理 列数
  var finalOmCols = omSh.getLastColumn();
  L('オーダー管理 列数: ' + finalOmCols + '列（期待: 35）' + (finalOmCols===35?' OK':' NG'));

  L('');
  L('=== execOrderMgmtChanges 完了 ===');
  return out.join('\n');
}

// ============================================================
// execFixODL00232 — ODL-00232 に PM0178 + 商品名を書き込む
// ============================================================
function execFixODL00232() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== execFixODL00232 ===');

  var crmSS = getSpreadsheet();
  var olSh  = crmSS.getSheetByName('オーダー明細');

  var olData = olSh.getRange(2, 1, olSh.getLastRow()-1, olSh.getLastColumn()).getValues();
  var targetRow = -1;
  for (var i=0; i<olData.length; i++) {
    if (String(olData[i][0]||'').trim() === 'ODL-00232') { targetRow = i + 2; break; }
  }
  if (targetRow < 0) { L('ERROR: ODL-00232 が見つからない'); return out.join('\n'); }

  var rowData = olData[targetRow - 2];
  var beforeName  = String(rowData[4]  || '').trim();  // col5  商品名
  var beforePmId  = String(rowData[10] || '').trim();  // col11 商品ID

  L('対象行: row=' + targetRow);
  L('BEFORE:');
  L('  col5  商品名: "' + beforeName  + '"');
  L('  col11 商品ID: "' + beforePmId  + '"');

  var newName = 'Pokemon card Pikachu McDonald\'s promo card';
  var newPmId = 'PM0178';

  olSh.getRange(targetRow, 5).setValue(newName);
  olSh.getRange(targetRow, 11).setValue(newPmId);
  SpreadsheetApp.flush();

  var afterName  = String(olSh.getRange(targetRow, 5).getValue()).trim();
  var afterPmId  = String(olSh.getRange(targetRow, 11).getValue()).trim();

  L('AFTER:');
  L('  col5  商品名: "' + afterName  + '"' + (afterName  === newName  ? ' OK' : ' NG'));
  L('  col11 商品ID: "' + afterPmId  + '"' + (afterPmId  === newPmId  ? ' OK' : ' NG'));

  // 商品ID 総数検証
  var olAll = olSh.getRange(2, 1, olSh.getLastRow()-1, olSh.getLastColumn()).getValues();
  var filled=0, blank=0;
  olAll.forEach(function(r){ if(String(r[10]||'').trim()) filled++; else blank++; });
  L('');
  L('商品ID 記入: ' + filled + '件（期待: 575）' + (filled===575?' OK':' NG'));
  L('商品ID 空欄: ' + blank  + '件（期待: 0）'  + (blank ===0 ?' OK':' NG'));

  L('=== execFixODL00232 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateGundamActual — PM0171/0192/0205 の現在値読み出し
// ============================================================
function investigateGundamActual() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== investigateGundamActual ===');

  var ss   = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');

  var pmData = pmSh.getRange(2, 1, pmSh.getLastRow()-1, pmSh.getLastColumn()).getValues();
  var targets = ['PM0171','PM0192','PM0205'];
  var mismatch = [];

  targets.forEach(function(pid) {
    var row = null;
    for (var i=0; i<pmData.length; i++) {
      if (String(pmData[i][0]||'').trim() === pid) { row = pmData[i]; break; }
    }
    if (!row) { L(pid + ': NOT FOUND'); return; }

    var pmId   = String(row[0] ||'').trim();
    var mark   = String(row[2] ||'').trim();
    var jaTitle= String(row[3] ||'').trim();
    var enTitle= String(row[4] ||'').trim();
    var ipId   = String(row[21]||'').trim();  // idx21=col22 作品ID
    var mkId   = String(row[22]||'').trim();  // idx22=col23 メーカーID

    L('');
    L(pmId + ':');
    L('  Mark      : ' + mark);
    L('  JA Title  : ' + jaTitle);
    L('  EN Title  : ' + enTitle);
    L('  col22 作品ID  : ' + ipId);
    L('  col23 メーカーID: ' + mkId + (mkId==='MK004' ? ' ← MK002要修正' : (mkId==='MK002' ? ' OK' : ' [?]')));

    if (mkId === 'MK004') mismatch.push(pmId);
  });

  L('');
  if (mismatch.length > 0) {
    L('【DRY RUN】MK004→MK002 修正対象: ' + mismatch.join(', '));
    mismatch.forEach(function(pid) {
      L('  ' + pid + ': col23 "MK004" → "MK002"');
    });
    L('→ execGundamMKFix() で適用予定');
  } else {
    L('全件 col23=MK002 または確認不要 → 修正不要');
  }

  L('=== investigateGundamActual 完了 ===');
  return out.join('\n');
}

// ============================================================
// execGundamMKFix — MK004→MK002 修正（investigateGundamActual でMK004が確認されたとき）
// ============================================================
function execGundamMKFix() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== execGundamMKFix ===');

  var ss   = SpreadsheetApp.openById(INV_BOOK_ID);
  var pmSh = ss.getSheetByName('商品マスタ');

  var pmData = pmSh.getRange(2, 1, pmSh.getLastRow()-1, pmSh.getLastColumn()).getValues();
  var targets = ['PM0171','PM0192','PM0205'];
  var fixed = 0, skipped = 0;

  targets.forEach(function(pid) {
    var rowIdx = -1;
    for (var i=0; i<pmData.length; i++) {
      if (String(pmData[i][0]||'').trim() === pid) { rowIdx = i; break; }
    }
    if (rowIdx < 0) { L(pid + ': NOT FOUND'); return; }

    var mkId = String(pmData[rowIdx][22]||'').trim();
    if (mkId !== 'MK004') {
      L(pid + ': col23=' + mkId + ' → スキップ（MK004でない）');
      skipped++;
      return;
    }

    var sheetRow = rowIdx + 2;  // 1-based, +1 for header
    pmSh.getRange(sheetRow, 23).setValue('MK002');
    SpreadsheetApp.flush();
    var after = String(pmSh.getRange(sheetRow, 23).getValue()).trim();
    L(pid + ': col23 MK004 → ' + after + (after==='MK002'?' OK':' NG'));
    fixed++;
  });

  L('');
  L('修正: ' + fixed + '件 / スキップ: ' + skipped + '件');
  L('=== execGundamMKFix 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateSheetList — CRM + INV_BOOK の全シート一覧
// ============================================================
function investigateSheetList() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== investigateSheetList ===');

  var crmSS = getSpreadsheet();
  L('[CRM] シート一覧:');
  crmSS.getSheets().forEach(function(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var h1 = lastCol > 0 && lastRow > 0 ? sh.getRange(1,1,1, Math.min(lastCol,20)).getValues()[0].map(function(v){ return String(v||'').trim(); }).filter(function(v){ return v; }).join(' | ') : '';
    L('  "' + sh.getName() + '"  rows=' + lastRow + '  cols=' + lastCol);
    if (h1) L('    headers: ' + h1);
  });

  L('');
  var invSS = SpreadsheetApp.openById(INV_BOOK_ID);
  L('[INV_BOOK] シート一覧:');
  invSS.getSheets().forEach(function(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var h1 = lastCol > 0 && lastRow > 0 ? sh.getRange(1,1,1, Math.min(lastCol,20)).getValues()[0].map(function(v){ return String(v||'').trim(); }).filter(function(v){ return v; }).join(' | ') : '';
    L('  "' + sh.getName() + '"  rows=' + lastRow + '  cols=' + lastCol);
    if (h1) L('    headers: ' + h1);
  });

  L('=== investigateSheetList 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateSalesData — 📊売上データ構造確認
// ============================================================
function investigateSalesData() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== investigateSalesData ===');

  var crmSS = getSpreadsheet();
  var sh = crmSS.getSheetByName('📊売上データ');
  if (!sh) { L('ERROR: シートが見つかりません'); return out.join('\n'); }

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  L('rows=' + lastRow + '  cols=' + lastCol);

  // 1行目 (ヘッダー行) 全列
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  L('');
  L('--- ヘッダー行 (全' + lastCol + '列) ---');
  headers.forEach(function(h, i) {
    var v = String(h||'').trim();
    if (v) L('  col' + (i+1) + ': "' + v + '"');
  });

  L('');
  // col14 の内容を確認
  var col14Header = String(headers[13]||'').trim();
  L('col14 ヘッダー: "' + col14Header + '"');

  // 2行目以降で col14 に値がある行を収集
  var data = sh.getRange(2, 1, lastRow-1, Math.min(lastCol, 20)).getValues();
  L('');
  L('--- col14 に値がある行（先頭20列表示）---');
  var cnt = 0;
  data.forEach(function(r, i) {
    var v14 = String(r[13]||'').trim();
    if (!v14) return;
    cnt++;
    var preview = r.slice(0, 20).map(function(v, ci) {
      var s = (v instanceof Date) ? v.toISOString().slice(0,10) : String(v===null||v===undefined?'':v).trim();
      return s ? ('col'+(ci+1)+'='+s) : '';
    }).filter(function(s){return s;}).join(' | ');
    L('  row' + (i+2) + ': ' + preview);
  });
  L('col14 に値がある行数: ' + cnt);

  L('=== investigateSalesData 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateSalesAudit8 — 売上データ col14 × オーダー管理 請求総額 照合
// ============================================================
function investigateSalesAudit8() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== investigateSalesAudit8 ===');

  var crmSS = getSpreadsheet();

  // ─── オーダー管理 読み込み ───
  var omSh   = crmSS.getSheetByName('オーダー管理');
  var omCols = omSh.getLastColumn();
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();
  // col1=オーダーID(idx0), col2=請求書番号(idx1), col14=請求総額(idx13)
  // ただし今回 A実行後は col14=請求総額=idx13 は変わらず
  var omByInv = {};   // 請求書番号 → { odId, 請求総額 }
  var omById  = {};   // オーダーID → { 請求書番号, 請求総額 }
  omData.forEach(function(r) {
    var odId  = String(r[0]||'').trim();
    var inv   = String(r[1]||'').trim();
    var total = parseFloat(r[13]) || 0;
    if (odId)  omById[odId]   = { inv: inv, total: total };
    if (inv)   omByInv[inv]   = { odId: odId, total: total };
    // also index without suffix (-01, -02 etc.)
    if (inv) {
      var base = inv.replace(/-\d+$/, '');
      if (base !== inv && !omByInv[base]) omByInv[base] = { odId: odId, total: total };
    }
  });

  // ─── 売上データ 読み込み（行6以降がデータ行）───
  var sdSh   = crmSS.getSheetByName('📊売上データ');
  var sdCols = sdSh.getLastColumn();
  var sdData = sdSh.getLastRow() >= 6
    ? sdSh.getRange(6, 1, sdSh.getLastRow()-5, sdCols).getValues()
    : [];

  // col12=請求書番号(idx11), col14=合計(idx13)
  L('');
  L('--- 売上データ col14(合計) が入っている行との照合 ---');
  var matchOK = 0, matchNG = 0, noMatch = 0;
  var auditRows = [];

  sdData.forEach(function(r, i) {
    var shRow  = i + 6;
    var inv    = String(r[11]||'').trim();   // col12
    var sdTot  = String(r[13]||'').trim();   // col14 合計
    if (!sdTot || !inv) return;

    var sdVal  = parseFloat(sdTot.replace(/[^0-9.-]/g, '')) || 0;
    var status = String(r[0]||'').trim();    // col1
    var name   = String(r[7]||'').trim();    // col8 商品名

    // オーダー管理と照合（売上データの -NN サフィックスも除去して検索）
    var baseInv = inv.replace(/-\d+$/, '');
    var om = omByInv[inv] || omByInv[baseInv];
    var result, diff;
    if (om) {
      diff = om.total - sdVal;
      result = Math.abs(diff) < 1 ? 'OK' : 'NG(差=' + diff + ')';
      if (Math.abs(diff) < 1) matchOK++; else matchNG++;
    } else {
      result = 'NOT_IN_CRM';
      noMatch++;
    }
    auditRows.push({ shRow: shRow, inv: inv, status: status, name: name, sdTot: sdVal, om: om, result: result });
  });

  auditRows.forEach(function(a) {
    L('row' + a.shRow + ' ' + a.inv + ' [' + a.status + '] 商品="' + a.name + '"');
    L('  売上データ 合計: ' + a.sdTot);
    if (a.om) {
      L('  オーダー管理 請求総額: ' + a.om.total + '  オーダーID=' + a.om.odId + '  → ' + a.result);
    } else {
      L('  → ' + a.result);
    }
  });

  L('');
  L('════════════════════════════════════');
  L('照合結果サマリー:');
  L('  一致(OK): ' + matchOK + '件');
  L('  不一致(NG): ' + matchNG + '件');
  L('  CRM未登録: ' + noMatch + '件');
  L('  合計: ' + auditRows.length + '件');
  L('=== investigateSalesAudit8 完了 ===');
  return out.join('\n');
}

// ============================================================
// postConfirmAudit — execOrderMgmtChanges 後の総合検証
// ============================================================
function postConfirmAudit() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== postConfirmAudit ===');

  var crmSS = getSpreadsheet();
  var olSh  = crmSS.getSheetByName('オーダー明細');
  var omSh  = crmSS.getSheetByName('オーダー管理');

  // [1] 明細 検証
  L('[1] 明細 検証');
  var olData = olSh.getRange(2, 1, olSh.getLastRow()-1, olSh.getLastColumn()).getValues();
  var totalRows = olData.length;
  var pmFilled=0, pmBlank=0;
  var odl232Found = false, odl232PmId = '';
  olData.forEach(function(r) {
    var odlId = String(r[0]||'').trim();
    var pmId  = String(r[10]||'').trim();
    if (pmId) pmFilled++; else pmBlank++;
    if (odlId === 'ODL-00232') { odl232Found = true; odl232PmId = pmId; }
  });
  L('  明細行数: '  + totalRows + '（期待: 575）' + (totalRows===575?' OK':' NG'));
  L('  商品ID記入: ' + pmFilled  + '件（期待: 575）' + (pmFilled===575?' OK':' NG'));
  L('  商品ID空欄: ' + pmBlank   + '件（期待: 0）'   + (pmBlank===0?' OK':' NG'));
  L('  ODL-00232 商品ID: "' + odl232PmId + '"（期待: PM0178）' + (odl232PmId==='PM0178'?' OK':' NG'));

  // [2] オーダー管理 列数
  L('');
  L('[2] オーダー管理 列数');
  var omCols = omSh.getLastColumn();
  L('  列数: ' + omCols + '（期待: 35）' + (omCols===35?' OK':' NG'));

  // [3] 影響オーダー 請求総額
  L('');
  L('[3] 影響オーダー 請求総額');
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, 35).getValues();
  var expected = { 'OD-00046': 5500, 'OD-00107': 81400, 'OD-00123': 56380, 'OD-00132': 693000 };
  omData.forEach(function(r) {
    var odId = String(r[0]||'').trim();
    if (!expected.hasOwnProperty(odId)) return;
    var total = parseFloat(r[13]) || 0;
    var exp   = expected[odId];
    L('  ' + odId + ': ' + total + '（期待: ' + exp + '）' + (Math.abs(total-exp)<1?' OK':' NG'));
  });

  L('=== postConfirmAudit 完了 ===');
  return out.join('\n');
}

// ============================================================
// diagAndFixOrderTotals — col34/35確認 + 請求総額 再計算
// ============================================================
function diagAndFixOrderTotals() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== diagAndFixOrderTotals ===');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var olSh  = crmSS.getSheetByName('オーダー明細');

  var omCols = omSh.getLastColumn();
  var omHeaders = omSh.getRange(1, 1, 1, omCols).getValues()[0].map(function(h){ return String(h||'').trim(); });
  var omData = omSh.getRange(2, 1, omSh.getLastRow()-1, omCols).getValues();
  L('オーダー管理 列数: ' + omCols + ' / ヘッダーcol34="' + omHeaders[33] + '" col35="' + omHeaders[34] + '"');

  var CI_OD    = 0;
  var CI_SUB11 = 10;
  var CI_SHIP  = 11;
  var CI_TAX   = 12;
  var CI_TOTAL = 13;

  var omRowMap = {};
  omData.forEach(function(r, i){ omRowMap[String(r[CI_OD]||'').trim()] = i + 2; });

  // ─── [1] 現在値の診断（個別セル読み取り）───
  L('');
  L('[1] 現在値（個別セル読み取り）:');
  var targets = ['OD-00046','OD-00107','OD-00123','OD-00132'];
  targets.forEach(function(odId) {
    var rn = omRowMap[odId]; if (!rn) { L('  ' + odId + ': NOT FOUND'); return; }
    var v11  = parseFloat(omSh.getRange(rn, 11).getValue()) || 0;
    var v12  = parseFloat(omSh.getRange(rn, 12).getValue()) || 0;
    var v13  = parseFloat(omSh.getRange(rn, 13).getValue()) || 0;
    var v14  = parseFloat(omSh.getRange(rn, 14).getValue()) || 0;
    var v34  = parseFloat(omSh.getRange(rn, 34).getValue()) || 0;
    var v35  = parseFloat(omSh.getRange(rn, 35).getValue()) || 0;
    L('  ' + odId + ' row=' + rn + ':');
    L('    col11(明細合計)=' + v11 + ' col12(送料)=' + v12 + ' col13(関税)=' + v13);
    L('    col14(請求総額)=' + v14);
    L('    col34(その他手数料)=' + v34 + ' col35(値引き)=' + v35);
  });

  // ─── [2] 正しい値を書き込む（B の内容を再適用）───
  L('');
  L('[2] col34/col35 正値を確認・再書き込み:');
  var corrections = {
    'OD-00046': { col34: 0,     col35: 0     },
    'OD-00107': { col34: 0,     col35: 29000 },
    'OD-00123': { col34: 7730,  col35: 0     },
    'OD-00132': { col34: 0,     col35: 1200  }
  };

  targets.forEach(function(odId) {
    var rn  = omRowMap[odId]; if (!rn) return;
    var exp = corrections[odId];
    var cur34 = parseFloat(omSh.getRange(rn, 34).getValue()) || 0;
    var cur35 = parseFloat(omSh.getRange(rn, 35).getValue()) || 0;
    if (cur34 !== exp.col34) { omSh.getRange(rn, 34).setValue(exp.col34); L('  ' + odId + ': col34 ' + cur34 + ' → ' + exp.col34); }
    else                     { L('  ' + odId + ': col34=' + cur34 + ' (already correct)'); }
    if (cur35 !== exp.col35) { omSh.getRange(rn, 35).setValue(exp.col35); L('  ' + odId + ': col35 ' + cur35 + ' → ' + exp.col35); }
    else                     { L('  ' + odId + ': col35=' + cur35 + ' (already correct)'); }
  });
  SpreadsheetApp.flush();

  // ─── [3] 明細合計 再計算 → 請求総額 再計算 ───
  L('');
  L('[3] 明細合計 → 請求総額 再計算:');
  var olRows = olSh.getLastRow() - 1;
  var olData = olSh.getRange(2, 1, olRows, olSh.getLastColumn()).getValues();
  var subMap = {};
  olData.forEach(function(r) {
    var odId = String(r[1]||'').trim();
    subMap[odId] = (subMap[odId]||0) + (parseFloat(r[9])||0);
  });

  var expectedTotals = { 'OD-00046': 5500, 'OD-00107': 81400, 'OD-00123': 56380, 'OD-00132': 693000 };
  targets.forEach(function(odId) {
    var rn = omRowMap[odId]; if (!rn) return;
    var newSub  = subMap[odId] || 0;
    omSh.getRange(rn, 11).setValue(newSub);
    SpreadsheetApp.flush();

    var sub   = parseFloat(omSh.getRange(rn, 11).getValue()) || 0;
    var ship  = parseFloat(omSh.getRange(rn, 12).getValue()) || 0;
    var tax   = parseFloat(omSh.getRange(rn, 13).getValue()) || 0;
    var other = parseFloat(omSh.getRange(rn, 34).getValue()) || 0;
    var disc  = parseFloat(omSh.getRange(rn, 35).getValue()) || 0;
    var newTotal = sub + ship + tax + other - disc;
    omSh.getRange(rn, 14).setValue(newTotal);
    SpreadsheetApp.flush();

    var exp = expectedTotals[odId];
    L('  ' + odId + ': 明細合計=' + sub + ' 送料=' + ship + ' 関税=' + tax + ' その他=' + other + ' 値引き=' + disc);
    L('    請求総額=' + newTotal + '（期待: ' + exp + '）' + (Math.abs(newTotal-exp)<1?' OK':' NG 差='+(newTotal-exp)));
  });

  L('=== diagAndFixOrderTotals 完了 ===');
  return out.join('\n');
}

// ============================================================
// hardFixOrderTotals — 正値を直接書き込み（読み取りなし）
// ============================================================
function hardFixOrderTotals() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== hardFixOrderTotals ===');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');

  // diagAndFixOrderTotals で判明したシート行番号を使用
  // OD-00046: row47  → 既に正値(5500) → スキップ
  // OD-00107: row108 → col35(値引き)=29000 / col14(請求総額)=81400
  // OD-00123: row124 → col34(その他手数料)=7730 / col14(請求総額)=56380
  // OD-00132: row133 → col35(値引き)=1200  / col14(請求総額)=693000

  var changes = [
    { odId: 'OD-00107', row: 108, col34: 0,    col35: 29000, col14: 81400  },
    { odId: 'OD-00123', row: 124, col34: 7730,  col35: 0,    col14: 56380  },
    { odId: 'OD-00132', row: 133, col34: 0,     col35: 1200, col14: 693000 }
  ];

  changes.forEach(function(c) {
    // col14 / col34 / col35 を同一行への個別書き込み（個別cellを直接指定）
    var r14  = omSh.getRange(c.row, 14);
    var r34  = omSh.getRange(c.row, 34);
    var r35  = omSh.getRange(c.row, 35);

    r34.setValue(c.col34);
    r35.setValue(c.col35);
    r14.setValue(c.col14);
    SpreadsheetApp.flush();

    // 個別セル再読み込みで検証
    var v14 = parseFloat(omSh.getRange(c.row, 14).getValue()) || 0;
    var v34 = parseFloat(omSh.getRange(c.row, 34).getValue()) || 0;
    var v35 = parseFloat(omSh.getRange(c.row, 35).getValue()) || 0;
    L(c.odId + ' (row=' + c.row + '):');
    L('  col34=' + v34 + '（期待: ' + c.col34 + '）' + (v34===c.col34?' OK':' NG'));
    L('  col35=' + v35 + '（期待: ' + c.col35 + '）' + (v35===c.col35?' OK':' NG'));
    L('  col14=' + v14 + '（期待: ' + c.col14 + '）' + (v14===c.col14?' OK':' NG'));
  });

  // OD-00046 確認のみ
  var v14_46 = parseFloat(omSh.getRange(47, 14).getValue()) || 0;
  L('OD-00046 (row=47): col14=' + v14_46 + '（期待: 5500）' + (Math.abs(v14_46-5500)<1?' OK':' NG'));

  L('');
  L('=== hardFixOrderTotals 完了 ===');
  return out.join('\n');
}

// ============================================================
// hardFixOrderTotals2 — setValues 2D配列で col34/35 を強制書き込み
// ============================================================
function hardFixOrderTotals2() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== hardFixOrderTotals2 ===');

  // 完全に新しい参照で開く
  var ss    = SpreadsheetApp.openById(getSpreadsheet().getId());
  var omSh  = ss.getSheetByName('オーダー管理');

  L('列数: ' + omSh.getLastColumn());

  // 修正対象: 行番号は diagAndFixOrderTotals で判明した値
  // OD-00107 row=108: col34=0, col35=29000
  // OD-00123 row=124: col34=7730, col35=0
  // OD-00132 row=133: col34=0,    col35=1200
  var targets = [
    { odId: 'OD-00107', row: 108, col34: 0,    col35: 29000 },
    { odId: 'OD-00123', row: 124, col34: 7730,  col35: 0    },
    { odId: 'OD-00132', row: 133, col34: 0,     col35: 1200 }
  ];

  targets.forEach(function(t) {
    // 2D配列で cols 34-35 を一括書き込み
    omSh.getRange(t.row, 34, 1, 2).setValues([[t.col34, t.col35]]);
    SpreadsheetApp.flush();

    // 即時読み取り（個別セル）
    var r34_v = omSh.getRange(t.row, 34).getValue();
    var r35_v = omSh.getRange(t.row, 35).getValue();
    L(t.odId + '(row=' + t.row + '): col34=' + r34_v + '(期待:' + t.col34 + ') col35=' + r35_v + '(期待:' + t.col35 + ')');

    // 2D配列でまとめ読み
    var batch = omSh.getRange(t.row, 34, 1, 2).getValues()[0];
    L('  batch read: [' + batch[0] + ', ' + batch[1] + ']');
  });

  L('');
  L('=== hardFixOrderTotals2 完了 ===');
  return out.join('\n');
}

// ============================================================
// hardFixOrderTotals3 — 書式を数値に変換してから正値を書き込み
// ============================================================
function hardFixOrderTotals3() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== hardFixOrderTotals3 ===');

  var ss   = SpreadsheetApp.openById(getSpreadsheet().getId());
  var omSh = ss.getSheetByName('オーダー管理');
  var numRows = omSh.getLastRow() - 1;  // data rows

  // [1] col34/col35 全行の書式を数値に変更
  L('[1] col34/col35 書式を数値（"0"）に変更...');
  omSh.getRange(1, 34, numRows + 1, 2).setNumberFormat('0');
  SpreadsheetApp.flush();
  L('  完了');

  // [2] 0 初期化（書式変更後に再設定）
  L('[2] col34/col35 全行を 0 で再初期化...');
  var initArr = [];
  for (var z = 0; z < numRows; z++) initArr.push([0, 0]);
  omSh.getRange(2, 34, numRows, 2).setValues(initArr);
  SpreadsheetApp.flush();
  L('  完了');

  // [3] 正値を書き込み
  L('[3] 正値書き込み...');
  // OD-00107 row=108: col35=29000
  // OD-00123 row=124: col34=7730
  // OD-00132 row=133: col35=1200
  omSh.getRange(108, 34, 1, 2).setValues([[0,     29000]]);
  omSh.getRange(124, 34, 1, 2).setValues([[7730,  0    ]]);
  omSh.getRange(133, 34, 1, 2).setValues([[0,     1200 ]]);
  SpreadsheetApp.flush();
  L('  完了');

  // [4] 即時検証
  L('[4] 検証（個別セル読み取り）:');
  var checks = [
    { odId: 'OD-00107', row: 108, e34: 0,    e35: 29000 },
    { odId: 'OD-00123', row: 124, e34: 7730,  e35: 0    },
    { odId: 'OD-00132', row: 133, e34: 0,     e35: 1200 }
  ];
  checks.forEach(function(c) {
    var v34 = omSh.getRange(c.row, 34).getValue();
    var v35 = omSh.getRange(c.row, 35).getValue();
    var n34 = (v34 instanceof Date) ? '(DATE!)' : String(v34);
    var n35 = (v35 instanceof Date) ? '(DATE!)' : String(v35);
    L(c.odId + ': col34=' + n34 + '(期待:' + c.e34 + ') col35=' + n35 + '(期待:' + c.e35 + ')');
  });

  // [5] 請求総額 再計算
  L('');
  L('[5] 請求総額 再計算:');
  var expected = { 108: { odId: 'OD-00107', total: 81400 },
                   124: { odId: 'OD-00123', total: 56380 },
                   133: { odId: 'OD-00132', total: 693000 } };
  Object.keys(expected).forEach(function(rn_str) {
    var rn = parseInt(rn_str);
    var e  = expected[rn_str];
    var sub   = Number(omSh.getRange(rn, 11).getValue()) || 0;
    var ship  = Number(omSh.getRange(rn, 12).getValue()) || 0;
    var tax   = Number(omSh.getRange(rn, 13).getValue()) || 0;
    var other = Number(omSh.getRange(rn, 34).getValue()) || 0;
    var disc  = Number(omSh.getRange(rn, 35).getValue()) || 0;
    var newTotal = sub + ship + tax + other - disc;
    omSh.getRange(rn, 14).setValue(newTotal);
    SpreadsheetApp.flush();
    L(e.odId + ': ' + sub + '+' + ship + '+' + tax + '+' + other + '-' + disc + '=' + newTotal + '（期待:' + e.total + '）' + (Math.abs(newTotal-e.total)<1?' OK':' NG'));
  });

  L('');
  L('OD-00046 (row=47): col14=' + (Number(omSh.getRange(47, 14).getValue())||0) + '（期待:5500）');
  L('=== hardFixOrderTotals3 完了 ===');
  return out.join('\n');
}

// ============================================================
// investigateOrderMgmtStatus — オーダー管理 4点調査（読み取り専用）
// ============================================================
function investigateOrderMgmtStatus() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== investigateOrderMgmtStatus ===');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var omCols = omSh.getLastColumn();
  var hdrs  = omSh.getRange(1,1,1,omCols).getValues()[0].map(function(h){ return String(h||'').trim(); });
  var data  = omSh.getRange(2,1,omSh.getLastRow()-1,omCols).getValues();

  function ci(names) {
    for (var i=0;i<names.length;i++) {
      var idx = hdrs.indexOf(names[i]);
      if (idx>=0) return idx;
    }
    return -1;
  }

  var C_STATUS = ci(['ステータス']);
  var C_RECD   = ci(['受注日']);
  var C_CUR    = ci(['通貨']);
  var C_FX     = ci(['為替レート']);
  var C_INV    = ci(['請求書番号']);
  var C_INVD   = ci(['請求書発行日']);
  var C_PAYD   = ci(['支払期日']);
  var C_RECV   = ci(['受注担当ID']);
  var C_SALES  = ci(['営業担当ID']);
  var C_備考   = ci(['取引備考欄']);
  var C_OD     = 0;

  L('列マッピング: ステータス=col'+(C_STATUS+1)+' 受注日=col'+(C_RECD+1)+' 通貨=col'+(C_CUR+1)+
    ' 為替=col'+(C_FX+1)+' 請求書発行日=col'+(C_INVD+1)+' 支払期日=col'+(C_PAYD+1)+
    ' 受注担当=col'+(C_RECV+1)+' 営業担当=col'+(C_SALES+1)+' 取引備考=col'+(C_備考+1));
  L('総行数: ' + data.length);
  L('');

  // ─── [1] キャンセル件数 + 取引備考欄 ───
  L('════════════════════════════════════');
  L('[1] ステータス=「キャンセル」の件数・取引備考欄');
  L('════════════════════════════════════');
  var cancelRows = [];
  data.forEach(function(r) {
    if (String(r[C_STATUS]||'').trim() === 'キャンセル') cancelRows.push(r);
  });
  L('件数: ' + cancelRows.length + '件');
  L('');
  cancelRows.forEach(function(r) {
    var odId  = String(r[C_OD]||'').trim();
    var inv   = C_INV>=0 ? String(r[C_INV]||'').trim() : '';
    var biko  = C_備考>=0 ? String(r[C_備考]||'').trim() : '';
    L('  ' + odId + ' (' + inv + '): 取引備考欄="' + biko + '"');
  });

  L('');
  // ─── [2] 受注日・請求書発行日 空欄 ───
  L('════════════════════════════════════');
  L('[2] 受注日・請求書発行日 空欄件数');
  L('════════════════════════════════════');
  var emptyRecd=[], emptyInvd=[], bothEmpty=[];
  data.forEach(function(r) {
    var odId = String(r[C_OD]||'').trim();
    var rd   = C_RECD>=0 ? r[C_RECD] : '';
    var id   = C_INVD>=0 ? r[C_INVD] : '';
    var rdEmpty = !rd || String(rd).trim()==='' || (rd instanceof Date && isNaN(rd));
    var idEmpty = !id || String(id).trim()==='' || (id instanceof Date && isNaN(id));
    if (rdEmpty) emptyRecd.push(odId);
    if (idEmpty) emptyInvd.push(odId);
    if (rdEmpty && idEmpty) bothEmpty.push(odId);
  });
  L('受注日 空欄: ' + emptyRecd.length + '件');
  if (emptyRecd.length > 0) L('  ' + emptyRecd.join(', '));
  L('請求書発行日 空欄: ' + emptyInvd.length + '件');
  if (emptyInvd.length > 0) L('  ' + emptyInvd.join(', '));
  L('両方空欄（補完不可）: ' + bothEmpty.length + '件');
  if (bothEmpty.length > 0) L('  ' + bothEmpty.join(', '));

  L('');
  // ─── [3] 為替レート 空欄 + 通貨内訳 ───
  L('════════════════════════════════════');
  L('[3] 為替レート 空欄件数 + 通貨内訳');
  L('════════════════════════════════════');
  var emptyFx = [], fxCurMap = {};
  data.forEach(function(r) {
    var odId = String(r[C_OD]||'').trim();
    var fx   = C_FX>=0  ? String(r[C_FX] ||'').trim() : '';
    var cur  = C_CUR>=0 ? String(r[C_CUR]||'').trim() : '';
    if (!fx || fx==='0' || fx==='') {
      emptyFx.push({ odId: odId, cur: cur });
      fxCurMap[cur] = (fxCurMap[cur]||0) + 1;
    }
  });
  L('為替レート 空欄: ' + emptyFx.length + '件');
  L('通貨別内訳:');
  Object.keys(fxCurMap).sort().forEach(function(c){ L('  ' + (c||'(空)') + ': ' + fxCurMap[c] + '件'); });
  if (emptyFx.length > 0) {
    L('対象オーダー:');
    emptyFx.forEach(function(x){ L('  ' + x.odId + ' 通貨=' + (x.cur||'(空)')); });
  }

  L('');
  // ─── [4] 営業担当ID 空欄 ───
  L('════════════════════════════════════');
  L('[4] 営業担当ID 空欄件数');
  L('════════════════════════════════════');
  var emptySales = [];
  data.forEach(function(r) {
    var odId  = String(r[C_OD]||'').trim();
    var sales = C_SALES>=0 ? String(r[C_SALES]||'').trim() : '';
    var recv  = C_RECV>=0  ? String(r[C_RECV] ||'').trim() : '';
    if (!sales) emptySales.push({ odId: odId, recv: recv });
  });
  L('営業担当ID 空欄: ' + emptySales.length + '件');
  if (emptySales.length > 0) {
    L('（空欄行の受注担当ID = D実行時のコピー元）:');
    emptySales.forEach(function(x){ L('  ' + x.odId + ' 受注担当=' + (x.recv||'(空)')); });
  }

  L('');
  L('=== investigateOrderMgmtStatus 完了 ===');
  return out.join('\n');
}

// ============================================================
// dryRunOrderMgmtFix — A〜E DRY RUN
// ============================================================
function dryRunOrderMgmtFix() {
  var out = [];
  function L(s){ out.push(s); }
  L('=== dryRunOrderMgmtFix (DRY RUN) ===');
  L('※ 書き込み一切なし');

  var crmSS = getSpreadsheet();
  var omSh  = crmSS.getSheetByName('オーダー管理');
  var omCols = omSh.getLastColumn();
  var hdrs  = omSh.getRange(1,1,1,omCols).getValues()[0].map(function(h){ return String(h||'').trim(); });
  var data  = omSh.getRange(2,1,omSh.getLastRow()-1,omCols).getValues();
  var numRows = data.length;

  function ci(names) {
    for (var i=0;i<names.length;i++) { var idx=hdrs.indexOf(names[i]); if(idx>=0) return idx; }
    return -1;
  }
  var C_OD    = 0;
  var C_INV   = ci(['請求書番号']);
  var C_ST    = ci(['ステータス']);
  var C_RECD  = ci(['受注日']);
  var C_CUR   = ci(['通貨']);
  var C_FX    = ci(['為替レート']);
  var C_SUB   = ci(['明細合計']);
  var C_SHIP  = ci(['送料']);
  var C_TAX   = ci(['関税']);
  var C_TOT   = ci(['請求総額']);
  var C_OTHER = 33;  // col34 その他手数料 (0-based)
  var C_DISC  = 34;  // col35 値引き
  var C_INVD  = ci(['請求書発行日']);
  var C_PAYD  = ci(['支払期日']);
  var C_RECV  = ci(['受注担当ID']);
  var C_SALES = ci(['営業担当ID']);

  L('現在の列数: ' + omCols + ' / 行数: ' + numRows);
  L('');

  // ─── [A] 受注日 補完 ───
  L('════════════════════════════════════');
  L('[A] 受注日 ← 請求書発行日で補完');
  L('════════════════════════════════════');
  var aFill=0, aSkipNoInvD=0;
  data.forEach(function(r) {
    var odId = String(r[C_OD]||'').trim();
    var rd   = r[C_RECD];
    var id   = r[C_INVD];
    var rdEmpty = !rd || (rd instanceof Date && isNaN(rd)) || String(rd).trim()==='';
    var idEmpty = !id || (id instanceof Date && isNaN(id)) || String(id).trim()==='';
    if (rdEmpty && !idEmpty) { aFill++; }
    if (rdEmpty && idEmpty)  { aSkipNoInvD++; }
  });
  L('補完予定: ' + aFill + '件（請求書発行日→受注日）');
  L('スキップ（発行日も空）: ' + aSkipNoInvD + '件 → 空のまま');

  L('');
  // ─── [B] 為替レート ───
  L('════════════════════════════════════');
  L('[B] 為替レート ← 通貨=JPYに "1" 設定');
  L('════════════════════════════════════');
  var bJpy=0, bOther=[];
  data.forEach(function(r) {
    var cur = String(r[C_CUR]||'').trim();
    var fx  = String(r[C_FX] ||'').trim();
    if (!fx || fx==='0') {
      if (cur==='JPY') bJpy++;
      else bOther.push(String(r[C_OD]||'').trim() + '(通貨=' + cur + ')');
    }
  });
  L('JPY → "1" 設定: ' + bJpy + '件');
  if (bOther.length>0) { L('他通貨 空欄（要確認）: ' + bOther.join(', ')); }
  else { L('他通貨 空欄: 0件'); }

  L('');
  // ─── [C] 支払サイト + 支払期日チェック ───
  L('════════════════════════════════════');
  L('[C] 支払サイト追加 + 支払期日 整合確認');
  L('════════════════════════════════════');
  L('選択肢マスタへ「支払サイト」列追加: 即日/2日後/7日後/14日後/30日後');
  L('オーダー管理 col' + (omCols+1) + ': 「支払サイト」追加・全' + numRows + '行="2日後"');
  L('');

  // 支払期日 vs 請求書発行日+2日 チェック
  var cMismatch=[], cBothEmpty=0, cInvdOnly=0;
  var siteDays = 2;
  data.forEach(function(r) {
    var odId = String(r[C_OD]||'').trim();
    var invD = r[C_INVD];
    var payD = r[C_PAYD];
    var invEmpty = !invD || (invD instanceof Date && isNaN(invD)) || String(invD).trim()==='';
    var payEmpty = !payD || (payD instanceof Date && isNaN(payD)) || String(payD).trim()==='';

    if (invEmpty && payEmpty) { cBothEmpty++; return; }
    if (!invEmpty && payEmpty) { cInvdOnly++; return; }  // will calculate new pay date

    if (!invEmpty && !payEmpty) {
      var invMs = (invD instanceof Date) ? invD.getTime() : new Date(invD).getTime();
      var payMs = (payD instanceof Date) ? payD.getTime() : new Date(payD).getTime();
      // expected = invD + siteDays
      var expD = new Date(invMs);
      expD.setDate(expD.getDate() + siteDays);
      // compare date-only (strip time)
      var expStr = expD.toISOString().slice(0,10);
      var actStr = new Date(payMs).toISOString().slice(0,10);
      if (expStr !== actStr) {
        cMismatch.push({ odId: odId, invD: new Date(invMs).toISOString().slice(0,10),
          payD: actStr, expD: expStr,
          diff: Math.round((payMs - (invMs + siteDays*86400000)) / 86400000) });
      }
    }
  });

  L('既存 支払期日 と (請求書発行日+2日) の照合:');
  L('  両方空欄: ' + cBothEmpty + '件（スキップ）');
  L('  発行日あり・支払期日空: ' + cInvdOnly + '件（新規計算）');
  if (cMismatch.length === 0) {
    L('  食い違いなし → 上書き OK');
  } else {
    L('  ★ 食い違い ' + cMismatch.length + '件 → STOP・上書きしない');
    cMismatch.forEach(function(m) {
      L('    ' + m.odId + ': 発行日=' + m.invD + ' 既存支払期日=' + m.payD +
        ' 期待(' + siteDays + '日後)=' + m.expD + ' 差=' + m.diff + '日');
    });
  }

  L('');
  // ─── [D] 営業担当ID 補完 ───
  L('════════════════════════════════════');
  L('[D] 営業担当ID ← 空欄行に受注担当IDをコピー');
  L('════════════════════════════════════');
  var dCopy=0, dSkipBothEmpty=0, dSkipHasSales=0;
  data.forEach(function(r) {
    var sales = String(r[C_SALES]||'').trim();
    var recv  = String(r[C_RECV] ||'').trim();
    if (sales)  { dSkipHasSales++; return; }
    if (!recv)  { dSkipBothEmpty++; return; }
    dCopy++;
  });
  L('営業担当ID がすでにある行: ' + dSkipHasSales + '件 → 絶対スキップ');
  L('両方空欄: ' + dSkipBothEmpty + '件 → スキップ');
  L('コピー予定（受注担当→営業担当）: ' + dCopy + '件');

  L('');
  // ─── [E] キャンセル列追加 + 候補一覧 ───
  L('════════════════════════════════════');
  L('[E] 新列 キャンセル理由(col' + (omCols+2) + ')・キャンセルメモ(col' + (omCols+3) + ')');
  L('════════════════════════════════════');
  var cancelCount=0;
  data.forEach(function(r){ if(String(r[C_ST]||'').trim()==='キャンセル') cancelCount++; });
  L('キャンセル行数: ' + cancelCount + '件（初期値: 空欄）');
  L('');
  L('選択肢マスタへ登録するキャンセル理由候補（確定はしんごさん判断）:');
  L('  ① 支払期日超過');
  L('  ② 顧客都合（予算不足）');
  L('  ③ 顧客都合（発注ミス）');
  L('  ④ 商品変更→再作成');
  L('  ⑤ 数量変更→再作成');
  L('  ⑥ 請求書修正→再作成（顧客要望）');
  L('  ⑦ 決済停止（外部要因）');
  L('  ⑧ 価格再調整→再発行');
  L('  ⑨ 社内ミス（請求書誤記）');
  L('  ⑩ 不明');

  L('');
  // ─── [検証] 金額列 不変確認 ───
  L('════════════════════════════════════');
  L('[検証] 金額列スナップショット（変化しないことを確認する基準値）');
  L('════════════════════════════════════');
  var totalSub=0, totalShip=0, totalTax=0, totalOther=0, totalDisc=0, totalTot=0;
  data.forEach(function(r) {
    totalSub   += parseFloat(r[C_SUB  ])||0;
    totalShip  += parseFloat(r[C_SHIP ])||0;
    totalTax   += parseFloat(r[C_TAX  ])||0;
    totalOther += parseFloat(r[C_OTHER])||0;
    totalDisc  += parseFloat(r[C_DISC ])||0;
    totalTot   += parseFloat(r[C_TOT  ])||0;
  });
  L('明細合計 合計: '     + totalSub);
  L('送料 合計: '         + totalShip);
  L('関税 合計: '         + totalTax);
  L('その他手数料 合計: ' + totalOther);
  L('値引き 合計: '       + totalDisc);
  L('請求総額 合計: '     + totalTot);
  L('オーダー行数: ' + numRows);

  L('');
  L('★ 食い違い件数: ' + cMismatch.length + '件');
  if (cMismatch.length > 0) {
    L('→ C実行を停止。食い違い行を確認後に指示を待つ');
  } else {
    L('→ 全チェック通過。CONFIRM 実行可');
  }
  L('=== dryRunOrderMgmtFix 完了 ===');
  return out.join('\n');
}
