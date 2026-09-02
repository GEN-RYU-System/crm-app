/**
 * DEV専用: 選択肢マスタV2 の contact_method カテゴリに LINE を追加する。
 *
 * PO決定（2026-09-02）: LDI-0005 の実データ（LINE）が存在するため追加。
 * 追加後の値（9種類）:
 *   Whatsapp / Instagram / Facebook / Market Place / Telegram /
 *   メール / Discord / LINE / その他
 *
 * 書き込み系操作（Execute のみ）:
 *   - その他 行の sort_order セル更新（setValue 1セル）
 *   - LINE 行の末尾追加（setValues 1行 × 5列）
 *   - バックアップ作成（copyTo）
 *
 * 実行順序:
 *   1. clasp run devContactMethodAudit            → 現状確認（読み取り専用）
 *   2. clasp run devBackupOptionMasterV2           → バックアップ作成（冪等）
 *   3. clasp run devAddLineContactMethodDryRun     → dry-run（書き込みなし）
 *   4. clasp run devAddLineContactMethodExecute    → 実行
 *   5. clasp run devVerifyLineAddResult            → 検証
 */

var OMLINE_BACKUP_NAME   = '選択肢マスタV2_backup_20260902';
var OMLINE_CATEGORY      = 'contact_method';
var OMLINE_NEW_VALUE     = 'LINE';
var OMLINE_AFTER_VALUE   = 'Discord';
var OMLINE_BEFORE_VALUE  = 'その他';

function omlineSheetName_() {
  return getCoreSchemaV1TableName('OPTION_MASTER');
}

/**
 * 読み取り専用: contact_method 全行と、シート全体の最大 option_id を報告する。
 * @returns {string} JSON.stringify({ sheetName, totalDataRows, maxOptionId, nextOptionId, contactMethodRows })
 */
function devContactMethodAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('devContactMethodAudit は DEV 環境でのみ実行できます');
  }

  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(omlineSheetName_());
  if (!sheet) {
    return JSON.stringify({ error: 'シートが見つかりません: ' + omlineSheetName_() });
  }

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var idIdx   = headers.indexOf('option_id');
  var catIdx  = headers.indexOf('category');
  var valIdx  = headers.indexOf('value');
  var sortIdx = headers.indexOf('sort_order');
  var actIdx  = headers.indexOf('is_active');

  if (idIdx < 0 || catIdx < 0 || valIdx < 0) {
    return JSON.stringify({ error: '必須ヘッダーが見つかりません', headers: headers });
  }

  var maxIdNum = 0;
  var totalDataRows = 0;
  var contactRows = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id  = String(row[idIdx] != null ? row[idIdx] : '').trim();
    if (!id) continue;
    totalDataRows++;

    var m = id.match(/^OPT-(\d+)$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxIdNum) maxIdNum = n;
    }

    if (String(row[catIdx] != null ? row[catIdx] : '').trim() === OMLINE_CATEGORY) {
      contactRows.push({
        sheetRow:  r + 1,
        option_id: id,
        value:     String(row[valIdx]  != null ? row[valIdx]  : '').trim(),
        sort_order: sortIdx >= 0 ? row[sortIdx] : null,
        is_active:  actIdx  >= 0 ? row[actIdx]  : null
      });
    }
  }

  var maxId  = maxIdNum > 0 ? ('OPT-' + String(maxIdNum).padStart(5, '0')) : 'なし';
  var nextId = 'OPT-' + String(maxIdNum + 1).padStart(5, '0');

  return JSON.stringify({
    sheetName:         omlineSheetName_(),
    totalDataRows:     totalDataRows,
    maxOptionId:       maxId,
    nextOptionId:      nextId,
    contactMethodRows: contactRows
  });
}

/**
 * バックアップ作成（冪等）。
 * バックアップ後に行数・列数・ヘッダーが元と一致することを検証する。
 * 不一致の場合は { ok: false, note: ... } を返す。
 * @returns {string} JSON.stringify({ created, backupName, rowMatch, colMatch, headerMatch, ok, note })
 */
function devBackupOptionMasterV2() {
  if (getEnvironment() !== 'development') {
    throw new Error('devBackupOptionMasterV2 は DEV 環境でのみ実行できます');
  }

  var ss       = getSpreadsheet();
  var original = ss.getSheetByName(omlineSheetName_());
  if (!original) {
    return JSON.stringify({ error: '選択肢マスタV2 が見つかりません' });
  }

  var existingBackup = ss.getSheetByName(OMLINE_BACKUP_NAME);
  var created = false;
  if (!existingBackup) {
    var newBackup = original.copyTo(ss);
    newBackup.setName(OMLINE_BACKUP_NAME);
    created = true;
  }

  var backup   = ss.getSheetByName(OMLINE_BACKUP_NAME);
  var origRows = original.getLastRow();
  var origCols = original.getLastColumn();
  var backRows = backup.getLastRow();
  var backCols = backup.getLastColumn();

  var origHeaders = origCols > 0
    ? original.getRange(1, 1, 1, origCols).getValues()[0].map(function(h) { return String(h != null ? h : '').trim(); })
    : [];
  var backHeaders = backCols > 0
    ? backup.getRange(1, 1, 1, backCols).getValues()[0].map(function(h) { return String(h != null ? h : '').trim(); })
    : [];

  var rowMatch    = origRows === backRows;
  var colMatch    = origCols === backCols;
  var headerMatch = JSON.stringify(origHeaders) === JSON.stringify(backHeaders);
  var ok = rowMatch && colMatch && headerMatch;

  return JSON.stringify({
    created:     created,
    backupName:  OMLINE_BACKUP_NAME,
    originalRows: origRows,
    backupRows:   backRows,
    originalCols: origCols,
    backupCols:   backCols,
    rowMatch:    rowMatch,
    colMatch:    colMatch,
    headerMatch: headerMatch,
    ok:  ok,
    note: ok ? 'バックアップ検証合格' : '【警告】バックアップ検証失敗 → Execute を実行しないこと'
  });
}

/**
 * dry-run: 追加予定の行と sort_order 変更予定の行を報告する（書き込みなし）。
 * @returns {string} JSON.stringify({ newRow, sortOrderChanges, sortOrderStrategy })
 */
function devAddLineContactMethodDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAddLineContactMethodDryRun は DEV 環境でのみ実行できます');
  }

  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(omlineSheetName_());
  if (!sheet) {
    return JSON.stringify({ error: 'シートが見つかりません' });
  }

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var idIdx   = headers.indexOf('option_id');
  var catIdx  = headers.indexOf('category');
  var valIdx  = headers.indexOf('value');
  var sortIdx = headers.indexOf('sort_order');

  var maxIdNum    = 0;
  var discordRow  = null;
  var sonoHokaRow = null;
  var lineExists  = false;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id  = String(row[idIdx] != null ? row[idIdx] : '').trim();
    if (!id) continue;

    var m = id.match(/^OPT-(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); if (n > maxIdNum) maxIdNum = n; }

    var cat = String(row[catIdx] != null ? row[catIdx] : '').trim();
    var val = String(row[valIdx] != null ? row[valIdx] : '').trim();

    if (cat === OMLINE_CATEGORY) {
      if (val === OMLINE_AFTER_VALUE)  discordRow  = { sheetRow: r + 1, option_id: id, sort_order: Number(row[sortIdx]) };
      if (val === OMLINE_BEFORE_VALUE) sonoHokaRow = { sheetRow: r + 1, option_id: id, sort_order: Number(row[sortIdx]) };
      if (val === OMLINE_NEW_VALUE)    lineExists = true;
    }
  }

  if (lineExists)   return JSON.stringify({ error: 'LINE は既に contact_method に存在します。追加は不要です。' });
  if (!discordRow)  return JSON.stringify({ error: 'Discord 行が見つかりません' });
  if (!sonoHokaRow) return JSON.stringify({ error: 'その他 行が見つかりません' });

  var newSortOrder  = discordRow.sort_order + 1;
  var nextOptionId  = 'OPT-' + String(maxIdNum + 1).padStart(5, '0');

  var sortOrderChanges = [];
  if (sonoHokaRow.sort_order <= newSortOrder) {
    sortOrderChanges.push({
      sheetRow:     sonoHokaRow.sheetRow,
      option_id:    sonoHokaRow.option_id,
      value:        OMLINE_BEFORE_VALUE,
      oldSortOrder: sonoHokaRow.sort_order,
      newSortOrder: newSortOrder + 1
    });
  }

  return JSON.stringify({
    newRow: {
      option_id:  nextOptionId,
      category:   OMLINE_CATEGORY,
      value:      OMLINE_NEW_VALUE,
      sort_order: newSortOrder,
      is_active:  true
    },
    sortOrderChanges:  sortOrderChanges,
    sortOrderStrategy: 'Discord(sort=' + discordRow.sort_order + ')の直後に LINE(sort=' + newSortOrder + ')を挿入。その他の sort_order を ' + sonoHokaRow.sort_order + ' → ' + (newSortOrder + 1) + ' に更新する。'
  });
}

/**
 * 実行: LINE 行を追加し、その他の sort_order を更新する。
 * 前提: devBackupOptionMasterV2 でバックアップ作成済みであること。
 * @returns {string} JSON.stringify({ step1, step2, ok })
 */
function devAddLineContactMethodExecute() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAddLineContactMethodExecute は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // バックアップ存在確認
  if (!ss.getSheetByName(OMLINE_BACKUP_NAME)) {
    return JSON.stringify({
      error: 'バックアップが見つかりません: ' + OMLINE_BACKUP_NAME + ' — devBackupOptionMasterV2 を先に実行してください'
    });
  }

  var sheet = ss.getSheetByName(omlineSheetName_());
  if (!sheet) return JSON.stringify({ error: 'シートが見つかりません' });

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var idIdx   = headers.indexOf('option_id');
  var catIdx  = headers.indexOf('category');
  var valIdx  = headers.indexOf('value');
  var sortIdx = headers.indexOf('sort_order');

  var maxIdNum    = 0;
  var discordRow  = null;
  var sonoHokaRow = null;
  var lineExists  = false;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id  = String(row[idIdx] != null ? row[idIdx] : '').trim();
    if (!id) continue;

    var m = id.match(/^OPT-(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); if (n > maxIdNum) maxIdNum = n; }

    var cat = String(row[catIdx] != null ? row[catIdx] : '').trim();
    var val = String(row[valIdx] != null ? row[valIdx] : '').trim();

    if (cat === OMLINE_CATEGORY) {
      if (val === OMLINE_AFTER_VALUE)  discordRow  = { sheetRow: r + 1, option_id: id, sort_order: Number(row[sortIdx]) };
      if (val === OMLINE_BEFORE_VALUE) sonoHokaRow = { sheetRow: r + 1, option_id: id, sort_order: Number(row[sortIdx]) };
      if (val === OMLINE_NEW_VALUE)    lineExists = true;
    }
  }

  if (lineExists)   return JSON.stringify({ error: 'LINE は既に存在します。中止。' });
  if (!discordRow)  return JSON.stringify({ error: 'Discord 行が見つかりません。中止。' });
  if (!sonoHokaRow) return JSON.stringify({ error: 'その他 行が見つかりません。中止。' });

  var newSortOrder = discordRow.sort_order + 1;
  var nextOptionId = 'OPT-' + String(maxIdNum + 1).padStart(5, '0');

  // ── step1: その他 の sort_order を更新 ──────────────────────────────────
  var step1 = { executed: false, detail: null };
  if (sonoHokaRow.sort_order <= newSortOrder) {
    sheet.getRange(sonoHokaRow.sheetRow, sortIdx + 1).setValue(newSortOrder + 1);
    step1 = {
      executed: true,
      detail: {
        sheetRow:  sonoHokaRow.sheetRow,
        option_id: sonoHokaRow.option_id,
        value:     OMLINE_BEFORE_VALUE,
        oldSort:   sonoHokaRow.sort_order,
        newSort:   newSortOrder + 1
      }
    };
  }

  // ── step2: LINE 行を末尾に追加 ──────────────────────────────────────────
  var appendRow = sheet.getLastRow() + 1;
  sheet.getRange(appendRow, 1, 1, 5).setValues([[nextOptionId, OMLINE_CATEGORY, OMLINE_NEW_VALUE, newSortOrder, true]]);

  return JSON.stringify({
    step1_sonoHokaUpdate: step1,
    step2_lineAdded: {
      sheetRow:   appendRow,
      option_id:  nextOptionId,
      category:   OMLINE_CATEGORY,
      value:      OMLINE_NEW_VALUE,
      sort_order: newSortOrder,
      is_active:  true
    },
    ok: true
  });
}

/**
 * 検証: 追加後の全条件を確認する（読み取り専用）。
 * 合格条件:
 *   - 行数が「バックアップ +1」
 *   - contact_method が 9種類
 *   - LINE が含まれる
 *   - option_id 重複なし
 *   - (category, value) 重複なし
 *   - 他カテゴリ行数に変化なし
 * @returns {string} JSON.stringify({ rowCountCheck, contactMethodCheck, idDuplicates, pairDuplicates, otherCategoryChanged, ok })
 */
function devVerifyLineAddResult() {
  if (getEnvironment() !== 'development') {
    throw new Error('devVerifyLineAddResult は DEV 環境でのみ実行できます');
  }

  var ss     = getSpreadsheet();
  var sheet  = ss.getSheetByName(omlineSheetName_());
  var backup = ss.getSheetByName(OMLINE_BACKUP_NAME);

  if (!sheet)  return JSON.stringify({ error: 'シートが見つかりません' });
  if (!backup) return JSON.stringify({ error: 'バックアップが見つかりません: ' + OMLINE_BACKUP_NAME });

  var data     = sheet.getDataRange().getValues();
  var backData = backup.getDataRange().getValues();
  var headers  = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var idIdx    = headers.indexOf('option_id');
  var catIdx   = headers.indexOf('category');
  var valIdx   = headers.indexOf('value');

  var backHeaders = backData[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var backIdIdx   = backHeaders.indexOf('option_id');
  var backCatIdx  = backHeaders.indexOf('category');

  // カテゴリ別行数（バックアップ）
  var catCountsBack = {};
  for (var br = 1; br < backData.length; br++) {
    var bid = String(backData[br][backIdIdx] != null ? backData[br][backIdIdx] : '').trim();
    var bcat = String(backData[br][backCatIdx] != null ? backData[br][backCatIdx] : '').trim();
    if (!bid) continue;
    catCountsBack[bcat] = (catCountsBack[bcat] || 0) + 1;
  }

  // 現行シートをスキャン
  var catCountsCurr = {};
  var idSet         = {};
  var pairSet       = {};
  var idDuplicates  = [];
  var pairDuplicates = [];
  var contactValues = [];
  var totalDataRows = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id  = String(row[idIdx] != null ? row[idIdx] : '').trim();
    if (!id) continue;
    totalDataRows++;

    var cat = String(row[catIdx] != null ? row[catIdx] : '').trim();
    var val = String(row[valIdx] != null ? row[valIdx] : '').trim();

    catCountsCurr[cat] = (catCountsCurr[cat] || 0) + 1;

    if (idSet[id]) idDuplicates.push(id);
    idSet[id] = true;

    var pair = cat + '::' + val;
    if (pairSet[pair]) pairDuplicates.push(pair);
    pairSet[pair] = true;

    if (cat === OMLINE_CATEGORY) contactValues.push(val);
  }

  // 他カテゴリ行数変化チェック
  var otherCategoryChanged = [];
  Object.keys(catCountsBack).forEach(function(cat) {
    if (cat === OMLINE_CATEGORY) return;
    if (catCountsCurr[cat] !== catCountsBack[cat]) {
      otherCategoryChanged.push({ category: cat, before: catCountsBack[cat], after: catCountsCurr[cat] });
    }
  });

  var backDataRows = backData.length - 1;
  var rowCountOk   = totalDataRows === backDataRows + 1;
  var lineExists   = contactValues.indexOf(OMLINE_NEW_VALUE) >= 0;
  var contactCount9 = contactValues.length === 9;

  var ok = rowCountOk && lineExists && contactCount9
    && idDuplicates.length === 0 && pairDuplicates.length === 0
    && otherCategoryChanged.length === 0;

  return JSON.stringify({
    rowCountCheck: {
      backupDataRows: backDataRows,
      currentDataRows: totalDataRows,
      diff: totalDataRows - backDataRows,
      ok: rowCountOk
    },
    contactMethodCheck: {
      count:    contactValues.length,
      values:   contactValues,
      lineExists: lineExists,
      ok: contactCount9
    },
    idDuplicates:       idDuplicates,
    pairDuplicates:     pairDuplicates,
    otherCategoryChanged: otherCategoryChanged,
    ok: ok,
    verdict: ok ? 'PASS' : 'FAIL — 上記の不一致を確認してください'
  });
}
