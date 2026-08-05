/**
 * CSVエクスポートサービス
 *
 * Purpose: スプレッドシートから動的にヘッダーを読み取り、サンプルCSVを生成
 * Features:
 * - 実際のシートのヘッダー構成を自動取得
 * - 列構成の変更に自動追従
 * - Excel互換のUTF-8 BOM対応
 *
 * Design Principle:
 * - ハードコード不可: 全てのヘッダーは実際のシートから読み取る
 * - 列追加・削除・並び替えに自動対応
 * - サンプルデータは空行で生成（個人情報漏洩リスクゼロ）
 */

/**
 * スプレッドシートから実際のヘッダーを読み取り、サンプルCSVを生成
 *
 * @param {string} sheetName - シート名
 * @param {number} sampleRows - サンプル行数（デフォルト: 2）
 * @returns {Object} CSV data object with content, filename, and mimeType
 *
 * @example
 * // リード管理シートのサンプルCSVを生成
 * const csv = exportSheetSampleCSV('リード管理', 2);
 * // => { content: '...', filename: 'リード管理_サンプル.csv', mimeType: 'text/csv' }
 */
function exportSheetSampleCSV(sheetName, sampleRows = 2) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      throw new Error(`シート「${sheetName}」にデータがありません`);
    }

    // ★重要: 実際のヘッダー（1行目）を取得（ハードコード不可）★
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    // サンプルデータを生成（空行）
    // ※個人情報漏洩リスクを避けるため、実データは使用しない
    const sampleData = [];
    for (let i = 0; i < sampleRows; i++) {
      sampleData.push(new Array(headers.length).fill(''));
    }

    // CSV生成
    const csvRows = [headers];
    csvRows.push(...sampleData);

    const csvContent = csvRows.map(row =>
      row.map(cell => {
        // CSV エスケープ処理
        const value = String(cell);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',')
    ).join('\n');

    // UTF-8 BOM付き（Excel対応）
    const csvWithBOM = '\uFEFF' + csvContent;

    return {
      content: csvWithBOM,
      filename: `${sheetName}_サンプル.csv`,
      mimeType: 'text/csv',
      columnCount: headers.length,
      sampleRowCount: sampleRows
    };
  } catch (error) {
    Logger.log(`[CSVExport] exportSheetSampleCSV error (${sheetName}): ${error.message}`);
    throw error;
  }
}

/**
 * リード管理サンプルCSVをエクスポート
 *
 * @returns {Object} CSV data object with content, filename, and mimeType
 */
function exportLeadsSampleCSV() {
  try {
    const result = exportSheetSampleCSV('リード管理', 2);
    result.filename = 'リード管理_サンプル.csv';
    return result;
  } catch (error) {
    Logger.log('[CSVExport] exportLeadsSampleCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 顧客マスタサンプルCSVをエクスポート
 *
 * @returns {Object} CSV data object with content, filename, and mimeType
 */
function exportCustomerMasterSampleCSV() {
  try {
    const result = exportSheetSampleCSV('顧客マスタ', 2);
    result.filename = '顧客マスタ_サンプル.csv';
    return result;
  } catch (error) {
    Logger.log('[CSVExport] exportCustomerMasterSampleCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 会話ログサンプルCSVをエクスポート
 *
 * @returns {Object} CSV data object with content, filename, and mimeType
 */
function exportConversationLogSampleCSV() {
  try {
    const result = exportSheetSampleCSV(CONFIG.SHEETS.CONVERSATION_LOG, 3);
    result.filename = '会話ログ_サンプル.csv';
    return result;
  } catch (error) {
    Logger.log('[CSVExport] exportConversationLogSampleCSV error: ' + error.message);
    throw error;
  }
}
