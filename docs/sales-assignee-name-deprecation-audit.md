# sales_assignee_name 廃止影響調査レポート

調査日: 2026-09-01
調査基準SHA: 5ab40815871b029707d751499ed40eebe287990b（origin/develop、PR #863 マージ後）

---

## 1. 対象列を持つシート一覧

### Registry 定義（src/00_CoreSchemaRegistry.js）

| テーブルキー | シート名 | 物理列名 | 列番号（Registry定義） | SALES_ASSIGNEE_ID 列の有無 |
|------------|---------|---------|---------------------|--------------------------|
| LEADS | リード管理 | sales_assignee_name | 26（Registry定義上の順序） | なし（referenceIds 未登録） |
| CUSTOMERS | 顧客マスタ | 営業担当者（表示名）/ sales_assignee_name（物理名） | 10 | あり（SALES_ASSIGNEE_ID として登録済み） |

- Registry 行番号（src/00_CoreSchemaRegistry.js:5）: LEADS の `['SALES_ASSIGNEE_NAME', 'sales_assignee_name']`
- Registry 行番号（src/00_CoreSchemaRegistry.js:17）: CUSTOMERS の `['SALES_ASSIGNEE_NAME', '営業担当者']`, `['SALES_ASSIGNEE_ID', 'sales_assignee_id']`

### GAS 実行結果で検出されたシート（2026-09-01T10:22:51Z）

| シート名 | 物理列名（実シート） | 列番号 | SALES_ASSIGNEE_ID 列の有無 | 備考 |
|---------|------------------|--------|--------------------------|------|
| リード管理 | sales_assignee_name | 26 | なし | 現行スキーマ正本 |
| 顧客マスタ | 営業担当者 | 10 | あり | 現行スキーマ正本 |
| Copy of リード管理 | 営業担当者 | 28 | なし | バックアップ/スナップショット |
| Copy of 顧客マスタ | 営業担当者 | 10 | なし | バックアップ/スナップショット |
| リード_アーカイブ | 営業担当者 | 22 | なし | アーカイブシート |
| リード_成約 | 営業担当者 | 22 | なし | 成約リードシート |
| 見積書管理_旧 | 営業担当者 | 22 | なし | 旧見積書管理 |
| 顧客マスタ_旧 | 営業担当者 | 25 | なし | 旧顧客マスタ |
| 顧客マスタ_pre_demo_20260826 | 営業担当者 | 10 | なし | デモ前スナップショット |

---

## 2. 参照箇所の全件表

| # | ファイル:行 | 用途 | 種別 | 到達可能性 |
|---|-----------|------|------|-----------|
| 1 | src/00_CoreSchemaRegistry.js:5 | LEADS テーブルのヘッダー定義 | 定義 | 新方式（全 CoreSchema 経由関数から到達） |
| 2 | src/00_CoreSchemaRegistry.js:17 | CUSTOMERS テーブルのヘッダー定義 | 定義 | 新方式（getCoreCustomersForFrontend等から到達） |
| 3 | src/27_WebApp.js:954 | createLead: コメント（営業担当者は空白） | コメント | 新方式（createLead 関数内） |
| 4 | src/27_WebApp.js:1545-1546 | getSalesStaffList 関数のコメント | コメント | 旧方式のみ（index.html から呼び出し） |
| 5 | src/27_WebApp.js:1701 | assignLeadToStaff: リード管理の sales_assignee_name 列を書き込み | 書き込み | 旧方式のみ（index.html 経由） |
| 6 | src/27_WebApp.js:6013 | fakeCustomers seed: 営業担当者フィールドのコメント（リード管理データ） | 定義/DEV | 到達なし（DEV seed 関数） |
| 7 | src/27_WebApp.js:6066 | fakeCustomers seed: 営業担当者フィールド空値（リード管理データ） | 定義/DEV | 到達なし（DEV seed 関数） |
| 8 | src/27_WebApp.js:7920 | generateInvoicePDFFromForm: ログ出力 | ログ | 旧方式のみ（index.html 経由） |
| 9 | src/12_DashboardService.js:30 | コメント（営業担当者のみフィルタ） | コメント | 【未確認】getDashboardKPIs 経由（新旧両方の可能性） |
| 10 | src/12_DashboardService.js:215 | コメント（営業担当者で目標設定） | コメント | 【未確認】 |
| 11 | src/12_DashboardService.js:667 | コメント（営業担当者のみ抽出） | コメント | 【未確認】 |
| 12 | src/35_SalesDataSyncService.js:105 | getCustomerSalesRep: customerMapping['sales_assignee_name'] で顧客マスタから読み取り | 読み取り | 旧方式のみ（請求書発行.js 経由） |
| 13 | src/35_SalesDataSyncService.js:372-373 | syncSalesData: settings['sales_assignee_name'] の書き込み | 書き込み | 旧方式のみ（請求書発行.js 経由） |
| 14 | src/35_SalesDataSyncService.js:381-389 | syncSalesData: salesDataMapping['sales_assignee_name'] で売上データへ書き込み | 書き込み | 旧方式のみ（請求書発行.js 経由） |
| 15 | src/11_QuoteService.js:161 | 見積もり管理シートへ sales_assignee_name として書き込み | 書き込み | 旧方式のみ（index.html の QUOTE_HISTORY シート経由） |
| 16 | src/11_QuoteService.js:274 | 見積もり管理シートから sales_assignee_name を読み取り | 読み取り | 旧方式のみ |
| 17 | src/11_QuoteService.js:364 | 見積もり管理シートから sales_assignee_name を読み取り | 読み取り | 旧方式のみ |
| 18 | src/19_ReminderService.js:28 | buildColIndex に '営業担当者' を渡す | 読み取り | 時間主導型トリガー（直接実行、新旧両方に依存しない） |
| 19 | src/19_ReminderService.js:42 | colIndex['sales_assignee_name'] でアクセス（**キー不一致バグ**） | 読み取り | 時間主導型トリガー |
| 20 | src/28_CoreCustomerReadApi.js:23 | getCoreCustomersForFrontend: CUSTOMERS から SALES_ASSIGNEE_NAME を読み取り | 読み取り | 新方式（getCoreCustomersForFrontend） |
| 21 | src/28_CoreCustomerReadApi.js:45 | salesAssigneeName フィールドへの変換 | 読み取り | 新方式 |
| 22 | src/28_CoreCustomerReadApi.js:77 | getCoreCustomerForFrontend: CUSTOMERS から SALES_ASSIGNEE_NAME を読み取り | 読み取り | 新方式（getCoreCustomerForFrontend） |
| 23 | src/28_CoreCustomerReadApi.js:112 | salesAssigneeName フィールドへの変換 | 読み取り | 新方式 |
| 24 | src/99_PerfBench.js:739 | perfbench: CUSTOMERS の SALES_ASSIGNEE_NAME を読み取り | 読み取り | DEV/ベンチマーク専用 |
| 25 | src/99_PerfBench.js:761 | salesAssigneeName のベンチマーク計測 | 読み取り | DEV/ベンチマーク専用 |
| 26 | src/99_CustomerMasterSeed.js:45 | seed: 'sales_assignee_name' のインデックス取得 | 読み取り/DEV | 到達なし（DEV seed 関数） |
| 27 | src/99_CustomerMasterSeed.js:121 | seed: 営業担当者のコメント | コメント/DEV | 到達なし |
| 28 | src/99_CustomerMasterSeed.js:330 | seed: 'sales_assignee_name' インデックス取得 | 読み取り/DEV | 到達なし |
| 29 | src/99_CustomerMasterSeed.js:384 | seed: 営業担当者を行データに設定 | 書き込み/DEV | 到達なし |
| 30 | src/99_CustomerMasterSeed.js:454 | seed: 'sales_assignee_name' インデックス取得 | 読み取り/DEV | 到達なし |
| 31 | src/99_CustomerMasterSeed.js:475 | seed: 営業担当者列の存在チェック | 読み取り/DEV | 到達なし |
| 32 | src/99_CustomerMasterSeed.js:1038 | seed: 営業担当者ヘッダー定義 | 定義/DEV | 到達なし |
| 33 | src/99_CustomerMasterSeed.js:1064 | seed: コメント | コメント/DEV | 到達なし |
| 34 | src/99_CustomerMasterSeed.js:1193 | seed: 'sales_assignee_name' インデックス取得 | 読み取り/DEV | 到達なし |
| 35 | src/99_CustomerMasterSeed.js:1238 | seed: 営業担当者を行データに設定 | 書き込み/DEV | 到達なし |
| 36 | src/99_DevCustomersAssigneeIdAudit.js:26-27 | DEV監査: 'sales_assignee_name' インデックス取得 | 読み取り/DEV | 到達なし |
| 37 | src/99_DevStaffAndCustomerCheck.js:80-81 | DEV確認: 営業担当者列インデックス取得 | 読み取り/DEV | 到達なし |
| 38 | src/99_DevStaffAndCustomerCheck.js:94 | DEV確認: 営業担当者フィールド返却 | 読み取り/DEV | 到達なし |
| 39 | src/99_DevLeadAssigneeIdRepairDryRun.js:8 | DEV修正ツール: '営業担当者' 列名リスト | 定義/DEV | 到達なし |
| 40 | src/99_DevLeadAssigneeIdRepair.js:9 | DEV修正ツール: '営業担当者' 列名リスト | 定義/DEV | 到達なし |
| 41 | src/99_DevLeadAssigneeAssignmentPolicyDryRun.js:8 | DEV修正ツール: '営業担当者' 列名リスト | 定義/DEV | 到達なし |
| 42 | src/99_DevLeadAssigneeOrphanDiagnosis.js:9 | DEV修正ツール: '営業担当者' 列名リスト | 定義/DEV | 到達なし |
| 43 | src/99_DevCoreSchemaV1HeaderDetailAuditV3.js:34 | DEV監査: '取引状況営業担当者' 列名（別列名）を使用 | 定義/DEV | 到達なし |
| 44 | src/28_AnalyticsEngine.js:3 | コメント（営業担当者の成約率分析） | コメント | 【未確認】 |
| 45 | src/28_AnalyticsEngine.js:121-122 | コメント（全営業担当者の分析レポート） | コメント | 【未確認】 |
| 46 | src/28_AnalyticsEngine.js:165 | コメント（全営業担当者のアサイン推奨） | コメント | 【未確認】 |
| 47 | src/06_BuddyFeedbackService.js:60 | AIプロンプト内の「営業担当者」テキスト | ラベル（プロンプト） | 旧方式のみ（index.html 経由） |
| 48 | src/06_BuddyFeedbackService.js:242 | AIプロンプト内の「営業担当者」テキスト | ラベル（プロンプト） | 旧方式のみ |
| 49 | src/05_BuddyCoachingService.js:598 | AIプロンプト内の「営業担当者」テキスト | ラベル（プロンプト） | 旧方式のみ |
| 50 | src/34_DealAnalysisService.js:167 | AIプロンプト内の「営業担当者」テキスト | ラベル（プロンプト） | 旧方式のみ |
| 51 | src/34_DealAnalysisService.js:188 | AIプロンプト内の「営業担当者」テキスト | ラベル（プロンプト） | 旧方式のみ |
| 52 | src/99_DevDemoSeed20260826.js:346-376 | DEMOシード: '営業担当者' フィールドに 'Demo Staff' をセット（6行） | 書き込み/DEV | 到達なし（DEV seed 専用） |
| 53 | src/08_Config.js:308 | LEADS ヘッダー定義: '営業担当者' // 26 | 定義 | 旧方式（CONFIG.HEADERS.LEADS 参照経由） |
| 54 | src/08_Config.js:552 | CUSTOMERS ヘッダー定義: '営業担当者' // 10 | 定義 | 旧方式（CONFIG.HEADERS.CUSTOMERS 参照経由） |
| 55 | src/18_CustomerRegistration.js:442 | 顧客マスタ新規登録: 営業担当者を空で登録 | 書き込み | 新方式（顧客登録 API 経由） |
| 56 | src/22_SetupIntegratedSheet.js:1156-1164 | 旧シート削除設定: '営業担当者マスタ' のシート名（別テーブル） | 定義 | 到達なし（setup 専用） |
| 57 | src/99_ColumnRenameExecution.js:1234 | 列リネーム実行: '営業担当者' → 'sales_assignee_name' のマッピング | 定義/DEV | 到達なし（リネーム実行ツール） |
| 58 | src/請求書発行.js:432 | 旧ERP: 「営業担当者」→「取引状況営業担当者」列マッピング | 読み取り | 旧方式のみ（index.html 経由） |
| 59 | src/請求書発行.js:539-547 | 旧ERP: 「営業担当者」列名で顧客マスタ・売上データシートを参照 | 読み取り/書き込み | 旧方式のみ |
| 60 | src/11_DailyReportService.js:4 | コメント（営業担当者の日報管理） | コメント | 旧方式のみ |
| 61 | frontend/src/content/ja/customers.ts:40 | 顧客一覧表示ラベル: salesAssigneeName = '営業担当者' | ラベル | 新方式（getCoreCustomersForFrontend 戻り値の表示に使用） |
| 62 | frontend/src/content/ja/customers.ts:61 | 顧客詳細表示ラベル: salesAssigneeName = '営業担当者' | ラベル | 新方式 |

**集計**:
- 新方式で使用（`getCoreCustomersForFrontend` / `getCoreCustomerForFrontend` / `18_CustomerRegistration.js`）: 8件（#1, #2, #20, #21, #22, #23, #55, #61/62）
- 旧方式のみ（src/index.html / 請求書発行.js 経由）: 21件（#5, #8, #12, #13, #14, #15, #16, #17, #47, #48, #49, #50, #51, #53, #54, #58, #59, #60 ほか）
- 到達なし（DEV専用 / seed 関数 / setup ツール）: 25件
- 【未確認】: 5件（#9, #10, #11, #44, #45, #46）

---

## 3. STAFF 参照 API の有無

| 確認項目 | 結果 |
|---------|------|
| 担当者一覧取得 API の存在 | あり（`getStaffList`: src/27_WebApp.js:1297、`getStaffListForAssign`: src/27_WebApp.js:1416、`getSalesStaffList`: src/27_WebApp.js:1548） |
| React フロント（frontend/src）からの ID→名前解決 API 呼び出し | なし（`getStaffList` / `getSalesStaffList` / `getStaffListForAssign` は frontend/src/ から未呼び出し） |
| 旧 ERP（src/index.html）からの呼び出し | あり（`getSalesStaffList`: index.html:17432, 22678、`getStaffListForAssign`: index.html:15534、`getStaffList`: index.html:16206） |
| フロントでの ID→名前解決の可否 | 不可能（React フロントに担当者一覧取得 API のバインドなし） |
| sales_assignee_id の現在の参照 | Registry 定義のみ（src/00_CoreSchemaRegistry.js:17 で CUSTOMERS テーブルに SALES_ASSIGNEE_ID 列定義あり）。コード上での読み取り・書き込みは確認されず |

---

## 4. データの現状（GAS実行結果: 2026-09-01T10:22:51Z）

### 現行スキーマシートのみ記載（バックアップ・旧シートは除く）

#### リード管理（正本シート）
| 列名 | 列番号 | 全データ行数 | 非空行数 | 担当者名の値 |
|------|--------|------------|--------|------------|
| sales_assignee_name | 26 | 10 | 0 | なし（全行空） |

#### 顧客マスタ（正本シート）
| 列名 | 列番号 | 全データ行数 | 非空行数 | 担当者名の値 |
|------|--------|------------|--------|------------|
| 営業担当者 | 10 | 6 | 6 | Demo Staff（6行全て） |

#### その他（参考: バックアップ・旧シート）
| シート名 | 列名 | データ行数 | 非空行数 | 確認された担当者名 |
|---------|------|-----------|--------|-----------------|
| Copy of リード管理 | 営業担当者 | 382 | 357 | 谷澤 伸吾、[メールアドレス]、阿部 竜馬、村中 |
| Copy of 顧客マスタ | 営業担当者 | 51 | 51 | 谷澤、阿部 |
| リード_アーカイブ | 営業担当者 | 132 | 0 | なし |
| リード_成約 | 営業担当者 | 0 | 0 | なし |
| 見積書管理_旧 | 営業担当者 | 56 | 11 | [メールアドレス] |
| 顧客マスタ_旧 | 営業担当者 | 52 | 52 | 営業 太郎、谷澤、阿部 |
| 顧客マスタ_pre_demo_20260826 | 営業担当者 | 69 | 51 | 谷澤、阿部 |

---

## 5. 書き換えの前提条件

| 確認項目 | 事実 |
|---------|------|
| 名前が必要な箇所数（新方式、React フロント） | 4件（getCoreCustomersForFrontend, getCoreCustomerForFrontend の各2箇所） |
| STAFF 参照で代替可能か（ID→名前解決） | 不可能（React フロントには担当者一覧取得 API のバインドが存在しない） |
| ID→名前解決の API が存在するか（React フロント向け） | なし（getStaffList 等は frontend/src/ から未呼び出し） |
| 顧客マスタの SALES_ASSIGNEE_ID 列の存在 | あり（Registry 定義済み、DEV 現行シートにも存在確認済み） |
| 顧客マスタ正本シートの SALES_ASSIGNEE_ID のデータ | 【未確認】（GAS 実行結果では値の内容を取得していない） |
| リード管理シートの ASSIGNEE_ID との対応関係 | Registry に ASSIGNEE_ID あり（LEADS.ASSIGNEE_ID → STAFF テーブル参照）。sales_assignee_name との二重持ちが現状 |
| 18_CustomerRegistration.js の新規登録での sales_assignee_name 書き込み | 空文字で書き込みのみ（値なし） |

---

## 6. 【未確認】項目

1. **src/12_DashboardService.js の参照**: getDashboardKPIs 関数（src/27_WebApp.js:332 で定義）から到達するかどうか未確認。コメント行のみでありコードとしての影響は低いと見られるが、実体確認が必要。

2. **src/28_AnalyticsEngine.js の参照**: コメント行のみ。呼び出し元が新旧どちらか未確認。

3. **顧客マスタ正本シートの SALES_ASSIGNEE_ID の現在値**: GAS 実行結果では `sales_assignee_id` 列の有無は確認できたが、実際の値（空か、staffId が入っているか）は未確認。

4. **見積書管理（正本シート）の sales_assignee_name の現在値**: GAS 結果は `見積書管理_旧` のみ。Registry の QUOTES テーブルには sales_assignee_name 列の定義はないが、11_QuoteService.js はシートに直接アクセスしている。正本見積書管理シートの状況が未確認。

5. **19_ReminderService.js のバグ詳細**: L28 で `buildColIndex(headers, ['営業担当者'])` と渡しているが、L42 で `colIndex['sales_assignee_name']` でアクセスしている。`buildColIndex` はヘッダー名文字列をキーとして返すため、このアクセスは常に `undefined` を返す。結果として staffName は常に空文字になっている。廃止の前後にかかわらず既存バグとして記録。

---

## 7. PO 判断が必要な項目

1. **React フロントでの担当者名表示**: 現在 `getCoreCustomersForFrontend` が `salesAssigneeName`（名前文字列）を返しており、フロントはそのまま表示している。廃止後に ID のみとする場合、React フロント側に `getStaffList` 等のバインドを追加して ID→名前解決する経路の実装が必要になる。

2. **旧 ERP（src/index.html）の移行方針**: `assignLeadToStaff`（src/27_WebApp.js:1667）が sales_assignee_name に名前を書き込んでいる。旧 ERP が廃止されるまでこの書き込みは継続される。

3. **35_SalesDataSyncService.js の移行**: 請求書発行フロー（旧 ERP 系）が顧客マスタの sales_assignee_name を参照して売上データシートに転記している。旧 ERP 廃止タイミングまたは、ID→名前解決の代替経路を設ける必要がある。

4. **バックアップ・旧シートの扱い**: Copy of リード管理（357行の非空データあり）、顧客マスタ_旧等のシートは現行スキーマ外。廃止作業の対象範囲に含めるかどうか判断が必要。

5. **19_ReminderService.js の既存バグ**: staffName が常に空になっているバグ（[未確認] 項目5参照）を廃止前に修正するかどうか判断が必要。

---

## getCoreStaffForFrontend の確認（2026-09-01）

### 戻り値フィールド

[実績] src/28_CoreStaffReadApi.js 行 31-42:

| フィールド名 | 物理列 | 内容 |
|------------|-------|------|
| `staffId` | STAFF_ID | スタッフID |
| `fullNameJa` | LAST_NAME_JA + FIRST_NAME_JA | 氏名（スペース結合） |
| `role` | ROLE | 役割 |
| `status` | STATUS | ステータス |
| `email` | EMAIL | メールアドレス |

### ID と名前の両方の有無

あり。`staffId`（ID）と `fullNameJa`（名前）の両方が返る。
**フロントでのID→名前変換が可能。新API不要。**

有効フィルタ: `status === activeStatus（有効）` のスタッフのみ返す（行 28-29）。
ページング: なし（全件1回の呼び出しで返す）。

### 使用状況（frontend/src/）

[実績] grep 結果:

- `frontend/src/gas/client.ts` 行 245: 呼び出し
- `frontend/src/gas/types.d.ts` 行 20: 型定義
- `frontend/src/preview/gasRunnerMock.ts` 行 297: モック（`succeed([])` を返す）

---

## LEADS への sales_assignee_id 追加（2026-09-01）

- 実施PRs: #869 / #870
- 列追加: sales_assignee_name（col26）の直後に sales_assignee_id（col27）を挿入
- Registry: LEADS.SALES_ASSIGNEE_ID を追加（SALES_ASSIGNEE_NAME の直後）
- バックアップ: リード管理_backup_20260901_assigneeid（rows:11, cols:51）
- 検証: Conformance Audit 0件（LEADS 定義52 / 実シート52）

---

## フロント実装（2026-09-01）

### 切り替え対象

| ファイル | 変更内容 |
|---------|---------|
| frontend/src/features/customers/contracts.ts | CustomerSummaryDto / CustomerProfileDto に salesAssigneeId: string を追加 |
| frontend/src/pages/customers/customerConfig.ts | resolveAssigneeName 関数追加（ID→名前変換 + フォールバック） |
| frontend/src/pages/customers/CustomerListPage.tsx | staffMap（useMemo・画面ごと1回）を適用 |
| frontend/src/pages/customers/CustomerDetailPage.tsx | staffMap（useMemo・画面ごと1回）を適用 |
| frontend/src/preview/gasRunnerMock.ts | モックデータに salesAssigneeId: 'EMP-00001' を追加 |

### フォールバック方針

salesAssigneeId が空または staffMap にヒットしない場合は salesAssigneeName を使用。
name も空の場合は空文字 '' を表示（「未割当」等の固定文字列は使わない）。

### Evaluator 確認結果

- 顧客一覧: 担当者名「Preview User」表示 PASS
- 顧客詳細: 「営業担当者」フィールドに「Preview User」表示 PASS
- 白画面・コンソールエラーなし PASS
- PR: #874

## 次フェーズの課題

1. フォールバック（salesAssigneeName への退避）の除去（name 列削除フェーズ）
2. LEADS.SALES_ASSIGNEE_NAME の削除（Registry + シート、値0件）
3. CUSTOMERS.SALES_ASSIGNEE_NAME の削除（Registry + シート、参照書き換え後）
