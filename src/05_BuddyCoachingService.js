/**
 * Buddy壁打ちシステム - コーチングサービス
 * 目標設定、実績集計、週次レポートAPI
 */

/**
 * リード管理シートのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 * PR-1（デュアルサポート期）専用。PR-3 で削除する。
 */
function _leadsHeaderIdx(headers, newName, oldName) {
  var idx = headers.indexOf(newName);
  return idx !== -1 ? idx : headers.indexOf(oldName);
}

// ==========================================
// Phase 1-1: 目標設定シート管理
// ==========================================

/**
 * 目標設定シートのヘッダー定義（拡張版）
 */
const COACHING_GOALS_HEADERS = [
  '目標ID',           // 1: 自動（GOAL-00001）
  '担当者ID',         // 2: 担当者マスタから
  '担当者名',         // 3: 担当者マスタから
  '対象期間タイプ',   // 4: 月次/週次
  '対象期間',         // 5: 2026-01 / 2026-W02
  '成約目標',         // 6: 数値
  '売上目標',         // 7: 数値（円）
  '行動目標',         // 8: テキスト（具体的な行動）
  'チャレンジ案件',   // 9: テキスト（重点顧客など）
  '設定日',           // 10: 自動
  'ステータス',       // 11: 設定中/確定/達成/未達
  '振り返りメモ',     // 12: テキスト
  '更新日'            // 13: 自動
];

/**
 * 目標設定シートを作成（初期化）
 */
function setupCoachingGoalsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('目標設定_壁打ち');

  if (!sheet) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet = ss.getSheetByName('目標設定_壁打ち');
      if (!sheet) {
        sheet = ss.insertSheet('目標設定_壁打ち');
      }
    } finally {
      lock.releaseLock();
    }
  }

  // ヘッダー設定
  sheet.getRange(1, 1, 1, COACHING_GOALS_HEADERS.length).setValues([COACHING_GOALS_HEADERS]);
  sheet.getRange(1, 1, 1, COACHING_GOALS_HEADERS.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 列幅調整
  sheet.setColumnWidth(1, 100);   // 目標ID
  sheet.setColumnWidth(2, 100);   // 担当者ID
  sheet.setColumnWidth(3, 100);   // 担当者名
  sheet.setColumnWidth(4, 100);   // 対象期間タイプ
  sheet.setColumnWidth(5, 100);   // 対象期間
  sheet.setColumnWidth(6, 80);    // 成約目標
  sheet.setColumnWidth(7, 100);   // 売上目標
  sheet.setColumnWidth(8, 200);   // 行動目標
  sheet.setColumnWidth(9, 200);   // チャレンジ案件
  sheet.setColumnWidth(10, 100);  // 設定日
  sheet.setColumnWidth(11, 80);   // ステータス
  sheet.setColumnWidth(12, 250);  // 振り返りメモ
  sheet.setColumnWidth(13, 100);  // 更新日

  // フリーズ
  sheet.setFrozenRows(1);

  Logger.log('目標設定_壁打ちシートを作成しました');
  return { success: true, message: '目標設定シートを作成しました' };
}

/**
 * 新規目標IDを生成
 */
function generateGoalId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('目標設定_壁打ち');

  if (!sheet || sheet.getLastRow() < 2) {
    return 'GOAL-00001';
  }

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  ids.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith('GOAL-')) {
      const num = parseInt(id.replace('GOAL-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return 'GOAL-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * 目標を保存
 * @param {Object} goalData - 目標データ
 * @returns {Object} 保存結果
 */
function saveGoal(goalData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('目標設定_壁打ち');

    // シートがなければ作成
    if (!sheet) {
      setupCoachingGoalsSheet();
      sheet = ss.getSheetByName('目標設定_壁打ち');
    }

    const now = new Date().toISOString();
    const goalId = goalData.goalId || generateGoalId();
    const isUpdate = !!goalData.goalId;

    if (isUpdate) {
      // 既存目標を更新
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('目標ID');

      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === goalId) {
          const row = [
            goalId,
            goalData.staffId,
            goalData.staffName,
            goalData.periodType,
            goalData.period,
            goalData.closedTarget || 0,
            goalData.salesTarget || 0,
            goalData.actionGoal || '',
            goalData.challengeDeal || '',
            data[i][headers.indexOf('設定日')], // 設定日は維持
            goalData.status || '設定中',
            goalData.reviewMemo || '',
            now
          ];
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
          return { success: true, goalId: goalId, message: '目標を更新しました' };
        }
      }
      return { success: false, message: '更新対象の目標が見つかりません' };
    } else {
      // 新規目標を追加
      const row = [
        goalId,
        goalData.staffId,
        goalData.staffName,
        goalData.periodType,
        goalData.period,
        goalData.closedTarget || 0,
        goalData.salesTarget || 0,
        goalData.actionGoal || '',
        goalData.challengeDeal || '',
        now, // 設定日
        goalData.status || '設定中',
        goalData.reviewMemo || '',
        now  // 更新日
      ];
      sheet.appendRow(row);
      return { success: true, goalId: goalId, message: '目標を設定しました' };
    }
  } catch (error) {
    Logger.log('saveGoal エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 目標を取得
 * @param {string} staffId - 担当者ID
 * @param {string} period - 対象期間（オプション）
 * @returns {Array} 目標一覧
 */
function getGoals(staffId, period) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('目標設定_壁打ち');

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const goals = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const goal = {};

      headers.forEach((header, idx) => {
        let value = row[idx];
        if (value instanceof Date) {
          value = value.toISOString();
        }
        goal[header] = value;
      });

      // フィルタリング
      if (staffId && goal['担当者ID'] !== staffId) continue;
      if (period && goal['対象期間'] !== period) continue;

      goals.push(goal);
    }

    return goals;
  } catch (error) {
    Logger.log('getGoals エラー: ' + error.message);
    return [];
  }
}

/**
 * 現在期間の目標を取得
 * @param {string} staffId - 担当者ID
 * @param {string} periodType - 期間タイプ（月次/週次）
 * @returns {Object|null} 目標
 */
function getCurrentGoal(staffId, periodType) {
  const now = new Date();
  let period;

  if (periodType === '週次') {
    // ISO週番号を計算
    const weekNum = getISOWeekNumber(now);
    period = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
  } else {
    // 月次
    period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  const goals = getGoals(staffId, period);
  return goals.find(g => g['対象期間タイプ'] === periodType) || null;
}

/**
 * ISO週番号を取得
 */
function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * 目標ステータスを更新
 * @param {string} goalId - 目標ID
 * @param {string} status - 新しいステータス
 * @returns {Object} 更新結果
 */
function updateGoalStatus(goalId, status) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('目標設定_壁打ち');

    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, message: 'シートにデータがありません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('目標ID');
    const statusIdx = headers.indexOf('ステータス');
    const updateIdx = headers.indexOf('更新日');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === goalId) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(status);
        sheet.getRange(i + 1, updateIdx + 1).setValue(new Date().toISOString());
        return { success: true, message: 'ステータスを更新しました' };
      }
    }

    return { success: false, message: '目標が見つかりません' };
  } catch (error) {
    Logger.log('updateGoalStatus エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

// ==========================================
// Phase 1-2: 実績集計API
// ==========================================

/**
 * 担当者の実績を集計
 * @param {string} staffId - 担当者ID
 * @param {string} periodType - 期間タイプ（月次/週次）
 * @param {string} period - 対象期間
 * @returns {Object} 実績データ
 */
function getPerformanceMetrics(staffId, periodType, period) {
  try {
    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadsSheet || leadsSheet.getLastRow() < 2) {
      return getEmptyMetrics();
    }

    const data = leadsSheet.getDataRange().getValues();
    const headers = data[0];

    const staffIdIdx = _leadsHeaderIdx(headers, 'assignee_id', '担当者ID');
    const statusIdx = headers.indexOf('進捗ステータス');
    const revenueIdx = _leadsHeaderIdx(headers, 'first_transaction_amount', '初回取引金額');
    const assignDateIdx = _leadsHeaderIdx(headers, 'assigned_at', 'アサイン日');
    const firstTradeIdx = _leadsHeaderIdx(headers, 'first_transaction_date', '初回取引日');

    // 期間の開始・終了日を計算
    const { startDate, endDate } = getPeriodDates(periodType, period);

    let totalDeals = 0;
    let closedWon = 0;
    let closedLost = 0;
    let totalRevenue = 0;
    let inProgress = 0;
    const dealsByStatus = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // 担当者フィルタ
      if (staffId && row[staffIdIdx] !== staffId) continue;

      // 期間フィルタ（アサイン日または取引日で判定）
      const assignDate = row[assignDateIdx] ? new Date(row[assignDateIdx]) : null;
      const tradeDate = row[firstTradeIdx] ? new Date(row[firstTradeIdx]) : null;
      const checkDate = tradeDate || assignDate;

      if (checkDate && (checkDate < startDate || checkDate > endDate)) continue;

      const status = row[statusIdx];
      const revenue = Number(row[revenueIdx]) || 0;

      // 商談段階のみカウント
      if (['アサイン確定', '商談中', '成約', '失注'].includes(status)) {
        totalDeals++;

        if (status === '成約') {
          closedWon++;
          totalRevenue += revenue;
        } else if (status === '失注') {
          closedLost++;
        } else {
          inProgress++;
        }

        // 進捗ステータス別カウント
        dealsByStatus[status] = (dealsByStatus[status] || 0) + 1;
      }
    }

    const conversionRate = totalDeals > 0 ? Math.round((closedWon / totalDeals) * 100) : 0;

    return {
      period: period,
      periodType: periodType,
      totalDeals: totalDeals,
      closedWon: closedWon,
      closedLost: closedLost,
      inProgress: inProgress,
      totalRevenue: totalRevenue,
      conversionRate: conversionRate,
      dealsByStatus: dealsByStatus
    };
  } catch (error) {
    Logger.log('getPerformanceMetrics エラー: ' + error.message);
    return getEmptyMetrics();
  }
}

/**
 * 空の実績データを返す
 */
function getEmptyMetrics() {
  return {
    period: '',
    periodType: '',
    totalDeals: 0,
    closedWon: 0,
    closedLost: 0,
    inProgress: 0,
    totalRevenue: 0,
    conversionRate: 0,
    dealsByStatus: {}
  };
}

/**
 * 期間の開始・終了日を計算
 */
function getPeriodDates(periodType, period) {
  let startDate, endDate;

  if (periodType === '週次') {
    // period形式: 2026-W02
    const [year, weekStr] = period.split('-W');
    const week = parseInt(weekStr, 10);
    startDate = getDateOfISOWeek(parseInt(year, 10), week);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // 月次 period形式: 2026-01
    const [year, month] = period.split('-');
    startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    endDate = new Date(parseInt(year, 10), parseInt(month, 10), 0);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

/**
 * ISO週番号から日付を取得
 */
function getDateOfISOWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  return monday;
}

/**
 * 目標に対する達成率を計算
 * @param {string} staffId - 担当者ID
 * @param {string} periodType - 期間タイプ
 * @param {string} period - 対象期間
 * @returns {Object} 達成率データ
 */
function getGoalProgress(staffId, periodType, period) {
  const goal = getGoals(staffId, period).find(g => g['対象期間タイプ'] === periodType);
  const metrics = getPerformanceMetrics(staffId, periodType, period);

  if (!goal) {
    return {
      hasGoal: false,
      metrics: metrics,
      progress: null
    };
  }

  const closedTarget = Number(goal['成約目標']) || 0;
  const salesTarget = Number(goal['売上目標']) || 0;

  return {
    hasGoal: true,
    goal: goal,
    metrics: metrics,
    progress: {
      closedRate: closedTarget > 0 ? Math.round((metrics.closedWon / closedTarget) * 100) : 0,
      salesRate: salesTarget > 0 ? Math.round((metrics.totalRevenue / salesTarget) * 100) : 0
    }
  };
}

// ==========================================
// Phase 1-3: 週次レポート参照API
// ==========================================

/**
 * 週次レポートを取得
 * @param {string} staffId - 担当者ID
 * @param {number} limit - 取得件数（デフォルト5）
 * @returns {Array} レポート一覧
 */
function getWeeklyReports(staffId, limit) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const reports = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const report = {};

      headers.forEach((header, idx) => {
        let value = row[idx];
        if (value instanceof Date) {
          value = value.toISOString();
        }
        report[header] = value;
      });

      // 担当者フィルタ
      if (staffId && report['担当者ID'] !== staffId) continue;

      reports.push(report);
    }

    // 提出日時で降順ソート
    reports.sort((a, b) => {
      const dateA = new Date(a['提出日時'] || 0);
      const dateB = new Date(b['提出日時'] || 0);
      return dateB - dateA;
    });

    // 件数制限
    const maxLimit = limit || 5;
    return reports.slice(0, maxLimit);
  } catch (error) {
    Logger.log('getWeeklyReports エラー: ' + error.message);
    return [];
  }
}

/**
 * 最新の週次レポートを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object|null} 最新レポート
 */
function getLatestWeeklyReport(staffId) {
  const reports = getWeeklyReports(staffId, 1);
  return reports.length > 0 ? reports[0] : null;
}

/**
 * 週次レポートを保存
 * @param {Object} reportData - レポートデータ
 * @returns {Object} 保存結果
 */
function saveWeeklyReport(reportData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);

    if (!sheet) {
      // シートを作成 - LockService使用（TROUBLE-018対応）
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);
        if (!sheet) {
          sheet = ss.insertSheet(CONFIG.SHEETS.WEEKLY_REPORT);
          sheet.getRange(1, 1, 1, HEADERS.WEEKLY_REPORT.length).setValues([HEADERS.WEEKLY_REPORT]);
        }
      } finally {
        lock.releaseLock();
      }
    }

    const now = new Date().toISOString();
    const reportId = 'WR-' + Date.now();

    const row = [
      reportId,
      reportData.staffId,
      reportData.staffName,
      reportData.targetWeek,
      reportData.achievements || '',
      reportData.goodPoints || '',
      reportData.improvements || '',
      reportData.nextGoals || '',
      reportData.concerns || '',
      reportData.buddyQuestion || '',
      reportData.buddyFeedback || '',
      now
    ];

    sheet.appendRow(row);

    return { success: true, reportId: reportId, message: 'レポートを保存しました' };
  } catch (error) {
    Logger.log('saveWeeklyReport エラー: ' + error.message);
    return { success: false, message: error.message };
  }
}

// ==========================================
// Phase 2: Buddy壁打ちコア機能
// ==========================================

/**
 * Buddyプロンプトテンプレート
 */
const BUDDY_PROMPTS = {
  // フリートークモード
  FREE_TALK: `
あなたは「Buddy」という営業コーチAIです。営業担当者の日常的な相談相手として、親しみやすく対応してください。

【Buddyの人格】
- 明るく前向き、でも現実的
- 共感力が高く、傾聴姿勢を大切にする
- 押し付けがましくなく、質問で気づきを促す
- データに基づいた客観的な意見を述べる
- 短く端的に返答する（3-4文程度）

【重要ルール】
- 事実（データ）に基づいた発言のみ
- 予測や主観的評価は禁止
- 「共感 → 事実提示 → 質問」の形式
- 励ましと具体的アドバイスのバランス

担当者情報:
{{STAFF_INFO}}

会話ログ:
{{CONVERSATION_LOG}}

ユーザーの発言:
{{USER_MESSAGE}}
`,

  // 月末目標設定モード
  GOAL_SETTING: `
あなたは「Buddy」という営業コーチAIです。月末の目標設定セッションをガイドしてください。

【目標設定の流れ】
1. 先月の振り返り（良かった点・改善点）
2. 今月の目標数値（成約数・売上）
3. 重点顧客（チャレンジ案件）の特定
4. 具体的な行動計画

【Buddyの役割】
- 過去の実績データを参照しながらアドバイス
- 無理のない現実的な目標設定をサポート
- 具体的な行動に落とし込むよう促す
- 質問で深掘りして目標を明確化

担当者情報:
{{STAFF_INFO}}

過去の実績:
{{PERFORMANCE_DATA}}

現在の目標設定状況:
{{CURRENT_GOAL}}

ユーザーの発言:
{{USER_MESSAGE}}
`,

  // 週次振り返りモード
  WEEKLY_REVIEW: `
あなたは「Buddy」という営業コーチAIです。週次の振り返りセッションをサポートしてください。

【週次振り返りの観点】
1. 今週のハイライト（成果・学び）
2. 目標に対する進捗確認
3. 来週に向けた改善点
4. 困っていることの共有

【Buddyの役割】
- 成果を認め、小さな進歩も称える
- 数字だけでなくプロセスも評価
- 建設的な改善提案
- 来週のアクションを具体化

担当者情報:
{{STAFF_INFO}}

今週の実績:
{{WEEKLY_METRICS}}

目標との比較:
{{GOAL_PROGRESS}}

前回の振り返り:
{{LAST_REPORT}}

ユーザーの発言:
{{USER_MESSAGE}}
`
};

/**
 * Buddy壁打ち応答を生成
 * @param {Object} params - パラメータ
 * @returns {Object} 応答結果
 */
function generateBuddyCoachingResponse(params) {
  const { mode, userMessage, staffId, staffName, conversationLog } = params;

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'APIキーが設定されていません。' };
  }

  try {
    // モードに応じたプロンプトを選択
    let promptTemplate = BUDDY_PROMPTS.FREE_TALK;
    let contextData = {};

    if (mode === 'goal_setting') {
      promptTemplate = BUDDY_PROMPTS.GOAL_SETTING;

      // 実績データを取得
      const now = new Date();
      const lastMonth = now.getFullYear() + '-' + String(now.getMonth()).padStart(2, '0');
      const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

      contextData.performanceData = getPerformanceMetrics(staffId, '月次', lastMonth);
      contextData.currentGoal = getCurrentGoal(staffId, '月次');

    } else if (mode === 'weekly_review') {
      promptTemplate = BUDDY_PROMPTS.WEEKLY_REVIEW;

      // 週次データを取得
      const now = new Date();
      const weekNum = getISOWeekNumber(now);
      const period = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');

      contextData.weeklyMetrics = getPerformanceMetrics(staffId, '週次', period);
      contextData.goalProgress = getGoalProgress(staffId, '月次',
        now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
      contextData.lastReport = getLatestWeeklyReport(staffId);
    }

    // プロンプトを構築
    const prompt = buildCoachingPrompt(promptTemplate, {
      staffInfo: `担当者ID: ${staffId}, 担当者名: ${staffName}`,
      conversationLog: conversationLog || '（なし）',
      userMessage: userMessage,
      ...contextData
    });

    // Gemini API呼び出し
    const response = callGeminiAPI(prompt, apiKey);

    if (response && response.candidates && response.candidates[0]) {
      const text = response.candidates[0].content.parts[0].text;

      // 対話ログを保存
      saveBuddyDialogLog(staffId, userMessage, text, mode, conversationLog);

      return {
        success: true,
        message: text,
        mode: mode
      };
    }

    return { success: false, message: '応答の生成に失敗しました。' };

  } catch (error) {
    Logger.log('generateBuddyCoachingResponse エラー: ' + error.message);
    return { success: false, message: '一時的にお話しできない状態です。' };
  }
}

/**
 * コーチングプロンプトを構築
 */
function buildCoachingPrompt(template, data) {
  let prompt = template;

  prompt = prompt.replace('{{STAFF_INFO}}', data.staffInfo || '');
  prompt = prompt.replace('{{CONVERSATION_LOG}}', data.conversationLog || '');
  prompt = prompt.replace('{{USER_MESSAGE}}', data.userMessage || '');
  prompt = prompt.replace('{{PERFORMANCE_DATA}}', JSON.stringify(data.performanceData || {}));
  prompt = prompt.replace('{{CURRENT_GOAL}}', JSON.stringify(data.currentGoal || {}));
  prompt = prompt.replace('{{WEEKLY_METRICS}}', JSON.stringify(data.weeklyMetrics || {}));
  prompt = prompt.replace('{{GOAL_PROGRESS}}', JSON.stringify(data.goalProgress || {}));
  prompt = prompt.replace('{{LAST_REPORT}}', JSON.stringify(data.lastReport || {}));

  return prompt;
}

/**
 * Buddy対話ログを保存
 */
function saveBuddyDialogLog(staffId, userMessage, buddyResponse, mode, conversationLog) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.BUDDY_LOG);

    if (!sheet) {
      // LockService使用（TROUBLE-018対応）
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        sheet = ss.getSheetByName(CONFIG.SHEETS.BUDDY_LOG);
        if (!sheet) {
          sheet = ss.insertSheet(CONFIG.SHEETS.BUDDY_LOG);
          const headers = ['ログID', '担当者ID', '日時', 'モード', 'ユーザー発言', 'Buddy応答', '会話コンテキスト'];
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
      } finally {
        lock.releaseLock();
      }
    }

    const logId = 'BL-' + Date.now();
    const now = new Date().toISOString();

    sheet.appendRow([
      logId,
      staffId,
      now,
      mode || 'free_talk',
      userMessage,
      buddyResponse,
      conversationLog || ''
    ]);

  } catch (error) {
    Logger.log('saveBuddyDialogLog エラー: ' + error.message);
  }
}

/**
 * Buddy対話履歴を取得
 * @param {string} staffId - 担当者ID
 * @param {number} limit - 取得件数
 * @returns {Array} 対話履歴
 */
function getBuddyDialogHistory(staffId, limit) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.BUDDY_LOG);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const history = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const log = {};

      headers.forEach((header, idx) => {
        let value = row[idx];
        if (value instanceof Date) {
          value = value.toISOString();
        }
        log[header] = value;
      });

      if (log['担当者ID'] === staffId) {
        history.push(log);
        if (history.length >= (limit || 10)) break;
      }
    }

    return history;
  } catch (error) {
    Logger.log('getBuddyDialogHistory エラー: ' + error.message);
    return [];
  }
}

// ==========================================
// Buddy知識DBシステム
// ==========================================

/**
 * Buddy知識DBシート名定義
 */
const BUDDY_KNOWLEDGE_SHEETS = {
  PERSONALITY: 'Buddy人格設定',
  PHRASES: 'Buddy言い回し',
  KNOWLEDGE: 'Buddy営業ナレッジ',
  TEMPLATES: 'Buddy会話テンプレート'
};

/**
 * 4つのBuddy知識DBシートを作成
 */
function createBuddyKnowledgeSheets() {
  const ss = getSpreadsheet();
  const results = [];

  // 1. Buddy人格設定シート
  results.push(createBuddyPersonalitySheet(ss));

  // 2. Buddy言い回しシート
  results.push(createBuddyPhrasesSheet(ss));

  // 3. Buddy営業ナレッジシート
  results.push(createBuddyKnowledgeSheet(ss));

  // 4. Buddy会話テンプレートシート
  results.push(createBuddyTemplatesSheet(ss));

  Logger.log('Buddy知識DBシートを作成しました: ' + JSON.stringify(results));
  return { success: true, results: results };
}

/**
 * Buddy人格設定シートを作成
 */
function createBuddyPersonalitySheet(ss) {
  // ssが渡されない場合は取得
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    throw new Error('スプレッドシートが取得できません');
  }

  let sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PERSONALITY);

  if (!sheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PERSONALITY);
      if (!sheet) {
        sheet = ss.insertSheet(BUDDY_KNOWLEDGE_SHEETS.PERSONALITY);
      }
    } finally {
      lock.releaseLock();
    }
  } else {
    sheet.clear();
  }

  // ヘッダー
  const headers = ['項目', '値', '備考'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 初期データ
  const data = [
    ['名前', 'Buddy', ''],
    ['一人称', '僕', ''],
    ['呼び方', '〇〇さん', '{name}で置換'],
    ['トーン', 'フランクだけど馴れ馴れしくない', ''],
    ['絵文字使用', '控えめ（👍💪程度）', ''],
    ['禁止ワード', 'すべき,必ず,絶対', 'カンマ区切り'],
    ['最大応答文', '3-4文', ''],
    ['基本姿勢', '共感→事実提示→質問', '']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  // 列幅調整
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 250);
  sheet.setColumnWidth(3, 150);

  return { sheet: BUDDY_KNOWLEDGE_SHEETS.PERSONALITY, status: 'created' };
}

/**
 * Buddy言い回しシートを作成
 * @param {Spreadsheet} ss - スプレッドシート（省略可）
 */
function createBuddyPhrasesSheet(ss) {
  // ssが渡されない場合は取得
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    throw new Error('スプレッドシートが取得できません');
  }

  // LockService使用（TROUBLE-018対応）- deleteSheetとinsertSheetを保護
  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    // 既存シートがあれば完全に削除
    const existingSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PHRASES);
    if (existingSheet) {
      ss.deleteSheet(existingSheet);
    }
    // 新規シートを作成
    sheet = ss.insertSheet(BUDDY_KNOWLEDGE_SHEETS.PHRASES);
  } finally {
    lock.releaseLock();
  }

  // ヘッダー
  const headers = ['シーン', 'Bad例', 'Good例', '使用タイミング'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 初期データ
  const data = [
    ['感想を聞く', 'この結果、どう思う？', '今月の成果、〇〇さん的に満足できる内容だった？', '実績提示後'],
    ['原因を聞く', '何が原因だったと思う？', '届かなかったね...達成できなかった理由って自分で思うところある？', '未達成時'],
    ['数値化促す', 'いいね！それを数値にすると？', 'なるほどね！それって例えば週に何件くらいのイメージ？', '目標設定時'],
    ['承認する', '良いですね', 'ちゃんと振り返りできてるの素晴らしい👍', 'レポート確認時'],
    ['共感する', '大変でしたね', 'それは辛かったね...', '困りごと相談時'],
    ['提案する', '○○してください', '○○してみるのはどう？', 'アドバイス時'],
    ['質問で深掘り', '詳しく教えて', 'もうちょっと聞いてもいい？具体的にはどんな感じだった？', '詳細確認時'],
    ['次を促す', '次はどうしますか', 'じゃあ次のアクション、一緒に考えよっか', '振り返り後']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  // 列幅調整
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 350);
  sheet.setColumnWidth(4, 120);

  // 行の高さを標準に設定
  sheet.setRowHeights(1, data.length + 1, 21);

  // テキスト折り返しを設定
  sheet.getRange(1, 1, data.length + 1, headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  return { sheet: BUDDY_KNOWLEDGE_SHEETS.PHRASES, status: 'created' };
}

/**
 * Buddy営業ナレッジシートを作成
 * @param {Spreadsheet} ss - スプレッドシート（省略可）
 */
function createBuddyKnowledgeSheet(ss) {
  // ssが渡されない場合は取得
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    throw new Error('スプレッドシートが取得できません');
  }

  // LockService使用（TROUBLE-018対応）- deleteSheetとinsertSheetを保護
  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    // 既存シートがあれば完全に削除
    const existingSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.KNOWLEDGE);
    if (existingSheet) {
      ss.deleteSheet(existingSheet);
    }
    // 新規シートを作成
    sheet = ss.insertSheet(BUDDY_KNOWLEDGE_SHEETS.KNOWLEDGE);
  } finally {
    lock.releaseLock();
  }

  // ヘッダー
  const headers = ['カテゴリ', 'タイトル', '内容', 'ソース', '有効'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 初期データ
  const data = [
    ['勝ちパターン', '早期関係構築', '初回接触から3日以内に2往復以上のやり取りで成約率UP', '社内分析', 'TRUE'],
    ['勝ちパターン', 'ニーズ深掘り', '価格の話の前に相手の課題を3つ以上聞き出す', '社内分析', 'TRUE'],
    ['勝ちパターン', '適切なフォロー', '商談後24時間以内のお礼連絡で次回アポ率向上', '社内分析', 'TRUE'],
    ['失敗パターン', '価格先行', '価格の話を先にすると成約率DOWN', '社内分析', 'TRUE'],
    ['失敗パターン', '長期放置', '1週間以上連絡しないと温度感が冷める', '社内分析', 'TRUE'],
    ['商品知識', 'Pokemon', '海外で人気、英語版が特に需要高い', '-', 'TRUE'],
    ['商品知識', 'ワンピース', 'アジア圏で人気、中国語版の需要あり', '-', 'TRUE'],
    ['商品知識', 'Yu-Gi-Oh', '北米で根強い人気、レアカード需要', '-', 'TRUE'],
    ['商品知識', 'Dragon Ball', '全世界で人気、コレクターアイテム多い', '-', 'TRUE'],
    ['顧客対応', '信頼重視顧客', '価格より品質・対応スピードを重視。丁寧なコミュニケーションが鍵', '社内分析', 'TRUE'],
    ['顧客対応', '価格重視顧客', '競合との比較を重視。明確な価値提案が必要', '社内分析', 'TRUE']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  // 列幅調整
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 400);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 60);

  // 行の高さを標準に設定
  sheet.setRowHeights(1, data.length + 1, 21);

  // テキスト折り返しを設定
  sheet.getRange(1, 1, data.length + 1, headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  return { sheet: BUDDY_KNOWLEDGE_SHEETS.KNOWLEDGE, status: 'created' };
}

/**
 * Buddy会話テンプレートシートを作成
 * @param {Spreadsheet} ss - スプレッドシート（省略可）
 */
function createBuddyTemplatesSheet(ss) {
  // ssが渡されない場合は取得
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    throw new Error('スプレッドシートが取得できません');
  }

  // LockService使用（TROUBLE-018対応）- deleteSheetとinsertSheetを保護
  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    // 既存シートがあれば完全に削除
    const existingSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.TEMPLATES);
    if (existingSheet) {
      ss.deleteSheet(existingSheet);
    }
    // 新規シートを作成
    sheet = ss.insertSheet(BUDDY_KNOWLEDGE_SHEETS.TEMPLATES);
  } finally {
    lock.releaseLock();
  }

  // ヘッダー
  const headers = ['モード', 'フェーズ', 'テンプレート', '変数'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 初期データ
  const data = [
    ['目標設定', '開始', '今月お疲れ様！来月の目標を一緒に考えよう。まず今月の振り返りから始めない？', ''],
    ['目標設定', '実績確認', '今月のデータを見てみよう。{performance_card} 今月の成果、{name}さん的に満足できる内容だった？', 'name, performance_card'],
    ['目標設定', '未達成時', '届かなかったね...達成できなかった理由って{name}さん的に思うところある？', 'name'],
    ['目標設定', '達成時', '目標達成おめでとう！🎉 {name}さん的に、特に良かった点ってどこだと思う？', 'name'],
    ['目標設定', '目標数値', 'じゃあ来月の目標を決めよう。先月の実績を踏まえて、成約数と売上目標、どのくらいを目指す？', ''],
    ['目標設定', '行動目標', '数字の目標が決まったね！それを達成するために、具体的にどんな行動を心がける？', ''],
    ['目標設定', 'チャレンジ', '最後に、今月特に力を入れたい案件ってある？重点顧客を1-2社決めておこう。', ''],
    ['目標設定', '確認', '目標をまとめると：{goal_summary} これでOK？', 'goal_summary'],
    ['週次振り返り', '開始', '週次レポートありがとう！今週の振り返りしよう。', ''],
    ['週次振り返り', '成果確認', '{achievement}、頑張ったね！特に{good_point}は素晴らしい👍', 'achievement, good_point'],
    ['週次振り返り', '改善点', '来週に向けて、改善したいところってある？', ''],
    ['週次振り返り', '目標進捗', '今月の目標に対して、現在{progress}%の達成率だね。残り{remaining}日、どう追い込む？', 'progress, remaining'],
    ['励まし', '成約時', '{name}さん、{company}成約おめでとう！🎉 今月の目標{goal}件に対して{current}件目だね。', 'name, company, goal, current'],
    ['励まし', '進捗良好', '順調だね！この調子でいこう💪', ''],
    ['励まし', '進捗遅れ', 'まだ時間あるよ。今週クロージングできそうな案件ある？', ''],
    ['励まし', '週末', '今週もお疲れ様！週末しっかり休んで、また来週頑張ろう👍', ''],
    ['フリートーク', '挨拶', 'やあ、{name}さん！今日はどんな感じ？', 'name'],
    ['フリートーク', '相談受付', 'なるほど、{topic}について相談したいんだね。詳しく聞かせて！', 'topic']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  // 列幅調整
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 500);
  sheet.setColumnWidth(4, 150);

  // 行の高さを標準に設定
  sheet.setRowHeights(1, data.length + 1, 21);

  // テキスト折り返しを設定（CLIPで折り返さない）
  sheet.getRange(1, 1, data.length + 1, headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  return { sheet: BUDDY_KNOWLEDGE_SHEETS.TEMPLATES, status: 'created' };
}

// ==========================================
// Buddy知識取得API
// ==========================================

/**
 * Buddy人格設定を取得
 * @returns {Object} 人格設定
 */
function getBuddyPersonality() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PERSONALITY);

    if (!sheet || sheet.getLastRow() < 2) {
      return getDefaultBuddyPersonality();
    }

    const data = sheet.getDataRange().getValues();
    const personality = {};

    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];
      if (key) {
        personality[key] = value;
      }
    }

    return personality;
  } catch (error) {
    Logger.log('getBuddyPersonality エラー: ' + error.message);
    return getDefaultBuddyPersonality();
  }
}

/**
 * デフォルトのBuddy人格設定
 */
function getDefaultBuddyPersonality() {
  return {
    '名前': 'Buddy',
    '一人称': '僕',
    '呼び方': '〇〇さん',
    'トーン': 'フランクだけど馴れ馴れしくない',
    '絵文字使用': '控えめ（👍💪程度）',
    '禁止ワード': 'すべき,必ず,絶対'
  };
}

/**
 * シーン別のBuddy言い回しを取得
 * @param {string} scene - シーン名（オプション）
 * @returns {Array|Object} 言い回し一覧または特定シーンの言い回し
 */
function getBuddyPhrases(scene) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PHRASES);

    if (!sheet || sheet.getLastRow() < 2) {
      return scene ? null : [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const phrases = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phrase = {
        scene: row[0],
        badExample: row[1],
        goodExample: row[2],
        timing: row[3]
      };

      if (scene) {
        if (phrase.scene === scene) {
          return phrase;
        }
      } else {
        phrases.push(phrase);
      }
    }

    return scene ? null : phrases;
  } catch (error) {
    Logger.log('getBuddyPhrases エラー: ' + error.message);
    return scene ? null : [];
  }
}

/**
 * カテゴリ別のBuddyナレッジを取得
 * @param {string} category - カテゴリ（オプション）
 * @returns {Array} ナレッジ一覧
 */
function getBuddyKnowledge(category) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.KNOWLEDGE);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const knowledge = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isActive = row[4] === true || row[4] === 'TRUE' || row[4] === 'true';

      if (!isActive) continue;

      const item = {
        category: row[0],
        title: row[1],
        content: row[2],
        source: row[3]
      };

      if (category) {
        if (item.category === category) {
          knowledge.push(item);
        }
      } else {
        knowledge.push(item);
      }
    }

    return knowledge;
  } catch (error) {
    Logger.log('getBuddyKnowledge エラー: ' + error.message);
    return [];
  }
}

/**
 * モード・フェーズ別のBuddyテンプレートを取得
 * @param {string} mode - モード
 * @param {string} phase - フェーズ（オプション）
 * @returns {Object|Array} テンプレートまたはテンプレート一覧
 */
function getBuddyTemplate(mode, phase) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.TEMPLATES);

    if (!sheet || sheet.getLastRow() < 2) {
      return phase ? null : [];
    }

    const data = sheet.getDataRange().getValues();
    const templates = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const template = {
        mode: row[0],
        phase: row[1],
        template: row[2],
        variables: row[3] ? row[3].split(',').map(v => v.trim()) : []
      };

      if (mode && template.mode !== mode) continue;

      if (phase) {
        if (template.phase === phase) {
          return template;
        }
      } else {
        templates.push(template);
      }
    }

    return phase ? null : templates;
  } catch (error) {
    Logger.log('getBuddyTemplate エラー: ' + error.message);
    return phase ? null : [];
  }
}

/**
 * テンプレートの変数を置換
 * @param {string} template - テンプレート文字列
 * @param {Object} variables - 変数オブジェクト
 * @returns {string} 置換後の文字列
 */
function applyBuddyTemplateVariables(template, variables) {
  let result = template;

  Object.keys(variables).forEach(key => {
    const regex = new RegExp('\\{' + key + '\\}', 'g');
    result = result.replace(regex, variables[key] || '');
  });

  return result;
}

// ==========================================
// 拡張版Buddyコーチング応答（知識DB統合）
// ==========================================

/**
 * 知識DB統合版のBuddy壁打ち応答を生成
 * @param {Object} params - パラメータ
 * @returns {Object} 応答結果
 */
function generateBuddyCoachingResponseWithKnowledge(params) {
  const { mode, userMessage, staffId, staffName, conversationLog } = params;

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'APIキーが設定されていません。' };
  }

  try {
    // 知識DBからデータを取得
    const personality = getBuddyPersonality();
    const phrases = getBuddyPhrases();
    const templates = getBuddyTemplate(mode === 'goal_setting' ? '目標設定' :
                                        mode === 'weekly_review' ? '週次振り返り' : 'フリートーク');

    // 関連するナレッジを取得（会話内容に応じて）
    let relevantKnowledge = [];
    const keywords = ['勝ちパターン', '失敗パターン'];
    keywords.forEach(cat => {
      relevantKnowledge = relevantKnowledge.concat(getBuddyKnowledge(cat));
    });

    // 商品関連キーワードがあれば商品知識も追加
    const productKeywords = ['Pokemon', 'ワンピース', 'Yu-Gi-Oh', 'Dragon Ball'];
    productKeywords.forEach(product => {
      if (userMessage.includes(product)) {
        relevantKnowledge = relevantKnowledge.concat(
          getBuddyKnowledge('商品知識').filter(k => k.title.includes(product))
        );
      }
    });

    // 動的システムプロンプトを構築
    const systemPrompt = buildDynamicSystemPrompt(personality, phrases, templates, relevantKnowledge, staffName);

    // コンテキストデータを取得
    let contextData = {};
    if (mode === 'goal_setting') {
      const now = new Date();
      const lastMonth = now.getFullYear() + '-' + String(now.getMonth()).padStart(2, '0');
      contextData.performanceData = getPerformanceMetrics(staffId, '月次', lastMonth);
      contextData.currentGoal = getCurrentGoal(staffId, '月次');
    } else if (mode === 'weekly_review') {
      const now = new Date();
      const weekNum = getISOWeekNumber(now);
      const period = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
      contextData.weeklyMetrics = getPerformanceMetrics(staffId, '週次', period);
      contextData.goalProgress = getGoalProgress(staffId, '月次',
        now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
      contextData.lastReport = getLatestWeeklyReport(staffId);
    }

    // 完全なプロンプトを構築
    const fullPrompt = systemPrompt + `

【現在のコンテキスト】
担当者ID: ${staffId}
担当者名: ${staffName}
モード: ${mode}

${Object.keys(contextData).length > 0 ? '【データ】\n' + JSON.stringify(contextData, null, 2) : ''}

${conversationLog ? '【会話ログ】\n' + conversationLog : ''}

【ユーザーの発言】
${userMessage}

【Buddyの応答】`;

    // Gemini API呼び出し
    const response = callGeminiAPI(fullPrompt, apiKey);

    if (response && response.candidates && response.candidates[0]) {
      const text = response.candidates[0].content.parts[0].text;

      // 対話ログを保存
      saveBuddyDialogLog(staffId, userMessage, text, mode, conversationLog);

      return {
        success: true,
        message: text,
        mode: mode
      };
    }

    return { success: false, message: '応答の生成に失敗しました。' };

  } catch (error) {
    Logger.log('generateBuddyCoachingResponseWithKnowledge エラー: ' + error.message);
    return { success: false, message: '一時的にお話しできない状態です。' };
  }
}

/**
 * 動的システムプロンプトを構築
 */
function buildDynamicSystemPrompt(personality, phrases, templates, knowledge, staffName) {
  // 禁止ワードをパース
  const forbiddenWords = personality['禁止ワード'] ? personality['禁止ワード'].split(',') : [];

  // 呼び方を担当者名に置換
  const callName = personality['呼び方'] ? personality['呼び方'].replace('〇〇', staffName) : staffName + 'さん';

  let prompt = `あなたは「${personality['名前'] || 'Buddy'}」という営業コーチAIです。

【人格設定】
- 一人称: ${personality['一人称'] || '僕'}
- 呼び方: ${callName}
- トーン: ${personality['トーン'] || 'フランクだけど馴れ馴れしくない'}
- 絵文字: ${personality['絵文字使用'] || '控えめ'}
- 応答の長さ: ${personality['最大応答文'] || '3-4文'}
- 基本姿勢: ${personality['基本姿勢'] || '共感→事実提示→質問'}

【禁止事項】
- 以下のワードは使用禁止: ${forbiddenWords.join('、')}
- 予測や主観的評価は禁止
- 押し付けがましい言い方は禁止

【良い言い回しの例】
`;

  // 言い回し例を追加（Good例のみ）
  phrases.slice(0, 6).forEach(p => {
    prompt += `- ${p.scene}: 「${p.goodExample}」（${p.timing}）\n`;
  });

  // テンプレート例を追加
  if (templates && templates.length > 0) {
    prompt += `\n【会話テンプレート】\n`;
    templates.slice(0, 5).forEach(t => {
      prompt += `- ${t.phase}: ${t.template}\n`;
    });
  }

  // ナレッジを追加
  if (knowledge && knowledge.length > 0) {
    prompt += `\n【営業ナレッジ】\n`;
    knowledge.forEach(k => {
      prompt += `- [${k.category}] ${k.title}: ${k.content}\n`;
    });
  }

  prompt += `
【重要ルール】
- 事実（データ）に基づいた発言のみ
- 「共感 → 事実提示 → 質問」の形式を基本とする
- 短く端的に（${personality['最大応答文'] || '3-4文'}程度）
- 励ましと具体的アドバイスのバランスを取る
`;

  return prompt;
}

// ==========================================
// Phase 4: 伴走機能（通知・リマインダー）
// ==========================================

/**
 * 成約時のBuddy通知メッセージを生成
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @param {string} customerName - 成約した顧客名
 * @returns {Object} 通知メッセージ
 */
function generateDealClosureNotification(staffId, staffName, customerName) {
  try {
    // 現在の目標と実績を取得
    const now = new Date();
    const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const goal = getCurrentGoal(staffId, '月次');
    const metrics = getPerformanceMetrics(staffId, '月次', period);

    // テンプレートを取得
    const template = getBuddyTemplate('励まし', '成約時');
    let message;

    if (template) {
      message = applyBuddyTemplateVariables(template.template, {
        name: staffName,
        company: customerName,
        goal: goal ? goal['成約目標'] : '-',
        current: metrics.closedWon || 0
      });
    } else {
      message = `${staffName}さん、${companyName}成約おめでとう！🎉`;
      if (goal && goal['成約目標']) {
        message += ` 今月の目標${goal['成約目標']}件に対して${metrics.closedWon || 0}件目だね。`;
      }
    }

    // 進捗に応じた追加メッセージ
    if (goal && goal['成約目標']) {
      const target = Number(goal['成約目標']);
      const current = metrics.closedWon || 0;
      const progressPct = Math.round((current / target) * 100);

      if (progressPct >= 100) {
        message += '\n\n目標達成おめでとう！この調子で更に上を目指そう💪';
      } else if (progressPct >= 80) {
        message += '\n\nもう少しで目標達成だね！ラストスパート頑張ろう💪';
      } else if (progressPct >= 50) {
        message += '\n\n順調だね！この調子で後半も頑張ろう👍';
      }
    }

    return {
      success: true,
      message: message,
      metrics: {
        closedWon: metrics.closedWon,
        goal: goal ? goal['成約目標'] : null,
        progress: goal && goal['成約目標'] ?
          Math.round((metrics.closedWon / Number(goal['成約目標'])) * 100) : null
      }
    };
  } catch (error) {
    Logger.log('generateDealClosureNotification エラー: ' + error.message);
    return {
      success: false,
      message: '成約おめでとう！🎉'
    };
  }
}

/**
 * 週中リマインダーを生成（水曜日実行想定）
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @returns {Object} リマインダーメッセージ
 */
function generateMidWeekReminder(staffId, staffName) {
  try {
    const now = new Date();
    const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const goal = getCurrentGoal(staffId, '月次');
    const metrics = getPerformanceMetrics(staffId, '月次', period);

    // 月の残り日数を計算
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const remainingDays = lastDay.getDate() - now.getDate();

    let message = `${staffName}さん、今週もお疲れ様！折り返し地点だね。`;

    if (goal && goal['成約目標']) {
      const target = Number(goal['成約目標']);
      const current = metrics.closedWon || 0;
      const remaining = target - current;
      const progressPct = Math.round((current / target) * 100);

      if (remaining <= 0) {
        message += `\n\n今月の目標はもう達成してるね！素晴らしい👏 さらに記録を伸ばしていこう！`;
      } else if (progressPct >= 70) {
        const progressTemplate = getBuddyTemplate('励まし', '進捗良好');
        message += `\n\n今月の進捗は${progressPct}%、あと${remaining}件。${progressTemplate ? progressTemplate.template : '順調だね！この調子でいこう💪'}`;
      } else {
        const behindTemplate = getBuddyTemplate('励まし', '進捗遅れ');
        message += `\n\n今月の進捗は${progressPct}%、残り${remainingDays}日であと${remaining}件。${behindTemplate ? behindTemplate.template : 'まだ時間あるよ。今週クロージングできそうな案件ある？'}`;
      }
    }

    // 進行中の商談数を追加
    if (metrics.inProgress > 0) {
      message += `\n\n現在進行中の商談が${metrics.inProgress}件あるね。優先度の高いものから進めていこう！`;
    }

    return {
      success: true,
      message: message,
      metrics: metrics
    };
  } catch (error) {
    Logger.log('generateMidWeekReminder エラー: ' + error.message);
    return {
      success: false,
      message: `${staffName}さん、今週もお疲れ様！後半も頑張ろう👍`
    };
  }
}

/**
 * 金曜日のレポート促進メッセージを生成
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @returns {Object} レポート促進メッセージ
 */
function generateFridayReportPrompt(staffId, staffName) {
  try {
    // 今週のレポートが既に提出されているかチェック
    const reports = getWeeklyReports(staffId, 1);
    const now = new Date();
    const weekNum = getISOWeekNumber(now);
    const currentWeek = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');

    let message;

    if (reports.length > 0 && reports[0]['対象週'] === currentWeek) {
      // 既にレポート提出済み
      const weekendTemplate = getBuddyTemplate('励まし', '週末');
      message = `${staffName}さん、今週もレポート提出ありがとう！` +
        (weekendTemplate ? '\n\n' + weekendTemplate.template : '\n\n今週もお疲れ様！週末しっかり休んで、また来週頑張ろう👍');
    } else {
      // レポート未提出
      message = `${staffName}さん、今週もお疲れ様！週次レポートの時間だよ。\n\n今週の振り返りを一緒にしよう。Buddy壁打ちの「週次振り返り」モードで、サクッとまとめられるよ👍`;
    }

    return {
      success: true,
      message: message,
      hasSubmitted: reports.length > 0 && reports[0]['対象週'] === currentWeek
    };
  } catch (error) {
    Logger.log('generateFridayReportPrompt エラー: ' + error.message);
    return {
      success: false,
      message: `${staffName}さん、今週もお疲れ様！週次レポートを提出してね👍`
    };
  }
}

/**
 * 月末の目標設定リマインダーを生成
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @returns {Object} 目標設定リマインダー
 */
function generateMonthEndGoalReminder(staffId, staffName) {
  try {
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ?
      (now.getFullYear() + 1) + '-01' :
      now.getFullYear() + '-' + String(now.getMonth() + 2).padStart(2, '0');

    // 来月の目標が設定されているかチェック
    const nextGoals = getGoals(staffId, nextMonth);
    const hasNextGoal = nextGoals.length > 0;

    let message;

    if (hasNextGoal) {
      message = `${staffName}さん、来月の目標は既に設定済みだね👍 準備万端！`;
    } else {
      // 今月の実績を取得
      const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const metrics = getPerformanceMetrics(staffId, '月次', currentMonth);

      const startTemplate = getBuddyTemplate('目標設定', '開始');
      message = `${staffName}さん、もうすぐ月末だね。` +
        (startTemplate ? '\n\n' + startTemplate.template : '\n\n来月の目標を一緒に考えよう。まず今月の振り返りから始めない？') +
        `\n\n今月の実績: 成約${metrics.closedWon || 0}件、売上¥${(metrics.totalRevenue || 0).toLocaleString()}`;
    }

    return {
      success: true,
      message: message,
      hasNextGoal: hasNextGoal
    };
  } catch (error) {
    Logger.log('generateMonthEndGoalReminder エラー: ' + error.message);
    return {
      success: false,
      message: `${staffName}さん、来月の目標を設定しよう！`
    };
  }
}

/**
 * 全スタッフへの週中リマインダーをバッチ送信（トリガー用）
 */
function sendMidWeekRemindersToAll() {
  try {
    const staffList = getStaffList();
    const results = [];

    staffList.forEach(staff => {
      if (staff['ステータス'] !== '有効') return;
      if (!['営業', 'リーダー'].includes(staff['役割'])) return;

      const staffName = (staff['苗字（日本語）'] || '') + ' ' + (staff['名前（日本語）'] || '');
      const reminder = generateMidWeekReminder(staff['担当者ID'], staffName.trim());

      // TODO: Discord通知やメール送信を実装
      results.push({
        staffId: staff['担当者ID'],
        staffName: staffName,
        message: reminder.message,
        success: reminder.success
      });
    });

    Logger.log('週中リマインダー送信完了: ' + results.length + '件');
    return { success: true, results: results };
  } catch (error) {
    Logger.log('sendMidWeekRemindersToAll エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 全スタッフへの金曜レポート促進をバッチ送信（トリガー用）
 */
function sendFridayReportPromptsToAll() {
  try {
    const staffList = getStaffList();
    const results = [];

    staffList.forEach(staff => {
      if (staff['ステータス'] !== '有効') return;

      const staffName = (staff['苗字（日本語）'] || '') + ' ' + (staff['名前（日本語）'] || '');
      const prompt = generateFridayReportPrompt(staff['担当者ID'], staffName.trim());

      // TODO: Discord通知やメール送信を実装
      results.push({
        staffId: staff['担当者ID'],
        staffName: staffName,
        message: prompt.message,
        hasSubmitted: prompt.hasSubmitted,
        success: prompt.success
      });
    });

    Logger.log('金曜レポート促進送信完了: ' + results.length + '件');
    return { success: true, results: results };
  } catch (error) {
    Logger.log('sendFridayReportPromptsToAll エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Buddyダッシュボード用のサマリーデータを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} サマリーデータ
 */
function getBuddyDashboardSummary(staffId) {
  try {
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const weekNum = getISOWeekNumber(now);
    const currentWeek = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');

    // 各種データを取得
    const goal = getCurrentGoal(staffId, '月次');
    const metrics = getPerformanceMetrics(staffId, '月次', currentMonth);
    const weeklyReport = getLatestWeeklyReport(staffId);

    // 週次レポート提出状況
    const hasWeeklyReport = weeklyReport && weeklyReport['対象週'] === currentWeek;

    // 今週のフォーカス（重点案件）を生成
    let weeklyFocus = '';
    if (goal && goal['チャレンジ案件']) {
      weeklyFocus = goal['チャレンジ案件'];
    }

    // Buddyメッセージを生成
    let buddyMessage = '';
    if (goal && goal['成約目標']) {
      const target = Number(goal['成約目標']);
      const current = metrics.closedWon || 0;
      const progressPct = Math.round((current / target) * 100);

      if (progressPct >= 100) {
        buddyMessage = '目標達成おめでとう！🎉 この調子で更に上を目指そう！';
      } else if (progressPct >= 80) {
        buddyMessage = 'あと少しで目標達成！ラストスパート頑張ろう💪';
      } else if (progressPct >= 50) {
        buddyMessage = '順調に進んでるね！後半も同じペースで👍';
      } else {
        const remaining = target - current;
        buddyMessage = `今月はあと${remaining}件。クロージングできそうな案件ある？`;
      }
    } else {
      buddyMessage = '今月の目標を設定しよう！Buddy壁打ちで一緒に考えるよ👍';
    }

    return {
      success: true,
      period: currentMonth,
      goal: goal,
      metrics: metrics,
      weeklyFocus: weeklyFocus,
      hasWeeklyReport: hasWeeklyReport,
      buddyMessage: buddyMessage,
      progress: goal && goal['成約目標'] ?
        Math.round((metrics.closedWon / Number(goal['成約目標'])) * 100) : null
    };
  } catch (error) {
    Logger.log('getBuddyDashboardSummary エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// ユーティリティ関数
// ==========================================

/**
 * Buddy知識DBシートの列幅を修正
 * 手動実行用関数
 */
function fixBuddySheetColumnWidths() {
  const ss = getSpreadsheet();
  const results = [];

  // Buddy人格設定
  const personalitySheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PERSONALITY);
  if (personalitySheet) {
    personalitySheet.setColumnWidth(1, 120);  // 項目
    personalitySheet.setColumnWidth(2, 250);  // 値
    personalitySheet.setColumnWidth(3, 150);  // 備考
    results.push({ sheet: 'Buddy人格設定', status: 'fixed' });
  }

  // Buddy言い回し
  const phrasesSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.PHRASES);
  if (phrasesSheet) {
    phrasesSheet.setColumnWidth(1, 100);  // シーン
    phrasesSheet.setColumnWidth(2, 200);  // Bad例
    phrasesSheet.setColumnWidth(3, 350);  // Good例
    phrasesSheet.setColumnWidth(4, 120);  // 使用タイミング
    results.push({ sheet: 'Buddy言い回し', status: 'fixed' });
  }

  // Buddy営業ナレッジ
  const knowledgeSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.KNOWLEDGE);
  if (knowledgeSheet) {
    knowledgeSheet.setColumnWidth(1, 100);  // カテゴリ
    knowledgeSheet.setColumnWidth(2, 120);  // タイトル
    knowledgeSheet.setColumnWidth(3, 400);  // 内容
    knowledgeSheet.setColumnWidth(4, 80);   // ソース
    knowledgeSheet.setColumnWidth(5, 60);   // 有効
    results.push({ sheet: 'Buddy営業ナレッジ', status: 'fixed' });
  }

  // Buddy会話テンプレート
  const templatesSheet = ss.getSheetByName(BUDDY_KNOWLEDGE_SHEETS.TEMPLATES);
  if (templatesSheet) {
    templatesSheet.setColumnWidth(1, 100);  // モード
    templatesSheet.setColumnWidth(2, 80);   // フェーズ
    templatesSheet.setColumnWidth(3, 500);  // テンプレート
    templatesSheet.setColumnWidth(4, 150);  // 変数
    results.push({ sheet: 'Buddy会話テンプレート', status: 'fixed' });
  }

  Logger.log('列幅修正完了: ' + JSON.stringify(results));
  return { success: true, results: results };
}

// ==========================================
// Buddy日替わりメッセージ機能
// ==========================================

/**
 * 日替わりメッセージシートのヘッダー
 */
const DAILY_MESSAGE_HEADERS = [
  '担当者ID',
  '担当者名',
  '日付',
  'メッセージ',
  '生成時刻',
  '状況タグ'
];

/**
 * 日替わりメッセージシートを作成
 */
function setupDailyMessageSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Buddy日替わりメッセージ');

  if (!sheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet = ss.getSheetByName('Buddy日替わりメッセージ');
      if (!sheet) {
        sheet = ss.insertSheet('Buddy日替わりメッセージ');
      }
    } finally {
      lock.releaseLock();
    }
  }

  // ヘッダー設定
  sheet.getRange(1, 1, 1, DAILY_MESSAGE_HEADERS.length).setValues([DAILY_MESSAGE_HEADERS]);
  sheet.getRange(1, 1, 1, DAILY_MESSAGE_HEADERS.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 列幅調整
  sheet.setColumnWidth(1, 100);  // 担当者ID
  sheet.setColumnWidth(2, 100);  // 担当者名
  sheet.setColumnWidth(3, 100);  // 日付
  sheet.setColumnWidth(4, 500);  // メッセージ
  sheet.setColumnWidth(5, 150);  // 生成時刻
  sheet.setColumnWidth(6, 200);  // 状況タグ

  sheet.setFrozenRows(1);

  Logger.log('Buddy日替わりメッセージシートを作成しました');
  return { success: true, message: 'シートを作成しました' };
}

/**
 * 担当者の状況を分析
 * @param {string} staffId - 担当者ID
 * @returns {Object} 状況データ
 */
function analyzeStaffSituation(staffId) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 今月の期間
  const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

  // 各種データを取得
  const goal = getCurrentGoal(staffId, '月次');
  const metrics = getPerformanceMetrics(staffId, '月次', currentMonth);
  const goalProgress = getGoalProgress(staffId, '月次', currentMonth);

  // 昨日の成約を取得
  const yesterdayDeals = getDealsClosedOn(staffId, yesterday);

  // 今日期限のアクションを取得
  const todayDueActions = getActionsDueOn(staffId, today);

  // 週次レポート提出状況
  const weeklyReportSubmitted = isWeeklyReportSubmitted(staffId);

  // 月末判定（残り3日以内）
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const remainingDays = lastDay.getDate() - today.getDate();
  const isMonthEnd = remainingDays <= 3;

  // 月初判定（3日以内）
  const isMonthStart = today.getDate() <= 3;

  // 曜日判定
  const dayOfWeek = today.getDay();
  const isFriday = dayOfWeek === 5;
  const isMonday = dayOfWeek === 1;

  return {
    yesterdayDeals: yesterdayDeals,
    monthlyGoal: goal,
    monthlyMetrics: metrics,
    monthlyProgress: goalProgress,
    activeDeals: metrics ? metrics.inProgress : 0,
    todayDueActions: todayDueActions,
    weeklyReportSubmitted: weeklyReportSubmitted,
    isMonthEnd: isMonthEnd,
    isMonthStart: isMonthStart,
    isFriday: isFriday,
    isMonday: isMonday,
    remainingDaysInMonth: remainingDays,
    dayOfWeek: dayOfWeek
  };
}

/**
 * 指定日に成約した案件を取得
 * @param {string} staffId - 担当者ID
 * @param {Date} date - 日付
 * @returns {Array} 成約案件一覧
 */
function getDealsClosedOn(staffId, date) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const staffIdIdx = _leadsHeaderIdx(headers, 'assignee_id', '担当者ID');
    const statusIdx = headers.indexOf('進捗ステータス');
    const tradeDateIdx = _leadsHeaderIdx(headers, 'first_transaction_date', '初回取引日');
    const customerIdx = headers.indexOf('顧客名');
    const revenueIdx = _leadsHeaderIdx(headers, 'first_transaction_amount', '初回取引金額');

    const targetDateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    const deals = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[staffIdIdx] !== staffId) continue;
      if (row[statusIdx] !== '成約') continue;

      const tradeDate = row[tradeDateIdx];
      if (!tradeDate) continue;

      const tradeDateStr = tradeDate instanceof Date ?
        Utilities.formatDate(tradeDate, 'Asia/Tokyo', 'yyyy-MM-dd') :
        String(tradeDate).substring(0, 10);

      if (tradeDateStr === targetDateStr) {
        deals.push({
          company: row[customerIdx] || '(顧客名未設定)',
          revenue: row[revenueIdx] || 0
        });
      }
    }

    return deals;
  } catch (error) {
    Logger.log('getDealsClosedOn エラー: ' + error.message);
    return [];
  }
}

/**
 * 指定日が期限のアクションを取得
 * @param {string} staffId - 担当者ID
 * @param {Date} date - 日付
 * @returns {Array} アクション一覧
 */
function getActionsDueOn(staffId, date) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const staffIdIdx = _leadsHeaderIdx(headers, 'assignee_id', '担当者ID');
    const statusIdx = headers.indexOf('進捗ステータス');
    const actionIdx = _leadsHeaderIdx(headers, 'next_action', '次回アクション');
    const actionDateIdx = _leadsHeaderIdx(headers, 'next_action_date', '次回アクション日');
    const customerIdx = headers.indexOf('顧客名');

    const targetDateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    const actions = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[staffIdIdx] !== staffId) continue;
      if (!['アサイン確定', '商談中'].includes(row[statusIdx])) continue;

      const actionDate = row[actionDateIdx];
      if (!actionDate) continue;

      const actionDateStr = actionDate instanceof Date ?
        Utilities.formatDate(actionDate, 'Asia/Tokyo', 'yyyy-MM-dd') :
        String(actionDate).substring(0, 10);

      if (actionDateStr === targetDateStr) {
        actions.push({
          company: row[customerIdx] || '(顧客名未設定)',
          action: row[actionIdx] || 'フォローアップ'
        });
      }
    }

    return actions;
  } catch (error) {
    Logger.log('getActionsDueOn エラー: ' + error.message);
    return [];
  }
}

/**
 * 週次レポートが今週提出済みかチェック
 * @param {string} staffId - 担当者ID
 * @returns {boolean} 提出済みかどうか
 */
function isWeeklyReportSubmitted(staffId) {
  try {
    const now = new Date();
    const weekNum = getISOWeekNumber(now);
    const currentWeek = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');

    const reports = getWeeklyReports(staffId, 1);
    return reports.length > 0 && reports[0]['対象週'] === currentWeek;
  } catch (error) {
    Logger.log('isWeeklyReportSubmitted エラー: ' + error.message);
    return false;
  }
}

/**
 * 状況に応じた日替わりメッセージを生成
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @returns {Object} メッセージと状況タグ
 */
function generateDailyBuddyMessage(staffId, staffName) {
  const situation = analyzeStaffSituation(staffId);
  const hour = new Date().getHours();
  const tags = [];

  // 挨拶（時間帯別）
  let greeting;
  if (hour < 12) greeting = 'おはよう';
  else if (hour < 18) greeting = 'こんにちは';
  else greeting = 'こんばんは';

  let message = `${greeting}、${staffName}さん！`;

  // 月曜日のメッセージ
  if (situation.isMonday) {
    message += '\n新しい週のスタート、今週も一緒に頑張ろう！';
    tags.push('月曜');
  }

  // 昨日の成約があれば最優先で表示
  if (situation.yesterdayDeals && situation.yesterdayDeals.length > 0) {
    const deal = situation.yesterdayDeals[0];
    message += `\n昨日の${deal.company}成約、お見事だったね👍`;
    tags.push('成約あり');

    if (situation.yesterdayDeals.length > 1) {
      message += ` (他${situation.yesterdayDeals.length - 1}件も！)`;
    }
  }

  // 月初のメッセージ
  if (situation.isMonthStart) {
    message += '\n新しい月のスタート🎉 今月も目標達成目指して頑張ろう！';
    tags.push('月初');
  }
  // 月末のメッセージ
  else if (situation.isMonthEnd) {
    message += `\n今月もあと${situation.remainingDaysInMonth}日。ラストスパート💪`;
    tags.push('月末');
  }

  // 今日期限のアクション
  if (situation.todayDueActions && situation.todayDueActions.length > 0) {
    const action = situation.todayDueActions[0];
    message += `\n今日は${action.company}の${action.action}期限だよ。`;
    tags.push('アクション期限');

    if (situation.todayDueActions.length > 1) {
      message += ` (他${situation.todayDueActions.length - 1}件)`;
    }
  }

  // 金曜日の週次レポート促進
  if (situation.isFriday && !situation.weeklyReportSubmitted) {
    message += '\n今日は金曜日、週次レポートの日だよ📝';
    tags.push('週次レポート未提出');
  }

  // 目標進捗
  if (situation.monthlyProgress && situation.monthlyProgress.hasGoal) {
    const progress = situation.monthlyProgress.progress;
    if (progress && progress.closedRate !== undefined) {
      const rate = progress.closedRate;

      if (rate >= 100) {
        message += '\n今月の目標達成おめでとう！🎉 さらに上を目指そう！';
        tags.push('目標達成');
      } else if (rate >= 80) {
        message += `\n今月の達成率${rate}%、素晴らしいペース！あと少し！`;
        tags.push('目標達成率高');
      } else if (rate < 50 && !situation.isMonthStart) {
        const goal = situation.monthlyGoal;
        const metrics = situation.monthlyMetrics;
        if (goal && metrics) {
          const remaining = (Number(goal['成約目標']) || 0) - (metrics.closedWon || 0);
          if (remaining > 0) {
            message += `\n目標まであと${remaining}件、一緒に頑張ろう！`;
            tags.push('目標進捗遅れ');
          }
        }
      }
    }
  }

  // 進行中案件の情報
  if (situation.activeDeals > 0 && !situation.todayDueActions.length) {
    message += `\n進行中の案件が${situation.activeDeals}件あるよ。優先度高いものから進めよう！`;
  }

  // 昨日の日報を参照してメッセージを追加
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
    const yesterdayReport = getDailyReport(staffId, yesterdayStr);

    if (yesterdayReport && yesterdayReport.status === '提出済') {
      // 明日の予定（=今日の予定）を参照
      if (yesterdayReport.tomorrowPlan && yesterdayReport.tomorrowPlan.trim() !== '') {
        const firstItem = extractFirstItem(yesterdayReport.tomorrowPlan);
        if (firstItem) {
          message += `\n今日は「${firstItem}」の予定だったね。頑張って！`;
          tags.push('昨日日報参照');
        }
      }

      // 困っていることがあった場合
      if (yesterdayReport.trouble && yesterdayReport.trouble.trim() !== '') {
        message += '\n昨日困ってたこと、解決できそう？相談あればいつでも話してね。';
        tags.push('フォローアップ');
      }
    }
  } catch (e) {
    Logger.log('日報参照エラー: ' + e.message);
  }

  return {
    message: message,
    tags: tags.join(',')
  };
}

/**
 * テキストから最初の項目を抽出
 * @param {string} text - テキスト
 * @returns {string} 最初の項目
 */
function extractFirstItem(text) {
  if (!text) return '';

  // 改行で分割して最初の行を取得
  const lines = text.split(/[\n\r]+/);
  if (lines.length > 0) {
    let firstLine = lines[0].trim();
    // 箇条書きマーカーを除去
    firstLine = firstLine.replace(/^[-・●◆▪️▸►→]/, '').trim();
    // 長すぎる場合は切り詰め
    if (firstLine.length > 30) {
      firstLine = firstLine.substring(0, 30) + '...';
    }
    return firstLine;
  }
  return '';
}

/**
 * 全担当者の日替わりメッセージを生成・保存
 * 毎日AM5:00に実行（トリガー設定）
 */
function generateDailyBuddyMessagesForAll() {
  try {
    const staffList = getStaffList();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Buddy日替わりメッセージ');

    // シートがなければ作成
    if (!sheet) {
      setupDailyMessageSheet();
      sheet = ss.getSheetByName('Buddy日替わりメッセージ');
    }

    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const now = new Date();
    let count = 0;

    staffList.forEach(staff => {
      // 有効なスタッフのみ
      if (staff['ステータス'] !== '有効') return;

      const staffId = staff['担当者ID'];
      const staffName = ((staff['苗字（日本語）'] || '') + ' ' + (staff['名前（日本語）'] || '')).trim() || staff['氏名（日本語）'] || '担当者';

      try {
        const result = generateDailyBuddyMessage(staffId, staffName);

        // シートに保存
        sheet.appendRow([
          staffId,
          staffName,
          today,
          result.message,
          now,
          result.tags
        ]);

        count++;
      } catch (e) {
        Logger.log(`${staffId} のメッセージ生成エラー: ${e.message}`);
      }
    });

    Logger.log(`日替わりメッセージ生成完了: ${count}件`);
    return { success: true, count: count };
  } catch (error) {
    Logger.log('generateDailyBuddyMessagesForAll エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 今日のBuddyメッセージを取得
 * @param {string} staffId - 担当者ID
 * @returns {string} メッセージ
 */
function getTodayBuddyMessage(staffId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Buddy日替わりメッセージ');

    if (!sheet || sheet.getLastRow() < 2) {
      return getDefaultBuddyGreeting(staffId);
    }

    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const data = sheet.getDataRange().getValues();

    // 最新のものから検索
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const rowDate = row[2] instanceof Date ?
        Utilities.formatDate(row[2], 'Asia/Tokyo', 'yyyy-MM-dd') :
        String(row[2]).substring(0, 10);

      if (row[0] === staffId && rowDate === today) {
        return row[3]; // メッセージ
      }
    }

    // 今日のメッセージがない場合はリアルタイム生成
    return getDefaultBuddyGreeting(staffId);
  } catch (error) {
    Logger.log('getTodayBuddyMessage エラー: ' + error.message);
    return getDefaultBuddyGreeting(staffId);
  }
}

/**
 * デフォルトのBuddy挨拶を取得
 * @param {string} staffId - 担当者ID（オプション）
 * @returns {string} 挨拶メッセージ
 */
function getDefaultBuddyGreeting(staffId) {
  const hour = new Date().getHours();
  let greeting;

  if (hour < 12) greeting = 'おはよう';
  else if (hour < 18) greeting = 'こんにちは';
  else greeting = 'こんばんは';

  // スタッフ名を取得して挨拶
  if (staffId) {
    try {
      const staffList = getStaffList();
      const staff = staffList.find(s => s['担当者ID'] === staffId);
      if (staff) {
        const name = ((staff['苗字（日本語）'] || '') + ' ' + (staff['名前（日本語）'] || '')).trim() || staff['氏名（日本語）'];
        if (name) {
          return `${greeting}、${name}さん！今日も頑張ろう💪`;
        }
      }
    } catch (e) {
      // エラー時はデフォルト
    }
  }

  return `${greeting}！今日も頑張ろう💪`;
}

/**
 * 日替わりメッセージ生成トリガーを設定
 * 手動実行用関数
 */
function setupDailyMessageTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'generateDailyBuddyMessagesForAll') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // AM5:00に実行するトリガーを作成
  ScriptApp.newTrigger('generateDailyBuddyMessagesForAll')
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('日替わりメッセージトリガーを設定しました（毎日AM5:00）');
  return { success: true, message: 'トリガーを設定しました' };
}

/**
 * 古い日替わりメッセージを削除（30日以上前）
 * 月1回実行推奨
 */
function cleanupOldDailyMessages() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Buddy日替わりメッセージ');

    if (!sheet || sheet.getLastRow() < 2) return { success: true, deleted: 0 };

    const data = sheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const rowsToDelete = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const rowDate = data[i][2] instanceof Date ? data[i][2] : new Date(data[i][2]);
      if (rowDate < cutoffDate) {
        rowsToDelete.push(i + 1); // 1-indexed
      }
    }

    // 後ろから削除
    rowsToDelete.forEach(row => {
      sheet.deleteRow(row);
    });

    Logger.log(`古いメッセージを${rowsToDelete.length}件削除しました`);
    return { success: true, deleted: rowsToDelete.length };
  } catch (error) {
    Logger.log('cleanupOldDailyMessages エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}
