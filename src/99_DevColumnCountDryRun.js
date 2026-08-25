/**
 * 削除候補列の非空白件数を数えるドライラン関数（読み取り専用・DEV専用）
 *
 * @param {string} sheetName   対象シート名
 * @param {string[]} headerNames 確認したいヘッダー名の配列
 * @returns {{ results: { [headerName: string]: number | null }, totalRows: number }}
 *   results: 各ヘッダーの非空白件数。ヘッダーが存在しない場合は null
 *   totalRows: ヘッダー行を除いたデータ行数
 */
function dryRunCountNonEmptyByHeader(sheetName, headerNames) {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunCountNonEmptyByHeader is available only in development');
  }
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    const results = {};
    for (const h of headerNames) results[h] = null;
    return { results, totalRows: 0 };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const totalRows = Math.max(0, lastRow - 1);

  const results = {};
  if (lastCol === 0 || lastRow < 2) {
    for (const h of headerNames) results[h] = null;
    return { results, totalRows };
  }

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(h => String(h).trim());

  for (const headerName of headerNames) {
    const colIndex = headers.indexOf(headerName);
    if (colIndex === -1) {
      results[headerName] = null;
      continue;
    }
    const colValues = sheet.getRange(2, colIndex + 1, totalRows, 1).getValues();
    let count = 0;
    for (const [value] of colValues) {
      if (value !== '' && value !== null && value !== undefined) count += 1;
    }
    results[headerName] = count;
  }

  return { results, totalRows };
}
