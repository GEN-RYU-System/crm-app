# 列名変換案（英語スネークケース）

## 1. 調査基準 SHA

| 項目 | 値 |
|------|---|
| 参照基準 | `docs/sql-readiness-audit.md`（PR #703 squash SHA `aeebe1e3`） |
| CoreSchemaV1 参照 | `src/00_CoreSchemaRegistry.js`（HEAD `8bf3249`） |
| コード grep 実行日 | 2026-08-31 |
| grep 対象 | `src/` / `frontend/src/`（`.js.map` 除外） |

**本文書は変換案の提示のみ。シート・コードの変更は行わない。確定は PO が行う。**

---

## 2. 命名規則

| 規則 | 内容 |
|------|------|
| 文字種 | 半角英小文字・数字・アンダースコアのみ |
| 区切り | 単語間は `_` |
| 先頭 | 数字で始めない |
| スペース | `_` に置換（`Address 1` → `address_1`） |
| 括弧 | 括弧を除去し中身をサフィックスに（`国名（日本語）` → `name_ja`） |
| スラッシュ | `_` に置換（`送料/代行費` → `shipping_or_agency_fee`） |
| 言語サフィックス | 日本語 = `_ja` / 英語 = `_en` |
| 予約語 | SQL 予約語と衝突する場合は接頭辞追加（セクション 4 参照） |
| 長さ | 63 文字以内 |
| 参照方針 | CoreSchemaV1 の英語キー（例: `LEAD_ID`）を優先し小文字化 |

---

## 3. シートごとの変換案

> **凡例**  
> **太字**行 = 条件 2 NG 列（スペース・括弧・スラッシュあり）  
> 斜体行 = CoreSchemaV1 未登録の追加列  
> 参照数 = src件数 + frontend件数（クロスシート共有列名は `†` で注記）

---

### 3-1. リード管理（64 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | リードID | `lead_id` | CoreSchemaキー LEAD_ID を小文字化 | 00_CoreSchema, 27_WebApp, 28_Core*Api 他多数 | 421 |
| 2 | 登録日 | `registered_at` | CoreSchemaキー REGISTERED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 95 |
| 3 | 顧客名 | `customer_name` | CoreSchemaキー CUSTOMER_NAME を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 340 |
| 4 | *リード進捗* | `lead_progress` | 日→英（意訳: リード進捗 = lead progress） | 99_ReconcileArchive, 99_DevDemoSeed, index.html 他 | 56 |
| 5 | *商談進捗* | `deal_progress` | 日→英（意訳: 商談進捗 = deal progress） | 99_ReconcileArchive, 99_DevDemoSeed 他 | 40 |
| 6 | 商談結果 | `deal_result` | CoreSchemaキー DEAL_RESULT を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 64 |
| 7 | **呼び方（英語）** | `english_call_name` | CoreSchemaキー ENGLISH_CALL_NAME を小文字化・全角括弧除去 | 27_WebApp, index.html, 22_SetupIntegratedSheet, 00_CoreSchema 他 | 57 |
| 8 | 国 | `country` | CoreSchemaキー COUNTRY を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他（†多数シートで共有） | 369† |
| 9 | シート更新日 | `sheet_updated_at` | CoreSchemaキー SHEET_UPDATED_AT を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 110 |
| 10 | リード担当者 | `lead_assignee_name` | CoreSchemaキー LEAD_ASSIGNEE_NAME を小文字化 | 00_CoreSchema, 27_WebApp 他 | 21 |
| 11 | リード種別 | `lead_type` | CoreSchemaキー LEAD_TYPE を小文字化 | 00_CoreSchema, 27_WebApp, index.html, 08_Config 他 | 133 |
| 12 | 流入経路 | `lead_source` | CoreSchemaキー LEAD_SOURCE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他（†選択肢マスタと共有） | 136 |
| 13 | 流入元ID | `lead_source_id` | CoreSchemaキー LEAD_SOURCE_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 60 |
| 14 | メッセージURL | `message_url` | CoreSchemaキー MESSAGE_URL を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 66 |
| 15 | 取り扱いタイトル | `handled_title` | CoreSchemaキー HANDLED_TITLE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 78 |
| 16 | 作品ID | `ip_ids` | CoreSchemaキー IP_IDS を小文字化 | 00_CoreSchema, 27_WebApp 他 | 58 |
| 17 | CSメモ | `cs_note` | CoreSchemaキー CS_NOTE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 49 |
| 18 | メール | `email` | CoreSchemaキー EMAIL を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp, 18_CustomerRegistration 他 | 245† |
| 19 | 電話番号 | `phone` | CoreSchemaキー PHONE を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 89† |
| 20 | 連絡手段 | `contact_method` | CoreSchemaキー CONTACT_METHOD を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 38 |
| 21 | 温度感 | `temperature` | CoreSchemaキー TEMPERATURE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 65 |
| 22 | 想定規模 | `expected_scale` | CoreSchemaキー EXPECTED_SCALE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 42 |
| 23 | 返信速度 | `response_speed` | CoreSchemaキー RESPONSE_SPEED を小文字化 | 00_CoreSchema, 27_WebApp, frontend 他 | 64 |
| 24 | 問い合わせ回数 | `inquiry_count` | CoreSchemaキー INQUIRY_COUNT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 11 |
| 25 | アーカイブ日 | `archived_at` | CoreSchemaキー ARCHIVED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 55 |
| 26 | アーカイブ理由 | `archive_reason` | CoreSchemaキー ARCHIVE_REASON を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp 他 | 51 |
| 27 | アサイン日 | `assigned_at` | CoreSchemaキー ASSIGNED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 34 |
| 28 | 営業担当者 | `sales_assignee_name` | CoreSchemaキー SALES_ASSIGNEE_NAME を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 86 |
| 29 | 担当者ID | `assignee_id` | CoreSchemaキー ASSIGNEE_ID を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 347† |
| 30 | 顧客タイプ | `customer_type` | CoreSchemaキー CUSTOMER_TYPE を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp, index.html 他 | 32 |
| 31 | 最終対応者ID | `last_responder_id` | CoreSchemaキー LAST_RESPONDER_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 12 |
| 32 | 見込度 | `prospect_score` | CoreSchemaキー PROSPECT_SCORE を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp, index.html 他 | 25 |
| 33 | 次回アクション | `next_action` | CoreSchemaキー NEXT_ACTION を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 113 |
| 34 | 次回アクション日 | `next_action_date` | CoreSchemaキー NEXT_ACTION_DATE を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp 他 | 69 |
| 35 | 商談メモ | `deal_note` | CoreSchemaキー DEAL_NOTE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 113 |
| 36 | 相手の課題 | `customer_issue` | CoreSchemaキー CUSTOMER_ISSUE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 23 |
| 37 | 販売形態 | `sales_channel` | CoreSchemaキー SALES_CHANNEL を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp, index.html 他 | 28 |
| 38 | 月間見込み金額 | `monthly_expected_amount` | CoreSchemaキー MONTHLY_EXPECTED_AMOUNT を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 20 |
| 39 | *1回の発注金額* | 【要PO確定】 | 英語名が一意に決まらない（候補: `per_order_amount` / `single_order_amount`） | 21_SetupDealReport, 13_DealReportService 他 | 17 |
| 40 | **購入頻度(月次)** | `purchase_frequency_monthly` | 半角括弧除去・内容をサフィックスに（monthly）・日→英 | 21_SetupDealReport, 13_DealReportService, 99_ReconcileArchive, index.html 他 | 20 |
| 41 | 競合比較中 | `competitor_comparison` | CoreSchemaキー COMPETITOR_COMPARISON を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp, index.html 他 | 26 |
| 42 | *商談の手応え* | 【要PO確定】 | 英語名が一意に決まらない（候補: `deal_impression` / `deal_confidence`） | 21_SetupDealReport, 13_DealReportService 他 | 15 |
| 43 | アラート確認日 | `alert_confirmed_at` | CoreSchemaキー ALERT_CONFIRMED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 10 |
| 44 | 対象外理由 | `exclusion_reason` | CoreSchemaキー EXCLUSION_REASON を小文字化 | 00_CoreSchema, 27_WebApp 他 | 17 |
| 45 | 失注理由 | `loss_reason` | CoreSchemaキー LOSS_REASON を小文字化 | 00_CoreSchema, 27_WebApp 他 | 14 |
| 46 | 初回取引日 | `first_transaction_date` | CoreSchemaキー FIRST_TRANSACTION_DATE を小文字化（†顧客マスタと共有） | 00_CoreSchema, 27_WebApp 他 | 70 |
| 47 | 初回取引金額 | `first_transaction_amount` | CoreSchemaキー FIRST_TRANSACTION_AMOUNT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 23 |
| 48 | 累計取引金額 | `cumulative_transaction_amount` | CoreSchemaキー CUMULATIVE_TRANSACTION_AMOUNT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 24 |
| 49 | **Good Point** | `good_point` | 半角スペース→`_`・英語単語を小文字化 | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 50 | **More Point** | `more_point` | 半角スペース→`_`・英語単語を小文字化 | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 51 | *反省と今後の抱負* | 【要PO確定】 | 英語名が一意に決まらない（候補: `reflection_and_aspiration` / `retrospective_note`） | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 52 | *レポート提出日* | `report_submitted_at` | 日→英（意訳: レポート提出日 = report submitted at） | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 53 | *レポート確認者* | `report_reviewer` | 日→英（意訳: レポート確認者 = report reviewer） | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 54 | *レポート確認日* | `report_reviewed_at` | 日→英（意訳: レポート確認日 = report reviewed at） | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 55 | *レポートコメント* | `report_comment` | 日→英（意訳: レポートコメント = report comment） | 22_SetupIntegratedSheet, 23_SheetService | 4 |
| 56 | *Buddyフィードバック* | `buddy_feedback` | 英語部分を小文字化・日→英（feedback） | 30_BuddyReportService, 06_BuddyFeedbackService 他 | 40 |
| 57 | 会話要約 | `conversation_summary` | CoreSchemaキー CONVERSATION_SUMMARY を小文字化 | 00_CoreSchema, 27_WebApp 他 | 19 |
| 58 | 最終会話日時 | `last_conversation_at` | CoreSchemaキー LAST_CONVERSATION_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 15 |
| 59 | 会話数 | `conversation_count` | CoreSchemaキー CONVERSATION_COUNT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 13 |
| 60 | 重複フラグ | `duplicate_flag` | CoreSchemaキー DUPLICATE_FLAG を小文字化 | 00_CoreSchema, 27_WebApp 他 | 20 |
| 61 | 重複元リードID | `duplicate_source_lead_id` | CoreSchemaキー DUPLICATE_SOURCE_LEAD_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 19 |
| 62 | 重複確認日 | `duplicate_confirmed_at` | CoreSchemaキー DUPLICATE_CONFIRMED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 11 |
| 63 | 重複確認者 | `duplicate_confirmed_by` | CoreSchemaキー DUPLICATE_CONFIRMED_BY を小文字化 | 00_CoreSchema, 27_WebApp 他 | 11 |
| 64 | リードステータス | `lead_status` | CoreSchemaキー LEAD_STATUS を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 128 |

---

### 3-2. 顧客マスタ（15 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 顧客ID | `customer_id` | CoreSchemaキー CUSTOMER_ID を小文字化（†多数シートで共有） | 00_CoreSchema, 28_CoreCustomerReadApi 他 | 183† |
| 2 | 源流リードID | `source_lead_id` | CoreSchemaキー SOURCE_LEAD_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 44 |
| 3 | 顧客名 | `customer_name` | CoreSchemaキー CUSTOMER_NAME を小文字化（†リード管理と共有） | 00_CoreSchema, 28_CoreCustomerReadApi 他 | 340† |
| 4 | 国 | `country` | CoreSchemaキー COUNTRY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 369† |
| 5 | メール | `email` | CoreSchemaキー EMAIL を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 245† |
| 6 | 電話番号 | `phone` | CoreSchemaキー PHONE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 89† |
| 7 | 国番号 | `country_code` | CoreSchemaキー COUNTRY_CODE を小文字化（†配送先・支払先と共有） | 00_CoreSchema 他 | 44† |
| 8 | 初回取引日 | `first_transaction_date` | CoreSchemaキー FIRST_TRANSACTION_DATE を小文字化（†リード管理と共有） | 00_CoreSchema 他 | 70† |
| 9 | 登録日 | `registered_at` | CoreSchemaキー REGISTERED_AT を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 95† |
| 10 | 営業担当者 | `sales_assignee_name` | CoreSchemaキー SALES_ASSIGNEE_NAME を小文字化（†リード管理と共有） | 00_CoreSchema 他 | 86† |
| 11 | *担当者ID* | `assignee_id` ※ | CoreSchemaV1 CUSTOMERS 未登録列。PO判断A が確定後に最終確定 | 00_CoreSchema(LEADS), 27_WebApp 他（†多数シートで共有） | 347† |
| 12 | 連絡ツール | `contact_tool` | CoreSchemaキー CONTACT_TOOL を小文字化 | 00_CoreSchema, 27_WebApp 他 | 17 |
| 13 | **FedEx ID** | `fedex_id` | 半角スペース→`_`・英語単語を小文字化 | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他 | 15 |
| 14 | 発送時メモ | `shipping_note` | CoreSchemaキー SHIPPING_NOTE を小文字化（†オーダー管理と共有） | 00_CoreSchema 他 | 20† |
| 15 | 顧客規模 | `customer_scale` | CoreSchemaキー CUSTOMER_SCALE を小文字化 | 00_CoreSchema 他 | 1 |

※ 列 #11 `担当者ID`（CUSTOMERS）: sql-readiness-audit PO判断A（保持/廃止）が確定してから命名を決定することを推奨。

---

### 3-3. 配送先マスタ（17 列）

> `Address 1/2/3`・`D Email`・`D Tax ID` の grep ヒット数は配送先・支払先・発行元マスタの3シートを合算。

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 配送先ID | `shipping_destination_id` | CoreSchemaキー SHIPPING_DESTINATION_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 26 |
| 2 | 顧客ID | `customer_id` | CoreSchemaキー CUSTOMER_ID を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 183† |
| 3 | 宛名 | `recipient_name` | CoreSchemaキー RECIPIENT_NAME を小文字化 | 00_CoreSchema, 27_WebApp 他 | 18 |
| 4 | **Address 1** | `address_line_1` | CoreSchemaキー ADDRESS_LINE_1 を小文字化・半角スペース→`_` | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他（†3シート合算） | 60† |
| 5 | **Address 2** | `address_line_2` | CoreSchemaキー ADDRESS_LINE_2 を小文字化・半角スペース→`_` | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他（†3シート合算） | 48† |
| 6 | **Address 3** | `address_line_3` | CoreSchemaキー ADDRESS_LINE_3 を小文字化・半角スペース→`_` | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他（†3シート合算） | 41† |
| 7 | City | `city` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema, 99_CustomerMasterSeed, 27_WebApp 他 | 83† |
| 8 | State | `state` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema, 99_CustomerMasterSeed, 27_WebApp 他 | 231†（注1） |
| 9 | Zip | `zip` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema, 99_CustomerMasterSeed, 27_WebApp 他 | 70† |
| 10 | 国 | `country` | CoreSchemaキー COUNTRY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 369† |
| 11 | 電話 | `phone` | CoreSchemaキー PHONE を小文字化（注2） | 00_CoreSchema, 27_WebApp 他 | 110† |
| 12 | 国番号 | `country_code` | CoreSchemaキー COUNTRY_CODE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 44† |
| 13 | **D Email** | `email` | CoreSchemaキー EMAIL を小文字化・プレフィックス `D` 除去（配送先コンテキストで一意） | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他 | 16 |
| 14 | **D Tax ID** | `tax_id` | CoreSchemaキー TAX_ID を小文字化・プレフィックス `D` 除去・半角スペース→`_` | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 請求書発行 他 | 16 |
| 15 | 表示名 | `display_name` | CoreSchemaキー DISPLAY_NAME を小文字化（†支払先と共有） | 00_CoreSchema 他 | 19† |
| 16 | 既定 | `is_default` | CoreSchemaキー IS_DEFAULT を小文字化（†支払先と共有） | 00_CoreSchema, 27_WebApp 他 | 28† |
| 17 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 169† |

注1: `State` の 231 件は JavaScript の予約語 `state` / スプレッドシートの `State` が混在している可能性あり。  
注2: SHIPPING_DESTINATIONS.PHONE は `電話`（CUSTOMERS.PHONE は `電話番号`）。SQL カラム名はどちらも `phone` だが、テーブルが異なるため衝突しない。

---

### 3-4. 支払先マスタ（16 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 支払先ID | `payment_destination_id` | CoreSchemaキー PAYMENT_DESTINATION_ID を小文字化 | 00_CoreSchema, 27_WebApp 他 | 26 |
| 2 | 顧客ID | `customer_id` | CoreSchemaキー CUSTOMER_ID を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 183† |
| 3 | 請求名義 | `billing_name` | CoreSchemaキー BILLING_NAME を小文字化 | 00_CoreSchema, 27_WebApp 他 | 18 |
| 4 | **Address 1** | `address_line_1` | CoreSchemaキー ADDRESS_LINE_1 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config 他 | 60† |
| 5 | **Address 2** | `address_line_2` | CoreSchemaキー ADDRESS_LINE_2 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config 他 | 48† |
| 6 | **Address 3** | `address_line_3` | CoreSchemaキー ADDRESS_LINE_3 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config 他 | 41† |
| 7 | City | `city` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 83† |
| 8 | State | `state` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 231† |
| 9 | Zip | `zip` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 70† |
| 10 | 国 | `country` | CoreSchemaキー COUNTRY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 369† |
| 11 | 支払方法 | `payment_method` | CoreSchemaキー PAYMENT_METHOD を小文字化（†オーダー管理と共有） | 00_CoreSchema, 27_WebApp 他 | 13 |
| 12 | 通貨 | `currency` | CoreSchemaキー CURRENCY を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 74† |
| 13 | **B Tax ID** | `tax_id` | CoreSchemaキー TAX_ID を小文字化・プレフィックス `B` 除去・半角スペース→`_` | 99_CustomerMasterSeed, 00_CoreSchema, 08_Config, 18_CustomerRegistration 他 | 22 |
| 14 | 表示名 | `display_name` | CoreSchemaキー DISPLAY_NAME を小文字化（†配送先と共有） | 00_CoreSchema 他 | 19† |
| 15 | 既定 | `is_default` | CoreSchemaキー IS_DEFAULT を小文字化（†配送先と共有） | 00_CoreSchema 他 | 28† |
| 16 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 169† |

---

### 3-5. 見積もり管理（19 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 見積書ID | `quote_id` | CoreSchemaキー QUOTE_ID を小文字化 | 00_CoreSchema, 28_CoreQuoteApi 他 | 57 |
| 2 | リードID | `lead_id` | CoreSchemaキー LEAD_ID を小文字化（†リード管理と共有） | 00_CoreSchema 他 | 421† |
| 3 | 顧客ID | `customer_id` | CoreSchemaキー CUSTOMER_ID を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 183† |
| 4 | オーダーID | `order_id` | CoreSchemaキー ORDER_ID を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 138† |
| 5 | 担当者ID | `staff_id` | CoreSchemaキー STAFF_ID を小文字化（※QUOTES では staff_id） | 00_CoreSchema 他 | 347† |
| 6 | 発行日 | `issued_date` | CoreSchemaキー ISSUED_DATE を小文字化 | 00_CoreSchema, 28_CoreQuoteApi 他 | 46 |
| 7 | 有効期限 | `expiry_date` | CoreSchemaキー EXPIRY_DATE を小文字化 | 00_CoreSchema, 28_CoreQuoteApi 他 | 21 |
| 8 | ステータス | `status` | CoreSchemaキー STATUS を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp 他 | 515† |
| 9 | 通貨 | `currency` | CoreSchemaキー CURRENCY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 74† |
| 10 | 為替レート | `exchange_rate` | CoreSchemaキー EXCHANGE_RATE を小文字化（†オーダー管理と共有） | 00_CoreSchema 他 | 60† |
| 11 | 小計 | `subtotal` | CoreSchemaキー SUBTOTAL を小文字化 | 00_CoreSchema, 27_WebApp 他 | 86 |
| 12 | 送料 | `shipping_fee` | CoreSchemaキー SHIPPING_FEE を小文字化（†オーダー管理と共有） | 00_CoreSchema, 27_WebApp 他 | 114† |
| 13 | 値引き | `discount` | CoreSchemaキー DISCOUNT を小文字化（†オーダー管理と共有） | 00_CoreSchema 他 | 26 |
| 14 | 合計金額 | `total_amount` | CoreSchemaキー TOTAL_AMOUNT を小文字化 | 00_CoreSchema 他 | 16 |
| 15 | 円換算合計 | `total_amount_jpy` | CoreSchemaキー TOTAL_AMOUNT_JPY を小文字化 | 00_CoreSchema 他 | 1 |
| 16 | **PDF URL** | `pdf_url` | CoreSchemaキー PDF_URL を小文字化・半角スペース→`_` | 11_QuoteService, 00_CoreSchema, 35_SalesDataSync, 27_WebApp 他 | 36 |
| 17 | 備考 | `note` | CoreSchemaキー NOTE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 65† |
| 18 | 作成日時 | `created_at` | CoreSchemaキー CREATED_AT を小文字化 | 00_CoreSchema 他 | 7 |
| 19 | 更新日時 | `updated_at` | CoreSchemaキー UPDATED_AT を小文字化 | 00_CoreSchema 他 | 7 |

---

### 3-6. 仕入れ（19 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 仕入れID | `purchase_id` | CoreSchemaキー PURCHASE_ID を小文字化 | 00_CoreSchema, 28_CorePurchaseApi 他 | 17 |
| 2 | オーダーID | `order_id` | CoreSchemaキー ORDER_ID を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 138† |
| 3 | 仕入れ担当ID | `purchase_assignee_id` | CoreSchemaキー PURCHASE_ASSIGNEE_ID を小文字化 | 00_CoreSchema, 28_CorePurchaseApi 他 | 5 |
| 4 | 仕入れ支払者ID | `paid_by_id` | CoreSchemaキー PAID_BY_ID を小文字化 | 00_CoreSchema 他 | 2 |
| 5 | 注文日 | `ordered_at` | CoreSchemaキー ORDERED_AT を小文字化 | 00_CoreSchema, 27_WebApp 他 | 25 |
| 6 | 仕入れ支払日 | `paid_at` | CoreSchemaキー PAID_AT を小文字化 | 00_CoreSchema 他 | 1 |
| 7 | 取引番号 | `transaction_number` | CoreSchemaキー TRANSACTION_NUMBER を小文字化 | 00_CoreSchema 他 | 4 |
| 8 | 仕入元 | `supplier` | CoreSchemaキー SUPPLIER を小文字化（†選択肢マスタと共有） | 00_CoreSchema, 27_WebApp, index.html 他 | 46 |
| 9 | 仕入元URL | `supplier_url` | CoreSchemaキー SUPPLIER_URL を小文字化 | 00_CoreSchema, 27_WebApp 他 | 4 |
| 10 | 数量 | `quantity` | CoreSchemaキー QUANTITY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 134† |
| 11 | 単価 | `unit_price` | CoreSchemaキー UNIT_PRICE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 110† |
| 12 | 金額 | `amount` | CoreSchemaキー AMOUNT を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 161† |
| 13 | **送料/代行費** | `shipping_or_agency_fee` | CoreSchemaキー SHIPPING_OR_AGENCY_FEE を小文字化・スラッシュ→`_or_` | 99_Phase5BConfirm, 00_CoreSchema, 08_Config, frontend/salesOrders.ts | 4 |
| 14 | 運送会社 | `carrier` | CoreSchemaキー CARRIER を小文字化 | 00_CoreSchema, 27_WebApp 他 | 4 |
| 15 | 送り状番号 | `tracking_number` | CoreSchemaキー TRACKING_NUMBER を小文字化（†発送と共有） | 00_CoreSchema 他 | 7† |
| 16 | ステータス | `status` | CoreSchemaキー STATUS を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 515† |
| 17 | 備考 | `note` | CoreSchemaキー NOTE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 65† |
| 18 | 登録日 | `registered_at` | CoreSchemaキー REGISTERED_AT を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 95† |
| 19 | 更新日 | `updated_at` | CoreSchemaキー UPDATED_AT を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 185† |

---

### 3-7. 国マスタ（8 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | **国ID(ISO2)** | `country_code` | CoreSchemaキー COUNTRY_CODE を小文字化・半角括弧除去（ISO2 は補足情報のため省略） | 28_CoreOrderReadApi, 99_DevCountryMasterJaNames, 17_CountryMaster, 00_CoreSchema, 99_SqlReadinessCheck 他 | 10 |
| 2 | **国名（表示）** | `display_name` | CoreSchemaキー DISPLAY_NAME を小文字化・全角括弧除去 | 99_PerfBench, 17_CountryMaster, 00_CoreSchema, 28_CoreLeadFormOptionsApi, 18_CustomerRegistration 他 | 15 |
| 3 | **国名（日本語）** | `name_ja` | CoreSchemaキー NAME_JA を小文字化・全角括弧を `_ja` サフィックスに | 28_CoreOrderReadApi, 99_DevCountryMasterJaNames, 00_CoreSchema 他 | 10 |
| 4 | 国番号 | `country_number` | CoreSchemaキー COUNTRY_NUMBER を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 44† |
| 5 | トランク0除去 | `strip_trunk_zero` | CoreSchemaキー STRIP_TRUNK_ZERO を小文字化 | 00_CoreSchema, 17_CountryMaster 他 | 7 |
| 6 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 169† |
| 7 | 州必須 | `state_required` | CoreSchemaキー STATE_REQUIRED を小文字化 | 00_CoreSchema, 17_CountryMaster, 18_CustomerRegistration 他 | 18 |
| 8 | 郵便番号必須 | `zip_required` | CoreSchemaキー ZIP_REQUIRED を小文字化 | 00_CoreSchema, 17_CountryMaster 他 | 18 |

---

### 3-8. 選択肢マスタ（36 列）

> CoreSchemaV1 未登録シート。英語名は業務文脈から意訳。

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | リード種別 | `lead_type` | 日→英（意訳）・†LEADS と共有 | 08_Config, index.html 他 | 133† |
| 2 | リードID | `lead_id` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema, 27_WebApp 他 | 421† |
| 3 | 流入経路 | `lead_source` | 日→英（意訳）・†LEADS と共有 | 08_Config, 27_WebApp 他 | 136† |
| 4 | **流入経路（IN）** | `lead_source_inbound` | 全角括弧除去・`_inbound` サフィックス | index.html, 08_Config, 22_SetupIntegratedSheet, 99_StaffMasterDump 他 | 9 |
| 5 | **流入経路（OUT）** | `lead_source_outbound` | 全角括弧除去・`_outbound` サフィックス | index.html, 08_Config, 99_StaffMasterDump 他 | 7 |
| 6 | アーカイブ理由 | `archive_reason` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema, 27_WebApp 他 | 51† |
| 7 | リードステータス | `lead_status` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema, 27_WebApp 他 | 128† |
| 8 | 返信速度 | `response_speed` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema, 27_WebApp 他 | 64† |
| 9 | 連絡手段 | `contact_method` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 38† |
| 10 | 取り扱い商材 | `handled_merchandise` | 日→英（意訳: 取り扱い商材 = handled merchandise） | 08_Config, frontend 他 | 10 |
| 11 | 温度感 | `lead_temperature` | 日→英（意訳: 温度感 = lead temperature）・†LEADS と共有 | 00_CoreSchema 他 | 65† |
| 12 | 想定規模 | `expected_scale` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 42† |
| 13 | 商談ステータス | `deal_status` | 日→英（意訳: 商談ステータス = deal status） | 08_Config 他 | 4 |
| 14 | 商談結果 | `deal_result` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 64† |
| 15 | 顧客タイプ | `customer_type` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 32† |
| 16 | 販売形態 | `sales_channel` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 28† |
| 17 | 競合比較中 | `competitor_comparison` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 26† |
| 18 | 役割 | `staff_role` | 日→英（意訳）・PostgreSQL 非予約語だが衝突リスクのため接頭辞追加（セクション4参照） | 08_Config 他 | — |
| 19 | ステータス | `status` | 日→英（意訳）・†多数シートで共有 | 08_Config 他 | 515† |
| 20 | カテゴリ | `category` | 日→英（意訳）・†多数シートで共有 | 08_Config 他 | — |
| 21 | **購入頻度(月次)** | `purchase_frequency_monthly` | 半角括弧除去・内容をサフィックスに（monthly）・日→英（†LEADS と共有） | 21_SetupDealReport, 13_DealReportService, index.html 他 | 20† |
| 22 | 見込度 | `prospect_score` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 25† |
| 23 | 支払い方法 | `payment_method` | 日→英（意訳）・†支払先マスタと共有 | 08_Config 他 | 13† |
| 24 | 発送方法 | `shipping_method` | 日→英（意訳）・†オーダー管理と共有 | 08_Config 他 | — |
| 25 | 商品ステータス | `product_status` | 日→英（意訳: 商品ステータス = product status） | 08_Config 他 | 2 |
| 26 | 為替 | `currency` | **実データ確認済み（Section 10参照）**: 値が JPY/USD/EUR/AUD/GBP（ISO 4217 通貨コード）→ `currency` を採用 | 08_Config, 27_WebApp 他 | 64 |
| 27 | 為替レート | （除外）→ セクション 7 参照 | GOOGLEFINANCE 数式列。SQL 移行後は外部 API 取得に置き換え | 00_CoreSchema 他 | 60† |
| 28 | 次回アクション日 | `next_action_date` | 日→英（意訳）・†LEADS と共有 | 00_CoreSchema 他 | 69† |
| 29 | ページ | 【要PO確定】 | 業務上の意味が不明確（候補: `page` / `screen_page`）。選択肢マスタ内での用途を確認要 | index.html 他（†多数文脈で出現） | 148†（注） |
| 30 | リードシーン | 【要PO確定】 | 業務上の意味が不明確（候補: `lead_scene` / `lead_scenario`）。コードに参照なし | 参照なし | 0 |
| 31 | 仕入元 | `supplier` | 日→英（意訳）・†仕入れと共有 | 08_Config 他 | 46† |
| 32 | eLogiCSV格納フォルダ | `elogi_csv_folder` | サービス名 eLogi をそのまま英字化・日本語部分を英訳 | 参照なし | 0 |
| 33 | ラベルPDF格納フォルダ | `label_pdf_folder` | 日→英（意訳: ラベル=label, PDF格納フォルダ=pdf_folder） | 参照なし | 0 |
| 34 | FAQ_カテゴリ | `faq_category` | `FAQ_` + 日→英（カテゴリ=category）・アンダースコア維持 | 08_Config 他 | 4 |
| 35 | 支払サイト | `payment_terms` | 日→英（業界慣用: 支払サイト = payment terms）・†オーダー管理と共有 | 08_Config 他 | 16† |
| 36 | キャンセル理由 | `cancellation_reason` | 日→英（意訳）・†オーダー管理と共有 | 08_Config, 27_WebApp 他 | 48† |

注: `ページ` の 148 件は JavaScript 文脈・UI テキスト等が混在。選択肢マスタへの参照のみの件数は未分別。

---

### 3-9. 発行元マスタ（18 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 発行元ID | `issuer_id` | CoreSchemaキー ISSUER_ID を小文字化 | 00_CoreSchema, 28_CoreIssuerApi 他 | 2 |
| 2 | 会社名 | `company_name` | CoreSchemaキー COMPANY_NAME を小文字化 | 00_CoreSchema, 28_CoreIssuerApi 他 | 7 |
| 3 | 担当者名 | `contact_name` | CoreSchemaキー CONTACT_NAME を小文字化 | 00_CoreSchema, 27_WebApp, frontend 他 | 72 |
| 4 | **Address 1** | `address_line_1` | CoreSchemaキー ADDRESS_LINE1 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema 他 | 60† |
| 5 | **Address 2** | `address_line_2` | CoreSchemaキー ADDRESS_LINE2 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema 他 | 48† |
| 6 | **Address 3** | `address_line_3` | CoreSchemaキー ADDRESS_LINE3 を小文字化・半角スペース→`_`（†3シート合算） | 99_CustomerMasterSeed, 00_CoreSchema 他 | 41† |
| 7 | City | `city` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 83† |
| 8 | State | `state` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 231† |
| 9 | Zip | `zip` | 英語単語を小文字化（†3シートで共有） | 00_CoreSchema 他 | 70† |
| 10 | 国 | `country` | CoreSchemaキー COUNTRY を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 369† |
| 11 | 電話番号 | `phone` | CoreSchemaキー PHONE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 89† |
| 12 | メール | `email` | CoreSchemaキー EMAIL を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 245† |
| 13 | 登録番号 | `registration_no` | CoreSchemaキー REGISTRATION_NO を小文字化 | 00_CoreSchema, frontend 他 | 1 |
| 14 | 受取名義 | `payee_name` | CoreSchemaキー PAYEE_NAME を小文字化 | 00_CoreSchema, frontend 他 | 1 |
| 15 | 受取先メール | `payment_email` | CoreSchemaキー PAYMENT_EMAIL を小文字化 | 00_CoreSchema, frontend 他 | 1 |
| 16 | 注記 | `note` | CoreSchemaキー PAYMENT_NOTE を小文字化→`note`（†多数シートで共有） | 00_CoreSchema, frontend 他 | 2 |
| 17 | 結びの文 | `closing_message` | CoreSchemaキー CLOSING_MESSAGE を小文字化 | 00_CoreSchema, frontend 他 | 1 |
| 18 | 有効 | `is_active` | CoreSchemaキー IS_ACTIVE を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 169† |

---

### 3-10. 担当者マスタ（24 列）

| # | 現在の列名 | 変換案 | 変換理由 | コード内の参照箇所（主要ファイル） | 参照数 |
|---|-----------|-------|---------|----------------------------------|--------|
| 1 | 担当者ID | `staff_id` | CoreSchemaキー STAFF_ID を小文字化（†多数シートで共有） | 00_CoreSchema, 27_WebApp, 26_LoginService 他 | 347† |
| 2 | **苗字（日本語）** | `last_name_ja` | CoreSchemaキー LAST_NAME_JA を小文字化・全角括弧を `_ja` サフィックスに | 27_WebApp, 26_Triggers, 12_DashboardService, 29_PermissionService, 00_EmailColumnHelper 他 | 51 |
| 3 | **名前（日本語）** | `first_name_ja` | CoreSchemaキー FIRST_NAME_JA を小文字化・全角括弧を `_ja` サフィックスに | 27_WebApp, 26_Triggers, 12_DashboardService, 29_PermissionService 他 | 51 |
| 4 | **氏名（日本語）** | `full_name_ja` | CoreSchemaキー FULL_NAME_JA を小文字化・全角括弧を `_ja` サフィックスに | 27_WebApp, 35_SalesDataSyncService, 22_SetupIntegratedSheet, 99_StaffMasterDump 他 | 36 |
| 5 | 苗字ふりがな | `last_name_kana` | CoreSchemaキー LAST_NAME_KANA を小文字化 | 00_CoreSchema, 22_SetupIntegratedSheet 他 | 7 |
| 6 | 名前ふりがな | `first_name_kana` | CoreSchemaキー FIRST_NAME_KANA を小文字化 | 00_CoreSchema, 22_SetupIntegratedSheet 他 | 7 |
| 7 | **苗字（英語）** | `last_name_en` | CoreSchemaキー LAST_NAME_EN を小文字化・全角括弧を `_en` サフィックスに | index.html, 00_CoreSchema, 08_Config, 22_SetupIntegratedSheet, frontend/staff.ts 他 | 14 |
| 8 | **名前（英語）** | `first_name_en` | CoreSchemaキー FIRST_NAME_EN を小文字化・全角括弧を `_en` サフィックスに | index.html, 00_CoreSchema, 08_Config, 22_SetupIntegratedSheet, frontend/staff.ts 他 | 14 |
| 9 | メール | `email` | CoreSchemaキー EMAIL を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 245† |
| 10 | **Discord ID** | `discord_id` | CoreSchemaキー DISCORD_ID を小文字化・半角スペース→`_` | 99_DevStaffDiscordIdCount, 11_DailyReportService, 00_CoreSchema, 08_Config, 22_SetupIntegratedSheet, frontend/staff.ts 他 | 11 |
| 11 | 役割 | `staff_role` | CoreSchemaキー ROLE を小文字化→`staff_role`（SQL予約語リスクのため接頭辞追加、セクション4参照） | 00_CoreSchema, 08_Config, 27_WebApp, index.html 他 | — |
| 12 | ステータス | `status` | CoreSchemaキー STATUS を小文字化（†多数シートで共有） | 00_CoreSchema 他 | 515† |
| 13 | 元候補者ID | `source_candidate_id` | CoreSchemaキー SOURCE_CANDIDATE_ID を小文字化 | 00_CoreSchema 他 | 5 |
| 14 | ダークモード | `dark_mode` | CoreSchemaキー DARK_MODE を小文字化 | 00_CoreSchema, 27_WebApp, index.html 他 | 32 |
| 15 | チャットメニュー表示 | `chat_menu_visible` | CoreSchemaキー CHAT_MENU_VISIBLE を小文字化 | 00_CoreSchema, 27_WebApp 他 | 5 |
| 16 | 営業メニュー表示 | `sales_menu_visible` | CoreSchemaキー SALES_MENU_VISIBLE を小文字化 | 00_CoreSchema, 27_WebApp 他 | 5 |
| 17 | 設定メニュー表示 | `settings_menu_visible` | CoreSchemaキー SETTINGS_MENU_VISIBLE を小文字化 | 00_CoreSchema, 27_WebApp 他 | 5 |
| 18 | 管理者メニュー表示 | `admin_menu_visible` | CoreSchemaキー ADMIN_MENU_VISIBLE を小文字化 | 00_CoreSchema, 27_WebApp 他 | 8 |
| 19 | Buddyメンテナンスメニュー表示 | `buddy_maintenance_menu_visible` | CoreSchemaキー BUDDY_MAINTENANCE_MENU_VISIBLE を小文字化 | 00_CoreSchema 他 | 8 |
| 20 | サイドバー表示 | `sidebar_visible` | CoreSchemaキー SIDEBAR_VISIBLE を小文字化 | 00_CoreSchema, 27_WebApp 他 | 16 |
| 21 | パスワードハッシュ | `password_hash` | CoreSchemaキー PASSWORD_HASH を小文字化 | 00_CoreSchema, 26_StaffCredentialService 他 | 2 |
| 22 | パスワードソルト | `password_salt` | CoreSchemaキー PASSWORD_SALT を小文字化 | 00_CoreSchema 他 | 1 |
| 23 | 連続失敗回数 | `login_fail_count` | CoreSchemaキー LOGIN_FAIL_COUNT を小文字化 | 00_CoreSchema, 26_StaffCredentialService 他 | 2 |
| 24 | ロック解除時刻 | `locked_until` | CoreSchemaキー LOCKED_UNTIL を小文字化 | 00_CoreSchema, 26_StaffCredentialService 他 | 2 |

---

## 4. SQL 予約語と衝突する列の一覧

PostgreSQL 16 の予約語リスト（non-reserved を除く完全予約語）と照合した結果。

| シート | 現在の列名 | 変換案 | 判定 | 対応 |
|-------|-----------|-------|------|------|
| 担当者マスタ / 選択肢マスタ | 役割 | `role` → `staff_role` | 注意 | `ROLE` は PostgreSQL の non-reserved キーワード（列名として使用可能だが一部 SQL 文脈で引用符が必要）。誤解防止のため `staff_role` を推奨 |

**その他の変換案（`status`, `state`, `note`, `date`系, `type`系）は PostgreSQL の非予約語または予約語に該当せず、衝突なし。**

---

## 5. 【要PO確定】の列一覧（変換案が決められなかったもの）

| シート | 現在の列名 | 候補案 | 確定できない理由 |
|-------|-----------|-------|----------------|
| リード管理 | 1回の発注金額 | `per_order_amount` / `single_order_amount` | 「1回」が「1取引あたり」か「単品単価」かで意味が変わる |
| リード管理 | 商談の手応え | `deal_impression` / `deal_confidence` / `deal_response` | 業務上の意味が主観的で一意に訳せない |
| リード管理 | 反省と今後の抱負 | `reflection_and_aspiration` / `retrospective_note` | 非常に長い概念・2つの概念を1列に持つ設計自体の見直しも含め PO 判断が必要 |
| 選択肢マスタ | ページ | `page` / `screen_page` | 実データ確認済み（共通/リード/新規/ルート）。英語名は業務文脈の判断が必要（Section 10参照） |
| 選択肢マスタ | リードシーン | `lead_scene` / `lead_scenario` | コードに参照なし（用途不明・Section 12参照） |

**合計: 5列（閾値 20 列を下回る。為替は Section 10 で `currency` に確定済み）**

---

## 6. 整形順序の参考数値

> NG 列の参照数の合計が小さいほど、整形の影響範囲が小さい。
> `†` = 複数シートで同一列名を共有しているため grep 数がクロスシートで合算されている。

| シート | NG 列数 | 全列数 | NG 列の参照数合計（src+fe） | 備考 |
|-------|---------|-------|--------------------------|------|
| 仕入れ | 1 | 19 | 4 | 参照が最も少ない |
| 顧客マスタ | 1 | 15 | 15 | |
| 国マスタ | 3 | 8 | 35 | |
| 見積もり管理 | 1 | 19 | 36 | |
| 選択肢マスタ | 3 | 36 | 36 | 購入頻度(月次) はリード管理と共有† |
| リード管理 | 4 | 64 | 85 | |
| 発行元マスタ | 3 | 18 | 149 | Address 1/2/3 は 3 シート合算† |
| 支払先マスタ | 4 | 16 | 171 | Address 1/2/3 は 3 シート合算† |
| 担当者マスタ | 6 | 24 | 177 | |
| 配送先マスタ | 5 | 17 | 181 | Address 1/2/3 は 3 シート合算† |

> **注**: Address 1/2/3 の grep ヒット数（60/48/41）は配送先・支払先・発行元の 3 シートを合算した値。
> 各シート単体の実影響は概ね 1/3 程度と推定されるが、精密な分離計上は行っていない（数値の提示のみ）。

---

## 7. 除外対象と理由

| 対象 | 除外理由 |
|------|---------|
| **商品マスタ同期**（`src/00_CoreSchemaRegistry.js` PRODUCTS テーブル） | 別セッション管轄のため本依頼の対象外 |
| **システム設定** 空列 6〜14（9 列） | 列名が存在しない（空文字）ため、変換ではなく列名の新規付与が必要。PO 判断 G が前提 |
| **通貨マスタ.円換算レート** | `=GOOGLEFINANCE("CURRENCY:USDJPY")` 数式列。SQL 移行後は salesanchor 側で外部 API から定期取得してDBに保存する方針（PO決定済み）。列名変換とは別に扱う |
| **選択肢マスタ.為替レート** | 同上（GOOGLEFINANCE 数式列） |

---

## 8. 整形手順の注意

列名の変更は、必ず以下の順序で行う。順序を誤ると機能が停止する。

1. コード側を「新旧どちらの列名でも読める」状態にする（PR / revert 可能）
2. PO がシートの列名を手作業で変更する（revert 不可）
3. コード側から旧列名の対応を削除する（PR / revert 可能）

CC はステップ2を実行してはならない。

---

## 9. 【未確認】項目 / 読んだファイル

### 【未確認】

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 選択肢マスタ `リードID` 列の業務的用途（なぜ選択肢シートにリードIDが存在するか） | 実データを目視確認 |
| 2 | 選択肢マスタ `ページ` の業務的用途（英語名: Section 10 に実データあり） | PO 確認 |
| 3 | ~~選択肢マスタ `為替` が通貨コードリストか為替種別リストか~~ **解決済み** → Section 10 参照 | — |
| 4 | 配送先マスタ `State` の grep 231 件に JS の状態管理変数 `state` が混在しているか | `grep -n "'State'" src/` で文字列リテラルに絞り再計上 |
| 5 | 担当者マスタ `役割` を `staff_role` にするか `role` のままでよいかの最終判断 | PO または DB 設計担当者が確認 |

### 読んだファイル

| ファイルパス | 確認内容 |
|------------|---------|
| `docs/sql-readiness-audit.md` | NG 列名 41 件・除外対象の定義 |
| `docs/sql-migration-scope.md` | 移行対象 22 シートの定義 |
| `docs/sheet-headers-snapshot.md` | 実シートヘッダー一覧 |
| `src/00_CoreSchemaRegistry.js` | CoreSchemaV1 全テーブル定義（英語キー→日本語列名マッピング） |
| `src/22_SetupIntegratedSheet.js` | L64,L284,L541（LEAD_SHEET_HEADERS、列幅設定、テストデータ）/ L698-730（月次レポートシート）/ L760-792（週次レポートシート） |
| `src/23_SheetService.js` | L695-718（リード行初期化コード）|
| `src/20_ReportService.js` | L146,164,317（Buddyフィードバック列の読み書き）|
| `src/32_StaffService.js` | L482,570,585,600（Buddyメンテナンスメニュー表示列の読み書き）|
| `src/13_DealReportService.js` | L47,51,60,77,84,88,413,417,426,469,470,472（商談の手応え・1回の発注金額・Buddyフィードバック）|
| `src/21_SetupDealReport.js` | L134,138,147,165（商談レポートセットアップ）|
| `src/06_BuddyFeedbackService.js` | L75,78（1回の発注金額・商談の手応えの参照）|
| `src/index.html` | L6291,6324（商談の手応え表示）/ L10390-10397,11337-11344（1回の発注金額フォーム）/ L14124-14125（商談の手応えフォーム）/ L14698,16313,16339（Buddyメンテナンスメニュー表示）|
| `src/99_StaffMasterDump.js` | L219（商談の手応えのリスト定義）|

---

## 10. 実データ確認結果

**調査日**: 2026-08-30  
**調査方法**: `clasp run getOptionMasterSample`（`src/99_OptionMasterSample.js`・読み取り専用）  
**対象シート**: 選択肢マスタ（CONFIG.SHEETS.SETTINGS）  
**書き込み系 grep**: 0件 ✓

### 為替（選択肢マスタ col 26）

先頭30行サンプル（`totalRows: 44`・`sampled: 30`）:

```
JPY, USD, EUR, AUD, GBP, (空)×25
```

**判定**: 値が ISO 4217 通貨コード（JPY/USD/EUR/AUD/GBP）のみ → `currency` を採用。

### ページ（選択肢マスタ col 29）

先頭30行サンプル（`totalRows: 44`・`sampled: 30`）:

```
共通, リード, 新規, ルート, (空)×26
```

**判定**: 値が画面ページ名（共通/リード/新規/ルート）→ 値をそのまま報告。英語名は PO が決める（【要PO確定】継続）。

---

## 11. Buddy 廃止に伴う除外候補

**背景**: Buddy 機能は廃止決定（PO、2026-08-30）。以下は事実の記録のみ。除外の可否は PO が判断する。

**Buddy ファイルリスト（タスク定義）**: `05_BuddyCoachingService.js` / `06_BuddyFeedbackService.js` / `30_BuddyReportService.js` / `13_DealReportService.js` / `21_SetupDealReport.js` / `22_SetupIntegratedSheet.js` / `23_SheetService.js`

> **注**: `22_SetupIntegratedSheet.js` と `23_SheetService.js` は Buddy専用ファイルではなく、リード管理シート全体の初期化を行う汎用ファイル。以下の列に対する参照（行番号を明記）はリード管理シートの初期化コードであり、Buddy機能専用の処理ではない。

### リード管理

| 列名 | 参照元ファイル（行番号） | 判定 | 参照数(src+fe) |
|------|------------------------|------|---------------|
| Good Point | `22_SetupIntegratedSheet.js` L64,L284,L541 / `23_SheetService.js` L707 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| More Point | `22_SetupIntegratedSheet.js` L65,L285,L542 / `23_SheetService.js` L708 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| 反省と今後の抱負 | `22_SetupIntegratedSheet.js` L66,L286,L543 / `23_SheetService.js` L709 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| レポート提出日 | `22_SetupIntegratedSheet.js` L67,L287,L544 / `23_SheetService.js` L710 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| レポート確認者 | `22_SetupIntegratedSheet.js` L68,L288,L545 / `23_SheetService.js` L711 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| レポート確認日 | `22_SetupIntegratedSheet.js` L69,L289,L546 / `23_SheetService.js` L712 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| レポートコメント | `22_SetupIntegratedSheet.js` L70,L290,L547 / `23_SheetService.js` L713 | Buddy専用（当該箇所はリード管理シート初期化コード） | 0 |
| Buddyフィードバック | `30_BuddyReportService.js` L25,40,86,275,422,426,474 / `06_BuddyFeedbackService.js` / `13_DealReportService.js` L60,77,84,426,472 / `22_SetupIntegratedSheet.js` L75,295,552,707,770 / `23_SheetService.js` L718 / **`20_ReportService.js` L146,164,317** / **`08_Config.js` L341,345** | **他機能も使用**（`20_ReportService.js`=週次・月次レポートサービス、`08_Config.js`=設定ファイルから参照） | 8+0 |
| 1回の発注金額 | `21_SetupDealReport.js` L134 / `13_DealReportService.js` L47,413,469 / `06_BuddyFeedbackService.js` L75 / `22_SetupIntegratedSheet.js` L52,272,529 / `23_SheetService.js` L695 / **`src/index.html` L10390,L11337** | **他機能も使用**（`src/index.html` = チャットリードフォーム・一般CRM UIから参照） | 17+0 |
| 商談の手応え | `21_SetupDealReport.js` L138 / `13_DealReportService.js` L51,417,470 / `06_BuddyFeedbackService.js` L78 / `22_SetupIntegratedSheet.js` L55,104,275,532 / `23_SheetService.js` L698 / **`src/index.html` L6291,6324,14124,14125** / **`99_StaffMasterDump.js` L219** | **他機能も使用**（`src/index.html` = 顧客一覧テーブル・営業フォーム、`99_StaffMasterDump.js` = 診断スクリプトから参照） | 17+0 |

### 担当者マスタ

| 列名 | 参照元ファイル（行番号） | 判定 | 参照数(src+fe) |
|------|------------------------|------|---------------|
| Buddyメンテナンスメニュー表示 | **`00_CoreSchemaRegistry.js` L167** / **`32_StaffService.js` L482,570,585,600** / **`src/index.html` L14698,16313,16339** | **他機能も使用**（`32_StaffService.js`=担当者サービス全般、`src/index.html`=スタッフ設定UI、いずれもBuddyファイルリスト外） | 8+0 |

### 集計

| 判定 | 列数 | 対象列 |
|------|------|--------|
| Buddy専用（当該参照がBuddyファイルのみ） | 7列 | Good Point / More Point / 反省と今後の抱負 / レポート提出日 / レポート確認者 / レポート確認日 / レポートコメント |
| 他機能も使用 | 4列 | Buddyフィードバック / 1回の発注金額 / 商談の手応え / Buddyメンテナンスメニュー表示 |
| 未参照 | 0列 | — |

> **注**: 上記「Buddy専用」の7列の参照元（`22_SetupIntegratedSheet.js` と `23_SheetService.js`）はBuddyファイルリストに含まれるが、コード確認済み（行番号明記）のとおり当該箇所はリード管理シート汎用初期化コードであり、Buddy機能専用の処理ではない。

---

## 12. 未参照列の再確認結果

**調査日**: 2026-08-30  
**調査コマンド**:

```bash
grep -rn "リードシーン|eLogiCSV格納フォルダ|ラベルPDF格納フォルダ" src/ frontend/src/
# 結果: 0件
```

| 列名 | シート | src/ 件数 | frontend/src/ 件数 | 判定 |
|------|-------|----------|-------------------|------|
| リードシーン | 選択肢マスタ | 0 | 0 | **未参照**（用途は PO 確認要） |
| eLogiCSV格納フォルダ | 選択肢マスタ | 0 | 0 | **未参照** |
| ラベルPDF格納フォルダ | 選択肢マスタ | 0 | 0 | **未参照** |

> 「未参照だから削除してよい」とは書かない。除外の可否は PO が判断する。

---

## 13. PO 判断が必要な項目（更新版）

| # | 項目 | 内容 |
|---|------|------|
| 1 | 1回の発注金額 | 候補: `per_order_amount` / `single_order_amount`。`src/index.html`（チャットUI）から参照あり（他機能も使用） |
| 2 | 商談の手応え | 候補: `deal_impression` / `deal_confidence` / `deal_response`。`src/index.html`（顧客一覧・営業フォーム）から参照あり（他機能も使用） |
| 3 | 反省と今後の抱負 | 候補: `reflection_and_aspiration` / `retrospective_note`。参照: `22_SetupIntegratedSheet.js` L66 / `23_SheetService.js` L709 のみ（Buddy専用と判定） |
| 4 | ページ（選択肢マスタ） | 実データ: 共通/リード/新規/ルート（4件）。英語名は PO が決める |
| 5 | Buddy専用列（7列）を移行対象から外すか | Good Point / More Point / 反省と今後の抱負 / レポート提出日 / レポート確認者 / レポート確認日 / レポートコメント（各列の参照元は Section 11 参照） |
| 6 | 未参照列（3列）を移行対象から外すか | リードシーン / eLogiCSV格納フォルダ / ラベルPDF格納フォルダ |
| 7 | 他機能も使用の4列（Buddyフィードバック・1回の発注金額・商談の手応え・Buddyメンテナンスメニュー表示）の扱い | Buddy廃止後も他機能から参照されているため、除外前に当該機能の対応が必要 |

---

*シートの列名変更・src/ の変更は行っていない。本文書は変換案の提示のみ。*
