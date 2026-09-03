/**
 * DEV専用: lead_status 列の実データを 選択肢マスタV2 の値に統一するための
 * バックアップ・dry-run・実行・検証関数群。
 *
 * 書き込み系操作:
 *   - devLeadStatusBackup:   リード管理シートのコピー作成
 *   - devLeadStatusMigrationExecute: lead_status 列の値変換（7行）
 *
 * 実行順序:
 *   1. clasp run devLeadStatusBackup          ← バックアップ作成
 *   2. clasp run devLeadStatusMigrationDryRun ← 変換対象確認（7行であること）
 *   3. clasp run devLeadStatusMigrationExecute← 実行
 *   4. clasp run devLeadStatusVerify          ← 検証
 *
 * 変換マッピング（確定済み）:
 *   成約済み → 成約    （6行）
 *   新規     → 新規リード（1行）
 *   商談中   → 変更なし（2行）
 *   失注     → 変更なし（1行）
 */

var LEAD_STATUS_BACKUP_NAME = 'リード管理_backup_20260903_status';

var LEAD_STATUS_CONVERSION_MAP = {
  '成約済み': '成約',
  '新規':     '新規リード'
};

// V2 の 10値（検証用）
var LEAD_STATUS_V2_VALUES = [
  '新規リード', 'リード対応中', 'アサイン確定', 'リード対象外',
  '商談中', '商談対象外', '追客(短期)', '追客(長期)', '成約', '失注'
];

// ────────────────────────────────────────────────────────────────────────────
// バックアップ
// ────────────────────────────────────────────────────────────────────────────

/**
 * DEV専用: リード管理シートのバックアップを作成する（冪等）。
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusBackup は DEV 環境でのみ実行できます');
  }

  var ss  = getSpreadsheet();
  var src = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  if (!src) throw new Error('リード管理シートが見つかりません');

  // 既存バックアップの確認（冪等）
  var existing = ss.getSheetByName(LEAD_STATUS_BACKUP_NAME);
  if (existing) {
    return JSON.stringify({
      alreadyExists: true,
      backupName: LEAD_STATUS_BACKUP_NAME,
      srcRows: src.getLastRow(), srcCols: src.getLastColumn(),
      backupRows: existing.getLastRow(), backupCols: existing.getLastColumn(),
      match: src.getLastRow() === existing.getLastRow() && src.getLastColumn() === existing.getLastColumn()
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var dest = src.copyTo(ss);
    dest.setName(LEAD_STATUS_BACKUP_NAME);
    // コピー後の検証
    var srcRows  = src.getLastRow();
    var srcCols  = src.getLastColumn();
    var destRows = dest.getLastRow();
    var destCols = dest.getLastColumn();
    var srcHeaders  = srcCols  > 0 ? src.getRange(1, 1, 1, srcCols).getValues()[0]  : [];
    var destHeaders = destCols > 0 ? dest.getRange(1, 1, 1, destCols).getValues()[0] : [];
    return JSON.stringify({
      success: true,
      backupName: LEAD_STATUS_BACKUP_NAME,
      srcRows: srcRows, srcCols: srcCols,
      destRows: destRows, destCols: destCols,
      rowMatch: srcRows === destRows,
      colMatch: srcCols === destCols,
      headerMatch: JSON.stringify(srcHeaders) === JSON.stringify(destHeaders)
    });
  } finally {
    lock.releaseLock();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dry-run
// ────────────────────────────────────────────────────────────────────────────

/**
 * DEV専用: lead_status 変換の dry-run（書き込みなし）。
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusMigrationDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusMigrationDryRun は DEV 環境でのみ実行できます');
  }

  var ss      = getSpreadsheet();
  var sheet   = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var statusColIdx = headers.indexOf('lead_status');
  if (statusColIdx < 0) throw new Error('lead_status 列が見つかりません');

  var changes = [];
  var unknownValues = [];

  for (var r = 1; r < data.length; r++) {
    var raw = data[r][statusColIdx];
    var val = (raw === null || raw === undefined) ? '' : String(raw).trim();
    if (!val) continue;

    if (LEAD_STATUS_CONVERSION_MAP.hasOwnProperty(val)) {
      changes.push({
        rowIndex: r + 1,
        before: val,
        after: LEAD_STATUS_CONVERSION_MAP[val]
      });
    } else if (LEAD_STATUS_V2_VALUES.indexOf(val) === -1) {
      unknownValues.push({ rowIndex: r + 1, value: val });
    }
  }

  return JSON.stringify({
    statusColPosition: statusColIdx + 1,
    totalDataRows: data.length - 1,
    plannedChanges: changes,
    plannedChangeCount: changes.length,
    unknownValues: unknownValues,
    unknownValueCount: unknownValues.length
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 実行
// ────────────────────────────────────────────────────────────────────────────

/**
 * DEV専用: lead_status 列の値を V2 の値に統一する。
 *
 * 前提: devLeadStatusBackup と devLeadStatusMigrationDryRun を先に実行すること。
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusMigrationExecute() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusMigrationExecute は DEV 環境でのみ実行できます');
  }

  // バックアップ存在確認
  var ss = getSpreadsheet();
  if (!ss.getSheetByName(LEAD_STATUS_BACKUP_NAME)) {
    throw new Error('バックアップが見つかりません: ' + LEAD_STATUS_BACKUP_NAME +
      ' — devLeadStatusBackup を先に実行してください');
  }

  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var statusColIdx = headers.indexOf('lead_status');
  if (statusColIdx < 0) throw new Error('lead_status 列が見つかりません');

  var lock = LockService.getScriptLock();
  var changed = [];
  var unknownValues = [];
  try {
    lock.waitLock(30000);

    for (var r = 1; r < data.length; r++) {
      var raw = data[r][statusColIdx];
      var val = (raw === null || raw === undefined) ? '' : String(raw).trim();
      if (!val) continue;

      if (LEAD_STATUS_CONVERSION_MAP.hasOwnProperty(val)) {
        var newVal = LEAD_STATUS_CONVERSION_MAP[val];
        // 1-indexed: row r+1, column statusColIdx+1
        sheet.getRange(r + 1, statusColIdx + 1).setValue(newVal);
        changed.push({ rowIndex: r + 1, before: val, after: newVal });
      } else if (LEAD_STATUS_V2_VALUES.indexOf(val) === -1) {
        unknownValues.push({ rowIndex: r + 1, value: val });
      }
    }
  } finally {
    lock.releaseLock();
  }

  return JSON.stringify({
    changedCount: changed.length,
    changed: changed,
    unknownValues: unknownValues,
    unknownValueCount: unknownValues.length
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 検証
// ────────────────────────────────────────────────────────────────────────────

/**
 * DEV専用: 実行後の検証。
 *   - lead_status の全値が V2 の10値のいずれかであること
 *   - 行数・列数がバックアップと一致すること
 *   - 他の列（lead_status 以外）がバックアップと一致すること（日付は文字列比較で正規化）
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusVerify() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusVerify は DEV 環境でのみ実行できます');
  }

  var ss      = getSpreadsheet();
  var sheet   = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  var backup  = ss.getSheetByName(LEAD_STATUS_BACKUP_NAME);
  if (!sheet)  throw new Error('リード管理シートが見つかりません');
  if (!backup) throw new Error('バックアップが見つかりません: ' + LEAD_STATUS_BACKUP_NAME);

  var data   = sheet.getDataRange().getValues();
  var bData  = backup.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var statusColIdx = headers.indexOf('lead_status');
  if (statusColIdx < 0) throw new Error('lead_status 列が見つかりません');

  var rowMatch = data.length === bData.length;
  var colMatch = (data[0] || []).length === (bData[0] || []).length;

  // lead_status 列の検証
  var statusViolations = [];
  var statusValues = [];
  for (var r = 1; r < data.length; r++) {
    var val = String(data[r][statusColIdx] != null ? data[r][statusColIdx] : '').trim();
    statusValues.push(val);
    if (val && LEAD_STATUS_V2_VALUES.indexOf(val) === -1) {
      statusViolations.push({ rowIndex: r + 1, value: val });
    }
  }

  // 他の列の変更確認（lead_status 列を除く）
  var otherColViolations = [];
  var numCols = Math.min((data[0] || []).length, (bData[0] || []).length);
  for (var r2 = 1; r2 < Math.min(data.length, bData.length); r2++) {
    for (var c = 0; c < numCols; c++) {
      if (c === statusColIdx) continue;
      var dVal = String(data[r2][c]  != null ? data[r2][c]  : '').replace(/\s+/g, ' ').trim();
      var bVal = String(bData[r2][c] != null ? bData[r2][c] : '').replace(/\s+/g, ' ').trim();
      if (dVal !== bVal) {
        otherColViolations.push({
          rowIndex: r2 + 1,
          colIndex: c + 1,
          header: headers[c] || '',
          current: dVal,
          backup: bVal
        });
      }
    }
  }

  var pass = rowMatch && colMatch && statusViolations.length === 0 && otherColViolations.length === 0;

  return JSON.stringify({
    pass: pass,
    rowMatch: rowMatch,
    colMatch: colMatch,
    statusViolations: statusViolations,
    statusViolationCount: statusViolations.length,
    statusValueCounts: (function() {
      var m = {};
      statusValues.forEach(function(v) { m[v] = (m[v] || 0) + 1; });
      return m;
    })(),
    otherColViolations: otherColViolations.slice(0, 10),
    otherColViolationCount: otherColViolations.length
  });
}
