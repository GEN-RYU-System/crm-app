/**
 * Phase2 列名整形 — オーダー明細（ORDER_LINES）シート
 *
 * 安全性チェック済み:
 *   - deleteSheet / deleteRow / deleteColumn / insertRow / insertColumn / .clear() / .sort() への呼び出し: 0件
 *   - 書き込みはヘッダー行（row 1）のみ
 *
 * 実行順序:
 *   1. devBackupOrderLinesSheet()  → バックアップ確認
 *   2. devRenameOrderLinesColumns() → ヘッダー変換
 */

/**
 * オーダー明細シートのバックアップを作成する（DEV 専用）。
 * @returns {Object} バックアップ結果
 */
function devBackupOrderLinesSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('オーダー明細');
  if (!sheet) throw new Error('シートが見つかりません: オーダー明細');

  var originalRows = sheet.getLastRow();
  var originalCols = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, originalCols).getValues()[0];

  var backupName = 'オーダー明細_backup_20260902';
  var existing = ss.getSheetByName(backupName);
  if (existing) {
    return { skipped: true, reason: 'バックアップ既存', backupName: backupName };
  }

  var backup = sheet.copyTo(ss);
  backup.setName(backupName);

  return {
    backupName: backupName,
    originalRows: originalRows,
    originalCols: originalCols,
    headers: headers
  };
}

/**
 * オーダー明細シートのヘッダー行を英語スネークケースに変換する（DEV 専用）。
 * @returns {Object} 変換結果
 */
function devRenameOrderLinesColumns() {
  var RENAME_MAP = {
    '明細ID':       'order_line_id',
    'オーダーID':   'order_id',
    '行番号':       'line_number',
    'カテゴリ':     'category',
    '商品名':       'product_name',
    '状態':         'status',
    'SKU':          'sku',
    '数量':         'quantity',
    '単価':         'unit_price',
    '小計':         'subtotal',
    '商品ID':       'product_id',
    'コンディション': 'condition'
  };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('オーダー明細');
  if (!sheet) throw new Error('シートが見つかりません: オーダー明細');

  var rowCountBefore = sheet.getLastRow();
  var colCountBefore = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, colCountBefore).getValues()[0];

  var renamedCount = 0;
  var skipped = [];

  for (var i = 0; i < headerRow.length; i++) {
    var cell = String(headerRow[i]).trim();
    if (RENAME_MAP[cell]) {
      sheet.getRange(1, i + 1).setValue(RENAME_MAP[cell]);
      headerRow[i] = RENAME_MAP[cell];
      renamedCount++;
    } else if (cell !== '') {
      skipped.push({ col: i + 1, name: cell });
    }
  }

  var rowCountAfter = sheet.getLastRow();
  var colCountAfter = sheet.getLastColumn();
  var newHeaders = sheet.getRange(1, 1, 1, colCountAfter).getValues()[0];

  return {
    renamedCount: renamedCount,
    expectedCount: Object.keys(RENAME_MAP).length,
    skipped: skipped,
    newHeaders: newHeaders,
    rowCountBefore: rowCountBefore,
    rowCountAfter: rowCountAfter,
    colCountBefore: colCountBefore,
    colCountAfter: colCountAfter
  };
}
