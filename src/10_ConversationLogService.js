/**
 * 会話ログサービス
 * 会話ログの記録、取得、翻訳、要約を管理
 */

// ============================================================
// 会話ログシート作成（手動実行用）
// ============================================================

/**
 * 会話ログシートを作成（手動実行用）
 * 統合された単一シートを作成
 */
function setupConversationLogSheets() {
  const ss = getSpreadsheet();

  // 会話ログ（統合シート）
  createConversationLogSheet(ss, CONFIG.SHEETS.CONVERSATION_LOG, '#4a86e8');

  // 専門用語辞書
  createTermDictionarySheet(ss);

  Logger.log('会話ログシートと専門用語辞書シートを作成しました');
  SpreadsheetApp.getActiveSpreadsheet().toast('会話ログシートを作成しました', 'セットアップ完了', 5);
}

/**
 * 会話ログシートを作成
 */
function createConversationLogSheet(ss, sheetName, headerColor) {
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return sheet;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = HEADERS.CONVERSATION_LOG;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(headerColor);
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // ログID
  sheet.setColumnWidth(2, 100);  // リードID
  sheet.setColumnWidth(3, 150);  // 日時
  sheet.setColumnWidth(4, 60);   // 送受信
  sheet.setColumnWidth(5, 100);  // 発言者
  sheet.setColumnWidth(6, 400);  // 原文
  sheet.setColumnWidth(7, 400);  // 翻訳文
  sheet.setColumnWidth(8, 80);   // 記録者ID
  sheet.setColumnWidth(9, 150);  // 記録日時

  // 送受信プルダウン
  const sendReceiveRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['送信', '受信'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 4, 1000, 1).setDataValidation(sendReceiveRule);

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

/**
 * 専門用語辞書シートを作成
 */
function createTermDictionarySheet(ss) {
  const sheetName = CONFIG.SHEETS.TERM_DICTIONARY;
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return sheet;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = HEADERS.TERM_DICTIONARY;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#9c27b0');
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 150);  // 英語
  sheet.setColumnWidth(2, 150);  // 日本語
  sheet.setColumnWidth(3, 100);  // カテゴリ
  sheet.setColumnWidth(4, 200);  // 説明
  sheet.setColumnWidth(5, 60);   // 有効

  // 初期データ
  const initialData = [
    ['Box', 'ボックス', '商品形態', '30パック入り', 'TRUE'],
    ['Case', 'ケース', '商品形態', '6ボックス入り', 'TRUE'],
    ['Sealed', 'シュリンク付き', '状態', '未開封品', 'TRUE'],
    ['Booster', 'ブースター', '商品形態', '拡張パック', 'TRUE'],
    ['PSA', 'PSA鑑定', '鑑定', 'Professional Sports Authenticator', 'TRUE'],
    ['BGS', 'BGS鑑定', '鑑定', 'Beckett Grading Services', 'TRUE'],
    ['MOQ', '最小注文数', '取引条件', 'Minimum Order Quantity', 'TRUE'],
    ['FOB', '本船渡し', '貿易条件', 'Free On Board', 'TRUE'],
    ['CIF', '運賃保険料込み', '貿易条件', 'Cost Insurance and Freight', 'TRUE'],
    ['ETB', 'エリートトレーナーボックス', '商品形態', 'Elite Trainer Box', 'TRUE'],
    ['UPC', 'ウルトラプレミアムコレクション', '商品形態', 'Ultra Premium Collection', 'TRUE'],
    ['NM', 'ニアミント', '状態', 'Near Mint', 'TRUE'],
    ['LP', 'ライトプレイ', '状態', 'Light Played', 'TRUE'],
    ['MP', 'モデレートプレイ', '状態', 'Moderate Played', 'TRUE']
  ];

  if (initialData.length > 0) {
    sheet.getRange(2, 1, initialData.length, initialData[0].length).setValues(initialData);
  }

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

// ============================================================
// 会話ログ操作
// ============================================================

/**
 * 次のログIDを生成
 */
function generateNextLogId(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return 'LOG-00001';
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith('LOG-')) {
      const num = parseInt(id.replace('LOG-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return 'LOG-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * 会話ログを追加
 * @param {Object} data - ログデータ
 * @param {string} data.leadId - リードID
 * @param {Date} data.datetime - メッセージ日時
 * @param {string} data.direction - 送信/受信
 * @param {string} data.speaker - 発言者
 * @param {string} data.originalText - 原文
 * @param {string} data.translatedText - 翻訳文（オプション）
 * @param {string} data.recorderId - 記録者ID
 * @param {string} data.type - 'lead' または 'deal'
 */
function addConversationLog(data) {
  // 統合された会話ログシートを使用
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { success: false, error: 'シートが見つかりません: ' + sheetName };
  }

  const logId = generateNextLogId(sheetName);
  const now = new Date();

  const row = [
    logId,
    data.leadId,
    data.datetime || now,
    data.direction,
    data.speaker || '',
    data.originalText,
    data.translatedText || '',
    data.recorderId,
    now
  ];

  sheet.appendRow(row);

  // リード管理シートの会話関連列を更新
  updateLeadConversationInfo(data.leadId);

  return { success: true, logId: logId };
}

/**
 * リードIDで会話ログを取得
 * @param {string} leadId - リードID
 * @param {string} type - 互換性のため残しているが、現在は使用しない
 */
function getConversationLogs(leadId, type) {
  const logs = [];

  // 統合された会話ログシートを使用
  const sheetName = CONFIG.SHEETS.CONVERSATION_LOG;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    // 日時でソート（新しい順）
    logs.sort((a, b) => new Date(b['日時']) - new Date(a['日時']));
    return logs;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === leadId) {
      const log = {};
      headers.forEach((header, idx) => {
        log[header] = data[i][idx];
      });
      log._source = sheetName;
      logs.push(log);
    }
  }

  // 日時でソート（新しい順）
  logs.sort((a, b) => new Date(b['日時']) - new Date(a['日時']));

  return logs;
}

/**
 * リード管理シートの会話関連列を更新
 */
function updateLeadConversationInfo(leadId) {
  const logs = getConversationLogs(leadId);

  if (logs.length === 0) return;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('リードID');
  const summaryIdx = headers.indexOf('会話要約');
  const lastDateIdx = headers.indexOf('最終会話日時');
  const countIdx = headers.indexOf('会話数');

  if (leadIdIdx === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      // 会話数
      if (countIdx >= 0) {
        sheet.getRange(i + 1, countIdx + 1).setValue(logs.length);
      }

      // 最終会話日時
      if (lastDateIdx >= 0 && logs[0]) {
        sheet.getRange(i + 1, lastDateIdx + 1).setValue(logs[0]['日時']);
      }

      // 会話要約（直近5件から生成）
      if (summaryIdx >= 0) {
        const recentLogs = logs.slice(0, 10);
        const summary = generateConversationSummaryText(recentLogs);
        sheet.getRange(i + 1, summaryIdx + 1).setValue(summary);
      }

      break;
    }
  }
}

/**
 * 会話要約テキストを生成（シンプル版）
 */
function generateConversationSummaryText(logs) {
  if (!logs || logs.length === 0) return '';

  // 直近5往復（10メッセージ）のキーワードを抽出
  const keywords = [];
  const recentLogs = logs.slice(0, 10);

  recentLogs.forEach(log => {
    const text = log['翻訳文'] || log['原文'] || '';
    // 簡易的なキーワード抽出（数字や短い文を含む）
    if (text.length > 0) {
      const snippet = text.substring(0, 30);
      keywords.push(snippet);
    }
  });

  // 50文字以内に収める
  let summary = keywords.slice(0, 3).join(' / ');
  if (summary.length > 50) {
    summary = summary.substring(0, 47) + '...';
  }

  return summary;
}

/**
 * Gemini APIで会話要約を生成（高度版）
 * @param {string} leadId - リードID
 */
function generateConversationSummary(leadId) {
  const logs = getConversationLogs(leadId);

  if (logs.length === 0) {
    return { success: false, error: '会話ログがありません' };
  }

  // 直近5往復を抽出
  const recentLogs = logs.slice(0, 10);

  // 会話テキストを構築
  let conversationText = '';
  recentLogs.reverse().forEach(log => {
    const direction = log['送受信'] === '送信' ? '自社' : '顧客';
    const text = log['翻訳文'] || log['原文'] || '';
    conversationText += `${direction}: ${text}\n`;
  });

  // Gemini APIキーを取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    // APIキーがない場合はシンプル版を使用
    return {
      success: true,
      summary: generateConversationSummaryText(logs)
    };
  }

  try {
    const prompt = `以下の顧客との会話を50文字以内で要約してください。重要なポイントや次のアクションに必要な情報を含めてください。\n\n${conversationText}`;

    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.3
          }
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { success: true, summary: summary.substring(0, 50) };
  } catch (e) {
    Logger.log('Gemini API エラー: ' + e.message);
    return {
      success: true,
      summary: generateConversationSummaryText(logs)
    };
  }
}

// ============================================================
// 翻訳機能
// ============================================================

/**
 * メッセージを翻訳
 * @param {string} text - 原文
 * @param {string} direction - 'en-ja' または 'ja-en'
 */
function translateMessage(text, direction) {
  if (!text || text.trim() === '') {
    return { success: false, error: '翻訳するテキストがありません' };
  }

  // 専門用語辞書を取得
  const dictionary = getTermDictionary();

  // Gemini APIキーを取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEYが設定されていません' };
  }

  try {
    const sourceLang = direction === 'en-ja' ? '英語' : '日本語';
    const targetLang = direction === 'en-ja' ? '日本語' : '英語';

    // 辞書情報をプロンプトに含める
    let dictionaryHint = '';
    if (dictionary.length > 0) {
      const relevantTerms = dictionary
        .filter(term => {
          const searchTerm = direction === 'en-ja' ? term.english : term.japanese;
          return text.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .slice(0, 10);

      if (relevantTerms.length > 0) {
        dictionaryHint = '\n\n以下の専門用語を参考にしてください:\n';
        relevantTerms.forEach(term => {
          dictionaryHint += `- ${term.english} = ${term.japanese}\n`;
        });
      }
    }

    const prompt = `以下の${sourceLang}テキストを${targetLang}に翻訳してください。ビジネスメールの文脈で、トレーディングカード業界の専門用語を考慮してください。${dictionaryHint}\n\n原文:\n${text}\n\n翻訳結果のみを出力してください。`;

    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.2
          }
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    const translation = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { success: true, translation: translation.trim() };
  } catch (e) {
    Logger.log('翻訳エラー: ' + e.message);
    return { success: false, error: '翻訳に失敗しました: ' + e.message };
  }
}

/**
 * 専門用語辞書を取得
 */
function getTermDictionary() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.TERM_DICTIONARY);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const terms = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === true || data[i][4] === 'TRUE') {
      terms.push({
        english: data[i][0],
        japanese: data[i][1],
        category: data[i][2],
        description: data[i][3]
      });
    }
  }

  return terms;
}

/**
 * 翻訳して会話ログに追加
 * @param {Object} data - ログデータ（translateMessage用のdirectionを含む）
 */
function translateAndAddLog(data) {
  // 翻訳方向を判定（受信=英語→日本語、送信=日本語→英語）
  const direction = data.direction === '受信' ? 'en-ja' : 'ja-en';

  // 翻訳実行
  const translateResult = translateMessage(data.originalText, direction);

  if (translateResult.success) {
    data.translatedText = translateResult.translation;
  }

  // ログ追加
  const logResult = addConversationLog(data);

  return {
    success: logResult.success,
    logId: logResult.logId,
    translation: translateResult.success ? translateResult.translation : null,
    error: logResult.error || translateResult.error
  };
}
