/**
 * DEV専用: システム設定シートの構造を読み取り専用で確認する。
 * シークレット値（SETTING_KEY が大文字スネークケースで VALUE_TYPE が string のもの等）は
 * マスクして返す。
 * @returns {string} JSON
 */
function auditSettingsSheetStructure() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV環境でのみ実行可能');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('システム設定');
  if (!sheet) {
    return JSON.stringify({ error: 'シートが見つかりません' });
  }

  var maxCols = sheet.getMaxColumns();
  var lastCol = sheet.getLastColumn();   // データのある最終列
  var lastRow = sheet.getLastRow();       // データのある最終行
  var maxRows = sheet.getMaxRows();

  // 1行目ヘッダーを全列（maxCols）取得
  var allHeaders = maxCols > 0
    ? sheet.getRange(1, 1, 1, maxCols).getValues()[0]
    : [];

  // データが存在する列（1〜lastCol）のヘッダー
  var dataHeaders = allHeaders.slice(0, lastCol);

  // 空ヘッダー列の位置（lastCol+1 以降）
  var emptyColPositions = [];
  for (var i = lastCol; i < maxCols; i++) {
    emptyColPositions.push(i + 1); // 1-indexed
  }

  // データ行を取得（最大50行、1行目ヘッダー除く）
  var dataRows = [];
  if (lastRow >= 2 && lastCol > 0) {
    var fetchRows = Math.min(lastRow - 1, 50);
    var rawData = sheet.getRange(2, 1, fetchRows, lastCol).getValues();

    // 「SETTING_KEY」列のインデックスを特定（縦持ち構造を想定）
    var keyColIdx = dataHeaders.indexOf('SETTING_KEY');
    if (keyColIdx === -1) keyColIdx = dataHeaders.indexOf('設定キー');
    var typeColIdx = dataHeaders.indexOf('VALUE_TYPE');
    if (typeColIdx === -1) typeColIdx = dataHeaders.indexOf('値の型');

    rawData.forEach(function(row, rowIdx) {
      var record = {};
      dataHeaders.forEach(function(header, colIdx) {
        var val = row[colIdx];
        // シークレット判定: キーが大文字_アンダースコア系 または API/TOKEN/KEY/SECRET を含む場合
        var isSecret = false;
        if (keyColIdx !== -1) {
          var keyVal = String(row[keyColIdx] || '');
          if (/API|TOKEN|KEY|SECRET|PASSWORD|WEBHOOK/i.test(keyVal)) {
            isSecret = true;
          }
        }
        if (isSecret && header === 'SETTING_VALUE' || header === '設定値') {
          record[header] = (val !== '' && val !== null && val !== undefined)
            ? '値あり（機密のため非表示）' : '';
        } else {
          record[header] = val;
        }
      });
      dataRows.push(record);
    });
  }

  return JSON.stringify({
    sheetName: sheet.getName(),
    maxCols: maxCols,
    lastCol: lastCol,
    lastRow: lastRow,
    maxRows: maxRows,
    dataHeaders: dataHeaders,
    emptyColCount: emptyColPositions.length,
    emptyColPositions: emptyColPositions,
    dataRows: dataRows,
    auditedAt: new Date().toISOString()
  });
}
