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

## 4. 実データ充填率

> **【行数実測済み / 列充填率は未実測】**  
> `auditDevSpreadsheetStructure()` 実測: 総データ行数 **382行**（空行ゼロ）。  
> 列単位の充填率は同関数では取得不可（行単位チェックのみ）。  
> 以下は grep・コード分析 + 運用実態からの推定（実測値ではない）:

| 充填率推定 | 対象列 |
|-----------|--------|
| ほぼ100%（必須/自動） | #1,#2,#3,#4,#8,#9,#11,#12,#60 |
| 高（80%以上）（運用で記入） | #7,#10,#13,#14,#17,#20,#21,#22,#23,#24,#33 |
| 中（50〜80%）（条件付き） | #5,#6,#15,#16,#27,#28,#29,#57,#58,#59,#64 |
| 低（25〜50%）（商談中のみ） | #25,#26,#32,#34,#35,#37,#38,#44,#45 |
| 希少（〜25%）（成約後のみ） | #46,#47,#48,#49,#50,#51,#52,#53,#54,#55,#56 |
| 不明/未使用 | #18,#19,#30,#31,#36,#39,#40,#41,#42,#43,#61,#62,#63 |

> **[?]** 正確な充填率が必要な場合は、以下の read-only GAS 関数を別 PR で追加することを推奨:
> ```js
> function auditLeadColumnFillRates() { /* ヘッダーごとに非空件数/総件数を返す */ }
> ```

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

2. **C 列 5 本（機能ゼロ）**: #36,#39,#40,#41,#42 はコードから読み取られていない。入力規則・選択肢は定義されているが、業務での活用が確認できない。カルテ編集フォームの追加候補か、廃止候補か要判断。

3. **会社名列の不在**: CoreInboxApi コメント「リード管理に会社名列なし → 顧客名で代用」（karte.company）。法人リードでは顧客名 ≠ 会社名のため、カルテ「会社」タブに誤情報が表示される構造的問題。

4. **廃止移行中の商談進捗 (#5)**: onEdit トリガー（02_ArchiveService）が依然 #5 を監視。完全廃止するには CoreInboxApi の #4 依存解消と同時に行う必要がある。

5. **充填率未実測**: 列単位の充填率調査には専用 read-only 関数が必要。

---

*調査のみ・実装変更なし*
*次のアクション: オーナーが追加・変更する列を指定 → Phase 1 実装開始*
