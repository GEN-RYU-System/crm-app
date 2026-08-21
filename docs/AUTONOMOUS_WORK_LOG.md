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
`git revert b58c3c0`

---

## 【9】オーダー顧客選択を Select → Combobox に変更（第3段階）— PR #332

**ブランチ**: `release/order-customer-combobox`

### 変更内容

- **`frontend/src/pages/orders/OrderEditorPage.tsx`**
  - import に `Combobox` を追加
  - 顧客選択フィールドを `<Select>` から `<Combobox<{customerId, customerName}>>` に置換
  - `handleCustomerChange` ロジックは変更なし（顧客ID変更→配送先・支払先リセット→aggregate取得）
  - `customers` state は `readonly` 配列のため `[...customers]` スプレッドで Combobox に渡す

### 変更理由

- 見積もりエディタ（QuoteEditorPage）の Lead 選択と同じ UX パターンに統一
- 顧客数増加時にドロップダウンでのスクロールが困難になることへの対応
- Combobox ではインクリメンタル検索が可能（顧客名・ID部分一致）

### 検証結果

- `tsc --noEmit` 通過（エラーなし）
- `npm run build:gas` 通過（typecheck + vite build + emit-gas-html + check:design-system）
- CI 通過（マージ後に確認）

### 戻し方

`git revert 125db38`

---

## 【10】Combobox 候補リストをポータルで最前面に描画 — PR #336

**マージ日時**: 2026-08-21（セッション内確認済）  
**revert用SHA**: `f8e8228`

### 変更前
- `Combobox` の候補リストが `position: absolute` で `.line-item-editor__row { overflow: hidden }` にクリップされ、オーダー・見積もり画面で候補が表示されない不具合

### 変更内容
- `frontend/src/components/ui/Combobox/Combobox.tsx`
  - `createPortal` で候補リストを `document.body` 直下にレンダリング
  - `useLayoutEffect` で `getBoundingClientRect()` を使い `position: fixed` で座標を計算
  - スペース不足時は上方向に開く（upward open）ロジックを追加
  - `scroll` / `resize` イベントで座標を再計算

### 検証結果
- `npm run build:gas` 通過
- CI 通過
- Playwright で `parentTag: BODY`・`position: fixed`・`zIndex: 9999` を確認

### 戻し方

`git revert f8e8228`

---

## 【11】孤立した ProductCombobox / OrderProductCombobox を削除 — PR #339

**マージ日時**: 2026-08-21  
**revert用SHA**: `b6bc73e`

### 変更前
- `frontend/src/pages/quotes/ProductCombobox.tsx`（PR #331 共通化後に削除されず残存）
- `frontend/src/pages/orders/OrderProductCombobox.tsx`（同上）
- どこからも import されていないがビルド・CI はすべて通過していた

### 変更内容
- 上記2ファイルを削除

### 検証結果
- `npm run build:gas` 通過
- CI 通過
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS

### 戻し方

`git revert b6bc73e`

---

## 【12】共通部品化手順・PR実機確認記録のルールを追記 — PR #340

**マージ日時**: 2026-08-21T10:18:30Z  
**revert用SHA**: `1ba9245`

### 変更前
- `docs/AUTONOMOUS_WORK_RULES.md` に共通部品変更時の手順・実機確認記録の要件が未定義

### 変更内容
- `docs/AUTONOMOUS_WORK_RULES.md` に以下2セクションを追加
  1. 「PR本文への実機確認記録（必須）」: 確認画面/URL/操作/結果のテーブル形式
  2. 「共通部品の作成・変更手順（必須）」: 対象画面列挙→全差し替え→旧部品削除→検証登録→実機確認の5ステップ

### 検証結果
- `npm run build:gas` 通過
- CI 通過
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS
- DEV SHA: `1ba9245` 一致

### 戻し方

`git revert 1ba9245`

---

## 【13】未使用ソースファイルの自動検出をcheck-design-systemに追加 — PR #341

**マージ日時**: 2026-08-21T09:07:45Z  
**revert用SHA**: `53191ba`

### 変更前
- `check-design-system.mjs` に未使用ファイル検出機能がなく、どこからも import されないファイルが残存しても検出できなかった

### 変更内容
- `frontend/scripts/check-design-system.mjs` に未使用ファイル検出ロジック追加
  - `frontend/src` 配下の `.ts`/`.tsx` を走査しどこからも import されていないファイルを検出
  - エントリポイント・`.d.ts` は除外
- `frontend/scripts/check-design-system-config.json` を新規作成（除外エントリポイント管理）
- `frontend/src/components/ui/LineItemEditor/index.ts`（未使用バレル）を削除

### 検証結果
- `npm run build:gas` 通過（新規 violation なし）
- CI 通過
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS
- DEV SHA: `53191ba` 一致

### 戻し方

`git revert 53191ba`

---

## 【14】共通部品の利用登録チェックをcheck-design-systemに追加 — PR #342

**マージ日時**: 2026-08-21T10:25:21Z  
**revert用SHA**: `cb7cd00`

### 変更前
- 共通部品を新規作成・変更しても「どのページが import しているか」を機械的に検証する手段がなかった
- PR #331 で `LineItemEditor` を共通化した際、`OrderEditorPage` 側の差し替え漏れが build/CI で検出されなかった

### 変更内容
- `frontend/scripts/check-design-system-config.json` に `componentUsageCheck.rules` を追加
  - `LineItemEditor`: `pages/quotes/` / `pages/orders/` で利用必須
  - `Combobox`: `pages/quotes/` / `pages/orders/` で利用必須
- `frontend/scripts/check-design-system.mjs` に利用登録チェック追加
  - ページディレクトリ配下の全 `.ts`/`.tsx` を走査
  - `components/ui` からの named import にコンポーネント名が含まれるか確認
  - 含まれなければ violation としてエラー停止

### 検証結果
- `npm run build:gas` 通過（既存コードは全ルールを満たしているため新規 violation なし）
- CI 通過
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS
- DEV SHA: `cb7cd00` 一致

### 戻し方

`git revert cb7cd00`

---

## 【訂正】支払先マスタ「顧客IDあり件数」の誤報告

**訂正日**: 2026-08-22

### 誤報告内容
前セッションの調査報告で「51行のうち顧客IDが入っている件数: 15件」と報告した。

### 正しい値
全51件に顧客IDが入力されている（空欄 0 件）。

### 誤報告の原因
`devAuditPaymentDestinations()` の初期実行時に出力した `rowsWithCustomerId` の値を誤読した。
実データは全行に顧客IDが存在しており、後続の `devCheckPaymentRowsByCustomerName` でも51件分のマッチが確認されている。

---

## 【PR1】受注管理サイドメニュー: 一覧APIにステータス追加

**日付**: 2026-08-22
**PR**: release/order-sidemenu-pr1

### 変更前の状態
- `CORE_ORDERS_CACHE_INDEX = 'CORE_ORDERS_CACHE_INDEX'`（実ファイル確認済み: src/28_CoreOrderReadApi.js line 6）
- `CORE_ORDERS_CACHE_PREFIX = 'CORE_ORDERS_CACHE_'`（実ファイル確認済み: src/28_CoreOrderReadApi.js line 7）
- `getCoreOrdersForFrontend` の読み取り列に `STATUS` なし
- `OrderRecord` 型（frontend/src/gas/client.ts）に `status` フィールドなし

### 変更内容（ファイル単位）
- `src/28_CoreOrderReadApi.js`:
  - キャッシュキーを V2 に変更（`CORE_ORDERS_CACHE_INDEX_V2`, `CORE_ORDERS_CACHE_V2_`）
  - 読み取り列に `STATUS` を追加
  - 返り値に `status: coreCustomerFrontendValue(row[orders.indexes.STATUS])` を追加
- `frontend/src/gas/client.ts`:
  - `OrderRecord` 型に `status: string` フィールドを追加

### 変更理由
フロントエンドのサイドメニュータブでステータス別絞り込みを実現するため、
GAS API の返り値に `status` フィールドを追加する。
キャッシュキーを V2 に変更することで旧キャッシュとの混在を防ぐ。

### 検証結果
- `npm run build:gas` 通過（typecheck → build → emit-gas-html → check:design-system）
- CI: PR push後に確認予定
- `clasp run runCoreSchemaConformanceAudit`: PR push後に確認予定
- `clasp run getCoreOrdersForFrontend` での status キー確認: PR push後に確認予定

### revert用SHA
`git revert <SHA>` （PR merge後に確定）

---

## 【PR2】受注管理サイドメニュー: ステータス選択肢APIを新設

**日付**: 2026-08-22
**PR**: release/order-sidemenu-pr2

### 変更前の状態
- `getCoreOrderStatusOptionsForFrontend` 関数が存在しなかった
- `CORE_ORDER_STATUS_TAB_KEYS` 配列が存在しなかった

### 変更内容（ファイル単位）
- `src/28_CoreOrderReadApi.js`:
  - `CORE_ORDER_STATUS_TAB_KEYS` 配列を追加（6ステータス、UNKNOWN除外）
  - `getCoreOrderStatusOptionsForFrontend` 関数を追加
  - `getCoreSchemaV1Value` でシート実値を返す実装（ハードコードなし）

### 変更理由
サイドメニューのタブ定義をGASから取得可能にする。
ラベルはスキーマの実値（シートの値）から生成することで、
フロントへの文字列ハードコードを防ぐ。

### 検証結果
- `npm run build:gas` 通過
- `grep -rn "支払い待ち\|仕入れ中\|発送待ち" frontend/src/` ヒット 0
- CI: PR push後に確認予定
- `clasp run getCoreOrderStatusOptionsForFrontend` → 返り値6件確認予定

### revert用SHA
`git revert <SHA>` （PR merge後に確定）

---

## 【PR1】マージ確定情報

**mergedAt**: 2026-08-21T21:28:22Z
**mergeCommit.oid**: 8acc6bc98df465559de9d8ea50abebb94b2df809
**revert用SHA**: `git revert 8acc6bc98df465559de9d8ea50abebb94b2df809`

---

## 【PR2】マージ確定情報

**mergedAt**: 2026-08-21T21:31:37Z
**mergeCommit.oid**: 9a048b302870ff943b5e9462fce7b47672724b8e
**revert用SHA**: `git revert 9a048b302870ff943b5e9462fce7b47672724b8e`

---

## 【PR5】受注管理ページ新規作成 (/sales-orders)

**日付**: 2026-08-22
**PR**: release/sales-orders-page

### 変更内容（ファイル単位）
- `frontend/src/content/ja/salesOrders.ts` (新規): 受注管理ページ用コピー・バッジバリアント定義
- `frontend/src/content/ja/index.ts`: salesOrdersCopy / SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT の re-export 追加
- `frontend/src/gas/client.ts`: OrderStatusOption 型・getCoreOrderStatusOptions() 関数を追加
- `frontend/src/gas/types.d.ts`: getCoreOrderStatusOptionsForFrontend を GoogleScriptRun 型に追加
- `frontend/src/features/salesOrders/contracts.ts` (新規): SalesOrderStatusOption / SalesOrderTab 型定義
- `frontend/src/features/salesOrders/gasAdapter.ts` (新規): OrderRecord -> SalesOrderRow マッピング
- `frontend/src/pages/sales-orders/SalesOrderListCacheContext.tsx` (新規): 受注一覧・ステータス選択肢のキャッシュ Provider
- `frontend/src/pages/sales-orders/salesOrderListConfig.ts` (新規): 列定義・ソート・フィルタ関数
- `frontend/src/pages/sales-orders/SalesOrderListPage.tsx` (新規): 受注管理ページ本体
- `frontend/src/pages/sales-orders/SalesOrderListPage.css` (新規): ページスタイル
- `frontend/src/App.tsx`: /sales-orders ルート追加・SalesOrderListCacheProvider でラップ
- `docs/AUTONOMOUS_WORK_LOG.md` (本ファイル): PR5 作業ログ追記

### 不明ステータス件数
DEV実機確認後に記録予定

### 検証結果
- `npm run build:gas` 通過（typecheck -> build -> emit-gas-html -> check:design-system）
- `grep -rn "支払い待ち|仕入れ中|発送待ち" frontend/src/` ヒット 0
- CI: PR push後に確認

### revert用SHA
`git revert <SHA>` （PR merge後に確定）
