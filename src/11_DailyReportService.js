// ==========================================
// 日報サービス
// 営業担当者の日報管理システム
// ==========================================

/**
 * 担当者マスタのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 */
function _dailyReportStaffHeaderIdx(headers, newName, oldName) {
  var idx = headers.indexOf(newName);
  return idx !== -1 ? idx : headers.indexOf(oldName);
}

const DAILY_REPORT_SHEET_NAME = '日報';

/**
 * 日報シートを作成
 */
function setupDailyReportSheet() {
  const ss = getSpreadsheet();

  // LockService使用（TROUBLE-018対応）- deleteSheetとinsertSheetを保護
  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    // 既存シートがあれば削除して再作成
    const existingSheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);
    if (existingSheet) {
      ss.deleteSheet(existingSheet);
    }
    sheet = ss.insertSheet(DAILY_REPORT_SHEET_NAME);
  } finally {
    lock.releaseLock();
  }

  // ヘッダー設定
  const headers = [
    '日報ID',
    '担当者ID',
    '担当者名',
    '日付',
    '今日出来たこと',
    '未達成だったこと',
    '困っていること',
    '学び・気づき',
    '明日の予定',
    'ひとこと',
    '商談数（自動）',
    '成約数（自動）',
    '新規接触数（自動）',
    '提出時刻',
    'ステータス'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a5568')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // 列幅調整
  sheet.setColumnWidth(1, 120);  // 日報ID
  sheet.setColumnWidth(2, 80);   // 担当者ID
  sheet.setColumnWidth(3, 100);  // 担当者名
  sheet.setColumnWidth(4, 100);  // 日付
  sheet.setColumnWidth(5, 300);  // 今日出来たこと
  sheet.setColumnWidth(6, 300);  // 未達成だったこと
  sheet.setColumnWidth(7, 300);  // 困っていること
  sheet.setColumnWidth(8, 300);  // 学び・気づき
  sheet.setColumnWidth(9, 300);  // 明日の予定
  sheet.setColumnWidth(10, 200); // ひとこと
  sheet.setColumnWidth(11, 100); // 商談数
  sheet.setColumnWidth(12, 100); // 成約数
  sheet.setColumnWidth(13, 100); // 新規接触数
  sheet.setColumnWidth(14, 150); // 提出時刻
  sheet.setColumnWidth(15, 80);  // ステータス

  // 行の高さとテキスト折り返し設定
  sheet.setRowHeights(1, 1, 21);
  sheet.getRange(1, 1, 1, headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  Logger.log('日報シートを作成しました');
  return { success: true, message: '日報シートを作成しました' };
}

/**
 * 日報IDを生成
 */
function generateDailyReportId() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);

  if (!sheet) {
    return 'DAILY-00001';
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 'DAILY-00001';
  }

  // 最新のIDを取得して次の番号を生成
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let maxNum = 0;

  ids.forEach(row => {
    const id = row[0];
    if (id && id.startsWith('DAILY-')) {
      const num = parseInt(id.replace('DAILY-', ''), 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  });

  return 'DAILY-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * 本日の数値実績を自動取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} 本日の実績
 */
function getTodayStats(staffId) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const ss = getSpreadsheet();

  let dealCount = 0;
  let closedCount = 0;
  let newContactCount = 0;

  // 商談管理シートから商談数を取得
  const dealSheet = ss.getSheetByName('商談管理');
  if (dealSheet && dealSheet.getLastRow() >= 2) {
    const dealData = dealSheet.getDataRange().getValues();
    const dealHeaders = dealData[0];
    const staffIdIdx = dealHeaders.indexOf('担当者ID');
    const dateIdx = dealHeaders.indexOf('商談日');
    const statusIdx = dealHeaders.indexOf('ステータス');

    for (let i = 1; i < dealData.length; i++) {
      const row = dealData[i];
      const rowStaffId = row[staffIdIdx];
      const dealDate = row[dateIdx];

      if (rowStaffId === staffId && dealDate) {
        let dateStr = '';
        if (dealDate instanceof Date) {
          dateStr = Utilities.formatDate(dealDate, 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          dateStr = String(dealDate).substring(0, 10);
        }

        if (dateStr === today) {
          dealCount++;
          if (row[statusIdx] === '成約') {
            closedCount++;
          }
        }
      }
    }
  }

  // リード一覧(IN)から新規接触数を取得
  const leadInSheet = ss.getSheetByName('リード一覧(IN)');
  if (leadInSheet && leadInSheet.getLastRow() >= 2) {
    const leadData = leadInSheet.getDataRange().getValues();
    const leadHeaders = leadData[0];
    const assigneeIdx = leadHeaders.indexOf('担当者ID');
    const contactDateIdx = leadHeaders.indexOf('初回接触日');

    for (let i = 1; i < leadData.length; i++) {
      const row = leadData[i];
      const rowAssignee = row[assigneeIdx];
      const contactDate = row[contactDateIdx];

      if (rowAssignee === staffId && contactDate) {
        let dateStr = '';
        if (contactDate instanceof Date) {
          dateStr = Utilities.formatDate(contactDate, 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          dateStr = String(contactDate).substring(0, 10);
        }

        if (dateStr === today) {
          newContactCount++;
        }
      }
    }
  }

  // リード一覧(OUT)からも新規接触数を取得
  const leadOutSheet = ss.getSheetByName('リード一覧(OUT)');
  if (leadOutSheet && leadOutSheet.getLastRow() >= 2) {
    const leadData = leadOutSheet.getDataRange().getValues();
    const leadHeaders = leadData[0];
    const assigneeIdx = leadHeaders.indexOf('担当者ID');
    const contactDateIdx = leadHeaders.indexOf('初回接触日');

    for (let i = 1; i < leadData.length; i++) {
      const row = leadData[i];
      const rowAssignee = row[assigneeIdx];
      const contactDate = row[contactDateIdx];

      if (rowAssignee === staffId && contactDate) {
        let dateStr = '';
        if (contactDate instanceof Date) {
          dateStr = Utilities.formatDate(contactDate, 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          dateStr = String(contactDate).substring(0, 10);
        }

        if (dateStr === today) {
          newContactCount++;
        }
      }
    }
  }

  return {
    dealCount: dealCount,
    closedCount: closedCount,
    newContactCount: newContactCount,
    date: today
  };
}

/**
 * 日報を保存（下書き/提出）
 * @param {Object} data - 日報データ
 * @returns {Object} 保存結果
 */
function saveDailyReport(data) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);

    // シートがなければ作成
    if (!sheet) {
      setupDailyReportSheet();
      sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);
    }

    const staffId = data.staffId;
    const staffName = data.staffName;
    const date = data.date || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const status = data.status || '下書き';
    const now = new Date();
    const submittedAt = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

    // 本日の実績を自動取得
    const stats = getTodayStats(staffId);

    // 既存の日報を検索
    const lastRow = sheet.getLastRow();
    let existingRow = -1;

    if (lastRow >= 2) {
      const existingData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      for (let i = 0; i < existingData.length; i++) {
        const rowStaffId = existingData[i][1];
        const rowDate = existingData[i][3];
        let rowDateStr = '';
        if (rowDate instanceof Date) {
          rowDateStr = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          rowDateStr = String(rowDate).substring(0, 10);
        }

        if (rowStaffId === staffId && rowDateStr === date) {
          existingRow = i + 2; // ヘッダー行 + 0始まりインデックス
          break;
        }
      }
    }

    const rowData = [
      existingRow > 0 ? sheet.getRange(existingRow, 1).getValue() : generateDailyReportId(),
      staffId,
      staffName,
      date,
      data.achievement || '',
      data.unachieved || '',
      data.trouble || '',
      data.learning || '',
      data.tomorrowPlan || '',
      data.comment || '',
      stats.dealCount,
      stats.closedCount,
      stats.newContactCount,
      submittedAt,
      status
    ];

    if (existingRow > 0) {
      // 既存の日報を更新
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // 新規追加
      sheet.appendRow(rowData);
    }

    // 提出時にリーダー通知（困っていることがある場合）
    if (status === '提出済' && data.trouble && data.trouble.trim() !== '') {
      notifyLeaderAboutTrouble(staffId, staffName, data.trouble);
    }

    return {
      success: true,
      reportId: rowData[0],
      message: status === '提出済' ? '日報を提出しました' : '下書きを保存しました'
    };
  } catch (error) {
    Logger.log('saveDailyReport エラー: ' + error.message);
    return {
      success: false,
      message: '日報の保存に失敗しました: ' + error.message
    };
  }
}

/**
 * 日報を取得
 * @param {string} staffId - 担当者ID
 * @param {string} date - 日付（yyyy-MM-dd）
 * @returns {Object|null} 日報データ
 */
function getDailyReport(staffId, date) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      return null;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowStaffId = row[1];
      const rowDate = row[3];

      let rowDateStr = '';
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        rowDateStr = String(rowDate).substring(0, 10);
      }

      if (rowStaffId === staffId && rowDateStr === date) {
        return {
          reportId: row[0],
          staffId: row[1],
          staffName: row[2],
          date: rowDateStr,
          achievement: row[4],
          unachieved: row[5],
          trouble: row[6],
          learning: row[7],
          tomorrowPlan: row[8],
          comment: row[9],
          dealCount: row[10],
          closedCount: row[11],
          newContactCount: row[12],
          submittedAt: row[13] instanceof Date ? row[13].toISOString() : row[13],
          status: row[14]
        };
      }
    }

    return null;
  } catch (error) {
    Logger.log('getDailyReport エラー: ' + error.message);
    return null;
  }
}

/**
 * 日報履歴を取得
 * @param {string} staffId - 担当者ID
 * @param {number} count - 取得件数
 * @returns {Array} 日報履歴
 */
function getDailyReportHistory(staffId, count) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const reports = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === staffId) {
        let dateStr = '';
        if (row[3] instanceof Date) {
          dateStr = Utilities.formatDate(row[3], 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          dateStr = String(row[3]).substring(0, 10);
        }

        reports.push({
          reportId: row[0],
          staffId: row[1],
          staffName: row[2],
          date: dateStr,
          achievement: row[4],
          unachieved: row[5],
          trouble: row[6],
          learning: row[7],
          tomorrowPlan: row[8],
          comment: row[9],
          dealCount: row[10],
          closedCount: row[11],
          newContactCount: row[12],
          submittedAt: row[13] instanceof Date ? row[13].toISOString() : row[13],
          status: row[14]
        });
      }
    }

    // 日付降順でソート
    reports.sort((a, b) => b.date.localeCompare(a.date));

    // 件数制限
    return reports.slice(0, count || 10);
  } catch (error) {
    Logger.log('getDailyReportHistory エラー: ' + error.message);
    return [];
  }
}

/**
 * チームの日報一覧を取得（リーダー・管理者向け）
 * @param {string} dateFrom - 開始日
 * @param {string} dateTo - 終了日
 * @param {string} filterStaffId - 担当者フィルタ（省略可）
 * @returns {Array} 日報一覧
 */
function getTeamDailyReports(dateFrom, dateTo, filterStaffId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(DAILY_REPORT_SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const reports = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let dateStr = '';
      if (row[3] instanceof Date) {
        dateStr = Utilities.formatDate(row[3], 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        dateStr = String(row[3]).substring(0, 10);
      }

      // 日付フィルタ
      if (dateFrom && dateStr < dateFrom) continue;
      if (dateTo && dateStr > dateTo) continue;

      // 担当者フィルタ
      if (filterStaffId && row[1] !== filterStaffId) continue;

      reports.push({
        reportId: row[0],
        staffId: row[1],
        staffName: row[2],
        date: dateStr,
        achievement: row[4],
        unachieved: row[5],
        trouble: row[6],
        learning: row[7],
        tomorrowPlan: row[8],
        comment: row[9],
        dealCount: row[10],
        closedCount: row[11],
        newContactCount: row[12],
        submittedAt: row[13] instanceof Date ? row[13].toISOString() : row[13],
        status: row[14],
        hasTrouble: row[6] && row[6].trim() !== ''
      });
    }

    // 日付降順でソート
    reports.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return a.staffName.localeCompare(b.staffName);
    });

    return reports;
  } catch (error) {
    Logger.log('getTeamDailyReports エラー: ' + error.message);
    return [];
  }
}

// ==========================================
// 通知機能
// ==========================================

/**
 * 日報リマインド通知を送信（21:30実行）
 */
function sendDailyReportReminder() {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');

  if (!webhookUrl) {
    Logger.log('DISCORD_WEBHOOK_URLが設定されていません');
    return;
  }

  const staffList = getActiveStaffList();
  let notifiedCount = 0;

  staffList.forEach(staff => {
    const report = getDailyReport(staff.id, today);
    if (!report || report.status !== '提出済') {
      // Discord通知
      const discordId = staff.discordId || '';
      const mention = discordId ? `<@${discordId}>` : staff.name + 'さん';

      const payload = {
        content: `${mention}\n📝 日報の提出期限は22:00です！\n忘れずに提出してね。`
      };

      try {
        UrlFetchApp.fetch(webhookUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload)
        });
        notifiedCount++;
      } catch (e) {
        Logger.log('Discord通知エラー (' + staff.name + '): ' + e.message);
      }
    }
  });

  Logger.log('日報リマインド送信完了: ' + notifiedCount + '名に通知');
}

/**
 * リーダーに「困っていること」を通知
 * @param {string} staffId - 担当者ID
 * @param {string} staffName - 担当者名
 * @param {string} trouble - 困っていること
 */
function notifyLeaderAboutTrouble(staffId, staffName, trouble) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('LEADER_DISCORD_WEBHOOK_URL');

  if (!webhookUrl) {
    // リーダー用Webhookがない場合は通常のWebhookを使用
    const fallbackUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
    if (!fallbackUrl) {
      Logger.log('Webhook URLが設定されていません');
      return;
    }

    const payload = {
      content: `📋 **日報通知**\n${staffName}さんが「困っていること」を報告しています。\n\n> ${truncateText(trouble, 200)}\n\n早めにフォローをお願いします。`
    };

    try {
      UrlFetchApp.fetch(fallbackUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      });
    } catch (e) {
      Logger.log('リーダー通知エラー: ' + e.message);
    }
    return;
  }

  const payload = {
    content: `📋 **日報通知**\n${staffName}さんが「困っていること」を報告しています。\n\n> ${truncateText(trouble, 200)}\n\n早めにフォローをお願いします。`
  };

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch (e) {
    Logger.log('リーダー通知エラー: ' + e.message);
  }
}

/**
 * テキストを指定文字数で切り詰め
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * アクティブな担当者一覧を取得
 */
function getActiveStaffList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('担当者マスタ');

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = _dailyReportStaffHeaderIdx(headers, 'staff_id', '担当者ID');
  const nameIdx = headers.indexOf('担当者名');
  const statusIdx = _dailyReportStaffHeaderIdx(headers, 'status', 'ステータス');
  const discordIdx = _dailyReportStaffHeaderIdx(headers, 'discord_id', 'Discord ID');

  const staffList = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = statusIdx >= 0 ? row[statusIdx] : 'アクティブ';

    if (status === 'アクティブ' || status === '' || status === undefined) {
      staffList.push({
        id: row[idIdx],
        name: row[nameIdx],
        discordId: discordIdx >= 0 ? row[discordIdx] : ''
      });
    }
  }

  return staffList;
}

// ==========================================
// トリガー設定
// ==========================================

/**
 * 日報リマインドトリガーを設定
 */
function setupDailyReportTriggers() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailyReportReminder') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 21:30に実行するトリガーを作成
  ScriptApp.newTrigger('sendDailyReportReminder')
    .timeBased()
    .atHour(21)
    .nearMinute(30)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('日報リマインドトリガーを設定しました（毎日21:30）');
  return { success: true, message: '日報リマインドトリガーを設定しました（毎日21:30）' };
}

/**
 * 日報未提出者一覧を取得
 * @param {string} date - 日付（yyyy-MM-dd）
 * @returns {Array} 未提出者一覧
 */
function getUnsubmittedStaff(date) {
  const targetDate = date || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const staffList = getActiveStaffList();
  const unsubmitted = [];

  staffList.forEach(staff => {
    const report = getDailyReport(staff.id, targetDate);
    if (!report || report.status !== '提出済') {
      unsubmitted.push({
        id: staff.id,
        name: staff.name,
        status: report ? report.status : '未作成'
      });
    }
  });

  return unsubmitted;
}
