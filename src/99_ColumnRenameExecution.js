/**
 * 仕入れシート列名整形 — 補助関数
 *
 * PR-1: backupPurchaseSheet / verifyPurchaseSheetBackup / getPurchaseSheetCurrentHeaders
 * PR-2: renamePurchaseSheetHeaders（追加予定）
 *
 * 実行環境: DEV のみ
 */

/**
 * 仕入れシートを複製してバックアップを作成する。
 * 対象: シート名 '仕入れ'（CoreSchemaV1 PURCHASES）
 * バックアップ名: '仕入れ_backup_20260831'
 */
function backupPurchaseSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupPurchaseSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'PURCHASES');
  var backupName = '仕入れ_backup_20260831';

  var existing = ss.getSheetByName(backupName);
  if (existing) {
    throw new Error('バックアップシートが既に存在します: ' + backupName);
  }

  var copy = sourceSheet.copyTo(ss);
  copy.setName(backupName);
  return {
    status: 'OK',
    backupName: backupName,
    sourceRows: sourceSheet.getLastRow(),
    sourceCols: sourceSheet.getLastColumn()
  };
}

/**
 * バックアップシートと元シートの行数・列数・ヘッダーが完全一致するか検証する。
 * 合格条件: status === 'OK' かつ headersMatch === true
 */
function verifyPurchaseSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyPurchaseSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'PURCHASES');
  var backupName = '仕入れ_backup_20260831';
  var backupSheet = ss.getSheetByName(backupName);

  if (!backupSheet) {
    throw new Error('バックアップシートが存在しません: ' + backupName);
  }

  var sourceRows = sourceSheet.getLastRow();
  var sourceCols = sourceSheet.getLastColumn();
  var backupRows = backupSheet.getLastRow();
  var backupCols = backupSheet.getLastColumn();

  var sourceHeaders = sourceCols > 0
    ? sourceSheet.getRange(1, 1, 1, sourceCols).getDisplayValues()[0]
    : [];
  var backupHeaders = backupCols > 0
    ? backupSheet.getRange(1, 1, 1, backupCols).getDisplayValues()[0]
    : [];

  var headersMatch = sourceHeaders.length === backupHeaders.length &&
    sourceHeaders.every(function(h, i) { return h === backupHeaders[i]; });

  var rowColMatch = sourceRows === backupRows && sourceCols === backupCols;

  return {
    status: rowColMatch && headersMatch ? 'OK' : 'MISMATCH',
    sourceRows: sourceRows,
    backupRows: backupRows,
    sourceCols: sourceCols,
    backupCols: backupCols,
    headersMatch: headersMatch,
    sourceHeaders: sourceHeaders,
    backupHeaders: backupHeaders
  };
}

/**
 * 仕入れシートの現在のヘッダー一覧を返す（記録用）。
 */
function getPurchaseSheetCurrentHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('getPurchaseSheetCurrentHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'PURCHASES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
}
