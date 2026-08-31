/**
 * BuddyReportService.gs
 * Buddy連携レポートサービス（週次・月次レポート提出＋AIフィードバック）
 * 2026-01-22追加
 *
 * 機能:
 * - 週次レポートの提出・取得・更新
 * - 月次レポートの提出・取得・更新
 * - Buddyフィードバック生成（Gemini API連携）
 * - レポート一覧・検索
 */

// ============================================================
// シートヘッダー定義
// ============================================================

const WEEKLY_REPORT_HEADERS = [
  'レポートID',
  '担当者ID',
  '担当者名',
  '週',           // 例: 2026-W04
  '今週の振り返り',
  '来週の目標',
  '課題・悩み',
  'Buddyフィードバック',
  '提出日時',
  '確認者',
  '確認日時',
  'コメント'
];

const MONTHLY_REPORT_HEADERS = [
  'レポートID',
  '担当者ID',
  '担当者名',
  '年月',         // 例: 2026-01
  '月間振り返り',
  '来月目標',
  '達成度自己評価',
  'Buddyフィードバック',
  '提出日時',
  '上長コメント'
];

// ============================================================
// 週次レポート
// ============================================================

/**
 * 週次レポートを提出
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 結果
 */
function submitWeeklyReport(reportData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('週次レポート');

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet('週次レポート');
    sheet.appendRow(WEEKLY_REPORT_HEADERS);
    sheet.setFrozenRows(1);
  }

  const { staffId, week, review, goals, challenges } = reportData;

  // 担当者名を取得
  const staffName = getStaffNameById(staffId);
  if (!staffName) {
    return { success: false, error: '担当者が見つかりません: ' + staffId };
  }

  // 既存レポートをチェック
  const existingReport = findWeeklyReport(staffId, week);
  if (existingReport) {
    return {
      success: false,
      error: 'この週のレポートは既に提出済みです',
      existingReportId: existingReport.reportId
    };
  }

  // レポートID生成
  const reportId = generateBuddyReportId('WR');

  // Buddyフィードバック生成（非同期処理用にオプション）
  let buddyFeedback = '';
  if (reportData.generateBuddyFeedback !== false) {
    buddyFeedback = generateWeeklyBuddyFeedback(staffId, review, goals, challenges);
  }

  const now = new Date();

  // データ追加
  const newRow = [
    reportId,
    staffId,
    staffName,
    week,
    review || '',
    goals || '',
    challenges || '',
    buddyFeedback,
    now,
    '',  // 確認者
    '',  // 確認日時
    ''   // コメント
  ];

  sheet.appendRow(newRow);

  return {
    success: true,
    reportId: reportId,
    staffId: staffId,
    week: week,
    buddyFeedback: buddyFeedback,
    submittedAt: now.toISOString()
  };
}

/**
 * 週次レポートを取得（Buddy連携版）
 * @param {string} staffId - 担当者ID
 * @param {string} week - 週（省略時は全件）
 * @returns {Object} レポートデータ
 */
function getBuddyWeeklyReports(staffId, week) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('週次レポート');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, reports: [], total: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('担当者ID');
  const weekIdx = headers.indexOf('週');

  const reports = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 担当者でフィルタ
    if (staffId && row[staffIdIdx] !== staffId) continue;

    // 週でフィルタ
    if (week && row[weekIdx] !== week) continue;

    const report = {};
    headers.forEach((header, idx) => {
      report[header] = row[idx];
    });
    reports.push(report);
  }

  // 新しい順にソート
  reports.sort((a, b) => {
    const dateA = a['提出日時'] instanceof Date ? a['提出日時'] : new Date(a['提出日時']);
    const dateB = b['提出日時'] instanceof Date ? b['提出日時'] : new Date(b['提出日時']);
    return dateB - dateA;
  });

  return {
    success: true,
    reports: reports,
    total: reports.length
  };
}

/**
 * 週次レポートを検索
 * @param {string} staffId - 担当者ID
 * @param {string} week - 週
 * @returns {Object|null} レポート
 */
function findWeeklyReport(staffId, week) {
  const result = getBuddyWeeklyReports(staffId, week);
  if (result.reports.length > 0) {
    return {
      reportId: result.reports[0]['レポートID'],
      ...result.reports[0]
    };
  }
  return null;
}

/**
 * 週次レポートを確認（上長コメント追加）
 * @param {string} reportId - レポートID
 * @param {string} reviewerId - 確認者ID
 * @param {string} comment - コメント
 * @returns {Object} 結果
 */
function confirmWeeklyReport(reportId, reviewerId, comment) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('週次レポート');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: '週次レポートシートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const reportIdIdx = headers.indexOf('レポートID');
  const reviewerIdx = headers.indexOf('確認者');
  const reviewDateIdx = headers.indexOf('確認日時');
  const commentIdx = headers.indexOf('コメント');

  for (let i = 1; i < data.length; i++) {
    if (data[i][reportIdIdx] === reportId) {
      const reviewerName = getStaffNameById(reviewerId) || reviewerId;
      const now = new Date();

      sheet.getRange(i + 1, reviewerIdx + 1).setValue(reviewerName);
      sheet.getRange(i + 1, reviewDateIdx + 1).setValue(now);
      sheet.getRange(i + 1, commentIdx + 1).setValue(comment || '');

      return {
        success: true,
        reportId: reportId,
        reviewer: reviewerName,
        confirmedAt: now.toISOString()
      };
    }
  }

  return { success: false, error: 'レポートが見つかりません: ' + reportId };
}

// ============================================================
// 月次レポート
// ============================================================

/**
 * 月次レポートを提出
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 結果
 */
function submitMonthlyReport(reportData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('月次レポート');

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet('月次レポート');
    sheet.appendRow(MONTHLY_REPORT_HEADERS);
    sheet.setFrozenRows(1);
  }

  const { staffId, yearMonth, review, goals, selfEvaluation } = reportData;

  // 担当者名を取得
  const staffName = getStaffNameById(staffId);
  if (!staffName) {
    return { success: false, error: '担当者が見つかりません: ' + staffId };
  }

  // 既存レポートをチェック
  const existingReport = findMonthlyReport(staffId, yearMonth);
  if (existingReport) {
    return {
      success: false,
      error: 'この月のレポートは既に提出済みです',
      existingReportId: existingReport.reportId
    };
  }

  // レポートID生成
  const reportId = generateBuddyReportId('MR');

  // Buddyフィードバック生成
  let buddyFeedback = '';
  if (reportData.generateBuddyFeedback !== false) {
    buddyFeedback = generateMonthlyBuddyFeedback(staffId, yearMonth, review, goals, selfEvaluation);
  }

  const now = new Date();

  // データ追加
  const newRow = [
    reportId,
    staffId,
    staffName,
    yearMonth,
    review || '',
    goals || '',
    selfEvaluation || '',
    buddyFeedback,
    now,
    ''  // 上長コメント
  ];

  sheet.appendRow(newRow);

  return {
    success: true,
    reportId: reportId,
    staffId: staffId,
    yearMonth: yearMonth,
    buddyFeedback: buddyFeedback,
    submittedAt: now.toISOString()
  };
}

/**
 * 月次レポートを取得
 * @param {string} staffId - 担当者ID
 * @param {string} yearMonth - 年月（省略時は全件）
 * @returns {Object} レポートデータ
 */
function getMonthlyReports(staffId, yearMonth) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('月次レポート');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, reports: [], total: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('担当者ID');
  const yearMonthIdx = headers.indexOf('年月');

  const reports = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 担当者でフィルタ
    if (staffId && row[staffIdIdx] !== staffId) continue;

    // 年月でフィルタ
    if (yearMonth && row[yearMonthIdx] !== yearMonth) continue;

    const report = {};
    headers.forEach((header, idx) => {
      report[header] = row[idx];
    });
    reports.push(report);
  }

  // 新しい順にソート
  reports.sort((a, b) => {
    const dateA = a['提出日時'] instanceof Date ? a['提出日時'] : new Date(a['提出日時']);
    const dateB = b['提出日時'] instanceof Date ? b['提出日時'] : new Date(b['提出日時']);
    return dateB - dateA;
  });

  return {
    success: true,
    reports: reports,
    total: reports.length
  };
}

/**
 * 月次レポートを検索
 * @param {string} staffId - 担当者ID
 * @param {string} yearMonth - 年月
 * @returns {Object|null} レポート
 */
function findMonthlyReport(staffId, yearMonth) {
  const result = getMonthlyReports(staffId, yearMonth);
  if (result.reports.length > 0) {
    return {
      reportId: result.reports[0]['レポートID'],
      ...result.reports[0]
    };
  }
  return null;
}

/**
 * 月次レポートにコメント追加
 * @param {string} reportId - レポートID
 * @param {string} reviewerId - 確認者ID
 * @param {string} comment - コメント
 * @returns {Object} 結果
 */
function addMonthlyReportComment(reportId, reviewerId, comment) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('月次レポート');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: '月次レポートシートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const reportIdIdx = headers.indexOf('レポートID');
  const commentIdx = headers.indexOf('上長コメント');

  for (let i = 1; i < data.length; i++) {
    if (data[i][reportIdIdx] === reportId) {
      const reviewerName = getStaffNameById(reviewerId) || reviewerId;

      // 既存コメントに追記
      const existingComment = data[i][commentIdx] || '';
      const newComment = existingComment
        ? existingComment + '\n---\n' + reviewerName + ' (' + new Date().toLocaleString('ja-JP') + '):\n' + comment
        : reviewerName + ' (' + new Date().toLocaleString('ja-JP') + '):\n' + comment;

      sheet.getRange(i + 1, commentIdx + 1).setValue(newComment);

      return {
        success: true,
        reportId: reportId,
        reviewer: reviewerName
      };
    }
  }

  return { success: false, error: 'レポートが見つかりません: ' + reportId };
}

// ============================================================
// Buddyフィードバック生成（Gemini API）
// ============================================================

/**
 * 週次レポート用Buddyフィードバック生成
 * @param {string} staffId - 担当者ID
 * @param {string} review - 今週の振り返り
 * @param {string} goals - 来週の目標
 * @param {string} challenges - 課題・悩み
 * @returns {string} フィードバック
 */
function generateWeeklyBuddyFeedback(staffId, review, goals, challenges) {
  // API使用制限チェック（20回/日）
  if (!checkBuddyApiLimit()) {
    return '(API使用制限に達しました。後ほど再生成してください)';
  }

  const staffName = getStaffNameById(staffId) || '担当者';

  const prompt = `あなたは営業チームのコーチング担当「Buddy」です。
以下の週次レポートを読んで、温かく建設的なフィードバックを提供してください。

【担当者】${staffName}

【今週の振り返り】
${review || '(記載なし)'}

【来週の目標】
${goals || '(記載なし)'}

【課題・悩み】
${challenges || '(記載なし)'}

---
フィードバックの観点:
1. 良かった点を具体的に褒める
2. 課題に対する具体的なアドバイス
3. 来週の目標に向けた応援メッセージ

※ 200字以内で、親しみやすい口調で書いてください。`;

  try {
    const feedback = callGeminiApi(prompt);
    incrementBuddyApiCount();
    return feedback;
  } catch (e) {
    Logger.log('Buddy feedback error: ' + e.message);
    return '(フィードバック生成に失敗しました)';
  }
}

/**
 * 月次レポート用Buddyフィードバック生成
 * @param {string} staffId - 担当者ID
 * @param {string} yearMonth - 年月
 * @param {string} review - 月間振り返り
 * @param {string} goals - 来月目標
 * @param {string} selfEvaluation - 達成度自己評価
 * @returns {string} フィードバック
 */
function generateMonthlyBuddyFeedback(staffId, yearMonth, review, goals, selfEvaluation) {
  // API使用制限チェック（20回/日）
  if (!checkBuddyApiLimit()) {
    return '(API使用制限に達しました。後ほど再生成してください)';
  }

  const staffName = getStaffNameById(staffId) || '担当者';

  // 実績データを取得
  const performance = getStaffMonthlyPerformance(staffId, yearMonth);

  const prompt = `あなたは営業チームのコーチング担当「Buddy」です。
以下の月次レポートと実績データを読んで、成長を促すフィードバックを提供してください。

【担当者】${staffName}
【対象月】${yearMonth}

【実績データ】
- 商談数: ${performance.dealCount}件
- 成約数: ${performance.wonCount}件
- 成約率: ${performance.winRate}%
- 売上: ${performance.revenue.toLocaleString()}円

【月間振り返り】
${review || '(記載なし)'}

【来月の目標】
${goals || '(記載なし)'}

【達成度自己評価】
${selfEvaluation || '(記載なし)'}

---
フィードバックの観点:
1. 実績データを踏まえた具体的な評価
2. 成長した点・改善できた点の指摘
3. 来月に向けた具体的なアドバイス
4. モチベーションを高める励まし

※ 300字以内で、親しみやすく専門的な口調で書いてください。`;

  try {
    const feedback = callGeminiApi(prompt);
    incrementBuddyApiCount();
    return feedback;
  } catch (e) {
    Logger.log('Buddy feedback error: ' + e.message);
    return '(フィードバック生成に失敗しました)';
  }
}

/**
 * Gemini APIを呼び出す
 * @param {string} prompt - プロンプト
 * @returns {string} 生成テキスト
 */
function callGeminiApi(prompt) {
  const apiKey = getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.candidates && result.candidates[0] && result.candidates[0].content) {
    return result.candidates[0].content.parts[0].text;
  }

  throw new Error('Unexpected API response');
}

/**
 * Buddy API使用制限をチェック
 * @returns {boolean} 使用可能かどうか
 */
function checkBuddyApiLimit() {
  const cache = CacheService.getScriptCache();
  const today = new Date().toISOString().split('T')[0];
  const key = 'BUDDY_API_COUNT_' + today;
  const count = parseInt(cache.get(key) || '0', 10);

  // 20回/日の制限
  return count < 20;
}

/**
 * Buddy API使用回数をインクリメント
 */
function incrementBuddyApiCount() {
  const cache = CacheService.getScriptCache();
  const today = new Date().toISOString().split('T')[0];
  const key = 'BUDDY_API_COUNT_' + today;
  const count = parseInt(cache.get(key) || '0', 10);

  // 24時間キャッシュ
  cache.put(key, String(count + 1), 86400);
}

/**
 * 担当者の月間実績を取得
 * @param {string} staffId - 担当者ID
 * @param {string} yearMonth - 年月（YYYY-MM形式）
 * @returns {Object} 実績データ
 */
function getStaffMonthlyPerformance(staffId, yearMonth) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  const defaultResult = { dealCount: 0, wonCount: 0, lostCount: 0, winRate: 0, revenue: 0 };

  if (!sheet || sheet.getLastRow() < 2) {
    return defaultResult;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('担当者ID');
  const statusIdx = headers.indexOf('進捗ステータス');
  const resultIdx = headers.indexOf('商談結果');
  const revenueIdx = headers.indexOf('初回取引金額');
  const updateIdx = headers.indexOf('シート更新日');

  // 対象月の範囲を計算
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  let dealCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let revenue = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (row[staffIdIdx] !== staffId) continue;

    const updateDate = row[updateIdx];
    if (!(updateDate instanceof Date)) continue;

    // 対象月の更新のみカウント
    if (updateDate < startDate || updateDate > endDate) continue;

    const status = row[statusIdx];
    const result = row[resultIdx];

    // 商談カウント
    if (CONFIG.DEAL_STATUSES.includes(status) || ['成約', '失注'].includes(result)) {
      dealCount++;
    }

    // 成約・失注カウント
    if (result === '成約') {
      wonCount++;
      revenue += parseFloat(row[revenueIdx]) || 0;
    } else if (result === '失注') {
      lostCount++;
    }
  }

  const totalClosed = wonCount + lostCount;
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

  return { dealCount, wonCount, lostCount, winRate, revenue };
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 担当者名を取得
 * @param {string} staffId - 担当者ID
 * @returns {string|null} 担当者名
 */
function getStaffNameById(staffId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('staff_id');
  const lastNameIdx = headers.indexOf('last_name_ja');
  const firstNameIdx = headers.indexOf('first_name_ja');

  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId) {
      return (data[i][lastNameIdx] || '') + ' ' + (data[i][firstNameIdx] || '');
    }
  }

  return null;
}

/**
 * Buddyレポート用IDを生成
 * @param {string} prefix - プレフィックス（WR/MR）
 * @returns {string} レポートID
 */
function generateBuddyReportId(prefix) {
  const now = new Date();
  const timestamp = now.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + '-' + timestamp + random;
}

/**
 * 現在の週番号を取得
 * @param {Date} date - 日付（省略時は今日）
 * @returns {string} 週番号（YYYY-Wxx形式）
 */
function getCurrentWeek(date) {
  date = date || new Date();
  const year = date.getFullYear();

  // ISO週番号を計算
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((date - jan1 + 1) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);

  return year + '-W' + String(weekNum).padStart(2, '0');
}

/**
 * 現在の年月を取得
 * @param {Date} date - 日付（省略時は今日）
 * @returns {string} 年月（YYYY-MM形式）
 */
function getCurrentYearMonth(date) {
  date = date || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

/**
 * チームのレポート提出状況を取得
 * @param {string} teamId - チームID
 * @param {string} week - 週番号
 * @returns {Object} 提出状況
 */
function getTeamReportStatus(teamId, week) {
  const members = getTeamMembers(teamId);
  const submittedIds = [];
  const pendingIds = [];

  members.forEach(member => {
    const report = findWeeklyReport(member.staffId, week);
    if (report) {
      submittedIds.push(member.staffId);
    } else {
      pendingIds.push(member.staffId);
    }
  });

  return {
    teamId: teamId,
    week: week,
    totalMembers: members.length,
    submitted: submittedIds.length,
    pending: pendingIds.length,
    submittedMembers: members.filter(m => submittedIds.includes(m.staffId)),
    pendingMembers: members.filter(m => pendingIds.includes(m.staffId)),
    submissionRate: members.length > 0
      ? Math.round((submittedIds.length / members.length) * 100)
      : 0
  };
}
