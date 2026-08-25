# リード管理シート ヘッダー監査レポート

> **Phase 0 — 調査のみ・変更禁止**
> 実施日: 2026-08-26
> 調査者: Hikky-dev (Claude Code)
> 調査対象: GEN-RYU-System/crm-app `src/` 全ファイル + `frontend/src/`
> 調査手法: `auditDevInboxSheetHeaders()` 実行 + リポジトリ全 grep

---

## 1. 調査概要

| 項目 | 値 |
|------|-----|
| シート名 | リード管理 |
| 総列数（実測） | 64 |
| 総データ行数（実測） | **382行**（`auditDevSpreadsheetStructure()` 実測: nonEmptyDataRowCount=382 / scannedDataRowCount=382） |
| 会話ログあり行数 | 26件（`dryRunVerifyInboxPhase1()` 実測 — Inbox で表示されるサブセット） |
| 調査ファイル数 | src/ 約150ファイル（.js） + frontend/src/ 約50ファイル（.tsx/.ts） |

---

## 2. 全64列 参照マップ

### 分類凡例
- **A** — 読み書き両方あり（コードが値を読み・書きする）
- **B** — 読みのみ（コードが読むが書かない）
- **C** — 書きのみ（初期化・書き込みはあるが能動的な読み取り不在）
- **D** — コード参照ゼロ（grep でヒットなし）

### 注記
- `00_CoreSchemaRegistry.js` の定義宣言はカウント外（全列が定義される）
- `00_HeaderMappingHelper.js` のマッピング宣言はカウント外
- `99_Perf*` ベンチファイルは除外（本番動作に無関係）
- 「読み」= `indexes.KEY` アクセス or `headers.indexOf('名前')` + 値利用
- 「書き」= `setValue` / `setValues` / `appendRow` / `coreCustomerFrontendReadTable` の書き込み列指定

---

| # | 列名 | キー | 分類 | 読み取り箇所（ファイル:関数） | 書き込み箇所（ファイル:関数） |
|---|------|------|------|------------------------------|------------------------------|
| 1 | リードID | LEAD_ID | **A** | 28_CoreInboxApi.js: `getInboxConversationDetailForFrontend`, `buildInboxConversations_`, `getBulkInitialLoadForFrontend` / 28_CoreQuoteApi.js: `getQuotesForFrontend`, `validateLeadId_` / 27_WebApp.js: 複数関数 / 99_CustomerMasterSeed.js: 複数 | 23_SheetService.js: `createLead` / 27_WebApp.js: `createLead` / 28_CoreInboxApi.js: テストデータ挿入 |
| 2 | 登録日 | REGISTERED_AT | **A** | 27_WebApp.js: lead行読み取り / 12_DashboardService.js: fallback日付 | 23_SheetService.js: `createLead`（auto） / 28_CorePurchaseApi.js: `setCell('REGISTERED_AT')` |
| 3 | 顧客名 | CUSTOMER_NAME | **A** | 28_CoreInboxApi.js: karte / 28_CoreQuoteApi.js / 28_CoreCustomerReadApi.js / 27_WebApp.js: 複数 / 99_CustomerMasterSeed.js | 23_SheetService.js: `createLead` / 27_WebApp.js: `createLead` |
| 4 | リード進捗 | LEAD_PROGRESS | **A** | 28_CoreInboxApi.js: `LEAD_PROGRESS_TO_INBOX_STATUS` マッピング（3箇所） / 27_WebApp.js: `l.1156`〜`1255`（フィルタ・ラベル） | 27_WebApp.js: `archiveLead`（廃止コメントあり）・`restoreLead`（l.3894/3928） / 30_CSVImportService.js: デフォルト値セット / 28_CoreInboxApi.js: テストデータ（l.792） |
| 5 | 商談進捗 | DEAL_PROGRESS | **A** | 02_ArchiveService.js: `archiveConversationByProgress` トリガー（l.20-305） / 19_ReminderService.js: ステータスフィルタ / 99_ReconcileArchive.js: 分布調査 | 02_ArchiveService.js: `archiveAll`（廃止移行中） / 23_SheetService.js: 新規作成行（seed） |
| 6 | 商談結果 | DEAL_RESULT | **A** | 27_WebApp.js: `getFollowupList`（l.5527） / 30_BuddyReportService.js: `getResultIdx`（l.625） / 06_BuddyFeedbackService.js: `dealResult` 参照 | 09_ConversationArchiveService.js: `setDealResult`（l.254） / 23_SheetService.js: 新規作成行（l.701/808）|
| 7 | 呼び方（英語） | ENGLISH_CALL_NAME | **A** | 99_CustomerMasterSeed.js: `nickCol`（l.679/829） / 27_WebApp.js: 全行読み取り | 23_SheetService.js: `createLead`（l.667） / 27_WebApp.js: seed（l.5980） |
| 8 | 国 | COUNTRY | **A** | 27_WebApp.js: 全行読み取り | 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 9 | シート更新日 | SHEET_UPDATED_AT | **A** | 12_DashboardService.js: fallback日付（l.45/151/531/680/758/807/908/952） / 04_BadgeService.js: fallback | 27_WebApp.js: `updateLeadField` 経由（自動） |
| 10 | リード担当者 | LEAD_ASSIGNEE_NAME | **A** | 27_WebApp.js: `getMyLeads`・`getLeadsByAssignee` / 19_ReminderService.js: フィルタ | 03_AssignService.js: `assignLead` / 27_WebApp.js: アサイン系関数 |
| 11 | リード種別 | LEAD_TYPE | **A** | 27_WebApp.js: `getLeads`（l.341/417/4026/4086/4204/4330/4390）/ 23_SheetService.js: `getLeadsByType` / 12_DashboardService.js: 種別集計（l.313-314） / 30_CSVImportService.js: バリデーション | 03_AssignService.js: `determineLeadType` / 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 12 | 流入経路 | LEAD_SOURCE | **A** | 28_CoreInboxApi.js: `platform` として使用（3箇所） / 27_WebApp.js: 全行読み取り | 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 13 | 流入元ID | LEAD_SOURCE_ID | **A** | 27_WebApp.js: URL解決（l.490）— 流入元IDが空の場合の互換処理 | 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 14 | メッセージURL | MESSAGE_URL | **A** | 27_WebApp.js: `getMessageUrl`（l.2908）/ `findLeadByMessageUrl`（l.858/889） / 12_DashboardService.js: `messageUrl`（l.605） | 23_SheetService.js: `createLead`（l.672） / `updateMessageUrl`（l.858） |
| 15 | 取り扱いタイトル | HANDLED_TITLE | **A** | 28_CoreCustomerReadApi.js: `handledTitle`（l.44） / 27_WebApp.js: 作品ID変換後上書き（l.510） | 27_WebApp.js: seed（l.6003/6065） / 99_DevIpIdsMigration.js: 変換元として参照 |
| 16 | 作品ID | IP_IDS | **A** | 27_WebApp.js: `ipIdsIdx`（l.421）→ 作品名変換 | 99_DevIpIdsMigration.js: `migrateIpIds`（一括書き込み） |
| 17 | CSメモ | CS_NOTE | **A** | 28_CoreInboxApi.js: `karte.note`（3箇所） | 27_WebApp.js: `updateLead` / 23_SheetService.js: `createLead` |
| 18 | メール | EMAIL | **A** | 27_WebApp.js: 全行読み取り（getLeads） | 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 19 | 電話番号 | PHONE | **A** | 27_WebApp.js: 全行読み取り | 23_SheetService.js: `createLead` / 27_WebApp.js: seed |
| 20 | 連絡手段 | CONTACT_METHOD | **A** | 27_WebApp.js: 全行読み取り / 08_Config.js: 選択肢定義 / 28_CoreLeadFormOptionsApi.js: オプション返却 | 23_SheetService.js: `createLead`（l.671） |
| 21 | 温度感 | TEMPERATURE | **A** | 12_DashboardService.js: 種別集計（l.317-321/383/392） / 01_AlertService.js: `alertHighTemp`（l.143/145） / 18_ProspectRank.js: ランク計算 | 23_SheetService.js: `createLead` / 27_WebApp.js: `updateLeadTemp` / seed |
| 22 | 想定規模 | EXPECTED_SCALE | **A** | 18_ProspectRank.js: `rankLead`（l.16/37） / 27_WebApp.js: 全行読み取り | 23_SheetService.js: `createLead` / seed |
| 23 | 返信速度 | RESPONSE_SPEED | **A** | 18_ProspectRank.js: `rankLead`（l.11/38） / 28_CoreLeadFormOptionsApi.js: オプション返却（l.47） | 23_SheetService.js: `createLead` / seed |
| 24 | 問い合わせ回数 | INQUIRY_COUNT | **A** | 23_SheetService.js: `findLeadByMessageUrl`（重複検出） | 23_SheetService.js: `createLead`（初期値1）・`updateInquiryCount` / 30_CSVImportService.js: デフォルト0 |
| 25 | アーカイブ日 | ARCHIVED_AT | **A** | 27_WebApp.js: `l.419`（アーカイブリスト表示）/ `getArchivedLeads`（l.1937） | 27_WebApp.js: `archiveLead`（l.1750/1788） |
| 26 | アーカイブ理由 | ARCHIVE_REASON | **A** | 27_WebApp.js: `getArchiveReasonList`（l.1455/1468） | 27_WebApp.js: `archiveLead`（l.1749/1783） |
| 27 | アサイン日 | ASSIGNED_AT | **A** | 27_WebApp.js: `l.1157/2841`（フィルタ・並び替え） / 04_BadgeService.js: `l.250`（商談速度計算） | 27_WebApp.js: `assignLead`（l.1506/1687） / 03_AssignService.js |
| 28 | 営業担当者 | SALES_ASSIGNEE_NAME | **A** | 27_WebApp.js: 全行読み取り / 03_AssignService.js: フィルタ | 27_WebApp.js: `assignLead` / seed |
| 29 | 担当者ID | ASSIGNEE_ID | **A** | 27_WebApp.js: `l.824/841/858/1159/1410/1505/1545/1602/1662/1686/2312/2349/2375/2420/2480/2652/3064`（大量参照） / 03_AssignService.js: `l.172` | 27_WebApp.js: `assignLead`・`generateNextAssigneeId` / 03_AssignService.js: `assignLead` |
| 30 | 顧客タイプ | CUSTOMER_TYPE | **A** | 18_ProspectRank.js: `rankLead`（l.27/33/36） / 06_BuddyFeedbackService.js: `customerType`（l.74） | 23_SheetService.js: `createLead` / seed |
| 31 | 最終対応者ID | LAST_RESPONDER_ID | **A** | 27_WebApp.js: 全行読み取り（getLeads 経由でフロントに渡る） | 27_WebApp.js: `archiveLead`（l.1940 `lastHandlerCol`） |
| 32 | 見込度 | PROSPECT_SCORE | **A** | 06_BuddyFeedbackService.js: `prospectLevel`（l.77） / 26_Triggers.js: 再計算トリガー | 23_SheetService.js: `createLead` / 21_SetupDealReport.js: プルダウン設定 / seed（l.5998）|
| 33 | 次回アクション | NEXT_ACTION | **A** | 28_CoreInboxApi.js: `karte.nextAction`（3箇所） | 27_WebApp.js: `updateLead` / 23_SheetService.js: `createLead` |
| 34 | 次回アクション日 | NEXT_ACTION_DATE | **A** | 27_WebApp.js: `nextActionDateCol`（l.2905/3273） / 13_DealReportService.js: `l.471` | 27_WebApp.js: `updateLead` / 13_DealReportService.js |
| 35 | 商談メモ | DEAL_NOTE | **A** | 12_DashboardService.js: 停滞判定コメント（l.712） / test_memo_sync_flow.js: 読み書き確認 | 27_WebApp.js: `updateLead` / seed（l.6001） |
| 36 | 相手の課題 | CUSTOMER_ISSUE | **C** | （コーチング文言として静的テキストに出現するが、シート列の読み取りコードなし） | 27_WebApp.js: seed（l.6002/6064 = '' or テキスト） |
| 37 | 販売形態 | SALES_CHANNEL | **A** | 28_CoreCustomerReadApi.js: `salesChannel`（l.26/43） | 27_WebApp.js: seed / 23_SheetService.js: `createLead` |
| 38 | 月間見込み金額 | MONTHLY_EXPECTED_AMOUNT | **A** | 27_WebApp.js: `amountCol`（l.2903/3102/3163） / 12_DashboardService.js: 売上予測（l.539） | 27_WebApp.js: `updateLead` / seed |
| 39 | 1回の発注金額 | ORDER_AMOUNT | **C** | （grep でリード管理列の能動的読み取りなし。シード・初期化値として書かれるのみ） | 27_WebApp.js: seed（0 or 数値） / 23_SheetService.js: 新規作成行 |
| 40 | 購入頻度(月次) | PURCHASE_FREQUENCY_MONTHLY | **C** | （08_Config.js に選択肢定義あり / 99_StaffMasterDump.js に名前列挙あるが能動的読み取りなし） | 27_WebApp.js: seed / 23_SheetService.js: 新規作成行 |
| 41 | 競合比較中 | COMPETITOR_COMPARISON | **C** | （99_StaffMasterDump.js に名前列挙のみ / 能動的読み取りなし） | 27_WebApp.js: seed（''） / 23_SheetService.js: 新規作成行 |
| 42 | 商談の手応え | DEAL_CONFIDENCE | **C** | （08_Config.js に選択肢定義 / 99_StaffMasterDump.js 列挙のみ / 能動的読み取りなし） | 27_WebApp.js: seed（''） / 23_SheetService.js: 新規作成行 |
| 43 | アラート確認日 | ALERT_CONFIRMED_AT | **A** | 27_WebApp.js: 全行読み取り（seed含む）/ 03_AssignService.js: `header === 'アラート確認日'`（l.117） | 27_WebApp.js: seed（''） / 03_AssignService.js: 書き込み |
| 44 | 対象外理由 | EXCLUSION_REASON | **A** | 27_WebApp.js: オプションリスト取得 / 08_Config.js / 13_DealReportService.js: `l.57`（読み）| 13_DealReportService.js: `l.57`（書き） / 27_WebApp.js: seed（''） |
| 45 | 失注理由 | LOSS_REASON | **A** | 27_WebApp.js: オプションリスト取得 / 08_Config.js: 選択肢定義 | 13_DealReportService.js: 書き込み / 27_WebApp.js: seed（''） |
| 46 | 初回取引日 | FIRST_TRANSACTION_DATE | **A** | 12_DashboardService.js: 売上集計（l.45/151/239/531/680/758/807/908/952） / 04_BadgeService.js: 商談速度（l.221/250/252） / 05_BuddyCoachingService.js（l.321/2066） | 27_WebApp.js: deal close / 05_BuddyCoachingService.js / 99_CustomerMasterSeed.js |
| 47 | 初回取引金額 | FIRST_TRANSACTION_AMOUNT | **A** | 12_DashboardService.js: 売上集計（l.50/51/169/243/539） / 04_BadgeService.js（l.231/246） / 30_BuddyReportService.js（l.626） / 05_BuddyCoachingService.js | 27_WebApp.js: deal close / seed |
| 48 | 累計取引金額 | CUMULATIVE_TRANSACTION_AMOUNT | **A** | 27_WebApp.js: `l.5395/5717`（累計計算） / 12_DashboardService.js / 16_Customer.js: `l.494`（更新前に読み取り） | 16_Customer.js: `l.495`（加算更新） / 27_WebApp.js |
| 49 | Good Point | GOOD_POINT | **A** | 30_BuddyReportService.js: DealReport 読み取り / 22_SetupIntegratedSheet.js: シート定義 | 27_WebApp.js: seed（''） / 13_DealReportService.js |
| 50 | More Point | MORE_POINT | **A** | 30_BuddyReportService.js: DealReport 読み取り / 22_SetupIntegratedSheet.js | 27_WebApp.js: seed（''） / 13_DealReportService.js |
| 51 | 反省と今後の抱負 | REFLECTION | **A** | 30_BuddyReportService.js: DealReport 読み取り / 22_SetupIntegratedSheet.js | 27_WebApp.js: seed（''） / 13_DealReportService.js |
| 52 | レポート提出日 | REPORT_SUBMITTED_AT | **A** | 20_ReportService.js: 提出確認（l.146/233） / 22_SetupIntegratedSheet.js | 20_ReportService.js: 書き込み（l.164/249） |
| 53 | レポート確認者 | REPORT_REVIEWER | **A** | 20_ReportService.js: 確認者表示 / 22_SetupIntegratedSheet.js | 27_WebApp.js: レビュー操作 |
| 54 | レポート確認日 | REPORT_REVIEWED_AT | **A** | 20_ReportService.js: 確認日表示 / 22_SetupIntegratedSheet.js | 27_WebApp.js: レビュー操作 |
| 55 | レポートコメント | REPORT_COMMENT | **A** | 20_ReportService.js: コメント表示 / 22_SetupIntegratedSheet.js | 27_WebApp.js: `feedbackIdx`・レビュー操作 |
| 56 | Buddyフィードバック | BUDDY_FEEDBACK | **A** | 20_ReportService.js: `feedbackIdx`（l.146/233/317） / 30_BuddyReportService.js: 読み取り（l.25/40/86/275） / 06_BuddyFeedbackService.js | 20_ReportService.js: `l.164/249`（書き込み） / 13_DealReportService.js: `l.60/77` |
| 57 | 会話要約 | CONVERSATION_SUMMARY | **A** | 28_CoreInboxApi.js: `karte`/`summary`（3箇所 l.122/226/430） / 28_CoreInboxApi.js: `buildInboxConversations_`（フィルタ l.224） | 10_ConversationLogService.js: `l.294-312`（要約自動生成）/ 28_CoreInboxApi.js: テストデータ（l.794） |
| 58 | 最終会話日時 | LAST_CONVERSATION_AT | **A** | 28_CoreInboxApi.js: `updatedAt`（3箇所 l.123/227/431） | 10_ConversationLogService.js: `lastDateIdx`（l.295/307） / 28_CoreInboxApi.js: テストデータ（l.795） |
| 59 | 会話数 | CONVERSATION_COUNT | **A** | 14_DevEnvironmentService.js: 列追加リスト / 28_CoreInboxApi.js: 間接参照 | 10_ConversationLogService.js: `countIdx`（l.296/302） |
| 60 | 重複フラグ | DUPLICATE_FLAG | **A** | 27_WebApp.js: `l.4708`（重複フラグクリア呼び出し） / 23_SheetService.js: `duplicateFlag`（l.724） | 15_DuplicateDetectionService.js: `setDuplicateFlag`・`clearDuplicateFlag`（l.208/293/339） |
| 61 | 重複元リードID | DUPLICATE_SOURCE_LEAD_ID | **A** | 99_CustomerMasterSeed.js: `dupSrcCol`（l.685/835/1004）— 源流リード解決 / 23_SheetService.js: `duplicateSourceId`（l.725） | 15_DuplicateDetectionService.js: `dupSourceCol`（l.209/294/340） |
| 62 | 重複確認日 | DUPLICATE_CONFIRMED_AT | **A** | 15_DuplicateDetectionService.js: 読み取り（clear 時） | 15_DuplicateDetectionService.js: `dupDateCol`（l.295/306） |
| 63 | 重複確認者 | DUPLICATE_CONFIRMED_BY | **A** | 15_DuplicateDetectionService.js: 読み取り | 15_DuplicateDetectionService.js: `dupConfirmerCol`（l.296/306） |
| 64 | リードステータス | LEAD_STATUS | **A** | 27_WebApp.js: `statusIdx`（大量参照: l.342/418/926/1187/1684/1885/2009/2783/2842/3162/3928/5358/5463/5574/5621/5685/5784/5881/5924） / 99_CustomerMasterSeed.js: フィルタ（l.74/200/258/361/662/686/805） / 12_DashboardService.js（l.293） / 02_ArchiveService.js: `l.183/189` | 27_WebApp.js: 複数関数 / 02_ArchiveService.js: `restoreLeads` / 99_CustomerMasterSeed.js（値書き込み） / 99_StaffMasterDump.js: 入力規則設定 |

---

## 3. 分類サマリー

| 分類 | 件数 | 対象列 |
|------|------|--------|
| **A 読み書き両方** | 59 | #1〜#35, #37〜#38, #43〜#64 |
| **B 読みのみ** | 0 | — |
| **C 書きのみ** | 5 | #36（相手の課題）、#39（1回の発注金額）、#40（購入頻度(月次)）、#41（競合比較中）、#42（商談の手応え） |
| **D コード参照ゼロ** | 0 | — |

> **C列の補足**: これら5列は新規作成時の行配列に空文字/0 で初期化されるが、コード上で読み取り処理（indexOf → 値取得 → ビジネスロジック使用）が確認できない。UIから人間がシートに直接記入し、コードが読まない列と判定。ただし `getLeads()` で全列をフロントに返す実装（27_WebApp.js）があるため、旧来のスプレッドシートUIが参照している可能性は残る。

---

## 4. 実データ充填率（実測）

> `auditLeadColumnFillRates()` 実行日: 2026-08-26  
> 総データ行数: **382行**（全行データあり）

| # | 列名 | 充填数 | 充填率 |
|---|------|--------|--------|
| 1 | リードID | 382 | 100.0% |
| 2 | 登録日 | 381 | 99.7% |
| 3 | 顧客名 | 382 | 100.0% |
| 4 | リード進捗 | 377 | 98.7% |
| 5 | 商談進捗 | 270 | 70.7% |
| 6 | 商談結果 | 228 | 59.7% |
| 7 | 呼び方（英語） | 33 | 8.6% |
| 8 | 国 | 246 | 64.4% |
| 9 | シート更新日 | 381 | 99.7% |
| 10 | リード担当者 | 82 | 21.5% |
| 11 | リード種別 | 381 | 99.7% |
| 12 | 流入経路 | 336 | 88.0% |
| 13 | 流入元ID | 333 | 87.2% |
| 14 | メッセージURL | 310 | 81.2% |
| 15 | 取り扱いタイトル | 11 | 2.9% |
| 16 | 作品ID | 10 | 2.6% |
| 17 | CSメモ | 15 | 3.9% |
| 18 | メール | 8 | 2.1% |
| 19 | 電話番号 | 25 | 6.5% |
| 20 | 連絡手段 | 52 | 13.6% |
| 21 | 温度感 | 10 | 2.6% |
| 22 | 想定規模 | 6 | 1.6% |
| 23 | 返信速度 | 10 | 2.6% |
| 24 | 問い合わせ回数 | 350 | 91.6% |
| 25 | アーカイブ日 | 0 | 0% |
| 26 | アーカイブ理由 | 0 | 0% |
| 27 | アサイン日 | 212 | 55.5% |
| 28 | 営業担当者 | 357 | 93.5% |
| 29 | 担当者ID | 59 | 15.4% |
| 30 | 顧客タイプ | 4 | 1.0% |
| 31 | 最終対応者ID | 0 | 0% |
| 32 | 見込度 | 0 | 0% |
| 33 | 次回アクション | 1 | 0.3% |
| 34 | 次回アクション日 | 1 | 0.3% |
| 35 | 商談メモ | 3 | 0.8% |
| 36 | 相手の課題 | 3 | 0.8% |
| 37 | 販売形態 | 3 | 0.8% |
| 38 | 月間見込み金額 | 0 | 0% |
| 39 | 1回の発注金額 | 2 | 0.5% |
| 40 | 購入頻度(月次) | 3 | 0.8% |
| 41 | 競合比較中 | 2 | 0.5% |
| 42 | 商談の手応え | 0 | 0% |
| 43 | アラート確認日 | 0 | 0% |
| 44 | 対象外理由 | 0 | 0% |
| 45 | 失注理由 | 0 | 0% |
| 46 | 初回取引日 | 0 | 0% |
| 47 | 初回取引金額 | 0 | 0% |
| 48 | 累計取引金額 | 0 | 0% |
| 49 | Good Point | 0 | 0% |
| 50 | More Point | 0 | 0% |
| 51 | 反省と今後の抱負 | 0 | 0% |
| 52 | レポート提出日 | 0 | 0% |
| 53 | レポート確認者 | 0 | 0% |
| 54 | レポート確認日 | 0 | 0% |
| 55 | レポートコメント | 0 | 0% |
| 56 | Buddyフィードバック | 0 | 0% |
| 57 | 会話要約 | 25 | 6.5% |
| 58 | 最終会話日時 | 25 | 6.5% |
| 59 | 会話数 | 24 | 6.3% |
| 60 | 重複フラグ | 350 | 91.6% |
| 61 | 重複元リードID | 0 | 0% |
| 62 | 重複確認日 | 0 | 0% |
| 63 | 重複確認者 | 0 | 0% |
| 64 | リードステータス | 381 | 99.7% |

> **注記**: 0% fill は「機能がない」ではなく「DEVデータで対象操作が未発生」の場合が多い（例: アーカイブ日・取引額・重複確認）。廃止判断には充填率ではなくコード到達分類（Section 4-B）を優先。

---

## 4-B. 到達経路分類（全64列）

### 分類定義

| 記号 | 意味 |
|------|------|
| ① | React到達あり — 28_Core\*Api.js または 27_WebApp.js のdoGet/doPost応答に含まれる |
| ② | GAS内部のみ — トリガー・スケジュール・レポート・内部計算のみで使用、React非到達 |
| ③ | 到達不能な関数のみ — 書き込み操作は存在するが**読み取りロジックが皆無**（書き込み先のデータは活用されない） |
| ④ | コード参照ゼロ — grep でヒットなし |
| ⑤ | 要オーナー判断 — 複数経路が混在または到達可否が設計意図に依存 |

### 分類表

| # | 列名 | 充填率 | 分類 | 根拠 |
|---|------|--------|------|------|
| 1 | リードID | 100% | ① | 28_CoreInboxApi: buildInboxConversations_ / getInboxConversationDetailForFrontend |
| 2 | 登録日 | 99.7% | ① | 27_WebApp: getLeads 全行返却 |
| 3 | 顧客名 | 100% | ① | 28_CoreInboxApi: karte.customerName / 28_CoreQuoteApi / 28_CoreCustomerReadApi |
| 4 | リード進捗 | 98.7% | ① | 28_CoreInboxApi: LEAD_PROGRESS_TO_INBOX_STATUS → InboxStatus変換（Inbox全3関数） |
| 5 | 商談進捗 | 70.7% | ② | 02_ArchiveService onEditトリガー / 19_ReminderService スケジュール。React非到達 |
| 6 | 商談結果 | 59.7% | ① | 27_WebApp: getFollowupList（doGet応答） / 30_BuddyReportService |
| 7 | 呼び方（英語） | 8.6% | ① | 27_WebApp: getLeads 全行返却 |
| 8 | 国 | 64.4% | ① | 27_WebApp: getLeads 全行返却 |
| 9 | シート更新日 | 99.7% | ② | 12_DashboardService / 04_BadgeService 内部計算のみ |
| 10 | リード担当者 | 21.5% | ① | 27_WebApp: getMyLeads / getLeadsByAssignee（doGet） |
| 11 | リード種別 | 99.7% | ① | 27_WebApp: getLeads（l.341/417 等 doGet） |
| 12 | 流入経路 | 88.0% | ① | 28_CoreInboxApi: platform フィールド（Inbox全3関数） |
| 13 | 流入元ID | 87.2% | ⑤ | 27_WebApp: URL解決に使用（内部ルックアップ）。値そのものが応答に含まれるか設計依存 |
| 14 | メッセージURL | 81.2% | ① | 27_WebApp: getMessageUrl API（l.2908）/ 12_DashboardService |
| 15 | 取り扱いタイトル | 2.9% | ① | 28_CoreCustomerReadApi: handledTitle（l.44） |
| 16 | 作品ID | 2.6% | ⑤ | 27_WebApp: 作品名変換に読み取り（内部変換のみか応答に含むか不明） / 書き込みは 99_DevIpIdsMigration |
| 17 | CSメモ | 3.9% | ① | 28_CoreInboxApi: karte.note（全3関数） |
| 18 | メール | 2.1% | ① | 27_WebApp: getLeads 全行返却 |
| 19 | 電話番号 | 6.5% | ① | 27_WebApp: getLeads 全行返却 |
| 20 | 連絡手段 | 13.6% | ① | 28_CoreLeadFormOptionsApi: フォーム選択肢として返却 |
| 21 | 温度感 | 2.6% | ② | 12_DashboardService 集計 / 01_AlertService — React応答には含まれず |
| 22 | 想定規模 | 1.6% | ② | 18_ProspectRank 内部計算のみ |
| 23 | 返信速度 | 2.6% | ① | 28_CoreLeadFormOptionsApi: フォーム選択肢返却（l.47） |
| 24 | 問い合わせ回数 | 91.6% | ② | 23_SheetService: 重複検出（内部）。React応答には含まれず |
| 25 | アーカイブ日 | 0% | ① | 27_WebApp: getArchivedLeads（doGet）。DEVデータでアーカイブ未実行のため0% |
| 26 | アーカイブ理由 | 0% | ① | 27_WebApp: getArchiveReasonList（doGet） |
| 27 | アサイン日 | 55.5% | ① | 27_WebApp: フィルタ・並び替えに使用 / 04_BadgeService 商談速度計算 |
| 28 | 営業担当者 | 93.5% | ① | 27_WebApp: getLeads / 03_AssignService — 担当者表示 |
| 29 | 担当者ID | 15.4% | ① | 27_WebApp: 17箇所（認証・アサイン・API応答）/ 03_AssignService |
| 30 | 顧客タイプ | 1.0% | ② | 18_ProspectRank / 06_BuddyFeedbackService — 内部ランク計算のみ |
| 31 | 最終対応者ID | 0% | ① | 27_WebApp: getLeads 経由でフロントに渡る（audit表に明記） |
| 32 | 見込度 | 0% | ② | 06_BuddyFeedbackService / 26_Triggers 再計算。React非到達 |
| 33 | 次回アクション | 0.3% | ① | 28_CoreInboxApi: karte.nextAction（全3関数） |
| 34 | 次回アクション日 | 0.3% | ① | 27_WebApp: nextActionDateCol（l.2905/3273）API応答 |
| 35 | 商談メモ | 0.8% | ② | 12_DashboardService 停滞判定（内部のみ） |
| 36 | 相手の課題 | 0.8% | **③** | 書き込み: createLead 初期化（''）のみ。**読み取りコードなし** |
| 37 | 販売形態 | 0.8% | ① | 28_CoreCustomerReadApi: salesChannel（l.26/43） |
| 38 | 月間見込み金額 | 0% | ⑤ | 27_WebApp amountCol / 12_DashboardService 売上予測。doGet応答か内部集計か設計依存 |
| 39 | 1回の発注金額 | 0.5% | **③** | 書き込み: createLead 初期化（0）のみ。**読み取りコードなし** |
| 40 | 購入頻度(月次) | 0.8% | **③** | 書き込み: createLead 初期化のみ。**読み取りコードなし** |
| 41 | 競合比較中 | 0.5% | **③** | 書き込み: createLead 初期化（''）のみ。**読み取りコードなし** |
| 42 | 商談の手応え | 0% | **③** | 書き込み: createLead 初期化（''）のみ。**読み取りコードなし** |
| 43 | アラート確認日 | 0% | ② | 03_AssignService（l.117）がアサイン時に書き込み / 27_WebApp 全行読み取りに含まれる可能性あり |
| 44 | 対象外理由 | 0% | ② | 27_WebApp: オプションリスト取得 / 13_DealReportService |
| 45 | 失注理由 | 0% | ② | 27_WebApp: オプションリスト取得 |
| 46 | 初回取引日 | 0% | ② | 12_DashboardService 売上集計 / 04_BadgeService — 成約後に書き込み。DEV未発生 |
| 47 | 初回取引金額 | 0% | ② | 12_DashboardService / 04_BadgeService / 30_BuddyReportService |
| 48 | 累計取引金額 | 0% | ② | 16_Customer.js 累計計算 / 27_WebApp |
| 49 | Good Point | 0% | ② | 30_BuddyReportService DealReport 読み取り / 13_DealReportService 書き込み |
| 50 | More Point | 0% | ② | 同上 |
| 51 | 反省と今後の抱負 | 0% | ② | 同上 |
| 52 | レポート提出日 | 0% | ② | 20_ReportService（l.146/233）確認 + 書き込み（l.164/249） |
| 53 | レポート確認者 | 0% | ② | 20_ReportService |
| 54 | レポート確認日 | 0% | ② | 20_ReportService |
| 55 | レポートコメント | 0% | ② | 20_ReportService |
| 56 | Buddyフィードバック | 0% | ② | 20_ReportService / 30_BuddyReportService / 06_BuddyFeedbackService |
| 57 | 会話要約 | 6.5% | ① | 28_CoreInboxApi: summary / karte（全3関数）。10_ConversationLogService が自動生成 |
| 58 | 最終会話日時 | 6.5% | ① | 28_CoreInboxApi: updatedAt（全3関数） |
| 59 | 会話数 | 6.3% | ⑤ | 10_ConversationLogService が書き込み / 14_DevEnvironmentService が列定義参照（DEV）/ 28_CoreInboxApi 間接参照 |
| 60 | 重複フラグ | 91.6% | ② | 15_DuplicateDetectionService（書き込み）/ 27_WebApp（読み取り・フラグクリア） |
| 61 | 重複元リードID | 0% | ② | 15_DuplicateDetectionService / 99_CustomerMasterSeed（DEV移行） |
| 62 | 重複確認日 | 0% | ② | 15_DuplicateDetectionService |
| 63 | 重複確認者 | 0% | ② | 15_DuplicateDetectionService |
| 64 | リードステータス | 99.7% | ① | 27_WebApp: statusIdx 19箇所（doGet/doPost中心）/ 02_ArchiveService / 23_SheetService |

### 分類サマリー

| 分類 | 件数 | 代表列 |
|------|------|--------|
| ① React到達あり | 30 | #1-4,#6-8,#10-12,#14-15,#17-20,#23,#25-29,#31,#33-34,#37,#57-58,#64 |
| ② GAS内部のみ | 26 | #5,#9,#21-22,#24,#30,#32,#35,#43-56,#60-63 |
| **③ 廃止候補** | **5** | **#36,#39,#40,#41,#42** |
| ④ コード参照ゼロ | 0 | — |
| ⑤ 要オーナー判断 | 3 | #13,#16,#38,#59 |

> ③列の共通パターン: `23_SheetService.js: createLead`（新規行初期化として`''`を書き込む）と`27_WebApp.js: seed` のみが書き込み先。どちらも値を「後で読み取る」コードが存在しない。入力規則・選択肢定義（08_Config / 99_StaffMasterDump）はあるが、実際の業務ロジックへの接続なし。

---

## 4-C. シート棚卸し（DEVブック全シート）

> `listDevSheets()` 実行日: 2026-08-26  
> 総シート数: 64

### 到達経路定義

| 記号 | 意味 |
|------|------|
| React | doGet/doPost 経由で React に読み書きされる |
| トリガー | onEdit / 時間主導トリガー から書き込まれる |
| メニュー | スプレッドシートメニューまたはスクリプト手動実行 |
| 内部 | GAS サービス間の内部読み書き（Reactからは不可視） |
| 到達なし | コード参照がない・DEVバックアップ・旧データ |

| シート名 | データ行数 | 列数 | 到達経路 | 備考 |
|----------|-----------|------|----------|------|
| リード管理 | 382 | 64 | React | 主データ（本監査対象） |
| 発行元マスタ | 1 | 18 | React | 流入元URL解決 |
| 発行元マスタ_旧 | 1 | 13 | 到達なし | 旧版。現行未使用 |
| 流入元マスタ | 9 | 6 | React | platform名ルックアップ |
| 共用在庫_V2テスト | 1,475 | 11 | 到達なし | テスト用データ |
| 表示設定マスタ | 2 | 4 | React | 表示フラグ設定 |
| システム設定 | 16 | 14 | React/内部 | 設定値（React + 内部両用） |
| オーダー管理 | 191 | 43 | React | 受注データ |
| オーダー明細 | 587 | 11 | React | 受注明細 |
| 発送 | 149 | 20 | React | 出荷管理 |
| 仕入れ | 497 | 19 | React | 仕入れ管理 |
| 見積もり管理 | 1 | 19 | React | 見積ヘッダ |
| 見積もり明細 | 3 | 12 | React | 見積明細 |
| 顧客マスタ | 51 | 21 | React | 顧客DB（成約後移行先） |
| 配送先マスタ | 53 | 17 | React | 配送先住所 |
| 支払先マスタ | 51 | 16 | React | 支払先情報 |
| 選択肢マスタ | 44 | 36 | React | フォーム選択肢 |
| 会話ログ（商談用） | 249 | 11 | React | 受信箱メッセージ（InboxAPI直結） |
| フォームトークン | 0 | 4 | React | フォームCSRFトークン |
| 担当者マスタ | 8 | 24 | React | スタッフ情報 |
| ログインセッション | 34 | 6 | React | セッション管理 |
| 国マスタ | 250 | 7 | React | 国コードルックアップ |
| 通貨マスタ | 5 | 5 | React | 通貨換算 |
| FedEx送料 | 89 | 24 | 内部 | 送料計算テーブル |
| DHL送料 | 184 | 11 | 内部 | 同上 |
| UPS送料 | 90 | 12 | 内部 | 同上 |
| 地帯表 | 254 | 5 | 内部 | 送料地帯定義 |
| 顧客分析 | 51 | 12 | React/内部 | 顧客分析集計 |
| 顧客月次分析 | 69 | 10 | React/内部 | 月次分析集計 |
| 顧客購入商品分析 | 262 | 7 | React/内部 | 購入商品分析 |
| DEV参照整合性監査ログ | 201 | 11 | メニュー | DEV専用監査ログ |
| DEV構造監査ログ | 205 | 17 | メニュー | DEV専用監査ログ |
| リード_アーカイブ | 132 | 61 | トリガー/React | onEdit + getArchivedLeads API |
| ステータス移行表 | 16 | 4 | 内部 | ステータス遷移定義 |
| リード_成約 | 0 | 61 | 到達なし | DEVデータ未発生（成約0件） |
| リード_失注 | 0 | 0 | 到達なし | DEVデータ未発生 |
| 商談レポート | 0 | 27 | 内部 | DealReport出力先（DEV未使用） |
| 目標設定 | 0 | 12 | 到達なし | 未使用 |
| 目標設定_壁打ち | 0 | 13 | 到達なし | 未使用 |
| シフト | 0 | 13 | 到達なし | 未使用 |
| ログイン履歴 | 112 | 6 | 内部 | ログイン記録 |
| PromptConfig | 999 | 4 | 内部 | LLMプロンプト定義 |
| FAQ | 9 | 7 | React | FAQ API返却 |
| 商材ナレッジ | 18 | 11 | React | ナレッジAPI返却 |
| メッセージテンプレート | 5 | 12 | React | テンプレートAPI |
| 営業ナレッジ | 4 | 11 | React | ナレッジAPI返却 |
| SCM出力同期 | 301 | 21 | 内部 | 在庫同期データ |
| 集計同期 | 205 | 20 | 内部 | 集計同期データ |
| 商品マスタ同期 | 231 | 24 | 内部 | 商品マスタ同期 |
| 権限管理 | 6 | 25 | React/内部 | 権限定義 |
| 請求書作成 | 23 | 20 | メニュー/React | 請求書生成 |
| 請求書_PDF出力 | 48 | 8 | メニュー | PDF出力バッファ |
| 見積もりテンプレート | 3 | 2 | メニュー | テンプレート定義 |
| 見積もり作成 | 1 | 15 | メニュー/React | 見積書作成 |
| 見積もり_PDF出力 | 40 | 8 | メニュー | PDF出力バッファ |
| 大分類マスタ_共用在庫 | 3 | 4 | 内部 | 在庫分類 |
| 作品マスタ_共用在庫 | 11 | 4 | 内部 | 作品分類 |
| メーカーマスタ_共用在庫 | 5 | 4 | 内部 | メーカー分類 |
| 商品区分マスタ_共用在庫 | 2 | 4 | 内部 | 商品区分 |
| 共用在庫 | 301 | 11 | React/内部 | 在庫管理 |
| 見積書管理_旧 | 56 | 25 | 到達なし | 旧見積書シート |
| 🗃️古物台帳 | 0 | 7 | 到達なし | 未使用 |
| 顧客マスタ_旧 | 52 | 42 | 到達なし | 旧顧客マスタ |
| リード管理_backup_20260807 | 496 | 61 | 到達なし | バックアップ（DEV専用） |
| 📊売上データ | 710 | 158 | 内部/到達なし | 売上集計（大量列） |

---

## 5. 精査4列：ステータス系ロジックとの関係

### 5-1. #4 リード進捗（LEAD_PROGRESS）

**値域**（`LEAD_PROGRESS_TO_INBOX_STATUS` マッピングから実測）:
```
新規 → 'lead'
対応中 → 'lead'
アサイン確定 → 'deal'
商談中 → 'deal'
見積もり提示 → 'deal'
成約 → 'existing'
追客 → 'followup'
アーカイブ → 'archive'
失注 → 'archive'
対象外 → 'archive'
```

**読み取り箇所**:
- `28_CoreInboxApi.js:29-42` — `LEAD_PROGRESS_TO_INBOX_STATUS` マップ定義（React Inbox の InboxStatus に変換）
- `28_CoreInboxApi.js:116/230/424` — Inbox 会話一覧・詳細・一括取得の3関数すべてで使用
- `27_WebApp.js:1156-1255` — リード進捗フィルタ・ラベル表示
- `27_WebApp.js:4027/4087/4205/4391/4743` — 各種クエリのフィルタ

**書き込み箇所**:
- `27_WebApp.js:3894/3928` — `restoreLead`（アーカイブ復元時）
- `27_WebApp.js:1779` — `archiveLead` 内コメント: 「リード進捗への書き込みを廃止。アーカイブ日・アーカイブ理由で管理する」
- `30_CSVImportService.js:436` — CSVインポート時デフォルト「新規」
- `28_CoreInboxApi.js:792` — テストデータ挿入（'新規'）

**⚠️ 特記**: アーカイブ操作は「リード進捗への書き込みを廃止」（27_WebApp.js:1779 コメント）とある。現在はアーカイブ日・アーカイブ理由で管理する移行期にあると思われるが、読み取りコード（CoreInboxApi）はまだ LEAD_PROGRESS を参照している。**#4 と #64（リードステータス）が二重管理状態の可能性あり**。

---

### 5-2. #5 商談進捗（DEAL_PROGRESS）

**値域**（`02_ArchiveService.js` から確認）:
- アーカイブ（トリガー値）/ その他（UI入力）

**読み取り箇所**:
- `02_ArchiveService.js:20-310` — onEdit トリガー。「商談進捗」列の編集を検知し自動アーカイブ
- `19_ReminderService.js:28/38/108` — リマインダー送信のフィルタ
- `99_ReconcileArchive.js:72/156` — アーカイブ整合性調査（DEV専用）

**書き込み箇所**:
- `02_ArchiveService.js:110` — コメント「商談進捗への書き込みを廃止。アーカイブ日・理由で管理」← **廃止中**
- `23_SheetService.js:701` — 新規作成行（空文字）

**⚠️ 特記**: #4 と同様「書き込み廃止」コメントが存在。しかし `02_ArchiveService.js` の onEdit トリガーが「商談進捗」列への編集を監視しているため、完全廃止はできていない。UI から手動編集される列として残存している。

---

### 5-3. #6 商談結果（DEAL_RESULT）

**値域**（`08_Config.js:258` / `21_SetupDealReport.js:51`）:
```
成約 / 失注 / 追客 / 見送り / 対象外
```

**読み取り箇所**:
- `27_WebApp.js:5527` — `getFollowupList`（商談結果が「追客」の顧客一覧取得）
- `30_BuddyReportService.js:625` — DealReport から結果取得
- `06_BuddyFeedbackService.js:70/288` — Buddy フィードバック文面生成

**書き込み箇所**:
- `09_ConversationArchiveService.js:254` — `setDealResult`（商談クローズ時）
- `23_SheetService.js:808` — 「商談結果にも同じステータスを記録」（フロントからの更新）
- `27_WebApp.js:6011/6073` — seed 初期値（''）

**calculateOrderStatus 等との関係**:
- `calculateOrderStatus()` 相当の関数はオーダー管理シートに対するものであり、LEADS.DEAL_RESULT とは直接紐付かない
- LEADS.DEAL_RESULT の値は `09_ConversationArchiveService` が商談クローズ API として担い、`06/30_BuddyService` が読む

---

### 5-4. #64 リードステータス（LEAD_STATUS）

**値域**（`08_Config.js:252` 静的定義）:
```
新規リード / リード対応中 / アサイン確定 / リード対象外 /
商談中 / 商談対象外 / 追客(短期) / 追客(長期) / 成約 / 失注
```
動的取得: `08_Config.js:1013-1138` — スクリプトプロパティ `LEAD_STATUS_N` から読み込む（DB連動）。

**読み取り箇所**（大量）:
- `27_WebApp.js`: `statusIdx = headers.indexOf('リードステータス')` が **19箇所** — 会話一覧・マイリード・フォローアップ・ダッシュボード・全リスト取得
- `99_CustomerMasterSeed.js`: 成約フィルタ（`=== '成約'`）— 顧客マスタ移行処理
- `12_DashboardService.js:293` — リード系フィルタ `CONFIG.LEAD_STATUSES.includes(status)`
- `02_ArchiveService.js:183/189` — アーカイブ復元時に「リードステータス」を復元
- `23_SheetService.js:610` — 新規作成後の会話リストフィルタ

**書き込み箇所**:
- `27_WebApp.js`: 複数の status 更新関数（アサイン・アーカイブ・復元・ステータス変更 API）
- `02_ArchiveService.js`: `restoreLeads`（復元時）
- `99_CustomerMasterSeed.js`: 遡及設定
- `99_StaffMasterDump.js`: 入力規則設定（DEV専用）

**#4 リード進捗 との関係**（⚠️ 重要）:

| 項目 | #4 リード進捗 | #64 リードステータス |
|------|--------------|---------------------|
| 値の管理方式 | 旧（廃止移行中） | 新（現行） |
| 主要読み取り先 | 28_CoreInboxApi（Inbox） | 27_WebApp（全ページ） |
| アーカイブ書き込み | 「廃止」コメントあり | 現行の書き込み先 |
| Config 定義 | `LEAD_PROGRESS_TO_INBOX_STATUS`（CoreInboxApi内） | `CONFIG.LEAD_STATUSES`（08_Config） |
| 選択肢数 | 10（ハードコード） | 10（スクリプトプロパティ + fallback） |

> **【推測】** リード管理は #4→#64 への段階的移行中。CoreInboxApi が #4 を読み続けているため、移行完了前は両列に整合した値が必要。#4 と #64 の値が乖離している行が存在する可能性がある（`99_StaffMasterDump.js:801-901` に実測調査関数 `surveyLeadProgressDealProgressDistribution` あり）。

---

## 6. フロントエンド参照（受信箱カルテ）

> 詳細は前回レポート参照。現行カルテで使用する列は 64 列中 **5列のみ**（実質的）。

| フロントフィールド | マップ先シート列 | タブ |
|------------------|-----------------|------|
| customerName | #3 顧客名 | 顧客・会社（代用） |
| platform | #12 流入経路 | 顧客 |
| status | #4 リード進捗 | 会社 |
| nextAction | #33 次回アクション | メモ |
| note | #17 CSメモ | メモ |

---

## 7. まとめ・Phase 1 へのインプット

### 発見した主要課題

1. **二重ステータス管理**: #4（リード進捗）と #64（リードステータス）が並存。CoreInboxApi は #4 を読み、27_WebApp は #64 を読む。両者の値が乖離した場合に Inbox と他ページで表示不整合が起きる。

2. **廃止候補（③）5列**: #36,#39,#40,#41,#42 はコードから読み取られていない（書き込み＝createLead初期化のみ）。充填率も0〜0.8%と極低。カルテ編集フォームへの追加か廃止かオーナー判断が必要。

3. **会社名列の不在**: CoreInboxApi コメント「リード管理に会社名列なし → 顧客名で代用」（karte.company）。法人リードでは顧客名 ≠ 会社名のため、カルテ「会社」タブに誤情報が表示される構造的問題。

4. **廃止移行中の商談進捗 (#5)**: onEdit トリガー（02_ArchiveService）が依然 #5 を監視。完全廃止するには CoreInboxApi の #4 依存解消と同時に行う必要がある。

---

*調査のみ・実装変更なし*
*次のアクション: オーナーが追加・変更する列を指定 → Phase 1 実装開始*
