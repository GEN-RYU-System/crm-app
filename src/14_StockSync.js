/**
 * ============================================================
 * 14_StockSync.js
 * 在庫同期ロジック
 * ============================================================
 *
 * 概要:
 * - ERPの「Stock List同期」シートから在庫データを取得
 * - 在庫確認、商品名検索、カテゴリ別フィルタリング機能を提供
 *
 * 関数一覧:
 * - getAvailableStock(): 在庫データ全件取得
 * - checkInventory(productId, quantity): 在庫確認
 * - getStockByProduct(productName): 商品名で在庫検索
 * - getStockByCategory(category): カテゴリ別在庫一覧取得
 */

/**
 * 在庫データを取得する関数
 *
 * @returns {Object} { data: [...], categories: [...] }
 *
 * 返却値の形式:
 * {
 *   data: [
 *     {
 *       category: 'Pokemon',
 *       mark: 'SV9a',
 *       enTitle: 'Product Name',
 *       jaTitle: '商品名',
 *       status: 'Stock',
 *       condition: 'Sealed',
 *       price: 10000,
 *       qty: 50,
 *       weight: 0.5,
 *       note: '',
 *       release: '2026-01-15'
 *     },
 *     // ...
 *   ],
 *   categories: ['Pokemon', 'One Piece', 'Yu-Gi-Oh']
 * }
 */
function getAvailableStock() {
  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.STOCK_LIST_SYNC;
    const sheet = ss.getSheetByName(sheetName);

    // シートが存在しない場合
    if (!sheet) {
      Logger.log('[getAvailableStock] Stock List同期シートが見つかりません: ' + sheetName);
      return {
        data: [],
        categories: [],
        error: 'Stock List同期シートが見つかりません。IMPORTRANGE設定を確認してください。'
      };
    }

    // データがない場合
    if (sheet.getLastRow() < 2) {
      Logger.log('[getAvailableStock] Stock List同期シートにデータがありません');
      return {
        data: [],
        categories: [],
        error: 'Stock List同期シートにデータがありません。'
      };
    }

    const raw = sheet.getDataRange().getValues();
    const header = raw[0].map(String);

    // ヘッダー名から列番号を特定するヘルパー
    const findHeader = (headers, targets) => {
      for (let target of targets) {
        const i = headers.findIndex(h => String(h).toLowerCase().trim() === target.toLowerCase());
        if (i !== -1) return i;
      }
      return -1;
    };

    // 列インデックスをマッピング
    const idx = {
      cat: findHeader(header, ["Category", "カテゴリ", "分類"]),
      mark: findHeader(header, ["Mark", "マーク"]),
      en: findHeader(header, ["English Title", "商品名(英)", "EN Title"]),
      ja: findHeader(header, ["Japanese Title", "商品名(日)", "JA Title", "商品名"]),
      st: findHeader(header, ["Status", "状態", "ステータス"]),
      cond: findHeader(header, ["Condition", "コンディション"]),
      pr: findHeader(header, ["Unit Price", "単価", "販売価格", "Price"]),
      qty: findHeader(header, ["Quantity", "数量", "在庫数", "Qty"]),
      note: findHeader(header, ["Note_JA", "備考", "ノート", "Note"]),
      rel: findHeader(header, ["Release Date", "発売日"]),
      weight: findHeader(header, ["Weight", "重量", "Box重量"])
    };

    // カテゴリが見つからない場合はA列(0)をデフォルトに
    if (idx.cat === -1) {
      Logger.log('[getAvailableStock] Categoryヘッダーが見つかりません。A列をデフォルトとして使用します。');
      idx.cat = 0;
    }

    const data = [];

    // 1行目はヘッダーなので、i=1 からスタート
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];

      // カテゴリがない行は無視
      if (!r[idx.cat]) continue;

      // 発売日のフォーマット処理
      let releaseDate = '-';
      if (idx.rel !== -1 && r[idx.rel]) {
        try {
          releaseDate = Utilities.formatDate(new Date(r[idx.rel]), "JST", "yyyy-MM-dd");
        } catch (e) {
          releaseDate = String(r[idx.rel]);
        }
      }

      data.push({
        category: String(r[idx.cat]).trim(),
        mark: idx.mark !== -1 ? String(r[idx.mark] || "") : "",
        enTitle: idx.en !== -1 ? String(r[idx.en] || "") : "",
        jaTitle: idx.ja !== -1 ? String(r[idx.ja] || "") : "",
        status: idx.st !== -1 ? String(r[idx.st] || "") : "",
        condition: idx.cond !== -1 ? String(r[idx.cond] || "") : "",
        price: idx.pr !== -1 ? (parseFloat(r[idx.pr]) || 0) : 0,
        qty: idx.qty !== -1 ? (parseFloat(r[idx.qty]) || 0) : 0,
        weight: idx.weight !== -1 ? (parseFloat(r[idx.weight]) || 0) : 0,
        note: idx.note !== -1 ? String(r[idx.note] || "") : "",
        release: releaseDate
      });
    }

    // カテゴリ一覧を作る（重複なし）
    const categories = [...new Set(data.map(d => d.category))].filter(c => c);

    Logger.log('[getAvailableStock] 取得成功: ' + data.length + '件のデータ、' + categories.length + 'カテゴリ');

    return {
      data: data,
      categories: categories
    };

  } catch (error) {
    Logger.log('[getAvailableStock] エラー: ' + error.message);
    return {
      data: [],
      categories: [],
      error: '在庫データの取得中にエラーが発生しました: ' + error.message
    };
  }
}

/**
 * 在庫確認関数
 *
 * @param {string} productId - 商品ID（英語名または日本語名で検索）
 * @param {number} quantity - 要求数量
 * @returns {Object} 在庫確認結果
 *
 * 返却値の形式:
 * {
 *   available: true,           // 在庫が十分か
 *   currentStock: 50,          // 現在の在庫数
 *   requestedQty: 10,          // 要求数量
 *   remainingStock: 40,        // 残り在庫数
 *   productName: 'Product Name', // 商品名
 *   productInfo: {...}         // 商品詳細情報
 * }
 */
function checkInventory(productId, quantity) {
  try {
    // 入力検証
    if (!productId) {
      return {
        available: false,
        error: '商品IDが指定されていません'
      };
    }

    if (!quantity || quantity <= 0) {
      return {
        available: false,
        error: '有効な数量を指定してください'
      };
    }

    // 在庫データを取得
    const stockData = getAvailableStock();

    if (stockData.error) {
      return {
        available: false,
        error: stockData.error
      };
    }

    if (!stockData.data || stockData.data.length === 0) {
      return {
        available: false,
        error: '在庫データが取得できませんでした'
      };
    }

    // 商品を検索（英語名または日本語名で検索）
    const product = stockData.data.find(item =>
      item.enTitle.toLowerCase().includes(productId.toLowerCase()) ||
      item.jaTitle.includes(productId) ||
      item.mark.toLowerCase() === productId.toLowerCase()
    );

    if (!product) {
      return {
        available: false,
        currentStock: 0,
        requestedQty: quantity,
        remainingStock: 0,
        productName: productId,
        error: '該当する商品が見つかりませんでした'
      };
    }

    // 在庫確認
    const currentStock = product.qty;
    const available = currentStock >= quantity;
    const remainingStock = currentStock - quantity;

    return {
      available: available,
      currentStock: currentStock,
      requestedQty: quantity,
      remainingStock: remainingStock >= 0 ? remainingStock : 0,
      productName: product.enTitle || product.jaTitle,
      productInfo: product
    };

  } catch (error) {
    Logger.log('[checkInventory] エラー: ' + error.message);
    return {
      available: false,
      error: '在庫確認中にエラーが発生しました: ' + error.message
    };
  }
}

/**
 * 商品名で在庫検索
 *
 * @param {string} productName - 商品名（英語名または日本語名、部分一致）
 * @returns {Array} 該当商品の在庫情報配列
 *
 * 使用例:
 * const results = getStockByProduct('Pokemon');
 * // => [{category: 'Pokemon', enTitle: '...', ...}, ...]
 */
function getStockByProduct(productName) {
  try {
    if (!productName) {
      Logger.log('[getStockByProduct] 商品名が指定されていません');
      return [];
    }

    // 在庫データを取得
    const stockData = getAvailableStock();

    if (stockData.error) {
      Logger.log('[getStockByProduct] ' + stockData.error);
      return [];
    }

    if (!stockData.data || stockData.data.length === 0) {
      Logger.log('[getStockByProduct] 在庫データがありません');
      return [];
    }

    // 商品名で検索（英語名・日本語名・マークで部分一致）
    const searchTerm = productName.toLowerCase();
    const results = stockData.data.filter(item =>
      item.enTitle.toLowerCase().includes(searchTerm) ||
      item.jaTitle.includes(productName) ||
      item.mark.toLowerCase().includes(searchTerm)
    );

    Logger.log('[getStockByProduct] 検索結果: ' + results.length + '件');

    return results;

  } catch (error) {
    Logger.log('[getStockByProduct] エラー: ' + error.message);
    return [];
  }
}

/**
 * カテゴリ別在庫一覧取得
 *
 * @param {string} category - カテゴリ名（完全一致）
 * @returns {Array} 該当カテゴリの在庫情報配列
 *
 * 使用例:
 * const pokemonStock = getStockByCategory('Pokemon');
 * // => [{category: 'Pokemon', enTitle: '...', ...}, ...]
 */
function getStockByCategory(category) {
  try {
    if (!category) {
      Logger.log('[getStockByCategory] カテゴリが指定されていません');
      return [];
    }

    // 在庫データを取得
    const stockData = getAvailableStock();

    if (stockData.error) {
      Logger.log('[getStockByCategory] ' + stockData.error);
      return [];
    }

    if (!stockData.data || stockData.data.length === 0) {
      Logger.log('[getStockByCategory] 在庫データがありません');
      return [];
    }

    // カテゴリでフィルタリング（完全一致）
    const results = stockData.data.filter(item =>
      item.category === category
    );

    Logger.log('[getStockByCategory] カテゴリ "' + category + '" の在庫: ' + results.length + '件');

    return results;

  } catch (error) {
    Logger.log('[getStockByCategory] エラー: ' + error.message);
    return [];
  }
}

/**
 * ============================================================
 * テスト関数
 * ============================================================
 */

/**
 * getAvailableStock()のテスト
 */
function testGetAvailableStock() {
  console.log('========================================');
  console.log('getAvailableStock() テスト');
  console.log('========================================');

  const result = getAvailableStock();

  console.log('データ件数: ' + result.data.length);
  console.log('カテゴリ一覧: ' + result.categories.join(', '));

  if (result.error) {
    console.log('エラー: ' + result.error);
  } else if (result.data.length === 0) {
    console.log('【警告】データが0件です。Stock List同期シートを確認してください。');
  } else {
    console.log('【成功】在庫データ取得成功！');
    console.log('サンプルデータ（最初の3件）:');
    result.data.slice(0, 3).forEach((item, index) => {
      console.log((index + 1) + '. ' + item.category + ' - ' + item.enTitle + ' (在庫: ' + item.qty + ')');
    });
  }

  console.log('========================================');
}

/**
 * checkInventory()のテスト
 */
function testCheckInventory() {
  console.log('========================================');
  console.log('checkInventory() テスト');
  console.log('========================================');

  // テスト1: 在庫あり
  console.log('--- テスト1: 在庫確認（存在する商品） ---');
  const stockData = getAvailableStock();
  if (stockData.data.length > 0) {
    const testProduct = stockData.data[0].enTitle || stockData.data[0].jaTitle;
    const testQty = 1;

    console.log('商品名: ' + testProduct);
    console.log('要求数量: ' + testQty);

    const result1 = checkInventory(testProduct, testQty);
    console.log('在庫あり: ' + result1.available);
    console.log('現在庫: ' + result1.currentStock);
    console.log('残り在庫: ' + result1.remainingStock);
  }

  // テスト2: 存在しない商品
  console.log('\n--- テスト2: 在庫確認（存在しない商品） ---');
  const result2 = checkInventory('存在しない商品XYZ', 10);
  console.log('在庫あり: ' + result2.available);
  console.log('エラー: ' + result2.error);

  console.log('========================================');
}

/**
 * getStockByProduct()のテスト
 */
function testGetStockByProduct() {
  console.log('========================================');
  console.log('getStockByProduct() テスト');
  console.log('========================================');

  const searchTerm = 'Pokemon';
  console.log('検索キーワード: ' + searchTerm);

  const results = getStockByProduct(searchTerm);
  console.log('検索結果: ' + results.length + '件');

  if (results.length > 0) {
    console.log('検索結果（最初の3件）:');
    results.slice(0, 3).forEach((item, index) => {
      console.log((index + 1) + '. ' + item.enTitle + ' (在庫: ' + item.qty + ')');
    });
  }

  console.log('========================================');
}

/**
 * getStockByCategory()のテスト
 */
function testGetStockByCategory() {
  console.log('========================================');
  console.log('getStockByCategory() テスト');
  console.log('========================================');

  const stockData = getAvailableStock();

  if (stockData.categories.length > 0) {
    const testCategory = stockData.categories[0];
    console.log('カテゴリ: ' + testCategory);

    const results = getStockByCategory(testCategory);
    console.log('該当商品数: ' + results.length + '件');

    if (results.length > 0) {
      console.log('在庫商品（最初の3件）:');
      results.slice(0, 3).forEach((item, index) => {
        console.log((index + 1) + '. ' + item.enTitle + ' (在庫: ' + item.qty + ')');
      });
    }
  } else {
    console.log('カテゴリが見つかりませんでした');
  }

  console.log('========================================');
}

/**
 * 全テスト実行
 */
function runAllStockSyncTests() {
  testGetAvailableStock();
  console.log('\n');
  testCheckInventory();
  console.log('\n');
  testGetStockByProduct();
  console.log('\n');
  testGetStockByCategory();
}
