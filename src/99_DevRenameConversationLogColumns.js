/**
 * 会話ログ（商談用）列名リネーム用 DEV ユーティリティ
 *
 * devBackupConversationLogSheet()
 *   - 会話ログ（商談用）を 会話ログ（商談用）_backup_20260902 にコピー
 *   - 行列数とヘッダーを検証する
 *
 * devRenameConversationLogColumns()
 *   - 会話ログ（商談用）の1行目（ヘッダー）を新列名に変更する
 *   - データ行（2行目以降）は一切変更しない
 *   - シートの削除・並べ替え・行列の挿入削除は行わない
 *
 * ★ 実行は指示に従って順番に行うこと（PR-1 マージ後に PR-2 として実行）
 */

function devBackupConversationLogSheet() {
  var ss  = SpreadsheetApp.openById(getSpreadsheet().getId());
  var src = ss.getSheetByName('会話ログ（商談用）');
  if (!src) { throw new Error('シートが見つかりません: 会話ログ（商談用）'); }

  var backupName = '会話ログ（商談用）_backup_20260902';
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

function devRenameConversationLogColumns() {
  var ss    = SpreadsheetApp.openById(getSpreadsheet().getId());
  var sheet = ss.getSheetByName('会話ログ（商談用）');
  if (!sheet) { throw new Error('シートが見つかりません: 会話ログ（商談用）'); }

  var RENAME_MAP = {
    'ログID':     'log_id',
    'リードID':   'lead_id',
    '日時':       'occurred_at',
    '送受信':     'direction',
    '発言者':     'speaker',
    '原文':       'original_text',
    '原文言語':   'original_language',
    '翻訳文':     'translated_text',
    '記録者ID':   'recorded_by',
    '記録日時':   'recorded_at',
    '商談解析':   'deal_analysis'
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
