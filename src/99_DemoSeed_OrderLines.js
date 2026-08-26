/**
 * デモデータ投入 ― オーダー明細 (セッション 6 / 9)
 * ファイル: src/99_DemoSeed_OrderLines.js
 *
 * 実測ヘッダー（auditDevCoreSchemaV1HeaderDetailV3 2026-08-26 実測）
 *   col1:明細ID  | col2:オーダーID | col3:行番号 | col4:カテゴリ
 *   col5:商品名  | col6:状態      | col7:SKU   | col8:数量
 *   col9:単価   | col10:小計     | col11:商品ID
 *
 * 戻し方: git revert <マージコミットSHA>
 *   ※ git revert はコードのみ。シートデータは
 *     BACKUP_20260826_デモ前 から手動復元が必要。
 */

// ── 定数 ─────────────────────────────────────────────────────────────
var DEMO_ORDER_LINES_TABLE_KEY = 'ORDER_LINES';
var DEMO_ORDER_LINES_COUNT     = 100;
var DEMO_ORDER_LINES_N_OFFSET  = 90000; // OL-90001 〜 OL-90100

// ── dryRun ───────────────────────────────────────────────────────────
/**
 * 書き込みなし。投入予定件数と先頭3件のプレビューを返す。
 * @returns {string}
 */
function dryRunDemoOrderLines() {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunDemoOrderLines は development 環境でのみ実行可能です');
  }

  var ss      = getSpreadsheet();
  var sheet   = getCoreSchemaV1Sheet(ss, DEMO_ORDER_LINES_TABLE_KEY);
  var lastRow = sheet.getLastRow();

  Logger.log('[dryRunDemoOrderLines] オーダー明細 現在行数: ' + lastRow + ' (ヘッダー含む)');

  // 衝突チェック（OL-90001〜OL-90100 が既存データに混入していないか）
  _checkDemoOrderLineIdConflict_(sheet, lastRow);

  var productSuffixes = ['A', 'B', 'C', 'D', 'E'];
  var lines = [
    '=== dryRunDemoOrderLines ===',
    '対象シート: オーダー明細',
    '現在行数: ' + lastRow + ' (ヘッダー含む)',
    '削除予定: ' + (lastRow > 1 ? lastRow - 1 : 0) + '行 (行2以降)',
    '挿入予定: ' + DEMO_ORDER_LINES_COUNT + '行 (OL-90001〜OL-90100)',
    'ID衝突  : なし ✓',
    '',
    '--- 先頭3行プレビュー ---'
  ];

  for (var n = 1; n <= 3; n++) {
    var quantity  = 1 + (n % 5);
    var unitPrice = 10000 + (n * 4900);
    var subtotal  = quantity * unitPrice;
    lines.push(
      'n=' + n +
      ' | OL-' + (DEMO_ORDER_LINES_N_OFFSET + n) +
      ' | OD-' + (DEMO_ORDER_LINES_N_OFFSET + n) +
      ' | 行番号=1' +
      ' | 商品名=デモ商品 ' + productSuffixes[(n - 1) % 5] +
      ' | 数量=' + quantity +
      ' | 単価=' + unitPrice +
      ' | 小計=' + subtotal
    );
  }

  return lines.join('\n');
}

// ── 本体 ─────────────────────────────────────────────────────────────
/**
 * オーダー明細シートの2行目以降を全削除し、デモ100行を挿入する。
 * @returns {number} 挿入件数 (100)
 */
function seedDemoOrderLines() {
  if (getEnvironment() !== 'development') {
    throw new Error('seedDemoOrderLines は development 環境でのみ実行可能です');
  }

  var ss       = getSpreadsheet();
  var tableKey = DEMO_ORDER_LINES_TABLE_KEY;
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

  // ---- 現在行数ログ ----
  var lastRow = sheet.getLastRow();
  Logger.log('[seedDemoOrderLines] オーダー明細 現在行数: ' + lastRow + ' (ヘッダー含む)');

  // ---- 衝突チェック（OL-90001〜OL-90100 と既存IDの衝突確認）----
  _checkDemoOrderLineIdConflict_(sheet, lastRow);

  // ---- ヘッダー実測（物理列順を取得）----
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('オーダー明細シートにヘッダーがありません');
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  function colOf(headerKey) {
    var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
    var idx  = rawHeaders.indexOf(name);
    if (idx === -1) throw new Error('HEADER_NOT_FOUND: ' + headerKey + ' (' + name + ')');
    return idx; // 0-based
  }

  var iOrderLineId = colOf('ORDER_LINE_ID'); // col1: 明細ID
  var iOrderId     = colOf('ORDER_ID');      // col2: オーダーID
  var iLineNumber  = colOf('LINE_NUMBER');   // col3: 行番号
  var iCategory    = colOf('CATEGORY');      // col4: カテゴリ
  var iProductName = colOf('PRODUCT_NAME'); // col5: 商品名
  var iStatus      = colOf('STATUS');        // col6: 状態
  var iSku         = colOf('SKU');           // col7: SKU
  var iQuantity    = colOf('QUANTITY');      // col8: 数量
  var iUnitPrice   = colOf('UNIT_PRICE');    // col9: 単価
  var iSubtotal    = colOf('SUBTOTAL');      // col10: 小計
  var iProductId   = colOf('PRODUCT_ID');   // col11: 商品ID

  var productSuffixes = ['A', 'B', 'C', 'D', 'E'];

  // ---- 2行目以降を全削除（ヘッダー行は触らない）----
  if (lastRow >= 2) {
    sheet.deleteRows(2, lastRow - 1);
  }

  // ---- 100行分データ生成（n=1〜100）----
  var rows = [];
  for (var n = 1; n <= DEMO_ORDER_LINES_COUNT; n++) {
    var quantity  = 1 + (n % 5);
    var unitPrice = 10000 + (n * 4900);
    var subtotal  = quantity * unitPrice;

    var row = new Array(lastCol).fill('');
    row[iOrderLineId] = 'OL-' + (DEMO_ORDER_LINES_N_OFFSET + n); // OL-90001〜OL-90100
    row[iOrderId]     = 'OD-' + (DEMO_ORDER_LINES_N_OFFSET + n); // OD-90001〜OD-90100
    row[iLineNumber]  = 1;
    row[iCategory]    = '';
    row[iProductName] = 'デモ商品 ' + productSuffixes[(n - 1) % 5]; // A〜E循環
    row[iStatus]      = '';
    row[iSku]         = '';
    row[iQuantity]    = quantity;                                   // 1+(n%5)
    row[iUnitPrice]   = unitPrice;                                  // 10000+(n*4900)
    row[iSubtotal]    = subtotal;                                   // quantity*unitPrice
    row[iProductId]   = '';
    rows.push(row);
  }

  // ---- 一括挿入 ----
  sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);

  Logger.log('[seedDemoOrderLines] 投入完了: ' + rows.length + '件');
  return rows.length;
}

// ── 内部ユーティリティ ────────────────────────────────────────────────
/**
 * 既存データに OL-90001〜OL-90100 が存在しないことを確認する。
 * 存在する場合は throw（二重投入防止）。
 * @param {Sheet} sheet
 * @param {number} lastRow
 */
function _checkDemoOrderLineIdConflict_(sheet, lastRow) {
  if (lastRow < 2) return; // データなし → 衝突なし
  var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < idValues.length; i++) {
    var id = String(idValues[i][0] || '');
    if (id.indexOf('OL-90') === 0) {
      throw new Error(
        'ID衝突: ' + id + ' が既存データに存在します。' +
        '二重投入を防ぐため停止しました。手動確認が必要です。'
      );
    }
  }
}
