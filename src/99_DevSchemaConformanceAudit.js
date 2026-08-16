/**
 * Core Schema V1 と実シートのヘッダーを照合する読み取り専用監査。
 * 書き込み・シート作成・削除は一切行わない。
 *
 * チェック項目:
 *   1. sheetName または aliases のいずれかで実タブが取得できるか
 *   2. 定義ヘッダー名が実シートのヘッダー行にすべて存在するか
 *   3. 実シートの列数と定義列数が一致するか
 *   4. primaryKey に対応する列が存在するか
 *   5. values 定義の選択肢が実データに網羅されているか
 *      （定義→実データ 超過は可。実データ→定義 超過は不一致）
 *
 * headers が {} の LEGACY テーブルは項目 2・3 をスキップする。
 */
function runCoreSchemaConformanceAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('runCoreSchemaConformanceAudit is available only in development');
  }

  const spreadsheet = getSpreadsheet();
  const lines = ['=== Core Schema V1 適合性監査 ===', ''];
  let totalMismatches = 0;

  Object.keys(CORE_SCHEMA_V1_TABLES).forEach(tableKey => {
    const table = CORE_SCHEMA_V1_TABLES[tableKey];
    const result = auditCoreSchemaConformanceTable(spreadsheet, tableKey, table);
    totalMismatches += result.mismatchCount;
    result.lines.forEach(line => lines.push(line));
    lines.push('');
  });

  const verdict = totalMismatches === 0 ? 'PASS' : '★FAIL';
  lines.push('=== 総不一致: ' + totalMismatches + ' → ' + verdict + ' ===');

  const output = lines.join('\n');
  Logger.log(output);
  return output;
}

function auditCoreSchemaConformanceTable(spreadsheet, tableKey, table) {
  const lines = ['[' + tableKey + ' / ' + table.sheetName + ']'];
  let mismatchCount = 0;

  // 1. シート取得
  const candidateNames = [table.sheetName]
    .concat(table.aliases || [])
    .concat(table.canonicalName && table.canonicalName !== table.sheetName ? [table.canonicalName] : [])
    .filter((name, idx, arr) => name && arr.indexOf(name) === idx);

  let sheet = null;
  let foundName = null;
  for (let i = 0; i < candidateNames.length; i++) {
    sheet = spreadsheet.getSheetByName(candidateNames[i]);
    if (sheet) { foundName = candidateNames[i]; break; }
  }

  if (!sheet) {
    lines.push('  1. シート取得: ★不一致 (試行: ' + candidateNames.join(', ') + ')');
    mismatchCount++;
    lines.push('  小計不一致: ' + mismatchCount + '件');
    return { lines: lines, mismatchCount: mismatchCount };
  }
  lines.push('  1. シート取得: OK (' + foundName + ')');

  const definedHeaderKeys = Object.keys(table.headers || {});
  const isLegacy = definedHeaderKeys.length === 0;

  if (isLegacy) {
    lines.push('  2-3. headers: {} → ヘッダー/列数チェックをスキップ');
    lines.push('  小計不一致: 0件');
    return { lines: lines, mismatchCount: 0 };
  }

  const headerRowNum = table.headerRowNumber || 1;
  const lastCol = sheet.getLastColumn();
  const actualHeadersRaw = lastCol > 0
    ? sheet.getRange(headerRowNum, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h).trim())
    : [];
  const actualNonEmptyHeaders = actualHeadersRaw.filter(Boolean);
  const definedPhysicalHeaders = definedHeaderKeys.map(k => table.headers[k]);

  // 2. 定義ヘッダーが実シートに存在するか
  const missingFromSheet = definedPhysicalHeaders.filter(h => actualNonEmptyHeaders.indexOf(h) === -1);
  if (missingFromSheet.length > 0) {
    lines.push('  2. 定義→実シート 欠落ヘッダー (' + missingFromSheet.length + '件): ' + missingFromSheet.join(', '));
    mismatchCount += missingFromSheet.length;
  } else {
    lines.push('  2. 定義→実シート 欠落ヘッダー: なし');
  }

  // 3. 列数一致
  const definedCount = definedPhysicalHeaders.length;
  const actualCount = actualNonEmptyHeaders.length;
  if (definedCount !== actualCount) {
    lines.push('  3. ヘッダー列数: 定義 ' + definedCount + ' / 実シート ' + actualCount + ' → ★不一致 (差: ' + (actualCount - definedCount) + ')');
    mismatchCount++;
  } else {
    lines.push('  3. ヘッダー列数: 定義 ' + definedCount + ' / 実シート ' + actualCount + ' → OK');
  }

  // 4. 主キー列存在
  if (table.primaryKey) {
    const pkPhysical = table.headers[table.primaryKey];
    if (!pkPhysical) {
      lines.push('  4. 主キー (' + table.primaryKey + '): ★headers に物理名なし');
      mismatchCount++;
    } else if (actualNonEmptyHeaders.indexOf(pkPhysical) === -1) {
      lines.push('  4. 主キー列 (' + pkPhysical + '): ★実シートに存在しない');
      mismatchCount++;
    } else {
      lines.push('  4. 主キー列 (' + pkPhysical + '): OK');
    }
  } else {
    lines.push('  4. 主キー: null (スキップ)');
  }

  // 5. values 選択肢チェック（実データに未定義値があれば不一致）
  const hasValues = table.values && Object.keys(table.values).length > 0;
  if (hasValues) {
    const lastRow = sheet.getLastRow();
    const dataValues = lastRow > headerRowNum
      ? sheet.getRange(headerRowNum + 1, 1, lastRow - headerRowNum, lastCol).getValues()
      : [];

    Object.keys(table.values).forEach(valueGroupKey => {
      const definedGroup = table.values[valueGroupKey];
      const definedSet = {};
      Object.keys(definedGroup).forEach(k => { definedSet[String(definedGroup[k])] = true; });

      const physicalHeader = table.headers[valueGroupKey];
      if (!physicalHeader) {
        lines.push('  5. Values [' + valueGroupKey + ']: ★headers に対応キーなし');
        mismatchCount++;
        return;
      }

      const colIdx = actualHeadersRaw.indexOf(physicalHeader);
      if (colIdx === -1) {
        lines.push('  5. Values [' + valueGroupKey + '] (' + physicalHeader + '): ★実シートに列なし');
        mismatchCount++;
        return;
      }

      const unexpectedValues = {};
      dataValues.forEach(row => {
        const val = String(row[colIdx] || '').trim();
        if (val && !definedSet[val]) {
          unexpectedValues[val] = (unexpectedValues[val] || 0) + 1;
        }
      });

      const unexpectedKeys = Object.keys(unexpectedValues);
      if (unexpectedKeys.length > 0) {
        lines.push(
          '  5. Values [' + valueGroupKey + '] (' + physicalHeader + '): ' +
          '★実データに未定義値 ' + unexpectedKeys.length + '種 → ' + unexpectedKeys.join(', ')
        );
        mismatchCount += unexpectedKeys.length;
      } else {
        lines.push('  5. Values [' + valueGroupKey + '] (' + physicalHeader + '): OK');
      }
    });
  } else {
    lines.push('  5. Values: 定義なし (スキップ)');
  }

  lines.push('  小計不一致: ' + mismatchCount + '件');
  return { lines: lines, mismatchCount: mismatchCount };
}
