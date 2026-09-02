/**
 * 通貨マスタ 列名リネーム用 DEV ユーティリティ
 *
 * devBackupCurrencyMasterSheet()
 *   - 通貨マスタ を通貨マスタ_backup_20260902 にコピー
 *   - 行列数とヘッダーを検証する
 *
 * devRenameCurrencyMasterColumns()
 *   - 通貨マスタ の1行目（ヘッダー）を新列名に変更する
 *   - データ行（2行目以降）は一切変更しない
 *   - シートの削除・並べ替え・行列の挿入削除は行わない
 *
 * ★ 実行は指示に従って順番に行うこと
 */

function devBackupCurrencyMasterSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheet().getId());
  var src = ss.getSheetByName('通貨マスタ');
  if (!src) { throw new Error('シートが見つかりません: 通貨マスタ'); }

  var backupName = '通貨マスタ_backup_20260902';
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

function devRenameCurrencyMasterColumns() {
  var ss    = SpreadsheetApp.openById(getSpreadsheet().getId());
  var sheet = ss.getSheetByName('通貨マスタ');
  if (!sheet) { throw new Error('シートが見つかりません: 通貨マスタ'); }

  var RENAME_MAP = {
    '通貨コード':  'currency_code',
    '記号':        'symbol',
    '名称':        'name',
    '円換算レート': 'rate_to_jpy',
    '有効':        'is_active'
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
