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
