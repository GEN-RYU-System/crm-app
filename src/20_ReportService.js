/**
 * ReportService.gs
 * 週次・月次レポート機能を提供するサービス
 * Phase 6: レポート機能
 */

// ==================== レポート取得関数 ====================

/**
 * 週次レポートを取得
 * @param {string} staffId - 担当者ID
 * @param {string} targetWeek - 対象週（YYYY/MM/DD形式）
 * @returns {Object} 週次レポートデータ
 */
function getWeeklyReport(staffId, targetWeek) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);

  if (!sheet || sheet.getLastRow() < 2) {
    return { report: null, targetWeek: targetWeek };
  }

  const reports = getSheetDataAsObjects(sheet);
  const report = reports.find(r =>
    r['担当者ID'] === staffId && r['対象週'] === targetWeek
  );

  return {
    report: report || null,
    targetWeek: targetWeek,
    exists: !!report
  };
}

/**
 * 月次レポートを取得
 * @param {string} staffId - 担当者ID
 * @param {string} targetMonth - 対象月（YYYY/MM形式）
 * @returns {Object} 月次レポートデータ
 */
function getMonthlyReport(staffId, targetMonth) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MONTHLY_REPORT);

  if (!sheet || sheet.getLastRow() < 2) {
    return { report: null, targetMonth: targetMonth };
  }

  const reports = getSheetDataAsObjects(sheet);
  const report = reports.find(r =>
    r['担当者ID'] === staffId && r['対象月'] === targetMonth
  );

  return {
    report: report || null,
    targetMonth: targetMonth,
    exists: !!report
  };
}

/**
 * 自分のレポート履歴を取得
 * @param {string} staffId - 担当者ID
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @param {number} limit - 取得件数
 * @returns {Array} レポートリスト
 */
function getMyReportHistory(staffId, reportType, limit) {
  limit = limit || 10;

  const ss = getSpreadsheet();
  const sheetName = reportType === 'monthly' ?
    CONFIG.SHEETS.MONTHLY_REPORT : CONFIG.SHEETS.WEEKLY_REPORT;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const reports = getSheetDataAsObjects(sheet);
  const myReports = reports
    .filter(r => r['担当者ID'] === staffId)
    .sort((a, b) => new Date(b['提出日時']) - new Date(a['提出日時']))
    .slice(0, limit);

  return myReports;
}

// ==================== レポート保存関数 ====================

/**
 * 週次レポートを保存
 * @param {string} staffId - 担当者ID
 * @param {string} targetWeek - 対象週
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 結果
 */
function saveWeeklyReport(staffId, targetWeek, reportData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet) {
    throw new Error('週次レポートシートが見つかりません');
  }

  // 担当者名を取得
  let staffName = '';
  if (staffSheet) {
    const staffData = getSheetDataAsObjects(staffSheet);
    const staff = staffData.find(s => s['担当者ID'] === staffId);
    if (staff) {
      staffName = getStaffFullName(staff);
    }
  }

  // 既存レポートを検索
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIdx = headers.indexOf('担当者ID');
  const weekIdx = headers.indexOf('対象週');

  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId && data[i][weekIdx] === targetWeek) {
      existingRow = i + 1;
      break;
    }
  }

  const now = new Date();

  if (existingRow > 0) {
    // 既存レポートを更新
    const rowData = [
      data[existingRow - 1][headers.indexOf('レポートID')],
      staffId,
      staffName,
      targetWeek,
      reportData.今週の成果 || '',
      reportData.良かった点 || '',
      reportData.改善点 || '',
      reportData.来週の目標 || '',
      reportData.困っていること || '',
      reportData.Buddyへの質問 || '',
      data[existingRow - 1][headers.indexOf('Buddyフィードバック')] || '',
      now
    ];
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    // 新規レポートを追加
    const reportId = generateReportId(sheet, 'WR');
    const newRow = [
      reportId,
      staffId,
      staffName,
      targetWeek,
      reportData.今週の成果 || '',
      reportData.良かった点 || '',
      reportData.改善点 || '',
      reportData.来週の目標 || '',
      reportData.困っていること || '',
      reportData.Buddyへの質問 || '',
      '', // Buddyフィードバック（後で更新）
      now
    ];
    sheet.appendRow(newRow);
  }

  // Buddyフィードバックを生成（非同期で良い）
  try {
    generateBuddyFeedbackForReport(staffId, targetWeek, 'weekly', reportData);
  } catch (e) {
    Logger.log('Buddyフィードバック生成エラー: ' + e.message);
  }

  return { success: true, reportId: existingRow > 0 ? data[existingRow - 1][0] : 'NEW' };
}

/**
 * 月次レポートを保存
 * @param {string} staffId - 担当者ID
 * @param {string} targetMonth - 対象月
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 結果
 */
function saveMonthlyReport(staffId, targetMonth, reportData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MONTHLY_REPORT);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet) {
    throw new Error('月次レポートシートが見つかりません');
  }

  // 担当者名を取得
  let staffName = '';
  if (staffSheet) {
    const staffData = getSheetDataAsObjects(staffSheet);
    const staff = staffData.find(s => s['担当者ID'] === staffId);
    if (staff) {
      staffName = getStaffFullName(staff);
    }
  }

  // 既存レポートを検索
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIdx = headers.indexOf('担当者ID');
  const monthIdx = headers.indexOf('対象月');

  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId && data[i][monthIdx] === targetMonth) {
      existingRow = i + 1;
      break;
    }
  }

  const now = new Date();

  if (existingRow > 0) {
    // 既存レポートを更新
    const rowData = [
      data[existingRow - 1][headers.indexOf('レポートID')],
      staffId,
      staffName,
      targetMonth,
      reportData.今月の成果 || '',
      reportData.良かった点 || '',
      reportData.改善点 || '',
      reportData.来月の目標 || '',
      data[existingRow - 1][headers.indexOf('Buddyフィードバック')] || '',
      now
    ];
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    // 新規レポートを追加
    const reportId = generateReportId(sheet, 'MR');
    const newRow = [
      reportId,
      staffId,
      staffName,
      targetMonth,
      reportData.今月の成果 || '',
      reportData.良かった点 || '',
      reportData.改善点 || '',
      reportData.来月の目標 || '',
      '', // Buddyフィードバック（後で更新）
      now
    ];
    sheet.appendRow(newRow);
  }

  // Buddyフィードバックを生成
  try {
    generateBuddyFeedbackForReport(staffId, targetMonth, 'monthly', reportData);
  } catch (e) {
    Logger.log('Buddyフィードバック生成エラー: ' + e.message);
  }

  return { success: true };
}

// ==================== ヘルパー関数 ====================

/**
 * レポートIDを生成
 * @param {Sheet} sheet - シート
 * @param {string} prefix - プレフィックス（WR/MR）
 * @returns {string} レポートID
 */
function generateReportId(sheet, prefix) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return prefix + '-00001';
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith(prefix)) {
      const num = parseInt(id.replace(prefix + '-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return prefix + '-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * Buddyフィードバックを生成（スタブ）
 * @param {string} staffId - 担当者ID
 * @param {string} period - 対象期間
 * @param {string} type - レポートタイプ
 * @param {Object} reportData - レポートデータ
 */
function generateBuddyFeedbackForReport(staffId, period, type, reportData) {
  // 将来的にAI連携で自動フィードバック生成
  // 現時点ではスタブとして実装

  const ss = getSpreadsheet();
  const sheetName = type === 'monthly' ?
    CONFIG.SHEETS.MONTHLY_REPORT : CONFIG.SHEETS.WEEKLY_REPORT;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIdx = headers.indexOf('担当者ID');
  const periodIdx = type === 'monthly' ? headers.indexOf('対象月') : headers.indexOf('対象週');
  const feedbackIdx = headers.indexOf('Buddyフィードバック');

  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId && data[i][periodIdx] === period) {
      // シンプルなフィードバックを生成
      const feedback = generateSimpleFeedback(reportData, type);
      sheet.getRange(i + 1, feedbackIdx + 1).setValue(feedback);
      break;
    }
  }
}

/**
 * シンプルなフィードバックを生成
 * @param {Object} reportData - レポートデータ
 * @param {string} type - レポートタイプ
 * @returns {string} フィードバック
 */
function generateSimpleFeedback(reportData, type) {
  const achievements = type === 'monthly' ? reportData.今月の成果 : reportData.今週の成果;
  const goodPoints = reportData.良かった点;
  const improvements = reportData.改善点;

  let feedback = '';

  if (achievements) {
    feedback += `振り返りお疲れ様！${achievements.length > 50 ? '充実した成果だね。' : ''}`;
  }

  if (goodPoints) {
    feedback += ' 良かった点をしっかり振り返れているね。その調子！';
  }

  if (improvements) {
    feedback += ' 改善点も見つけられているのは素晴らしい。次に活かそう！';
  }

  if (!feedback) {
    feedback = 'レポートありがとう！次も頑張ろう！';
  }

  return feedback;
}

/**
 * 今週の対象週を取得
 * @returns {string} YYYY/MM/DD形式
 */
function getCurrentTargetWeek() {
  return getCurrentWeekMonday();
}

/**
 * 今月の対象月を取得
 * @returns {string} YYYY/MM形式
 */
function getCurrentTargetMonth() {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ==================== 管理者向け機能 ====================

/**
 * レポート提出状況を取得
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @param {string} period - 対象期間
 * @returns {Object} 提出状況
 */
function getReportSubmissionStatus(reportType, period) {
  const ss = getSpreadsheet();
  const sheetName = reportType === 'monthly' ?
    CONFIG.SHEETS.MONTHLY_REPORT : CONFIG.SHEETS.WEEKLY_REPORT;
  const reportSheet = ss.getSheetByName(sheetName);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    return { error: 'スタッフシートが見つかりません' };
  }

  const staffData = getSheetDataAsObjects(staffSheet);
  const reportData = reportSheet ? getSheetDataAsObjects(reportSheet) : [];

  // 有効なスタッフのみ
  const activeStaff = staffData.filter(s => s['ステータス'] === '有効');

  // 対象期間のレポート提出者を集計
  const periodKey = reportType === 'monthly' ? '対象月' : '対象週';
  const submittedStaffIds = new Set();
  reportData
    .filter(r => r[periodKey] === period)
    .forEach(r => submittedStaffIds.add(r['担当者ID']));

  const submitted = [];
  const notSubmitted = [];

  activeStaff.forEach(staff => {
    const staffInfo = {
      担当者ID: staff['担当者ID'],
      担当者名: getStaffFullName(staff),
      役割: staff['役割']
    };

    if (submittedStaffIds.has(staff['担当者ID'])) {
      submitted.push(staffInfo);
    } else {
      notSubmitted.push(staffInfo);
    }
  });

  return {
    period: period,
    reportType: reportType,
    submitted: submitted,
    notSubmitted: notSubmitted,
    submittedCount: submitted.length,
    totalCount: activeStaff.length,
    submissionRate: activeStaff.length > 0 ?
      Math.round((submitted.length / activeStaff.length) * 100) : 0
  };
}

/**
 * チームレポート一覧を取得
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @param {string} period - 対象期間
 * @returns {Array} レポートリスト
 */
function getTeamReports(reportType, period) {
  const ss = getSpreadsheet();
  const sheetName = reportType === 'monthly' ?
    CONFIG.SHEETS.MONTHLY_REPORT : CONFIG.SHEETS.WEEKLY_REPORT;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const reports = getSheetDataAsObjects(sheet);
  const periodKey = reportType === 'monthly' ? '対象月' : '対象週';

  return reports
    .filter(r => r[periodKey] === period)
    .sort((a, b) => new Date(b['提出日時']) - new Date(a['提出日時']));
}
