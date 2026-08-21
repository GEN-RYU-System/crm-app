/**
 * Buddy Feedback Logger - フィードバック理由記録システム
 */

/**
 * Buddyフィードバックを記録（Good/Bad+理由）
 * @param {string} knowledgeId - Knowledge ID
 * @param {string} feedbackType - 'Good' or 'Bad'
 * @param {string} reason - フィードバックの理由
 * @param {string} context - フィードバックが発生したコンテキスト（例: 週次レポート、商談メモ等）
 * @return {boolean} 記録成功したかどうか
 */
function recordBuddyFeedback(knowledgeId, feedbackType, reason, context = '') {
  try {
    const ss = getSpreadsheet();
    const knowledgeSheet = ss.getSheetByName('BuddyKnowledge');

    if (!knowledgeSheet) {
      throw new Error('BuddyKnowledgeシートが見つかりません');
    }

    // 1. BuddyKnowledgeシートのカウンタを更新
    updateKnowledgeCounter(knowledgeSheet, knowledgeId, feedbackType);

    // 2. 詳細ログを記録
    logFeedbackReason(knowledgeId, feedbackType, reason, context);

    // 3. Success Rateを再計算
    recalculateSuccessRate(knowledgeSheet, knowledgeId);

    return true;
  } catch (e) {
    Logger.log('Buddyフィードバック記録エラー: ' + e.message);
    return false;
  }
}

/**
 * BuddyKnowledgeシートのカウンタを更新
 * @param {Sheet} sheet - BuddyKnowledgeシート
 * @param {string} knowledgeId - Knowledge ID
 * @param {string} feedbackType - 'Good' or 'Bad'
 */
function updateKnowledgeCounter(sheet, knowledgeId, feedbackType) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('Knowledge ID');
  const positiveFeedbackCol = headers.indexOf('Positive Feedback');
  const negativeFeedbackCol = headers.indexOf('Negative Feedback');
  const usageCountCol = headers.indexOf('Usage Count');

  if (idCol === -1 || positiveFeedbackCol === -1 || negativeFeedbackCol === -1) {
    throw new Error('必要な列が見つかりません');
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === knowledgeId) {
      // Usage Countをインクリメント
      if (usageCountCol !== -1) {
        const currentUsage = data[i][usageCountCol] || 0;
        sheet.getRange(i + 1, usageCountCol + 1).setValue(currentUsage + 1);
      }

      // フィードバックカウンタをインクリメント
      if (feedbackType === 'Good') {
        const current = data[i][positiveFeedbackCol] || 0;
        sheet.getRange(i + 1, positiveFeedbackCol + 1).setValue(current + 1);
      } else if (feedbackType === 'Bad') {
        const current = data[i][negativeFeedbackCol] || 0;
        sheet.getRange(i + 1, negativeFeedbackCol + 1).setValue(current + 1);
      }

      return;
    }
  }

  Logger.log('警告: Knowledge ID ' + knowledgeId + ' が見つかりませんでした');
}

/**
 * フィードバック理由を詳細ログシートに記録
 * @param {string} knowledgeId - Knowledge ID
 * @param {string} feedbackType - 'Good' or 'Bad'
 * @param {string} reason - フィードバックの理由
 * @param {string} context - コンテキスト
 */
function logFeedbackReason(knowledgeId, feedbackType, reason, context) {
  const ss = getSpreadsheet();
  let logSheet = ss.getSheetByName('Buddy Feedback Log');

  // シートが存在しない場合は作成
  if (!logSheet) {
    logSheet = ss.insertSheet('Buddy Feedback Log');
    const headers = [
      'Log ID',
      'Knowledge ID',
      'Feedback Type',
      'Reason',
      'Context',
      'User Email',
      'Timestamp'
    ];
    logSheet.appendRow(headers);
    logSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#ff9800')
      .setFontColor('#ffffff');
    logSheet.setFrozenRows(1);
  }

  // ログIDを生成
  const logId = 'FB-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const user = resolveCurrentUserEmail();
  const timestamp = new Date();

  logSheet.appendRow([
    logId,
    knowledgeId,
    feedbackType,
    reason,
    context,
    user,
    timestamp
  ]);
}

/**
 * Success Rateを再計算
 * @param {Sheet} sheet - BuddyKnowledgeシート
 * @param {string} knowledgeId - Knowledge ID
 */
function recalculateSuccessRate(sheet, knowledgeId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('Knowledge ID');
  const positiveFeedbackCol = headers.indexOf('Positive Feedback');
  const negativeFeedbackCol = headers.indexOf('Negative Feedback');
  const successRateCol = headers.indexOf('Success Rate');

  if (successRateCol === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === knowledgeId) {
      const positive = data[i][positiveFeedbackCol] || 0;
      const negative = data[i][negativeFeedbackCol] || 0;
      const total = positive + negative;

      const successRate = total > 0 ? Math.round((positive / total) * 100) : 0;

      sheet.getRange(i + 1, successRateCol + 1).setValue(successRate);

      Logger.log(`Knowledge ID ${knowledgeId} のSuccess Rateを ${successRate}% に更新しました`);
      return;
    }
  }
}

/**
 * 特定Knowledgeのフィードバック履歴を取得
 * @param {string} knowledgeId - Knowledge ID
 * @return {array} フィードバック履歴
 */
function getFeedbackHistory(knowledgeId) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('Buddy Feedback Log');

  if (!logSheet) {
    return [];
  }

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const knowledgeIdCol = headers.indexOf('Knowledge ID');

  const history = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][knowledgeIdCol] === knowledgeId) {
      history.push({
        logId: data[i][0],
        knowledgeId: data[i][1],
        feedbackType: data[i][2],
        reason: data[i][3],
        context: data[i][4],
        user: data[i][5],
        timestamp: data[i][6]
      });
    }
  }

  return history;
}

/**
 * フィードバック統計を取得
 * @param {string} knowledgeId - Knowledge ID（省略時は全体統計）
 * @return {object} 統計情報
 */
function getFeedbackStatistics(knowledgeId = null) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('Buddy Feedback Log');

  if (!logSheet) {
    return {
      totalFeedbacks: 0,
      goodCount: 0,
      badCount: 0,
      uniqueKnowledge: 0
    };
  }

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const knowledgeIdCol = headers.indexOf('Knowledge ID');
  const feedbackTypeCol = headers.indexOf('Feedback Type');

  let goodCount = 0;
  let badCount = 0;
  const knowledgeSet = new Set();

  for (let i = 1; i < data.length; i++) {
    const rowKnowledgeId = data[i][knowledgeIdCol];
    const feedbackType = data[i][feedbackTypeCol];

    // 特定Knowledgeのみの統計を取得する場合
    if (knowledgeId && rowKnowledgeId !== knowledgeId) continue;

    if (feedbackType === 'Good') goodCount++;
    if (feedbackType === 'Bad') badCount++;

    knowledgeSet.add(rowKnowledgeId);
  }

  return {
    totalFeedbacks: goodCount + badCount,
    goodCount,
    badCount,
    goodRate: (goodCount + badCount) > 0 ? Math.round((goodCount / (goodCount + badCount)) * 100) : 0,
    uniqueKnowledge: knowledgeSet.size
  };
}

/**
 * テスト用: フィードバック記録のテスト
 */
function testRecordFeedback() {
  Logger.log('=== Buddyフィードバック記録テスト ===');

  // Goodフィードバック
  const result1 = recordBuddyFeedback(
    'BK-001',
    'Good',
    '励ましの言葉が適切で、モチベーションが上がった',
    '週次レポート'
  );
  Logger.log('Goodフィードバック記録: ' + (result1 ? '成功' : '失敗'));

  // Badフィードバック
  const result2 = recordBuddyFeedback(
    'BK-002',
    'Bad',
    'アドバイスが抽象的すぎて、具体的なアクションが分からなかった',
    '商談メモ'
  );
  Logger.log('Badフィードバック記録: ' + (result2 ? '成功' : '失敗'));

  // 統計を表示
  Logger.log('\n=== フィードバック統計 ===');
  const stats = getFeedbackStatistics();
  Logger.log(JSON.stringify(stats, null, 2));
}

/**
 * テスト用: 特定Knowledgeの履歴を表示
 * @param {string} knowledgeId - Knowledge ID
 */
function testGetFeedbackHistory(knowledgeId) {
  Logger.log('=== フィードバック履歴: ' + knowledgeId + ' ===');
  const history = getFeedbackHistory(knowledgeId);
  Logger.log(JSON.stringify(history, null, 2));
}
