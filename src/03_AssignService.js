
function runAssignMigration() {
  const ss = SpreadsheetApp.getActive();
  const activeSheet = ss.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  // リード一覧シートのみで実行可能
  if (sheetName !== CONFIG.SHEETS.LEADS_IN && sheetName !== CONFIG.SHEETS.LEADS_OUT) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '「リード一覧（IN）」または「リード一覧（OUT）」シートで実行してください。',
      '実行ガード',
      5
    );
    return;
  }
  
  // リード種別を決定
  const leadType = sheetName === CONFIG.SHEETS.LEADS_IN ? 'インバウンド' : 'アウトバウンド';
  
  const dealsSheet = ss.getSheetByName(CONFIG.SHEETS.DEALS);
  if (!dealsSheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `移行先シート「${CONFIG.SHEETS.DEALS}」が見つかりません。`,
      'エラー',
      8
    );
    return;
  }
  
  // データ取得
  const data = activeSheet.getDataRange().getValues();
  const headers = data[0];
  
  // 列インデックス取得
  const colIndex = {
    担当者: headers.indexOf('担当者'),
    担当者ID: headers.indexOf('assignee_id'),
    進捗: headers.indexOf('進捗'),
    顧客名: headers.indexOf('customer_name'),
    リードID: headers.indexOf('lead_id')
  };
  
  // 移行対象行を抽出（逆順で処理：削除時のインデックスずれ防止）
  const rowsToMigrate = [];
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const 担当者 = row[colIndex.担当者];
    const 担当者ID = row[colIndex.担当者ID];
    const 進捗 = row[colIndex.進捗];
    
    if (担当者 && 担当者ID && 進捗 === 'アサイン待ち') {
      rowsToMigrate.push({
        rowIndex: i + 1, // 1-indexed
        data: row,
        leadType: leadType
      });
    }
  }
  
  if (rowsToMigrate.length === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '移行対象の行がありません。\n（「担当者」「担当者ID」が入力済み、かつ「進捗」が「アサイン待ち」の行が対象）',
      '情報',
      5
    );
    return;
  }
  
  // 商談管理シートのヘッダー取得
  const dealsHeaders = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getValues()[0];
  
  // 移行処理
  let migratedCount = 0;
  rowsToMigrate.forEach(item => {
    // 商談管理用の行データを構築
    const newRow = buildDealsRow(item.data, headers, dealsHeaders, item.leadType);
    
    // 商談管理シートに追加
    dealsSheet.appendRow(newRow);
    
    // 元シートから削除
    activeSheet.deleteRow(item.rowIndex);
    
    migratedCount++;
  });
  
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${migratedCount}件のリードを商談管理に移行しました。`,
    '完了',
    5
  );
}

/**
 * 商談管理用の行データを構築
 */
function buildDealsRow(sourceRow, sourceHeaders, dealsHeaders, leadType) {
  const newRow = [];
  const today = new Date();
  
  dealsHeaders.forEach((header, i) => {
    if (header === 'リード種別') {
      newRow.push(leadType);
    } else if (header === 'アサイン日') {
      newRow.push(today);
    } else if (header === '進捗ステータス') {
      newRow.push('アサイン確定');
    } else if (header === 'シート更新日') {
      newRow.push(today);
    } else if (header === 'アラート確認日') {
      newRow.push(today);
    } else {
      // 元データから継承
      const sourceIndex = sourceHeaders.indexOf(header);
      if (sourceIndex !== -1) {
        newRow.push(sourceRow[sourceIndex]);
      } else {
        newRow.push('');
      }
    }
  });
  
  return newRow;
}

/**
 * メニューから実行するためのラッパー関数
 */
function menuRunAssignMigration() {
  runAssignMigration();
}

// ============================================================
// 統合シート対応（USE_INTEGRATED_SHEET = true 時に使用）
// ============================================================

/**
 * 統合シート用アサイン処理
 * 「リード管理」シート内でステータスを変更
 *
 * 実行条件：
 * - 「担当者」列と「担当者ID」列が両方入っている行
 * - 「進捗ステータス」列が「新規」または「対応中」の行
 */
function runAssignMigrationIntegrated() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `「${CONFIG.SHEETS.LEADS}」シートが見つかりません。`,
      'エラー',
      8
    );
    return;
  }

  // データ取得
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 列インデックス取得
  const colIndex = {
    リードID: headers.indexOf('lead_id'),
    リード種別: headers.indexOf('lead_type'),
    進捗ステータス: headers.indexOf('進捗ステータス'),
    アサイン日: headers.indexOf('assigned_at'),
    担当者: headers.indexOf('担当者'),
    担当者ID: headers.indexOf('assignee_id'),
    顧客名: headers.indexOf('customer_name'),
    シート更新日: headers.indexOf('sheet_updated_at')
  };

  // アサイン対象行を抽出
  const rowsToAssign = [];
  const leadStatuses = CONFIG.LEAD_STATUSES || ['新規', '対応中'];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const 担当者 = row[colIndex.担当者];
    const 担当者ID = row[colIndex.担当者ID];
    const 進捗ステータス = row[colIndex.進捗ステータス];

    // 担当者情報があり、リード段階のステータスの場合
    if (担当者 && 担当者ID && leadStatuses.includes(進捗ステータス)) {
      rowsToAssign.push({
        rowIndex: i + 1, // 1-indexed
        data: row
      });
    }
  }

  if (rowsToAssign.length === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'アサイン対象の行がありません。\n（「担当者」「担当者ID」が入力済み、かつ「進捗ステータス」が「新規」または「対応中」の行が対象）',
      '情報',
      5
    );
    return;
  }

  // アサイン処理
  const today = new Date();
  let assignedCount = 0;

  rowsToAssign.forEach(item => {
    const rowNum = item.rowIndex;

    // 進捗ステータスを「アサイン確定」に変更
    sheet.getRange(rowNum, colIndex.進捗ステータス + 1).setValue(CONFIG.PROGRESS_STATUSES.ASSIGNED);

    // アサイン日を設定
    sheet.getRange(rowNum, colIndex.アサイン日 + 1).setValue(today);

    // シート更新日を更新
    sheet.getRange(rowNum, colIndex.シート更新日 + 1).setValue(today);

    assignedCount++;
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${assignedCount}件のリードをアサイン確定に更新しました。`,
    '完了',
    5
  );
}

/**
 * 統合シート用アサイン処理（メニュー用）
 */
function menuRunAssignMigrationIntegrated() {
  runAssignMigrationIntegrated();
}

/**
 * 自動切り替え：USE_INTEGRATED_SHEETに応じて適切な関数を実行
 */
function runAssignMigrationAuto() {
  if (CONFIG.USE_INTEGRATED_SHEET) {
    runAssignMigrationIntegrated();
  } else {
    runAssignMigration();
  }
}
