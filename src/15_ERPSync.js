/**
 * ERP連携ロジック
 * Phase 3: CRM → ERP データ連携機能
 *
 * 【主要機能】
 * 1. exportToERP(invoiceId) - 請求書データをERPに出力
 * 2. getERPSpreadsheet() - ERPスプレッドシート取得
 * 3. handleERPError(error, context, invoiceId) - エラーハンドリング
 *
 * 【無限ループ防止】
 * ERP側のonEdit()トリガーで3重チェックを実装（このファイルではなくERP側）
 * - チェック1: IMPORTRANGE除外（user === ''）
 * - チェック2: 対象シート限定（📋仕入れリスト）
 * - チェック3: 同期済みフラグチェック
 */

// ============================================================
// 1. exportToERP(invoiceId) - 請求書データをERPに出力
// ============================================================

/**
 * 請求書データをERPに出力する関数
 * @param {string} invoiceId - 請求書ID（例: 'INV-00001'）
 * @returns {Object} 処理結果
 */
function exportToERP(invoiceId) {
  const startTime = new Date();

  try {
    Logger.log('=== ERP出力開始 ===');
    Logger.log('請求書ID: ' + invoiceId);

    // 1. パラメータチェック
    if (!invoiceId) {
      throw new Error('請求書IDが指定されていません');
    }

    // 2. CRM側から請求書データを取得
    const invoiceResult = getInvoice(invoiceId);
    if (!invoiceResult.success) {
      throw new Error('請求書の取得に失敗しました: ' + invoiceResult.message);
    }

    const invoice = invoiceResult.invoice;
    Logger.log('請求書データ取得完了: ' + invoice['請求書番号']);

    // 3. CRM側から請求書明細を取得
    const ss = getSpreadsheet();
    const invoiceItemsSheet = ss.getSheetByName(CONFIG.SHEETS.INVOICE_ITEMS);

    if (!invoiceItemsSheet) {
      throw new Error('請求書明細シートが見つかりません');
    }

    const itemsData = invoiceItemsSheet.getDataRange().getValues();
    const itemsHeaders = itemsData[0];
    const itemInvoiceIdIndex = itemsHeaders.indexOf('請求書ID');

    const items = [];
    for (let i = 1; i < itemsData.length; i++) {
      if (itemsData[i][itemInvoiceIdIndex] === invoiceId) {
        const item = {};
        itemsHeaders.forEach((header, index) => {
          item[header] = itemsData[i][index];
        });
        items.push(item);
      }
    }

    if (items.length === 0) {
      throw new Error('請求書明細が見つかりません: ' + invoiceId);
    }

    Logger.log('請求書明細取得完了: ' + items.length + '件');

    // 4. ERPスプレッドシートを取得
    const erpSs = getERPSpreadsheet();
    if (!erpSs) {
      throw new Error('ERPスプレッドシートの取得に失敗しました');
    }

    const erpSpreadsheetId = erpSs.getId();
    Logger.log('ERPスプレッドシート取得完了: ' + erpSpreadsheetId);

    // 5. 📊売上データシートに追記
    const salesDataSheet = erpSs.getSheetByName(CONFIG.ERP.SHEETS.SALES_DATA);

    if (!salesDataSheet) {
      throw new Error('ERPの📊売上データシートが見つかりません');
    }

    // ERPヘッダー構造を取得（28列）
    const erpHeaders = salesDataSheet.getRange(1, 1, 1, 28).getValues()[0];
    Logger.log('ERPヘッダー取得完了: ' + erpHeaders.length + '列');

    // 配送料の按分計算
    const shippingFee = Number(invoice['配送料']) || 0;
    const itemCount = items.length;
    const shippingPerItem = [];

    if (itemCount > 0) {
      const baseShipping = Math.floor(shippingFee / itemCount);
      const remainder = shippingFee - (baseShipping * itemCount);

      for (let i = 0; i < itemCount; i++) {
        // 余りを最初の商品に加算
        shippingPerItem.push(baseShipping + (i < remainder ? 1 : 0));
      }
    }

    // 各商品ごとに1行ずつ売上データレコードを構築
    const salesRecords = [];

    items.forEach((item, index) => {
      const record = _buildSalesRecord(invoice, item, shippingPerItem[index] || 0);
      salesRecords.push(record);
      Logger.log('売上データレコード構築: ' + (index + 1) + '/' + itemCount);
    });

    // ERPシートに追記
    const lastRow = salesDataSheet.getLastRow();
    const targetRow = lastRow + 1;

    salesDataSheet.getRange(targetRow, 1, salesRecords.length, 28).setValues(salesRecords);
    Logger.log('ERPシートに追記完了: ' + salesRecords.length + '行（行番号: ' + targetRow + '～' + (targetRow + salesRecords.length - 1) + '）');

    // 6. CRM側の請求書にERP出力情報を記録
    const invoicesSheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);
    const invoicesData = invoicesSheet.getDataRange().getValues();
    const invoicesHeaders = invoicesData[0];
    const invoiceIdIndex = invoicesHeaders.indexOf('請求書ID');
    const erpOutputDateIndex = invoicesHeaders.indexOf('ERP出力日');
    const erpOutputFlagIndex = invoicesHeaders.indexOf('ERP出力済み');

    for (let i = 1; i < invoicesData.length; i++) {
      if (invoicesData[i][invoiceIdIndex] === invoiceId) {
        const rowNum = i + 1;

        if (erpOutputDateIndex !== -1) {
          invoicesSheet.getRange(rowNum, erpOutputDateIndex + 1).setValue(new Date());
        }

        if (erpOutputFlagIndex !== -1) {
          invoicesSheet.getRange(rowNum, erpOutputFlagIndex + 1).setValue(true);
        }

        Logger.log('CRM請求書シートにERP出力情報を記録');
        break;
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    Logger.log('=== ERP出力完了 ===');
    Logger.log('処理時間: ' + duration + '秒');

    return {
      success: true,
      invoiceId: invoiceId,
      exportedRows: salesRecords.length,
      erpSpreadsheetId: erpSpreadsheetId,
      timestamp: endTime
    };

  } catch (error) {
    Logger.log('=== ERP出力エラー ===');
    Logger.log('エラー: ' + error.message);
    Logger.log('スタックトレース: ' + error.stack);

    // エラーログを記録
    handleERPError(error, 'exportToERP', invoiceId);

    return {
      success: false,
      invoiceId: invoiceId,
      error: error.message,
      timestamp: new Date()
    };
  }
}

// ============================================================
// 2. _buildSalesRecord(invoice, item, shippingFee) - 売上データレコード構築
// ============================================================

/**
 * 売上データレコードを構築する内部関数
 * ERPの📊売上データシートのヘッダー構造（28列）に合わせてレコードを構築
 *
 * @param {Object} invoice - 請求書オブジェクト
 * @param {Object} item - 請求書明細1行
 * @param {number} shippingFee - 按分後の配送料
 * @returns {Array} 28列の配列
 * @private
 */
function _buildSalesRecord(invoice, item, shippingFee) {
  // ERPヘッダー（28列）
  // A: 取引状況請求書発行日
  // B: 取引状況ステータス
  // C: 取引状況決済方法
  // D: 取引状況通貨
  // E: 取引状況商品名
  // F: 取引状況数量
  // G: 取引状況単価
  // H: 取引状況取引先名
  // I: 取引状況運送状番号（発送前は空）
  // J: 取引状況配送料
  // K: 取引状況状態
  // L: 取引状況カテゴリ
  // M: 請求書情報請求書番号
  // N: 請求書情報KEY（ERP独自、空でOK）
  // O: 請求書情報PDFリンク
  // P: 請求書情報メモ
  // Q: 請求書情報Billing Country
  // R: 請求書情報Billing Name
  // S: 請求書情報Email
  // T: 請求書情報受注担当者
  // U: 発送情報運送状番号（発送前は空）
  // V: 発送情報発送方法（発送前は空）
  // W: 発送情報発送日（発送前は空）
  // X: 発送情報発送（チェックボックス、FALSE）
  // Y: 発送情報通知（発送前は空）
  // Z: 請求額JPY
  // AA: 請求額USD
  // AB: 入金額（初期0）

  const record = [
    invoice['請求日'] || new Date(),                     // A: 取引状況請求書発行日
    'Completed',                                          // B: 取引状況ステータス
    invoice['決済方法'] || '',                            // C: 取引状況決済方法
    invoice['通貨'] || 'JPY',                             // D: 取引状況通貨
    item['商品名（英語）'] || item['商品名（日本語）'] || '', // E: 取引状況商品名
    Number(item['数量']) || 0,                            // F: 取引状況数量
    Number(item['単価']) || 0,                            // G: 取引状況単価
    invoice['顧客名'] || '',                              // H: 取引状況取引先名
    '',                                                   // I: 取引状況運送状番号（発送前）
    shippingFee,                                          // J: 取引状況配送料（按分後）
    item['状態'] || '',                                   // K: 取引状況状態
    item['カテゴリ'] || '',                               // L: 取引状況カテゴリ
    invoice['請求書番号'] || '',                          // M: 請求書情報請求書番号
    '',                                                   // N: 請求書情報KEY（ERP独自）
    invoice['PDFリンク'] || '',                           // O: 請求書情報PDFリンク
    invoice['備考'] || '',                                // P: 請求書情報メモ
    invoice['請求先国'] || '',                            // Q: 請求書情報Billing Country
    invoice['顧客名'] || '',                              // R: 請求書情報Billing Name
    '',                                                   // S: 請求書情報Email（顧客マスタから取得する場合は追加）
    invoice['作成者名'] || '',                            // T: 請求書情報受注担当者
    '',                                                   // U: 発送情報運送状番号（発送前）
    '',                                                   // V: 発送情報発送方法（発送前）
    '',                                                   // W: 発送情報発送日（発送前）
    false,                                                // X: 発送情報発送（チェックボックス）
    '',                                                   // Y: 発送情報通知（発送前）
    _calculateJPYAmount(invoice, item, shippingFee),      // Z: 請求額JPY
    _calculateUSDAmount(invoice, item, shippingFee),      // AA: 請求額USD
    0                                                     // AB: 入金額（初期0）
  ];

  return record;
}

// ============================================================
// 3. 金額計算ヘルパー関数
// ============================================================

/**
 * JPY換算金額を計算
 * @param {Object} invoice - 請求書
 * @param {Object} item - 明細
 * @param {number} shippingFee - 配送料
 * @returns {number} JPY金額
 * @private
 */
function _calculateJPYAmount(invoice, item, shippingFee) {
  const currency = invoice['通貨'] || 'JPY';
  const quantity = Number(item['数量']) || 0;
  const unitPrice = Number(item['単価']) || 0;
  const subtotal = quantity * unitPrice + shippingFee;

  if (currency === 'JPY') {
    return subtotal;
  }

  // USD/EUR → JPY変換（為替レートは設定シートから取得）
  try {
    const exchangeRate = _getExchangeRate(currency);
    return Math.round(subtotal * exchangeRate);
  } catch (e) {
    Logger.log('為替レート取得エラー: ' + e.message + ' - JPY換算をスキップ');
    return 0;
  }
}

/**
 * USD換算金額を計算
 * @param {Object} invoice - 請求書
 * @param {Object} item - 明細
 * @param {number} shippingFee - 配送料
 * @returns {number} USD金額
 * @private
 */
function _calculateUSDAmount(invoice, item, shippingFee) {
  const currency = invoice['通貨'] || 'JPY';
  const quantity = Number(item['数量']) || 0;
  const unitPrice = Number(item['単価']) || 0;
  const subtotal = quantity * unitPrice + shippingFee;

  if (currency === 'USD') {
    return subtotal;
  }

  // JPY/EUR → USD変換（為替レートは設定シートから取得）
  try {
    const usdRate = _getExchangeRate('USD'); // JPYベースのUSDレート

    if (currency === 'JPY') {
      return Math.round((subtotal / usdRate) * 100) / 100;
    } else if (currency === 'EUR') {
      const eurRate = _getExchangeRate('EUR');
      const jpy = subtotal * eurRate;
      return Math.round((jpy / usdRate) * 100) / 100;
    }

    return 0;
  } catch (e) {
    Logger.log('為替レート取得エラー: ' + e.message + ' - USD換算をスキップ');
    return 0;
  }
}

/**
 * 為替レートを取得（設定シートから）
 * @param {string} currency - 通貨コード（USD/EUR）
 * @returns {number} 為替レート（対JPY）
 * @private
 */
function _getExchangeRate(currency) {
  const ss = getSpreadsheet();
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!settingsSheet) {
    Logger.log('警告: 設定シートが見つかりません - デフォルトレートを使用');
    // デフォルトレート
    return currency === 'USD' ? 150 : 160; // 1 USD = 150 JPY, 1 EUR = 160 JPY
  }

  const data = settingsSheet.getDataRange().getValues();
  const headers = data[0];
  const currencyIndex = headers.indexOf('通貨');
  const rateIndex = headers.indexOf('レート');

  if (currencyIndex === -1 || rateIndex === -1) {
    Logger.log('警告: 通貨またはレート列が見つかりません - デフォルトレートを使用');
    return currency === 'USD' ? 150 : 160;
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][currencyIndex]).trim() === currency) {
      const rate = Number(data[i][rateIndex]);
      if (!isNaN(rate) && rate > 0) {
        return rate;
      }
    }
  }

  Logger.log('警告: ' + currency + 'の為替レートが見つかりません - デフォルトレートを使用');
  return currency === 'USD' ? 150 : 160;
}

// ============================================================
// 4. getERPSpreadsheet() - ERPスプレッドシート取得
// ============================================================

/**
 * ERPスプレッドシートを取得する関数
 * PropertiesServiceからERP_SPREADSHEET_IDを取得、なければCONFIG.ERP.SPREADSHEET_IDをフォールバック
 *
 * @returns {Spreadsheet} ERPスプレッドシート
 */
function getERPSpreadsheet() {
  try {
    const props = PropertiesService.getScriptProperties();
    let erpId = props.getProperty('ERP_SPREADSHEET_ID');

    if (!erpId) {
      Logger.log('警告: ERP_SPREADSHEET_IDがPropertiesServiceに未設定 - CONFIG.ERPからフォールバック');
      erpId = CONFIG.ERP.SPREADSHEET_ID;
    }

    if (!erpId) {
      throw new Error('ERPスプレッドシートIDが設定されていません（PropertiesServiceまたはCONFIG.ERP）');
    }

    Logger.log('ERPスプレッドシートID: ' + erpId);
    const erpSs = SpreadsheetApp.openById(erpId);

    if (!erpSs) {
      throw new Error('ERPスプレッドシートを開けませんでした（ID: ' + erpId + '）');
    }

    Logger.log('ERPスプレッドシート取得成功: ' + erpSs.getName());
    return erpSs;

  } catch (error) {
    Logger.log('ERPスプレッドシート取得エラー: ' + error.message);
    throw new Error('ERPスプレッドシートの取得に失敗しました: ' + error.message);
  }
}

// ============================================================
// 5. handleERPError(error, context, invoiceId) - エラーハンドリング
// ============================================================

/**
 * ERPエラーハンドリング関数
 * エラーログをCRMの「ERPエラーログ」シートに記録
 *
 * @param {Error} error - エラーオブジェクト
 * @param {string} context - コンテキスト（例: 'exportToERP'）
 * @param {string} invoiceId - 請求書ID（オプション）
 * @returns {void}
 */
function handleERPError(error, context, invoiceId) {
  try {
    Logger.log('ERPエラーハンドリング開始');
    Logger.log('コンテキスト: ' + context);
    Logger.log('請求書ID: ' + (invoiceId || '不明'));
    Logger.log('エラー: ' + error.message);

    const errorLog = {
      timestamp: new Date(),
      context: context || '不明',
      invoiceId: invoiceId || '',
      errorMessage: error.message || '',
      errorStack: error.stack || '',
      user: Session.getActiveUser().getEmail()
    };

    _logError(errorLog);

    Logger.log('ERPエラーログ記録完了');

  } catch (logError) {
    Logger.log('エラーログの記録に失敗しました: ' + logError.message);
    // エラーログの記録に失敗しても処理は継続
  }
}

// ============================================================
// 6. _logError(errorLog) - エラーログ記録（内部関数）
// ============================================================

/**
 * エラーログを記録する内部関数
 * CRM側の「ERPエラーログ」シートに追記
 *
 * @param {Object} errorLog - エラーログオブジェクト
 * @param {Date} errorLog.timestamp - タイムスタンプ
 * @param {string} errorLog.context - コンテキスト
 * @param {string} errorLog.invoiceId - 請求書ID
 * @param {string} errorLog.errorMessage - エラーメッセージ
 * @param {string} errorLog.errorStack - スタックトレース
 * @param {string} errorLog.user - 実行者
 * @returns {void}
 * @private
 */
function _logError(errorLog) {
  try {
    const ss = getSpreadsheet();
    let errorLogSheet = ss.getSheetByName('ERPエラーログ');

    // シートがなければ作成
    if (!errorLogSheet) {
      Logger.log('ERPエラーログシートが存在しないため作成します');
      errorLogSheet = ss.insertSheet('ERPエラーログ');

      // ヘッダー作成
      const headers = [
        'タイムスタンプ',
        'コンテキスト',
        '請求書ID',
        'エラーメッセージ',
        'スタックトレース',
        '実行者'
      ];

      errorLogSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      errorLogSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      errorLogSheet.setFrozenRows(1);

      Logger.log('ERPエラーログシート作成完了');
    }

    // ログ行を追記
    const logRow = [
      errorLog.timestamp,
      errorLog.context,
      errorLog.invoiceId,
      errorLog.errorMessage,
      errorLog.errorStack,
      errorLog.user
    ];

    errorLogSheet.appendRow(logRow);

    Logger.log('エラーログ追記完了: 行' + errorLogSheet.getLastRow());

  } catch (e) {
    Logger.log('エラーログシートへの記録に失敗: ' + e.message);
    // エラーログの記録に失敗しても処理は継続
  }
}

// ============================================================
// 7. getInvoice(invoiceId) - 請求書取得（内部依存）
// ============================================================

/**
 * 請求書を取得する関数（内部依存、12_Invoice.jsに同等の関数が存在すると想定）
 * 12_Invoice.jsが未実装の場合、この関数を使用
 *
 * @param {string} invoiceId - 請求書ID
 * @returns {Object} { success, invoice, message }
 */
function getInvoice(invoiceId) {
  try {
    Logger.log('請求書取得開始: ' + invoiceId);

    if (!invoiceId) {
      throw new Error('請求書IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const invoicesSheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);

    if (!invoicesSheet) {
      throw new Error('請求書管理シートが見つかりません');
    }

    const invoicesData = invoicesSheet.getDataRange().getValues();
    const invoicesHeaders = invoicesData[0];
    const invoiceIdIndex = invoicesHeaders.indexOf('請求書ID');

    if (invoiceIdIndex === -1) {
      throw new Error('請求書IDカラムが見つかりません');
    }

    let invoiceRow = null;

    for (let i = 1; i < invoicesData.length; i++) {
      if (invoicesData[i][invoiceIdIndex] === invoiceId) {
        invoiceRow = invoicesData[i];
        break;
      }
    }

    if (!invoiceRow) {
      throw new Error('請求書が見つかりません: ' + invoiceId);
    }

    // 請求書オブジェクトを構築
    const invoice = {};
    invoicesHeaders.forEach((header, index) => {
      invoice[header] = invoiceRow[index];
    });

    Logger.log('請求書取得完了: ' + invoice['請求書番号']);

    return {
      success: true,
      invoice: invoice
    };

  } catch (error) {
    Logger.log('請求書取得エラー: ' + error.message);
    return {
      success: false,
      message: '請求書の取得に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// テスト用関数（開発用）
// ============================================================

/**
 * ERP出力テスト
 */
function testExportToERP() {
  const invoiceId = 'INV-00001'; // テスト用請求書ID（実際のIDに変更してください）
  const result = exportToERP(invoiceId);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * ERPスプレッドシート取得テスト
 */
function testGetERPSpreadsheet() {
  try {
    const erpSs = getERPSpreadsheet();
    Logger.log('テスト成功: ' + erpSs.getName() + ' (ID: ' + erpSs.getId() + ')');
    return {
      success: true,
      name: erpSs.getName(),
      id: erpSs.getId()
    };
  } catch (error) {
    Logger.log('テスト失敗: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * エラーハンドリングテスト
 */
function testHandleERPError() {
  const testError = new Error('これはテストエラーです');
  testError.stack = 'Test Stack Trace\nat testFunction()';

  handleERPError(testError, 'testContext', 'INV-TEST');

  Logger.log('エラーハンドリングテスト完了 - ERPエラーログシートを確認してください');

  return {
    success: true,
    message: 'エラーログを記録しました'
  };
}

/**
 * 為替レート取得テスト
 */
function testGetExchangeRate() {
  const usdRate = _getExchangeRate('USD');
  const eurRate = _getExchangeRate('EUR');

  Logger.log('USD為替レート: ' + usdRate);
  Logger.log('EUR為替レート: ' + eurRate);

  return {
    success: true,
    usdRate: usdRate,
    eurRate: eurRate
  };
}

/**
 * PropertiesServiceにERP_SPREADSHEET_IDを設定するヘルパー関数
 */
function setERPSpreadsheetId(spreadsheetId) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ERP_SPREADSHEET_ID', spreadsheetId);
    Logger.log('ERP_SPREADSHEET_IDを設定しました: ' + spreadsheetId);
    return {
      success: true,
      message: 'ERP_SPREADSHEET_IDを設定しました'
    };
  } catch (error) {
    Logger.log('設定エラー: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}
