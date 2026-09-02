/**
 * 見積もり明細シートの列名変更ユーティリティ（Phase 2 スプリント）
 *
 * PR-2 手順:
 *   1. devBackupQuoteLinesSheet()  → バックアップ作成・検証
 *   2. devRenameQuoteLinesColumns() → 列名変更・検証
 *
 * 禁止: deleteSheet / deleteRow / deleteColumn / insertRow / insertColumn
 *       2行目以降（データ行）への変更
 *       バックアップシートへの変更
 */

/**
 * 見積もり明細シートをバックアップする（読み取り専用コピー）。
 * バックアップ名: 見積もり明細_backup_20260902
 *
 * @returns {{ originalRows: number, originalCols: number, backupName: string, headers: string[] }}
 */
function devBackupQuoteLinesSheet() {
  var ss = getSpreadsheet();
  var src = ss.getSheetByName('見積もり明細');
  if (!src) { throw new Error('シートが見つかりません: 見積もり明細'); }

  var backupName = '見積もり明細_backup_20260902';
  if (ss.getSheetByName(backupName)) { throw new Error('バックアップ既存: ' + backupName); }

  var bk = src.copyTo(ss);
  bk.setName(backupName);

  var srcData = src.getDataRange().getValues();
  var bkData  = bk.getDataRange().getValues();

  if (srcData.length !== bkData.length || srcData[0].length !== bkData[0].length) {
    throw new Error('バックアップ行列数不一致');
  }

  Logger.log('バックアップ作成完了: ' + backupName);
  Logger.log('  行数: ' + srcData.length + ', 列数: ' + srcData[0].length);
  Logger.log('  ヘッダー: ' + JSON.stringify(srcData[0]));

  return {
    originalRows: srcData.length,
    originalCols: srcData[0].length,
    backupName: backupName,
    headers: srcData[0]
  };
}

/**
 * 見積もり明細シートの列名を日本語から英語スネークケースに変更する。
 * ヘッダー行（1行目）のみを変更する。データ行は変更しない。
 *
 * @returns {{ renamedCount: number, expectedCount: number, skipped: Array, newHeaders: string[], rowCountBefore: number, rowCountAfter: number, colCountBefore: number, colCountAfter: number }}
 */
function devRenameQuoteLinesColumns() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('見積もり明細');
  if (!sheet) { throw new Error('シートが見つかりません: 見積もり明細'); }

  var RENAME_MAP = {
    '明細ID':  'quote_line_id',
    '見積書ID': 'quote_id',
    '行番号':   'line_no',
    '商品ID':   'product_id',
    '商品名':   'product_name',
    '説明':     'description',
    '状態':     'condition',
    '重量':     'weight',
    '数量':     'quantity',
    '単価':     'unit_price',
    '金額':     'amount',
    '備考':     'note'
  };

  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var originalRowCount = sheet.getLastRow();
  var originalColCount = sheet.getLastColumn();

  var renamedCount = 0;
  var skipped = [];

  for (var i = 0; i < headerRow.length; i++) {
    var cellValue = String(headerRow[i]).trim();
    if (RENAME_MAP[cellValue]) {
      sheet.getRange(1, i + 1).setValue(RENAME_MAP[cellValue]);
      renamedCount++;
    } else if (cellValue !== '') {
      skipped.push({ col: i + 1, name: cellValue });
    }
  }

  var newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var result = {
    renamedCount:    renamedCount,
    expectedCount:   Object.keys(RENAME_MAP).length,
    skipped:         skipped,
    newHeaders:      newHeaders,
    rowCountBefore:  originalRowCount,
    rowCountAfter:   sheet.getLastRow(),
    colCountBefore:  originalColCount,
    colCountAfter:   sheet.getLastColumn()
  };

  Logger.log('列名変更結果: ' + JSON.stringify(result));

  if (renamedCount !== result.expectedCount) {
    throw new Error('列名変更数が期待値と不一致: ' + renamedCount + ' !== ' + result.expectedCount);
  }
  if (skipped.length > 0) {
    throw new Error('未変換列が存在: ' + JSON.stringify(skipped));
  }
  if (result.rowCountBefore !== result.rowCountAfter) {
    throw new Error('行数が変化しました');
  }
  if (result.colCountBefore !== result.colCountAfter) {
    throw new Error('列数が変化しました');
  }

  return result;
}
