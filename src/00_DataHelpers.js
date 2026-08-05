/**
 * データ変換ヘルパー関数
 * ヘッダー駆動の動的なデータ処理を提供
 */

/**
 * オブジェクトを配列に変換（ヘッダーの順序に従う）
 * 列の追加・削除・順序変更に自動対応
 *
 * @param {Object} data - データオブジェクト（例: {ログID: 'LOG-00001', リードID: 'LDI-00001', ...}）
 * @param {Array} headers - ヘッダー配列（例: HEADERS.CONVERSATION_LOG）
 * @returns {Array} - 配列形式のデータ（シート行として保存可能）
 *
 * @example
 * const logData = {
 *   'ログID': 'LOG-00001',
 *   'リードID': 'LDI-00001',
 *   '日時': new Date(),
 *   '送受信': '送信',
 *   '発言者': '谷澤 伸吾',
 *   '原文': 'こんにちは',
 *   '原文言語': 'ja',
 *   '翻訳文': 'Hello',
 *   '記録者ID': 'STF-00001',
 *   '記録日時': new Date()
 * };
 * const row = convertObjectToRowArray(logData, HEADERS.CONVERSATION_LOG);
 * // 結果: ['LOG-00001', 'LDI-00001', Date, '送信', '谷澤 伸吾', 'こんにちは', 'ja', 'Hello', 'STF-00001', Date]
 */
function convertObjectToRowArray(data, headers) {
  return headers.map(header => {
    const value = data[header];
    // undefined, null の場合は空文字列を返す
    return value !== undefined && value !== null ? value : '';
  });
}

/**
 * 会話ログオブジェクトの配列をスプレッドシートに一括保存
 * ヘッダー定義に基づいて自動的に列を構成
 *
 * @param {Array<Object>} logObjects - ログオブジェクトの配列
 * @param {Sheet} targetSheet - 保存先シート
 * @returns {number} - 保存した行数
 *
 * @example
 * const logs = [
 *   {ログID: 'LOG-00001', リードID: 'LDI-00001', ...},
 *   {ログID: 'LOG-00002', リードID: 'LDI-00001', ...}
 * ];
 * const sheet = ss.getSheetByName('会話ログ（商談用）');
 * const savedCount = bulkSaveConversationLogs(logs, sheet);
 * Logger.log('保存完了: ' + savedCount + ' 件');
 */
function bulkSaveConversationLogs(logObjects, targetSheet) {
  if (!logObjects || logObjects.length === 0) {
    Logger.log('bulkSaveConversationLogs: データがありません');
    return 0;
  }

  const headers = HEADERS.CONVERSATION_LOG;
  const rows = logObjects.map(log =>
    convertObjectToRowArray(log, headers)
  );

  const lastRow = targetSheet.getLastRow();
  targetSheet.getRange(
    lastRow + 1,
    1,
    rows.length,
    headers.length  // 列数もヘッダーから自動取得
  ).setValues(rows);

  Logger.log('bulkSaveConversationLogs: ' + rows.length + ' 件保存しました');
  return rows.length;
}

/**
 * 配列データをオブジェクトに変換（ヘッダーをキーとして使用）
 * スプレッドシートから取得したデータをオブジェクト形式に変換
 *
 * @param {Array} rowData - 行データ配列
 * @param {Array} headers - ヘッダー配列
 * @returns {Object} - オブジェクト形式のデータ
 *
 * @example
 * const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 * const rowData = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
 * const logObject = convertRowArrayToObject(rowData, headers);
 * // 結果: {ログID: 'LOG-00001', リードID: 'LDI-00001', ...}
 */
function convertRowArrayToObject(rowData, headers) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = rowData[index];
  });
  return obj;
}

/**
 * スプレッドシートの全データをオブジェクト配列に変換
 *
 * @param {Sheet} sheet - 対象シート
 * @returns {Array<Object>} - オブジェクトの配列
 *
 * @example
 * const sheet = ss.getSheetByName('会話ログ（商談用）');
 * const logs = convertSheetToObjects(sheet);
 * logs.forEach(log => {
 *   Logger.log(log['ログID'] + ': ' + log['原文']);
 * });
 */
function convertSheetToObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const objects = [];

  for (let i = 1; i < data.length; i++) {
    objects.push(convertRowArrayToObject(data[i], headers));
  }

  return objects;
}

/**
 * ヘッダー名から列インデックスを取得
 *
 * @param {Array} headers - ヘッダー配列
 * @param {string} headerName - 検索するヘッダー名
 * @returns {number} - 列インデックス（0-indexed）、見つからない場合は -1
 *
 * @example
 * const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 * const originalTextIndex = getColumnIndex(headers, '原文');
 * if (originalTextIndex !== -1) {
 *   const originalText = rowData[originalTextIndex];
 * }
 */
function getColumnIndex(headers, headerName) {
  return headers.indexOf(headerName);
}

/**
 * 複数のヘッダー名から列インデックスのマップを取得
 *
 * @param {Array} headers - ヘッダー配列
 * @param {Array<string>} headerNames - 検索するヘッダー名の配列
 * @returns {Object} - {ヘッダー名: インデックス} のマップ
 *
 * @example
 * const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 * const columnMap = getColumnIndexMap(headers, ['原文', '翻訳文', '原文言語']);
 * const originalText = rowData[columnMap['原文']];
 * const translatedText = rowData[columnMap['翻訳文']];
 * const originalLanguage = rowData[columnMap['原文言語']];
 */
function getColumnIndexMap(headers, headerNames) {
  const map = {};
  headerNames.forEach(name => {
    map[name] = headers.indexOf(name);
  });
  return map;
}

/**
 * シートのヘッダー行(1行目)を読み込み、列名とインデックスのマップを作成する
 * 列の順序が変わってもヘッダー名で参照できるようにする
 *
 * @param {Sheet} sheet - シートオブジェクト
 * @returns {Object} - 列名をキー、インデックス(0始まり)を値とするマップ
 *
 * @example
 * const sheet = getSheetByGid(ss, CONFIG.SHEETS.TERM_DICTIONARY_GID);
 * const headerMap = getHeaderIndexMap(sheet);
 * // 結果: { 'ナレッジID': 0, 'カテゴリ': 1, '英文': 2, ... }
 */
function getHeaderIndexMap(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    return {};
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};

  headers.forEach((header, index) => {
    if (header) {  // 空のヘッダーは無視
      map[header] = index;
    }
  });

  return map;
}

/**
 * gid（シートID）からシートを取得
 * シート名ではなくgidで取得することで、シート名変更の影響を受けない
 *
 * @param {Spreadsheet} spreadsheet - スプレッドシートオブジェクト
 * @param {number} gid - シートID（gid）
 * @returns {Sheet|null} - 該当するシート、見つからない場合はnull
 *
 * @example
 * const ss = getSpreadsheet();
 * const leadsSheet = getSheetByGid(ss, CONFIG.SHEETS.LEADS_GID);
 * if (leadsSheet) {
 *   // シートが見つかった
 * }
 */
function getSheetByGid(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) {
      return sheets[i];
    }
  }
  Logger.log('getSheetByGid: gid=' + gid + ' のシートが見つかりません');
  return null;
}
