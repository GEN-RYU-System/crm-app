# GAS シートアクセス整理 — シート参照調査レポート

## 調査基準 SHA

```
96b030391d5a415bd3cfe972968e7cc9552e268e 2026-08-30 02:47:20 +0900
ブランチ: develop
状態: クリーン（src/ 変更なし。docs/gas-cleanup-proposal.md が未コミット新規ファイルとして存在）
前回調査(gas-cleanup-proposal.md)の基準SHA と一致 ✓
```

---

## 2-1. ERP_CONFIG の定義有無

### 確認コマンドと結果

```bash
grep -rn "ERP_CONFIG" src/ --include="*.js" | grep -vE "ERP_CONFIG\.[A-Za-z]"
# → src/Config.js:37:const ERP_CONFIG = {
```

**結論: `ERP_CONFIG` は `src/Config.js:37` に定義されている。**

### ERP_CONFIG の内容（src/Config.js:37〜103）

`SPREADSHEET_ID: null`（定義上 null。`getSheetByConfig` は `SpreadsheetApp.getActiveSpreadsheet()` を使用）

| ERP_CONFIG.SHEETS キー | シート名（NAME 値） | GID（ID 値） |
|----------------------|-----------------|------------|
| CONFIG | ⚙️設定 | 1159512127 |
| PRODUCT_MASTER | M_商品 | 548021217 |
| CUSTOMER_MASTER | M_顧客 | 884228295 |
| SUPPLIER_MASTER | M_仕入先 | 580576840 |
| INVENTORY | 📦在庫 | [GID省略] |
| VIEWER_SUPPLIER_STOCK | 📦仕入在庫参照 | 1186337887 |
| INVOICE_INPUT | 📝請求書作成 | [GID省略] |
| INVOICE_TEMPLATE | フォーマット | 74688869 |
| SALES_DATA | 📊売上データ | 600397303 |
| LEDGER | 🗃️古物台帳 | [GID省略] |
| PURCHASE_LIST | 📋仕入れリスト | 1123262060 |
| RAW_FORM_RESPONSES | raw_顧客回答 | 0 |
| SHIPPING_FEDEX | FedEx_ShippingRates | 264167304 |
| SHIPPING_DHL | DHL_ShippingRates | [GID省略] |
| SHIPPING_UPS | UPS_ShippingRates | 1195813452 |
| ZONES | M_Zones | 833993881 |
| SYSTEM_AGENTS | 90_SystemAgents | （ID未設定） |
| SYSTEM_SPECS | 91_SystemSpecs | （ID未設定） |
| SYSTEM_CHANGELOG | 99_Changelog | （ID未設定） |

`getSheetByConfig` は GID → NAME の順でシートを探す（src/Config.js:108-115）。

---

## 2-2. 重複定義関数の一覧

```bash
grep -rhoE "^function [A-Za-z0-9_]+" src/ --include="*.js" | sort | uniq -d
```

35件の重複を検出。以下に全件の定義元を記載する。

**【未確認：どちらが有効か】** GAS は全ファイルが1つの名前空間で、読み込み順に依存するため、コードだけではどちらが実際に呼ばれているかを確定できない。

| 関数名 | 定義ファイル（行） |
|-------|-----------------|
| `addConversationLog` | src/27_WebApp.js:4526 / src/10_ConversationLogService.js:192 |
| `addLeadSourceIdColumn` | src/14_DevEnvironmentService.js:344 / src/99_DevLeadSourceIdMigration.js:30 |
| `addStaff` | src/27_WebApp.js:2343 / src/32_StaffService.js:240 |
| `archiveOnStatusChange` | src/02_ArchiveService.js:25（`e` 引数） / src/09_ConversationArchiveService.js:351（`leadId, newStatus` 引数）※シグネチャが異なる |
| `checkCurrentEnvironment` | src/00_SetupEnvironment.js:63 / src/checkEnv.js:1 |
| `createConversationLogSheet` | src/21_SetupDealReport.js:227（引数: `ss`） / src/10_ConversationLogService.js:30（引数: `ss, sheetName, headerColor`）※シグネチャが異なる |
| `createDealReportSheet` | src/21_SetupDealReport.js:98 / src/13_DealReportService.js:451 |
| `deleteRole` | src/37_PermissionManagementService.js:205 / src/27_WebApp.js:2223 |
| `deleteStaff` | src/27_WebApp.js:2417 / src/32_StaffService.js:307 |
| `dryRunIpIdsMigration` | src/99_DevIpIdsMigration.js:81 / src/99_DevIpIdsDryRun.js:24 |
| `exportConversationLogSampleCSV` | src/27_WebApp.js:6126 / src/29_CSVExportService.js:120 |
| `exportCustomerMasterSampleCSV` | src/27_WebApp.js:6204 / src/29_CSVExportService.js:104 |
| `exportLeadsSampleCSV` | src/27_WebApp.js:5975 / src/29_CSVExportService.js:88 |
| `generateNextLeadId` | src/30_CSVImportService.js:107 / src/23_SheetService.js:556 |
| `generateNextLogId` | src/30_CSVImportService.js:186（引数なし） / src/10_ConversationLogService.js:156（引数: `sheetName`）※シグネチャが異なる |
| `generateQuoteId` | src/11_QuoteService.js:15 / src/11_Quote.js:514（引数: `sheet`）※シグネチャが異なる |
| `generateQuotePDF` | src/27_WebApp.js:7237（引数なし） / src/11_Quote.js:480（引数: `quoteId`）※シグネチャが異なる |
| `generateReportId` | src/20_ReportService.js:273（引数: `sheet, prefix`） / src/13_DealReportService.js:170（引数なし）※シグネチャが異なる |
| `getGoals` | src/27_WebApp.js:2465（引数: `staffId`） / src/05_BuddyCoachingService.js:185（引数: `staffId, period`）※シグネチャが異なる |
| `getHeaderIndexMap` | src/23_SheetService.js:822 / src/00_DataHelpers.js:181 |
| `getSheetByGid` | src/27_WebApp.js:7382 / src/CRM作成.js:183 / src/elogiCSV出力.js:119 / src/00_DataHelpers.js:214 / src/write_verification_results.js:4（5重複） |
| `getStaffFullName` | src/27_WebApp.js:6594（引数なし） / src/12_DashboardService.js:417（引数: `staff`） / src/35_SalesDataSyncService.js:52（引数: `emailOrId, staffSheet, staffMapping`）※シグネチャが異なる（3重複） |
| `getStaffList` | src/27_WebApp.js:1291 / src/32_StaffService.js:10 |
| `include` | src/27_WebApp.js:319 / src/Code.js:56 |
| `initializeGoalsSheet` | src/01_Initialize.js:198 / src/23_SheetService.js:153 |
| `initializeGoalsSheetFromMenu` | src/01_Initialize.js:438 / src/23_SheetService.js:196 |
| `initializePermissionsSheet` | src/01_Initialize.js:174 / src/23_SheetService.js:113 |
| `initializePermissionsSheetFromMenu` | src/01_Initialize.js:447 / src/23_SheetService.js:229 |
| `initializeSettingsSheet` | src/01_Initialize.js:150 / src/23_SheetService.js:96 |
| `menuRunAssignMigration` | src/03_AssignService.js:136 / src/07_Code.js:97 |
| `saveBuddyDialogLog` | src/05_BuddyCoachingService.js:785（引数: `staffId, userMessage, buddyResponse, mode, conversationLog`） / src/13_DealReportService.js:253（引数: `staffId, userInput, buddyResponse, context, emotionAnalysis`）※シグネチャが異なる |
| `saveDealReport` | src/27_WebApp.js:3416 / src/13_DealReportService.js:18 |
| `saveWeeklyReport` | src/20_ReportService.js:98（引数: `staffId, targetWeek, reportData`） / src/05_BuddyCoachingService.js:545（引数: `reportData`）※シグネチャが異なる |
| `sendDiscordNotification` | src/27_WebApp.js:3793（引数: `webhookUrl, message`） / src/CRM作成.js:156（引数: `id, name, email, timestamp`）※シグネチャが異なる |
| `translateAndAddLog` | src/27_WebApp.js:4595 / src/10_ConversationLogService.js:521 |
| `updateStaff` | src/27_WebApp.js:2372 / src/32_StaffService.js:98 |

---

## 2-3. 参照シート名の全件抽出（パターン別）

### パターン1: 文字列リテラル（主要なもの）

```bash
grep -rnoE "getSheetByName\(['\"][^'\"]+['\"]\)" src/ --include="*.js"
```

旧ERP系ファイル分のみ抜粋（現行ファイルは2-4でまとめて記載）:

| ファイル | シート名（文字列リテラル） | 行 |
|---------|----------------------|---|
| src/発送通知.js | 📊売上データ | 3 |
| src/発送通知.js | CRM | 4 |
| src/発送通知.js | 発送通知作業用 | 5 |
| src/発送通知.js | 📤発送通知 | 7 |
| src/仕入れ転記.js | ImportLog | 173 |

### パターン2: CONFIG.SHEETS 経由（現行系）

```bash
grep -rnoE "getSheetByName\(CONFIG\.SHEETS\.[A-Za-z0-9_]+\)" src/ --include="*.js"
```

（2-4 のファイル別一覧にシート名の実値を記載）

### パターン3: ERP_CONFIG / getSheetByConfig 経由（旧ERP系）

```bash
grep -rnoE "getSheetByConfig\([^)]+\)" src/ --include="*.js"
grep -rnoE "ERP_CONFIG\.SHEETS\.[A-Za-z0-9_]+" src/ --include="*.js" | sort -u
```

| ファイル | ERP_CONFIG キー | 実際のシート名 | 行 |
|---------|---------------|-------------|---|
| src/見積もりページ.js | ZONES | M_Zones | 5, 24 |
| src/見積もりページ.js | SHIPPING_FEDEX | FedEx_ShippingRates | 19 |
| src/見積もりページ.js | SHIPPING_DHL | DHL_ShippingRates | 20 |
| src/見積もりページ.js | SHIPPING_UPS | UPS_ShippingRates | 21 |
| src/見積もりページ.js | carrier.config（変数） | 【未確認：実行時依存】 | 29 |
| src/仕入れ転記.js | PURCHASE_LIST | 📋仕入れリスト | 72 |
| src/仕入れ転記.js | PRODUCT_MASTER | M_商品 | 96 |
| src/仕入れ転記.js | SALES_DATA | 📊売上データ | 10（参照のみ） |
| src/請求書発行.js | INVOICE_INPUT | 📝請求書作成 | 573 |
| src/請求書発行.js | INVOICE_TEMPLATE | フォーマット | 591, 592, 595 |
| src/CRM作成.js | RAW_FORM_RESPONSES | raw_顧客回答 | 16 |
| src/CRM作成.js | CUSTOMER_MASTER | M_顧客 | 17 |
| src/在庫ページ.js | VIEWER_SUPPLIER_STOCK | 📦仕入在庫参照 | 3 |

### getSheetByGid による参照（GID → シート名が不明なもの）

```bash
grep -rnoE "getSheetByGid\([^,)]+,\s*[^)]+\)" src/ --include="*.js"
```

| ファイル | GID 値または参照先 | 推定シート名 | 行 |
|---------|-----------------|------------|---|
| src/27_WebApp.js | PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID | **【未確認：gid→シート名】** | 7415 |
| src/27_WebApp.js | PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID | **【未確認：gid→シート名】** | 7419 |
| src/35_SalesDataSyncService.js | PRODUCTION_IDS.INVOICE_CREATION_SHEET_GID | **【未確認：gid→シート名】** | 202 |
| src/35_SalesDataSyncService.js | PRODUCTION_IDS.SALES_DATA_SHEET_GID | **【未確認：gid→シート名】** | 203 |
| src/elogiCSV出力.js | 600397303（ハードコード） | '📊売上データ'（ERP_CONFIG.SHEETS.SALES_DATA の ID と一致） | 15 |

**⚠️ 重要**: `PRODUCTION_IDS` は `src/` 内に定義が存在しない。  
（grep結果: `grep -rn "const PRODUCTION_IDS\|var PRODUCTION_IDS\|PRODUCTION_IDS =" src/ --include="*.js"` → 0件）  
→ PRODUCTION_IDS を使うコード（27_WebApp.js:7415 の `writeQuoteToSheetAndGeneratePDF` など）は、`PRODUCTION_IDS` が未定義のため実行時エラーになる可能性がある。【未確認：定義がどこかに存在するか PO 確認要】

---

## 2-4. ファイル別シート参照一覧

### CONFIG.SHEETS キーと実際のシート名の対応表

| CONFIG.SHEETS キー | 解決方法 | 実際のシート名 |
|-------------------|---------|-------------|
| SETTINGS | 静的（08_Config.js:65） | 選択肢マスタ |
| PERMISSIONS | 静的 | 権限設定 |
| GOALS | 静的 | 目標設定 |
| TEMPLATES | 静的 | テンプレート |
| WEEKLY_REPORT | 静的 | 週次レポート |
| MONTHLY_REPORT | 静的 | 月次レポート |
| SHIFT | 静的 | シフト |
| BUDDY_LOG | 静的 | Buddy対話ログ |
| CONVERSATION_LOG | 静的 | 会話ログ |
| TERM_DICTIONARY | 静的 | 専門用語辞書 |
| NOTICES | 静的 | お知らせ |
| READ_STATUS | 静的 | 既読管理 |
| FAQ | 静的 | FAQ |
| QUOTES | 静的 | 見積書管理 |
| QUOTE_ITEMS | 静的 | 見積書明細 |
| INVOICES | 静的 | 請求書管理 |
| INVOICE_ITEMS | 静的 | 請求書明細 |
| INVOICE_INPUT | 静的 | 📝請求書作成 |
| INVOICE_TEMPLATE | 静的 | フォーマット |
| SALES_DATA | 静的 | 📊売上データ |
| CUSTOMER_MASTER | 静的 | M_Customer |
| PRODUCT_MASTER_SYNC | 静的 | M_Product同期 |
| STOCK_LIST_SYNC | 静的 | Stock List同期 |
| ZONES_SYNC | 静的 | M_Zones同期 |
| FEDEX_RATES_SYNC | 静的 | FedEx_ShippingRates同期 |
| DHL_RATES_SYNC | 静的 | DHL_ShippingRates同期 |
| UPS_RATES_SYNC | 静的 | UPS_ShippingRates同期 |
| SALES_DATA_SYNC | 静的 | 📊売上データ同期 |
| SCM_STOCK_SYNC | 静的 | 集計同期 |
| SCM_SUPPLIER_MASTER_SYNC | 静的 | 仕入元マスタ同期 |
| LEADS | CoreSchema V1（LEADS.sheetName） | リード管理 |
| STAFF | CoreSchema V1（STAFF.sheetName） | 担当者マスタ |
| SCM_PRODUCT_MASTER_SYNC | CoreSchema V1（PRODUCTS.sheetName） | 商品マスタ同期 |
| CRM_CUSTOMERS | CoreSchema V1（CUSTOMERS.sheetName） | 顧客マスタ |
| CRM_SHIPPING | CoreSchema V1（SHIPPING_DESTINATIONS.sheetName） | 配送先マスタ |
| CRM_PAYMENT | CoreSchema V1（PAYMENT_DESTINATIONS.sheetName） | 支払先マスタ |
| ORDER_MASTER | CoreSchema V1（ORDERS.sheetName） | オーダー管理 |
| ORDER_LINES | CoreSchema V1（ORDER_LINES.sheetName） | オーダー明細 |
| SHIPMENT | CoreSchema V1（SHIPMENTS.sheetName） | 発送 |
| PURCHASE | CoreSchema V1（PURCHASES.sheetName） | 仕入れ |
| FORM_TOKENS | CoreSchema V1（FORM_TOKENS.sheetName） | フォームトークン |

### CONFIG.SHEETS に定義がないキー（コードが参照しているが解決できないもの）

以下のキーは `getSheetByName(undefined)` を呼ぶため、実行時に null が返る。

| 未定義キー | 参照しているファイル（主要なもの） |
|-----------|-------------------------------|
| BUDDY_CONVERSATION_LOG | src/01_Initialize.js:321 |
| CONVERSATION_LOG_DEAL | （grep で検索要） |
| CONVERSATION_LOG_LEAD | （grep で検索要） |
| DEALS | src/03_AssignService.js:27 |
| GLOSSARY | src/01_Initialize.js:369 |
| LEADS_GID | src/00_DataHelpers.js（grep で確認） |
| LEADS_IN | （grep で検索要） |
| LEADS_OUT | （grep で検索要） |
| NOTICE | （NOTICES と別キー）src/（grep で確認） |
| NOTIFICATION | src/17_NotificationService.js:16, 23 |
| PRODUCT_MASTER | （grep で確認） |
| PROMPT_CONFIG | src/34_PromptConfigService.js:15, 83, 204 |
| QUOTE_TEMPLATES | （grep で確認） |
| RAW_FORM_RESPONSES | （grep で確認） |
| SHIPPING_DHL | （grep で確認） |
| SHIPPING_FEDEX | （grep で確認） |
| SHIPPING_UPS | （grep で確認） |
| STAFF_MASTER | src/01_Initialize.js:129 / src/check_staff_registration.js:4 |
| SYSTEM_AGENTS | （ERP_CONFIG にあるが CONFIG.SHEETS にはない） |
| SYSTEM_CHANGELOG | （同上） |
| SYSTEM_SPECS | （同上） |
| TEMPLATE | src/01_Initialize.js:225 |
| TERM_DICTIONARY_GID | （grep で確認） |
| VIEWER_SUPPLIER_STOCK | （ERP_CONFIG にあるが CONFIG.SHEETS にはない）src/在庫ページ.js |
| ZONES | （ERP_CONFIG にあるが CONFIG.SHEETS にはない）src/見積もりページ.js |

### 旧ERP系ファイルのシート参照（本調査の中心）

| ファイル | 参照シート名 | 参照方式 | 行 | 備考 |
|---------|-----------|---------|---|------|
| src/見積もりページ.js | M_Zones | getSheetByConfig(ERP_CONFIG.SHEETS.ZONES) / GID優先 | 5, 24 | GID: 833993881 |
| src/見積もりページ.js | FedEx_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_FEDEX / GID優先 | 19 | GID: 264167304 |
| src/見積もりページ.js | DHL_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_DHL / GID優先 | 20 | GID: [省略] |
| src/見積もりページ.js | UPS_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_UPS / GID優先 | 21 | GID: 1195813452 |
| src/見積もりページ.js | 【未確認】 | carrier.config 変数経由 | 29 | 実行時にどのシートか決まる |
| src/仕入れ転記.js | 📋仕入れリスト | getSheetByConfig(ERP_CONFIG.SHEETS.PURCHASE_LIST) / GID優先 | 72 | GID: 1123262060 |
| src/仕入れ転記.js | M_商品 | getSheetByConfig(ERP_CONFIG.SHEETS.PRODUCT_MASTER) / GID優先 | 96 | GID: 548021217 |
| src/仕入れ転記.js | 📊売上データ | ERP_CONFIG.SHEETS.SALES_DATA 参照（シート取得ではなくデータ参照） | 10 | GID: 600397303 |
| src/仕入れ転記.js | ImportLog | getSheetByName('ImportLog')（文字列リテラル） | 173 | |
| src/請求書発行.js | 📝請求書作成 | getSheetByConfig(ERP_CONFIG.SHEETS.INVOICE_INPUT) / GID優先 | 573 | GID: [省略] |
| src/請求書発行.js | フォーマット | getSheetByConfig(ERP_CONFIG.SHEETS.INVOICE_TEMPLATE) / GID優先 | 591, 592, 595 | GID: 74688869 |
| src/発送通知.js | 📊売上データ | getSheetByName('📊売上データ')（文字列リテラル） | 3 | |
| src/発送通知.js | CRM | getSheetByName('CRM')（文字列リテラル） | 4 | |
| src/発送通知.js | 発送通知作業用 | getSheetByName('発送通知作業用')（文字列リテラル） | 5 | |
| src/発送通知.js | 📤発送通知 | getSheetByName('📤発送通知')（文字列リテラル） | 7 | |
| src/在庫ページ.js | 📦仕入在庫参照 | ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK / GID優先 | 3 | GID: 1186337887 |
| src/CRM作成.js | raw_顧客回答 | ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES / GID優先 | 16 | GID: 0（GID無効→NAME使用） |
| src/CRM作成.js | M_顧客 | ERP_CONFIG.SHEETS.CUSTOMER_MASTER / GID優先 | 17 | GID: 884228295 |
| src/elogiCSV出力.js | 📊売上データ | getSheetByGid(ss, 600397303)（GIDハードコード） | 15 | ERP_CONFIG.SALES_DATA.ID と一致 |

---

## 2-5. シート名一覧表（PO記入欄つき）

PO はスプレッドシートのシートタブを確認し、「実在するか」欄に ○ / × を記入してください。

### 旧ERP系ファイルが参照するシート

| シート名 | 参照方式 | 参照しているファイル | 実在するか（PO記入） |
|---------|---------|-------------------|-------------------|
| M_Zones | ERP_CONFIG.SHEETS.ZONES（GID: 833993881） | src/見積もりページ.js | 　 |
| FedEx_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_FEDEX（GID: 264167304） | src/見積もりページ.js | 　 |
| DHL_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_DHL（GID: [省略]） | src/見積もりページ.js | 　 |
| UPS_ShippingRates | ERP_CONFIG.SHEETS.SHIPPING_UPS（GID: 1195813452） | src/見積もりページ.js | 　 |
| 📋仕入れリスト | ERP_CONFIG.SHEETS.PURCHASE_LIST（GID: 1123262060） | src/仕入れ転記.js | 　 |
| M_商品 | ERP_CONFIG.SHEETS.PRODUCT_MASTER（GID: 548021217） | src/仕入れ転記.js | 　 |
| 📝請求書作成 | ERP_CONFIG.SHEETS.INVOICE_INPUT（GID: [省略]） | src/請求書発行.js / CONFIG.SHEETS.INVOICE_INPUT（現行系も参照） | 　 |
| フォーマット | ERP_CONFIG.SHEETS.INVOICE_TEMPLATE（GID: 74688869） | src/請求書発行.js / CONFIG.SHEETS.INVOICE_TEMPLATE（現行系も参照） | 　 |
| 📊売上データ | 複数（ERP_CONFIG.SHEETS.SALES_DATA / CONFIG.SHEETS.SALES_DATA / GID: 600397303） | src/発送通知.js / src/elogiCSV出力.js / 現行ファイル多数 | 　 |
| CRM | getSheetByName('CRM') 文字列リテラル | src/発送通知.js | 　 |
| 発送通知作業用 | getSheetByName('発送通知作業用') 文字列リテラル | src/発送通知.js | 　 |
| 📤発送通知 | getSheetByName('📤発送通知') 文字列リテラル | src/発送通知.js | 　 |
| 📦仕入在庫参照 | ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK（GID: 1186337887） | src/在庫ページ.js | 　 |
| raw_顧客回答 | ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES（GID: 0 → NAME使用） | src/CRM作成.js | 　 |
| M_顧客 | ERP_CONFIG.SHEETS.CUSTOMER_MASTER（GID: 884228295） | src/CRM作成.js | 　 |
| ImportLog | getSheetByName('ImportLog') 文字列リテラル | src/仕入れ転記.js | 　 |

### 現行系ファイルのみが参照するシート（参考）

| シート名 | CONFIG.SHEETS キー | 主な参照ファイル | 実在するか（PO記入） |
|---------|-------------------|----------------|-------------------|
| リード管理 | LEADS | src/27_WebApp.js 他多数 | 　 |
| 担当者マスタ | STAFF | src/27_WebApp.js 他多数 | 　 |
| 選択肢マスタ | SETTINGS | src/27_WebApp.js 他 | 　 |
| 権限設定 | PERMISSIONS | src/27_WebApp.js 他 | 　 |
| 目標設定 | GOALS | src/27_WebApp.js 他 | 　 |
| 週次レポート | WEEKLY_REPORT | src/20_ReportService.js 他 | 　 |
| 月次レポート | MONTHLY_REPORT | src/20_ReportService.js 他 | 　 |
| Buddy対話ログ | BUDDY_LOG | src/05_BuddyCoachingService.js 他 | 　 |
| 会話ログ | CONVERSATION_LOG | src/27_WebApp.js 他 | 　 |
| 専門用語辞書 | TERM_DICTIONARY | src/12_KnowledgeService.js 他 | 　 |
| お知らせ | NOTICES | src/16_NoticeService.js 他 | 　 |
| 既読管理 | READ_STATUS | src/16_NoticeService.js 他 | 　 |
| FAQ | FAQ | src/35_FAQService.js 他 | 　 |
| 見積書管理 | QUOTES / CoreSchema（見積もり管理） | src/27_WebApp.js 他 ※2種のシート名が混在している可能性あり | 　 |
| 見積もり管理 | CoreSchema V1（QUOTES.sheetName） | src/28_CoreQuoteApi.js 他 | 　 |
| 見積書明細 | QUOTE_ITEMS（静的） | src/11_Quote.js 他 | 　 |
| 見積もり明細 | CoreSchema V1（QUOTE_LINES.sheetName） | src/28_CoreQuoteApi.js 他 | 　 |
| 請求書管理 | INVOICES | src/27_WebApp.js 他 | 　 |
| オーダー管理 | ORDER_MASTER | src/27_WebApp.js 他 | 　 |
| オーダー明細 | ORDER_LINES | src/99_Phase7A.js 他 | 　 |
| 顧客マスタ | CRM_CUSTOMERS | src/18_CustomerRegistration.js 他 | 　 |
| 配送先マスタ | CRM_SHIPPING | src/18_CustomerRegistration.js 他 | 　 |
| 支払先マスタ | CRM_PAYMENT | src/18_CustomerRegistration.js 他 | 　 |
| 発送 | SHIPMENT | src/99_Phase5B.js 他 | 　 |
| 仕入れ | PURCHASE | src/99_Phase5BConfirm.js 他 | 　 |
| M_Customer | CUSTOMER_MASTER（静的） | src/30_CSVImportService.js 他 | 　 |
| 商品マスタ同期 | SCM_PRODUCT_MASTER_SYNC / PRODUCTS | src/28_SharedInventoryReadApi.js 他 | 　 |
| 作品マスタ_共用在庫 | getSheetByName 文字列リテラル | src/27_WebApp.js:601 / src/28_SharedInventoryReadApi.js:50 他 | 　 |
| 共用在庫 | getSheetByName 文字列リテラル | src/28_SharedInventoryReadApi.js:70 他 | 　 |
| 集計同期 | SCM_STOCK_SYNC | src/27_WebApp.js:8185（デバッグ用） | 　 |
| 仕入元マスタ同期 | SCM_SUPPLIER_MASTER_SYNC | src/99_StaffMasterDump.js:1071 | 　 |
| M_Zones同期 | ZONES_SYNC | src/13_Shipping.js:126 / src/99_StaffMasterDump.js:1071 | 　 |
| 国マスタ | getSheetByName 文字列リテラル | src/17_CountryMaster.js / src/28_CoreLeadFormOptionsApi.js:62 他 | 　 |
| 見積もり作成 | getSheetByName 文字列リテラル | src/27_WebApp.js:6314 | 　 |
| 見積もり_PDF出力 | getSheetByName 文字列リテラル | src/27_WebApp.js:7242 | 　 |
| 商談レポート | getSheetByName 文字列リテラル | src/27_WebApp.js:3420, 3426 | 　 |
| ログイン履歴 | getSheetByName 文字列リテラル | src/27_WebApp.js:3544〜3605 | 　 |
| メッセージテンプレート | getSheetByName 文字列リテラル | src/36_MessageTemplateService.js:425 | 　 |
| 目標設定_壁打ち | getSheetByName 文字列リテラル | src/05_BuddyCoachingService.js:34〜267 | 　 |
| Buddy日替わりメッセージ | getSheetByName 文字列リテラル | src/05_BuddyCoachingService.js:1955〜2476 | 　 |
| Buddy Feedback Log | getSheetByName 文字列リテラル | src/30_BuddyFeedbackLogger.js:90〜203 | 　 |
| BuddyKnowledge | getSheetByName 文字列リテラル | src/30_BuddyFeedbackLogger.js:16 | 　 |
| 会話ログ（商談用） | getSheetByName 文字列リテラル | src/28_CoreInboxApi.js:344-345 / src/00_DataHelpers.js:51,107 | 　 |
| 🔍列定義検証結果 | getSheetByName 文字列リテラル | src/write_verification_results.js:21 | 　 |
| フォームトークン | FORM_TOKENS | src/18_CustomerRegistration.js 他 | 　 |
| 🗃️古物台帳 | getSheetByName 文字列リテラル | src/01_Initialize.js:667 | 　 |
| シフト | SHIFT | src/24_ShiftService.js 他 | 　 |
| KPI管理・PDSサイクル | getSheetByName 文字列リテラル | src/28_AnalyticsEngine.js:179 | 　 |

---

## 【未確認】項目の一覧

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | `PRODUCTION_IDS` の定義場所。src/ 内には存在しない。定義がなければ `writeQuoteToSheetAndGeneratePDF`（27_WebApp.js:7415）等が実行時エラーになる | PO がスクリプトエディタ全体を検索、またはコード実行を試みる |
| 2 | `PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID` → 実際のシート名 | PO がスクリプトエディタで値を確認 |
| 3 | `PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID` → 実際のシート名 | 同上 |
| 4 | `PRODUCTION_IDS.INVOICE_CREATION_SHEET_GID` → 実際のシート名 | 同上 |
| 5 | `PRODUCTION_IDS.SALES_DATA_SHEET_GID` → 実際のシート名 | 同上 |
| 6 | 見積もりページ.js の `carrier.config`（変数経由のシート参照）→ 実行時に何のシートが返るか | src/見積もりページ.js のコードを確認（本調査では全文未読） |
| 7 | `CONFIG.SHEETS` に定義がない24のキー（DEALS, PROMPT_CONFIG, NOTIFICATION 等）を参照しているコードが実際にエラーになっているか | GAS エディタで実行してエラーログを確認 |
| 8 | `CONFIG.SHEETS.QUOTES`（静的値 '見積書管理'）と CoreSchema V1 QUOTES テーブル（'見積もり管理'）の2種のシート名が混在しているが、両方が実在するか | PO がスプレッドシートのシートタブを確認 |
| 9 | `ERP_CONFIG.SPREADSHEET_ID` が null のため、旧ERP系コードが `getActiveSpreadsheet()` を使う → 実行されたとき、どのスプレッドシートに対して操作するのか | PO がスクリプトを実行する環境（スクリプトエディタ上か、Webアプリ経由か）を確認 |

---

## 読んだファイル / 未読ファイルの一覧

| ファイル | 状態 |
|---------|------|
| src/Config.js | 全文読了（160行） |
| src/08_Config.js | 行58〜237を読了（SHEETS定義部分） |
| src/00_CoreSchemaRegistry.js | 行0〜182を読了（テーブル定義部分） |
| src/26_DeploymentInfo.js | 先頭30行のみ読了 |
| src/見積もりページ.js | 未読（grep のみ） |
| src/仕入れ転記.js | 未読（grep のみ） |
| src/請求書発行.js | 未読（grep のみ） |
| src/発送通知.js | 未読（grep のみ） |
| src/在庫ページ.js | 未読（grep のみ） |
| src/CRM作成.js | 先頭20行のみ読了、行183周辺を確認 |
| src/elogiCSV出力.js | 先頭5行と行119周辺のみ確認 |
| src/27_WebApp.js | 行7400〜7420, 7576〜7582 周辺のみ確認 |
| src/35_SalesDataSyncService.js | 行200〜205のみ確認 |
| 上記以外の src/ ファイル | 未読（grep・ファイル名のみ） |

---

*src/ 配下のファイルの変更は行っていない。*
