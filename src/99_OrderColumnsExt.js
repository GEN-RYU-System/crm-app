// ============================================================
// Phase4: オーダー管理 列拡張（26列 → 39列）
// - 既存172行のデータは保持（col1〜26 不変）
// - 新13列（col27〜39）のヘッダーのみ追加
// ============================================================

/**
 * addOrderExtColumns — col27〜39 のヘッダーを追加し、前後比較を報告
 */
function addOrderExtColumns() {
  var ss = getSpreadsheet();
  var lines = ['=== Phase4: オーダー管理 列拡張 ===', ''];

  var sheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!sheet) {
    lines.push('[ERROR] シートが見つかりません: ' + CONFIG.SHEETS.ORDER_MASTER);
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  var currentCols = sheet.getLastColumn();
  var lastRow     = sheet.getLastRow();
  lines.push('追加前: 列数=' + currentCols + ' データ行数=' + (lastRow - 1));
  lines.push('追加予定: col27〜' + HEADERS.ORDER_MASTER.length + ' (' + (HEADERS.ORDER_MASTER.length - 26) + '列)');
  lines.push('');

  // ── スナップショット（追加前）──
  var targetIds = ['OD-00001', 'OD-00086', 'OD-00172'];
  var beforeData = sheet.getRange(2, 1, lastRow - 1, 26).getValues();

  var snapBefore = {};
  var snapRowNums = {};
  beforeData.forEach(function(row, idx) {
    var odId = String(row[0] || '').trim();
    if (targetIds.indexOf(odId) >= 0) {
      snapBefore[odId]   = row.slice();
      snapRowNums[odId]  = idx + 2;
    }
  });

  lines.push('--- スナップショット（追加前）col1〜26 ---');
  targetIds.forEach(function(id) {
    if (!snapBefore[id]) { lines.push(id + ': [NOT FOUND]'); return; }
    lines.push(id + ' (シートrow' + snapRowNums[id] + '):');
    snapBefore[id].forEach(function(v, i) {
      var s = (v instanceof Date)
        ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd')
        : String(v === null || v === undefined ? '' : v);
      lines.push('  col' + (i + 1) + ': "' + s + '"');
    });
  });
  lines.push('');

  // ── 既存列数チェック ──
  if (currentCols !== 26) {
    lines.push('[WARN] 既存列数が26でありません（actual=' + currentCols + '）。続行します。');
  }

  // ── 新13列ヘッダー追加（col27〜39）──
  var newHeaders = HEADERS.ORDER_MASTER.slice(26); // 13 headers
  var startCol   = 27;
  var headerRange = sheet.getRange(1, startCol, 1, newHeaders.length);
  headerRange.setValues([newHeaders]);
  headerRange.setFontWeight('bold')
             .setBackground('#4A86E8')
             .setFontColor('#FFFFFF')
             .setHorizontalAlignment('center');
  SpreadsheetApp.flush();

  lines.push('[WRITE] col' + startCol + '〜' + (startCol + newHeaders.length - 1) + ' ヘッダー追加完了');
  lines.push('');

  // ── 列一覧（全39列）──
  lines.push('--- 列一覧（全' + HEADERS.ORDER_MASTER.length + '列）---');
  HEADERS.ORDER_MASTER.forEach(function(h, i) {
    lines.push('  col' + (i + 1) + ' ' + h + (i >= 26 ? '  ★新規' : ''));
  });
  lines.push('');

  // ── compareOrderHeaders ──
  lines.push(compareOrderHeaders());
  lines.push('');

  // ── スナップショット（追加後）との比較 ──
  var afterData = sheet.getRange(2, 1, lastRow - 1, 26).getValues();
  var snapAfter = {};
  afterData.forEach(function(row) {
    var odId = String(row[0] || '').trim();
    if (targetIds.indexOf(odId) >= 0) snapAfter[odId] = row.slice();
  });

  lines.push('--- 既存データ前後比較（col1〜26）---');
  var totalMM = 0;
  targetIds.forEach(function(id) {
    var before = snapBefore[id];
    var after  = snapAfter[id];
    if (!before || !after) { lines.push(id + ': データなし'); return; }
    var mm = [];
    for (var i = 0; i < 26; i++) {
      var bStr = (before[i] instanceof Date)
        ? Utilities.formatDate(before[i], 'Asia/Tokyo', 'yyyy/MM/dd')
        : String(before[i] === null || before[i] === undefined ? '' : before[i]);
      var aStr = (after[i] instanceof Date)
        ? Utilities.formatDate(after[i], 'Asia/Tokyo', 'yyyy/MM/dd')
        : String(after[i] === null || after[i] === undefined ? '' : after[i]);
      if (bStr !== aStr) mm.push('col' + (i + 1) + ': before="' + bStr + '" after="' + aStr + '"');
    }
    totalMM += mm.length;
    lines.push(id + ': mismatches=' + mm.length + (mm.length === 0 ? ' [OK]' : ' [FAIL]'));
    mm.forEach(function(m) { lines.push('  ' + m); });
  });
  lines.push('合計 mismatches=' + totalMM + ' [' + (totalMM === 0 ? 'OK' : 'FAIL') + ']');

  lines.push('');
  lines.push('=== 実装完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ─────────────────────────────────────────────
// compareOrderHeaders — HEADERS.ORDER_MASTER と実シートの比較
// ─────────────────────────────────────────────
function compareOrderHeaders() {
  var ss = getSpreadsheet();
  var lines = ['=== オーダー管理 (' + CONFIG.SHEETS.ORDER_MASTER + ') ==='];
  var sheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!sheet) {
    lines.push('  [ERROR] タブが見つかりません: ' + CONFIG.SHEETS.ORDER_MASTER);
    return lines.join('\n');
  }
  var expected = HEADERS.ORDER_MASTER;
  var actual   = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  var mismatches = 0;
  expected.forEach(function(h, i) {
    var act = String(actual[i] || '');
    var ok  = (act === h);
    if (!ok) mismatches++;
    lines.push('  col' + (i + 1) + ': [' + (ok ? 'OK' : 'MISMATCH') + '] "' + h + '"'
      + (ok ? '' : ' / 実="' + act + '"'));
  });
  lines.push('  mismatches=' + mismatches);
  return lines.join('\n');
}
