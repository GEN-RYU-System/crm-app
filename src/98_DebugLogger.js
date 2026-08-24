/**
 * Logger出力でデバッグ用関数
 */

function getColumnName(index) {
  let name = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

/**
 * リード管理シートのヘッダーをログ出力
 */
function logLeadsSheetHeaders() {
  try {
    const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('PRODUCTION_SPREADSHEET_ID'));
    Logger.log('スプレッドシート名: ' + ss.getName());

    const sheet = ss.getSheetByName('リード管理');
    if (!sheet) {
      Logger.log('エラー: リード管理シートが存在しません');
      Logger.log('利用可能なシート:');
      ss.getSheets().forEach(s => Logger.log('  - ' + s.getName()));
      return;
    }

    const lastColumn = sheet.getLastColumn();
    Logger.log('総列数: ' + lastColumn);

    if (lastColumn === 0) {
      Logger.log('エラー: リード管理シートにデータがありません');
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    Logger.log('\n=== リード管理シート ヘッダー情報 ===');
    headers.forEach((h, i) => {
      const colName = getColumnName(i + 1);
      Logger.log(`${colName}列 (${i + 1}): ${h}`);
    });

  } catch (e) {
    Logger.log('エラー: ' + e.message);
    Logger.log('スタック: ' + e.stack);
  }
}

/**
 * 商談管理シートのヘッダーをログ出力
 */
function logDealsSheetHeaders() {
  try {
    const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('PRODUCTION_SPREADSHEET_ID'));
    Logger.log('スプレッドシート名: ' + ss.getName());

    const sheet = ss.getSheetByName('商談管理');
    if (!sheet) {
      Logger.log('エラー: 商談管理シートが存在しません');
      Logger.log('利用可能なシート:');
      ss.getSheets().forEach(s => Logger.log('  - ' + s.getName()));
      return;
    }

    const lastColumn = sheet.getLastColumn();
    Logger.log('総列数: ' + lastColumn);

    if (lastColumn === 0) {
      Logger.log('エラー: 商談管理シートにデータがありません');
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    Logger.log('\n=== 商談管理シート ヘッダー情報 ===');
    headers.forEach((h, i) => {
      const colName = getColumnName(i + 1);
      Logger.log(`${colName}列 (${i + 1}): ${h}`);
    });

  } catch (e) {
    Logger.log('エラー: ' + e.message);
    Logger.log('スタック: ' + e.stack);
  }
}

/**
 * 全シート情報をログ出力
 */
function logAllSheetInfo() {
  try {
    const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('PRODUCTION_SPREADSHEET_ID'));
    Logger.log('\n=== スプレッドシート情報 ===');
    Logger.log('名前: ' + ss.getName());
    Logger.log('ID: ' + ss.getId());

    const sheets = ss.getSheets();
    Logger.log('\n総シート数: ' + sheets.length);
    Logger.log('\n=== シート一覧 ===');

    sheets.forEach((s, i) => {
      Logger.log(`\n${i + 1}. ${s.getName()}`);
      Logger.log(`   ID: ${s.getSheetId()}`);
      Logger.log(`   行数: ${s.getLastRow()}`);
      Logger.log(`   列数: ${s.getLastColumn()}`);
    });

  } catch (e) {
    Logger.log('エラー: ' + e.message);
    Logger.log('スタック: ' + e.stack);
  }
}
