/**
 * ERPデータクレンジング
 *
 * 配送料金表シート（UPS/DHL/FedEx）のノイズデータを削除
 *
 * ⚠️ 警告:
 * - このスクリプトはERPスプレッドシートのデータを変更します
 * - 実行前に必ずバックアップを取ってください
 * - 本番環境で実行する場合は慎重に確認してください
 */

/**
 * 全配送料金表シートのノイズデータを一括クリーンアップ
 *
 * 対象シート:
 * - UPS_ShippingRates
 * - DHL_ShippingRates
 * - FedEx_ShippingRates
 *
 * 実行方法:
 * 1. ERPスプレッドシートのApps Scriptエディタでこのファイルを開く
 * 2. 関数選択 → cleanAllShippingRatesNoiseData
 * 3. 実行前に previewAllNoiseData() で削除対象を確認（推奨）
 * 4. 実行ボタン（▶️）をクリック
 */
function cleanAllShippingRatesNoiseData() {
  const sheets = ['UPS_ShippingRates', 'DHL_ShippingRates', 'FedEx_ShippingRates'];
  const output = [];

  output.push('========================================');
  output.push('全配送料金表クリーンアップ開始');
  output.push('========================================\n');

  const results = {};

  sheets.forEach(sheetName => {
    output.push(`\n[${sheetName}] クリーンアップ中...`);
    const result = cleanShippingRatesSheet(sheetName, false); // false = 確認ダイアログなし
    results[sheetName] = result;
  });

  // 総合レポート
  output.push('\n========================================');
  output.push('全シートクリーンアップ完了');
  output.push('========================================');

  let totalDeleted = 0;
  Object.keys(results).forEach(sheetName => {
    const count = results[sheetName];
    output.push(`${sheetName}: ${count}行削除`);
    totalDeleted += count;
  });

  output.push(`\n合計削除行数: ${totalDeleted}行`);

  const result = output.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 全シートのノイズデータプレビュー
 */
function previewAllNoiseData() {
  const sheets = ['UPS_ShippingRates', 'DHL_ShippingRates', 'FedEx_ShippingRates'];
  const output = [];

  output.push('========================================');
  output.push('全配送料金表ノイズデータプレビュー');
  output.push('========================================\n');

  const results = {};

  sheets.forEach(sheetName => {
    output.push(`\n[${sheetName}]`);
    output.push('─'.repeat(40));
    const count = previewSheetNoiseData(sheetName);
    results[sheetName] = count;
  });

  // 総合レポート
  output.push('\n========================================');
  output.push('プレビュー総合レポート');
  output.push('========================================');

  let totalNoise = 0;
  Object.keys(results).forEach(sheetName => {
    const count = results[sheetName];
    output.push(`${sheetName}: ${count}行のノイズデータ`);
    totalNoise += count;
  });

  output.push(`\n合計: ${totalNoise}行のノイズデータが見つかりました`);
  output.push('\n実際に削除するには cleanAllShippingRatesNoiseData() を実行してください');

  const result = output.join('\n');
  Logger.log(result);
  return result;
}

/**
 * 汎用: 配送料金表シートのクリーンアップ
 */
function cleanShippingRatesSheet(sheetName, showDialog = true) {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log(`❌ エラー: ${sheetName}シートが見つかりません`);
    return 0;
  }

  // 確認ダイアログ（個別実行時のみ）
  if (showDialog) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'データクレンジング確認',
      `${sheetName}シートのノイズデータを削除します。\n\n` +
      '削除対象: A列・B列のみに値があり、他の列が空白の行\n\n' +
      '⚠️ この操作は取り消せません。続行しますか？',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      Logger.log('キャンセルされました');
      return 0;
    }
  }

  const data = sheet.getDataRange().getValues();
  const lastCol = sheet.getLastColumn();

  let deletedCount = 0;

  // 下から上に向かって削除
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    const hasMinWeight = row[0] !== '' && row[0] !== null && row[0] !== undefined;
    const hasMaxWeight = row[1] !== '' && row[1] !== null && row[1] !== undefined;

    let allOtherColumnsEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherColumnsEmpty = false;
        break;
      }
    }

    if ((hasMinWeight || hasMaxWeight) && allOtherColumnsEmpty) {
      const rowNumber = i + 1;
      Logger.log(`  削除: 行${rowNumber} - A列: ${row[0]}, B列: ${row[1]}`);
      sheet.deleteRow(rowNumber);
      deletedCount++;
    }
  }

  Logger.log(`  → ${deletedCount}行削除完了`);
  return deletedCount;
}

/**
 * 汎用: シートのノイズデータプレビュー
 */
function previewSheetNoiseData(sheetName) {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log(`❌ エラー: ${sheetName}シートが見つかりません`);
    return 0;
  }

  const data = sheet.getDataRange().getValues();
  const lastCol = sheet.getLastColumn();

  let noiseCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const hasMinWeight = row[0] !== '' && row[0] !== null && row[0] !== undefined;
    const hasMaxWeight = row[1] !== '' && row[1] !== null && row[1] !== undefined;

    let allOtherColumnsEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherColumnsEmpty = false;
        break;
      }
    }

    if ((hasMinWeight || hasMaxWeight) && allOtherColumnsEmpty) {
      const rowNumber = i + 1;
      noiseCount++;
      Logger.log(`  削除対象: 行${rowNumber} - A列: ${row[0]}, B列: ${row[1]}`);
    }
  }

  Logger.log(`  → 合計: ${noiseCount}行のノイズデータ`);
  return noiseCount;
}

/**
 * FedEx_ShippingRatesシートのデータを調査
 */
function investigateFedExData() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('FedEx_ShippingRates');

  if (!sheet) {
    return 'FedEx_ShippingRatesシートが見つかりません';
  }

  const data = sheet.getDataRange().getValues();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const output = [];
  output.push('========================================');
  output.push('FedEx_ShippingRates データ調査');
  output.push('========================================');
  output.push(`総行数: ${lastRow}`);
  output.push(`総列数: ${lastCol}`);
  output.push('');

  // ヘッダー行を確認
  output.push('【ヘッダー行（1行目）】');
  const headers = data[0];
  for (let i = 0; i < Math.min(headers.length, 10); i++) {
    output.push(`  列${i+1}(${String.fromCharCode(65+i)}): ${headers[i]}`);
  }
  output.push('');

  // サンプルデータ（2-11行目）
  output.push('【サンプルデータ（2-11行目）】');
  for (let i = 1; i < Math.min(data.length, 11); i++) {
    const row = data[i];
    const rowNum = i + 1;
    const aCol = row[0];
    const bCol = row[1];
    const cCol = row[2];

    // C列以降が全て空白か確認
    let allOtherEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherEmpty = false;
        break;
      }
    }

    const isNoise = (aCol !== '' || bCol !== '') && allOtherEmpty;
    const marker = isNoise ? '❌ノイズ' : '✅正常';

    output.push(`  行${rowNum} ${marker}: A=${aCol}, B=${bCol}, C=${cCol}`);
  }
  output.push('');

  // ノイズデータをカウント
  output.push('【ノイズデータ集計】');
  let noiseCount = 0;
  const noiseRows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const hasMinWeight = row[0] !== '' && row[0] !== null && row[0] !== undefined;
    const hasMaxWeight = row[1] !== '' && row[1] !== null && row[1] !== undefined;

    let allOtherEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherEmpty = false;
        break;
      }
    }

    if ((hasMinWeight || hasMaxWeight) && allOtherEmpty) {
      noiseCount++;
      if (noiseRows.length < 20) {
        noiseRows.push(`  行${i+1}: A=${row[0]}, B=${row[1]}`);
      }
    }
  }

  output.push(`ノイズデータ総数: ${noiseCount}行`);
  output.push('');
  output.push('【ノイズデータ例（最大20行）】');
  noiseRows.forEach(line => output.push(line));

  const result = output.join('\n');
  Logger.log(result);
  return result;
}

/**
 * UPS_ShippingRatesのノイズデータをクリーンアップ
 *
 * 削除対象:
 * - AB列（またはA列・B列）のみに値があり、他の列が空白の行
 * - 具体的には「0」「0.5」のみが記載されている行
 *
 * 実行方法:
 * 1. ERPスプレッドシートのApps Scriptエディタでこのファイルを開く
 * 2. 関数選択 → cleanUPSShippingRatesNoiseData
 * 3. 実行前に previewUPSNoiseData() で削除対象を確認（推奨）
 * 4. 実行ボタン（▶️）をクリック
 */
function cleanUPSShippingRatesNoiseData() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('UPS_ShippingRates');

  if (!sheet) {
    Logger.log('❌ エラー: UPS_ShippingRatesシートが見つかりません');
    return;
  }

  // 確認ダイアログ
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'データクレンジング確認',
    'UPS_ShippingRatesシートのノイズデータを削除します。\n\n' +
    '削除対象: A列・B列のみに値があり、他の列が空白の行\n\n' +
    '⚠️ この操作は取り消せません。事前にバックアップを取りましたか？\n\n' +
    '続行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    Logger.log('キャンセルされました');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const lastCol = sheet.getLastColumn();

  let deletedCount = 0;
  const deletedRows = [];

  // 下から上に向かって削除（行番号のズレを防ぐ）
  for (let i = data.length - 1; i >= 1; i--) { // ヘッダー行（0行目）は除外
    const row = data[i];

    // A列（Min_Weight）とB列（Max_Weight）のみに値があるか確認
    const hasMinWeight = row[0] !== '' && row[0] !== null && row[0] !== undefined;
    const hasMaxWeight = row[1] !== '' && row[1] !== null && row[1] !== undefined;

    // C列以降がすべて空白か確認
    let allOtherColumnsEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherColumnsEmpty = false;
        break;
      }
    }

    // ノイズデータの条件: A列またはB列に値があり、他の列が全て空白
    if ((hasMinWeight || hasMaxWeight) && allOtherColumnsEmpty) {
      const rowNumber = i + 1;
      Logger.log(`削除予定: 行${rowNumber} - A列: ${row[0]}, B列: ${row[1]}`);

      // 行を削除
      sheet.deleteRow(rowNumber);
      deletedCount++;
      deletedRows.push({
        rowNumber: rowNumber,
        minWeight: row[0],
        maxWeight: row[1]
      });
    }
  }

  // 結果レポート
  Logger.log('\n========================================');
  Logger.log('データクレンジング完了');
  Logger.log('========================================');
  Logger.log(`削除した行数: ${deletedCount}行`);

  if (deletedCount > 0) {
    Logger.log('\n削除した行の詳細:');
    deletedRows.reverse().forEach(row => {
      Logger.log(`  行${row.rowNumber}: Min_Weight=${row.minWeight}, Max_Weight=${row.maxWeight}`);
    });
  }

  // 完了メッセージ
  ui.alert(
    'クリーンアップ完了',
    `${deletedCount}行のノイズデータを削除しました。\n\n` +
    '詳細は実行ログを確認してください。',
    ui.ButtonSet.OK
  );
}

/**
 * 削除対象のプレビュー（実際には削除しない）
 *
 * 実行前にこの関数で削除対象を確認することを推奨
 */
function previewUPSNoiseData() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('UPS_ShippingRates');

  if (!sheet) {
    Logger.log('❌ エラー: UPS_ShippingRatesシートが見つかりません');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const lastCol = sheet.getLastColumn();

  let noiseCount = 0;
  const noiseRows = [];

  Logger.log('========================================');
  Logger.log('ノイズデータ削除プレビュー');
  Logger.log('========================================');
  Logger.log('');

  for (let i = 1; i < data.length; i++) { // ヘッダー行（0行目）は除外
    const row = data[i];

    // A列（Min_Weight）とB列（Max_Weight）のみに値があるか確認
    const hasMinWeight = row[0] !== '' && row[0] !== null && row[0] !== undefined;
    const hasMaxWeight = row[1] !== '' && row[1] !== null && row[1] !== undefined;

    // C列以降がすべて空白か確認
    let allOtherColumnsEmpty = true;
    for (let j = 2; j < lastCol; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allOtherColumnsEmpty = false;
        break;
      }
    }

    // ノイズデータの条件
    if ((hasMinWeight || hasMaxWeight) && allOtherColumnsEmpty) {
      const rowNumber = i + 1;
      noiseCount++;
      noiseRows.push({
        rowNumber: rowNumber,
        minWeight: row[0],
        maxWeight: row[1]
      });

      Logger.log(`削除対象: 行${rowNumber} - A列: ${row[0]}, B列: ${row[1]}`);
    }
  }

  Logger.log('\n========================================');
  Logger.log(`合計: ${noiseCount}行のノイズデータが見つかりました`);
  Logger.log('========================================');
  Logger.log('');
  Logger.log('実際に削除するには cleanUPSShippingRatesNoiseData() を実行してください');
}

/**
 * 正常データの確認（11行目など）
 *
 * 正常データの構造を確認
 */
function checkValidDataStructure() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('UPS_ShippingRates');

  if (!sheet) {
    Logger.log('❌ エラー: UPS_ShippingRatesシートが見つかりません');
    return;
  }

  Logger.log('========================================');
  Logger.log('正常データ構造確認（11行目）');
  Logger.log('========================================');

  const row11 = sheet.getRange(11, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('\n11行目のデータ:');
  for (let i = 0; i < row11.length; i++) {
    const colLetter = String.fromCharCode(65 + i); // A, B, C...
    if (row11[i] !== '' && row11[i] !== null && row11[i] !== undefined) {
      Logger.log(`  ${colLetter}列: ${row11[i]}`);
    }
  }

  // 空白列をカウント
  let emptyCount = 0;
  let filledCount = 0;
  for (let i = 0; i < row11.length; i++) {
    if (row11[i] === '' || row11[i] === null || row11[i] === undefined) {
      emptyCount++;
    } else {
      filledCount++;
    }
  }

  Logger.log('\n統計:');
  Logger.log(`  データ入力列: ${filledCount}列`);
  Logger.log(`  空白列: ${emptyCount}列`);
}

/**
 * バックアップ作成
 *
 * クレンジング前にUPS_ShippingRatesシートのコピーを作成
 */
function createBackupBeforeCleaning() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('UPS_ShippingRates');

  if (!sheet) {
    Logger.log('❌ エラー: UPS_ShippingRatesシートが見つかりません');
    return;
  }

  // タイムスタンプ付きバックアップ名
  const timestamp = Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss');
  const backupName = `UPS_ShippingRates_backup_${timestamp}`;

  // シートをコピー
  const backup = sheet.copyTo(ss);
  backup.setName(backupName);

  Logger.log(`✅ バックアップを作成しました: ${backupName}`);
  Logger.log('   このシートは後で削除できます');

  return backupName;
}

/**
 * テスト: FedEx_ShippingRatesの最初のノイズ行（行2）を削除
 *
 * 目的: clasp runでの削除権限を確認
 */
function testDeleteOneRow() {
  const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('FedEx_ShippingRates');

  if (!sheet) {
    return 'エラー: FedEx_ShippingRatesシートが見つかりません';
  }

  const output = [];
  output.push('========================================');
  output.push('単一行削除テスト');
  output.push('========================================');

  // 削除前の情報
  const beforeRowCount = sheet.getLastRow();
  const row2Data = sheet.getRange(2, 1, 1, 3).getValues()[0];
  output.push(`削除前の総行数: ${beforeRowCount}`);
  output.push(`行2のデータ: A=${row2Data[0]}, B=${row2Data[1]}, C=${row2Data[2]}`);
  output.push('');

  // 行2を削除
  try {
    sheet.deleteRow(2);
    output.push('✅ 行2の削除を実行しました');
  } catch (error) {
    output.push(`❌ 削除エラー: ${error.message}`);
    const result = output.join('\n');
    Logger.log(result);
    return result;
  }

  // 削除後の情報
  SpreadsheetApp.flush();
  const afterRowCount = sheet.getLastRow();
  const newRow2Data = sheet.getRange(2, 1, 1, 3).getValues()[0];
  output.push('');
  output.push(`削除後の総行数: ${afterRowCount}`);
  output.push(`新しい行2のデータ: A=${newRow2Data[0]}, B=${newRow2Data[1]}, C=${newRow2Data[2]}`);
  output.push('');

  // 結果判定
  if (afterRowCount === beforeRowCount - 1) {
    output.push('✅ 削除成功: 行数が1減少しました');
  } else {
    output.push('❌ 削除失敗: 行数が変化していません');
  }

  const result = output.join('\n');
  Logger.log(result);
  return result;
}
