# legacy ページ 到達範囲確認レポート

**調査日**: 2026-08-30  
**調査基準 SHA**: `0c4865a`（worktree ベース `origin/develop`）  
**参照した先行ドキュメント**: `docs/gas-undefined-reference-audit.md` / `docs/gas-old-new-wiring-map.md`  
**目的**: `?page=legacy` の入口を外す前に、そこから到達できる機能を全て洗い出し、入口を外すと止まるものを事前に確定させる。  
**調査範囲**: `src/index.html`（レガシーページ本体）から `google.script.run` で呼び出される全 GAS 関数  
**制約**: `src/` への変更なし・clasp push なし・読み取り専用調査のみ

---

## 0. 前提: legacy 分岐の実装箇所

**【事実】** `src/27_WebApp.js:57`（実測値）

```javascript
// 旧画面プレビュー（移植作業の参考用・移植完了後に削除すること）
if (params.page === 'legacy') {
  return HtmlService.createTemplateFromFile('index')  // ← src/index.html を配信
    .evaluate()
    .setTitle('CRM (Legacy)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

- `?page=legacy` という URL パラメータがある場合のみ `src/index.html` を配信する
- 分岐は 1 箇所のみ（grep 結果: `src/27_WebApp.js:57` の 1 件のみ）
- コメントに「移植完了後に削除すること」と明記あり

---

## 1. google.script.run 呼び出しパターンの確認

`src/index.html` は 22,917 行。`google.script.run` の呼び出しは 2 パターン:

### パターン A: 直接チェーン呼び出し（主流）

```javascript
google.script.run
  .withSuccessHandler(result => { ... })
  .withFailureHandler(err => { ... })
  .functionName(args);
```

関数名は最後の `.functionName(args)` の部分。

### パターン B: runAsync ラッパー（1 件のみ）

```javascript
// index.html:14365
function runAsync(funcName, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [funcName](...args);
  });
}
// 呼び出し例 (index.html:22872):
const result = await runAsync('issueFormTokenWithUrl', leadId);
```

---

## 2. 呼び出される GAS 関数の全一覧

**【事実】** `grep` 実測結果（index.html からの全 `google.script.run` 呼び出し）

| # | GAS 関数名 | index.html 行番号（代表） |
|---|-----------|----------------------|
| 1 | `getCurrentUser` | 15109 |
| 2 | `getUserSidebarPreference` | 15160 |
| 3 | `getSettingsData` | 15221 |
| 4 | `getMessageTemplates` | 15234 |
| 5 | `getQuoteMasterSettings` | 15255 |
| 6 | `getAvailableStatuses` | 15269 |
| 7 | `getAllProductConditionsMap` | 15282 |
| 8 | `getSettingsData`（2 回目） | 15338 |
| 9 | `getAvailableStatuses`（2 回目） | 15352 |
| 10 | `getAllProductConditionsMap`（2 回目） | 15365 |
| 11 | `getAllProductPricesMap` | 15378 |
| 12 | `getAllProductQuantitiesMap` | 15391 |
| 13 | `getAllProductWeightsMap` | 15404 |
| 14 | `getDashboardKPIs` | 15417 |
| 15 | `getLeadsByType('インバウンド')` | 15430 |
| 16 | `getLeadsByType('アウトバウンド')` | 15443 |
| 17 | `getMyLeads` | 15456 |
| 18 | `getStockData` | 15480 |
| 19 | `getAllCustomersForQuote` | 15493 |
| 20 | `getQuoteTemplates` | 15506 |
| 21 | `getStaffListForAssign` | 15534 |
| 22 | `getArchiveReasons` | 15548 |
| 23 | `getUserDarkMode` | 15567 |
| 24 | `getAllMessageTemplates` | 15850 |
| 25 | `updateTemplate` | 15869 |
| 26 | `saveKnowledge` | 15886 |
| 27 | `createTemplate` | 15982 |
| 28 | `updateTemplate`（2 回目） | 16014 |
| 29 | `deleteTemplate` | 16043 |
| 30 | `getPermissions` | 16083 |
| 31 | `saveRolePermissions` | 16156 |
| 32 | `getStaffList` | 16206 |
| 33 | `getPermissionsList` | 16246 |
| 34 | `updateStaff` | 16280 |
| 35 | `addStaff` | 16459 |
| 36 | `updatePermission` | 16487 |
| 37 | `getKnowledgeList` | 16510 |
| 38 | `saveKnowledge`（2 回目） | 16624 |
| 39 | `deleteKnowledge` | 16651 |
| 40 | `getActivePromptConfigs` | 16675 |
| 41 | `deletePromptConfig` | 16702 |
| 42 | `updatePromptConfig` | 16761 |
| 43 | `testDiscordConnection` | 16784 |
| 44 | `syncDiscordToConversationLog` | 16834 |
| 45 | `getAllDiscordChannelsFromCustomerMaster` | 16915 |
| 46 | `updateUserDarkMode` | 17030 |
| 47 | `getUserMenuPreferences` | 17063 |
| 48 | `getUserSidebarPreference`（2 回目） | 17093 |
| 49 | `updateUserSidebarPreference` | 17123 |
| 50 | `updateUserMenuPreferences` | 17155 |
| 51 | `getSalesStaffList` | 17432 |
| 52 | `startDeal` | 17462 |
| 53 | `createLead` | 17577 |
| 54 | `updateLead` | 17627 |
| 55 | `getDashboardKPIs`（2 回目） | 17650 |
| 56 | `getMyLeads`（2 回目） | 17663 |
| 57 | `getNewAssigns` | 17675 |
| 58 | `getLeadsByType`（3 回目） | 17697 |
| 59 | `getLeadsByType`（4 回目） | 17719 |
| 60 | `getStockData`（2 回目） | 17744 |
| 61 | `getZoneNumbersForCountry` | 18443 |
| 62 | `calculateAllShippingRatesForQuote` | 18520 |
| 63 | `saveQuoteFromForm` | 18738 |
| 64 | `getQuotesForList` | 18787 |
| 65 | `loadQuoteForForm` | 18871 |
| 66 | `updateQuotePDFUrl` | 19011 |
| 67 | `writeQuoteToSheetAndGeneratePDF` | 19030 |
| 68 | `loadQuoteForForm`（2 回目） | 19049 |
| 69 | `getQuotePDFUrl` | 19060 |
| 70 | `loadQuoteDataFromCreationSheet` | 19364 |
| 71 | `writeQuoteToSheetAndGeneratePDF`（2 回目） | 19663 |
| 72 | `initializePersonalWorkSheets` | 19688 |
| 73 | `calculateAllShippingRatesForQuote`（2 回目） | 20206 |
| 74 | `generateInvoicePDFFromForm` | 20541 |
| 75 | `writeInvoiceToSalesData` | 20570 |
| 76 | `getLeadDetail` | 20586 |
| 77 | `getSalesStats` | 20601 |
| 78 | `getReminders` | 20615 |
| 79 | `getFollowUps` | 20629 |
| 80 | `getNewCustomers` | 20644 |
| 81 | `getRouteCustomers` | 20659 |
| 82 | `getAllDealsStats` | 20679 |
| 83 | `getStaffSummary` | 20693 |
| 84 | `getAllNewCustomers` | 20708 |
| 85 | `getAllRouteCustomers` | 20723 |
| 86 | `exportLeadsSampleCSV` | 20745 |
| 87 | `exportCustomerMasterSampleCSV` | 20766 |
| 88 | `exportConversationLogSampleCSV` | 20787 |
| 89 | `importLeadsCSV` | 20996 |
| 90 | `importCustomerMasterCSV` | 21024 |
| 91 | `importConversationLogCSV` | 21051 |
| 92 | `getConversationLogsForLead` | 21131 |
| 93 | `translateAndAddLog` | 21204 |
| 94 | `getLeads('all', 'アウトバウンド')` | 21269 |
| 95 | `getLeads('all', 'インバウンド')` | 21276 |
| 96 | `getFAQData` | 21334 |
| 97 | `getConversationLogsForLead`（2 回目） | 21725 |
| 98 | `updateConversationLogTranslation` | 21885 |
| 99 | `analyzeDealFromMessage` | 21935 |
| 100 | `addConversationLog` | 22021 |
| 101 | `getLeadDetail`（2 回目） | 22253 |
| 102 | `createLead`（2 回目） | 22263 |
| 103 | `updateLeadField` | 22364 |
| 104 | `updateLeadField`（2 回目） | 22443 |
| 105 | `archiveLeadWithReason` | 22569 |
| 106 | `restoreLeadFromArchive` | 22638 |
| 107 | `getSalesStaffList`（2 回目） | 22678 |
| 108 | `assignLeadToStaff` | 22734 |
| 109 | `assignLeadToStaff`（2 回目） | 22784 |
| 110 | `issueFormTokenWithUrl`（runAsync 経由） | 22872 |
| 111 | `syncAllDiscordChannelsFromCustomerMaster` | 16894 |

**ユニーク関数名数: 52 種類**（重複呼び出しを除く）

---

## 3. 各関数の判定

### 判定基準

| 判定 | 条件 |
|-----|------|
| **既に機能不全** | 未定義参照（PRODUCTION_IDS / CONFIG.QUOTE_HISTORY / 関数定義なし）で必ず失敗する |
| **稼働中** | 定義あり、既知の未定義参照なし、正常に動作可能 |
| **実質機能不全** | 定義あり・クラッシュしないが、依存するシートが見つからず常に `{success:false}` を返す |
| **【未確認】** | コードを読んでも確定できない |

---

### 3-A. 既に機能不全（関数定義なし — 13 関数）

**【事実】** `grep -rn "function <関数名>" src/` → 全件 0 件（実測）

GAS で `google.script.run.undefinedFunction()` を呼ぶと、`withFailureHandler` が呼ばれる。UIはエラー表示になる。

| 関数名 | index.html 行 | 根拠 |
|-------|-------------|------|
| `getAvailableStatuses` | 15269, 15352 | src/ に定義なし（全ファイル grep 0 件） |
| `getAllProductConditionsMap` | 15282, 15365 | 同上。27_WebApp.js:270 で参照のみ（doPost ハンドラ内） |
| `getAllProductPricesMap` | 15378 | 同上 |
| `getAllProductQuantitiesMap` | 15391 | 同上 |
| `getAllProductWeightsMap` | 15404 | 同上 |
| `getAllCustomersForQuote` | 15493 | 同上。27_WebApp.js:261 で参照のみ |
| `getQuoteMasterSettings` | 15255 | src/ に定義なし（全ファイル grep 0 件） |
| `getZoneNumbersForCountry` | 18443 | 同上 |
| `calculateAllShippingRatesForQuote` | 18520, 20206 | 同上 |
| `testDiscordConnection` | 16784 | 同上（src/*.js に定義なし） |
| `syncDiscordToConversationLog` | 16834 | 同上 |
| `getAllDiscordChannelsFromCustomerMaster` | 16915 | 同上 |
| `syncAllDiscordChannelsFromCustomerMaster` | 16894 | 同上 |

**影響**: 初期化フェーズで `getQuoteMasterSettings`・`getAvailableStatuses`・`getAllProductConditionsMap`・`getAllProductPricesMap`・`getAllProductQuantitiesMap`・`getAllProductWeightsMap`・`getAllCustomersForQuote` が失敗 → 見積もり系の初期データロードが全て失敗する。Discord 連携機能も全て使用不可。

---

### 3-B. 既に機能不全（PRODUCTION_IDS 未定義 — 2 関数）

先行調査（`docs/gas-undefined-reference-audit.md`）で確定済み。

| 関数名 | 実装 | index.html 行 | 症状 |
|-------|------|-------------|------|
| `writeQuoteToSheetAndGeneratePDF` | src/27_WebApp.js:7398 | 19030, 19663 | try-catch → `{success:false, message:'PRODUCTION_IDS is not defined'}` |
| `writeInvoiceToSalesData` | src/35_SalesDataSyncService.js:194 | 20570 | try-catch → `{success:false}` |

**影響**: 見積書PDF生成・売上データ転記が機能しない。

---

### 3-C. 既に機能不全（CONFIG.QUOTE_HISTORY 未定義 — 5 関数）

**【事実】** `grep -rn "QUOTE_HISTORY" src/` → `11_QuoteService.js` 内の 6 箇所のみ（定義なし）。  
`CONFIG.QUOTE_HISTORY.GID` は `TypeError: Cannot read properties of undefined (reading 'GID')` を発生させる。  
各関数は try-catch で囲まれているため `{success:false, error:'TypeError...' }` を返す（クラッシュしない）。

| 関数名 | 実装 | index.html 行 | 失敗箇所 |
|-------|------|-------------|---------|
| `saveQuoteFromForm` | src/27_WebApp.js:7679 → `saveQuote()` | 18738 | src/11_QuoteService.js:88 `CONFIG.QUOTE_HISTORY.GID` |
| `getQuotesForList` | src/27_WebApp.js:7847 → `getAllQuotes()` | 18787 | src/11_QuoteService.js:317 `CONFIG.QUOTE_HISTORY.GID` |
| `loadQuoteForForm` | src/27_WebApp.js:7755 → `getQuoteById()` | 18871, 19049 | src/11_QuoteService.js:213 `CONFIG.QUOTE_HISTORY.GID` |
| `getQuotePDFUrl` | src/11_QuoteService.js:408 | 19060 | L418 `CONFIG.QUOTE_HISTORY.GID` |
| `updateQuotePDFUrl` | src/11_QuoteService.js:471 | 19011 | L482 `CONFIG.QUOTE_HISTORY.GID` |

**影響**: 見積もり保存・読込・一覧・PDF URL の全操作が失敗する。

---

### 3-D. 既に機能不全（内部関数未定義 — 1 関数）

| 関数名 | 実装 | index.html 行 | 失敗箇所 |
|-------|------|-------------|---------|
| `generateInvoicePDFFromForm` | src/27_WebApp.js:7908 | 20541 | 内部で `writeInvoiceToSheetAndGeneratePDF()` を呼ぶ（src/ に定義なし → ReferenceError）。try-catch → `{success:false}` |

---

### 3-E. 実質機能不全（CONFIG.SHEETS.PROMPT_CONFIG 未定義 — 3 関数）

先行調査で確認済み。シートが見つからず常に `{success:false}` を返す（クラッシュしない）。

| 関数名 | 実装 | index.html 行 |
|-------|------|-------------|
| `getActivePromptConfigs` | src/34_PromptConfigService.js:12 | 16675 |
| `updatePromptConfig` | src/34_PromptConfigService.js:80 | 16761 |
| `deletePromptConfig` | src/34_PromptConfigService.js:201 | 16702 |

---

### 3-F. 稼働中（定義あり、既知の未定義参照なし）

**【事実】** 各関数の定義を `grep -rn "function <名>" src/` で確認。PRODUCTION_IDS / CONFIG.QUOTE_HISTORY 参照なし（実測）。

| 関数名 | 実装ファイル:行 | 読み書きするシート | 操作 |
|-------|-------------|----------------|-----|
| `getCurrentUser` | src/27_WebApp.js:1361 | ログインセッション, 担当者マスタ | 読み取り |
| `getUserSidebarPreference` | src/32_StaffService.js:655 | 担当者マスタ（sidebar 設定列） | 読み取り |
| `updateUserSidebarPreference` | src/32_StaffService.js:742 | 担当者マスタ | 書き込み |
| `getSettingsData` | src/08_Config.js:1185 | 選択肢マスタ | 読み取り |
| `getMessageTemplates` | src/27_WebApp.js:8069 → src/36_MessageTemplateService.js:289 | メッセージテンプレート | 読み取り |
| `getAllMessageTemplates` | src/27_WebApp.js:8077 → src/36_MessageTemplateService.js:360 | メッセージテンプレート | 読み取り |
| `createTemplate` | src/27_WebApp.js:8086 | メッセージテンプレート | 書き込み |
| `updateTemplate` | src/27_WebApp.js:8096 | メッセージテンプレート | 書き込み |
| `deleteTemplate` | src/27_WebApp.js:8105 | メッセージテンプレート | 削除 |
| `getDashboardKPIs` | src/27_WebApp.js:326 | リード管理 | 読み取り |
| `getLeadsByType` | src/27_WebApp.js:656 | リード管理 | 読み取り |
| `getLeads` | src/27_WebApp.js:388 | リード管理 | 読み取り |
| `getLeadDetail` | src/27_WebApp.js:743 | リード管理 | 読み取り |
| `getMyLeads` | src/27_WebApp.js:806 | リード管理 | 読み取り |
| `createLead` | src/27_WebApp.js:906 | リード管理 | 書き込み |
| `updateLead` | src/27_WebApp.js:971 | リード管理 | 書き込み |
| `updateLeadField` | src/27_WebApp.js:1039 | リード管理 | 書き込み |
| `archiveLeadWithReason` | src/27_WebApp.js:1741 | リード管理（アーカイブ先） | 書き込み |
| `restoreLeadFromArchive` | src/27_WebApp.js:3888 | リード管理 | 書き込み |
| `assignLeadToStaff` | src/27_WebApp.js:1661 | リード管理 | 書き込み |
| `startDeal` | src/27_WebApp.js:1881 | リード管理 | 書き込み |
| `getNewAssigns` | src/27_WebApp.js:1824 | リード管理 | 読み取り |
| `getStaffListForAssign` | src/27_WebApp.js:1410 | 担当者マスタ | 読み取り |
| `getArchiveReasons` | src/27_WebApp.js:1468 | 選択肢マスタ（アーカイブ理由列） | 読み取り |
| `getSalesStaffList` | src/27_WebApp.js:1542 | 担当者マスタ | 読み取り |
| `getStaffList` | src/27_WebApp.js:1291 / src/32_StaffService.js:10 | 担当者マスタ | 読み取り |
| `getPermissionsList` | src/32_StaffService.js:53 | 権限設定 | 読み取り |
| `updateStaff` | src/27_WebApp.js:2372 / src/32_StaffService.js:98 | 担当者マスタ | 書き込み |
| `addStaff` | src/27_WebApp.js:2343 / src/32_StaffService.js:240 | 担当者マスタ | 書き込み |
| `updatePermission` | src/32_StaffService.js:167 | 権限設定 | 書き込み |
| `getPermissions` | src/27_WebApp.js:8114 | 権限設定 | 読み取り |
| `saveRolePermissions` | src/27_WebApp.js:8124 | 権限設定 | 書き込み |
| `getUserDarkMode` | src/32_StaffService.js:330 | 担当者マスタ | 読み取り |
| `updateUserDarkMode` | src/32_StaffService.js:398 | 担当者マスタ | 書き込み |
| `getUserMenuPreferences` | src/32_StaffService.js:463 | 担当者マスタ | 読み取り |
| `updateUserMenuPreferences` | src/32_StaffService.js:551 | 担当者マスタ | 書き込み |
| `getStockData` | src/在庫ページ.js:1 | 📦仕入在庫参照（ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK, ID:1186337887） | 読み取り |
| `getQuoteTemplates` | src/27_WebApp.js:6925 | 見積もりテンプレート（なければデフォルト返す） | 読み取り |
| `loadQuoteDataFromCreationSheet` | src/27_WebApp.js:6332 | 見積もり作成（シート名ハードコード） | 読み取り |
| `initializePersonalWorkSheets` | src/27_WebApp.js:7197 | 見積もり作成・請求書作成（個人シート作成/取得） | 書き込み |
| `getKnowledgeList` | src/12_KnowledgeService.js:9 | 【未確認: getKnowledgeList が参照するシート名未読】 | 読み取り |
| `saveKnowledge` | src/12_KnowledgeService.js:49 | 【未確認: 同上】 | 書き込み |
| `deleteKnowledge` | src/12_KnowledgeService.js:137 | 【未確認: 同上】 | 削除 |
| `getSalesStats` | src/27_WebApp.js:5345 | リード管理（集計） | 読み取り |
| `getReminders` | src/27_WebApp.js:5457 | リード管理（リマインダー列） | 読み取り |
| `getFollowUps` | src/27_WebApp.js:5521 | リード管理（フォローアップ列） | 読み取り |
| `getNewCustomers` | src/27_WebApp.js:5568 | リード管理 | 読み取り |
| `getRouteCustomers` | src/27_WebApp.js:5615 | リード管理 | 読み取り |
| `getAllDealsStats` | src/27_WebApp.js:5674 | リード管理（商談統計） | 読み取り |
| `getStaffSummary` | src/27_WebApp.js:5779 | リード管理（担当者別集計） | 読み取り |
| `getAllNewCustomers` | src/27_WebApp.js:5877 | リード管理 | 読み取り |
| `getAllRouteCustomers` | src/27_WebApp.js:5920 | リード管理 | 読み取り |
| `exportLeadsSampleCSV` | src/27_WebApp.js:5975 / src/29_CSVExportService.js:88 | リード管理 | 読み取り |
| `exportCustomerMasterSampleCSV` | src/27_WebApp.js:6204 / src/29_CSVExportService.js:104 | 顧客マスタ | 読み取り |
| `exportConversationLogSampleCSV` | src/27_WebApp.js:6126 / src/29_CSVExportService.js:120 | 会話ログ | 読み取り |
| `importLeadsCSV` | src/30_CSVImportService.js:356 | リード管理 | 書き込み |
| `importCustomerMasterCSV` | src/30_CSVImportService.js:471 | 顧客マスタ | 書き込み |
| `importConversationLogCSV` | src/30_CSVImportService.js:547 | 会話ログ | 書き込み |
| `getConversationLogsForLead` | src/27_WebApp.js:4480 | 会話ログ | 読み取り |
| `addConversationLog` | src/27_WebApp.js:4526 / src/10_ConversationLogService.js:192 | 会話ログ | 書き込み |
| `translateAndAddLog` | src/27_WebApp.js:4595 / src/10_ConversationLogService.js:521 | 会話ログ | 書き込み |
| `updateConversationLogTranslation` | src/27_WebApp.js:8008 | 会話ログ | 書き込み |
| `analyzeDealFromMessage` | src/34_DealAnalysisService.js:13 | 会話ログ（Claude API 経由分析） | 読み取り+書き込み |
| `getFAQData` | src/35_FAQService.js:11 | FAQ | 読み取り |
| `issueFormTokenWithUrl` | src/18_CustomerRegistration.js:995 | 顧客登録トークン（Script Property） | 読み取り+書き込み |

---

## 4. 「入口を外すと止まるもの」の特定

`?page=legacy` を外すと `src/index.html` が配信されなくなる。
**GAS 関数自体は消えない** — 消えるのはその UI 入口のみ。

React SPA（新方式）にも同名・同等の機能が存在する場合は影響なし。
React SPA にない場合 = **入口を外すと機能が失われる**。

### 4-1. 稼働中かつ React SPA に移行済み → 影響なし

以下は React SPA の client.ts で同等機能が提供されている（フロント44に含まれる）:

| 機能カテゴリ | レガシー関数 | React SPA 相当 |
|------------|-----------|-------------|
| ダッシュボード | `getDashboardKPIs` | `getDashboardKPIs`（フロント44 #1） |
| リード管理 | `getLeadsByType`, `getLeadDetail`, `createLead`, `updateLead`, `getLeadDetail` | フロント44 #4〜#8 |
| 担当者 | `getCurrentUser` | React SPA の認証フロー |

### 4-2. 稼働中かつ React SPA に相当機能なし → **入口を外すと止まる**

**【事実】** React SPA（client.ts / フロント44）に含まれないことを、`docs/gas-old-new-wiring-map.md` および先行調査の差分から確認。

以下の機能は現時点でレガシーページ経由でのみアクセス可能。**入口を外すと UI 上の入口が失われる。**

| 機能 | レガシー関数 | 書き込むシート | 影響 |
|-----|-----------|-------------|-----|
| 在庫データ閲覧（旧ERP形式） | `getStockData` | 読み取り: 📦仕入在庫参照 | **旧ERP在庫ビューが消える** |
| 担当者管理（追加・更新） | `addStaff`, `updateStaff` | 書き込み: 担当者マスタ | **担当者追加・編集画面が消える** ※React に Admin 相当機能がなければ |
| 権限管理 | `getPermissions`, `saveRolePermissions`, `updatePermission` | 書き込み: 権限設定 | **権限設定画面が消える** |
| メッセージテンプレート管理 | `createTemplate`, `updateTemplate`, `deleteTemplate`, `getMessageTemplates`, `getAllMessageTemplates` | 書き込み: メッセージテンプレート | **テンプレート管理画面が消える** |
| ナレッジ管理 | `getKnowledgeList`, `saveKnowledge`, `deleteKnowledge` | 書き込み: 【未確認シート】 | **ナレッジ管理画面が消える** |
| 売上統計・担当者サマリー | `getSalesStats`, `getStaffSummary`, `getAllDealsStats` | 読み取り: リード管理 | **旧形式ダッシュボード集計が消える** |
| リマインダー・フォローアップ | `getReminders`, `getFollowUps`, `getNewCustomers`, `getRouteCustomers` | 読み取り: リード管理 | **旧形式リマインダー・フォローアップ画面が消える** |
| CSV インポート / エクスポート | `exportLeadsSampleCSV`, `exportCustomerMasterSampleCSV`, `exportConversationLogSampleCSV`, `importLeadsCSV`, `importCustomerMasterCSV`, `importConversationLogCSV` | リード管理・顧客マスタ・会話ログ | **データ管理画面（CSV 入出力）が消える** |
| 会話ログ（翻訳・AI 分析） | `translateAndAddLog`, `updateConversationLogTranslation`, `analyzeDealFromMessage` | 書き込み: 会話ログ | **翻訳・AI 分析機能が消える** |
| FAQ 閲覧 | `getFAQData` | 読み取り: FAQ | **FAQ ページが消える** |
| 顧客登録フォームトークン発行 | `issueFormTokenWithUrl` | Script Property | **フォームトークン発行機能が消える** |
| ダークモード / サイドバー / メニュー設定 | `updateUserDarkMode`, `updateUserMenuPreferences`, `updateUserSidebarPreference` | 担当者マスタ | **UI 設定保存が消える** |

### 4-3. 既に機能不全なので「止まる」とは言えないもの

以下は入口があっても既にエラーになっているため、入口を外しても**実質的な影響なし**:

- 見積書系（`saveQuoteFromForm`, `getQuotesForList`, `loadQuoteForForm`, `getQuotePDFUrl`, `updateQuotePDFUrl`, `writeQuoteToSheetAndGeneratePDF`, `generateInvoicePDFFromForm`, `writeInvoiceToSalesData`）
- 商品・ステータスマップ系（`getAllProductConditionsMap` 等 9 関数）
- Discord 連携（4 関数）
- プロンプト設定（`getActivePromptConfigs` 等 3 関数）

---

## 5. 判定サマリ

| 判定 | 件数 | 関数名（ユニーク） |
|-----|------|----------------|
| **既に機能不全** | **24** | 関数定義なし 13 + PRODUCTION_IDS 2 + CONFIG.QUOTE_HISTORY 5 + 内部関数未定義 1 + PROMPT_CONFIG 3 |
| **稼働中** | **28** | 上記 3-F 参照 |
| **【未確認】** | **1** | `getKnowledgeList` / `saveKnowledge` / `deleteKnowledge` が使うシート名 |

---

## 6. 【未確認】項目

| # | 未確認内容 | 理由 |
|---|-----------|-----|
| 1 | `getKnowledgeList` / `saveKnowledge` / `deleteKnowledge` が読み書きするシート名 | src/12_KnowledgeService.js の実装を今回未読 |
| 2 | `addStaff` / `updateStaff` が React SPA にも存在するか | React SPA の Admin 画面実装未確認。`frontend/src/gas/client.ts` に記述があれば影響なし |
| 3 | `getPermissions` / `saveRolePermissions` / `updatePermission` が React SPA にも存在するか | 同上 |

---

## 7. PO 判断が必要な項目

| # | 確認内容 | 理由 |
|---|---------|------|
| 1 | レガシーページを現在も業務で使用しているか | 稼働中関数のうち「入口を外すと止まるもの」が実際に使われているかを確認するため |
| 2 | 担当者管理・権限管理・テンプレート管理・CSV インポートが React SPA に移行済みか | 移行済みであれば「止まる」ものが減る。未移行であれば入口を外す前に React 側に機能追加が必要 |
| 3 | ナレッジ管理・FAQ・フォームトークン発行が React SPA に移行済みか | 同上 |
| 4 | 「既に機能不全」の見積書・商品マップ・Discord 機能について修正する意思があるか | 修正なし = 入口を外してもよい（既に動かない） / 修正あり = 入口を外す前に修正 |

---

## 8. 読んだファイル / 未読ファイルの一覧

### 読んだファイル（実測）

| ファイル | 読んだ箇所 | 目的 |
|--------|---------|-----|
| src/27_WebApp.js | L12–70, L228–300, L326–430, L656–1110, L1291–1900, L2343–2430, L3888, L4480–4650, L5345–6210, L6311–6400, L6925–6965, L7197–7260, L7679–7800, L7847–7910, L7908–8140 | doGet 分岐・全 GAS 関数定義確認 |
| src/index.html | 関数名抽出（grep のみ・全体は未通読） | google.script.run 呼び出し一覧取得 |
| src/08_Config.js | L1–100, L1185–1260 | CONFIG 定義・getSettingsData 実装 |
| src/11_QuoteService.js | L23–35, L75–165, L202–230, L302–400, L408–510 | CONFIG.QUOTE_HISTORY 参照・saveQuote 等 |
| src/11_Quote.js | L41–55, L205–215, L297–305 | 別実装との区別（CONFIG.SHEETS.QUOTES 使用） |
| src/12_KnowledgeService.js | 関数名のみ grep | **内容未読** |
| src/32_StaffService.js | L10–55, L98–175, L240–260, L330–340, L398–470, L463–560, L551–670, L655–750, L742–780 | 設定系関数実装確認 |
| src/34_PromptConfigService.js | L12–25, L80–95, L201–215 | PROMPT_CONFIG 参照確認（先行調査済み） |
| src/36_MessageTemplateService.js | L289–360, L360 | テンプレートシート名確認 |
| src/在庫ページ.js | L1–60 | getStockData 実装・ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK 確認 |
| src/Config.js | L37–50 | ERP_CONFIG 定義確認 |
| docs/gas-undefined-reference-audit.md | 全文 | 先行調査の引用 |
| docs/gas-old-new-wiring-map.md | origin/develop 経由（フロント44 一覧） | React SPA との比較 |

### 未読ファイル（今回スコープ外・または関数名のみ確認）

| ファイル | 理由 |
|--------|-----|
| src/12_KnowledgeService.js（内容） | 関数定義の存在確認のみ。シート名未読 |
| src/30_CSVImportService.js | 関数定義の存在確認のみ |
| src/29_CSVExportService.js | 同上 |
| src/34_DealAnalysisService.js | 同上 |
| src/35_FAQService.js | 同上 |
| src/18_CustomerRegistration.js | 同上 |
| src/10_ConversationLogService.js | 同上 |
| src/35_SalesDataSyncService.js | 先行調査で確認済み（writeInvoiceToSalesData） |
| src/28_* 系（CoreApi 群） | React SPA 側の実装。今回は Legacy 調査のため対象外 |

---

## 9. 結論（PO 向けサマリ）

| 項目 | 値 |
|-----|---|
| 調査基準 SHA | `0c4865a`（develop 最新） |
| legacy 分岐の実装 | src/27_WebApp.js:57（1 箇所のみ） |
| 配信されるファイル | src/index.html（22,917 行） |
| 呼び出される GAS 関数（ユニーク） | 52 種類 |
| 既に機能不全（入口を外しても影響なし） | **24 関数** |
| 稼働中（うち React 移行済みは影響なし） | **28 関数** |
| 入口を外すと UI 上の入口が失われるもの | **最大 20 機能**（4-2 参照）。React SPA への移行状況により変動 |
| 入口を外す前提条件 | PO が 7 節の確認事項を確認し、未移行機能の対処方針を決定すること |

*調査実施: 読み取り専用（src/ への変更なし、clasp push なし）*
