function checkLeadHeaders() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    Logger.log('リード管理シートが見つかりません');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log('=== リード管理シートのヘッダー一覧 ===');
  headers.forEach((header, index) => {
    Logger.log('列' + (index + 1) + ': "' + header + '"');
  });

  // 特に重要な列を確認
  const importantHeaders = ['顧客名', '呼び方（英語）', '国', 'リード種別', '流入経路', 'メッセージURL', 'CSメモ'];

  Logger.log('\n=== 重要な列の存在確認 ===');
  importantHeaders.forEach(headerName => {
    const exists = headers.includes(headerName);
    Logger.log('"' + headerName + '": ' + (exists ? '✅ 存在' : '❌ 存在しない'));
  });

  return {
    headers: headers,
    count: headers.length
  };
}
