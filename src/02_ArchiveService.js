/**
 * アーカイブサービス - 統合シート版
 * リード管理シート内でアーカイブ日を設定して管理
 */

/**
 * 成約/失注時に自動でアーカイブ情報を設定
 */
function archiveOnStatusChange(e) {
  if (!e || !e.source) return;

  const sheet = e.source.getActiveSheet();

  if (sheet.getName() !== CONFIG.SHEETS.LEADS) return;

  const editedRow = e.range.getRow();
  if (editedRow === 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusColIndex = headers.indexOf('進捗ステータス');

  // 進捗ステータス列が編集された場合のみ
  if (e.range.getColumn() !== statusColIndex + 1) return;

  const newStatus = e.value;

  // 完了ステータスの場合はアーカイブ日を設定
  if (CONFIG.CLOSED_STATUSES && CONFIG.CLOSED_STATUSES.includes(newStatus)) {
    const archiveDateColIndex = headers.indexOf('アーカイブ日');
    const archiveReasonColIndex = headers.indexOf('アーカイブ理由');

    if (archiveDateColIndex !== -1) {
      sheet.getRange(editedRow, archiveDateColIndex + 1).setValue(new Date());
    }
    if (archiveReasonColIndex !== -1) {
      sheet.getRange(editedRow, archiveReasonColIndex + 1).setValue(newStatus);
    }

    // 顧客名を取得して通知
    const customerNameIndex = headers.indexOf('顧客名');
    const rowData = sheet.getRange(editedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const customerName = customerNameIndex !== -1 ? rowData[customerNameIndex] : '不明';

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `「${customerName}」様を「${newStatus}」としてアーカイブしました。`,
      '自動アーカイブ',
      3
    );
  }
}

/**
 * 手動でアーカイブ（選択行をアーカイブ）
 */
function manualArchive() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getActiveSheet();

  if (sheet.getName() !== CONFIG.SHEETS.LEADS) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'リード管理シートで実行してください。',
      'エラー',
      5
    );
    return;
  }

  const selection = ss.getSelection();
  const activeRange = selection.getActiveRange();

  if (!activeRange) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'アーカイブする行を選択してください。',
      'エラー',
      5
    );
    return;
  }

  const startRow = activeRange.getRow();
  const numRows = activeRange.getNumRows();

  if (startRow === 1) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'ヘッダー行はアーカイブできません。',
      'エラー',
      5
    );
    return;
  }

  // 確認ダイアログ
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'アーカイブ確認',
    `${numRows}件のリードをアーカイブしますか？`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const archiveDateColIndex = headers.indexOf('アーカイブ日');
  const archiveReasonColIndex = headers.indexOf('アーカイブ理由');
  const statusColIndex = headers.indexOf('進捗ステータス');
  const updateDateColIndex = headers.indexOf('シート更新日');

  const now = new Date();

  // 各行にアーカイブ情報を設定
  for (let i = startRow; i < startRow + numRows; i++) {
    if (archiveDateColIndex !== -1) {
      sheet.getRange(i, archiveDateColIndex + 1).setValue(now);
    }
    if (archiveReasonColIndex !== -1) {
      sheet.getRange(i, archiveReasonColIndex + 1).setValue('手動アーカイブ');
    }
    if (statusColIndex !== -1) {
      sheet.getRange(i, statusColIndex + 1).setValue('アーカイブ');
    }
    if (updateDateColIndex !== -1) {
      sheet.getRange(i, updateDateColIndex + 1).setValue(now);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${numRows}件をアーカイブしました。`,
    '完了',
    3
  );
}

/**
 * アーカイブから復元（アーカイブ情報をクリア）
 */
function restoreFromArchive() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getActiveSheet();

  if (sheet.getName() !== CONFIG.SHEETS.LEADS) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'リード管理シートで実行してください。',
      'エラー',
      5
    );
    return;
  }

  const selection = ss.getSelection();
  const activeRange = selection.getActiveRange();

  if (!activeRange) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '復元する行を選択してください。',
      'エラー',
      5
    );
    return;
  }

  const startRow = activeRange.getRow();
  const numRows = activeRange.getNumRows();

  if (startRow === 1) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'ヘッダー行は復元できません。',
      'エラー',
      5
    );
    return;
  }

  // 確認ダイアログ
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '復元確認',
    `${numRows}件のリードを復元しますか？\nステータスは「対応中」に設定されます。`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const archiveDateColIndex = headers.indexOf('アーカイブ日');
  const archiveReasonColIndex = headers.indexOf('アーカイブ理由');
  const statusColIndex = headers.indexOf('進捗ステータス');
  const reapproachDateColIndex = headers.indexOf('次回アクション日');
  const updateDateColIndex = headers.indexOf('シート更新日');

  const now = new Date();

  // 各行のアーカイブ情報をクリアし、ステータスを復元
  for (let i = startRow; i < startRow + numRows; i++) {
    if (archiveDateColIndex !== -1) {
      sheet.getRange(i, archiveDateColIndex + 1).setValue('');
    }
    if (archiveReasonColIndex !== -1) {
      sheet.getRange(i, archiveReasonColIndex + 1).setValue('');
    }
    if (statusColIndex !== -1) {
      sheet.getRange(i, statusColIndex + 1).setValue('対応中');
    }
    if (reapproachDateColIndex !== -1) {
      sheet.getRange(i, reapproachDateColIndex + 1).setValue(now);
    }
    if (updateDateColIndex !== -1) {
      sheet.getRange(i, updateDateColIndex + 1).setValue(now);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${numRows}件を復元しました。`,
    '完了',
    3
  );
}

/**
 * リードをアーカイブ（API用）
 * @param {string} leadId - リードID
 * @param {string} archiveReason - アーカイブ理由
 * @param {string} csMemo - CSメモ（追記）
 * @returns {Object} {success, message}
 */
function archiveToDroppedLead(leadId, archiveReason, csMemo) {
  if (!leadId) {
    return { success: false, message: 'リードIDが指定されていません。' };
  }

  const ss = getSpreadsheet();
  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadsSheet || leadsSheet.getLastRow() < 2) {
    return { success: false, message: 'リード管理シートが見つかりません。' };
  }

  const data = leadsSheet.getDataRange().getValues();
  const headers = data[0];

  const idIdx = headers.indexOf('リードID');
  const archiveDateIdx = headers.indexOf('アーカイブ日');
  const archiveReasonIdx = headers.indexOf('アーカイブ理由');
  const statusIdx = headers.indexOf('進捗ステータス');
  const lastHandlerIdx = headers.indexOf('最終対応者ID');
  const csMemoIdx = headers.indexOf('CSメモ');
  const updateDateIdx = headers.indexOf('シート更新日');

  // リードを検索
  let targetRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === leadId) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return { success: false, message: `リード「${leadId}」が見つかりません。` };
  }

  const now = new Date();

  // 現在のユーザー情報を取得
  let currentUserId = '';
  try {
    const currentUser = getCurrentUserWithPermissions();
    currentUserId = currentUser.staffId || '';
  } catch (e) {
    Logger.log('ユーザー情報取得エラー: ' + e.message);
  }

  // アーカイブ情報を設定
  if (archiveDateIdx >= 0) {
    leadsSheet.getRange(targetRowIndex, archiveDateIdx + 1).setValue(now);
  }
  if (archiveReasonIdx >= 0) {
    leadsSheet.getRange(targetRowIndex, archiveReasonIdx + 1).setValue(archiveReason || '対象外');
  }
  if (statusIdx >= 0) {
    leadsSheet.getRange(targetRowIndex, statusIdx + 1).setValue('アーカイブ');
  }
  if (lastHandlerIdx >= 0 && currentUserId) {
    leadsSheet.getRange(targetRowIndex, lastHandlerIdx + 1).setValue(currentUserId);
  }
  if (csMemoIdx >= 0 && csMemo) {
    const existingMemo = leadsSheet.getRange(targetRowIndex, csMemoIdx + 1).getValue() || '';
    const newMemo = existingMemo ? existingMemo + '\n---\n' + csMemo : csMemo;
    leadsSheet.getRange(targetRowIndex, csMemoIdx + 1).setValue(newMemo);
  }
  if (updateDateIdx >= 0) {
    leadsSheet.getRange(targetRowIndex, updateDateIdx + 1).setValue(now);
  }

  return { success: true, message: 'リードをアーカイブしました。' };
}

/**
 * アーカイブされたリード一覧を取得
 * @returns {Array} アーカイブ済みリードリスト
 */
function getArchivedLeadsList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusIdx = headers.indexOf('進捗ステータス');
  const leads = [];

  for (let i = 1; i < data.length; i++) {
    const status = data[i][statusIdx];
    // 進捗ステータスが「アーカイブ」のリードのみ
    if (status !== 'アーカイブ') continue;

    const lead = {};
    headers.forEach((header, index) => {
      let value = data[i][index];
      if (value instanceof Date) {
        value = value.toISOString();
      }
      lead[header] = value;
    });
    leads.push(lead);
  }

  return leads;
}
