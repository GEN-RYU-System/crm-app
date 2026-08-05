/**
 * 商談レポート機能のセットアップ
 * ⚠️ このファイルの関数は手動実行が必要です
 *
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. setupDealReportSheets() を選択して実行
 */

/**
 * 商談レポート関連のシートをすべてセットアップ
 * メニューから実行、または直接実行
 * ※会話ログは統合シート（会話ログ）を使用
 */
function setupDealReportSheets() {
  const ss = getSpreadsheet();

  // 1. 設定シートに列を追加
  addDealReportSettingsColumns(ss);

  // 2. 商談レポートシートを作成
  createDealReportSheet(ss);

  // 3. Buddy対話ログシートを作成
  createBuddyDialogLogSheet(ss);

  // ※会話ログは統合シートを使用（ConversationLogService.gsで作成）

  Logger.log('商談レポート関連シートのセットアップが完了しました');
  SpreadsheetApp.getActiveSpreadsheet().toast('商談レポート機能のセットアップが完了しました', '完了', 5);
}

/**
 * Task 1: 設定シートに商談レポート用の列を追加
 */
function addDealReportSettingsColumns(ss) {
  ss = ss || getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) {
    Logger.log('設定シートが見つかりません');
    return;
  }

  // 現在のヘッダーを取得
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // 追加する列と選択肢
  const newColumns = {
    '商談結果': ['成約', '失注', '追客', '見送り', '対象外'],
    '取り扱い商材': ['Pokemon', 'One Piece', 'Yu-Gi-Oh!', 'Dragon Ball', 'その他'],
    '販売先': ['実店舗', 'EC', 'ライブ配信', '卸売', '複合', 'その他'],
    '信頼重視/価格重視': ['信頼重視', '価格重視', '不明'],
    '購入頻度(月次)': ['週1以上', '週1', '月2-3回', '月1', '不定期', '不明'],
    '見込度': ['5', '4', '3', '2', '1']
  };

  let addedCount = 0;

  Object.keys(newColumns).forEach(colName => {
    // 既に存在する場合はスキップ
    if (headers.includes(colName)) {
      Logger.log(`列「${colName}」は既に存在します`);
      return;
    }

    const newColIndex = lastCol + addedCount + 1;
    const options = newColumns[colName];

    // ヘッダーを設定
    sheet.getRange(1, newColIndex).setValue(colName);
    sheet.getRange(1, newColIndex).setFontWeight('bold');
    sheet.getRange(1, newColIndex).setBackground('#4a86e8');
    sheet.getRange(1, newColIndex).setFontColor('#ffffff');

    // 選択肢を設定
    if (options.length > 0) {
      const optData = options.map(o => [o]);
      sheet.getRange(2, newColIndex, options.length, 1).setValues(optData);
    }

    addedCount++;
    Logger.log(`列「${colName}」を追加しました`);
  });

  // キャッシュをクリア
  if (addedCount > 0) {
    clearDropdownCache();
  }

  Logger.log(`設定シートに${addedCount}列を追加しました`);
}

/**
 * Task 2-1: 商談レポートシートを作成
 */
function createDealReportSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheetName = '商談レポート';

  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    Logger.log(`シート「${sheetName}」は既に存在します`);
    return sheet;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log(`シート「${sheetName}」は既に存在します`);
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'レポートID',      // RPT-00001形式
    '担当者ID',        // EMP-001形式
    '商談ID',          // DEAL-00001形式（リードID）
    '提出日',          // 日付
    '商談開始日',      // 日付
    '商談結果',        // プルダウン
    '顧客名',          // テキスト
    '顧客の国',        // プルダウン
    '取り扱い商材',    // テキスト（カンマ区切り）
    '販売先',          // テキスト（カンマ区切り）
    '信頼重視/価格重視', // プルダウン
    '1回の発注金額',   // 数値
    '購入頻度',        // プルダウン
    '月の発注量見込み', // テキスト
    '見込度',             // 数値(1-5)
    '商談の手応え',    // 数値(1-5)
    '良かった点',      // テキスト
    '成約ポイント',    // テキスト
    '改善点',          // テキスト
    'アクションプラン', // テキスト
    '次回アクション日', // 日付（旧：再アプローチ日を統合）
    '対象外理由',      // テキスト
    '見送り理由',      // テキスト
    '商談ログID',      // テキスト
    'Buddyフィードバック', // テキスト
    '作成日時'         // 日時
  ];

  // ヘッダーを設定
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 列幅を調整
  sheet.setColumnWidth(1, 120);  // レポートID
  sheet.setColumnWidth(7, 150);  // 顧客名
  sheet.setColumnWidth(17, 200); // 良かった点
  sheet.setColumnWidth(18, 200); // 成約ポイント
  sheet.setColumnWidth(19, 200); // 改善点
  sheet.setColumnWidth(20, 200); // アクションプラン
  sheet.setColumnWidth(26, 300); // Buddyフィードバック

  Logger.log(`シート「${sheetName}」を作成しました`);
  return sheet;
}

/**
 * Task 2-2: Buddy対話ログシートを作成
 */
function createBuddyDialogLogSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheetName = 'Buddy対話ログ';

  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    Logger.log(`シート「${sheetName}」は既に存在します`);
    return sheet;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log(`シート「${sheetName}」は既に存在します`);
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'ログID',          // BLOG-00001形式
    '担当者ID',        // EMP-001形式
    '日時',            // 日時
    'ユーザー入力',    // テキスト
    'Buddy応答',       // テキスト
    'コンテキスト',    // テキスト（商談ID等）
    '感情分析結果'     // JSON
  ];

  // ヘッダーを設定
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#9c27b0');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 列幅を調整
  sheet.setColumnWidth(4, 300); // ユーザー入力
  sheet.setColumnWidth(5, 400); // Buddy応答
  sheet.setColumnWidth(7, 300); // 感情分析結果

  Logger.log(`シート「${sheetName}」を作成しました`);
  return sheet;
}

/**
 * Task 2-3: 会話ログ（商談用）シートを作成
 */
function createConversationLogSheet(ss) {
  ss = ss || getSpreadsheet();
  const sheetName = '会話ログ（商談用）';

  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    Logger.log(`シート「${sheetName}」は既に存在します`);
    return sheet;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log(`シート「${sheetName}」は既に存在します`);
      return sheet;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'ログID',          // CLOG-00001形式
    '商談ID',          // DEAL-00001形式
    '担当者ID',        // EMP-001形式
    '顧客名',          // テキスト
    'ログ内容',        // テキスト（全文）
    '登録日時'         // 日時
  ];

  // ヘッダーを設定
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#ff9800');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 列幅を調整
  sheet.setColumnWidth(4, 150); // 顧客名
  sheet.setColumnWidth(5, 500); // ログ内容

  Logger.log(`シート「${sheetName}」を作成しました`);
  return sheet;
}

/**
 * メニューに追加（onOpenで呼び出し）
 */
function addDealReportSetupMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('商談レポート設定')
    .addItem('全シートをセットアップ', 'setupDealReportSheets')
    .addSeparator()
    .addItem('設定シートに列追加のみ', 'addDealReportSettingsColumns')
    .addItem('商談レポートシート作成のみ', 'createDealReportSheet')
    .addItem('Buddy対話ログシート作成のみ', 'createBuddyDialogLogSheet')
    .addToUi();
}
