/**
 * お知らせサービス
 * お知らせの作成、取得、既読管理を担当
 */

// ============================================================
// お知らせシート作成（手動実行用）
// ============================================================

/**
 * お知らせシートと既読管理シートを作成（手動実行用）
 */
function setupNoticeSheets() {
  const ss = getSpreadsheet();

  // お知らせシート
  createNoticeSheet(ss);

  // 既読管理シート
  createReadStatusSheet(ss);

  Logger.log('お知らせシートと既読管理シートを作成しました');
  SpreadsheetApp.getActiveSpreadsheet().toast('お知らせシートを作成しました', 'セットアップ完了', 5);
}

/**
 * お知らせシートを作成
 */
function createNoticeSheet(ss) {
  const sheetName = CONFIG.SHEETS.NOTICES;
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
      Logger.log(sheetName + ' は既に存在します');
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = HEADERS.NOTICES;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#ff9800');
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 120);  // お知らせID
  sheet.setColumnWidth(2, 150);  // 日時
  sheet.setColumnWidth(3, 100);  // 種別
  sheet.setColumnWidth(4, 200);  // タイトル
  sheet.setColumnWidth(5, 400);  // 本文
  sheet.setColumnWidth(6, 80);   // 対象種別
  sheet.setColumnWidth(7, 120);  // 対象値
  sheet.setColumnWidth(8, 120);  // 有効期限
  sheet.setColumnWidth(9, 100);  // 作成者
  sheet.setColumnWidth(10, 200); // アクションURL
  sheet.setColumnWidth(11, 120); // アクションラベル

  // 種別プルダウン
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['重要', 'お知らせ', 'メンテナンス', '個人'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 3, 1000, 1).setDataValidation(typeRule);

  // 対象種別プルダウン
  const targetTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['全員', '役割', '個人'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 6, 1000, 1).setDataValidation(targetTypeRule);

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

/**
 * 既読管理シートを作成
 */
function createReadStatusSheet(ss) {
  const sheetName = CONFIG.SHEETS.READ_STATUS;
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
      Logger.log(sheetName + ' は既に存在します');
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = HEADERS.READ_STATUS;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#607d8b');
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // 担当者ID
  sheet.setColumnWidth(2, 120);  // お知らせID
  sheet.setColumnWidth(3, 150);  // 既読日時

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

// ============================================================
// お知らせ操作
// ============================================================

/**
 * 次のお知らせIDを生成
 */
function generateNextNoticeId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTICES);

  if (!sheet || sheet.getLastRow() < 2) {
    return 'NOTICE-00001';
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith('NOTICE-')) {
      const num = parseInt(id.replace('NOTICE-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return 'NOTICE-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * 未読お知らせを取得
 * @param {string} staffId - 担当者ID
 */
function getUnreadNotices(staffId) {
  const ss = getSpreadsheet();
  const noticeSheet = ss.getSheetByName(CONFIG.SHEETS.NOTICES);
  const readSheet = ss.getSheetByName(CONFIG.SHEETS.READ_STATUS);

  if (!noticeSheet) {
    return [];
  }

  // 担当者情報を取得
  const staff = getStaffById(staffId);
  const staffRole = staff ? staff.role : '';

  // 既読済みIDリスト
  const readIds = new Set();
  if (readSheet && readSheet.getLastRow() >= 2) {
    const readData = readSheet.getDataRange().getValues();
    for (let i = 1; i < readData.length; i++) {
      if (readData[i][0] === staffId) {
        readIds.add(readData[i][1]);
      }
    }
  }

  const noticeData = noticeSheet.getDataRange().getValues();
  const headers = noticeData[0];
  const today = new Date();
  const unread = [];

  for (let i = 1; i < noticeData.length; i++) {
    const notice = {
      id: noticeData[i][0],
      datetime: noticeData[i][1],
      type: noticeData[i][2],
      title: noticeData[i][3],
      body: noticeData[i][4],
      targetType: noticeData[i][5],
      targetValue: noticeData[i][6],
      expiry: noticeData[i][7],
      author: noticeData[i][8],
      actionUrl: noticeData[i][9],
      actionLabel: noticeData[i][10]
    };

    if (!notice.id) continue;

    // 有効期限チェック
    if (notice.expiry && new Date(notice.expiry) < today) continue;

    // 対象者チェック
    if (!isNoticeTarget(notice, staffId, staffRole)) continue;

    // 既読チェック
    if (readIds.has(notice.id)) continue;

    unread.push(notice);
  }

  // 新しい順にソート
  unread.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  return unread;
}

/**
 * 全お知らせを取得（履歴用）
 * @param {string} staffId - 担当者ID
 */
function getAllNotices(staffId) {
  const ss = getSpreadsheet();
  const noticeSheet = ss.getSheetByName(CONFIG.SHEETS.NOTICES);
  const readSheet = ss.getSheetByName(CONFIG.SHEETS.READ_STATUS);

  if (!noticeSheet) {
    return [];
  }

  // 担当者情報を取得
  const staff = getStaffById(staffId);
  const staffRole = staff ? staff.role : '';

  // 既読済みIDリスト
  const readIds = new Set();
  if (readSheet && readSheet.getLastRow() >= 2) {
    const readData = readSheet.getDataRange().getValues();
    for (let i = 1; i < readData.length; i++) {
      if (readData[i][0] === staffId) {
        readIds.add(readData[i][1]);
      }
    }
  }

  const noticeData = noticeSheet.getDataRange().getValues();
  const notices = [];

  for (let i = 1; i < noticeData.length; i++) {
    const notice = {
      id: noticeData[i][0],
      datetime: noticeData[i][1],
      type: noticeData[i][2],
      title: noticeData[i][3],
      body: noticeData[i][4],
      targetType: noticeData[i][5],
      targetValue: noticeData[i][6],
      expiry: noticeData[i][7],
      author: noticeData[i][8],
      actionUrl: noticeData[i][9],
      actionLabel: noticeData[i][10],
      isRead: readIds.has(noticeData[i][0])
    };

    if (!notice.id) continue;

    // 対象者チェック
    if (!isNoticeTarget(notice, staffId, staffRole)) continue;

    notices.push(notice);
  }

  // 新しい順にソート
  notices.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  return notices;
}

/**
 * お知らせの対象者かチェック
 */
function isNoticeTarget(notice, staffId, role) {
  if (notice.targetType === '全員') return true;
  if (notice.targetType === '個人' && notice.targetValue === staffId) return true;
  if (notice.targetType === '役割') {
    const targetRoles = (notice.targetValue || '').split(',').map(r => r.trim());
    if (targetRoles.includes(role)) return true;
  }
  return false;
}

/**
 * お知らせを既読にする
 * @param {string} staffId - 担当者ID
 * @param {string} noticeId - お知らせID
 */
function markNoticeAsRead(staffId, noticeId) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.READ_STATUS);

  if (!sheet) {
    // シートがなければ作成
    sheet = createReadStatusSheet(ss);
  }

  // 既に既読でないか確認
  if (sheet.getLastRow() >= 2) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === staffId && data[i][1] === noticeId) {
        return { success: true, message: '既に既読です' };
      }
    }
  }

  sheet.appendRow([staffId, noticeId, new Date()]);
  return { success: true };
}

/**
 * 全てのお知らせを既読にする
 * @param {string} staffId - 担当者ID
 */
function markAllNoticesAsRead(staffId) {
  const unread = getUnreadNotices(staffId);

  unread.forEach(notice => {
    markNoticeAsRead(staffId, notice.id);
  });

  return { success: true, count: unread.length };
}

// ============================================================
// お知らせ作成
// ============================================================

/**
 * システムからお知らせを作成
 */
function createSystemNotice(type, title, body, targetType, targetValue, actionUrl, actionLabel) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.NOTICES);

  if (!sheet) {
    sheet = createNoticeSheet(ss);
  }

  const noticeId = generateNextNoticeId();
  const now = new Date();

  sheet.appendRow([
    noticeId,
    now,
    type,
    title,
    body,
    targetType,
    targetValue || '',
    '', // 有効期限（空=無期限）
    'システム',
    actionUrl || '',
    actionLabel || ''
  ]);

  Logger.log('お知らせを作成しました: ' + noticeId + ' - ' + title);
  return noticeId;
}

/**
 * 個人リマインドを作成
 */
function createPersonalReminder(staffId, title, body, actionUrl, actionLabel) {
  return createSystemNotice('個人', title, body, '個人', staffId, actionUrl, actionLabel);
}

/**
 * 管理者からお知らせを作成
 */
function createAdminNotice(data) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.NOTICES);

  if (!sheet) {
    sheet = createNoticeSheet(ss);
  }

  const noticeId = generateNextNoticeId();
  const now = new Date();

  sheet.appendRow([
    noticeId,
    now,
    data.type || 'お知らせ',
    data.title,
    data.body,
    data.targetType || '全員',
    data.targetValue || '',
    data.expiry || '',
    data.author || '管理者',
    data.actionUrl || '',
    data.actionLabel || ''
  ]);

  return { success: true, noticeId: noticeId };
}

// ============================================================
// データ量監視連携
// ============================================================

/**
 * データ量警告をお知らせに登録
 */
function notifyDataVolumeAlert(alerts) {
  alerts.forEach(alert => {
    const type = alert.level === 'DANGER' ? '重要' : 'お知らせ';
    createSystemNotice(
      type,
      `${alert.sheet}のデータ量${alert.level === 'DANGER' ? '警告' : '注意'}`,
      `${alert.sheet}が${alert.current}行になりました。\n閾値: ${alert.threshold}行\n\n${alert.action}`,
      '役割',
      'オーナー,リーダー',
      '',
      ''
    );
  });
}

// ============================================================
// 日報・週次リマインド連携
// ============================================================

/**
 * 日報リマインドをお知らせに登録
 */
function createDailyReportReminder(staffId) {
  return createPersonalReminder(
    staffId,
    '日報の提出期限です',
    '日報の提出期限は22:00です。\n忘れずに提出してください。',
    '',
    ''
  );
}

/**
 * 週次レポートリマインドをお知らせに登録
 */
function createWeeklyReportReminder(staffId) {
  return createPersonalReminder(
    staffId,
    '週次レポートの提出期限です',
    '週次レポートの提出期限は日曜23:59です。\n今週の振り返りを記入してください。',
    '',
    ''
  );
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 担当者IDから担当者情報を取得
 */
function getStaffById(staffId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('担当者ID');
  const roleIdx = headers.indexOf('役割');
  const familyNameIdx = headers.indexOf('苗字（日本語）');
  const givenNameIdx = headers.indexOf('名前（日本語）');

  if (idIdx === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === staffId) {
      return {
        id: data[i][idIdx],
        role: roleIdx >= 0 ? data[i][roleIdx] : '',
        name: (familyNameIdx >= 0 && givenNameIdx >= 0)
          ? (data[i][familyNameIdx] + ' ' + data[i][givenNameIdx]).trim()
          : ''
      };
    }
  }

  return null;
}
