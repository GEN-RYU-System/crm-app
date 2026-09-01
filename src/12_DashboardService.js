/**
 * DashboardService.gs
 * ダッシュボード機能を提供するサービス
 * Phase 2: ダッシュボード強化
 */

/**
 * チームダッシュボードデータを取得
 * @returns {Object} チームダッシュボードデータ
 */
function getTeamDashboardData() {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  const goalsSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!leadSheet) {
    return { error: 'リード管理シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = staffSheet ? getSheetDataAsObjects(staffSheet) : [];
  const goals = goalsSheet ? getSheetDataAsObjects(goalsSheet) : [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const thisWeekStart = getWeekStart(now);

  // 営業担当者のみフィルタ
  const salesStaff = staff.filter(s => s['役割'] === '営業' && s['ステータス'] === '有効');

  // チームメンバーごとの統計を計算
  const memberStats = salesStaff.map(member => {
    const memberName = getStaffFullName(member);
    const memberDeals = leads.filter(l => l['担当者'] === memberName);

    // 商談段階のデータ
    const activeDeals = memberDeals.filter(l => CONFIG.DEAL_STATUSES.includes(l['進捗ステータス']));
    const wonDeals = memberDeals.filter(l => l['進捗ステータス'] === '成約');
    const lostDeals = memberDeals.filter(l => l['進捗ステータス'] === '失注');

    // 今月の成約
    const thisMonthWon = wonDeals.filter(l => {
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    // 売上計算
    const totalSales = wonDeals.reduce((sum, l) => sum + (parseFloat(l['first_transaction_amount']) || 0), 0);
    const thisMonthSales = thisMonthWon.reduce((sum, l) => sum + (parseFloat(l['first_transaction_amount']) || 0), 0);

    // 成約率計算
    const closedDeals = wonDeals.length + lostDeals.length;
    const winRate = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : 0;

    // 目標取得
    const memberGoal = goals.find(g =>
      g['assignee_id'] === member['assignee_id'] &&
      g['期間タイプ'] === '月次' &&
      g['期間'] === `${thisYear}/${String(thisMonth + 1).padStart(2, '0')}`
    );

    return {
      担当者ID: member['assignee_id'],
      担当者名: memberName,
      進行中商談: activeDeals.length,
      成約数: wonDeals.length,
      失注数: lostDeals.length,
      成約率: winRate,
      総売上: totalSales,
      今月売上: thisMonthSales,
      今月成約数: thisMonthWon.length,
      目標商談数: memberGoal ? memberGoal['商談数目標'] : null,
      目標成約数: memberGoal ? memberGoal['成約数目標'] : null,
      目標売上: memberGoal ? memberGoal['売上目標'] : null,
      目標達成率: memberGoal && memberGoal['売上目標'] ?
        Math.round((thisMonthSales / parseFloat(memberGoal['売上目標'])) * 100) : null
    };
  });

  // チーム全体の統計
  const teamTotal = {
    totalDeals: memberStats.reduce((sum, m) => sum + m.進行中商談, 0),
    totalWon: memberStats.reduce((sum, m) => sum + m.成約数, 0),
    totalLost: memberStats.reduce((sum, m) => sum + m.失注数, 0),
    totalSales: memberStats.reduce((sum, m) => sum + m.総売上, 0),
    thisMonthSales: memberStats.reduce((sum, m) => sum + m.今月売上, 0),
    thisMonthWon: memberStats.reduce((sum, m) => sum + m.今月成約数, 0),
    avgWinRate: memberStats.length > 0 ?
      Math.round(memberStats.reduce((sum, m) => sum + m.成約率, 0) / memberStats.length) : 0
  };

  return {
    teamTotal: teamTotal,
    memberStats: memberStats.sort((a, b) => b.今月売上 - a.今月売上),
    lastUpdated: now.toISOString()
  };
}

// 注: 旧バージョンのgetPersonalDashboardDataは削除されました
// 新しいバージョンは下部に定義されています（activeDeals, leadId, messageUrl対応）

/**
 * トレンドデータを取得（グラフ用）
 * @param {string} staffId - 担当者ID（nullの場合はチーム全体）
 * @param {number} months - 取得する月数（デフォルト6ヶ月）
 * @returns {Object} トレンドデータ
 */
function getTrendData(staffId, months) {
  months = months || 6;

  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!leadSheet) {
    return { error: 'リード管理シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = staffSheet ? getSheetDataAsObjects(staffSheet) : [];

  // 担当者名を取得
  let staffName = null;
  if (staffId) {
    const currentStaff = staff.find(s => s['assignee_id'] === staffId);
    if (currentStaff) {
      staffName = getStaffFullName(currentStaff);
    }
  }

  // 対象リードをフィルタ
  const targetLeads = staffName ?
    leads.filter(l => l['担当者'] === staffName) :
    leads;

  const now = new Date();
  const trendData = [];

  // 過去N月分のデータを集計
  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    const monthLabel = `${targetYear}/${String(targetMonth + 1).padStart(2, '0')}`;

    // その月の成約
    const monthWon = targetLeads.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });

    // その月の失注
    const monthLost = targetLeads.filter(l => {
      if (l['進捗ステータス'] !== '失注') return false;
      const date = new Date(l['sheet_updated_at']);
      return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });

    // その月のアサイン
    const monthAssigned = targetLeads.filter(l => {
      if (!l['assigned_at']) return false;
      const date = new Date(l['assigned_at']);
      return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });

    const monthSales = monthWon.reduce((sum, l) => sum + (parseFloat(l['first_transaction_amount']) || 0), 0);

    trendData.push({
      month: monthLabel,
      成約数: monthWon.length,
      失注数: monthLost.length,
      新規商談: monthAssigned.length,
      売上: monthSales,
      成約率: (monthWon.length + monthLost.length) > 0 ?
        Math.round((monthWon.length / (monthWon.length + monthLost.length)) * 100) : 0
    });
  }

  return {
    labels: trendData.map(d => d.month),
    datasets: {
      成約数: trendData.map(d => d.成約数),
      失注数: trendData.map(d => d.失注数),
      新規商談: trendData.map(d => d.新規商談),
      売上: trendData.map(d => d.売上),
      成約率: trendData.map(d => d.成約率)
    },
    raw: trendData
  };
}

/**
 * 目標進捗ランキングを取得
 * @param {string} periodType - 期間タイプ（月次/週次）
 * @param {string} period - 期間（例: 2024/01）
 * @returns {Array} ランキングデータ
 */
function getGoalProgressRanking(periodType, period) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  const goalsSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!leadSheet || !goalsSheet) {
    return { error: 'シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = staffSheet ? getSheetDataAsObjects(staffSheet) : [];
  const goals = getSheetDataAsObjects(goalsSheet);

  // 営業担当者で目標設定がある人をフィルタ
  const periodGoals = goals.filter(g =>
    g['期間タイプ'] === periodType &&
    g['期間'] === period
  );

  if (periodGoals.length === 0) {
    return { message: '目標が設定されていません', ranking: [] };
  }

  // 期間を解析
  const [year, monthOrWeek] = period.split('/');
  const targetMonth = parseInt(monthOrWeek) - 1;
  const targetYear = parseInt(year);

  const ranking = periodGoals.map(goal => {
    // 担当者情報を取得
    const staffMember = staff.find(s => s['assignee_id'] === goal['assignee_id']);
    const staffName = staffMember ? getStaffFullName(staffMember) : goal['担当者名'];

    // 実績を計算
    const memberDeals = leads.filter(l => l['担当者'] === staffName);
    const wonDeals = memberDeals.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });

    const actualSales = wonDeals.reduce((sum, l) => sum + (parseFloat(l['first_transaction_amount']) || 0), 0);
    const actualWon = wonDeals.length;

    const salesGoal = parseFloat(goal['売上目標']) || 0;
    const wonGoal = parseInt(goal['成約数目標']) || 0;

    return {
      担当者ID: goal['assignee_id'],
      担当者名: staffName,
      売上目標: salesGoal,
      売上実績: actualSales,
      売上達成率: salesGoal > 0 ? Math.round((actualSales / salesGoal) * 100) : 0,
      成約目標: wonGoal,
      成約実績: actualWon,
      成約達成率: wonGoal > 0 ? Math.round((actualWon / wonGoal) * 100) : 0
    };
  }).sort((a, b) => b.売上達成率 - a.売上達成率);

  // 順位を付与
  ranking.forEach((item, index) => {
    item.順位 = index + 1;
  });

  return {
    period: period,
    periodType: periodType,
    ranking: ranking,
    topPerformer: ranking.length > 0 ? ranking[0] : null,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * CSダッシュボードデータを取得
 * @returns {Object} CSダッシュボードデータ
 */
function getCsDashboardData() {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet) {
    return { error: 'リード管理シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = getWeekStart(now);

  // リード段階のデータのみ
  const leadsOnly = leads.filter(l => CONFIG.LEAD_STATUSES.includes(l['進捗ステータス']));

  // 本日の新規リード
  const todayNew = leadsOnly.filter(l => {
    const regDate = new Date(l['registered_at']);
    return regDate >= today;
  });

  // アサイン待ち（対応中）
  const waitingAssign = leadsOnly.filter(l => l['進捗ステータス'] === '対応中');

  // 今週アサイン確定
  const weekAssigned = leads.filter(l => {
    if (!l['assigned_at']) return false;
    const assignDate = new Date(l['assigned_at']);
    return assignDate >= thisWeekStart;
  });

  // 種別別集計
  const byType = {
    インバウンド: leadsOnly.filter(l => l['lead_type'] === 'インバウンド').length,
    アウトバウンド: leadsOnly.filter(l => l['lead_type'] === 'アウトバウンド').length
  };

  // 温度感別集計
  const byTemp = {
    高: leadsOnly.filter(l => l['temperature'] === '高').length,
    中: leadsOnly.filter(l => l['temperature'] === '中').length,
    低: leadsOnly.filter(l => l['temperature'] === '低').length
  };

  return {
    todayNew: todayNew.length,
    waitingAssign: waitingAssign.length,
    weekAssigned: weekAssigned.length,
    totalLeads: leadsOnly.length,
    byType: byType,
    byTemp: byTemp,
    lastUpdated: now.toISOString()
  };
}

/**
 * アラート対象のデータを取得（期限超過、長期未更新など）
 * @returns {Object} アラートデータ
 */
function getAlertData() {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet) {
    return { error: 'リード管理シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 商談中のもののみ
  const activeDeals = leads.filter(l => CONFIG.DEAL_STATUSES.includes(l['進捗ステータス']));

  // アクション期限超過
  const overdueActions = activeDeals.filter(l => {
    if (!l['next_action_date']) return false;
    const actionDate = new Date(l['next_action_date']);
    return actionDate < today;
  }).map(l => ({
    リードID: l['lead_id'],
    顧客名: l['customer_name'],
    担当者: l['担当者'],
    次回アクション日: l['next_action_date'],
    超過日数: Math.floor((today - new Date(l['next_action_date'])) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => b.超過日数 - a.超過日数);

  // 長期未更新（7日以上）
  const staleDeals = activeDeals.filter(l => {
    if (!l['sheet_updated_at']) return false;
    const updateDate = new Date(l['sheet_updated_at']);
    const daysSinceUpdate = Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate >= 7;
  }).map(l => ({
    リードID: l['lead_id'],
    顧客名: l['customer_name'],
    担当者: l['担当者'],
    シート更新日: l['sheet_updated_at'],
    未更新日数: Math.floor((now - new Date(l['sheet_updated_at'])) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => b.未更新日数 - a.未更新日数);

  // 高温度で進捗なし（3日以上）
  const hotLeadsNoProgress = activeDeals.filter(l => {
    if (l['temperature'] !== '高') return false;
    if (!l['sheet_updated_at']) return false;
    const updateDate = new Date(l['sheet_updated_at']);
    const daysSinceUpdate = Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate >= 3;
  }).map(l => ({
    リードID: l['lead_id'],
    顧客名: l['customer_name'],
    担当者: l['担当者'],
    温度感: l['temperature'],
    未更新日数: Math.floor((now - new Date(l['sheet_updated_at'])) / (1000 * 60 * 60 * 24))
  }));

  return {
    overdueActions: overdueActions,
    staleDeals: staleDeals,
    hotLeadsNoProgress: hotLeadsNoProgress,
    summary: {
      期限超過: overdueActions.length,
      長期未更新: staleDeals.length,
      高温度要注意: hotLeadsNoProgress.length,
      total: overdueActions.length + staleDeals.length + hotLeadsNoProgress.length
    },
    lastUpdated: now.toISOString()
  };
}

// ==================== ヘルパー関数 ====================

/**
 * 担当者のフルネームを取得
 * @param {Object} staff - 担当者データ
 * @returns {string} フルネーム
 */
function getStaffFullName(staff) {
  // 新形式（苗字/名前分離）
  if (staff['苗字（日本語）'] && staff['名前（日本語）']) {
    return staff['苗字（日本語）'] + ' ' + staff['名前（日本語）'];
  }
  // 旧形式（氏名統合）
  if (staff['氏名（日本語）']) {
    return staff['氏名（日本語）'];
  }
  // フォールバック
  return staff['担当者名'] || staff['assignee_id'] || '不明';
}

/**
 * 週の開始日を取得（月曜始まり）
 * @param {Date} date - 基準日
 * @returns {Date} 週の開始日
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * シートデータをオブジェクト配列に変換
 * @param {Sheet} sheet - シート
 * @returns {Array} オブジェクト配列
 */
function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // 空行スキップ

    const obj = {};
    headers.forEach((header, index) => {
      let value = row[index];
      // Date オブジェクトは ISO 文字列に変換（google.script.run シリアライズ対策）
      if (value instanceof Date) {
        value = value.toISOString();
      }
      obj[header] = value;
    });
    result.push(obj);
  }

  return result;
}

// ==========================================
// 個人ダッシュボード用API
// ==========================================

/**
 * 個人ダッシュボードデータを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} 個人ダッシュボードデータ
 */
function getPersonalDashboardData(staffId) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const goalsSheet = ss.getSheetByName('目標設定');

  if (!leadSheet) {
    return { error: 'リード管理シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 担当者名を取得
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  let staffName = '';
  if (staffSheet) {
    const staffData = staffSheet.getDataRange().getValues();
    const staffHeaders = staffData[0];
    const idIdx = staffHeaders.indexOf('staff_id');
    const lastNameIdx = staffHeaders.indexOf('last_name_ja');
    const firstNameIdx = staffHeaders.indexOf('first_name_ja');
    const fullNameIdx = staffHeaders.indexOf('full_name_ja');

    for (let i = 1; i < staffData.length; i++) {
      if (staffData[i][idIdx] === staffId) {
        if (lastNameIdx >= 0 && firstNameIdx >= 0) {
          staffName = ((staffData[i][lastNameIdx] || '') + ' ' + (staffData[i][firstNameIdx] || '')).trim();
        }
        if (!staffName && fullNameIdx >= 0) {
          staffName = staffData[i][fullNameIdx];
        }
        break;
      }
    }
  }

  // 自分の案件をフィルタ
  const myDeals = leads.filter(l => l['担当者'] === staffName || l['assignee_id'] === staffId);

  // 進行中の案件（Config.gsの定義を使用）
  const activeStatuses = CONFIG.DEAL_STATUSES || ['アサイン確定', '商談中'];
  const activeDeals = myDeals.filter(l => activeStatuses.includes(l['進捗ステータス']));

  // 今月の成約
  const thisMonthWon = myDeals.filter(l => {
    if (l['進捗ステータス'] !== '成約') return false;
    const tradeDate = l['first_transaction_date'] || l['sheet_updated_at'];
    if (!tradeDate) return false;
    const date = new Date(tradeDate);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });

  // 今月の売上
  const thisMonthSales = thisMonthWon.reduce((sum, l) => {
    return sum + (parseFloat(l['monthly_expected_amount']) || parseFloat(l['first_transaction_amount']) || 0);
  }, 0);

  // 目標進捗
  let goalProgress = { hasGoal: false };
  if (goalsSheet && goalsSheet.getLastRow() >= 2) {
    const goalsData = getSheetDataAsObjects(goalsSheet);
    const currentPeriod = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`;

    const currentGoal = goalsData.find(g =>
      g['assignee_id'] === staffId &&
      g['対象期間タイプ'] === '月次' &&
      g['対象期間'] === currentPeriod &&
      g['ステータス'] === '進行中'
    );

    if (currentGoal) {
      const closedTarget = Number(currentGoal['成約目標']) || 0;
      const salesTarget = Number(currentGoal['売上目標']) || 0;

      goalProgress = {
        hasGoal: true,
        closedCurrent: thisMonthWon.length,
        closedTarget: closedTarget,
        closedPercent: closedTarget > 0 ? Math.round((thisMonthWon.length / closedTarget) * 100) : 0,
        salesCurrent: Math.round(thisMonthSales / 10000), // 万円単位
        salesTarget: Math.round(salesTarget / 10000),
        salesPercent: salesTarget > 0 ? Math.round((thisMonthSales / salesTarget) * 100) : 0
      };
    }
  }

  // 期限間近のアクション（今日〜7日以内）
  const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingActions = activeDeals
    .filter(l => {
      if (!l['next_action_date']) return false;
      const actionDate = new Date(l['next_action_date']);
      return actionDate >= today && actionDate <= sevenDaysLater;
    })
    .map(l => {
      const actionDate = new Date(l['next_action_date']);
      const daysDiff = Math.floor((actionDate - today) / (1000 * 60 * 60 * 24));

      return {
        company: l['customer_name'] || '(顧客名なし)',
        action: l['next_action'] || '-',
        date: l['next_action_date'],
        dateFormatted: formatDateJP(actionDate),
        dueType: daysDiff === 0 ? 'today' : (daysDiff === 1 ? 'tomorrow' : 'later'),
        daysDiff: daysDiff
      };
    })
    .sort((a, b) => a.daysDiff - b.daysDiff)
    .slice(0, 5);

  // 担当案件（進行中）
  const activeDealsList = activeDeals
    .map(l => ({
      leadId: l['lead_id'] || '',
      company: l['customer_name'] || '(顧客名なし)',
      status: l['進捗ステータス'],
      amount: Math.round((parseFloat(l['monthly_expected_amount']) || 0) / 10000), // 万円単位
      nextAction: l['next_action'] || '-',
      nextActionDate: l['next_action_date'] || '',
      staff: l['担当者'] || '-',
      messageUrl: l['message_url'] || ''
    }))
    .slice(0, 10);

  return {
    goalProgress: goalProgress,
    upcomingActions: upcomingActions,
    activeDeals: activeDealsList,
    totalActiveDeals: activeDeals.length,
    lastUpdated: now.toISOString()
  };
}

/**
 * 日付を日本語形式でフォーマット
 */
function formatDateJP(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return '今日';
  if (daysDiff === 1) return '明日';
  return `${month}/${day}`;
}

// ============================================================
// ボトルネック特定ダッシュボード API
// ============================================================

/**
 * ボトルネックダッシュボード統合データ取得
 * チームKPI、ボトルネック、担当者パフォーマンスを一括取得
 */
function getBottleneckDashboardData() {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  const goalsSheet = ss.getSheetByName('目標設定');

  if (!leadSheet || !staffSheet) {
    return { error: 'シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = getSheetDataAsObjects(staffSheet);
  const goals = goalsSheet ? getSheetDataAsObjects(goalsSheet) : [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const settings = CONFIG.BOTTLENECK_SETTINGS;

  // 営業担当者のみ抽出
  const salesStaff = staff.filter(s =>
    s['ステータス'] === '有効' &&
    (s['役割'] === '営業' || s['役割'] === 'リーダー')
  );

  // 商談段階の案件
  const activeDeals = leads.filter(l => CONFIG.DEAL_STATUSES.includes(l['進捗ステータス']));
  const wonDeals = leads.filter(l => l['進捗ステータス'] === '成約');
  const lostDeals = leads.filter(l => l['進捗ステータス'] === '失注');

  // 今月の成約・失注
  const thisMonthWon = wonDeals.filter(l => {
    const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const thisMonthLost = lostDeals.filter(l => {
    const date = new Date(l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });

  // 先月の成約・失注
  const lastMonthWon = wonDeals.filter(l => {
    const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
    return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
  });
  const lastMonthLost = lostDeals.filter(l => {
    const date = new Date(l['sheet_updated_at']);
    return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
  });

  // ==================== チームKPI ====================
  const teamKPI = {
    totalDeals: activeDeals.length,
    wonDeals: thisMonthWon.length,
    winRate: (thisMonthWon.length + thisMonthLost.length) > 0
      ? Math.round((thisMonthWon.length / (thisMonthWon.length + thisMonthLost.length)) * 100)
      : 0,
    stagnantCount: 0 // 後で計算
  };

  // ==================== ボトルネック検出 ====================
  const stagnationThreshold = now.getTime() - (settings.STAGNATION_HOURS * 60 * 60 * 1000);
  const longDealThreshold = now.getTime() - (settings.LONG_DEAL_DAYS * 24 * 60 * 60 * 1000);

  // 停滞案件（商談メモ未更新48時間以上）
  const stagnantDeals = activeDeals.filter(l => {
    const updateDate = l['sheet_updated_at'] ? new Date(l['sheet_updated_at']).getTime() : 0;
    return updateDate < stagnationThreshold;
  }).map(l => ({
    leadId: l['lead_id'],
    customerName: l['customer_name'] || '(顧客名なし)',
    staffName: l['担当者'],
    status: l['進捗ステータス'],
    lastUpdate: l['sheet_updated_at'],
    hoursSinceUpdate: Math.floor((now.getTime() - new Date(l['sheet_updated_at']).getTime()) / (1000 * 60 * 60))
  }));

  teamKPI.stagnantCount = stagnantDeals.length;

  // 停滞案件を担当者別に集計
  const stagnantByStaff = {};
  stagnantDeals.forEach(d => {
    if (!stagnantByStaff[d.staffName]) {
      stagnantByStaff[d.staffName] = [];
    }
    stagnantByStaff[d.staffName].push(d);
  });

  // クロージング長期化案件
  const longDeals = activeDeals.filter(l => {
    const assignDate = l['assigned_at'] ? new Date(l['assigned_at']).getTime() : 0;
    return assignDate > 0 && assignDate < longDealThreshold;
  }).map(l => ({
    leadId: l['lead_id'],
    customerName: l['customer_name'] || '(顧客名なし)',
    staffName: l['担当者'],
    status: l['進捗ステータス'],
    assignDate: l['assigned_at'],
    daysSinceAssign: Math.floor((now.getTime() - new Date(l['assigned_at']).getTime()) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => b.daysSinceAssign - a.daysSinceAssign);

  // 成約率低下担当者
  const conversionDropStaff = [];
  salesStaff.forEach(s => {
    const staffName = getStaffFullName(s);
    const staffDeals = leads.filter(l => l['担当者'] === staffName);

    // 今月
    const thisMonthStaffWon = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;
    const thisMonthStaffLost = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '失注') return false;
      const date = new Date(l['sheet_updated_at']);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;
    const thisMonthTotal = thisMonthStaffWon + thisMonthStaffLost;
    const thisMonthRate = thisMonthTotal > 0 ? Math.round((thisMonthStaffWon / thisMonthTotal) * 100) : null;

    // 先月
    const lastMonthStaffWon = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    }).length;
    const lastMonthStaffLost = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '失注') return false;
      const date = new Date(l['sheet_updated_at']);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    }).length;
    const lastMonthTotal = lastMonthStaffWon + lastMonthStaffLost;
    const lastMonthRate = lastMonthTotal > 0 ? Math.round((lastMonthStaffWon / lastMonthTotal) * 100) : null;

    // 低下判定
    if (thisMonthRate !== null && lastMonthRate !== null && lastMonthRate > 0) {
      const drop = lastMonthRate - thisMonthRate;
      if (drop >= settings.CONVERSION_DROP_THRESHOLD) {
        conversionDropStaff.push({
          staffId: s['assignee_id'],
          staffName: staffName,
          thisMonthRate: thisMonthRate,
          lastMonthRate: lastMonthRate,
          drop: drop
        });
      }
    }
  });

  // ==================== 担当者別パフォーマンス ====================
  const staffPerformance = salesStaff.map(s => {
    const staffName = getStaffFullName(s);
    const staffDeals = leads.filter(l => l['担当者'] === staffName);
    const staffActiveDeals = staffDeals.filter(l => CONFIG.DEAL_STATUSES.includes(l['進捗ステータス']));

    // 今月の成約
    const staffWon = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    const staffLost = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '失注') return false;
      const date = new Date(l['sheet_updated_at']);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    const closedTotal = staffWon + staffLost;
    const winRate = closedTotal > 0 ? Math.round((staffWon / closedTotal) * 100) : null;

    // 停滞件数
    const stagnantCount = stagnantByStaff[staffName] ? stagnantByStaff[staffName].length : 0;

    // 目標取得
    const currentPeriod = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`;
    const staffGoal = goals.find(g =>
      g['assignee_id'] === s['assignee_id'] &&
      g['期間タイプ'] === '月次' &&
      g['期間'] === currentPeriod
    );
    const goalWinRate = staffGoal ? Number(staffGoal['成約率目標']) : null;

    // 状態判定
    let status = 'ok'; // ✅ 順調
    if (stagnantCount >= settings.STAGNATION_WARNING_COUNT) {
      status = 'critical'; // 🚨 要介入
    } else if (conversionDropStaff.find(c => c.staffId === s['assignee_id'])) {
      status = 'critical';
    } else if (stagnantCount >= 1 || (goalWinRate && winRate !== null && winRate < goalWinRate)) {
      status = 'warning'; // ⚠️ 注意
    }

    return {
      staffId: s['assignee_id'],
      staffName: staffName,
      dealCount: staffActiveDeals.length,
      wonCount: staffWon,
      stagnantCount: stagnantCount,
      winRate: winRate,
      goalWinRate: goalWinRate,
      status: status
    };
  }).sort((a, b) => {
    // criticalを先頭に、次にwarning、最後にok
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  return {
    teamKPI: teamKPI,
    bottlenecks: {
      stagnantDeals: stagnantDeals.slice(0, 10),
      stagnantByStaff: Object.keys(stagnantByStaff).map(name => ({
        staffName: name,
        count: stagnantByStaff[name].length
      })).sort((a, b) => b.count - a.count),
      longDeals: longDeals.slice(0, 10),
      conversionDropStaff: conversionDropStaff
    },
    staffPerformance: staffPerformance,
    lastUpdated: now.toLocaleString('ja-JP')
  };
}

/**
 * 担当者詳細データ取得（ボトルネック用）
 * @param {string} staffId - 担当者ID
 */
function getStaffDetailForBottleneck(staffId) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!leadSheet || !staffSheet) {
    return { error: 'シートが見つかりません' };
  }

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = getSheetDataAsObjects(staffSheet);

  const targetStaff = staff.find(s => s['assignee_id'] === staffId);
  if (!targetStaff) {
    return { error: '担当者が見つかりません' };
  }

  const staffName = getStaffFullName(targetStaff);
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const settings = CONFIG.BOTTLENECK_SETTINGS;
  const stagnationThreshold = now.getTime() - (settings.STAGNATION_HOURS * 60 * 60 * 1000);

  const staffDeals = leads.filter(l => l['担当者'] === staffName);
  const activeDeals = staffDeals.filter(l => CONFIG.DEAL_STATUSES.includes(l['進捗ステータス']));

  // 今月の数字
  const thisMonthWon = staffDeals.filter(l => {
    if (l['進捗ステータス'] !== '成約') return false;
    const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  }).length;

  const thisMonthLost = staffDeals.filter(l => {
    if (l['進捗ステータス'] !== '失注') return false;
    const date = new Date(l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  }).length;

  const closedTotal = thisMonthWon + thisMonthLost;
  const winRate = closedTotal > 0 ? Math.round((thisMonthWon / closedTotal) * 100) : null;

  // 対応が必要な案件
  const problemDeals = activeDeals.map(l => {
    const updateDate = l['sheet_updated_at'] ? new Date(l['sheet_updated_at']).getTime() : 0;
    const assignDate = l['assigned_at'] ? new Date(l['assigned_at']).getTime() : 0;
    const isStagnant = updateDate < stagnationThreshold;
    const daysSinceAssign = assignDate > 0 ? Math.floor((now.getTime() - assignDate) / (1000 * 60 * 60 * 24)) : 0;
    const isLongDeal = daysSinceAssign >= settings.LONG_DEAL_DAYS;

    const problems = [];
    if (isStagnant) problems.push('停滞中');
    if (isLongDeal) problems.push('長期化');

    return {
      leadId: l['lead_id'],
      customerName: l['customer_name'] || '(顧客名なし)',
      status: l['進捗ステータス'],
      stagnantDays: isStagnant ? Math.floor((now.getTime() - updateDate) / (1000 * 60 * 60 * 24)) : 0,
      daysSinceAssign: daysSinceAssign,
      problems: problems,
      hasProblem: problems.length > 0
    };
  }).filter(d => d.hasProblem).sort((a, b) => b.stagnantDays - a.stagnantDays);

  // 週次トレンド（過去4週の成約率）
  const weeklyTrend = [];
  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    const weekStart = new Date(weekEnd.getTime() - (7 * 24 * 60 * 60 * 1000));

    const weekWon = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '成約') return false;
      const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
      return date >= weekStart && date < weekEnd;
    }).length;

    const weekLost = staffDeals.filter(l => {
      if (l['進捗ステータス'] !== '失注') return false;
      const date = new Date(l['sheet_updated_at']);
      return date >= weekStart && date < weekEnd;
    }).length;

    const weekTotal = weekWon + weekLost;
    weeklyTrend.push({
      weekLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()}〜`,
      wonCount: weekWon,
      lostCount: weekLost,
      winRate: weekTotal > 0 ? Math.round((weekWon / weekTotal) * 100) : null
    });
  }

  return {
    staffId: staffId,
    staffName: staffName,
    metrics: {
      dealCount: activeDeals.length,
      wonCount: thisMonthWon,
      lostCount: thisMonthLost,
      winRate: winRate
    },
    problemDeals: problemDeals,
    weeklyTrend: weeklyTrend
  };
}
