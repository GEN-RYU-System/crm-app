# GAS 新旧配線対応表

## 調査基準 SHA

```
874fac10286bbda73636db37de1db5ca9e3afff6 2026-08-30 16:26:18 +0900
ブランチ: develop（worktree: docs/old-new-wiring-map）
状態: クリーン（src/ 変更なし）
```

旧方式ドキュメントの基準 SHA（先行調査）:
```
96b030391d5a415bd3cfe972968e7cc9552e268e
```

---

## 1. 新方式の配線一覧（フロント44関数）

`frontend/src/gas/client.ts` から呼び出される全 44 関数を実際のコードを読んで記録する。

シート名は `src/00_CoreSchemaRegistry.js` の `sheetName` フィールドから解決した実値を記載する。

### 1-1. ダッシュボード / 共通

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 1 | `getDashboardKPIs` | src/27_WebApp.js:326 | リード管理 | リード種別, リードステータス, 初回取引金額（ヘッダー名で indexOf） | 読み取り |
| 2 | `getCurrentUser` | src/27_WebApp.js:1361 | 担当者マスタ（ログインセッション経由） | 【未確認：27_WebApp.js:1361 周辺を全文未読。セッションからスタッフ情報を返すと推定できるがコード未確認】 | 読み取り |
| 39 | `pingForLatencyCheck` | src/27_WebApp.js:8266 | なし（即座に返す） | なし | なし |

### 1-2. リード管理

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 3 | `getLeadsByType` | src/27_WebApp.js:656 | リード管理 | 全列（getDataRange） | 読み取り |
| 4 | `getLeadsBatchForFrontend` | src/27_WebApp.js:684 | リード管理, 流入元マスタ他（getLeadsByType + getLeadFormOptions を内部呼び出し） | リード管理全列 + 流入元マスタ等オプション列 | 読み取り |
| 5 | `getLeadDetail` | src/27_WebApp.js:743 | リード管理 | 特定リードIDの全列 | 読み取り |
| 6 | `createLead` | src/27_WebApp.js:906 | リード管理 | 全列（appendRow相当） | 書き込み |
| 7 | `updateLead` | src/27_WebApp.js:971 | リード管理 | 特定行の更新 | 書き込み |
| 25 | `getLeadOptionsForFrontend` | src/27_WebApp.js:696 | リード管理 | リードID, 顧客名（2列のみ） | 読み取り |
| 35 | `getLeadFormOptions` | src/27_WebApp.js（`getLeadFormOptions` は src/28_CoreLeadFormOptionsApi.js:27 に定義） | 流入元マスタ, 国マスタ 等 | 流入元マスタ: source_id, 名称, インバウンド, アウトバウンド, 有効, 表示順; 国マスタ: ヘッダー動的解決 | 読み取り |

> `getLeadFormOptions` の実装ファイルは `src/28_CoreLeadFormOptionsApi.js:27`（27_WebApp.js には実体なし）。`getLeadsBatchForFrontend` から内部呼び出しされる。

### 1-3. 顧客管理

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 8 | `getCoreCustomersForFrontend` | src/28_CoreCustomerReadApi.js:52 | 顧客マスタ, リード管理, オーダー管理 | 顧客マスタ: 顧客ID, 源流リードID, 顧客名, 国, 営業担当者; リード管理: リードID, 販売形態, 取り扱いタイトル; オーダー管理: オーダーID, 顧客ID, ステータス, 通貨, 請求総額 | 読み取り |
| 9 | `getCoreCustomerForFrontend` | src/28_CoreCustomerReadApi.js:67 | 顧客マスタ, 配送先マスタ, 支払先マスタ | 顧客マスタ: 顧客ID, 源流リードID, 顧客名, 国, メール, 電話番号, 国番号, 初回取引日, 登録日, 営業担当者, 連絡ツール, 発送時メモ; 配送先マスタ・支払先マスタ: 各全列 | 読み取り |
| 10 | `getCoreAllCustomerAggregatesForFrontend` | src/28_CoreCustomerReadApi.js:235 | 顧客マスタ, オーダー管理 | 顧客ID + 全オーダー集計 | 読み取り |

### 1-4. 担当者管理

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 11 | `getCoreStaffForFrontend` | src/28_CoreStaffReadApi.js:11 | 担当者マスタ | 担当者ID, 苗字（日本語）, 名前（日本語）, 役割, ステータス, メール | 読み取り |
| 12 | `getCoreStaffMemberForFrontend` | src/28_CoreStaffReadApi.js:48 | 担当者マスタ | 担当者ID, 苗字・名前（日本語/かな/英語）, メール, 役割, ステータス | 読み取り |

### 1-5. 認証・セッション

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 13 | `loginWithPassword` | src/26_LoginService.js:33 | 担当者マスタ, ログインセッション | 担当者マスタ: パスワードハッシュ, パスワードソルト, ロック解除時刻, 連続失敗回数; ログインセッション: セッションID, 担当者ID, 発行日時, 失効日時, 状態 | 読み取り + 書き込み |
| 14 | `logout` | src/26_LoginService.js:91 | ログインセッション | 状態列を失効に更新 | 書き込み |
| 15 | `getSessionUser` | src/26_LoginService.js:102 | ログインセッション, 担当者マスタ | セッションID から担当者情報を返す | 読み取り |
| 16 | `changeOwnPasswordForFrontend` | src/28_CoreStaffCredentialApi.js:53 | 担当者マスタ | パスワードハッシュ, パスワードソルト | 読み取り + 書き込み |

### 1-6. 在庫

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 17 | `getSharedInventoryForFrontend` | src/28_SharedInventoryReadApi.js:358 | 共用在庫, 商品マスタ同期, 作品マスタ_共用在庫 | 共用在庫: Series, Quantity, Unit Price, Condition, Status, Note_JA, Note_EN, 提供者, product_id; 商品マスタ同期: product_id, Japanese Title, English Title, Mark, Release Date, 作品ID, Box重量, Case重量; 作品マスタ_共用在庫: ip_id, 作品名, 別名 | 読み取り |
| 29 | `getInventoryBatchForFrontend` | src/28_SharedInventoryReadApi.js:197 | 共用在庫, 商品マスタ同期, 作品マスタ_共用在庫（上記 getSharedInventoryForFrontend と同じシート群） | 同上 + 表示モード設定シート | 読み取り |
| 30 | `getInventoryProductOptions` | src/28_CoreInventoryOptionApi.js:21 | 商品マスタ同期 | product_id, Japanese Title, English Title, Mark, Condition | 読み取り |
| 31 | `getInventoryConditions` | src/28_CoreInventoryOptionApi.js:113 | 共用在庫 | product_id 絞り込み後 Condition | 読み取り |

### 1-7. 見積もり

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 18 | `getCoreQuotesForFrontend` | src/28_CoreQuoteApi.js:41 | 見積もり管理, 顧客マスタ, リード管理 | 見積もり管理: 見積書ID, リードID, 顧客ID, オーダーID, 担当者ID, 発行日, 有効期限, ステータス, 通貨, 為替レート, 小計, 送料, 値引き, 合計金額, 円換算合計, PDF URL, 備考, 作成日時, 更新日時 | 読み取り |
| 19 | `getCoreQuoteForFrontend` | src/28_CoreQuoteApi.js:99 | 見積もり管理, 見積もり明細 | 見積もり管理: 全列; 見積もり明細: 明細ID, 見積書ID, 行番号, 商品ID, 商品名, 説明, 状態, 重量, 数量, 単価, 金額, 備考 | 読み取り |
| 27 | `createCoreQuoteForFrontend` | src/28_CoreQuoteApi.js | 見積もり管理, 見積もり明細 | 全列 | 書き込み |
| 28 | `updateCoreQuoteForFrontend` | src/28_CoreQuoteApi.js | 見積もり管理, 見積もり明細 | 特定行の更新 | 書き込み |

### 1-8. オーダー管理

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 20 | `getCoreOrderDetailForFrontend` | src/28_CoreOrderReadApi.js:165 | オーダー管理, オーダー明細, 仕入れ, 発送 | 各テーブルの全列（詳細取得） | 読み取り |
| 21 | `confirmCoreOrderPaymentForFrontend` | src/28_CoreOrderWriteApi.js:392 | オーダー管理 | 支払いステータス, 支払確認日, 入金確認者ID | 書き込み |
| 22 | `getCoreOrdersForFrontend` | src/28_CoreOrderReadApi.js:11 | オーダー管理, 顧客マスタ | オーダーID, 顧客ID, 請求書番号, 請求書発行日, 決済手段, 請求総額, 通貨, 支払期日, 支払いステータス, 円換算請求総額, ステータス, 支払確認日; 顧客マスタ: 顧客ID, 顧客名 | 読み取り |
| 23 | `getCoreOrdersBatchForFrontend` | src/28_CoreOrderReadApi.js:73 | オーダー管理, 顧客マスタ（上記と同じシート群） | 同上 + ステータス選択肢 | 読み取り |
| 24 | `getCoreOrderStatusOptionsForFrontend` | src/28_CoreOrderReadApi.js:145 | なし（00_CoreSchemaRegistry.js の定数から返す） | なし | なし（定数返却） |
| 33 | `createCoreOrderForFrontend` | src/28_CoreOrderWriteApi.js:66 | オーダー管理, オーダー明細, ログインセッション | オーダーID採番, 全列 | 書き込み |
| 34 | `updateCoreOrderForFrontend` | src/28_CoreOrderUpdateApi.js:64 | オーダー管理, オーダー明細 | 特定行の更新 | 書き込み |

### 1-9. 通貨

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 26 | `getCoreCurrenciesForFrontend` | src/28_CoreCurrencyApi.js:11 | 通貨マスタ | 通貨コード, 記号, 名称, 円換算レート, 有効 | 読み取り |

### 1-10. 同期シグナル

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 32 | `checkSyncSignals` | src/29_SyncSignalApi.js:22 | 【未確認：29_SyncSignalApi.js 未読。シート名は不明】 | 【未確認】 | 読み取り |

### 1-11. 発行元マスタ

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 36 | `getCoreIssuerForFrontend` | src/28_CoreIssuerApi.js:21 | 発行元マスタ | 発行元ID, 会社名, 担当者名, 住所, 電話番号, メール, 登録番号, 受取名義, 受取先メール, 注記, 結びの文, 有効 | 読み取り |
| 42 | `updateCoreIssuerForFrontend` | src/28_CoreIssuerApi.js | 発行元マスタ | 有効行の更新 | 書き込み |

### 1-12. インボックス（受信箱）

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 37 | `getInboxConversationsForFrontend` | src/28_CoreInboxApi.js:54 | リード管理, 会話ログ（または会話ログ（商談用）） | リード管理: リードID, リードステータス, 顧客名, 会話要約, 最終会話日時, 会話数 等; 会話ログ: 全列集約 | 読み取り |
| 38 | `getInboxConversationDetailForFrontend` | src/28_CoreInboxApi.js（詳細取得関数） | リード管理, 会話ログ（または会話ログ（商談用）） | 特定リードIDのメッセージ全件 | 読み取り |
| 40 | `getInboxBulkInitialLoad` | src/28_CoreInboxApi.js | リード管理, 会話ログ | 一覧 + 初期ロード分の詳細 | 読み取り |
| 41 | `getInboxMoreMessages` | src/28_CoreInboxApi.js | 会話ログ（または会話ログ（商談用）） | ページネーション追加取得 | 読み取り |

### 1-13. 仕入れ

| # | GAS 関数名 | 実装ファイル | 読み書きするシート名 | 読み書きする列（主要） | 操作 |
|---|-----------|------------|------------------|-------------------|----|
| 43 | `getCorePurchaseStatusOptionsForFrontend` | src/28_CorePurchaseApi.js | なし（00_CoreSchemaRegistry.js の定数から返す） | なし | なし（定数返却） |
| 44 | `upsertCorePurchaseForFrontend` | src/28_CorePurchaseApi.js:50 | 仕入れ | 仕入れID, オーダーID, 仕入れ担当ID, 仕入れ支払者ID, 注文日, 仕入れ支払日, 取引番号, 仕入元, 仕入元URL, 数量, 単価, 金額, 送料/代行費, 運送会社, 送り状番号, ステータス, 備考, 登録日, 更新日 | 書き込み（新規または更新） |

---

## 2. 旧方式の配線一覧（旧ERP系ファイル）

以下のファイルを実際に全文読んで記録する。

### 2-1. src/見積もりページ.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `getCountryList` | 4 | 読み取り | M_Zones（ERP_CONFIG.SHEETS.ZONES: GID 833993881） | 全列（getDataRange）、1列目（国名）のみ使用 |
| `getLiveShippingEstimates` | 14 | 読み取り | M_Zones（ERP_CONFIG.SHEETS.ZONES）, FedEx_ShippingRates（ERP_CONFIG.SHEETS.SHIPPING_FEDEX）, DHL_ShippingRates（ERP_CONFIG.SHEETS.SHIPPING_DHL）, UPS_ShippingRates（ERP_CONFIG.SHEETS.SHIPPING_UPS）※GID は src/Config.js:54-58 参照 | M_Zones: 国名(col0), Zone名(col1), Carrier(col2); 各ShippingRates: Zone名(col1), MinWeight(col2), MaxWeight(col3), Price(col4) |

**旧独自処理**: なし（配送見積もり機能。新方式に同等機能の確認が必要）

---

### 2-2. src/在庫ページ.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `getStockData` | 1 | 読み取り | 📦仕入在庫参照（ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK: GID 1186337887） | ヘッダー名で動的解決: Category, Mark, English Title, Japanese Title, Status, Condition, Unit Price, Quantity, Note_JA, Release Date, Weight |
| `testStockData` | 64 | デバッグ | 同上 | デバッグ出力のみ |

**旧独自処理**: 読み取り対象シートが `📦仕入在庫参照`（GID 1186337887）。新方式の `getSharedInventoryForFrontend` が読む `共用在庫` とはシート名が異なる。同一シートか別シートかは【未確認】。

---

### 2-3. src/発送通知.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `transferDataToShippingNotice` | 1 | 読み取り + 書き込み | 📊売上データ（getSheetByName文字列リテラル）, 発送通知作業用, 📤発送通知 | 📊売上データ: 発送情報発送, 発送情報通知, 発送情報発送方法, 発送情報運送状番号, 取引状況商品名, 取引状況数量, 取引状況取引先名（4行目ヘッダーで動的解決）; 発送通知作業用: A2:B7(テンプレート), E2:F(発送会社マップ); 📤発送通知: A1, B1, B2（出力セル固定） |

**旧独自処理**:
1. **📊売上データシートの発送状況フラグを更新する**（`doneCol` に "完了"を書き、`checkCol` に false を書く: 行 200-201）。新方式にこの書き込みに相当する操作はない。
2. **発送通知作業用シートのテンプレートからメッセージを組み立てる**（行 163-183）。発送通知テキストの生成は新方式に存在しない。
3. **📤発送通知シートへ発送メッセージを出力する**（行 192-196）。新方式に存在しない。

---

### 2-4. src/CRM作成.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `transferToCRM` | 24 | 書き込み | raw_顧客回答（ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES: GID 0 → NAME使用）, M_顧客（ERP_CONFIG.SHEETS.CUSTOMER_MASTER: GID 884228295） | raw_顧客回答: 列番号ハードコード(TIMESTAMP=0, BILL_NAME=1, …SHIP_COUNTRY=21); M_顧客: A列(顧客ID連番), appendRow |
| `sendDiscordNotification` | 156 | 外部連携 | なし（Discord Webhook POST） | CRM_WEBHOOK_URL（ただし `const CRM_WEBHOOK_URL = ''` でハードコード空。clasp run対応のため実行時は取得不可？【未確認】） |
| `getSheetByGid` | 183 | ユーティリティ | — | — |

**旧独自処理**:
1. **列番号ハードコード**（行 44-60）: BILL_NAME=1, EMAIL=3 等を定数化せず数値で参照。
2. **顧客IDの採番ロジック**（行 91-115）: `T` + 4桁連番で生成し、M_顧客シートに appendRow する。
3. **Discord通知**（行 148, 156-180）: フォーム送信者の情報を Discord に投稿。新方式の `createLead` には Discord 通知は含まれていない（27_WebApp.js 版の `sendDiscordNotification` と重複定義あり）。
4. **フォームトリガーで動作**（行 36: `srcSheet.getSheetId() !== FORM_SHEET_ID` チェック）: スプレッドシートの onEdit トリガー経由で動作する設計。

---

### 2-5. src/elogiCSV出力.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `generateElogiCSV` | 5 | 読み取り + 書き込み | 📊売上データ（getSheetByGid(ss, 600397303)、GIDハードコード） | 4行目ヘッダーで動的解決: 19列（発送情報(必須)注文種類 〜 発送情報住所３）; 書き込み: 発送情報タイムスタンプ列, 発送情報ラベル発行列 |
| `getSheetByGid` | 119 | ユーティリティ | — | — |

**旧独自処理**:
1. **ELOGI CSV 生成・Drive保存**（行 96-113）: `ELOGI_CSVFOLDER_ID` スクリプトプロパティが指す Drive フォルダに CSV ファイルを作成する。新方式に同等機能なし。
2. **GID ハードコード**（行 15: `600397303`）: `ERP_CONFIG.SHEETS.SALES_DATA.ID` と一致するが、定数経由ではない。

---

### 2-6. src/仕入元管理.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `myFunction` | 1 | なし | なし（空実装） | なし |

**旧独自処理**: 実質的な処理なし（空スタブ）。

---

### 2-7. src/ユーティリティ.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `getSheetById` | 4 | ユーティリティ | 引数で指定されたシート | — |
| `checkIsAdmin` | 13 | 読み取り | なし（ハードコードリスト `adminEmails` と比較） | `resolveCurrentUserEmail()` 経由でセッション情報 |

**旧独自処理**: `checkIsAdmin` は管理者メール `admin@example.com` とのハードコード比較。新方式の権限管理（`checkPermission` + 担当者マスタの役割列）とは完全に異なるロジック。

---

### 2-8. src/メニューr.js

**関数一覧**: なし（コメントのみ。実行可能コードなし）

---

### 2-9. src/オーダー管理ページ.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `getOrdersByStatus` | 5 | なし（ダミーデータ返却） | なし（コード内: 「実装時はシート"Orders"から取得する処理に書き換えてください」とコメント） | ダミーデータのみ |
| `saveInvoice` | 18 | なし（スタブ） | コメントに "Invoices"シートと記載のみ。実装なし | なし |
| `getSalesSummary` | 28 | なし（ハードコード返却） | なし | なし |

**旧独自処理**: 全関数がスタブまたはダミーデータ返却。実際のシート操作なし。

---

### 2-10. src/Code.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `doGet_ERP_DISABLED` | 7 | エントリ（無効化済み） | なし（HtmlService で `index` テンプレートを返す） | `getInitialAppPayload` 経由で在庫・国リスト・顧客リストを読む |
| `getInitialAppPayload` | 21 | 読み取り | `getStockData()` → 📦仕入在庫参照; `getCountryList()` → M_Zones; `getCustomerListForUI()` → CONFIG.SHEETS.CUSTOMER_MASTER（CUSTOMER_MASTER.ID 参照→【未確認: どのシートを指すか。Code.js は Config.js の ERP_CONFIG と 08_Config.js の CONFIG の両方を参照しているが、`CONFIG.SHEETS.CUSTOMER_MASTER` は `08_Config.js` 側では `M_Customer` を指す】） | 在庫全列, 国名列, 顧客マスタ(顧客ID, name, email) |
| `getCustomerListForUI` | 41 | 読み取り | CONFIG.SHEETS.CUSTOMER_MASTER（静的値 `'M_Customer'`） | 顧客ID(col0), 顧客名(col2), メール(col3) |
| `include` | 56 | ユーティリティ | なし（HtmlService） | — |
| `getPartHtml` | 63 | ユーティリティ | なし | — |

**旧独自処理**:
1. **`doGet_ERP_DISABLED`**: 関数名が `doGet` から `doGet_ERP_DISABLED` にリネーム済み（コード先頭コメントで明記）。実行されない。
2. **`getCustomerListForUI`**: `CONFIG.SHEETS.CUSTOMER_MASTER` 経由で `M_Customer` シートを読む。新方式の `getCoreCustomersForFrontend` は `顧客マスタ` シートを読む。シート名が異なる【未確認: 同一スプレッドシートに両方存在するか確認要】。

---

### 2-11. src/Config.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `getERPEnvironment` | 9 | 設定取得 | なし | `getEnvironment()` 委譲 |
| `getERPSpreadsheetId` | 16 | 設定取得 | なし | スクリプトプロパティ `DEV_SPREADSHEET_ID` |
| `getRequiredSpreadsheetProperty` | 20 | 設定取得 | なし | スクリプトプロパティ読み取り |
| `configureDevSpreadsheetProperties` | 26 | 設定書き込み | なし | スクリプトプロパティ `DEV_SPREADSHEET_ID` 書き込み |
| `smokeReadConfiguredSpreadsheets` | 32 | 動作確認 | なし（SpreadsheetApp.openById のみ） | — |
| `getSheetByConfig` | 108 | ユーティリティ | 引数 `sheetConfig` が示すシート（GID優先 → NAME） | — |
| `getERPProperty` | 120 | 設定取得 | なし | スクリプトプロパティ読み取り |
| `getInvoiceFolderId` | 132 | 設定取得 | なし | スクリプトプロパティ `INVOICE_FOLDER_ID` |
| `getDiscordCRMWebhook` | 138 | 設定取得 | なし | スクリプトプロパティ `DISCORD_CRM_WEBHOOK` |
| `getGeminiApiKey` | 143 | 設定取得 | なし | スクリプトプロパティ `GEMINI_API_KEY` |
| `showERPEnvironment` | 153 | 設定確認 | なし | スクリプトプロパティ読み取り |
| `ERP_CONFIG`（定数） | 37 | — | — | — |

**旧独自処理**:
1. **`ERP_CONFIG` 定数**（行 37-103）: 旧ERP全体が依存する設定定数。削除すると旧ERP系ファイル（見積もりページ.js, 仕入れ転記.js, 請求書発行.js, 在庫ページ.js, CRM作成.js）が全て実行時エラーになる。

---

### 2-12. src/DB_System.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `initSystemSheets` | 4 | 書き込み | CONFIG.SHEETS.SYSTEM_AGENTS.NAME（undefined → TypeError確定）, CONFIG.SHEETS.SYSTEM_SPECS.NAME（undefined → TypeError確定）, CONFIG.SHEETS.SYSTEM_CHANGELOG.NAME（undefined → TypeError確定） | AgentName, Role/Function, Description, Instruction（SYSTEM_AGENTS）; Category, Item, Description, Status（SYSTEM_SPECS）; Version, Date, Changes, Author（SYSTEM_CHANGELOG） |
| `getSystemAgents` | 41 | 読み取り | CONFIG.SHEETS.SYSTEM_AGENTS.NAME（undefined → TypeError確定） | AgentName, Role/Function, Description, Instruction |

**旧独自処理**:
1. **TypeError確定**（既存調査 gas-undefined-reference-audit.md §2-4 で確認済み）: `CONFIG.SHEETS.SYSTEM_AGENTS.NAME` は `undefined` であるため、実行すると `TypeError: Cannot read properties of undefined` が発生する。フロント44外。

---

### 2-13. src/仕入れ転記.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `transferSelectedToPurchaseList` | 4 | 読み取り + 書き込み | 📊売上データ（ERP_CONFIG.SHEETS.SALES_DATA: GID 600397303）, M_商品（ERP_CONFIG.SHEETS.PRODUCT_MASTER: GID 548021217）, 📋仕入れリスト（ERP_CONFIG.SHEETS.PURCHASE_LIST: GID 1123262060）, ImportLog（getSheetByName文字列リテラル、なければ作成） | 📊売上データ: 4行目ヘッダーで動的解決（取引状況商品名, 取引状況状態, 取引状況数量, 取引状況単価）; M_商品: English Title, Japanese Title（indexOf）; 📋仕入れリスト: タイトル名, 状態, 数量, 単位, 売値 (5列固定) |
| `loadMasterData` | 95 | 読み取り | M_商品（ERP_CONFIG.SHEETS.PRODUCT_MASTER） | English Title, Japanese Title |
| `processTransactionData` | 115 | 変換 | なし（メモリ内処理） | — |
| `normalizeTitle` | 146 | ユーティリティ | なし | — |
| `detectUnit` | 150 | ユーティリティ | なし | — |
| `ensurePurchaseListHeaders` | 158 | 書き込み | 📋仕入れリスト | 1行目ヘッダー書き込み |
| `showDetailedErrors` | 165 | UI | なし | — |
| `logTransaction` | 171 | 書き込み | ImportLog（なければ作成） | 日時, ユーザー, action, data |

**旧独自処理**:
1. **商品名の英語 → 日本語変換**（行 129-130）: M_商品マスタから英語タイトルに対応する日本語タイトルを引いて 📋仕入れリストに書く。新方式 `upsertCorePurchaseForFrontend` にこの変換ロジックはない。
2. **単位の自動判定**（行 150-156）: condition 文字列から "case/box/single" を判定して単位を決める。
3. **仕入れリスト（📋仕入れリスト）への書き込み**（行 77）: 新方式の `upsertCorePurchaseForFrontend` は `仕入れ` シート（CoreSchema V1）に書く。書き先シートが異なる。

---

### 2-14. src/請求書発行.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `revertSalesToInput` | 8 | 読み取り + 書き込み | 📝請求書作成（ERP_CONFIG.SHEETS.INVOICE_INPUT）, 📊売上データ（ERP_CONFIG.SHEETS.SALES_DATA）, M_顧客（ERP_CONFIG.SHEETS.CUSTOMER_MASTER）※GID は src/Config.js:47-50 参照 | 📊売上データ: 4行目ヘッダー動的解決（取引状況請求書番号, 取引状況請求書リンク, 取引状況トラブル, 各取引状況列）; 📝請求書作成: I2-I5, J2 セル固定, A-D/F列クリア |
| `transferAndGeneratePDF` | 146 | 読み取り + 書き込み + PDF出力 | 📝請求書作成（ERP_CONFIG.SHEETS.INVOICE_INPUT）, 📊売上データ（ERP_CONFIG.SHEETS.SALES_DATA）, M_顧客（ERP_CONFIG.SHEETS.CUSTOMER_MASTER）, フォーマット（ERP_CONFIG.SHEETS.INVOICE_TEMPLATE）, ⚙️設定（ERP_CONFIG.SHEETS.CONFIG）※GID は src/Config.js:41-50 参照 | 📝請求書作成: I2-I5, J2 + 1行目 + 2-17行データ; 📊売上データ: 4行目ヘッダー動的解決（多数の列）; フォーマット: 21行目ヘッダー + 22行目以降データ + 合計欄; ⚙️設定: 1行目ヘッダー（状態, 内容品名, 単位, 通貨, レート, 為替表記, HTS, カテゴリ）|
| `setupTransferConfig` | 482 | 設定読み取り | 📝請求書作成, 📊売上データ, M_顧客, フォーマット, ⚙️設定（全シートをGIDで取得） | ヘッダー行の動的解決 |
| `createInvoicePDF_Internal` | 564 | PDF生成 + Drive保存 | フォーマット（ERP_CONFIG.SHEETS.INVOICE_TEMPLATE: GID 74688869） | Drive フォルダ `CONFIG.DRIVE.INVOICE_FOLDER_ID` に PDF 保存 |

**旧独自処理**:
1. **PDF生成（Drive保存 + URL返却）**（行 564-637）: `createInvoicePDF_Internal` は GAS の Sheets エクスポート API を使いシート全体を PDF にして Drive に保存し URL を返す。新方式には存在しない。
2. **請求書番号の採番（#1000 形式）**（行 239-251）: `#1000`, `#1001` 形式の請求書番号を 📊売上データの既存値から採番。新方式 `createCoreOrderForFrontend` の `generateNextInvoiceNumber()` は別形式（src/28_CoreOrderWriteApi.js:306）。
3. **KEY 採番（`nextKeyBase-01` 形式）**（行 256-274）。
4. **「修正戻し」ステータスへの更新** (`revertSalesToInput`): PDF を `[VOID]` リネームして Cancel フォルダに移動する（行 69-88）。新方式に対応機能なし。
5. **旧マスタ（M_顧客 GID 884228295）からの顧客情報引き当て**（行 181-193）: 新方式の顧客マスタは `顧客マスタ` シート（GID は【未確認】）。
6. **フォーマット（請求書テンプレート）シートへの書き込み**（行 278-347）: テンプレートシートに明細を書き込んでからエクスポートする。新方式にこのフローはない。

---

### 2-15. src/仕入れ.js

**関数一覧**

| 関数名 | 行 | 操作 | 読み書きするシート名 | 読み書きする列（主要） |
|-------|-----|-----|------------------|-------------------|
| `CreatePurchaseMessage` | 2 | 読み取り + 書き込み | 仕入れ（getSheetByName('仕入れ')文字列リテラル） | Y17 → B15, Z17 → B16（セル固定） |
| `ClearPurchaseMessage` | 21 | 書き込み | 仕入れ | B2:E13, B15:B16 のクリア |

**旧独自処理**:
1. **「仕入れ」シートへの直接セルコピー**（行 9-17）: `Y17→B15`, `Z17→B16` という固定セル参照。新方式に対応する処理なし。

---

## 3. 新旧対応表

機能軸で新旧を突き合わせる。

### 判定基準（再掲）

**「重複・削除候補」と判定してよいのは、以下を全て満たす場合のみ:**
1. 新方式の関数が存在し、フロント44に含まれている
2. 新旧が**同じ業務データ**を扱っている（同じシート、または新旧で対応するシートの同じ列）
3. **旧方式にしかない処理が1つもない**（旧独自の計算・出力・外部連携が無いこと）
4. 削除がコードのみで完結する（シート・Script Property の変更を必要としない）

| 機能 | 旧方式（ファイル:関数） | 旧が触るシート・列 | 新方式（GAS関数） | 新が触るシート・列 | 判定 |
|-----|-------------------|-----------------|--------------|-----------------|----|
| ① 配送見積もり（国リスト・送料計算） | 見積もりページ.js:`getCountryList`, `getLiveShippingEstimates` | M_Zones（GID 833993881）, FedEx/DHL/UPS_ShippingRates（各GID） | 新方式に相当する見積もり計算関数なし（フロント44になし） | — | **未完了・要判断**（新方式なし） |
| ② 旧在庫表示（仕入在庫参照） | 在庫ページ.js:`getStockData` | 📦仕入在庫参照（GID 1186337887） | `getSharedInventoryForFrontend` (フロント#17) | 共用在庫 | **未完了・要判断**（旧が触るシートと新が触るシートが異なる。同一シートか不明。シートの実在確認がPO判断要） |
| ③ 発送通知作成 | 発送通知.js:`transferDataToShippingNotice` | 📊売上データ, 発送通知作業用, 📤発送通知 | 新方式なし | — | **未完了・要判断**（新方式なし。かつ旧独自処理あり: 発送フラグ更新、通知テキスト生成、📤発送通知シート出力） |
| ④ ELOGI CSV 出力 | elogiCSV出力.js:`generateElogiCSV` | 📊売上データ（GID 600397303） | 新方式なし | — | **未完了・要判断**（新方式なし。旧独自処理: CSV生成、Drive保存） |
| ⑤ フォーム → CRM 転記 | CRM作成.js:`transferToCRM`, `sendDiscordNotification` | raw_顧客回答（GID 0）, M_顧客（GID 884228295） | `createLead`（フロント#6）は React フォームから呼ばれる。対応するシートはリード管理（CoreSchemaV1） | リード管理 | **未完了・要判断**（旧はフォームトリガー動作、Discord通知付き、M_顧客に書く。新は React 経由でリード管理に書く。業務フロー・書き先が異なる） |
| ⑥ 仕入れリスト転記 | 仕入れ転記.js:`transferSelectedToPurchaseList` | 📊売上データ, M_商品, 📋仕入れリスト, ImportLog | `upsertCorePurchaseForFrontend`（フロント#44） | 仕入れ（CoreSchemaV1） | **未完了・要判断**（旧が書く先が 📋仕入れリスト、新が書く先が 仕入れ。商品名変換ロジック（英語→日本語）が旧独自処理として存在） |
| ⑦ 請求書発行（PDF生成・売上転記） | 請求書発行.js:`transferAndGeneratePDF`, `revertSalesToInput`, `createInvoicePDF_Internal` | 📝請求書作成, 📊売上データ, M_顧客, フォーマット, ⚙️設定 | `createCoreOrderForFrontend`, `getCoreQuotesForFrontend` 等はオーダー/見積もり管理を読み書きするが、PDFをDriveに保存するロジックは存在しない | オーダー管理, 見積もり管理 | **未完了・要判断**（PDF生成・Drive保存・修正戻し機能が旧独自処理として存在。新方式に相当機能なし） |
| ⑧ 仕入れメッセージ作成 | 仕入れ.js:`CreatePurchaseMessage`, `ClearPurchaseMessage` | 仕入れ（シート名 "仕入れ" 文字列リテラル） | 新方式なし | — | **未完了・要判断**（新方式なし。旧独自処理: セル固定コピー） |
| ⑨ リード一覧取得 | — | — | `getLeadsByType`, `getLeadsBatchForFrontend`（フロント#3, #4） | リード管理 | 旧方式に相当機能なし（新方式のみ） |
| ⑩ 顧客管理 | Code.js:`getCustomerListForUI`（doGet_ERP_DISABLED経由） | M_Customer | `getCoreCustomersForFrontend`（フロント#8） | 顧客マスタ | **未完了・要判断**（旧は M_Customer、新は 顧客マスタ。シート名が異なる。同一スプレッドシートに両方存在するか【未確認】。条件4: シートの実在確認を必要とする可能性あり） |
| ⑪ 権限・管理者チェック | ユーティリティ.js:`checkIsAdmin`（ハードコードリスト） | なし | `checkPermission` + 担当者マスタの役割列（フロント認証基盤） | 担当者マスタ | **未完了・要判断**（旧独自処理あり: `admin@example.com` ハードコードによる判定。ロジックが根本的に異なる） |
| ⑫ DB初期化 | DB_System.js:`initSystemSheets`, `getSystemAgents` | CONFIG.SHEETS.SYSTEM_AGENTS など（undefined → TypeError） | 新方式なし | — | **未完了・要判断**（新方式なし。旧は TypeError確定で機能しない） |
| ⑬ ERP Config 定数 | Config.js:`ERP_CONFIG`（定数） | — | 新方式は 08_Config.js の `CONFIG` 定数 | — | **未完了・要判断**（条件4: Config.js を削除すると旧ERP系ファイル全体が実行時エラーになる。コード削除だけでは完結しない） |
| ⑭ メニューr.js | メニューr.js（コメントのみ） | なし | 該当なし | — | **判定不能【未確認】**（コメントファイル。削除しても影響なさそうだが、GAS の読み込み順に影響する可能性がゼロとは断定できない。安全のため未確認とする） |
| ⑮ オーダー管理ページ | オーダー管理ページ.js:`getOrdersByStatus`, `saveInvoice`, `getSalesSummary` | なし（全スタブ・ダミー） | `getCoreOrdersForFrontend` 等 | オーダー管理 | **判定不能【未確認】**（旧はスタブ。シートを読まないので業務的実害はない。しかしどこかから呼ばれているかの確認が必要） |

---

## 4. 判定サマリ

| 判定 | 件数 | 対象機能 |
|-----|-----|---------|
| 重複・削除候補 | **0件** | — |
| 未完了・要判断 | **13件** | ①②③④⑤⑥⑦⑧⑩⑪⑫⑬（旧ERP主要機能）+ ①⑨旧方式のみ or 新方式のみ |
| 判定不能【未確認】 | **2件** | ⑭メニューr.js（コメントファイルの削除影響）、⑮オーダー管理ページ.js（呼び出し元確認） |

---

## 5. 旧独自処理の一覧（残す理由の根拠）

| ファイル | 関数 | 旧独自処理の内容 | 根拠行番号 |
|---------|------|--------------|----------|
| 発送通知.js | `transferDataToShippingNotice` | 📊売上データの発送フラグ（発送情報通知列）を "完了" に更新し、チェックを false にする | 行 200-201 |
| 発送通知.js | `transferDataToShippingNotice` | 発送通知作業用シートのテンプレート（A2:B7）と発送会社マップ（E2:F）からメッセージテキストを生成する | 行 130-183 |
| 発送通知.js | `transferDataToShippingNotice` | 生成した発送メッセージを 📤発送通知シートの B2 に出力する | 行 192-196 |
| elogiCSV出力.js | `generateElogiCSV` | ELOGI 社向け CSV を生成し、DriveApp で `ELOGI_CSVFOLDER_ID` フォルダに CSV ファイルとして保存する | 行 96-113 |
| CRM作成.js | `transferToCRM` | フォーム送信トリガーで動作し、raw_顧客回答 シートから列番号ハードコードでデータを読む | 行 24-37, 44-60 |
| CRM作成.js | `transferToCRM` | 顧客IDを `T` + 4桁連番で生成し M_顧客シートに appendRow する | 行 91-144 |
| CRM作成.js | `sendDiscordNotification` | 顧客登録完了を Discord Webhook に POST する（引数: id, name, email, timestamp） | 行 156-180 |
| 仕入れ転記.js | `transferSelectedToPurchaseList` | 商品名を英語タイトルから M_商品マスタで日本語タイトルに変換して 📋仕入れリストに書く | 行 100-112, 129-130, 140 |
| 仕入れ転記.js | `loadMasterData`/`detectUnit` | condition 文字列（"case/box/single"）から単位（カートン/BOX/枚）を自動判定する | 行 150-156 |
| 仕入れ転記.js | `transferSelectedToPurchaseList` | 書き先が 📋仕入れリスト（旧ERP専用シート）。新方式の仕入れシートとは別 | 行 72-77 |
| 請求書発行.js | `createInvoicePDF_Internal` | フォーマットシートを Sheets エクスポート API で PDF 化し Drive フォルダに保存して URL を返す | 行 564-637 |
| 請求書発行.js | `transferAndGeneratePDF` | 請求書番号（#XXXX 形式）と KEY を 📊売上データから採番する | 行 239-274 |
| 請求書発行.js | `revertSalesToInput` | 既存 PDF を `[VOID]` リネームして Cancel フォルダに移動する（DriveApp） | 行 69-88 |
| 請求書発行.js | `transferAndGeneratePDF` | フォーマット（テンプレートシート）に明細・合計・請求書番号を書き込む | 行 278-347 |
| 仕入れ.js | `CreatePurchaseMessage`/`ClearPurchaseMessage` | 「仕入れ」シートの固定セル（Y17→B15, Z17→B16）をコピーし、B2:E13 をクリアする | 行 9-17, 25-28 |
| ユーティリティ.js | `checkIsAdmin` | admin@example.com との比較（ハードコードリスト）で管理者判定する | 行 14 |
| Config.js | `ERP_CONFIG`（定数） | 旧ERP系シートの GID・NAME を全て保持する。削除すると旧ERP系ファイル全てが実行時エラー | 行 37-103 |

---

## 6. 【未確認】項目の一覧

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | `checkSyncSignals` が読むシート名（29_SyncSignalApi.js 未読） | src/29_SyncSignalApi.js を読む |
| 2 | `getCurrentUser`（27_WebApp.js:1361）が読むシートと列（実装未読） | src/27_WebApp.js:1361-1400 周辺を読む |
| 3 | 📦仕入在庫参照（GID 1186337887）と 共用在庫 は同一のシートか別シートか | PO がスプレッドシートのシートタブを確認 |
| 4 | M_Customer（Code.js が参照）と 顧客マスタ（新方式が参照）は同一スプレッドシートに両方存在するか | PO がスプレッドシートのシートタブを確認 |
| 5 | `CRM_WEBHOOK_URL = ''`（CRM作成.js:15）。clasp run 対応とコメントがあるが、実際に Webhook URL を取得できているか | PO がスクリプトプロパティ `DISCORD_CRM_WEBHOOK` を確認 |
| 6 | オーダー管理ページ.js の `getOrdersByStatus`, `saveInvoice`, `getSalesSummary` がどこかから呼ばれているか | `grep -rn "getOrdersByStatus\|saveInvoice\|getSalesSummary" src/ --include="*.js"` |
| 7 | メニューr.js を削除した場合に GAS の読み込み順・実行に影響があるか | GAS エディタでコメントのみのファイルを削除しても問題ないか確認 |
| 8 | 見積もりページ.js の `getCountryList`, `getLiveShippingEstimates` は現在 07_Code.js メニューから呼ばれているか | `grep -rn "getCountryList\|getLiveShippingEstimates" src/` |

---

## 7. PO 判断が必要な項目

| # | 項目 | 理由 |
|---|------|------|
| 1 | 📦仕入在庫参照 シートと 共用在庫 シートの関係（同一か別か）。在庫ページ.js の `getStockData` と新方式 `getSharedInventoryForFrontend` が同じデータを読んでいるか確認要 | 異なる場合は旧方式にしかアクセスしていないシートが残る |
| 2 | 発送通知.js は現在も業務で使用しているか | 07_Code.js メニューの「発送通知」→ `transferDataToShippingNotice` 経由で実行される。旧独自処理が3つある |
| 3 | elogiCSV出力.js は現在も業務で使用しているか | ELOGI CSV 生成・Drive 保存は新方式に存在しない |
| 4 | 請求書発行.js（`transferAndGeneratePDF`, `revertSalesToInput`）は現在も業務で使用しているか | PDF 生成・Drive 保存・修正戻し機能は新方式に存在しない |
| 5 | 仕入れ.js（`CreatePurchaseMessage`）は現在も業務で使用しているか | 07_Code.js メニューからの呼び出しは確認できていない（grep 未実施） |
| 6 | CRM作成.js の `transferToCRM` はフォームトリガーとして現在も動作しているか | フォーム送信 → M_顧客への転記 + Discord 通知が現在も稼働中なら削除不可 |
| 7 | M_顧客（GID 884228295）シートは現在も使用しているか。または 顧客マスタ に移行済みか | 請求書発行.js・CRM作成.js の両方が M_顧客 を参照 |
| 8 | 見積もりページ.js の配送見積もり機能は現在も業務で使用しているか | M_Zones, FedEx/DHL/UPS_ShippingRates シートの利用継続有無 |

---

## 8. 読んだファイル / 未読ファイルの一覧

### 読了ファイル（旧ERP系）

| ファイル | 状態 |
|---------|------|
| src/見積もりページ.js | 全文読了（55行） |
| src/在庫ページ.js | 全文読了（74行） |
| src/発送通知.js | 全文読了（206行） |
| src/CRM作成.js | 全文読了（189行） |
| src/elogiCSV出力.js | 全文読了（121行） |
| src/仕入元管理.js | 全文読了（3行） |
| src/ユーティリティ.js | 全文読了（21行） |
| src/メニューr.js | 全文読了（7行） |
| src/オーダー管理ページ.js | 全文読了（32行） |
| src/Code.js | 全文読了（65行） |
| src/Config.js | 全文読了（160行） |
| src/DB_System.js | 全文読了（52行） |
| src/仕入れ転記.js | 全文読了（176行） |
| src/請求書発行.js | 全文読了（637行） |
| src/仕入れ.js | 全文読了（31行） |

### 読了ファイル（新方式・CoreSchemaRegistry）

| ファイル | 状態 |
|---------|------|
| src/00_CoreSchemaRegistry.js | 先頭 258行読了（全テーブル定義） |
| src/28_CoreOrderReadApi.js | 先頭 165行読了 |
| src/28_CoreQuoteApi.js | 先頭 130行読了 |
| src/28_CoreCustomerReadApi.js | 先頭 100行読了 |
| src/28_CoreStaffReadApi.js | 先頭 80行読了 |
| src/28_SharedInventoryReadApi.js | 先頭 100行読了 |
| src/28_CorePurchaseApi.js | 先頭 90行読了 |
| src/28_CoreIssuerApi.js | 先頭 80行読了 |
| src/28_CoreInboxApi.js | 先頭 80行読了 |
| src/28_CoreInventoryOptionApi.js | 関数名のみ確認（grep） |
| src/28_CoreLeadFormOptionsApi.js | 関数名のみ確認（grep） |
| src/28_CoreCurrencyApi.js | 関数名のみ確認（grep） |
| src/28_CoreOrderWriteApi.js | 関数名・行数のみ確認（grep） |
| src/28_CoreOrderUpdateApi.js | 関数名・行数のみ確認（grep） |
| src/28_CoreStaffCredentialApi.js | 関数名のみ確認（grep） |
| src/26_LoginService.js | 関数名・行数のみ確認（grep） |
| src/26_SessionService.js | 関数名・行数のみ確認（grep） |
| src/27_WebApp.js | 行 325-370, 655-736（getDashboardKPIs, getLeadsByType, getLeadsBatchForFrontend, getLeadOptionsForFrontend）を部分読了 |
| frontend/src/gas/client.ts | 既存調査（gas-cleanup-proposal.md）の結果を使用 |

### 未読ファイル

| ファイル | 理由 |
|---------|------|
| src/29_SyncSignalApi.js | `checkSyncSignals` の実装ファイル。シート名が【未確認】 |
| src/27_WebApp.js（残部） | 行 1361 周辺（getCurrentUser）等、フロント44の残り関数の実装 |
| src/28_CoreStaffWriteApi.js | フロント44には書き込みスタッフ API は含まれていないため対象外 |

---

*src/ 配下のファイルの変更は行っていない。*
