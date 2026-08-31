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
