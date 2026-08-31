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
