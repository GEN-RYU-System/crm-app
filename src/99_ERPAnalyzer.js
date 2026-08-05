/**
 * 99_ERPAnalyzer.gs - ERPスプレッドシートの構造を分析するための一時スクリプト
 *
 * このスクリプトは分析後に削除します
 */

/**
 * ERPスプレッドシートの全シート構造を取得
 */
function analyzeERPStructure() {
  const ERP_SPREADSHEET_ID = '[REDACTED]';

  try {
    const ss = SpreadsheetApp.openById(ERP_SPREADSHEET_ID);
    const sheets = ss.getSheets();

    const structure = {
      spreadsheetName: ss.getName(),
      spreadsheetId: ERP_SPREADSHEET_ID,
      totalSheets: sheets.length,
      sheets: []
    };

    sheets.forEach((sheet, index) => {
      const sheetData = {
        index: index + 1,
        name: sheet.getName(),
        sheetId: sheet.getSheetId(),
        lastRow: sheet.getLastRow(),
        lastColumn: sheet.getLastColumn(),
        headers: []
      };

      // ヘッダー行を取得（1行目）
      if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        const headers = headerRange.getValues()[0];
        sheetData.headers = headers.map((header, colIndex) => ({
          column: String.fromCharCode(65 + colIndex), // A, B, C...
          columnIndex: colIndex + 1,
          headerName: header
        }));
      }

      structure.sheets.push(sheetData);

      Logger.log(`Sheet ${index + 1}/${sheets.length}: ${sheet.getName()} (${sheet.getLastRow()} rows, ${sheet.getLastColumn()} cols)`);
    });

    return structure;

  } catch (error) {
    Logger.log('Error analyzing ERP structure: ' + error.message);
    throw error;
  }
}

/**
 * 結果をJSON形式でログ出力
 */
function logERPStructure() {
  const structure = analyzeERPStructure();
  Logger.log('=== ERP Structure Analysis ===');
  Logger.log(JSON.stringify(structure, null, 2));
  return structure;
}

/**
 * 特定のシートの詳細データを取得（サンプル行含む）
 */
function getSheetDetails(sheetName, sampleRows = 5) {
  const ERP_SPREADSHEET_ID = '[REDACTED]';

  try {
    const ss = SpreadsheetApp.openById(ERP_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    const details = {
      sheetName: sheetName,
      sheetId: sheet.getSheetId(),
      lastRow: lastRow,
      lastColumn: lastColumn,
      headers: [],
      sampleData: []
    };

    // ヘッダー取得
    if (lastRow > 0 && lastColumn > 0) {
      const headerRange = sheet.getRange(1, 1, 1, lastColumn);
      details.headers = headerRange.getValues()[0];

      // サンプルデータ取得（2行目から最大5行）
      const dataRowCount = Math.min(sampleRows, lastRow - 1);
      if (dataRowCount > 0) {
        const dataRange = sheet.getRange(2, 1, dataRowCount, lastColumn);
        details.sampleData = dataRange.getValues();
      }
    }

    return details;

  } catch (error) {
    Logger.log('Error getting sheet details: ' + error.message);
    throw error;
  }
}

/**
 * 全シートの詳細を取得
 */
function getAllSheetsDetails() {
  const ERP_SPREADSHEET_ID = '[REDACTED]';

  try {
    const ss = SpreadsheetApp.openById(ERP_SPREADSHEET_ID);
    const sheets = ss.getSheets();

    const allDetails = {
      spreadsheetName: ss.getName(),
      spreadsheetId: ERP_SPREADSHEET_ID,
      totalSheets: sheets.length,
      sheetsDetails: []
    };

    sheets.forEach((sheet) => {
      const details = getSheetDetails(sheet.getName(), 3);
      allDetails.sheetsDetails.push(details);
      Logger.log(`Analyzed: ${sheet.getName()}`);
    });

    return allDetails;

  } catch (error) {
    Logger.log('Error getting all sheets details: ' + error.message);
    throw error;
  }
}
