/**
 * セットアップ完了後の動作確認テスト
 *
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. 関数選択ドロップダウンからテスト関数を選択
 * 3. 実行ボタン（▶️）をクリック
 * 4. 実行ログで結果を確認
 */

/**
 * 【テスト1】初期化完了確認
 * すべてのシートが正しく作成されているか確認
 */
function test1_VerifySheetCreation() {
  Logger.log('=== テスト1: シート作成確認 ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    '見積書管理',
    '見積書明細',
    '請求書管理',
    '請求書明細',
    'M_Customer',
    'Stock List同期',
    'M_Product同期',
    'M_Zones同期',
    'FedEx_ShippingRates同期',
    'DHL_ShippingRates同期',
    'UPS_ShippingRates同期'
  ];

  let allCreated = true;
  let missingSheets = [];

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log('✅ ' + sheetName + ' - 作成済み');
    } else {
      Logger.log('❌ ' + sheetName + ' - 未作成');
      allCreated = false;
      missingSheets.push(sheetName);
    }
  });

  if (allCreated) {
    Logger.log('\n✅ テスト1成功: すべてのシートが作成されています');
    return true;
  } else {
    Logger.log('\n❌ テスト1失敗: 以下のシートが見つかりません:');
    missingSheets.forEach(name => Logger.log('  - ' + name));
    Logger.log('\n対処方法: GASエディタで initializeERPIntegration() を実行してください');
    return false;
  }
}

/**
 * 【テスト2】IMPORTRANGE同期確認
 * すべてのIMPORTRANGEシートにデータが表示されているか確認
 */
function test2_VerifyImportRangeSync() {
  Logger.log('=== テスト2: IMPORTRANGE同期確認 ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const syncSheets = [
    'Stock List同期',
    'M_Product同期',
    'M_Zones同期',
    'FedEx_ShippingRates同期',
    'DHL_ShippingRates同期',
    'UPS_ShippingRates同期'
  ];

  let allSynced = true;
  let unsyncedSheets = [];

  syncSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('❌ ' + sheetName + ' - シートが存在しません');
      allSynced = false;
      unsyncedSheets.push(sheetName + ' (未作成)');
      return;
    }

    // A1セルに数式があるか確認
    const formula = sheet.getRange('A1').getFormula();
    if (!formula || !formula.startsWith('=IMPORTRANGE')) {
      Logger.log('❌ ' + sheetName + ' - IMPORTRANGE数式が設定されていません');
      allSynced = false;
      unsyncedSheets.push(sheetName + ' (数式なし)');
      return;
    }

    // データが取得できているか確認（2行目以降にデータがあるか）
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('⚠️  ' + sheetName + ' - データ未同期（権限承認が必要）');
      allSynced = false;
      unsyncedSheets.push(sheetName + ' (権限未承認)');
      return;
    }

    Logger.log('✅ ' + sheetName + ' - 同期済み（' + lastRow + '行）');
  });

  if (allSynced) {
    Logger.log('\n✅ テスト2成功: すべてのIMPORTRANGEシートが同期されています');
    return true;
  } else {
    Logger.log('\n❌ テスト2失敗: 以下のシートで問題があります:');
    unsyncedSheets.forEach(name => Logger.log('  - ' + name));
    Logger.log('\n対処方法: 各シートのA1セルで「アクセスを許可」をクリックしてください');
    return false;
  }
}

/**
 * 【テスト3】顧客マスタ作成テスト
 * テスト顧客を1件作成し、正しく登録されるか確認
 */
function test3_CreateTestCustomer() {
  Logger.log('=== テスト3: 顧客マスタ作成テスト ===');

  const testData = {
    billingName: 'Test Company Ltd.',
    billingPhone: '12345678901',
    billingEmail: 'test@example.com',
    billingAddress1: '123 Test Street',
    billingAddress2: 'Suite 100',
    billingCity: 'Test City',
    billingState: 'CA',
    billingZip: '12345',
    billingCountry: 'United States',
    notes: 'テストデータ - セットアップ確認用',
    source: 'Setup Test'
  };

  try {
    const result = createCustomer(testData);

    if (result.success) {
      Logger.log('✅ テスト3成功: 顧客作成完了');
      Logger.log('   Customer ID: ' + result.customerId);
      Logger.log('   確認: M_Customerシートに1行追加されています');
      return true;
    } else {
      Logger.log('❌ テスト3失敗: ' + result.error);
      return false;
    }
  } catch (error) {
    Logger.log('❌ テスト3失敗（例外発生）: ' + error.message);
    Logger.log('   スタックトレース: ' + error.stack);
    return false;
  }
}

/**
 * 【テスト4】見積書作成テスト
 * テスト見積書を1件作成し、配送料計算が動作するか確認
 */
function test4_CreateTestQuote() {
  Logger.log('=== テスト4: 見積書作成テスト ===');

  // 前提: M_Customerにデータが1件以上ある
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const customerSheet = ss.getSheetByName('M_Customer');

  if (!customerSheet || customerSheet.getLastRow() < 2) {
    Logger.log('⚠️  前提条件エラー: M_Customerにデータがありません');
    Logger.log('   先に test3_CreateTestCustomer() を実行してください');
    return false;
  }

  // 最初の顧客データを取得
  const customerData = customerSheet.getRange(2, 1, 1, 12).getValues()[0];
  const customerId = customerData[0];
  const customerName = customerData[2];

  const testQuote = {
    dealId: 'TEST-DEAL-001',
    customerId: customerId,
    customerName: customerName,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
    currency: 'USD',
    deliveryCountry: 'United States',
    deliveryAddress: '123 Test Street, Test City, CA',
    notes: 'テスト見積書 - セットアップ確認用',
    items: [
      {
        productId: 'TEST-PROD-001',
        productName: 'Test Product',
        productNameJa: 'テスト商品',
        category: 'Pokemon',
        condition: '新品',
        quantity: 2,
        unitPrice: 100.00,
        weight: 0.5,
        mark: 'test',
        releaseDate: '2024-01-01',
        stockQty: 10,
        notes: ''
      }
    ]
  };

  try {
    const result = createQuote(testQuote);

    if (result.success) {
      Logger.log('✅ テスト4成功: 見積書作成完了');
      Logger.log('   Quote ID: ' + result.quoteId);
      Logger.log('   確認: 見積書管理シートに1行追加されています');
      Logger.log('   確認: 見積書明細シートに商品明細が追加されています');

      // 配送料計算の確認
      const quoteSheet = ss.getSheetByName('見積書管理');
      const quoteRow = quoteSheet.getRange(2, 1, 1, 23).getValues()[0];
      const shippingFee = quoteRow[8];

      if (shippingFee > 0) {
        Logger.log('   ✅ 配送料自動計算: $' + shippingFee.toFixed(2));
      } else {
        Logger.log('   ⚠️  配送料が0円です。料金表の同期を確認してください。');
      }

      return true;
    } else {
      Logger.log('❌ テスト4失敗: ' + result.error);
      return false;
    }
  } catch (error) {
    Logger.log('❌ テスト4失敗（例外発生）: ' + error.message);
    Logger.log('   スタックトレース: ' + error.stack);
    return false;
  }
}

/**
 * 【テスト5】在庫データ取得テスト
 * IMPORTRANGE経由で在庫データが取得できるか確認
 */
function test5_GetStockData() {
  Logger.log('=== テスト5: 在庫データ取得テスト ===');

  try {
    const result = getAvailableStock();

    if (result.error) {
      Logger.log('❌ テスト5失敗: ' + result.error);
      return false;
    }

    Logger.log('✅ テスト5成功: 在庫データ取得完了');
    Logger.log('   取得データ数: ' + result.data.length + '件');
    Logger.log('   カテゴリ一覧: ' + result.categories.join(', '));

    // サンプルデータを表示（最初の3件）
    if (result.data.length > 0) {
      Logger.log('\n   サンプルデータ（最初の3件）:');
      result.data.slice(0, 3).forEach((item, index) => {
        Logger.log('   ' + (index + 1) + '. ' + item.category + ' - ' + item.enTitle + ' (在庫: ' + item.qty + ')');
      });
    }

    return true;
  } catch (error) {
    Logger.log('❌ テスト5失敗（例外発生）: ' + error.message);
    Logger.log('   対処方法: Stock List同期シートのIMPORTRANGE権限を確認してください');
    return false;
  }
}

/**
 * 【テスト6】配送料金計算テスト
 * 配送料金表から正しく料金を計算できるか確認
 */
function test6_CalculateShippingFee() {
  Logger.log('=== テスト6: 配送料金計算テスト ===');

  const testCases = [
    { country: 'United States', weight: 1.0 },
    { country: 'Japan', weight: 2.5 },
    { country: 'United Kingdom', weight: 0.5 }
  ];

  let allPassed = true;

  testCases.forEach((testCase, index) => {
    Logger.log('\nテストケース ' + (index + 1) + ': ' + testCase.country + ', ' + testCase.weight + 'kg');

    try {
      const result = calculateShippingFee(testCase.country, testCase.weight, 'auto');

      if (result.success) {
        Logger.log('  ✅ 計算成功');
        Logger.log('     選択キャリア: ' + result.carrier);
        Logger.log('     配送料: $' + result.fee.toFixed(2));
        Logger.log('     ゾーン: ' + result.zone);
        Logger.log('     全キャリア料金:');
        Object.entries(result.allRates).forEach(([carrier, rate]) => {
          if (rate !== null) {
            Logger.log('       - ' + carrier + ': $' + rate.toFixed(2));
          }
        });
      } else {
        Logger.log('  ❌ 計算失敗: ' + result.error);
        allPassed = false;
      }
    } catch (error) {
      Logger.log('  ❌ 例外発生: ' + error.message);
      allPassed = false;
    }
  });

  if (allPassed) {
    Logger.log('\n✅ テスト6成功: 配送料金計算が正常に動作しています');
    return true;
  } else {
    Logger.log('\n❌ テスト6失敗: 配送料金表の同期を確認してください');
    return false;
  }
}

/**
 * 【統合テスト】全テストを順次実行
 * すべてのテストを実行し、セットアップが完了しているか総合確認
 */
function runAllSetupTests() {
  Logger.log('╔═══════════════════════════════════════════════════════╗');
  Logger.log('║  CRM-ERP統合 セットアップ確認テスト                  ║');
  Logger.log('╚═══════════════════════════════════════════════════════╝\n');

  const tests = [
    { name: 'テスト1: シート作成確認', func: test1_VerifySheetCreation },
    { name: 'テスト2: IMPORTRANGE同期確認', func: test2_VerifyImportRangeSync },
    { name: 'テスト3: 顧客マスタ作成', func: test3_CreateTestCustomer },
    { name: 'テスト4: 見積書作成', func: test4_CreateTestQuote },
    { name: 'テスト5: 在庫データ取得', func: test5_GetStockData },
    { name: 'テスト6: 配送料金計算', func: test6_CalculateShippingFee }
  ];

  const results = [];

  tests.forEach((test, index) => {
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const passed = test.func();
    results.push({ name: test.name, passed: passed });
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  // サマリー表示
  Logger.log('\n╔═══════════════════════════════════════════════════════╗');
  Logger.log('║  テスト結果サマリー                                   ║');
  Logger.log('╚═══════════════════════════════════════════════════════╝\n');

  let passedCount = 0;
  results.forEach(result => {
    const status = result.passed ? '✅ 成功' : '❌ 失敗';
    Logger.log(status + ': ' + result.name);
    if (result.passed) passedCount++;
  });

  Logger.log('\n合計: ' + passedCount + '/' + tests.length + ' テスト成功');

  if (passedCount === tests.length) {
    Logger.log('\n🎉 おめでとうございます！セットアップが完了しています。');
    Logger.log('   本番運用を開始できます。');
  } else {
    Logger.log('\n⚠️  セットアップが完了していません。');
    Logger.log('   失敗したテストの対処方法を確認してください。');
    Logger.log('   詳細: 本番稼働前_セットアップ手順書.md を参照');
  }

  return passedCount === tests.length;
}

/**
 * 【クリーンアップ】テストデータの削除
 * テスト実行で作成したデータを削除します
 *
 * 注意: 本番データが混在している場合は実行しないでください
 */
function cleanupTestData() {
  Logger.log('=== テストデータクリーンアップ ===');

  const confirmation = Browser.msgBox(
    'テストデータ削除',
    'テストで作成したデータを削除します。本番データが含まれる場合は実行しないでください。\n\n続行しますか？',
    Browser.Buttons.YES_NO
  );

  if (confirmation !== 'yes') {
    Logger.log('キャンセルされました');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let deletedCount = 0;

  // M_Customerからテストデータ削除
  const customerSheet = ss.getSheetByName('M_Customer');
  if (customerSheet) {
    const data = customerSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][27] === 'Setup Test') { // AB列: 登録元
        customerSheet.deleteRow(i + 1);
        deletedCount++;
        Logger.log('削除: 顧客 - ' + data[i][0]);
      }
    }
  }

  // 見積書管理からテストデータ削除
  const quoteSheet = ss.getSheetByName('見積書管理');
  if (quoteSheet) {
    const data = quoteSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][13] && data[i][13].includes('テスト見積書')) { // N列: 備考
        // 見積書明細も削除
        const quoteId = data[i][0];
        const itemsSheet = ss.getSheetByName('見積書明細');
        if (itemsSheet) {
          const itemsData = itemsSheet.getDataRange().getValues();
          for (let j = itemsData.length - 1; j >= 1; j--) {
            if (itemsData[j][1] === quoteId) {
              itemsSheet.deleteRow(j + 1);
            }
          }
        }

        quoteSheet.deleteRow(i + 1);
        deletedCount++;
        Logger.log('削除: 見積書 - ' + quoteId);
      }
    }
  }

  Logger.log('\n✅ クリーンアップ完了: ' + deletedCount + '件のテストデータを削除しました');
}
