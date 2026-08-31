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
    staffId: h.indexOf('staff_id'),
    last:    h.indexOf('last_name_ja'),
    first:   h.indexOf('first_name_ja'),
    full:    h.indexOf('full_name_ja'),
    role:    h.indexOf('staff_role'),
    status:  h.indexOf('status')
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
 * 【書き込みあり / DEV専用】リード管理「リードステータス」列に入力規則（範囲参照型）を設定する
 *
 * 設定内容: 選択肢マスタ「リードステータス」列（headers.indexOf で動的に特定）の
 *           値が入っている行範囲を参照するプルダウン。値の直書きは行わない。
 * 無効値の入力時は「警告を表示」（setAllowInvalid(true)）とし、拒否しない。
 *
 * 事前確認（どちらか不合格なら中断）:
 *   1. 選択肢マスタ「リードステータス」列の値が10件であること
 *   2. リード管理「リードステータス」列の全データ行がその10値のいずれかであること
 *
 * 実行後の検証:
 *   - 入力規則が設定されたこと（getCriteriaType = VALUE_IN_RANGE）
 *   - setAllowInvalid(true) であること（警告のみ・拒否なし）
 *   - セルの値が変化していないこと（設定前後の分布比較）
 */
function setLeadStatusValidation() {
  var EXPECTED_OPTION_COUNT = 10;

  var ss = getSpreadsheet();
  var out = [];

  // =====================================================
  // 1. 事前確認: 選択肢マスタ「リードステータス」列
  // =====================================================
  out.push('=== 1. 事前確認: 選択肢マスタ ===');
  var optSh = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!optSh) {
    var m1 = '[ABORT] 選択肢マスタが見つかりません。';
    Logger.log(m1); return m1;
  }

  var optLastCol = optSh.getLastColumn();
  var optLastRow = optSh.getLastRow();
  var optHeaders = optSh.getRange(1, 1, 1, optLastCol).getValues()[0];
  var optColIdx = optHeaders.indexOf('リードステータス');
  if (optColIdx < 0) {
    var m2 = '[ABORT] 選択肢マスタに「リードステータス」列が見つかりません。';
    Logger.log(m2); return m2;
  }

  out.push('選択肢マスタ シートID: ' + optSh.getSheetId());
  out.push('リードステータス列: col' + (optColIdx + 1) + ' (' + String.fromCharCode(65 + optColIdx) + '列)');

  var optRaw = optSh.getRange(2, optColIdx + 1, optLastRow - 1, 1).getValues();
  var optValues = [];
  var optStartRow = -1;
  var optEndRow   = -1;
  for (var r = 0; r < optRaw.length; r++) {
    var v = String(optRaw[r][0] || '').trim();
    if (v !== '') {
      if (optStartRow < 0) optStartRow = r + 2; // 1-indexed シート行番号
      optEndRow = r + 2;
      optValues.push(v);
    }
  }

  out.push('選択肢件数: ' + optValues.length + '件 (期待値: ' + EXPECTED_OPTION_COUNT + ')');
  if (optValues.length !== EXPECTED_OPTION_COUNT) {
    out.push('[ABORT] 件数不一致のため中断します。');
    Logger.log(out.join('\n')); return out.join('\n');
  }

  out.push('選択肢の行範囲: 行' + optStartRow + '〜行' + optEndRow);
  optValues.forEach(function(v, i) { out.push('  ' + (i + 1) + '. ' + v); });
  out.push('[OK] 選択肢マスタ確認完了');
  out.push('');

  // =====================================================
  // 2. 事前確認: リード管理「リードステータス」列
  // =====================================================
  out.push('=== 2. 事前確認: リード管理 ===');
  var leadSh = ss.getSheetByName('リード管理');
  if (!leadSh) {
    var m3 = '[ABORT] リード管理シートが見つかりません。';
    Logger.log(m3); return m3;
  }

  var leadLastCol = leadSh.getLastColumn();
  var leadLastRow = leadSh.getLastRow();
  var leadHeaders = leadSh.getRange(1, 1, 1, leadLastCol).getValues()[0];
  var leadColIdx  = leadHeaders.indexOf('リードステータス');
  if (leadColIdx < 0) {
    var m4 = '[ABORT] リード管理に「リードステータス」列が見つかりません。';
    Logger.log(m4); return m4;
  }

  var dataRows = leadLastRow - 1;
  out.push('リードステータス列: col' + (leadColIdx + 1));
  out.push('データ行数: ' + dataRows + '行');

  var leadRaw = leadSh.getRange(2, leadColIdx + 1, dataRows, 1).getValues();
  var optSet = {};
  optValues.forEach(function(v) { optSet[v] = true; });

  var beforeDist = {};
  var nonConforming = [];
  var emptyCount = 0;
  leadRaw.forEach(function(row, i) {
    var v = String(row[0] || '').trim();
    if (v === '') {
      emptyCount++;
    } else {
      beforeDist[v] = (beforeDist[v] || 0) + 1;
      if (!optSet[v]) {
        nonConforming.push('行' + (i + 2) + ': "' + v + '"');
      }
    }
  });

  out.push('空欄行数: ' + emptyCount + '行');
  out.push('非適合行数: ' + nonConforming.length + '行');

  if (nonConforming.length > 0) {
    out.push('[ABORT] 非適合値が存在します。中断します。');
    nonConforming.slice(0, 20).forEach(function(s) { out.push('  ' + s); });
    if (nonConforming.length > 20) out.push('  ...省略 (' + (nonConforming.length - 20) + '件)');
    Logger.log(out.join('\n')); return out.join('\n');
  }

  out.push('[OK] 全データ行が10値のいずれかに適合');
  out.push('');

  // =====================================================
  // 3. 入力規則の設定
  // =====================================================
  out.push('=== 3. 入力規則の設定 ===');
  var validationSrcRange = optSh.getRange(optStartRow, optColIdx + 1, optValues.length, 1);
  out.push('参照範囲: 選択肢マスタ '
    + String.fromCharCode(65 + optColIdx) + optStartRow + ':'
    + String.fromCharCode(65 + optColIdx) + optEndRow);

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(validationSrcRange, true)
    .setAllowInvalid(true)   // 無効値は警告のみ（拒否しない）
    .build();

  leadSh.getRange(2, leadColIdx + 1, dataRows, 1).setDataValidation(rule);
  out.push('[設定完了] リード管理 col' + (leadColIdx + 1) + ' 行2〜行' + leadLastRow + ' に入力規則を設定しました。');
  out.push('');

  // =====================================================
  // 4. 実行後の検証
  // =====================================================
  out.push('=== 4. 実行後の検証 ===');

  var setRules = leadSh.getRange(2, leadColIdx + 1, dataRows, 1).getDataValidations();
  var firstSetRule = null;
  for (var k = 0; k < setRules.length; k++) {
    if (setRules[k][0] !== null) { firstSetRule = setRules[k][0]; break; }
  }

  var ruleExists = firstSetRule !== null;
  out.push('[' + (ruleExists ? 'OK' : 'NG') + '] 入力規則が設定されているか: ' + (ruleExists ? 'あり' : 'なし'));

  if (firstSetRule) {
    var criteriaType = firstSetRule.getCriteriaType();
    var isRange = criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE;
    out.push('[' + (isRange ? 'OK' : 'NG') + '] 規則タイプ: ' + criteriaType);
    var allowInvalid = firstSetRule.getAllowInvalid();
    out.push('[' + (allowInvalid ? 'OK' : 'NG') + '] setAllowInvalid（警告のみ・拒否なし）: ' + allowInvalid);
  }

  var afterRaw = leadSh.getRange(2, leadColIdx + 1, dataRows, 1).getValues();
  var afterDist = {};
  var afterEmpty = 0;
  afterRaw.forEach(function(row) {
    var v = String(row[0] || '').trim();
    if (v === '') { afterEmpty++; } else { afterDist[v] = (afterDist[v] || 0) + 1; }
  });

  var valuesUnchanged = true;
  Object.keys(beforeDist).forEach(function(k) {
    if (beforeDist[k] !== (afterDist[k] || 0)) valuesUnchanged = false;
  });
  Object.keys(afterDist).forEach(function(k) {
    if ((beforeDist[k] || 0) !== afterDist[k]) valuesUnchanged = false;
  });
  out.push('[' + (valuesUnchanged ? 'OK' : 'NG') + '] セルの値が変化していないか: ' + (valuesUnchanged ? '変化なし' : '変化あり（要確認）'));

  out.push('');
  out.push('=== 実行後の値分布 ===');
  Object.keys(afterDist).sort(function(a, b) { return afterDist[b] - afterDist[a]; }).forEach(function(k) {
    out.push('  ' + k + ': ' + afterDist[k] + '行');
  });
  out.push('  （空欄）: ' + afterEmpty + '行');

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

/**
 * 【読み取り専用】リード管理 col62 の入力規則状況 + 選択肢マスタのリードステータス列の実値
 * 書き込みは一切行わない
 */
function inspectLeadStatusValidation() {
  var TARGET_VALUES = [
    '新規リード', 'リード対応中', 'アサイン確定', 'リード対象外',
    '商談中', '商談対象外', '追客(短期)', '追客(長期)', '成約', '失注'
  ];

  var ss = getSpreadsheet();
  var out = [];

  // === 1. リード管理 col62 の入力規則 ===
  out.push('=== 1. リード管理 col62 の入力規則 ===');
  var leadSh = ss.getSheetByName('リード管理');
  if (!leadSh) {
    out.push('[NOT FOUND] リード管理');
  } else {
    var leadLastCol = leadSh.getLastColumn();
    var leadHeaders = leadSh.getRange(1, 1, 1, leadLastCol).getValues()[0];
    var leadColIdx = leadHeaders.indexOf('リードステータス');
    out.push('リードステータス列: ' + (leadColIdx >= 0 ? 'col' + (leadColIdx + 1) : '[NOT FOUND]'));

    if (leadColIdx >= 0) {
      var leadLastRow = leadSh.getLastRow();
      var rules = leadSh.getRange(2, leadColIdx + 1, Math.max(leadLastRow - 1, 1), 1).getDataValidations();
      var firstRule = null;
      for (var k = 0; k < rules.length; k++) {
        if (rules[k][0] !== null) { firstRule = rules[k][0]; break; }
      }
      if (!firstRule) {
        out.push('入力規則: なし');
      } else {
        try {
          var cv = firstRule.getCriteriaValues()[0];
          if (Array.isArray(cv)) {
            out.push('入力規則: プルダウン（' + cv.length + '件）');
            cv.forEach(function(v, i) { out.push('  ' + (i + 1) + '. ' + v); });
          } else {
            out.push('入力規則: 範囲参照型');
          }
        } catch (e) {
          out.push('入力規則: 取得エラー (' + e.message + ')');
        }
      }
    }
  }
  out.push('');

  // === 2. 選択肢マスタのリードステータス列の実値 ===
  out.push('=== 2. 選択肢マスタ「リードステータス」列の実値 ===');
  var optSh = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!optSh) {
    out.push('[NOT FOUND] 選択肢マスタ');
  } else {
    var optData = optSh.getDataRange().getValues();
    var optHeaders = optData[0];
    var optColIdx = -1;
    for (var h = 0; h < optHeaders.length; h++) {
      if (String(optHeaders[h]).trim() === 'リードステータス') { optColIdx = h; break; }
    }
    if (optColIdx < 0) {
      out.push('リードステータス列: [NOT FOUND]（シートに列が存在しません）');
      out.push('シートヘッダー列数: ' + optHeaders.length);
    } else {
      out.push('リードステータス列: col' + (optColIdx + 1) + ' (' + String.fromCharCode(65 + optColIdx) + '列)');
      var optValues = [];
      for (var r = 1; r < optData.length; r++) {
        var v = String(optData[r][optColIdx] || '').trim();
        if (v !== '') optValues.push({ row: r + 1, value: v });
      }
      out.push('値の件数: ' + optValues.length);
      optValues.forEach(function(item) {
        out.push('  行' + item.row + ': ' + item.value);
      });
    }
  }
  out.push('');

  // === 3. DEFAULT_DROPDOWN_OPTIONS 10値との照合 ===
  out.push('=== 3. DEFAULT_DROPDOWN_OPTIONS 10値との照合 ===');
  if (optColIdx < 0) {
    out.push('選択肢マスタに列が存在しないため照合不可');
  } else {
    var sheetSet = {};
    optValues.forEach(function(item) { sheetSet[item.value] = true; });
    var missing = TARGET_VALUES.filter(function(v) { return !sheetSet[v]; });
    var extra   = Object.keys(sheetSet).filter(function(v) { return TARGET_VALUES.indexOf(v) < 0; });
    if (missing.length === 0 && extra.length === 0) {
      out.push('判定: 完全一致');
    } else {
      if (missing.length > 0) {
        out.push('DEFAULT_OPTIONS にあってシートに無い値 (' + missing.length + '件):');
        missing.forEach(function(v) { out.push('  - ' + v); });
      }
      if (extra.length > 0) {
        out.push('シートにあって DEFAULT_OPTIONS に無い値 (' + extra.length + '件):');
        extra.forEach(function(v) { out.push('  - ' + v); });
      }
    }
  }

  Logger.log(out.join('\n'));
  return out.join('\n');
}


/**
 * リード進捗・商談進捗の実データ分布調査（読み取りのみ）
 * 調査項目:
 *   1. リード進捗 値分布
 *   2. 商談進捗 値分布
 *   3. 特定値の件数（見積もり提示 / アーカイブ）
 *   4. 該当行のリードステータス値
 *   5. アーカイブ日・アーカイブ理由の有値行数
 *   6. col4・col5 の入力規則有無
 */
function surveyProgressColumnDetail() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sh) { Logger.log("[NOT FOUND] リード管理"); return "[NOT FOUND] リード管理"; }

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  var allData = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = allData[0];

  var liIdx = headers.indexOf("リード進捗");
  var diIdx = headers.indexOf("商談進捗");
  var lsIdx = headers.indexOf("リードステータス");
  var aaIdx = headers.indexOf("アーカイブ日");
  var arIdx = headers.indexOf("アーカイブ理由");

  var out = [];
  out.push("=== surveyProgressColumnDetail ===");
  out.push("シート: " + CONFIG.SHEETS.LEADS);
  out.push("総データ行: " + (lastRow - 1));
  out.push("リード進捗 col: " + (liIdx >= 0 ? liIdx + 1 : "[NOT FOUND]"));
  out.push("商談進捗 col: " + (diIdx >= 0 ? diIdx + 1 : "[NOT FOUND]"));
  out.push("リードステータス col: " + (lsIdx >= 0 ? lsIdx + 1 : "[NOT FOUND]"));
  out.push("アーカイブ日 col: " + (aaIdx >= 0 ? aaIdx + 1 : "[NOT FOUND]"));
  out.push("アーカイブ理由 col: " + (arIdx >= 0 ? arIdx + 1 : "[NOT FOUND]"));
  out.push("");

  var lpDist = {};
  var dpDist = {};
  var mitsumoris = [];
  var lpArchives = [];
  var dpArchives = [];
  var archiveDateCount = 0;
  var archiveReasonCount = 0;

  for (var i = 1; i < allData.length; i++) {
    var r = allData[i];
    var lp = (liIdx >= 0) ? String(r[liIdx] || "").trim() : "";
    var dp = (diIdx >= 0) ? String(r[diIdx] || "").trim() : "";
    var ls = (lsIdx >= 0) ? String(r[lsIdx] || "").trim() : "";

    var lpKey = lp === "" ? "(空)" : lp;
    var dpKey = dp === "" ? "(空)" : dp;
    lpDist[lpKey] = (lpDist[lpKey] || 0) + 1;
    dpDist[dpKey] = (dpDist[dpKey] || 0) + 1;

    if (dp === "見積もり提示") mitsumoris.push({ row: i + 1, ls: ls || "(空)" });
    if (lp === "アーカイブ")  lpArchives.push({ row: i + 1, ls: ls || "(空)" });
    if (dp === "アーカイブ")  dpArchives.push({ row: i + 1, ls: ls || "(空)" });

    if (aaIdx >= 0) {
      var av = r[aaIdx];
      if (av !== "" && av !== null && av !== undefined) archiveDateCount++;
    }
    if (arIdx >= 0) {
      var rv = r[arIdx];
      if (rv !== "" && rv !== null && rv !== undefined) archiveReasonCount++;
    }
  }

  out.push("=== 1. リード進捗 分布 ===");
  Object.keys(lpDist).sort(function(a, b) { return lpDist[b] - lpDist[a]; })
    .forEach(function(k) { out.push("  " + k + ": " + lpDist[k] + "件"); });

  out.push("");
  out.push("=== 2. 商談進捗 分布 ===");
  Object.keys(dpDist).sort(function(a, b) { return dpDist[b] - dpDist[a]; })
    .forEach(function(k) { out.push("  " + k + ": " + dpDist[k] + "件"); });

  out.push("");
  out.push("=== 3. 特定値の件数 ===");
  out.push("  商談進捗 = 見積もり提示: " + mitsumoris.length + "件");
  out.push("  リード進捗 = アーカイブ: " + lpArchives.length + "件");
  out.push("  商談進捗 = アーカイブ: " + dpArchives.length + "件");

  out.push("");
  out.push("=== 4. 該当行のリードステータス ===");
  var hasTarget = mitsumoris.length + lpArchives.length + dpArchives.length > 0;
  if (!hasTarget) {
    out.push("  （全3項目とも該当行なし）");
  }
  if (mitsumoris.length > 0) {
    out.push("  [商談進捗=見積もり提示]");
    mitsumoris.forEach(function(x) { out.push("    行" + x.row + " → リードステータス: " + x.ls); });
  }
  if (lpArchives.length > 0) {
    out.push("  [リード進捗=アーカイブ]");
    lpArchives.forEach(function(x) { out.push("    行" + x.row + " → リードステータス: " + x.ls); });
  }
  if (dpArchives.length > 0) {
    out.push("  [商談進捗=アーカイブ]");
    dpArchives.forEach(function(x) { out.push("    行" + x.row + " → リードステータス: " + x.ls); });
  }

  out.push("");
  out.push("=== 5. アーカイブ日・アーカイブ理由 有値行数 ===");
  out.push("  アーカイブ日 に値あり: " + archiveDateCount + "行");
  out.push("  アーカイブ理由 に値あり: " + archiveReasonCount + "行");

  out.push("");
  out.push("=== 6. col4・col5 入力規則 ===");
  if (liIdx >= 0) {
    var lpRule = sh.getRange(2, liIdx + 1).getDataValidation();
    out.push("  リード進捗 (col" + (liIdx + 1) + "): " + (lpRule ? String(lpRule.getCriteriaType()) : "なし"));
  } else {
    out.push("  リード進捗: [列が存在しない]");
  }
  if (diIdx >= 0) {
    var dpRule = sh.getRange(2, diIdx + 1).getDataValidation();
    out.push("  商談進捗 (col" + (diIdx + 1) + "): " + (dpRule ? String(dpRule.getCriteriaType()) : "なし"));
  } else {
    out.push("  商談進捗: [列が存在しない]");
  }

  Logger.log(out.join("\n"));
  return out.join("\n");
}

/**
 * トリガー一覧を返す（clasp run 用 - UI 呼び出しなし）
 * ScriptApp.getProjectTriggers() で全件列挙し、
 * ハンドラ関数名・イベント種別・実行頻度・ID を返す
 */
function listTriggersForClasp() {
  var out = [];
  var targets = [
    'onEditTrigger', 'archiveOnStatusChange',
    'checkAndRemind', 'checkDealRemind', 'checkActionDateRemind'
  ];

  try {
    var triggers = ScriptApp.getProjectTriggers();
    out.push('=== トリガー一覧 (' + triggers.length + '件) ===');

    if (triggers.length === 0) {
      out.push('  （登録なし）');
    }

    triggers.forEach(function(t, i) {
      var fn   = t.getHandlerFunction();
      var et   = String(t.getEventType());
      var src  = String(t.getTriggerSource());
      var uid  = t.getUniqueId();
      out.push('');
      out.push('--- [' + (i + 1) + '] ---');
      out.push('  ハンドラ関数: ' + fn);
      out.push('  イベント種別: ' + et);
      out.push('  トリガーソース: ' + src);
      out.push('  ID: ' + uid);
    });

    out.push('');
    out.push('=== 調査対象関数の登録状況 ===');
    var registeredFns = triggers.map(function(t) { return t.getHandlerFunction(); });
    targets.forEach(function(fn) {
      var found = registeredFns.indexOf(fn) >= 0;
      out.push('  ' + fn + ': ' + (found ? '[登録あり]' : '未登録'));
    });

  } catch (e) {
    out.push('ERROR: ' + e.message);
  }

  var result = out.join('\n');
  Logger.log(result);
  return result;
}


/**
 * 【読み取り専用】オーダー管理「支払サイト」列の値分布を調査する
 * 値は選択肢データのため出力可。個人データ（顧客名等）は出力しない。
 */
function surveyOrderPaymentTerms() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('オーダー管理');
  if (!sh) return '[NOT FOUND] オーダー管理';

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return '[空シート]';

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIdx = headers.indexOf('支払サイト');
  if (colIdx < 0) return '[NOT FOUND] 支払サイト列 (全' + lastCol + '列を検索)';

  var dataRows = lastRow - 1;
  var values = sh.getRange(2, colIdx + 1, dataRows, 1).getValues();

  var dist = {};
  var emptyCount = 0;
  values.forEach(function(row) {
    var v = String(row[0] || '').trim();
    if (v === '') { emptyCount++; } else { dist[v] = (dist[v] || 0) + 1; }
  });

  var out = [
    '=== surveyOrderPaymentTerms ===',
    'シート: オーダー管理',
    '支払サイト列: col' + (colIdx + 1),
    '総データ行: ' + dataRows,
    ''
  ];

  var sorted = Object.keys(dist).sort(function(a, b) { return dist[b] - dist[a]; });
  if (sorted.length === 0) {
    out.push('有値行: 0件（全行空欄）');
  } else {
    out.push('--- 値の分布（多い順）---');
    sorted.forEach(function(k) { out.push('  ' + JSON.stringify(k) + ': ' + dist[k] + '件'); });
  }
  out.push('空欄: ' + emptyCount + '件');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * リード管理シートの全ヘッダーを返す（clasp run 用）
 * 進捗ステータス列の実在確認を目的とする
 */
function checkProgressStatusColumn() {
  var sh = getSpreadsheet().getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sh) return '[NOT FOUND] ' + CONFIG.SHEETS.LEADS;

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  var targets = ['進捗ステータス', 'リード進捗', '商談進捗', 'リードステータス'];
  var out = ['=== リード管理シート ヘッダー確認 ===',
             '総列数: ' + lastCol, ''];

  out.push('=== 調査対象列の実在確認 ===');
  targets.forEach(function(name) {
    var idx = headers.indexOf(name);
    out.push('  ' + name + ': ' + (idx >= 0 ? 'col' + (idx + 1) : '[存在しない]'));
  });

  out.push('');
  out.push('=== 全ヘッダー一覧 ===');
  headers.forEach(function(h, i) {
    out.push('  col' + (i + 1) + ': ' + h);
  });

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【読み取り専用】送料計算マスタ4シートの列構成を調査する
 * - gid / 行数 / 列数 / ヘッダー行番号 / 全列ヘッダー名（col番号付き）/ 各列の空欄件数
 * - DEV環境でシートが見つからない場合は PRODUCTION_SPREADSHEET_ID でフォールバック
 * シートデータの値は出力しない（ヘッダー名・件数のみ）
 */
function auditShippingMasterSheets() {
  var out = [];

  // DEV環境ではIMPORTRANGE同期シートが存在しないため、PRODスプレッドシートを参照する
  var envSs = getSpreadsheet();
  var probeSheet = envSs.getSheetByName(CONFIG.SHEETS.ZONES_SYNC);
  var ss;
  if (probeSheet) {
    ss = envSs;
    out.push('[参照先] 現在の環境のスプレッドシート');
  } else {
    var prodId = PropertiesService.getScriptProperties().getProperty('PRODUCTION_SPREADSHEET_ID');
    if (!prodId) {
      out.push('[ERROR] PRODUCTION_SPREADSHEET_ID が未設定です。');
      Logger.log(out.join('\n'));
      return out.join('\n');
    }
    ss = SpreadsheetApp.openById(prodId);
    out.push('[参照先] PROD スプレッドシート (DEV環境にシートなし)');
  }
  out.push('スプレッドシート名: ' + ss.getName());
  out.push('');

  var sheetTargets = [
    { label: '地帯表',     sheetName: CONFIG.SHEETS.ZONES_SYNC },
    { label: 'FedEx送料',  sheetName: CONFIG.SHEETS.FEDEX_RATES_SYNC },
    { label: 'DHL送料',    sheetName: CONFIG.SHEETS.DHL_RATES_SYNC },
    { label: 'UPS送料',    sheetName: CONFIG.SHEETS.UPS_RATES_SYNC }
  ];

  sheetTargets.forEach(function(t, i) {
    out.push('=== ' + (i + 1) + '. ' + t.label + ' (' + t.sheetName + ') ===');
    var sheet = ss.getSheetByName(t.sheetName);
    if (!sheet) {
      out.push('[NOT FOUND] ' + t.sheetName);
    } else {
      var sheetOut = auditSheetColumnsForClasp(sheet);
      sheetOut.forEach(function(line) { out.push(line); });
    }
    out.push('');
  });

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【読み取り専用 / DEV専用】DEV環境の送料マスタ4シートの列構成を調査する
 * シート名: 地帯表 / FedEx送料 / DHL送料 / UPS送料
 * - gid / 行数 / 列数 / ヘッダー行番号 / 全列ヘッダー名（col番号付き）/ 各列の空欄件数
 * データ値は出力しない（ヘッダー名・件数のみ）
 */
function auditDevShippingSheets() {
  var ss = getSpreadsheet();
  var out = [];

  out.push('スプレッドシート名: ' + ss.getName());
  out.push('');

  var sheetNames = ['地帯表', 'FedEx送料', 'DHL送料', 'UPS送料'];

  sheetNames.forEach(function(sheetName, i) {
    out.push('=== ' + (i + 1) + '. ' + sheetName + ' ===');
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      out.push('[NOT FOUND] ' + sheetName);
    } else {
      var gid = sheet.getSheetId();
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      out.push('gid=' + gid + ' / ' + lastRow + '行 x ' + lastCol + '列 / ヘッダー行: 1行目');
      if (lastCol >= 1) {
        var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
        var dataRowCount = Math.max(lastRow - 1, 0);
        var emptyCounts = new Array(lastCol).fill(0);
        if (dataRowCount > 0) {
          var values = sheet.getRange(2, 1, dataRowCount, lastCol).getValues();
          values.forEach(function(row) {
            row.forEach(function(cell, colIdx) {
              if (cell === '' || cell === null || cell === undefined) {
                emptyCounts[colIdx]++;
              }
            });
          });
        }
        out.push('データ行数: ' + dataRowCount + '行');
        out.push('');
        headers.forEach(function(header, j) {
          out.push('  col' + (j + 1) + ': "' + header + '" / 空欄: ' + emptyCounts[j] + '件');
        });
      }
    }
    out.push('');
  });

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 【読み取り専用 / DEV専用】見積もり管理シートの既存ステータス値を集計する。
 * スキーマ変更前の事前確認用。データ値は件数のみ報告する。
 */
function auditQuoteStatusValues() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('見積もり管理');
  if (!sheet || sheet.getLastRow() < 2) {
    var msg = 'シートなし or データ行なし';
    Logger.log(msg);
    return msg;
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var statusColIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].trim() === 'ステータス') { statusColIdx = i; break; }
  }
  if (statusColIdx < 0) {
    var msg2 = 'ステータス列が見つかりません';
    Logger.log(msg2);
    return msg2;
  }
  var dataRowCount = sheet.getLastRow() - 1;
  var data = sheet.getRange(2, statusColIdx + 1, dataRowCount, 1).getValues();
  var counts = {};
  data.forEach(function(row) {
    var v = String(row[0]).trim();
    if (!v) v = '(空欄)';
    counts[v] = (counts[v] || 0) + 1;
  });
  var lines = ['見積もり管理シート ステータス値集計 (総データ行: ' + dataRowCount + ')', ''];
  Object.keys(counts).sort().forEach(function(v) {
    lines.push('  "' + v + '": ' + counts[v] + '件');
  });
  var auditResult = lines.join('\n');
  Logger.log(auditResult);
  return auditResult;
}
