/**
 * システム設定シートの削除前バックアップ・空列削除関数（DEV専用）
 *
 * 不可逆操作のため全関数に DEV環境チェックを設ける。
 * 実行順序:
 *   1. backupSettingsSheetPreDelete      — シート全体を複製してバックアップ
 *   2. evacuateSettingsDeleteTargetColumns — 削除対象列（6〜14）を退避シートへ保存
 *   3. settingsDeleteColsDryRun           — 削除対象を確認（実変更なし）
 *   4. settingsDeleteColsExecute         — 実削除（右端→左順、不可逆）
 */

/**
 * システム設定シートの削除前バックアップを作成する（DEV専用）
 */
function backupSettingsSheetPreDelete() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');
  if (!sheet) {
    return JSON.stringify({ success: false, reason: 'システム設定シートが見つかりません' });
  }

  var origRows = sheet.getLastRow();
  var origCols = sheet.getLastColumn();
  var origHeaders = sheet.getRange(1, 1, 1, origCols).getValues()[0];

  var newSheet = sheet.copyTo(ss);
  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(ss.getNumSheets());
  newSheet.setName('システム設定_backup_predelete_20260901');

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
    rows: origRows,
    cols: origCols,
    backupName: 'システム設定_backup_predelete_20260901'
  });
}

/**
 * 削除対象9列のデータを退避シートに保存する（DEV専用）
 */
function evacuateSettingsDeleteTargetColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');
  if (!sheet) {
    return JSON.stringify({ success: false, reason: 'システム設定シートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  // 列6〜14のデータを取得（列14が lastCol を超える場合は存在する列まで）
  var startCol = 6;
  var endCol = Math.min(14, lastCol);
  var numCols = endCol - startCol + 1;

  var data = sheet.getRange(1, startCol, lastRow, numCols).getValues();

  // 列14(idx=13)の値チェック（値があればどの行かを報告。値は出力しない）
  var col14HasValue = false;
  var col14Row = -1;
  if (endCol >= 14) {
    var col14Idx = 14 - startCol; // 0-indexed within data
    data.forEach(function(row, i) {
      if (i > 0 && row[col14Idx] !== '' && row[col14Idx] !== null && row[col14Idx] !== undefined) {
        col14HasValue = true;
        col14Row = i + 1; // 1-indexed
      }
    });
  }

  // 退避シートを作成
  var evacuateSheet = ss.insertSheet('SETTINGS_deleted_columns_20260901');
  evacuateSheet.getRange(1, 1, data.length, numCols).setValues(data);

  if (evacuateSheet.getLastRow() !== lastRow) {
    return JSON.stringify({
      success: false,
      reason: '退避シートの行数が元と一致しません',
      origRows: lastRow,
      evacuatedRows: evacuateSheet.getLastRow()
    });
  }

  return JSON.stringify({
    success: true,
    evacuatedRows: lastRow,
    evacuatedCols: numCols,
    col14HasValue: col14HasValue,
    col14Row: col14HasValue ? col14Row : null
  });
}

/**
 * システム設定シートの空列削除 dry-run（DEV専用）
 */
function settingsDeleteColsDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');
  if (!sheet) return JSON.stringify({ error: 'シートが見つかりません' });

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var targets = [];
  for (var c = 6; c <= 14; c++) {
    if (c <= lastCol) {
      targets.push({
        colNumber: c,
        headerValue: headers[c - 1] !== undefined ? headers[c - 1] : ''
      });
    } else {
      targets.push({ colNumber: c, headerValue: 'OUT_OF_RANGE' });
    }
  }

  return JSON.stringify({
    totalCols: lastCol,
    targetCount: targets.length,
    targets: targets
  });
}

/**
 * システム設定シートの空列9件を削除する（DEV専用）
 * 列6〜14を右端から左へ順番に削除する
 */
function settingsDeleteColsExecute() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');
  if (!sheet) return JSON.stringify({ error: 'シートが見つかりません' });

  var beforeCols = sheet.getLastColumn();
  var beforeRows = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, beforeCols).getValues()[0];

  Logger.log('削除前 列数: ' + beforeCols + ', 行数: ' + beforeRows);

  // 右端(14)から左(6)へ削除
  for (var c = 14; c >= 6; c--) {
    if (c <= beforeCols) {
      Logger.log('削除: 列' + c + ' header="' + (headers[c - 1] || '') + '"');
      sheet.deleteColumn(c);
    }
  }

  var afterCols = sheet.getLastColumn();
  var afterRows = sheet.getLastRow();
  var afterHeaders = afterCols > 0 ? sheet.getRange(1, 1, 1, afterCols).getValues()[0] : [];

  var emptyHeaderCols = [];
  afterHeaders.forEach(function(h, i) {
    if (h === '' || h === null || h === undefined) {
      emptyHeaderCols.push(i + 1);
    }
  });

  var success = (afterCols === beforeCols - 9) &&
                (afterRows === beforeRows) &&
                (emptyHeaderCols.length === 0);

  return JSON.stringify({
    success: success,
    beforeCols: beforeCols,
    afterCols: afterCols,
    expectedCols: beforeCols - 9,
    beforeRows: beforeRows,
    afterRows: afterRows,
    emptyHeaderCols: emptyHeaderCols
  });
}
