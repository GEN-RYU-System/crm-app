/**
 * 99_DevRenameShipmentsColumns.js
 *
 * 発送シートの列名を日本語から英語スネークケースへ変換するためのユーティリティ。
 * PR-2 実行フェーズ専用。本番データに影響するため、必ずバックアップ後に実行する。
 *
 * 使用手順:
 * 1. devBackupShipmentsSheet() でバックアップ作成・検証
 * 2. devRenameShipmentsColumns() で列名変換を実行
 */

/* global SpreadsheetApp, getSpreadsheet */

/**
 * 発送シートを複製してバックアップを作成する。
 * バックアップ名: 発送_backup_20260902
 *
 * @return {{originalRows: number, originalCols: number, backupName: string, headers: string[]}}
 */
function devBackupShipmentsSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheet().getId());
  var src = ss.getSheetByName('発送');
  if (!src) { throw new Error('シートが見つかりません: 発送'); }
  var backupName = '発送_backup_20260902';
  if (ss.getSheetByName(backupName)) { throw new Error('バックアップ既存: ' + backupName); }
  var bk = src.copyTo(ss);
  bk.setName(backupName);
  var srcData = src.getDataRange().getValues();
  var bkData = bk.getDataRange().getValues();
  if (srcData.length !== bkData.length || srcData[0].length !== bkData[0].length) {
    throw new Error('バックアップ行列数不一致');
  }
  return {
    originalRows: srcData.length,
    originalCols: srcData[0].length,
    backupName: backupName,
    headers: srcData[0]
  };
}

/**
 * 発送シートの列名を日本語から英語スネークケースへ変換する。
 * データ行（2行目以降）は変更しない。
 * バックアップ作成後に実行すること。
 *
 * @return {{renamedCount: number, expectedCount: number, skipped: Array, newHeaders: string[], rowCountBefore: number, rowCountAfter: number, colCountBefore: number, colCountAfter: number}}
 */
function devRenameShipmentsColumns() {
  var ss = SpreadsheetApp.openById(getSpreadsheet().getId());
  var sheet = ss.getSheetByName('発送');
  if (!sheet) { throw new Error('シートが見つかりません: 発送'); }

  var RENAME_MAP = {
    '発送ID':       'shipment_id',
    'オーダーID':   'order_id',
    '箱番号':       'box_number',
    '発送方法':     'shipping_method',
    '発送日':       'shipped_at',
    '運送状番号':   'tracking_number',
    '長さ':         'length',
    '幅':           'width',
    '高さ':         'height',
    '重量':         'weight',
    '見積もり送料': 'estimated_shipping_fee',
    'ラベルURL':    'label_url',
    'インボイスURL': 'invoice_url',
    '検品':         'inspection',
    '梱包':         'packing',
    '格納':         'storage',
    '集荷依頼':     'pickup_request',
    '通知':         'notification',
    '発送担当ID':   'shipping_assignee_id',
    '備考':         'note',
    '登録日':       'registered_at',
    '更新日':       'updated_at'
  };

  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
    renamedCount: renamedCount,
    expectedCount: Object.keys(RENAME_MAP).length,
    skipped: skipped,
    newHeaders: newHeaders,
    rowCountBefore: originalRowCount,
    rowCountAfter: sheet.getLastRow(),
    colCountBefore: originalColCount,
    colCountAfter: sheet.getLastColumn()
  };
}
