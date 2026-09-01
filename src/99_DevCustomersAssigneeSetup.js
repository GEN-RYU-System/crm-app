/**
 * DEV専用: 顧客マスタの削除前バックアップを作成する。
 * @returns {string} JSON
 */
function backupCustomersMasterPreChange() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) {
    return JSON.stringify({ success: false, reason: '顧客マスタシートが見つかりません' });
  }

  var origRows = sheet.getLastRow();
  var origCols = sheet.getLastColumn();
  var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];

  var newSheet = sheet.copyTo(ss);
  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(ss.getNumSheets());
  newSheet.setName('顧客マスタ_backup_20260901');

  var backupRows = newSheet.getLastRow();
  var backupCols = newSheet.getLastColumn();
  var backupHeaders = newSheet.getRange(1, 1, 1, backupCols).getValues()[0];

  if (backupRows !== origRows || backupCols !== origCols) {
    return JSON.stringify({
      success: false,
      reason: '行数または列数が一致しません',
      origRows: origRows, backupRows: backupRows,
      origCols: origCols, backupCols: backupCols
    });
  }

  return JSON.stringify({
    success: true,
    backupName: '顧客マスタ_backup_20260901',
    rows: origRows,
    cols: origCols,
    headers: origHeaders
  });
}

/**
 * DEV専用: 顧客マスタの「担当者ID」ヘッダーを「sales_assignee_id」に変更する。
 * ヘッダー行のみ。データ行には一切触れない。
 * @returns {string} JSON
 */
function renameCustomersAssigneeIdHeader() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) {
    return JSON.stringify({ success: false, reason: '顧客マスタシートが見つかりません' });
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('担当者ID');

  if (targetIdx === -1) {
    // すでに sales_assignee_id になっているか確認
    var alreadyRenamed = headers.indexOf('sales_assignee_id');
    if (alreadyRenamed !== -1) {
      return JSON.stringify({ success: true, message: 'すでに sales_assignee_id に変更済み', colPosition: alreadyRenamed + 1 });
    }
    return JSON.stringify({ success: false, reason: '担当者ID 列が見つかりません', headers: headers });
  }

  // ヘッダー行の1セルのみ変更
  sheet.getRange(1, targetIdx + 1).setValue('sales_assignee_id');

  // 検証
  var afterHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var afterRows = sheet.getLastRow();
  var afterCols = sheet.getLastColumn();

  return JSON.stringify({
    success: true,
    colPosition: targetIdx + 1,
    beforeHeader: '担当者ID',
    afterHeader: afterHeaders[targetIdx],
    afterHeaders: afterHeaders,
    afterRows: afterRows,
    afterCols: afterCols
  });
}

/**
 * DEV専用: 顧客マスタの sales_assignee_id 列に EMP-00001 を全行書き込む dry-run。
 * 実際の書き込みは行わず、対象行数・列位置のみ報告する。
 * @returns {string} JSON
 */
function setCustomersAssigneeIdDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) return JSON.stringify({ error: '顧客マスタが見つかりません' });

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('sales_assignee_id');

  if (targetIdx === -1) {
    return JSON.stringify({ success: false, reason: 'sales_assignee_id 列が見つかりません', headers: headers });
  }

  var dataRows = lastRow - 1;
  var currentValues = sheet.getRange(2, targetIdx + 1, dataRows, 1).getValues();

  return JSON.stringify({
    success: true,
    colPosition: targetIdx + 1,
    targetColName: 'sales_assignee_id',
    dataRows: dataRows,
    currentValues: currentValues.map(function(r, i) { return { rowNum: i + 2, currentValue: r[0] }; }),
    willWrite: 'EMP-00001',
    dryRun: true
  });
}

/**
 * DEV専用: 顧客マスタの sales_assignee_id 列に EMP-00001 を全行書き込む。
 * sales_assignee_id 列のみ書き込む。他の列・他のシートには触れない。
 * @returns {string} JSON
 */
function setCustomersAssigneeId() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) return JSON.stringify({ error: '顧客マスタが見つかりません' });

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('sales_assignee_id');

  if (targetIdx === -1) {
    return JSON.stringify({ success: false, reason: 'sales_assignee_id 列が見つかりません' });
  }

  var dataRows = lastRow - 1;

  // 書き込み前の全列スナップショット（照合用）
  var beforeSnapshot = sheet.getRange(2, 1, dataRows, lastCol).getValues();

  // sales_assignee_id 列のみに EMP-00001 を書き込む
  Logger.log('書き込み前: col=' + (targetIdx + 1) + ', rows=' + dataRows);
  var writeValues = [];
  for (var i = 0; i < dataRows; i++) {
    writeValues.push(['EMP-00001']);
    Logger.log('  row' + (i + 2) + ': "" → "EMP-00001"');
  }
  sheet.getRange(2, targetIdx + 1, dataRows, 1).setValues(writeValues);

  // 書き込み後の全列スナップショット（照合用）
  var afterSnapshot = sheet.getRange(2, 1, dataRows, lastCol).getValues();

  // 検証1: sales_assignee_id 列が全行 EMP-00001 になっているか
  var allWritten = afterSnapshot.every(function(row) { return row[targetIdx] === 'EMP-00001'; });

  // 検証2: 他の列が変化していないか
  var otherColsIntact = true;
  for (var r = 0; r < dataRows; r++) {
    for (var c = 0; c < lastCol; c++) {
      if (c === targetIdx) continue; // 対象列はスキップ
      if (beforeSnapshot[r][c] !== afterSnapshot[r][c]) {
        otherColsIntact = false;
        Logger.log('警告: 他列が変化 row=' + (r + 2) + ' col=' + (c + 1));
      }
    }
  }

  // 検証3: 行数・列数が変化していないか
  var afterRows = sheet.getLastRow();
  var afterCols = sheet.getLastColumn();

  return JSON.stringify({
    success: allWritten && otherColsIntact && (afterRows === lastRow) && (afterCols === lastCol),
    colPosition: targetIdx + 1,
    dataRows: dataRows,
    allWritten: allWritten,
    otherColsIntact: otherColsIntact,
    rowsMatch: afterRows === lastRow,
    colsMatch: afterCols === lastCol,
    afterSnapshot: afterSnapshot.map(function(row, i) {
      return {
        rowNum: i + 2,
        sales_assignee_id: row[targetIdx]
      };
    })
  });
}

/**
 * DEV専用: 顧客マスタの sales_assignee_id 列の現在値を確認する（読み取り専用）。
 * @returns {string} JSON
 */
function readCustomersAssigneeIdCurrent() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('CUSTOMERS'));
  if (!sheet) return JSON.stringify({ error: '顧客マスタが見つかりません' });

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var targetIdx = headers.indexOf('sales_assignee_id');

  if (targetIdx === -1) {
    return JSON.stringify({ success: false, reason: 'sales_assignee_id 列が見つかりません', headers: headers });
  }

  var dataRows = lastRow - 1;
  var currentValues = sheet.getRange(2, targetIdx + 1, dataRows, 1).getValues();

  var allEmp00001 = currentValues.every(function(r) { return r[0] === 'EMP-00001'; });

  return JSON.stringify({
    success: true,
    colPosition: targetIdx + 1,
    headers: headers,
    dataRows: dataRows,
    allEmp00001: allEmp00001,
    currentValues: currentValues.map(function(r, i) { return { rowNum: i + 2, value: r[0] }; })
  });
}

/**
 * DEV専用: 顧客マスタと顧客マスタ_backup_20260901 を全セル照合する。
 * 日付は toISOString() で文字列化して比較する。
 * sales_assignee_id 列のみ差分が許容される。
 * @returns {string} JSON
 */
function compareCustomersVsBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();

  var currentSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMERS);
  var backupSheet  = ss.getSheetByName('顧客マスタ_backup_20260901');

  if (!currentSheet) return JSON.stringify({ error: '顧客マスタが見つかりません' });
  if (!backupSheet)  return JSON.stringify({ error: 'バックアップシートが見つかりません' });

  var curLastRow = currentSheet.getLastRow();
  var curLastCol = currentSheet.getLastColumn();
  var bkLastRow  = backupSheet.getLastRow();
  var bkLastCol  = backupSheet.getLastColumn();

  if (curLastRow !== bkLastRow || curLastCol !== bkLastCol) {
    return JSON.stringify({
      match: false,
      reason: '行数または列数が異なります',
      current:  { rows: curLastRow, cols: curLastCol },
      backup:   { rows: bkLastRow,  cols: bkLastCol }
    });
  }

  var curHeaders = currentSheet.getRange(1, 1, 1, curLastCol).getValues()[0];
  var bkHeaders  = backupSheet.getRange(1, 1, 1, bkLastCol).getValues()[0];

  // 許容差分列: sales_assignee_id（旧ヘッダー: 担当者ID）
  // バックアップは変更前なので '担当者ID' で探す
  var skipColIdxCurrent = curHeaders.indexOf('sales_assignee_id');
  var skipColIdxBackup  = bkHeaders.indexOf('担当者ID');

  // バックアップヘッダーが sales_assignee_id になっている場合にも対応
  if (skipColIdxBackup === -1) skipColIdxBackup = bkHeaders.indexOf('sales_assignee_id');

  /**
   * セルの値を型非依存な文字列に正規化する
   */
  function normalize(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }

  var diffs = [];

  // ヘッダー行の照合（スキップ列以外）
  for (var c = 0; c < curLastCol; c++) {
    if (c === skipColIdxCurrent) continue;
    var cur = normalize(curHeaders[c]);
    var bk  = normalize(bkHeaders[c]);
    if (cur !== bk) {
      diffs.push({ row: 1, col: c + 1, currentVal: cur, backupVal: bk });
    }
  }

  // データ行の照合（行2〜lastRow）
  if (curLastRow >= 2) {
    var curData = currentSheet.getRange(2, 1, curLastRow - 1, curLastCol).getValues();
    var bkData  = backupSheet.getRange(2, 1, bkLastRow - 1, bkLastCol).getValues();

    for (var r = 0; r < curData.length; r++) {
      for (var c2 = 0; c2 < curLastCol; c2++) {
        if (c2 === skipColIdxCurrent) continue;
        var curV = normalize(curData[r][c2]);
        var bkV  = normalize(bkData[r][c2]);
        if (curV !== bkV) {
          diffs.push({
            row: r + 2,
            col: c2 + 1,
            colName: curHeaders[c2],
            currentVal: curV,
            backupVal: bkV
          });
        }
      }
    }
  }

  return JSON.stringify({
    match: diffs.length === 0,
    totalRows: curLastRow,
    totalCols: curLastCol,
    skippedColCurrent: skipColIdxCurrent + 1,
    skippedColBackup:  skipColIdxBackup + 1,
    diffs: diffs,
    auditedAt: new Date().toISOString()
  });
}
