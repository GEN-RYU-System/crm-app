function checkStaffHeaders() {
  try {
    const ss = SpreadsheetApp.openById('[REDACTED]');
    const sheet = ss.getSheetByName('担当者マスタ');
    
    if (!sheet) {
      return { success: false, error: '担当者マスタシートが見つかりません' };
    }
    
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    Logger.log('ヘッダー:', headers);
    
    // メール関連の列を探す
    const emailVariations = ['メール', 'メールアドレス', 'Email', 'email'];
    const foundEmails = emailVariations.filter(v => headers.includes(v));
    
    return {
      success: true,
      headers: headers,
      emailColumns: foundEmails,
      hasメール: headers.includes('メール'),
      hasメールアドレス: headers.includes('メールアドレス')
    };
    
  } catch (error) {
    Logger.log('エラー:', error.message);
    return { success: false, error: error.message };
  }
}
