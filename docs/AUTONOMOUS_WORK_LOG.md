# 自律作業ログ

このファイルは Claude Code による自律実装セッションの記録です。
各エントリは PR 単位で記述されます。

---

## 【1】Combobox 共通部品化 — PR #301

**マージ日時**: 2026-08-19T20:35:28Z

### 変更前
- `frontend/src/pages/quotes/LeadCombobox.tsx` に LeadCombobox 固有の Combobox 実装
- `frontend/src/pages/quotes/ProductCombobox.tsx` に ProductCombobox 固有の Combobox 実装（LeadCombobox.css を共有）
- `frontend/src/pages/quotes/LeadCombobox.css` に `.lead-combobox__*` CSS クラス定義
- `ProductCombobox` の幅が `ui-field--width-md` でハードコード

### 変更内容
- `frontend/src/components/ui/Combobox/Combobox.tsx` を新規作成（ジェネリクス `Combobox<T>`）
- `frontend/src/components/ui/Combobox/Combobox.css` を新規作成（`.combobox__*` デザイントークン使用）
- `LeadCombobox.tsx` → `Combobox<LeadOption>` の薄いラッパーに書き換え
- `ProductCombobox.tsx` → `Combobox<InventoryProductOption>` の薄いラッパーに書き換え（`width` prop / `className` prop 対応）
- `LeadCombobox.css` を削除（CSS は `Combobox.css` に統合）
- `frontend/src/components/ui/index.ts` に `Combobox` / `ComboboxProps` をエクスポート追加
- `frontend/src/pages/catalog/ComponentCatalogPage.tsx` に Combobox デモカード追加
- `frontend/src/content/ja/catalog.ts` に Combobox コピー追加

### 期待効果
- 重複実装の排除（LeadCombobox と ProductCombobox で同一ロジックが二重に存在していた）
- 今後の Combobox 追加は `Combobox<T>` を利用するだけでよい
- `width` prop により幅のハードコードを解消

### 検証結果
- `npm run build:gas` 通過
- CI 通過
- Playwright による見積もりエディタ動作確認（Lead/Product 各 Combobox の選択・クリア）

### 戻し方
`git revert 78e308e` で LeadCombobox / ProductCombobox の旧実装を復元可能

---

## 【2】カタログ未登録部品の登録 — PR #302

**マージ日時**: 2026-08-19T20:41:02Z

### 変更前
- `StatCard` と `StatusMessage` が `components/ui/index.ts` にはエクスポートされているが `ComponentCatalogPage.tsx` に未登録
- `check-design-system.mjs` の 12 件ハードコードリストにも含まれていなかった

### 変更内容
- `ComponentCatalogPage.tsx` に `StatCard` / `StatusMessage` のデモカードを追加
- `content/ja/catalog.ts` に対応するコピー文字列を追加
- `check-design-system.mjs` のハードコードリストに `StatCard` / `StatusMessage` を追加（この時点ではまだハードコード方式）

### 期待効果
- コンポーネントカタログに未登録部品がなくなる
- `check-design-system` がカタログ漏れを検出できるようになる

### 検証結果
- `npm run build:gas` 通過（`check:design-system` 含む）
- CI 通過

### 戻し方
`git revert 4f35b41` でカタログ登録を元に戻せる

---

## 【3】検査対象リストの拡充 — PR #303

**マージ日時**: 2026-08-19T20:45:43Z

### 変更前
- `check-design-system.mjs` のカタログ検査が 12 件ハードコードのリストに依存
- 新コンポーネント追加時にスクリプト更新を忘れると検査漏れが発生する構造

### 変更内容
- `check-design-system.mjs` line 15 を書き換え
- `components/ui/index.ts` から `export { ComponentName }` を正規表現で動的抽出
- エクスポートが 0 件の場合はスクリプトエラーとして検出するガードを追加

### 変更後の動的抽出結果（検証時点）
```
PageHeader, Button, Card, StatCard, StatusMessage, Spinner,
EmptyState, Badge, Skeleton, Tabs, TabBar, DataTable,
PageToolbar, TextField, Textarea, Select, ConversationWorkspace,
SubMenu, HubShell, Combobox（計20件）
```

### 期待効果
- 新コンポーネントを `components/ui/index.ts` にエクスポートするだけで自動的に検査対象になる
- `check-design-system.mjs` のメンテナンスコスト削減

### 検証結果
- `npm run build:gas` 通過
- CI 通過

### 戻し方
`git revert e143adf` でハードコード方式に戻せる

---

## 【4】staff feature 境界の検査追加 — 実装済み確認（新規 PR 不要）

**確認日時**: 2026-08-20

### 調査結果

【事実】`check-design-system.mjs` の lines 46–52 に staff feature 境界検査がすでに存在する。

```javascript
const staffContractsSource = await readFile(resolve(srcDir, 'features/staff/contracts.ts'), 'utf8');
const staffGasAdapterSource = await readFile(resolve(srcDir, 'features/staff/gasAdapter.ts'), 'utf8');
const staffPageSource = await readFile(resolve(srcDir, 'pages/staff/StaffListPage.tsx'), 'utf8');
if (!staffContractsSource.includes('StaffRepository'))
  violations.push('staff feature does not declare StaffRepository');
if (!staffGasAdapterSource.includes('staffGasRepository'))
  violations.push('staff feature does not provide GAS repository');
if (!staffGasAdapterSource.includes("from '../../gas/client'"))
  violations.push('staff GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(staffPageSource) ||
    (!staffPageSource.includes('StaffRepository') && !staffPageSource.includes('StaffListCacheContext')))
  violations.push('staff page bypasses the StaffRepository boundary');
```

**追加元**: PR #299「スタッフ一覧にキャッシュコンテキストを追加」(commit `1e82b1d`) でスタッフ境界の実装と同時に検査が追加された。

### 変更内容
なし（コード変更不要）

### 戻し方
対象なし

---

## 【5】LeadEditorPage を中間層方式へ移行 — PR #316

**実施日時**: 2026-08-21

### 変更前
- `LeadEditorPage.tsx` が `gas/client` から `createLead` / `getLeadDetail` / `updateLead` を直接 import
- `features/leads/` ディレクトリ未存在

### 変更内容
- `frontend/src/features/leads/contracts.ts` 新規作成（`LeadRepository` インターフェース定義）
- `frontend/src/features/leads/gasAdapter.ts` 新規作成（`leadGasRepository` として gas/client をラップ）
- `LeadEditorPage.tsx` を `repository: LeadRepository` props 経由に変更（gas/client 直接呼び出し削除）
- `App.tsx` に `leadGasRepository` import を追加し `LeadEditorPage` に渡す
- `check-design-system.mjs` に leads 境界検査を追加

### 期待する効果
- `pages/leads/LeadEditorPage.tsx` から gas/client への実行時依存を排除
- Reviewer の境界検査で Lead エディタの境界違反が検出可能になる

### 検証結果
- `tsc --noEmit` 通過
- `npm run build:gas` 通過（design-system check 含む）
- CI 通過（マージ後に確認）

### 戻し方
`git revert 12a1a50`

---

## 【6】DashboardPage を中間層方式へ移行 — PR #318

**実施日時**: 2026-08-21

### 変更前
- `DashboardPage.tsx` が `gas/client` から `DashboardKpis` 型を直接 import
- `App.tsx` が `getDashboardKpis()` を `gas/client` から直接呼び出し
- `features/dashboard/` ディレクトリ未存在

### 変更内容
- `frontend/src/features/dashboard/contracts.ts` 新規作成（`DashboardRepository` インターフェース・`DashboardKpis` 型定義）
- `frontend/src/features/dashboard/gasAdapter.ts` 新規作成（`dashboardGasRepository` として gas/client をラップ）
- `DashboardPage.tsx` の型 import を `features/dashboard/contracts` に変更
- `App.tsx` の `getDashboardKpis()` 直接呼び出しを `dashboardGasRepository.getKpis()` に置換
- `check-design-system.mjs` に dashboard 境界検査を追加

### 期待する効果
- `pages/dashboard/DashboardPage.tsx` から gas/client への依存を排除
- `App.tsx` の gas/client 呼び出しを `dashboardGasRepository` 経由に統一

### 検証結果
- `tsc --noEmit` 通過
- `npm run build:gas` 通過（design-system check 含む）
- CI 通過（マージ後に確認）

### 戻し方
`git revert 1ac81d1`

---

## 【7】usePrefetch を CacheProvider 配下に移動し画面白紙を修正 — PR #320

**マージ日時**: 2026-08-21T03:19:05Z

### 変更前
- `AppRouter` 本体（return 前）で `usePrefetch(permissions)` を呼んでいた
- この時点では `LeadListCacheProvider` 等のコンテキストが未提供
- 結果: `useLeadListCache()` が Provider 外から呼ばれ `"leads CacheProvider is required"` を throw
- 症状: ブラウザで画面が真っ白

### 変更内容
- `frontend/src/App.tsx` に `AppShellWithPrefetch` コンポーネントを追加
- `AppShellWithPrefetch` を全 CacheProvider の内側（JSX return 内）に配置
- `AppRouter` 本体から `usePrefetch(permissions)` 呼び出しを削除
- `docs/AUTONOMOUS_WORK_RULES.md` に「画面確認（必須）」セクションを追記

### 期待する効果
- 画面白紙の解消
- build / CI が通っても画面が壊れる事例を記録し、Playwright 確認を必須化

### 検証結果
- `npm run build:gas` 通過（tsc + vite + check:design-system）
- CI 通過（frontend-check / gas-global-namespace）
- DEV 配布 success
- `runCoreSchemaConformanceAudit`: 総不一致 0 → PASS

### 戻し方
`git revert f1e9a35`

---

## 【8】LineItemEditor 共通部品作成・Quote/Order 明細行共通化（第2段階）— PR #331

**ブランチ**: `release/line-item-editor`

### 変更内容
- **GAS** `src/28_CoreInventoryOptionApi.js`: `getInventoryProductOptions` の返値に `category` を追加
- **`frontend/src/gas/client.ts`**: `InventoryProductOption` に `category` フィールドを追加
- **`frontend/src/features/orders/contracts.ts`**: `InventoryConditionOption` 型と `listConditions` メソッドを追加、`InventoryProductOption` を整理
- **`frontend/src/features/orders/gasAdapter.ts`**: `listConditions` 実装（`getInventoryConditions` 経由）、category マッピング修正
- **`frontend/src/pages/orders/orderEditorConfig.ts`**: `OrderLineEditorValues` に `unitWeight` を追加
- **`frontend/src/components/ui/LineItemEditor/`**: 共通明細入力部品を新規作成
  - `LineItemEditorLabels` を呼び出し元から注入（コンポーネント自体に日本語コピーなし）
- **`frontend/src/pages/quotes/QuoteEditorPage.tsx`**: LineItemEditor 使用にリファクタリング（動作変更なし）
- **`frontend/src/pages/orders/OrderEditorPage.tsx`**: LineItemEditor 使用にリファクタリング
  - 状態入力が TextField → Select（在庫連動）に変更（Quote と同フロー）
  - category は OrderEditorValues で管理し GAS ペイロードに継続送信
- **`frontend/src/pages/catalog/ComponentCatalogPage.tsx`**: LineItemEditor をカタログに登録

### 検証結果
- `tsc --noEmit` 通過（エラーなし）
- `npm run build:gas` 通過（typecheck + vite build + emit-gas-html + check:design-system）
- CI 通過（マージ後に確認）

### 戻し方
`git revert d6d9f58`
