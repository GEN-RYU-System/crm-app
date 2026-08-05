/**
 * 重複検知サービス
 * 過去の問い合わせ履歴を検索し、重複を検知
 */

// ============================================================
// 重複検知
// ============================================================

/**
 * 過去の問い合わせ履歴を検索
 * @param {string} email - メールアドレス
 */
function checkExistingCustomer(email) {
  // 1. メインシート（リード管理）を検索（アクティブなリード）
  const mainResult = searchInMainSheet(email);
  if (mainResult.found) {
    return mainResult;
  }

  // 2. リード管理シートのアーカイブ済み（アーカイブ日あり）を検索
  const archivedResult = searchInArchivedLeads(email);
  if (archivedResult.found) {
    return archivedResult;
  }

  // 3. アーカイブブックを検索（設定されている場合）
  const archiveBookId = PropertiesService.getScriptProperties().getProperty('ARCHIVE_BOOK_ID');
  if (archiveBookId) {
    const archiveResult = searchInArchiveBook(email, archiveBookId);
    if (archiveResult.found) {
      return archiveResult;
    }
  }

  return { found: false };
}

/**
 * メインシート（リード管理）を検索（アクティブなリードのみ）
 */
function searchInMainSheet(email) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { found: false };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const emailCol = headers.indexOf('メール');
  const customerCol = headers.indexOf('顧客名');
  const progressCol = headers.indexOf('進捗ステータス');
  const staffCol = headers.indexOf('担当者');
  const dateCol = headers.indexOf('シート更新日');
  const idCol = headers.indexOf('リードID');
  const archiveDateCol = headers.indexOf('アーカイブ日');

  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][emailCol] || '';
    const archiveDate = data[i][archiveDateCol];

    // アーカイブ済みはスキップ
    if (archiveDate) continue;

    // メールアドレスで一致
    const emailMatch = email && rowEmail && rowEmail.toLowerCase() === email.toLowerCase();

    if (emailMatch) {
      return {
        found: true,
        source: 'メイン',
        leadId: data[i][idCol],
        customerName: data[i][customerCol],
        lastStatus: data[i][progressCol] || '-',
        lastStaff: data[i][staffCol] || '-',
        lastDate: data[i][dateCol] || '-',
        matchType: 'email'
      };
    }
  }

  return { found: false };
}

/**
 * リード管理シートのアーカイブ済みリードを検索
 */
function searchInArchivedLeads(email) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { found: false };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const emailCol = headers.indexOf('メール');
  const customerCol = headers.indexOf('顧客名');
  const archiveReasonCol = headers.indexOf('アーカイブ理由');
  const archiveDateCol = headers.indexOf('アーカイブ日');
  const idCol = headers.indexOf('リードID');
  const staffCol = headers.indexOf('最終対応者ID');
  const progressCol = headers.indexOf('進捗ステータス');

  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][emailCol] || '';
    const archiveDate = data[i][archiveDateCol];

    // アーカイブ済みのみ対象
    if (!archiveDate) continue;

    // メールアドレスで一致
    const emailMatch = email && rowEmail && rowEmail.toLowerCase() === email.toLowerCase();

    if (emailMatch) {
      const archiveReason = data[i][archiveReasonCol] || '';
      const status = data[i][progressCol] || '';
      return {
        found: true,
        source: 'アーカイブ済み',
        leadId: data[i][idCol],
        customerName: data[i][customerCol],
        lastStatus: status + (archiveReason ? '（' + archiveReason + '）' : ''),
        lastStaff: data[i][staffCol] || '-',
        lastDate: archiveDate || '-',
        matchType: 'email'
      };
    }
  }

  return { found: false };
}

/**
 * アーカイブブックを検索
 */
function searchInArchiveBook(email, archiveBookId) {
  try {
    const archiveSs = SpreadsheetApp.openById(archiveBookId);
    const sheets = archiveSs.getSheets();

    for (const sheet of sheets) {
      if (sheet.getLastRow() < 2) continue;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      // メール列を探す（複数の可能性）
      let emailCol = headers.indexOf('メール');
      if (emailCol === -1) emailCol = headers.indexOf('email');
      if (emailCol === -1) continue;

      for (let i = 1; i < data.length; i++) {
        const rowEmail = data[i][emailCol] || '';

        if (email && rowEmail && rowEmail.toLowerCase() === email.toLowerCase()) {
          // 見つかったシート名から情報を取得
          const leadIdCol = headers.indexOf('リードID');
          const customerCol = headers.indexOf('顧客名');
          const dateCol = headers.indexOf('離脱日') >= 0 ? headers.indexOf('離脱日') : headers.indexOf('記録日時');

          return {
            found: true,
            source: 'アーカイブ（' + sheet.getName() + '）',
            leadId: leadIdCol >= 0 ? data[i][leadIdCol] : '-',
            customerName: customerCol >= 0 ? data[i][customerCol] : '-',
            lastStatus: 'アーカイブ済',
            lastStaff: '-',
            lastDate: dateCol >= 0 ? data[i][dateCol] : '-',
            matchType: 'email'
          };
        }
      }
    }
  } catch (e) {
    Logger.log('アーカイブブック検索エラー: ' + e.message);
  }

  return { found: false };
}

// ============================================================
// 重複フラグ管理
// ============================================================

/**
 * 重複情報を取得
 * @param {string} leadId - リードID
 */
function getDuplicateInfo(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { found: false };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('リードID');
  const customerCol = headers.indexOf('顧客名');
  const dupFlagCol = headers.indexOf('重複フラグ');
  const dupSourceCol = headers.indexOf('重複元リードID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === leadId) {
      const dupSourceId = data[i][dupSourceCol];

      // 重複元の情報を取得
      let sourceInfo = null;
      if (dupSourceId) {
        sourceInfo = getLeadInfoById(dupSourceId);
      }

      return {
        found: true,
        leadId: leadId,
        customerName: data[i][customerCol],
        duplicateFlag: data[i][dupFlagCol],
        duplicateSourceId: dupSourceId,
        sourceInfo: sourceInfo
      };
    }
  }

  return { found: false };
}

/**
 * リードIDから情報を取得
 */
function getLeadInfoById(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('リードID');
  const customerCol = headers.indexOf('顧客名');
  const progressCol = headers.indexOf('進捗ステータス');
  const staffCol = headers.indexOf('担当者');
  const dateCol = headers.indexOf('シート更新日');
  const archiveDateCol = headers.indexOf('アーカイブ日');
  const archiveReasonCol = headers.indexOf('アーカイブ理由');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === leadId) {
      const archiveDate = data[i][archiveDateCol];
      const archiveReason = data[i][archiveReasonCol];
      const status = data[i][progressCol] || '-';

      return {
        leadId: leadId,
        customerName: data[i][customerCol],
        lastStatus: archiveDate ? status + (archiveReason ? '（' + archiveReason + '）' : '') : status,
        lastStaff: data[i][staffCol] || '-',
        lastDate: archiveDate || data[i][dateCol] || '-',
        isArchived: !!archiveDate
      };
    }
  }

  return null;
}

/**
 * 重複フラグをクリア（新規として確定）
 * @param {string} leadId - リードID
 */
function clearDuplicateFlag(leadId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('リードID');
  const dupFlagCol = headers.indexOf('重複フラグ');
  const dupSourceCol = headers.indexOf('重複元リードID');
  const dupDateCol = headers.indexOf('重複確認日');
  const dupConfirmerCol = headers.indexOf('重複確認者');

  if (idCol === -1 || dupFlagCol === -1) {
    return { success: false, error: '必要な列が見つかりません' };
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === leadId) {
      const rowNum = i + 1;

      // 重複フラグをクリア
      sheet.getRange(rowNum, dupFlagCol + 1).setValue(false);
      sheet.getRange(rowNum, dupSourceCol + 1).setValue('');

      // 確認日時と確認者を記録
      const currentUser = Session.getActiveUser().getEmail();
      sheet.getRange(rowNum, dupDateCol + 1).setValue(new Date());
      sheet.getRange(rowNum, dupConfirmerCol + 1).setValue(currentUser);

      return { success: true };
    }
  }

  return { success: false, error: 'リードが見つかりません' };
}

/**
 * 重複フラグを設定
 * @param {string} leadId - リードID
 * @param {string} sourceId - 重複元リードID
 */
function setDuplicateFlag(leadId, sourceId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol = headers.indexOf('リードID');
  const dupFlagCol = headers.indexOf('重複フラグ');
  const dupSourceCol = headers.indexOf('重複元リードID');

  if (idCol === -1 || dupFlagCol === -1) {
    return { success: false, error: '必要な列が見つかりません' };
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === leadId) {
      const rowNum = i + 1;

      // 重複フラグを設定
      sheet.getRange(rowNum, dupFlagCol + 1).setValue(true);
      sheet.getRange(rowNum, dupSourceCol + 1).setValue(sourceId);

      return { success: true };
    }
  }

  return { success: false, error: 'リードが見つかりません' };
}

// ============================================================
// 新規リード登録時のチェック
// ============================================================

/**
 * 新規リード登録時の重複チェック
 * WebApp.gsのaddLead関数から呼び出される
 * @param {Object} leadData - リードデータ
 * @returns {Object} チェック結果
 */
function checkDuplicateBeforeAdd(leadData) {
  const email = leadData.email || leadData['メール'] || '';

  if (!email) {
    return { duplicate: false };
  }

  const existingCheck = checkExistingCustomer(email);

  if (existingCheck.found) {
    return {
      duplicate: true,
      duplicateInfo: existingCheck
    };
  }

  return { duplicate: false };
}
