/**
 * CRMリード管理シート セットアップ
 * 手動実行用関数群
 *
 * 実行順序:
 * 1. setupIntegratedLeadSheet() - リード管理シート作成
 * 2. addTestData() - テストデータ追加（オプション）
 */

/**
 * リード管理シートの60列ヘッダー定義
 * Config.gs の HEADERS.LEADS と同期必須
 * CLAUDE.md Section 2.2 準拠
 */
const LEAD_SHEET_HEADERS = [
  // カテゴリ1: 基本情報（4列）
  'リードID',           // 1: 自動（LDI-00001 or LDO-00001）
  '登録日',             // 2: 自動
  'リード種別',         // 3: インバウンド/アウトバウンド（自動）
  'シート更新日',       // 4: 自動
  // カテゴリ2: CS記入（15列）
  '流入経路',           // 5: プルダウン（設定シート参照）
  '顧客名',             // 6: テキスト
  '呼び方（英語）',     // 7: テキスト
  '国',                 // 8: プルダウン（設定シート参照）
  'メール',             // 9: テキスト
  '電話番号',           // 10: テキスト
  '連絡手段',           // 11: プルダウン（設定シート参照）
  'メッセージURL',      // 12: テキスト
  '初回接触日',         // 13: 日付
  '温度感',             // 14: プルダウン（設定シート参照）
  '想定規模',           // 15: プルダウン（設定シート参照）
  '顧客タイプ',         // 16: プルダウン（設定シート参照）
  '返信速度',           // 17: プルダウン（設定シート参照）
  'CSメモ',             // 18: テキスト
  '問い合わせ回数',     // 19: 自動（重複検知用）
  // カテゴリ3: アサイン・担当（5列）
  '進捗ステータス',     // 20: プルダウン（自動入力ルールあり）
  '担当者',             // 21: プルダウン（担当者マスタ参照）
  '担当者ID',           // 22: 自動
  'アサイン日',         // 23: 自動
  '最終対応者ID',       // 24: 自動
  // カテゴリ4: 営業（商談中）（13列）
  '見込度',             // 25: 自動計算（商談情報から算出）
  '次回アクション',     // 26: テキスト
  '次回アクション日',   // 27: プルダウン（旧：再アプローチ日を統合）
  '商談メモ',           // 28: テキスト
  '相手の課題',         // 29: テキスト
  '取り扱いタイトル',   // 30: 複数選択プルダウン
  '販売形態',           // 31: プルダウン（設定シート参照）
  '月間見込み金額',     // 32: 数値
  '1回の発注金額',      // 33: 数値
  '購入頻度',           // 34: プルダウン（設定シート参照）
  '競合比較中',         // 35: プルダウン（設定シート参照）
  '商談の手応え',       // 36: プルダウン（設定シート参照）
  'アラート確認日',     // 37: 自動
  // カテゴリ5: 営業（レポート）（13列）
  '商談結果',           // 38: プルダウン（設定シート参照）
  '対象外理由',         // 39: プルダウン（設定シート参照）
  '失注理由',           // 40: プルダウン（設定シート参照）
  '初回取引日',         // 41: 日付
  '初回取引金額',       // 42: 数値
  '累計取引金額',       // 43: 自動計算
  'Good Point',         // 44: テキスト（商談ごとの振り返り）
  'More Point',         // 45: テキスト（商談ごとの振り返り）
  '反省と今後の抱負',   // 46: テキスト（商談ごとの振り返り）
  'レポート提出日',     // 47: 自動
  'レポート確認者',     // 48: プルダウン
  'レポート確認日',     // 49: 自動
  'レポートコメント',   // 50: テキスト
  // カテゴリ6: アーカイブ（2列）
  'アーカイブ日',       // 51: 自動
  'アーカイブ理由',     // 52: プルダウン（設定シート参照）
  // カテゴリ7: Buddy・AI（1列）
  'Buddyフィードバック', // 53: AIからのFB
  // カテゴリ8: 会話ログ連携（3列）
  '会話要約',           // 54: 自動
  '最終会話日時',       // 55: 自動
  '会話数',             // 56: 自動
  // カテゴリ9: 重複管理（4列）
  '重複フラグ',         // 57: 自動
  '重複元リードID',     // 58: 自動
  '重複確認日',         // 59: 日付
  '重複確認者'          // 60: 自動
];

/**
 * プルダウン選択肢の定義（設定シートがない場合のフォールバック）
 * 基本的には設定シートを参照する
 */
const DROPDOWN_OPTIONS_SETUP = {
  'リード種別': ['インバウンド', 'アウトバウンド'],
  '進捗ステータス': ['新規', '対応中', '対象外', 'アサイン確定', '商談中', '見積もり提示', '成約', '失注', '追客', 'アーカイブ'],
  '温度感': ['高', '中', '低'],
  '想定規模': ['大口', '中規模', '小口', '不明'],
  '顧客タイプ': ['信頼重視', '価格重視', '不明'],
  '返信速度': ['24h以内', '48h以内', '3日以上', '未返信'],
  '連絡手段': ['Instagram DM', 'WhatsApp', 'Email', 'Discord', 'LINE', '電話', 'その他'],
  '次回アクション日': ['相手の返信後', '不明点を確認後', '本日中', '明日までに', '3日以内', '1週間以内'],
  '販売形態': ['実店舗', 'EC', 'ライブ配信', '複合', '不明'],
  '競合比較中': ['はい', 'いいえ', '不明'],
  '購入頻度': ['週1回以上', '月2-3回', '月1回', '不定期'],
  '商談結果': ['成約', '失注', '追客', '対象外'],
  '商談の手応え': ['◎ 非常に良い', '○ 良い', '△ 普通', '× 厳しい'],
  'アーカイブ理由': ['連絡不通', '対象外', '重複', 'その他'],
  '対象外理由': ['予算不足', 'ニーズ不一致', '地域対象外', 'その他'],
  '失注理由': ['競合負け', '価格不一致', 'タイミング合わず', '予算凍結', 'その他']
};

/**
 * 「リード管理」シートを新規作成（環境設定に従う）
 * 開発環境の場合は開発用スプレッドシートに作成
 * 手動実行: Apps Scriptエディタから実行
 */
function setupIntegratedLeadSheetForEnv() {
  // デバッグ: どの環境・スプレッドシートを使用するか確認
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();
  const devId = props.getProperty('DEV_SPREADSHEET_ID');

  Logger.log('=== setupIntegratedLeadSheetForEnv 開始 ===');
  Logger.log('ENVIRONMENT: ' + env);
  Logger.log('DEV_SPREADSHEET_ID: ' + devId);
  Logger.log('PRODUCTION_ID: ' + PRODUCTION_IDS.SPREADSHEET_ID);

  const ss = getSpreadsheet(); // Config.gsの環境設定に従う

  Logger.log('取得したスプレッドシート名: ' + ss.getName());
  Logger.log('取得したスプレッドシートID: ' + ss.getId());
  Logger.log('期待するID（開発）: ' + devId);
  Logger.log('一致確認: ' + (ss.getId() === devId ? '✅ 開発環境' : '❌ 本番環境'));

  if (ss.getId() !== devId && env === 'development') {
    Logger.log('*** 警告: 開発環境設定なのに本番スプレッドシートを取得しています ***');
  }

  setupIntegratedLeadSheetInternal(ss);
}

/**
 * 「リード管理」シートを新規作成
 *
 * 手動実行: Apps Scriptエディタから実行
 */
function setupIntegratedLeadSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupIntegratedLeadSheetInternal(ss);
}

/**
 * 内部実装: リード管理シートのセットアップ
 */
function setupIntegratedLeadSheetInternal(ss) {
  const sheetName = 'リード管理';

  // 既存シートがあれば削除確認
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'シート作成',
      `「${sheetName}」シートは既に存在します。\n削除して再作成しますか？`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      ss.toast('キャンセルしました', 'セットアップ', 3);
      return;
    }

    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      ss.deleteSheet(sheet);
    } finally {
      lock.releaseLock();
    }
  }

  // 新規シート作成 - LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  // ヘッダー設定
  const headerRange = sheet.getRange(1, 1, 1, LEAD_SHEET_HEADERS.length);
  headerRange.setValues([LEAD_SHEET_HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  // 列幅の設定
  setColumnWidthsForSetup(sheet);

  // 入力規則（プルダウン）の設定
  setDataValidationsForSetup(sheet, ss);

  // ヘッダー行を固定
  sheet.setFrozenRows(1);

  // シートを先頭に移動
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  ss.toast('「リード管理」シートを作成しました', 'セットアップ完了', 5);
  Logger.log('リード管理シートのセットアップが完了しました');
  Logger.log('ヘッダー数: ' + LEAD_SHEET_HEADERS.length + '列');
}

/**
 * 列幅を設定（60列対応）
 * CLAUDE.md Section 2.2 準拠
 */
function setColumnWidthsForSetup(sheet) {
  const widths = {
    // カテゴリ1: 基本情報（4列）
    1: 100,   // リードID
    2: 100,   // 登録日
    3: 100,   // リード種別
    4: 100,   // シート更新日
    // カテゴリ2: CS記入（15列）
    5: 120,   // 流入経路
    6: 120,   // 顧客名
    7: 120,   // 呼び方（英語）
    8: 80,    // 国
    9: 180,   // メール
    10: 120,  // 電話番号
    11: 120,  // 連絡手段
    12: 200,  // メッセージURL
    13: 100,  // 初回接触日
    14: 60,   // 温度感
    15: 80,   // 想定規模
    16: 80,   // 顧客タイプ
    17: 80,   // 返信速度
    18: 200,  // CSメモ
    19: 80,   // 問い合わせ回数
    // カテゴリ3: アサイン・担当（5列）
    20: 100,  // 進捗ステータス
    21: 100,  // 担当者
    22: 80,   // 担当者ID
    23: 100,  // アサイン日
    24: 100,  // 最終対応者ID
    // カテゴリ4: 営業（商談中）（13列）
    25: 60,   // 見込度
    26: 150,  // 次回アクション
    27: 100,  // 次回アクション日
    28: 200,  // 商談メモ
    29: 150,  // 相手の課題
    30: 100,  // 取り扱いタイトル
    31: 80,   // 販売形態
    32: 100,  // 月間見込み金額
    33: 100,  // 1回の発注金額
    34: 80,   // 購入頻度
    35: 80,   // 競合比較中
    36: 100,  // 商談の手応え
    37: 100,  // アラート確認日
    // カテゴリ5: 営業（レポート）（13列）
    38: 80,   // 商談結果
    39: 100,  // 対象外理由
    40: 100,  // 失注理由
    41: 100,  // 初回取引日
    42: 100,  // 初回取引金額
    43: 100,  // 累計取引金額
    44: 200,  // Good Point
    45: 200,  // More Point
    46: 200,  // 反省と今後の抱負
    47: 100,  // レポート提出日
    48: 100,  // レポート確認者
    49: 100,  // レポート確認日
    50: 200,  // レポートコメント
    // カテゴリ6: アーカイブ（2列）
    51: 100,  // アーカイブ日
    52: 100,  // アーカイブ理由
    // カテゴリ7: Buddy・AI（1列）
    53: 300,  // Buddyフィードバック
    // カテゴリ8: 会話ログ連携（3列）
    54: 200,  // 会話要約
    55: 100,  // 最終会話日時
    56: 80,   // 会話数
    // カテゴリ9: 重複管理（4列）
    57: 80,   // 重複フラグ
    58: 100,  // 重複元リードID
    59: 100,  // 重複確認日
    60: 100   // 重複確認者
  };

  Object.keys(widths).forEach(col => {
    sheet.setColumnWidth(parseInt(col), widths[col]);
  });
}

/**
 * 入力規則（プルダウン）を設定
 */
function setDataValidationsForSetup(sheet, ss) {
  const maxRows = 1000; // 入力規則を設定する行数

  // 固定プルダウンの設定
  Object.keys(DROPDOWN_OPTIONS_SETUP).forEach(columnName => {
    const colIndex = LEAD_SHEET_HEADERS.indexOf(columnName) + 1;
    if (colIndex > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(DROPDOWN_OPTIONS_SETUP[columnName], true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(2, colIndex, maxRows, 1).setDataValidation(rule);
    }
  });

  // 設定シートを参照するプルダウン（流入経路、国）
  const settingsSheet = ss.getSheetByName('設定');
  if (settingsSheet) {
    // 流入経路（IN）を流入経路列に適用
    setDropdownFromSettingsSheetForSetup(sheet, settingsSheet, '流入経路', '流入経路（IN）', maxRows);

    // 国
    setDropdownFromSettingsSheetForSetup(sheet, settingsSheet, '国', '国', maxRows);
  }

  // 担当者マスタを参照するプルダウン
  const staffSheet = ss.getSheetByName('担当者マスタ');
  if (staffSheet && staffSheet.getLastRow() > 1) {
    const staffColIndex = LEAD_SHEET_HEADERS.indexOf('担当者') + 1;
    if (staffColIndex > 0) {
      // 新形式（苗字/名前分離）と旧形式（氏名統合）の両方に対応
      const staffData = staffSheet.getDataRange().getValues();
      const staffHeaders = staffData[0];
      const familyNameColIndex = staffHeaders.indexOf('苗字（日本語）');
      const givenNameColIndex = staffHeaders.indexOf('名前（日本語）');
      const oldNameColIndex = staffHeaders.indexOf('氏名（日本語）');
      const statusColIndex = staffHeaders.indexOf('ステータス');

      const staffNames = [];
      for (let i = 1; i < staffData.length; i++) {
        const status = staffData[i][statusColIndex];
        if (status !== '有効') continue;

        // 新形式でフルネームを構築
        let fullName = '';
        if (familyNameColIndex >= 0 && givenNameColIndex >= 0) {
          const family = staffData[i][familyNameColIndex] || '';
          const given = staffData[i][givenNameColIndex] || '';
          if (family || given) {
            fullName = (family + ' ' + given).trim();
          }
        }
        // 新形式で名前が取得できない場合は旧形式を使用
        if (!fullName && oldNameColIndex >= 0) {
          fullName = staffData[i][oldNameColIndex] || '';
        }

        if (fullName) {
          staffNames.push(fullName);
        }
      }

      if (staffNames.length > 0) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(staffNames, true)
          .setAllowInvalid(true) // 担当者は手入力も許可
          .build();
        sheet.getRange(2, staffColIndex, maxRows, 1).setDataValidation(rule);
      }
    }
  }

  Logger.log('入力規則の設定が完了しました');
}

/**
 * 設定シートからプルダウン選択肢を取得して設定
 */
function setDropdownFromSettingsSheetForSetup(targetSheet, settingsSheet, targetColumnName, settingsColumnName, maxRows) {
  const colIndex = LEAD_SHEET_HEADERS.indexOf(targetColumnName) + 1;
  if (colIndex <= 0) return;

  const settingsData = settingsSheet.getDataRange().getValues();
  const settingsHeaders = settingsData[0];
  const settingsColIndex = settingsHeaders.indexOf(settingsColumnName);

  if (settingsColIndex >= 0) {
    const values = [];
    for (let i = 1; i < settingsData.length; i++) {
      const value = settingsData[i][settingsColIndex];
      if (value && value !== '') {
        values.push(String(value));
      }
    }

    if (values.length > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(values, true)
        .setAllowInvalid(true)
        .build();
      targetSheet.getRange(2, colIndex, maxRows, 1).setDataValidation(rule);
    }
  }
}

/**
 * 次のリードIDを生成
 */
function generateNextLeadIdForSetup(leadType) {
  const prefix = leadType === 'インバウンド' ? 'LDI-' : 'LDO-';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('リード管理');

  if (!sheet || sheet.getLastRow() < 2) {
    return prefix + '00001';
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith(prefix)) {
      const num = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return prefix + String(maxNum + 1).padStart(5, '0');
}

/**
 * テストデータを追加（開発用）
 */
function addTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('リード管理');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('「リード管理」シートが存在しません。先にsetupIntegratedLeadSheet()を実行してください。');
    return;
  }

  const today = new Date();

  // テストデータ（60列）
  const testData = [
    // インバウンドリード（新規）
    createTestRow('インバウンド', '新規', 'Webサイト', 'John Smith', 'John', 'USA', 'john@abc.com', '+1-555-1234', 'Discord', '', '高', '大口', '信頼重視', '24h以内'),
    // インバウンドリード（対応中）
    createTestRow('インバウンド', '対応中', 'SNS', 'Jane Doe', 'Jane', 'Canada', 'jane@xyz.com', '', 'LINE', '', '中', '中規模', '価格重視', '48h以内'),
    // アウトバウンドリード（アサイン確定）
    createTestRow('アウトバウンド', 'アサイン確定', '展示会', 'Bob Wilson', 'Bob', 'UK', 'bob@def.com', '+44-20-1234', 'Email', '', '高', '大口', '信頼重視', '24h以内'),
    // 商談中
    createTestRow('インバウンド', '商談中', '紹介', 'Alice Chen', 'Alice', 'Singapore', 'alice@ghi.com', '', 'WhatsApp', '', '高', '大口', '信頼重視', '24h以内'),
  ];

  testData.forEach(row => {
    sheet.appendRow(row);
  });

  ss.toast(`${testData.length}件のテストデータを追加しました`, 'テストデータ', 3);
  Logger.log(testData.length + '件のテストデータを追加しました');
}

/**
 * テスト行データを作成（60列）
 * CLAUDE.md Section 2.2 準拠
 */
function createTestRow(leadType, status, source, customerName, englishName, country, email, phone, contactMethod, url, temp, scale, customerType, responseSpeed) {
  const today = new Date();
  const leadId = generateNextLeadIdForSetup(leadType);
  const isAssigned = status === 'アサイン確定' || status === '商談中' || status === '見積もり提示';

  // 60列分のデータを作成
  return [
    // カテゴリ1: 基本情報（4列）
    leadId,           // 1: リードID
    today,            // 2: 登録日
    leadType,         // 3: リード種別
    today,            // 4: シート更新日
    // カテゴリ2: CS記入（15列）
    source,           // 5: 流入経路
    customerName,     // 6: 顧客名
    englishName,      // 7: 呼び方（英語）
    country,          // 8: 国
    email,            // 9: メール
    phone,            // 10: 電話番号
    contactMethod,    // 11: 連絡手段
    url,              // 12: メッセージURL
    today,            // 13: 初回接触日
    temp,             // 14: 温度感
    scale,            // 15: 想定規模
    customerType,     // 16: 顧客タイプ
    responseSpeed,    // 17: 返信速度
    '',               // 18: CSメモ
    1,                // 19: 問い合わせ回数
    // カテゴリ3: アサイン・担当（5列）
    status,           // 20: 進捗ステータス
    '',               // 21: 担当者
    '',               // 22: 担当者ID
    isAssigned ? today : '',  // 23: アサイン日
    '',               // 24: 最終対応者ID
    // カテゴリ4: 営業（商談中）（13列）
    '',               // 25: 見込度（自動計算）
    '',               // 26: 次回アクション
    '',               // 27: 次回アクション日
    '',               // 28: 商談メモ
    '',               // 29: 相手の課題
    '',               // 30: 取り扱いタイトル
    '',               // 31: 販売形態
    '',               // 32: 月間見込み金額
    '',               // 33: 1回の発注金額
    '',               // 34: 購入頻度
    '',               // 35: 競合比較中
    '',               // 36: 商談の手応え
    '',               // 37: アラート確認日
    // カテゴリ5: 営業（レポート）（13列）
    '',               // 38: 商談結果
    '',               // 39: 対象外理由
    '',               // 40: 失注理由
    '',               // 41: 初回取引日
    '',               // 42: 初回取引金額
    '',               // 43: 累計取引金額
    '',               // 44: Good Point
    '',               // 45: More Point
    '',               // 46: 反省と今後の抱負
    '',               // 47: レポート提出日
    '',               // 48: レポート確認者
    '',               // 49: レポート確認日
    '',               // 50: レポートコメント
    // カテゴリ6: アーカイブ（2列）
    '',               // 51: アーカイブ日
    '',               // 52: アーカイブ理由
    // カテゴリ7: Buddy・AI（1列）
    '',               // 53: Buddyフィードバック
    // カテゴリ8: 会話ログ連携（3列）
    '',               // 54: 会話要約
    '',               // 55: 最終会話日時
    0,                // 56: 会話数
    // カテゴリ9: 重複管理（4列）
    false,            // 57: 重複フラグ
    '',               // 58: 重複元リードID
    '',               // 59: 重複確認日
    ''                // 60: 重複確認者
  ];
}

/**
 * シート情報を表示（デバッグ用）
 */
function showSheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('リード管理');

  if (!sheet) {
    Logger.log('リード管理シートが存在しません');
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log('=== リード管理シート情報 ===');
  Logger.log('最終行: ' + lastRow);
  Logger.log('最終列: ' + lastCol);
  Logger.log('ヘッダー数: ' + LEAD_SHEET_HEADERS.length);

  if (lastRow >= 1) {
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('実際のヘッダー: ' + headers.join(', '));
    Logger.log('データ行数: ' + (lastRow - 1));
  }
}

// ============================================================
// 旧シート削除・新シート作成
// ============================================================

/**
 * 旧シートを削除（手動実行用）
 * 削除対象: リード一覧（IN）、リード一覧（OUT）、商談管理、アーカイブ、ダッシュボード、通知設定
 */
function deleteOldSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const oldSheets = [
    'リード一覧（IN）',
    'リード一覧（OUT）',
    '商談管理',
    'アーカイブ',
    'ダッシュボード',
    '通知設定'
  ];

  // 存在するシートを確認
  const existingSheets = oldSheets.filter(name => ss.getSheetByName(name) !== null);

  if (existingSheets.length === 0) {
    ui.alert('削除対象のシートはありません');
    Logger.log('削除対象のシートはありません');
    return;
  }

  // 確認ダイアログ
  const response = ui.alert(
    '旧シート削除',
    `以下の${existingSheets.length}シートを削除します:\n\n${existingSheets.join('\n')}\n\nこの操作は取り消せません。続行しますか？`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('キャンセルしました');
    return;
  }

  // 削除実行
  let deletedCount = 0;
  existingSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      try {
        ss.deleteSheet(sheet);
        Logger.log('削除: ' + name);
        deletedCount++;
      } catch (e) {
        Logger.log('削除失敗: ' + name + ' - ' + e.message);
      }
    }
  });

  ui.alert(`${deletedCount}シートを削除しました`);
  Logger.log('旧シート削除完了: ' + deletedCount + 'シート');
}

/**
 * 新シートを作成（手動実行用）
 * 作成: 月次レポート、シフト、週次レポート
 */
function createNewSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 月次レポートシート
  createMonthlyReportSheet(ss);

  // 週次レポートシート
  createWeeklyReportSheet(ss);

  // シフトシート
  createShiftSheet(ss);

  ss.toast('新シートを作成しました', 'セットアップ完了', 5);
  Logger.log('新シート作成完了');
}

/**
 * 月次レポートシートを作成
 */
function createMonthlyReportSheet(ss) {
  const sheetName = '月次レポート';
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'レポートID',
    '担当者ID',
    '担当者名',
    '対象月',
    '今月の成果',
    '良かった点',
    '改善点',
    '来月の目標',
    'Buddyフィードバック',
    '提出日時'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // レポートID
  sheet.setColumnWidth(2, 80);   // 担当者ID
  sheet.setColumnWidth(3, 100);  // 担当者名
  sheet.setColumnWidth(4, 80);   // 対象月
  sheet.setColumnWidth(5, 300);  // 今月の成果
  sheet.setColumnWidth(6, 300);  // 良かった点
  sheet.setColumnWidth(7, 300);  // 改善点
  sheet.setColumnWidth(8, 300);  // 来月の目標
  sheet.setColumnWidth(9, 400);  // Buddyフィードバック
  sheet.setColumnWidth(10, 150); // 提出日時

  Logger.log(sheetName + ' を作成しました');
}

/**
 * 週次レポートシートを作成
 */
function createWeeklyReportSheet(ss) {
  const sheetName = '週次レポート';
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log(sheetName + ' は既に存在します');
      return;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'レポートID',
    '担当者ID',
    '担当者名',
    '対象週',
    '今週の成果',
    '良かった点',
    '改善点',
    '来週の目標',
    '困っていること',
    'Buddyへの質問',
    'Buddyフィードバック',
    '提出日時'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#fbbc04');
  headerRange.setFontColor('#000000');
  sheet.setFrozenRows(1);

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // レポートID
  sheet.setColumnWidth(2, 80);   // 担当者ID
  sheet.setColumnWidth(3, 100);  // 担当者名
  sheet.setColumnWidth(4, 100);  // 対象週
  sheet.setColumnWidth(5, 300);  // 今週の成果
  sheet.setColumnWidth(6, 300);  // 良かった点
  sheet.setColumnWidth(7, 300);  // 改善点
  sheet.setColumnWidth(8, 300);  // 来週の目標
  sheet.setColumnWidth(9, 300);  // 困っていること
  sheet.setColumnWidth(10, 300); // Buddyへの質問
  sheet.setColumnWidth(11, 400); // Buddyフィードバック
  sheet.setColumnWidth(12, 150); // 提出日時

  Logger.log(sheetName + ' を作成しました');
}

/**
 * シフトシートを作成
 */
function createShiftSheet(ss) {
  const sheetName = 'シフト';
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    Logger.log(sheetName + ' は既に存在します');
    return;
  }

  // LockService使用（TROUBLE-018対応）
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      Logger.log(sheetName + ' は既に存在します');
      return;
    }
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headers = [
    'シフトID',
    '担当者ID',
    '担当者名',
    '対象週',
    '曜日',
    '時間帯1_開始',
    '時間帯1_終了',
    '時間帯2_開始',
    '時間帯2_終了',
    '時間帯3_開始',
    '時間帯3_終了',
    '提出日時',
    '更新日時'
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#ea4335');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // 列幅設定
  sheet.setColumnWidth(1, 100);  // シフトID
  sheet.setColumnWidth(2, 80);   // 担当者ID
  sheet.setColumnWidth(3, 100);  // 担当者名
  sheet.setColumnWidth(4, 100);  // 対象週
  sheet.setColumnWidth(5, 60);   // 曜日
  sheet.setColumnWidth(6, 100);  // 時間帯1_開始
  sheet.setColumnWidth(7, 100);  // 時間帯1_終了
  sheet.setColumnWidth(8, 100);  // 時間帯2_開始
  sheet.setColumnWidth(9, 100);  // 時間帯2_終了
  sheet.setColumnWidth(10, 100); // 時間帯3_開始
  sheet.setColumnWidth(11, 100); // 時間帯3_終了
  sheet.setColumnWidth(12, 150); // 提出日時
  sheet.setColumnWidth(13, 150); // 更新日時

  // 曜日プルダウン
  const dayRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['月', '火', '水', '木', '金', '土', '日'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, 1000, 1).setDataValidation(dayRule);

  // 時間プルダウン生成（7:00〜22:00、30分刻み）
  const timeOptions = [];
  for (let h = 7; h <= 22; h++) {
    timeOptions.push(h + ':00');
    if (h < 22) {
      timeOptions.push(h + ':30');
    }
  }

  const timeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(timeOptions, true)
    .setAllowInvalid(true)
    .build();

  // 時間帯列にプルダウン適用
  for (let col = 6; col <= 11; col++) {
    sheet.getRange(2, col, 1000, 1).setDataValidation(timeRule);
  }

  Logger.log(sheetName + ' を作成しました');
}

/**
 * 担当者マスタの列を分離（手動実行用）
 * 氏名（日本語）→ 苗字（日本語）、名前（日本語）
 * 氏名（英語）→ 苗字（英語）、名前（英語）
 */
function updateStaffMasterColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName('担当者マスタ');

  if (!sheet) {
    ui.alert('担当者マスタシートが存在しません');
    return;
  }

  const response = ui.alert(
    '担当者マスタ更新',
    '担当者マスタの列構成を更新します:\n\n' +
    '・氏名（日本語）→ 苗字（日本語）、名前（日本語）\n' +
    '・氏名（英語）→ 苗字（英語）、名前（英語）\n\n' +
    '既存データは手動で移行が必要です。続行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('キャンセルしました');
    return;
  }

  // 新しいヘッダー
  const newHeaders = [
    '担当者ID',
    '苗字（日本語）',
    '名前（日本語）',
    '苗字（英語）',
    '名前（英語）',
    'メール',
    'Discord ID',
    '役割',
    'ステータス',
    '元候補者ID'
  ];

  // 現在のデータを取得
  const currentData = sheet.getDataRange().getValues();
  const currentHeaders = currentData[0];

  // 列を追加
  const currentCols = sheet.getLastColumn();
  const newCols = newHeaders.length;

  if (currentCols < newCols) {
    sheet.insertColumnsAfter(currentCols, newCols - currentCols);
  }

  // 新しいヘッダーを設定
  const headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
  headerRange.setValues([newHeaders]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');

  // 列幅設定
  sheet.setColumnWidth(1, 80);   // 担当者ID
  sheet.setColumnWidth(2, 100);  // 苗字（日本語）
  sheet.setColumnWidth(3, 100);  // 名前（日本語）
  sheet.setColumnWidth(4, 100);  // 苗字（英語）
  sheet.setColumnWidth(5, 100);  // 名前（英語）
  sheet.setColumnWidth(6, 180);  // メール
  sheet.setColumnWidth(7, 120);  // Discord ID
  sheet.setColumnWidth(8, 100);  // 役割
  sheet.setColumnWidth(9, 80);   // ステータス
  sheet.setColumnWidth(10, 100); // 元候補者ID

  ui.alert(
    '更新完了',
    '担当者マスタのヘッダーを更新しました。\n\n' +
    '既存データがある場合は、手動で以下の移行を行ってください:\n' +
    '・「氏名（日本語）」を「苗字（日本語）」「名前（日本語）」に分割\n' +
    '・「氏名（英語）」を「苗字（英語）」「名前（英語）」に分割',
    ui.ButtonSet.OK
  );

  Logger.log('担当者マスタの列構成を更新しました');
}

/**
 * 担当者マスタのデータを移行（手動実行用）
 * 旧形式（氏名統合）→ 新形式（苗字/名前分離）
 */
function migrateStaffMasterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName('担当者マスタ');

  if (!sheet) {
    ui.alert('担当者マスタシートが存在しません');
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    ui.alert('移行対象のデータがありません');
    return;
  }

  const headers = data[0];

  // 旧形式の列を探す
  const oldNameJaIdx = headers.indexOf('氏名（日本語）');
  const oldNameEnIdx = headers.indexOf('氏名（英語）');

  // 新形式の列を探す
  const familyNameJaIdx = headers.indexOf('苗字（日本語）');
  const givenNameJaIdx = headers.indexOf('名前（日本語）');
  const familyNameEnIdx = headers.indexOf('苗字（英語）');
  const givenNameEnIdx = headers.indexOf('名前（英語）');

  // 新形式の列が存在しない場合はヘッダー更新を促す
  if (familyNameJaIdx === -1 || givenNameJaIdx === -1) {
    ui.alert(
      'ヘッダー未更新',
      '先に updateStaffMasterColumns() を実行してヘッダーを更新してください。',
      ui.ButtonSet.OK
    );
    return;
  }

  const response = ui.alert(
    'データ移行確認',
    '担当者マスタのデータを移行します:\n\n' +
    '・日本語名: スペースで分割、なければ全体を「名前」列へ\n' +
    '・英語名: スペースで分割（First Last形式）\n\n' +
    '移行後に手動での修正が必要な場合があります。続行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('キャンセルしました');
    return;
  }

  let migratedCount = 0;
  const migrationLog = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const staffId = row[headers.indexOf('担当者ID')];

    if (!staffId) continue; // 空行スキップ

    let needsUpdate = false;

    // 日本語名の移行
    // 旧形式のデータがあり、新形式が空の場合
    const oldNameJa = oldNameJaIdx >= 0 ? String(row[oldNameJaIdx] || '') : '';
    const newFamilyJa = String(row[familyNameJaIdx] || '');
    const newGivenJa = String(row[givenNameJaIdx] || '');

    if (oldNameJa && !newFamilyJa && !newGivenJa) {
      // 旧データを分割して移行
      const splitResult = splitJapaneseName(oldNameJa);
      sheet.getRange(i + 1, familyNameJaIdx + 1).setValue(splitResult.family);
      sheet.getRange(i + 1, givenNameJaIdx + 1).setValue(splitResult.given);
      needsUpdate = true;
      migrationLog.push(`${staffId}: 日本語名「${oldNameJa}」→「${splitResult.family}」「${splitResult.given}」`);
    }

    // 英語名の移行
    const oldNameEn = oldNameEnIdx >= 0 ? String(row[oldNameEnIdx] || '') : '';
    const newFamilyEn = String(row[familyNameEnIdx] || '');
    const newGivenEn = String(row[givenNameEnIdx] || '');

    if (oldNameEn && !newFamilyEn && !newGivenEn) {
      const splitResult = splitEnglishName(oldNameEn);
      sheet.getRange(i + 1, familyNameEnIdx + 1).setValue(splitResult.family);
      sheet.getRange(i + 1, givenNameEnIdx + 1).setValue(splitResult.given);
      needsUpdate = true;
      migrationLog.push(`${staffId}: 英語名「${oldNameEn}」→「${splitResult.family}」「${splitResult.given}」`);
    }

    if (needsUpdate) {
      migratedCount++;
    }
  }

  // 結果表示
  let message = `移行完了: ${migratedCount}件のデータを移行しました。\n\n`;

  if (migrationLog.length > 0) {
    message += '移行ログ:\n';
    migrationLog.slice(0, 10).forEach(log => {
      message += '・' + log + '\n';
    });
    if (migrationLog.length > 10) {
      message += `（他 ${migrationLog.length - 10} 件）\n`;
    }
  }

  message += '\n※ 分割結果を確認し、必要に応じて手動で修正してください。';

  ui.alert('移行完了', message, ui.ButtonSet.OK);
  Logger.log('データ移行完了: ' + migratedCount + '件');
  migrationLog.forEach(log => Logger.log(log));
}

/**
 * 日本語名を分割
 * @param {string} fullName - フルネーム
 * @returns {Object} {family, given}
 */
function splitJapaneseName(fullName) {
  fullName = String(fullName).trim();

  // スペースがある場合はスペースで分割
  if (fullName.includes(' ') || fullName.includes('　')) {
    const parts = fullName.split(/[\s　]+/);
    return {
      family: parts[0] || '',
      given: parts.slice(1).join(' ') || ''
    };
  }

  // スペースがない場合は全体を「名前」列へ（手動修正を促す）
  return {
    family: '',
    given: fullName
  };
}

/**
 * 英語名を分割
 * @param {string} fullName - フルネーム（First Last形式）
 * @returns {Object} {family, given}
 */
function splitEnglishName(fullName) {
  fullName = String(fullName).trim();

  if (fullName.includes(' ')) {
    const parts = fullName.split(/\s+/);
    // First Last形式: 最初が名(given)、最後が姓(family)
    return {
      given: parts[0] || '',
      family: parts.slice(1).join(' ') || ''
    };
  }

  // スペースがない場合は全体を「名前」列へ
  return {
    family: '',
    given: fullName
  };
}

/**
 * 担当者マスタにプルダウンを再設定（手動実行用）
 */
function setupStaffMasterDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('担当者マスタ');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('担当者マスタシートが存在しません');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = Math.max(sheet.getLastRow(), 100);

  // 役割プルダウン
  const roleIdx = headers.indexOf('役割');
  if (roleIdx >= 0) {
    const roleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['オーナー', 'システム管理者', 'リーダー', '営業', 'CS'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, roleIdx + 1, lastRow - 1, 1).setDataValidation(roleRule);
  }

  // ステータスプルダウン
  const statusIdx = headers.indexOf('ステータス');
  if (statusIdx >= 0) {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['有効', '無効'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, statusIdx + 1, lastRow - 1, 1).setDataValidation(statusRule);
  }

  Logger.log('担当者マスタのプルダウンを設定しました');
  SpreadsheetApp.getUi().alert('担当者マスタのプルダウンを設定しました');
}

// ============================================================
// 旧機能（削除済み）
// ============================================================
// 離脱リードシートは廃止され、リード管理シートに統合されました
// アーカイブは進捗ステータスとアーカイブ日・アーカイブ理由列で管理します

// ============================================================
// 不要シート削除・テンプレート統合
// ============================================================

/**
 * 不要シートを削除（手動実行用）
 * 削除対象: 顧客マスタ、営業担当者マスタ、メッセージテンプレート（統合後）
 */
function deleteObsoleteSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const obsoleteSheets = [
    '顧客マスタ',
    '営業担当者マスタ',
    'メッセージテンプレート'
  ];

  // 存在するシートを確認
  const existingSheets = obsoleteSheets.filter(name => ss.getSheetByName(name) !== null);

  if (existingSheets.length === 0) {
    ui.alert('削除対象のシートはありません');
    Logger.log('削除対象のシートはありません');
    return;
  }

  // 確認ダイアログ
  const response = ui.alert(
    '不要シート削除',
    `以下の${existingSheets.length}シートを削除します:\n\n${existingSheets.join('\n')}\n\nこの操作は取り消せません。続行しますか？`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('キャンセルしました');
    return;
  }

  // 削除実行
  let deletedCount = 0;
  existingSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      try {
        Logger.log('削除対象: ' + name);
        ss.deleteSheet(sheet);
        Logger.log('削除完了: ' + name);
        deletedCount++;
      } catch (e) {
        Logger.log('削除失敗: ' + name + ' - ' + e.message);
      }
    }
  });

  ui.alert(`${deletedCount}シートを削除しました`);
  Logger.log('不要シート削除完了: ' + deletedCount + 'シート');
}

/**
 * メッセージテンプレートをテンプレートシートに統合（手動実行用）
 */
function mergeMessageTemplates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // ソースシート（メッセージテンプレート）
  const sourceSheet = ss.getSheetByName('メッセージテンプレート');
  if (!sourceSheet) {
    ui.alert('メッセージテンプレートシートが見つかりません');
    Logger.log('メッセージテンプレートシートが見つかりません');
    return;
  }

  // ターゲットシート（テンプレート）
  let targetSheet = ss.getSheetByName(CONFIG.SHEETS.TEMPLATES);
  if (!targetSheet) {
    // LockService使用（TROUBLE-018対応）
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      targetSheet = ss.getSheetByName(CONFIG.SHEETS.TEMPLATES);
      if (!targetSheet) {
        // テンプレートシートがなければ作成
        targetSheet = ss.insertSheet(CONFIG.SHEETS.TEMPLATES);
        const headers = HEADERS.TEMPLATES || ['テンプレートID', 'テンプレート名', 'カテゴリ', '本文', '使用場面', '更新日'];
        targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        targetSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        targetSheet.getRange(1, 1, 1, headers.length).setBackground('#4a86e8');
        targetSheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
        targetSheet.setFrozenRows(1);
      }
    } finally {
      lock.releaseLock();
    }
  }

  // ソースデータを取得
  const sourceData = sourceSheet.getDataRange().getValues();
  if (sourceData.length < 2) {
    ui.alert('メッセージテンプレートにデータがありません');
    return;
  }

  const sourceHeaders = sourceData[0];

  // ターゲットデータを取得（重複チェック用）
  const targetData = targetSheet.getDataRange().getValues();
  const targetHeaders = targetData[0];
  const existingNames = new Set();

  const templateNameIdx = targetHeaders.indexOf('テンプレート名');
  if (templateNameIdx >= 0 && targetData.length > 1) {
    for (let i = 1; i < targetData.length; i++) {
      const name = targetData[i][templateNameIdx];
      if (name) existingNames.add(name);
    }
  }

  // コピー実行
  let copiedCount = 0;
  let skippedCount = 0;
  const now = new Date();

  for (let i = 1; i < sourceData.length; i++) {
    const row = sourceData[i];

    // テンプレート名を取得（ソースのヘッダー構造に応じて調整）
    const srcNameIdx = sourceHeaders.indexOf('テンプレート名') >= 0 ? sourceHeaders.indexOf('テンプレート名') : 1;
    const templateName = row[srcNameIdx];

    if (!templateName) continue;

    // 重複チェック
    if (existingNames.has(templateName)) {
      Logger.log('スキップ（重複）: ' + templateName);
      skippedCount++;
      continue;
    }

    // 新しいテンプレートIDを生成
    const templateId = 'TPL-' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + (copiedCount + 1);

    // ターゲットシートの列構造に合わせてデータを準備
    const newRow = [
      templateId,                                                    // テンプレートID
      row[sourceHeaders.indexOf('テンプレート名')] || '',             // テンプレート名
      row[sourceHeaders.indexOf('カテゴリ')] || '',                   // カテゴリ
      row[sourceHeaders.indexOf('本文')] || row[sourceHeaders.indexOf('テンプレート')] || '',  // 本文
      row[sourceHeaders.indexOf('使用場面')] || '',                   // 使用場面
      now                                                            // 更新日
    ];

    targetSheet.appendRow(newRow);
    existingNames.add(templateName);
    copiedCount++;
    Logger.log('コピー完了: ' + templateName);
  }

  const message = `統合完了:\n・コピー: ${copiedCount}件\n・スキップ（重複）: ${skippedCount}件`;
  ui.alert('テンプレート統合', message, ui.ButtonSet.OK);
  Logger.log(message);
}
