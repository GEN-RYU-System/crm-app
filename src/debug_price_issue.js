/**
 * 見積もり価格の不具合を調査
 * 特定の商品の価格データを詳細に確認
 */
function debugPriceIssue() {
  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.SCM_STOCK_SYNC;
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: '集計同期シートが見つかりません: ' + sheetName };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const categoryCol = headers.indexOf('Category');
    const markCol = headers.indexOf('Mark');
    const conditionCol = headers.indexOf('Condition');
    const priceCol = headers.indexOf('Unit Price');
    const qtyCol = headers.indexOf('Quantity');
    const jpTitleCol = headers.indexOf('Japanese Title');
    const enTitleCol = headers.indexOf('English Title');

    const result = {
      sheetName: sheetName,
      headers: headers,
      columnIndexes: {
        category: categoryCol,
        mark: markCol,
        condition: conditionCol,
        price: priceCol,
        quantity: qtyCol,
        jpTitle: jpTitleCol,
        enTitle: enTitleCol
      },
      pokemonM3Products: [],
      pokemonM2Products: [],
      allPokemonProducts: [],
      priceMapSample: {}
    };

    // 全てのPokemon商品を取得
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const category = row[categoryCol];
      const mark = row[markCol];
      const condition = row[conditionCol];
      const price = row[priceCol];
      const qty = row[qtyCol];
      const jpTitle = row[jpTitleCol];
      const enTitle = row[enTitleCol];

      if (category === 'Pokemon') {
        const productData = {
          row: i + 1,
          category: category,
          mark: mark,
          jpTitle: jpTitle,
          enTitle: enTitle,
          condition: condition,
          price: price,
          quantity: qty,
          key: category + '-' + mark + '-' + String(condition).trim()
        };

        result.allPokemonProducts.push(productData);

        // M3商品を特定
        if (mark === 'M3') {
          result.pokemonM3Products.push(productData);
        }

        // M2商品を特定
        if (mark === 'M2') {
          result.pokemonM2Products.push(productData);
        }

        // 価格マップにも追加（getAllProductPricesMapと同じロジック）
        if (qty > 0 && price) {
          const key = category + '-' + mark + '-' + String(condition).trim();
          result.priceMapSample[key] = parseFloat(price) || 0;
        }
      }
    }

    result.pokemonM3Count = result.pokemonM3Products.length;
    result.pokemonM2Count = result.pokemonM2Products.length;
    result.totalPokemonCount = result.allPokemonProducts.length;

    return result;
  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 価格マップの完全な状態を確認
 */
function debugFullPriceMap() {
  try {
    const priceMap = getAllProductPricesMap();

    // Pokemon商品のみフィルター
    const pokemonPrices = {};
    for (const key in priceMap) {
      if (key.startsWith('Pokemon-')) {
        pokemonPrices[key] = priceMap[key];
      }
    }

    return {
      totalProducts: Object.keys(priceMap).length,
      pokemonProducts: Object.keys(pokemonPrices).length,
      pokemonPrices: pokemonPrices,
      allKeys: Object.keys(priceMap).sort()
    };
  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 特定の商品キーの価格を直接確認
 */
function checkSpecificProductPrices() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.SCM_STOCK_SYNC);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const categoryCol = headers.indexOf('Category');
    const markCol = headers.indexOf('Mark');
    const conditionCol = headers.indexOf('Condition');
    const priceCol = headers.indexOf('Unit Price');
    const qtyCol = headers.indexOf('Quantity');
    const jpTitleCol = headers.indexOf('Japanese Title');
    const enTitleCol = headers.indexOf('English Title');

    const testProducts = [
      { category: 'Pokemon', mark: 'M3', title: 'Nihil Zero' },
      { category: 'Pokemon', mark: 'M3', title: 'MEGA Dream ex' },
      { category: 'Pokemon', mark: 'M2', title: 'Inferno X' },
      { category: 'Pokemon', mark: 'SV5a', title: 'Crimson Haze' },
      { category: 'Pokemon', mark: 'SV4a', title: 'Shiny Treasure ex' },
      { category: 'Pokemon', mark: 'S11', title: 'Lost Abyss' }
    ];

    const results = [];

    for (const testProduct of testProducts) {
      const found = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const category = row[categoryCol];
        const mark = row[markCol];
        const enTitle = row[enTitleCol];

        if (category === testProduct.category && mark === testProduct.mark) {
          found.push({
            row: i + 1,
            category: category,
            mark: mark,
            jpTitle: row[jpTitleCol],
            enTitle: enTitle,
            condition: row[conditionCol],
            price: row[priceCol],
            quantity: row[qtyCol],
            key: category + '-' + mark + '-' + String(row[conditionCol]).trim()
          });
        }
      }

      results.push({
        search: testProduct,
        matches: found,
        matchCount: found.length
      });
    }

    return results;
  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}
