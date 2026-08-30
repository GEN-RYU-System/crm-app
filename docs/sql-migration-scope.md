# SQL 移行対象の確定と差分列の特定

## 1. 調査基準 SHA

| 項目 | 値 |
|------|---|
| 調査時点 HEAD | `5d99689` feat: 発送待ちタブに発送段階・請求書番号・発送先の国・支払状況の4列を追加 (#692) |
| sheet-headers-snapshot 取得時 GAS SHA | `fb90782df` (PR #673 squash merge, develop ブランチ) |
| 調査日 | 2026-08-30 |
| 調査範囲 | `frontend/src/gas/client.ts` に集約された全 44 フロントエンド呼び出し関数 |

---

## 2. 移行対象シート一覧

### 2-1. 移行対象（22 シート）

「移行対象」= 44 フロントエンド関数のいずれかが実際にシート読み書きを行うもの。

| # | シート名 | CoreSchemaV1 テーブルキー | 参照関数（代表例） |
|---|---------|--------------------------|-----------------|
| 1 | リード管理 | LEADS | getDashboardKPIs / getLeadsBatchForFrontend / createLead / updateLead 他 |
| 2 | 顧客マスタ | CUSTOMERS | getCoreCustomersForFrontend / getCoreCustomerForFrontend / getCoreOrdersForFrontend 他 |
| 3 | 担当者マスタ | STAFF | getCoreStaffForFrontend / loginWithPassword / getCurrentUser 他 |
| 4 | ログインセッション | LOGIN_SESSIONS | loginWithPassword / logout / getSessionUser |
| 5 | オーダー管理 | ORDERS | getCoreOrdersForFrontend / getCoreOrderDetailForFrontend / createCoreOrderForFrontend 他 |
| 6 | オーダー明細 | ORDER_LINES | getCoreOrderDetailForFrontend / createCoreOrderForFrontend / updateCoreOrderForFrontend |
| 7 | 発送 | SHIPMENTS | getCoreOrdersForFrontend / getCoreOrderDetailForFrontend / updateCoreOrderForFrontend |
| 8 | 仕入れ | PURCHASES | getCoreOrdersForFrontend / getCoreOrderDetailForFrontend / upsertCorePurchaseForFrontend |
| 9 | 見積もり管理 | QUOTES | getCoreQuotesForFrontend / getCoreQuoteForFrontend / createCoreQuoteForFrontend 他 |
| 10 | 見積もり明細 | QUOTE_LINES | getCoreQuoteForFrontend / createCoreQuoteForFrontend / updateCoreQuoteForFrontend |
| 11 | 配送先マスタ | SHIPPING_DESTINATIONS | getCoreCustomerForFrontend / getCoreOrdersForFrontend / getCoreOrderDetailForFrontend 他 |
| 12 | 支払先マスタ | PAYMENT_DESTINATIONS | getCoreCustomerForFrontend / getCoreAllCustomerAggregatesForFrontend 他 |
| 13 | 共用在庫 | SHARED_INVENTORY | getSharedInventoryForFrontend / getInventoryBatchForFrontend / getInventoryProductOptions 他 |
| 14 | 商品マスタ同期 | PRODUCTS | getSharedInventoryForFrontend / getInventoryBatchForFrontend / getInventoryProductOptions 他 |
| 15 | 作品マスタ_共用在庫 | なし（getSheetByName 文字列リテラル） | getSharedInventoryForFrontend / getInventoryBatchForFrontend |
| 16 | 国マスタ | COUNTRIES | getCoreOrdersForFrontend / getCoreOrderDetailForFrontend / getLeadFormOptions |
| 17 | 通貨マスタ | CURRENCIES | getCoreCurrenciesForFrontend / createCoreOrderForFrontend（為替レート取得） |
| 18 | 流入元マスタ | LEAD_SOURCES | getLeadFormOptions / getInboxBulkInitialLoad |
| 19 | 選択肢マスタ | なし（CONFIG.SHEETS.SETTINGS = '選択肢マスタ'、CoreSchemaV1.SETTINGS = 'システム設定' とは別） | getLeadFormOptions |
| 20 | 発行元マスタ | ISSUER | getCoreIssuerForFrontend / updateCoreIssuerForFrontend |
| 21 | 会話ログ（商談用） | なし（`CONFIG.SHEETS.CONVERSATION_LOG`='会話ログ' が不在のため getSheetByName('会話ログ（商談用）') にフォールバック） | getInboxConversationsForFrontend / getInboxConversationDetailForFrontend / getInboxBulkInitialLoad / getInboxMoreMessages |
| 22 | システム設定 | SETTINGS（CoreSchemaV1.SETTINGS = 'システム設定'） | createCoreOrderForFrontend（`getSettingValue('オーダー支払期日日数')`）/ createCoreQuoteForFrontend（`getSettingValue('見積もり有効期限日数')`） |

**注**: `checkSyncSignals` (CacheService のみ) と `pingForLatencyCheck` (シート無アクセス) と `getCoreOrderStatusOptionsForFrontend`・`getCorePurchaseStatusOptionsForFrontend` (CoreSchemaV1 の静的値のみ) の 4 関数はシートアクセスなし。

### 2-2. 除外シート一覧（44 関数が直接アクセスしない 55 シート）

| 除外理由 | シート名 |
|---------|---------|
| バックアップ系 | Copy of リード管理 / Copy of オーダー管理 / Copy of オーダー明細 / Copy of 発送 / Copy of 仕入れ / Copy of 見積もり管理 / Copy of 顧客マスタ / Copy of 配送先マスタ / Copy of 支払先マスタ / Copy of 会話ログ（商談用） / 顧客マスタ_backup_20260826 / 顧客マスタ_pre_demo_20260826 / リード管理_backup_20260807 |
| 旧版 | 発行元マスタ_旧 / 見積書管理_旧 / 顧客マスタ_旧 |
| アーカイブ・成約・失注 | リード_アーカイブ / リード_成約 / リード_失注 / リード_アーカイブ |
| テスト用 | 共用在庫_V2テスト |
| DEV 監査ログ | DEV参照整合性監査ログ / DEV構造監査ログ |
| 静的コードが参照する名前と不一致（実在するが到達不能） | 権限管理（コードは「権限設定」を参照）/ 請求書作成（コードは「📝請求書作成」を参照） |
| フロントエンド非経由（GAS 内部・バックグラウンド処理のみ） | フォームトークン / ログイン履歴 / ログインセッション（フロント経由なし、API 内部のみ） |
| 到達不能（CONFIG.SHEETS キーが undefined） | PromptConfig |
| 非フロントエンド（AI・Buddy 系） | PromptConfig / FAQ / 商材ナレッジ / 営業ナレッジ / 商談レポート |
| 集計・分析系（参照パターン未確認） | 顧客分析 / 顧客月次分析 / 顧客購入商品分析 / SCM出力同期 / 集計同期 |
| 管理・マスタ系（参照未確認） | 表示設定マスタ / 通貨マスタ（※） / 地帯表 / ステータス移行表 / 目標設定 / 目標設定_壁打ち / シフト / 発行元マスタ_旧 |
| ERP 系（別名で不到達） | FedEx送料 / DHL送料 / UPS送料 / 地帯表 |
| PDF 出力用 | 請求書_PDF出力 / 見積もり_PDF出力 / 見積もりテンプレート / 見積もり作成 |
| 共用在庫マスタ系（フロント不到達） | 大分類マスタ_共用在庫 / メーカーマスタ_共用在庫 / 商品区分マスタ_共用在庫 |
| 売上データ（GAS 内部のみ） | 📊売上データ |
| メッセージ系 | メッセージテンプレート |

> ※ `getCoreCurrenciesForFrontend` が `通貨マスタ` を参照するため移行対象（#17）に含む。上記除外行は誤記でなく「参照未確認」として列挙した他の行との区別のため残す。

---

## 3. シートごとの列一覧

CoreSchemaV1 登録列 vs 実際のシート列を比較した結果。差分ありは LEADS と CUSTOMERS のみ（詳細はセクション 4・5）。会話ログ・選択肢マスタ・作品マスタ_共用在庫は CoreSchemaV1 未登録のため「—」。

| # | シート名 | CoreSchema 定義列数 | 実シート列数 | 差分 |
|---|---------|-------------------|------------|------|
| 1 | リード管理 | 51 | 64 | **+13**（セクション 4 参照） |
| 2 | 顧客マスタ | 14 | 15 | **+1**（セクション 5 参照） |
| 3 | 担当者マスタ | 24 | 24 | 0 |
| 4 | ログインセッション | 6 | 6 | 0 |
| 5 | オーダー管理 | 43 | 43 | 0 |
| 6 | オーダー明細 | 11 | 11 | 0 |
| 7 | 発送 | 20 | 20 | 0 |
| 8 | 仕入れ | 19 | 19 | 0 |
| 9 | 見積もり管理 | 19 | 19 | 0 |
| 10 | 見積もり明細 | 12 | 12 | 0 |
| 11 | 配送先マスタ | 17 | 17 | 0 |
| 12 | 支払先マスタ | 16 | 16 | 0 |
| 13 | 共用在庫 | 11 | 11 | 0 |
| 14 | 商品マスタ同期 | 24 | 24 | 0 |
| 15 | 作品マスタ_共用在庫 | CoreSchemaV1 未登録 | 4 | — |
| 16 | 国マスタ | 8 | 7 | [?] スナップショット 7 列・CoreSchema 8 列（要確認） |
| 17 | 通貨マスタ | 5 | 5 | 0 |
| 18 | 流入元マスタ | 6 | 6 | 0 |
| 19 | 選択肢マスタ | CoreSchemaV1 未登録 | 36 | — |
| 20 | 発行元マスタ | 18 | 18 | 0 |
| 21 | 会話ログ（商談用） | CoreSchemaV1 未登録 | 11 | — |
| 22 | システム設定 | 5 | 5 | 0 |

### 3-1. 各シートの CoreSchemaV1 定義列

<details>
<summary>リード管理（CoreSchema 51 列）</summary>

`リードID` / `登録日` / `顧客名` / `商談結果` / `呼び方（英語）` / `国` / `シート更新日` / `リード担当者` / `リード種別` / `流入経路` / `流入元ID` / `メッセージURL` / `取り扱いタイトル` / `作品ID` / `CSメモ` / `メール` / `電話番号` / `連絡手段` / `温度感` / `想定規模` / `返信速度` / `問い合わせ回数` / `アーカイブ日` / `アーカイブ理由` / `アサイン日` / `営業担当者` / `担当者ID` / `顧客タイプ` / `最終対応者ID` / `見込度` / `次回アクション` / `次回アクション日` / `商談メモ` / `相手の課題` / `販売形態` / `月間見込み金額` / `競合比較中` / `アラート確認日` / `対象外理由` / `失注理由` / `初回取引日` / `初回取引金額` / `累計取引金額` / `会話要約` / `最終会話日時` / `会話数` / `重複フラグ` / `重複元リードID` / `重複確認日` / `重複確認者` / `リードステータス`

</details>

<details>
<summary>顧客マスタ（CoreSchema 14 列）</summary>

`顧客ID` / `源流リードID` / `顧客名` / `国` / `メール` / `電話番号` / `国番号` / `初回取引日` / `登録日` / `営業担当者` / `連絡ツール` / `FedEx ID` / `発送時メモ` / `顧客規模`

</details>

<details>
<summary>作品マスタ_共用在庫（CoreSchemaV1 未登録、実際 4 列）</summary>

実シート列（docs/sheet-headers-snapshot.md より）: 4 列。具体的なヘッダー名は未取得 — 共用在庫 ReadApi (`getSheetByName('作品マスタ_共用在庫')`) が参照している。

</details>

<details>
<summary>選択肢マスタ（CoreSchemaV1 未登録、実際 36 列）</summary>

`getLeadFormOptions` が `CONFIG.SHEETS.SETTINGS = '選択肢マスタ'` 経由でアクセス。CoreSchemaV1.SETTINGS（= 'システム設定'）とは別シート。具体的なヘッダー名は未取得。

</details>

<details>
<summary>会話ログ（商談用）（CoreSchemaV1 未登録、実際 11 列）</summary>

コードが参照する列: `リードID` / `ログID` / `日時` / `原文` / `送受信`（5 列）。残り 6 列の列名は未取得。
アクセス経路: `src/28_CoreInboxApi.js:resolveConversationLogSheet_` が `CONFIG.SHEETS.CONVERSATION_LOG`（= '会話ログ'、実在しない）を試みて失敗後、`getSheetByName('会話ログ（商談用）')` にフォールバック。

</details>

<details>
<summary>システム設定（CoreSchema 5 列 = 実シート 5 列）</summary>

`設定キー` / `設定値` / `値の型` / `説明` / `更新日時`

アクセス経路: `src/08_Config.js:getSettingValue` が `getCoreSchemaV1Sheet(ss, 'SETTINGS')` 経由で読み取り。
- `createCoreOrderForFrontend` → `getSettingValue('オーダー支払期日日数')`
- `createCoreQuoteForFrontend` → `getSettingValue('見積もり有効期限日数')`

</details>

---

## 4. LEADS 差 13 列の特定結果

実シート 64 列 − CoreSchema 51 列 = **+13 列**。

以下 13 列はすべて実シートに存在するが CoreSchemaV1 の LEADS テーブルに未登録。

| # | 列名 | src/ ヒット数 | frontend/src/ ヒット数 | 備考 |
|---|------|-------------|----------------------|------|
| 1 | リード進捗 | 56 | 1 (`frontend/src/content/ja/leads.ts:42`) | i18n ラベルのみ |
| 2 | 商談進捗 | 40 | 0 | GAS 内部処理のみ |
| 3 | 1回の発注金額 | 17 | 0 | GAS 内部処理のみ |
| 4 | 購入頻度(月次) | 33 | 0 | GAS 内部処理のみ |
| 5 | 商談の手応え | 15 | 0 | GAS 内部処理のみ |
| 6 | Good Point | 4 | 0 | GAS 内部処理のみ |
| 7 | More Point | 4 | 0 | GAS 内部処理のみ |
| 8 | 反省と今後の抱負 | 4 | 0 | GAS 内部処理のみ |
| 9 | レポート提出日 | 4 | 0 | GAS 内部処理のみ |
| 10 | レポート確認者 | 4 | 0 | GAS 内部処理のみ |
| 11 | レポート確認日 | 4 | 0 | GAS 内部処理のみ |
| 12 | レポートコメント | 4 | 0 | GAS 内部処理のみ |
| 13 | Buddyフィードバック | 40 | 0 | GAS 内部処理のみ |

**判定**: 13 列はいずれも `frontend/src/` から直接参照されておらず、SQL 移行時にフロントエンド I/F 変更は不要。GAS 側の処理（Buddy コーチング・商談レポート等）は移行対象外か個別検討が必要。

---

## 5. CUSTOMERS 差 1 列の特定結果

実シート 15 列 − CoreSchema 14 列 = **+1 列**。

| 列名 | 位置（実シート） | src/ ヒット数 | frontend/src/ ヒット数 |
|------|---------------|-------------|----------------------|
| 担当者ID | 営業担当者 と 連絡ツール の間（第 11 列） | 250+ | 3 件（auth.ts / salesOrders.ts / quotes.ts） |

**grep 詳細（250+ ヒットの内訳）**: src/ ヒットの大多数は STAFF テーブルや LEADS テーブルの `担当者ID` 列への参照であり、CUSTOMERS テーブルの `担当者ID` 列への参照とは区別が必要。

**frontend/src/ 3 件の内訳**:
- `frontend/src/features/auth.ts` — 担当者ID を営業担当者識別に使用
- `frontend/src/pages/salesOrders.ts` — 受注担当 ID として参照
- `frontend/src/pages/quotes.ts` — 見積もり担当者 ID として参照

> [?] これら 3 件が CUSTOMERS テーブルの `担当者ID` 列を参照しているか、STAFF / LEADS / ORDERS テーブルの同名列を参照しているかは未確認（コンテキスト精査が必要）。

**判定**: CoreSchemaV1 CUSTOMERS に `担当者ID` が未登録のため、schema-based な書き込み API はこの列を更新しない。SQL 移行時に列を追加する必要があるかは PO 判断が必要（セクション 7 参照）。

---

## 6. 【未確認】項目

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 国マスタ: CoreSchema 8 列定義・実シート 7 列（スナップショット）— 1 列の差異の原因 | `clasp run dumpAllSheetHeaders` で再取得して比較 |
| 2 | 作品マスタ_共用在庫 の 4 列の具体的なヘッダー名 | `clasp run dumpAllSheetHeaders` の出力または `getSharedInventoryForFrontend` 戻り値を確認 |
| 3 | 選択肢マスタ 36 列の具体的なヘッダー名 | `clasp run dumpAllSheetHeaders` の出力または `getLeadFormOptions` 戻り値を確認 |
| 4 | frontend/src/ の `担当者ID` 3 件が CUSTOMERS.担当者ID を指しているか STAFF / LEADS 等の同名列を指しているか | 各ファイルのコンテキストを精査 |
| 5 | LEADS 差13列のうち `リード進捗` が frontend/src/content/ja/leads.ts:42 で参照されている理由（i18n ラベルなら移行不要だが、画面に表示されているなら要確認） | frontend/src/content/ja/leads.ts:42 を読んで確認 |
| 6 | `ログインセッション` シートを移行対象に含めるか（SESSION は GAS 内部 API のみが RW、フロントエンドはセッション ID のみをやりとりする） | PO 判断（セクション 7 参照） |
| 7 | 会話ログ（商談用）の残り 6 列（コードが参照しない列）の具体的なヘッダー名 | `clasp run dumpAllSheetHeaders` の出力を確認 |

---

## 7. PO 判断が必要な項目

| # | 項目 | 選択肢 |
|---|------|-------|
| A | `CUSTOMERS.担当者ID`（CoreSchemaV1 未登録の実列）を SQL 移行後も保持するか | (a) CoreSchemaV1 に追加して正式列とする / (b) 廃止列として移行後に削除する |
| B | LEADS 差 13 列を SQL 移行後も保持するか（Buddy・商談レポート機能が使用中） | (a) SQL に追加列として移行 / (b) 移行スコープ外として GAS スプレッドシートに残す |
| C | `ログインセッション` を SQL に移行するか（GAS 内部セッション管理のみ） | (a) SQL に移行してセッション管理を統一 / (b) GAS スプレッドシートに残す |
| D | `会話ログ（商談用）` を SQL に移行するか（Inbox 4 関数がアクセス） | (a) SQL に移行 / (b) スコープ外 |
| E | `作品マスタ_共用在庫`（CoreSchemaV1 未登録、共用在庫 API が参照）を SQL に移行するか | (a) CoreSchemaV1 に追加して SQL 移行 / (b) GAS 側のみに残す |
| F | `選択肢マスタ`（36 列・CoreSchemaV1 未登録）を SQL に移行するか | (a) SQL に移行 / (b) GAS 側のみに残す |
| G | `システム設定`（CoreSchemaV1.SETTINGS、5 列）を SQL に移行するか（オーダー支払期日・見積もり有効期限の設定値として `createCoreOrderForFrontend` / `createCoreQuoteForFrontend` が参照） | (a) SQL に移行してアプリ設定を統一 / (b) GAS スプレッドシートに残す |

---

## 8. 読んだファイル / 未読ファイルの一覧

### 読んだファイル

| ファイルパス | 目的 |
|------------|------|
| `docs/sheet-headers-snapshot.md` | 実シートヘッダー・列数の取得 |
| `docs/gas-cleanup-proposal.md` (section 3-2) | 44 フロントエンド関数一覧・GAS エントリポイント特定 |
| `src/00_CoreSchemaRegistry.js` | CoreSchemaV1 全テーブル定義（ヘッダー・PK・values 列挙） |
| `src/27_WebApp.js` | `getDashboardKPIs` / `getLeadsByType` / `getLeadsBatchForFrontend` / `getLeadDetail` / `createLead` / `updateLead` / `getCurrentUser` の実装確認 |
| `src/28_CoreCustomerReadApi.js` | `getCoreCustomersForFrontend` / `getCoreCustomerForFrontend` / `getCoreAllCustomerAggregatesForFrontend` のシートアクセス確認 |
| `src/28_CoreStaffReadApi.js` | `getCoreStaffForFrontend` / `getCoreStaffMemberForFrontend` のシートアクセス確認 |
| `src/28_CoreStaffCredentialApi.js` | `changeOwnPasswordForFrontend` のシートアクセス確認 |
| `src/26_LoginService.js` | `loginWithPassword` / `logout` / `getSessionUser` の実装確認 |
| `src/26_SessionService.js` | セッション管理（ログインセッション）のシートアクセス確認 |
| `src/28_CoreOrderReadApi.js` | `getCoreOrdersForFrontend` / `getCoreOrdersBatchForFrontend` / `getCoreOrderDetailForFrontend` のシートアクセス確認 |
| `src/28_CoreOrderUpdateApi.js` | `updateCoreOrderForFrontend` のシートアクセス確認 |
| `src/28_CoreOrderWriteApi.js` | `createCoreOrderForFrontend` / `confirmCoreOrderPaymentForFrontend` のシートアクセス確認 |
| `src/28_CoreQuoteApi.js` | `getCoreQuotesForFrontend` / `getCoreQuoteForFrontend` / `createCoreQuoteForFrontend` / `updateCoreQuoteForFrontend` のシートアクセス確認 |
| `src/28_CoreInventoryOptionApi.js` | `getInventoryProductOptions` / `getInventoryConditions` のシートアクセス確認 |
| `src/28_SharedInventoryReadApi.js` | `getSharedInventoryForFrontend` / `getInventoryBatchForFrontend` のシートアクセス確認 |
| `src/28_CoreInboxApi.js` | `getInboxConversationsForFrontend` / `getInboxConversationDetailForFrontend` / `getInboxBulkInitialLoad` / `getInboxMoreMessages` のシートアクセス確認 |
| `src/28_CoreLeadFormOptionsApi.js` | `getLeadFormOptions` のシートアクセス確認 |
| `src/29_SyncSignalApi.js` | `checkSyncSignals` がシートアクセスしないことを確認 |
| `src/28_CoreCurrencyApi.js` | `getCoreCurrenciesForFrontend` のシートアクセス確認 |
| `src/28_CoreIssuerApi.js` | `getCoreIssuerForFrontend` / `updateCoreIssuerForFrontend` のシートアクセス確認 |
| `src/28_CorePurchaseApi.js` | `upsertCorePurchaseForFrontend` / `getCorePurchaseStatusOptionsForFrontend` のシートアクセス確認 |
| `src/26_StaffCredentialService.js` | `recordLoginFailure` / `recordLoginSuccess` のシートアクセス確認（担当者マスタのみ、ログイン履歴不使用を確認） |
| `src/26_OrderStatusService.js` | `recalculateOrderStatusById` のシートアクセス確認（ORDERS / SHIPMENTS / PURCHASES のみ） |
| `src/08_Config.js` | `getSettingValue` が CoreSchemaV1.SETTINGS（= 'システム設定'）を参照することを確認 |

### 未読ファイル（確認が不十分なもの）

| ファイルパス | 未確認事項 |
|------------|----------|
| `frontend/src/content/ja/leads.ts` | リード進捗 の i18n ラベルが画面表示に使われているか（セクション 6-5） |
| `frontend/src/features/auth.ts` | `担当者ID` が CUSTOMERS 列への参照かを確認（セクション 6-4） |
| `frontend/src/pages/salesOrders.ts` | 同上 |
| `frontend/src/pages/quotes.ts` | 同上 |
| `src/28_CoreStaffWriteApi.js` | フロント直接呼び出しなしと仮定（44 件リストに存在しないため） |

---

*src/ 配下ファイルへの変更は行っていない。スプレッドシートへの書き込みは一切行っていない。*
