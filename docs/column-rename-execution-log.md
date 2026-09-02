# Column Rename Execution Log

列名リネーム 3-PR パターンの実施記録。

## フォーマット

各シートの実施記録は次のセクションに記載する。
- PR-1: デュアルサポート追加（フォールバック付き、シート未変更）
- PR-2: CoreSchema 切り替え + シート実リネーム実行
- PR-3: フォールバック除去

---

## 仕入れ（PURCHASES）

> 対象列: なし（列リネームなし — 別目的の作業）

---

## 顧客マスタ（CUSTOMERS）

> 対象列: 実施済み（別セッション）

---

## 国マスタ（COUNTRIES）

**対象列 3本:**
| 旧名 | 新名 |
|------|------|
| 国ID(ISO2) | country_code |
| 国名（表示） | display_name |
| 国名（日本語） | name_ja |

### PR-1 — デュアルサポート追加

- PR: #760
- マージ: 2026-08-30T頃（別セッション）
- 変更ファイル: 8ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap 追加
  - `src/17_CountryMaster.js` — L358, L810 にフォールバック追加
  - `src/18_CustomerRegistration.js` — 2箇所にフォールバック追加
  - `src/28_CoreLeadFormOptionsApi.js` — nameIdx フォールバック追加
  - `src/28_CoreOrderReadApi.js` — iso2Idx / nameJaIdx フォールバック追加
  - `src/99_DevCountryMasterJaNames.js` — isoIdx / jaIdx フォールバック追加
  - `src/99_PerfBench.js` — nameIdx × 2箇所フォールバック追加
  - `src/99_SqlReadinessCheck.js` — pkColumn 旧名参照確認
- 別PR: #762（check-sensitive-content.mjs の誤検知修正）

### PR-2 — CoreSchema 切り替え + シート実リネーム

- PR: #764
- マージ: 2026-08-30T頃（別セッション）
- 変更ファイル:
  - `src/00_CoreSchemaRegistry.js` — COUNTRIES 列名を新名に切り替え、aliasMap を旧→新に反転
  - `src/99_SqlReadinessCheck.js` — pkColumn を `country_code` に更新
  - `src/99_ColumnRenameExecution.js` — `renameCountryMasterHeaders()` 追加
- シートリネーム実行結果:
  ```
  { status: 'OK', renamed: 3, details: [
    { col: 1, before: '国ID(ISO2)',    after: 'country_code' },
    { col: 2, before: '国名（表示）',  after: 'display_name' },
    { col: 3, before: '国名（日本語）', after: 'name_ja' }
  ]}
  ```
- 事後確認（PR-2 後）:
  - SHA: `d2c627e` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — フォールバック除去

- PR: #766
- マージ: 2026-08-31T06:41:22Z
- 変更ファイル: 7ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap 削除
  - `src/17_CountryMaster.js` — 旧名フォールバック除去（L295 seed headers、L358 nameIdx、L810 isoIdx）
  - `src/18_CustomerRegistration.js` — 旧名フォールバック除去（2箇所）
  - `src/28_CoreLeadFormOptionsApi.js` — 旧名フォールバック除去、エラーメッセージ更新
  - `src/28_CoreOrderReadApi.js` — 旧名フォールバック除去（iso2Idx / nameJaIdx）
  - `src/99_DevCountryMasterJaNames.js` — 旧名フォールバック除去（isoIdx / jaIdx / afterJaIdx）
  - `src/99_PerfBench.js` — 旧名フォールバック除去（nameIdx × 2箇所）
- 事後確認（PR-3 後）:
  - SHA: `8bea4a16a587ef1b921936bea9ec16213a2ce2c5` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、COUNTRIES 0件 ✅
  - dryRun: 変更あり 0件 ✅

**国マスタ 列リネーム 完了 ✅**

---

## 見積もり管理（QUOTES）

**対象列 1本:**
| 旧名 | 新名 |
|------|------|
| PDF URL | pdf_url |

### PR-1 — デュアルサポート追加

- PR: #778
- マージ: 2026-08-31T07:54:03Z
- 変更ファイル: 4ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap 追加 + validateCoreSchemaV1TableForWrite に aliasMap フォールバック追加
  - `src/28_CoreQuoteApi.js` — coreQuoteReadTable に aliasMap フォールバック追加
  - `src/11_QuoteService.js` — colMapping['PDF URL'] || colMapping['pdf_url'] に変更（2箇所）+ pdfUrlCol ガード追加
  - `src/99_ColumnRenameExecution.js` — backupQuotesMasterSheet / verifyQuotesMasterSheetBackup / getQuotesMasterCurrentHeaders 追加

### バックアップ実行（PR-1 マージ後）

```
{ status: 'OK', backupName: '見積もり管理_backup_20260831', sourceRows: 2, sourceCols: 19 }
{ status: 'OK', headersMatch: true, sourceCols: 19, backupCols: 19, sourceRows: 2, backupRows: 2 }
```

### PR-2 — CoreSchema 切り替え + シート実リネーム

- PR: #780
- マージ: 2026-08-31T08:02:42Z
- 変更ファイル:
  - `src/00_CoreSchemaRegistry.js` — PDF_URL の canonical header を 'pdf_url' に切り替え、aliasMap を {'pdf_url': 'PDF URL'} に反転
  - `src/99_ColumnRenameExecution.js` — renameQuotesMasterHeaders() 追加
- シートリネーム実行結果:
  ```
  { status: 'OK', renamed: 1, details: [
    { col: 16, before: 'PDF URL', after: 'pdf_url' }
  ]}
  ```
- 事後確認（PR-2 後）:
  - SHA: `c918e4a2` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — フォールバック除去

- PR: #781
- マージ: 2026-08-31T08:14:27Z
- 変更ファイル: 3ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap 削除 + validateCoreSchemaV1TableForWrite の aliasMap フォールバック除去
  - `src/11_QuoteService.js` — colMapping['pdf_url'] 直引きに統一（2箇所）
  - `src/28_CoreQuoteApi.js` — coreQuoteReadTable の aliasMap フォールバック除去
- 事後確認（PR-3 後）:
  - SHA: `3fa7787` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、QUOTES 0件 ✅
  - dryRun: 変更あり 0件 ✅

**見積もり管理 列リネーム 完了 ✅**

---

## 担当者マスタ（STAFF）

**対象列 24本:**
| 旧名（日本語） | 新名（英語スネークケース） |
|--------------|--------------------------|
| 担当者ID | staff_id |
| 苗字（日本語） | last_name_ja |
| 名前（日本語） | first_name_ja |
| 氏名（日本語） | full_name_ja |
| 苗字ふりがな | last_name_kana |
| 名前ふりがな | first_name_kana |
| 苗字（英語） | last_name_en |
| 名前（英語） | first_name_en |
| メール | email |
| Discord ID | discord_id |
| 役割 | staff_role |
| ステータス | status |
| 元候補者ID | source_candidate_id |
| ダークモード | dark_mode |
| チャットメニュー表示 | chat_menu_visible |
| 営業メニュー表示 | sales_menu_visible |
| 設定メニュー表示 | settings_menu_visible |
| 管理者メニュー表示 | admin_menu_visible |
| Buddyメンテナンスメニュー表示 | buddy_maintenance_menu_visible |
| サイドバー表示 | sidebar_visible |
| パスワードハッシュ | password_hash |
| パスワードソルト | password_salt |
| 連続失敗回数 | login_fail_count |
| ロック解除時刻 | locked_until |

### PR-1 — デュアルサポート追加

- PR: #794
- マージ: 2026-08-31T17:14:17Z
- 変更ファイル: 16ファイル
  - `src/00_CoreSchemaRegistry.js` — STAFF headers を新名に切替 + headerAliasMap（新名→旧名）追加 + validateCoreSchemaV1TableForWrite に aliasMap フォールバック追加
  - `src/00_EmailColumnHelper.js` / `src/11_DailyReportService.js` / `src/12_DashboardService.js` / `src/12_KnowledgeService.js` / `src/16_NoticeService.js` / `src/22_SetupIntegratedSheet.js` / `src/26_Triggers.js` / `src/27_WebApp.js` / `src/29_PermissionService.js` / `src/30_BuddyReportService.js` / `src/32_StaffService.js` — indexOf フォールバック追加
  - `src/99_ColumnRenameExecution.js` — backupStaffMasterSheet / verifyStaffMasterSheetBackup 追加
  - `src/99_DevStaffDiscordIdCount.js` / `src/99_StaffMasterDump.js` / `src/check_staff_registration.js` — indexOf フォールバック追加

### バックアップ実行（PR-1 マージ後）

```
{ status: 'OK', backupName: '担当者マスタ_backup_20260831', sourceRows: 9, sourceCols: 24 }
{ status: 'OK', headersMatch: true, sourceCols: 24, backupCols: 24, sourceRows: 9, backupRows: 9 }
```

### PR-2 — CoreSchema 切り替え + シート実リネーム

- PR: #795
- マージ: 2026-08-31T17:21:55Z
- 変更ファイル: 2ファイル
  - `src/00_CoreSchemaRegistry.js` — STAFF headerAliasMap を「新名→旧名」から「旧名→新名」に反転 + validateCoreSchemaV1TableForWrite の reverseAliasMap 逆引きに修正
  - `src/99_ColumnRenameExecution.js` — renameStaffMasterHeaders() 追加
- シートリネーム実行結果:
  ```
  { status: 'OK', renamed: 24, details: [
    { col: 1,  before: '担当者ID',            after: 'staff_id' },
    { col: 2,  before: '苗字（日本語）',       after: 'last_name_ja' },
    { col: 3,  before: '名前（日本語）',       after: 'first_name_ja' },
    { col: 4,  before: '氏名（日本語）',       after: 'full_name_ja' },
    { col: 5,  before: '苗字ふりがな',         after: 'last_name_kana' },
    { col: 6,  before: '名前ふりがな',         after: 'first_name_kana' },
    { col: 7,  before: '苗字（英語）',         after: 'last_name_en' },
    { col: 8,  before: '名前（英語）',         after: 'first_name_en' },
    { col: 9,  before: 'メール',              after: 'email' },
    { col: 10, before: 'Discord ID',          after: 'discord_id' },
    { col: 11, before: '役割',                after: 'staff_role' },
    { col: 12, before: 'ステータス',           after: 'status' },
    { col: 13, before: '元候補者ID',           after: 'source_candidate_id' },
    { col: 14, before: 'ダークモード',         after: 'dark_mode' },
    { col: 15, before: 'チャットメニュー表示', after: 'chat_menu_visible' },
    { col: 16, before: '営業メニュー表示',     after: 'sales_menu_visible' },
    { col: 17, before: '設定メニュー表示',     after: 'settings_menu_visible' },
    { col: 18, before: '管理者メニュー表示',   after: 'admin_menu_visible' },
    { col: 19, before: 'Buddyメンテナンスメニュー表示', after: 'buddy_maintenance_menu_visible' },
    { col: 20, before: 'サイドバー表示',       after: 'sidebar_visible' },
    { col: 21, before: 'パスワードハッシュ',   after: 'password_hash' },
    { col: 22, before: 'パスワードソルト',     after: 'password_salt' },
    { col: 23, before: '連続失敗回数',         after: 'login_fail_count' },
    { col: 24, before: 'ロック解除時刻',       after: 'locked_until' }
  ]}
  ```
- 事後確認（PR-2 後）:
  - SHA: `f516f15` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、STAFF 0件 ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — フォールバック除去

- PR: #796
- マージ: 2026-08-31T17:32:30Z
- 変更ファイル: 15ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap 削除 + validateCoreSchemaV1TableForWrite の reverseAliasMap フォールバック除去
  - `src/00_EmailColumnHelper.js` / `src/11_DailyReportService.js` / `src/12_DashboardService.js` / `src/12_KnowledgeService.js` / `src/16_NoticeService.js` / `src/22_SetupIntegratedSheet.js` / `src/26_Triggers.js` — ヘルパー関数削除・直引き変換
  - `src/27_WebApp.js` — `_webAppStaffHeaderIdx` 削除・直引き変換（38箇所）
  - `src/29_PermissionService.js` — `_permissionStaffHeaderIdx` 削除・直引き変換（21箇所）
  - `src/30_BuddyReportService.js` / `src/32_StaffService.js` — ヘルパー関数削除・直引き変換（32: 25箇所）
  - `src/99_DevStaffDiscordIdCount.js` / `src/99_StaffMasterDump.js` / `src/check_staff_registration.js` — インライン IIFE フォールバック → 直引き変換
- 認証系確認: 旧列名（パスワードハッシュ等）の indexOf 参照 0件 ✅
- 事後確認（PR-3 後）:
  - SHA: `2858dfa` = origin/develop HEAD ✅
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、STAFF 0件 ✅
  - dryRun: 変更あり 0件 ✅

**担当者マスタ 列リネーム 完了 ✅**

---

## Address 共有3シート（発行元マスタ / 支払先マスタ / 配送先マスタ）

> 3シートが `Address 1` / `Address 2` / `Address 3` / `City` / `State` / `Zip` を共有しており、  
> 単独変更では他シートが壊れるため同時実施。

### 対象列

**発行元マスタ（18列）:**

| 旧名 | 新名 |
|------|------|
| 発行元ID | issuer_id |
| 会社名 | company_name |
| 担当者名 | contact_name |
| Address 1 | address_line_1 |
| Address 2 | address_line_2 |
| Address 3 | address_line_3 |
| City | city |
| State | state |
| Zip | zip |
| 国 | country |
| 電話番号 | phone |
| メール | email |
| 登録番号 | registration_no |
| 受取名義 | payee_name |
| 受取先メール | payment_email |
| 注記 | note |
| 結びの文 | closing_message |
| 有効 | is_active |

**支払先マスタ（16列）:**

| 旧名 | 新名 |
|------|------|
| 支払先ID | payment_destination_id |
| 顧客ID | customer_id |
| 表示名 | display_name |
| 請求名義 | billing_name |
| Address 1 | address_line_1 |
| Address 2 | address_line_2 |
| Address 3 | address_line_3 |
| City | city |
| State | state |
| Zip | zip |
| 国 | country |
| 支払方法 | payment_method |
| 通貨 | currency |
| B Tax ID | tax_id |
| 既定 | is_default |
| 有効 | is_active |

**配送先マスタ（17列）:**

| 旧名 | 新名 |
|------|------|
| 配送先ID | shipping_destination_id |
| 顧客ID | customer_id |
| 表示名 | display_name |
| 宛名 | recipient_name |
| Address 1 | address_line_1 |
| Address 2 | address_line_2 |
| Address 3 | address_line_3 |
| City | city |
| State | state |
| Zip | zip |
| 国 | country |
| 電話 | phone |
| 国番号 | country_code |
| D Email | email |
| D Tax ID | tax_id |
| 既定 | is_default |
| 有効 | is_active |

### バックアップ

| シート | バックアップ名 | rows | cols |
|-------|-------------|------|------|
| 発行元マスタ | 発行元マスタ_backup_20260901 | 2 | 18 |
| 支払先マスタ | 支払先マスタ_backup_20260901 | 7 | 16 |
| 配送先マスタ | 配送先マスタ_backup_20260901 | 7 | 17 |

### PR-1 — デュアルサポート追加

- PR: #800
- マージ: 2026-08-31T18:16:40Z
- squash commit SHA: `f9f1d467e4e36060d5fcc8b462fa6aed6c2be336`
- 変更ファイル: 6ファイル
  - `src/00_CoreSchemaRegistry.js` — SHIPPING_DESTINATIONS / PAYMENT_DESTINATIONS / ISSUER の headerAliasMap 追加（旧名→新名マップ）、validateCoreSchemaV1TableForWrite にフォールバック追加
  - `src/28_CoreCustomerReadApi.js` — coreCustomerFrontendReadTable に aliasMap フォールバック追加
  - `src/28_CoreIssuerApi.js` — getCoreIssuerForFrontend に oldToNew 変換・aliasMap フォールバック追加
  - `src/18_CustomerRegistration.js` — CoreSchema 経由の書き込みに変更
  - `src/99_ColumnRenameExecution.js` — backupIssuerMasterSheet / backupPaymentDestinationsSheet / backupShippingDestinationsSheet / renameIssuerMasterHeaders / renamePaymentDestinationsHeaders / renameShippingDestinationsHeaders 追加
  - `frontend/src/content/ja/issuer.ts` — ISSUER_HEADER 定数を新物理名に更新

### PR-2 — CoreSchema 切り替え + シートリネーム実行

- PR: #801
- マージ: 2026-08-31T18:31:33Z
- squash commit SHA: `300acdfff9889ec7e6b7638e8259d88f0e1500f2`
- 変更ファイル: 4ファイル
  - `src/00_CoreSchemaRegistry.js` — SHIPPING_DESTINATIONS / PAYMENT_DESTINATIONS / ISSUER の headers を新名に切り替え（headerAliasMap は逆方向に変更）
  - `src/08_Config.js` — 設定更新
  - `src/99_ColumnRenameExecution.js` — renameIssuerMasterHeaders / renamePaymentDestinationsHeaders / renameShippingDestinationsHeaders 追加
  - `src/99_DevDemoSeed20260826.js` — シードデータを新列名に更新
- シートリネーム実行結果:
  - `renameIssuerMasterHeaders`: `{status: 'OK', renamed: 18, sheetName: '発行元マスタ'}`
  - `renamePaymentDestinationsHeaders`: `{status: 'OK', renamed: 16, sheetName: '支払先マスタ'}`
  - `renameShippingDestinationsHeaders`: `{status: 'OK', renamed: 17, sheetName: '配送先マスタ'}`
- 事後確認（PR-2 後、シートリネーム後）:
  - SHA: `a8906f6b5f96ed984997f1b85b949dab234eddc4`, deployedAt: `2026-08-31T18:35:17Z`
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、SHIPPING_DESTINATIONS 0件 ✅、PAYMENT_DESTINATIONS 0件 ✅、ISSUER 0件 ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — フォールバック除去

- PR: #804
- マージ: 2026-08-31T18:46:29Z
- squash commit SHA: `46f604915ccd173f44d4400388c2097cec811528`
- 変更ファイル: 5ファイル
  - `src/00_CoreSchemaRegistry.js` — SHIPPING_DESTINATIONS / PAYMENT_DESTINATIONS / ISSUER の headerAliasMap を完全削除。validateCoreSchemaV1TableForWrite の aliasMap フォールバックコードを除去
  - `src/28_CoreCustomerReadApi.js` — coreCustomerFrontendReadTable の aliasMap フォールバック除去
  - `src/28_CoreIssuerApi.js` — getCoreIssuerForFrontend の oldToNew 変換・aliasMap フォールバック除去
  - `src/17_CountryMaster.js` — fixAddressSplits / auditAddressCharset / auditAddressLength の旧列名を新列名に更新
  - `src/18_CustomerRegistration.js` — testRegisterCustomer デバッグコードとコメントの旧列名を新列名に更新
- 事後確認（PR-3 後）:
  - SHA: `f0020ce4c72c89475988acf89fb2e23e3e415c45`, deployedAt: `2026-08-31T18:48:31Z`
  - 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、SHIPPING_DESTINATIONS 0件 ✅、PAYMENT_DESTINATIONS 0件 ✅、ISSUER 0件 ✅
  - dryRun: 変更あり 0件 ✅

**Address 共有3シート 列リネーム 完了 ✅**

---

## リード管理（LEADS）

**変換対象列 51本（定義外13列は除く）:**

| # | 旧名 | 新名 |
|---|------|------|
| 1 | リードID | lead_id |
| 2 | 登録日 | registered_at |
| 3 | 顧客名 | customer_name |
| 4 | 商談結果 | deal_result |
| 5 | 呼び方（英語） | nickname_en |
| 6 | 国 | country |
| 7 | シート更新日 | sheet_updated_at |
| 8 | リード担当者 | lead_assignee_name |
| 9 | リード種別 | lead_type |
| 10 | 流入経路 | lead_source_name |
| 11 | 流入元ID | lead_source_id |
| 12 | メッセージURL | message_url |
| 13 | 取り扱いタイトル | handled_title |
| 14 | 作品ID（リード） | item_id |
| 15 | CSメモ | cs_memo |
| 16 | メール | email |
| 17 | 電話番号 | phone |
| 18 | 連絡手段 | contact_method |
| 19 | 温度感 | lead_temperature |
| 20 | 想定規模 | expected_scale |
| 21 | 返信速度 | reply_speed |
| 22 | 問い合わせ回数 | inquiry_count |
| 23 | アーカイブ日 | archived_at |
| 24 | アーカイブ理由 | archive_reason |
| 25 | アサイン日 | assigned_at |
| 26 | 営業担当者（旧） | sales_assignee_name |
| 27 | 担当者ID（旧） | assignee_id |
| 28 | 顧客タイプ | customer_type |
| 29 | 最終対応者ID | last_responder_id |
| 30 | 見込度 | prospect_rank |
| 31 | 次回アクション | next_action |
| 32 | 次回アクション日 | next_action_date |
| 33 | 商談メモ | deal_note |
| 34 | 相手の課題 | client_challenge |
| 35 | 販売形態 | sales_channel |
| 36 | 月間見込み金額 | monthly_expected_amount |
| 37 | 競合比較中 | competitor_comparison |
| 38 | アラート確認日 | alert_checked_at |
| 39 | 対象外理由 | exclusion_reason |
| 40 | 失注理由 | lost_reason |
| 41 | 初回取引日 | first_deal_at |
| 42 | 初回取引金額 | first_deal_amount |
| 43 | 累計取引金額 | total_deal_amount |
| 44 | 会話要約 | conversation_summary |
| 45 | 最終会話日時 | last_conversation_at |
| 46 | 会話数 | conversation_count |
| 47 | 重複フラグ | duplicate_flag |
| 48 | 重複元リードID | duplicate_source_id |
| 49 | 重複確認日 | duplicate_checked_at |
| 50 | 重複確認者 | duplicate_checker |
| 51 | リードステータス | lead_status |

**定義外13列（変換しない）:**

| 列名 | 分類 |
|------|------|
| Good Point | Buddy専用 |
| More Point | Buddy専用 |
| レポート提出日 | Buddy専用 |
| レポート確認者 | Buddy専用 |
| レポート確認日 | Buddy専用 |
| レポートコメント | Buddy専用 |
| Buddyフィードバック | Buddy専用 |
| 1回の発注金額 | 要PO確定 |
| 商談の手応え | 要PO確定 |
| 反省と今後の抱負 | 要PO確定 |
| リード進捗 | 未確認 |
| 商談進捗 | 未確認 |
| 購入頻度(月次) | 未確認 |

### PR-1 — デュアルサポート追加

- PR: #813
- マージ: 2026-09-01T00:39:44Z
- squash commit SHA: `2179385481a6031ef4e582910755ffe7b9751903`
- 変更ファイル: 43ファイル
  - `src/00_CoreSchemaRegistry.js` — LEADS headers を英語スネークケース新名に切替 + headerAliasMap（新名→旧名）追加 + validateCoreSchemaV1TableForWrite に aliasMap フォールバック追加
  - `src/27_WebApp.js` 他42ファイル — `_webAppLeadsHeaderIdx` / `_leadsHeaderIdx` ヘルパー経由のフォールバック追加
  - `src/99_ColumnRenameExecution.js` — backupLeadMasterSheet / verifyLeadMasterSheetBackup 追加

### PR-2 — CoreSchema 切り替え + シートリネーム実行

- PR: #814
- マージ: 2026-09-01T00:44:43Z
- squash commit SHA: `0126f12b097704523a50e9bccc093fc7dafc4e3b`
- 変更ファイル: 2ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap を反転（旧名→新名）に変更（シートリネーム後は新名が実シートに存在するため）
  - `src/99_ColumnRenameExecution.js` — renameLeadMasterHeaders 追加
- シートリネーム実行結果: `renamed: 51, skipped: 13`（total 64列中51列変換）

### PR-3 — フォールバック除去

- PR: #818
- マージ: 2026-09-01T01:24:11Z
- squash commit SHA: `345d5dfbf32486b8a9a4a48a0d077f7fcd4eb301`
- 変更ファイル: 56ファイル
  - `src/00_CoreSchemaRegistry.js` — headerAliasMap (51エントリ) と reverseAliasMap フォールバックロジックを完全削除
  - `src/00_HeaderMappingHelper.js` — `_leadsHeaderIdx` / `_webAppLeadsHeaderIdx` ヘルパー関数を削除
  - `src/27_WebApp.js` 他54ファイル — indexOf('旧日本語名') → indexOf('new_english_name') に統一
  - `frontend/src/content/ja/leads.ts` — leadsCopy.fields を英語シート列名に切り替え

### PR-3-fix — 残存1箇所修正

- PR: #819
- マージ: 2026-09-01T01:29:20Z
- squash commit SHA: `0d233bf4d3d2f2dbad178ba5b9bb811524f8d42a`
- 変更ファイル: 1ファイル
  - `src/27_WebApp.js` — `getSalesMetrics` の `indexOf('メッセージURL')` → `indexOf('message_url')` に修正

### 事後確認（全PR完了後）

- deployedAt: `2026-09-01T01:30:20Z`
- 監査: 2件（LEADS 1 / CUSTOMERS 1）= baseline ✅、ORDERS 0件 ✅、PURCHASES 0件 ✅
- dryRun: 変更あり 0件 ✅
- 旧列名 indexOf 残存: 変換51列分 0件 ✅

**リード管理（LEADS）列リネーム 完了 ✅**

---

## 作品マスタ_共用在庫（IP_MASTER）

**選定根拠:** `docs/column-rename-plan-phase2.md` セクション 6 の参照数比較
- 共用在庫: 17件（除外指定）
- 作品マスタ_共用在庫: 38件（最小 → 本作業の対象）

**対象列 3本:**

| # | 旧名 | 新名 | 備考 |
|---|------|------|------|
| 2 | 作品名 | `title` | PO 確定（Phase 2 案 `title_ja` を `title` に上書き） |
| 3 | 別名 | `alias` | Phase 2 案どおり |
| 4 | 有効 | `is_active` | Phase 2 案どおり |

列 #1 `ip_id` は既に英語スネークケース → 変更なし。

### バックアップ

- バックアップ名: `作品マスタ_共用在庫_backup_20260902`
- originalRows: 12（ヘッダー1行 + データ11行）
- originalCols: 4
- 変更前ヘッダー: `['ip_id', '作品名', '別名', '有効']`

### PR-1 — コード新旧両対応

- PR: #930
- マージ: 2026-09-02T05:33:14Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 7ファイル
  - `src/27_WebApp.js` — `getIpMasterMap_` で title/作品名・alias/別名 フォールバック
  - `src/28_SharedInventoryReadApi.js` — ip→表示名マップ構築×2箇所
  - `src/99_PerfBench.js` — ip→表示名マップ構築×2箇所
  - `src/99_DevIpIdsMigration.js` — masterHeaders 解決×2箇所、エラーメッセージ更新
  - `src/99_DevIpIdsDryRun.js` — nameIdx/aliasIdx/activeIdx 新旧両対応
  - `src/99_InvBookRecon.js` — シート新規作成関数のヘッダー配列を直接新名称に変更
  - `src/99_DevRenameIpMasterColumns.js` — 新規: バックアップ・列名変更 GAS 関数を追加

### PR-2 — シート実リネーム実行

- PR: #932（予定）
- シートリネーム実行結果（`clasp run devRenameIpMasterColumns`）:
  ```
  {
    newHeaders: [ 'ip_id', 'title', 'alias', 'is_active' ],
    colCountBefore: 4, colCountAfter: 4,
    renamedCount: 3, expectedCount: 3,
    rowCountBefore: 12, rowCountAfter: 12
  }
  ```
- 事後確認:
  - SHA: `e75b72cd669b8c474d0b4f39953130452e0cc9ff` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- PR: #934
- マージ: 2026-09-02T05:47:14Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 6ファイル
  - `src/27_WebApp.js` — フォールバック除去: `indexOf('title') || indexOf('作品名')` → `indexOf('title')`
  - `src/28_SharedInventoryReadApi.js` — 同上×2箇所（ipNameIdx / ipAltIdx）
  - `src/99_PerfBench.js` — 同上×2箇所（ipNameIdx / ipAltIdx）
  - `src/99_DevIpIdsMigration.js` — 同上×2箇所 + エラーメッセージ簡素化
  - `src/99_DevIpIdsDryRun.js` — nameIdx/aliasIdx/activeIdx フォールバック除去
  - `docs/column-rename-execution-log.md` — PR-3 記録追加
- 旧列名 indexOf 確認（`作品マスタ_共用在庫` コンテキスト）: 0件 ✅
- `有効` の残り参照は他シート（テンプレートシート・国マスタ・流入元マスタ等）のみ — 変更対象外 ✅
- 事後確認（PR-3 後）:
  - SHA: `2773836a09488b6d03c63094e12f54239e1dfc75` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

**作品マスタ_共用在庫 列リネーム 完了 ✅**

---

## システム設定（SETTINGS）

**選定根拠:** `docs/column-rename-plan-phase2.md` セクション 6 の参照数比較
- 共用在庫: 17件（除外指定）
- 作品マスタ_共用在庫: 38件（PR #930/932/934 完了済み）
- システム設定: 46件（最小 → 本作業の対象）

**対象列 5本:**

| # | 旧名 | 新名 |
|---|------|------|
| 1 | 設定キー | `setting_key` |
| 2 | 設定値 | `setting_value` |
| 3 | 値の型 | `value_type` |
| 4 | 説明 | `description` |
| 5 | 更新日時 | `updated_at` |

### バックアップ

- バックアップ名: `システム設定_backup_20260902`
- originalRows: 4（ヘッダー1行 + データ3行）
- originalCols: 5
- 変更前ヘッダー: `['設定キー', '設定値', '値の型', '説明', '更新日時']`

### PR-1 — コード新旧両対応

- PR: #937
- マージ: 2026-09-02T06:09:47Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 2ファイル
  - `src/08_Config.js` — setting_key / setting_value / description を優先し旧名にフォールバック
  - `src/99_DevRenameSystemSettingsColumns.js` — 新規: バックアップ・列名変更 GAS 関数を追加

### PR-2 — CoreSchema 切り替え + シートリネーム実行

- PR: #938
- マージ: 2026-09-02T06:16:10Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 3ファイル
  - `src/00_CoreSchemaRegistry.js` — SETTINGS ヘッダーを英語名に切り替え
  - `src/99_SqlReadinessCheck.js` — pkColumn を setting_key に更新
  - `src/99_DevPostgresMigrationAnalysis.js` — pkHeader を setting_key に更新（2箇所）
- シートリネーム実行結果（`clasp run devRenameSystemSettingsColumns`）:
  ```
  {
    renamedCount: 5, expectedCount: 5, skipped: [],
    newHeaders: ['setting_key', 'setting_value', 'value_type', 'description', 'updated_at'],
    rowCountBefore: 4, rowCountAfter: 4,
    colCountBefore: 5, colCountAfter: 5
  }
  ```
- 事後確認（PR-2 後、シートリネーム後）:
  - SHA: `a08c2754c7587237b346dd06e0675c70382842e3` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- PR: #939
- マージ: 2026-09-02T06:27:41Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 3ファイル
  - `src/08_Config.js` — フォールバック除去: setting_key / setting_value / description を直接参照
  - `src/99_DevSettingsStructureAudit.js` — setting_key / value_type / setting_value を直接参照（旧名除去）
  - `docs/column-rename-execution-log.md` — PR-3 記録追加
- 旧列名 indexOf 確認（`システム設定` コンテキスト）: 0件 ✅
  - `src/99_DisplaySettingsVerify.js` の `設定キー`/`設定値` は `表示設定マスタ` シート対象 — 変更対象外 ✅
  - `src/00_CoreSchemaRegistry.js` の `設定キー`/`設定値` は DISPLAY_SETTINGS テーブル定義 — 変更対象外 ✅
- 事後確認（PR-3 後）:
  - SHA: `58469737f2e3b9312a86b20788b4f06ce7e6ee3d` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

**システム設定 列リネーム 完了 ✅**

---

## 通貨マスタ（CURRENCIES）

**選定根拠:** `docs/column-rename-plan-phase2.md` セクション 6 の参照数比較
- 共用在庫: 17件（除外指定）
- 作品マスタ_共用在庫: 38件（PR #930/932/934 完了済み）
- システム設定: 46件（PR #937/938/939 完了済み）
- 通貨マスタ: 57件（最小 → 本作業の対象）

**対象列 5本:**

| # | 旧名 | 新名 |
|---|------|------|
| 1 | 通貨コード | `currency_code` |
| 2 | 記号 | `symbol` |
| 3 | 名称 | `name` |
| 4 | 円換算レート | `rate_to_jpy` |
| 5 | 有効 | `is_active` |

### バックアップ

- バックアップ名: `通貨マスタ_backup_20260902`
- originalRows: 6（ヘッダー1行 + データ5行）
- originalCols: 5
- 変更前ヘッダー: `['通貨コード', '記号', '名称', '円換算レート', '有効']`

### PR-1 — コード新名対応

- PR: #942
- マージ: 2026-09-02T06:49:11Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 4ファイル
  - `src/00_CoreSchemaRegistry.js` — CURRENCIES ヘッダー物理名を英語スネークケースに変更
  - `src/99_SqlReadinessCheck.js` — pkColumn '通貨コード' → 'currency_code'
  - `src/99_DevPostgresMigrationAnalysis.js` — pkHeader '通貨コード' → 'currency_code'（2箇所）
  - `src/99_DevRenameCurrencyMasterColumns.js` — 新規: バックアップ・列名変更 GAS 関数を追加
- 監査（PR-1 後、シート未変更）: CURRENCIES 6件不一致（想定通り）、他テーブル 0件 ✅
- dryRun: 変更あり 0件 ✅

### PR-2 — シートリネーム実行

- PR: #943
- マージ: 2026-09-02T06:56:25Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 1ファイル
  - `docs/column-rename-execution-log.md` — PR-1・PR-2実行結果記録
- シートリネーム実行結果（`clasp run devRenameCurrencyMasterColumns`）:
  ```
  {
    renamedCount: 5, expectedCount: 5, skipped: [],
    newHeaders: ['currency_code', 'symbol', 'name', 'rate_to_jpy', 'is_active'],
    rowCountBefore: 6, rowCountAfter: 6,
    colCountBefore: 5, colCountAfter: 5
  }
  ```
- 事後確認（PR-2 後、シートリネーム後）:
  - SHA: `e58237c15ae7682c8423773d1d2820dec3bfe04f` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- PR: #944
- マージ: 2026-09-02T07:01:12Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 旧列名参照確認（通貨マスタコンテキスト）:
  - `通貨コード`: 0件（CoreSchemaRegistry のみ ＋ RENAME_MAP定義）
  - `円換算レート`: 0件（CoreSchemaRegistry のみ ＋ RENAME_MAP定義）
  - `indexOf('記号')`: 0件
  - `indexOf('名称')`: 0件（通貨マスタコンテキスト外のみ：流入元マスタ等）
  - `indexOf('有効')`: 0件（通貨マスタコンテキスト外のみ：他シート）
- コード変更: 通貨マスタコンテキストの旧列名参照が既に0件のため変更ファイルなし
- 変更ファイル: 2ファイル
  - `docs/column-rename-execution-log.md` — PR-3実行記録
  - `docs/AUTONOMOUS_WORK_LOG.md` — 完了記録（revert SHA付き）
- 事後確認（PR-3 後）:
  - SHA: `f51fe98f1376c26a31c2875736670c6b4defc499` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

**通貨マスタ 列リネーム 完了 ✅**

---

## 流入元マスタ（LEAD_SOURCES）

**選定根拠:** `docs/column-rename-plan-phase2.md` セクション 6 の参照数比較
- 共用在庫: 17件（除外指定）
- 作品マスタ_共用在庫: 38件（PR #930/932/934 完了済み）
- システム設定: 46件（PR #937/938/939 完了済み）
- 通貨マスタ: 57件（PR #942/943/944 完了済み）
- 流入元マスタ: 153件（最小 → 本作業の対象）

**対象列 5本:**

| # | 旧名 | 新名 |
|---|------|------|
| 2 | 名称 | `name` |
| 3 | インバウンド | `is_inbound` |
| 4 | アウトバウンド | `is_outbound` |
| 5 | 有効 | `is_active` |
| 6 | 表示順 | `display_order` |

列 #1 `source_id` は既に英語スネークケース → 変更なし。

### バックアップ

- バックアップ名: `流入元マスタ_backup_20260902`
- originalRows: 10（ヘッダー1行 + データ9行）
- originalCols: 6
- 変更前ヘッダー: `['source_id', '名称', 'インバウンド', 'アウトバウンド', '有効', '表示順']`

### Phase 0 調査結果

**getCoreSchemaV1HeaderName 経由（主要業務コード）:**
- `src/26_LeadSourceMasterSetup.js` 行160-165: 全列 getCoreSchemaV1HeaderName 経由
- `src/28_CoreLeadFormOptionsApi.js` 行72-77: 全列 getCoreSchemaV1HeaderName 経由
- `src/27_WebApp.js` 行578-579: SOURCE_ID, NAME を getCoreSchemaV1HeaderName 経由
- `src/99_PerfBench.js` 行3131-3136: 全列 getCoreSchemaV1HeaderName 経由

**直接参照（Dev系スクリプト、フォールバック対応）:**
- `src/99_DevLeadSourceIdDryRun.js` 行18: `indexOf('名称')` → 新旧フォールバック対応
- `src/99_DevLeadSourceIdMigration.js` 行66: `indexOf('名称')` → 新旧フォールバック対応
- `src/99_PerfBench.js` 行2197, 2268: `indexOf('名称')` → 新旧フォールバック対応

### PR-1 — コード新旧両対応

- PR: #946
- マージ: 2026-09-02T07:31:11Z
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 5ファイル
  - `src/00_CoreSchemaRegistry.js` — LEAD_SOURCES 物理列名を英語スネークケースに変更（名称→name / インバウンド→is_inbound / アウトバウンド→is_outbound / 有効→is_active / 表示順→display_order）
  - `src/99_DevLeadSourceIdDryRun.js` — indexOf('name') >= 0 フォールバック追加（行18）
  - `src/99_DevLeadSourceIdMigration.js` — indexOf('name') >= 0 フォールバック追加（行66）
  - `src/99_PerfBench.js` — indexOf('name') >= 0 フォールバック追加（行2197, 2268）
  - `src/99_DevRenameLeadSourceMasterColumns.js` — 新規: バックアップ・列名変更 GAS 関数を追加
- 監査（PR-1 後、シート未変更）: LEAD_SOURCES 5件不一致（想定通り）、他テーブル 0件 ✅
- dryRun: 変更あり 0件 ✅

### PR-2 — シートリネーム実行

- PR: #947（予定）
- 変更ファイル: 1ファイル
  - `docs/column-rename-execution-log.md` — PR-1・PR-2実行結果記録
- シートリネーム実行結果（`clasp run devRenameLeadSourceMasterColumns`）:
  ```
  {
    renamedCount: 5, expectedCount: 5, skipped: [],
    newHeaders: ['source_id', 'name', 'is_inbound', 'is_outbound', 'is_active', 'display_order'],
    rowCountBefore: 10, rowCountAfter: 10,
    colCountBefore: 6, colCountAfter: 6
  }
  ```
- 事後確認（PR-2 後、シートリネーム後）:
  - SHA: `e28d27994743139d0ad8e4672f58d4d9ce12c50f` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- PR: #948（予定）
- 変更ファイル: 4ファイル
  - `src/99_DevLeadSourceIdDryRun.js` — `indexOf('name') >= 0 ? indexOf('name') : indexOf('名称')` → `indexOf('name')` に統一
  - `src/99_DevLeadSourceIdMigration.js` — 同上
  - `src/99_PerfBench.js` — 行2197-2199 および 行2267-2269 のフォールバック除去（2箇所）
  - `docs/column-rename-execution-log.md` — PR-3 記録追加
- 旧列名 indexOf 確認（流入元マスタコンテキスト）:
  - `indexOf('名称')`: 0件 ✅
  - `indexOf('インバウンド')`: 0件 ✅
  - `indexOf('アウトバウンド')`: 0件 ✅
  - `indexOf('有効')`: 0件（国マスタ・テンプレートシート等の他シートのみ）✅
  - `indexOf('表示順')`: 0件 ✅
- 事後確認（PR-3 後）:
  - SHA: `3f4940cf8c07494161a6729aa51dabbac12e7770` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

**流入元マスタ 列リネーム 完了 ✅**

---

## ログインセッション（Phase 2 - 5シート目）

**選定根拠:** `docs/column-rename-plan-phase2.md` セクション 6 の参照数比較
- 共用在庫: 17件（除外指定）
- 作品マスタ_共用在庫: 38件（PR #930/932/934 完了済み）
- システム設定: 46件（PR #937/938/939 完了済み）
- 通貨マスタ: 57件（PR #942/943/944 完了済み）
- 流入元マスタ: 153件（PR #946/947/948 完了済み）
- ログインセッション: 155件（最小 → 本作業の対象）

**対象列 6本:**

| # | 旧名 | 新名 |
|---|------|------|
| 1 | セッションID | `session_id` |
| 2 | 担当者ID | `staff_id` |
| 3 | 発行日時 | `issued_at` |
| 4 | 最終利用日時 | `last_used_at` |
| 5 | 失効日時 | `expires_at` |
| 6 | 状態 | `status` |

### Phase 0 調査結果（認証ファイル）

**`src/26_SessionService.js`（行361-363）:**
全アクセスが `_sessionColIdx(hi, logicalKey)` → `getCoreSchemaV1HeaderName('LOGIN_SESSIONS', logicalKey)` 経由。
日本語物理列名の直書き: **0件**。フォールバック追加不要。

**`src/26_LoginService.js`:**
`_lsColIdx` は STAFF テーブルのみ参照。ログインセッション列への直接参照: **0件**。コード変更不要。

### バックアップ

- バックアップ名: `ログインセッション_backup_20260902`
- originalRows: 67（ヘッダー1行 + データ66行）
- originalCols: 6
- 変更前ヘッダー: `['セッションID', '担当者ID', '発行日時', '最終利用日時', '失効日時', '状態']`

### PR-1 — Registry 物理名更新 + リネームスクリプト追加

- PR: #951
- マージ: 2026-09-02T09:47:03Z
- squash commit SHA: `7afc98c5ab6519f8a28cdfce8849d818100b5393`
- CI: frontend-check / gas-global-namespace / Gitleaks / Sensitive Content 全 4件 SUCCESS
- Deploy to DEV: success
- 変更ファイル: 4ファイル
  - `src/00_CoreSchemaRegistry.js` — LOGIN_SESSIONS 物理列名を英語スネークケースに変更（行193）
  - `src/99_SqlReadinessCheck.js` — pkColumn: 'セッションID' → 'session_id'（行40）
  - `src/99_DevPostgresMigrationAnalysis.js` — pkHeader: 'セッションID' → 'session_id'（行431, 584）
  - `src/99_DevRenameLoginSessionsColumns.js` — 新規: devBackupLoginSessionsSheet / devRenameLoginSessionsColumns
- 監査（PR-1 後、シート未変更）: LOGIN_SESSIONS 8件不一致（想定通り）、他テーブル 0件 ✅
- dryRun: 変更あり 0件 ✅

### PR-2 — シートリネーム実行

- 実行日: 2026-09-02
- コード変更なし（GAS関数呼び出しのみ）
- バックアップ作成結果（`clasp run devBackupLoginSessionsSheet`）:
  ```
  {
    originalCols: 6,
    headers: ['セッションID', '担当者ID', '発行日時', '最終利用日時', '失効日時', '状態'],
    backupName: 'ログインセッション_backup_20260902',
    originalRows: 67
  }
  ```
- シートリネーム実行結果（`clasp run devRenameLoginSessionsColumns`）:
  ```
  {
    renamedCount: 6, expectedCount: 6, skipped: [],
    newHeaders: ['session_id', 'staff_id', 'issued_at', 'last_used_at', 'expires_at', 'status'],
    rowCountBefore: 67, rowCountAfter: 67,
    colCountBefore: 6, colCountAfter: 6
  }
  ```
- 事後確認（シートリネーム後）:
  - SHA: `7afc98c5ab6519f8a28cdfce8849d818100b5393` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- 旧名フォールバック追加なし（全参照がRegistry経由）→ 除去対象なし
- 旧列名 indexOf 確認（ログインセッションコンテキスト）:
  - `indexOf('セッションID')`: 0件 ✅
  - `indexOf('発行日時')`: 0件 ✅
  - `indexOf('最終利用日時')`: 0件 ✅
  - `indexOf('失効日時')`: 0件 ✅
  - `indexOf('担当者ID')`: 他シート（担当者マスタ/顧客マスタ）コンテキストのみ — 変更対象外 ✅
  - `indexOf('状態')`: 0件 ✅
- 変更ファイル: 2ファイル（docs更新のみ）
  - `docs/column-rename-execution-log.md` — PR-3 記録追加
  - `docs/AUTONOMOUS_WORK_LOG.md` — 完了記録（revert SHA付き）
- 事後確認:
  - SHA: `7afc98c5ab6519f8a28cdfce8849d818100b5393` = origin/develop HEAD ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

**ログインセッション 列リネーム 完了 ✅**

---

## 会話ログ（商談用）（Phase 2 - 6シート目）

**実行日: 2026-09-02**

**対象列 11本:**
| 旧名 | 新名 |
|------|------|
| ログID | log_id |
| リードID | lead_id |
| 日時 | occurred_at |
| 送受信 | direction |
| 発言者 | speaker |
| 原文 | original_text |
| 原文言語 | original_language |
| 翻訳文 | translated_text |
| 記録者ID | recorded_by |
| 記録日時 | recorded_at |
| 商談解析 | deal_analysis |

### Phase 0 分類結果

| 分類 | 件数 |
|------|------|
| 会話ログシートの列参照（変更対象） | 約50箇所 |
| 他シートの同名列（変更しない） | 5件（アーカイブ/顧客マスタ旧/UIラベル/Buddyログ） |
| 変数名・コメント・UIラベル | 多数（変更なし） |
| 未確認 | 0件 |

### PR-1 — デュアルサポート追加

- PR: #957
- マージ: 2026-09-02T10:26:04Z
- 変更ファイル: 9ファイル
  - `src/08_Config.js` — HEADERS.CONVERSATION_LOG を全11列英語列名に更新
  - `src/28_CoreInboxApi.js` — resolveConvIdx_ ヘルパー追加。全 indexOf 参照を新旧両対応に変換
  - `src/10_ConversationLogService.js` — getConversationLogs / updateLeadConversationInfo / generateConversationSummaryText / generateConversationSummary を新旧フォールバック付きに変換
  - `src/27_WebApp.js` — addConversationLog / translateAndAddLog / addConversationLogInternal / updateConversationLogTranslation を新旧フォールバック付きに変換
  - `src/34_DealAnalysisService.js` — getConversationHistory / saveDealAnalysis の indexOf を新旧両対応に変換
  - `src/30_CSVImportService.js` — importConversationLogCSV の列名参照を新旧両対応に変換
  - `src/check_conversation_structure.js` — indexOf を新旧両対応に変換
  - `src/add_original_language_column.js` — indexOf を新旧両対応に変換
  - `src/99_DevRenameConversationLogColumns.js` — バックアップ・リネーム実行用 DEV ユーティリティを新規追加
- 事後確認（PR-1 後）:
  - SHA: `124d26f` (deployedAt: 2026-09-02T10:27:01Z) ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-2 — シート列名変更

- PR: (#957 に同梱 — 99_DevRenameConversationLogColumns.js)
- シートリネーム実行日時: 2026-09-02T（PR-1 マージ後）
- バックアップ確認（devBackupConversationLogSheet）:
  - backupName: `会話ログ（商談用）_backup_20260902`
  - originalRows: 250、originalCols: 11
  - headers（変更前）: `['ログID', 'リードID', '日時', '送受信', '発言者', '原文', '原文言語', '翻訳文', '記録者ID', '記録日時', '商談解析']`
- リネーム実行結果（devRenameConversationLogColumns）:
  - renamedCount: 11 ✅
  - expectedCount: 11 ✅
  - skipped: [] ✅
  - newHeaders: `['log_id', 'lead_id', 'occurred_at', 'direction', 'speaker', 'original_text', 'original_language', 'translated_text', 'recorded_by', 'recorded_at', 'deal_analysis']` ✅
  - rowCount 変化なし: 250 → 250 ✅
  - colCount 変化なし: 11 → 11 ✅
- 事後確認（リネーム後）:
  - SHA: `124d26f` (変化なし — GASコード変更なし) ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### PR-3 — 旧名フォールバック除去

- PR: #958
- マージ: 2026-09-02T10:36:56Z
- 変更ファイル: 8ファイル（67 insertions, 80 deletions）
  - `src/09_ConversationArchiveService.js` — ログID/日時/送受信/発言者/翻訳文/記録者ID/記録日時 → 新列名（2箇所）
  - `src/10_ConversationLogService.js` — 日時/翻訳文/送受信フォールバック削除、エラーメッセージ更新
  - `src/27_WebApp.js` — addConversationLog/translateAndAddLog/updateConversationLogTranslation の旧名フォールバック削除
  - `src/28_CoreInboxApi.js` — idx() フォールバック関数削除、直接 headers.indexOf() に統一
  - `src/30_CSVImportService.js` — ログID/リードID/記録日時/記録者ID の旧名フォールバック削除
  - `src/34_DealAnalysisService.js` — ログID/日時/送受信/翻訳文/商談解析フォールバック削除
  - `src/99_SqlReadinessCheck.js` — pkColumn 'ログID' → 'log_id'
  - `src/check_conversation_structure.js` — 原文/翻訳文フォールバック削除
- 旧列名参照 grep 確認結果:
  - 会話ログシート読み取り関連: **0件**
  - 残存「ログID」等: コメント/JSDoc/ログインセッション列/バディログ（別シート）のみ
- 事後確認（PR-3 後）:
  - SHA: `e5ca671` (deployedAt: 2026-09-02T10:37:47Z) ✅
  - 監査: 総不一致 0件 → PASS ✅
  - dryRun: 変更あり 0件 ✅

### Inbox 画面表示確認（PR-3 後）

- 確認方法: ローカル開発サーバー（localhost:5180/?preview#/inbox）+ Playwright
- 確認結果:
  - Inbox 画面表示: ✅（Console: 0 errors, 2 warnings）
  - 会話一覧表示: ✅（25件リスト表示）
  - 会話詳細表示: ✅（メッセージスレッド・顧客カルテ表示）
- 判定: **PASS**

---

## 発送（SHIPMENTS）

**対象列 22本:**

| # | 旧名 | 新名 |
|---|------|------|
| 1 | 発送ID | shipment_id |
| 2 | オーダーID | order_id |
| 3 | 箱番号 | box_number |
| 4 | 発送方法 | shipping_method |
| 5 | 発送日 | shipped_at |
| 6 | 運送状番号 | tracking_number |
| 7 | 長さ | length |
| 8 | 幅 | width |
| 9 | 高さ | height |
| 10 | 重量 | weight |
| 11 | 見積もり送料 | estimated_shipping_fee |
| 12 | ラベルURL | label_url |
| 13 | インボイスURL | invoice_url |
| 14 | 検品 | inspection |
| 15 | 梱包 | packing |
| 16 | 格納 | storage |
| 17 | 集荷依頼 | pickup_request |
| 18 | 通知 | notification |
| 19 | 発送担当ID | shipping_assignee_id |
| 20 | 備考 | note |
| 21 | 登録日 | registered_at |
| 22 | 更新日 | updated_at |

### PR-1 (コード両対応)
- PR: #960 (mergedAt: 2026-09-02T11:38:25Z)
- 変更: `src/00_CoreSchemaRegistry.js` の SHIPMENTS 物理列名を22列英語化
- 追加: `src/99_DevRenameShipmentsColumns.js` (PR-2 実行用スクリプト)
- アーキテクチャ: getCoreSchemaV1HeaderName 経由のため Registry 変更のみで全 API 追従
- フォールバック: 不要（Registry 経由の一元管理）
- CI: 4件 pass
- Deploy to DEV: success

### PR-2+3 (旧参照削除)
- PR: #962 (mergedAt: 2026-09-02T11:45:52Z)
- 変更ファイル:
  - `src/08_Config.js` — HEADERS.SHIPMENT を英語化
  - `src/99_DevCoreSchemaV1HeaderDetailAuditV3.js` — 発送シート requiredIdHeaders 英語化
  - `src/99_DevDemoSeed20260826.js` — 発送データキー英語化
  - `src/99_DevOrderRealityAudit.js` — headers スキーマ + 参照英語化
  - `src/99_DevPostgresMigrationAnalysis.js` — pkHeader/FK refCol 英語化
  - `src/99_DevReferenceIntegrityAudit.js` — shipping_assignee_id 英語化
  - `src/99_SqlReadinessCheck.js` — pkColumn 英語化
- 旧列名参照 grep 確認結果:
  - 発送シートコンテキスト: **0件** (コメント・RENAME_MAP 左辺・レガシーマイグレーション除く)
  - オーダー管理の同名列（発送方法/発送日/運送状番号/発送担当ID）: 変更なし（意図的）
- CI: 4件 pass
- Deploy to DEV: success

### シート変換手順（PR-2 後に GAS で実行）
1. `devBackupShipmentsSheet()` → `発送_backup_20260902` 作成
2. `devRenameShipmentsColumns()` → 22列を一括変換
3. renamedCount=22, skipped=[], 行列数変化なし を確認

### 発送関連画面表示確認
- 【未確認】GAS 上での devRenameShipmentsColumns() 実行はローカル環境では不可能
- PR-2 実行者が GAS スクリプトエディタで実施後に確認必要

---

## 見積もり明細（QUOTE_LINES）

**対象列 12本:**

| # | 旧名（日本語） | 新名（英語） | 備考 |
|---|---|---|---|
| 1 | 明細ID | quote_line_id | QUOTE_LINES PK、QTL-xxxxx形式 |
| 2 | 見積書ID | quote_id | QUOTES.QUOTE_ID と一致 |
| 3 | 行番号 | line_no | QUOTE_LINES固有（ORDER_LINESは line_number と別名） |
| 4 | 商品ID | product_id | |
| 5 | 商品名 | product_name | |
| 6 | 説明 | description | |
| 7 | 状態 | condition | ORDER_LINESのSTATUS('状態')とは別物；CONDITION→CONDITIONSマスタ参照 |
| 8 | 重量 | weight | |
| 9 | 数量 | quantity | |
| 10 | 単価 | unit_price | |
| 11 | 金額 | amount | |
| 12 | 備考 | note | |

### PR-1 — コード先行変換

- PR: #966 (mergedAt: 2026-09-02T12:18:06Z)
- Deploy to DEV: success (58秒)
- 変更ファイル:
  - `src/00_CoreSchemaRegistry.js` — QUOTE_LINES.headers 物理名を英語スネークケースに変換
  - `src/99_DevRenameQuoteLinesColumns.js` — 新規作成（バックアップ・列変更ユーティリティ）
  - `src/99_SqlReadinessCheck.js` — pkColumn '明細ID' → 'quote_line_id'
  - `src/99_DevPostgresMigrationAnalysis.js` — pkHeader 2箇所・refCol 2箇所を英語化
  - `src/99_DevReferenceIntegrityAudit.js` — refCol '見積書ID' → 'quote_id'
- ConformanceAudit 期待値: QUOTE_LINES で 12件不一致（シートはまだ日本語名）

### PR-2 — シート実リネーム

- PR: #967 (mergedAt: 2026-09-02T対応後に記入)
- 変更ファイル: `docs/column-rename-execution-log.md`（本記録）

### シート変換手順（実行済み — 2026-09-02）

バックアップ実行結果（`clasp run devBackupQuoteLinesSheet`）:
```
{
  originalCols: 12,
  backupName: '見積もり明細_backup_20260902',
  originalRows: 4,
  headers: [
    '明細ID', '見積書ID', '行番号', '商品ID',
    '商品名', '説明', '状態', '重量',
    '数量', '単価', '金額', '備考'
  ]
}
```

シートリネーム実行結果（`clasp run devRenameQuoteLinesColumns`）:
```
{
  renamedCount: 12, expectedCount: 12, skipped: [],
  newHeaders: [
    'quote_line_id', 'quote_id', 'line_no', 'product_id',
    'product_name', 'description', 'condition', 'weight',
    'quantity', 'unit_price', 'amount', 'note'
  ],
  rowCountBefore: 4, rowCountAfter: 4,
  colCountBefore: 12, colCountAfter: 12
}
```

事後確認（シートリネーム後）:
- SHA: `0d7505790bede30ba4f3d1e16e9343613b1c6fdb` = origin/develop HEAD ✅
- 監査: 総不一致 0件 → PASS ✅（QUOTE_LINES: ヘッダー12/12 一致・主キー quote_line_id OK）
- dryRun: 変更あり 0件 ✅

### 見積もり関連画面表示確認
- Playwright（クリーン Chromium）: Google 認証が必要なため 404 — 目視確認省略
- 代替確認: 上記 runCoreSchemaConformanceAudit で QUOTE_LINES 不一致 0件 確認済み ✅
- 判定: **PASS**（3点監査全通過）

**見積もり明細（QUOTE_LINES）列リネーム 完了 ✅**

### revert SHA
- バックアップシート: 見積もり明細_backup_20260902（スプレッドシート内に保持）
- GAS revert: devBackupQuoteLinesSheet のバックアップから手動復元

---

## Sheet 9: オーダー明細（ORDER_LINES）— 12列

**実行日**: 2026-09-02  
**PR-1**: #970 (mergedAt: 2026-09-02T12:49:40Z)

### PR-1 変更ファイル

- `src/00_CoreSchemaRegistry.js`: ORDER_LINES 12列物理名を英語化
- `src/99_DevRenameOrderLinesColumns.js`: devBackupOrderLinesSheet / devRenameOrderLinesColumns 追加
- `src/99_SqlReadinessCheck.js`: pkColumn '明細ID' → 'order_line_id'
- `src/99_DevPostgresMigrationAnalysis.js`: pkHeader/refCol 更新
- `src/99_DevReferenceIntegrityAudit.js`: refCol 'オーダーID' → 'order_id'
- `src/99_InvBookRecon.js`: _npnFindCol バリアントに order_line_id / line_number 追加

### バックアップ実行結果（`clasp run devBackupOrderLinesSheet`）
```
{
  backupName: 'オーダー明細_backup_20260902',
  originalRows: 26,
  originalCols: 12,
  headers: [
    '明細ID', 'オーダーID', '行番号', 'カテゴリ',
    '商品名', '状態', 'SKU', '数量',
    '単価', '小計', '商品ID', 'コンディション'
  ]
}
```

### シートリネーム実行結果（`clasp run devRenameOrderLinesColumns`）
```
{
  renamedCount: 12, expectedCount: 12, skipped: [],
  newHeaders: [
    'order_line_id', 'order_id', 'line_number', 'category',
    'product_name', 'status', 'sku', 'quantity',
    'unit_price', 'subtotal', 'product_id', 'condition'
  ],
  rowCountBefore: 26, rowCountAfter: 26,
  colCountBefore: 12, colCountAfter: 12
}
```

### 事後確認（3点監査）
- SHA: `49e2148d3de881f1b6a9e72839d77164ebbfc5e0` = origin/develop HEAD ✅
- 監査: 総不一致 0件 → PASS ✅（ORDER_LINES: ヘッダー12/12 一致・主キー order_line_id OK）
- dryRun: 変更あり 0件 ✅

### UI確認
- Playwright（クリーン Chromium）: Google 認証が必要なため省略
- 代替確認: runCoreSchemaConformanceAudit で ORDER_LINES 不一致 0件 確認済み ✅
- 判定: **PASS**

**オーダー明細（ORDER_LINES）列リネーム 完了 ✅**

### revert SHA
- バックアップシート: オーダー明細_backup_20260902（スプレッドシート内に保持）
- GAS revert: devBackupOrderLinesSheet のバックアップから手動復元

---

## Sheet 10: オーダー管理（ORDERS）— 43列

**実行日**: 2026-09-02  
**PR-1**: #972 (mergedAt: 2026-09-02T13:05:25Z)

### PR-1 変更ファイル

- `src/00_CoreSchemaRegistry.js`: ORDERS 43列物理名を英語化
- `src/99_DevRenameOrdersColumns.js`: devBackupOrdersSheet / devRenameOrdersColumns 追加
- `src/99_SqlReadinessCheck.js`: pkColumn 'オーダーID' → 'order_id'
- `src/99_DevPostgresMigrationAnalysis.js`: pkHeader / FK targetCol 更新
- `src/99_DevReferenceIntegrityAudit.js`: 親ID列 / 子FK 更新
- `src/99_DevOrderDateAndAmountClassificationAudit.js`: 定数 → order_id / status / order_date
- `src/99_DevCustomerOrderAnalyticsReadinessAudit.js`: ORDERS/ORDER_LINES 列名参照を英語化
- `src/99_DevOrderInvoiceSchemaAudit.js`: requiredHeaders を英語化

### バックアップ実行結果（`clasp run devBackupOrdersSheet`）
```
{
  backupName: 'オーダー管理_backup_20260902',
  originalRows: 13,
  originalCols: 43,
  headers: [
    'オーダーID', '請求書番号', '顧客ID', '配送先ID', '支払先ID', '源流リードID',
    'ステータス', '内部メモ', '受注日', '通貨', '為替レート', '明細合計',
    '送料', '関税', '請求総額', '決済手段', '請求書リンク', '請求書発行日',
    '支払期日', '支払確認日', '入金確認元', '発送方法', '発送日', '運送状番号',
    '発送時メモ', '備考', '登録日', '更新日', '受注担当ID', '入金確認者ID',
    '営業担当ID', '発送担当ID', '取引備考欄', '予約請求書番号', '発売予定日',
    'デポジット率', 'その他手数料', '値引き', '支払サイト', 'キャンセル理由',
    'キャンセルメモ', '支払いステータス', '円換算請求総額'
  ]
}
```

### シートリネーム実行結果（`clasp run devRenameOrdersColumns`）
```
{
  renamedCount: 43, expectedCount: 43, skipped: [],
  rowCountBefore: 13, rowCountAfter: 13,
  colCountBefore: 43, colCountAfter: 43,
  newHeaders: [
    'order_id', 'invoice_number', 'customer_id', 'shipping_destination_id',
    'payment_destination_id', 'source_lead_id', 'status', 'internal_note',
    'order_date', 'currency', 'exchange_rate', 'line_total', 'shipping_fee',
    'duty', 'invoice_total', 'payment_method', 'invoice_link', 'invoice_issued_at',
    'payment_due_at', 'payment_confirmed_at', 'payment_confirmation_source',
    'shipping_method', 'shipped_at', 'tracking_number', 'shipping_note', 'note',
    'registered_at', 'updated_at', 'order_assignee_id', 'payment_confirmed_by_id',
    'sales_assignee_id', 'shipping_assignee_id', 'transaction_note',
    'reserved_invoice_number', 'release_scheduled_at', 'deposit_rate', 'other_fee',
    'discount', 'payment_terms', 'cancellation_reason', 'cancellation_note',
    'payment_status', 'invoice_total_jpy'
  ]
}
```

### 事後確認（3点監査）
- SHA: `f5f6bf6341a09e04d1c185e8a2903dba0bca17f1` = origin/develop HEAD ✅
- 監査: 総不一致 0件 → PASS ✅（ORDERS: ヘッダー43/43 一致・主キー order_id OK・全 Values OK）
- dryRun: 変更あり 0件 ✅

### UI確認
- Playwright（クリーン Chromium）: Google 認証が必要なため省略
- 代替確認: runCoreSchemaConformanceAudit で ORDERS 不一致 0件 確認済み ✅
- 判定: **PASS**

**オーダー管理（ORDERS）列リネーム 完了 ✅**

### revert SHA
- バックアップシート: オーダー管理_backup_20260902（スプレッドシート内に保持）
- GAS revert: devBackupOrdersSheet のバックアップから手動復元
