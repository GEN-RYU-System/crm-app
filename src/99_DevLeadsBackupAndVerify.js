/**
 * DEV専用: LEADS 定義外13列削除前のバックアップ・退避・検証関数群
 * 書き込み系操作: backupLeadSheetPreDelete の copyTo / evacuateLeadDeleteTargetColumns の setValues のみ
 * 実行環境: DEV のみ
 */

/**
 * 既存バックアップシート（列名整形前）のヘッダーを確認する（読み取り専用）
 */
function checkLeadBackupSheetHeaders() {
  if (getEnvironment() !== 'development') throw new Error('DEV only');
  var ss = getSpreadsheet();
  var backupName = 'リード管理_backup_20260831';
  var sheet = ss.getSheetByName(backupName);
  if (!sheet) return JSON.stringify({ exists: false, sheetName: backupName });
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];
  return JSON.stringify({
    exists: true,
    sheetName: backupName,
    colCount: lastCol,
    rowCount: sheet.getLastRow(),
    headers: headers
  });
}

/**
 * 削除直前バックアップを作成する（現在の64列状態を複製）
 */
function backupLeadSheetPreDelete() {
  if (getEnvironment() !== 'development') throw new Error('DEV only');
  var ss = getSpreadsheet();
  var src = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!src) throw new Error('リード管理シートが見つかりません');
  var destName = 'リード管理_backup_predelete_20260901';
  if (ss.getSheetByName(destName)) {
    // 既に存在する場合は状態だけ返す（冪等）
    var dest2 = ss.getSheetByName(destName);
    return JSON.stringify({
      alreadyExists: true,
      srcRows: src.getLastRow(), srcCols: src.getLastColumn(),
      destRows: dest2.getLastRow(), destCols: dest2.getLastColumn()
    });
  }
  var lock = LockService.getScriptLock();
  var dest;
  try {
    lock.waitLock(30000);
    dest = src.copyTo(ss);
    dest.setName(destName);
  } finally {
    lock.releaseLock();
  }
  return JSON.stringify({
    success: true,
    srcRows: src.getLastRow(), srcCols: src.getLastColumn(),
    destRows: dest.getLastRow(), destCols: dest.getLastColumn(),
    colsMatch: src.getLastColumn() === dest.getLastColumn(),
    rowsMatch: src.getLastRow() === dest.getLastRow()
  });
}

/**
 * 削除対象13列のデータを退避シートにコピーする
 */
function evacuateLeadDeleteTargetColumns() {
  if (getEnvironment() !== 'development') throw new Error('DEV only');

  var TARGET_COLUMNS = [
    'リード進捗','商談進捗','1回の発注金額','購入頻度(月次)','商談の手応え',
    'Good Point','More Point','反省と今後の抱負',
    'レポート提出日','レポート確認者','レポート確認日','レポートコメント','Buddyフィードバック'
  ];

  var ss = getSpreadsheet();
  var src = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!src) throw new Error('リード管理シートが見つかりません');

  var destName = 'LEADS_deleted_columns_20260901';
  var existingDest = ss.getSheetByName(destName);

  var allHeaders = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0];
  var dataRows = Math.max(0, src.getLastRow() - 1);

  var colIndices = TARGET_COLUMNS.map(function(name) {
    var idx = allHeaders.indexOf(name);
    return { name: name, idx: idx };
  });
  var notFound = colIndices.filter(function(c) { return c.idx < 0; }).map(function(c){ return c.name; });
  if (notFound.length > 0) throw new Error('対象列が見つかりません: ' + notFound.join(', '));

  var dest;
  if (existingDest) {
    dest = existingDest;
  } else {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      dest = ss.insertSheet(destName);
    } finally {
      lock.releaseLock();
    }
    dest.getRange(1, 1, 1, TARGET_COLUMNS.length).setValues([TARGET_COLUMNS]);
  }

  if (dataRows > 0) {
    var allData = src.getRange(2, 1, dataRows, src.getLastColumn()).getValues();
    var evacuateData = allData.map(function(row) {
      return colIndices.map(function(c) { return row[c.idx]; });
    });
    dest.getRange(2, 1, dataRows, TARGET_COLUMNS.length).setValues(evacuateData);
  }

  // リード進捗・商談進捗のサンプル値
  var rIdx = TARGET_COLUMNS.indexOf('リード進捗');
  var sIdx = TARGET_COLUMNS.indexOf('商談進捗');
  var sample = [];
  if (dataRows > 0) {
    var sampleData = dest.getRange(2, 1, Math.min(dataRows, 3), TARGET_COLUMNS.length).getValues();
    sample = sampleData.map(function(row) {
      return { リード進捗: row[rIdx], 商談進捗: row[sIdx] };
    });
  }

  return JSON.stringify({
    success: true,
    evacuatedCols: TARGET_COLUMNS.length,
    evacuatedRows: dataRows,
    destDataRows: dest.getLastRow() - 1,
    rowsMatch: dataRows === (dest.getLastRow() - 1),
    sample_リード進捗_商談進捗: sample
  });
}

/**
 * 削除後のヘッダー・行数・バックアップ無傷を確認する（読み取り専用）
 */
function verifyLeadHeadersAfterDelete() {
  if (getEnvironment() !== 'development') throw new Error('DEV only');
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var backup = ss.getSheetByName('リード管理_backup_predelete_20260901');
  var evacuate = ss.getSheetByName('LEADS_deleted_columns_20260901');
  return JSON.stringify({
    currentColCount: sheet.getLastColumn(),
    currentRowCount: sheet.getLastRow(),
    currentHeaders: headers,
    backupColCount: backup ? backup.getLastColumn() : null,
    backupRowCount: backup ? backup.getLastRow() : null,
    evacuateColCount: evacuate ? evacuate.getLastColumn() : null,
    evacuateRowCount: evacuate ? evacuate.getLastRow() : null
  });
}
