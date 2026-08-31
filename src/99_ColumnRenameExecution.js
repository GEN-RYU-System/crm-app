/**
 * 仕入れシート列名整形 — 補助関数
 *
 * PR-1: backupPurchaseSheet / verifyPurchaseSheetBackup / getPurchaseSheetCurrentHeaders
 * PR-2: renamePurchaseSheetHeaders
 * PR-3: フォールバック削除予定
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

/**
 * 仕入れシートのヘッダー行を日本語から英語スネークケースへ一括変更する。
 *
 * 前提条件:
 *   - backupPurchaseSheet() が実行済みであること（バックアップが存在すること）
 *   - DEV 環境であること
 *
 * 動作:
 *   1. バックアップシートの存在を確認する（未実行なら停止）
 *   2. 現在のヘッダーを取得し、日本語→英語マッピングで変換する
 *   3. 変更前・変更後・変換数を返す
 *
 * @returns {{ status: string, renamed: number, details: Array<{col: number, before: string, after: string}> }}
 */
function renamePurchaseSheetHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renamePurchaseSheetHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  // バックアップが存在しない場合は停止
  var backupName = '仕入れ_backup_20260831';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupPurchaseSheet() を実行してください: ' + backupName);
  }

  var jaToEn = {
    '仕入れID': 'purchase_id', 'オーダーID': 'order_id', '仕入れ担当ID': 'purchase_assignee_id',
    '仕入れ支払者ID': 'paid_by_id', '注文日': 'ordered_at', '仕入れ支払日': 'paid_at',
    '取引番号': 'transaction_number', '仕入元': 'supplier', '仕入元URL': 'supplier_url',
    '数量': 'quantity', '単価': 'unit_price', '金額': 'amount',
    '送料/代行費': 'shipping_or_agency_fee', '運送会社': 'carrier', '送り状番号': 'tracking_number',
    'ステータス': 'status', '備考': 'note', '登録日': 'registered_at', '更新日': 'updated_at'
  };

  var sheet = getCoreSchemaV1Sheet(ss, 'PURCHASES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('仕入れシートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  var details = [];
  var newHeaders = currentHeaders.map(function(h, i) {
    var trimmed = String(h).trim();
    var mapped = jaToEn[trimmed];
    if (mapped !== undefined && mapped !== trimmed) {
      details.push({ col: i + 1, before: trimmed, after: mapped });
      return mapped;
    }
    return trimmed;
  });

  // 一括で書き込む
  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    renamed: details.length,
    details: details
  };
}

// ===================================================================
// 顧客マスタ列名整形 補助関数
// PR-1: backupCustomerSheet / verifyCustomerSheetBackup / getCustomerSheetCurrentHeaders
// PR-2: renameCustomerFedexIdHeader（PR-2 で追加予定）
// ===================================================================

/**
 * 顧客マスタシートを複製してバックアップを作成する。
 * 対象: シート名 '顧客マスタ'（CoreSchemaV1 CUSTOMERS）
 * バックアップ名: '顧客マスタ_backup_20260831'
 */
function backupCustomerSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupCustomerSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var backupName = '顧客マスタ_backup_20260831';

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
function verifyCustomerSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyCustomerSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var backupName = '顧客マスタ_backup_20260831';
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
 * 顧客マスタシートの現在のヘッダー一覧を返す（記録用）。
 */
function getCustomerSheetCurrentHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('getCustomerSheetCurrentHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
}

/**
 * 顧客マスタシートの 'FedEx ID' 列を 'fedex_id' へ改名する。
 *
 * 前提条件:
 *   - backupCustomerSheet() が実行済みであること（バックアップが存在すること）
 *   - DEV 環境であること
 *
 * @returns {{ status: string, renamed: number, details: Array<{col: number, before: string, after: string}> }}
 */
function renameCustomerFedexIdHeader() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameCustomerFedexIdHeader は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '顧客マスタ_backup_20260831';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupCustomerSheet() を実行してください: ' + backupName);
  }

  var sheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('顧客マスタシートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  var targetIndex = currentHeaders.indexOf('FedEx ID');
  if (targetIndex === -1) {
    if (currentHeaders.indexOf('fedex_id') !== -1) {
      return { status: 'ALREADY_DONE', renamed: 0, details: [], message: '既に fedex_id に変更済みです' };
    }
    throw new Error('FedEx ID 列が顧客マスタシートに見つかりません');
  }

  var newHeaders = currentHeaders.slice();
  newHeaders[targetIndex] = 'fedex_id';
  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    renamed: 1,
    details: [{ col: targetIndex + 1, before: 'FedEx ID', after: 'fedex_id' }]
  };
}

// ===================================================================
// 国マスタ列名整形 補助関数
// PR-1: backupCountryMasterSheet / verifyCountryMasterSheetBackup / getCountryMasterCurrentHeaders
// PR-2: renameCountryMasterHeaders（PR-2 で追加予定）
// ===================================================================

/**
 * 国マスタシートを複製してバックアップを作成する。
 * 対象: シート名 '国マスタ'（CoreSchemaV1 COUNTRIES）
 * バックアップ名: '国マスタ_backup_20260831'
 */
function backupCountryMasterSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupCountryMasterSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'COUNTRIES');
  var backupName = '国マスタ_backup_20260831';

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
function verifyCountryMasterSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyCountryMasterSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'COUNTRIES');
  var backupName = '国マスタ_backup_20260831';
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
 * 国マスタシートの現在のヘッダー一覧を返す（記録用）。
 */
function getCountryMasterCurrentHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('getCountryMasterCurrentHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'COUNTRIES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
}
