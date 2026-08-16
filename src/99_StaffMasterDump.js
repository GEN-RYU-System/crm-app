/**
 * 【読み取り専用】オーダー管理の「ステータス」列のプルダウン選択肢を返す
 * セル値・個人データは出力しない
 */
function checkOrderStatusDropdown() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('オーダー管理');
  if (!sh) { Logger.log('[NOT FOUND] オーダー管理'); return '[NOT FOUND]'; }

  var lastCol = sh.getLastColumn();
  if (lastCol < 1) { Logger.log('[EMPTY] オーダー管理'); return '[EMPTY]'; }

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var statusCol = headers.indexOf('ステータス');
  if (statusCol < 0) { Logger.log('[NOT FOUND] ステータス列'); return '[NOT FOUND] ステータス列'; }

  var lastRow = sh.getLastRow();
  var rules = sh.getRange(2, statusCol + 1, Math.max(lastRow - 1, 1), 1).getDataValidations();

  var firstRule = null;
  for (var k = 0; k < rules.length; k++) {
    if (rules[k][0] !== null) { firstRule = rules[k][0]; break; }
  }

  var out = [
    'シート: オーダー管理',
    'ステータス列: col' + (statusCol + 1),
    ''
  ];

  if (!firstRule) {
    out.push('プルダウン設定: なし');
  } else {
    try {
      var cv = firstRule.getCriteriaValues()[0];
      if (Array.isArray(cv)) {
        out.push('プルダウン選択肢 (' + cv.length + '件):');
        cv.forEach(function(v, i) { out.push('  ' + (i + 1) + '. ' + v); });
      } else {
        out.push('プルダウン: 範囲参照 (直接読み取り不可)');
      }
    } catch (e) {
      out.push('プルダウン: 取得エラー (' + e.message + ')');
    }
  }

  Logger.log(out.join('\n'));
  return out.join('\n');
}

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
