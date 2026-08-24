# 自律作業ログ

> **履歴書換え済み（2026-08-24）:** すべての作業者は旧クローン／旧worktreeを使用・pushせず、必ず新履歴を再クローンすること。旧SHAは `docs/SHA_REMAP_20260824.md` で新SHAへ読み替える。

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

## 【9】受注管理一覧の列調整 — PR #372

**マージ日時**: 2026-08-21T23:39:50Z
**revert用SHA**: `b8c8dc1f39219dd664443e9db5950e3aa24c9b8d`

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
- CI 通過: Frontend Check `success` (31s)、GAS Global Namespace Check `success`
- Deploy to DEV 通過: `success` (56s)
- SHA 照合: deployedSha = `b8c8dc1f...` = `origin/develop` HEAD ✓
- conformance audit: 総不一致 0 → PASS

### 戻し方

`git revert b8c8dc1f39219dd664443e9db5950e3aa24c9b8d` で列定義・ページ変更を元に戻せる

---

## 【10】オーダー受注日・支払期日をサーバー側で自動設定 — PR #377

**マージ日時**: 2026-08-22T06:53:02Z
**revert用SHA**: `56d9e125b877e35d536f66bb537ecfb02ac7162c`

### 変更前

- `OrderEditorPage.tsx` に受注日・支払期日の日付入力フィールドが存在していた
- `createCoreOrderForFrontend` はフロントから `orderDate` / `paymentDueAt` / `paymentTerms` を受け取り、そのまま書き込んでいた

### 変更内容

**GAS サーバー側（`src/28_CoreOrderWriteApi.js`）**
- `payload.orderDate` / `payload.paymentDueAt` の受け取りを廃止
- `ORDER_DATE` ← `now`（今日の日付）を自動設定
- `PAYMENT_DUE_AT` ← `now + N日`（システム設定「オーダー支払期日日数」の値、既定値 2）を自動計算
- `PAYMENT_TERMS` ← `"N日後"` を自動生成（例: `"2日後"`）

**GAS システム設定シード（`src/26_SystemSettingsSetup.js`）**
- 種別: NUMBER / 設定キー: `オーダー支払期日日数` / 値: `2` をシード配列に追加
- ※実行（`clasp run seedSystemSettings`）はユーザー指示を待つ

**フロントエンド**
- `OrderEditorValues` / `OrderCreatePayload` から `orderDate` / `paymentDueAt` フィールドを削除
- `OrderEditorPage.tsx` の受注日・支払期日 TextField を削除
- `content/ja/orders.ts` から未使用の `editor.paymentDueAt` / `editor.orderDate` コピー文字列を削除

### 変更理由

- 受注日はサーバー時刻が正確。フロント入力では時差・手入力ミスのリスクがある
- 支払期日はビジネスルール（受注日 + N日）で一意に決まり、フロント入力は不要
- 見積もり有効期限（`28_CoreQuoteApi.js`）と同じ自動設定パターンで統一

### 根拠データ

- 既存オーダー 172 件の支払サイト列: 全件「2日後」（`surveyOrderPaymentTerms` 実測）
- → 既定値 2 日は実データと一致

### 検証結果

- `?preview` 確認: `/orders/new` で受注日・支払期日フィールドが消えていること、0 React エラー ✓
- `npm run build:gas` 通過
- CI 通過、DEV デプロイ完了
- SHA 照合: deployedSha = `56d9e125...` = `origin/develop` HEAD ✓
- conformance audit: 総不一致 0 → PASS

### 戻し方

`git revert 56d9e125` で GAS ロジック・フロント変更の両方を元に戻せる

---

## 【11】在庫状態プルダウンをプリフェッチ化（商品選択時の待ち時間を除去） — PR #382

**マージ日時**: 2026-08-22T17:15:57Z
**revert用SHA**: `efad153df11b5217d6e351e10e936f0714693ac1`

### 1-A 調査結果（明細状態即時化の調査）

**待ち時間の原因**:
- `OrderEditorPage.tsx` L159: `repository.listConditions(productId)` を商品選択時に GAS 呼び出し
- `QuoteEditorPage.tsx` L126: `getInventoryConditions(productId)` を商品選択時に直接呼び出し
- `usePrefetch.ts` には `ensureInventory`（SharedInventoryDto[] のプリフェッチ）が既に含まれていた
- `SharedInventoryDto` には `productId`, `condition`, `quantity`, `unitPrice` が含まれていた
- **欠如**: `SharedInventoryDto` に `unitWeight` がなかった（`getInventoryConditions` は商品マスタ同期の Box重量/Case重量から取得していた）

**解決策**:
- GAS の `buildSharedInventoryRows_` に `unitWeight` を追加（productMap に boxWeight/caseWeight を追加）
- フロント型に `unitWeight` を追加
- `useInventoryConditionsMap()` フックで SharedInventoryDto[] を Map に変換
- OrderEditorPage / QuoteEditorPage で GAS 呼び出しを排除

### 変更ファイルと変更内容

| ファイル | 変更内容 |
|--------|---------|
| `src/28_SharedInventoryReadApi.js` | buildSharedInventoryRows_ に unitWeight を追加 |
| `frontend/src/gas/client.ts` | SharedInventoryItem に unitWeight 追加 |
| `frontend/src/features/inventory/contracts.ts` | SharedInventoryDto に unitWeight 追加 |
| `frontend/src/pages/inventory/InventoryListCacheContext.tsx` | useInventoryConditionsMap() フック追加 |
| `frontend/src/pages/orders/OrderEditorPage.tsx` | listConditions GAS 呼び出し削除、useInventoryConditionsMap() 使用 |
| `frontend/src/pages/quotes/QuoteEditorPage.tsx` | getInventoryConditions GAS 呼び出し削除、useInventoryConditionsMap() 使用 |
| `frontend/src/features/orders/contracts.ts` | OrderRepository から listConditions を削除 |
| `frontend/src/features/orders/gasAdapter.ts` | listConditions 実装を削除 |
| `frontend/src/preview/gasRunnerMock.ts` | getSharedInventoryForFrontend を MOCK_SHARED_INVENTORY で応答するよう更新 |

### ?preview 確認結果

- オーダー新規作成（`/?preview#/orders/new`）: 商品選択後に即座に「Sealed box（在庫: 5）」「Case（在庫: 3）」表示 ✓
- 見積もり新規作成（`/?preview#/quotes/create`）: 同様に即座に表示 ✓
- コンソールエラー: 0件（OrderListPage の既存警告は今回変更と無関係）

### SHA照合

- getDeployedSha: `efad153df11b5217d6e351e10e936f0714693ac1`
- origin/develop HEAD: `efad153` ✓ 一致

### conformance audit 結果

**★FAIL**: 総不一致 1件
- `ORDERS / オーダー管理`: 定義 40 列 / 実シート 42 列 → 差 2 列
- 今回の変更はオーダー管理シートに一切触れていない（変更は SharedInventoryReadApi のみ）
- PR #377 時点では audit PASS だった → この 2 列の乖離は今回マージ後に初めて検出

**停止条件に該当**: AUTONOMOUS_WORK_RULES.md「runCoreSchemaConformanceAudit が FAIL → 即座に revert」
→ ORDERS 列数不一致の原因調査のため報告して停止。PO の指示を待つ。

### 戻し方

```
git revert efad153
```

---

## 【12】複数提供者の在庫表示調査（調査のみ）— 実施済み

**調査日時**: 2026-08-22

### 1-B 調査結果

**PR #313 の cheapest_one 集約ロジック**
- ファイル: `src/28_SharedInventoryReadApi.js` L162-173
- `applyInventoryDisplayMode_()` 関数が実装
- `product_id × Condition` をキーにグループ化し、Unit Price が最安の 1 行のみ採用
- 表示設定マスタ（DISPLAY_SETTINGS シート）から `inventory/display_mode` を読み取り
  - 設定値: `cheapest_one`（在庫画面で最安1件のみ表示）または `all`
  - 設定取得失敗時は `all` にフォールバック

**現在の画面が表示する在庫数と単価**
- display_mode = `cheapest_one` の場合: product_id × Condition ごとに最安1件のみ
- SharedInventoryDto として返される量は集約後の数量

**共用在庫シートの構造**
- 同じ商品・同じ状態の行が複数存在し得る（複数の提供者が出す場合）
- `cheapest_one` モードではその中から最安1行のみを採用
- 件数の実測: 99_DisplaySettingsVerify.js で確認可能（PO 判断の範囲）

---

## [2026-08-22] PR8 (#383): Registry にオーダー入金確認列を追加（42列実態合わせ）+ DEVテストデータ関数新設

### 変更前の状態

`src/00_CoreSchemaRegistry.js` の `ORDERS.headers` は40列を定義していたが、
シートの実態は42列（入金確認元・入金確認者IDが手動追加済み）だった。

### 変更内容（ファイル単位）

- `src/00_CoreSchemaRegistry.js`: PAYMENT_CONFIRMATION_SOURCE を20列目（支払確認日の直後）に、
  PAYMENT_CONFIRMED_BY_ID を29列目（受注担当IDの直後）に挿入。40列→42列に修正。
  ORDERS.values に PAYMENT_CONFIRMATION_SOURCE グループ（手動 / PayPal自動）を追加。
  ORDERS.referenceIds に `{ PAYMENT_CONFIRMED_BY_ID → STAFF }` を追加
- `src/99_DevReferenceIntegrityAudit.js`: DEV_REFERENCE_INTEGRITY_RELATIONSHIPS 末尾に
  `['担当者マスタ', '担当者ID', 'オーダー管理', '入金確認者ID', 'OPTIONAL']` を追加
- `src/99_TestFunctions.js`: createDevTestUnpaidOrder を追記。
  環境ガード・二重実行防止・LockService・物理ヘッダー名直書き禁止（getCoreSchemaV1HeaderName 使用）・
  calculateOrderStatus / calculatePaymentStatus 使用・OD/ODL採番ロジックを実装

### 変更理由

DEVシートに手作業追加された2列（入金確認元・入金確認者ID）を Registry に追従させ、
validateCoreSchemaV1TableForWrite を使う全関数がこれら列を認識できるようにするため。
併せて DEV 環境でのテストデータ投入を可能にする関数を新設。

### 検証結果

- `clasp run runCoreSchemaConformanceAudit`: 総不一致 **0** （ORDERS 42列一致含む）
- `clasp run runAndLogDevReferenceIntegrityAudit`: 孤立参照 **0** （全20リレーション）
  - 入金確認者ID: 孤立参照数=0 / EMPTY_REFERENCE_ALLOWED（172件全て空欄）
- CI: frontend-check pass / gas-global-namespace pass
- Deploy to DEV: success（run #32587457370）

### マージコミット SHA

fd084eda2725ec7ba675afb947982fb0e0aa8e4c

### 戻し方

```
git revert fd084eda2725ec7ba675afb947982fb0e0aa8e4c
```

---

## 【13】社内メモ列の調査（調査のみ）— 実施済み

**調査日時**: 2026-08-22

### 1-C 調査結果

**ORDERS シートの備考・メモ関連列（Core Schema V1 定義より）**

| 列キー | 日本語列名 | 用途 |
|-------|----------|------|
| SHIPPING_NOTE | 発送時メモ | 発送時の注意事項（顧客向け） |
| NOTE | 備考 | 一般備考 |
| TRANSACTION_NOTE | 取引備考欄 | 取引に関する備考 |
| CANCELLATION_NOTE | キャンセルメモ | キャンセル理由の詳細 |

**GAS コード内の使われ方**
- `SHIPPING_NOTE`（発送時メモ）: `35_SalesDataSyncService.js` L22-28 で「顧客発送時メモ」として使用。`buildComment()` 関数でコメント生成に使用
- `NOTE`（備考）: `99_Phase5BConfirm.js` 等で仕入れ備考として使用
- `TRANSACTION_NOTE`（取引備考欄）: `99_Phase5BConfirm.js` L279 で使用
- `CANCELLATION_NOTE`（キャンセルメモ）: Core Schema 定義のみ

**PDF への出力確認**
- `27_WebApp.js` L7905: `customerShippingMemo`（SHIPPING_NOTE）が PDF 生成に使われている

**「社内メモ」用途への適合性**
- 既存列で請求書発行時の「社内メモ」として最も近いのは `NOTE`（備考）
- ただし `NOTE` は複数用途に使われており、社内メモ専用ではない
- 専用の「社内メモ」列が必要な場合は `INTERNAL_NOTE`（内部メモ）列の新設が適切
- 列新設はシートへの列追加を伴うため、PO の判断が必要

---

## 【14】支払期日バッジ表示改善 — PR #395

**実施日時**: 2026-08-22

### 変更前

支払期日のセルに背景色をつけた Badge で日付を包んで表示していた。
- `支払期日 < 今日` → `<Badge variant="danger">{日付}</Badge>`
- `支払期日 <= 今日+1日` → `<Badge variant="warning">{日付}</Badge>`
- それ以外 → 日付テキストのみ

「今日」と「明日」が同じ warning 色で区別できず、文言もなかった。

### 変更内容

日付は通常テキスト、右隣にテキスト付きの状態バッジを追加。

| 条件 | バッジ文言 | 色 |
|------|----------|-----|
| 支払期日 < 今日 | 期限超過 | danger（赤） |
| 支払期日 = 今日 | 本日期日 | warning（黄） |
| 支払期日 = 明日 | 期日1日前 | warning（黄） |
| それ以降 | なし | - |
| 空 | なし（「-」表示） | - |

しきい値「明日」は既存の `PAYMENT_DUE_WARNING_DAYS = 1` を流用（新定数なし）。

**変更ファイル（frontend のみ、3ファイル）:**
- `frontend/src/content/ja/salesOrders.ts` — `paymentDueBadgeOverdue` / `paymentDueBadgeToday` / `paymentDueBadgeTomorrow` を追加
- `frontend/src/pages/sales-orders/SalesOrderListPage.tsx` — `renderPaymentDueAtCell` を新ロジックに更新
- `frontend/src/pages/sales-orders/SalesOrderListPage.css` — `.sales-order-list-page__payment-due-cell` を追加

### 調査結果（変更なし）

**A. OD-00174 が存在する理由**
- 【事実】ORDERS テーブルには OD-00173（1件版シードで作成）と OD-00175/176/177（3件版シードで作成）の間に OD-00174 が存在する。
- 【未確認】`getCoreOrdersForFrontend` は SESSION_REQUIRED のため `clasp run` では呼び出せず、登録日・請求書番号・ステータスをこのセッションから確認できていない。スプレッドシートを直接確認してください。

**B. テストデータの金額が空になっている理由**
- 【事実】`src/99_DevTestOrderSeed.js` が ORDERS シートに `appendRow` する際、`col('INVOICE_TOTAL')` および `col('INVOICE_TOTAL_JPY')` を一切呼んでいない（L191–207 に記述なし）。配列は空文字列で初期化されるため、これらの列は空のまま書き込まれる。
- 【事実】`INVOICE_TOTAL` は `src/28_CoreOrderUpdateApi.js` の `updateCoreOrderForFrontend` 関数（L115–116）が明細合計＋各種費用から計算して書き込む。シードデータは `updateCoreOrderForFrontend` を呼ばず直接 `appendRow` するため、金額が設定されない。
- 【結論】シードデータの金額が空なのは仕様通りの結果（シードは支払期日バッジの確認用であり、金額計算は対象外）。

### 検証結果

- `npm run build:gas` 通過（typecheck + vite build + emit-gas-html + design-system check）
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 **0**（GAS 変更なし）
- CI: PASS（deploy-dev.yml: success）
- PO 実機確認待ち: OD-00176 赤バッジ / OD-00175 黄バッジ / OD-00177 バッジなし

### 補足: OD-00174 の後処理

PO が手動削除し完了。削除後の /sales-orders は すべて 175 / タブ合計 175 で一致。
「不明」ステータスは 0 件になった。

### マージコミット SHA

e0eafe480182d5450d0134b048ce2e33ab4a4723

### 戻し方

```
git revert e0eafe480182d5450d0134b048ce2e33ab4a4723
```

---

## 【15】支払期日バッジの位置ズレ修正 — PR #396

**実施日時**: 2026-08-23

### 現象

支払期日列で、バッジがある行（OD-00175/176）の日付が左にずれる。
バッジのない行（OD-00177）と日付の右端が揃わない。

### 原因

バッジあり行は `<span class="cell">[日付][バッジ]</span>` の幅 = 日付幅 + gap + バッジ幅。
バッジなし行は `[日付テキスト]` の幅 = 日付幅のみ。
セルが `text-align: center` で中央揃えされているため、セル幅が違うと日付の左端位置がずれる。

### 修正

バッジなし行にも同じ幅の空スロットを常に置き、全行のセル幅を揃える。

- CSS: `inline-flex` → `inline-grid`、バッジ列幅を `--_badge-col: 5rem` で1箇所に定義
- TSX: `let badge: ReactNode` を宣言し、バッジあり/なしを分岐後、
  常に `<span><{日付}><span aria-hidden>{badge}</span></span>` を返す
  （バッジなし時は空 `<span>` がグリッド列を占有するため幅は変わらない）

**変更ファイル（frontend 2ファイル）:**
- `frontend/src/pages/sales-orders/SalesOrderListPage.css`
- `frontend/src/pages/sales-orders/SalesOrderListPage.tsx`

### 検証結果

- `npm run build:gas` 通過（typecheck + vite build + emit-gas-html + design-system check）
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 **0**（GAS 変更なし）
- CI: PASS（deploy-dev.yml: success）
- PO 実機確認: OD-00175/176/177 の日付右端が縦一直線に揃っていることを確認済み

### マージコミット SHA

457ef47f394b748ce875fd2f050cc1e29c788a44

### 戻し方

```
git revert 457ef47f394b748ce875fd2f050cc1e29c788a44
```

---

## 【16】支払期日セルのレイアウト調整（日付を列中央に配置） — PR #399

**実施日時**: 2026-08-23

### 現象

PR #397 で日付の右端は揃ったが、日付＋バッジの塊が列中央より左に寄って見える。
バッジが右に付く分、全体が左にオフセットしているため。

### 原因

2カラムグリッド `max-content var(--_badge-col)` では、日付とバッジの合計幅が
列内で中央揃えされる。日付単体ではなく塊全体が中央になるため、
バッジのない行と位置が揃わない（日付が左に見える）。

### 修正

3カラムグリッド `var(--_badge-col) 1fr var(--_badge-col)` に変更。

| カラム | 内容 | 備考 |
|--------|------|------|
| 1列目 | 空スペーサー（aria-hidden） | 常に確保 |
| 2列目 | 日付テキスト | 1fr → コンテンツ幅 |
| 3列目 | バッジスロット（justify-self: end） | バッジなし時も5rem確保 |

3カラムが対称（左右とも `--_badge-col: 5rem`）なため、
1fr 列の日付が常にセル全体の中央に配置される。

**変更ファイル（frontend 2ファイル）:**
- `frontend/src/pages/sales-orders/SalesOrderListPage.css` — grid-template-columns 変更 + badge-slot クラス追加
- `frontend/src/pages/sales-orders/SalesOrderListPage.tsx` — 先頭スペーサー追加・badge-slot クラス付与

### 検証結果

- `npm run build:gas` 通過（typecheck + vite build + emit-gas-html + design-system check）
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 **0**（GAS 変更なし）
- CI: PR #399 で確認予定
- PO 実機確認待ち: OD-00175/176/177 の日付が列中央に揃い、バッジが列右端に揃っていること

### マージコミット SHA

（マージ後に記録）

### 戻し方

```
git revert <マージコミットSHA>
```

---

## 【17】調査記録: updateCoreOrderForFrontend と recalculateOrderStatusById の乖離

- 調査日: 2026-08-23
- 事実: src/28_CoreOrderUpdateApi.js は recalculateOrderStatusById を呼び出していない。
        JSDoc には「updateCoreOrderForFrontend から呼び出すことを想定」とあるが、
        実装ではインラインで calculateOrderStatus() + calculatePaymentStatus() を呼んでいる。
- 事実: clasp run dryRunOrderStatusRecalculation の結果（2026-08-23実測）:
        総件数175件、変更あり0件。既存データへの実害なし。
- 記録: /orders 経由の更新が増えた際（目安: 月次ベースで変更ありが1件以上）に再確認すること。
```

---

## 【19】PR18: デザイントークン実態調査・sales-orders 検査追加

- 日時: 2026-08-24
- PR: #（マージ後に記録）
- マージコミットSHA: （マージ後に記録）
- 戻し方: git revert <マージコミットSHA>

### 根本原因

`var(--undefined-token)` は CSS として有効な構文のため、ビルド・CI・check:design-system をすべて通過する。ブラウザはフォールバック値（継承値または初期値）を使用するため、画面が壊れていても静的解析では検出できない。

### 再発防止

`check-design-system.mjs` に未定義トークン検査を追加（sales-orders 対象、段階的に他ページへ拡大予定）。未定義トークンの参照は `undefined CSS token: <name> in <file>` として build:gas を失敗させるようになった。

### 調査結果サマリ

**調査A: 定義トークン総数**: 329件（tokens.css + palette.css 合計）

**調査B: sales-orders の未定義トークン（修正前）**

| トークン名 | 件数 | 対象ファイル | 修正後 |
|------------|------|--------------|--------|
| `--font-size-xl` | 1 | SalesOrderDetailPage.css | `--page-header-title-size` |
| `--font-size-sm` | 7 | Detail + List | `--font-sm` |
| `--font-size-xs` | 3 | Detail + List | `--font-xs` |
| `--font-size-md` | 3 | SalesOrderDetailPage.css | `--font-md` |
| `--color-text-secondary` | 8 | Detail + List | `--color-text-muted` |
| `--color-text-tertiary` | 1 | SalesOrderListPage.css | `--color-text-muted` |
| `--radius-md` | 1 | SalesOrderDetailPage.css | `--radius-surface` |
| `--radius-sm` | 1 | SalesOrderListPage.css | `--radius-button` |
| `--color-surface-hover` | 1 | SalesOrderListPage.css | `--color-tab-surface-hover` |
| `--color-surface-selected` | 1 | SalesOrderListPage.css | `--color-tab-surface-active` |
| `--font-weight-medium` | 1 | SalesOrderListPage.css | `--font-weight-semibold` |

**調査B: sales-orders 以外の未定義トークン（修正対象外）**: 当初 Generator が「352件」と報告したが、これは誤集計だった。Generator は定義済みトークンとのクロスチェックをせず、全 `var()` 参照（当時 約982件）を未定義候補として列挙した可能性が高い。実際に `tokens.css` + `palette.css` と照合した結果、未定義トークンは **8件・5種のみ**（`--font-lg` 3件 / `--space-4` 2件 / `--ui-skeleton-table-columns` 1件 / `--color-success-700` 1件 / `--text-sm` 1件）。正しい集計方法: `node -e` で全 CSS の `var()` を取得し、定義済みトークン Set と差分を取る。

**調査C: raw値使用**: font-size raw px/rem = 0件、border-radius raw px = 0件、color hex/rgb = 0件（すべてトークン経由）。

**調査D: font-size値の使用分布**: `--font-sm`が18件（最多）。`--font-md`が4件。生値0件。border-radius は全件トークン経由。

### 検証結果

- `npm run build:gas` → design-system checks passed
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS
- PO実機確認待ち: sales-orders 一覧・詳細ページのフォントサイズ・色・角丸が意図通り見えること

---

## 【18】PR13: 受注管理詳細ページ（読み取り専用）

- PR番号: #406
- マージコミットSHA: （マージ後に記録）
- 対象: /sales-orders/:orderId
- 新規ファイル: SalesOrderDetailPage.tsx, SalesOrderDetailPage.css
- GAS: getCoreOrderDetailForFrontend を 28_CoreOrderReadApi.js に追加
- 戻し方: git revert <マージコミットSHA>
- dryRun（2026-08-23）: 175件中変更あり0件。実害なし。
- PO実機確認: OD-00175（登録なし確認）+ OD-00164（実データ確認）が必要

---

## 【20】管理センター Discord連携設定ページ — PR #438

- PR番号: #438
- マージコミットSHA: `b7fb2bd00f73ef0e02637f24049eeeec68aeb335`
- mergedAt: 2026-08-23T22:05:36Z
- 対象: 管理センター > 外部連携 > Discord連携設定（/discord-integration）
- 新規ファイル:
  - `src/34_DiscordSettingsApi.js`（GAS API 4関数）
  - `frontend/src/features/discordIntegration/contracts.ts`
  - `frontend/src/features/discordIntegration/gasAdapter.ts`
  - `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx`
  - `frontend/src/content/ja/discordIntegration.ts`
- 変更ファイル:
  - `frontend/src/app/navigation.ts`（discordIntegration ページ追加、state: 'preview'）
  - `frontend/src/gas/client.ts`（4関数追加）
  - `src/27_WebApp.js`（getPermissionsByRole に discordIntegration 追加）
- 戻し方: `git revert b7fb2bd00f73ef0e02637f24049eeeec68aeb335`
- Deploy to DEV: completed / success（2026-08-23T22:05:38Z、1m9s）
- U1〜U4確定:
  - U1: testDiscordConnection() — 引数なし、{success, botInfo:{username, id, discriminator}} — src/33_DiscordIntegrationService.js:23-87
  - U2: 管理センターグループ = EXTERNAL_LINK_SUB_ITEMS、admin_access — frontend/src/app/navigation.ts:86-89
  - U3: スクリプトプロパティ DISCORD_CHANNEL_IDS にJSON配列保存（saveNotificationSettings方式踏襲）
  - U4: .claspignore — 34_DiscordSettingsApi.js は除外なし
- S1〜S4: 全合格（Logger.logにトークンなし・フロント返却はマスクのみ・全関数checkPermission・実値ハードコードなし）
- V1〜V4: Playwright 全11 AC PASS・build:gas 成功・未設定時エラー表示確認済み・権限ガード実装済み
- スコープ外（次PR）: 受信箱への実データ同期（inbox gasAdapter実装）

---

## 【21】PR19: デザイントークン6件追加・未定義参照解消・検査を全体に拡張 — PR #448

- 日時: 2026-08-24
- PR: #448
- ブランチコミット SHA: fd6a22c86d15055bae64dcd873d461e38c353a25
- マージコミット SHA: （マージ後に記録）
- 戻し方: git revert <マージコミットSHA>

### 変更内容

**tokens.css に追加した6件**

| トークン | 値 | 根拠 |
|----------|-----|------|
| `--font-lg` | 18px | 3箇所（quotes/orders editor・orders detail）で合計金額の強調表示に使用中だった未定義参照を正式化 |
| `--text-sm` | `var(--font-sm)` | `--font-sm` の別名（IssuerMasterPage が参照）|
| `--color-success-strong` | `var(--palette-success-text)` | 白背景上の成功メッセージテキスト。palette.css の既存シェード（#22543d）を使用。独自色値は設けず |
| `--transition-fast` | `var(--motion-fast)` | `--motion-fast` の別名（MultiSelect.css が参照）。値を二重管理しないよう別名とした |
| `--radius-xs` | 4px | MultiSelect.css で参照。palette に4px相当なし → 実値定義 |
| `--line-height-tight` | 1.25 | MultiSelect.css で参照。palette に汎用 line-height トークンなし → 実値定義 |

**IssuerMasterPage.css 修正**

- `--space-4` → `--space-lg`（16px、palette-space-4 と同値のため別名で置換）
- `--color-success-700` → `--color-success-strong`

**check-design-system.mjs 拡張**

- 未定義トークン検査対象を `pages/sales-orders/` 限定 → `frontend/src/` 全体に変更
- 除外: `--ui-skeleton-table-columns` のみ（コンポーネントAPIのため。コメントあり）

**docs/DESIGN_TOKENS.md 新設**

- よく使う20件（使用回数順）＋全件一覧を掲載
- 「この表にある名前だけを使う」旨と「未定義参照は画面だけ壊れる」旨を明記

### 検証結果

- `npm run build:gas` → PASS（design-system checks passed）
- `npm run check:design-system` → 違反0（frontend/src/ 全体、--ui-skeleton-table-columns除外）
- `clasp run runCoreSchemaConformanceAudit` → 総不一致 0 → PASS
- PO実機確認待ち（合計金額18px・発行元マスタ・MultiSelect）

### ナレッジ: 未定義CSS変数の挙動

`var(--undefined-token)` はビルドも CI も通過する。ブラウザはフォールバック値（継承値または `initial`）を使用するため、**画面だけが静かに壊れる**。check:design-system の全体検査により今後は CI でブロックされる。

### データ事実: PY-00012（支払先マスタ）

`dryRunGetPaymentDestination("PY-00012")` の結果: `DISPLAY_NAME = ''` / `BILLING_NAME = ''`。フロントが「-」と表示するのはデータ未入力によるもので、コードのバグではない。

### 事実: OD-00177 の入金確認

`dryRunGetOrderStatus("OD-00177")` の結果: `STATUS = '仕入れ中'` / `PAYMENT_STATUS = '入金済み'` / `PAYMENT_CONFIRMED_AT = '2026-08-23T15:50:24.716Z'`。DEV 実機で入金確認機能が動作し、ステータス遷移が記録されていることを確認済み。また `dryRunOrderStatusRecalculation` の差分 0件（サイドエフェクトなし）も確認済み。

---

## 【21】Discord OAuth Bot招待フロー実装 — Phase 2-A

- 日時: 2026-08-24
- ブランチ: release/discord-oauth-invite
- PR: #459
- マージコミット SHA: （マージ後に記録）
- 戻し方: git revert <マージコミットSHA>

### 変更ファイル一覧と目的

| ファイル | Change kind | 目的 |
|----------|-------------|------|
| `src/35_DiscordOAuthApi.js` | new feature | generateDiscordOAuthUrl / getDiscordOAuthStatus / handleDiscordOAuthCallback / createDiscordCallbackHtml |
| `src/27_WebApp.js` | feature extension | doGet に Discord OAuthコールバック分岐追加（state パラメータ判定） |
| `frontend/src/gas/client.ts` | feature extension | generateDiscordOAuthUrl / getDiscordOAuthStatus 関数追加 |
| `frontend/src/gas/types.d.ts` | feature extension | GoogleScriptRun に2メソッド追加 |
| `frontend/src/features/discordIntegration/contracts.ts` | feature extension | DiscordOAuthUrlResult / DiscordOAuthStatusResult 型・Repository メソッド追加 |
| `frontend/src/features/discordIntegration/gasAdapter.ts` | feature extension | generateOAuthUrl / getOAuthStatus メソッド追加 |
| `frontend/src/content/ja/discordIntegration.ts` | feature extension | Bot招待セクションのcopyキー追加 |
| `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx` | feature extension | Bot招待UIセクション追加（招待ボタン・Guild連携状態・状態確認ボタン） |
| `frontend/src/preview/gasRunnerMock.ts` | feature extension | generateDiscordOAuthUrl / getDiscordOAuthStatus モック追加 |
| `frontend/dist/index.html` | artifact | build:gas 再生成 |

### S1〜S7 実測結果

**S1: Logger.logへの秘匿情報出力**
```
$ grep -n "Logger.log" src/35_DiscordOAuthApi.js
9:  * - Logger.log に CLIENT_ID・state・guild_id を渡さない
54:    Logger.log('generateDiscordOAuthUrl error: ' + error.message);
75:    Logger.log('getDiscordOAuthStatus error: ' + error.message);
```
→ error.message のみ出力。CLIENT_ID・state・guild_id は含まない。合格。

**S2: getDiscordOAuthStatusの戻り値にCLIENT_IDを含まない**
→ `return { guildId: guildId || null }` のみ返却。CLIENT_IDは含まない。合格。

**S3: checkPermission('admin_access')が両関数に存在**
```
$ grep -n "checkPermission" src/35_DiscordOAuthApi.js
8:  * - 全関数に checkPermission('admin_access') でガード
31:    checkPermission('admin_access');
70:    checkPermission('admin_access');
```
→ generateDiscordOAuthUrl (L31) / getDiscordOAuthStatus (L70) 両方に存在。合格。

**S4: DISCORD_CLIENT_IDプロパティキー名のみ（実値なし）**
```
$ grep -rn "DISCORD_CLIENT_ID\s*=" src/
（出力なし）
```
→ 実値の代入は0件。getProperty('DISCORD_CLIENT_ID') のみ。合格。

**S5: permissions値の内訳（Kick/Ban削除後）**
- 削除前: 805432406（KICK_MEMBERS + BAN_MEMBERS を含む）
- 削除後: 805432400（KICK_MEMBERS 0x2・BAN_MEMBERS 0x4 を除去）
- 残存権限内訳:
  - MANAGE_CHANNELS (0x10 = 16)
  - ADD_REACTIONS (0x40 = 64)
  - VIEW_CHANNEL (0x400 = 1024)
  - SEND_MESSAGES (0x800 = 2048)
  - MANAGE_MESSAGES (0x2000 = 8192)
  - EMBED_LINKS (0x4000 = 16384)
  - ATTACH_FILES (0x8000 = 32768)
  - READ_MESSAGE_HISTORY (0x10000 = 65536)
  - MANAGE_ROLES (0x10000000 = 268435456)
  - MANAGE_WEBHOOKS (0x20000000 = 536870912)
- 使用根拠: Botがチャンネル管理・メッセージ送受信・役職管理に必要な最小権限セット。合格。

**S6: state one-time消費**
```
$ grep -n "cache.remove" src/35_DiscordOAuthApi.js
107:  cache.remove(state);
```
→ state検証後に即remove。one-time消費を実装済み。合格。

**S7: guild_idフォーマット検証（Snowflake）**
```
$ grep -n "17,19" src/35_DiscordOAuthApi.js
110:  if (!guildId || !/^\d{17,19}$/.test(guildId)) {
```
→ /^\d{17,19}$/ でSnowflakeフォーマット確認。合格。

### ビルド検証

```
$ npm run build:gas
design-system checks passed
```
→ PASS（TypeScriptエラー0・デザインシステム違反0）

---

## 【22】Discord チャンネル Auto-setup（Phase 2-B） — PR #458

### 変更ファイル一覧と目的

| ファイル | 変更種別 | 目的 |
|---------|---------|------|
| `src/36_DiscordChannelSetupApi.js` | 新規作成 | カテゴリ + ticket-startチャンネル自動作成GAS API |
| `frontend/src/gas/client.ts` | 追記 | runDiscordAutoSetup / getDiscordSetupStatus 関数追加 |
| `frontend/src/gas/types.d.ts` | 追記 | GoogleScriptRun型に2関数追加 |
| `frontend/src/features/discordIntegration/contracts.ts` | 追記 | DiscordAutoSetupResult / DiscordSetupStatus 型追加 |
| `frontend/src/features/discordIntegration/gasAdapter.ts` | 追記 | リポジトリに runAutoSetup / getSetupStatus 追加 |
| `frontend/src/content/ja/discordIntegration.ts` | 追記 | セットアップUI用10件テキスト追加 |
| `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx` | 変更 | チャンネルセットアップセクション追加 |
| `frontend/src/preview/gasRunnerMock.ts` | 追記 | runDiscordAutoSetup / getDiscordSetupStatus モック追加 |
| `frontend/dist/index.html` | 自動生成 | build:gas 成果物 |

### セキュリティチェック実測結果

| # | チェック | 実測コマンド | 結果 |
|---|---------|------------|------|
| S1 | Logger.log に BOT_TOKEN 値なし | `grep -n "Logger.log" src/36_DiscordChannelSetupApi.js` | status/id/channelId のみ。BOT_TOKEN 0件 |
| S3 | 両関数に checkPermission('admin_access') | ファイル読み取り | 142行・253行で確認 |
| S4 | DISCORD_BOT_TOKEN= の代入なし | `grep -rn "DISCORD_BOT_TOKEN\s*=" src/36_DiscordChannelSetupApi.js` | 0-hit |
| S5 | permission_overwrites @everyone deny / Bot allow のみ | コードレビュー | applyPermissionOverwrites_ 関数で最小権限実装 |

### 冪等性の実装方法

`GET /guilds/{guild_id}/channels` でギルドの全チャンネル一覧を取得し、`name` と `type` が一致する既存チャンネルがある場合はそのIDを再利用する。新規作成は行わない。カテゴリ（type=4）と ticket-start チャンネル（type=0）それぞれについて独立して判定する。

### mergeCommit SHA

`8575fcbef423b06eaacfa466a02fee24f4761851`（2026-08-24T00:00:59Z）

### 戻し方

`git revert 8575fcbef423b06eaacfa466a02fee24f4761851`

---

## 【23】LEADS に IP_IDS（作品ID）列追加 — PR #437

- mergedAt: 2026-08-23T21:35:41Z
- マージコミット SHA: `5af2fd6dfe084675f40d1e4e509cc299fa9842eb`
- 戻し方: `git revert 5af2fd6dfe084675f40d1e4e509cc299fa9842eb`

---

## 【24】受信箱 GAS 読み取り API（Phase 1） — PR #445

- mergedAt: 2026-08-23T22:10:54Z
- マージコミット SHA: `b62e200ee59137b67a510f92e82f097a01671922`
- 戻し方: `git revert b62e200ee59137b67a510f92e82f097a01671922`

### 変更内容

- `src/28_CoreInboxApi.js` 新規作成
  - `getInboxConversationsForFrontend(sessionId, forceRefresh)` — 会話一覧（CacheService TTL 600s）
  - `getInboxConversationDetailForFrontend(sessionId, leadId)` — 会話詳細（messages + karte）
  - `buildInboxConversations_()` — 会話ログをリードID集約 + リード管理結合
  - `readInboxMessages_()` — 指定リードのメッセージ一覧（日時昇順）
  - `resolveConversationLogSheet_()` — '会話ログ' → '会話ログ（商談用）' 動的解決
  - `LEAD_PROGRESS_TO_INBOX_STATUS` — 進捗→InboxStatus マッピング

### 検証結果（dryRunVerifyInboxPhase1 実測）

- conversationListCount: 25（会話ログあり 24 + CONVERSATION_SUMMARY のみ 1）
- sheetUniqueLeadCount: 24
- LDI-00002 sampleMessageCount: 75
- LDI-00001 sampleMessageCount: 8

---

## 【25】DEV 診断: dryRunVerifyInboxPhase1 追加 — PR #447

- mergedAt: 2026-08-23T22:20:02Z
- マージコミット SHA: `db3676e06c887f02df30d654c812e9c104e41f97`
- 戻し方: `git revert db3676e06c887f02df30d654c812e9c104e41f97`

---

## 【26】受信箱フロント接続（Phase 2） — PR #449

- mergedAt: 2026-08-23T22:37:05Z
- マージコミット SHA: `d14bb3bb8960d92e9abb9789ff5a1183cf9508c8`
- 戻し方: `git revert d14bb3bb8960d92e9abb9789ff5a1183cf9508c8`

### 変更内容

- `frontend/src/features/inbox/gasAdapter.ts` 新規作成（InboxRepository → GAS クライアント橋渡し）
- `frontend/src/gas/client.ts` — getInboxConversations / getInboxConversationDetail 追加
- `frontend/src/gas/types.d.ts` — GoogleScriptRun 型に 2 メソッド追加
- `frontend/src/App.tsx` — inboxPreviewRepository → inboxGasRepository に差し替え
- `frontend/src/preview/gasRunnerMock.ts` — 5件モック（alpha/bravo/charlie/delta/echo）追加

---

## 【27】受信箱 3 ペイン UI 実装（Phase 3） — PR #453

- mergedAt: 2026-08-23T22:57:43Z
- マージコミット SHA: `f1237217a83fb0359a148fdadef995b8fbb67490`
- 戻し方: `git revert f1237217a83fb0359a148fdadef995b8fbb67490`

### 変更内容

- `frontend/src/pages/inbox/InboxPreviewPage.tsx` 全面書き換え — 遅延ロード（mount 時に listConversations のみ、選択時に getConversation + Map キャッシュ）
- `frontend/src/content/ja/inbox.ts` — eyebrow を 'Inbox preview' → 'Inbox' に変更
- `frontend/src/features/inbox/previewAdapter.ts` 削除（dead code）
- Deploy to DEV: CI 課金限度超過により **失敗**（GitHub Actions spending limit）

### Phase A DEV リカバリ（2026-08-24 実施）

GitHub Actions 課金停止による DEV 配布失敗を、ローカル `clasp push` で回復。

1. `.claspignore` 確認: `docs/`, `28_CoreInboxApi.js` は除外なし → 全ファイル対象 ✓
2. `npm run build:gas` → PASS（typecheck + vite + emit-gas-html + design-system check）
3. `clasp push --force` → 183 ファイル push 完了
4. `clasp run recordDeployedSha ["3b25543839071fa5ac4366302b63e04bb47f1977"]`
   → `{ sha: '3b25543...', deployedAt: '2026-08-24T06:45:39.695Z' }` ✓
5. `clasp run getDeployedSha` → `3b25543...` = develop HEAD ✓
6. `dryRunVerifyInboxPhase1("LDI-00002")` → conversationListCount=25 / sampleMessageCount=75 ✓
7. `dryRunVerifyInboxPhase1("LDI-00001")` → sampleMessageCount=8 ✓
8. 25 件目（CONVERSATION_SUMMARY のみ、会話ログなし）: **LDI-00233**（顧客実名は公開後監査で除去。詳細は `docs/PUBLIC_READINESS_SCAN.md` を参照）

### 公開後監査・DEV Deploy to DEV Run 512 再実行（2026-08-24）

- 合格条件（DEV）: Run 512 が成功し、`clasp run getDeployedSha` が `develop` HEAD と一致すること。
- 実測: `gh run rerun 32699033081 --failed` の再実行は **成功**。`deploy` job は全工程成功（42秒）。
  - `Build GAS artifact` は `npm run build:gas`（`typecheck` / `vite build` / `emit-gas-html` / design-system check）を実行。
  - `clasp run getDeployedSha` → `e4e6b66e3d360ba162c8dd742d41d2ccdbe5e330`。
  - `develop` HEAD → `e4e6b66e3d360ba162c8dd742d41d2ccdbe5e330`。一致。
  - Phase A の DEV API 実測: `LDI-00002` は会話一覧25件・メッセージ75件、`LDI-00001` はメッセージ8件。
- 画面照合: この実行環境には操作可能なブラウザ接続がなく、新規の実UI観測は未実施。上記は Phase A の DEV API 実測値。
- 公開後監査: `gitleaks git --log-opts="--all"` は0件、`trufflehog git file://. --no-update --only-verified` は verified/unverified とも0件。
- 補完grepで顧客実名1件を検出（本ログの旧記載、コミット `e4e6b66e3d360ba162c8dd742d41d2ccdbe5e330`）。GitHubリポジトリは `PRIVATE` へ復帰済み。現行ファイルから実名を除去した。履歴書換えは実施しない。
- 変更内容: 実名をID参照へ置換し、`docs/PUBLIC_READINESS_SCAN.md` を追加。
- 戻し方: 監査PR #462 のsquash mergeコミット `bc4453579a7f49bf3fda69b1223f0dfa4c53bc16` は `git revert bc4453579a7f49bf3fda69b1223f0dfa4c53bc16` で戻せる（実名の再公開はしない）。

### 履歴書換え（2026-08-24）

- バックアップ: `git clone --mirror` と `git bundle create --all` を実行し、バンドルから復元した `origin/develop` が書換え前の `3c16588c73e13ed639e76b6ace07a3d0e17ff4cc` と一致。
- 実施: `git-filter-repo --replace-text` で顧客実名のフルネーム・姓・名の3パターンを `[REDACTED]` へ置換。全パターンは同一の4コミットにのみ出現。
- SHA対応: `docs/SHA_REMAP_20260824.md` に filter-repo の commit-map（旧SHA→新SHA、1,108行）を保存。
- 読み替え: 過去のrevert SHAを含むすべての旧SHAは、同ファイルで新SHAに読み替えること。
