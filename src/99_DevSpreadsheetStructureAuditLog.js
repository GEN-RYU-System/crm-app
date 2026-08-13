/**
 * DEV構造監査の結果だけを専用ログへ追記する。
 * セル値、ID値、数式本文、例外詳細は保存・返却・ログ出力しない。
 */
const DEV_STRUCTURE_AUDIT_LOG_SHEET_NAME = 'DEV構造監査ログ';
const DEV_STRUCTURE_AUDIT_LOG_VERSION = '2';
const DEV_STRUCTURE_AUDIT_LOG_HEADERS = [
  '実行日時',
  '監査バージョン',
  'タブ名',
  '監査対象行数',
  '完全空行数',
  '実レコード数',
  '列数',
  'ヘッダー重複数',
  '数式セル数',
  'フィルタ有無',
  'シート保護数',
  '範囲保護数',
  'データ検証セル数',
  'ID系ヘッダー名',
  'ID空欄数',
  'ID重複値行数',
  '成功種別'
];

function runAndLogDevSpreadsheetStructureAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error(
      'runAndLogDevSpreadsheetStructureAudit is available only in development'
    );
  }

  let audit;
  try {
    audit = auditDevSpreadsheetStructure();
  } catch (error) {
    return { success: false, errorType: 'AUDIT_FAILED' };
  }

  try {
    const logRows = buildDevStructureAuditLogRows(audit.sheets, new Date());
    if (logRows.length === 0) {
      return { success: false, errorType: 'NO_AUDIT_ROWS' };
    }
    const spreadsheet = getSpreadsheet();
    writeDevStructureAuditLogRows(spreadsheet, logRows);
    return {
      success: true,
      resultType: 'AUDIT_LOG_RECORDED',
      logRowCount: logRows.length
    };
  } catch (error) {
    return { success: false, errorType: 'AUDIT_LOG_WRITE_FAILED' };
  }
}

function writeDevStructureAuditLogRows(spreadsheet, logRows) {
  const existingSheet = spreadsheet.getSheetByName(DEV_STRUCTURE_AUDIT_LOG_SHEET_NAME);
  if (existingSheet) {
    if (!hasDevStructureAuditLogHeaders(existingSheet)) {
      throw new Error('DEV structure audit log header is invalid');
    }
    existingSheet.getRange(
      existingSheet.getLastRow() + 1,
      1,
      logRows.length,
      DEV_STRUCTURE_AUDIT_LOG_HEADERS.length
    ).setValues(logRows);
    return;
  }

  let newSheet;
  try {
    newSheet = spreadsheet.insertSheet(DEV_STRUCTURE_AUDIT_LOG_SHEET_NAME);
    const allRows = [DEV_STRUCTURE_AUDIT_LOG_HEADERS].concat(logRows);
    newSheet.getRange(1, 1, allRows.length, DEV_STRUCTURE_AUDIT_LOG_HEADERS.length)
      .setValues(allRows);
  } catch (error) {
    if (newSheet) {
      try {
        spreadsheet.deleteSheet(newSheet);
      } catch (rollbackError) {
        // Rollback failure is intentionally not exposed.
      }
    }
    throw new Error('DEV structure audit log write failed');
  }
}

function hasDevStructureAuditLogHeaders(sheet) {
  const headers = sheet.getRange(1, 1, 1, DEV_STRUCTURE_AUDIT_LOG_HEADERS.length)
    .getDisplayValues()[0];
  return headers.every((header, index) =>
    header === DEV_STRUCTURE_AUDIT_LOG_HEADERS[index]
  );
}

function buildDevStructureAuditLogRows(sheets, executedAt) {
  return sheets.reduce((rows, sheet) => {
    const idHeaderIntegrity = sheet.idHeaderIntegrity.length > 0
      ? sheet.idHeaderIntegrity
      : [{ header: '', emptyCount: 0, duplicateValueRowCount: 0 }];

    idHeaderIntegrity.forEach(idHeader => {
      rows.push([
        executedAt,
        DEV_STRUCTURE_AUDIT_LOG_VERSION,
        sheet.name,
        sheet.scannedDataRowCount,
        sheet.completelyEmptyDataRowCount,
        sheet.nonEmptyDataRowCount,
        sheet.columnCount,
        sheet.duplicateHeaderCount,
        sheet.formulaCellCount,
        sheet.hasFilter,
        sheet.sheetProtectionCount,
        sheet.rangeProtectionCount,
        sheet.dataValidationCellCount,
        idHeader.header,
        idHeader.emptyCount,
        idHeader.duplicateValueRowCount,
        'AUDIT_SUCCEEDED'
      ]);
    });
    return rows;
  }, []);
}
