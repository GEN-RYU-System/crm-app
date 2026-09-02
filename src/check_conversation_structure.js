/**
 * 会話ログシートの構造とサンプルデータを確認する関数
 * 結果を新しいシート「会話ログ_分析結果」に出力します
 */
function checkConversationLogStructure() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  // 出力先シートを作成または取得
  let outputSheetName = '会話ログ_分析結果';
  let outputSheet = ss.getSheetByName(outputSheetName);
  if (outputSheet) {
    ss.deleteSheet(outputSheet);
  }
  outputSheet = ss.insertSheet(outputSheetName);

  // ヘッダー行を取得
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 出力: ヘッダー一覧
  let row = 1;
  outputSheet.getRange(row, 1).setValue('=== ヘッダー一覧 ===');
  row++;
  headers.forEach((header, index) => {
    outputSheet.getRange(row, 1).setValue('列' + (index + 1));
    outputSheet.getRange(row, 2).setValue(header);
    row++;
  });

  row++; // 空行

  // サンプルデータを取得（最新5件）
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const sampleCount = Math.min(5, lastRow - 1);
    const dataRange = sheet.getRange(Math.max(2, lastRow - 4), 1, sampleCount, sheet.getLastColumn()).getValues();

    outputSheet.getRange(row, 1).setValue('=== サンプルデータ（最新' + sampleCount + '件） ===');
    row++;

    // ヘッダー行を書き込み
    headers.forEach((header, colIndex) => {
      outputSheet.getRange(row, colIndex + 1).setValue(header);
    });
    outputSheet.getRange(row, 1, 1, headers.length).setFontWeight('bold');
    row++;

    // データ行を書き込み
    dataRange.forEach((dataRow) => {
      dataRow.forEach((value, colIndex) => {
        outputSheet.getRange(row, colIndex + 1).setValue(value);
      });
      row++;
    });

    row++; // 空行
  }

  // 翻訳方向を記録する列があるか確認
  const translationDirectionColumns = [
    '翻訳方向',
    '翻訳種別',
    '和訳フラグ',
    '英訳フラグ',
    '原文言語',
    '翻訳先言語'
  ];

  outputSheet.getRange(row, 1).setValue('=== 翻訳方向関連の列の存在確認 ===');
  row++;
  translationDirectionColumns.forEach(colName => {
    const exists = headers.includes(colName);
    outputSheet.getRange(row, 1).setValue(colName);
    outputSheet.getRange(row, 2).setValue(exists ? '✅ 存在' : '❌ 存在しない');
    row++;
  });

  row++; // 空行

  // データ統計
  outputSheet.getRange(row, 1).setValue('=== データ統計 ===');
  row++;
  outputSheet.getRange(row, 1).setValue('ヘッダー数');
  outputSheet.getRange(row, 2).setValue(headers.length);
  row++;
  outputSheet.getRange(row, 1).setValue('データ行数');
  outputSheet.getRange(row, 2).setValue(lastRow - 1);

  // 列幅を自動調整
  outputSheet.autoResizeColumns(1, 10);

  Logger.log('✅ 分析結果をシート「' + outputSheetName + '」に出力しました');
  return '分析完了: シート「' + outputSheetName + '」を確認してください';
}

/**
 * 日本語を含むかどうかを判定する関数
 */
function containsJapanese(text) {
  if (!text) return false;
  // ひらがな、カタカナ、漢字の正規表現
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  return japaneseRegex.test(text);
}

/**
 * 会話ログの原文と翻訳文を分析して、どちらが日本語かを判定する
 */
function analyzeConversationLanguages() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const originalTextColIndex = headers.indexOf('original_text');
  const translatedTextColIndex = headers.indexOf('translated_text');

  if (originalTextColIndex === -1 || translatedTextColIndex === -1) {
    throw new Error('original_text または translated_text の列が見つかりません');
  }

  // サンプルデータを分析（最新10件）
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return '分析対象のデータがありません';
  }

  const sampleCount = Math.min(10, lastRow - 1);
  const dataRange = sheet.getRange(Math.max(2, lastRow - sampleCount + 1), 1, sampleCount, sheet.getLastColumn()).getValues();

  // 出力先シートを作成
  let outputSheetName = '言語分析結果';
  let outputSheet = ss.getSheetByName(outputSheetName);
  if (outputSheet) {
    ss.deleteSheet(outputSheet);
  }
  outputSheet = ss.insertSheet(outputSheetName);

  // ヘッダー
  let row = 1;
  outputSheet.getRange(row, 1).setValue('行番号');
  outputSheet.getRange(row, 2).setValue('原文');
  outputSheet.getRange(row, 3).setValue('原文は日本語？');
  outputSheet.getRange(row, 4).setValue('翻訳文');
  outputSheet.getRange(row, 5).setValue('翻訳文は日本語？');
  outputSheet.getRange(row, 6).setValue('推奨表示');
  outputSheet.getRange(row, 1, 1, 6).setFontWeight('bold');
  row++;

  // データを分析
  dataRange.forEach((dataRow, index) => {
    const originalText = dataRow[originalTextColIndex];
    const translatedText = dataRow[translatedTextColIndex];

    const originalIsJapanese = containsJapanese(originalText);
    const translatedIsJapanese = containsJapanese(translatedText);

    // 推奨表示を決定
    let recommended = '';
    if (originalIsJapanese && !translatedIsJapanese) {
      recommended = '原文';
    } else if (!originalIsJapanese && translatedIsJapanese) {
      recommended = '翻訳文';
    } else if (originalIsJapanese && translatedIsJapanese) {
      recommended = '両方日本語';
    } else {
      recommended = '両方英語';
    }

    outputSheet.getRange(row, 1).setValue(lastRow - sampleCount + 1 + index);
    outputSheet.getRange(row, 2).setValue(originalText);
    outputSheet.getRange(row, 3).setValue(originalIsJapanese ? '✅' : '❌');
    outputSheet.getRange(row, 4).setValue(translatedText);
    outputSheet.getRange(row, 5).setValue(translatedIsJapanese ? '✅' : '❌');
    outputSheet.getRange(row, 6).setValue(recommended);
    row++;
  });

  // 列幅を自動調整
  outputSheet.autoResizeColumns(1, 6);

  Logger.log('✅ 言語分析結果をシート「' + outputSheetName + '」に出力しました');
  return '分析完了: シート「' + outputSheetName + '」を確認してください';
}

/**
 * 分析結果を読み取る関数
 */
function readAnalysisResults() {
  const ss = getSpreadsheet();

  // 言語分析結果を読み取る
  const analysisSheet = ss.getSheetByName('言語分析結果');
  if (!analysisSheet) {
    return { error: 'シート「言語分析結果」が見つかりません。先にanalyzeConversationLanguages()を実行してください。' };
  }

  const lastRow = analysisSheet.getLastRow();
  if (lastRow <= 1) {
    return { error: '分析結果にデータがありません' };
  }

  const data = analysisSheet.getRange(2, 1, lastRow - 1, 6).getValues();

  const results = data.map(row => ({
    rowNumber: row[0],
    originalText: row[1],
    originalIsJapanese: row[2] === '✅',
    translatedText: row[3],
    translatedIsJapanese: row[4] === '✅',
    recommended: row[5]
  }));

  return {
    totalRows: results.length,
    results: results,
    summary: {
      originalJapaneseCount: results.filter(r => r.originalIsJapanese).length,
      translatedJapaneseCount: results.filter(r => r.translatedIsJapanese).length,
      recommendOriginal: results.filter(r => r.recommended === '原文').length,
      recommendTranslated: results.filter(r => r.recommended === '翻訳文').length,
      bothJapanese: results.filter(r => r.recommended === '両方日本語').length,
      bothEnglish: results.filter(r => r.recommended === '両方英語').length
    }
  };
}
