/**
 * HEADERS.LEADSと実際のシートヘッダーを比較
 */
function compareLeadHeaders() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const configHeaders = HEADERS.LEADS;

  Logger.log('='.repeat(80));
  Logger.log('HEADERS.LEADS vs 実際のシート比較');
  Logger.log('='.repeat(80));
  Logger.log('');

  Logger.log('HEADERS.LEADS列数: ' + configHeaders.length);
  Logger.log('実際のシート列数: ' + actualHeaders.length);
  Logger.log('差分: ' + (actualHeaders.length - configHeaders.length) + ' 列');
  Logger.log('');

  Logger.log('【詳細比較】');
  Logger.log('-'.repeat(80));
  Logger.log(String('列番号').padEnd(10) + String('HEADERS.LEADS').padEnd(30) + String('実際のシート').padEnd(30) + '状態');
  Logger.log('-'.repeat(80));

  const maxLength = Math.max(configHeaders.length, actualHeaders.length);

  for (let i = 0; i < maxLength; i++) {
    const configHeader = configHeaders[i] || '(定義なし)';
    const actualHeader = actualHeaders[i] || '(列なし)';
    const match = configHeader === actualHeader;
    const status = match ? '✅' : '❌';

    const line = String(i + 1).padEnd(10) +
                 String(configHeader).padEnd(30) +
                 String(actualHeader).padEnd(30) +
                 status;

    Logger.log(line);

    // 不一致の場合は詳細情報
    if (!match && i < 60) {  // 最初の60列まで
      Logger.log('  ⚠️ 不一致: 期待="' + configHeader + '" 実際="' + actualHeader + '"');
    }
  }

  Logger.log('-'.repeat(80));
  Logger.log('');

  // 不一致の列をリストアップ
  const mismatches = [];
  for (let i = 0; i < maxLength; i++) {
    const configHeader = configHeaders[i] || '(定義なし)';
    const actualHeader = actualHeaders[i] || '(列なし)';
    if (configHeader !== actualHeader) {
      mismatches.push({
        column: i + 1,
        config: configHeader,
        actual: actualHeader
      });
    }
  }

  Logger.log('【不一致サマリー】');
  Logger.log('不一致箇所: ' + mismatches.length + ' 箇所');
  Logger.log('');

  if (mismatches.length > 0) {
    Logger.log('不一致リスト:');
    mismatches.forEach(m => {
      Logger.log(`  ${m.column}列目: "${m.config}" → "${m.actual}"`);
    });
  }

  Logger.log('');
  Logger.log('='.repeat(80));

  return {
    configLength: configHeaders.length,
    actualLength: actualHeaders.length,
    difference: actualHeaders.length - configHeaders.length,
    mismatches: mismatches,
    actualHeaders: actualHeaders
  };
}
