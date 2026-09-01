
// ============================================================
// シートヘッダー定義
// ============================================================

const BUDDY_DIALOG_HEADERS = [
  '対話ID',
  '担当者ID',
  '担当者名',
  'リードID',      // 関連リード（省略可）
  '顧客名',        // 関連顧客（省略可）
  '相談内容',
  'Buddyアドバイス',
  '対話日時',
  'カテゴリ',      // 商談相談/スキルアップ/その他
  'メモ'           // フォローアップメモ
];

const DIALOG_CATEGORIES = [
  '商談相談',
  'ネクストアクション',
  'クロージング',
  '顧客対応',
  'スキルアップ',
  'モチベーション',
  'その他'
];

// ============================================================
// 対話機能
// ============================================================

/**
 * Buddyに相談する
 * @param {Object} dialogData - 相談データ
 * @returns {Object} Buddyの回答
 */
function askBuddy(dialogData) {
  const { staffId, leadId, question, category } = dialogData;

  // API使用制限チェック
  if (!checkBuddyApiLimit()) {
    return {
      success: false,
      error: 'Buddy API の1日の使用制限（20回）に達しました。明日以降に再度お試しください。'
    };
  }

  // 担当者情報取得
  const staffName = getStaffNameById(staffId);
  if (!staffName) {
    return { success: false, error: '担当者が見つかりません: ' + staffId };
  }

  // リード情報取得（指定がある場合）
  let leadContext = '';
  let customerName = '';
  if (leadId) {
    const leadInfo = getLeadContextForBuddy(leadId);
    if (leadInfo) {
      leadContext = leadInfo.context;
      customerName = leadInfo.customerName;
    }
  }

  // Buddyプロンプト生成
  const prompt = buildBuddyPrompt(staffName, question, category, leadContext);

  try {
    const advice = callGeminiApi(prompt);
    incrementBuddyApiCount();

    // 対話ログを保存
    const dialogId = saveBuddyDialog({
      staffId,
      staffName,
      leadId: leadId || '',
      customerName: customerName || '',
      question,
      advice,
      category: category || 'その他'
    });

    return {
      success: true,
      dialogId: dialogId,
      advice: advice,
      category: category || 'その他',
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    Logger.log('Buddy dialog error: ' + e.message);
    return {
      success: false,
      error: 'Buddyからの回答生成に失敗しました: ' + e.message
    };
  }
}

/**
 * Buddyプロンプトを生成
 * @param {string} staffName - 担当者名
 * @param {string} question - 相談内容
 * @param {string} category - カテゴリ
 * @param {string} leadContext - リード情報コンテキスト
 * @returns {string} プロンプト
 */
function buildBuddyPrompt(staffName, question, category, leadContext) {
  let roleDescription = '';
  let focusArea = '';

  switch (category) {
    case '商談相談':
      roleDescription = '営業戦略のスペシャリスト';
      focusArea = '商談を前に進めるための具体的なアドバイスを提供してください。';
      break;
    case 'ネクストアクション':
      roleDescription = 'セールスコーチ';
      focusArea = '次に取るべきアクションを明確に、優先順位を付けて提案してください。';
      break;
    case 'クロージング':
      roleDescription = 'クロージングのエキスパート';
      focusArea = '成約に向けた効果的なアプローチを提案してください。';
      break;
    case '顧客対応':
      roleDescription = 'カスタマーリレーション専門家';
      focusArea = '顧客との良好な関係構築のためのアドバイスを提供してください。';
      break;
    case 'スキルアップ':
      roleDescription = '営業スキル開発コーチ';
      focusArea = 'スキル向上のための具体的なアドバイスと練習方法を提案してください。';
      break;
    case 'モチベーション':
      roleDescription = 'メンタルコーチ';
      focusArea = '前向きな気持ちを取り戻すためのサポートを提供してください。';
      break;
    default:
      roleDescription = '営業アドバイザー';
      focusArea = '実践的で具体的なアドバイスを提供してください。';
  }

  let prompt = `あなたは「Buddy」という名前の${roleDescription}です。
営業チームのメンバーが壁打ち相談に来ました。親しみやすく、かつ専門的なアドバイスを提供してください。

【相談者】${staffName}

`;

  if (leadContext) {
    prompt += `【関連する商談情報】
${leadContext}

`;
  }

  prompt += `【相談内容】
${question}

---
${focusArea}

※ 300字以内で、箇条書きを活用して分かりやすく回答してください。
※ 必要に応じて具体的な例やスクリプト例を含めてください。`;

  return prompt;
}

/**
 * リード情報をBuddy用コンテキストとして取得
 * @param {string} leadId - リードID
 * @returns {Object|null} コンテキスト情報
 */
function getLeadContextForBuddy(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const leadIdIdx = headers.indexOf('lead_id');
  const customerIdx = headers.indexOf('customer_name');
  const statusIdx = headers.indexOf('進捗ステータス');
  const platformIdx = headers.indexOf('流入元');
  const noteIdx = headers.indexOf('メモ');
  const lastContactIdx = headers.indexOf('最終コンタクト日');
  const actionIdx = headers.indexOf('next_action');

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      const row = data[i];
      const context = `- 顧客名: ${row[customerIdx] || '(未設定)'}
- 現在のステータス: ${row[statusIdx] || '(未設定)'}
- 流入元: ${row[platformIdx] || '(未設定)'}
- 最終コンタクト: ${row[lastContactIdx] instanceof Date ? row[lastContactIdx].toLocaleDateString('ja-JP') : '(未記録)'}
- 次回アクション: ${row[actionIdx] || '(未設定)'}
- メモ: ${row[noteIdx] || '(なし)'}`;

      return {
        context: context,
        customerName: row[customerIdx] || ''
      };
    }
  }

  return null;
}

/**
 * 対話ログを保存
 * @param {Object} dialog - 対話データ
 * @returns {string} 対話ID
 */
function saveBuddyDialog(dialog) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Buddy対話ログ');

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet('Buddy対話ログ');
    sheet.appendRow(BUDDY_DIALOG_HEADERS);
    sheet.setFrozenRows(1);
  }

  const dialogId = 'BD-' + new Date().getTime().toString(36).toUpperCase() +
                   Math.random().toString(36).substring(2, 6).toUpperCase();

  const newRow = [
    dialogId,
    dialog.staffId,
    dialog.staffName,
    dialog.leadId,
    dialog.customerName,
    dialog.question,
    dialog.advice,
    new Date(),
    dialog.category,
    ''  // メモ（後から追加可能）
  ];

  sheet.appendRow(newRow);

  return dialogId;
}

/**
 * 対話履歴を取得（壁打ち用）
 * @param {string} staffId - 担当者ID
 * @param {number} limit - 取得件数（デフォルト20）
 * @returns {Object} 対話履歴
 */
function getCoachingDialogHistory(staffId, limit) {
  limit = limit || 20;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Buddy対話ログ');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, dialogs: [], total: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('assignee_id');

  const dialogs = [];
  for (let i = data.length - 1; i >= 1 && dialogs.length < limit; i--) {
    const row = data[i];

    if (staffId && row[staffIdIdx] !== staffId) continue;

    const dialog = {};
    headers.forEach((header, idx) => {
      dialog[header] = row[idx];
    });
    dialogs.push(dialog);
  }

  return {
    success: true,
    dialogs: dialogs,
    total: dialogs.length
  };
}

/**
 * リード関連の対話履歴を取得
 * @param {string} leadId - リードID
 * @returns {Object} 対話履歴
 */
function getBuddyDialogsByLead(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Buddy対話ログ');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, dialogs: [], total: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const leadIdIdx = headers.indexOf('lead_id');

  const dialogs = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (row[leadIdIdx] !== leadId) continue;

    const dialog = {};
    headers.forEach((header, idx) => {
      dialog[header] = row[idx];
    });
    dialogs.push(dialog);
  }

  // 新しい順にソート
  dialogs.sort((a, b) => {
    const dateA = a['対話日時'] instanceof Date ? a['対話日時'] : new Date(a['対話日時']);
    const dateB = b['対話日時'] instanceof Date ? b['対話日時'] : new Date(b['対話日時']);
    return dateB - dateA;
  });

  return {
    success: true,
    dialogs: dialogs,
    total: dialogs.length
  };
}

/**
 * 対話にメモを追加
 * @param {string} dialogId - 対話ID
 * @param {string} memo - メモ
 * @returns {Object} 結果
 */
function addDialogMemo(dialogId, memo) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Buddy対話ログ');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'Buddy対話ログシートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const dialogIdIdx = headers.indexOf('対話ID');
  const memoIdx = headers.indexOf('メモ');

  for (let i = 1; i < data.length; i++) {
    if (data[i][dialogIdIdx] === dialogId) {
      sheet.getRange(i + 1, memoIdx + 1).setValue(memo);
      return { success: true, dialogId: dialogId };
    }
  }

  return { success: false, error: '対話が見つかりません: ' + dialogId };
}

/**
 * 対話カテゴリ一覧を取得
 * @returns {Array} カテゴリ一覧
 */
function getDialogCategories() {
  return DIALOG_CATEGORIES;
}

/**
 * クイックアドバイス（商談コンテキスト付き）
 * @param {string} leadId - リードID
 * @param {string} staffId - 担当者ID
 * @returns {Object} アドバイス
 */
function getQuickAdvice(leadId, staffId) {
  const leadInfo = getLeadContextForBuddy(leadId);

  if (!leadInfo) {
    return { success: false, error: 'リードが見つかりません' };
  }

  // ステータスに応じた自動カテゴリ選択
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('lead_id');
  const statusIdx = headers.indexOf('進捗ステータス');

  let status = '';
  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      status = data[i][statusIdx];
      break;
    }
  }

  let category = 'ネクストアクション';
  if (status === 'クロージング') {
    category = 'クロージング';
  } else if (status === 'アイスブレイク') {
    category = '顧客対応';
  } else if (status === '提案' || status === '見積もり提示') {
    category = '商談相談';
  }

  const question = `この商談について、今後どう進めるべきかアドバイスをください。`;

  return askBuddy({
    staffId: staffId,
    leadId: leadId,
    question: question,
    category: category
  });
}
