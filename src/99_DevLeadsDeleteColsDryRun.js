/**
 * DEV専用: リード管理シートの定義外13列「削除 dry-run」
 *
 * 実際の削除はせず、以下を読み取り専用で報告する:
 *   - 削除対象列の現在の列番号・列名・非空データ件数
 *   - 削除後に残る列数（見込み）
 *   - 非空データが存在する列に対する警告
 *
 * 書き込み系操作: なし（getValues のみ）
 *
 * 実行環境: DEV のみ
 * 対応 PR: release/leads-delete-cols
 *
 * @returns {string} JSON文字列
 */
function leadsDeleteColsDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('leadsDeleteColsDryRun は DEV 環境でのみ実行できます');
  }

  // 削除対象列（監査レポート 2026-09-01 の PO 決定に基づく）
  // - レガシー専用3列: リード進捗・商談進捗・商談の手応え
  // - Buddy複合2列（LEADS側のみ）: 1回の発注金額・購入頻度(月次)
  // - Buddy専用7列: Good Point・More Point・反省と今後の抱負・レポート提出日・レポート確認者・レポート確認日・レポートコメント
  // - 要PO確定1列: Buddyフィードバック
  var DELETE_TARGET_COLUMNS = [
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

  if (lastRow < 1) {
    return JSON.stringify({ error: 'シートが空です' });
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataRows = Math.max(0, lastRow - 1);

  var foundColumns = [];
  var notFoundColumns = [];
  var warnings = [];

  DELETE_TARGET_COLUMNS.forEach(function(colName) {
    var colIdx = headers.indexOf(colName);

    if (colIdx === -1) {
      notFoundColumns.push(colName);
      return;
    }

    var nonEmptyCount = 0;
    if (dataRows > 0) {
      var colValues = sheet.getRange(2, colIdx + 1, dataRows, 1).getValues();
      colValues.forEach(function(row) {
        var val = row[0];
        if (val !== '' && val !== null && val !== undefined) {
          nonEmptyCount++;
        }
      });
    }

    var entry = {
      columnName: colName,
      colPosition: colIdx + 1,
      nonEmptyCount: nonEmptyCount,
      totalDataRows: dataRows
    };

    if (nonEmptyCount > 0) {
      warnings.push('WARNING: ' + colName + ' 列に ' + nonEmptyCount + ' 件の非空データあり — 削除前にデータを確認してください');
      entry.hasData = true;
    } else {
      entry.hasData = false;
    }

    foundColumns.push(entry);
  });

  // 削除後の残列数を計算
  var remainingColCount = lastCol - foundColumns.length;

  var result = {
    dryRun: true,
    executedAt: new Date().toISOString(),
    sheetName: sheet.getName(),
    currentTotalCols: lastCol,
    remainingColsAfterDelete: remainingColCount,
    dataRows: dataRows,
    deleteTargetCount: DELETE_TARGET_COLUMNS.length,
    foundCount: foundColumns.length,
    notFoundCount: notFoundColumns.length,
    warnings: warnings,
    foundColumns: foundColumns,
    notFoundColumns: notFoundColumns
  };

  Logger.log(JSON.stringify(result, null, 2));
  return JSON.stringify(result);
}

/**
 * DEV専用: リード管理シートの定義外13列を実際に削除する（不可逆操作）
 *
 * 実行前に leadsDeleteColsDryRun() を実行し、
 * warnings が空であること・foundColumns の位置を確認してから実行すること。
 *
 * 削除は列番号の降順（右から左）で行う。
 * 左から順に削除すると列番号がずれるため。
 *
 * 書き込み系操作: deleteColumn（不可逆）
 *
 * 実行環境: DEV のみ
 * 対応 PR: release/leads-delete-cols
 *
 * @returns {string} JSON文字列
 */
function leadsDeleteColsExecute() {
  if (getEnvironment() !== 'development') {
    throw new Error('leadsDeleteColsExecute は DEV 環境でのみ実行できます');
  }

  var DELETE_TARGET_COLUMNS = [
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

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 削除対象列の番号を収集し、降順にソートして右から削除
  var colNumbersToDelete = [];

  DELETE_TARGET_COLUMNS.forEach(function(colName) {
    var colIdx = headers.indexOf(colName);
    if (colIdx !== -1) {
      colNumbersToDelete.push({ name: colName, colNumber: colIdx + 1 });
    }
  });

  // 降順ソート（右から削除することで列番号ずれを防ぐ）
  colNumbersToDelete.sort(function(a, b) {
    return b.colNumber - a.colNumber;
  });

  var deleted = [];
  var errors = [];

  colNumbersToDelete.forEach(function(target) {
    try {
      sheet.deleteColumn(target.colNumber);
      deleted.push({ columnName: target.name, deletedColNumber: target.colNumber });
      Logger.log('削除完了: ' + target.name + ' (col ' + target.colNumber + ')');
    } catch (e) {
      errors.push({ columnName: target.name, colNumber: target.colNumber, error: String(e) });
      Logger.log('削除エラー: ' + target.name + ' — ' + String(e));
    }
  });

  var result = {
    dryRun: false,
    executedAt: new Date().toISOString(),
    sheetName: sheet.getName(),
    deletedCount: deleted.length,
    errorCount: errors.length,
    deleted: deleted,
    errors: errors,
    remainingColsAfterDelete: sheet.getLastColumn()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return JSON.stringify(result);
}
