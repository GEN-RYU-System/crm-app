/**
 * スプレッドシート初期設定
 * シート作成、ヘッダー設定、入力規則設定
 */
function initializeSpreadsheet() {
  const ss = getSpreadsheet();

  // 1. シート作成
  createSheets(ss);

  // 2. ヘッダー設定
  setHeaders(ss);

  // 3. 設定シートにプルダウン選択肢を初期化
  initializeSettingsSheet(ss);

  // 4. 通知設定シートを初期化
  initializeNotificationSheet(ss);

  // 5. 権限設定シートを初期化
  initializePermissionsSheet(ss);

  // 6. 入力規則設定
  setDataValidations(ss);

  // 6. トリガー設定
  setupTriggers();

  Logger.log('初期設定が完了しました。');
  SpreadsheetApp.getActiveSpreadsheet().toast('初期設定が完了しました。', '完了', 5);
}

/**
 * シート作成
 */
function createSheets(ss) {
  const sheetNames = Object.values(CONFIG.SHEETS);
  
  sheetNames.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      // LockService使用（TROUBLE-018対応）
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        sheet = ss.getSheetByName(name);
        if (!sheet) {
          sheet = ss.insertSheet(name);
          Logger.log(`シート「${name}」を作成しました。`);
        }
      } finally {
        lock.releaseLock();
      }
    }
  });
}

/**
 * ヘッダー設定
 * リード管理シートは setupIntegratedLeadSheet() で作成するため、
 * ここでは補助シート（担当者マスタ、テンプレート、設定）のみ設定
 */
function setHeaders(ss) {
  // 各シートにヘッダー設定
  const headerMap = {
    [CONFIG.SHEETS.STAFF]: HEADERS.STAFF,
    [CONFIG.SHEETS.TEMPLATES]: HEADERS.TEMPLATES,
    [CONFIG.SHEETS.SETTINGS]: HEADERS.SETTINGS
  };

  Object.entries(headerMap).forEach(([sheetName, headers]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // 既存データがある場合はスキップ
      if (sheet.getLastRow() > 0) {
        const existingHeader = sheet.getRange(1, 1).getValue();
        if (existingHeader) {
          Logger.log(`「${sheetName}」は既にデータがあるためスキップ`);
          return;
        }
      }

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
      sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      Logger.log(`「${sheetName}」のヘッダーを設定しました。`);
    }
  });
}

/**
 * 設定シートにプルダウン選択肢を初期化
 */
function initializeSettingsSheet(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sheet) return;

  // 既にデータがある場合はスキップ
  if (sheet.getLastRow() > 1) {
    Logger.log('設定シートは既にデータがあるためスキップ');
    return;
  }

  // 強制更新関数を呼び出し
  forceResetSettingsSheet(ss);
}

/**
 * 権限設定シートを初期化
 */
function initializePermissionsSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  if (!sheet) {
    Logger.log('権限設定シートが見つかりません');
    return;
  }

  // 既にデータがある場合はスキップ
  if (sheet.getLastRow() > 1) {
    Logger.log('権限設定シートは既にデータがあるためスキップ');
    return;
  }

  // ヘッダーを設定
  const headers = HEADERS.PERMISSIONS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // デフォルト役割を追加（オブジェクト形式に対応）
  Object.keys(DEFAULT_ROLES).forEach(roleName => {
    const permissions = DEFAULT_ROLES[roleName];
    const rowData = headers.map(header => {
      if (header === '役割名') {
        return roleName;
      }
      return permissions[header] || false;
    });
    sheet.appendRow(rowData);
  });

  Logger.log('権限設定シートを初期化しました');
}

/**
 * 目標設定シートを初期化
 */
function initializeGoalsSheet(ss) {
  ss = ss || getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);

  if (!sheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
      if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEETS.GOALS);
      }
    } finally {
      lock.releaseLock();
    }
  }

  // ヘッダー設定
  const headerRange = sheet.getRange(1, 1, 1, GOALS_HEADERS.length);
  headerRange.setValues([GOALS_HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a90d9');
  headerRange.setFontColor('#ffffff');

  // 期間タイプの入力規則（設定シートから取得）
  const dropdownOptions = getDropdownOptions();
  const periodTypes = dropdownOptions['期間タイプ'] || DEFAULT_DROPDOWN_OPTIONS['期間タイプ'];
  const periodTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(periodTypes, true)
    .build();
  sheet.getRange(2, 4, 100, 1).setDataValidation(periodTypeRule);

  // ヘッダー行を固定
  sheet.setFrozenRows(1);

  Logger.log('目標設定シートを初期化しました');
  return { success: true, message: '目標設定シートを初期化しました' };
}

/**
 * メニューから呼び出す用：目標設定シート初期化
 */
function initializeGoalsSheetFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ss = getSpreadsheet();

  // 既存シートがある場合は確認
  const existingSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
  if (existingSheet && existingSheet.getLastRow() > 1) {
    const confirm = ui.alert(
      '確認',
      '目標設定シートには既にデータがあります。上書きしますか？',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) {
      return;
    }

    // 既存シートをクリア
    existingSheet.clear();
  }

  const result = initializeGoalsSheet(ss);

  if (result.success) {
    ui.alert('完了', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('エラー', result.message || '初期化に失敗しました。', ui.ButtonSet.OK);
  }
}

/**
 * メニューから呼び出す用：権限設定シート初期化（上書き可能）
 */
function initializePermissionsSheetFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ss = getSpreadsheet();

  // 既存シートがある場合は確認
  const existingSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  if (existingSheet && existingSheet.getLastRow() > 1) {
    const confirm = ui.alert(
      '確認',
      '権限設定シートには既にデータがあります。上書きしますか？\n※既存の役割設定は全て削除されます。',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) {
      return;
    }

    // 既存シートをクリア
    existingSheet.clear();
  }

  // シートがない場合は作成
  if (!existingSheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      if (!ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS)) {
        ss.insertSheet(CONFIG.SHEETS.PERMISSIONS);
      }
    } finally {
      lock.releaseLock();
    }
  }

  // 初期化（スキップフラグを無視するため直接処理）
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  const headers = HEADERS.PERMISSIONS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // デフォルト役割を追加
  Object.keys(DEFAULT_ROLES).forEach(roleName => {
    const permissions = DEFAULT_ROLES[roleName];
    const rowData = headers.map(header => {
      if (header === '役割名') {
        return roleName;
      }
      return permissions[header] || false;
    });
    sheet.appendRow(rowData);
  });

  ui.alert('完了', '権限設定シートを初期化しました。', ui.ButtonSet.OK);
}

/**
 * 設定シートを強制的にリセット（ヘッダーと選択肢を再設定）
 */
function forceResetSettingsSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sheet) {
    Logger.log('設定シートが見つかりません');
    return;
  }

  // 既存データをクリア
  sheet.clear();

  // ヘッダーを設定
  const headers = DROPDOWN_COLUMNS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 各列の最大行数を計算
  let maxRows = 0;
  headers.forEach(header => {
    const options = DEFAULT_DROPDOWN_OPTIONS[header] || [];
    if (options.length > maxRows) {
      maxRows = options.length;
    }
  });

  if (maxRows === 0) return;

  // データを2次元配列として準備
  const data = [];
  for (let row = 0; row < maxRows; row++) {
    const rowData = [];
    headers.forEach(header => {
      const options = DEFAULT_DROPDOWN_OPTIONS[header] || [];
      rowData.push(options[row] || '');
    });
    data.push(rowData);
  }

  // データを書き込み
  sheet.getRange(2, 1, maxRows, headers.length).setValues(data);

  // キャッシュをクリア
  clearDropdownCache();

  Logger.log('設定シートを強制リセットしました');
}

/**
 * メニューから呼び出す用：設定シート強制リセット（パスワード保護）
 */
function resetSettingsSheetFromMenu() {
  const ui = SpreadsheetApp.getUi();

  // パスワード確認
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (adminPassword) {
    const response = ui.prompt(
      '管理者認証',
      '管理者パスワードを入力してください:',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    if (response.getResponseText() !== adminPassword) {
      ui.alert('エラー', 'パスワードが正しくありません。', ui.ButtonSet.OK);
      return;
    }
  }

  // 確認ダイアログ
  const confirm = ui.alert(
    '確認',
    '設定シートを完全にリセットします。既存のカスタマイズは全て失われます。\n本当に実行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  const ss = getSpreadsheet();
  forceResetSettingsSheet(ss);

  // 入力規則も再設定
  setDataValidations(ss);

  ui.alert('完了', '設定シートをリセットしました。', ui.ButtonSet.OK);
}

/**
 * 設定シートを差分更新（既存を維持、不足のみ追加）
 */
function updateSettingsSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sheet) {
    Logger.log('設定シートが見つかりません');
    return;
  }

  // 現在のデータを取得
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  let existingHeaders = [];
  let existingData = {};

  if (lastCol > 0 && lastRow > 0) {
    existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(h => h);

    // 既存の各列のデータを取得
    existingHeaders.forEach((header, colIndex) => {
      if (lastRow > 1) {
        const colData = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
        existingData[header] = colData.map(row => row[0]).filter(v => v !== '' && v !== null && v !== undefined);
      } else {
        existingData[header] = [];
      }
    });
  }

  // 新しい列を特定（DROPDOWN_COLUMNSにあって既存ヘッダーにないもの）
  const newColumns = DROPDOWN_COLUMNS.filter(col => !existingHeaders.includes(col));

  // 不足している選択肢を特定
  const missingOptions = {};
  DROPDOWN_COLUMNS.forEach(col => {
    const defaultOpts = DEFAULT_DROPDOWN_OPTIONS[col] || [];
    const existingOpts = existingData[col] || [];
    const missing = defaultOpts.filter(opt => !existingOpts.includes(opt));
    if (missing.length > 0) {
      missingOptions[col] = missing;
    }
  });

  // 変更がない場合
  if (newColumns.length === 0 && Object.keys(missingOptions).length === 0) {
    Logger.log('設定シートは最新です（変更なし）');
    return { added: 0, message: '変更はありませんでした。' };
  }

  // 新しい列を追加
  newColumns.forEach(newCol => {
    const newColIndex = lastCol + newColumns.indexOf(newCol) + 1;
    sheet.getRange(1, newColIndex).setValue(newCol);
    sheet.getRange(1, newColIndex).setFontWeight('bold');
    sheet.getRange(1, newColIndex).setBackground('#4a86e8');
    sheet.getRange(1, newColIndex).setFontColor('#ffffff');

    // デフォルト値を設定
    const opts = DEFAULT_DROPDOWN_OPTIONS[newCol] || [];
    if (opts.length > 0) {
      const optData = opts.map(o => [o]);
      sheet.getRange(2, newColIndex, opts.length, 1).setValues(optData);
    }

    existingData[newCol] = opts;
  });

  // 既存列に不足している選択肢を追加
  Object.keys(missingOptions).forEach(col => {
    if (newColumns.includes(col)) return; // 新規追加列はスキップ

    const colIndex = existingHeaders.indexOf(col) + 1;
    if (colIndex <= 0) return;

    const existingOpts = existingData[col] || [];
    const missing = missingOptions[col];

    // 既存データの最終行の次から追加
    const startRow = existingOpts.length + 2;
    const missingData = missing.map(o => [o]);
    sheet.getRange(startRow, colIndex, missing.length, 1).setValues(missingData);
  });

  // キャッシュをクリア
  clearDropdownCache();

  const addedCols = newColumns.length;
  const addedOpts = Object.values(missingOptions).reduce((sum, arr) => sum + arr.length, 0);

  Logger.log(`設定シートを更新しました: 新規列${addedCols}件, 新規選択肢${addedOpts}件`);
  return {
    addedColumns: addedCols,
    addedOptions: addedOpts,
    newColumns: newColumns,
    missingOptions: missingOptions
  };
}

/**
 * メニューから呼び出す用：設定シート差分更新
 */
function updateSettingsSheetFromMenu() {
  const ss = getSpreadsheet();
  const result = updateSettingsSheet(ss);

  // 入力規則も再設定
  setDataValidations(ss);

  const ui = SpreadsheetApp.getUi();
  if (result && (result.addedColumns > 0 || result.addedOptions > 0)) {
    let message = '設定シートを更新しました。\n\n';
    if (result.addedColumns > 0) {
      message += `新規列: ${result.newColumns.join(', ')}\n`;
    }
    if (result.addedOptions > 0) {
      message += `追加した選択肢:\n`;
      Object.keys(result.missingOptions).forEach(col => {
        message += `  ${col}: ${result.missingOptions[col].join(', ')}\n`;
      });
    }
    ui.alert('更新完了', message, ui.ButtonSet.OK);
  } else {
    ui.alert('確認', '設定シートは最新です。変更はありませんでした。', ui.ButtonSet.OK);
  }
}

/**
 * 入力規則（プルダウン）設定
 * リード管理シートは setupIntegratedLeadSheet() で設定するため、
 * ここでは担当者マスタのみ設定
 */
function setDataValidations(ss) {
  // 設定シートからプルダウン選択肢を取得
  const dropdownOptions = getDropdownOptions();

  // 担当者マスタの入力規則
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (staffSheet) {
    const headers = staffSheet.getRange(1, 1, 1, staffSheet.getLastColumn()).getValues()[0];

    setValidation(staffSheet, headers, '役割', dropdownOptions.役割);
    setValidation(staffSheet, headers, 'ステータス', dropdownOptions.ステータス);
  }

  Logger.log('入力規則を設定しました。');
}

/**
 * 単一列に入力規則を設定
 */
function setValidation(sheet, headers, columnName, optionsList) {
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return;
  
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(optionsList, true)
    .setAllowInvalid(false)
    .build();
  
  // 2行目から1000行目まで適用
  sheet.getRange(2, colIndex + 1, 999, 1).setDataValidation(rule);
}

/**
 * 次のリードIDを生成
 * @param {string} leadType - リード種別（'インバウンド' or 'アウトバウンド'）
 */
function generateNextLeadId(leadType) {
  const prefix = leadType === 'インバウンド' ? 'LDI-' : 'LDO-';
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  let maxId = 0;

  if (sheet && sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    ids.forEach(row => {
      const id = row[0];
      if (id && id.toString().startsWith(prefix)) {
        const num = parseInt(id.replace(prefix, ''), 10);
        if (num > maxId) maxId = num;
      }
    });
  }

  const nextNum = maxId + 1;
  return prefix + String(nextNum).padStart(5, '0');
}

// ========== 統合シート用関数 ==========

/**
 * 統合シートからリードを取得
 * @param {string} filter - フィルタ条件（'all', 'lead', 'deal', 'closed'）
 * @param {string} leadType - リード種別フィルタ（'all', 'インバウンド', 'アウトバウンド'）
 * @returns {Array} リードデータの配列
 */
function getIntegratedLeads(filter, leadType) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusIndex = headers.indexOf('進捗ステータス');
  const typeIndex = headers.indexOf('リード種別');

  const leads = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIndex];
    const type = row[typeIndex];

    // フィルタ適用
    let include = true;

    // ステータスフィルタ
    if (filter === 'lead' && !CONFIG.LEAD_STATUSES.includes(status)) {
      include = false;
    } else if (filter === 'deal' && !CONFIG.DEAL_STATUSES.includes(status)) {
      include = false;
    } else if (filter === 'closed' && !CONFIG.CLOSED_STATUSES.includes(status)) {
      include = false;
    }

    // リード種別フィルタ
    if (leadType && leadType !== 'all' && type !== leadType) {
      include = false;
    }

    if (include) {
      const lead = {};
      headers.forEach((header, index) => {
        lead[header] = row[index];
      });
      leads.push(lead);
    }
  }

  return leads;
}

/**
 * 統合シートにリードを追加
 * @param {Object} leadData - リードデータ
 * @param {string} leadType - リード種別（インバウンド/アウトバウンド）
 * @returns {string} 生成されたリードID
 */
function addIntegratedLead(leadData, leadType) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet) {
    throw new Error('リード管理シートが見つかりません');
  }

  // 重複チェック
  const duplicateCheck = checkDuplicateBeforeAdd(leadData);
  const duplicateFlag = duplicateCheck.duplicate;
  const duplicateSourceId = duplicateCheck.duplicate ? duplicateCheck.duplicateInfo.leadId : '';

  const leadId = generateNextLeadId(leadType);
  const now = new Date();

  // 60列構造に合わせて行データを作成（CLAUDE.md Section 2.2 準拠）
  const rowData = [
    // カテゴリ1: 基本情報（4列）
    leadId,                           // 1: リードID
    now,                              // 2: 登録日
    leadType,                         // 3: リード種別
    now,                              // 4: シート更新日
    // カテゴリ2: CS記入（15列）
    leadData['流入経路'] || '',       // 5: 流入経路
    leadData['顧客名'] || '',         // 6: 顧客名
    leadData['呼び方（英語）'] || '', // 7: 呼び方（英語）
    leadData['国'] || '',             // 8: 国
    leadData['メール'] || '',         // 9: メール
    leadData['電話番号'] || '',       // 10: 電話番号
    leadData['連絡手段'] || leadData['SNS/連絡手段'] || '',   // 11: 連絡手段
    leadData['メッセージURL'] || '',  // 12: メッセージURL
    leadData['初回接触日'] || '',     // 13: 初回接触日
    leadData['温度感'] || '',         // 14: 温度感
    leadData['想定規模'] || '',       // 15: 想定規模
    leadData['顧客タイプ'] || '',     // 16: 顧客タイプ
    leadData['返信速度'] || '',       // 17: 返信速度
    leadData['CSメモ'] || '',         // 18: CSメモ
    1,                                // 19: 問い合わせ回数
    // カテゴリ3: アサイン・担当（5列）
    '新規',                           // 20: 進捗ステータス
    leadData['担当者'] || '',         // 21: 担当者
    leadData['担当者ID'] || '',       // 22: 担当者ID
    '',                               // 23: アサイン日
    '',                               // 24: 最終対応者ID
    // カテゴリ4: 営業（商談中）（13列）
    '',                               // 25: 見込度（自動計算）
    '',                               // 26: 次回アクション
    '',                               // 27: 次回アクション日
    '',                               // 28: 商談メモ
    '',                               // 29: 相手の課題
    '',                               // 30: 取り扱いタイトル
    '',                               // 31: 販売形態
    '',                               // 32: 月間見込み金額
    '',                               // 33: 1回の発注金額
    '',                               // 34: 購入頻度
    '',                               // 35: 競合比較中
    '',                               // 36: 商談の手応え
    '',                               // 37: アラート確認日
    // カテゴリ5: 営業（レポート）（13列）
    '',                               // 38: 商談結果
    '',                               // 39: 対象外理由
    '',                               // 40: 失注理由
    '',                               // 41: 初回取引日
    '',                               // 42: 初回取引金額
    '',                               // 43: 累計取引金額
    '',                               // 44: Good Point
    '',                               // 45: More Point
    '',                               // 46: 反省と今後の抱負
    '',                               // 47: レポート提出日
    '',                               // 48: レポート確認者
    '',                               // 49: レポート確認日
    '',                               // 50: レポートコメント
    // カテゴリ6: アーカイブ（2列）
    '',                               // 51: アーカイブ日
    '',                               // 52: アーカイブ理由
    // カテゴリ7: Buddy・AI（1列）
    '',                               // 53: Buddyフィードバック
    // カテゴリ8: 会話ログ連携（3列）
    '',                               // 54: 会話要約
    '',                               // 55: 最終会話日時
    0,                                // 56: 会話数
    // カテゴリ9: 重複管理（4列）
    duplicateFlag,                    // 57: 重複フラグ
    duplicateSourceId,                // 58: 重複元リードID
    '',                               // 59: 重複確認日
    ''                                // 60: 重複確認者
  ];

  sheet.appendRow(rowData);

  // 重複があった場合は情報を返す
  return {
    leadId: leadId,
    duplicate: duplicateCheck.duplicate ? duplicateCheck.duplicateInfo : null
  };
}

/**
 * 統合シートのリードを更新
 * @param {string} leadId - リードID
 * @param {Object} updateData - 更新データ
 * @returns {boolean} 成功/失敗
 */
function updateIntegratedLead(leadId, updateData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    return false;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === leadId) {
      // 更新データを適用
      Object.keys(updateData).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex >= 0) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
        }
      });

      // シート更新日を更新
      const updateDateIndex = headers.indexOf('シート更新日');
      if (updateDateIndex >= 0) {
        sheet.getRange(i + 1, updateDateIndex + 1).setValue(new Date());
      }

      return true;
    }
  }

  return false;
}

/**
 * 統合シートでリードをアサイン（ステータス変更）
 * @param {string} leadId - リードID
 * @param {string} staffName - 担当者名
 * @param {string} staffId - 担当者ID
 * @returns {boolean} 成功/失敗
 */
function assignIntegratedLead(leadId, staffName, staffId) {
  return updateIntegratedLead(leadId, {
    '進捗ステータス': 'アサイン確定',
    '担当者': staffName,
    '担当者ID': staffId,
    'アサイン日': new Date()
  });
}

/**
 * 統合シートでリードをクローズ（ステータス変更）
 * @param {string} leadId - リードID
 * @param {string} status - クローズステータス（成約/失注/保留/対象外）
 * @returns {boolean} 成功/失敗
 */
function closeIntegratedLead(leadId, status) {
  if (!CONFIG.CLOSED_STATUSES.includes(status)) {
    return false;
  }

  return updateIntegratedLead(leadId, {
    '進捗ステータス': status,
    '商談結果': status  // 商談結果にも同じステータスを記録
  });
}

/**
 * シートを取得
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * ヘッダーのインデックスマップを取得
 */
function getHeaderIndexMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index;
  });
  return map;
}

// ============================================================
// 重複検知機能
// ============================================================

/**
 * リードの重複を検知（リード管理シートのアーカイブ済みリードを検索）
 * @param {string} email - メールアドレス
 * @param {string} messageUrl - メッセージURL
 * @param {string} customerName - 顧客名
 * @param {string} source - 流入経路
 * @returns {Object} 重複情報
 */
function checkDuplicateLead(email, messageUrl, customerName, source) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  // リード管理シートが存在しない場合は重複なし
  if (!sheet || sheet.getLastRow() < 2) {
    return { isDuplicate: false };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 列インデックスを取得
  const leadIdIdx = headers.indexOf('リードID');
  const emailIdx = headers.indexOf('メール');
  const urlIdx = headers.indexOf('メッセージURL');
  const nameIdx = headers.indexOf('顧客名');
  const sourceIdx = headers.indexOf('流入経路');
  const archiveDateIdx = headers.indexOf('アーカイブ日');
  const archiveReasonIdx = headers.indexOf('アーカイブ理由');
  const contactCountIdx = headers.indexOf('問い合わせ回数');
  const csMemoIdx = headers.indexOf('CSメモ');

  let match = null;
  let matchPriority = 0; // 優先度: 1=メール, 2=URL, 3=名前+経路

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // アーカイブ済みのリードのみ検索（アーカイブ日が設定されている）
    const archiveDate = archiveDateIdx >= 0 ? row[archiveDateIdx] : null;
    if (!archiveDate) continue;

    // 優先度1: メールアドレスで検索
    if (email && emailIdx >= 0) {
      const rowEmail = row[emailIdx];
      if (rowEmail && email.toLowerCase() === String(rowEmail).toLowerCase()) {
        if (matchPriority < 1) {
          match = row;
          matchPriority = 1;
        }
        // メール一致は最優先なのでbreak
        break;
      }
    }

    // 優先度2: メッセージURLで検索
    if (messageUrl && urlIdx >= 0 && matchPriority < 2) {
      const rowUrl = row[urlIdx];
      if (rowUrl && messageUrl === rowUrl) {
        match = row;
        matchPriority = 2;
      }
    }

    // 優先度3: 顧客名 + 流入経路で検索
    if (customerName && source && nameIdx >= 0 && sourceIdx >= 0 && matchPriority < 3) {
      const rowName = row[nameIdx];
      const rowSource = row[sourceIdx];
      if (rowName && rowSource && customerName === rowName && source === rowSource) {
        match = row;
        matchPriority = 3;
      }
    }
  }

  if (match) {
    // 一致があった場合
    const archiveDate = match[archiveDateIdx];
    let formattedDate = '-';
    if (archiveDate) {
      try {
        formattedDate = Utilities.formatDate(new Date(archiveDate), 'Asia/Tokyo', 'yyyy-MM-dd');
      } catch (e) {
        formattedDate = String(archiveDate);
      }
    }

    return {
      isDuplicate: true,
      previousLeadId: match[leadIdIdx] || '',
      lastContactDate: formattedDate,
      contactCount: match[contactCountIdx] || 1,
      dropReason: match[archiveReasonIdx] || '',
      csMemo: match[csMemoIdx] || '',
      matchType: matchPriority === 1 ? 'email' : (matchPriority === 2 ? 'url' : 'name_source')
    };
  }

  return { isDuplicate: false };
}
