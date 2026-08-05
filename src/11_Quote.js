/**
 * 見積書管理ロジック
 * Phase 2: ERP統合 - 見積書発行機能
 */

// ============================================================
// 1. createQuote(quoteData) - 見積書を作成
// ============================================================

/**
 * 見積書を作成する関数
 * @param {Object} quoteData - 見積書データ
 * @param {string} quoteData.dealId - 商談ID（LDI-00001）
 * @param {string} quoteData.customerId - 顧客ID（CT-00001）
 * @param {string} quoteData.customerName - 顧客名
 * @param {string} quoteData.currency - 通貨（JPY/USD/EUR）
 * @param {Array} quoteData.items - 商品リスト
 * @param {string} quoteData.deliveryCountry - 配送先国
 * @param {string} quoteData.deliveryAddress - 配送先住所
 * @param {string} quoteData.notes - 備考
 * @param {string} quoteData.validUntil - 有効期限（YYYY-MM-DD）
 * @param {string} quoteData.creatorId - 作成者ID（オプション）
 * @param {string} quoteData.creatorName - 作成者名（オプション）
 * @returns {Object} { success, quoteId, message }
 */
function createQuote(quoteData) {
  try {
    Logger.log('見積書作成開始: ' + JSON.stringify(quoteData));

    // 必須パラメータチェック
    if (!quoteData.dealId || !quoteData.customerId || !quoteData.customerName) {
      throw new Error('必須パラメータが不足しています（dealId, customerId, customerName）');
    }

    if (!quoteData.items || quoteData.items.length === 0) {
      throw new Error('商品が指定されていません');
    }

    // スプレッドシート取得
    const ss = getSpreadsheet();
    const quotesSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTES);
    const quoteItemsSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTE_ITEMS);

    if (!quotesSheet || !quoteItemsSheet) {
      throw new Error('見積書管理シートまたは見積書明細シートが見つかりません');
    }

    // 1. QuoteID生成（QT-00001形式）
    const quoteId = generateQuoteId(quotesSheet);
    Logger.log('生成されたQuoteID: ' + quoteId);

    // 2. 商品小計計算
    let subtotal = 0;
    quoteData.items.forEach(item => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      subtotal += quantity * unitPrice;
    });
    Logger.log('商品小計: ' + subtotal);

    // 3. 配送料計算（13_Shipping.js依存、未実装の場合は0円）
    let shippingFee = 0;
    try {
      if (typeof calculateShippingFee === 'function') {
        // 配送料計算関数が存在する場合
        const totalWeight = quoteData.items.reduce((sum, item) => {
          return sum + (Number(item.weight) || 0) * (Number(item.quantity) || 0);
        }, 0);

        shippingFee = calculateShippingFee({
          country: quoteData.deliveryCountry,
          weight: totalWeight,
          currency: quoteData.currency || 'JPY'
        });
        Logger.log('配送料: ' + shippingFee);
      } else {
        Logger.log('警告: calculateShippingFee関数が未実装のため、配送料を0円とします');
      }
    } catch (e) {
      Logger.log('警告: 配送料計算エラー: ' + e.message + ' - 配送料を0円とします');
    }

    // 4. 合計金額計算
    const totalAmount = subtotal + shippingFee;
    Logger.log('合計金額: ' + totalAmount);

    // 5. 見積書管理シートに追記
    const now = new Date();
    const validUntil = quoteData.validUntil ? new Date(quoteData.validUntil) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // デフォルト30日後

    const quoteRow = [
      quoteId,                                    // 1: 見積書ID
      quoteData.dealId,                           // 2: 商談ID
      quoteData.customerId,                       // 3: 顧客ID
      quoteData.customerName,                     // 4: 顧客名
      now,                                        // 5: 作成日
      validUntil,                                 // 6: 有効期限
      quoteData.currency || 'JPY',                // 7: 通貨
      subtotal,                                   // 8: 商品小計
      shippingFee,                                // 9: 配送料
      totalAmount,                                // 10: 合計金額
      CONFIG.QUOTE_STATUS.DRAFT,                  // 11: ステータス（下書き）
      quoteData.deliveryCountry || '',            // 12: 配送先国
      quoteData.deliveryAddress || '',            // 13: 配送先住所
      quoteData.notes || '',                      // 14: 備考
      '',                                         // 15: PDFリンク（後で設定）
      quoteData.creatorId || '',                  // 16: 作成者ID
      quoteData.creatorName || '',                // 17: 作成者名
      '',                                         // 18: 送付日
      '',                                         // 19: 承認日
      now,                                        // 20: 更新日
      '',                                         // 21: 請求書ID
      '',                                         // 22: 請求書変換日
      ''                                          // 23: メモ
    ];

    quotesSheet.appendRow(quoteRow);
    Logger.log('見積書管理シートに追記完了');

    // 6. 見積書明細シートに各商品を追記
    quoteData.items.forEach((item, index) => {
      const itemId = generateQuoteItemId(quoteItemsSheet);
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const itemSubtotal = quantity * unitPrice;

      const itemRow = [
        itemId,                                   // 1: 明細ID
        quoteId,                                  // 2: 見積書ID
        item.productId || '',                     // 3: 商品ID
        item.productName || '',                   // 4: 商品名（英語）
        item.productNameJp || '',                 // 5: 商品名（日本語）
        item.category || '',                      // 6: カテゴリ
        item.condition || '',                     // 7: 状態
        quantity,                                 // 8: 数量
        unitPrice,                                // 9: 単価
        itemSubtotal,                             // 10: 小計
        Number(item.weight) || 0,                 // 11: 重量（kg）
        item.mark || '',                          // 12: マーク
        item.releaseDate || '',                   // 13: 発売日
        item.stockQuantity || '',                 // 14: 在庫数
        item.itemNotes || ''                      // 15: 備考
      ];

      quoteItemsSheet.appendRow(itemRow);
      Logger.log('商品明細追加: ' + (index + 1) + '/' + quoteData.items.length);
    });

    // 在庫確認（14_StockSync.js依存、警告のみ）
    try {
      if (typeof checkStockAvailability === 'function') {
        quoteData.items.forEach(item => {
          const stockCheck = checkStockAvailability(item.productId, item.quantity);
          if (!stockCheck.available) {
            Logger.log('警告: 商品 ' + item.productName + ' の在庫が不足しています（必要: ' + item.quantity + ', 在庫: ' + stockCheck.currentStock + '）');
          }
        });
      }
    } catch (e) {
      Logger.log('在庫確認をスキップ: ' + e.message);
    }

    Logger.log('見積書作成完了: ' + quoteId);

    return {
      success: true,
      quoteId: quoteId,
      message: '見積書を作成しました',
      data: {
        quoteId: quoteId,
        subtotal: subtotal,
        shippingFee: shippingFee,
        totalAmount: totalAmount,
        itemCount: quoteData.items.length
      }
    };

  } catch (error) {
    Logger.log('見積書作成エラー: ' + error.message);
    return {
      success: false,
      message: '見積書の作成に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 2. getQuote(quoteId) - 見積書を取得
// ============================================================

/**
 * 見積書を取得する関数
 * @param {string} quoteId - 見積書ID（QT-00001）
 * @returns {Object} 見積書データ
 */
function getQuote(quoteId) {
  try {
    Logger.log('見積書取得開始: ' + quoteId);

    if (!quoteId) {
      throw new Error('見積書IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const quotesSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTES);
    const quoteItemsSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTE_ITEMS);

    if (!quotesSheet || !quoteItemsSheet) {
      throw new Error('見積書管理シートまたは見積書明細シートが見つかりません');
    }

    // 1. 見積書管理シートから検索
    const quotesData = quotesSheet.getDataRange().getValues();
    const quotesHeaders = quotesData[0];
    const quoteIdIndex = quotesHeaders.indexOf('見積書ID');

    if (quoteIdIndex === -1) {
      throw new Error('見積書IDカラムが見つかりません');
    }

    let quoteRow = null;
    let quoteRowIndex = -1;

    for (let i = 1; i < quotesData.length; i++) {
      if (quotesData[i][quoteIdIndex] === quoteId) {
        quoteRow = quotesData[i];
        quoteRowIndex = i;
        break;
      }
    }

    if (!quoteRow) {
      throw new Error('見積書が見つかりません: ' + quoteId);
    }

    // 見積書データを構築
    const quote = {};
    quotesHeaders.forEach((header, index) => {
      quote[header] = quoteRow[index];
    });

    // 2. 見積書明細シートから該当商品を取得
    const itemsData = quoteItemsSheet.getDataRange().getValues();
    const itemsHeaders = itemsData[0];
    const itemQuoteIdIndex = itemsHeaders.indexOf('見積書ID');

    const items = [];
    for (let i = 1; i < itemsData.length; i++) {
      if (itemsData[i][itemQuoteIdIndex] === quoteId) {
        const item = {};
        itemsHeaders.forEach((header, index) => {
          item[header] = itemsData[i][index];
        });
        items.push(item);
      }
    }

    quote.items = items;

    Logger.log('見積書取得完了: ' + quoteId + '（商品数: ' + items.length + '）');

    return {
      success: true,
      quote: quote,
      rowIndex: quoteRowIndex
    };

  } catch (error) {
    Logger.log('見積書取得エラー: ' + error.message);
    return {
      success: false,
      message: '見積書の取得に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 3. updateQuote(quoteId, updates) - 見積書を更新
// ============================================================

/**
 * 見積書を更新する関数
 * @param {string} quoteId - 見積書ID（QT-00001）
 * @param {Object} updates - 更新データ
 * @returns {Object} { success, message }
 */
function updateQuote(quoteId, updates) {
  try {
    Logger.log('見積書更新開始: ' + quoteId);
    Logger.log('更新内容: ' + JSON.stringify(updates));

    if (!quoteId) {
      throw new Error('見積書IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const quotesSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTES);

    if (!quotesSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // 見積書を検索
    const quotesData = quotesSheet.getDataRange().getValues();
    const quotesHeaders = quotesData[0];
    const quoteIdIndex = quotesHeaders.indexOf('見積書ID');
    const statusIndex = quotesHeaders.indexOf('ステータス');
    const updateDateIndex = quotesHeaders.indexOf('更新日');

    if (quoteIdIndex === -1) {
      throw new Error('見積書IDカラムが見つかりません');
    }

    let targetRowIndex = -1;
    let currentStatus = '';

    for (let i = 1; i < quotesData.length; i++) {
      if (quotesData[i][quoteIdIndex] === quoteId) {
        targetRowIndex = i + 1; // シートの行番号（1-indexed）
        currentStatus = quotesData[i][statusIndex];
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('見積書が見つかりません: ' + quoteId);
    }

    // ステータス更新時のバリデーション
    if (updates['ステータス']) {
      const newStatus = updates['ステータス'];
      const validStatuses = [
        CONFIG.QUOTE_STATUS.DRAFT,
        CONFIG.QUOTE_STATUS.SENT,
        CONFIG.QUOTE_STATUS.APPROVED,
        CONFIG.QUOTE_STATUS.REJECTED,
        CONFIG.QUOTE_STATUS.EXPIRED
      ];

      if (!validStatuses.includes(newStatus)) {
        throw new Error('無効なステータスです: ' + newStatus);
      }

      // ステータス遷移チェック
      if (currentStatus === CONFIG.QUOTE_STATUS.APPROVED && newStatus !== CONFIG.QUOTE_STATUS.APPROVED) {
        throw new Error('承認済みの見積書は変更できません');
      }

      if (currentStatus === CONFIG.QUOTE_STATUS.REJECTED && newStatus !== CONFIG.QUOTE_STATUS.REJECTED) {
        Logger.log('警告: 却下済みの見積書のステータスを変更します');
      }

      // 送付日を自動設定
      if (newStatus === CONFIG.QUOTE_STATUS.SENT && !updates['送付日']) {
        updates['送付日'] = new Date();
      }

      // 承認日を自動設定
      if (newStatus === CONFIG.QUOTE_STATUS.APPROVED && !updates['承認日']) {
        updates['承認日'] = new Date();
      }
    }

    // 更新処理
    Object.keys(updates).forEach(key => {
      const colIndex = quotesHeaders.indexOf(key);
      if (colIndex !== -1) {
        quotesSheet.getRange(targetRowIndex, colIndex + 1).setValue(updates[key]);
        Logger.log('更新: ' + key + ' = ' + updates[key]);
      } else {
        Logger.log('警告: 列が見つかりません: ' + key);
      }
    });

    // 更新日を自動設定
    if (updateDateIndex !== -1) {
      quotesSheet.getRange(targetRowIndex, updateDateIndex + 1).setValue(new Date());
    }

    Logger.log('見積書更新完了: ' + quoteId);

    return {
      success: true,
      message: '見積書を更新しました'
    };

  } catch (error) {
    Logger.log('見積書更新エラー: ' + error.message);
    return {
      success: false,
      message: '見積書の更新に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 4. getQuotesByDeal(dealId) - 商談別の見積一覧を取得
// ============================================================

/**
 * 商談別の見積一覧を取得する関数
 * @param {string} dealId - 商談ID（LDI-00001）
 * @returns {Object} { success, quotes }
 */
function getQuotesByDeal(dealId) {
  try {
    Logger.log('商談別見積一覧取得開始: ' + dealId);

    if (!dealId) {
      throw new Error('商談IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const quotesSheet = ss.getSheetByName(CONFIG.SHEETS.QUOTES);

    if (!quotesSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // 見積書管理シートから検索
    const quotesData = quotesSheet.getDataRange().getValues();
    const quotesHeaders = quotesData[0];
    const dealIdIndex = quotesHeaders.indexOf('商談ID');

    if (dealIdIndex === -1) {
      throw new Error('商談IDカラムが見つかりません');
    }

    const quotes = [];

    for (let i = 1; i < quotesData.length; i++) {
      if (quotesData[i][dealIdIndex] === dealId) {
        const quote = {};
        quotesHeaders.forEach((header, index) => {
          quote[header] = quotesData[i][index];
        });
        quotes.push(quote);
      }
    }

    Logger.log('商談別見積一覧取得完了: ' + dealId + '（件数: ' + quotes.length + '）');

    return {
      success: true,
      quotes: quotes,
      count: quotes.length
    };

  } catch (error) {
    Logger.log('商談別見積一覧取得エラー: ' + error.message);
    return {
      success: false,
      message: '見積一覧の取得に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 5. convertQuoteToInvoice(quoteId) - 見積書を請求書に変換
// ============================================================

/**
 * 見積書を請求書に変換する関数（Phase 2-2で実装予定）
 * @param {string} quoteId - 見積書ID（QT-00001）
 * @returns {Object} { success, invoiceId, message }
 */
function convertQuoteToInvoice(quoteId) {
  try {
    Logger.log('見積書→請求書変換（スタブ）: ' + quoteId);

    // スタブ実装
    // TODO: Phase 2-2で実装
    // - 見積書のステータスが「承認済み」であることを確認
    // - 請求書を作成（12_Invoice.jsのcreateInvoice()を呼び出す）
    // - 見積書に請求書IDを設定
    // - 見積書の請求書変換日を設定

    return {
      success: false,
      message: '見積書→請求書変換機能はPhase 2-2で実装予定です'
    };

  } catch (error) {
    Logger.log('見積書→請求書変換エラー: ' + error.message);
    return {
      success: false,
      message: '見積書→請求書変換に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 6. generateQuotePDF(quoteId) - PDF生成
// ============================================================

/**
 * PDF生成（Phase 4で実装予定、スタブのみ）
 * @param {string} quoteId - 見積書ID（QT-00001）
 * @returns {Object} { success, pdfUrl, message }
 */
function generateQuotePDF(quoteId) {
  try {
    Logger.log('見積書PDF生成（スタブ）: ' + quoteId);

    // スタブ実装
    // TODO: Phase 4で実装
    // - 見積書データを取得
    // - Google Docsテンプレートを使用してPDFを生成
    // - Google Driveに保存
    // - 見積書管理シートにPDFリンクを設定

    return {
      success: false,
      message: 'PDF生成機能はPhase 4で実装予定です'
    };

  } catch (error) {
    Logger.log('見積書PDF生成エラー: ' + error.message);
    return {
      success: false,
      message: 'PDF生成に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 見積書IDを生成（QT-00001形式、ゼロパディング5桁）
 * @param {Sheet} sheet - 見積書管理シート
 * @returns {string} 見積書ID
 */
function generateQuoteId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;

  // 既存のIDから最大番号を取得
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]); // 見積書IDは1列目
    if (id.startsWith('QT-')) {
      const num = parseInt(id.substring(3));
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // 次の番号を生成
  const nextNum = maxNum + 1;
  return 'QT-' + String(nextNum).padStart(5, '0');
}

/**
 * 見積書明細IDを生成（QTI-00001形式、ゼロパディング5桁）
 * @param {Sheet} sheet - 見積書明細シート
 * @returns {string} 明細ID
 */
function generateQuoteItemId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;

  // 既存のIDから最大番号を取得
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]); // 明細IDは1列目
    if (id.startsWith('QTI-')) {
      const num = parseInt(id.substring(4));
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // 次の番号を生成
  const nextNum = maxNum + 1;
  return 'QTI-' + String(nextNum).padStart(5, '0');
}

/**
 * ゼロパディング関数（汎用）
 * @param {number} num - 数値
 * @param {number} length - 桁数
 * @returns {string} ゼロパディングされた文字列
 */
function zeroPad(num, length) {
  return String(num).padStart(length, '0');
}

// ============================================================
// テスト用関数（開発用）
// ============================================================

/**
 * 見積書作成テスト
 */
function testCreateQuote() {
  const testData = {
    dealId: 'LDI-00001',
    customerId: 'CT-00001',
    customerName: 'ABC Trading',
    currency: 'JPY',
    items: [
      {
        productId: 'PRD-00001',
        productName: 'Pokemon Card Box',
        productNameJp: 'ポケモンカードボックス',
        category: 'Pokemon',
        condition: 'Sealed',
        quantity: 10,
        unitPrice: 10000,
        weight: 0.5
      },
      {
        productId: 'PRD-00002',
        productName: 'One Piece Card Box',
        productNameJp: 'ワンピースカードボックス',
        category: 'One Piece',
        condition: 'Sealed',
        quantity: 5,
        unitPrice: 8000,
        weight: 0.5
      }
    ],
    deliveryCountry: 'United States',
    deliveryAddress: '123 Main St, New York, NY 10001',
    notes: 'テスト見積書',
    validUntil: '2026-02-23',
    creatorId: 'EMP-001',
    creatorName: '山田太郎'
  };

  const result = createQuote(testData);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 見積書取得テスト
 */
function testGetQuote() {
  const quoteId = 'QT-00001';
  const result = getQuote(quoteId);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 見積書更新テスト
 */
function testUpdateQuote() {
  const quoteId = 'QT-00001';
  const updates = {
    'ステータス': CONFIG.QUOTE_STATUS.SENT,
    'メモ': 'テスト更新'
  };
  const result = updateQuote(quoteId, updates);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 商談別見積一覧取得テスト
 */
function testGetQuotesByDeal() {
  const dealId = 'LDI-00001';
  const result = getQuotesByDeal(dealId);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}
