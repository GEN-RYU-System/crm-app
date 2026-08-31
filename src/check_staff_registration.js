function checkStaffRegistration() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF_MASTER);
    
    if (!sheet) {
      return { success: false, error: '担当者マスタシートが見つかりません' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    Logger.log('=== 担当者マスタ確認 ===');
    Logger.log('ヘッダー:', headers);
    Logger.log('総行数:', data.length);
    
    const emailIdx = (function(h){ var i=h.indexOf('email'); return i!==-1?i:h.indexOf('メール'); })(headers);
    const nameIdx = headers.indexOf('担当者名');
    const idIdx = (function(h){ var i=h.indexOf('staff_id'); return i!==-1?i:h.indexOf('担当者ID'); })(headers);
    
    if (emailIdx === -1) {
      return { success: false, error: 'メール列が見つかりません', headers };
    }
    
    // admin@example.com を検索
    let found = false;
    const targetEmail = 'admin@example.com';
    
    for (let i = 1; i < data.length; i++) {
      const email = data[i][emailIdx];
      Logger.log('行' + (i+1) + ':', {
        担当者ID: data[i][idIdx],
        担当者名: data[i][nameIdx],
        メール: email
      });
      
      if (email === targetEmail) {
        found = true;
        Logger.log('✅ 見つかりました！');
      }
    }
    
    return {
      success: true,
      found: found,
      targetEmail: targetEmail,
      totalRows: data.length - 1,
      headers: headers
    };
    
  } catch (error) {
    Logger.log('エラー:', error.message);
    return { success: false, error: error.message, stack: error.stack };
  }
}
