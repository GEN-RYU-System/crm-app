# LEADS 定義外13列 監査レポート

作成日: 2026-09-01  
調査対象ブランチ: release/gas-audit-docs  
調査方法: コード静的解析（grep・Read）+ GAS 読み取り専用関数  
POの決定: **日報 / 週次月次レポート / 商談レポートを残す。Buddyコーチングのみ廃止**

---

## 1. 背景

CoreSchemaRegistry の LEADS 定義は 51 列だが、実シートには 64 列存在する（差 13 列）。  
これらは列名整形（PR #818–820）の対象外とした。  
本レポートは「残すべきか・廃止すべきか」の PO 判断材料を提供する。

---

## 2. レポートサービス 4 ファイルの実体確認

### 2-1. `src/11_DailyReportService.js`（日報）

| 項目 | 内容 |
|------|------|
| シート名 | `日報`（独立シート） |
| 主要関数 | `saveDailyReport` (L227), `getDailyReport` (L322), `getDailyReportHistory` (L380), `getTeamDailyReports` (L440) |
| 自動集計 | `getTodayStats` (L118): 商談管理・リード一覧(IN/OUT) から `assignee_id`・`商談日`・`ステータス`・`初回接触日` を読む（すべて Registry 定義列） |
| LEADS 列参照 | `assignee_id` / `初回接触日` のみ（Registry 定義列）。定義外13列への参照なし |
| Buddy依存 | なし |
| PO方針との整合 | **残す（Keep）** — Buddy と完全に独立 |

日報シートの列:  
`日報ID, 担当者ID, 担当者名, 日付, 今日出来たこと, 未達成だったこと, 困っていること, 学び・気づき, 明日の予定, ひとこと, 商談数（自動）, 成約数（自動）, 新規接触数（自動）, 提出時刻, ステータス`

---

### 2-2. `src/13_DealReportService.js`（商談レポート）

| 項目 | 内容 |
|------|------|
| シート名 | `商談レポート`（独立シート） |
| 主要関数 | `saveDealReport` (L14), `getDealReportsByStaff` (L280), `getDealReports` (L330), `submitDealReportFromSlide` (L382) |
| LEADS 参照 | `getDealDataForReport` (L138): 商談IDで LEADS を引き、`customer_name`・`country` のみ使用。他列は読み取るが使わない |
| Buddy依存 | `generateDealFeedback` (L76): Buddy フィードバック生成（`06_BuddyFeedbackService.js` 呼び出し）。成功・失敗どちらでも `saveDealReport` は正常完了する |
| PO方針との整合 | **残す（Keep）** — Buddy フィードバック列は商談レポートシートにのみ存在し、LEADS 定義外13列とは別物 |

商談レポートシートの列（26列）:  
`レポートID, 担当者ID, 商談ID, 提出日, 商談開始日, 商談結果, 顧客名, 顧客の国, 取り扱い商材, 販売先, 信頼重視/価格重視, 1回の発注金額, 購入頻度, 月の発注量見込み, パートナーシップ度, 商談の手応え, 良かった点, 成約ポイント, 改善点, アクションプラン, 次回アクション日, 対象外理由, 見送り理由, 商談ログID, Buddyフィードバック, 作成日時`

> **注意**: `1回の発注金額`・`購入頻度`・`商談の手応え`・`Buddyフィードバック` は商談レポートシートの列名であり、LEADS シートの定義外13列とは別シート・別データ。

---

### 2-3. `src/20_ReportService.js`（週次・月次レポート）

| 項目 | 内容 |
|------|------|
| シート名 | `週次レポート` / `月次レポート`（独立シート） |
| 主要関数 | `saveWeeklyReport` (L93), `saveMonthlyReport` (L182), `getWeeklyReport` (L10), `getMonthlyReport` (L36) |
| Buddy依存 | `generateBuddyFeedbackForReport` (L297): **スタブ実装**（Gemini API 不使用）。テンプレート文字列を返すだけ。分離可能 |
| LEADS 列参照 | なし |
| PO方針との整合 | **残す（Keep）** — コア保存・取得関数は Buddy スタブと分離できる |

週次レポートシートの列:  
`レポートID, 担当者ID, 担当者名, 対象週, 今週の成果, 良かった点, 改善点, 来週の目標, 困っていること, Buddyへの質問, Buddyフィードバック, 提出日時`

月次レポートシートの列:  
`レポートID, 担当者ID, 担当者名, 対象月, 今月の成果, 良かった点, 改善点, 来月の目標, Buddyフィードバック, 提出日時`

---

### 2-4. `src/30_BuddyReportService.js`（Buddy レポートサービス）

| 項目 | 内容 |
|------|------|
| シート名 | `週次レポート` / `月次レポート`（20_ReportService と同一シートだがスキーマが異なる） |
| 主要関数 | `submitWeeklyReport` (L43), `submitMonthlyReport` (L232), `generateWeeklyBuddyFeedback` (L422), `generateMonthlyBuddyFeedback` (L471) |
| Gemini API | `callGeminiApi` (L527): `gemini-2.0-flash` を使用。`GEMINI_API_KEY` が必須 |
| API制限 | `checkBuddyApiLimit` (L570): CacheService で 20回/日 管理 |
| LEADS 参照 | `getStaffMonthlyPerformance` (L599): LEADS シートから `deal_result`・`first_transaction_amount` を読む（Registry 定義列）。`進捗ステータス` を `headers.indexOf` で検索しているが、この列名は LEADS に存在せず -1 を返す（バグ・実害なし） |
| PO方針との整合 | **廃止（Abolish）** — このファイル全体が Buddy コーチング専用 |

---

## 3. LEADS 定義外13列の分類

### 分類基準

| 分類 | 定義 |
|------|------|
| **レガシー専用** | 活性サービスコードからの参照ゼロ。旧スキーマの残骸 |
| **Buddy複合** | LEADS 列自体は空初期化のみだが、同名列が商談レポートシートにも存在し Buddy 機能から参照される |
| **Buddy専用** | 旧「統合シート」設計（`22_SetupIntegratedSheet.js`）の埋め込みレポート列。現行の独立レポートシートに移行済み |
| **要PO確定** | 廃止方針は固まっているが、将来の Reference が残るか PO が明示的に確認すべき列 |

### 13列一覧

| # | 列名 | 分類 | 参照ファイル（活性） | データ有無（DEV実測） |
|---|------|------|---------------------|---------------------|
| 1 | リード進捗 | **レガシー専用** | なし（99_* devのみ） | 10/10 行（シード由来 ※1） |
| 2 | 商談進捗 | **レガシー専用** | なし（99_* devのみ） | 10/10 行（シード由来 ※1） |
| 3 | 商談の手応え | **レガシー専用** | `23_SheetService.js` で空初期化のみ | **0/10 行** |
| 4 | 1回の発注金額 | **Buddy複合** | `06_BuddyFeedbackService.js` (Buddy/商談FB)・`13_DealReportService.js` (商談レポートシート列) | **0/10 行** |
| 5 | 購入頻度(月次) | **Buddy複合** | 同上 + `99_ReconcileArchive.js` (dev) | **0/10 行** |
| 6 | Good Point | **Buddy専用** | `22_SetupIntegratedSheet.js`・`23_SheetService.js` で空初期化のみ | **0/10 行** |
| 7 | More Point | **Buddy専用** | 同上 | **0/10 行** |
| 8 | 反省と今後の抱負 | **Buddy専用** | 同上 | **0/10 行** |
| 9 | レポート提出日 | **Buddy専用** | 同上 | **0/10 行** |
| 10 | レポート確認者 | **Buddy専用** | 同上 | **0/10 行** |
| 11 | レポート確認日 | **Buddy専用** | 同上 | **0/10 行** |
| 12 | レポートコメント | **Buddy専用** | 同上 | **0/10 行** |
| 13 | Buddyフィードバック | **要PO確定** | `22_SetupIntegratedSheet.js`・`23_SheetService.js` で空初期化のみ | **0/10 行** |

> ※1 `リード進捗`・`商談進捗` の DEV データは `99_DevDemoSeed20260826.js`（L278–332）によるシード値のみ。活性サービスコードからの書き込みはなし。PROD 実データの確認が必要。

### 各分類の詳細

#### レガシー専用（3列）

- **リード進捗 / 商談進捗**: 旧システムのステータス列。現行は `lead_status`・`deal_result` に相当する Registry 列が存在し役割が重複。活性サービスコードからの書き込みなし。DEV では `99_DevDemoSeed20260826.js` が '成約'/'商談中' 等を書き込んでいるため 10/10 に見えるが、PROD ではシードが走らないため実データ確認が必要。
- **商談の手応え（LEADS列）**: `23_SheetService.js` で新規リード作成時に空文字を書くのみ。`06_BuddyFeedbackService.js` が参照する `reportData.dealFeeling` はフォーム入力値であり、この LEADS 列を読むコードは存在しない。DEV 実測 0/10 行。

#### Buddy複合（2列）

- **1回の発注金額 / 購入頻度(月次)（LEADS列）**: LEADS シートには空初期化のみ。同名の列が商談レポートシートにも独立して存在し、`06_BuddyFeedbackService.js`（Buddy商談フィードバック）と `13_DealReportService.js`（商談レポート保存）がフォーム入力データとして使う。
  - LEADS 列の実態: `23_SheetService.js` の空文字初期化のみ（データ書き込みなし）
  - 商談レポートシート列の実態: 商談時にユーザーが入力した値が書かれる（Keep対象）
  - **PO判断**: LEADS 列は廃止可能だが、商談レポートシート列は Keep

#### Buddy専用（7列）

`22_SetupIntegratedSheet.js` が設計した旧「統合シート」構成で、LEADS に週次レポートのフィールドを直接埋め込んでいた（Phase 6 Buddy設計）。  
現行は独立した `週次レポート` / `月次レポート` シートに移行済み。  
これら7列は `23_SheetService.js` でのみ空文字初期化される。実データが書かれたことはないと推定されるが、GAS確認が必要。

#### 要PO確定（1列）

- **Buddyフィードバック（LEADS列）**: 商談レポートシートにも同名列があり混乱の原因。LEADS 列は `23_SheetService.js` で空初期化のみ。廃止が自然だが、既存データがある場合は移行が必要。

---

## 4. データ有無確認（GAS）

### 確認関数

本調査と同じ PR に含まれる `src/99_DevLeadUndefinedColumnAudit.js` の `auditLeadUndefinedColumns()` を使用する。

```bash
# DEV 環境マージ後に実行
clasp run auditLeadUndefinedColumns
```

### 書き込み系操作の確認

```bash
grep -n "setValue\|setValues\|appendRow\|deleteRow\|clearContent" \
  src/99_DevLeadUndefinedColumnAudit.js
# → 0件（読み取り専用を確認済み）
```

### 実行結果（DEV実測: 2026-09-01T02:16:05Z）

```bash
clasp run auditLeadUndefinedColumns
```

```json
{"sheetName":"リード管理","totalRows":10,"totalCols":64,"auditedAt":"2026-09-01T02:16:05.696Z","columns":[
  {"columnName":"リード進捗",     "exists":true,"colPosition":4, "nonEmptyCount":10,"totalRows":10},
  {"columnName":"商談進捗",       "exists":true,"colPosition":5, "nonEmptyCount":10,"totalRows":10},
  {"columnName":"1回の発注金額",  "exists":true,"colPosition":39,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"購入頻度(月次)", "exists":true,"colPosition":40,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"商談の手応え",   "exists":true,"colPosition":42,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"Good Point",     "exists":true,"colPosition":49,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"More Point",     "exists":true,"colPosition":50,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"反省と今後の抱負","exists":true,"colPosition":51,"nonEmptyCount":0,"totalRows":10},
  {"columnName":"レポート提出日", "exists":true,"colPosition":52,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"レポート確認者", "exists":true,"colPosition":53,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"レポート確認日", "exists":true,"colPosition":54,"nonEmptyCount":0, "totalRows":10},
  {"columnName":"レポートコメント","exists":true,"colPosition":55,"nonEmptyCount":0,"totalRows":10},
  {"columnName":"Buddyフィードバック","exists":true,"colPosition":56,"nonEmptyCount":0,"totalRows":10}
]}
```

**判定**:
- 全13列が実シートに存在する
- `リード進捗`・`商談進捗`: DEV では 10/10 行に値あり → ただし全件がシードスクリプト由来（`99_DevDemoSeed20260826.js:278–332`）。PROD での実データ確認が必要。
- 残り11列: 全て 0/10 行 → 安全に削除可能（PROD 確認後）

---

## 5. PO 判断が必要な事項

| # | 判断事項 | 背景 | 推奨 |
|---|----------|------|------|
| 1 | **Buddyフィードバック（LEADS列）を廃止するか** | 商談レポートシートと同名列が二重に存在し混乱の原因。LEADS 列は現時点で空と推定 | 廃止推奨（データ確認後） |
| 2 | **Buddy専用7列を削除するか** | 現行の独立レポートシートに移行済み。LEADS に残す理由なし | データ確認後に削除推奨 |
| 3 | **Buddy複合2列（1回の発注金額・購入頻度）のLEADS列を整理するか** | 商談レポートシート列と名前が衝突。LEADS 列は空のまま | LEADS 列は削除し、商談レポートシート列を Keep 推奨 |
| 4 | **レガシー3列の削除タイミング** | リード進捗・商談進捗・商談の手応えは完全に未使用 | 即時削除可能（データ確認後） |

---

## 6. Buddy廃止後の残存コード対応方針

| ファイル | 対応内容 |
|---------|---------|
| `src/30_BuddyReportService.js` | ファイル全体を廃止（Buddy コーチング専用） |
| `src/06_BuddyFeedbackService.js` | `generateDealFeedback` は商談レポートサービスが呼ぶため、商談レポート独自の位置へ移動または存続（PO確認） |
| `src/20_ReportService.js` | `generateBuddyFeedbackForReport` (L297) のスタブ呼び出しを削除（または関数ごと削除） |
| `src/13_DealReportService.js` | `generateDealFeedback` 呼び出し (L76) を廃止するか残すか PO 確認 |
| `src/22_SetupIntegratedSheet.js` | Buddy 列（Good Point 等）を列定義から除去 |
| `src/23_SheetService.js` | 空初期化コード (L704–715) を除去 |

---

## 7. 参照ファイル一覧

| ファイル | 役割 |
|---------|------|
| `src/11_DailyReportService.js` | 日報（Keep・Buddy非依存） |
| `src/13_DealReportService.js` | 商談レポート（Keep・Buddy依存は外部化可能） |
| `src/20_ReportService.js` | 週次・月次レポート（Keep・Buddyスタブ分離可能） |
| `src/30_BuddyReportService.js` | Buddy専用（Abolish） |
| `src/06_BuddyFeedbackService.js` | Buddy商談フィードバック（PO確認：一部Keep可能性） |
| `src/22_SetupIntegratedSheet.js` | 旧統合シート設計（Buddy列含む） |
| `src/23_SheetService.js` | リード作成時の空初期化（Buddy列含む） |
| `src/99_DevLeadUndefinedColumnAudit.js` | 本調査の GAS 確認関数（本 PR で追加） |
