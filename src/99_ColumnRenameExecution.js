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

/**
 * 国マスタシートのヘッダー行を旧列名から英語スネークケースへ一括変更する。
 *
 * 対象列:
 *   国ID(ISO2)   → country_code
 *   国名（表示） → display_name
 *   国名（日本語）→ name_ja
 *
 * 前提条件:
 *   - backupCountryMasterSheet() が実行済みであること
 *   - DEV 環境であること
 *
 * @returns {{ status: string, renamed: number, details: Array<{col: number, before: string, after: string}> }}
 */
function renameCountryMasterHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameCountryMasterHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '国マスタ_backup_20260831';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupCountryMasterSheet() を実行してください: ' + backupName);
  }

  var jaToEn = {
    '国ID(ISO2)':    'country_code',
    '国名（表示）':  'display_name',
    '国名（日本語）': 'name_ja'
  };

  var sheet = getCoreSchemaV1Sheet(ss, 'COUNTRIES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('国マスタシートに列がありません');

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

  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    renamed: details.length,
    details: details
  };
}

// ===================================================================
// 見積もり管理 列名整形 補助関数
// PR-1: backupQuotesMasterSheet / verifyQuotesMasterSheetBackup / getQuotesMasterCurrentHeaders
// PR-2: renameQuotesMasterHeaders（PR-2 で追加予定）
// ===================================================================

/**
 * 見積もり管理シートを複製してバックアップを作成する。
 * 対象: シート名 '見積もり管理'（CoreSchemaV1 QUOTES）
 * バックアップ名: '見積もり管理_backup_20260831'
 */
function backupQuotesMasterSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupQuotesMasterSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'QUOTES');
  var backupName = '見積もり管理_backup_20260831';

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
function verifyQuotesMasterSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyQuotesMasterSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'QUOTES');
  var backupName = '見積もり管理_backup_20260831';
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
 * 見積もり管理シートの現在のヘッダー一覧を返す（記録用）。
 */
function getQuotesMasterCurrentHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('getQuotesMasterCurrentHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'QUOTES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
}

/**
 * 見積もり管理シートのヘッダー行を旧列名から英語スネークケースへ一括変更する。
 *
 * 対象列:
 *   PDF URL → pdf_url
 *
 * 前提条件:
 *   - backupQuotesMasterSheet() が実行済みであること
 *   - DEV 環境であること
 *
 * @returns {{ status: string, renamed: number, details: Array<{col: number, before: string, after: string}> }}
 */
function renameQuotesMasterHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameQuotesMasterHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '見積もり管理_backup_20260831';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupQuotesMasterSheet() を実行してください: ' + backupName);
  }

  var oldToNew = {
    'PDF URL': 'pdf_url'
  };

  var sheet = getCoreSchemaV1Sheet(ss, 'QUOTES');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('見積もり管理シートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  var details = [];
  var newHeaders = currentHeaders.map(function(h, i) {
    var trimmed = String(h).trim();
    var mapped = oldToNew[trimmed];
    if (mapped !== undefined && mapped !== trimmed) {
      details.push({ col: i + 1, before: trimmed, after: mapped });
      return mapped;
    }
    return trimmed;
  });

  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    renamed: details.length,
    details: details
  };
}

// ===================================================================
// 担当者マスタ列名整形 補助関数
// Step B: backupStaffMasterSheet / verifyStaffMasterSheetBackup
// PR-2: renameStaffMasterHeaders
// ===================================================================

/**
 * 担当者マスタシートを複製してバックアップを作成する。
 * 対象: シート名 '担当者マスタ'（CoreSchemaV1 STAFF）
 * バックアップ名: '担当者マスタ_backup_20260831'
 */
function backupStaffMasterSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupStaffMasterSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'STAFF');
  var backupName = '担当者マスタ_backup_20260831';

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
 * 担当者マスタシートのヘッダー行を旧列名（日本語）から英語スネークケースへ一括変更する。
 *
 * 対象列（24列）:
 *   担当者ID            → staff_id
 *   苗字（日本語）      → last_name_ja
 *   名前（日本語）      → first_name_ja
 *   氏名（日本語）      → full_name_ja
 *   苗字ふりがな        → last_name_kana
 *   名前ふりがな        → first_name_kana
 *   苗字（英語）        → last_name_en
 *   名前（英語）        → first_name_en
 *   メール              → email
 *   Discord ID          → discord_id
 *   役割                → staff_role
 *   ステータス          → status
 *   元候補者ID          → source_candidate_id
 *   ダークモード        → dark_mode
 *   チャットメニュー表示 → chat_menu_visible
 *   営業メニュー表示    → sales_menu_visible
 *   設定メニュー表示    → settings_menu_visible
 *   管理者メニュー表示  → admin_menu_visible
 *   Buddyメンテナンスメニュー表示 → buddy_maintenance_menu_visible
 *   サイドバー表示      → sidebar_visible
 *   パスワードハッシュ  → password_hash
 *   パスワードソルト    → password_salt
 *   連続失敗回数        → login_fail_count
 *   ロック解除時刻      → locked_until
 *
 * 前提条件:
 *   - backupStaffMasterSheet() が実行済みであること（バックアップが存在すること）
 *   - DEV 環境であること
 *
 * @returns {{ status: string, renamed: number, details: Array<{col: number, before: string, after: string}> }}
 */
function renameStaffMasterHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameStaffMasterHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  // バックアップが存在しない場合は停止
  var backupName = '担当者マスタ_backup_20260831';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupStaffMasterSheet() を実行してください: ' + backupName);
  }

  var oldToNew = {
    '担当者ID': 'staff_id',
    '苗字（日本語）': 'last_name_ja',
    '名前（日本語）': 'first_name_ja',
    '氏名（日本語）': 'full_name_ja',
    '苗字ふりがな': 'last_name_kana',
    '名前ふりがな': 'first_name_kana',
    '苗字（英語）': 'last_name_en',
    '名前（英語）': 'first_name_en',
    'メール': 'email',
    'Discord ID': 'discord_id',
    '役割': 'staff_role',
    'ステータス': 'status',
    '元候補者ID': 'source_candidate_id',
    'ダークモード': 'dark_mode',
    'チャットメニュー表示': 'chat_menu_visible',
    '営業メニュー表示': 'sales_menu_visible',
    '設定メニュー表示': 'settings_menu_visible',
    '管理者メニュー表示': 'admin_menu_visible',
    'Buddyメンテナンスメニュー表示': 'buddy_maintenance_menu_visible',
    'サイドバー表示': 'sidebar_visible',
    'パスワードハッシュ': 'password_hash',
    'パスワードソルト': 'password_salt',
    '連続失敗回数': 'login_fail_count',
    'ロック解除時刻': 'locked_until'
  };

  var sheet = getCoreSchemaV1Sheet(ss, 'STAFF');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('担当者マスタシートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  var details = [];
  var newHeaders = currentHeaders.map(function(h, i) {
    var trimmed = String(h).trim();
    var mapped = oldToNew[trimmed];
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

/**
 * バックアップシートと元シートの行数・列数・ヘッダーが完全一致するか検証する。
 * 合格条件: status === 'OK' かつ headersMatch === true
 */
function verifyStaffMasterSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyStaffMasterSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'STAFF');
  var backupName = '担当者マスタ_backup_20260831';
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

// ===================================================================
// Address 共有3シート 列名整形 補助関数
// Step 2: バックアップ関数（PR-1 に含める / PR-2 マージ前に実行）
// ===================================================================

/**
 * 発行元マスタシートを複製してバックアップを作成する。
 * バックアップ名: '発行元マスタ_backup_20260901'
 */
function backupIssuerMasterSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupIssuerMasterSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'ISSUER');
  var backupName = '発行元マスタ_backup_20260901';

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
 * 支払先マスタシートを複製してバックアップを作成する。
 * バックアップ名: '支払先マスタ_backup_20260901'
 */
function backupPaymentDestinationsSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupPaymentDestinationsSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');
  var backupName = '支払先マスタ_backup_20260901';

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
 * 配送先マスタシートを複製してバックアップを作成する。
 * バックアップ名: '配送先マスタ_backup_20260901'
 */
function backupShippingDestinationsSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupShippingDestinationsSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS');
  var backupName = '配送先マスタ_backup_20260901';

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
 * 3シートのバックアップを一括検証する。
 * 合格条件: overall === 'OK' かつ全 results の status === 'OK' かつ headersMatch === true
 */
function verifyAddressSheetBackups() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyAddressSheetBackups は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var checks = [
    { tableKey: 'ISSUER',                backupName: '発行元マスタ_backup_20260901' },
    { tableKey: 'PAYMENT_DESTINATIONS',  backupName: '支払先マスタ_backup_20260901' },
    { tableKey: 'SHIPPING_DESTINATIONS', backupName: '配送先マスタ_backup_20260901' }
  ];

  var results = checks.map(function(c) {
    var sourceSheet = getCoreSchemaV1Sheet(ss, c.tableKey);
    var backupSheet = ss.getSheetByName(c.backupName);

    if (!backupSheet) {
      return { tableKey: c.tableKey, backupName: c.backupName, status: 'ERROR', reason: 'バックアップシートが存在しません' };
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
      tableKey: c.tableKey,
      backupName: c.backupName,
      status: rowColMatch && headersMatch ? 'OK' : 'MISMATCH',
      sourceRows: sourceRows,
      backupRows: backupRows,
      sourceCols: sourceCols,
      backupCols: backupCols,
      headersMatch: headersMatch
    };
  });

  var allOk = results.every(function(r) { return r.status === 'OK'; });
  return { overall: allOk ? 'OK' : 'MISMATCH', results: results };
}

// ===================================================================
// Address 共有3シート 列名整形 PR-2: リネーム関数
// ===================================================================

/**
 * 発行元マスタのヘッダーを旧列名から英語スネークケースへ一括変更する。
 *
 * 対象列（18列）:
 *   発行元ID     → issuer_id
 *   会社名       → company_name
 *   担当者名     → contact_name
 *   Address 1    → address_line_1
 *   Address 2    → address_line_2
 *   Address 3    → address_line_3
 *   City         → city
 *   State        → state
 *   Zip          → zip
 *   国           → country
 *   電話番号     → phone
 *   メール       → email
 *   登録番号     → registration_no
 *   受取名義     → payee_name
 *   受取先メール → payment_email
 *   注記         → note
 *   結びの文     → closing_message
 *   有効         → is_active
 *
 * 前提条件:
 *   - backupIssuerMasterSheet() が実行済みであること（バックアップが存在すること）
 *   - DEV 環境であること
 */
function renameIssuerMasterHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameIssuerMasterHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '発行元マスタ_backup_20260901';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupIssuerMasterSheet() を実行してください: ' + backupName);
  }

  var oldToNew = {
    '発行元ID': 'issuer_id', '会社名': 'company_name', '担当者名': 'contact_name',
    'Address 1': 'address_line_1', 'Address 2': 'address_line_2', 'Address 3': 'address_line_3',
    'City': 'city', 'State': 'state', 'Zip': 'zip', '国': 'country',
    '電話番号': 'phone', 'メール': 'email', '登録番号': 'registration_no',
    '受取名義': 'payee_name', '受取先メール': 'payment_email', '注記': 'note',
    '結びの文': 'closing_message', '有効': 'is_active'
  };

  return _renameSheetHeaders_(ss, getCoreSchemaV1Sheet(ss, 'ISSUER'), oldToNew);
}

/**
 * 支払先マスタのヘッダーを旧列名から英語スネークケースへ一括変更する。
 *
 * 対象列（16列）:
 *   支払先ID  → payment_destination_id
 *   顧客ID    → customer_id
 *   請求名義  → billing_name
 *   Address 1 → address_line_1
 *   Address 2 → address_line_2
 *   Address 3 → address_line_3
 *   City      → city
 *   State     → state
 *   Zip       → zip
 *   国        → country
 *   支払方法  → payment_method
 *   通貨      → currency
 *   B Tax ID  → tax_id
 *   表示名    → display_name
 *   既定      → is_default
 *   有効      → is_active
 */
function renamePaymentDestinationsHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renamePaymentDestinationsHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '支払先マスタ_backup_20260901';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupPaymentDestinationsSheet() を実行してください: ' + backupName);
  }

  var oldToNew = {
    '支払先ID': 'payment_destination_id', '顧客ID': 'customer_id', '請求名義': 'billing_name',
    'Address 1': 'address_line_1', 'Address 2': 'address_line_2', 'Address 3': 'address_line_3',
    'City': 'city', 'State': 'state', 'Zip': 'zip', '国': 'country',
    '支払方法': 'payment_method', '通貨': 'currency', 'B Tax ID': 'tax_id',
    '表示名': 'display_name', '既定': 'is_default', '有効': 'is_active'
  };

  return _renameSheetHeaders_(ss, getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS'), oldToNew);
}

/**
 * 配送先マスタのヘッダーを旧列名から英語スネークケースへ一括変更する。
 *
 * 対象列（17列）:
 *   配送先ID  → shipping_destination_id
 *   顧客ID    → customer_id
 *   宛名      → recipient_name
 *   Address 1 → address_line_1
 *   Address 2 → address_line_2
 *   Address 3 → address_line_3
 *   City      → city
 *   State     → state
 *   Zip       → zip
 *   国        → country
 *   電話      → phone
 *   国番号    → country_code
 *   D Email   → email
 *   D Tax ID  → tax_id
 *   表示名    → display_name
 *   既定      → is_default
 *   有効      → is_active
 */
function renameShippingDestinationsHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameShippingDestinationsHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  var backupName = '配送先マスタ_backup_20260901';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupShippingDestinationsSheet() を実行してください: ' + backupName);
  }

  var oldToNew = {
    '配送先ID': 'shipping_destination_id', '顧客ID': 'customer_id', '宛名': 'recipient_name',
    'Address 1': 'address_line_1', 'Address 2': 'address_line_2', 'Address 3': 'address_line_3',
    'City': 'city', 'State': 'state', 'Zip': 'zip', '国': 'country',
    '電話': 'phone', '国番号': 'country_code', 'D Email': 'email', 'D Tax ID': 'tax_id',
    '表示名': 'display_name', '既定': 'is_default', '有効': 'is_active'
  };

  return _renameSheetHeaders_(ss, getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS'), oldToNew);
}

/**
 * 内部ヘルパー: シートのヘッダー行を oldToNew マップに従って一括変更する。
 * データ行（2行目以降）は変更しない。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} oldToNew - { 旧名: 新名 }
 */
function _renameSheetHeaders_(ss, sheet, oldToNew) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error(sheet.getName() + ' シートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  var details = [];
  var newHeaders = currentHeaders.map(function(h, i) {
    var trimmed = String(h).trim();
    var mapped = oldToNew[trimmed];
    if (mapped !== undefined && mapped !== trimmed) {
      details.push({ col: i + 1, before: trimmed, after: mapped });
      return mapped;
    }
    return trimmed;
  });

  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    sheetName: sheet.getName(),
    renamed: details.length,
    details: details
  };
}

// ===================================================================
// リード管理 列名整形 補助関数
// Step 2: バックアップ関数（PR-1 に含める / PR-2 マージ前に実行）
// ===================================================================

/**
 * リード管理シートを複製してバックアップを作成する。
 * バックアップ名: 'リード管理_backup_20260901'
 */
function backupLeadMasterSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('backupLeadMasterSheet は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'LEADS');
  var backupName = 'リード管理_backup_20260901';

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
 * 合格条件: status === 'OK' かつ headersMatch === true かつ sourceCols === 64
 */
function verifyLeadMasterSheetBackup() {
  if (getEnvironment() !== 'development') {
    throw new Error('verifyLeadMasterSheetBackup は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sourceSheet = getCoreSchemaV1Sheet(ss, 'LEADS');
  var backupName = 'リード管理_backup_20260901';
  var backupSheet = ss.getSheetByName(backupName);

  if (!backupSheet) {
    throw new Error('バックアップシートが存在しません: ' + backupName);
  }

  var sourceCols = sourceSheet.getLastColumn();
  var sourceRows = sourceSheet.getLastRow();
  var backupCols = backupSheet.getLastColumn();
  var backupRows = backupSheet.getLastRow();

  var sourceHeaders = sourceCols > 0
    ? sourceSheet.getRange(1, 1, 1, sourceCols).getValues()[0]
    : [];
  var backupHeaders = backupCols > 0
    ? backupSheet.getRange(1, 1, 1, backupCols).getValues()[0]
    : [];

  var headersMatch = JSON.stringify(sourceHeaders) === JSON.stringify(backupHeaders);

  return {
    status: headersMatch && sourceCols === backupCols && sourceRows === backupRows ? 'OK' : 'MISMATCH',
    headersMatch: headersMatch,
    sourceCols: sourceCols,
    backupCols: backupCols,
    sourceRows: sourceRows,
    backupRows: backupRows
  };
}

// ===================================================================
// リード管理 列名整形
// PR-2: renameLeadMasterHeaders（シートの51列をリネーム）
// ===================================================================

/**
 * リード管理シートのヘッダー行を旧列名（日本語）から英語スネークケースへ一括変更する。
 *
 * 変換する: CoreSchemaRegistry LEADS 定義の 51列のみ
 * 変換しない: 定義外13列（リード進捗/商談進捗/1回の発注金額/購入頻度(月次)/
 *             商談の手応え/Good Point/More Point/反省と今後の抱負/
 *             レポート提出日/レポート確認者/レポート確認日/レポートコメント/
 *             Buddyフィードバック）
 *
 * 前提条件:
 * - 環境: DEV のみ
 * - バックアップシート「リード管理_backup_20260901」が存在すること
 * - シートの合計列数: 64列（変換51 + 未変換13）
 */
function renameLeadMasterHeaders() {
  if (getEnvironment() !== 'development') {
    throw new Error('renameLeadMasterHeaders は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();

  // バックアップが存在しない場合は停止
  var backupName = 'リード管理_backup_20260901';
  if (!ss.getSheetByName(backupName)) {
    throw new Error('バックアップシートが存在しません。先に backupLeadMasterSheet() を実行してください: ' + backupName);
  }

  // 変換対象: 旧名（日本語）→ 新名（英語スネークケース）
  // CoreSchemaRegistry LEADS 定義 51列のみ
  var oldToNew = {
    'リードID': 'lead_id',
    '登録日': 'registered_at',
    '顧客名': 'customer_name',
    '商談結果': 'deal_result',
    '呼び方（英語）': 'english_call_name',
    '国': 'country',
    'シート更新日': 'sheet_updated_at',
    'リード担当者': 'lead_assignee_name',
    'リード種別': 'lead_type',
    '流入経路': 'lead_source',
    '流入元ID': 'lead_source_id',
    'メッセージURL': 'message_url',
    '取り扱いタイトル': 'handled_title',
    '作品ID': 'ip_ids',
    'CSメモ': 'cs_note',
    'メール': 'email',
    '電話番号': 'phone',
    '連絡手段': 'contact_method',
    '温度感': 'temperature',
    '想定規模': 'expected_scale',
    '返信速度': 'response_speed',
    '問い合わせ回数': 'inquiry_count',
    'アーカイブ日': 'archived_at',
    'アーカイブ理由': 'archive_reason',
    'アサイン日': 'assigned_at',
    '営業担当者': 'sales_assignee_name',
    '担当者ID': 'assignee_id',
    '顧客タイプ': 'customer_type',
    '最終対応者ID': 'last_responder_id',
    '見込度': 'prospect_score',
    '次回アクション': 'next_action',
    '次回アクション日': 'next_action_date',
    '商談メモ': 'deal_note',
    '相手の課題': 'customer_issue',
    '販売形態': 'sales_channel',
    '月間見込み金額': 'monthly_expected_amount',
    '競合比較中': 'competitor_comparison',
    'アラート確認日': 'alert_confirmed_at',
    '対象外理由': 'exclusion_reason',
    '失注理由': 'loss_reason',
    '初回取引日': 'first_transaction_date',
    '初回取引金額': 'first_transaction_amount',
    '累計取引金額': 'cumulative_transaction_amount',
    '会話要約': 'conversation_summary',
    '最終会話日時': 'last_conversation_at',
    '会話数': 'conversation_count',
    '重複フラグ': 'duplicate_flag',
    '重複元リードID': 'duplicate_source_lead_id',
    '重複確認日': 'duplicate_confirmed_at',
    '重複確認者': 'duplicate_confirmed_by',
    'リードステータス': 'lead_status'
  };

  var sheet = getCoreSchemaV1Sheet(ss, 'LEADS');
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('リード管理シートに列がありません');

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var currentHeaders = headerRange.getDisplayValues()[0];

  Logger.log('変換前ヘッダー（' + lastCol + '列）: ' + JSON.stringify(currentHeaders));

  var details = [];
  var skipped = [];
  var newHeaders = currentHeaders.map(function(h, i) {
    var trimmed = String(h).trim();
    var mapped = oldToNew[trimmed];
    if (mapped !== undefined && mapped !== trimmed) {
      details.push({ col: i + 1, before: trimmed, after: mapped });
      return mapped;
    }
    skipped.push({ col: i + 1, header: trimmed });
    return trimmed;
  });

  Logger.log('変換後ヘッダー: ' + JSON.stringify(newHeaders));
  Logger.log('変換: ' + details.length + '列, スキップ: ' + skipped.length + '列');

  // 一括書き込み（行/列の追加・削除・並び替えは一切しない）
  headerRange.setValues([newHeaders]);

  return {
    status: 'OK',
    renamed: details.length,
    total: lastCol,
    skipped: skipped.length,
    details: details
  };
}
