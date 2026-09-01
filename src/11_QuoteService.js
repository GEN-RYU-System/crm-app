/**
 * 見積もり管理サービス
 *
 * 機能:
 * - 見積書ID自動採番
 * - 見積もり保存
 * - 見積もり読み込み
 * - 見積もり一覧取得
 */

/**
 * 見積書ID自動採番
 * @return {string} QT-00001形式のID
 */
function generateQuoteId() {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // gid=1116182608のシートを検索
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません (gid: ' + CONFIG.QUOTE_HISTORY.GID + ')');
    }

    // 既存の見積書IDを取得
    const lastRow = quoteSheet.getLastRow();
    if (lastRow <= 1) {
      // データがない場合は QT-00001 から開始
      return 'QT-00001';
    }

    // 見積書ID列（A列 = 0）のデータを取得
    const quoteIds = quoteSheet.getRange(2, 1, lastRow - 1, 1).getValues();

    // 最大の番号を取得
    let maxNum = 0;
    quoteIds.forEach(row => {
      const id = row[0];
      if (id && typeof id === 'string' && id.startsWith('QT-')) {
        const num = parseInt(id.substring(3), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    // 次の番号を生成
    const nextNum = maxNum + 1;
    const nextId = 'QT-' + String(nextNum).padStart(5, '0');

    Logger.log('✅ 見積書ID生成: ' + nextId);

    return nextId;

  } catch (error) {
    Logger.log('❌ 見積書ID生成エラー: ' + error.message);
    throw error;
  }
}

/**
 * 見積もり保存
 *
 * @param {Object} quoteData 見積もりデータ
 * @return {Object} 保存結果 {success, quoteId, rowsAdded}
 */
function saveQuote(quoteData) {
  try {
    Logger.log('=== 見積もり保存開始 ===');
    Logger.log('顧客名: ' + quoteData.customerName);
    Logger.log('リードID: ' + quoteData.leadId);
    Logger.log('商品数: ' + quoteData.items.length);

    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積書管理シートを取得
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // ★ ヘッダーマッピングを取得（列順序に依存しない）
    const colMapping = getQuoteHistoryMapping(quoteSheet);
    Logger.log('列マッピング取得完了: ' + Object.keys(colMapping).length + '列');

    // 見積書ID生成
    const quoteId = generateQuoteId();

    // 現在のユーザー情報取得
    const userEmail = resolveCurrentUserEmail();

    // 作成日・有効期限
    const createdDate = new Date();
    const expiryDate = new Date(createdDate);
    expiryDate.setDate(expiryDate.getDate() + 30); // 30日後

    // 商品明細データを行に変換（ヘッダー名ベース）
    const rows = [];
    const totalColumns = Object.keys(colMapping).length;

    quoteData.items.forEach((item, index) => {
      const isFirstRow = index === 0;

      // 商品マークと商品英語名を分離（新形式対応 + 後方互換性）
      let productMark = item.productMark || '';
      let productEnTitle = item.productEnTitle || '';

      // 旧形式データの場合（productNameのみ存在）
      if (!productMark && !productEnTitle && item.productName) {
        const firstHyphenIndex = item.productName.indexOf('-');
        if (firstHyphenIndex > 0) {
          productMark = item.productName.substring(0, firstHyphenIndex);
          productEnTitle = item.productName.substring(firstHyphenIndex + 1);
        } else {
          productEnTitle = item.productName;
        }
      }

      // ★ 列番号ではなくヘッダー名でデータを構築
      const row = new Array(totalColumns).fill('');
      row[colMapping['見積書ID'] - 1] = quoteId;
      row[colMapping['customer_name'] - 1] = quoteData.customerName || '';
      row[colMapping['lead_id'] - 1] = quoteData.leadId || '';
      row[colMapping['カテゴリ'] - 1] = item.category || '';
      row[colMapping['商品マーク'] - 1] = productMark;
      row[colMapping['商品英語名'] - 1] = productEnTitle;
      row[colMapping['コンディション'] - 1] = item.condition || '';
      row[colMapping['数量'] - 1] = item.quantity || 0;
      row[colMapping['重量'] - 1] = item.weight || 0;
      row[colMapping['単価'] - 1] = item.unitPrice || 0;
      row[colMapping['小計'] - 1] = item.subtotal || 0;

      // 1行目のみ設定する項目
      if (isFirstRow) {
        row[colMapping['Sub Total'] - 1] = quoteData.subtotal || 0;
        row[colMapping['shipping'] - 1] = quoteData.shipping || 0;
        row[colMapping['Total'] - 1] = quoteData.total || 0;
        row[colMapping['country'] - 1] = quoteData.country || '';
        row[colMapping['発送方法'] - 1] = quoteData.shippingMethod || '';
        row[colMapping['総重量'] - 1] = quoteData.totalWeight || 0;
        row[colMapping['支払い方法'] - 1] = quoteData.paymentMethod || '';
        row[colMapping['為替レート'] - 1] = quoteData.exchangeRate || 0;
        row[colMapping['作成日'] - 1] = createdDate;
        row[colMapping['有効期限'] - 1] = expiryDate;
        row[colMapping['sales_assignee_name'] - 1] = quoteData.salesRep || userEmail;
        row[colMapping['assignee_id'] - 1] = quoteData.salesRepId || userEmail;
        row[colMapping['メモ'] - 1] = quoteData.memo || '';
      }

      rows.push(row);
    });

    // シートに追加
    const lastRow = quoteSheet.getLastRow();
    const startRow = lastRow + 1;
    quoteSheet.getRange(startRow, 1, rows.length, totalColumns).setValues(rows);

    Logger.log('✅ 見積もり保存完了');
    Logger.log('  - 見積書ID: ' + quoteId);
    Logger.log('  - 追加行数: ' + rows.length);
    Logger.log('  - 開始行: ' + startRow);

    return {
      success: true,
      quoteId: quoteId,
      rowsAdded: rows.length,
      message: '見積もりを保存しました'
    };

  } catch (error) {
    Logger.log('❌ 見積もり保存エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もり読み込み（ID指定）
 *
 * @param {string} quoteId 見積書ID
 * @return {Object} 見積もりデータ
 */
function getQuoteById(quoteId) {
  try {
    Logger.log('=== 見積もり読み込み ===');
    Logger.log('見積書ID: ' + quoteId);

    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積書管理シートを取得
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // 全データを取得
    const lastRow = quoteSheet.getLastRow();
    if (lastRow <= 1) {
      return { success: false, message: 'データが見つかりません' };
    }

    // ★ ヘッダーマッピングを取得
    const colMapping = getQuoteHistoryMapping(quoteSheet);
    const totalColumns = Object.keys(colMapping).length;

    const data = quoteSheet.getRange(2, 1, lastRow - 1, totalColumns).getValues();

    // 該当する見積書IDの行を抽出（見積書ID列から検索）
    const quoteIdCol = colMapping['見積書ID'] - 1;  // 0-indexed
    const quoteRows = data.filter(row => row[quoteIdCol] === quoteId);

    if (quoteRows.length === 0) {
      return { success: false, message: '見積書が見つかりません' };
    }

    // 1行目（ヘッダー情報）
    const firstRow = quoteRows[0];

    // ★ ヘッダー名ベースで商品明細を構築
    const items = quoteRows.map(row => ({
      category: row[colMapping['カテゴリ'] - 1],
      productMark: row[colMapping['商品マーク'] - 1],
      productEnTitle: row[colMapping['商品英語名'] - 1],
      condition: row[colMapping['コンディション'] - 1],
      quantity: row[colMapping['数量'] - 1],
      weight: row[colMapping['重量'] - 1],
      unitPrice: row[colMapping['単価'] - 1],
      subtotal: row[colMapping['小計'] - 1]
    }));

    // ★ ヘッダー名ベースで見積もりデータを構築
    const quoteData = {
      quoteId: quoteId,
      customerName: firstRow[colMapping['customer_name'] - 1],
      leadId: firstRow[colMapping['lead_id'] - 1],
      items: items,
      subtotal: firstRow[colMapping['Sub Total'] - 1],
      shipping: firstRow[colMapping['shipping'] - 1],
      total: firstRow[colMapping['Total'] - 1],
      country: firstRow[colMapping['country'] - 1],
      shippingMethod: firstRow[colMapping['発送方法'] - 1],
      totalWeight: firstRow[colMapping['総重量'] - 1],
      paymentMethod: firstRow[colMapping['支払い方法'] - 1],
      exchangeRate: firstRow[colMapping['為替レート'] - 1],
      createdDate: firstRow[colMapping['作成日'] - 1],
      expiryDate: firstRow[colMapping['有効期限'] - 1],
      salesRep: firstRow[colMapping['sales_assignee_name'] - 1],
      salesRepId: firstRow[colMapping['assignee_id'] - 1],
      memo: firstRow[colMapping['メモ'] - 1]
    };

    Logger.log('✅ 見積もり読み込み完了');
    Logger.log('  - 商品数: ' + items.length);

    return {
      success: true,
      quote: quoteData
    };

  } catch (error) {
    Logger.log('❌ 見積もり読み込みエラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もり一覧取得
 *
 * @param {Object} options オプション {limit, offset, leadId}
 * @return {Object} 見積もり一覧
 */
function getAllQuotes(options) {
  options = options || {};
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const leadId = options.leadId || null;

  try {
    Logger.log('=== 見積もり一覧取得 ===');

    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積書管理シートを取得
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // 全データを取得
    const lastRow = quoteSheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, quotes: [], totalCount: 0 };
    }

    // ★ ヘッダーマッピングを取得
    const colMapping = getQuoteHistoryMapping(quoteSheet);
    const totalColumns = Object.keys(colMapping).length;

    const data = quoteSheet.getRange(2, 1, lastRow - 1, totalColumns).getValues();

    // 見積書IDごとにグループ化（1行目のみ取得）
    const quoteMap = {};
    const quoteIdCol = colMapping['見積書ID'] - 1;
    const leadIdCol = colMapping['lead_id'] - 1;

    data.forEach(row => {
      const quoteId = row[quoteIdCol];
      if (!quoteMap[quoteId]) {
        // リードIDフィルタ
        if (leadId && row[leadIdCol] !== leadId) {
          return;
        }

        // ★ ヘッダー名ベースでデータを取得
        quoteMap[quoteId] = {
          quoteId: quoteId,
          customerName: row[colMapping['customer_name'] - 1],
          leadId: row[leadIdCol],
          itemCount: 1,
          subtotal: row[colMapping['Sub Total'] - 1],
          shipping: row[colMapping['shipping'] - 1],
          total: row[colMapping['Total'] - 1],
          country: row[colMapping['country'] - 1],
          createdDate: row[colMapping['作成日'] - 1],
          expiryDate: row[colMapping['有効期限'] - 1],
          salesRep: row[colMapping['sales_assignee_name'] - 1]
        };
      } else {
        quoteMap[quoteId].itemCount++;
      }
    });

    // 配列に変換
    const quotes = Object.values(quoteMap);

    // 作成日で降順ソート
    quotes.sort((a, b) => {
      const dateA = a.createdDate ? new Date(a.createdDate) : new Date(0);
      const dateB = b.createdDate ? new Date(b.createdDate) : new Date(0);
      return dateB - dateA;
    });

    // ページネーション
    const paginatedQuotes = quotes.slice(offset, offset + limit);

    Logger.log('✅ 見積もり一覧取得完了');
    Logger.log('  - 総数: ' + quotes.length);
    Logger.log('  - 取得数: ' + paginatedQuotes.length);

    return {
      success: true,
      quotes: paginatedQuotes,
      totalCount: quotes.length
    };

  } catch (error) {
    Logger.log('❌ 見積もり一覧取得エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もりIDからPDF URLを取得
 * @param {string} quoteId - 見積書ID
 * @returns {Object} { success: boolean, pdfUrl: string | null }
 */
function getQuotePDFUrl(quoteId) {
  try {
    Logger.log('=== 見積もりPDF URL取得: ' + quoteId);

    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積書管理シートを取得
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // ヘッダーマッピングを取得
    const colMapping = getQuoteHistoryMapping(quoteSheet);
    const lastRow = quoteSheet.getLastRow();

    if (lastRow <= 1) {
      return { success: true, pdfUrl: null };
    }

    const quoteIdCol = colMapping['見積書ID'];
    const pdfUrlCol = colMapping['pdf_url'];
    if (!pdfUrlCol) throw new Error('PDF_URL_COLUMN_NOT_FOUND');

    // 見積書IDでデータを検索（最初の行のみ）
    const data = quoteSheet.getRange(2, 1, lastRow - 1, Math.max(quoteIdCol, pdfUrlCol)).getValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][quoteIdCol - 1] === quoteId) {
        const pdfUrl = data[i][pdfUrlCol - 1];
        Logger.log('✅ PDF URL取得成功: ' + (pdfUrl || '（未設定）'));
        return {
          success: true,
          pdfUrl: pdfUrl || null
        };
      }
    }

    Logger.log('⚠️ 見積書IDが見つかりません: ' + quoteId);
    return { success: true, pdfUrl: null };

  } catch (error) {
    Logger.log('❌ PDF URL取得エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 見積もりIDにPDF URLを記録
 * @param {string} quoteId - 見積書ID
 * @param {string} pdfUrl - PDF URL
 * @returns {Object} { success: boolean, message: string }
 */
function updateQuotePDFUrl(quoteId, pdfUrl) {
  try {
    Logger.log('=== 見積もりPDF URL更新: ' + quoteId);
    Logger.log('  - URL: ' + pdfUrl);

    const ss = getSpreadsheet();
    const sheets = ss.getSheets();

    // 見積書管理シートを取得
    let quoteSheet = null;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === CONFIG.QUOTE_HISTORY.GID) {
        quoteSheet = sheets[i];
        break;
      }
    }

    if (!quoteSheet) {
      throw new Error('見積書管理シートが見つかりません');
    }

    // ヘッダーマッピングを取得
    const colMapping = getQuoteHistoryMapping(quoteSheet);
    const lastRow = quoteSheet.getLastRow();

    if (lastRow <= 1) {
      throw new Error('見積書管理シートにデータがありません');
    }

    const quoteIdCol = colMapping['見積書ID'];
    const pdfUrlCol = colMapping['pdf_url'];
    if (!pdfUrlCol) throw new Error('PDF_URL_COLUMN_NOT_FOUND');

    // 見積書IDでデータを検索して更新
    const quoteIdRange = quoteSheet.getRange(2, quoteIdCol, lastRow - 1, 1);
    const quoteIds = quoteIdRange.getValues();

    let updated = false;
    for (let i = 0; i < quoteIds.length; i++) {
      if (quoteIds[i][0] === quoteId) {
        // 該当する全ての行にPDF URLを設定
        quoteSheet.getRange(i + 2, pdfUrlCol).setValue(pdfUrl);
        updated = true;
      }
    }

    if (updated) {
      Logger.log('✅ PDF URL更新成功');
      return {
        success: true,
        message: 'PDF URLを更新しました'
      };
    } else {
      Logger.log('⚠️ 見積書IDが見つかりません: ' + quoteId);
      return {
        success: false,
        message: '見積書IDが見つかりません'
      };
    }

  } catch (error) {
    Logger.log('❌ PDF URL更新エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
