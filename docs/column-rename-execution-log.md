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
