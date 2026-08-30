# GAS シートアクセス整理 — 調査提案書

## 調査基準 SHA

```
96b030391d5a415bd3cfe972968e7cc9552e268e 2026-08-30 02:47:20 +0900
ブランチ: develop
状態: クリーン（未コミット変更なし）
```

---

## 3-1. 先行調査数値の再検証

### SpreadsheetApp を含むファイル数

```bash
grep -rl "SpreadsheetApp" src/ | wc -l
# → 54
```

**先行調査値(54)と一致 ✓ → 3-1 合格**

### 先行調査の「293」について

```
先行調査値: 27_WebApp.js の直接呼び出し 293回で最大（元の計測コマンド記録なし）
判定: 【定義不明・検証不能】
```

元のコマンドが記録されていないため、何を計測した値かが特定できない。
参考として、以下の実測値を記録する。

| コマンド | 実測値 |
|---------|--------|
| `grep -c "SpreadsheetApp" src/27_WebApp.js` | 2 |
| `grep -Ec "\.getRange\(|\.getValues\(|\.getValue\(|\.setValues\(|\.setValue\(|\.appendRow\(" src/27_WebApp.js` | 289 |
| `grep -Ec "\.getRange\(|\.getValues\(|\.getValue\(|\.setValues\(|\.setValue\(|\.appendRow\(|\.getLastRow\(|\.insertRow\(|\.deleteRow\(" src/27_WebApp.js` | 343 |
| `grep -roh "SpreadsheetApp" src/` （全体マッチ数） | 236 |

289 が先行調査値 293 に最も近い。差 4 の原因は確認できていない。

### 3-1 追加確認: 27_WebApp.js の SpreadsheetApp 2箇所

`grep -n "SpreadsheetApp" src/27_WebApp.js` → 行 7566, 8184

---

**1箇所目 — 行 7566**（読んだ行: 7556〜7576）

```javascript
SpreadsheetApp.flush();
```

- 関数: `writeQuoteToSheetAndGeneratePDF`
- 用途: シート書き込み後に再計算を強制する静的呼び出し
- オブジェクト取得: なし（戻り値を変数に代入していない）
- 使い回し: 0回

---

**2箇所目 — 行 8184**（読んだ行: 8174〜8268）

```javascript
var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);  // 行8184
var syncSheet = ss.getSheetByName(CONFIG.SHEETS.SCM_STOCK_SYNC);  // 行8185
```

- 関数: `checkImportRangeFormula`（コメントに「デバッグ: IMPORTRANGE数式を確認」）
- `ss` の使い回し: **1回のみ**（行8185 の getSheetByName のみ）
- `syncSheet` の使い回し: 行8186, 8199, 8200, 8233, 8234 で計 5回
- 性質: デバッグ専用関数。フロントから呼び出されていない（後述の3-2参照）

---

## 3-2. フロント呼び出し関数一覧

全呼び出しは `frontend/src/gas/client.ts` に集約。gasAdapter ファイル群は client.ts をラップするだけで、直接 GAS 呼び出しはしていない。

確認コマンド:
```bash
grep -rn "google\.script\.run" frontend/src/  # → gasRunnerMock.ts のコメントのみ
grep -rhoE "run\(['\"][A-Za-z0-9_]+['\"]" frontend/src/ | sort -u  # → 0件
grep -rhoE "google\.script\.run\.[A-Za-z0-9_]+" frontend/src/ | sort -u  # → 0件
grep -rn "google\.script\.run\|runner\." frontend/src/ --include="*.ts" --include="*.tsx" | grep -v client.ts | grep -v gasRunnerMock  # → 0件
```

呼び出し形式は全て `runner.withSuccessHandler(…).withFailureHandler(…).GAS関数名(引数)` のチェーン記法。

### フロント呼び出し関数一覧（44件）

| # | GAS 関数名 | 呼び出し元ファイル | 行 |
|---|-----------|-----------------|---|
| 1 | `getDashboardKPIs` | frontend/src/gas/client.ts | 50 |
| 2 | `getCurrentUser` | frontend/src/gas/client.ts | 69 |
| 3 | `getLeadsByType` | frontend/src/gas/client.ts | 88 |
| 4 | `getLeadsBatchForFrontend` | frontend/src/gas/client.ts | 111 |
| 5 | `getLeadDetail` | frontend/src/gas/client.ts | 133 |
| 6 | `createLead` | frontend/src/gas/client.ts | 151 |
| 7 | `updateLead` | frontend/src/gas/client.ts | 169 |
| 8 | `getCoreCustomersForFrontend` | frontend/src/gas/client.ts | 187 |
| 9 | `getCoreCustomerForFrontend` | frontend/src/gas/client.ts | 209 |
| 10 | `getCoreAllCustomerAggregatesForFrontend` | frontend/src/gas/client.ts | 227 |
| 11 | `getCoreStaffForFrontend` | frontend/src/gas/client.ts | 245 |
| 12 | `getCoreStaffMemberForFrontend` | frontend/src/gas/client.ts | 267 |
| 13 | `loginWithPassword` | frontend/src/gas/client.ts | 293 |
| 14 | `logout` | frontend/src/gas/client.ts | 305 |
| 15 | `getSessionUser` | frontend/src/gas/client.ts | 317 |
| 16 | `changeOwnPasswordForFrontend` | frontend/src/gas/client.ts | 329 |
| 17 | `getSharedInventoryForFrontend` | frontend/src/gas/client.ts | 369 |
| 18 | `getCoreQuotesForFrontend` | frontend/src/gas/client.ts | 439 |
| 19 | `getCoreQuoteForFrontend` | frontend/src/gas/client.ts | 455 |
| 20 | `getCoreOrderDetailForFrontend` | frontend/src/gas/client.ts | 564 |
| 21 | `confirmCoreOrderPaymentForFrontend` | frontend/src/gas/client.ts | 579 |
| 22 | `getCoreOrdersForFrontend` | frontend/src/gas/client.ts | 594 |
| 23 | `getCoreOrdersBatchForFrontend` | frontend/src/gas/client.ts | 613 |
| 24 | `getCoreOrderStatusOptionsForFrontend` | frontend/src/gas/client.ts | 633 |
| 25 | `getLeadOptionsForFrontend` | frontend/src/gas/client.ts | 657 |
| 26 | `getCoreCurrenciesForFrontend` | frontend/src/gas/client.ts | 672 |
| 27 | `createCoreQuoteForFrontend` | frontend/src/gas/client.ts | 711 |
| 28 | `updateCoreQuoteForFrontend` | frontend/src/gas/client.ts | 728 |
| 29 | `getInventoryBatchForFrontend` | frontend/src/gas/client.ts | 764 |
| 30 | `getInventoryProductOptions` | frontend/src/gas/client.ts | 778 |
| 31 | `getInventoryConditions` | frontend/src/gas/client.ts | 792 |
| 32 | `checkSyncSignals` | frontend/src/gas/client.ts | 816 |
| 33 | `createCoreOrderForFrontend` | frontend/src/gas/client.ts | 835 |
| 34 | `updateCoreOrderForFrontend` | frontend/src/gas/client.ts | 852 |
| 35 | `getLeadFormOptions` | frontend/src/gas/client.ts | 887 |
| 36 | `getCoreIssuerForFrontend` | frontend/src/gas/client.ts | 907 |
| 37 | `getInboxConversationsForFrontend` | frontend/src/gas/client.ts | 921 |
| 38 | `getInboxConversationDetailForFrontend` | frontend/src/gas/client.ts | 936 |
| 39 | `pingForLatencyCheck` | frontend/src/gas/client.ts | 947 |
| 40 | `getInboxBulkInitialLoad` | frontend/src/gas/client.ts | 961 |
| 41 | `getInboxMoreMessages` | frontend/src/gas/client.ts | 976 |
| 42 | `updateCoreIssuerForFrontend` | frontend/src/gas/client.ts | 994 |
| 43 | `getCorePurchaseStatusOptionsForFrontend` | frontend/src/gas/client.ts | 1025 |
| 44 | `upsertCorePurchaseForFrontend` | frontend/src/gas/client.ts | 1038 |

---

## 3-3. GAS 側の到達経路

### a. Web エントリ

```bash
grep -rn "function doGet\|function doPost" src/
```

| ファイル | 行 | 関数名 | 状態 |
|---------|-----|-------|------|
| src/27_WebApp.js | 12 | `doGet` | 現役（本番エントリ） |
| src/27_WebApp.js | 228 | `doPost` | 現役（Webhookエントリ） |
| src/Code.js | 7 | `doGet_ERP_DISABLED` | 無効化済み（関数名がリネームされている） |

### b. コード内トリガー登録

```bash
grep -rn "ScriptApp.newTrigger\|\.timeBased()\|\.forSpreadsheet(" src/
```

| ファイル | 登録される関数 | トリガー種別 |
|---------|-------------|------------|
| src/00_TriggerSetup.js:63-64 | `testEnvironmentCheck` | timeBased |
| src/00_TriggerSetup.js:84-85 | `onEditTrigger` | forSpreadsheet |
| src/00_TriggerSetup.js:92-93 | `checkAndRemind` | timeBased |
| src/00_TriggerSetup.js:100-101 | `runMonthlyArchive` | timeBased |
| src/00_TriggerSetup.js:110-111 | `checkDataVolume` | timeBased |
| src/00_TriggerSetup.js:124-125 | `generateDailyReport` | timeBased（※未実装stub） |
| src/00_TriggerSetup.js:134-135 | `generateWeeklyReport` | timeBased |
| src/00_TriggerSetup.js:144-145 | `backupData` | timeBased |
| src/01_AlertService.js:348-349 | `runDailyAlertCheck` | timeBased |
| src/01_AlertService.js:355-356 | `runHourlyAlertCheck` | timeBased |
| src/05_BuddyCoachingService.js:2458-2459 | `generateDailyBuddyMessagesForAll` | timeBased |
| src/11_DailyReportService.js:656-657 | `sendDailyReportReminder` | timeBased |
| src/26_OrderStatusService.js:655-656 | （変数 `targetFn` で動的登録） | timeBased |
| src/31_MetaWebhook.js:291-292 | `processMetaQueue` | timeBased（1分ごと） |
| src/HealthCheck.js:544-545 | `dailyHealthCheck` | timeBased |

※ `generateDailyReport`（00_TriggerSetup.js:370）は「TODO: 実装」の stub。`11_DailyReportService.js` の関数とは別物。

### c. シートメニュー

```bash
grep -rn "function onOpen\|createMenu\|addItem(" src/
```

| ファイル | 呼ばれる関数（addItem で登録） |
|---------|--------------------------|
| src/07_Code.js | `initializeSpreadsheet`, `initializeGoalsSheetFromMenu`, `initializePermissionsSheetFromMenu`, `menuRunAssignMigration`, `manualArchive`, `restoreFromArchive`, `recalculateAllProspectRanks`, `sendTestNotification`, `promptWorkCompletionNotification`, `sendWeeklyReviewReminder`, `setupNotificationTriggers`, `removeNotificationTriggers`, `setPmoNotificationProperties`, `setupAllTriggers`, `deleteAllTriggers`, `listAllTriggers`, `refreshDropdownSettings`, `updateSettingsSheetFromMenu`, `resetSettingsSheetFromMenu`, `openWebApp`, `transferAndGeneratePDF`, `revertSalesToInput`, `transferSelectedToPurchaseList`, `showLog`, `generateElogiCSV`, `transferDataToShippingNotice`, `transferAllSheetsSequentially`, `transfer_UPS_ShippingRates`〜`transfer_CommercialInvoice` |
| src/21_SetupDealReport.js | `setupDealReportSheets`, `addDealReportSettingsColumns`, `createDealReportSheet`, `createBuddyDialogLogSheet` |

**⚠️ 重要**: `transfer_UPS_ShippingRates`, `transfer_DHL_ShippingRates`, `transfer_FedEx_ShippingRates`, `transfer_M_Zones`, `transfer_InvoiceFormat`, `transfer_InvoiceCreate`, `transfer_SalesData`, `transfer_StockList`, `transfer_M_Product`, `transfer_M_Customer`, `transfer_CommercialInvoice`, `transferAllSheetsSequentially` の 12 関数は、メニューに登録されているが `src/` 内に定義が存在しない（実行時エラーになる dead reference）。

```bash
grep -rn "function transferAllSheetsSequentially\|function transfer_UPS" src/ --include="*.js"
# → 0件
```

### d. HTML テンプレート

```bash
grep -rn "google.script.run\|<?=\|<?!=" src/ --include=*.html
```

| HTMLファイル | 呼ばれる GAS 関数 | 定義ファイル |
|------------|----------------|------------|
| src/meta_inbox.html:435 | `doPost`（action=metaGetContacts） | src/27_WebApp.js:228 |
| src/meta_inbox.html:529 | `metaSendMessageFromUI` | src/33_MetaSend.js:176 |
| src/meta_inbox.html:537 | `metaGetContactList` | src/32_MetaSheet.js:147 |
| src/meta_inbox.html:545 | `metaGetConversation` | src/32_MetaSheet.js:107 |
| src/order_form.html:582 | `registerCustomerFromForm` | src/18_CustomerRegistration.js:297 |
| src/index.html:15064 | `getFAQData` | src/35_FAQService.js:11 |

### e. appsscript.json

ファイル: `src/appsscript.json`

```json
{
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" },
  "executionApi": { "access": "MYSELF" }
}
```

- `webapp`: 公開 Web アプリとして配布（doGet/doPost が到達経路）
- `executionApi`: MYSELF のみ（ライブラリ経由の外部呼び出しは不可）
- `library`: 設定なし（他プロジェクトからのライブラリ呼び出しなし）

### g. 手動トリガー（GAS エディタ）

**【未確認：手動トリガー】**

GAS エディタの「トリガー」（時計アイコン）で手動登録されたトリガーはコードから判定できない。
PO が GAS エディタ左メニューを開いて確認すること。
b 経路のコード登録関数とは別に存在する可能性がある。
本調査では「呼ばれていない」と判定しない。

---

## 3-4. どこからも呼ばれていないファイル・関数（分類表）

合格条件の定義:
- **確実に不要**: src/ 内で自ファイル以外からの呼び出しが 0件 AND フロント一覧になし AND 3-3 a〜e に該当しない AND 【PO確認待ち: 手動トリガー】
- **要判断**: 上記のいずれかで 1件以上ヒット
- **現役**: 明らかに active

### 確実に不要（PO確認待ち：手動トリガー）

以下は1〜3の全条件を満たしている。手動トリガーの有無は未確認のため「PO確認待ち」付き。

| ファイル | 関数 | コマンド | ヒット数（自ファイル除く） | 判定 |
|---------|------|---------|----------------------|------|
| src/Code.js | `doGet_ERP_DISABLED` | `grep -rn "doGet_ERP_DISABLED" src/ frontend/src/ --include=*.js --include=*.ts --include=*.html` | 0 | 確実に不要（PO確認待ち） |
| src/Code.js | `getCustomerListForUI` | 同上パターン | 0 | 確実に不要（PO確認待ち） |
| src/Code.js | `getInitialAppPayload` | 同上パターン | 0 | 確実に不要（PO確認待ち） |
| src/Code.js | `getPartHtml` | 同上パターン | 0 | 確実に不要（PO確認待ち） |
| src/Code.js | `include` | 重複定義（src/27_WebApp.js:319に同名関数あり） | 0（呼び出しは27_WebApp版が優先） | 確実に不要（PO確認待ち） |
| src/SettingsService.js | `getDeploymentInfo` 他全関数 | `grep -rn "getDeploymentInfo" src/ frontend/src/ --include=*.js --include=*.ts --include=*.html` | 0 | 確実に不要（PO確認待ち） |
| src/MoveArchivedLeads.js | `moveArchivedLeadsToArchiveSheet`, `checkArchivedLeadsCount` | `grep -rn "moveArchivedLeadsToArchiveSheet" src/ frontend/src/ --include=*.js --include=*.ts` | 0 | 確実に不要（PO確認待ち） |
| src/setup.js | `setupProject` | `grep -rn "setupProject" src/ frontend/src/ --include=*.js --include=*.ts` | 0 | 確実に不要（PO確認待ち）※ initSystemSheets 経由の間接参照のみ |
| src/showProperties.js | `showAllProperties` | `grep -rn "showAllProperties" src/ frontend/src/ --include=*.js --include=*.ts` | 0 | 確実に不要（PO確認待ち） |
| src/HealthCheck.js | 全関数（`dailyHealthCheck`, `checkAllAppUrls` 等） | `grep -rn "dailyHealthCheck" src/ frontend/src/ --include=*.js` | 0（自ファイル内のトリガー登録のみ） | 確実に不要候補（PO確認待ち：手動トリガー or コードトリガーが実際に登録されているか要確認） |
| src/30_BuddyReportService.js | 全関数（`submitWeeklyReport` 他 10件） | 各関数 grep → 全件 0 | 0 | 確実に不要（PO確認待ち） |

### 要判断

| ファイル | 関数 | 理由 |
|---------|------|------|
| src/CRM作成.js | `getSheetByGid` | 27_WebApp.js / 00_DataHelpers.js / elogiCSV出力.js に同名関数が存在。重複定義。GAS では後ろのファイルが優先される可能性があり、どれが実際に呼ばれているか不明（呼び出し元はあるが、どの定義が使われているかが不明） |
| src/CRM作成.js | `sendDiscordNotification` | 27_WebApp.js:3793 に同名関数が存在。重複定義 |
| src/CRM作成.js | `transferToCRM` | 呼び出し元 0件。ただし旧ERP系ファイルとの整合性要確認 |
| src/DB_System.js | `initSystemSheets` | src/setup.js から呼び出し 1件あり。setup.js 自体が確実に不要なら連鎖で不要 |
| src/11_DailyReportService.js | `getDailyReport` | src/05_BuddyCoachingService.js:2270 から呼び出し 1件あり → 現役 |
| src/11_DailyReportService.js | `sendDailyReportReminder` | 自ファイル内でコードトリガー登録（行656）あり → 要判断（手動トリガー確認待ち） |
| src/11_DailyReportService.js | その他全関数 | 呼び出し 0件 → 確実に不要候補（PO確認待ち） |

### 現役

- src/27_WebApp.js（doGet/doPost エントリ、フロント呼び出し関数の実装）
- src/28_Core*Api.js 各ファイル（フロント 44関数の実体）
- src/26_*Service.js 各ファイル（認証・セッション・パスワード等）
- src/23_SheetService.js（シートアクセス共通関数）
- src/31_MetaWebhook.js, src/32_MetaSheet.js, src/33_MetaSend.js（Meta インボックス）
- src/18_CustomerRegistration.js（order_form.html から呼び出し）
- src/35_FAQService.js（index.html から呼び出し）
- src/07_Code.js（onOpen メニュー）
- src/05_BuddyCoachingService.js（コードトリガー登録あり、getDailyReport を呼ぶ）
- src/00_TriggerSetup.js（トリガー一括登録）

---

## 3-5. 旧アプリ由来と思われるファイル

```bash
ls src/ | grep -v "^[0-9][0-9]_"
```

結果: 37ファイル（appsscript.json / index.html / meta_inbox.html / order_form.html を除くと 33件）

### 明確に旧ERP系ファイル（根拠あり）

| ファイル | 旧アプリ由来の根拠 |
|---------|----------------|
| src/Code.js | 先頭コメント「doGet関数は gas/27_WebApp.js に統合されました。このファイルの doGet() は無効化されました（重複防止）」。関数名が `doGet_ERP_DISABLED` にリネーム済み |
| src/Config.js | 先頭コメント「NOTE: CRM側のCONFIGは 08_Config.js に定義されています」。関数名に `ERP_` プレフィックス（`getERPEnvironment`, `getERPSpreadsheetId`）。`getSheetByConfig` は他の旧ERP系ファイルから参照されている |
| src/CRM作成.js | 日本語ファイル名。`getSheetByGid`, `sendDiscordNotification` は 27_WebApp.js / 00_DataHelpers.js に同名の現行関数が存在する（重複定義） |
| src/DB_System.js | `CONFIG.SHEETS.SYSTEM_AGENTS` など、現行スキーマと一致するシート名を参照するが、setup.js からのみ呼ばれる（setup.js 自体が不要候補） |
| src/オーダー管理ページ.js | 日本語ファイル名。07_Code.js のメニュー外。`ERP_CONFIG` を参照 |
| src/ユーティリティ.js | 日本語ファイル名。`ERP_CONFIG` を参照 |
| src/見積もりページ.js | 日本語ファイル名。`getSheetByConfig(ERP_CONFIG.SHEETS.ZONES)` を参照（Config.js 依存） |
| src/在庫ページ.js | 日本語ファイル名。`ERP_CONFIG` を参照 |
| src/仕入れ.js | 日本語ファイル名。旧ERP仕入れ管理 |
| src/仕入れ転記.js | 日本語ファイル名。`getSheetByConfig(ERP_CONFIG.SHEETS.PURCHASE_LIST)` を参照（Config.js 依存）。07_Code.js メニューから `transferSelectedToPurchaseList` で呼ばれる |
| src/仕入元管理.js | 日本語ファイル名。呼び出し元未確認 |
| src/請求書発行.js | 日本語ファイル名。`getSheetByConfig(ERP_CONFIG.SHEETS.INVOICE_INPUT)` を参照（Config.js 依存）。07_Code.js メニューから `transferAndGeneratePDF`, `revertSalesToInput` で呼ばれる |
| src/発送通知.js | 日本語ファイル名。07_Code.js メニューから `transferDataToShippingNotice` で呼ばれる |
| src/elogiCSV出力.js | 日本語ファイル名。07_Code.js メニューから `generateElogiCSV` で呼ばれる。`getSheetByGid` を独自定義（重複） |
| src/メニューr.js | 内容はコメントのみ（07_Code.js のメニュー関数を列挙したドキュメントコード）。実行コードなし |

### 旧ERP系ファイルと Core Schema V1（番号付き）の関係

- `Config.js` の `getSheetByConfig`, `getSheetByGid` は現行の `08_Config.js`, `00_DataHelpers.js` に相当する関数があり、役割が重複している
- `Code.js` の `include()` は `27_WebApp.js:319` に同名関数がある（重複）
- `Config.js` を参照する旧ERP系ファイル（見積もりページ.js, 仕入れ転記.js, 請求書発行.js）は `ERP_CONFIG` というグローバル変数を使うが、この変数の定義元は **未確認**（src/ 内で `ERP_CONFIG =` または `var ERP_CONFIG` を grep → 【未確認】）

### デバッグ・検証スクリプト（根拠あり）

| ファイル | 根拠 |
|---------|------|
| src/check_staff_headers.js | ファイル名が `check_` プレフィックス、0件の外部呼び出し |
| src/check_staff_registration.js | 同上 |
| src/check_lead_headers.js | 同上 |
| src/check_conversation_structure.js | 同上 |
| src/verify_column_alignment.js | ファイル名が `verify_` プレフィックス、0件の外部呼び出し |
| src/verify_column_simple.js | 同上 |
| src/compare_lead_headers.js | ファイル名が `compare_` プレフィックス |
| src/add_original_language_column.js | 一回性マイグレーション的ファイル名 |
| src/debug_price_issue.js | ファイル名が `debug_` プレフィックス |
| src/test_lead_memo_sync.js | ファイル名が `test_` プレフィックス |
| src/test_memo_sync_flow.js | 同上 |
| src/test_price_data.js | 同上 |
| src/write_verification_results.js | 検証結果書き込み用、一回性スクリプト |
| src/checkEnv.js | 環境確認スクリプト |
| src/showProperties.js | スクリプトプロパティ表示、0件の外部呼び出し |

---

## 3-6. レポート機能関連ファイル

```bash
ls src/ | grep -i "report"
# → 11_DailyReportService.js, 13_DealReportService.js, 20_ReportService.js,
#    21_SetupDealReport.js, 30_BuddyReportService.js
grep -rln "Report" src/ | head -20
```

### 各ファイルの到達可能性

| ファイル | 関数 | コマンド | ヒット数（自ファイル除く） | 判定 |
|---------|------|---------|----------------------|------|
| 11_DailyReportService.js | `getDailyReport` | `grep -rn "getDailyReport" src/ frontend/src/ --include=*.js --include=*.ts` | 1（src/05_BuddyCoachingService.js:2270） | **現役**（部分的） |
| 11_DailyReportService.js | `sendDailyReportReminder` | `grep -rn "sendDailyReportReminder" src/ --include=*.js \| grep -v "^src/11_"` | 0（自ファイルのトリガー登録のみ） | 要判断（PO確認待ち：手動/コードトリガー実稼働状況） |
| 11_DailyReportService.js | その他 10関数 | 各関数 grep → 全件 0 | 0 | 確実に不要候補（PO確認待ち） |
| 13_DealReportService.js | `saveBuddyDialogLog` | `grep -rn "saveBuddyDialogLog" src/ --include=*.js \| grep -v "^src/13_"` | 5 | **現役** |
| 13_DealReportService.js | `saveDealReport` | 同上パターン | 1 | **現役** |
| 13_DealReportService.js | `getDealDataForReport` | 同上 | 1 | **現役** |
| 13_DealReportService.js | その他関数 | 各関数 grep → 0 | 0 | 確実に不要候補（PO確認待ち） |
| 20_ReportService.js | `getWeeklyReport` | `grep -rn "getWeeklyReport" src/ --include=*.js \| grep -v "^src/20_"` | 5 | **現役** |
| 20_ReportService.js | `saveWeeklyReport` | 同上パターン | 2 | **現役** |
| 20_ReportService.js | `getMonthlyReport` | 同上 | 2 | **現役** |
| 20_ReportService.js | `generateReportId` | 同上 | 3 | **現役** |
| 20_ReportService.js | その他 6関数 | 各関数 grep → 0 | 0 | 確実に不要候補（PO確認待ち） |
| 21_SetupDealReport.js | `setupDealReportSheets` | 同上パターン | 1（メニューから呼び出し） | **現役**（メニュー経由） |
| 21_SetupDealReport.js | `createDealReportSheet` | 同上 | 2 | **現役** |
| 21_SetupDealReport.js | `createConversationLogSheet` | 同上 | 2 | **現役** |
| 21_SetupDealReport.js | その他 3関数 | 各関数 grep → 0 | 0 | 確実に不要候補（PO確認待ち） |
| 30_BuddyReportService.js | 全 10関数 | 各関数 grep → 全件 0 | 0 | 確実に不要（PO確認待ち） |

---

## PO 判断が必要な項目の一覧

| # | 項目 | 確認方法 |
|---|------|---------|
| 1 | 【未確認：手動トリガー】GAS エディタで手動登録されたトリガーの有無 | GAS エディタ左メニュー「トリガー」（時計アイコン）を開いて確認 |
| 2 | `HealthCheck.js` の `dailyHealthCheck` が実際に稼働しているか | 同上（トリガー一覧に `dailyHealthCheck` が存在するか） |
| 3 | `11_DailyReportService.js` の `sendDailyReportReminder` が実際に稼働しているか | 同上 |
| 4 | 旧ERP系ファイル群（`見積もりページ.js`, `請求書発行.js` 等）は現在も業務で使用しているか | 07_Code.js メニューから実際に使用されているかを確認 |
| 5 | `07_Code.js` の「データ転記」メニュー（`transfer_UPS_ShippingRates` 等 12関数）は使用しているか | これらの関数は src/ 内に定義が存在しないため、クリックすると実行時エラーになる |
| 6 | `ERP_CONFIG` のグローバル変数定義がどこにあるか | `grep -rn "var ERP_CONFIG\|const ERP_CONFIG\|ERP_CONFIG =" src/` で確認 |
| 7 | `30_BuddyReportService.js` の全関数（週次/月次 Buddy レポート）は廃止済みか | 削除方針を確認 |
| 8 | `CRM作成.js` の `getSheetByGid` は `00_DataHelpers.js` 版または `27_WebApp.js` 版と重複定義になっているが、どれが実際に動いているか | GAS では同名関数が複数あるとどちらが使われるか不定のため確認要 |

---

## 読んだファイルの一覧

| ファイル | 状態 |
|---------|------|
| frontend/src/gas/client.ts | 全文読了（1041行） |
| frontend/src/features/customers/gasAdapter.ts | 先頭20行のみ（ラッパー確認） |
| src/27_WebApp.js | 行 7556〜7576, 8174〜8268 を部分読了 |
| src/appsscript.json | 全文読了（22行） |
| src/Code.js | 先頭20行読了 |
| src/Config.js | 先頭20行読了 |
| src/DB_System.js | 先頭30行読了 |
| src/HealthCheck.js | 先頭20行読了 |
| src/meta_inbox.html | 行 430〜445, 525〜555 を部分読了 |
| src/order_form.html | 行 578〜622 を部分読了 |
| src/00_TriggerSetup.js | 行 363〜390 を部分読了 |
| src/11_DailyReportService.js | 関数定義一覧のみ（grep） |
| src/20_ReportService.js, 13_DealReportService.js, 30_BuddyReportService.js, 21_SetupDealReport.js | 関数定義一覧のみ（grep） |
| その他 src/ ファイル | 未読（ファイル名・grep結果のみ） |

---

*src/ 配下のファイルの変更は行っていない。*
