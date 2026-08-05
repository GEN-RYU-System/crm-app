/**
 * 会話ログの列定義とシートの実際の構造を検証
 * すべての列がずれていないか徹底的にチェック
 */

function verifyConversationLogAlignment() {
  const ss = getSpreadsheet();

  // 検証結果を格納
  const results = {
    timestamp: new Date().toISOString(),
    expectedHeaders: HEADERS.CONVERSATION_LOG,
    sheets: {}
  };

  // まず全シートを取得して会話ログ関連シートを自動検出
  const allSheets = ss.getSheets();
  Logger.log('📊 スプレッドシート内の全シート:');
  allSheets.forEach((sheet, index) => {
    Logger.log(`  ${index + 1}. ${sheet.getName()}`);
  });
  Logger.log('');

  // 会話ログ関連シートを自動検出（"会話ログ" または "Log" を含む）
  const conversationLogSheets = allSheets
    .map(sheet => sheet.getName())
    .filter(name => name.includes('会話ログ') || name.includes('Log'));

  Logger.log('🔍 検出された会話ログ関連シート:');
  conversationLogSheets.forEach(name => {
    Logger.log(`  - ${name}`);
  });
  Logger.log('');

  // 検証対象シート
  const sheetsToCheck = conversationLogSheets.length > 0
    ? conversationLogSheets
    : ['会話ログ（商談用）']; // フォールバック

  Logger.log('='.repeat(80));
  Logger.log('会話ログ列定義検証開始');
  Logger.log('='.repeat(80));
  Logger.log('');

  // 期待されるヘッダー（CONFIG定義）
  Logger.log('【期待されるヘッダー定義】 (HEADERS.CONVERSATION_LOG)');
  HEADERS.CONVERSATION_LOG.forEach((header, index) => {
    Logger.log(`  ${index + 1}列目: ${header}`);
  });
  Logger.log('  合計: ' + HEADERS.CONVERSATION_LOG.length + ' 列');
  Logger.log('');

  // 各シートを検証
  sheetsToCheck.forEach(sheetName => {
    Logger.log('-'.repeat(80));
    Logger.log(`【シート: ${sheetName}】`);
    Logger.log('-'.repeat(80));

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('  ⚠️ シートが見つかりません');
      results.sheets[sheetName] = { error: 'シートが見つかりません' };
      return;
    }

    // 実際のヘッダーを取得
    const lastCol = sheet.getLastColumn();
    const actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    Logger.log('');
    Logger.log('【実際のシートヘッダー】');
    actualHeaders.forEach((header, index) => {
      Logger.log(`  ${index + 1}列目: ${header}`);
    });
    Logger.log('  合計: ' + actualHeaders.length + ' 列');
    Logger.log('');

    // 列数比較
    const sheetResult = {
      actualHeaders: actualHeaders,
      columnCount: {
        expected: HEADERS.CONVERSATION_LOG.length,
        actual: actualHeaders.length,
        match: HEADERS.CONVERSATION_LOG.length === actualHeaders.length
      },
      headerComparison: [],
      dataSample: []
    };

    Logger.log('【列数比較】');
    Logger.log(`  期待: ${sheetResult.columnCount.expected} 列`);
    Logger.log(`  実際: ${sheetResult.columnCount.actual} 列`);
    Logger.log(`  判定: ${sheetResult.columnCount.match ? '✅ 一致' : '❌ 不一致'}`);
    Logger.log('');

    // ヘッダー名の比較
    Logger.log('【ヘッダー名比較】');
    const maxLength = Math.max(HEADERS.CONVERSATION_LOG.length, actualHeaders.length);

    for (let i = 0; i < maxLength; i++) {
      const expected = HEADERS.CONVERSATION_LOG[i] || '(定義なし)';
      const actual = actualHeaders[i] || '(列なし)';
      const match = expected === actual;

      const comparison = {
        column: i + 1,
        expected: expected,
        actual: actual,
        match: match
      };

      sheetResult.headerComparison.push(comparison);

      const status = match ? '✅' : '❌';
      Logger.log(`  ${status} ${i + 1}列目: 期待="${expected}" | 実際="${actual}"`);
    }
    Logger.log('');

    // データサンプル取得（最新5件）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      Logger.log('【データサンプル】最新5件の実際のデータ');
      Logger.log('');

      const sampleSize = Math.min(5, lastRow - 1);
      const startRow = Math.max(2, lastRow - sampleSize + 1);
      const dataRange = sheet.getRange(startRow, 1, sampleSize, lastCol).getValues();

      dataRange.forEach((row, rowIndex) => {
        const actualRowNumber = startRow + rowIndex;
        Logger.log(`  --- 行 ${actualRowNumber} ---`);

        const rowData = {};
        row.forEach((value, colIndex) => {
          const headerName = actualHeaders[colIndex] || `(列${colIndex + 1})`;
          const displayValue = value === '' ? '(空)' : value;
          Logger.log(`    ${headerName}: ${displayValue}`);
          rowData[headerName] = value;
        });

        sheetResult.dataSample.push({
          row: actualRowNumber,
          data: rowData
        });

        Logger.log('');
      });
    } else {
      Logger.log('【データサンプル】データがありません');
      Logger.log('');
    }

    results.sheets[sheetName] = sheetResult;
  });

  // 総合判定
  Logger.log('='.repeat(80));
  Logger.log('【総合判定】');
  Logger.log('='.repeat(80));

  let allMatch = true;
  Object.entries(results.sheets).forEach(([sheetName, result]) => {
    if (result.error) {
      Logger.log(`❌ ${sheetName}: エラー - ${result.error}`);
      allMatch = false;
    } else if (!result.columnCount.match) {
      Logger.log(`❌ ${sheetName}: 列数不一致 (期待${result.columnCount.expected}列, 実際${result.columnCount.actual}列)`);
      allMatch = false;
    } else {
      const mismatchCount = result.headerComparison.filter(c => !c.match).length;
      if (mismatchCount > 0) {
        Logger.log(`❌ ${sheetName}: ヘッダー名不一致 (${mismatchCount}箇所)`);
        allMatch = false;
      } else {
        Logger.log(`✅ ${sheetName}: すべて一致`);
      }
    }
  });

  Logger.log('');
  if (allMatch) {
    Logger.log('🎉 すべてのシートで列定義が一致しています');
  } else {
    Logger.log('⚠️ 列定義の不一致が検出されました。上記の詳細を確認してください。');
  }

  Logger.log('');
  Logger.log('='.repeat(80));
  Logger.log('検証完了');
  Logger.log('='.repeat(80));

  return results;
}

/**
 * アーカイブブックの列定義も検証
 */
function verifyArchiveBookAlignment() {
  const archiveBookId = PropertiesService.getScriptProperties().getProperty('ARCHIVE_BOOK_ID');

  if (!archiveBookId) {
    Logger.log('⚠️ アーカイブブックIDが設定されていません');
    return null;
  }

  try {
    const archiveSs = SpreadsheetApp.openById(archiveBookId);

    Logger.log('='.repeat(80));
    Logger.log('アーカイブブック列定義検証開始');
    Logger.log('='.repeat(80));
    Logger.log('');

    const archiveSheets = [
      'リード会話ログ_アーカイブ',
      '商談会話ログ_成約',
      '商談会話ログ_失注',
      '商談会話ログ_追客',
      '商談会話ログ_対象外'
    ];

    archiveSheets.forEach(sheetName => {
      Logger.log('-'.repeat(80));
      Logger.log(`【アーカイブシート: ${sheetName}】`);
      Logger.log('-'.repeat(80));

      const sheet = archiveSs.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log('  ⚠️ シートが見つかりません');
        Logger.log('');
        return;
      }

      const lastCol = sheet.getLastColumn();
      const actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

      Logger.log('【実際のヘッダー】');
      actualHeaders.forEach((header, index) => {
        Logger.log(`  ${index + 1}列目: ${header}`);
      });
      Logger.log('  合計: ' + actualHeaders.length + ' 列');
      Logger.log('');

      // 期待値と比較
      Logger.log('【列数比較】');
      Logger.log(`  期待: ${HEADERS.CONVERSATION_LOG.length} 列`);
      Logger.log(`  実際: ${actualHeaders.length} 列`);
      Logger.log(`  判定: ${HEADERS.CONVERSATION_LOG.length === actualHeaders.length ? '✅ 一致' : '❌ 不一致'}`);
      Logger.log('');

      // ヘッダー名比較
      Logger.log('【ヘッダー名比較】');
      const maxLength = Math.max(HEADERS.CONVERSATION_LOG.length, actualHeaders.length);

      for (let i = 0; i < maxLength; i++) {
        const expected = HEADERS.CONVERSATION_LOG[i] || '(定義なし)';
        const actual = actualHeaders[i] || '(列なし)';
        const match = expected === actual;
        const status = match ? '✅' : '❌';
        Logger.log(`  ${status} ${i + 1}列目: 期待="${expected}" | 実際="${actual}"`);
      }
      Logger.log('');
    });

    Logger.log('='.repeat(80));
    Logger.log('アーカイブブック検証完了');
    Logger.log('='.repeat(80));

  } catch (e) {
    Logger.log('❌ アーカイブブックアクセスエラー: ' + e.message);
    return null;
  }
}

/**
 * すべての検証を実行
 */
function runFullColumnVerification() {
  Logger.log('');
  Logger.log('');
  Logger.log('##########################################################################');
  Logger.log('# 会話ログ列定義 完全検証');
  Logger.log('# ' + new Date().toLocaleString('ja-JP'));
  Logger.log('##########################################################################');
  Logger.log('');

  // 期待される列定義を明示
  Logger.log('【HEADERS.CONVERSATION_LOG 定義】');
  Logger.log('期待される列数: ' + HEADERS.CONVERSATION_LOG.length + ' 列');
  Logger.log('');
  HEADERS.CONVERSATION_LOG.forEach((header, index) => {
    Logger.log(`  ${index + 1}列目: ${header}`);
  });
  Logger.log('');
  Logger.log('');

  // メインCRMブックの検証
  const mainResults = verifyConversationLogAlignment();

  Logger.log('');
  Logger.log('');

  // アーカイブブックの検証
  verifyArchiveBookAlignment();

  Logger.log('');
  Logger.log('');
  Logger.log('##########################################################################');
  Logger.log('# 全検証完了');
  Logger.log('##########################################################################');

  return mainResults;
}
