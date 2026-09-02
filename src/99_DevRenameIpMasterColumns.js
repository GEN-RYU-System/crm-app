/**
 * 99_DevRenameIpMasterColumns.js
 *
 * Phase 2 列名リネーム — 作品マスタ_共用在庫 シート
 *
 * 手順:
 *   1. devBackupIpMasterSheet()  — バックアップを作成
 *   2. devRenameIpMasterColumns() — 列名を変更（PR-2 で実行）
 *
 * 禁止操作:
 *   - データ行（2行目以降）の変更
 *   - シートの削除・並べ替え・行列の挿入削除
 *   - 複製シートの変更・削除
 */

// ─── バックアップ作成 ──────────────────────────────────────────────────────────

/**
 * 作品マスタ_共用在庫 のバックアップシートを作成する。
 * リネーム実行前に呼び出すこと。
 *
 * @returns {Object} { originalRows, originalCols, backupName, headers }
 */
function devBackupIpMasterSheet() {
  var ss  = getSpreadsheet();
  var src = ss.getSheetByName('作品マスタ_共用在庫');
  if (!src) { throw new Error('シートが見つかりません: 作品マスタ_共用在庫'); }

  var backupName = '作品マスタ_共用在庫_backup_20260902';
  if (ss.getSheetByName(backupName)) {
    throw new Error('バックアップ既存（冪等チェック）: ' + backupName);
  }

  var bk = src.copyTo(ss);
  bk.setName(backupName);

  var srcData = src.getDataRange().getValues();
  var bkData  = bk.getDataRange().getValues();
  if (srcData.length !== bkData.length || srcData[0].length !== bkData[0].length) {
    throw new Error('バックアップ行列数不一致: src=' +
      srcData.length + 'x' + srcData[0].length + ' bk=' +
      bkData.length + 'x' + bkData[0].length);
  }

  return {
    originalRows: srcData.length,
    originalCols: srcData[0].length,
    backupName:   backupName,
    headers:      srcData[0]
  };
}

// ─── 列名変更（PR-2 でシートリネーム後に実行） ────────────────────────────────

/**
 * 作品マスタ_共用在庫 の日本語列名 3 列を英語スネークケースに変更する。
 *
 * 変換マップ:
 *   作品名 → title
 *   別名   → alias
 *   有効   → is_active
 *
 * @returns {Object} { renamedCount, expectedCount, newHeaders, rowCountBefore, rowCountAfter, colCountBefore, colCountAfter }
 */
function devRenameIpMasterColumns() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (!sheet) { throw new Error('シートが見つかりません: 作品マスタ_共用在庫'); }

  var RENAME_MAP = {
    '作品名': 'title',
    '別名':   'alias',
    '有効':   'is_active'
  };

  var originalRowCount = sheet.getLastRow();
  var originalColCount = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, originalColCount).getValues()[0];

  var renamedCount = 0;
  for (var i = 0; i < headerRow.length; i++) {
    var cell = String(headerRow[i]);
    if (RENAME_MAP[cell]) {
      sheet.getRange(1, i + 1).setValue(RENAME_MAP[cell]);
      renamedCount++;
    }
  }

  // 実行後の検証
  var newHeaders    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRowCount   = sheet.getLastRow();
  var newColCount   = sheet.getLastColumn();

  var result = {
    renamedCount:    renamedCount,
    expectedCount:   Object.keys(RENAME_MAP).length,
    newHeaders:      newHeaders,
    rowCountBefore:  originalRowCount,
    rowCountAfter:   newRowCount,
    colCountBefore:  originalColCount,
    colCountAfter:   newColCount
  };

  // 自動チェック
  if (renamedCount !== result.expectedCount) {
    throw new Error('列名変更数が期待値と不一致: ' +
      'renamed=' + renamedCount + ' expected=' + result.expectedCount +
      ' headersBefore=' + JSON.stringify(headerRow));
  }
  if (newRowCount !== originalRowCount || newColCount !== originalColCount) {
    throw new Error('行数または列数が変化しました: ' +
      'rows ' + originalRowCount + '->' + newRowCount + ' ' +
      'cols ' + originalColCount + '->' + newColCount);
  }

  Logger.log('devRenameIpMasterColumns 完了: ' + JSON.stringify(result));
  return result;
}
