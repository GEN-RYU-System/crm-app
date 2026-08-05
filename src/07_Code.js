/**
 * CRM ダッシュボード - メインエントリーポイント
 */

/**
 * スプレッドシート起動時にカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // CRMメニュー
  ui.createMenu('🎯 CRM')
    .addSubMenu(ui.createMenu('📋 初期設定')
      .addItem('🔧 全シート初期設定', 'initializeSpreadsheet')
      .addSeparator()
      .addItem('🎯 目標設定シート初期化', 'initializeGoalsSheetFromMenu')
      .addItem('🔐 権限設定シート初期化', 'initializePermissionsSheetFromMenu'))
    .addSeparator()
    .addItem('➡️ アサイン移行（選択シート）', 'menuRunAssignMigration')
    .addSeparator()
    .addItem('📦 選択行をアーカイブ', 'manualArchive')
    .addItem('♻️ アーカイブから復元', 'restoreFromArchive')
    .addSeparator()
    .addItem('🔄 見込度を再計算（全件）', 'recalculateAllProspectRanks')
    .addSeparator()
    .addSubMenu(ui.createMenu('📢 PMO通知')
      .addItem('🔔 テスト通知を送信', 'sendTestNotification')
      .addItem('✅ 作業完了通知を送信', 'promptWorkCompletionNotification')
      .addItem('📋 週次レビュー通知を送信', 'sendWeeklyReviewReminder')
      .addSeparator()
      .addItem('🕐 通知トリガー設定', 'setupNotificationTriggers')
      .addItem('🗑️ 通知トリガー削除', 'removeNotificationTriggers')
      .addSeparator()
      .addItem('⚙️ 通知プロパティ設定', 'setPmoNotificationProperties'))
    .addSubMenu(ui.createMenu('⚙️ 設定')
      .addItem('📊 トリガーをセットアップ', 'setupAllTriggers')
      .addItem('🗑️ 全トリガーを削除', 'deleteAllTriggers')
      .addItem('📋 トリガー一覧を表示', 'listAllTriggers')
      .addSeparator()
      .addItem('🔄 プルダウン設定を反映', 'refreshDropdownSettings')
      .addItem('🔄 設定を更新（差分のみ追加）', 'updateSettingsSheetFromMenu')
      .addItem('🔃 設定を強制リセット（全削除）', 'resetSettingsSheetFromMenu'))
    .addSeparator()
    .addItem('🌐 Webアプリを開く', 'openWebApp')
    .addToUi();

  // 請求書メニュー（gas/メニューr.jsから統合）
  ui.createMenu("請求書")
    .addItem("📝請求書発行", "transferAndGeneratePDF")
    .addSeparator()
    .addItem("⏪請求書差し戻し", "revertSalesToInput")
    .addToUi();

  // 仕入れメニュー（gas/メニューr.jsから統合）
  ui.createMenu('仕入れ')
    .addItem('📥 選択行を転記', 'transferSelectedToPurchaseList')
    .addSeparator()
    .addItem('📋 ログを確認', 'showLog')
    .addToUi();

  // 発送メニュー（gas/メニューr.jsから統合）
  ui.createMenu("発送")
    .addItem("🛫elogiラベル作成", "generateElogiCSV")
    .addSeparator()
    .addItem("📦発送通知", "transferDataToShippingNotice")
    .addToUi();

  // データ転記メニュー
  ui.createMenu('📦 データ転記')
    .addItem('★ 全シート順次転記', 'transferAllSheetsSequentially')
    .addSeparator()
    .addItem('1. UPS送料表', 'transfer_UPS_ShippingRates')
    .addItem('2. DHL送料表', 'transfer_DHL_ShippingRates')
    .addItem('3. FedEx送料表', 'transfer_FedEx_ShippingRates')
    .addItem('4. 地帯表', 'transfer_M_Zones')
    .addItem('5. 請求書フォーマット', 'transfer_InvoiceFormat')
    .addItem('6. 📝請求書作成', 'transfer_InvoiceCreate')
    .addItem('7. 📊売上データ', 'transfer_SalesData')
    .addItem('8. Stock List', 'transfer_StockList')
    .addItem('9. M_Product', 'transfer_M_Product')
    .addItem('10. M_Customer', 'transfer_M_Customer')
    .addItem('11. Commercial Invoice', 'transfer_CommercialInvoice')
    .addToUi();
}

/**
 * Webアプリを開く（環境対応版に委譲）
 * 実装は gas/08_Config_WebAppURL.js を参照
 */
function openWebApp() {
  openWebApp_EnvAware();
}

/**
 * メニューから実行するためのラッパー関数
 */
function menuRunAssignMigration() {
  runAssignMigration();
}

/**
 * プルダウン設定を反映（キャッシュクリア + 入力規則再設定）
 */
function refreshDropdownSettings() {
  const ui = SpreadsheetApp.getUi();

  // キャッシュをクリア
  clearDropdownCache();

  // 入力規則を再設定
  const ss = getSpreadsheet();
  setDataValidations(ss);

  ui.alert('完了', 'プルダウン設定を反映しました。\n設定シートの変更がスプレッドシートに適用されました。', ui.ButtonSet.OK);
}
