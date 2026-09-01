/**
 * DEV専用: 選択肢マスタの全ヘッダーと特定3列の値を読み取り専用で報告する。
 *
 * 書き込み系操作: なし（setValue, setValues, appendRow, deleteColumn, deleteRow, .clear() 使用禁止）
 * 返却値: JSON文字列（ヘッダー一覧 + 3列の全値）
 *
 * 確認対象:
 *   - 全ヘッダー（英語化されているかの確認）
 *   - リード種別 の全値
 *   - 返信速度 の全値
 *   - アーカイブ理由 の全値
 *
 * @returns {string} JSON.stringify({...})
 */
function devOptionMasterValuesAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('devOptionMasterValuesAudit は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) {
    return JSON.stringify({ error: 'シートが見つかりません: ' + CONFIG.SHEETS.SETTINGS });
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return JSON.stringify({ error: 'データ行がありません（ヘッダー行のみ）' });
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h != null ? h : '').trim(); });

  // 全ヘッダーを colIndex: header の形式で返す
  var headerMap = [];
  for (var i = 0; i < headers.length; i++) {
    headerMap.push({ colIndex: i + 1, header: headers[i] });
  }

  // 対象3列のキー候補（日本語・英語の両方で試みる）
  var TARGET_KEYS = [
    { label: 'リード種別',   candidates: ['リード種別', 'lead_type'] },
    { label: '返信速度',     candidates: ['返信速度', 'response_speed'] },
    { label: 'アーカイブ理由', candidates: ['アーカイブ理由', 'archive_reason'] }
  ];

  var columnResults = TARGET_KEYS.map(function(target) {
    var foundKey = null;
    var foundIdx = -1;

    target.candidates.forEach(function(cand) {
      if (foundIdx === -1) {
        var idx = headers.indexOf(cand);
        if (idx !== -1) {
          foundIdx = idx;
          foundKey = cand;
        }
      }
    });

    if (foundIdx === -1) {
      return {
        label: target.label,
        foundHeader: null,
        colIndex: -1,
        values: [],
        valueCount: 0
      };
    }

    var values = [];
    for (var r = 1; r < allData.length; r++) {
      var cell = allData[r][foundIdx];
      var cellStr = String(cell != null ? cell : '').trim();
      if (cellStr !== '') {
        values.push(cellStr);
      }
    }

    return {
      label: target.label,
      foundHeader: foundKey,
      colIndex: foundIdx + 1,
      values: values,
      valueCount: values.length
    };
  });

  return JSON.stringify({
    sheetName: CONFIG.SHEETS.SETTINGS,
    auditedAt: new Date().toISOString(),
    totalRows: lastRow,
    totalCols: lastCol,
    headers: headerMap,
    targetColumns: columnResults
  });
}
