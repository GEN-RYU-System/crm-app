/**
 * BadgeService.gs
 * バッジ・実績機能を提供するサービス
 * Phase 5: パフォーマンス機能
 */

// ==================== バッジ定義 ====================
const BADGE_DEFINITIONS = {
  // 成約系バッジ
  FIRST_DEAL: {
    id: 'FIRST_DEAL',
    name: '初成約',
    icon: '🎉',
    description: '初めての成約を達成',
    category: '成約',
    condition: { type: 'won_count', value: 1 }
  },
  DEAL_MASTER_10: {
    id: 'DEAL_MASTER_10',
    name: '成約マスター',
    icon: '🏆',
    description: '累計10件の成約を達成',
    category: '成約',
    condition: { type: 'won_count', value: 10 }
  },
  DEAL_MASTER_50: {
    id: 'DEAL_MASTER_50',
    name: '成約レジェンド',
    icon: '👑',
    description: '累計50件の成約を達成',
    category: '成約',
    condition: { type: 'won_count', value: 50 }
  },

  // 成約率系バッジ
  HIGH_CONVERSION: {
    id: 'HIGH_CONVERSION',
    name: '高成約率',
    icon: '🎯',
    description: '月間成約率70%以上を達成',
    category: '成約率',
    condition: { type: 'win_rate', value: 70 }
  },
  PERFECT_CONVERSION: {
    id: 'PERFECT_CONVERSION',
    name: 'パーフェクト',
    icon: '💎',
    description: '月間成約率100%を達成',
    category: '成約率',
    condition: { type: 'win_rate', value: 100 }
  },

  // 売上系バッジ
  SALES_100K: {
    id: 'SALES_100K',
    name: '10万円達成',
    icon: '💰',
    description: '月間売上10万円を達成',
    category: '売上',
    condition: { type: 'monthly_sales', value: 100000 }
  },
  SALES_500K: {
    id: 'SALES_500K',
    name: '50万円達成',
    icon: '💵',
    description: '月間売上50万円を達成',
    category: '売上',
    condition: { type: 'monthly_sales', value: 500000 }
  },
  SALES_1M: {
    id: 'SALES_1M',
    name: 'ミリオン達成',
    icon: '🌟',
    description: '月間売上100万円を達成',
    category: '売上',
    condition: { type: 'monthly_sales', value: 1000000 }
  },

  // 連続系バッジ
  STREAK_3: {
    id: 'STREAK_3',
    name: '3連勝',
    icon: '🔥',
    description: '3件連続で成約',
    category: '連続',
    condition: { type: 'win_streak', value: 3 }
  },
  STREAK_5: {
    id: 'STREAK_5',
    name: '5連勝',
    icon: '⚡',
    description: '5件連続で成約',
    category: '連続',
    condition: { type: 'win_streak', value: 5 }
  },
  STREAK_10: {
    id: 'STREAK_10',
    name: '10連勝',
    icon: '🌈',
    description: '10件連続で成約',
    category: '連続',
    condition: { type: 'win_streak', value: 10 }
  },

  // 目標達成系バッジ
  GOAL_ACHIEVED: {
    id: 'GOAL_ACHIEVED',
    name: '目標達成',
    icon: '✅',
    description: '月間目標を達成',
    category: '目標',
    condition: { type: 'goal_achieved', value: 100 }
  },
  GOAL_EXCEEDED: {
    id: 'GOAL_EXCEEDED',
    name: '目標超過',
    icon: '🚀',
    description: '月間目標を120%達成',
    category: '目標',
    condition: { type: 'goal_achieved', value: 120 }
  },

  // 特別バッジ
  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    name: 'スピードスター',
    icon: '⏱️',
    description: 'アサインから3日以内に成約',
    category: '特別',
    condition: { type: 'quick_close', value: 3 }
  },
  BIG_DEAL: {
    id: 'BIG_DEAL',
    name: 'ビッグディール',
    icon: '🐋',
    description: '1件で50万円以上の成約',
    category: '特別',
    condition: { type: 'single_deal', value: 500000 }
  }
};

// ==================== バッジ取得関数 ====================

/**
 * 担当者の取得済みバッジを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} バッジリストとストリーク情報
 */
function getStaffBadges(staffId) {
  const earnedBadges = checkBadgeConditions(staffId);
  const streak = getStaffWinStreak(staffId);

  return {
    earned: earnedBadges,
    all: Object.values(BADGE_DEFINITIONS),
    earnedCount: earnedBadges.length,
    totalCount: Object.keys(BADGE_DEFINITIONS).length,
    winStreak: streak
  };
}

/**
 * 担当者の連勝数を取得
 * @param {string} staffId - 担当者ID
 * @returns {number} 連勝数
 */
function getStaffWinStreak(staffId) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!leadSheet || !staffSheet) return 0;

  const staff = getSheetDataAsObjects(staffSheet);
  const staffMember = staff.find(s => s['assignee_id'] === staffId);
  if (!staffMember) return 0;

  const staffName = getStaffFullName(staffMember);
  const leads = getSheetDataAsObjects(leadSheet);
  const myDeals = leads.filter(l => l['担当者'] === staffName);

  return calculateWinStreak(myDeals);
}

/**
 * バッジ条件をチェック
 * @param {string} staffId - 担当者ID
 * @returns {Array} 取得済みバッジ
 */
function checkBadgeConditions(staffId) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  const goalsSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!leadSheet) return [];

  const leads = getSheetDataAsObjects(leadSheet);
  const staff = staffSheet ? getSheetDataAsObjects(staffSheet) : [];
  const goals = goalsSheet ? getSheetDataAsObjects(goalsSheet) : [];

  // 担当者名を取得
  const staffMember = staff.find(s => s['assignee_id'] === staffId);
  if (!staffMember) return [];

  const staffName = getStaffFullName(staffMember);
  const myDeals = leads.filter(l => l['担当者'] === staffName);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // 統計を計算
  const wonDeals = myDeals.filter(l => l['進捗ステータス'] === '成約');
  const lostDeals = myDeals.filter(l => l['進捗ステータス'] === '失注');
  const closedDeals = wonDeals.length + lostDeals.length;
  const winRate = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : 0;

  // 今月の統計
  const thisMonthWon = wonDeals.filter(l => {
    const date = new Date(l['first_transaction_date'] || l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const thisMonthLost = myDeals.filter(l => {
    if (l['進捗ステータス'] !== '失注') return false;
    const date = new Date(l['sheet_updated_at']);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const thisMonthClosed = thisMonthWon.length + thisMonthLost.length;
  const thisMonthWinRate = thisMonthClosed > 0 ? Math.round((thisMonthWon.length / thisMonthClosed) * 100) : 0;
  const thisMonthSales = thisMonthWon.reduce((sum, l) => sum + (parseFloat(l['first_transaction_amount']) || 0), 0);

  // 連勝数を計算
  const winStreak = calculateWinStreak(myDeals);

  // 目標達成率を計算
  const myGoal = goals.find(g =>
    g['assignee_id'] === staffId &&
    g['期間タイプ'] === '月次' &&
    g['期間'] === `${thisYear}/${String(thisMonth + 1).padStart(2, '0')}`
  );
  const goalAchievement = myGoal && myGoal['売上目標'] ?
    Math.round((thisMonthSales / parseFloat(myGoal['売上目標'])) * 100) : 0;

  // 最大単一取引額
  const maxSingleDeal = Math.max(...wonDeals.map(l => parseFloat(l['first_transaction_amount']) || 0), 0);

  // クイッククローズをチェック
  const hasQuickClose = wonDeals.some(l => {
    if (!l['assigned_at'] || !l['first_transaction_date']) return false;
    const assignDate = new Date(l['assigned_at']);
    const closeDate = new Date(l['first_transaction_date']);
    const days = Math.floor((closeDate - assignDate) / (1000 * 60 * 60 * 24));
    return days <= 3;
  });

  // バッジ条件をチェック
  const earnedBadges = [];

  Object.values(BADGE_DEFINITIONS).forEach(badge => {
    let earned = false;

    switch (badge.condition.type) {
      case 'won_count':
        earned = wonDeals.length >= badge.condition.value;
        break;
      case 'win_rate':
        earned = thisMonthClosed >= 5 && thisMonthWinRate >= badge.condition.value;
        break;
      case 'monthly_sales':
        earned = thisMonthSales >= badge.condition.value;
        break;
      case 'win_streak':
        earned = winStreak >= badge.condition.value;
        break;
      case 'goal_achieved':
        earned = goalAchievement >= badge.condition.value;
        break;
      case 'quick_close':
        earned = hasQuickClose;
        break;
      case 'single_deal':
        earned = maxSingleDeal >= badge.condition.value;
        break;
    }

    if (earned) {
      earnedBadges.push({
        ...badge,
        earnedAt: now.toISOString()
      });
    }
  });

  return earnedBadges;
}

/**
 * 連勝数を計算
 * @param {Array} deals - 商談リスト
 * @returns {number} 連勝数
 */
function calculateWinStreak(deals) {
  // 完了した商談を日付順にソート
  const closedDeals = deals
    .filter(l => l['進捗ステータス'] === '成約' || l['進捗ステータス'] === '失注')
    .sort((a, b) => {
      const dateA = new Date(a['sheet_updated_at'] || 0);
      const dateB = new Date(b['sheet_updated_at'] || 0);
      return dateB - dateA; // 新しい順
    });

  let streak = 0;
  for (const deal of closedDeals) {
    if (deal['進捗ステータス'] === '成約') {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ==================== Buddy励まし機能 ====================

/**
 * Buddyの励ましメッセージを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} 励ましデータ
 */
function getBuddyEncouragement(staffId) {
  const badges = getStaffBadges(staffId);
  const alertData = getAlertList(staffId);

  const now = new Date();
  const hour = now.getHours();

  let greeting = '';
  if (hour < 12) {
    greeting = 'おはよう！';
  } else if (hour < 17) {
    greeting = 'お疲れ様！';
  } else {
    greeting = 'こんばんは！';
  }

  // 最近獲得したバッジがあれば祝福
  const recentBadges = badges.earned.filter(b => {
    const earnedDate = new Date(b.earnedAt);
    const daysSince = Math.floor((now - earnedDate) / (1000 * 60 * 60 * 24));
    return daysSince <= 1;
  });

  let message = greeting;

  if (recentBadges.length > 0) {
    const badge = recentBadges[0];
    message += ` ${badge.icon}「${badge.name}」バッジおめでとう！すごいね！`;
  } else if (alertData.summary.total > 0) {
    if (alertData.summary.level3 > 0) {
      message += ' いくつか確認が必要な商談があるみたい。一緒にチェックしよう！';
    } else {
      message += ' 順調だね！でもいくつかフォローアップした方がいいかも。';
    }
  } else {
    // ランダムな励まし
    const encouragements = [
      '今日も頑張ってるね！',
      'いい調子だよ！',
      '素晴らしい進捗だね！',
      '今日もよろしく！',
      '一緒に頑張ろう！'
    ];
    message += ' ' + encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  // 次のバッジへの進捗
  const nextBadge = getNextBadgeProgress(staffId, badges.earned);

  return {
    message: message,
    badges: {
      recent: recentBadges,
      total: badges.earnedCount,
      totalAvailable: badges.totalCount
    },
    nextBadge: nextBadge,
    alerts: alertData.summary
  };
}

/**
 * 次のバッジへの進捗を取得
 * @param {string} staffId - 担当者ID
 * @param {Array} earnedBadges - 取得済みバッジ
 * @returns {Object} 次のバッジ情報
 */
function getNextBadgeProgress(staffId, earnedBadges) {
  const earnedIds = earnedBadges.map(b => b.id);

  // 未取得バッジから次の目標を選定
  const candidates = Object.values(BADGE_DEFINITIONS)
    .filter(b => !earnedIds.includes(b.id))
    .sort((a, b) => a.condition.value - b.condition.value);

  if (candidates.length === 0) {
    return { complete: true, message: '全バッジ取得済み！素晴らしい！' };
  }

  const next = candidates[0];
  return {
    badge: next,
    message: `次の目標: ${next.icon} ${next.name}（${next.description}）`
  };
}

/**
 * 成約時のBuddy祝福メッセージを取得
 * @param {string} staffId - 担当者ID
 * @param {Object} dealData - 成約データ
 * @returns {Object} 祝福メッセージ
 */
function getBuddyCelebration(staffId, dealData) {
  const badges = getStaffBadges(staffId);
  const newBadges = [];

  // 新しく獲得したバッジをチェック
  // （実際の実装では前回チェック時のバッジと比較する必要がある）

  let message = `🎉 「${dealData.顧客名}」成約おめでとう！`;

  if (dealData.amount && dealData.amount >= 500000) {
    message += ' ビッグディールだね！すごい！';
  }

  // 連勝数をチェック
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  const staffMember = staffSheet ? getSheetDataAsObjects(staffSheet).find(s => s['assignee_id'] === staffId) : null;

  if (staffMember && leadSheet) {
    const staffName = getStaffFullName(staffMember);
    const myDeals = getSheetDataAsObjects(leadSheet).filter(l => l['担当者'] === staffName);
    const streak = calculateWinStreak(myDeals);

    if (streak >= 3) {
      message += ` 🔥 ${streak}連勝中！その調子！`;
    }
  }

  return {
    message: message,
    newBadges: newBadges,
    encouragement: 'この調子で次も頑張ろう！'
  };
}

/**
 * 失注時のBuddyフォローメッセージを取得
 * @param {string} staffId - 担当者ID
 * @param {Object} dealData - 失注データ
 * @returns {Object} フォローメッセージ
 */
function getBuddyFollowUp(staffId, dealData) {
  const messages = [
    '残念だったね。でも次がある！一緒に振り返ってみよう。',
    '今回は縁がなかったみたい。学びを次に活かそう！',
    'うまくいかないこともあるよ。次のチャンスを逃さないようにしよう！',
    '惜しかったね。何か気づいたことがあれば教えて。'
  ];

  const message = messages[Math.floor(Math.random() * messages.length)];

  return {
    message: message,
    questions: [
      '今回の商談で難しかったことは？',
      '次に活かせそうな学びは？',
      '他にサポートできることはある？'
    ]
  };
}

/**
 * バッジ定義を取得
 * @returns {Object} バッジ定義
 */
function getBadgeDefinitions() {
  return BADGE_DEFINITIONS;
}
