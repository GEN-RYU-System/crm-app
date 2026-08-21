/**
 * DEV CRMブックの構造だけを監査する読み取り専用関数。
 * セル値、ID値、数式本文、メモ、会話本文は返却・記録しない。
 */
function auditDevSpreadsheetStructure() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevSpreadsheetStructure is available only in development');
  }

  const spreadsheet = getSpreadsheet();
  return {
    sheets: spreadsheet.getSheets().map(auditDevSpreadsheetSheet)
  };
}

function auditDevSpreadsheetSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const hasData = lastRow > 0 && lastColumn > 0;
  const headers = hasData
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    : [];
  const scannedDataRowCount = hasData ? Math.max(lastRow - 1, 0) : 0;
  const dataRange = scannedDataRowCount > 0
    ? sheet.getRange(2, 1, scannedDataRowCount, lastColumn)
    : null;
  const dataValues = dataRange ? dataRange.getValues() : [];
  const dataFormulas = dataRange ? dataRange.getFormulas() : [];
  const usedRange = hasData ? sheet.getRange(1, 1, lastRow, lastColumn) : null;
  const completelyEmptyDataRowCount = countCompletelyEmptyRows(dataValues, dataFormulas);

  return {
    name: sheet.getName(),
    scannedDataRowCount: scannedDataRowCount,
    completelyEmptyDataRowCount: completelyEmptyDataRowCount,
    nonEmptyDataRowCount: scannedDataRowCount - completelyEmptyDataRowCount,
    columnCount: lastColumn,
    headers: headers,
    duplicateHeaderCount: countDuplicateHeaders(headers),
    formulaCellCount: countFormulaCells(usedRange ? usedRange.getFormulas() : []),
    hasFilter: sheet.getFilter() !== null,
    sheetProtectionCount: sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length,
    rangeProtectionCount: sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).length,
    dataValidationCellCount: countDataValidationCells(
      usedRange ? usedRange.getDataValidations() : []
    ),
    idHeaderIntegrity: auditIdHeaders(headers, dataValues, dataFormulas)
  };
}

function countDuplicateHeaders(headers) {
  const counts = {};
  headers.forEach(header => {
    const normalized = String(header).trim();
    if (normalized) counts[normalized] = (counts[normalized] || 0) + 1;
  });
  return Object.keys(counts).reduce((count, header) =>
    count + Math.max(counts[header] - 1, 0), 0
  );
}

function countCompletelyEmptyRows(values, formulas) {
  return values.filter((row, rowIndex) =>
    !isNonEmptyDataRecord(row, formulas[rowIndex])
  ).length;
}

function isNonEmptyDataRecord(values, formulas) {
  return values.some((value, columnIndex) =>
    value !== '' || formulas[columnIndex] !== ''
  );
}

function countFormulaCells(formulas) {
  return formulas.reduce((count, row) =>
    count + row.filter(formula => formula !== '').length, 0
  );
}

function countDataValidationCells(validations) {
  return validations.reduce((count, row) =>
    count + row.filter(validation => validation !== null).length, 0
  );
}

function auditIdHeaders(headers, values, formulas) {
  return headers.reduce((result, header, columnIndex) => {
    if (!isIdHeader(header)) return result;

    const counts = {};
    let emptyCount = 0;
    values.forEach((row, rowIndex) => {
      if (!isNonEmptyDataRecord(row, formulas[rowIndex])) return;
      const value = row[columnIndex];
      if (value === '') {
        emptyCount += 1;
        return;
      }
      const fingerprint = String(value);
      counts[fingerprint] = (counts[fingerprint] || 0) + 1;
    });

    result.push({
      header: header,
      emptyCount: emptyCount,
      duplicateValueRowCount: Object.keys(counts).reduce((count, fingerprint) =>
        count + (counts[fingerprint] > 1 ? counts[fingerprint] : 0), 0
      )
    });
    return result;
  }, []);
}

function isIdHeader(header) {
  const normalized = String(header).trim();
  return /(?:ID|ＩＤ)$/i.test(normalized) || /\bID\b/i.test(normalized);
}
