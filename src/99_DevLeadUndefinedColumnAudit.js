/**
 * DEV専用: リード管理シートの「CoreSchemaRegistry 定義外13列」について、
 * データ有無（非空行数）を読み取り専用で監査する。
 *
 * 書き込み系操作: なし
 * 返却値: JSON文字列（列名・非空件数・全行数）
 *
 * @returns {string} JSON.stringify({ totalRows, columns: [...] })
 */
function auditLeadUndefinedColumns() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditLeadUndefinedColumns は DEV 環境でのみ実行できます');
  }

  var UNDEFINED_COLUMNS = [
    'リード進捗',
    '商談進捗',
    '1回の発注金額',
    '購入頻度(月次)',
    '商談の手応え',
    'Good Point',
    'More Point',
    '反省と今後の抱負',
    'レポート提出日',
    'レポート確認者',
    'レポート確認日',
    'レポートコメント',
    'Buddyフィードバック'
  ];

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    return JSON.stringify({ error: 'リード管理シートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return JSON.stringify({ totalRows: 0, columns: UNDEFINED_COLUMNS.map(function(name) {
      return { columnName: name, exists: false, nonEmptyCount: 0, totalRows: 0 };
    })});
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataRows = lastRow - 1;
  var results = [];

  UNDEFINED_COLUMNS.forEach(function(colName) {
    var colIdx = headers.indexOf(colName);

    if (colIdx === -1) {
      results.push({
        columnName: colName,
        exists: false,
        colPosition: -1,
        nonEmptyCount: 0,
        totalRows: dataRows
      });
      return;
    }

    var colValues = sheet.getRange(2, colIdx + 1, dataRows, 1).getValues();
    var nonEmptyCount = 0;

    colValues.forEach(function(row) {
      var val = row[0];
      if (val !== '' && val !== null && val !== undefined) {
        nonEmptyCount++;
      }
    });

    results.push({
      columnName: colName,
      exists: true,
      colPosition: colIdx + 1,
      nonEmptyCount: nonEmptyCount,
      totalRows: dataRows
    });
  });

  return JSON.stringify({
    sheetName: sheet.getName(),
    totalRows: dataRows,
    totalCols: lastCol,
    auditedAt: new Date().toISOString(),
    columns: results
  });
}
