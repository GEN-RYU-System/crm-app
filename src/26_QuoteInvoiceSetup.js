/**
 * 見積もり・請求書シートセットアップ
 *
 * Core Schema V1 の QUOTES / QUOTE_LINES / INVOICES / INVOICE_LINES
 * に対応する物理シートを作成する。
 *
 * ★ このファイルの関数以外でシートを作成・削除・上書きしてはならない。
 */

/**
 * 「見積書管理」を「見積書管理_旧」にリネームする（1回限り実行）
 *
 * - 既に「見積書管理_旧」が存在する場合は何もしない
 * - 行の削除・内容の変更はしない
 * - LockService で保護する
 *
 * ★ 実行タイミングは当方の指示を待つこと
 *
 * @returns {{ status: string, sheetName?: string, from?: string, to?: string }}
 */
function renameOldQuoteSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var OLD_NAME = '見積書管理';
    var NEW_NAME = '見積書管理_旧';

    if (ss.getSheetByName(NEW_NAME)) {
      Logger.log('[renameOldQuoteSheet] ' + NEW_NAME + ' は既に存在します。何もしません。');
      return { status: 'ALREADY_EXISTS', sheetName: NEW_NAME };
    }

    var sheet = ss.getSheetByName(OLD_NAME);
    if (!sheet) {
      Logger.log('[renameOldQuoteSheet] ' + OLD_NAME + ' が見つかりません。何もしません。');
      return { status: 'SOURCE_NOT_FOUND', sheetName: OLD_NAME };
    }

    sheet.setName(NEW_NAME);
    Logger.log('[renameOldQuoteSheet] リネーム完了: ' + OLD_NAME + ' → ' + NEW_NAME);
    return { status: 'RENAMED', from: OLD_NAME, to: NEW_NAME };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4シートを作成する
 *   QUOTES      → 見積もり管理
 *   QUOTE_LINES → 見積もり明細
 *   INVOICES    → 請求書管理
 *   INVOICE_LINES → 請求書明細
 *
 * - 既に存在するタブは絶対に上書きしない
 * - ヘッダーは Core Schema V1 の定義から生成する（物理名を直書きしない）
 * - LockService で保護する
 *
 * @returns {Object} 各テーブルキーの結果 { status: 'CREATED'|'ALREADY_EXISTS', sheetName: string, columns?: number }
 */
function setupQuoteInvoiceSheets() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var tableKeys = ['QUOTES', 'QUOTE_LINES'];
    var results = {};

    tableKeys.forEach(function(tableKey) {
      var table = CORE_SCHEMA_V1_TABLES[tableKey];
      var sheetName = table.sheetName;

      if (ss.getSheetByName(sheetName)) {
        Logger.log('[setupQuoteInvoiceSheets] ' + sheetName + ' は既に存在します。スキップ。');
        results[tableKey] = { status: 'ALREADY_EXISTS', sheetName: sheetName };
        return;
      }

      var headerNames = Object.keys(table.headers).map(function(k) { return table.headers[k]; });
      var sheet = ss.insertSheet(sheetName);

      sheet.getRange(1, 1, 1, headerNames.length).setValues([headerNames]);
      sheet.getRange(1, 1, 1, headerNames.length)
        .setFontWeight('bold')
        .setBackground('#4a86e8')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);

      Logger.log('[setupQuoteInvoiceSheets] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
      results[tableKey] = { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
    });

    return results;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 未使用の請求書シートをリネームしてアーカイブする（1回限り実行）
 *
 *   「請求書管理」→「請求書管理_未使用」
 *   「請求書明細」→「請求書明細_未使用」
 *
 * - 対象シートが存在しない場合は何もしない
 * - リネーム後の名前が既に存在する場合も何もしない
 * - 削除はしない
 * - LockService で保護する
 *
 * ★ 実行タイミングは当方の指示を待つこと
 *
 * @returns {Object} 各シートの処理結果
 */
function archiveUnusedInvoiceSheets() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var RENAMES = [
      { from: '請求書管理', to: '請求書管理_未使用' },
      { from: '請求書明細', to: '請求書明細_未使用' }
    ];
    var results = {};

    RENAMES.forEach(function(item) {
      if (ss.getSheetByName(item.to)) {
        Logger.log('[archiveUnusedInvoiceSheets] ' + item.to + ' は既に存在します。何もしません。');
        results[item.from] = { status: 'ALREADY_EXISTS', sheetName: item.to };
        return;
      }
      var sheet = ss.getSheetByName(item.from);
      if (!sheet) {
        Logger.log('[archiveUnusedInvoiceSheets] ' + item.from + ' が見つかりません。何もしません。');
        results[item.from] = { status: 'SOURCE_NOT_FOUND', sheetName: item.from };
        return;
      }
      sheet.setName(item.to);
      Logger.log('[archiveUnusedInvoiceSheets] リネーム完了: ' + item.from + ' → ' + item.to);
      results[item.from] = { status: 'RENAMED', from: item.from, to: item.to };
    });

    return results;
  } finally {
    lock.releaseLock();
  }
}
