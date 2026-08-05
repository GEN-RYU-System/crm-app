/**
 * テストランナー
 * 自動テストの実行・レポート生成
 */

/**
 * clasp run 動作確認用シンプルテスト
 * 外部サービス不要
 */
function testClaspRun() {
  return {
    success: true,
    message: 'clasp run is working!',
    timestamp: new Date().toISOString(),
    environment: 'GAS'
  };
}

// ============================================================
// メインテスト実行
// ============================================================

/**
 * 全テストを実行
 * @returns {Object} テスト結果
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('全テスト開始');
  Logger.log('環境: ' + getEnvironment());
  Logger.log('========================================');

  const startTime = new Date();
  const results = [];

  // 1. 基本機能テスト
  results.push(testSpreadsheetAccess());
  results.push(testSheetExists());
  results.push(testHeaderCount());

  // 2. API テスト
  results.push(testGetLeadsIn());
  results.push(testGetLeadsOut());
  results.push(testGetDeals());
  results.push(testGetDropdownOptions());

  // 3. 認証テスト
  results.push(testCurrentUserAuth());

  // 4. データ整合性テスト
  results.push(testRequiredColumns());

  const endTime = new Date();
  const duration = endTime - startTime;

  // 結果集計
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  Logger.log('========================================');
  Logger.log('テスト結果: ' + passed + '/' + total + ' PASS');
  Logger.log('実行時間: ' + duration + 'ms');
  Logger.log('========================================');

  results.forEach(function(r) {
    const status = r.pass ? '✅' : '❌';
    Logger.log(status + ' ' + r.name + ': ' + r.detail);
  });

  return {
    passed: passed,
    failed: failed,
    total: total,
    duration: duration,
    allPassed: failed === 0,
    results: results
  };
}

/**
 * クイックテスト（主要機能のみ）
 */
function runQuickTests() {
  Logger.log('========================================');
  Logger.log('クイックテスト開始');
  Logger.log('========================================');

  const results = [];

  results.push(testSpreadsheetAccess());
  results.push(testGetLeadsIn());
  results.push(testGetDeals());

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  Logger.log('========================================');
  Logger.log('クイックテスト結果: ' + passed + '/' + total + ' PASS');
  Logger.log('========================================');

  return {
    passed: passed,
    total: total,
    allPassed: passed === total,
    results: results
  };
}

// ============================================================
// 個別テスト関数
// ============================================================

/**
 * スプレッドシートアクセステスト
 */
function testSpreadsheetAccess() {
  const name = 'スプレッドシートアクセス';
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return { name: name, pass: false, detail: 'スプレッドシートがnull' };
    }
    const ssName = ss.getName();
    const ssId = ss.getId();
    return { name: name, pass: true, detail: ssName + ' (' + ssId.substring(0, 10) + '...)' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * 必要なシートの存在確認
 */
function testSheetExists() {
  const name = 'シート存在確認';
  try {
    const ss = getSpreadsheet();
    const requiredSheets = [
      CONFIG.SHEETS.LEADS,
      CONFIG.SHEETS.STAFF,
      CONFIG.SHEETS.SETTINGS
    ];

    const missing = [];
    requiredSheets.forEach(function(sheetName) {
      if (!ss.getSheetByName(sheetName)) {
        missing.push(sheetName);
      }
    });

    if (missing.length > 0) {
      return { name: name, pass: false, detail: '不足: ' + missing.join(', ') };
    }
    return { name: name, pass: true, detail: requiredSheets.length + 'シートOK' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * リード管理シートのヘッダー列数確認
 */
function testHeaderCount() {
  const name = 'ヘッダー列数';
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (!sheet) {
      return { name: name, pass: false, detail: 'リード管理シートなし' };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expected = HEADERS.LEADS.length; // 47

    if (headers.length < expected) {
      return { name: name, pass: false, detail: '期待:' + expected + ' 実際:' + headers.length };
    }
    return { name: name, pass: true, detail: headers.length + '列 (期待:' + expected + ')' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * 必須列の存在確認
 */
function testRequiredColumns() {
  const name = '必須列確認';
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (!sheet) {
      return { name: name, pass: false, detail: 'リード管理シートなし' };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const required = ['リードID', 'リード種別', '進捗ステータス', '顧客名', '担当者'];

    const missing = [];
    required.forEach(function(col) {
      if (!headers.includes(col)) {
        missing.push(col);
      }
    });

    if (missing.length > 0) {
      return { name: name, pass: false, detail: '不足: ' + missing.join(', ') };
    }
    return { name: name, pass: true, detail: required.length + '列OK' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * getLeads(インバウンド)テスト
 */
function testGetLeadsIn() {
  const name = 'getLeads(IN)';
  try {
    const leads = getLeads('lead', 'インバウンド');
    if (!Array.isArray(leads)) {
      return { name: name, pass: false, detail: '配列でない: ' + typeof leads };
    }
    return { name: name, pass: true, detail: leads.length + '件取得' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * getLeads(アウトバウンド)テスト
 */
function testGetLeadsOut() {
  const name = 'getLeads(OUT)';
  try {
    const leads = getLeads('lead', 'アウトバウンド');
    if (!Array.isArray(leads)) {
      return { name: name, pass: false, detail: '配列でない: ' + typeof leads };
    }
    return { name: name, pass: true, detail: leads.length + '件取得' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * getDealsテスト
 */
function testGetDeals() {
  const name = 'getDeals';
  try {
    const deals = getDeals();
    if (!Array.isArray(deals)) {
      return { name: name, pass: false, detail: '配列でない: ' + typeof deals };
    }
    return { name: name, pass: true, detail: deals.length + '件取得' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * getDropdownOptionsテスト
 */
function testGetDropdownOptions() {
  const name = 'getDropdownOptions';
  try {
    const options = getDropdownOptions();
    if (!options || typeof options !== 'object') {
      return { name: name, pass: false, detail: 'オブジェクトでない' };
    }

    const keys = Object.keys(options);
    return { name: name, pass: true, detail: keys.length + '項目取得' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

/**
 * 認証テスト
 */
function testCurrentUserAuth() {
  const name = '認証確認';
  try {
    const user = getCurrentUserWithPermissions();
    if (!user) {
      return { name: name, pass: false, detail: 'ユーザー情報なし' };
    }
    if (!user.isAuthenticated) {
      return { name: name, pass: false, detail: '未認証: ' + (user.error || '不明') };
    }
    return { name: name, pass: true, detail: user.email + ' (' + user.role + ')' };
  } catch (e) {
    return { name: name, pass: false, detail: e.message };
  }
}

// ============================================================
// テスト結果レポート
// ============================================================

/**
 * テスト結果をフォーマットして返す
 */
function formatTestResults(results) {
  let report = '# テスト結果レポート\n\n';
  report += '実行日時: ' + new Date().toLocaleString('ja-JP') + '\n';
  report += '環境: ' + getEnvironment() + '\n\n';

  report += '## サマリー\n';
  report += '- 合計: ' + results.total + '件\n';
  report += '- 成功: ' + results.passed + '件\n';
  report += '- 失敗: ' + results.failed + '件\n';
  report += '- 実行時間: ' + results.duration + 'ms\n\n';

  report += '## 詳細\n\n';

  results.results.forEach(function(r) {
    const status = r.pass ? '✅' : '❌';
    report += status + ' **' + r.name + '**: ' + r.detail + '\n';
  });

  return report;
}

/**
 * デプロイ前テスト（失敗したらエラーをスロー）
 */
function runPreDeployTests() {
  const results = runAllTests();

  if (!results.allPassed) {
    const failedTests = results.results.filter(r => !r.pass);
    const failedNames = failedTests.map(r => r.name).join(', ');
    throw new Error('テスト失敗: ' + failedNames);
  }

  Logger.log('✅ 全テスト合格 - デプロイOK');
  return true;
}

// ============================================================
// テストデータ投入（バッジ・ストリーク確認用）
// ============================================================

/**
 * バッジとストリーク確認用のテストデータを投入
 * GASエディタから直接実行してください
 *
 * 投入内容：
 * - テスト用担当者: TEST-001（テスト 太郎）
 * - 成約データ: 5件連続成約（ストリーク確認用）
 * - 大型案件: 60万円の成約（BIG_DEALバッジ用）
 * - 目標データ: 月間売上目標100万円
 */
function insertBadgeTestData() {
  const ss = getSpreadsheet();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  Logger.log('========================================');
  Logger.log('バッジ・ストリーク確認用テストデータ投入');
  Logger.log('環境: ' + getEnvironment());
  Logger.log('========================================');

  // 1. 担当者マスタにテスト担当者を追加
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!staffSheet) {
    Logger.log('❌ 担当者マスタシートが見つかりません');
    return { success: false, error: '担当者マスタシートがありません' };
  }

  const testStaffId = 'TEST-001';
  const staffData = getSheetDataAsObjects(staffSheet);
  const existingStaff = staffData.find(s => s['担当者ID'] === testStaffId);

  if (!existingStaff) {
    // テスト担当者を追加
    staffSheet.appendRow([
      testStaffId,           // 担当者ID
      'テスト',              // 苗字（日本語）
      '太郎',                // 名前（日本語）
      'Test',                // 苗字（英語）
      'Taro',                // 名前（英語）
      'test@example.com',    // メール
      'test_user',           // Discord ID
      '営業',                // 役割
      '有効',                // ステータス
      ''                     // 元候補者ID
    ]);
    Logger.log('✅ テスト担当者を追加: ' + testStaffId);
  } else {
    Logger.log('ℹ️ テスト担当者は既に存在: ' + testStaffId);
  }

  // 2. リード管理シートに成約データを追加
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadSheet) {
    Logger.log('❌ リード管理シートが見つかりません');
    return { success: false, error: 'リード管理シートがありません' };
  }

  const testLeads = [
    // 連続成約データ（5件 - ストリーク確認用）
    createTestLead('TEST-LDI-001', '成約', 120000, -10, testStaffId, '顧客A社'),
    createTestLead('TEST-LDI-002', '成約', 85000, -8, testStaffId, '顧客B社'),
    createTestLead('TEST-LDI-003', '成約', 95000, -5, testStaffId, '顧客C社'),
    createTestLead('TEST-LDI-004', '成約', 150000, -3, testStaffId, '顧客D社'),
    createTestLead('TEST-LDI-005', '成約', 600000, -1, testStaffId, '顧客E社（大型案件）'),  // BIG_DEAL用
  ];

  // 既存のテストデータを確認
  const existingLeads = getSheetDataAsObjects(leadSheet);
  const existingTestIds = existingLeads.filter(l => String(l['リードID']).startsWith('TEST-')).map(l => l['リードID']);

  testLeads.forEach(lead => {
    if (!existingTestIds.includes(lead[0])) {
      leadSheet.appendRow(lead);
      Logger.log('✅ テストリード追加: ' + lead[0] + ' (' + lead[5] + ') ' + lead[19] + ' ￥' + lead[41]);
    } else {
      Logger.log('ℹ️ テストリードは既に存在: ' + lead[0]);
    }
  });

  // 3. 目標設定シートにデータを追加
  const goalsSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
  if (goalsSheet) {
    const period = thisYear + '/' + String(thisMonth + 1).padStart(2, '0');
    const goalsData = getSheetDataAsObjects(goalsSheet);
    const existingGoal = goalsData.find(g =>
      g['担当者ID'] === testStaffId &&
      g['期間タイプ'] === '月次' &&
      g['期間'] === period
    );

    if (!existingGoal) {
      goalsSheet.appendRow([
        'GOAL-TEST-001',     // 目標ID
        testStaffId,         // 担当者ID
        'テスト 太郎',       // 担当者名
        '月次',              // 期間タイプ
        period,              // 期間
        10,                  // 商談数目標
        5,                   // 成約数目標
        50,                  // 成約率目標
        1000000,             // 売上目標（100万円）
        'テストデータ',      // メモ
        now,                 // 作成日
        now                  // 更新日
      ]);
      Logger.log('✅ 目標データを追加: ' + period);
    } else {
      Logger.log('ℹ️ 目標データは既に存在: ' + period);
    }
  }

  Logger.log('========================================');
  Logger.log('テストデータ投入完了！');
  Logger.log('');
  Logger.log('【確認方法】');
  Logger.log('1. Webアプリを開く');
  Logger.log('2. テスト担当者（test@example.com）でログイン');
  Logger.log('3. 営業ダッシュボードを開く');
  Logger.log('');
  Logger.log('【期待される表示】');
  Logger.log('- ストリーク: 5連勝中！（オレンジグラデーション）');
  Logger.log('- バッジ: 初成約、10万円達成、50万円達成、3連勝、5連勝、ビッグディール');
  Logger.log('========================================');

  return {
    success: true,
    staffId: testStaffId,
    leadsCount: testLeads.length,
    totalSales: testLeads.reduce((sum, l) => sum + l[41], 0)
  };
}

/**
 * テスト用リードデータ行を作成
 */
function createTestLead(leadId, status, amount, daysAgo, staffId, customerName) {
  const now = new Date();
  const dealDate = new Date(now.getTime() + daysAgo * 24 * 60 * 60 * 1000);
  const dateStr = Utilities.formatDate(dealDate, 'Asia/Tokyo', 'yyyy/MM/dd');

  // 60列のリードデータ（HEADERS.LEADS準拠）
  const row = new Array(60).fill('');

  row[0] = leadId;                        // リードID
  row[1] = dateStr;                       // 登録日
  row[2] = 'インバウンド';                // リード種別
  row[3] = dateStr;                       // シート更新日
  row[4] = 'テスト流入';                  // 流入経路
  row[5] = customerName;                  // 顧客名
  row[6] = 'Test Customer';               // 呼び方（英語）
  row[7] = 'USA';                         // 国
  row[8] = 'test@customer.com';           // メール
  row[9] = '';                            // 電話番号
  row[10] = 'Email';                      // 連絡手段
  row[11] = '';                           // メッセージURL
  row[12] = dateStr;                      // 初回接触日
  row[13] = '高';                         // 温度感
  row[14] = '中規模';                     // 想定規模
  row[15] = '信頼重視';                   // 顧客タイプ
  row[16] = '24h以内';                    // 返信速度
  row[17] = 'テストデータ';               // CSメモ
  row[18] = 1;                            // 問い合わせ回数
  row[19] = status;                       // 進捗ステータス
  row[20] = 'テスト 太郎';                // 担当者
  row[21] = staffId;                      // 担当者ID
  row[22] = dateStr;                      // アサイン日
  row[23] = staffId;                      // 最終対応者ID
  row[24] = 'A';                          // 見込度
  row[25] = '';                           // 次回アクション
  row[26] = '';                           // 次回アクション日
  row[27] = 'テスト商談';                 // 商談メモ
  row[28] = '';                           // 相手の課題
  row[29] = 'Pokemon';                    // 取り扱いタイトル
  row[30] = 'EC';                         // 販売形態
  row[31] = amount;                       // 月間見込み金額
  row[32] = amount;                       // 1回の発注金額
  row[33] = '月1回';                      // 購入頻度
  row[34] = 'いいえ';                     // 競合比較中
  row[35] = '◎ 非常に良い';               // 商談の手応え
  row[36] = '';                           // アラート確認日
  row[37] = status === '成約' ? '成約' : ''; // 商談結果
  row[38] = '';                           // 対象外理由
  row[39] = '';                           // 失注理由
  row[40] = status === '成約' ? dateStr : ''; // 初回取引日
  row[41] = status === '成約' ? amount : 0;   // 初回取引金額
  row[42] = status === '成約' ? amount : 0;   // 累計取引金額

  return row;
}

/**
 * テストデータを削除（クリーンアップ用）
 */
function removeTestData() {
  const ss = getSpreadsheet();

  Logger.log('========================================');
  Logger.log('テストデータ削除');
  Logger.log('========================================');

  // リード管理シートからテストデータを削除
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (leadSheet) {
    const data = leadSheet.getDataRange().getValues();
    const rowsToDelete = [];

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).startsWith('TEST-')) {
        rowsToDelete.push(i + 1);
      }
    }

    rowsToDelete.forEach(row => {
      leadSheet.deleteRow(row);
    });

    Logger.log('✅ テストリード削除: ' + rowsToDelete.length + '件');
  }

  // 担当者マスタからテスト担当者を削除
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (staffSheet) {
    const data = staffSheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).startsWith('TEST-')) {
        staffSheet.deleteRow(i + 1);
        Logger.log('✅ テスト担当者削除: ' + data[i][0]);
      }
    }
  }

  // 目標設定シートからテストデータを削除
  const goalsSheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
  if (goalsSheet) {
    const data = goalsSheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).startsWith('GOAL-TEST-')) {
        goalsSheet.deleteRow(i + 1);
        Logger.log('✅ テスト目標削除: ' + data[i][0]);
      }
    }
  }

  Logger.log('========================================');
  Logger.log('テストデータ削除完了');
  Logger.log('========================================');

  return { success: true };
}

// ============================================================
// スナップショット機能（DISC-028承認）
// 削除系関数実行時のデータ変更検知
// ============================================================

/**
 * 全シートのスナップショットを取得
 * @returns {Object} シートごとのスナップショット
 */
function takeDataSnapshot() {
  const ss = getSpreadsheet();
  const snapshot = {
    timestamp: new Date().toISOString(),
    environment: getEnvironment(),
    sheets: {}
  };

  // 監視対象シート
  const targetSheets = [
    CONFIG.SHEETS.LEADS,
    CONFIG.SHEETS.STAFF,
    CONFIG.SHEETS.SETTINGS,
    CONFIG.SHEETS.GOALS,
    CONFIG.SHEETS.SHIFT,
    CONFIG.SHEETS.BUDDY_LOG,
    CONFIG.SHEETS.CONVERSATION_LOG,
    CONFIG.SHEETS.NOTICES
  ];

  targetSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      let headers = [];
      let dataHash = '';

      if (lastRow > 0 && lastCol > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

        // データハッシュを計算（行数が多い場合は先頭1000行まで）
        const rowsToHash = Math.min(lastRow, 1000);
        const data = sheet.getRange(1, 1, rowsToHash, lastCol).getValues();
        dataHash = computeDataHash(data);
      }

      snapshot.sheets[sheetName] = {
        rowCount: lastRow,
        colCount: lastCol,
        headers: headers,
        dataHash: dataHash
      };
    }
  });

  return snapshot;
}

/**
 * データのMD5ハッシュを計算
 * @param {Array} data - 2次元配列データ
 * @returns {string} MD5ハッシュ
 */
function computeDataHash(data) {
  const jsonStr = JSON.stringify(data);
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    jsonStr,
    Utilities.Charset.UTF_8
  );
  return hash.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

/**
 * 2つのスナップショットを比較
 * @param {Object} before - 実行前スナップショット
 * @param {Object} after - 実行後スナップショット
 * @returns {Object} 変更検知結果
 */
function compareSnapshots(before, after) {
  const changes = [];
  const details = {};

  Object.keys(before.sheets).forEach(sheetName => {
    const b = before.sheets[sheetName];
    const a = after.sheets[sheetName];

    if (!a) {
      changes.push(`${sheetName}: シートが削除されました`);
      details[sheetName] = { type: 'deleted' };
      return;
    }

    const sheetChanges = [];

    // 行数の変更
    if (b.rowCount !== a.rowCount) {
      const diff = a.rowCount - b.rowCount;
      const sign = diff > 0 ? '+' : '';
      sheetChanges.push(`行数変更 ${b.rowCount} → ${a.rowCount}（${sign}${diff}行）`);
    }

    // 列数の変更
    if (b.colCount !== a.colCount) {
      const diff = a.colCount - b.colCount;
      const sign = diff > 0 ? '+' : '';
      sheetChanges.push(`列数変更 ${b.colCount} → ${a.colCount}（${sign}${diff}列）`);
    }

    // ヘッダーの変更
    if (JSON.stringify(b.headers) !== JSON.stringify(a.headers)) {
      sheetChanges.push('ヘッダー変更あり');
    }

    // データハッシュの変更
    if (b.dataHash !== a.dataHash) {
      if (sheetChanges.length === 0) {
        sheetChanges.push('データ内容変更あり（行数・列数は同じ）');
      }
    }

    if (sheetChanges.length > 0) {
      changes.push(`${sheetName}: ${sheetChanges.join(', ')}`);
      details[sheetName] = {
        type: 'modified',
        rowCountBefore: b.rowCount,
        rowCountAfter: a.rowCount,
        colCountBefore: b.colCount,
        colCountAfter: a.colCount,
        hashChanged: b.dataHash !== a.dataHash
      };
    }
  });

  // 新規シートの検知
  Object.keys(after.sheets).forEach(sheetName => {
    if (!before.sheets[sheetName]) {
      changes.push(`${sheetName}: 新規シートが作成されました`);
      details[sheetName] = { type: 'created' };
    }
  });

  return {
    hasChanges: changes.length > 0,
    changeCount: changes.length,
    changes: changes,
    details: details
  };
}

/**
 * スナップショット付きで関数を実行
 * 削除系関数を安全に実行するためのラッパー
 *
 * @param {string} functionName - 実行する関数名
 * @param {...*} args - 関数に渡す引数
 * @returns {Object} 実行結果と変更検知結果
 */
function runWithSnapshot(functionName, ...args) {
  Logger.log('========================================');
  Logger.log('【runWithSnapshot】開始');
  Logger.log('関数名: ' + functionName);
  Logger.log('引数: ' + JSON.stringify(args));
  Logger.log('環境: ' + getEnvironment());
  Logger.log('========================================');

  // 本番環境チェック
  if (getEnvironment() === 'production') {
    Logger.log('❌ エラー: 本番環境での削除系関数実行は禁止されています');
    return {
      success: false,
      error: '本番環境での削除系関数実行は禁止されています',
      result: null,
      changes: null
    };
  }

  // 関数存在チェック
  if (typeof this[functionName] !== 'function') {
    Logger.log('❌ エラー: 関数が見つかりません: ' + functionName);
    return {
      success: false,
      error: '関数が見つかりません: ' + functionName,
      result: null,
      changes: null
    };
  }

  // 1. 実行前スナップショット
  Logger.log('【Step 1】実行前スナップショット取得中...');
  const before = takeDataSnapshot();
  Logger.log('✅ スナップショット取得完了');

  // 2. 関数実行
  Logger.log('【Step 2】関数実行中...');
  let result;
  let error = null;

  try {
    result = this[functionName](...args);
    Logger.log('✅ 関数実行完了');
  } catch (e) {
    error = e.message;
    Logger.log('❌ 関数実行エラー: ' + e.message);
  }

  // 3. 実行後スナップショット
  Logger.log('【Step 3】実行後スナップショット取得中...');
  const after = takeDataSnapshot();
  Logger.log('✅ スナップショット取得完了');

  // 4. 変更検知
  Logger.log('【Step 4】変更検知中...');
  const comparison = compareSnapshots(before, after);

  Logger.log('========================================');
  Logger.log('【変更検知結果】');
  if (comparison.hasChanges) {
    Logger.log('⚠️ ' + comparison.changeCount + '件の変更を検知:');
    comparison.changes.forEach(change => {
      Logger.log('  - ' + change);
    });
  } else {
    Logger.log('✅ 変更なし');
  }
  Logger.log('========================================');

  // 5. 結果を返す
  const finalResult = {
    success: error === null,
    error: error,
    functionName: functionName,
    args: args,
    result: result,
    changes: comparison,
    snapshots: {
      before: {
        timestamp: before.timestamp,
        environment: before.environment
      },
      after: {
        timestamp: after.timestamp,
        environment: after.environment
      }
    }
  };

  Logger.log('【runWithSnapshot】完了');
  Logger.log('結果: ' + JSON.stringify(finalResult, null, 2));

  return finalResult;
}

/**
 * 削除系関数かどうかをチェック
 * @param {string} functionName - 関数名
 * @returns {Object} チェック結果
 */
function isDeleteFunction(functionName) {
  const blacklistPatterns = [
    /^delete/i,
    /^remove/i,
    /^clear/i,
    /^drop/i,
    /^cleanup/i,
    /^purge/i,
    /^reset/i,
    /^destroy/i,
    /^truncate/i
  ];

  for (const pattern of blacklistPatterns) {
    if (pattern.test(functionName)) {
      return {
        isDelete: true,
        matchedPattern: pattern.toString(),
        message: `関数名「${functionName}」は削除系関数です。runWithSnapshot()経由で実行してください。`
      };
    }
  }

  return {
    isDelete: false,
    matchedPattern: null,
    message: `関数名「${functionName}」は削除系関数ではありません。`
  };
}

/**
 * runWithSnapshotのテスト
 * insertBadgeTestDataを実行して変更検知をテスト
 */
function testRunWithSnapshot() {
  Logger.log('========================================');
  Logger.log('runWithSnapshotテスト開始');
  Logger.log('========================================');

  // insertBadgeTestDataを実行
  const result = runWithSnapshot('insertBadgeTestData');

  Logger.log('========================================');
  Logger.log('テスト結果:');
  Logger.log('成功: ' + result.success);
  Logger.log('変更検知: ' + result.changes.hasChanges);
  if (result.changes.hasChanges) {
    Logger.log('変更内容:');
    result.changes.changes.forEach(c => Logger.log('  - ' + c));
  }
  Logger.log('========================================');

  return result;
}
