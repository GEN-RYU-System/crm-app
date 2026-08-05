/**
 * ActionSuggestService.gs
 * 次回アクションサジェスト機能を提供するサービス
 * 2026-01-22追加
 *
 * 機能:
 * - 過去の入力履歴からサジェスト候補を取得
 * - 進捗ステータス別の推奨アクション
 * - アクション記入日の自動記録
 */

// ============================================================
// 次回アクションサジェスト
// ============================================================

/**
 * 進捗ステータス別の推奨アクション（デフォルト）
 */
const DEFAULT_ACTION_SUGGESTIONS = {
  'アイスブレイク': [
    '挨拶メッセージ送信',
    '会社紹介・自己紹介',
    '相手の事業内容確認',
    '共通点・話題を探す'
  ],
  '情報収集': [
    '現在の仕入れ状況ヒアリング',
    '取り扱い希望タイトル確認',
    '購入頻度・数量確認',
    '予算感の確認',
    '競合他社の利用状況確認'
  ],
  '提案': [
    '提案書作成・送付',
    '取り扱い商品リスト送付',
    '価格表送付',
    'サンプル提案'
  ],
  '見積もり提示': [
    '見積書作成・送付',
    '見積内容の説明',
    '条件交渉対応',
    '追加見積り作成'
  ],
  'クロージング': [
    '契約条件の最終確認',
    '支払い方法の確認',
    '発送スケジュール調整',
    '契約締結フォロー'
  ]
};

/**
 * 共通の汎用アクション
 */
const COMMON_ACTIONS = [
  'フォローアップメッセージ送信',
  '返信待ち確認',
  '質問への回答',
  'ミーティング日程調整',
  '資料送付',
  '状況確認の連絡',
  '値引き相談',
  '上長に相談・報告'
];

/**
 * 次回アクションのサジェスト候補を取得
 * @param {string} staffId - 担当者ID（過去履歴取得用）
 * @param {string} progressStatus - 現在の進捗ステータス
 * @returns {Object} サジェスト候補
 */
function getActionSuggestions(staffId, progressStatus) {
  const suggestions = {
    recommended: [],  // 進捗ステータス別推奨アクション
    common: COMMON_ACTIONS,  // 共通アクション
    history: [],  // 過去の入力履歴
    dateOptions: DEFAULT_DROPDOWN_OPTIONS['次回アクション日'] || []
  };

  // 進捗ステータス別推奨アクション
  if (progressStatus && DEFAULT_ACTION_SUGGESTIONS[progressStatus]) {
    suggestions.recommended = DEFAULT_ACTION_SUGGESTIONS[progressStatus];
  }

  // 過去の入力履歴を取得
  if (staffId) {
    suggestions.history = getStaffActionHistory(staffId);
  }

  return suggestions;
}

/**
 * 担当者の過去の次回アクション入力履歴を取得
 * @param {string} staffId - 担当者ID
 * @returns {Array} 過去のアクション一覧（重複なし、頻度順）
 */
function getStaffActionHistory(staffId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIdx = headers.indexOf('担当者ID');
  const actionIdx = headers.indexOf('次回アクション');
  const staffNameIdx = headers.indexOf('担当者');

  if (actionIdx === -1) {
    return [];
  }

  // 担当者の過去アクションを収集
  const actionCounts = {};

  for (let i = 1; i < data.length; i++) {
    const rowStaffId = data[i][staffIdIdx];
    const action = data[i][actionIdx];

    // 担当者IDまたは担当者名でマッチ
    if (action && (rowStaffId === staffId)) {
      const trimmedAction = String(action).trim();
      if (trimmedAction) {
        actionCounts[trimmedAction] = (actionCounts[trimmedAction] || 0) + 1;
      }
    }
  }

  // 頻度順にソートして返す（上位10件）
  return Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

/**
 * 次回アクション日を計算
 * @param {string} dateOption - 日付オプション（本日中、明日中、等）
 * @returns {Date} 計算された日付
 */
function calculateActionDate(dateOption) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateOption) {
    case '本日中':
      return today;

    case '明日中':
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;

    case '2日後':
      const twoDays = new Date(today);
      twoDays.setDate(twoDays.getDate() + 2);
      return twoDays;

    case '3日後':
      const threeDays = new Date(today);
      threeDays.setDate(threeDays.getDate() + 3);
      return threeDays;

    case '1週間後':
      const oneWeek = new Date(today);
      oneWeek.setDate(oneWeek.getDate() + 7);
      return oneWeek;

    case '週末':
      // 次の土曜日
      const weekend = new Date(today);
      const daysUntilSaturday = (6 - weekend.getDay() + 7) % 7 || 7;
      weekend.setDate(weekend.getDate() + daysUntilSaturday);
      return weekend;

    case '新作リリース1ヶ月前':
      // 仮で1ヶ月後に設定（実際のリリース日は別途管理）
      const oneMonth = new Date(today);
      oneMonth.setMonth(oneMonth.getMonth() + 1);
      return oneMonth;

    default:
      return null;
  }
}

/**
 * 次回アクションを設定（アクション記入日も自動記録）
 * @param {string} leadId - リードID
 * @param {string} action - 次回アクション内容
 * @param {string} dateOption - 日付オプション
 * @returns {Object} 結果
 */
function setNextAction(leadId, action, dateOption) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    return { success: false, error: 'リード管理シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('リードID');
  const actionIdx = headers.indexOf('次回アクション');
  const actionDateIdx = headers.indexOf('次回アクション日');
  // アクション記入日列を追加する場合（現在のヘッダーにない場合は作成）
  let actionRecordDateIdx = headers.indexOf('アクション記入日');

  if (leadIdIdx === -1 || actionIdx === -1) {
    return { success: false, error: '必要な列が見つかりません' };
  }

  // リードIDで行を検索
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: 'リードが見つかりません: ' + leadId };
  }

  const now = new Date();

  // 次回アクションを設定
  sheet.getRange(targetRow, actionIdx + 1).setValue(action);

  // 次回アクション日を計算して設定
  if (dateOption && actionDateIdx !== -1) {
    const calculatedDate = calculateActionDate(dateOption);
    if (calculatedDate) {
      sheet.getRange(targetRow, actionDateIdx + 1).setValue(calculatedDate);
    } else {
      // 日付オプションが計算不可の場合はそのまま設定
      sheet.getRange(targetRow, actionDateIdx + 1).setValue(dateOption);
    }
  }

  // アクション記入日を自動記録（列がある場合）
  if (actionRecordDateIdx !== -1) {
    sheet.getRange(targetRow, actionRecordDateIdx + 1).setValue(now);
  }

  // シート更新日も更新
  const updateDateIdx = headers.indexOf('シート更新日');
  if (updateDateIdx !== -1) {
    sheet.getRange(targetRow, updateDateIdx + 1).setValue(now);
  }

  return {
    success: true,
    leadId: leadId,
    action: action,
    dateOption: dateOption,
    recordedAt: now.toISOString()
  };
}

/**
 * アクション期限のリマインド対象を取得
 * @param {number} daysAhead - 何日先までを対象にするか（デフォルト0=今日）
 * @returns {Array} リマインド対象リスト
 */
function getActionReminders(daysAhead) {
  daysAhead = daysAhead || 0;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const leadIdIdx = headers.indexOf('リードID');
  const customerIdx = headers.indexOf('顧客名');
  const actionIdx = headers.indexOf('次回アクション');
  const actionDateIdx = headers.indexOf('次回アクション日');
  const staffIdx = headers.indexOf('担当者');
  const staffIdIdx = headers.indexOf('担当者ID');
  const statusIdx = headers.indexOf('進捗ステータス');

  if (actionDateIdx === -1) {
    return [];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const reminders = [];

  for (let i = 1; i < data.length; i++) {
    const actionDate = data[i][actionDateIdx];
    const status = data[i][statusIdx];

    // 進行中の商談のみ対象
    if (!CONFIG.DEAL_STATUSES.includes(status)) continue;

    if (actionDate instanceof Date) {
      const actionDay = new Date(actionDate.getFullYear(), actionDate.getMonth(), actionDate.getDate());

      // 指定日以前が対象
      if (actionDay <= targetDate) {
        const daysDiff = Math.floor((today - actionDay) / (1000 * 60 * 60 * 24));

        reminders.push({
          leadId: data[i][leadIdIdx],
          customerName: data[i][customerIdx] || '(顧客名なし)',
          action: data[i][actionIdx] || '-',
          actionDate: actionDate,
          staff: data[i][staffIdx] || '-',
          staffId: data[i][staffIdIdx] || '',
          status: status,
          isOverdue: daysDiff > 0,
          daysOverdue: Math.max(0, daysDiff),
          urgency: daysDiff > 2 ? 'critical' : (daysDiff > 0 ? 'warning' : 'normal')
        });
      }
    }
  }

  // 緊急度順にソート
  return reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
