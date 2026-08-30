# SQL 適合性調査レポート

## 1. 調査基準 SHA

| 項目 | 値 |
|------|---|
| 調査時点 GAS デプロイ SHA | `1bc146b8bb818425c152291145ad0b43d0a9ebd0` (PR #702 squash, 2026-08-30T15:19:29Z) |
| dumpAllSheetHeaders 取得 SHA | 上記と同一 |
| runSqlReadinessCheck 実行日時 | 2026-08-30T15:30+ JST |
| 調査対象 | 移行対象22シート（`docs/sql-migration-scope.md` 参照） |
| 参照ファイル | `docs/sheet-headers-snapshot.md`, `src/00_CoreSchemaRegistry.js`, `src/99_SqlReadinessCheck.js` |

---

## 2. 【未確認】#1〜#7 の解消結果

`docs/sql-migration-scope.md` セクション6 の【未確認】項目を、`clasp run dumpAllSheetHeaders` と
コード精査で解消した。

### #1 国マスタの列数差1の原因

| 項目 | 値 |
|------|---|
| スナップショット時（SHA `fb90782df`）実シート列数 | 7（`国名（日本語）` 列なし） |
| 現時点の実シート列数 | 8（`国名（日本語）` 追加済み） |
| CoreSchemaV1 定義列数 | 8 |

**【事実】** PR #690（`feat: 国マスタ日本語名書き込み`）が `国名（日本語）` 列にデータを書き込んだ時点で差異が解消。
スナップショット取得時（PR #673）はまだ列が空だったため 7 件と計上されていた。
現時点は差分 0（CoreSchema 8 = 実シート 8）。

### #2 作品マスタ_共用在庫 の 4 列ヘッダー名

`ip_id` / `作品名` / `別名` / `有効`

### #3 選択肢マスタ 36 列のヘッダー名

`リード種別` / `リードID` / `流入経路` / `流入経路（IN）` / `流入経路（OUT）` / `アーカイブ理由` /
`リードステータス` / `返信速度` / `連絡手段` / `取り扱い商材` / `温度感` / `想定規模` /
`商談ステータス` / `商談結果` / `顧客タイプ` / `販売形態` / `競合比較中` / `役割` /
`ステータス` / `カテゴリ` / `購入頻度(月次)` / `見込度` / `支払い方法` / `発送方法` /
`商品ステータス` / `為替` / `為替レート` / `次回アクション日` / `ページ` / `リードシーン` /
`仕入元` / `eLogiCSV格納フォルダ` / `ラベルPDF格納フォルダ` / `FAQ_カテゴリ` / `支払サイト` / `キャンセル理由`

### #4 frontend/src/ の `担当者ID` 3 件の参照先

`frontend/src/content/ja/leads.ts:42` に `leadStatus: 'リード進捗'` のみ定義され、
3 件の `担当者ID` は以下の通り。いずれも CUSTOMERS の列を指してない。

| ファイル | キー | 対応するシート列 |
|---------|------|----------------|
| `frontend/src/content/ja/quotes.ts:50` | `staffId: '担当者ID'` | `見積もり管理.担当者ID`（QUOTES.STAFF_ID → STAFF テーブル参照） |
| `frontend/src/content/ja/salesOrders.ts:221` | `labelShipmentShippingAssigneeId: '担当者ID'` | `発送.発送担当ID`（SHIPMENTS.STAFF_ID → STAFF テーブル参照） |
| `frontend/src/content/ja/auth.ts:3` | `staffIdLabel: '担当者ID'` | `担当者マスタ.担当者ID`（STAFF 主キー） |

**【事実】** `CustomerProfileDto`（`frontend/src/features/customers/contracts.ts`）に `担当者ID` に対応するフィールドなし。
顧客マスタの実列 `担当者ID`（CoreSchemaV1 未定義の差分列）はフロントエンドから参照されていない。

### #5 `リード進捗` の frontend 参照

`frontend/src/content/ja/leads.ts:42`:
```typescript
fields: { ..., leadStatus: 'リード進捗' }
```

`leadStatus` キーは `content/ja/leads.ts` の `fields` オブジェクト内にのみ存在し、
`frontend/src/` の他のファイル（コンポーネント・ページ）で `leads.fields.leadStatus` を参照する箇所はゼロ件（grep 確認済み）。

**【事実】** i18n ラベルとして定義されているが画面表示に使われておらず、`リード進捗` 列は移行要否の判断対象（LEADS 差13列の1つ）。

### #7 会話ログ（商談用）の残り 6 列ヘッダー名

全 11 列: `ログID` / `リードID` / `日時` / `送受信` / `発言者` / `原文` / `原文言語` / `翻訳文` / `記録者ID` / `記録日時` / `商談解析`

コードが参照する 5 列: `リードID` / `ログID` / `日時` / `原文` / `送受信`
残り 6 列（コード未参照）: `発言者` / `原文言語` / `翻訳文` / `記録者ID` / `記録日時` / `商談解析`

---

## 3. LEADS 差 13 列の再分類

Buddy 廃止決定（PO, 2026-08-30）を受け、LEADS の CoreSchemaV1 未定義 13 列について
参照ファイルを調査した。**削除の可否は判定しない（PO 判断）。**

### 判定基準

| 判定 | 条件 |
|------|------|
| **Buddy専用** | 参照元が `05_BuddyCoachingService.js` / `30_BuddyReportService.js` のみ |
| **他機能も使用** | 上記以外のファイルからも参照される |
| **未参照** | src/ / frontend/src/ 両方で0件 |

### 結果

| 列名 | Buddy専用件数 | 非Buddy件数 | 参照ファイル（非Buddy・抜粋） | 判定 |
|------|-------------|------------|--------------------------|------|
| リード進捗 | 0 | 27 | `99_ReconcileArchive.js`, `99_DevDemoSeed20260826.js`, `99_StaffMasterDump.js` | 他機能も使用 |
| 商談進捗 | 0 | 34 | `99_ReconcileArchive.js`, `99_DevDemoSeed20260826.js`, `99_StaffMasterDump.js` | 他機能も使用 |
| 1回の発注金額 | 0 | 9 | `21_SetupDealReport.js`, `13_DealReportService.js`, `06_BuddyFeedbackService.js`, `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| 購入頻度(月次) | 0 | 8 | `21_SetupDealReport.js`, `13_DealReportService.js`, `99_ReconcileArchive.js` | 他機能も使用 |
| 商談の手応え | 0 | 11 | `21_SetupDealReport.js`, `13_DealReportService.js`, `06_BuddyFeedbackService.js`, `22_SetupIntegratedSheet.js` | 他機能も使用 |
| Good Point | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| More Point | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| 反省と今後の抱負 | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| レポート提出日 | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| レポート確認者 | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| レポート確認日 | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| レポートコメント | 0 | 4 | `22_SetupIntegratedSheet.js`, `23_SheetService.js` | 他機能も使用 |
| Buddyフィードバック | 8 | 32 | `20_ReportService.js`, `30_BuddyFeedbackLogger.js`, `13_DealReportService.js`, `06_BuddyFeedbackService.js`, `21_SetupDealReport.js`, `22_SetupIntegratedSheet.js`, `23_SheetService.js`, `08_Config.js` | 他機能も使用 |

**集計: Buddy専用 0列 / 他機能も使用 13列 / 未参照 0列**

> **注記:** 「Buddy専用」と定義される条件（`05_BuddyCoachingService.js` / `30_BuddyReportService.js` のみ）に該当する列は0件。
> ただし `Good Point` 〜 `レポートコメント` の7列は `22_SetupIntegratedSheet.js`（リード管理シートのヘッダー定義）と `23_SheetService.js` のみが参照しており、
> `Buddyフィードバック` は `30_BuddyReportService.js` を含む複数ファイルが参照している。
> 廃止手順・削除可否は PO 判断（セクション 7 参照）。

---

## 4. シート別 SQL 適合性判定表

`runSqlReadinessCheck` （`src/99_SqlReadinessCheck.js`）で先頭 100 行をサンプル調査した結果。

凡例: `OK` = 適合 / `NG` = 要整形 / `—` = データなし（ヘッダー行のみ）

| # | シート名 | 主キー | 列名 | 1セル1値 | 型 | 数式 | 結合 | ヘッダー | **総合** |
|---|---------|:------:|:----:|:--------:|:--:|:----:|:----:|:--------:|:--------:|
| 1 | リード管理 | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 2 | 顧客マスタ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 3 | 配送先マスタ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 4 | 支払先マスタ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 5 | オーダー管理 | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 6 | オーダー明細 | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 7 | 見積もり管理 | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 8 | 見積もり明細 | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 9 | 発送 | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 10 | 仕入れ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 11 | フォームトークン | OK | OK | — | — | — | — | — | **OK** |
| 12 | 商品マスタ同期 | OK | **NG** | **NG** | OK | OK | OK | OK | **NG** |
| 13 | 作品マスタ_共用在庫 | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 14 | 国マスタ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 15 | 通貨マスタ | OK | OK | OK | OK | **NG** | OK | OK | **NG** |
| 16 | 流入元マスタ | OK | OK | OK | OK | OK | OK | OK | **OK** |
| 17 | 選択肢マスタ | **NG** | **NG** | OK | OK | **NG** | OK | OK | **NG** |
| 18 | 発行元マスタ | OK | **NG** | **NG** | OK | OK | OK | OK | **NG** |
| 19 | 会話ログ（商談用） | OK | OK | **NG** | OK | OK | OK | OK | **NG** |
| 20 | システム設定 | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 21 | 担当者マスタ | OK | **NG** | OK | OK | OK | OK | OK | **NG** |
| 22 | ログインセッション | OK | OK | OK | OK | OK | OK | OK | **OK** |

**総合 OK: 8シート** / **総合 NG: 14シート**

---

## 5. 要整形箇所の一覧（NG 詳細）

### 条件2 — 列名に空白・記号・括弧が含まれる

| シート名 | NG 列名 | 問題の種類 |
|---------|---------|-----------|
| リード管理 | `呼び方（英語）` | 全角括弧（）|
| リード管理 | `購入頻度(月次)` | 半角括弧() |
| リード管理 | `Good Point` | 半角スペース |
| リード管理 | `More Point` | 半角スペース |
| 顧客マスタ | `FedEx ID` | 半角スペース |
| 配送先マスタ | `Address 1` | 半角スペース |
| 配送先マスタ | `Address 2` | 半角スペース |
| 配送先マスタ | `Address 3` | 半角スペース |
| 配送先マスタ | `D Email` | 半角スペース |
| 配送先マスタ | `D Tax ID` | 半角スペース |
| 支払先マスタ | `Address 1` | 半角スペース |
| 支払先マスタ | `Address 2` | 半角スペース |
| 支払先マスタ | `Address 3` | 半角スペース |
| 支払先マスタ | `B Tax ID` | 半角スペース |
| 見積もり管理 | `PDF URL` | 半角スペース |
| 仕入れ | `送料/代行費` | スラッシュ/ |
| 商品マスタ同期 | `Japanese Title` | 半角スペース |
| 商品マスタ同期 | `English Title` | 半角スペース |
| 商品マスタ同期 | `Boxes per Case` | 半角スペース |
| 商品マスタ同期 | `Packs per Box` | 半角スペース |
| 商品マスタ同期 | `VOLUME WEIGHT` | 半角スペース |
| 商品マスタ同期 | `Release Date` | 半角スペース |
| 商品マスタ同期 | `Search Keywords` | 半角スペース |
| 商品マスタ同期 | `Exclude Keywords` | 半角スペース |
| 商品マスタ同期 | `Related Series` | 半角スペース |
| 国マスタ | `国ID(ISO2)` | 半角括弧() |
| 国マスタ | `国名（表示）` | 全角括弧（）|
| 国マスタ | `国名（日本語）` | 全角括弧（）|
| 選択肢マスタ | `流入経路（IN）` | 全角括弧（）|
| 選択肢マスタ | `流入経路（OUT）` | 全角括弧（）|
| 選択肢マスタ | `購入頻度(月次)` | 半角括弧() |
| 発行元マスタ | `Address 1` | 半角スペース |
| 発行元マスタ | `Address 2` | 半角スペース |
| 発行元マスタ | `Address 3` | 半角スペース |
| システム設定 | `（空）` 列 6〜14 | 空の列名（9列）|
| 担当者マスタ | `苗字（日本語）` | 全角括弧（）|
| 担当者マスタ | `名前（日本語）` | 全角括弧（）|
| 担当者マスタ | `氏名（日本語）` | 全角括弧（）|
| 担当者マスタ | `苗字（英語）` | 全角括弧（）|
| 担当者マスタ | `名前（英語）` | 全角括弧（）|
| 担当者マスタ | `Discord ID` | 半角スペース |

**条件2 合計: 41 列名 NG（15 シート）**

### 条件3 — 1セル1値（カンマ・改行区切り候補）

`runSqlReadinessCheck` が先頭 100 行をサンプルとして検出した結果。
カンマは「非数字文字列に含まれる」場合に候補として記録（テキストフィールドの自然なカンマとの区別は要手動確認）。

| シート名 | 検出列 | 検出タイプ | 備考 |
|---------|--------|-----------|------|
| 商品マスタ同期 | `Search Keywords` | カンマ区切り候補 | キーワードリスト形式の可能性 |
| 商品マスタ同期 | `Exclude Keywords` | カンマ区切り候補 | キーワードリスト形式の可能性 |
| 商品マスタ同期 | `Related Series` | カンマ区切り候補 | 複数シリーズ名の可能性 |
| 発行元マスタ | `結びの文` | カンマ区切り候補または改行 | 複数行テキストの可能性 |
| 会話ログ（商談用） | `原文` | カンマ区切り候補 | 会話文の自然なカンマ（要確認） |
| 会話ログ（商談用） | `翻訳文` | カンマ区切り候補 | 会話文の自然なカンマ（要確認） |

> **注記:** `会話ログ（商談用）` の `原文` / `翻訳文` は会話テキストであり、カンマは文の区切り符号（自然なカンマ）の可能性が高い。SQL 移行時は `TEXT` 型として扱う想定。真の複数値かは手動確認が必要。

### 条件5 — 数式あり

| シート名 | 数式が含まれる列 | 数式（サンプル） | 影響 |
|---------|----------------|-----------------|------|
| 通貨マスタ | `円換算レート`（3行目以降） | `=GOOGLEFINANCE("CURRENCY:USDJPY")` | SQL 移行後は数式が使えないため代替手段が必要 |
| 選択肢マスタ | `為替レート`（3行目以降） | `=GOOGLEFINANCE("CURRENCY:USDJPY")` | 同上 |

### 条件1 — 主キーなし

| シート名 | 状況 | 影響 |
|---------|------|------|
| 選択肢マスタ | 行を一意に識別できる主キー列が定義されていない | SQL テーブル化にあたり PK 設計が必要 |

---

## 6. 【未確認】項目

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 発行元マスタ 条件3 の具体的なカラム名（`結びの文`と推定、要確認） | 実データを目視またはシートを直接確認 |
| 2 | 会話ログ（商談用）の `原文` / `翻訳文` がカンマを自然な句読点として含むか、または実際に複数値を格納しているか | シートの実データを目視確認 |
| 3 | 商品マスタ同期の `Search Keywords` / `Exclude Keywords` / `Related Series` が CSV 形式（多値）か単一値か | シートの実データを目視確認 |
| 4 | ログインセッション（シート #22）の SQL 移行要否（PO 判断事項 #C 参照） | PO 判断 |

---

## 7. PO 判断が必要な項目

| # | 項目 | 選択肢 |
|---|------|-------|
| A | `CUSTOMERS.担当者ID`（CoreSchemaV1 未登録の実列）を SQL 移行後も保持するか | (a) CoreSchemaV1 に追加して正式列として移行 / (b) 廃止列として移行後に削除 |
| B | LEADS 差13列（全て「他機能も使用」）を SQL 移行後も保持するか | (a) SQL に追加列として移行（13列全部または選択移行）/ (b) 移行スコープ外として GAS スプレッドシートに残す |
| C | `ログインセッション` を SQL に移行するか（GAS 内部セッション管理のみ、フロントエンドはセッションIDのみやりとり） | (a) SQL に移行してセッション管理を統一 / (b) GAS スプレッドシートに残す |
| D | `会話ログ（商談用）` を SQL に移行するか（Inbox 4 関数がアクセス） | (a) SQL に移行 / (b) スコープ外 |
| E | `作品マスタ_共用在庫`（CoreSchemaV1 未登録、共用在庫 API が参照）を SQL に移行するか | (a) CoreSchemaV1 に追加して SQL 移行 / (b) GAS 側のみに残す |
| F | `選択肢マスタ`（36 列・CoreSchemaV1 未登録・主キーなし）を SQL に移行するか | (a) SQL に移行（主キー設計が必要）/ (b) GAS 側のみに残す |
| G | `システム設定`（CoreSchemaV1.SETTINGS、5 列 + 空列 9 列）を SQL に移行するか | (a) SQL に移行（空列は削除）/ (b) GAS スプレッドシートに残す |
| H | 条件2 NG 列名（41 列）のリネーム方針（例: `Address 1` → `address_1`、`FedEx ID` → `fedex_id`）| 整形方法・命名規則を決定する |
| I | 条件5 NG の `GOOGLEFINANCE` 数式（通貨マスタ / 選択肢マスタ）を SQL 移行後どこで更新するか | (a) 定期バッチで更新 / (b) 外部 API 直接参照 / (c) 手動更新 |
| J | LEADS 差13列のうち「Buddy廃止」による削除対象を確定するか | Buddy 廃止スコープと連動して決定 |

---

## 8. 読んだファイル / 未読ファイルの一覧

### 読んだファイル（本調査で確認済み）

| ファイルパス | 確認内容 |
|------------|---------|
| `docs/sql-migration-scope.md` | 移行対象22シートの定義と【未確認】項目 |
| `docs/sheet-headers-snapshot.md` | シートヘッダー一覧（前回スナップショット） |
| `src/00_CoreSchemaRegistry.js` | CoreSchemaV1 定義（全テーブル） |
| `src/99_SqlReadinessCheck.js` | 調査関数（本調査で新規追加） |
| `src/22_SetupIntegratedSheet.js` | LEADS 13列参照の文脈確認 |
| `src/23_SheetService.js` | 同上 |
| `frontend/src/gas/client.ts` | QuoteRecord.staffId の参照先確認 |
| `frontend/src/features/customers/contracts.ts` | CustomerProfileDto に担当者ID なしを確認 |
| `frontend/src/content/ja/leads.ts` | `leadStatus: 'リード進捗'` の未使用確認 |
| `frontend/src/content/ja/quotes.ts` | staffId の参照先確認 |
| `frontend/src/content/ja/salesOrders.ts` | 発送担当ID の参照先確認 |
| `frontend/src/content/ja/auth.ts` | 担当者ID の参照先確認 |

### 未読ファイル（確認が不十分なもの）

| ファイルパス | 未確認事項 |
|------------|---------|
| `frontend/src/features/auth.ts` | `担当者ID` が CUSTOMERS 列への参照かを確認（本調査で contracts.ts から間接確認 → 参照なしと判断） |
| `src/13_DealReportService.js` | LEADS 13列の参照文脈の詳細 |
| `src/06_BuddyFeedbackService.js` | 同上 |
