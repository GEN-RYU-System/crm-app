/**
 * DEV専用: 顧客マスタ_旧 の全列ヘッダー名と各列の空欄件数を返す（読み取り専用）
 * データ値は出力しない。ヘッダー名と件数のみ。
 */
function devAuditOldCustomerMasterColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAuditOldCustomerMasterColumns is available only in development');
  }
  var spreadsheet = getSpreadsheet();

  // 旧マスタ: 「顧客マスタ_旧」があればそちらを、なければ「顧客マスタ」を試みる
  var sheet = spreadsheet.getSheetByName('顧客マスタ_旧')
           || spreadsheet.getSheetByName('顧客マスタ');
  if (!sheet) {
    return { error: 'シートが見つかりません: 顧客マスタ_旧 / 顧客マスタ' };
  }

  var sheetName = sheet.getName();
  var lastRow   = sheet.getLastRow();
  var lastCol   = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return { sheetName: sheetName, totalDataRows: 0, columns: [] };
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var dataRowCount = Math.max(0, lastRow - 1);

  if (dataRowCount === 0) {
    return {
      sheetName: sheetName,
      totalDataRows: 0,
      columns: headers.map(function(h, i) {
        return { colIndex: i + 1, headerName: String(h).trim(), blankCount: 0, filledCount: 0 };
      }),
    };
  }

  var allValues = sheet.getRange(2, 1, dataRowCount, lastCol).getValues();
  var blankCounts = new Array(lastCol).fill(0);
  allValues.forEach(function(row) {
    row.forEach(function(cell, colIdx) {
      var empty = (cell === '' || cell === null || cell === undefined);
      if (empty) blankCounts[colIdx]++;
    });
  });

  return {
    sheetName:     sheetName,
    totalDataRows: dataRowCount,
    columns: headers.map(function(h, i) {
      return {
        colIndex:   i + 1,
        headerName: String(h).trim(),
        blankCount: blankCounts[i],
        filledCount: dataRowCount - blankCounts[i],
      };
    }),
  };
}

/**
 * DEV専用: 配送先マスタの全列ヘッダー名と各列の空欄件数を返す（読み取り専用）
 * データ値は出力しない。ヘッダー名と件数のみ。
 */
function devAuditShippingDestinationColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('devAuditShippingDestinationColumns is available only in development');
  }
  var spreadsheet = getSpreadsheet();
  var shippingTable = getCoreSchemaV1Table('SHIPPING_DESTINATIONS');
  var sheet = spreadsheet.getSheetByName(shippingTable.sheetName);
  if (!sheet) return { error: 'sheet not found: ' + shippingTable.sheetName };

  var lastRow      = sheet.getLastRow();
  var lastCol      = sheet.getLastColumn();
  var headerRow    = shippingTable.headerRowNumber;
  var dataRowCount = Math.max(0, lastRow - headerRow);

  var headers = lastCol > 0
    ? sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0]
    : [];

  if (dataRowCount === 0) {
    return {
      sheetName: shippingTable.sheetName,
      totalDataRows: 0,
      columns: headers.map(function(h, i) {
        return { colIndex: i + 1, headerName: String(h).trim(), blankCount: 0, filledCount: 0 };
      }),
    };
  }

  var allValues = sheet
    .getRange(headerRow + 1, 1, dataRowCount, lastCol)
    .getValues();

  var blankCounts = new Array(lastCol).fill(0);
  allValues.forEach(function(row) {
    row.forEach(function(cell, colIdx) {
      if (cell === '' || cell === null || cell === undefined) blankCounts[colIdx]++;
    });
  });

  return {
    sheetName:     shippingTable.sheetName,
    totalDataRows: dataRowCount,
    columns: headers.map(function(h, i) {
      return {
        colIndex:    i + 1,
        headerName:  String(h).trim(),
        blankCount:  blankCounts[i],
        filledCount: dataRowCount - blankCounts[i],
      };
    }),
  };
}
