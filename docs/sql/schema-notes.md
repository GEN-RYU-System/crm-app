# PostgreSQL DDL 設計ノート（段階3）

> 作成日: 2026-09-03  
> 対応ファイル: `docs/sql/schema.sql`  
> 根拠: `src/00_CoreSchemaRegistry.js` / `docs/postgres-migration-analysis.md` / `docs/sql-migration-scope.md`

---

## 1. シート名 / Registry 論理名 / PostgreSQL テーブル名 対応表

| # | シート名 | CoreSchemaV1 論理キー | PostgreSQL テーブル名 | PK 列 | 備考 |
|---|---------|---------------------|----------------------|-------|------|
| 1 | リード管理 | LEADS | `leads` | `lead_id` | |
| 2 | 顧客マスタ | CUSTOMERS | `customers` | `customer_id` | 実シート追加列 1件（§2参照） |
| 3 | 担当者マスタ | STAFF | `staff` | `staff_id` | |
| 4 | ログインセッション | LOGIN_SESSIONS | `login_sessions` | `session_id` | |
| 5 | オーダー管理 | ORDERS | `orders` | `order_id` | |
| 6 | オーダー明細 | ORDER_LINES | `order_lines` | `order_line_id` | |
| 7 | 発送 | SHIPMENTS | `shipments` | `shipment_id` | |
| 8 | 仕入れ | PURCHASES | `purchases` | `purchase_id` | |
| 9 | 見積もり管理 | QUOTES | `quotes` | `quote_id` | |
| 10 | 見積もり明細 | QUOTE_LINES | `quote_lines` | `quote_line_id` | |
| 11 | 配送先マスタ | SHIPPING_DESTINATIONS | `shipping_destinations` | `shipping_destination_id` | |
| 12 | 支払先マスタ | PAYMENT_DESTINATIONS | `payment_destinations` | `payment_destination_id` | |
| 13 | 共用在庫 | SHARED_INVENTORY | **DDL 除外** | — | §4参照 |
| 14 | 商品マスタ同期 | PRODUCTS | `products` | `product_id` | |
| 15 | 作品マスタ_共用在庫 | CoreSchemaV1 未登録 | `ip_works` | `ip_id` | §3-1参照 |
| 16 | 国マスタ | COUNTRIES | `countries` | `country_code` | |
| 17 | 通貨マスタ | CURRENCIES | `currencies` | `currency_code` | |
| 18 | 流入元マスタ | LEAD_SOURCES | `lead_sources` | `source_id` | |
| 19 | 選択肢マスタ（V2）| OPTION_MASTER | `option_master` | `option_id` | §3-2参照 |
| 20 | 発行元マスタ | ISSUER | `issuers` | `issuer_id` | |
| 21 | 会話ログ（商談用）| CoreSchemaV1 未登録 | `conversation_logs` | `log_id` | §3-3参照 |
| 22 | システム設定 | SETTINGS | `settings` | `setting_key` | |

---

## 2. 列名決定の根拠

### 2-1. 命名規則

- **原則**: `CoreSchemaRegistry` の論理キー（大文字スネーク）→ lowercase snake_case
- **例**: `LEAD_ID` → `lead_id`, `REGISTERED_AT` → `registered_at`
- **物理列名は無視**: Registry に日本語物理名が残っている CUSTOMERS / QUOTES の場合も、論理キーから SQL 列名を決定
- **例外**: `ROLE` (STAFF) は Registry の物理名が `staff_role` のため `staff_role` を採用（同テーブル内の `STATUS` と識別するため）

### 2-2. 型決定の根拠

| SQL 型 | 条件 | 例 |
|--------|------|---|
| `TEXT` | string / empty | lead_id, customer_name, status 等 |
| `INTEGER` | number かつ小数なし かつ 値が 2^31-1 以内 | line_number, quantity, login_fail_count |
| `BIGINT` | number かつ 10 桁整数（INTEGER 超過） | hs_code（HSコード） |
| `NUMERIC(15,2)` | number かつ金額・費用系 | unit_price, amount, invoice_total |
| `NUMERIC(15,6)` | number かつ為替レート | exchange_rate, rate_to_jpy |
| `NUMERIC(5,2)` | number かつ割合（0–100%） | deposit_rate |
| `NUMERIC(15,3)` | number かつ重量（kg, 小数3桁） | weight (shipments, quote_lines) |
| `BOOLEAN` | boolean | is_active, dark_mode, inspection |
| `DATE` | Date かつ 時刻不要（日付のみ） | order_date, issued_date, first_transaction_date |
| `TIMESTAMPTZ` | Date かつ 時刻必要 | registered_at, occurred_at, expires_at |

### 2-3. NOT NULL 付与基準

`nonEmpty = 分析行（100%）` かつ `サンプル行数 ≥ 5` の場合のみ付与。  
PK 列は常に NOT NULL。

| 非付与の理由 | 対象テーブル例 |
|------------|--------------|
| サンプル行数 < 5 | issuers（1行）/ quotes（1行）/ quote_lines（3行） |
| nonEmpty < 100% | 各テーブルの任意入力列（0/N 〜 N-1/N） |

### 2-4. 注目すべき型決定

| テーブル.列 | GAS での型 | SQL 型 | 理由 |
|-----------|-----------|--------|------|
| `issuers.zip` | number（7桁整数） | TEXT | 郵便番号は識別子。将来の国際対応で先頭ゼロが必要になり得るため TEXT |
| `products.hs_code` | number（10桁） | BIGINT | 10桁整数は INTEGER（最大 ~21億）超過のため BIGINT |
| `settings.setting_value` | ★MIXED(number/boolean) | TEXT | 2026-09-02 に文字列統一済み。アプリ側でパースして使用 |
| `settings.updated_at` | string（ISO 8601） | TIMESTAMPTZ | GAS では文字列格納だが SQL 移行時に型変換が必要 |
| `login_sessions.session_id` | string（UUID×2連結） | TEXT | maxLen=72。UUID 型 2列への分割は移行フェーズで検討 |
| `products.boxes_per_case` | ★MIXED("-"/number) | NUMERIC(15,2) | PO判断G(a): "-" → NULL に変換してNUMERIC型 |
| `products.packs_per_box` | ★MIXED("-"/number) | NUMERIC(15,2) | 同上 |
| `products.case_weight` | ★MIXED("-"/number) | NUMERIC(15,2) | 同上 |
| `shipping_destinations.zip` | ★MIXED(string/number) | TEXT | 2026-09-02 に文字列統一済み |
| `payment_destinations.zip` | ★MIXED(string/number) | TEXT | 同上 |
| `conversation_logs.recorder_id` | string | TEXT | メールアドレス形式（maxLen=27）。staff_id（EMP-XXXXX）とは異なる形式 |
| `orders.order_date` | Date | DATE | 時刻なし（日付のみ）のため DATE |
| `orders.invoice_issued_at` | Date | DATE | 同上 |
| `orders.payment_due_at` | Date | DATE | 同上 |
| `orders.payment_confirmed_at` | Date | DATE | 同上 |
| `orders.release_scheduled_at` | Date | DATE | 同上 |

---

## 3. CoreSchemaV1 未登録テーブルの扱い

### 3-1. ip_works（作品マスタ_共用在庫）

- **Registry 状態**: CoreSchemaV1 未登録。`getSharedInventoryForFrontend` が `getSheetByName('作品マスタ_共用在庫')` で直接参照
- **列情報の出典**: `docs/column-rename-execution-log.md`（PR #930-934 でリネーム実施済み）
- **分析結果**: 4列・11行。ip_id は 11/11 で一意
- **PO判断D(a)**: SQL 移行対象とする
- **PK 付与根拠**: GAS Registry の `primaryKey: null` は「シート上の PK 管理なし」を意味するが、実データは一意。SQL では ip_id を PK として定義

| SQL 列名 | GAS 列名 | 型 |
|---------|---------|---|
| ip_id | ip_id | TEXT NOT NULL PK |
| title | 作品名（リネーム済み） | TEXT NOT NULL |
| alias | 別名（リネーム済み） | TEXT NOT NULL |
| is_active | 有効（リネーム済み） | BOOLEAN NOT NULL |

### 3-2. option_master（選択肢マスタV2）

- **Registry 状態**: CoreSchemaV1.OPTION_MASTER として登録済み（シート名: '選択肢マスタV2'）
- **旧「選択肢マスタ」（36列）**: DEV 環境不在。選択肢マスタV2 に置き換えられた
- **分析結果**: SHEET_NOT_FOUND（分析時に「選択肢マスタ」シートが存在しなかった）
- **PO判断A(a)**: 選択肢マスタV2（OPTION_MASTER, 5列）のみを SQL 移行対象とする
- **型情報**: 分析データなしのため全列 NULL 可（Registry の論理型から推定）

### 3-3. conversation_logs（会話ログ（商談用））

- **Registry 状態**: CoreSchemaV1 未登録。`CONFIG.SHEETS.CONVERSATION_LOG='会話ログ'` が不在のため `getSheetByName('会話ログ（商談用）')` にフォールバック
- **分析結果**: 11列・249行（先頭100行分析）。全 100/100 充填（deal_analysis を除く）
- **PO判断C(a)**: SQL 移行対象とする
- **列名マッピング**:

| SQL 列名 | GAS 列名 | 型 |
|---------|---------|---|
| log_id | ログID | TEXT NOT NULL PK |
| lead_id | リードID | TEXT NOT NULL FK→leads |
| occurred_at | 日時 | TIMESTAMPTZ NOT NULL |
| direction | 送受信 | TEXT NOT NULL |
| speaker | 発言者 | TEXT NOT NULL |
| original_text | 原文 | TEXT NOT NULL |
| original_language | 原文言語 | TEXT NOT NULL |
| translated_text | 翻訳文 | TEXT NOT NULL |
| recorder_id | 記録者ID | TEXT NOT NULL |
| recorded_at | 記録日時 | TIMESTAMPTZ NOT NULL |
| deal_analysis | 商談解析 | TEXT（0/100、全空） |

- **recorder_id の注意**: メールアドレス形式（maxLen=27）。STAFF テーブルの `staff_id`（EMP-XXXXX 形式）とは異なる。FK 制約なし

---

## 4. DDL 除外テーブル

### 4-1. shared_inventory（共用在庫）

- **除外根拠**: `CoreSchemaV1.SHARED_INVENTORY.primaryKey: null`（コメント: 「product_id が重複する（同一商品を複数の提供者が出す場合がある）ため primaryKey は null」）
- **データ概要**: 1086行。product_id が 204行で NULL/空（先頭100行分析）
- **外部参照**: `getSharedInventoryForFrontend` / `getInventoryBatchForFrontend` / `getInventoryProductOptions` がアクセス
- **SQL 移行時の設計選択肢**（将来フェーズで PO 判断が必要）:
  - 選択肢1: `(product_id, supplier)` の複合 UNIQUE 制約を定義し、サロゲートキー（serial）を PK として追加
  - 選択肢2: `product_id + 提供者 + Condition` の組み合わせを複合 PK とする
  - 選択肢3: 在庫管理専用テーブルとして別スキーマで設計
- **GAS 列情報** (11列):

| SQL 候補列名 | GAS 物理列名 | 型 |
|------------|------------|---|
| series | Series | TEXT |
| quantity | Quantity | INTEGER NOT NULL |
| unit_price | Unit Price | NUMERIC(15,2) NOT NULL |
| condition | Condition | TEXT NOT NULL |
| status | Status | TEXT NOT NULL |
| note_ja | Note_JA | TEXT |
| note_en | Note_EN | TEXT |
| supplier | 提供者 | TEXT NOT NULL |
| product_id | product_id | TEXT（FK → products） |
| raw_name | raw_name | TEXT |
| exclusion_reason | 除外理由 | TEXT |

---

## 5. 差分・不一致の記録

### 5-1. CUSTOMERS 実シート追加列「担当者ID」

- **状況**: CoreSchemaV1.CUSTOMERS に未登録だが実シートに存在する
- **位置**: `sales_assignee_id` (col 10) と `contact_tool` (col 11) の間（第11列）
- **PO 判断（sql-migration-scope.md §7-A の (a)）**: CoreSchemaV1 に追加して正式列とする
- **DDL での列名**: `assignee_id` (TEXT, FK → staff)
- **根拠**: LEADS テーブルも同名 `assignee_id` で STAFF への FK を持つパターンと統一

### 5-2. LEADS +13 列（Buddy/商談レポート機能）

- **状況**: 実シート 64列のうち CoreSchemaV1.LEADS 登録 51列に存在しない 13列
- **PO 判断（sql-migration-scope.md §7-B の (a)）**: SQL 追加列として移行
- **フロントエンド参照**: 全 13列とも `frontend/src/` から直接参照されていない
- **DDL での列名マッピング**:

| SQL 列名 | GAS 物理列名 |
|---------|-----------|
| lead_progress | リード進捗 |
| deal_progress | 商談進捗 |
| order_amount_per_session | 1回の発注金額 |
| purchase_frequency_monthly | 購入頻度(月次) |
| deal_feel | 商談の手応え |
| good_point | Good Point |
| more_point | More Point |
| reflection_and_goals | 反省と今後の抱負 |
| report_submitted_at | レポート提出日 |
| report_reviewer | レポート確認者 |
| report_reviewed_at | レポート確認日 |
| report_comment | レポートコメント |
| buddy_feedback | Buddyフィードバック |

### 5-3. CUSTOMERS / QUOTES 物理列名が日本語のまま

- **状況**: CoreSchemaV1.CUSTOMERS と QUOTES は物理列名が日本語（Phase2 リネーム未実施）
- **DDL への影響**: SQL 列名は物理列名でなく論理キーから決定するため影響なし
- **例**: `CUSTOMER_ID` (論理) / `顧客ID` (物理) → SQL 列名は `customer_id`
- **GAS 側の対応**: 今後 Phase3 として物理列名のリネームを実施予定

### 5-4. products.hs_code の型

- **GAS**: number 型（10桁整数として格納）
- **SQL**: BIGINT（INTEGER の上限 ~2.1億 では 10桁整数をカバーできないため）
- **将来的な検討**: HS コードは識別子としての性質も持つため、TEXT への変更も選択肢

### 5-5. 国マスタの列数差異

- **sql-migration-scope.md の記録**: CoreSchema 8列 vs 実シート 7列（差異あり）
- **分析実施時**: 8列 = 8列で一致（差異解消済み）
- **DDL**: 8列すべてを定義（country_number / strip_trunk_zero / is_active / state_required / zip_required は日本語物理名だが、DDL は論理キーで定義）

---

## 6. FK / CASCADE 設計まとめ

### 6-1. ON DELETE CASCADE（line item 関係）

| 参照元テーブル.列 | 参照先 |
|----------------|--------|
| `order_lines.order_id` | `orders.order_id` |
| `shipments.order_id` | `orders.order_id` |
| `purchases.order_id` | `orders.order_id` |
| `quote_lines.quote_id` | `quotes.quote_id` |

### 6-2. ON DELETE RESTRICT（その他すべての FK）

その他すべての外部キーは ON DELETE RESTRICT とし、参照整合性違反を明示的エラーとして扱う。

### 6-3. FK 制約なし（コメントのみ）

| 列 | 理由 |
|----|------|
| `order_lines.condition` | CONDITIONS テーブルは 22テーブルスコープ外 |
| `quote_lines.condition` | 同上 |
| `products.major_category_id` | PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1 |
| `products.work_id` | 同上 |
| `products.manufacturer_id` | 同上 |
| `products.product_category_id` | 同上 |
| `staff.source_candidate_id` | 同上 |
| `conversation_logs.recorder_id` | メールアドレス形式で STAFF.staff_id とは型・形式が異なる |

---

## 7. PO 判断の採用記録

| PO判断 ID | 項目 | 採用選択肢 | DDL での反映 |
|---------|------|-----------|------------|
| sql-migration-scope §7-A (a) | CUSTOMERS.担当者ID を正式列化 | (a) CoreSchemaV1 に追加 | `customers.assignee_id TEXT` |
| sql-migration-scope §7-B (a) | LEADS +13列 を SQL 移行 | (a) SQL 追加列として移行 | `leads` テーブルに 13列追加 |
| analysis §8-A (a) | 選択肢マスタV2 のみ移行 | (a) OPTION_MASTER のみ | `option_master` テーブル |
| analysis §8-B (a) | ログインセッション SQL 移行 | (a) SQL 移行 | `login_sessions` テーブル |
| analysis §8-C (a) | 会話ログ SQL 移行 | (a) SQL 移行 | `conversation_logs` テーブル |
| analysis §8-D (a) | 作品マスタ_共用在庫 SQL 移行 | (a) SQL 移行 | `ip_works` テーブル |
| analysis §8-E (a) | システム設定 SQL 移行 | (a) SQL 移行 | `settings` テーブル |
| analysis §8-F | zip 型混在（解消済み） | (a) 文字列統一 | TEXT 型で格納 |
| analysis §8-G (a) | PRODUCTS の "-" 混在列 | (a) NULL 変換・NUMERIC 型 | `NUMERIC(15,2)` NULL 可 |
| analysis §8-H (a) | 列名 snake_case 変換 | (a) 全列名を snake_case | 全テーブルで論理キー→snake_case |

---

*対応 DDL: `docs/sql/schema.sql`*  
*分析根拠: `docs/postgres-migration-analysis.md`（実測値）*  
*スコープ根拠: `docs/sql-migration-scope.md`（22テーブル確定）*
