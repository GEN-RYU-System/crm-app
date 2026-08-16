/**
 * 【読み取り専用】担当者マスタの1行目とプルダウン設定を読む
 * 氏名・メールなどのデータ行は出力しない
 */
function dumpStaffMaster() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('担当者マスタ');
  if (!sh) { Logger.log('[NOT FOUND] 担当者マスタ'); return '[NOT FOUND]'; }

  var c = sh.getLastColumn();
  var r = sh.getLastRow();
  if (c < 1) { Logger.log('[EMPTY] 担当者マスタ'); return '[EMPTY]'; }

  var h = sh.getRange(1, 1, 1, c).getValues()[0];
  var out = ['gid=' + sh.getSheetId() + ' / ' + r + '行 x ' + c + '列', ''];

  h.forEach(function(name, i) {
    var rules = sh.getRange(2, i + 1, Math.max(r - 1, 1), 1).getDataValidations();
    var firstRule = null;
    for (var k = 0; k < rules.length; k++) {
      if (rules[k][0] !== null) { firstRule = rules[k][0]; break; }
    }
    var opts = '';
    if (firstRule) {
      try {
        var cv = firstRule.getCriteriaValues()[0];
        opts = Array.isArray(cv) ? ' [' + cv.join(',') + ']' : ' [範囲参照]';
      } catch (e) { opts = ' [取得不可]'; }
    }
    out.push('col' + (i + 1) + ': "' + name + '"' + (firstRule ? ' ★プルダウン' + opts : ''));
  });

  out.push('');
  out.push('空ヘッダー数: ' + h.filter(function(x) { return String(x).trim() === ''; }).length);
  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【読み取り専用】選択肢マスタのヘッダー行・進捗ステータス値と
 * リード管理62列目の入力規則・リードステータス実値を調査する
 */
function inspectOptionsAndLeadStatus() {
  var ss = getSpreadsheet();
  var out = [];

  // ── 1. 選択肢マスタ ヘッダー行 ──
  var stSh = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!stSh) {
    out.push('[NOT FOUND] 選択肢マスタ');
  } else {
    var stData = stSh.getDataRange().getValues();
    var stHeaders = stData[0];
    out.push('=== 選択肢マスタ ヘッダー行 (' + stHeaders.length + '列) ===');
    stHeaders.forEach(function(h, i) {
      out.push('col' + (i + 1) + ': ' + JSON.stringify(String(h)));
    });

    // 進捗ステータス列 の全値
    var psIdx = stHeaders.indexOf('進捗ステータス');
    out.push('');
    out.push('=== 進捗ステータス列 (col' + (psIdx + 1) + ') ===');
    if (psIdx < 0) {
      out.push('[NOT FOUND] 進捗ステータス');
    } else {
      for (var r = 1; r < stData.length; r++) {
        var v = stData[r][psIdx];
        if (v !== '' && v !== null && v !== undefined) {
          out.push('row' + (r + 1) + ': ' + JSON.stringify(String(v)));
        }
      }
    }
  }

  // ── 2. リード管理 col62 入力規則 ──
  out.push('');
  out.push('=== リード管理 col62 入力規則 ===');
  var lSh = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  var lastCol = lSh ? lSh.getLastColumn() : 0;
  if (!lSh) {
    out.push('[NOT FOUND] リード管理');
  } else {
    out.push('lastColumn: ' + lastCol);
    if (lastCol >= 62) {
      var h62 = lSh.getRange(1, 62).getValue();
      out.push('col62 ヘッダー値: ' + JSON.stringify(String(h62)));
      try {
        var rule = lSh.getRange(2, 62).getDataValidation();
        if (!rule) {
          out.push('入力規則: なし');
        } else {
          out.push('入力規則 criteriaType: ' + rule.getCriteriaType().toString());
          try {
            var cv = rule.getCriteriaValues()[0];
            out.push('入力規則 values: ' + (Array.isArray(cv) ? JSON.stringify(cv) : '範囲参照'));
          } catch (e2) { out.push('入力規則 values 取得エラー: ' + e2.message); }
        }
      } catch (e) { out.push('入力規則取得エラー: ' + e.message); }
    } else {
      out.push('[WARN] col62 なし (lastColumn=' + lastCol + ')');
    }
  }

  // ── 3. DRY RUN: リードステータス実値 vs 更新後選択肢 ──
  out.push('');
  out.push('=== DRY RUN: リードステータス適合チェック ===');
  if (lSh && lastCol >= 62) {
    var lData = lSh.getDataRange().getValues();
    var lh = lData[0];
    var lsIdx = lh.indexOf('リードステータス');
    out.push('リードステータス列: ' + (lsIdx >= 0 ? 'col' + (lsIdx + 1) : '[NOT FOUND]'));

    if (lsIdx >= 0) {
      var counts = {};
      for (var i = 1; i < lData.length; i++) {
        var sv = String(lData[i][lsIdx] !== undefined && lData[i][lsIdx] !== null ? lData[i][lsIdx] : '');
        var key = sv === '' ? '（空欄）' : sv;
        counts[key] = (counts[key] || 0) + 1;
      }
      out.push('現在の全値と件数:');
      Object.keys(counts).sort().forEach(function(k) {
        out.push('  ' + JSON.stringify(k) + ': ' + counts[k] + '件');
      });

      // 更新後の選択肢: 進捗ステータス列から「対象外」を除き「商談対象外」「リード対象外」を追加
      var newOpts = ['新規', '対応中', 'アサイン確定', '商談中', '見積もり提示', '成約', '失注', '追客', 'アーカイブ', '商談対象外', 'リード対象外'];
      out.push('');
      out.push('更新後選択肢: ' + JSON.stringify(newOpts));
      var nonConforming = {};
      Object.keys(counts).forEach(function(k) {
        if (k !== '（空欄）' && newOpts.indexOf(k) < 0) {
          nonConforming[k] = counts[k];
        }
      });
      if (Object.keys(nonConforming).length === 0) {
        out.push('適合判定: 全件適合');
      } else {
        out.push('適合判定: ★非適合あり');
        Object.keys(nonConforming).forEach(function(k) {
          out.push('  非適合値 ' + JSON.stringify(k) + ': ' + nonConforming[k] + '件');
        });
      }
    } else {
      out.push('[INFO] リードステータス列が存在しないため適合チェックをスキップ');
    }
  }

  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【読み取り専用】担当者マスタの氏名系列と選択肢の充填状況
 * 氏名・メール等の値そのものは出力しない（件数のみ）
 */
function checkStaffNameColumns() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('担当者マスタ');
  if (!sh) { Logger.log('[NOT FOUND] 担当者マスタ'); return '[NOT FOUND]'; }

  var v = sh.getDataRange().getValues();
  var h = v[0];
  var idx = {
    staffId: h.indexOf('担当者ID'),
    last:    h.indexOf('苗字（日本語）'),
    first:   h.indexOf('名前（日本語）'),
    full:    h.indexOf('氏名（日本語）'),
    role:    h.indexOf('役割'),
    status:  h.indexOf('ステータス')
  };

  var stat = { rows: 0, last: 0, first: 0, full: 0, lastAndFirst: 0, fullOnly: 0 };
  var roleSet = {}, statusSet = {};

  v.slice(1).forEach(function(r) {
    var id = String(r[idx.staffId] || '').trim();
    if (!id) return;
    stat.rows++;
    var l = String(r[idx.last]  || '').trim() !== '';
    var f = String(r[idx.first] || '').trim() !== '';
    var u = String(r[idx.full]  || '').trim() !== '';
    if (l) stat.last++;
    if (f) stat.first++;
    if (u) stat.full++;
    if (l && f) stat.lastAndFirst++;
    if (u && !(l && f)) stat.fullOnly++;
    var role   = String(r[idx.role]   || '').trim();
    var status = String(r[idx.status] || '').trim();
    if (role)   roleSet[role]     = (roleSet[role] || 0) + 1;
    if (status) statusSet[status] = (statusSet[status] || 0) + 1;
  });

  var out = [
    '担当者ID入りの行数: ' + stat.rows,
    '',
    '[氏名系列の充填]',
    '  苗字（日本語）: ' + stat.last,
    '  名前（日本語）: ' + stat.first,
    '  氏名（日本語）: ' + stat.full,
    '  苗字+名前の両方あり: ' + stat.lastAndFirst,
    '  氏名のみ（苗字+名前が欠落）: ' + stat.fullOnly,
    '',
    '[役割の実値と件数]'
  ];
  Object.keys(roleSet).forEach(function(k) { out.push('  ' + k + ': ' + roleSet[k]); });
  out.push('');
  out.push('[ステータスの実値と件数]');
  Object.keys(statusSet).forEach(function(k) { out.push('  ' + k + ': ' + statusSet[k]); });

  Logger.log(out.join('\n'));
  return out.join('\n');
}
