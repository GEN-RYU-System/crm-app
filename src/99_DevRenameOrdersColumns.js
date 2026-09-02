/**
 * DEV オーダー管理シート 43列ヘッダーリネーム
 *
 * 実行手順:
 *   1. clasp run devBackupOrdersSheet   — バックアップを作成してから
 *   2. clasp run devRenameOrdersColumns — ヘッダー行のみ書き換え
 *
 * 制約:
 *   - ヘッダー行（1行目）のみ書き換える
 *   - データ行（2行目以降）は一切変更しない
 *   - deleteSheet / deleteRow / deleteColumn / insertRow / insertColumn /
 *     .clear() / .sort() は呼び出さない（0件確認済み）
 */

var DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME = 'オーダー管理';
var DEV_RENAME_ORDERS_COLUMNS_BACKUP_DATE = '20260902';
var DEV_RENAME_ORDERS_COLUMNS_EXPECTED_COUNT = 43;

var DEV_RENAME_ORDERS_COLUMNS_RENAME_MAP = {
  'オーダーID':     'order_id',
  '請求書番号':     'invoice_number',
  '顧客ID':         'customer_id',
  '配送先ID':       'shipping_destination_id',
  '支払先ID':       'payment_destination_id',
  '源流リードID':   'source_lead_id',
  'ステータス':     'status',
  '内部メモ':       'internal_note',
  '受注日':         'order_date',
  '通貨':           'currency',
  '為替レート':     'exchange_rate',
  '明細合計':       'line_total',
  '送料':           'shipping_fee',
  '関税':           'duty',
  '請求総額':       'invoice_total',
  '決済手段':       'payment_method',
  '請求書リンク':   'invoice_link',
  '請求書発行日':   'invoice_issued_at',
  '支払期日':       'payment_due_at',
  '支払確認日':     'payment_confirmed_at',
  '入金確認元':     'payment_confirmation_source',
  '発送方法':       'shipping_method',
  '発送日':         'shipped_at',
  '運送状番号':     'tracking_number',
  '発送時メモ':     'shipping_note',
  '備考':           'note',
  '登録日':         'registered_at',
  '更新日':         'updated_at',
  '受注担当ID':     'order_assignee_id',
  '入金確認者ID':   'payment_confirmed_by_id',
  '営業担当ID':     'sales_assignee_id',
  '発送担当ID':     'shipping_assignee_id',
  '取引備考欄':     'transaction_note',
  '予約請求書番号': 'reserved_invoice_number',
  '発売予定日':     'release_scheduled_at',
  'デポジット率':   'deposit_rate',
  'その他手数料':   'other_fee',
  '値引き':         'discount',
  '支払サイト':     'payment_terms',
  'キャンセル理由': 'cancellation_reason',
  'キャンセルメモ': 'cancellation_note',
  '支払いステータス': 'payment_status',
  '円換算請求総額': 'invoice_total_jpy'
};

/**
 * オーダー管理シートをバックアップする（実行後にリネームを実行すること）
 *
 * @returns {{ backupName: string, originalRows: number, originalCols: number, headers: string[] }}
 */
function devBackupOrdersSheet() {
  if (getEnvironment() !== 'development') {
    throw new Error('devBackupOrdersSheet は development 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var backupName = DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME + '_backup_' + DEV_RENAME_ORDERS_COLUMNS_BACKUP_DATE;

  var existing = ss.getSheetByName(backupName);
  if (existing) {
    var originalSheet = ss.getSheetByName(DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
    var originalRows = originalSheet ? originalSheet.getLastRow() : 0;
    var originalCols = originalSheet ? originalSheet.getLastColumn() : 0;
    var headers = originalCols > 0
      ? originalSheet.getRange(1, 1, 1, originalCols).getDisplayValues()[0]
      : [];
    return {
      backupName: backupName,
      skipped: true,
      reason: 'BACKUP_ALREADY_EXISTS',
      originalRows: originalRows,
      originalCols: originalCols,
      headers: headers
    };
  }

  var sheet = ss.getSheetByName(DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
  }

  var originalRows = sheet.getLastRow();
  var originalCols = sheet.getLastColumn();
  var headers = originalCols > 0
    ? sheet.getRange(1, 1, 1, originalCols).getDisplayValues()[0]
    : [];

  sheet.copyTo(ss).setName(backupName);

  return {
    backupName: backupName,
    skipped: false,
    originalRows: originalRows,
    originalCols: originalCols,
    headers: headers
  };
}

/**
 * オーダー管理シートのヘッダー行のみを英語スネークケースに書き換える
 *
 * @returns {{
 *   renamedCount: number,
 *   expectedCount: number,
 *   skipped: string[],
 *   newHeaders: string[],
 *   rowCountBefore: number,
 *   rowCountAfter: number,
 *   colCountBefore: number,
 *   colCountAfter: number
 * }}
 */
function devRenameOrdersColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('devRenameOrdersColumns は development 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
  }

  var colCountBefore = sheet.getLastColumn();
  var rowCountBefore = sheet.getLastRow();

  if (colCountBefore < 1) {
    throw new Error('ヘッダー行が空です: ' + DEV_RENAME_ORDERS_COLUMNS_SHEET_NAME);
  }

  var headerRange = sheet.getRange(1, 1, 1, colCountBefore);
  var headerValues = headerRange.getDisplayValues()[0];

  var newHeaders = headerValues.slice();
  var renamedCount = 0;
  var skipped = [];

  for (var i = 0; i < headerValues.length; i++) {
    var current = String(headerValues[i]).trim();
    if (Object.prototype.hasOwnProperty.call(DEV_RENAME_ORDERS_COLUMNS_RENAME_MAP, current)) {
      newHeaders[i] = DEV_RENAME_ORDERS_COLUMNS_RENAME_MAP[current];
      renamedCount += 1;
    } else if (current !== '') {
      skipped.push({ col: i + 1, header: current });
    }
  }

  headerRange.setValues([newHeaders]);

  var colCountAfter = sheet.getLastColumn();
  var rowCountAfter = sheet.getLastRow();

  return {
    renamedCount: renamedCount,
    expectedCount: DEV_RENAME_ORDERS_COLUMNS_EXPECTED_COUNT,
    skipped: skipped,
    newHeaders: newHeaders,
    rowCountBefore: rowCountBefore,
    rowCountAfter: rowCountAfter,
    colCountBefore: colCountBefore,
    colCountAfter: colCountAfter
  };
}
