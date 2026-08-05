/**
 * シンプルな会話ログ列検証（Logger出力版）
 */
function simpleColumnVerification() {
  const ss = getSpreadsheet();

  Logger.log('='.repeat(80));
  Logger.log('会話ログ列定義検証');
  Logger.log('='.repeat(80));
  Logger.log('');

  Logger.log('【期待される定義】');
  Logger.log('列数: ' + HEADERS.CONVERSATION_LOG.length);
  HEADERS.CONVERSATION_LOG.forEach((header, index) => {
    Logger.log(`  ${index + 1}列目: ${header}`);
  });
  Logger.log('');

  // 全シートを取得
  const allSheets = ss.getSheets();
  const sheetNames = allSheets.map(s => s.getName());

  Logger.log('【スプレッドシート内の全シート】(' + sheetNames.length + '個)');
  sheetNames.forEach((name, index) => {
    Logger.log(`  ${index + 1}. ${name}`);
  });
  Logger.log('');

  // 会話ログ関連シートを検出
  const conversationLogSheets = sheetNames.filter(name =>
    name.includes('会話ログ') || name.includes('Log') || name.includes('ログ')
  );

  Logger.log('【会話ログ関連シート検出】(' + conversationLogSheets.length + '個)');
  conversationLogSheets.forEach(name => {
    Logger.log(`  - ${name}`);
  });
  Logger.log('');

  // 各会話ログシートを検証
  conversationLogSheets.forEach(sheetName => {
    Logger.log('-'.repeat(80));
    Logger.log(`シート: ${sheetName}`);
    Logger.log('-'.repeat(80));

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('❌ シートが見つかりません');
      Logger.log('');
      return;
    }

    const lastCol = sheet.getLastColumn();
    const actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    Logger.log('実際の列数: ' + lastCol);
    Logger.log('期待される列数: ' + HEADERS.CONVERSATION_LOG.length);
    Logger.log('一致: ' + (HEADERS.CONVERSATION_LOG.length === lastCol ? '✅' : '❌'));
    Logger.log('');

    Logger.log('【ヘッダー比較】');
    const maxLength = Math.max(HEADERS.CONVERSATION_LOG.length, actualHeaders.length);
    for (let i = 0; i < maxLength; i++) {
      const expected = HEADERS.CONVERSATION_LOG[i] || '(定義なし)';
      const actual = actualHeaders[i] || '(列なし)';
      const match = expected === actual;
      const status = match ? '✅' : '❌';

      Logger.log(`  ${status} ${i + 1}列目: 期待="${expected}" | 実際="${actual}"`);
    }
    Logger.log('');

    // データサンプル（最新1件）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      Logger.log('【最新データサンプル】(行' + lastRow + ')');
      const sampleRow = sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];
      actualHeaders.forEach((header, index) => {
        const value = sampleRow[index];
        const displayValue = value === '' ? '(空)' : value;
        Logger.log(`  ${header || '列' + (index + 1)}: ${displayValue}`);
      });
      Logger.log('');
    } else {
      Logger.log('【データサンプル】データなし');
      Logger.log('');
    }
  });

  Logger.log('='.repeat(80));
  Logger.log('検証完了');
  Logger.log('='.repeat(80));

  return 'OK';  // 単純な文字列を返す
}
