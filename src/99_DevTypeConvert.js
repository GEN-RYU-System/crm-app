/**
 * 型混在列の解消（バックアップ / dry-run / 実行 / 検証）
 * 対象: 配送先マスタ.zip / 支払先マスタ.zip / システム設定.setting_value
 *
 * PostgreSQL 移植対応 — 型混在列の解消 (2026-09-02)
 *
 * 実行順序:
 *   1. devBackupTypeConvertSheets()   — バックアップ作成
 *   2. devDryRunTypeConvert()         — 変換内容の事前確認
 *   3. devExecuteTypeConvert()        — 実際の変換実行
 *   4. devVerifyTypeConvert()         — 変換後の検証
 */

// ============================================================
// Step 1: バックアップ作成
// ============================================================

/**
 * 対象シートをバックアップシートとしてコピーする。
 * 既存バックアップがある場合はスキップ（二重バックアップ防止）。
 */
function devBackupTypeConvertSheets() {
  var ss = getSpreadsheet();
  var results = [];

  var targets = [
    { tableKey: 'SHIPPING_DESTINATIONS', backupName: '配送先マスタ_backup_20260902_type' },
    { tableKey: 'PAYMENT_DESTINATIONS',  backupName: '支払先マスタ_backup_20260902_type' },
    { tableKey: 'SETTINGS',              backupName: 'システム設定_backup_20260902_type' }
  ];

  targets.forEach(function(t) {
    var sheet = getCoreSchemaV1Sheet(ss, t.tableKey);
    var existing = ss.getSheetByName(t.backupName);
    if (existing) {
      results.push({ tableKey: t.tableKey, skipped: true, reason: '既存バックアップあり' });
      return;
    }
    var backup = sheet.copyTo(ss);
    backup.setName(t.backupName);
    results.push({
      tableKey: t.tableKey,
      backupName: t.backupName,
      rows: backup.getLastRow(),
      cols: backup.getLastColumn(),
      originalRows: sheet.getLastRow(),
      originalCols: sheet.getLastColumn(),
      rowMatch: backup.getLastRow() === sheet.getLastRow(),
      colMatch: backup.getLastColumn() === sheet.getLastColumn()
    });
  });

  return results;
}

// ============================================================
// Step 2: dry-run（変換内容の事前確認）
// ============================================================

/**
 * 実際の変換は行わず、変換対象の行・列・before/after をリストアップする。
 */
function devDryRunTypeConvert() {
  var ss = getSpreadsheet();
  var report = [];

  // 配送先マスタ zip
  var shippingSheet = getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS');
  var shHeaders = shippingSheet.getRange(1, 1, 1, shippingSheet.getLastColumn()).getValues()[0];
  var shZipIdx = shHeaders.indexOf('zip');
  if (shZipIdx >= 0 && shippingSheet.getLastRow() > 1) {
    var shData = shippingSheet.getRange(2, 1, shippingSheet.getLastRow() - 1, shippingSheet.getLastColumn()).getValues();
    shData.forEach(function(row, i) {
      var v = row[shZipIdx];
      if (typeof v !== 'string') {
        report.push({ sheet: '配送先マスタ', row: i + 2, col: shZipIdx + 1, before: v, beforeType: typeof v, after: String(v), afterType: 'string' });
      }
    });
  }

  // 支払先マスタ zip
  var paymentSheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');
  var pmHeaders = paymentSheet.getRange(1, 1, 1, paymentSheet.getLastColumn()).getValues()[0];
  var pmZipIdx = pmHeaders.indexOf('zip');
  if (pmZipIdx >= 0 && paymentSheet.getLastRow() > 1) {
    var pmData = paymentSheet.getRange(2, 1, paymentSheet.getLastRow() - 1, paymentSheet.getLastColumn()).getValues();
    pmData.forEach(function(row, i) {
      var v = row[pmZipIdx];
      if (typeof v !== 'string') {
        report.push({ sheet: '支払先マスタ', row: i + 2, col: pmZipIdx + 1, before: v, beforeType: typeof v, after: String(v), afterType: 'string' });
      }
    });
  }

  // システム設定 setting_value
  var settingsSheet = getCoreSchemaV1Sheet(ss, 'SETTINGS');
  var stHeaders = settingsSheet.getRange(1, 1, 1, settingsSheet.getLastColumn()).getValues()[0];
  var svIdx = stHeaders.indexOf('setting_value');
  if (svIdx >= 0 && settingsSheet.getLastRow() > 1) {
    var stData = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, settingsSheet.getLastColumn()).getValues();
    stData.forEach(function(row, i) {
      var v = row[svIdx];
      if (typeof v !== 'string') {
        // boolean: String(true) = "true", String(false) = "false" (小文字)
        // number:  String(30) = "30"
        var strVal = String(v);
        report.push({ sheet: 'システム設定', row: i + 2, col: svIdx + 1, before: v, beforeType: typeof v, after: strVal, afterType: 'string' });
      }
    });
  }

  return { dryRun: true, changes: report };
}

// ============================================================
// Step 3: 実際の変換実行
// ============================================================

/**
 * 非文字列の zip / setting_value セルをすべて文字列に変換する。
 * セルの書式を '@'（テキスト）に設定してから setValue() する。
 *
 * 注意: boolean の場合は String(true) = "true"、String(false) = "false"（小文字）
 */
function devExecuteTypeConvert() {
  var ss = getSpreadsheet();
  var changed = [];

  // --- 配送先マスタ zip ---
  var shippingSheet = getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS');
  var shHeaders = shippingSheet.getRange(1, 1, 1, shippingSheet.getLastColumn()).getValues()[0];
  var shZipIdx = shHeaders.indexOf('zip');
  if (shZipIdx >= 0 && shippingSheet.getLastRow() > 1) {
    var shData = shippingSheet.getRange(2, 1, shippingSheet.getLastRow() - 1, shippingSheet.getLastColumn()).getValues();
    shData.forEach(function(row, i) {
      var v = row[shZipIdx];
      if (typeof v !== 'string') {
        var cell = shippingSheet.getRange(i + 2, shZipIdx + 1);
        cell.setNumberFormat('@');  // 書式を文字列に設定
        cell.setValue(String(v));
        changed.push({ sheet: '配送先マスタ', row: i + 2, col: shZipIdx + 1, before: v, after: String(v) });
      }
    });
  }

  // --- 支払先マスタ zip ---
  var paymentSheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');
  var pmHeaders = paymentSheet.getRange(1, 1, 1, paymentSheet.getLastColumn()).getValues()[0];
  var pmZipIdx = pmHeaders.indexOf('zip');
  if (pmZipIdx >= 0 && paymentSheet.getLastRow() > 1) {
    var pmData = paymentSheet.getRange(2, 1, paymentSheet.getLastRow() - 1, paymentSheet.getLastColumn()).getValues();
    pmData.forEach(function(row, i) {
      var v = row[pmZipIdx];
      if (typeof v !== 'string') {
        var cell = paymentSheet.getRange(i + 2, pmZipIdx + 1);
        cell.setNumberFormat('@');
        cell.setValue(String(v));
        changed.push({ sheet: '支払先マスタ', row: i + 2, col: pmZipIdx + 1, before: v, after: String(v) });
      }
    });
  }

  // --- システム設定 setting_value ---
  var settingsSheet = getCoreSchemaV1Sheet(ss, 'SETTINGS');
  var stHeaders = settingsSheet.getRange(1, 1, 1, settingsSheet.getLastColumn()).getValues()[0];
  var svIdx = stHeaders.indexOf('setting_value');
  if (svIdx >= 0 && settingsSheet.getLastRow() > 1) {
    var stData = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, settingsSheet.getLastColumn()).getValues();
    stData.forEach(function(row, i) {
      var v = row[svIdx];
      if (typeof v !== 'string') {
        // boolean: "true" / "false"（小文字）— getSettingValue は rawValue === 'true' で判定
        var strVal = String(v);
        var cell = settingsSheet.getRange(i + 2, svIdx + 1);
        cell.setNumberFormat('@');
        cell.setValue(strVal);
        changed.push({ sheet: 'システム設定', row: i + 2, col: svIdx + 1, before: v, after: strVal });
      }
    });
  }

  return { changed: changed };
}

// ============================================================
// Step 4: 実行後の検証
// ============================================================

/**
 * 変換後に全行が文字列型になっているかを検証する。
 * issues が空（pass: true）であれば成功。
 */
function devVerifyTypeConvert() {
  var ss = getSpreadsheet();
  var issues = [];

  function checkCol(tableKey, colName) {
    var sheet = getCoreSchemaV1Sheet(ss, tableKey);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colIdx = headers.indexOf(colName);
    if (colIdx < 0) { issues.push({ tableKey: tableKey, colName: colName, error: '列が見つかりません' }); return; }
    if (sheet.getLastRow() < 2) return;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    data.forEach(function(row, i) {
      var v = row[colIdx];
      if (typeof v !== 'string') {
        issues.push({ tableKey: tableKey, colName: colName, row: i + 2, value: v, type: typeof v, error: '文字列化されていない' });
      }
    });
  }

  checkCol('SHIPPING_DESTINATIONS', 'zip');
  checkCol('PAYMENT_DESTINATIONS', 'zip');
  checkCol('SETTINGS', 'setting_value');

  return { issues: issues, pass: issues.length === 0 };
}
