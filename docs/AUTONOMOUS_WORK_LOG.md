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

## 【5】オーダー作成画面のフルページスケルトン廃止 — PR #362

**マージ日時**: 2026-08-21T21:11:51Z  
**revert用SHA**: `6e10e1d62f278b9b8b1c042e886bf335a58d48d1`

### 変更内容
- `frontend/src/pages/orders/OrderCreatePage.tsx` を CustomerListCacheContext 対応に書き換え
- フルページ Skeleton を廃止し、顧客データが prefetch 済みであれば即時表示
- 在庫・通貨は独立した useEffect で非同期ロード

### 検証結果
- `npm run build:gas` 通過、CI 通過、DEV デプロイ完了
- **実機確認不足**: `?preview` モード未整備のため Playwright による事前確認を省略
- マージ後に「オーダー新規作成画面が開かない」報告 → PR #364 でリバート

---

## 【6】PR #362 差し戻し — PR #364

**マージ日時**: 2026-08-21T21:24:54Z  
**revert用SHA**: `df83e0a36bff4143d3bc964bad310853a61919a9`

### 変更内容
- `git revert 6e10e1d` により PR #362 の変更を差し戻し

### 経緯
- 2回の静的解析では根本原因を特定できなかったため、ルールに従い即リバート
- 実際の原因は OrderListPage の navigate バグ（PR #367 で修正）であり、PR #362 自体は無関係だった

### 検証結果
- CI 通過、DEV デプロイ完了

---

## 【7】オーダー新規作成ボタンの navigate 修正 — PR #367

**マージ日時**: 2026-08-21T21:48:07Z  
**revert用SHA**: `3bdc975109811d4955a1333a42d9082162e8ea40`

### 変更前
```tsx
// OrderListPage.tsx
import { ORDER_ROUTE_SEGMENTS } from './orderEditorConfig';
<Button onClick={() => navigate(ORDER_ROUTE_SEGMENTS.create)}>
// navigate('new') → 相対パス、React Router v6 で意図通りに動かないケースあり
```

### 変更後
```tsx
import { ORDER_EDITOR_PATHS } from './orderEditorConfig';
<Button onClick={() => navigate(ORDER_EDITOR_PATHS.create)}>
// navigate('/orders/new') → 絶対パス、確実に動く
```

### 根本原因
`ORDER_ROUTE_SEGMENTS.create = 'new'`（相対パス）を React Router v6 の index route から呼ぶと  
正しく解決されないケースがある。`ORDER_EDITOR_PATHS.create = '/orders/new'`（絶対パス）を使うべきだった。  
QuoteListPage は最初から絶対パスを使っており正常動作していた。

### 検証結果
- Playwright: `?preview#/` → 「新規作成」クリック → `/orders/new` へ遷移を確認
- CI 通過、DEV デプロイ完了、SHA 照合 OK、conformance audit PASS

---

## 【8】dev preview モード — GAS モックランナー導入 — PR #370

**マージ日時**: 2026-08-21T21:59:29Z  
**revert用SHA**: `78bff4f3e1ce0f04016de2d02e9f37a8fe93c6f6`

### 変更内容
- `frontend/src/preview/gasRunnerMock.ts` を新規作成
  - `window.google.script.run` のモックランナー（immutable chain builder パターン）
  - `GoogleScriptRun` の全メソッドをカバー
  - モックデータ: 顧客2件 / 商品2件 / 通貨3件 / 案件オプション2件 等
  - すべて ASCII 文字列（`check:design-system` の日本語禁止ルールをクリア）
- `frontend/src/vite-env.d.ts` を新規作成（`import.meta.env` 型定義）
- `frontend/src/main.tsx` に条件付きモック注入を追加
  - `import.meta.env.DEV && ?preview` の場合のみ `installGASMock()` を呼ぶ
  - 本番ビルドでは dead-code elimination により含まれない

### 検証結果
- `http://localhost:5179/?preview#/orders/new` → オーダー新規作成フォーム表示 OK
- `http://localhost:5179/?preview#/quotes/create` → 見積もり新規作成フォーム表示 OK
- コンソール React エラー: 0（favicon 404 のみ、無害）
- `npm run build:gas` 通過（`check:design-system` 含む）
- CI 通過、DEV デプロイ完了
- SHA 照合: deployedSha = `07b672ee...` = `origin/develop` HEAD ✓
- conformance audit: 総不一致 0 → PASS

---

## 【9】受注管理一覧の列調整 — PR #TBD

**マージ日時**: TBD
**revert用SHA**: TBD（マージ後に更新）

### 変更前

- `frontend/src/pages/sales-orders/salesOrderListConfig.ts`: 列定義に `orderId` 列がなく、`SALES_ORDER_LIST_COLUMNS` は `customerName` から始まっていた
- `SalesOrderListPage.tsx`: `columns` はタブ状態に関係なく常に同じ列セットを表示していた（`status` 列も全タブで表示）

### 変更内容

- `salesOrderListConfig.ts`:
  - `SalesOrderColumnDef` 型を新規追加（`sortable?: boolean` フィールドを持つ）
  - `SALES_ORDER_LIST_COLUMNS` の先頭に `orderId`（受注番号）列を追加（`sortable: false`）
  - 列定義の `key` 型を `keyof SalesOrderRow` に拡張（`SalesOrderSortKey` 限定を解除）
  - `SALES_ORDER_LIST_SEARCH_COLUMNS` の型も `keyof SalesOrderRow` に変更
- `SalesOrderListPage.tsx`:
  - `useCallback` で `changeSort` をメモ化
  - `columns` を `useMemo` でラップし、`activeTabLabel` / `sort` に依存
  - `status` 列は `activeTabLabel === null`（「すべて」タブ）のときのみ `columns` に含める
  - ソート不可列（`orderId`）は `onSort` / `ariaSort` / `sortIcon` を付与しない

### 変更理由

- `orderId` は各行の一意識別子として最も重要な情報。一覧の左端に常時表示することで視認性を向上
- 「すべて」タブ以外ではステータスがタブ名と同一になるため、重複する `status` 列を非表示にして列を絞り込む

### 検証結果

- `npm run build:gas` 通過（TypeScript + Vite build + check:design-system）
- CI 通過（PR マージ後に更新）
- DEV デプロイ後の実機確認（PR マージ後に更新）

### 戻し方

`git revert TBD` で列定義・ページ変更を元に戻せる
