/**
 * ヘッダー名から列番号を取得するヘルパー関数
 *
 * このヘルパーは、列の順序が変更されても正しく動作するように、
 * ヘッダー名（1行目）から列番号を動的に取得します。
 */

/**
 * シートのヘッダー行から列番号のマッピングを作成
 *
 * @param {Sheet} sheet - Google Sheetsのシートオブジェクト
 * @param {number} headerRow - ヘッダー行の番号（デフォルト: 1）
 * @returns {Object} ヘッダー名 → 列番号のマッピング
 *
 * @example
 * const mapping = getHeaderMapping(sheet);
 * const nameCol = mapping['customer_name'];  // → 2
 * sheet.getRange(5, nameCol).setValue('ABC Corp');
 */
function getHeaderMapping(sheet, headerRow = 1) {
  if (!sheet) {
    throw new Error('シートオブジェクトがnullまたはundefinedです');
  }

  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      throw new Error('シートに列がありません');
    }

    const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    const mapping = {};

    headers.forEach((header, index) => {
      if (header && header !== '') {
        // ヘッダー名 → 列番号（1-indexed）
        mapping[String(header).trim()] = index + 1;
      }
    });

    return mapping;
  } catch (error) {
    Logger.log('[getHeaderMapping] エラー: ' + error.message);
    throw new Error('ヘッダーマッピングの取得に失敗しました: ' + error.message);
  }
}

/**
 * シートから特定のヘッダー名の列番号を取得
 *
 * @param {Sheet} sheet - Google Sheetsのシートオブジェクト
 * @param {string} headerName - ヘッダー名
 * @param {number} headerRow - ヘッダー行の番号（デフォルト: 1）
 * @returns {number} 列番号（1-indexed）、見つからない場合は null
 *
 * @example
 * const nameCol = getColumnByHeader(sheet, '顧客名');
 * if (nameCol) {
 *   sheet.getRange(5, nameCol).setValue('ABC Corp');
 * }
 */
function getColumnByHeader(sheet, headerName, headerRow = 1) {
  const mapping = getHeaderMapping(sheet, headerRow);
  return mapping[String(headerName).trim()] || null;
}

/**
 * 複数のヘッダー名の列番号を一括取得
 *
 * @param {Sheet} sheet - Google Sheetsのシートオブジェクト
 * @param {Array<string>} headerNames - ヘッダー名の配列
 * @param {number} headerRow - ヘッダー行の番号（デフォルト: 1）
 * @returns {Object} ヘッダー名 → 列番号のマッピング（見つからない場合は null）
 *
 * @example
 * const cols = getColumnsByHeaders(sheet, ['顧客名', 'メール', '電話番号']);
 * sheet.getRange(5, cols['customer_name']).setValue('ABC Corp');
 */
function getColumnsByHeaders(sheet, headerNames, headerRow = 1) {
  const mapping = getHeaderMapping(sheet, headerRow);
  const result = {};

  headerNames.forEach(name => {
    result[name] = mapping[String(name).trim()] || null;
  });

  return result;
}

/**
 * 見積もり作成シートの列マッピングを動的に取得
 *
 * @param {Sheet} sheet - 見積もり作成シート
 * @returns {Object} 列マッピング
 *
 * @example
 * const cols = getQuoteCreationColumns(quoteSheet);
 * quoteSheet.getRange(2, cols.CATEGORY).setValue('Pokemon');
 */
function getQuoteCreationColumns(sheet) {
  const headers = [
    'No.',
    'カテゴリ',
    'コンディション',
    '商品マーク',
    '商品英語名',
    '個数',
    '重量 (kg)',
    '単価',
    '小計',
    '在庫数',
    'Description',
    '品目',          // L列（2026-02-12追加：輸出ラベル用品目名）
    'HSコード',      // M列（2026-02-12追加：税関コード）
    '素材',          // N列（2026-02-12追加：商品素材）
    '設定項目',
    '値',
    '説明',
    '発送先情報',
    '発送情報_値',
    '追加情報1',  // T列（クリア対象外）
    '追加情報2'   // U列（クリア対象外）
  ];

  const mapping = getHeaderMapping(sheet);
  const result = {};

  // 定義されたヘッダーに対応する列番号を取得
  result.NO = mapping['No.'] || null;
  result.CATEGORY = mapping['カテゴリ'] || null;
  result.CONDITION = mapping['コンディション'] || null;
  result.PRODUCT_MARK = mapping['商品マーク'] || null;
  result.PRODUCT_EN_TITLE = mapping['商品英語名'] || null;
  result.QUANTITY = mapping['個数'] || null;
  result.WEIGHT = mapping['重量 (kg)'] || null;
  result.UNIT_PRICE = mapping['単価'] || null;
  result.SUBTOTAL = mapping['小計'] || null;
  result.STOCK_QUANTITY = mapping['在庫数'] || null;
  result.DESCRIPTION = mapping['Description'] || null;

  // 輸出データカラムを追加（2026-02-12追加）
  result.EXPORT_ITEM_NAME = mapping['品目'] || null;
  result.HS_CODE = mapping['HSコード'] || null;
  result.MATERIAL = mapping['素材'] || null;

  result.SETTING_KEY = mapping['設定項目'] || null;
  result.SETTING_VALUE = mapping['値'] || null;
  result.SETTING_DESC = mapping['説明'] || null;

  // 発送先情報のカラムを追加（R/S列）
  result.SHIPPING_INFO_KEY = mapping['発送先情報'] || null;
  result.SHIPPING_INFO_VALUE = mapping['発送情報_値'] || null;

  // 追加情報カラムを追加（T/U列、クリア対象外）
  result.ADDITIONAL_INFO_1 = mapping['追加情報1'] || null;
  result.ADDITIONAL_INFO_2 = mapping['追加情報2'] || null;

  // nullチェック: 必須カラムが見つからない場合はエラー
  const requiredColumns = ['NO', 'CATEGORY', 'CONDITION', 'PRODUCT_MARK', 'PRODUCT_EN_TITLE', 'QUANTITY'];
  requiredColumns.forEach(key => {
    if (!result[key]) {
      throw new Error(`必須カラム "${key}" が見積もり作成シートに見つかりません`);
    }
  });

  return result;
}

/**
 * 見積もり履歴シートの列マッピングを動的に取得
 *
 * @param {Sheet} sheet - 見積もり履歴シート
 * @returns {Object} 列マッピング（ヘッダー名 → 列番号）
 *
 * @example
 * const mapping = getQuoteHistoryMapping(quoteHistorySheet);
 * const markCol = mapping['商品マーク'];
 * const enTitleCol = mapping['商品英語名'];
 */
function getQuoteHistoryMapping(sheet) {
  return getHeaderMapping(sheet);
}

/**
 * ヘッダー配列から 0-indexed の列インデックスマップを作成する。
 * getDataRange().getValues() パターン（row[idx] アクセス）用。
 * 1つでも見つからない列名があれば Error をスローする（サイレント -1 防止）。
 *
 * @param {Array<string>} headers - データ1行目のヘッダー配列
 * @param {Array<string>} names   - 取得したい列名の配列
 * @returns {Object} 列名 → 0-based インデックスのマッピング
 *
 * @example
 * const colIndex = buildColIndex(data[0], ['顧客名', '担当者ID']);
 * const name = row[colIndex['customer_name']];
 */
function buildColIndex(headers, names) {
  const idx = {}, missing = [];
  names.forEach(n => {
    const i = headers.indexOf(n);
    if (i < 0) missing.push(n);
    idx[n] = i;
  });
  if (missing.length) throw new Error('列が見つかりません: ' + missing.join(', '));
  return idx;
}

/**
 * テスト関数: ヘッダーマッピングの動作確認
 */
function testHeaderMapping() {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積もり作成シートをテスト
    let quoteCreationSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID) {
        quoteCreationSheet = sheets[i];
        break;
      }
    }

    if (quoteCreationSheet) {
      Logger.log('=== 見積もり作成シート ===');
      const cols = getQuoteCreationColumns(quoteCreationSheet);
      Logger.log('カテゴリ列: ' + cols.CATEGORY);
      Logger.log('商品名/マーク列: ' + cols.PRODUCT_MARK);
      Logger.log('コンディション列: ' + cols.CONDITION);
    }

    // 見積もり履歴シートをテスト
    let quoteHistorySheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteHistorySheet = sheets[i];
        break;
      }
    }

    if (quoteHistorySheet) {
      Logger.log('\n=== 見積もり履歴シート ===');
      const mapping = getQuoteHistoryMapping(quoteHistorySheet);
      Logger.log('商品マーク列: ' + mapping['商品マーク']);
      Logger.log('商品英語名列: ' + mapping['商品英語名']);
      Logger.log('コンディション列: ' + mapping['コンディション']);
    }

    return { success: true, message: 'テスト完了' };
  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}
