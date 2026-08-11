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
