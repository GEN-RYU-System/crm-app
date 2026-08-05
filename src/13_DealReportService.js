/**
 * 商談レポートサービス
 * 商談レポートの保存、取得、ID生成を担当
 */

// シート名定数
const DEAL_REPORT_SHEETS = {
  DEAL_REPORT: '商談レポート',
  BUDDY_DIALOG_LOG: 'Buddy対話ログ',
  CONVERSATION_LOG: '会話ログ'
};

/**
 * 商談レポートを保存
 * @param {Object} data - レポートデータ
 * @returns {Object} 保存結果
 */
function saveDealReport(data) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);

    if (!sheet) {
      return { success: false, message: '商談レポートシートが見つかりません。setupDealReportSheets()を実行してください。' };
    }

    // レポートID生成
    const reportId = generateReportId();
    const now = new Date();

    // 商談データを取得
    const dealData = getDealDataForReport(data.dealId);

    // 行データを作成
    const rowData = [
      reportId,                           // レポートID
      data.staffId || '',                 // 担当者ID
      data.dealId || '',                  // 商談ID
      data.submitDate || now,             // 提出日
      data.dealStartDate || '',           // 商談開始日
      data.dealResult || '',              // 商談結果
      dealData ? dealData['顧客名'] : (data.customerName || ''), // 顧客名
      dealData ? dealData['国'] : (data.customerCountry || ''),  // 顧客の国
      Array.isArray(data.products) ? data.products.join(', ') : (data.products || ''), // 取り扱い商材
      Array.isArray(data.salesChannels) ? data.salesChannels.join(', ') : (data.salesChannels || ''), // 販売先
      data.customerType || '',            // 信頼重視/価格重視
      data.orderAmount || '',             // 1回の発注金額
      data.purchaseFrequency || '',       // 購入頻度
      data.monthlyOrderEstimate || '',    // 月の発注量見込み
      data.prospectLevel || '',            // 見込度
      data.dealFeeling || '',             // 商談の手応え
      data.goodPoints || '',              // 良かった点
      data.successPoints || '',           // 成約ポイント
      data.improvements || '',            // 改善点
      data.actionPlan || '',              // アクションプラン
      data.nextActionDate || data.reapproachDate || '',  // 次回アクション日（旧：再アプローチ日を統合）
      data.excludeReason || '',           // 対象外理由
      data.postponeReason || '',          // 見送り理由
      data.conversationLogId || '',       // 商談ログID
      '',                                 // Buddyフィードバック（後で更新）
      now                                 // 作成日時
    ];

    // データを追加
    sheet.appendRow(rowData);

    // 会話ログがある場合は保存
    let conversationLogId = '';
    if (data.conversationLog) {
      conversationLogId = saveConversationLog(data.dealId, data.conversationLog, data.staffId, dealData ? dealData['顧客名'] : '');
      // レポートに会話ログIDを更新
      const lastRow = sheet.getLastRow();
      const logIdColIndex = 25; // 商談ログID列
      sheet.getRange(lastRow, logIdColIndex).setValue(conversationLogId);
    }

    // Buddyフィードバックを生成
    let buddyFeedback = null;
    try {
      buddyFeedback = generateDealFeedback(data, data.conversationLog || '');
      if (buddyFeedback && buddyFeedback.buddyMessage) {
        // フィードバックを更新
        const lastRow = sheet.getLastRow();
        const feedbackColIndex = 26; // Buddyフィードバック列
        sheet.getRange(lastRow, feedbackColIndex).setValue(buddyFeedback.buddyMessage);
      }
    } catch (e) {
      Logger.log('Buddyフィードバック生成エラー: ' + e.message);
    }

    return {
      success: true,
      reportId: reportId,
      conversationLogId: conversationLogId,
      buddyFeedback: buddyFeedback
    };

  } catch (error) {
    Logger.log('商談レポート保存エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 会話ログを保存
 * @param {string} dealId - 商談ID
 * @param {string} log - ログ内容
 * @param {string} staffId - 担当者ID
 * @param {string} customerName - 顧客名
 * @returns {string} ログID
 */
function saveConversationLog(dealId, log, staffId, customerName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.CONVERSATION_LOG);

  if (!sheet) {
    Logger.log('会話ログシートが見つかりません');
    return '';
  }

  const logId = generateConversationLogId();
  const now = new Date();

  const rowData = [
    logId,          // ログID
    dealId || '',   // 商談ID
    staffId || '',  // 担当者ID
    customerName || '', // 顧客名
    log || '',      // ログ内容
    now             // 登録日時
  ];

  sheet.appendRow(rowData);
  return logId;
}

/**
 * 商談データを取得（レポート用）
 * @param {string} dealId - 商談ID（リードID）
 * @returns {Object|null} 商談データ
 */
function getDealDataForReport(dealId) {
  if (!dealId) return null;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === dealId) {
      const deal = {};
      headers.forEach((header, index) => {
        deal[header] = data[i][index];
      });
      return deal;
    }
  }

  return null;
}

/**
 * レポートID生成（RPT-00001形式）
 * @returns {string} レポートID
 */
function generateReportId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);

  if (!sheet || sheet.getLastRow() < 2) {
    return 'RPT-00001';
  }

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  ids.forEach(row => {
    const id = row[0];
    if (id && id.toString().startsWith('RPT-')) {
      const num = parseInt(id.replace('RPT-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return 'RPT-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * 会話ログID生成（CLOG-00001形式）
 * @returns {string} ログID
 */
function generateConversationLogId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.CONVERSATION_LOG);

  if (!sheet || sheet.getLastRow() < 2) {
    return 'CLOG-00001';
  }

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  ids.forEach(row => {
    const id = row[0];
    if (id && id.toString().startsWith('CLOG-')) {
      const num = parseInt(id.replace('CLOG-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return 'CLOG-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * Buddy対話ログID生成（BLOG-00001形式）
 * @returns {string} ログID
 */
function generateBuddyLogId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.BUDDY_DIALOG_LOG);

  if (!sheet || sheet.getLastRow() < 2) {
    return 'BLOG-00001';
  }

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  ids.forEach(row => {
    const id = row[0];
    if (id && id.toString().startsWith('BLOG-')) {
      const num = parseInt(id.replace('BLOG-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return 'BLOG-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * Buddy対話ログを保存
 * @param {string} staffId - 担当者ID
 * @param {string} userInput - ユーザー入力
 * @param {string} buddyResponse - Buddy応答
 * @param {string} context - コンテキスト
 * @param {Object} emotionAnalysis - 感情分析結果
 * @returns {string} ログID
 */
function saveBuddyDialogLog(staffId, userInput, buddyResponse, context, emotionAnalysis) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.BUDDY_DIALOG_LOG);

  if (!sheet) {
    Logger.log('Buddy対話ログシートが見つかりません');
    return '';
  }

  const logId = generateBuddyLogId();
  const now = new Date();

  const rowData = [
    logId,
    staffId || '',
    now,
    userInput || '',
    buddyResponse || '',
    context || '',
    emotionAnalysis ? JSON.stringify(emotionAnalysis) : ''
  ];

  sheet.appendRow(rowData);
  return logId;
}

/**
 * 担当者の商談レポート一覧を取得
 * @param {string} staffId - 担当者ID
 * @returns {Array} レポート一覧
 */
function getDealReportsByStaff(staffId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIndex = headers.indexOf('担当者ID');

  const reports = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIndex] === staffId) {
      const report = {};
      headers.forEach((header, index) => {
        report[header] = data[i][index];
      });
      reports.push(report);
    }
  }

  return reports;
}

/**
 * 商談レポート用のプルダウン選択肢を取得
 * @returns {Object} 選択肢
 */
function getDealReportDropdownOptions() {
  const options = getDropdownOptions();

  // 商談レポート用の追加選択肢
  return {
    dealResult: options['商談結果'] || ['成約', '失注', '追客', '見送り', '対象外'],
    products: options['取り扱い商材'] || ['Pokemon', 'One Piece', 'Yu-Gi-Oh!', 'Dragon Ball', 'その他'],
    salesChannels: options['販売先'] || ['実店舗', 'EC', 'ライブ配信', '卸売', '複合', 'その他'],
    customerType: options['信頼重視/価格重視'] || ['信頼重視', '価格重視', '不明'],
    purchaseFrequency: options['購入頻度(月次)'] || ['週1以上', '週1', '月2-3回', '月1', '不定期', '不明'],
    partnershipLevel: ['5', '4', '3', '2', '1'],
    countries: options['国'] || DEFAULT_DROPDOWN_OPTIONS['国']
  };
}

/**
 * 特定の商談のレポート一覧を取得
 * @param {string} leadId - リードID（商談ID）
 * @returns {Array} レポート一覧
 */
function getDealReports(leadId) {
  if (!leadId) return [];

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dealIdIndex = headers.indexOf('商談ID');
  const submitDateIndex = headers.indexOf('提出日');
  const activityIndex = headers.indexOf('良かった点');

  if (dealIdIndex === -1) return [];

  const reports = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][dealIdIndex] === leadId) {
      const report = {};
      headers.forEach((header, index) => {
        let value = data[i][index];
        // Date オブジェクトは ISO 文字列に変換
        if (value instanceof Date) {
          value = value.toISOString();
        }
        report[header] = value;
      });
      // フロントエンド用にフィールド名を追加
      report['提出日時'] = report['提出日'];
      report['活動内容'] = report['良かった点'] || report['アクションプラン'] || '';
      reports.push(report);
    }
  }

  // 新しい順にソート
  reports.sort((a, b) => {
    const dateA = new Date(a['提出日時'] || 0);
    const dateB = new Date(b['提出日時'] || 0);
    return dateB - dateA;
  });

  return reports;
}

/**
 * スライドパネルからのレポート提出
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 保存結果
 */
function submitDealReportFromSlide(reportData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);

    // シートがなければ作成
    if (!sheet) {
      Logger.log('商談レポートシートがないため作成します');
      sheet = createDealReportSheet(ss);
    }

    const reportId = generateReportId();
    const now = new Date();

    // 簡易版の行データを作成（スライドパネル用）
    const rowData = [
      reportId,                           // レポートID
      reportData.staffId || '',           // 担当者ID
      reportData.leadId || '',            // 商談ID
      now,                                // 提出日
      '',                                 // 商談開始日
      '',                                 // 商談結果
      reportData.customerName || '',      // 顧客名
      '',                                 // 顧客の国
      '',                                 // 取り扱い商材
      '',                                 // 販売先
      '',                                 // 信頼重視/価格重視
      '',                                 // 1回の発注金額
      '',                                 // 購入頻度
      '',                                 // 月の発注量見込み
      '',                                 // パートナーシップ度
      '',                                 // 商談の手応え
      reportData.activity || '',          // 良かった点（活動内容として使用）
      '',                                 // 成約ポイント
      reportData.concerns || '',          // 改善点（課題・懸念点として使用）
      reportData.nextAction || '',        // アクションプラン
      '',                                 // 次回アクション日（旧：再アプローチ日を統合）
      '',                                 // 対象外理由
      '',                                 // 見送り理由
      '',                                 // 商談ログID
      '',                                 // Buddyフィードバック
      now                                 // 作成日時
    ];

    // データを追加
    sheet.appendRow(rowData);

    Logger.log('スライドパネルからレポート保存: ' + reportId);

    return {
      success: true,
      reportId: reportId
    };

  } catch (error) {
    Logger.log('スライドパネルレポート保存エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 商談レポートシートを作成
 * @param {Spreadsheet} ss - スプレッドシート
 * @returns {Sheet} 作成されたシート
 */
function createDealReportSheet(ss) {
  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    // 既存チェック
    sheet = ss.getSheetByName(DEAL_REPORT_SHEETS.DEAL_REPORT);
    if (!sheet) {
      sheet = ss.insertSheet(DEAL_REPORT_SHEETS.DEAL_REPORT);
    }
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'レポートID', '担当者ID', '商談ID', '提出日', '商談開始日', '商談結果',
    '顧客名', '顧客の国', '取り扱い商材', '販売先', '信頼重視/価格重視',
    '1回の発注金額', '購入頻度', '月の発注量見込み', 'パートナーシップ度',
    '商談の手応え', '良かった点', '成約ポイント', '改善点', 'アクションプラン',
    '次回アクション日', '対象外理由', '見送り理由',
    '商談ログID', 'Buddyフィードバック', '作成日時'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  Logger.log('商談レポートシートを作成しました');
  return sheet;
}
