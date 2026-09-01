/**
 * DEV専用: リード管理シートの列追加前バックアップを作成する。
 * @returns {string} JSON
 */
function backupLeadsMasterPreAssigneeAdd() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return JSON.stringify({ success: false, reason: 'リード管理シートが見つかりません', sheetNameTried: sheetName });
  }

  var origRows = sheet.getLastRow();
  var origCols = sheet.getLastColumn();
  var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];

  var newSheet = sheet.copyTo(ss);
  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(ss.getNumSheets());
  newSheet.setName('リード管理_backup_20260901_assigneeid');

  var backupRows = newSheet.getLastRow();
  var backupCols = newSheet.getLastColumn();

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
    backupName: 'リード管理_backup_20260901_assigneeid',
    rows: origRows,
    cols: origCols,
    headers: origHeaders
  });
}

/**
 * DEV専用: LEADS の sales_assignee_name 直後に sales_assignee_id 列を追加する dry-run。
 * 実際の挿入は行わず、挿入位置と挿入後の列構成を報告するのみ。
 * @returns {string} JSON
 */
function addLeadsSalesAssigneeIdDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません', sheetNameTried: sheetName });

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var sourceIdx = headers.indexOf('sales_assignee_name');
  if (sourceIdx === -1) {
    return JSON.stringify({ success: false, reason: 'sales_assignee_name 列が見つかりません', headers: headers });
  }

  // 挿入位置: sales_assignee_name の直後（1-indexed）
  var insertAfterCol = sourceIdx + 1; // 1-indexed の sales_assignee_name 列番号
  var insertAtCol    = insertAfterCol + 1; // 新列を挿入する位置（この列の前に挿入 = 直後に追加）

  // 挿入後の列構成をシミュレーション
  var simulatedHeaders = headers.slice(0, sourceIdx + 1)
    .concat(['sales_assignee_id'])
    .concat(headers.slice(sourceIdx + 1));

  return JSON.stringify({
    success: true,
    dryRun: true,
    currentColCount: lastCol,
    expectedColCount: lastCol + 1,
    sales_assignee_name_colPosition: insertAfterCol,
    insertAtColPosition: insertAtCol,
    simulatedHeaders: simulatedHeaders
  });
}

/**
 * DEV専用: LEADS の sales_assignee_name 直後に sales_assignee_id 列を追加する。
 * ヘッダーのみ書き込む。データ行には書き込まない。
 * @returns {string} JSON
 */
function addLeadsSalesAssigneeId() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return JSON.stringify({ error: 'リード管理シートが見つかりません', sheetNameTried: sheetName });

  var beforeCols = sheet.getLastColumn();
  var beforeRows = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, beforeCols).getValues()[0];

  var sourceIdx = headers.indexOf('sales_assignee_name');
  if (sourceIdx === -1) {
    return JSON.stringify({ success: false, reason: 'sales_assignee_name 列が見つかりません' });
  }

  // 挿入位置: sales_assignee_name（1-indexed = sourceIdx+1）の直後
  var insertAtCol = sourceIdx + 2; // insertColumnAfter は insertAtCol-1 列の後に挿入

  Logger.log('挿入前 列数: ' + beforeCols + ', 挿入位置: ' + insertAtCol);
  Logger.log('sales_assignee_name の列番号: ' + (sourceIdx + 1));

  // sales_assignee_name の直後に列を挿入
  sheet.insertColumnAfter(sourceIdx + 1);

  // 新しい列のヘッダーを設定
  sheet.getRange(1, insertAtCol).setValue('sales_assignee_id');
  Logger.log('ヘッダー設定: col' + insertAtCol + ' = sales_assignee_id');

  // 検証
  var afterCols = sheet.getLastColumn();
  var afterRows = sheet.getLastRow();
  var afterHeaders = sheet.getRange(1, 1, 1, afterCols).getValues()[0];
  var newColIdx = afterHeaders.indexOf('sales_assignee_id');

  var success = (afterCols === beforeCols + 1) &&
                (afterRows === beforeRows) &&
                (newColIdx !== -1) &&
                (afterHeaders[sourceIdx] === 'sales_assignee_name') &&
                (afterHeaders[sourceIdx + 1] === 'sales_assignee_id');

  return JSON.stringify({
    success: success,
    beforeCols: beforeCols,
    afterCols: afterCols,
    expectedCols: beforeCols + 1,
    beforeRows: beforeRows,
    afterRows: afterRows,
    newColPosition: newColIdx + 1,
    afterHeaders: afterHeaders,
    sales_assignee_name_position: sourceIdx + 1,
    sales_assignee_id_position: sourceIdx + 2
  });
}

/**
 * DEV専用: リード管理とバックアップを全セル照合する（列追加した sales_assignee_id 除く）。
 * 日付は toISOString() で正規化して比較する。
 * @returns {string} JSON
 */
function compareLeadsVsBackupAfterAdd() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('LEADS');
  var currentSheet = ss.getSheetByName(sheetName);
  var backupSheet  = ss.getSheetByName('リード管理_backup_20260901_assigneeid');

  if (!currentSheet) return JSON.stringify({ error: 'リード管理シートが見つかりません' });
  if (!backupSheet)  return JSON.stringify({ error: 'バックアップシートが見つかりません' });

  var curLastRow = currentSheet.getLastRow();
  var curLastCol = currentSheet.getLastColumn();
  var bkLastRow  = backupSheet.getLastRow();
  var bkLastCol  = backupSheet.getLastColumn();

  // 列追加後: currentSheet は bkLastCol + 1 列のはず
  if (curLastRow !== bkLastRow || curLastCol !== bkLastCol + 1) {
    return JSON.stringify({
      match: false,
      reason: '行数または列数が想定外',
      current: { rows: curLastRow, cols: curLastCol },
      backup:  { rows: bkLastRow,  cols: bkLastCol },
      expected: { rows: bkLastRow, cols: bkLastCol + 1 }
    });
  }

  var curHeaders = currentSheet.getRange(1, 1, 1, curLastCol).getValues()[0];
  var bkHeaders  = backupSheet.getRange(1, 1, 1, bkLastCol).getValues()[0];

  // 追加した列 sales_assignee_id のインデックスをスキップ
  var skipColIdxCurrent = curHeaders.indexOf('sales_assignee_id');

  function normalize(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }

  var diffs = [];

  // 現在シートの列に対して、バックアップの対応列（追加列をスキップして対応付け）と照合
  var bkColOffset = 0;
  for (var c = 0; c < curLastCol; c++) {
    if (c === skipColIdxCurrent) {
      bkColOffset = -1; // バックアップ側はこの列がないのでオフセット
      continue;
    }
    var bkC = c + bkColOffset;
    if (bkC < 0 || bkC >= bkLastCol) continue;

    // ヘッダー照合
    var curH = normalize(curHeaders[c]);
    var bkH  = normalize(bkHeaders[bkC]);
    if (curH !== bkH) {
      diffs.push({ row: 1, curCol: c + 1, bkCol: bkC + 1, currentVal: curH, backupVal: bkH });
    }
  }

  // データ行照合
  if (curLastRow >= 2) {
    var curData = currentSheet.getRange(2, 1, curLastRow - 1, curLastCol).getValues();
    var bkData  = backupSheet.getRange(2, 1, bkLastRow - 1, bkLastCol).getValues();

    for (var r = 0; r < curData.length; r++) {
      var bkColOffset2 = 0;
      for (var c2 = 0; c2 < curLastCol; c2++) {
        if (c2 === skipColIdxCurrent) {
          bkColOffset2 = -1;
          continue;
        }
        var bkC2 = c2 + bkColOffset2;
        if (bkC2 < 0 || bkC2 >= bkLastCol) continue;

        var curV = normalize(curData[r][c2]);
        var bkV  = normalize(bkData[r][bkC2]);
        if (curV !== bkV) {
          diffs.push({
            row: r + 2,
            curCol: c2 + 1,
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
    currentCols: curLastCol,
    backupCols: bkLastCol,
    skippedColCurrent: skipColIdxCurrent + 1,
    diffs: diffs,
    auditedAt: new Date().toISOString()
  });
}
