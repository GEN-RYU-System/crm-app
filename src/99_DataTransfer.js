/**
 * データ転記機能（全書式込み）
 * 移行元: [REDACTED]
 * 移行先: 現在のスプレッドシート（開発環境）
 */

/**
 * 全シート順次転記（メニューから実行）
 */
function transferAllSheetsSequentially() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();

  const sheetMappings = [
    [1195813452, 826682661, 'UPS_ShippingRates'],
    [1214726714, 130115565, 'DHL_ShippingRates'],
    [264167304, 427573081, 'FedEx_ShippingRates'],
    [833993881, 1508396503, 'M_Zones'],
    [74688869, 1863910716, 'InvoiceFormat'],
    [1761617187, 496016280, '📝請求書作成'],
    [600397303, 182417310, '📊売上データ'],
    [1186337887, 1708307083, 'Stock List'],
    [548021217, 1729733820, 'M_Product'],
    [884228295, 222220248, 'M_Customer'],
    [645231413, 1240290016, 'Commercial Invoice']
  ];

  const results = [];
  Logger.log('========================================');
  Logger.log('全シート順次転記開始');
  Logger.log('========================================');

  for (let i = 0; i < sheetMappings.length; i++) {
    const [sourceGid, targetGid, name] = sheetMappings[i];
    Logger.log(`\n${i + 1}/11: ${name}`);
    Logger.log(`  移行元gid: ${sourceGid}`);
    Logger.log(`  移行先gid: ${targetGid}`);

    try {
      const result = transferSingleSheetDT(sourceId, targetId, sourceGid, targetGid);
      results.push(result);

      if (result.success) {
        Logger.log(`  ✓ 完了: ${result.rows}行 x ${result.cols}列`);
      } else {
        Logger.log(`  ✗ 失敗: ${result.error}`);
      }

      // API制限対策
      Utilities.sleep(1000);

    } catch (e) {
      Logger.log(`  ✗ エラー: ${e.message}`);
      results.push({ success: false, sheet: name, error: e.message });
    }
  }

  // サマリー
  Logger.log('\n========================================');
  Logger.log('転記サマリー');
  Logger.log('========================================');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  Logger.log(`成功: ${successCount} / ${results.length}`);
  Logger.log(`失敗: ${failCount} / ${results.length}`);
  Logger.log('');

  results.forEach((r, i) => {
    const num = i + 1;
    if (r.success) {
      Logger.log(`${num}. ✓ ${r.sheet}: ${r.rows}行 x ${r.cols}列`);
    } else {
      Logger.log(`${num}. ✗ ${r.sheet || sheetMappings[i][2]}: ${r.error}`);
    }
  });

  // 完了ダイアログ
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'データ転記完了',
    `${successCount}/${results.length} シートの転記が完了しました。\n\n詳細はログを確認してください。`,
    ui.ButtonSet.OK
  );

  return results;
}

/**
 * 1シート転記実行
 */
function transferSingleSheetDT(sourceSpreadsheetId, targetSpreadsheetId, sourceGid, targetGid) {
  const sourceSs = SpreadsheetApp.openById(sourceSpreadsheetId);
  const targetSs = SpreadsheetApp.openById(targetSpreadsheetId);

  const sourceSheet = getSheetByGidDT(sourceSs, sourceGid);
  if (!sourceSheet) {
    throw new Error('移行元シートが見つかりません');
  }

  const targetSheet = getSheetByGidDT(targetSs, targetGid);
  if (!targetSheet) {
    throw new Error('移行先シートが見つかりません');
  }

  // クリア
  targetSheet.clear();

  // データ取得
  const sourceRange = sourceSheet.getDataRange();
  const numRows = sourceRange.getNumRows();
  const numCols = sourceRange.getNumColumns();

  if (numRows === 0 || numCols === 0) {
    return {
      success: true,
      sheet: sourceSheet.getName(),
      rows: 0,
      cols: 0
    };
  }

  const targetRange = targetSheet.getRange(1, 1, numRows, numCols);

  // 値・数式をコピー
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);

  // 書式をコピー
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

  // 条件付き書式をコピー
  const conditionalFormatRules = sourceSheet.getConditionalFormatRules();
  targetSheet.setConditionalFormatRules(conditionalFormatRules);

  // 列幅をコピー
  for (let col = 1; col <= numCols; col++) {
    targetSheet.setColumnWidth(col, sourceSheet.getColumnWidth(col));
  }

  // 行高をコピー
  for (let row = 1; row <= numRows; row++) {
    targetSheet.setRowHeight(row, sourceSheet.getRowHeight(row));
  }

  // 固定行・列をコピー
  targetSheet.setFrozenRows(sourceSheet.getFrozenRows());
  targetSheet.setFrozenColumns(sourceSheet.getFrozenColumns());

  return {
    success: true,
    sheet: sourceSheet.getName(),
    rows: numRows,
    cols: numCols
  };
}

/**
 * GIDからシートを取得
 */
function getSheetByGidDT(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) {
      return sheets[i];
    }
  }
  return null;
}

// 個別転記関数
function transfer_UPS_ShippingRates() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 1195813452, 826682661);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `UPS送料表の転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_DHL_ShippingRates() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 1214726714, 130115565);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `DHL送料表の転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_FedEx_ShippingRates() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 264167304, 427573081);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `FedEx送料表の転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_M_Zones() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 833993881, 1508396503);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `地帯表の転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_InvoiceFormat() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 74688869, 1863910716);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `請求書フォーマットの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_InvoiceCreate() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 1761617187, 496016280);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `📝請求書作成の転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_SalesData() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 600397303, 182417310);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `📊売上データの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_StockList() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 1186337887, 1708307083);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `Stock Listの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_M_Product() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 548021217, 1729733820);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `M_Productの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_M_Customer() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 884228295, 222220248);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `M_Customerの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}

function transfer_CommercialInvoice() {
  const sourceId = '[REDACTED]';
  const targetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const result = transferSingleSheetDT(sourceId, targetId, 645231413, 1240290016);

  const ui = SpreadsheetApp.getUi();
  if (result.success) {
    ui.alert('完了', `Commercial Invoiceの転記が完了しました。\n${result.rows}行 x ${result.cols}列`, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', `転記に失敗しました: ${result.error}`, ui.ButtonSet.OK);
  }

  return result;
}
