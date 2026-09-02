/**
 * ログインセッション 列名リネーム用 DEV ユーティリティ
 *
 * devBackupLoginSessionsSheet()
 *   - ログインセッション を ログインセッション_backup_20260902 にコピー
 *   - 行列数とヘッダーを検証する
 *
 * devRenameLoginSessionsColumns()
 *   - ログインセッション の1行目（ヘッダー）を新列名に変更する
 *   - データ行（2行目以降）は一切変更しない
 *   - シートの削除・並べ替え・行列の挿入削除は行わない
 *
 * ★ 実行は指示に従って順番に行うこと
 */

function devBackupLoginSessionsSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheet().getId());
  var src = ss.getSheetByName('ログインセッション');
  if (!src) { throw new Error('シートが見つかりません: ログインセッション'); }

  var backupName = 'ログインセッション_backup_20260902';
  if (ss.getSheetByName(backupName)) { throw new Error('バックアップ既存: ' + backupName); }

  var bk = src.copyTo(ss);
  bk.setName(backupName);

  var srcData = src.getDataRange().getValues();
  var bkData  = bk.getDataRange().getValues();

  if (srcData.length !== bkData.length || srcData[0].length !== bkData[0].length) {
    throw new Error('バックアップ行列数不一致');
  }

  return {
    originalRows: srcData.length,
    originalCols: srcData[0].length,
    backupName:   backupName,
    headers:      srcData[0]
  };
}

function devRenameLoginSessionsColumns() {
  var ss    = SpreadsheetApp.openById(getSpreadsheet().getId());
  var sheet = ss.getSheetByName('ログインセッション');
  if (!sheet) { throw new Error('シートが見つかりません: ログインセッション'); }

  var RENAME_MAP = {
    'セッションID':   'session_id',
    '担当者ID':       'staff_id',
    '発行日時':       'issued_at',
    '最終利用日時':   'last_used_at',
    '失効日時':       'expires_at',
    '状態':           'status'
  };

  var headerRow      = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var originalRowCount = sheet.getLastRow();
  var originalColCount = sheet.getLastColumn();

  var renamedCount = 0;
  var skipped = [];
  for (var i = 0; i < headerRow.length; i++) {
    if (RENAME_MAP[headerRow[i]]) {
      sheet.getRange(1, i + 1).setValue(RENAME_MAP[headerRow[i]]);
      renamedCount++;
    } else if (headerRow[i] !== '') {
      skipped.push({ col: i + 1, name: headerRow[i] });
    }
  }

  var newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return {
    renamedCount:   renamedCount,
    expectedCount:  Object.keys(RENAME_MAP).length,
    skipped:        skipped,
    newHeaders:     newHeaders,
    rowCountBefore: originalRowCount,
    rowCountAfter:  sheet.getLastRow(),
    colCountBefore: originalColCount,
    colCountAfter:  sheet.getLastColumn()
  };
}
