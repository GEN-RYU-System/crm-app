/**
 * 価格データの調査 - 集計同期シートのデータを確認
 */
function testPriceData() {
  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.SCM_STOCK_SYNC;
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: '集計同期シートが見つかりません: ' + sheetName };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { error: '集計同期シートにデータがありません' };
    }

    const headers = data[0];
    const categoryCol = headers.indexOf('Category');
    const markCol = headers.indexOf('Mark');
    const conditionCol = headers.indexOf('Condition');
    const priceCol = headers.indexOf('Unit Price');
    const qtyCol = headers.indexOf('Quantity');

    const result = {
      sheetName: sheetName,
      totalRows: data.length - 1,
      headers: headers,
      columnIndexes: {
        category: categoryCol,
        mark: markCol,
        condition: conditionCol,
        price: priceCol,
        quantity: qtyCol
      },
      sampleData: [],
      priceMap: {}
    };

    // サンプルデータを取得（最初の10行）
    for (let i = 1; i < Math.min(11, data.length); i++) {
      const row = data[i];
      result.sampleData.push({
        row: i + 1,
        category: row[categoryCol],
        mark: row[markCol],
        condition: row[conditionCol],
        price: row[priceCol],
        quantity: row[qtyCol],
        key: row[categoryCol] + '-' + row[markCol] + '-' + String(row[conditionCol]).trim()
      });
    }

    // 価格マップを構築（getAllProductPricesMapと同じロジック）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const category = row[categoryCol];
      const mark = row[markCol];
      const condition = row[conditionCol];
      const price = row[priceCol];
      const qty = row[qtyCol];

      if (category && mark && condition && qty > 0 && price) {
        const key = category + '-' + mark + '-' + String(condition).trim();
        result.priceMap[key] = parseFloat(price) || 0;
      }
    }

    result.priceMapCount = Object.keys(result.priceMap).length;

    // 特定の商品の価格を確認（例: Pokemon-M3-Sealed）
    const testKeys = [
      'Pokemon-M3-Sealed',
      'Pokemon-M3-Box',
      'Pokemon-M3-Case',
      'OnePiece-OP01-Sealed',
      'OnePiece-OP01-Box'
    ];

    result.testPrices = {};
    testKeys.forEach(key => {
      result.testPrices[key] = result.priceMap[key] || 'Not found';
    });

    return result;
  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 集計同期シートのヘッダーと構造を確認
 */
function inspectStockSyncSheet() {
  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.SCM_STOCK_SYNC;
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: '集計同期シートが見つかりません: ' + sheetName };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    return {
      sheetName: sheetName,
      lastRow: lastRow,
      lastColumn: lastCol,
      headers: headers.map((h, i) => ({
        index: i,
        column: String.fromCharCode(65 + i),
        name: h
      })),
      totalRecords: lastRow - 1
    };
  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}
