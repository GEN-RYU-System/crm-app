
function onEditTrigger(e) {
  if (!e) return;
  
  try {
    // シート更新日を自動更新
    updateSheetTimestamp(e);
    
    // 見込度を再計算
    updateProspectRankOnEdit(e);
    
    // 成約/失注時に自動アーカイブ
    archiveOnStatusChange(e);
    
    // 担当者ID自動入力
    autoFillStaffId(e);
  } catch (error) {
    Logger.log('onEditTrigger エラー: ' + error.message);
  }
}

/**
 * シート更新日を自動更新
 */
function updateSheetTimestamp(e) {
  if (!e || !e.source) return;
  
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  
  // 対象シートのみ（統合シート版）
  if (sheetName !== CONFIG.SHEETS.LEADS) return;
  
  const editedRow = e.range.getRow();
  if (editedRow === 1) return;
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const timestampColIndex = headers.indexOf('sheet_updated_at');
  
  if (timestampColIndex !== -1) {
    // 更新日列自体の編集は無視（無限ループ防止）
    if (e.range.getColumn() === timestampColIndex + 1) return;
    
    sheet.getRange(editedRow, timestampColIndex + 1).setValue(new Date());
  }
}

/**
 * 担当者選択時にSTAFF_ID（LDO形式）を自動入力
 */
function autoFillStaffId(e) {
  if (!e || !e.source) return;

  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  const targetSheets = [
    CONFIG.SHEETS.LEADS_IN,
    CONFIG.SHEETS.LEADS_OUT
  ];

  if (!targetSheets.includes(sheetName)) return;

  const editedRow = e.range.getRow();
  if (editedRow === 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const staffColIndex = headers.indexOf('担当者');

  // 担当者列が編集された場合のみ
  if (e.range.getColumn() !== staffColIndex + 1) return;

  const staffName = e.value;
  if (!staffName) return;

  // 担当者マスタからSTAFF_ID取得
  const ss = e.source;
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!staffSheet || staffSheet.getLastRow() < 2) return;

  const staffData = staffSheet.getDataRange().getValues();
  const staffHeaders = staffData[0];

  const familyNameCol = staffHeaders.indexOf('last_name_ja');
  const givenNameCol = staffHeaders.indexOf('first_name_ja');
  const oldNameCol = staffHeaders.indexOf('full_name_ja');
  const staffMasterIdCol = staffHeaders.indexOf('staff_id');

  if (staffMasterIdCol === -1) return;
  if (familyNameCol === -1 && givenNameCol === -1 && oldNameCol === -1) return;

  for (let i = 1; i < staffData.length; i++) {
    // 新形式でフルネームを構築
    let fullName = '';
    if (familyNameCol >= 0 && givenNameCol >= 0) {
      const family = staffData[i][familyNameCol] || '';
      const given = staffData[i][givenNameCol] || '';
      if (family || given) {
        fullName = (family + ' ' + given).trim();
      }
    }
    // 新形式で名前が取得できない場合は旧形式を使用
    if (!fullName && oldNameCol >= 0) {
      fullName = staffData[i][oldNameCol] || '';
    }

    if (fullName === staffName) {
      const staffMasterId = staffData[i][staffMasterIdCol];
      const leadStaffIdColIndex = headers.indexOf('assignee_id');
      if (leadStaffIdColIndex !== -1 && staffMasterId) {
        sheet.getRange(editedRow, leadStaffIdColIndex + 1).setValue(staffMasterId);
      }
      break;
    }
  }
}

/**
 * ==========================================
 * トリガー管理関数は gas/00_TriggerSetup.js に統合されました
 * ==========================================
 *
 * 以下の関数を使用してください：
 * - setupAllTriggers() - 全トリガーをセットアップ（環境自動判定）
 * - deleteAllTriggers() - 全トリガーを削除
 * - listAllTriggers() - トリガー一覧を表示
 *
 * カスタムメニュー「🔧 管理」→「📊 トリガー管理」から実行できます。
 * ==========================================
 */
