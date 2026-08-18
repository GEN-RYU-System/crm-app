/**
 * オーダー管理シート構造調査（DEV専用・一時調査用）
 *
 * clasp run auditOrdersSheetStructure で実行する。
 * 読み取り専用。データ値は返さない（件数・ヘッダー名・GID のみ）。
 */
function auditOrdersSheetStructure() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditOrdersSheetStructure is available only in development');
  }

  var ss      = getSpreadsheet();
  var sheet   = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var table   = getCoreSchemaV1Table('ORDERS');

  var gid            = sheet.getSheetId();
  var lastRow        = sheet.getLastRow();
  var lastCol        = sheet.getLastColumn();
  var headerRowNum   = table.headerRowNumber;
  var dataRowCount   = lastRow - headerRowNum;

  // ── ヘッダー行 ──
  var headers = sheet.getRange(headerRowNum, 1, 1, lastCol)
    .getDisplayValues()[0];
  var headerList = headers.map(function(h, i) {
    return { col: i + 1, name: h };
  });

  // ── プルダウン設定（データ行先頭1行をサンプルとして確認） ──
  var validationResult = [];
  if (lastRow >= headerRowNum + 1) {
    var rules = sheet.getRange(headerRowNum + 1, 1, 1, lastCol)
      .getDataValidations()[0];
    rules.forEach(function(rule, i) {
      if (!rule) return;
      var type = String(rule.getCriteriaType());
      var vals = null;
      try {
        var raw = rule.getCriteriaValues();
        if (raw && raw.length > 0) {
          vals = raw.map(function(v) {
            // LIST from range → Range オブジェクト
            if (v && typeof v.getA1Notation === 'function') {
              return '=RANGE:' + v.getA1Notation();
            }
            // LIST from items → 配列
            if (Array.isArray(v)) {
              return v.map(String).join(', ');
            }
            return String(v);
          });
        }
      } catch (e) {
        vals = ['(取得エラー)'];
      }
      validationResult.push({
        col:           i + 1,
        header:        headers[i],
        criteriaType:  type,
        criteriaValues: vals
      });
    });
  }

  // ── 空欄件数（全データ行を走査） ──
  var blankCounts = [];
  if (dataRowCount > 0) {
    var data = sheet.getRange(headerRowNum + 1, 1, dataRowCount, lastCol)
      .getValues();
    for (var c = 0; c < lastCol; c++) {
      var blank = 0;
      for (var r = 0; r < dataRowCount; r++) {
        var v = data[r][c];
        if (v === '' || v === null || v === undefined) blank++;
      }
      blankCounts.push({
        col:    c + 1,
        header: headers[c],
        blank:  blank,
        filled: dataRowCount - blank
      });
    }
  }

  return {
    gid:           gid,
    totalRows:     lastRow,
    lastColumn:    lastCol,
    headerRowNum:  headerRowNum,
    dataRowCount:  dataRowCount,
    headers:       headerList,
    validations:   validationResult,
    blankCounts:   blankCounts
  };
}
