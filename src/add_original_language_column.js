/**
 * 会話ログシートに「原文言語」列を追加する
 * 既存データには既存ロジックで言語を推定して記録
 */
function addOriginalLanguageColumn() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const originalTextIndex = headers.indexOf('原文');
  const translatedTextIndex = headers.indexOf('翻訳文');

  if (originalTextIndex === -1) {
    throw new Error('原文列が見つかりません');
  }

  // 「原文言語」列が既に存在するか確認
  if (headers.indexOf('原文言語') !== -1) {
    Logger.log('⚠️ 「原文言語」列は既に存在します');
    return '「原文言語」列は既に存在します';
  }

  // 「原文」の次の列（translatedTextIndexの前）に「原文言語」を挿入
  const insertColumnIndex = originalTextIndex + 2; // 1-indexed, 原文の次

  Logger.log('📝 列を挿入: 位置 ' + insertColumnIndex);
  sheet.insertColumnAfter(originalTextIndex + 1);

  // ヘッダーを設定
  sheet.getRange(1, insertColumnIndex).setValue('原文言語');
  sheet.getRange(1, insertColumnIndex).setFontWeight('bold');
  sheet.getRange(1, insertColumnIndex).setBackground('#4a86e8');
  sheet.getRange(1, insertColumnIndex).setFontColor('#ffffff');

  // 列幅を設定
  sheet.setColumnWidth(insertColumnIndex, 50);

  Logger.log('✅ ヘッダー「原文言語」を追加しました');

  // 既存データに言語を推定して記録
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    Logger.log('📊 既存データ ' + (lastRow - 1) + ' 件に言語を推定します...');

    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const updates = [];

    dataRange.forEach((row, index) => {
      const originalText = row[originalTextIndex];
      const language = detectLanguage(originalText);
      updates.push([language]);
    });

    // 一括更新
    if (updates.length > 0) {
      sheet.getRange(2, insertColumnIndex, updates.length, 1).setValues(updates);
      Logger.log('✅ ' + updates.length + ' 件のデータに言語を記録しました');
    }
  }

  Logger.log('🎉 「原文言語」列の追加が完了しました');
  return '完了: 「原文言語」列を追加し、' + (lastRow - 1) + ' 件のデータに言語を記録しました';
}

// detectLanguage() は 10_ConversationLogService.gs に一元化済み
