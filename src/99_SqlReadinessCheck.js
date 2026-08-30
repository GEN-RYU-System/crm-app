/**
 * SQL 適合性調査 — 読み取り専用
 *
 * 調査対象: 移行対象22シート
 * 制約:
 *   - スプレッドシートへの書き込みを一切行わない（読み取り専用）
 *   - 各シートの先頭 最大 100 行をサンプルとして読む（全件走査しない）
 *   - 数式は getFormulas() で取得する
 *   - 結合セルは getMergedRanges() で確認する
 *   - エラーは try-catch で捕捉し、そのシートは "error" として記録して継続
 *
 * 実行: clasp run runSqlReadinessCheck
 */

/**
 * 移行対象22シートの定義
 */
var SQL_CHECK_TARGETS = [
  { sheetName: 'リード管理',         pkColumn: 'リードID' },
  { sheetName: '顧客マスタ',         pkColumn: '顧客ID' },
  { sheetName: '配送先マスタ',       pkColumn: '配送先ID' },
  { sheetName: '支払先マスタ',       pkColumn: '支払先ID' },
  { sheetName: 'オーダー管理',       pkColumn: 'オーダーID' },
  { sheetName: 'オーダー明細',       pkColumn: '明細ID' },
  { sheetName: '見積もり管理',       pkColumn: '見積書ID' },
  { sheetName: '見積もり明細',       pkColumn: '明細ID' },
  { sheetName: '発送',               pkColumn: '発送ID' },
  { sheetName: '仕入れ',             pkColumn: '仕入れID' },
  { sheetName: 'フォームトークン',   pkColumn: 'トークン' },
  { sheetName: '商品マスタ同期',     pkColumn: 'product_id' },
  { sheetName: '作品マスタ_共用在庫', pkColumn: 'ip_id' },
  { sheetName: '国マスタ',           pkColumn: '国ID(ISO2)' },
  { sheetName: '通貨マスタ',         pkColumn: '通貨コード' },
  { sheetName: '流入元マスタ',       pkColumn: 'source_id' },
  { sheetName: '選択肢マスタ',       pkColumn: null },
  { sheetName: '発行元マスタ',       pkColumn: '発行元ID' },
  { sheetName: '会話ログ（商談用）', pkColumn: 'ログID' },
  { sheetName: 'システム設定',       pkColumn: '設定キー' },
  { sheetName: '担当者マスタ',       pkColumn: '担当者ID' },
  { sheetName: 'ログインセッション', pkColumn: 'セッションID' }
];

/**
 * 列名に絵文字・空白・SQLで問題になる記号が含まれるかを判定する
 * 空文字列は false を返す
 */
function sqlCheckColNameSafe_(name) {
  if (name === null || name === undefined || name === '') return false;
  var s = String(name);
  // 絵文字 (Unicode Emoji, Misc Symbols, Dingbats 等)
  if (/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}]/u.test(s)) return false;
  // 空白文字（半角スペース、全角スペース、タブ、改行）
  if (/[ \u3000\t\n\r]/.test(s)) return false;
  // SQL予約語として問題になる記号（括弧・スラッシュ・記号類）
  if (/[()（）\[\]【】「」『』\/\\*+\-=<>!@#$%^&|~`"';,.]/.test(s)) return false;
  return true;
}

/**
 * 条件3: セルに複数値（カンマ区切り or 改行区切り）が含まれるかサンプルチェック
 * rows: 2D配列（ヘッダー行を除く）
 * headers: ヘッダー配列
 */
function sqlCheckMultiVal_(rows, headers) {
  var issues = [];
  var checkRows = Math.min(rows.length, 100);
  for (var c = 0; c < headers.length; c++) {
    var hasNewline = false;
    var commaCandidate = null;
    for (var r = 0; r < checkRows; r++) {
      var v = rows[r][c];
      if (typeof v !== 'string' || v.length === 0) continue;
      if (v.indexOf('\n') >= 0) {
        hasNewline = true;
        break;
      }
      // カンマ区切り候補: 数字で始まらない文字列にカンマが含まれる場合
      if (commaCandidate === null && v.indexOf(',') >= 0 && !/^\d/.test(v)) {
        commaCandidate = v.substring(0, 60);
      }
    }
    if (hasNewline) {
      issues.push({ column: headers[c], type: '改行区切り' });
    } else if (commaCandidate !== null) {
      issues.push({ column: headers[c], type: 'カンマ区切り候補', sample: commaCandidate });
    }
  }
  return issues;
}

/**
 * メイン実行関数
 * 22シートを順に調査し、結果を Logger に出力して配列を返す
 */
function runSqlReadinessCheck() {
  var ss = getSpreadsheet();
  var results = [];

  for (var i = 0; i < SQL_CHECK_TARGETS.length; i++) {
    var target = SQL_CHECK_TARGETS[i];
    var r = {
      sheetName:    target.sheetName,
      pkColumn:     target.pkColumn,
      cond1_pk:     null,
      cond2_cols:   null,
      cond2_ng:     [],
      cond3_single: null,
      cond3_issues: [],
      cond4_type:   null,
      cond4_issues: [],
      cond5_formula: null,
      cond5_sample:  null,
      cond6_joined:  null,
      cond6_count:   0,
      cond7_header:  null,
      rowCount:      0,
      colCount:      0,
      error:         null
    };

    try {
      var sheet = ss.getSheetByName(target.sheetName);
      if (!sheet) {
        r.error = 'シートが見つかりません';
        results.push(r);
        continue;
      }

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      r.rowCount = lastRow;
      r.colCount = lastCol;

      if (lastCol === 0 || lastRow === 0) {
        r.error = 'シートが空';
        results.push(r);
        continue;
      }

      // ヘッダー行を取得（1行目）
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

      // === 条件1: 主キーがある ===
      if (target.pkColumn === null) {
        r.cond1_pk = 'NG_NO_PK';
      } else {
        r.cond1_pk = headers.indexOf(target.pkColumn) >= 0 ? 'OK' : 'NG_PK_NOT_FOUND';
      }

      // === 条件2: 列名が機械的に扱える ===
      var allSafe = true;
      for (var c = 0; c < headers.length; c++) {
        var colName = headers[c];
        if (!sqlCheckColNameSafe_(colName)) {
          r.cond2_ng.push({ col: c + 1, name: String(colName === '' ? '（空）' : colName) });
          allSafe = false;
        }
      }
      r.cond2_cols = allSafe ? 'OK' : 'NG';

      // データ行なし: 条件3〜7をスキップ
      if (lastRow < 2) {
        r.cond3_single  = 'OK_NO_DATA';
        r.cond4_type    = 'OK_NO_DATA';
        r.cond5_formula = 'OK_NO_DATA';
        r.cond6_joined  = 'OK_NO_DATA';
        r.cond7_header  = 'OK_NO_DATA';
        results.push(r);
        continue;
      }

      var sampleRows = Math.min(lastRow - 1, 100);
      var dataRange = sheet.getRange(2, 1, sampleRows, lastCol);

      // === 条件5: 数式が入っていない ===
      var formulas = dataRange.getFormulas();
      var formulaFound = false;
      var formulaSample = null;
      outer: for (var fr = 0; fr < formulas.length; fr++) {
        for (var fc = 0; fc < formulas[fr].length; fc++) {
          if (formulas[fr][fc] !== '') {
            formulaFound = true;
            formulaSample = {
              row: fr + 2,
              col: fc + 1,
              colName: String(headers[fc] || ''),
              formula: formulas[fr][fc].substring(0, 80)
            };
            break outer;
          }
        }
      }
      r.cond5_formula = formulaFound ? 'NG' : 'OK';
      r.cond5_sample  = formulaSample;

      // === 条件6: 結合セルがない ===
      var joinedCells = sheet.getRange(1, 1, lastRow, lastCol).getMergedRanges();
      r.cond6_count  = joinedCells.length;
      r.cond6_joined = joinedCells.length === 0 ? 'OK' : 'NG';

      // === 条件7: ヘッダーが1行目のみ ===
      var row2 = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
      var row2AllEmpty = row2.every(function(v) { return v === '' || v === null; });
      var pkIdx = target.pkColumn ? headers.indexOf(target.pkColumn) : -1;
      var row2LooksHeader = pkIdx >= 0 && String(row2[pkIdx]) === String(target.pkColumn);
      r.cond7_header = (row2AllEmpty || row2LooksHeader) ? 'WARN' : 'OK';

      // === 条件3: 1セル1値 ===
      var vals = dataRange.getValues();
      r.cond3_issues = sqlCheckMultiVal_(vals, headers);
      r.cond3_single = r.cond3_issues.length === 0 ? 'OK' : 'NG';

      // === 条件4: 型が揃っている（日付列の数値シリアル値チェック）===
      var typeIssues = [];
      for (var c4 = 0; c4 < headers.length; c4++) {
        var h4 = String(headers[c4] || '');
        // 日付・日時列と判断する列名パターン
        if (!/日$|日時$|_at$|Date$|At$/i.test(h4)) continue;
        var numSerial = 0;
        var total = 0;
        for (var r4 = 0; r4 < Math.min(vals.length, 100); r4++) {
          var v4 = vals[r4][c4];
          if (v4 === '' || v4 === null) continue;
          total++;
          if (typeof v4 === 'number') numSerial++;
        }
        if (numSerial > 0 && total > 0) {
          typeIssues.push({ column: h4, numericCount: numSerial, totalSampled: total });
        }
      }
      r.cond4_issues = typeIssues;
      r.cond4_type   = typeIssues.length === 0 ? 'OK' : 'NG';

    } catch (e) {
      r.error = String(e);
    }

    results.push(r);
  }

  // === ログ出力 ===
  Logger.log('=== SQL 適合性チェック サマリー ===');
  results.forEach(function(r) {
    var overall = (!r.error &&
      r.cond1_pk     && r.cond1_pk.startsWith('OK') &&
      r.cond2_cols   === 'OK' &&
      r.cond3_single && r.cond3_single.startsWith('OK') &&
      r.cond4_type   && r.cond4_type.startsWith('OK') &&
      r.cond5_formula && r.cond5_formula.startsWith('OK') &&
      r.cond6_joined  && r.cond6_joined.startsWith('OK') &&
      r.cond7_header  && r.cond7_header.startsWith('OK')
    ) ? 'PASS' : (r.error ? 'ERROR' : 'FAIL');

    Logger.log(JSON.stringify({
      sheet:     r.sheetName,
      overall:   overall,
      pk:        r.cond1_pk,
      colNames:  r.cond2_cols,
      ngColCnt:  r.cond2_ng.length,
      singleVal: r.cond3_single,
      typeOk:    r.cond4_type,
      noFormula: r.cond5_formula,
      noJoin:    r.cond6_joined,
      headerRow: r.cond7_header,
      rows:      r.rowCount,
      error:     r.error
    }));
  });

  Logger.log('=== NG 詳細 ===');
  results.forEach(function(r) {
    if (r.cond2_ng.length > 0)
      Logger.log('[列名NG] ' + r.sheetName + ': ' + JSON.stringify(r.cond2_ng));
    if (r.cond3_issues.length > 0)
      Logger.log('[複数値] ' + r.sheetName + ': ' + JSON.stringify(r.cond3_issues));
    if (r.cond4_issues.length > 0)
      Logger.log('[型] ' + r.sheetName + ': ' + JSON.stringify(r.cond4_issues));
    if (r.cond5_sample)
      Logger.log('[数式] ' + r.sheetName + ': ' + JSON.stringify(r.cond5_sample));
    if (r.cond6_count > 0)
      Logger.log('[結合] ' + r.sheetName + ': ' + r.cond6_count + '個');
  });

  return results;
}
