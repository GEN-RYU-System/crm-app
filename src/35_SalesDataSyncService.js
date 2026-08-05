/**
 * 📊売上データシート同期サービス
 *
 * 請求書作成シートから📊売上データシートにデータを転記する
 * 全ての項目は動的ヘッダーマッピングを使用（列番号のハードコード禁止）
 *
 * 実装日: 2026-02-12
 * 更新日: 2026-02-12 - 動的マッピング実装
 * 関連ドキュメント:
 *   - SALES_DATA_OUTPUT_SPEC_V2.md
 *   - SALES_DATA_DYNAMIC_MAPPING_PLAN.md
 *   - SALES_DATA_OUTPUT_ITEMS_LIST.md
 */

// ========================================
// 補助関数
// ========================================

/**
 * コメント結合関数
 *
 * @param {string} customerShippingMemo - 顧客発送時メモ
 * @param {string} shippingMemo - 発送メモ
 * @returns {string} 結合されたコメント（bullet point形式）
 *
 * @example
 * buildComment('顧客メモ', '発送メモ')
 * // '・顧客メモ\n・発送メモ'
 */
function buildComment(customerShippingMemo, shippingMemo) {
  const parts = [];

  if (customerShippingMemo && String(customerShippingMemo).trim() !== '') {
    parts.push('・' + String(customerShippingMemo).trim());
  }

  if (shippingMemo && String(shippingMemo).trim() !== '') {
    parts.push('・' + String(shippingMemo).trim());
  }

  return parts.join('\n');
}

/**
 * スタッフ管理から氏名（日本語）を取得
 *
 * @param {string} emailOrId - メールアドレスまたは担当者ID
 * @param {Sheet} staffSheet - スタッフ管理シート
 * @param {Object} staffMapping - ヘッダーマッピング
 * @returns {string} 氏名（日本語）
 */
function getStaffFullName(emailOrId, staffSheet, staffMapping) {
  if (!emailOrId || !staffSheet || !staffMapping) {
    return '';
  }

  try {
    const data = staffSheet.getDataRange().getValues();
    const emailCol = staffMapping['メール'];
    const nameCol = staffMapping['氏名（日本語）'];

    if (!emailCol || !nameCol) {
      Logger.log('⚠️ スタッフ管理に必要な列が見つかりません');
      return '';
    }

    // 1. メールアドレスで検索（1行目はヘッダーなのでスキップ）
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol - 1] === emailOrId) {
        return data[i][nameCol - 1] || '';
      }
    }

    // 2. 氏名（日本語）で検索（メールで見つからなかった場合）
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameCol - 1] === emailOrId) {
        return data[i][nameCol - 1] || '';
      }
    }

    Logger.log('⚠️ 担当者が見つかりません: ' + emailOrId);
    return '';
  } catch (error) {
    Logger.log('❌ 担当者取得エラー: ' + error.message);
    return '';
  }
}

/**
 * 顧客マスタから営業担当者を取得
 *
 * @param {string} customerName - 顧客名
 * @param {Sheet} customerSheet - 顧客マスタシート
 * @param {Object} customerMapping - ヘッダーマッピング
 * @returns {string} 営業担当者名
 */
function getCustomerSalesRep(customerName, customerSheet, customerMapping) {
  if (!customerName || !customerSheet || !customerMapping) {
    return '';
  }

  try {
    const data = customerSheet.getDataRange().getValues();
    const nameCol = customerMapping['B Name'];
    const salesRepCol = customerMapping['営業担当者'];

    if (!nameCol || !salesRepCol) {
      Logger.log('⚠️ 顧客マスタに必要な列が見つかりません');
      return '';
    }

    // 顧客名で検索（1行目はヘッダーなのでスキップ）
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameCol - 1] === customerName) {
        return data[i][salesRepCol - 1] || '';
      }
    }

    Logger.log('⚠️ 顧客が見つかりません: ' + customerName);
    return '';
  } catch (error) {
    Logger.log('❌ 顧客営業担当者取得エラー: ' + error.message);
    return '';
  }
}

/**
 * 請求書番号に連番を付与
 *
 * @param {string} baseNumber - 基本の請求書番号（例: INV-00001）
 * @param {number} itemIndex - 商品インデックス（0始まり）
 * @param {number} totalItems - 商品総数
 * @returns {string} 連番付き請求書番号
 *
 * @example
 * formatInvoiceNumber('INV-00001', 0, 3) // 'INV-00001-01'
 * formatInvoiceNumber('INV-00001', 1, 3) // 'INV-00001-02'
 * formatInvoiceNumber('INV-00001', 0, 1) // 'INV-00001' (1商品の場合は連番なし)
 */
function formatInvoiceNumber(baseNumber, itemIndex, totalItems) {
  if (!baseNumber) {
    return '';
  }

  if (totalItems === 1) {
    return baseNumber; // 1商品の場合は連番なし
  } else {
    const suffix = String(itemIndex + 1).padStart(2, '0'); // 01, 02, 03...
    return baseNumber + '-' + suffix;
  }
}

/**
 * SKUに連番を付与
 *
 * @param {string} baseSKU - 基本のSKU（例: SKU-00001）
 * @param {number} itemIndex - 商品インデックス（0始まり）
 * @param {number} totalItems - 商品総数
 * @returns {string} 連番付きSKU
 *
 * @example
 * formatSKU('SKU-00001', 0, 3) // 'SKU-00001-01'
 * formatSKU('SKU-00001', 1, 3) // 'SKU-00001-02'
 * formatSKU('SKU-00001', 0, 1) // 'SKU-00001' (1商品の場合は連番なし)
 */
function formatSKU(baseSKU, itemIndex, totalItems) {
  if (!baseSKU) {
    return '';
  }

  if (totalItems === 1) {
    return baseSKU; // 1商品の場合は連番なし
  } else {
    const suffix = String(itemIndex + 1).padStart(2, '0'); // 01, 02, 03...
    return baseSKU + '-' + suffix;
  }
}

// ========================================
// メイン関数
// ========================================

/**
 * 請求書作成シートから📊売上データシートにデータを転記
 * 動的ヘッダーマッピングを使用（列番号のハードコード禁止）
 *
 * @param {string} pdfUrl - 生成されたPDFのURL
 * @returns {Object} 転記結果
 *
 * @example
 * const result = writeInvoiceToSalesData('https://drive.google.com/file/d/...');
 * // { success: true, rowsWritten: 3, invoiceNumber: 'INV-00001', pdfUrl: '...' }
 */
function writeInvoiceToSalesData(pdfUrl) {
  try {
    Logger.log('='.repeat(80));
    Logger.log('📊売上データシート：請求書データ転記開始（動的マッピング方式）');
    Logger.log('PDF URL: ' + pdfUrl);
    Logger.log('='.repeat(80));

    const ss = getSpreadsheet();
    const invoiceSheet = getSheetByGid(ss, PRODUCTION_IDS.INVOICE_CREATION_SHEET_GID);
    const salesDataSheet = getSheetByGid(ss, PRODUCTION_IDS.SALES_DATA_SHEET_GID);

    if (!invoiceSheet) {
      Logger.log('❌ 請求書作成シートが見つかりません');
      return {
        success: false,
        error: '請求書作成シートが見つかりません'
      };
    }

    if (!salesDataSheet) {
      Logger.log('❌ 📊売上データシートが見つかりません');
      return {
        success: false,
        error: '📊売上データシートが見つかりません'
      };
    }

    // ========================================
    // ステップ1: 各シートのヘッダーマッピングを取得
    // ========================================
    Logger.log('');
    Logger.log('【ステップ1】ヘッダーマッピング取得');

    // 1-1. 📊売上データシートのヘッダーマッピング（3行目がヘッダー）
    const salesDataMapping = getHeaderMapping(salesDataSheet, 3);
    Logger.log('  📊売上データシート: ' + Object.keys(salesDataMapping).length + '列');

    // 1-2. 請求書作成シートのヘッダーマッピング
    const invoiceCols = getQuoteCreationColumns(invoiceSheet);
    Logger.log('  請求書作成シート: マッピング取得完了');

    // 1-3. スタッフ管理のヘッダーマッピング
    const staffSheet = ss.getSheetByName('スタッフ管理');
    if (!staffSheet) {
      Logger.log('⚠️ スタッフ管理が見つかりません');
    }
    const staffMapping = staffSheet ? getHeaderMapping(staffSheet, 1) : {};
    Logger.log('  スタッフ管理: ' + Object.keys(staffMapping).length + '列');

    // 1-4. 顧客マスタのヘッダーマッピング
    const customerSheet = ss.getSheetByName('顧客マスタ');
    if (!customerSheet) {
      Logger.log('⚠️ 顧客マスタが見つかりません');
    }
    const customerMapping = customerSheet ? getHeaderMapping(customerSheet, 1) : {};
    Logger.log('  顧客マスタ: ' + Object.keys(customerMapping).length + '列');

    // ========================================
    // ステップ2: 請求書作成シートからデータ読み込み
    // ========================================
    Logger.log('');
    Logger.log('【ステップ2】請求書作成シートからデータ読み込み');

    // 2-1. 設定データ読み込み（L/M列）
    Logger.log('  2-1. 設定データ読み込み（L/M列）');
    const settings = {};
    for (let i = 2; i <= 20; i++) {  // L20/M20（USD為替レート）まで読み込む
      const key = invoiceSheet.getRange(i, invoiceCols.SETTING_KEY).getValue();
      const value = invoiceSheet.getRange(i, invoiceCols.SETTING_VALUE).getValue();
      if (key) {
        settings[key] = value;
        Logger.log('    ' + key + ': ' + value);
      }
    }

    // 2-2. 発送先情報読み込み（O/P列）
    Logger.log('  2-2. 発送先情報読み込み（O/P列）');
    const shippingInfo = {};
    for (let i = 2; i <= 13; i++) {
      const key = invoiceSheet.getRange(i, invoiceCols.SHIPPING_INFO_KEY).getValue();
      const value = invoiceSheet.getRange(i, invoiceCols.SHIPPING_INFO_VALUE).getValue();
      if (key) {
        shippingInfo[key] = value;
        Logger.log('    ' + key + ': ' + value);
      }
    }

    // 2-3. 商品データ読み込み（A-N列）
    Logger.log('  2-3. 商品データ読み込み（A-N列）');
    const itemRows = [];
    const maxRow = 21; // 請求書作成シートの最大行数
    for (let row = 2; row <= maxRow; row++) {
      const category = invoiceSheet.getRange(row, invoiceCols.CATEGORY).getValue();
      if (!category) break;

      const item = {
        no: invoiceSheet.getRange(row, invoiceCols.NO).getValue(),
        category: category,
        condition: invoiceSheet.getRange(row, invoiceCols.CONDITION).getValue(),
        mark: invoiceSheet.getRange(row, invoiceCols.PRODUCT_MARK).getValue(),
        enTitle: invoiceSheet.getRange(row, invoiceCols.PRODUCT_EN_TITLE).getValue(),
        quantity: invoiceSheet.getRange(row, invoiceCols.QUANTITY).getValue(),
        weight: invoiceSheet.getRange(row, invoiceCols.WEIGHT).getValue(),
        unitPrice: invoiceSheet.getRange(row, invoiceCols.UNIT_PRICE).getValue(),
        subtotal: invoiceSheet.getRange(row, invoiceCols.SUBTOTAL).getValue(),
        stockQuantity: invoiceSheet.getRange(row, invoiceCols.STOCK_QUANTITY).getValue(),
        description: invoiceSheet.getRange(row, invoiceCols.DESCRIPTION).getValue(),
        exportItemName: invoiceSheet.getRange(row, invoiceCols.EXPORT_ITEM_NAME).getValue(),
        hsCode: invoiceSheet.getRange(row, invoiceCols.HS_CODE).getValue(),
        material: invoiceSheet.getRange(row, invoiceCols.MATERIAL).getValue()
      };

      itemRows.push(item);
      Logger.log('    商品' + item.no + ': ' + item.category + ' - ' + item.enTitle + ' (' + item.condition + ') × ' + item.quantity);
      Logger.log('      HSコード読み込み: ' + (item.hsCode || '(空)'));
    }

    Logger.log('  商品データ読み込み完了: ' + itemRows.length + '件');

    // ========================================
    // ステップ3: 📊売上データシート用の行データを構築（動的マッピング）
    // ========================================
    Logger.log('');
    Logger.log('【ステップ3】📊売上データシート用の行データを構築');

    const dataRows = [];
    const columnCount = salesDataSheet.getLastColumn();
    Logger.log('  📊売上データシートの列数: ' + columnCount);

    for (let i = 0; i < itemRows.length; i++) {
      const item = itemRows[i];
      // 書き込み対象外の列の関数を保護するため、配列を初期化せずに作成
      const rowData = new Array(columnCount);

      Logger.log('  商品' + (i + 1) + '/' + itemRows.length + ': ' + item.enTitle);

      // ========================================
      // 項目1: 取引状況ステータス - 書き込み不要（関数で自動更新）
      // ========================================
      // （スキップ）

      // ========================================
      // 項目2: 取引状況コメント
      // ========================================
      const commentCol = salesDataMapping['取引状況コメント'];
      if (commentCol) {
        const comment = buildComment(
          settings['顧客発送時メモ'],
          shippingInfo['発送メモ']
        );
        rowData[commentCol - 1] = comment;
        Logger.log('    取引状況コメント: ' + (comment ? comment.replace(/\n/g, ' ') : '（空欄）'));
      }

      // ========================================
      // 項目3: 取引状況受注担当者（請求書を発行した実行者）
      // ========================================
      const orderStaffCol = salesDataMapping['取引状況受注担当者'];
      if (orderStaffCol) {
        // 実行者のメールアドレスを取得
        const activeUserEmail = Session.getActiveUser().getEmail();
        // スタッフ管理から氏名を検索
        const orderStaffName = getStaffFullName(
          activeUserEmail,
          staffSheet,
          staffMapping
        );
        rowData[orderStaffCol - 1] = orderStaffName;
        Logger.log('    取引状況受注担当者（実行者）: ' + (orderStaffName || '（見つかりません）') + ' (' + activeUserEmail + ')');
      } else {
        Logger.log('    ⚠️ 「取引状況受注担当者」列が見つかりません');
      }

      // ========================================
      // 項目3.5: 取引状況営業担当者（請求書作成シートL18/M18から直接取得）
      // ========================================
      const salesStatusRepCol = salesDataMapping['取引状況営業担当者'];
      if (salesStatusRepCol) {
        rowData[salesStatusRepCol - 1] = settings['営業担当者'] || '';
        Logger.log('    取引状況営業担当者: ' + (settings['営業担当者'] || '（空欄）'));
      } else {
        Logger.log('    ⚠️ 「取引状況営業担当者」列が見つかりません');
      }

      // ========================================
      // 項目4: 営業担当者（顧客マスタから取得）
      // ========================================
      const salesRepCol = salesDataMapping['営業担当者'];
      if (salesRepCol) {
        const salesRep = getCustomerSalesRep(
          settings['顧客名'],
          customerSheet,
          customerMapping
        );
        rowData[salesRepCol - 1] = salesRep;
        Logger.log('    営業担当者: ' + (salesRep || '（見つかりません）'));
      }

      // ========================================
      // 項目5-38: 残りの項目（ヘッダーマッピングによる直接転記）
      // ========================================

      // 項目5: 取引状況取引先名
      const customerNameCol = salesDataMapping['取引状況取引先名'];
      if (customerNameCol) {
        rowData[customerNameCol - 1] = settings['顧客名'] || '';
      }

      // 項目6: 取引状況商品名
      const productNameCol = salesDataMapping['取引状況商品名'];
      if (productNameCol) {
        rowData[productNameCol - 1] = item.enTitle || '';
      }

      // 項目7: 取引状況カテゴリ
      const categoryCol = salesDataMapping['取引状況カテゴリ'];
      if (categoryCol) {
        rowData[categoryCol - 1] = item.category || '';
      }

      // 項目8: 取引状況状態
      const conditionCol = salesDataMapping['取引状況状態'];
      if (conditionCol) {
        rowData[conditionCol - 1] = item.condition || '';
      }

      // 項目9: 取引状況請求書内容
      const descriptionCol = salesDataMapping['取引状況請求書内容'];
      if (descriptionCol) {
        rowData[descriptionCol - 1] = item.description || '';
      }

      // 項目10: 取引状況数量
      const quantityCol = salesDataMapping['取引状況数量'];
      if (quantityCol) {
        rowData[quantityCol - 1] = item.quantity || 0;
      }

      // 項目11: 取引状況請求書番号（連番）
      const invoiceNumberCol = salesDataMapping['取引状況請求書番号'];
      if (invoiceNumberCol) {
        const invoiceNumber = formatInvoiceNumber(
          settings['請求書番号'],
          i,
          itemRows.length
        );
        rowData[invoiceNumberCol - 1] = invoiceNumber;
        Logger.log('    取引状況請求書番号: ' + invoiceNumber);
      }

      // 項目12: 取引状況請求書リンク
      const invoiceLinkCol = salesDataMapping['取引状況請求書リンク'];
      if (invoiceLinkCol) {
        rowData[invoiceLinkCol - 1] = pdfUrl || '';
      }

      // 項目13: 取引状況合計（1行目のみ）
      const totalCol = salesDataMapping['取引状況合計'];
      if (totalCol) {
        // 0の場合も出力（|| ではなく ?? を使用）
        rowData[totalCol - 1] = (i === 0) ? (settings['合計'] ?? '') : '';
      }

      // 項目14: 取引状況単価
      const unitPriceCol = salesDataMapping['取引状況単価'];
      if (unitPriceCol) {
        rowData[unitPriceCol - 1] = item.unitPrice || 0;
      }

      // 項目15: 取引状況小計
      const subtotalCol = salesDataMapping['取引状況小計'];
      if (subtotalCol) {
        rowData[subtotalCol - 1] = item.subtotal || 0;
      }

      // 項目16: 取引状況関税（1行目のみ）
      const taxCol = salesDataMapping['取引状況関税'];
      if (taxCol) {
        // 0の場合も出力（|| ではなく ?? を使用）
        rowData[taxCol - 1] = (i === 0) ? (settings['税'] ?? '') : '';
      }

      // 項目17: 取引状況送料（1行目のみ）
      const shippingCol = salesDataMapping['取引状況送料'];
      if (shippingCol) {
        // 0の場合も出力（|| ではなく ?? を使用）
        rowData[shippingCol - 1] = (i === 0) ? (settings['送料'] ?? '') : '';
      }

      // 項目18: 取引状況決済
      const paymentMethodCol = salesDataMapping['取引状況決済'];
      if (paymentMethodCol) {
        rowData[paymentMethodCol - 1] = settings['支払い方法'] || '';
      }

      // 項目19: 取引状況通貨
      const currencyCol = salesDataMapping['取引状況通貨'];
      if (currencyCol) {
        rowData[currencyCol - 1] = settings['支払い通貨'] || '';
      }

      // 項目20: 取引状況SKU（連番）
      const skuCol = salesDataMapping['取引状況SKU'];
      if (skuCol) {
        const sku = formatSKU(
          settings['SKU'],
          i,
          itemRows.length
        );
        rowData[skuCol - 1] = sku;
        Logger.log('    取引状況SKU: ' + sku);
      }

      // 項目21: 取引状況支払い名義
      const paymentNameCol = salesDataMapping['取引状況支払い名義'];
      if (paymentNameCol) {
        rowData[paymentNameCol - 1] = settings['支払い名義'] || '';
      }

      // 項目22: 取引状況請求書発行日
      const issueDateCol = salesDataMapping['取引状況請求書発行日'];
      if (issueDateCol) {
        rowData[issueDateCol - 1] = settings['請求書発行日'] || '';
      }

      // 項目23: 取引状況支払期日
      const dueDateCol = salesDataMapping['取引状況支払期日'];
      if (dueDateCol) {
        rowData[dueDateCol - 1] = settings['支払い期日'] || '';
      }

      // 項目24: 取引状況為替レート
      const exchangeRateCol = salesDataMapping['取引状況為替レート'];
      if (exchangeRateCol) {
        rowData[exchangeRateCol - 1] = settings['為替レート'] || '';
      }

      // 項目25: 発送情報リードID
      const leadIdCol = salesDataMapping['発送情報リードID'];
      if (leadIdCol) {
        rowData[leadIdCol - 1] = settings['リードID'] || '';
      }

      // 項目26: 発送情報受取人氏名
      const recipientNameCol = salesDataMapping['発送情報受取人氏名'];
      if (recipientNameCol) {
        rowData[recipientNameCol - 1] = shippingInfo['受取人氏名'] || '';
      }

      // 項目27: 発送情報電話番号
      const phoneCol = salesDataMapping['発送情報電話番号'];
      if (phoneCol) {
        rowData[phoneCol - 1] = shippingInfo['電話番号'] || '';
      }

      // 項目28: 発送情報メールアドレス
      const emailCol = salesDataMapping['発送情報メールアドレス'];
      if (emailCol) {
        rowData[emailCol - 1] = shippingInfo['メールアドレス'] || '';
      }

      // 項目29: 発送情報TAX Number
      const taxNumberCol = salesDataMapping['発送情報TAX Number'];
      if (taxNumberCol) {
        rowData[taxNumberCol - 1] = shippingInfo['TAX Number'] || '';
      }

      // 項目30: 発送情報住所1
      const address1Col = salesDataMapping['発送情報住所1'];
      if (address1Col) {
        rowData[address1Col - 1] = shippingInfo['住所1'] || '';
      }

      // 項目31: 発送情報住所2
      const address2Col = salesDataMapping['発送情報住所2'];
      if (address2Col) {
        rowData[address2Col - 1] = shippingInfo['住所2'] || '';
      }

      // 項目32: 発送情報住所3
      const address3Col = salesDataMapping['発送情報住所3'];
      if (address3Col) {
        rowData[address3Col - 1] = shippingInfo['住所3'] || '';
      }

      // 項目33: 発送情報都市名
      const cityCol = salesDataMapping['発送情報都市名'];
      if (cityCol) {
        rowData[cityCol - 1] = shippingInfo['都市名'] || '';
      }

      // 項目34: 発送情報州
      const stateCol = salesDataMapping['発送情報州'];
      if (stateCol) {
        rowData[stateCol - 1] = shippingInfo['州'] || '';
      }

      // 項目35: 発送情報ZIP CODE
      const zipCol = salesDataMapping['発送情報ZIP CODE'];
      if (zipCol) {
        rowData[zipCol - 1] = shippingInfo['ZIP CODE'] || '';
      }

      // 項目36: 発送情報国名
      const countryCol = salesDataMapping['発送情報国名'];
      if (countryCol) {
        rowData[countryCol - 1] = shippingInfo['国名'] || '';
      }

      // 項目37: 発送情報重量(kg)
      const weightCol = salesDataMapping['発送情報重量(kg)'];
      if (weightCol) {
        rowData[weightCol - 1] = item.weight || 0;
      }

      // 項目38: 発送情報HSコード
      const hsCodeCol = salesDataMapping['発送情報HSコード'];
      if (hsCodeCol) {
        // HSコードをテキストとして書き込む（アポストロフィ不要）
        // 後で setNumberFormat('@') でテキスト形式を設定し、科学的記数法を回避
        rowData[hsCodeCol - 1] = item.hsCode || '';
        Logger.log('    HSコード: ' + (item.hsCode || '(空)') + ' → 列' + hsCodeCol + ' (' + getColumnLetterFromNumber(hsCodeCol) + '列)' + ' [テキスト形式]');
      } else {
        Logger.log('    ⚠️ 「発送情報HSコード」列が見つかりません');
      }

      // 項目39: 発送情報$内容品単価（USD単価 = 単価 ÷ USD為替レート）
      const usdPriceCol = salesDataMapping['発送情報$内容品単価'];
      if (usdPriceCol) {
        const usdExchangeRate = settings['USD為替レート'] || 150;  // デフォルト150円/USD
        const unitPrice = item.unitPrice || 0;
        const usdUnitPrice = usdExchangeRate > 0 ? unitPrice / usdExchangeRate : 0;
        // 数値型として明示的に設定（小数点以下2桁）
        const roundedUsdPrice = Math.round(usdUnitPrice * 100) / 100;
        rowData[usdPriceCol - 1] = Number(roundedUsdPrice);  // Number()で明示的に数値型に変換
        Logger.log('    USD単価: ¥' + unitPrice + ' ÷ ' + usdExchangeRate + ' = $' + roundedUsdPrice.toFixed(2) + ' (数値型)');
      }

      // 項目40: 発送情報為替レート（USD為替レート）
      const shippingExchangeRateCol = salesDataMapping['発送情報為替レート'];
      if (shippingExchangeRateCol) {
        const usdExchangeRate = settings['USD為替レート'] || 150;
        rowData[shippingExchangeRateCol - 1] = usdExchangeRate;
      }

      dataRows.push(rowData);
      Logger.log('  商品' + (i + 1) + '行データ構築完了');

      // デバッグ: 重要な列の値を確認
      Logger.log('  【デバッグ】rowData配列の確認:');
      Logger.log('    - 配列長: ' + rowData.length);
      Logger.log('    - D列（index 3）取引状況受注担当者: ' + rowData[3]);
      Logger.log('    - E列（index 4）取引状況営業担当者: ' + rowData[4]);
      Logger.log('    - AY列（index 50）USD単価: ' + rowData[50]);
      Logger.log('    - AZ列（index 51）為替レート: ' + rowData[51]);
      Logger.log('    - BA列（index 52）HSコード: ' + rowData[52]);
    }

    // ========================================
    // ステップ4: 📊売上データシートに一括書き込み
    // ========================================
    Logger.log('');
    Logger.log('【ステップ4】📊売上データシートに一括書き込み');

    if (dataRows.length > 0) {
      // 請求書番号列を参照して実際のデータの最終行を特定
      const invoiceNumberCol = salesDataMapping['取引状況請求書番号'];
      let nextRow = 4; // デフォルト: ヘッダー行の次（3行目がヘッダー）

      if (invoiceNumberCol) {
        Logger.log('  請求書番号列で最終行を検索中...');
        const invoiceNumberData = salesDataSheet.getRange(4, invoiceNumberCol, salesDataSheet.getMaxRows() - 3, 1).getValues();

        // 下から上に検索して、最初にデータが入っている行を見つける
        for (let i = invoiceNumberData.length - 1; i >= 0; i--) {
          if (invoiceNumberData[i][0] && String(invoiceNumberData[i][0]).trim() !== '') {
            nextRow = i + 4 + 1; // 4行目から開始 + インデックス + 1（次の行）
            Logger.log('  最終データ行: ' + (i + 4) + '行目（請求書番号: ' + invoiceNumberData[i][0] + '）');
            break;
          }
        }
      } else {
        Logger.log('  ⚠️ 請求書番号列が見つかりません。デフォルト位置を使用します');
      }

      Logger.log('  書き込み開始行: ' + nextRow + '行目');

      // ========================================
      // 出力する列だけを書き込み（その他の列は完全に触らない）
      // ========================================

      // 書き込み対象の列を特定（undefinedではない列）
      const writeCols = new Set();
      for (let row = 0; row < dataRows.length; row++) {
        for (let col = 0; col < columnCount; col++) {
          if (dataRows[row][col] !== undefined) {
            writeCols.add(col + 1); // 1-based index
          }
        }
      }

      // 列を昇順に並べ替え
      const sortedWriteCols = Array.from(writeCols).sort((a, b) => a - b);
      Logger.log('  書き込み対象列数: ' + sortedWriteCols.length + '/' + columnCount + '列');

      // 連続する列をグループ化して一括書き込み（パフォーマンス最適化）
      const colGroups = [];
      let currentGroup = { start: sortedWriteCols[0], end: sortedWriteCols[0] };

      for (let i = 1; i < sortedWriteCols.length; i++) {
        if (sortedWriteCols[i] === currentGroup.end + 1) {
          // 連続している場合はグループを拡張
          currentGroup.end = sortedWriteCols[i];
        } else {
          // 連続していない場合は新しいグループを開始
          colGroups.push(currentGroup);
          currentGroup = { start: sortedWriteCols[i], end: sortedWriteCols[i] };
        }
      }
      colGroups.push(currentGroup); // 最後のグループを追加

      Logger.log('  書き込みグループ数: ' + colGroups.length);

      // グループごとに書き込み
      for (const group of colGroups) {
        const colCount = group.end - group.start + 1;
        const groupData = dataRows.map(row => {
          const rowSlice = [];
          for (let col = group.start; col <= group.end; col++) {
            rowSlice.push(row[col - 1] !== undefined ? row[col - 1] : '');
          }
          return rowSlice;
        });

        const range = salesDataSheet.getRange(nextRow, group.start, dataRows.length, colCount);
        range.setValues(groupData);

        const startLetter = getColumnLetterFromNumber(group.start);
        const endLetter = getColumnLetterFromNumber(group.end);
        Logger.log('    書き込み: ' + startLetter + '列～' + endLetter + '列 (' + colCount + '列)');
      }

      // USD単価列の数値形式を明示的に設定（「;;;」非表示形式を上書き）
      const usdPriceCol = salesDataMapping['発送情報$内容品単価'];
      if (usdPriceCol) {
        const usdPriceRange = salesDataSheet.getRange(nextRow, usdPriceCol, dataRows.length, 1);
        usdPriceRange.setNumberFormat('0.00');
        const rangeNotation = getColumnLetterFromNumber(usdPriceCol) + nextRow + ':' + getColumnLetterFromNumber(usdPriceCol) + (nextRow + dataRows.length - 1);
        Logger.log('  USD単価列の数値形式を設定: ' + rangeNotation + ' → 0.00 (' + dataRows.length + '行)');
      }

      // HSコード列をテキスト形式に設定（科学的記数法を回避）
      const hsCodeCol = salesDataMapping['発送情報HSコード'];
      if (hsCodeCol) {
        const hsCodeRange = salesDataSheet.getRange(nextRow, hsCodeCol, dataRows.length, 1);
        hsCodeRange.setNumberFormat('@');
        const rangeNotation = getColumnLetterFromNumber(hsCodeCol) + nextRow + ':' + getColumnLetterFromNumber(hsCodeCol) + (nextRow + dataRows.length - 1);
        Logger.log('  HSコード列をテキスト形式に設定: ' + rangeNotation + ' → @ (' + dataRows.length + '行)');
      }

      Logger.log('  ✅ 一括書き込み完了');
    } else {
      Logger.log('  ⚠️ 書き込むデータがありません');
    }

    Logger.log('');
    Logger.log('='.repeat(80));
    Logger.log('📊売上データシート：請求書データ転記完了');
    Logger.log('  - 書き込み行数: ' + dataRows.length);
    Logger.log('  - 請求書番号: ' + settings['請求書番号']);
    Logger.log('  - PDF URL: ' + pdfUrl);
    Logger.log('='.repeat(80));

    return {
      success: true,
      rowsWritten: dataRows.length,
      invoiceNumber: settings['請求書番号'],
      pdfUrl: pdfUrl
    };

  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// ========================================
// テスト関数
// ========================================

/**
 * テスト関数: 売上データ同期機能のテスト
 *
 * 実行方法:
 *   clasp run testSalesDataSync
 */
function testSalesDataSync() {
  const testPdfUrl = 'https://drive.google.com/file/d/test_invoice_12345/view';

  Logger.log('📊売上データ同期機能テスト開始');
  Logger.log('テストPDF URL: ' + testPdfUrl);

  const result = writeInvoiceToSalesData(testPdfUrl);

  Logger.log('');
  Logger.log('【テスト結果】');
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト関数: buildComment()のテスト
 */
function testBuildComment() {
  Logger.log('='.repeat(80));
  Logger.log('buildComment() テスト');
  Logger.log('='.repeat(80));

  const test1 = buildComment('顧客メモ', '発送メモ');
  Logger.log('テスト1: ' + test1);
  Logger.log('期待値: ・顧客メモ\\n・発送メモ');

  const test2 = buildComment('顧客メモのみ', '');
  Logger.log('テスト2: ' + test2);
  Logger.log('期待値: ・顧客メモのみ');

  const test3 = buildComment('', '発送メモのみ');
  Logger.log('テスト3: ' + test3);
  Logger.log('期待値: ・発送メモのみ');

  const test4 = buildComment('', '');
  Logger.log('テスト4: ' + test4);
  Logger.log('期待値: （空文字列）');

  return {
    test1: test1,
    test2: test2,
    test3: test3,
    test4: test4
  };
}

/**
 * テスト関数: formatInvoiceNumber()のテスト
 */
function testFormatInvoiceNumber() {
  Logger.log('='.repeat(80));
  Logger.log('formatInvoiceNumber() テスト');
  Logger.log('='.repeat(80));

  const test1 = formatInvoiceNumber('INV-00001', 0, 3);
  Logger.log('テスト1 (3商品の1番目): ' + test1 + ' (期待値: INV-00001-01)');

  const test2 = formatInvoiceNumber('INV-00001', 1, 3);
  Logger.log('テスト2 (3商品の2番目): ' + test2 + ' (期待値: INV-00001-02)');

  const test3 = formatInvoiceNumber('INV-00001', 2, 3);
  Logger.log('テスト3 (3商品の3番目): ' + test3 + ' (期待値: INV-00001-03)');

  const test4 = formatInvoiceNumber('INV-00001', 0, 1);
  Logger.log('テスト4 (1商品のみ): ' + test4 + ' (期待値: INV-00001)');

  return {
    test1: test1,
    test2: test2,
    test3: test3,
    test4: test4
  };
}

/**
 * テスト関数: formatSKU()のテスト
 */
function testFormatSKU() {
  Logger.log('='.repeat(80));
  Logger.log('formatSKU() テスト');
  Logger.log('='.repeat(80));

  const test1 = formatSKU('SKU-00001', 0, 3);
  Logger.log('テスト1 (3商品の1番目): ' + test1 + ' (期待値: SKU-00001-01)');

  const test2 = formatSKU('SKU-00001', 1, 3);
  Logger.log('テスト2 (3商品の2番目): ' + test2 + ' (期待値: SKU-00001-02)');

  const test3 = formatSKU('SKU-00001', 2, 3);
  Logger.log('テスト3 (3商品の3番目): ' + test3 + ' (期待値: SKU-00001-03)');

  const test4 = formatSKU('SKU-00001', 0, 1);
  Logger.log('テスト4 (1商品のみ): ' + test4 + ' (期待値: SKU-00001)');

  return {
    test1: test1,
    test2: test2,
    test3: test3,
    test4: test4
  };
}
