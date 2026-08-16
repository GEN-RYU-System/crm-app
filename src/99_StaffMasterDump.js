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

/**
 * 【読み取り専用】選択肢マスタの構造を調査する
 * 1. 1行目ヘッダー行を列番号つきで全列出力
 * 2. 各列の値の個数（空欄を除く）
 * 3. 空ヘッダー列・重複ヘッダー列の検出
 * 4. DROPDOWN_COLUMNS（08_Config.js 定義の22列）との差分
 */
function inspectOptionsMasterStructure() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sh) { Logger.log('[NOT FOUND] 選択肢マスタ'); return '[NOT FOUND] 選択肢マスタ'; }

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var totalCols = headers.length;
  var totalRows = data.length;
  var out = [];

  out.push('=== 選択肢マスタ 基本情報 ===');
  out.push('シートID (gid): ' + sh.getSheetId());
  out.push('全行数: ' + totalRows + ' (ヘッダー含む)');
  out.push('全列数: ' + totalCols);
  out.push('');

  // 1. ヘッダー行（列番号付き全列）
  out.push('=== 1. ヘッダー行（全' + totalCols + '列）===');
  headers.forEach(function(h, i) {
    out.push('col' + (i + 1) + ': ' + JSON.stringify(String(h)));
  });
  out.push('');

  // 2. 各列の値の個数（空欄除く）
  out.push('=== 2. 各列の値の個数（空欄除く）===');
  headers.forEach(function(h, i) {
    var count = 0;
    for (var r = 1; r < data.length; r++) {
      var v = data[r][i];
      if (v !== '' && v !== null && v !== undefined) count++;
    }
    out.push('col' + (i + 1) + ' ' + JSON.stringify(String(h)) + ': ' + count + '件');
  });
  out.push('');

  // 3. 空ヘッダー列・重複ヘッダー列の検出
  out.push('=== 3. 空ヘッダー列・重複ヘッダー列 ===');
  var emptyHeaders = [];
  var seen = {};
  var duplicates = [];
  headers.forEach(function(h, i) {
    var s = String(h).trim();
    if (s === '') {
      emptyHeaders.push('col' + (i + 1));
    } else {
      if (seen[s] !== undefined) {
        duplicates.push('col' + (i + 1) + ' "' + s + '" (初出: col' + (seen[s] + 1) + ')');
      } else {
        seen[s] = i;
      }
    }
  });
  out.push('空ヘッダー列: ' + (emptyHeaders.length === 0 ? 'なし' : emptyHeaders.join(', ')));
  out.push('重複ヘッダー列: ' + (duplicates.length === 0 ? 'なし' : duplicates.join(', ')));
  out.push('');

  // 4. DROPDOWN_COLUMNS（08_Config.js 定義）との差分
  var DEFINED = [
    '流入経路（IN）', '流入経路（OUT）', '国', '温度感', '想定規模', '顧客タイプ', '返信速度', '連絡手段',
    'リードステータス', '次回アクション日', '取り扱いタイトル', '販売形態', '競合比較中', '購入頻度',
    '商談結果', '商談の手応え', 'アーカイブ理由', '対象外理由', '失注理由', '役割', 'ステータス', '期間タイプ'
  ];
  var sheetHeaderSet = {};
  headers.forEach(function(h) {
    var s = String(h).trim();
    if (s) sheetHeaderSet[s] = true;
  });

  var onlyInDefined = DEFINED.filter(function(k) { return !sheetHeaderSet[k]; });
  var onlyInSheet = Object.keys(sheetHeaderSet).filter(function(k) { return DEFINED.indexOf(k) < 0; });

  out.push('=== 4. DROPDOWN_COLUMNS（定義22列）vs 実物 ===');
  out.push('[定義にあってシートに無い列] (' + onlyInDefined.length + '件)');
  if (onlyInDefined.length === 0) {
    out.push('  なし');
  } else {
    onlyInDefined.forEach(function(k) { out.push('  - ' + JSON.stringify(k)); });
  }
  out.push('');
  out.push('[シートにあって定義に無い列] (' + onlyInSheet.length + '件)');
  if (onlyInSheet.length === 0) {
    out.push('  なし');
  } else {
    headers.forEach(function(h, i) {
      var s = String(h).trim();
      if (s && DEFINED.indexOf(s) < 0) {
        out.push('  col' + (i + 1) + ': ' + JSON.stringify(s));
      }
    });
  }

  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【DRY RUN / 読み取り専用】リード管理「リードステータス」列の実測値調査
 * - 値の分布（行数つき）
 * - 「新規」→「新規リード」の変換対象件数
 * - 変換後に全行が10値に収まるかチェック（合格条件: 全件適合）
 * - 空欄行数
 * 書き込みは一切行わない
 */
function dryRunLeadStatusConversion() {
  var TARGET_VALUES = [
    '新規リード', 'リード対応中', 'アサイン確定', 'リード対象外',
    '商談中', '商談対象外', '追客(短期)', '追客(長期)', '成約', '失注'
  ];
  var CONVERSION_MAP = { '新規': '新規リード' };

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('リード管理');
  if (!sh) { Logger.log('[NOT FOUND] リード管理'); return '[NOT FOUND] リード管理'; }

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIdx = headers.indexOf('リードステータス');

  if (colIdx < 0) {
    var msg = '[NOT FOUND] リードステータス列 (全' + lastCol + '列を検索)';
    Logger.log(msg);
    return msg;
  }

  var out = [
    '=== DRY RUN: リードステータス実測 ===',
    'シート: リード管理',
    'リードステータス列: col' + (colIdx + 1),
    '総行数（ヘッダー除く）: ' + (lastRow - 1),
    ''
  ];

  var rawValues = sh.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  var distribution = {};
  var emptyCount = 0;

  rawValues.forEach(function(row) {
    var v = String(row[0] || '').trim();
    if (v === '') {
      emptyCount++;
    } else {
      distribution[v] = (distribution[v] || 0) + 1;
    }
  });

  // 1. 実測値の分布
  out.push('=== 1. 実測値の分布 ===');
  var sortedKeys = Object.keys(distribution).sort(function(a, b) {
    return distribution[b] - distribution[a];
  });
  sortedKeys.forEach(function(k) { out.push('  ' + k + ': ' + distribution[k] + '行'); });
  out.push('  （空欄）: ' + emptyCount + '行');
  out.push('');

  // 2. 変換対象件数（新規 → 新規リード）
  out.push('=== 2. 変換対象件数 ===');
  var conversionTotal = 0;
  Object.keys(CONVERSION_MAP).forEach(function(from) {
    var to = CONVERSION_MAP[from];
    var count = distribution[from] || 0;
    out.push('  "' + from + '" → "' + to + '": ' + count + '行');
    conversionTotal += count;
  });
  out.push('  変換対象合計: ' + conversionTotal + '行');
  out.push('');

  // 3. 変換後に全件が10値に収まるか
  out.push('=== 3. 変換後の適合チェック ===');
  var targetSet = {};
  TARGET_VALUES.forEach(function(v) { targetSet[v] = true; });
  var nonConforming = [];
  sortedKeys.forEach(function(k) {
    var converted = CONVERSION_MAP[k] || k;
    if (!targetSet[converted]) {
      nonConforming.push('"' + k + '" → "' + converted + '" (' + distribution[k] + '行)');
    }
  });
  if (nonConforming.length === 0) {
    out.push('  判定: 全件適合');
    out.push('  （変換後、全' + (lastRow - 1 - emptyCount) + '行が10値のいずれかに収まる）');
  } else {
    out.push('  判定: 不適合あり');
    nonConforming.forEach(function(s) { out.push('  不適合: ' + s); });
  }
  out.push('');

  // 4. 空欄行数
  out.push('=== 4. 空欄行数 ===');
  out.push('  空欄: ' + emptyCount + '行');
  out.push('');

  out.push('--- DRY RUN 完了（書き込みなし）---');
  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【書き込みあり / DEV専用】リード管理「リードステータス」列の「新規」を「新規リード」に変換する
 *
 * 制約:
 * - 列は indexOf('リードステータス') で動的に特定（列番号直書き禁止）
 * - 「新規」のセルのみを個別に上書き（行全体・列全体の一括上書きは行わない）
 * - 実行前に対象行数=107を確認。107以外は中断して報告
 *
 * 実行後の検証:
 * - 62列目の分布を再取得して期待値と照合
 * - 「新規」が0行、合計379行が変わっていないことを確認
 */
function convertLeadStatusShinkikuToShinkiLead() {
  var EXPECTED_COUNT = 107;
  var FROM_VALUE = '新規';
  var TO_VALUE = '新規リード';
  var EXPECTED_DIST = {
    '新規リード': 107,
    '失注': 117,
    '成約': 51,
    'アサイン確定': 41,
    '商談中': 37,
    '商談対象外': 25,
    'リード対象外': 1
  };
  var EXPECTED_TOTAL = 379;

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('リード管理');
  if (!sh) { Logger.log('[NOT FOUND] リード管理'); return '[NOT FOUND] リード管理'; }

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIdx = headers.indexOf('リードステータス');

  if (colIdx < 0) {
    var notFound = '[NOT FOUND] リードステータス列 (全' + lastCol + '列を検索)';
    Logger.log(notFound);
    return notFound;
  }

  var dataRows = lastRow - 1;
  var rawValues = sh.getRange(2, colIdx + 1, dataRows, 1).getValues();

  // 変換対象行を収集（行番号はシート上の実際の行番号 = index + 2）
  var targetRows = [];
  rawValues.forEach(function(row, i) {
    var v = String(row[0] || '').trim();
    if (v === FROM_VALUE) {
      targetRows.push(i + 2); // 1-indexed, header=row1
    }
  });

  // 事前チェック: 対象行数が107でなければ中断
  if (targetRows.length !== EXPECTED_COUNT) {
    var abortMsg = '[ABORT] 対象行数が想定と異なります。想定=' + EXPECTED_COUNT + ', 実測=' + targetRows.length + '。書き込みを中断しました。';
    Logger.log(abortMsg);
    return abortMsg;
  }

  var out = [
    '=== convertLeadStatusShinkikuToShinkiLead 実行 ===',
    'リードステータス列: col' + (colIdx + 1),
    '変換: "' + FROM_VALUE + '" → "' + TO_VALUE + '"',
    '対象行数（事前確認済み）: ' + targetRows.length,
    ''
  ];

  // 対象セルのみを個別に書き換え
  targetRows.forEach(function(rowNum) {
    sh.getRange(rowNum, colIdx + 1).setValue(TO_VALUE);
  });

  out.push('[書き込み完了] ' + targetRows.length + '件を "' + TO_VALUE + '" に変換しました。');
  out.push('');

  // 実行後の検証: 分布を再取得
  var afterValues = sh.getRange(2, colIdx + 1, dataRows, 1).getValues();
  var afterDist = {};
  var afterEmpty = 0;
  afterValues.forEach(function(row) {
    var v = String(row[0] || '').trim();
    if (v === '') {
      afterEmpty++;
    } else {
      afterDist[v] = (afterDist[v] || 0) + 1;
    }
  });

  var afterTotal = 0;
  Object.keys(afterDist).forEach(function(k) { afterTotal += afterDist[k]; });

  out.push('=== 実行後の分布（実測） ===');
  var sortedAfter = Object.keys(afterDist).sort(function(a, b) { return afterDist[b] - afterDist[a]; });
  sortedAfter.forEach(function(k) { out.push('  ' + k + ': ' + afterDist[k] + '行'); });
  out.push('  （空欄）: ' + afterEmpty + '行');
  out.push('  合計（空欄除く）: ' + afterTotal + '行');
  out.push('');

  // 検証
  out.push('=== 検証 ===');
  var allOk = true;

  // 1. 「新規」が0行
  var shinkikuAfter = afterDist[FROM_VALUE] || 0;
  var check1 = shinkikuAfter === 0;
  out.push('  [' + (check1 ? 'OK' : 'NG') + '] "新規"が0行: 実測=' + shinkikuAfter);
  if (!check1) allOk = false;

  // 2. 合計379行が変わっていない
  var totalWithEmpty = afterTotal + afterEmpty;
  var check2 = totalWithEmpty === EXPECTED_TOTAL;
  out.push('  [' + (check2 ? 'OK' : 'NG') + '] 合計379行: 実測=' + totalWithEmpty);
  if (!check2) allOk = false;

  // 3. 分布が期待値と一致
  var distOk = true;
  Object.keys(EXPECTED_DIST).forEach(function(k) {
    var exp = EXPECTED_DIST[k];
    var act = afterDist[k] || 0;
    if (exp !== act) {
      out.push('  [NG] ' + k + ' 期待=' + exp + ' 実測=' + act);
      distOk = false;
      allOk = false;
    }
  });
  // 期待値に無いキーが出現していないか
  Object.keys(afterDist).forEach(function(k) {
    if (EXPECTED_DIST[k] === undefined) {
      out.push('  [NG] 想定外の値: "' + k + '" (' + afterDist[k] + '行)');
      distOk = false;
      allOk = false;
    }
  });
  if (distOk) {
    out.push('  [OK] 分布が期待値と一致');
  }

  out.push('');
  out.push('=== 最終判定: ' + (allOk ? '全項目OK ✓' : '異常あり ✗（上記NGを確認してください）') + ' ===');
  Logger.log(out.join('\n'));
  return out.join('\n');
}
