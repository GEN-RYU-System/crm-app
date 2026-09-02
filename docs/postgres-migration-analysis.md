# PostgreSQL 移植に向けた構造分析（段階1）

> 作成日: 2026-09-02  
> 実行関数: `devPostgresMigrationAnalysisStage1()`  
> 分析SHA: `38ce8a3ca4a722f06d7f325ae73a28277c404715`（PR #920 squash merge commit）  
> 分析実施日時: `2026-09-02T03:03:20.627Z`  
> 分析対象環境: DEV  
> 分析範囲: `docs/sql-migration-scope.md` 記載の22シート

---

## 1. 調査基準SHA / 書き込み系 grep の結果

| 項目 | 値 |
|-----|---|
| 分析関数デプロイ SHA | `38ce8a3ca4a722f06d7f325ae73a28277c404715` |
| `getDeployedSha` 実測 | `38ce8a3ca4a722f06d7f325ae73a28277c404715` |
| `deployedAt` | `2026-09-02T03:01:36.995Z` |
| 書き込み系 grep 結果 | コメント行（line 5）のみ。実コード行 0件 |

```
grep -nE "setValue|setValues|appendRow|insertSheet|deleteSheet|deleteRow|deleteColumn|\.clear\(|\.sort\(|setFormula" src/99_DevPostgresMigrationAnalysis.js
```

実行結果（ヒット行全文）:
```
5: * 読み取り専用: setValue / setValues / appendRow / insertSheet 等の書き込み系操作は一切行わない。
```

コメント行のみ。**実コードへの書き込み系操作なし**。

---

## 2. シート別の列一覧と型判定（全22シート）

凡例:
- `nonEmpty` = 非空セル数 / 分析行数（最大100行）
- `totalRows` = シート実データ行数（ヘッダー除く）
- 型: string/number/boolean/Date/empty/★MIXED（複数型混在）
- [PII] = 名前・メール・電話・住所等。実サンプル値は記録しない
- `pgIssues` = PostgreSQL列名問題（後述セクション6参照）

### 2-1. リード管理（51列、実データ10行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | lead_id | 10/10 | string | maxLen=8、sample: LDI-0001〜 |
| 2 | registered_at | 10/10 | Date | |
| 3 | customer_name | 10/10 | string | [PII] maxLen=15 |
| 4 | deal_result | 7/10 | string | maxLen=2、sample: 成約 |
| 5 | english_call_name | 10/10 | string | [PII] maxLen=7 |
| 6 | country | 10/10 | string | maxLen=2、sample: US/ES/GB |
| 7 | sheet_updated_at | 0/10 | empty | |
| 8 | lead_assignee_name | 0/10 | empty | [PII] |
| 9 | lead_type | 0/10 | empty | |
| 10 | lead_source | 0/10 | empty | |
| 11 | lead_source_id | 0/10 | empty | |
| 12 | message_url | 0/10 | empty | |
| 13 | handled_title | 0/10 | empty | |
| 14 | ip_ids | 0/10 | empty | |
| 15 | cs_note | 0/10 | empty | |
| 16 | email | 10/10 | string | [PII] maxLen=21 |
| 17 | phone | 0/10 | empty | [PII] |
| 18 | contact_method | 10/10 | string | [PII] maxLen=7 |
| 19 | temperature | 10/10 | string | maxLen=1、sample: 高 |
| 20 | expected_scale | 0/10 | empty | |
| 21 | response_speed | 0/10 | empty | |
| 22 | inquiry_count | 0/10 | empty | |
| 23 | archived_at | 0/10 | empty | |
| 24 | archive_reason | 0/10 | empty | |
| 25 | assigned_at | 0/10 | empty | |
| 26 | sales_assignee_id | 10/10 | string | maxLen=9、sample: EMP-00001 |
| 27 | assignee_id | 0/10 | empty | |
| 28 | customer_type | 0/10 | empty | |
| 29 | last_responder_id | 0/10 | empty | |
| 30 | prospect_score | 0/10 | empty | |
| 31 | next_action | 0/10 | empty | |
| 32 | next_action_date | 0/10 | empty | |
| 33 | deal_note | 0/10 | empty | |
| 34 | customer_issue | 0/10 | empty | |
| 35 | sales_channel | 0/10 | empty | |
| 36 | monthly_expected_amount | 0/10 | empty | |
| 37 | competitor_comparison | 0/10 | empty | |
| 38 | alert_confirmed_at | 0/10 | empty | |
| 39 | exclusion_reason | 0/10 | empty | |
| 40 | loss_reason | 1/10 | string | maxLen=2、sample: 価格 |
| 41 | first_transaction_date | 0/10 | empty | |
| 42 | first_transaction_amount | 0/10 | empty | |
| 43 | cumulative_transaction_amount | 0/10 | empty | |
| 44 | conversation_summary | 0/10 | empty | |
| 45 | last_conversation_at | 0/10 | empty | |
| 46 | conversation_count | 0/10 | empty | |
| 47 | duplicate_flag | 0/10 | empty | |
| 48 | duplicate_source_lead_id | 0/10 | empty | |
| 49 | duplicate_confirmed_at | 0/10 | empty | |
| 50 | duplicate_confirmed_by | 0/10 | empty | |
| 51 | lead_status | 10/10 | string | maxLen=4、sample: 成約済み |

### 2-2. 顧客マスタ（14列、実データ6行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | 顧客ID | 6/6 | string | UPPERCASE, NON_ASCII | maxLen=7、sample: CT-0001 |
| 2 | 源流リードID | 6/6 | string | UPPERCASE, NON_ASCII | maxLen=8、sample: LDI-0001 |
| 3 | 顧客名 | 6/6 | string | NON_ASCII | [PII] maxLen=14 |
| 4 | 国 | 6/6 | string | NON_ASCII | maxLen=2 |
| 5 | メール | 6/6 | string | NON_ASCII | [PII] maxLen=21 |
| 6 | 電話番号 | 6/6 | string | NON_ASCII | [PII] maxLen=12 |
| 7 | 国番号 | 6/6 | string | NON_ASCII | maxLen=3、sample: +1/+34/+44 |
| 8 | 初回取引日 | 6/6 | Date | NON_ASCII | |
| 9 | 登録日 | 6/6 | Date | NON_ASCII | |
| 10 | sales_assignee_id | 6/6 | string | — | maxLen=9、sample: EMP-00001 |
| 11 | 連絡ツール | 6/6 | string | NON_ASCII | maxLen=7、sample: Email/Discord |
| 12 | fedex_id | 0/6 | empty | — | |
| 13 | 発送時メモ | 0/6 | empty | NON_ASCII | |
| 14 | 顧客規模 | 0/6 | empty | NON_ASCII | |

### 2-3. 担当者マスタ（24列、実データ8行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | staff_id | 8/8 | string | maxLen=9、sample: EMP-00001 |
| 2 | last_name_ja | 8/8 | string | [PII] maxLen=3 |
| 3 | first_name_ja | 8/8 | string | [PII] maxLen=2 |
| 4 | full_name_ja | 6/8 | string | [PII] maxLen=5 |
| 5 | last_name_kana | 7/8 | string | [PII] maxLen=5 |
| 6 | first_name_kana | 7/8 | string | [PII] maxLen=4 |
| 7 | last_name_en | 7/8 | string | [PII] maxLen=8 |
| 8 | first_name_en | 7/8 | string | [PII] maxLen=7 |
| 9 | email | 7/8 | string | [PII] maxLen=27 |
| 10 | discord_id | 3/8 | string | maxLen=19、sample: 1255555836776939692 |
| 11 | staff_role | 8/8 | string | maxLen=7、sample: オーナー/システム管理者 |
| 12 | status | 8/8 | string | maxLen=2、sample: 有効 |
| 13 | source_candidate_id | 0/8 | empty | |
| 14 | dark_mode | 5/8 | boolean | |
| 15 | chat_menu_visible | 4/8 | boolean | |
| 16 | sales_menu_visible | 4/8 | boolean | |
| 17 | settings_menu_visible | 4/8 | boolean | |
| 18 | admin_menu_visible | 4/8 | boolean | |
| 19 | buddy_maintenance_menu_visible | 4/8 | boolean | |
| 20 | sidebar_visible | 4/8 | boolean | |
| 21 | password_hash | 8/8 | string | maxLen=44 |
| 22 | password_salt | 8/8 | string | maxLen=36（UUID形式） |
| 23 | login_fail_count | 8/8 | number | sample: 0 |
| 24 | locked_until | 0/8 | empty | |

### 2-4. ログインセッション（6列、実データ64行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | セッションID | 64/64 | string | UPPERCASE, NON_ASCII | maxLen=72（UUID×2連結形式） |
| 2 | 担当者ID | 64/64 | string | UPPERCASE, NON_ASCII | maxLen=9、sample: EMP-00001 |
| 3 | 発行日時 | 64/64 | Date | NON_ASCII | |
| 4 | 最終利用日時 | 64/64 | Date | NON_ASCII | |
| 5 | 失効日時 | 64/64 | Date | NON_ASCII | |
| 6 | 状態 | 64/64 | string | NON_ASCII | maxLen=4、sample: 失効 |

### 2-5. オーダー管理（43列、実データ12行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | オーダーID | 12/12 | string | NON_ASCII/UPPERCASE、maxLen=8、sample: ORD-0001 |
| 2 | 請求書番号 | 11/12 | string | NON_ASCII、maxLen=13、sample: INV-2026-0001 |
| 3 | 顧客ID | 12/12 | string | NON_ASCII/UPPERCASE、maxLen=7 |
| 4 | 配送先ID | 12/12 | string | NON_ASCII/UPPERCASE、maxLen=7 |
| 5 | 支払先ID | 12/12 | string | NON_ASCII/UPPERCASE、maxLen=7 |
| 6 | 源流リードID | 12/12 | string | NON_ASCII/UPPERCASE、maxLen=8 |
| 7 | ステータス | 12/12 | string | NON_ASCII、maxLen=5 |
| 8 | 内部メモ | 0/12 | empty | NON_ASCII |
| 9 | 受注日 | 12/12 | Date | NON_ASCII |
| 10 | 通貨 | 12/12 | string | NON_ASCII、maxLen=3 |
| 11 | 為替レート | 12/12 | number | NON_ASCII |
| 12 | 明細合計 | 12/12 | number | NON_ASCII |
| 13 | 送料 | 12/12 | number | NON_ASCII |
| 14 | 関税 | 12/12 | number | NON_ASCII |
| 15 | 請求総額 | 12/12 | number | NON_ASCII |
| 16 | 決済手段 | 11/12 | string | NON_ASCII、maxLen=6 |
| 17 | 請求書リンク | 0/12 | empty | NON_ASCII |
| 18 | 請求書発行日 | 4/12 | Date | NON_ASCII |
| 19 | 支払期日 | 9/12 | Date | NON_ASCII |
| 20 | 支払確認日 | 6/12 | Date | NON_ASCII |
| 21 | 入金確認元 | 0/12 | empty | NON_ASCII |
| 22 | 発送方法 | 11/12 | string | NON_ASCII、maxLen=5 |
| 23 | 発送日 | 0/12 | empty | NON_ASCII |
| 24 | 運送状番号 | 0/12 | empty | NON_ASCII |
| 25 | 発送時メモ | 0/12 | empty | NON_ASCII |
| 26 | 備考 | 0/12 | empty | NON_ASCII |
| 27 | 登録日 | 12/12 | Date | NON_ASCII |
| 28 | 更新日 | 12/12 | Date | NON_ASCII |
| 29 | 受注担当ID | 0/12 | empty | NON_ASCII/UPPERCASE |
| 30 | 入金確認者ID | 0/12 | empty | NON_ASCII/UPPERCASE |
| 31 | 営業担当ID | 0/12 | empty | NON_ASCII/UPPERCASE |
| 32 | 発送担当ID | 0/12 | empty | NON_ASCII/UPPERCASE |
| 33 | 取引備考欄 | 0/12 | empty | NON_ASCII |
| 34 | 予約請求書番号 | 0/12 | empty | NON_ASCII |
| 35 | 発売予定日 | 0/12 | empty | NON_ASCII |
| 36 | デポジット率 | 0/12 | empty | NON_ASCII |
| 37 | その他手数料 | 0/12 | empty | NON_ASCII |
| 38 | 値引き | 0/12 | empty | NON_ASCII |
| 39 | 支払サイト | 0/12 | empty | NON_ASCII |
| 40 | キャンセル理由 | 2/12 | string | NON_ASCII、maxLen=4、sample: 顧客都合/在庫なし |
| 41 | キャンセルメモ | 0/12 | empty | NON_ASCII |
| 42 | 支払いステータス | 12/12 | string | NON_ASCII、maxLen=5 |
| 43 | 円換算請求総額 | 0/12 | empty | NON_ASCII |

### 2-6. オーダー明細（12列、実データ25行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | 明細ID | 25/25 | string | NON_ASCII/UPPERCASE、maxLen=7、sample: OL-0001 |
| 2 | オーダーID | 25/25 | string | NON_ASCII/UPPERCASE、maxLen=8 |
| 3 | 行番号 | 25/25 | number | NON_ASCII |
| 4 | カテゴリ | 25/25 | string | NON_ASCII、maxLen=7、sample: ポケモンカード |
| 5 | 商品名 | 25/25 | string | NON_ASCII、maxLen=24 |
| 6 | 状態 | 25/25 | string | NON_ASCII、maxLen=2 |
| 7 | SKU | 0/25 | empty | UPPERCASE |
| 8 | 数量 | 25/25 | number | NON_ASCII |
| 9 | 単価 | 25/25 | number | NON_ASCII |
| 10 | 小計 | 25/25 | number | NON_ASCII |
| 11 | 商品ID | 1/25 | string | NON_ASCII/UPPERCASE、maxLen=6（ほぼ空） |
| 12 | コンディション | 1/25 | string | NON_ASCII、maxLen=10（ほぼ空） |

### 2-7. 発送（22列、実データ8行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | 発送ID | 8/8 | string | NON_ASCII/UPPERCASE、maxLen=7、sample: SH-0001 |
| 2 | オーダーID | 8/8 | string | NON_ASCII/UPPERCASE、maxLen=8 |
| 3 | 箱番号 | 8/8 | number | NON_ASCII |
| 4 | 発送方法 | 8/8 | string | NON_ASCII、maxLen=5 |
| 5 | 発送日 | 4/8 | Date | NON_ASCII |
| 6 | 運送状番号 | 4/8 | string | NON_ASCII、maxLen=13 |
| 7 | 長さ | 0/8 | empty | NON_ASCII |
| 8 | 幅 | 0/8 | empty | NON_ASCII |
| 9 | 高さ | 0/8 | empty | NON_ASCII |
| 10 | 重量 | 0/8 | empty | NON_ASCII |
| 11 | 見積もり送料 | 0/8 | empty | NON_ASCII |
| 12 | ラベルURL | 0/8 | empty | NON_ASCII/UPPERCASE |
| 13 | インボイスURL | 0/8 | empty | NON_ASCII/UPPERCASE |
| 14 | 検品 | 2/8 | boolean | NON_ASCII |
| 15 | 梱包 | 1/8 | boolean | NON_ASCII |
| 16 | 格納 | 1/8 | boolean | NON_ASCII |
| 17 | 集荷依頼 | 4/8 | boolean | NON_ASCII |
| 18 | 通知 | 4/8 | boolean | NON_ASCII |
| 19 | 発送担当ID | 1/8 | string | NON_ASCII/UPPERCASE、maxLen=9 |
| 20 | 備考 | 1/8 | string | NON_ASCII、maxLen=14 |
| 21 | 登録日 | 8/8 | Date | NON_ASCII |
| 22 | 更新日 | 8/8 | Date | NON_ASCII |

### 2-8. 仕入れ（19列、実データ12行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | purchase_id | 12/12 | string | maxLen=7、sample: PC-0001 |
| 2 | order_id | 12/12 | string | maxLen=8 |
| 3 | purchase_assignee_id | 0/12 | empty | |
| 4 | paid_by_id | 0/12 | empty | |
| 5 | ordered_at | 8/12 | Date | |
| 6 | paid_at | 0/12 | empty | |
| 7 | transaction_number | 0/12 | empty | |
| 8 | supplier | 12/12 | string | maxLen=15 |
| 9 | supplier_url | 0/12 | empty | |
| 10 | quantity | 12/12 | number | |
| 11 | unit_price | 12/12 | number | |
| 12 | amount | 12/12 | number | |
| 13 | shipping_or_agency_fee | 0/12 | empty | |
| 14 | carrier | 0/12 | empty | |
| 15 | tracking_number | 0/12 | empty | |
| 16 | status | 12/12 | string | maxLen=4、sample: 支払済み |
| 17 | note | 0/12 | empty | |
| 18 | registered_at | 12/12 | Date | |
| 19 | updated_at | 11/12 | Date | |

### 2-9. 見積もり管理（19列、実データ1行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | 見積書ID | 1/1 | string | NON_ASCII/UPPERCASE、maxLen=8、sample: QT-00001 |
| 2 | リードID | 1/1 | string | NON_ASCII/UPPERCASE、maxLen=9、sample: LDI-00001 |
| 3 | 顧客ID | 0/1 | empty | NON_ASCII/UPPERCASE |
| 4 | オーダーID | 0/1 | empty | NON_ASCII/UPPERCASE |
| 5 | 担当者ID | 1/1 | string | NON_ASCII/UPPERCASE、maxLen=9 |
| 6 | 発行日 | 0/1 | empty | NON_ASCII |
| 7 | 有効期限 | 0/1 | empty | NON_ASCII |
| 8 | ステータス | 1/1 | string | NON_ASCII、maxLen=3、sample: 下書き |
| 9 | 通貨 | 1/1 | string | NON_ASCII、maxLen=3 |
| 10 | 為替レート | 1/1 | number | NON_ASCII |
| 11 | 小計 | 1/1 | number | NON_ASCII |
| 12 | 送料 | 1/1 | number | NON_ASCII |
| 13 | 値引き | 1/1 | number | NON_ASCII |
| 14 | 合計金額 | 1/1 | number | NON_ASCII |
| 15 | 円換算合計 | 1/1 | number | NON_ASCII |
| 16 | pdf_url | 0/1 | empty | |
| 17 | 備考 | 1/1 | string | NON_ASCII、maxLen=19 |
| 18 | 作成日時 | 1/1 | Date | NON_ASCII |
| 19 | 更新日時 | 1/1 | Date | NON_ASCII |

### 2-10. 見積もり明細（12列、実データ3行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | 明細ID | 3/3 | string | NON_ASCII/UPPERCASE、maxLen=9、sample: QTL-00001 |
| 2 | 見積書ID | 3/3 | string | NON_ASCII/UPPERCASE、maxLen=8 |
| 3 | 行番号 | 3/3 | number | NON_ASCII |
| 4 | 商品ID | 0/3 | empty | NON_ASCII/UPPERCASE |
| 5 | 商品名 | 3/3 | string | NON_ASCII、maxLen=6 |
| 6 | 説明 | 0/3 | empty | NON_ASCII |
| 7 | 状態 | 0/3 | empty | NON_ASCII |
| 8 | 重量 | 0/3 | empty | NON_ASCII |
| 9 | 数量 | 3/3 | number | NON_ASCII |
| 10 | 単価 | 3/3 | number | NON_ASCII |
| 11 | 金額 | 3/3 | number | NON_ASCII |
| 12 | 備考 | 0/3 | empty | NON_ASCII |

### 2-11. 配送先マスタ（17列、実データ6行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | shipping_destination_id | 6/6 | string | maxLen=7、sample: SD-0001 |
| 2 | customer_id | 6/6 | string | maxLen=7 |
| 3 | display_name | 0/6 | empty | [PII] |
| 4 | recipient_name | 6/6 | string | [PII] maxLen=14 |
| 5 | address_line_1 | 6/6 | string | [PII] maxLen=16 |
| 6 | address_line_2 | 0/6 | empty | [PII] |
| 7 | address_line_3 | 0/6 | empty | [PII] |
| 8 | city | 6/6 | string | maxLen=8 |
| 9 | state | 6/6 | string | maxLen=13 |
| 10 | zip | 6/6 | **★MIXED(string:2/number:4)** | maxLen=8 |
| 11 | country | 6/6 | string | maxLen=2 |
| 12 | phone | 6/6 | string | [PII] maxLen=12 |
| 13 | country_code | 6/6 | string | maxLen=3 |
| 14 | email | 0/6 | empty | [PII] |
| 15 | tax_id | 0/6 | empty | |
| 16 | is_default | 6/6 | boolean | |
| 17 | is_active | 6/6 | boolean | |

### 2-12. 支払先マスタ（16列、実データ6行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | payment_destination_id | 6/6 | string | maxLen=7、sample: PD-0001 |
| 2 | customer_id | 6/6 | string | maxLen=7 |
| 3 | display_name | 0/6 | empty | [PII] |
| 4 | billing_name | 6/6 | string | [PII] maxLen=14 |
| 5 | address_line_1 | 6/6 | string | [PII] maxLen=16 |
| 6 | address_line_2 | 0/6 | empty | [PII] |
| 7 | address_line_3 | 0/6 | empty | [PII] |
| 8 | city | 6/6 | string | maxLen=8 |
| 9 | state | 6/6 | string | maxLen=13 |
| 10 | zip | 6/6 | **★MIXED(string:2/number:4)** | maxLen=8 |
| 11 | country | 6/6 | string | maxLen=2 |
| 12 | payment_method | 6/6 | string | maxLen=6 |
| 13 | currency | 6/6 | string | maxLen=3 |
| 14 | tax_id | 0/6 | empty | |
| 15 | is_default | 6/6 | boolean | |
| 16 | is_active | 6/6 | boolean | |

### 2-13. 共用在庫（11列、実データ1086行 → 先頭100行を分析）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | Series | 0/100 | empty | UPPERCASE | |
| 2 | Quantity | 100/100 | number | UPPERCASE | |
| 3 | Unit Price | 100/100 | number | UPPERCASE, SPECIAL_CHARS | スペース含む |
| 4 | Condition | 100/100 | string | UPPERCASE | maxLen=18 |
| 5 | Status | 100/100 | string | UPPERCASE | maxLen=8、sample: In Stock |
| 6 | Note_JA | 100/100 | string | UPPERCASE | maxLen=4 |
| 7 | Note_EN | 0/100 | empty | UPPERCASE | |
| 8 | 提供者 | 100/100 | string | NON_ASCII | maxLen=4、sample: シンソク |
| 9 | product_id | 100/100 | string | — | maxLen=6、sample: PM0219 |
| 10 | raw_name | 100/100 | string | — | [PII] maxLen=43 |
| 11 | 除外理由 | 59/100 | string | NON_ASCII | maxLen=57 |

### 2-14. 商品マスタ同期（24列、実データ267行 → 先頭100行を分析）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | product_id | 100/100 | string | — | maxLen=6、sample: PM0001 |
| 2 | Category | 100/100 | string | UPPERCASE | maxLen=9 |
| 3 | Mark | 100/100 | string | UPPERCASE | maxLen=6 |
| 4 | Japanese Title | 100/100 | string | UPPERCASE, SPECIAL_CHARS | maxLen=34 |
| 5 | English Title | 100/100 | string | UPPERCASE, SPECIAL_CHARS | maxLen=58 |
| 6 | Boxes per Case | 56/100 | **★MIXED(string:19/number:37)** | UPPERCASE, SPECIAL_CHARS | "-"と数値混在 |
| 7 | Packs per Box | 95/100 | **★MIXED(string:33/number:62)** | UPPERCASE, SPECIAL_CHARS | "-"と数値混在 |
| 8 | VOLUME WEIGHT | 0/100 | empty | UPPERCASE, SPECIAL_CHARS | |
| 9 | Box重量 | 96/100 | number | UPPERCASE, NON_ASCII | hasDecimal、小数点あり |
| 10 | Case重量 | 92/100 | **★MIXED(string:21/number:71)** | UPPERCASE, NON_ASCII | "-"と数値混在 |
| 11 | Release Date | 100/100 | Date | UPPERCASE, SPECIAL_CHARS | |
| 12 | Search Keywords | 100/100 | string | UPPERCASE, SPECIAL_CHARS | maxLen=138 |
| 13 | Exclude Keywords | 18/100 | string | UPPERCASE, SPECIAL_CHARS | maxLen=103 |
| 14 | Related Series | 98/100 | string | UPPERCASE, SPECIAL_CHARS | maxLen=82 |
| 15 | カテゴリ分類 | 100/100 | string | NON_ASCII | maxLen=6、sample: Single |
| 16 | REQUIRED_OUTPUT_VALUE | 98/100 | string | UPPERCASE | maxLen=33 |
| 17 | MOQ | 11/100 | number | UPPERCASE | |
| 18 | 品目 | 100/100 | string | NON_ASCII | maxLen=12 |
| 19 | HSコード | 100/100 | number | UPPERCASE, NON_ASCII | sample: 9504400000 |
| 20 | 素材 | 100/100 | string | NON_ASCII | maxLen=5 |
| 21 | 大分類ID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=5、sample: DIV01 |
| 22 | 作品ID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=5、sample: IP001 |
| 23 | メーカーID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=5、sample: MK001 |
| 24 | product_category_ID | 100/100 | string | UPPERCASE | maxLen=9 |

### 2-15. 作品マスタ_共用在庫（4列、実データ11行）

CoreSchemaV1 未登録。

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | ip_id | 11/11 | string | maxLen=5、sample: IP001〜 |
| 2 | 作品名 | 11/11 | string | NON_ASCII、maxLen=13 |
| 3 | 別名 | 11/11 | string | NON_ASCII、maxLen=12 |
| 4 | 有効 | 11/11 | boolean | NON_ASCII |

### 2-16. 国マスタ（8列、実データ256行 → 先頭100行を分析）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | country_code | 100/100 | string | — | maxLen=2、sample: AF/AX/AL |
| 2 | display_name | 100/100 | string | — | [PII] maxLen=30 |
| 3 | name_ja | 100/100 | string | — | [PII] maxLen=13 |
| 4 | 国番号 | 100/100 | number | NON_ASCII | sample: 93/358/355 |
| 5 | トランク0除去 | 100/100 | boolean | NON_ASCII | |
| 6 | 有効 | 100/100 | boolean | NON_ASCII | |
| 7 | 州必須 | 100/100 | boolean | NON_ASCII | |
| 8 | 郵便番号必須 | 100/100 | boolean | NON_ASCII | |

注: `docs/sql-migration-scope.md` では CoreSchema 8列 vs 実シート 7列（差異あり）と記録されていたが、分析実施時は 8列 = 8列で一致。差異はすでに解消されていた可能性あり。

### 2-17. 通貨マスタ（5列、実データ5行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | 通貨コード | 5/5 | string | NON_ASCII | maxLen=3、sample: JPY/USD/EUR |
| 2 | 記号 | 5/5 | string | NON_ASCII | maxLen=2 |
| 3 | 名称 | 5/5 | string | NON_ASCII | maxLen=4 |
| 4 | 円換算レート | 5/5 | number | NON_ASCII | hasDecimal |
| 5 | 有効 | 5/5 | boolean | NON_ASCII | |

### 2-18. 流入元マスタ（6列、実データ9行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | source_id | 9/9 | string | — | maxLen=6、sample: SRC001〜 |
| 2 | 名称 | 9/9 | string | NON_ASCII | maxLen=20 |
| 3 | インバウンド | 9/9 | boolean | NON_ASCII | |
| 4 | アウトバウンド | 9/9 | boolean | NON_ASCII | |
| 5 | 有効 | 9/9 | boolean | NON_ASCII | |
| 6 | 表示順 | 9/9 | number | NON_ASCII | |

### 2-19. 選択肢マスタ（SHEET_NOT_FOUND）

シート名 `選択肢マスタ` で検索したが DEV スプレッドシートに存在しない。  
`docs/sql-migration-scope.md` によれば `CONFIG.SHEETS.SETTINGS = '選択肢マスタ'` 経由でアクセスするとのことだが、  
DEV 環境では `選択肢マスタV2`（OPTION_MASTER: CoreSchemaV1 登録済み）に置き換えられた可能性がある。  
【未確認】詳細は後述セクション7参照。

### 2-20. 発行元マスタ（18列、実データ1行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | issuer_id | 1/1 | string | maxLen=9、sample: ISS-00001 |
| 2 | company_name | 1/1 | string | [PII] maxLen=15 |
| 3 | contact_name | 1/1 | string | [PII] maxLen=15 |
| 4 | address_line_1 | 1/1 | string | [PII] maxLen=33 |
| 5 | address_line_2 | 1/1 | string | [PII] maxLen=20 |
| 6 | address_line_3 | 0/1 | empty | [PII] |
| 7 | city | 1/1 | string | maxLen=11 |
| 8 | state | 1/1 | string | maxLen=5 |
| 9 | zip | 1/1 | number | sample: 1600023（日本の郵便番号を数値として格納） |
| 10 | country | 1/1 | string | maxLen=5 |
| 11 | phone | 1/1 | string | [PII] maxLen=14 |
| 12 | email | 1/1 | string | [PII] maxLen=28 |
| 13 | registration_no | 1/1 | string | maxLen=14、sample: T3810449547408 |
| 14 | payee_name | 1/1 | string | [PII] maxLen=16 |
| 15 | payment_email | 1/1 | string | [PII] maxLen=28 |
| 16 | note | 1/1 | string | maxLen=256（長文テキスト） |
| 17 | closing_message | 1/1 | string | maxLen=28 |
| 18 | is_active | 1/1 | boolean | |

### 2-21. 会話ログ（商談用）（11列、実データ249行 → 先頭100行を分析）

CoreSchemaV1 未登録。

| col | ヘッダー名 | nonEmpty/分析行 | 型 | pgIssues | 備考 |
|-----|---------|---------------|-----|---------|-----|
| 1 | ログID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=9、sample: LOG-00001〜 |
| 2 | リードID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=9、sample: LDI-00001 |
| 3 | 日時 | 100/100 | Date | NON_ASCII | |
| 4 | 送受信 | 100/100 | string | NON_ASCII | maxLen=2、sample: 受信 |
| 5 | 発言者 | 100/100 | string | NON_ASCII | maxLen=21 |
| 6 | 原文 | 100/100 | string | NON_ASCII | maxLen=250 |
| 7 | 原文言語 | 100/100 | string | NON_ASCII | maxLen=2 |
| 8 | 翻訳文 | 100/100 | string | NON_ASCII | maxLen=208 |
| 9 | 記録者ID | 100/100 | string | UPPERCASE, NON_ASCII | maxLen=27（メールアドレス形式） |
| 10 | 記録日時 | 100/100 | Date | NON_ASCII | |
| 11 | 商談解析 | 0/100 | empty | NON_ASCII | |

注: `docs/sql-migration-scope.md` では「コードが参照する列: リードID/ログID/日時/原文/送受信（5列）」と記載されていたが、分析では全11列が確認できた。残り6列: 発言者/原文言語/翻訳文/記録者ID/記録日時/商談解析。

### 2-22. システム設定（5列、実データ3行）

| col | ヘッダー名 | nonEmpty/分析行 | 型 | 備考 |
|-----|---------|---------------|-----|-----|
| 1 | 設定キー | 3/3 | string | NON_ASCII、maxLen=16、sample: 見積もり有効期限日数/REMINDER_ENABLED/オーダー支払期日日数 |
| 2 | 設定値 | 3/3 | **★MIXED(number:2/boolean:1)** | NON_ASCII |
| 3 | 値の型 | 3/3 | string | NON_ASCII、maxLen=3、sample: 数値/真偽値 |
| 4 | 説明 | 3/3 | string | NON_ASCII、maxLen=23 |
| 5 | 更新日時 | 3/3 | string | NON_ASCII、maxLen=24（ISO文字列として格納） |

---

## 3. 主キーの検証結果

| シート | PK列ヘッダー | 総行数 | 空PKあり | 重複PKあり | 検証結果 | サンプル（先頭3件） |
|-------|-----------|-----|--------|---------|--------|--------------|
| リード管理 | lead_id | 10 | 0 | 0 | 合格 | LDI-0001/LDI-0002/LDI-0003 |
| 顧客マスタ | 顧客ID | 6 | 0 | 0 | 合格 | CT-0001/CT-0002/CT-0003 |
| 担当者マスタ | staff_id | 8 | 0 | 0 | 合格 | EMP-00001/EMP-00002/EMP-00003 |
| ログインセッション | セッションID | 64 | 0 | 0 | 合格 | UUID×2連結形式（maxLen=72） |
| オーダー管理 | オーダーID | 12 | 0 | 0 | 合格 | ORD-0001/ORD-0002/ORD-0003 |
| オーダー明細 | 明細ID | 25 | 0 | 0 | 合格 | OL-0001/OL-0002/OL-0003 |
| 発送 | 発送ID | 8 | 0 | 0 | 合格 | SH-0001/SH-0002/SH-0003 |
| 仕入れ | purchase_id | 12 | 0 | 0 | 合格 | PC-0001/PC-0002/PC-0003 |
| 見積もり管理 | 見積書ID | 1 | 0 | 0 | 合格 | QT-00001 |
| 見積もり明細 | 明細ID | 3 | 0 | 0 | 合格 | QTL-00001/QTL-00002/QTL-00003 |
| 配送先マスタ | shipping_destination_id | 6 | 0 | 0 | 合格 | SD-0001/SD-0002/SD-0003 |
| 支払先マスタ | payment_destination_id | 6 | 0 | 0 | 合格 | PD-0001/PD-0002/PD-0003 |
| 共用在庫 | null | 1086 | — | — | PK不定義（スキップ） | — |
| 商品マスタ同期 | product_id | 267 | 0 | 0 | 合格 | PM0001/PM0002/PM0003 |
| 作品マスタ_共用在庫 | null | 11 | — | — | PK不定義（スキップ） | — |
| 国マスタ | country_code | 256 | 0 | 0 | 合格 | AF/AX/AL |
| 通貨マスタ | 通貨コード | 5 | 0 | 0 | 合格 | JPY/USD/EUR |
| 流入元マスタ | source_id | 9 | 0 | 0 | 合格 | SRC001/SRC002/SRC003 |
| 選択肢マスタ | — | — | — | — | SHEET_NOT_FOUND |
| 発行元マスタ | issuer_id | 1 | 0 | 0 | 合格 | ISS-00001 |
| 会話ログ（商談用） | ログID | 249 | 0 | 0 | 合格 | LOG-00001/LOG-00002/LOG-00003 |
| システム設定 | 設定キー | 3 | 0 | 0 | 合格 | 見積もり有効期限日数/REMINDER_ENABLED/オーダー支払期日日数 |

**全シートで空PK・重複PKは0件。**（選択肢マスタはシート不在のため対象外）

---

## 4. 外部キー候補の一覧（孤児レコード件数を含む）

| 参照元シート | 参照元列 | 参照先シート | 参照先列 | 参照元総行 | NULL/空行数 | 孤児件数 | 判定 |
|-----------|---------|-----------|---------|---------|----------|--------|-----|
| 顧客マスタ | 源流リードID | リード管理 | lead_id | 6 | 0 | 0 | 合格 |
| 顧客マスタ | sales_assignee_id | 担当者マスタ | staff_id | 6 | 0 | 0 | 合格 |
| オーダー明細 | オーダーID | オーダー管理 | オーダーID | 25 | 0 | 0 | 合格 |
| 見積もり管理 | 顧客ID | 顧客マスタ | 顧客ID | 1 | 1 | 0 | NULL行1件あり（孤児なし） |
| 見積もり明細 | 見積書ID | 見積もり管理 | 見積書ID | 3 | 0 | 0 | 合格 |
| 配送先マスタ | customer_id | 顧客マスタ | 顧客ID | 6 | 0 | 0 | 合格 |
| 支払先マスタ | customer_id | 顧客マスタ | 顧客ID | 6 | 0 | 0 | 合格 |
| 発送 | オーダーID | オーダー管理 | オーダーID | 8 | 0 | 0 | 合格 |
| 仕入れ | order_id | オーダー管理 | オーダーID | 12 | 0 | 0 | 合格 |
| 共用在庫 | product_id | 商品マスタ同期 | product_id | 1086 | 204 | 0 | NULL/空204件あり（孤児なし） |

**孤児レコード（Orphan records）: 0件。**

注記:
- `見積もり管理.顧客ID` の NULL 1件: 未成立の見積もり（顧客ID未設定）として想定範囲内。
- `共用在庫.product_id` の NULL/空 204件（1086行中）: 先頭100行のみ分析のため過小評価の可能性。【未確認 — 全行精査が必要】

---

## 5. 重複・非正規化の検出結果

### 5-1. 同名列が複数シートに存在する列（53件）

| 列名 | 出現シート |
|-----|---------|
| registered_at | リード管理, 仕入れ |
| country | リード管理, 配送先マスタ, 支払先マスタ, 発行元マスタ |
| email | リード管理, 担当者マスタ, 配送先マスタ, 発行元マスタ |
| phone | リード管理, 配送先マスタ, 発行元マスタ |
| sales_assignee_id | リード管理, 顧客マスタ |
| 顧客ID | 顧客マスタ, オーダー管理, 見積もり管理 |
| 源流リードID | 顧客マスタ, オーダー管理 |
| 国番号 | 顧客マスタ, 国マスタ |
| 登録日 | 顧客マスタ, オーダー管理, 発送 |
| 発送時メモ | 顧客マスタ, オーダー管理 |
| status | 担当者マスタ, 仕入れ |
| 担当者ID | ログインセッション, 見積もり管理 |
| 状態 | ログインセッション, オーダー明細, 見積もり明細 |
| オーダーID | オーダー管理, オーダー明細, 発送, 見積もり管理 |
| ステータス | オーダー管理, 見積もり管理 |
| 通貨 | オーダー管理, 見積もり管理 |
| 為替レート | オーダー管理, 見積もり管理 |
| 送料 | オーダー管理, 見積もり管理 |
| 発送方法 | オーダー管理, 発送 |
| 発送日 | オーダー管理, 発送 |
| 運送状番号 | オーダー管理, 発送 |
| 備考 | オーダー管理, 発送, 見積もり管理, 見積もり明細 |
| 更新日 | オーダー管理, 発送 |
| 発送担当ID | オーダー管理, 発送 |
| 値引き | オーダー管理, 見積もり管理 |
| 明細ID | オーダー明細, 見積もり明細 |
| 行番号 | オーダー明細, 見積もり明細 |
| 商品名 | オーダー明細, 見積もり明細 |
| 数量 | オーダー明細, 見積もり明細 |
| 単価 | オーダー明細, 見積もり明細 |
| 小計 | オーダー明細, 見積もり管理 |
| 商品ID | オーダー明細, 見積もり明細 |
| 重量 | 発送, 見積もり明細 |
| note | 仕入れ, 発行元マスタ |
| 見積書ID | 見積もり管理, 見積もり明細 |
| リードID | 見積もり管理, 会話ログ（商談用） |
| 更新日時 | 見積もり管理, システム設定 |
| 説明 | 見積もり明細, システム設定 |
| customer_id | 配送先マスタ, 支払先マスタ |
| display_name | 配送先マスタ, 支払先マスタ, 国マスタ |
| address_line_1 | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| address_line_2 | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| address_line_3 | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| city | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| state | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| zip | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| country_code | 配送先マスタ, 国マスタ |
| tax_id | 配送先マスタ, 支払先マスタ |
| is_default | 配送先マスタ, 支払先マスタ |
| is_active | 配送先マスタ, 支払先マスタ, 発行元マスタ |
| product_id | 共用在庫, 商品マスタ同期 |
| 有効 | 作品マスタ_共用在庫, 国マスタ, 通貨マスタ, 流入元マスタ |
| 名称 | 通貨マスタ, 流入元マスタ |

### 5-2. ID列と名前列が同一シートに共存するシート（10件）

| シート名 | ID列の例 | 名前列の例 |
|--------|---------|---------|
| リード管理 | lead_id, lead_source_id, sales_assignee_id, assignee_id | customer_name, english_call_name, lead_assignee_name |
| 顧客マスタ | 顧客ID, 源流リードID, sales_assignee_id, fedex_id | 顧客名 |
| オーダー明細 | 明細ID, オーダーID, 商品ID | 商品名 |
| 見積もり明細 | 明細ID, 見積書ID, 商品ID | 商品名 |
| 配送先マスタ | shipping_destination_id, customer_id, tax_id | display_name, recipient_name |
| 支払先マスタ | payment_destination_id, customer_id, tax_id | display_name, billing_name |
| 共用在庫 | product_id | raw_name |
| 作品マスタ_共用在庫 | ip_id | 作品名, 別名 |
| 流入元マスタ | source_id | 名称 |
| 発行元マスタ | issuer_id | company_name, contact_name, payee_name |

---

## 6. PostgreSQL 固有の問題

### 6-1. 予約語衝突

**0件。** 全22シートの全列名において、PostgreSQL 16 予約語との完全一致は検出されなかった。

### 6-2. 命名規則違反（239件）

| 違反種別 | 件数 | 説明 |
|--------|-----|-----|
| CONTAINS_NON_ASCII | 169 | 日本語（ひらがな・カタカナ・漢字）を含む列名 |
| CONTAINS_UPPERCASE | 60 | 大文字を含む列名（英語列名: Category/Mark/Unit Price 等） |
| CONTAINS_SPECIAL_CHARS | 10 | スペース・特殊文字を含む列名（Unit Price/Japanese Title 等） |

違反の内訳（主なシート）:
- 日本語列名（NON_ASCII）が最多: 顧客マスタ・ログインセッション・オーダー管理 等の日本語ヘッダー列すべて
- 大文字（UPPERCASE）: 商品マスタ同期の英語列（Category, Mark, Boxes per Case 等）
- スペース/特殊文字（SPECIAL_CHARS）: 商品マスタ同期の英語列（Unit Price, Japanese Title, Boxes per Case 等）

PostgreSQL では列名に非ASCII・大文字・スペースを使用する場合、ダブルクォートで囲む必要がある。SQL移行時にすべての列名の変換方針を決定する必要がある。

### 6-3. 型混在列（6件）

| シート | 列名 | 型混在内容 |
|-------|-----|---------|
| 配送先マスタ | zip | string:2 / number:4（郵便番号の一部が数値型として格納） |
| 支払先マスタ | zip | string:2 / number:4（同上） |
| 商品マスタ同期 | Boxes per Case | string:19 / number:37（"-"文字列と数値が混在） |
| 商品マスタ同期 | Packs per Box | string:33 / number:62（"-"文字列と数値が混在） |
| 商品マスタ同期 | Case重量 | string:21 / number:71（"-"文字列と数値が混在） |
| システム設定 | 設定値 | number:2 / boolean:1（数値と真偽値が混在） |

PostgreSQL移行時に列の型を固定する必要がある。`zip` は TEXT、`Boxes per Case` / `Packs per Box` / `Case重量` は NULL可の NUMERIC、`設定値` は TEXT（アプリ側でパース）等の選択肢がある。

### 6-4. その他の注意事項

- **ログインセッション.セッションID** の maxLen=72: UUID（36文字）を2つ連結した形式（UUID+UUID）。PostgreSQL では UUID 型 2列への分割、または TEXT(72) で格納する必要がある。
- **発行元マスタ.zip** は number型（sample: 1600023）: 日本の郵便番号（7桁数値）として格納。ハイフン無し。PostgreSQL では VARCHAR(7) か TEXT が適切。
- **システム設定.更新日時** は string型（ISO 8601形式の文字列として格納）: PostgreSQL では TIMESTAMPTZ が適切だが、型変換が必要。

---

## 7. 【未確認】項目

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 選択肢マスタ（36列）がDEV環境に存在しない理由 | DEVスプレッドシートを直接確認するか `getLeadFormOptions` を実行してシート参照先を確認 |
| 2 | 選択肢マスタV2（OPTION_MASTER、5列）が選択肢マスタ（36列）の後継かどうか | `getLeadFormOptions` のコードと `CONFIG.SHEETS.SETTINGS` の値を確認 |
| 3 | 共用在庫.product_id の NULL/空 204件の全件確認（100行サンプルのみ分析） | `devPostgresMigrationAnalysisSheets9to16()` の全行版を別途実行 |
| 4 | 会話ログ（商談用）の記録者ID（maxLen=27）がメールアドレス形式: staff_id（EMP-XXXXX形式）ではなくメールが使われている理由 | `getInboxConversationsForFrontend` の記録ロジックを確認 |
| 5 | 国マスタの列数差異（sql-migration-scope.md では CoreSchema 8列/実シート 7列 と記録されていたが分析では 8列/8列 で一致）の解消経緯 | git log / PR 一覧で追跡可能 |
| 6 | 共用在庫のデータ量（1086行）が大きく、100行サンプルでは全体の型分布を代表できているか不明 | サブ関数 `devPostgresMigrationAnalysisSheets9to16()` を再実行し全行カウントを取得 |

---

## 8. PO 判断が必要な項目

| # | 項目 | 事実 | 選択肢 |
|---|-----|-----|-------|
| A | 選択肢マスタ（36列・旧）をSQL移行するか | DEV環境では不在。選択肢マスタV2（OPTION_MASTER、5列）がCoreSchemaV1に登録済み | (a) 選択肢マスタV2のみをSQL移行対象とする / (b) 旧選択肢マスタの扱いを明確化する |
| B | ログインセッションをSQL移行するか | 64行、すべてGAS内部API経由。フロントエンドはセッションIDのみやりとり。セッションIDはUUID×2連結形式（maxLen=72） | (a) SQLに移行してセッション管理を統一 / (b) GASスプレッドシートに残す |
| C | 会話ログ（商談用）をSQL移行するか | 249行、記録者IDがメールアドレス形式（staff_idではない）。11列中1列（商談解析）は全空。Inbox 4関数がアクセス | (a) SQLに移行 / (b) スコープ外 |
| D | 作品マスタ_共用在庫をSQL移行するか | CoreSchemaV1未登録。4列11行。共用在庫ReadAPIが参照 | (a) CoreSchemaV1に追加してSQL移行 / (b) GAS側のみに残す |
| E | システム設定をSQL移行するか | 3行。設定値列がnumber/boolean混在型。更新日時がstring（ISO形式） | (a) SQLに移行してアプリ設定を統一（型変換必要） / (b) GASスプレッドシートに残す |
| F | zip列の型混在（配送先マスタ・支払先マスタ）をどう扱うか | 6行中 string:2 / number:4（国際郵便番号の一部が数値格納） | (a) SQL移行前にスプレッドシートで文字列に統一 / (b) SQL移行時にTEXTにキャストして統一 |
| G | 商品マスタ同期の"-"文字列混在列（Boxes per Case / Packs per Box / Case重量）をどう扱うか | NULL代わりに"-"文字列を使用。数値型に変換すると"-"をNULLに置換する必要がある | (a) NULLに変換してSQL側でNUMERIC型 / (b) TEXT型で保持してアプリ側で変換 |
| H | 列名の命名規則をどうするか（239件の違反） | 日本語列名169件・大文字60件・スペース10件 | (a) SQL移行時に全列名をsnake_caseに変換（別名テーブルが必要） / (b) ダブルクォートで囲んで既存名を保持 |

---

## 9. 読んだファイル / 未読ファイルの一覧

### 読んだファイル

| ファイルパス | 目的 |
|------------|------|
| `docs/sql-migration-scope.md` | 22シート一覧・列差分・FK情報の把握 |
| `docs/schema-audit-baseline.md` | post-merge 比較基準の確認 |
| `src/00_CoreSchemaRegistry.js` | 全テーブル定義・PK・FK参照関係の確認 |
| `src/08_Config.js` | getEnvironment/getSpreadsheet の実装確認 |
| `src/99_DevAddLineToOptionMaster.js` | 既存dev関数のパターン確認 |

### 未読ファイル

| ファイルパス | 未確認事項 |
|------------|----------|
| `src/28_CoreLeadFormOptionsApi.js` | getLeadFormOptions が参照するシート名（選択肢マスタ vs 選択肢マスタV2）の詳細 |
| `src/28_CoreInboxApi.js` | 会話ログへの記録者ID書き込みロジック（staff_id vs email） |

---

*分析関数（読み取り専用）: `src/99_DevPostgresMigrationAnalysis.js`*  
*スプレッドシートへの書き込みは一切行っていない。*
