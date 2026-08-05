/**
 * gid (シートID) からシートを取得
 */
function getSheetByGid(ss, gid) {
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    if (allSheets[i].getSheetId() === gid) {
      return allSheets[i];
    }
  }
  return null;
}

/**
 * 検証結果をスプレッドシートに出力
 */
function writeVerificationResultsToSheet() {
  const ss = getSpreadsheet();

  // 検証結果シートを作成または取得
  let resultSheet = ss.getSheetByName('🔍列定義検証結果');

  if (resultSheet) {
    ss.deleteSheet(resultSheet);
  }

  resultSheet = ss.insertSheet('🔍列定義検証結果');

  const output = [];

  // ヘッダー
  output.push(['='.repeat(80)]);
  output.push(['会話ログ列定義 完全検証']);
  output.push(['実行日時: ' + new Date().toLocaleString('ja-JP')]);
  output.push(['='.repeat(80)]);
  output.push(['']);

  // 期待される定義
  output.push(['【期待される定義】']);
  output.push(['列数: ' + HEADERS.CONVERSATION_LOG.length]);
  HEADERS.CONVERSATION_LOG.forEach((header, index) => {
    output.push([`  ${index + 1}列目: ${header}`]);
  });
  output.push(['']);

  // 全シート一覧（gid付き）
  const allSheets = ss.getSheets();
  const sheetInfo = allSheets
    .filter(s => s.getName() !== '🔍列定義検証結果')
    .map(s => ({ name: s.getName(), gid: s.getSheetId() }));

  output.push(['【スプレッドシート内の全シート】(' + sheetInfo.length + '個)']);
  sheetInfo.forEach((info, index) => {
    output.push([`  ${index + 1}. ${info.name} (gid=${info.gid})`]);
  });
  output.push(['']);

  // 検証対象シートをgidで指定（会話ログ（商談用）のgid）
  const targetGid = 2011591943;
  const targetSheet = getSheetByGid(ss, targetGid);

  output.push(['【検証対象シート】(gid指定)']);
  output.push([`  対象gid: ${targetGid}`]);

  if (!targetSheet) {
    output.push(['  ❌ 指定されたgidのシートが見つかりませんでした']);
    output.push(['  スプレッドシートを確認してください']);
    output.push(['']);

    // シートに書き込み
    const range = resultSheet.getRange(1, 1, output.length, 4);
    range.setValues(output.map(row => {
      while (row.length < 4) row.push('');
      return row;
    }));

    return 'エラー: 指定されたgid=' + targetGid + 'のシートが見つかりませんでした';
  }

  output.push([`  シート名: ${targetSheet.getName()}`]);
  output.push(['']);
  output.push(['']);

  const existingConversationLogSheets = [targetSheet.getName()];

  // 各シートを詳細検証
  existingConversationLogSheets.forEach(sheetName => {
    output.push(['-'.repeat(80)]);
    output.push([`シート名: ${sheetName}`]);
    output.push(['-'.repeat(80)]);

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      output.push(['❌ シートが見つかりません']);
      output.push(['']);
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // ヘッダー行を取得（より安全な方法）
    let actualHeaders = [];
    try {
      const headerRange = sheet.getRange(1, 1, 1, lastCol);
      const headerValues = headerRange.getValues();
      actualHeaders = headerValues[0] || [];

      // デバッグ情報
      output.push(['デバッグ情報: 最終行=' + lastRow + ', 最終列=' + lastCol]);
      output.push(['デバッグ情報: ヘッダー配列長=' + actualHeaders.length]);
    } catch (e) {
      output.push(['❌ ヘッダー取得エラー: ' + e.message]);
      actualHeaders = [];
    }

    output.push(['実際の列数: ' + lastCol]);
    output.push(['期待される列数: ' + HEADERS.CONVERSATION_LOG.length]);
    output.push(['一致: ' + (HEADERS.CONVERSATION_LOG.length === lastCol ? '✅ YES' : '❌ NO (不一致)')]);
    output.push(['']);

    output.push(['【ヘッダー比較】']);
    output.push(['列番号', '状態', '期待されるヘッダー', '実際のヘッダー']);

    const maxLength = Math.max(HEADERS.CONVERSATION_LOG.length, actualHeaders.length);
    for (let i = 0; i < maxLength; i++) {
      const expected = HEADERS.CONVERSATION_LOG[i] || '(定義なし)';
      const actual = actualHeaders[i] || '(列なし)';
      const match = expected === actual;
      const status = match ? '✅' : '❌';

      output.push([i + 1, status, expected, actual]);
    }
    output.push(['']);

    // データサンプル（最新3件）
    if (lastRow > 1) {
      output.push(['【最新データサンプル】(最新3件)']);
      output.push(['']);

      const sampleSize = Math.min(3, lastRow - 1);
      const startRow = lastRow - sampleSize + 1;
      const dataRange = sheet.getRange(startRow, 1, sampleSize, lastCol).getValues();

      dataRange.forEach((row, rowIndex) => {
        const actualRowNumber = startRow + rowIndex;
        output.push([`--- 行${actualRowNumber} ---`]);

        actualHeaders.forEach((header, colIndex) => {
          const value = row[colIndex];
          const displayValue = value === '' ? '(空)' : value;
          output.push([`  ${header || '列' + (colIndex + 1)}`, displayValue]);
        });

        output.push(['']);
      });
    } else {
      output.push(['【データサンプル】データなし']);
      output.push(['']);
    }
  });

  // 総合判定
  output.push(['='.repeat(80)]);
  output.push(['【総合判定】']);
  output.push(['='.repeat(80)]);

  let allMatch = true;
  // 直接targetSheetを使用
  if (targetSheet) {
    const sheetName = targetSheet.getName();

    const lastCol = targetSheet.getLastColumn();

    // ヘッダー取得（安全版）
    let actualHeaders = [];
    try {
      actualHeaders = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    } catch (e) {
      output.push([`❌ ${sheetName}: ヘッダー取得エラー - ${e.message}`]);
      allMatch = false;
    }

    if (allMatch) {
      if (HEADERS.CONVERSATION_LOG.length !== lastCol) {
        output.push([`❌ ${sheetName}: 列数不一致 (期待${HEADERS.CONVERSATION_LOG.length}列, 実際${lastCol}列)`]);
        allMatch = false;
      } else {
        let mismatchCount = 0;
        for (let i = 0; i < lastCol; i++) {
          if (HEADERS.CONVERSATION_LOG[i] !== actualHeaders[i]) {
            mismatchCount++;
          }
        }

        if (mismatchCount > 0) {
          output.push([`❌ ${sheetName}: ヘッダー名不一致 (${mismatchCount}箇所)`]);
          allMatch = false;
        } else {
          output.push([`✅ ${sheetName}: すべて一致`]);
        }
      }
    }
  } else {
    output.push([`❌ 検証対象シートが見つかりませんでした (gid=${targetGid})`]);
    allMatch = false;
  }

  output.push(['']);
  if (allMatch) {
    output.push(['🎉 すべてのシートで列定義が完全に一致しています']);
  } else {
    output.push(['⚠️ 列定義の不一致が検出されました。上記の詳細を確認してください。']);
  }

  output.push(['']);
  output.push(['='.repeat(80)]);
  output.push(['検証完了']);
  output.push(['='.repeat(80)]);

  // シートに書き込み
  const range = resultSheet.getRange(1, 1, output.length, 4);
  range.setValues(output.map(row => {
    while (row.length < 4) row.push('');
    return row;
  }));

  // 書式設定
  resultSheet.setColumnWidth(1, 150);
  resultSheet.setColumnWidth(2, 100);
  resultSheet.setColumnWidth(3, 200);
  resultSheet.setColumnWidth(4, 300);

  Logger.log('検証結果を「🔍列定義検証結果」シートに出力しました');

  return '検証結果を「🔍列定義検証結果」シートに出力しました。スプレッドシートを確認してください。';
}
