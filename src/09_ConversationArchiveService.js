/**
 * 会話ログアーカイブサービス
 * 会話ログのアーカイブ処理を担当
 */

// アーカイブブックID
const ARCHIVE_BOOK_ID = '1J4VFKwwV5xbEy15TrbwriFRDiYTH-YfrVTzwTQJpXpI';

// アーカイブシート名
const ARCHIVE_SHEETS = {
  LEAD_ARCHIVE: 'リード会話ログ_アーカイブ',
  DEAL_WON: '商談会話ログ_成約',
  DEAL_LOST: '商談会話ログ_失注',
  DEAL_FOLLOWUP: '商談会話ログ_追客',
  DEAL_NOT_APPLICABLE: '商談会話ログ_対象外',
  SETTINGS: '設定'
};

// ============================================================
// アーカイブブック初期化（手動実行用）
// ============================================================

/**
 * アーカイブブックを初期化（手動実行用）
 */
function setupArchiveBook() {
  // スクリプトプロパティにアーカイブブックIDを設定
  PropertiesService.getScriptProperties().setProperty('ARCHIVE_BOOK_ID', ARCHIVE_BOOK_ID);

  try {
    const archiveSs = SpreadsheetApp.openById(ARCHIVE_BOOK_ID);

    // 既存シートを削除（Sheet1以外）
    const existingSheets = archiveSs.getSheets();
    existingSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      if (sheetName !== 'Sheet1' && !Object.values(ARCHIVE_SHEETS).includes(sheetName)) {
        try {
          archiveSs.deleteSheet(sheet);
        } catch (e) {
          Logger.log('シート削除スキップ: ' + sheetName);
        }
      }
    });

    // 新しいシートを作成
    Object.entries(ARCHIVE_SHEETS).forEach(([key, sheetName]) => {
      if (sheetName === '設定') {
        createArchiveSettingsSheet(archiveSs, sheetName);
      } else {
        createArchiveLogSheet(archiveSs, sheetName);
      }
    });

    // Sheet1を削除（他のシートがある場合のみ）
    const sheet1 = archiveSs.getSheetByName('Sheet1');
    if (sheet1 && archiveSs.getSheets().length > 1) {
      try {
        archiveSs.deleteSheet(sheet1);
      } catch (e) {
        Logger.log('Sheet1削除スキップ');
      }
    }

    Logger.log('アーカイブブックの初期化が完了しました');
    SpreadsheetApp.getActiveSpreadsheet().toast('アーカイブブックを初期化しました', 'セットアップ完了', 5);

  } catch (e) {
    Logger.log('アーカイブブック初期化エラー: ' + e.message);
    throw new Error('アーカイブブックにアクセスできません: ' + e.message);
  }
}

/**
 * アーカイブ用会話ログシートを作成
 * LockService使用（TROUBLE-018対応）
 */
function createArchiveLogSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return sheet;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  // CRMの会話ログと同じヘッダー（9列）
  const headers = HEADERS.CONVERSATION_LOG;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');

  // シート名に応じた色分け
  const colors = {
    'リード会話ログ_アーカイブ': '#9e9e9e',
    '商談会話ログ_成約': '#4caf50',
    '商談会話ログ_失注': '#f44336',
    '商談会話ログ_追客': '#ff9800',
    '商談会話ログ_対象外': '#607d8b'
  };

  headerRange.setBackground(colors[sheetName] || '#4a86e8');
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // ログID
  sheet.setColumnWidth(2, 100);  // リードID
  sheet.setColumnWidth(3, 150);  // 日時
  sheet.setColumnWidth(4, 60);   // 送受信
  sheet.setColumnWidth(5, 100);  // 発言者
  sheet.setColumnWidth(6, 400);  // 原文
  sheet.setColumnWidth(7, 400);  // 翻訳文
  sheet.setColumnWidth(8, 80);   // 記録者ID
  sheet.setColumnWidth(9, 150);  // 記録日時

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

/**
 * アーカイブ設定シートを作成
 * LockService使用（TROUBLE-018対応）
 */
function createArchiveSettingsSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return sheet;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = ['設定項目', '値', '説明'];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  // 初期設定値
  const settings = [
    ['成約アーカイブ日数', '90', '成約から何日後にアーカイブするか'],
    ['追客アーカイブ日数', '90', '追客から何日後にアーカイブするか'],
    ['最終アーカイブ実行日', '', '月次アーカイブの最終実行日'],
    ['CRMブックID', '', 'CRMスプレッドシートのID']
  ];

  sheet.getRange(2, 1, settings.length, settings[0].length).setValues(settings);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 300);

  sheet.setFrozenRows(1);

  Logger.log(sheetName + ' を作成しました');
  return sheet;
}

// ============================================================
// アーカイブ処理
// ============================================================

/**
 * 月次アーカイブ処理（毎月1日AM3:00に実行）
 */
function runMonthlyArchive() {
  const archiveBookId = PropertiesService.getScriptProperties().getProperty('ARCHIVE_BOOK_ID');
  if (!archiveBookId) {
    Logger.log('アーカイブブックIDが設定されていません');
    return;
  }

  // 成約・追客は90日経過後にアーカイブ
  archiveOldConversations('成約', 90);
  archiveOldConversations('追客', 90);

  Logger.log('月次アーカイブ処理が完了しました');
}

/**
 * 古い会話ログをアーカイブ
 * @param {string} status - 商談結果ステータス
 * @param {number} days - 経過日数
 */
function archiveOldConversations(status, days) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) return;

  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('リードID');
  const resultCol = headers.indexOf('商談結果');
  const dateCol = headers.indexOf('シート更新日');

  if (idCol === -1 || resultCol === -1) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const leadsToArchive = [];

  for (let i = 1; i < data.length; i++) {
    const leadId = data[i][idCol];
    const leadStatus = data[i][resultCol];
    const updateDate = data[i][dateCol];

    if (leadStatus === status && updateDate && new Date(updateDate) < cutoffDate) {
      leadsToArchive.push(leadId);
    }
  }

  // 各リードの会話ログをアーカイブ
  leadsToArchive.forEach(leadId => {
    archiveConversationsForLead(leadId, status);
  });

  Logger.log(`${status}の会話ログを${leadsToArchive.length}件アーカイブしました`);
}

/**
 * 特定リードの会話ログをアーカイブ
 */
function archiveConversationsForLead(leadId, status) {
  const archiveBookId = PropertiesService.getScriptProperties().getProperty('ARCHIVE_BOOK_ID');
  if (!archiveBookId) return;

  try {
    const archiveSs = SpreadsheetApp.openById(archiveBookId);

    // アーカイブ先シートを決定
    let targetSheetName;
    switch (status) {
      case '成約':
        targetSheetName = ARCHIVE_SHEETS.DEAL_WON;
        break;
      case '失注':
        targetSheetName = ARCHIVE_SHEETS.DEAL_LOST;
        break;
      case '追客':
        targetSheetName = ARCHIVE_SHEETS.DEAL_FOLLOWUP;
        break;
      case '対象外':
        targetSheetName = ARCHIVE_SHEETS.DEAL_NOT_APPLICABLE;
        break;
      default:
        targetSheetName = ARCHIVE_SHEETS.LEAD_ARCHIVE;
    }

    const targetSheet = archiveSs.getSheetByName(targetSheetName);
    if (!targetSheet) {
      Logger.log('アーカイブシートが見つかりません: ' + targetSheetName);
      return;
    }

    // CRMから会話ログを取得
    const logs = getConversationLogs(leadId);

    if (logs.length === 0) return;

    // アーカイブシートに追加
    logs.forEach(log => {
      const row = [
        log['ログID'],
        log['リードID'],
        log['日時'],
        log['送受信'],
        log['発言者'],
        log['原文'],
        log['翻訳文'],
        log['記録者ID'],
        log['記録日時']
      ];
      targetSheet.appendRow(row);
    });

    // CRMの会話ログから削除
    deleteConversationLogs(leadId);

    Logger.log(`${leadId}の会話ログを${logs.length}件アーカイブしました`);

  } catch (e) {
    Logger.log('会話ログアーカイブエラー: ' + e.message);
  }
}

/**
 * ステータス変更時のアーカイブ（即時）
 * @param {string} leadId - リードID
 * @param {string} newStatus - 新しいステータス
 */
function archiveOnStatusChange(leadId, newStatus) {
  // 失注・対象外は即時アーカイブ
  if (newStatus === '失注' || newStatus === '対象外') {
    archiveConversationsForLead(leadId, newStatus);
  }
}

/**
 * 会話ログを削除（アーカイブ後）
 */
function deleteConversationLogs(leadId) {
  const ss = getSpreadsheet();

  // リード用会話ログから削除
  deleteLogsFromSheet(ss, CONFIG.SHEETS.CONVERSATION_LOG_LEAD, leadId);

  // 商談用会話ログから削除
  deleteLogsFromSheet(ss, CONFIG.SHEETS.CONVERSATION_LOG_DEAL, leadId);
}

/**
 * 特定シートから会話ログを削除
 */
function deleteLogsFromSheet(ss, sheetName, leadId) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdCol = headers.indexOf('リードID');

  if (leadIdCol === -1) return;

  // 下から削除していく（行番号がずれないように）
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][leadIdCol] === leadId) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ============================================================
// リードアーカイブ時の連携
// ============================================================

/**
 * リードアーカイブ時に会話ログもアーカイブ
 * ArchiveService.gsから呼び出される
 */
function archiveConversationLogsForArchivedLead(leadId) {
  const archiveBookId = PropertiesService.getScriptProperties().getProperty('ARCHIVE_BOOK_ID');
  if (!archiveBookId) return;

  try {
    const archiveSs = SpreadsheetApp.openById(archiveBookId);
    const targetSheet = archiveSs.getSheetByName(ARCHIVE_SHEETS.LEAD_ARCHIVE);

    if (!targetSheet) {
      Logger.log('リードアーカイブシートが見つかりません');
      return;
    }

    // CRMから会話ログを取得
    const logs = getConversationLogs(leadId);

    if (logs.length === 0) return;

    // アーカイブシートに追加
    logs.forEach(log => {
      const row = [
        log['ログID'],
        log['リードID'],
        log['日時'],
        log['送受信'],
        log['発言者'],
        log['原文'],
        log['翻訳文'],
        log['記録者ID'],
        log['記録日時']
      ];
      targetSheet.appendRow(row);
    });

    // CRMの会話ログから削除
    deleteConversationLogs(leadId);

    Logger.log(`リード${leadId}の会話ログをアーカイブしました`);

  } catch (e) {
    Logger.log('リード会話ログアーカイブエラー: ' + e.message);
  }
}
