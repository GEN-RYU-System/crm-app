/**
 * CRM ダッシュボード - スプレッドシート初期設定
 *
 * @description
 * CRMダッシュボードのスプレッドシート構造を初期化します。
 * 以下のシートを自動作成します：
 * - リード管理（メインシート）
 * - 担当者マスタ
 * - 設定シート
 * - レポートシート
 * - ログシート
 */

/**
 * スプレッドシート全体を初期化（メインエントリーポイント）
 *
 * @deprecated 23_SheetService.js の同名関数に統合済み。名前衝突を避けるためリネーム。
 *             GAS 上では 23_SheetService.js の initializeSpreadsheet() が有効。
 */
function _DEPRECATED_initializeSpreadsheet_legacy() {
  throw new Error(
    'この関数は無効化されています。既存シートを削除して再作成するため、' +
    '実行するとリード管理シートのデータが失われます。' +
    '本当に必要な場合はコード側のガードを外してください。'
  );
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '初期設定の実行',
    'CRMダッシュボードの初期設定を実行します。\n既存のシートは削除されませんが、データが上書きされる可能性があります。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('キャンセルしました。');
    return;
  }

  try {
    Logger.log('========================================');
    Logger.log('スプレッドシート初期化を開始');
    Logger.log('========================================\n');

    const ss = getSpreadsheet();

    // 各シートを初期化
    initializeLeadsSheet(ss);
    initializeStaffMasterSheet(ss);
    initializeSettingsSheet(ss);
    initializePermissionsSheet(ss);
    initializeGoalsSheet(ss);
    initializeTemplateSheet(ss);
    initializeWeeklyReportSheet(ss);
    initializeMonthlyReportSheet(ss);
    initializeShiftSheet(ss);
    initializeBuddyConversationLogSheet(ss);
    initializeConversationLogSheet(ss);
    initializeGlossarySheet(ss);
    initializeNoticeSheet(ss);
    initializeReadStatusSheet(ss);

    Logger.log('\n========================================');
    Logger.log('スプレッドシート初期化が完了しました');
    Logger.log('========================================');

    ui.alert('完了', 'CRMダッシュボードの初期設定が完了しました。', ui.ButtonSet.OK);

    return {
      success: true,
      message: 'スプレッドシート初期化が完了しました'
    };

  } catch (error) {
    Logger.log('初期化エラー: ' + error.message);
    Logger.log(error.stack);
    ui.alert('エラー', '初期化中にエラーが発生しました:\n' + error.message, ui.ButtonSet.OK);

    return {
      success: false,
      message: '初期化エラー: ' + error.message,
      error: error.toString()
    };
  }
}

/**
 * リード管理シートを初期化（メインシート）
 */
function initializeLeadsSheet(ss) {
  throw new Error(
    'この関数は無効化されています。既存シートを削除して再作成するため、' +
    '実行するとリード管理シートのデータが失われます。' +
    '本当に必要な場合はコード側のガードを外してください。'
  );
  Logger.log('初期化中: リード管理');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.LEADS, 0); // 最初のシートとして作成
  }

  // ヘッダー設定
  const headers = CONFIG.HEADERS.LEADS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダースタイル
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  // 列幅を自動調整
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // フリーズ行
  sheet.setFrozenRows(1);

  Logger.log('✅ リード管理シートの初期化完了');
}

/**
 * 担当者マスタシートを初期化
 */
function initializeStaffMasterSheet(ss) {
  Logger.log('初期化中: 担当者マスタ');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF_MASTER);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.STAFF_MASTER);
  }

  const headers = CONFIG.HEADERS.STAFF_MASTER;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#34A853')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 担当者マスタシートの初期化完了');
}

/**
 * 設定シートを初期化
 */
function initializeSettingsSheet(ss) {
  Logger.log('初期化中: 設定');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
  }

  const headers = CONFIG.HEADERS.SETTINGS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#FBBC04')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 設定シートの初期化完了');
}

/**
 * 権限設定シートを初期化
 */
function initializePermissionsSheet(ss) {
  Logger.log('初期化中: 権限設定');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.PERMISSIONS);
  }

  const headers = CONFIG.HEADERS.PERMISSIONS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#EA4335')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 権限設定シートの初期化完了');
}

/**
 * 目標設定シートを初期化
 */
function initializeGoalsSheet(ss) {
  Logger.log('初期化中: 目標設定');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.GOALS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.GOALS);
  }

  const headers = CONFIG.HEADERS.GOALS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9C27B0')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 目標設定シートの初期化完了');
}

/**
 * テンプレートシートを初期化
 */
function initializeTemplateSheet(ss) {
  Logger.log('初期化中: テンプレート');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.TEMPLATE);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.TEMPLATE);
  }

  const headers = CONFIG.HEADERS.TEMPLATE;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#FF6F00')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ テンプレートシートの初期化完了');
}

/**
 * 週次レポートシートを初期化
 */
function initializeWeeklyReportSheet(ss) {
  Logger.log('初期化中: 週次レポート');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.WEEKLY_REPORT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.WEEKLY_REPORT);
  }

  const headers = CONFIG.HEADERS.WEEKLY_REPORT;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#00ACC1')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 週次レポートシートの初期化完了');
}

/**
 * 月次レポートシートを初期化
 */
function initializeMonthlyReportSheet(ss) {
  Logger.log('初期化中: 月次レポート');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.MONTHLY_REPORT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.MONTHLY_REPORT);
  }

  const headers = CONFIG.HEADERS.MONTHLY_REPORT;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#00897B')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 月次レポートシートの初期化完了');
}

/**
 * シフトシートを初期化
 */
function initializeShiftSheet(ss) {
  Logger.log('初期化中: シフト');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SHIFT);
  }

  const headers = CONFIG.HEADERS.SHIFT;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#7CB342')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ シフトシートの初期化完了');
}

/**
 * Buddy対話ログシートを初期化
 */
function initializeBuddyConversationLogSheet(ss) {
  Logger.log('初期化中: Buddy対話ログ');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.BUDDY_CONVERSATION_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.BUDDY_CONVERSATION_LOG);
  }

  const headers = CONFIG.HEADERS.BUDDY_CONVERSATION_LOG;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#8E24AA')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ Buddy対話ログシートの初期化完了');
}

/**
 * 会話ログシートを初期化
 */
function initializeConversationLogSheet(ss) {
  Logger.log('初期化中: 会話ログ');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.CONVERSATION_LOG);
  }

  const headers = CONFIG.HEADERS.CONVERSATION_LOG;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#5E35B1')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 会話ログシートの初期化完了');
}

/**
 * 専門用語辞書シートを初期化
 */
function initializeGlossarySheet(ss) {
  Logger.log('初期化中: 専門用語辞書');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.GLOSSARY);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.GLOSSARY);
  }

  const headers = CONFIG.HEADERS.GLOSSARY;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#3949AB')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 専門用語辞書シートの初期化完了');
}

/**
 * お知らせシートを初期化
 */
function initializeNoticeSheet(ss) {
  Logger.log('初期化中: お知らせ');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.NOTICE);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.NOTICE);
  }

  const headers = CONFIG.HEADERS.NOTICE;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E88E5')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ お知らせシートの初期化完了');
}

/**
 * 既読管理シートを初期化
 */
function initializeReadStatusSheet(ss) {
  Logger.log('初期化中: 既読管理');

  let sheet = ss.getSheetByName(CONFIG.SHEETS.READ_STATUS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.READ_STATUS);
  }

  const headers = CONFIG.HEADERS.READ_STATUS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#546E7A')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);

  Logger.log('✅ 既読管理シートの初期化完了');
}

/**
 * 目標設定シートを初期化（メニューから実行）
 */
function initializeGoalsSheetFromMenu() {
  const ss = getSpreadsheet();
  initializeGoalsSheet(ss);
  SpreadsheetApp.getUi().alert('完了', '目標設定シートを初期化しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 権限設定シートを初期化（メニューから実行）
 */
function initializePermissionsSheetFromMenu() {
  const ss = getSpreadsheet();
  initializePermissionsSheet(ss);
  SpreadsheetApp.getUi().alert('完了', '権限設定シートを初期化しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// ERP統合: 初期化関数
// ============================================================

/**
 * ERP統合シートを一括初期化
 */
function initializeERPIntegration() {
  Logger.log('\n========================================');
  Logger.log('ERP統合: シートを初期化中...');
  Logger.log('========================================\n');

  const ss = getSpreadsheet();
  const erpId = CONFIG.ERP.SPREADSHEET_ID;

  try {
    // 1. 見積書管理シート
    initializeQuotesSheet(ss);

    // 2. 見積書明細シート
    initializeQuoteItemsSheet(ss);

    // 3. 顧客マスタシート
    initializeCustomerMasterSheet(ss);

    // 4. IMPORTRANGE同期シート（ERP → CRM）
    initializeStockSyncSheet(ss, erpId);
    initializeProductSyncSheet(ss, erpId);
    initializeZonesSyncSheet(ss, erpId);
    initializeFedExRatesSyncSheet(ss, erpId);
    initializeDHLRatesSyncSheet(ss, erpId);
    initializeUPSRatesSyncSheet(ss, erpId);

    Logger.log('\n========================================');
    Logger.log('ERP統合シート初期化が完了しました');
    Logger.log('========================================');
    Logger.log('\n重要な次のステップ:');
    Logger.log('1. スプレッドシートを開いて各「同期」シートを確認');
    Logger.log('2. IMPORTRANGEの「#REF!」エラーが表示されている場合、アクセス許可を承認');
    Logger.log('3. 承認後、数秒でERPからデータが自動同期されます');

    return {
      success: true,
      message: 'ERP統合シートの初期化が完了しました',
      createdSheets: [
        CONFIG.SHEETS.QUOTES,
        CONFIG.SHEETS.QUOTE_ITEMS,
        CONFIG.SHEETS.CUSTOMER_MASTER,
        CONFIG.SHEETS.STOCK_SYNC,
        CONFIG.SHEETS.PRODUCT_SYNC,
        CONFIG.SHEETS.ZONES_SYNC,
        CONFIG.SHEETS.FEDEX_RATES_SYNC,
        CONFIG.SHEETS.DHL_RATES_SYNC,
        CONFIG.SHEETS.UPS_RATES_SYNC
      ]
    };

  } catch (error) {
    Logger.log('初期化エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: '初期化エラー: ' + error.message,
      error: error.toString()
    };
  }
}

// ============================================================
// SCM統合: IMPORTRANGE同期シート初期化
// ============================================================

/**
 * SCM（サプライチェーン管理）からのIMPORTRANGE同期シートを初期化
 *
 * 対象シート:
 * - 商品マスタ同期（SCM: 商品マスタ）
 * - 集計同期（SCM: 集計）
 * - 仕入元マスタ同期（SCM: 仕入元マスタ）
 */
function initializeSCMSyncSheets() {
  Logger.log('\n========================================');
  Logger.log('SCM統合: IMPORTRANGE同期シートを初期化中...');
  Logger.log('========================================\n');

  const ss = getSpreadsheet();
  const scmId = PRODUCTION_IDS.SCM_SPREADSHEET_ID;

  try {
    // 1. 商品マスタ同期
    initializeSCMProductMasterSync(ss, scmId);

    // 2. 集計同期（在庫情報）
    initializeSCMStockSync(ss, scmId);

    // 3. 仕入元マスタ同期
    initializeSCMSupplierMasterSync(ss, scmId);

    Logger.log('\n========================================');
    Logger.log('SCM統合シート初期化が完了しました');
    Logger.log('========================================');
    Logger.log('\n重要な次のステップ:');
    Logger.log('1. スプレッドシートを開いて各「同期」シートを確認');
    Logger.log('2. IMPORTRANGEの「#REF!」エラーが表示されている場合、アクセス許可を承認');
    Logger.log('3. 承認後、数秒でSCMからデータが自動同期されます');

    return {
      success: true,
      message: 'SCM統合シートの初期化が完了しました',
      createdSheets: [
        CONFIG.SHEETS.SCM_PRODUCT_MASTER_SYNC,
        CONFIG.SHEETS.SCM_STOCK_SYNC,
        CONFIG.SHEETS.SCM_SUPPLIER_MASTER_SYNC
      ]
    };

  } catch (error) {
    Logger.log('初期化エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: '初期化エラー: ' + error.message,
      error: error.toString()
    };
  }
}

/**
 * 商品マスタ同期シートを初期化（SCM: 商品マスタ）
 */
function initializeSCMProductMasterSync(ss, scmId) {
  const sheetName = CONFIG.SHEETS.SCM_PRODUCT_MASTER_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // IMPORTRANGE数式を設定
  const formula = `=IMPORTRANGE("${scmId}", "商品マスタ!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  // 注釈を追加
  sheet.getRange('A1').setNote(
    'SCMから自動同期されます。\n' +
    '同期元: 商品マスタシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  // シートを保護（閲覧のみ）
  const protection = sheet.protect().setDescription('SCM同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * 集計同期シートを初期化（SCM: 集計）
 */
function initializeSCMStockSync(ss, scmId) {
  const sheetName = CONFIG.SHEETS.SCM_STOCK_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // IMPORTRANGE数式を設定
  const formula = `=IMPORTRANGE("${scmId}", "集計!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  // 注釈を追加
  sheet.getRange('A1').setNote(
    'SCMから自動同期されます。\n' +
    '同期元: 集計シート（在庫情報）\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  // シートを保護（閲覧のみ）
  const protection = sheet.protect().setDescription('SCM同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * 仕入元マスタ同期シートを初期化（SCM: 仕入元マスタ）
 */
function initializeSCMSupplierMasterSync(ss, scmId) {
  const sheetName = CONFIG.SHEETS.SCM_SUPPLIER_MASTER_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // IMPORTRANGE数式を設定
  const formula = `=IMPORTRANGE("${scmId}", "仕入元マスタ!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  // 注釈を追加
  sheet.getRange('A1').setNote(
    'SCMから自動同期されます。\n' +
    '同期元: 仕入元マスタシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  // シートを保護（閲覧のみ）
  const protection = sheet.protect().setDescription('SCM同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

// ============================================================
// CRM基本シート: 売上データ・古物台帳
// ============================================================

/**
 * 📊売上データシートを初期化（ヘッダー4行目構造）
 */
function initializeSalesDataSheet() {
  Logger.log('初期化中: 📊売上データ');

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SALES_DATA);
  }

  // ヘッダーは4行目に配置
  // 1-3行目: メタデータ or 空行
  // 4行目: カラムヘッダー

  // ヘッダー配列の定義（ERPの📊売上データと同じ構造）
  const headers = [
    '取引状況請求書番号',  // 重要: 入金確認のキー列
    '取引状況支払確認日',  // 重要: 入金確認の記録列
    '取引日',
    '顧客ID',
    '顧客名',
    '商品ID',
    '商品名',
    '数量',
    '単価',
    '金額',
    '担当者',
    '備考'
  ];

  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(4, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(4); // 4行目までフリーズ

  // メタデータ追加（1行目）
  sheet.getRange('A1').setValue('📊 売上データ管理');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  sheet.getRange('A2').setValue('※ヘッダーは4行目です');
  sheet.getRange('A2').setFontColor('#666666');

  Logger.log('✅ 📊売上データシートの初期化完了');
}

/**
 * 古物台帳シートを初期化（空シート）
 */
function initializeAntiqueLedgerSheet() {
  Logger.log('初期化中: 🗃️古物台帳');

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('🗃️古物台帳');

  if (!sheet) {
    sheet = ss.insertSheet('🗃️古物台帳');
  }

  // 空シートとして作成（運用後に実装）
  const placeholderHeaders = [
    '古物ID', '取得日', '品名', '数量', '取得価格', '取得元', '備考'
  ];

  sheet.getRange(1, 1, 1, placeholderHeaders.length).setValues([placeholderHeaders]);
  sheet.getRange(1, 1, 1, placeholderHeaders.length)
    .setFontWeight('bold')
    .setBackground('#E0E0E0')
    .setFontColor('#666666');

  // 注釈を追加
  sheet.getRange('A2').setNote(
    '古物台帳は将来実装予定です。\n' +
    '運用開始後に列構成を確定します。\n' +
    '現在は枠組みのみ作成されています。'
  );

  Logger.log('✅ 🗃️古物台帳シート（空）の初期化完了');
}

// ============================================================
// 統合初期化関数: 全CRMシート一括作成
// ============================================================

/**
 * 全CRMシートを順序立てて一括作成する統合関数
 */
function initializeAllCRMSheets() {
  Logger.log('========================================');
  Logger.log('CRMシート類の一括作成を開始');
  Logger.log('========================================\n');

  const results = {
    success: [],
    errors: []
  };

  try {
    // Phase 1: 環境確認
    Logger.log('\n--- Phase 1: 環境確認 ---');
    const env = showCurrentEnvironment();
    Logger.log('環境: ' + env.environment);
    Logger.log('スプレッドシート: ' + env.spreadsheetName);

    // Phase 2: CRM基本シート作成
    Logger.log('\n--- Phase 2: CRM基本シート作成 ---');
    try {
      initializeSalesDataSheet();
      results.success.push('📊売上データ');
    } catch (e) {
      results.errors.push('📊売上データ: ' + e.message);
      Logger.log('エラー: ' + e.message);
    }

    try {
      initializeAntiqueLedgerSheet();
      results.success.push('🗃️古物台帳');
    } catch (e) {
      results.errors.push('🗃️古物台帳: ' + e.message);
      Logger.log('エラー: ' + e.message);
    }

    // Phase 3: SCM同期シート作成
    Logger.log('\n--- Phase 3: SCM同期シート作成 ---');
    try {
      const scmResult = initializeSCMSyncSheets();
      if (scmResult.success) {
        results.success.push(...scmResult.createdSheets);
      } else {
        results.errors.push('SCM同期: ' + scmResult.message);
      }
    } catch (e) {
      results.errors.push('SCM同期: ' + e.message);
      Logger.log('エラー: ' + e.message);
    }

    // Phase 4: ERP統合シート作成
    Logger.log('\n--- Phase 4: ERP統合シート作成 ---');
    try {
      const erpResult = initializeERPIntegration();
      if (erpResult.success) {
        results.success.push(...erpResult.createdSheets);
      } else {
        results.errors.push('ERP統合: ' + erpResult.message);
      }
    } catch (e) {
      results.errors.push('ERP統合: ' + e.message);
      Logger.log('エラー: ' + e.message);
    }

    // 結果サマリー
    Logger.log('\n========================================');
    Logger.log('CRMシート類の一括作成が完了');
    Logger.log('========================================');
    Logger.log('成功: ' + results.success.length + '個のシート');
    Logger.log('失敗: ' + results.errors.length + '個のシート');

    if (results.errors.length > 0) {
      Logger.log('\nエラー詳細:');
      results.errors.forEach(function(err) { Logger.log('  - ' + err); });
    }

    Logger.log('\n重要な次のステップ:');
    Logger.log('1. スプレッドシートを開いて各「同期」シートを確認');
    Logger.log('2. IMPORTRANGEの「#REF!」エラーが表示されている場合、アクセス許可を承認');
    Logger.log('3. 承認後、数秒でSCM/ERPからデータが自動同期されます');

    return results;

  } catch (error) {
    Logger.log('致命的エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: '致命的エラー: ' + error.message,
      error: error.toString()
    };
  }
}

// ============================================================
// ERP統合: Group A - Header-based Sheets
// ============================================================

/**
 * 見積書管理シートを初期化
 */
function initializeQuotesSheet(ss) {
  const sheetName = CONFIG.SHEETS.QUOTES;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headers = HEADERS.QUOTES;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * 見積書明細シートを初期化
 */
function initializeQuoteItemsSheet(ss) {
  const sheetName = CONFIG.SHEETS.QUOTE_ITEMS;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headers = HEADERS.QUOTE_ITEMS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#34A853')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * 顧客マスタ（M_Customer）シートを初期化
 */
function initializeCustomerMasterSheet(ss) {
  const sheetName = CONFIG.SHEETS.CUSTOMER_MASTER;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headers = HEADERS.CUSTOMER_MASTER;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9C27B0')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

// ============================================================
// ERP統合: Group B - IMPORTRANGE Sync Sheets
// ============================================================

/**
 * Stock List同期シートを初期化（ERP: Stock List）
 */
function initializeStockSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.STOCK_LIST_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "Stock List!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: Stock Listシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * M_Product同期シートを初期化（ERP: M_Product）
 */
function initializeProductSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.PRODUCT_MASTER_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "M_Product!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: M_Productシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * M_Zones同期シートを初期化（ERP: M_Zones）
 */
function initializeZonesSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.ZONES_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "M_Zones!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: M_Zonesシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * FedEx料金表同期シートを初期化（ERP: FedEx_ShippingRates）
 */
function initializeFedExRatesSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.FEDEX_RATES_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "FedEx_ShippingRates!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: FedEx_ShippingRatesシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * DHL料金表同期シートを初期化（ERP: DHL_ShippingRates）
 */
function initializeDHLRatesSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.DHL_RATES_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "DHL_ShippingRates!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: DHL_ShippingRatesシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}

/**
 * UPS料金表同期シートを初期化（ERP: UPS_ShippingRates）
 */
function initializeUPSRatesSyncSheet(ss, erpId) {
  const sheetName = CONFIG.SHEETS.UPS_RATES_SYNC;
  Logger.log(`初期化中: ${sheetName}`);

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const formula = `=IMPORTRANGE("${erpId}", "UPS_ShippingRates!A:Z")`;
  sheet.getRange('A1').setFormula(formula);

  sheet.getRange('A1').setNote(
    'ERPから自動同期されます。\n' +
    '同期元: UPS_ShippingRatesシート\n' +
    '更新間隔: 30秒〜30分\n' +
    '手動編集不可（自動上書きされます）'
  );

  const protection = sheet.protect().setDescription('ERP同期シート（読み取り専用）');
  protection.setWarningOnly(true);

  Logger.log(`✅ ${sheetName} の初期化完了`);
}
