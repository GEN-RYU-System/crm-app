// ============================================================
// 発送・仕入れタブ セットアップ（SSOT原則）
// - 既存同名タブがあれば中止して報告
// - 書き込み対象: 発送/仕入れタブのヘッダー行のみ
// ============================================================

/**
 * メイン実行: 発送・仕入れタブを作成し、headers比較・採番初回値を報告
 */
function setupShipmentPurchaseTabs() {
  var ss = getSpreadsheet();
  var lines = ['=== 発送・仕入れタブ セットアップ ===', ''];

  // ─── 既存タブチェック（あれば即中止）───
  var existing = [];
  if (ss.getSheetByName(CONFIG.SHEETS.SHIPMENT)) existing.push('"' + CONFIG.SHEETS.SHIPMENT + '"');
  if (ss.getSheetByName(CONFIG.SHEETS.PURCHASE)) existing.push('"' + CONFIG.SHEETS.PURCHASE + '"');
  if (existing.length > 0) {
    lines.push('[ABORT] 既存タブが見つかりました。削除してから再実行してください:');
    existing.forEach(function(n) { lines.push('  ' + n); });
    var abortResult = lines.join('\n');
    Logger.log(abortResult);
    return abortResult;
  }

  // ─── タブ作成 ───
  _createSheetTab(ss, CONFIG.SHEETS.SHIPMENT, HEADERS.SHIPMENT, [6]);   // col6: 運送状番号
  lines.push('[OK] タブ作成: "' + CONFIG.SHEETS.SHIPMENT + '" (' + HEADERS.SHIPMENT.length + '列)');

  _createSheetTab(ss, CONFIG.SHEETS.PURCHASE, HEADERS.PURCHASE, [13]);  // col13: 送り状番号
  lines.push('[OK] タブ作成: "' + CONFIG.SHEETS.PURCHASE + '" (' + HEADERS.PURCHASE.length + '列)');
  lines.push('');

  // ─── 列一覧 ───
  lines.push('--- 発送タブ列一覧（' + HEADERS.SHIPMENT.length + '列）---');
  HEADERS.SHIPMENT.forEach(function(h, i) { lines.push('  col' + (i + 1) + ' ' + h); });
  lines.push('');
  lines.push('--- 仕入れタブ列一覧（' + HEADERS.PURCHASE.length + '列）---');
  HEADERS.PURCHASE.forEach(function(h, i) { lines.push('  col' + (i + 1) + ' ' + h); });
  lines.push('');

  // ─── compare ───
  lines.push(compareShipmentHeaders());
  lines.push('');
  lines.push(comparePurchaseHeaders());
  lines.push('');

  // ─── 採番初回値 ───
  lines.push('--- 採番初回値 ---');
  lines.push('nextShipmentId: ' + nextShipmentId());
  lines.push('nextPurchaseId: ' + nextPurchaseId());
  lines.push('');
  lines.push('=== セットアップ完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ─────────────────────────────────────────────
// 内部ヘルパー: タブ作成
// ─────────────────────────────────────────────
function _createSheetTab(ss, sheetName, headers, textFormatCols) {
  var sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');
  // '@'テキスト書式（運送状番号・送り状番号 列）
  if (textFormatCols && textFormatCols.length > 0) {
    textFormatCols.forEach(function(col) {
      sheet.getRange(2, col, 1000, 1).setNumberFormat('@');
    });
  }
  sheet.setFrozenRows(1);
}

// ─────────────────────────────────────────────
// compareShipmentHeaders
// ─────────────────────────────────────────────
function compareShipmentHeaders() {
  var ss = getSpreadsheet();
  var lines = ['=== 発送 (' + CONFIG.SHEETS.SHIPMENT + ') ==='];
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SHIPMENT);
  if (!sheet) {
    lines.push('  [ERROR] タブが見つかりません: ' + CONFIG.SHEETS.SHIPMENT);
    return lines.join('\n');
  }
  var expected = HEADERS.SHIPMENT;
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  var mismatches = 0;
  expected.forEach(function(h, i) {
    var act = String(actual[i] || '');
    var ok = (act === h);
    if (!ok) mismatches++;
    lines.push('  col' + (i + 1) + ': [' + (ok ? 'OK' : 'MISMATCH') + '] "' + h + '"' +
      (ok ? '' : ' / 実="' + act + '"'));
  });
  lines.push('  mismatches=' + mismatches);
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// comparePurchaseHeaders
// ─────────────────────────────────────────────
function comparePurchaseHeaders() {
  var ss = getSpreadsheet();
  var lines = ['=== 仕入れ (' + CONFIG.SHEETS.PURCHASE + ') ==='];
  var sheet = ss.getSheetByName(CONFIG.SHEETS.PURCHASE);
  if (!sheet) {
    lines.push('  [ERROR] タブが見つかりません: ' + CONFIG.SHEETS.PURCHASE);
    return lines.join('\n');
  }
  var expected = HEADERS.PURCHASE;
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  var mismatches = 0;
  expected.forEach(function(h, i) {
    var act = String(actual[i] || '');
    var ok = (act === h);
    if (!ok) mismatches++;
    lines.push('  col' + (i + 1) + ': [' + (ok ? 'OK' : 'MISMATCH') + '] "' + h + '"' +
      (ok ? '' : ' / 実="' + act + '"'));
  });
  lines.push('  mismatches=' + mismatches);
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// nextShipmentId — 発送シートの次の SHP-XXXXX を返す
// ─────────────────────────────────────────────
function nextShipmentId() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SHIPMENT);
  if (!sheet) throw new Error('タブが見つかりません: ' + CONFIG.SHEETS.SHIPMENT);
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(row) {
      var m = String(row[0] || '').match(/^SHP-(\d{5})$/);
      if (m) { var n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'SHP-' + ('00000' + (maxNum + 1)).slice(-5);
}

// ─────────────────────────────────────────────
// nextPurchaseId — 仕入れシートの次の PUR-XXXXX を返す
// ─────────────────────────────────────────────
function nextPurchaseId() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.PURCHASE);
  if (!sheet) throw new Error('タブが見つかりません: ' + CONFIG.SHEETS.PURCHASE);
  var maxNum = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(row) {
      var m = String(row[0] || '').match(/^PUR-(\d{5})$/);
      if (m) { var n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'PUR-' + ('00000' + (maxNum + 1)).slice(-5);
}
