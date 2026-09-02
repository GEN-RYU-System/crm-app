# 列名変換案 Phase 2（PostgreSQL 移植対応）

**本文書は変換案の提示のみ。シート・コードの変更は行わない。確定は PO が行う。**

---

## 1. 調査基準 SHA

| 項目 | 値 |
|------|---|
| 分析基準 SHA | `39e60bbe592ea367fd35feded029369a38b43d79` |
| grep 実行日 | 2026-09-02T03:34:15Z |
| grep 対象 | `src/` / `frontend/src/`（`.js.map` 除外） |
| 参照元ドキュメント | `docs/postgres-migration-analysis.md`（分析 SHA `38ce8a3`） |
| Phase 1 参照 | `docs/column-rename-plan.md` |

---

## 2. 対象シートと除外シート

### 2-1. Phase 2 の対象シート（本文書でカバーするシート）

`docs/postgres-migration-analysis.md` セクション 2 の全 22 シートのうち、
`pgIssues` に `NON_ASCII` が含まれ、かつ Phase 1（`docs/column-rename-plan.md`）で未対応のシート。

| # | シート名 | NON_ASCII 列数 | 全列数 | セクション |
|---|---------|--------------|-------|-----------|
| 1 | ログインセッション | 6 | 6 | 3-1 |
| 2 | オーダー管理 | 43 | 43 | 3-2 |
| 3 | オーダー明細 | 12 | 12 | 3-3 |
| 4 | 発送 | 22 | 22 | 3-4 |
| 5 | 見積もり明細 | 12 | 12 | 3-5 |
| 6 | 共用在庫（NON_ASCII 列のみ） | 2 | 11 | 3-6 |
| 7 | 作品マスタ_共用在庫 | 3 | 4 | 3-7 |
| 8 | 通貨マスタ | 5 | 5 | 3-8 |
| 9 | 流入元マスタ | 5 | 6 | 3-9 |
| 10 | 会話ログ（商談用） | 11 | 11 | 3-10 |
| 11 | システム設定 | 5 | 5 | 3-11 |

**合計: 11 シート、126 列（NON_ASCII 対象）**

### 2-2. Phase 1 カバー済みシート（本文書の対象外）

以下は Phase 1 で変換案が確定済みのため、Phase 2 での再掲は不要。

| シート名 | Phase 1 セクション |
|---------|-----------------|
| リード管理 | 3-1（64 列） |
| 顧客マスタ | 3-2（15 列） |
| 配送先マスタ | 3-3（17 列） |
| 支払先マスタ | 3-4（16 列） |
| 見積もり管理 | 3-5（19 列） |
| 仕入れ | 3-6（19 列） |
| 国マスタ | 3-7（8 列） |
| 選択肢マスタ | 3-8（36 列、廃止済みのため参考のみ） |
| 発行元マスタ | 3-9（18 列） |
| 担当者マスタ | 3-10（24 列） |

### 2-3. 除外シート（Phase 2 の対象外）

| シート名 | 除外理由 |
|---------|---------|
| 商品マスタ同期 | 別セッション管轄のため本依頼の対象外 |
| 共用在庫（英語列名部分） | `Series` / `Quantity` / `Unit Price` / `Condition` / `Status` / `Note_JA` / `Note_EN` / `product_id` / `raw_name` の 9 列は UPPERCASE/SPECIAL_CHARS 問題のみ。NON_ASCII は「提供者」「除外理由」の 2 列のみ（セクション 3-6 で対応） |
| 送料マスタ関連（地帯表 / FedEx 送料 / DHL 送料 / UPS 送料） | 22 シート分析の対象外 |
| サイズ / 重量 / 荷姿マスタ | 22 シート分析の対象外 |

---

## 3. シートごとの変換案

> **凡例**
> - `変換理由` の「CoreSchemaキー XX を小文字化」は `src/00_CoreSchemaRegistry.js` で定義済みの英語キー
> - 「Phase 1 section X-Y #N」は `docs/column-rename-plan.md` の該当行と一致する変換案
> - コード参照数 = `src/` + `frontend/src/` の grep 実測値（日本語列名での検索、クロスシート合算を含む）
> - `†` = 複数シートで同一名が出現するため参照数はクロスシート合算

---

### 3-1. ログインセッション（6 列、実データ 64 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | セッションID | `session_id` | CoreSchemaキー SESSION_ID を小文字化 | — | 16 |
| 2 | 担当者ID | `staff_id` | CoreSchemaキー STAFF_ID を小文字化 | Phase 1 section 3-10 #1 / Phase 1 section 3-5 #5 | 239† |
| 3 | 発行日時 | `issued_at` | CoreSchemaキー ISSUED_AT を小文字化 | — | 1 |
| 4 | 最終利用日時 | `last_used_at` | CoreSchemaキー LAST_USED_AT を小文字化 | — | 2 |
| 5 | 失効日時 | `expires_at` | CoreSchemaキー EXPIRES_AT を小文字化 | — | 2 |
| 6 | 状態 | `status` | CoreSchemaキー STATUS を小文字化 | Phase 1 section 3-5 #8、Phase 1 section 3-6 #16 他 | 135† |

---

### 3-2. オーダー管理（43 列、実データ 12 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | オーダーID | `order_id` | CoreSchemaキー ORDER_ID を小文字化 | Phase 1 section 3-5 #4 | 148† |
| 2 | 請求書番号 | `invoice_number` | CoreSchemaキー INVOICE_NUMBER を小文字化 | — | 71 |
| 3 | 顧客ID | `customer_id` | CoreSchemaキー CUSTOMER_ID を小文字化 | Phase 1 section 3-2 #1 | 176† |
| 4 | 配送先ID | `shipping_destination_id` | CoreSchemaキー SHIPPING_DESTINATION_ID を小文字化 | Phase 1 section 3-3 #1 | 21† |
| 5 | 支払先ID | `payment_destination_id` | CoreSchemaキー PAYMENT_DESTINATION_ID を小文字化 | Phase 1 section 3-4 #1 | 20† |
| 6 | 源流リードID | `source_lead_id` | CoreSchemaキー SOURCE_LEAD_ID を小文字化 | Phase 1 section 3-2 #2 | 46† |
| 7 | ステータス | `status` | CoreSchemaキー STATUS を小文字化 | Phase 1 section 3-5 #8 他 | 430† |
| 8 | 内部メモ | `internal_note` | CoreSchemaキー INTERNAL_NOTE を小文字化 | — | 5 |
| 9 | 受注日 | `order_date` | CoreSchemaキー ORDER_DATE を小文字化 | — | 46 |
| 10 | 通貨 | `currency` | CoreSchemaキー CURRENCY を小文字化 | Phase 1 section 3-4 #12 | 62† |
| 11 | 為替レート | `exchange_rate` | CoreSchemaキー EXCHANGE_RATE を小文字化 | Phase 1 section 3-5 #10 | 45† |
| 12 | 明細合計 | `line_total` | CoreSchemaキー LINE_TOTAL を小文字化 | — | 29 |
| 13 | 送料 | `shipping_fee` | CoreSchemaキー SHIPPING_FEE を小文字化 | Phase 1 section 3-5 #12 | 175† |
| 14 | 関税 | `duty` | CoreSchemaキー DUTY を小文字化 | — | 38 |
| 15 | 請求総額 | `invoice_total` | CoreSchemaキー INVOICE_TOTAL を小文字化 | — | 57 |
| 16 | 決済手段 | `payment_method` | CoreSchemaキー PAYMENT_METHOD を小文字化 | Phase 1 section 3-4 #11 | 10† |
| 17 | 請求書リンク | `invoice_link` | CoreSchemaキー INVOICE_LINK を小文字化 | — | 10 |
| 18 | 請求書発行日 | `invoice_issued_at` | CoreSchemaキー INVOICE_ISSUED_AT を小文字化 | — | 36 |
| 19 | 支払期日 | `payment_due_at` | CoreSchemaキー PAYMENT_DUE_AT を小文字化 | — | 44 |
| 20 | 支払確認日 | `payment_confirmed_at` | CoreSchemaキー PAYMENT_CONFIRMED_AT を小文字化 | — | 27 |
| 21 | 入金確認元 | `payment_confirmation_source` | CoreSchemaキー PAYMENT_CONFIRMATION_SOURCE を小文字化 | — | 1 |
| 22 | 発送方法 | `shipping_method` | CoreSchemaキー SHIPPING_METHOD を小文字化 | — | 32 |
| 23 | 発送日 | `shipped_at` | CoreSchemaキー SHIPPED_AT を小文字化 | — | 23† |
| 24 | 運送状番号 | `tracking_number` | CoreSchemaキー TRACKING_NUMBER を小文字化 | Phase 1 section 3-6 #15 | 28† |
| 25 | 発送時メモ | `shipping_note` | CoreSchemaキー SHIPPING_NOTE を小文字化 | Phase 1 section 3-2 #14 | 18† |
| 26 | 備考 | `note` | CoreSchemaキー NOTE を小文字化 | Phase 1 section 3-5 #17 | 69† |
| 27 | 登録日 | `registered_at` | CoreSchemaキー REGISTERED_AT を小文字化 | Phase 1 section 3-1 #2 | 97† |
| 28 | 更新日 | `updated_at` | CoreSchemaキー UPDATED_AT を小文字化 | Phase 1 section 3-6 #19 | 116† |
| 29 | 受注担当ID | `order_assignee_id` | CoreSchemaキー ORDER_ASSIGNEE_ID を小文字化 | — | 11 |
| 30 | 入金確認者ID | `payment_confirmed_by_id` | CoreSchemaキー PAYMENT_CONFIRMED_BY_ID を小文字化 | — | 2 |
| 31 | 営業担当ID | `sales_assignee_id` | CoreSchemaキー SALES_ASSIGNEE_ID を小文字化（† ORDERS テーブル固有、LEADS/CUSTOMERS の同名列と別テーブル） | Phase 1 section 3-1 #26（LEADS）/ Phase 1 section 3-2 #10（CUSTOMERS） | 21† |
| 32 | 発送担当ID | `shipping_assignee_id` | CoreSchemaキー SHIPPING_ASSIGNEE_ID を小文字化 | — | 10† |
| 33 | 取引備考欄 | `transaction_note` | CoreSchemaキー TRANSACTION_NOTE を小文字化 | — | 16 |
| 34 | 予約請求書番号 | `reserved_invoice_number` | CoreSchemaキー RESERVED_INVOICE_NUMBER を小文字化 | — | 6 |
| 35 | 発売予定日 | `release_scheduled_at` | CoreSchemaキー RELEASE_SCHEDULED_AT を小文字化 | — | 7 |
| 36 | デポジット率 | `deposit_rate` | CoreSchemaキー DEPOSIT_RATE を小文字化 | — | 8 |
| 37 | その他手数料 | `other_fee` | CoreSchemaキー OTHER_FEE を小文字化 | — | 20 |
| 38 | 値引き | `discount` | CoreSchemaキー DISCOUNT を小文字化 | Phase 1 section 3-5 #13 | 33† |
| 39 | 支払サイト | `payment_terms` | CoreSchemaキー PAYMENT_TERMS を小文字化 | Phase 1 section 3-8 #35（選択肢マスタ） | 16† |
| 40 | キャンセル理由 | `cancellation_reason` | CoreSchemaキー CANCELLATION_REASON を小文字化 | Phase 1 section 3-8 #36（選択肢マスタ） | 48† |
| 41 | キャンセルメモ | `cancellation_note` | CoreSchemaキー CANCELLATION_NOTE を小文字化 | — | 17 |
| 42 | 支払いステータス | `payment_status` | CoreSchemaキー PAYMENT_STATUS を小文字化 | — | 12 |
| 43 | 円換算請求総額 | `invoice_total_jpy` | CoreSchemaキー INVOICE_TOTAL_JPY を小文字化 | — | 3 |

---

### 3-3. オーダー明細（12 列、実データ 25 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | 明細ID | `order_line_id` | CoreSchemaキー ORDER_LINE_ID を小文字化（見積もり明細の `quote_line_id` と区別） | — | 61† |
| 2 | オーダーID | `order_id` | CoreSchemaキー ORDER_ID を小文字化 | Phase 1 section 3-5 #4、本文書 section 3-2 #1 | 148† |
| 3 | 行番号 | `line_number` | CoreSchemaキー LINE_NUMBER を小文字化（注: 見積もり明細の CoreSchemaキーは LINE_NO。ORDERS テーブルは LINE_NUMBER であることを確認済み） | — | 70† |
| 4 | カテゴリ | `category` | CoreSchemaキー CATEGORY を小文字化 | — | 204† |
| 5 | 商品名 | `product_name` | CoreSchemaキー PRODUCT_NAME を小文字化 | — | 177† |
| 6 | 状態 | `status` | CoreSchemaキー STATUS を小文字化（ORDER_LINES テーブルの状態列、他テーブルと別） | Phase 1 section 3-5 #8 他 | 135† |
| 7 | SKU | `sku` | 英語単語を小文字化（CoreSchemaキー SKU を小文字化） | — | 52 |
| 8 | 数量 | `quantity` | CoreSchemaキー QUANTITY を小文字化 | Phase 1 section 3-6 #10 | 127† |
| 9 | 単価 | `unit_price` | CoreSchemaキー UNIT_PRICE を小文字化 | Phase 1 section 3-6 #11 | 113† |
| 10 | 小計 | `subtotal` | CoreSchemaキー SUBTOTAL を小文字化 | Phase 1 section 3-5 #11 | 82† |
| 11 | 商品ID | `product_id` | CoreSchemaキー PRODUCT_ID を小文字化 | — | 60† |
| 12 | コンディション | `condition` | CoreSchemaキー CONDITION を小文字化 | — | 57 |

> 注1: `明細ID` は ORDERS テーブル (ORDER_LINE_ID) と QUOTES テーブル (QUOTE_LINE_ID) で別キー。オーダー明細は `order_line_id`、見積もり明細は `quote_line_id` とする（セクション 3-5 参照）。
> 注2: `コンディション`（ORDER_LINES）も `condition` に変換。QUOTE_LINES の「状態」（`condition`）とは別テーブルなので SQL 上の衝突なし。`src/00_CoreSchemaRegistry.js` L79 に「CONDITION 表示名が '状態'（STATUS）と重複するため 'コンディション' を採用」と明記されている。

---

### 3-4. 発送（22 列、実データ 8 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | 発送ID | `shipment_id` | CoreSchemaキー SHIPMENT_ID を小文字化 | — | 19 |
| 2 | オーダーID | `order_id` | CoreSchemaキー ORDER_ID を小文字化 | 本文書 section 3-2 #1 | 148† |
| 3 | 箱番号 | `box_number` | CoreSchemaキー BOX_NUMBER を小文字化 | — | 13 |
| 4 | 発送方法 | `shipping_method` | CoreSchemaキー SHIPPING_METHOD を小文字化 | 本文書 section 3-2 #22 | 32† |
| 5 | 発送日 | `shipped_at` | CoreSchemaキー SHIPPED_AT を小文字化 | 本文書 section 3-2 #23 | 23† |
| 6 | 運送状番号 | `tracking_number` | CoreSchemaキー TRACKING_NUMBER を小文字化 | Phase 1 section 3-6 #15 | 28† |
| 7 | 長さ | `length` | CoreSchemaキー LENGTH を小文字化 | — | 15 |
| 8 | 幅 | `width` | CoreSchemaキー WIDTH を小文字化 | — | 47 |
| 9 | 高さ | `height` | CoreSchemaキー HEIGHT を小文字化 | — | 15 |
| 10 | 重量 | `weight` | CoreSchemaキー WEIGHT を小文字化 | — | 140† |
| 11 | 見積もり送料 | `estimated_shipping_fee` | CoreSchemaキー ESTIMATED_SHIPPING_FEE を小文字化 | — | 5 |
| 12 | ラベルURL | `label_url` | CoreSchemaキー LABEL_URL を小文字化 | — | 2 |
| 13 | インボイスURL | `invoice_url` | CoreSchemaキー INVOICE_URL を小文字化 | — | 2 |
| 14 | 検品 | `inspection` | CoreSchemaキー INSPECTION を小文字化 | — | 10 |
| 15 | 梱包 | `packing` | CoreSchemaキー PACKING を小文字化 | — | 9 |
| 16 | 格納 | `storage` | CoreSchemaキー STORAGE を小文字化 | — | 22 |
| 17 | 集荷依頼 | `pickup_request` | CoreSchemaキー PICKUP_REQUEST を小文字化 | — | 25 |
| 18 | 通知 | `notification` | CoreSchemaキー NOTIFICATION を小文字化 | — | 110† |
| 19 | 発送担当ID | `shipping_assignee_id` | CoreSchemaキー SHIPPING_ASSIGNEE_ID を小文字化 | 本文書 section 3-2 #32 | 10† |
| 20 | 備考 | `note` | CoreSchemaキー NOTE を小文字化 | Phase 1 section 3-5 #17 | 69† |
| 21 | 登録日 | `registered_at` | CoreSchemaキー REGISTERED_AT を小文字化 | Phase 1 section 3-1 #2 | 97† |
| 22 | 更新日 | `updated_at` | CoreSchemaキー UPDATED_AT を小文字化 | Phase 1 section 3-6 #19 | 116† |

> 注: 「通知」の参照数 110 件はクロスコンテキスト（UI テキスト等）が含まれる可能性がある。

---

### 3-5. 見積もり明細（12 列、実データ 3 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | 明細ID | `quote_line_id` | CoreSchemaキー QUOTE_LINE_ID を小文字化（オーダー明細の `order_line_id` と区別） | — | 61† |
| 2 | 見積書ID | `quote_id` | CoreSchemaキー QUOTE_ID を小文字化 | Phase 1 section 3-5 #1 | 55† |
| 3 | 行番号 | `line_no` | CoreSchemaキー LINE_NO を小文字化（QUOTE_LINES テーブルは LINE_NO） | — | 70† |
| 4 | 商品ID | `product_id` | CoreSchemaキー PRODUCT_ID を小文字化 | 本文書 section 3-3 #11 | 60† |
| 5 | 商品名 | `product_name` | CoreSchemaキー PRODUCT_NAME を小文字化 | 本文書 section 3-3 #5 | 177† |
| 6 | 説明 | `description` | CoreSchemaキー DESCRIPTION を小文字化 | — | 15 |
| 7 | 状態 | `condition` | CoreSchemaキー CONDITION を小文字化（QUOTE_LINES の「状態」は CONDITION キーにマッピングされている） | 本文書 section 3-3 #12 | 135† |
| 8 | 重量 | `weight` | CoreSchemaキー WEIGHT を小文字化 | 本文書 section 3-4 #10 | 140† |
| 9 | 数量 | `quantity` | CoreSchemaキー QUANTITY を小文字化 | Phase 1 section 3-6 #10 | 127† |
| 10 | 単価 | `unit_price` | CoreSchemaキー UNIT_PRICE を小文字化 | Phase 1 section 3-6 #11 | 113† |
| 11 | 金額 | `amount` | CoreSchemaキー AMOUNT を小文字化 | Phase 1 section 3-6 #12 | 152† |
| 12 | 備考 | `note` | CoreSchemaキー NOTE を小文字化 | Phase 1 section 3-5 #17 | 69† |

> 注: 「状態」列は CoreSchemaRegistry で `['CONDITION', '状態']` とマッピングされているため `condition` を採用。`status` との混同に注意。

---

### 3-6. 共用在庫（NON_ASCII 列のみ、全 11 列中 2 列、実データ 1086 行）

英語列名（Series / Quantity / Unit Price 等）は UPPERCASE / SPECIAL_CHARS 問題であり、
別セッション管轄のため本文書のスコープ外。NON_ASCII の 2 列のみを対象とする。

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 8 | 提供者 | `supplier` | CoreSchemaキー SUPPLIER を小文字化（SHARED_INVENTORY テーブルの提供者列） | Phase 1 section 3-6 #8（仕入れの `supplier` と同名だがテーブル別） | 11 |
| 11 | 除外理由 | `exclusion_reason` | CoreSchemaキー EXCLUSION_REASON を小文字化 | Phase 1 section 3-1 #44（LEADS の `exclusion_reason` と同名だがテーブル別） | 6 |

---

### 3-7. 作品マスタ_共用在庫（3 列、実データ 11 行）

CoreSchemaV1 未登録シート。

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 2 | 作品名 | `title_ja` | 日→英（意訳: 作品名 = title in Japanese）・`_ja` サフィックスで言語を明示 | — | 18 |
| 3 | 別名 | `alias` | 日→英（意訳: 別名 = alias）・業界慣用語 | — | 20 |
| 4 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE の慣用（†多数シートで共有） | Phase 1 section 3-3 #17 / Phase 1 section 3-7 #6 | 178† |

> 注: 列 #1 `ip_id` はすでに英語スネークケース（pgIssues なし）のため対象外。
> `作品名` の変換候補として `work_title_ja` も考えられるが、CoreSchemaV1 未登録のため POが判断する。
> 現時点では `title_ja` を提案するが、Phase 1 の `ip_ids` キー（LEADS.IP_IDS）との整合を考慮して「`ip_title_ja`」を追加候補として残す。

---

### 3-8. 通貨マスタ（5 列、実データ 5 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | 通貨コード | `currency_code` | CoreSchemaキー CURRENCY_CODE を小文字化 | — | 4 |
| 2 | 記号 | `symbol` | CoreSchemaキー SYMBOL を小文字化 | — | 4 |
| 3 | 名称 | `name` | CoreSchemaキー NAME を小文字化（†流入元マスタと同名だがテーブル別） | 本文書 section 3-9 #2 | 44† |
| 4 | 円換算レート | `rate_to_jpy` | CoreSchemaキー RATE_TO_JPY を小文字化 | — | 1 |
| 5 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | Phase 1 section 3-3 #17 | 178† |

---

### 3-9. 流入元マスタ（5 列、実データ 9 行）

`source_id` 列はすでに英語スネークケース（pgIssues なし）のため対象外。

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 2 | 名称 | `name` | CoreSchemaキー NAME を小文字化（†通貨マスタと同名だがテーブル別） | 本文書 section 3-8 #3 | 44† |
| 3 | インバウンド | `is_inbound` | CoreSchemaキー IS_INBOUND を小文字化 | — | 59 |
| 4 | アウトバウンド | `is_outbound` | CoreSchemaキー IS_OUTBOUND を小文字化 | — | 41 |
| 5 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | Phase 1 section 3-3 #17 | 178† |
| 6 | 表示順 | `display_order` | CoreSchemaキー DISPLAY_ORDER を小文字化 | — | 9 |

---

### 3-10. 会話ログ（商談用）（11 列、実データ 249 行）

CoreSchemaV1 未登録シート。

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | ログID | `log_id` | 日→英（意訳: ログID = log_id）・実サンプル値 LOG-00001 と整合 | — | 65 |
| 2 | リードID | `lead_id` | 日→英（意訳）・Phase 1 section 3-1 #1 と一致 | Phase 1 section 3-1 #1 / Phase 1 section 3-5 #2 | 242† |
| 3 | 日時 | `logged_at` | 日→英（意訳: 記録日時を兼ねた「日時」＝ logged at）・`date_time` は汎用すぎるため避ける | — | 139† |
| 4 | 送受信 | `direction` | 日→英（意訳: 送受信 = direction）・実値「受信」「送信」は `inbound`/`outbound` と対応 | — | 21 |
| 5 | 発言者 | `speaker` | 日→英（意訳: 発言者 = speaker） | — | 14 |
| 6 | 原文 | `original_text` | 日→英（意訳: 原文 = original text） | — | 68 |
| 7 | 原文言語 | `original_language` | 日→英（意訳: 原文言語 = original language） | — | 19 |
| 8 | 翻訳文 | `translated_text` | 日→英（意訳: 翻訳文 = translated text） | — | 33 |
| 9 | 記録者ID | `recorded_by` | 日→英（意訳: 記録者ID = recorded by）・実値がメールアドレス形式のため `_id` サフィックスを除去して意味を正確に表現 | — | 12 |
| 10 | 記録日時 | `recorded_at` | 日→英（意訳: 記録日時 = recorded at） | — | 13 |
| 11 | 商談解析 | `deal_analysis` | 日→英（意訳: 商談解析 = deal analysis） | — | 13 |

> 注: 列 #3「日時」は「会話が行われた日時」を意味する。`logged_at` を採用するが `occurred_at` / `message_at` も候補。英語名は PO が業務上の意味を確認して確定することを推奨。
> 列 #9「記録者ID」の実値がメールアドレス形式（maxLen=27）であることは【未確認】項目（postgres-migration-analysis.md セクション 7 #4）として記録済み。

---

### 3-11. システム設定（5 列、実データ 3 行）

| # | 現在の列名 | 変換案 | 変換理由 | 既存の同名列 | コード参照数 |
|---|-----------|-------|---------|------------|------------|
| 1 | 設定キー | `setting_key` | CoreSchemaキー SETTING_KEY を小文字化 | — | 11 |
| 2 | 設定値 | `setting_value` | CoreSchemaキー SETTING_VALUE を小文字化 | — | 10 |
| 3 | 値の型 | `value_type` | CoreSchemaキー VALUE_TYPE を小文字化 | — | 3 |
| 4 | 説明 | `description` | CoreSchemaキー DESCRIPTION を小文字化（†見積もり明細と同名だがテーブル別） | 本文書 section 3-5 #6 | 15† |
| 5 | 更新日時 | `updated_at` | CoreSchemaキー UPDATED_AT を小文字化（†多数シートで共有） | Phase 1 section 3-6 #19 | 7† |

---

## 4. PostgreSQL 予約語と衝突する列

Phase 1 の検証（`docs/column-rename-plan.md` セクション 4）に加え、Phase 2 の変換案を PostgreSQL 16 の予約語リストと照合した。

**結果: 0 件。**

Phase 2 の変換案に含まれる `order_id`（ORDER は予約語だが `order_id` は識別子として問題なし）、`status`、`name`、`condition`、`description`、`currency` はいずれも PostgreSQL 16 の完全予約語（non-reserved を除く）に該当しない。

Phase 1 で確認済みの `role` → `staff_role` の対応はログインセッション/オーダー管理等には出現しない。

---

## 5. 【要PO確定】の一覧

| シート | 現在の列名 | 候補案 | 確定できない理由 |
|-------|-----------|-------|----------------|
| 作品マスタ_共用在庫 | 作品名 | `title_ja` / `ip_title_ja` / `work_title_ja` | CoreSchemaV1 未登録。作品の英語表現（title / work / ip）が業務上どれが適切か PO が確認要 |
| 会話ログ（商談用） | 日時 | `logged_at` / `occurred_at` / `message_at` | 「会話が行われた日時」か「システムに記録された日時」かで意味が異なる。実データ確認では logged_at を暫定採用 |

**合計: 2 列（閾値 20 列を大幅に下回る）**

---

## 6. 整形順序の参考数値

| シート | 日本語列数 | 全列数 | コード参照数の合計（実測値） |
|-------|-----------|-------|--------------------------|
| ログインセッション | 6 | 6 | 155 |
| 作品マスタ_共用在庫 | 3 | 4 | 38 |
| 共用在庫（NON_ASCII 2列のみ） | 2 | 11 | 17 |
| 通貨マスタ | 5 | 5 | 57 |
| 流入元マスタ | 5 | 6 | 153 |
| システム設定 | 5 | 5 | 46 |
| 見積もり明細 | 12 | 12 | 1049 |
| 発送 | 22 | 22 | 920 |
| オーダー明細 | 12 | 12 | 1090 |
| 会話ログ（商談用） | 11 | 11 | 412 |
| オーダー管理 | 43 | 43 | 1588 |

> **注**: コード参照数はクロスシート合算値（`†`）を含む。オーダー管理 / オーダー明細 等の大半の列名（ステータス 430件、顧客ID 176件等）は他シートと同名のため、参照数の大部分は他テーブルコンテキストを含む。整形の実際の影響範囲は本数値より小さい。

---

## 7. 【未確認】項目

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 見積もり明細「行番号」の CoreSchemaキーが LINE_NO（QUOTE_LINES）か LINE_NUMBER（ORDER_LINES）かについて、なぜ両テーブルで表記が異なるか | `src/00_CoreSchemaRegistry.js` L128-136 で確認済み（LINE_NO と LINE_NUMBER で確かに別名）。SQL テーブル設計時に統一するか PO が判断 |
| 2 | 会話ログ「日時」の業務上の意味（「会話発生日時」か「システム記録日時」か） | `src/28_CoreInboxApi.js` の記録ロジックを確認（`postgres-migration-analysis.md` 未読ファイルとして記録済み） |
| 3 | 作品マスタ_共用在庫「作品名」の正式英語表現（ip_title / work_title / title） | CoreSchemaV1 未登録のため、今後 CoreSchemaV1 に追加する際に命名方針を確定 |
| 4 | 発送「通知」(NOTIFICATION) の参照数 110 件にクロスコンテキスト（UI テキスト等）が混在しているか | `grep -rn "通知" src/ frontend/src/ ... | grep -v "設定\|メール\|先" | wc -l` で絞り込み可能 |
| 5 | 共用在庫の UPPERCASE / SPECIAL_CHARS 問題（Series / Unit Price 等 9 列）の担当セッション | 別セッション管轄と判断しているが確認が必要 |
