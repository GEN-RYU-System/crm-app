/**
 * FAQ機能サービス
 * FAQの取得・作成・更新・削除を提供
 * Last updated: 2026-03-25
 */

/**
 * 全FAQデータを取得
 * @returns {Array} FAQデータ配列
 */
function getFAQData() {
  Logger.log('📚 getFAQData() called - START');

  try {
    // 環境確認
    Logger.log('📚 Environment: ' + getEnvironment());

    Logger.log('📚 Getting spreadsheet...');
    const ss = getSpreadsheet();
    Logger.log('📚 Spreadsheet ID: ' + ss.getId());
    Logger.log('📚 Spreadsheet name: ' + ss.getName());

    Logger.log('📚 CONFIG.SHEETS.FAQ: ' + CONFIG.SHEETS.FAQ);
    Logger.log('📚 Getting FAQ sheet...');
    const sheet = ss.getSheetByName(CONFIG.SHEETS.FAQ);

    if (!sheet) {
      // 利用可能なシート名をログ出力
      const availableSheets = ss.getSheets().map(s => s.getName());
      Logger.log('❌ FAQシートが見つかりません');
      Logger.log('❌ 利用可能なシート: ' + availableSheets.join(', '));

      return {
        success: false,
        error: 'FAQシートが見つかりません（シート名: ' + CONFIG.SHEETS.FAQ + '）',
        availableSheets: availableSheets,
        data: []
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('FAQデータがありません');
      return {
        success: true,
        data: []
      };
    }

    // ヘッダーとデータを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = dataRange.getValues();

    // データをオブジェクト配列に変換（Date型を文字列に変換）
    const faqList = values.map(row => {
      const faq = {};
      headers.forEach((header, index) => {
        const value = row[index];
        // Dateオブジェクトは文字列に変換（google.script.runでの転送可能にする）
        if (value instanceof Date) {
          faq[header] = value.toISOString();
        } else {
          faq[header] = value;
        }
      });
      return faq;
    });

    // 公開フラグがtrueのものだけフィルター（チェックボックス形式）
    const publicFAQs = faqList.filter(faq => faq['公開フラグ'] === true);

    // カテゴリ別、表示順でソート
    publicFAQs.sort((a, b) => {
      // カテゴリでソート
      if (a['カテゴリ'] !== b['カテゴリ']) {
        return a['カテゴリ'].localeCompare(b['カテゴリ'], 'ja');
      }
      // 同じカテゴリなら表示順でソート
      return (a['表示順'] || 999) - (b['表示順'] || 999);
    });

    Logger.log(`📚 FAQ取得成功: ${publicFAQs.length}件`);

    const result = {
      success: true,
      data: publicFAQs,
      // デバッグ情報
      _debug: {
        environment: getEnvironment(),
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetName: CONFIG.SHEETS.FAQ,
        rowCount: lastRow,
        publicCount: publicFAQs.length
      }
    };

    Logger.log('📚 getFAQData() - Returning result:', JSON.stringify({ success: result.success, dataCount: result.data.length }));

    return result;

  } catch (error) {
    Logger.log('❌ FAQ取得エラー: ' + error.message);
    Logger.log('❌ Error stack: ' + error.stack);

    const errorResult = {
      success: false,
      error: error.message,
      data: []
    };

    Logger.log('📚 getFAQData() - Returning error result:', JSON.stringify(errorResult));

    return errorResult;
  }
}

/**
 * 新しいFAQを作成
 * @param {Object} faqData FAQデータオブジェクト
 * @returns {Object} 結果オブジェクト
 */
function createFAQ(faqData) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.FAQ);

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    // FAQ IDを自動生成
    const faqId = generateNextFAQId();
    const today = new Date();

    // ヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 新しい行データを構築
    const newRow = [];
    headers.forEach(header => {
      if (header === 'FAQ ID') {
        newRow.push(faqId);
      } else if (header === '作成日' || header === '更新日') {
        newRow.push(today);
      } else if (header === '公開フラグ' && !faqData[header]) {
        newRow.push('非公開'); // デフォルト値
      } else if (header === '表示順' && !faqData[header]) {
        newRow.push(999); // デフォルト値
      } else {
        newRow.push(faqData[header] || '');
      }
    });

    // シートに追加
    sheet.appendRow(newRow);

    Logger.log(`FAQ作成成功: ${faqId}`);

    return {
      success: true,
      faqId: faqId,
      message: 'FAQを作成しました'
    };

  } catch (error) {
    Logger.log('FAQ作成エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 既存FAQを更新
 * @param {string} faqId FAQ ID
 * @param {Object} faqData 更新するFAQデータ
 * @returns {Object} 結果オブジェクト
 */
function updateFAQ(faqId, faqData) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.FAQ);

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    // ヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const faqIdColIndex = headers.indexOf('FAQ ID');

    if (faqIdColIndex === -1) {
      throw new Error('FAQ ID列が見つかりません');
    }

    // FAQ IDで行を検索
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    const values = dataRange.getValues();

    let targetRowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][faqIdColIndex] === faqId) {
        targetRowIndex = i + 2; // 2行目から開始（1行目はヘッダー）
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`FAQ ID「${faqId}」が見つかりません`);
    }

    // 更新日を設定
    const today = new Date();

    // 各列を更新
    headers.forEach((header, index) => {
      if (header === 'FAQ ID') {
        // IDは更新しない
        return;
      } else if (header === '更新日') {
        sheet.getRange(targetRowIndex, index + 1).setValue(today);
      } else if (faqData.hasOwnProperty(header)) {
        sheet.getRange(targetRowIndex, index + 1).setValue(faqData[header]);
      }
    });

    Logger.log(`FAQ更新成功: ${faqId}`);

    return {
      success: true,
      faqId: faqId,
      message: 'FAQを更新しました'
    };

  } catch (error) {
    Logger.log('FAQ更新エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * FAQを削除（論理削除: 公開フラグを「非公開」に変更）
 * @param {string} faqId FAQ ID
 * @returns {Object} 結果オブジェクト
 */
function deleteFAQ(faqId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.FAQ);

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    // ヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const faqIdColIndex = headers.indexOf('FAQ ID');
    const flagColIndex = headers.indexOf('公開フラグ');
    const updateDateColIndex = headers.indexOf('更新日');

    if (faqIdColIndex === -1 || flagColIndex === -1) {
      throw new Error('必要な列が見つかりません');
    }

    // FAQ IDで行を検索
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    const values = dataRange.getValues();

    let targetRowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][faqIdColIndex] === faqId) {
        targetRowIndex = i + 2; // 2行目から開始
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`FAQ ID「${faqId}」が見つかりません`);
    }

    // 公開フラグを「非公開」に変更（論理削除）
    sheet.getRange(targetRowIndex, flagColIndex + 1).setValue('非公開');

    // 更新日を更新
    if (updateDateColIndex !== -1) {
      sheet.getRange(targetRowIndex, updateDateColIndex + 1).setValue(new Date());
    }

    Logger.log(`FAQ削除成功（論理削除）: ${faqId}`);

    return {
      success: true,
      faqId: faqId,
      message: 'FAQを削除しました'
    };

  } catch (error) {
    Logger.log('FAQ削除エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * FAQ IDを生成（99_SetupFAQSheet.gsの関数を再利用）
 * @returns {string} FAQ ID (FAQ-00001形式)
 */
function generateNextFAQId() {
  const prefix = 'FAQ-';
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.FAQ);

  if (!sheet || sheet.getLastRow() < 2) {
    return prefix + '00001';
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith(prefix)) {
      const num = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return prefix + String(maxNum + 1).padStart(5, '0');
}

/**
 * カテゴリ一覧を取得
 * @returns {Array} カテゴリ配列
 */
function getFAQCategories() {
  try {
    const ss = getSpreadsheet();
    const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

    if (!settingsSheet) {
      Logger.log('設定シートが見つかりません');
      return {
        success: false,
        error: '設定シートが見つかりません',
        categories: []
      };
    }

    // 設定シートから「FAQ_カテゴリ」列を取得
    const data = settingsSheet.getDataRange().getValues();
    const headers = data[0];
    const categoryColIndex = headers.indexOf('FAQ_カテゴリ');

    if (categoryColIndex === -1) {
      Logger.log('FAQ_カテゴリ列が見つかりません');
      return {
        success: false,
        error: 'FAQ_カテゴリ列が見つかりません',
        categories: []
      };
    }

    // カテゴリ値を収集（空白を除く）
    const categories = [];
    for (let i = 1; i < data.length; i++) {
      const category = data[i][categoryColIndex];
      if (category && category !== '') {
        categories.push(String(category));
      }
    }

    Logger.log(`カテゴリ取得成功: ${categories.length}件`);

    return {
      success: true,
      categories: categories
    };

  } catch (error) {
    Logger.log('カテゴリ取得エラー: ' + error.message);
    return {
      success: false,
      error: error.message,
      categories: []
    };
  }
}
