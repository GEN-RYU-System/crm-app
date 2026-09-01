/**
 * DEV専用: リード管理 contact_method 列の実データ移行。
 *
 * 対象: `Email`（8件）→ `メール` への置換
 * 制約: contact_method 列のみ変更。他の列に触れない。
 *       dry-run で8件を確認してから実行すること。
 *       事前にバックアップを作成する。
 *
 * 書き込み系操作: リード管理 contact_method 列の setValue のみ
 *                バックアップシート（リード管理_backup_20260901_contact）の作成
 *
 * 実行順:
 *   clasp run devContactMethodMigrationDryRun  → 対象行確認
 *   clasp run devContactMethodMigrationExecute → 実移行
 */

var CONTACT_METHOD_BACKUP_SHEET = 'リード管理_backup_20260901_contact';
var CONTACT_METHOD_FROM = 'Email';
var CONTACT_METHOD_TO   = 'メール';

/**
 * dry-run: 変更対象の行を報告する（書き込みなし）
 * @returns {string} JSON.stringify({ totalRows, targetCount, targets })
 */
function devContactMethodMigrationDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('devContactMethodMigrationDryRun は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return JSON.stringify({ totalRows: 0, targetCount: 0, targets: [] });

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var cmIdx   = headers.indexOf('contact_method');

  if (cmIdx < 0) return JSON.stringify({ error: 'contact_method 列が見つかりません' });

  var targets = [];
  for (var r = 1; r < data.length; r++) {
    var val = String(data[r][cmIdx] != null ? data[r][cmIdx] : '').trim();
    if (val === CONTACT_METHOD_FROM) {
      var leadId = String(data[r][headers.indexOf('lead_id')] || '').trim();
      targets.push({ rowNumber: r + 1, lead_id: leadId, current: val, willBecome: CONTACT_METHOD_TO });
    }
  }

  return JSON.stringify({
    totalRows: lastRow - 1,
    targetCount: targets.length,
    fromValue: CONTACT_METHOD_FROM,
    toValue: CONTACT_METHOD_TO,
    targets: targets
  });
}

/**
 * 実移行: バックアップ作成 → contact_method 列の Email を メール に更新 → 検証
 * @returns {string} JSON.stringify({ backup, updated, verificationPassed, mismatchedOtherCols })
 */
function devContactMethodMigrationExecute() {
  if (getEnvironment() !== 'development') {
    throw new Error('devContactMethodMigrationExecute は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var leadsSheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  if (!leadsSheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });

  var lastRow = leadsSheet.getLastRow();
  var lastCol = leadsSheet.getLastColumn();
  if (lastRow < 2) return JSON.stringify({ error: 'データ行なし' });

  // 既存バックアップのチェック（冪等保護）
  var existingBackup = ss.getSheetByName(CONTACT_METHOD_BACKUP_SHEET);
  if (!existingBackup) {
    // バックアップ作成
    var backup = leadsSheet.copyTo(ss);
    backup.setName(CONTACT_METHOD_BACKUP_SHEET);
  }

  // 全データを読む
  var data    = leadsSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var cmIdx   = headers.indexOf('contact_method');

  if (cmIdx < 0) return JSON.stringify({ error: 'contact_method 列が見つかりません' });

  // 変更対象を特定して更新
  var updatedRows = [];
  for (var r = 1; r < data.length; r++) {
    var val = String(data[r][cmIdx] != null ? data[r][cmIdx] : '').trim();
    if (val === CONTACT_METHOD_FROM) {
      leadsSheet.getRange(r + 1, cmIdx + 1).setValue(CONTACT_METHOD_TO);
      updatedRows.push(r + 1);
    }
  }

  // 検証: 更新後に contact_method 列を再読み取り
  var afterData   = leadsSheet.getDataRange().getValues();
  var afterCmVals = afterData.slice(1).map(function(row) { return String(row[cmIdx] != null ? row[cmIdx] : '').trim(); });
  var remainingFrom = afterCmVals.filter(function(v) { return v === CONTACT_METHOD_FROM; }).length;

  // 検証: 他列がバックアップと変わっていないことを確認（contact_method 以外）
  var backupSheet = ss.getSheetByName(CONTACT_METHOD_BACKUP_SHEET);
  var mismatchedCols = [];
  if (backupSheet) {
    var backupData = backupSheet.getDataRange().getValues();
    for (var col = 0; col < Math.min(headers.length, lastCol); col++) {
      if (col === cmIdx) continue; // contact_method は変更対象なのでスキップ
      var colMismatches = 0;
      for (var row = 1; row < Math.min(afterData.length, backupData.length); row++) {
        var afterVal  = String(afterData[row][col]  != null ? afterData[row][col]  : '').trim();
        var backupVal = String(backupData[row][col] != null ? backupData[row][col] : '').trim();
        if (afterVal !== backupVal) colMismatches++;
      }
      if (colMismatches > 0) {
        mismatchedCols.push({ col: col + 1, header: headers[col], mismatchCount: colMismatches });
      }
    }
  }

  return JSON.stringify({
    backup: { name: CONTACT_METHOD_BACKUP_SHEET, existed: !!existingBackup },
    updated: updatedRows.length,
    updatedRows: updatedRows,
    remainingFromValue: remainingFrom,
    verificationPassed: remainingFrom === 0,
    mismatchedOtherCols: mismatchedCols,
    ok: remainingFrom === 0 && mismatchedCols.length === 0
  });
}
