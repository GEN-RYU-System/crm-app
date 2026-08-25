# 自律作業ログ

> リポジトリ・クローンの正誤は `docs/REPOSITORY_CANONICAL_STATE.md` を参照。

> **develop凍結解除（2026-08-24）:** redaction2 v2 の履歴書換え・全履歴再スキャンを完了し、凍結を解除した。Actions を通常のDEVデプロイ経路とし、ローカル clasp は障害時のバックアップ経路とする。
>
> **並行作業者への必須告知:** 既存クローン／worktree は使用・push・fetch 禁止。新履歴を必ず再クローンすること。作業ログ内の旧SHA（revert SHAを含む）は `docs/SHA_REMAP_20260824.md`（v1）から `docs/SHA_REMAP_20260824_v2.md`（v2）へ順に連結して読み替える。
>
> **redaction2 v2:** 実ID 3件・実メール 5件・電話番号／登録番号 3件を置換対象とし、除外した数値列はシートgid・Git SHA・Actions run ID・ビルド生成物であり個人連絡先ではない。旧SHAは `docs/SHA_REMAP_20260824.md` と `docs/SHA_REMAP_20260824_v2.md` を順に参照する。

> **履歴書換え済み（2026-08-24）:** すべての作業者は旧クローン／旧worktreeを使用・pushせず、必ず新履歴を再クローンすること。旧SHAは `docs/SHA_REMAP_20260824.md` で新SHAへ読み替える。

このファイルは Claude Code による自律実装セッションの記録です。
各エントリは PR 単位で記述されます。

---

## 【発行元seed】Script Propertiesによる実値分離

### 変更内容
- 発行元seedは、設定済みの場合にScript Propertiesを参照し、未設定の場合は公開可能なダミー値を使用する。

### 必要なプロパティキー
- `ISSUER_SEED_COMPANY_NAME`
- `ISSUER_SEED_CONTACT_NAME`
- `ISSUER_SEED_ADDRESS_LINE1`
- `ISSUER_SEED_ADDRESS_LINE2`
- `ISSUER_SEED_ADDRESS_LINE3`
- `ISSUER_SEED_CITY`
- `ISSUER_SEED_STATE`
- `ISSUER_SEED_ZIP`
- `ISSUER_SEED_COUNTRY`
- `ISSUER_SEED_PHONE`
- `ISSUER_SEED_EMAIL`
- `ISSUER_SEED_REGISTRATION_NO`
- `ISSUER_SEED_PAYEE_NAME`
- `ISSUER_SEED_PAYMENT_EMAIL`
- `ISSUER_SEED_PAYMENT_NOTE`
- `ISSUER_SEED_CLOSING_MESSAGE`

---

## 【Discord連携】保存と接続確認の統合 — PR #489

### 変更内容
- Botトークンの保存と接続確認を「保存して接続」ボタンへ統合した。
- 保存・接続成功、保存済み接続失敗、保存失敗を区別して表示するようにした。

### 検証結果
- `npm run build:gas --prefix frontend` 成功。
- `?preview#/discord-integration` のPlaywrightで3状態を確認。

### mergeCommit
`c2075ded9152f0003d5200ea02e8a1fc5f172172`

---

## 【通貨マスタ共通キャッシュ】PR作成前記録

### SHA訂正

- PR #467 の旧revert SHA `b38f145759607c23f74873a20783352550dfee22` は履歴書き換えにより無効化された。
- 正しいrevert対象: `b10aaf6bc9695e3b930a779aebc2c47f10ae7f2e`（`git revert b10aaf6bc9695e3b930a779aebc2c47f10ae7f2e`）。

### 合格条件と実測

- `?preview&previewProfile=quotes-only#/quotes` の背景プリフェッチ完了時: `getCoreCurrenciesForFrontend: 1`。
- 同プロファイルはUSD見積を1件返し、見積一覧は `JPY150,000（$1,000）` を表示。注文ナビゲーションは非表示。
- `frontend/npm run build:gas`: PASS（typecheck / Vite / emit-gas-html / design-system check）。

### 変更内容

- `CurrencyMasterCacheContext` を `CurrencyRecord[]` の唯一の正本とし、`useCurrencySymbolMap` だけが記号mapを派生する。
- 注文／見積一覧Contextと注文／見積編集画面の直接通貨取得を共通Context参照に置換した。
- `usePrefetch` は注文または見積のいずれかの権限がある場合に通貨キャッシュを取得する。
- preview限定で `previewProfile=quotes-only` とUSD見積モックを追加した。

### PR / revert

- PR #503 をsquash merge。マージコミット SHA: `ed38300b6b61910a31468e57af9f46e138a307fe`。
- 戻し方: `git revert ed38300b6b61910a31468e57af9f46e138a307fe`。
- Deploy to DEV run `32777170062` は成功し、`getDeployedSha` は同じSHAを返した。

### 別PR候補: 重複呼出しの起点（修正なし）

- `getSessionUser=2`: `AuthContext.tsx` の認証用 `useEffect`（`getSessionUser`）がReact StrictModeの開発時再実行を受ける。
- `getCurrentUser=2` / `getDashboardKPIs=2`: `App.tsx` の初期 `useEffect` が `loadPermissions` / `load` を同時に起動し、同じStrictMode再実行を受ける。
- `getCoreOrdersForFrontend=2`: `usePrefetch.ts` の `ensureOrders` がStrictModeの開発時再実行を受ける。通常のキャッシュ内重複ではなく、StrictModeでProviderを再生成するプレビュー実測に起因する。
- 計画1〜11では、初期ロードのStrictMode耐性を扱う箇所に別PRとして追加する。今回の通貨キャッシュPRには実装修正を含めない。

---

## 【Phase 0】Lead detail keyed cache 再調査

### canonical上の根拠

- `frontend/src/pages/leads/LeadListCacheContext.tsx` は `createListCache<LeadRecord, LeadListTabType>` を使い、一覧を `all` / リード種別で保持している。
- `frontend/src/pages/leads/LeadEditorPage.tsx` は一覧に対象leadIdがない場合、`repository.getDetail(leadId)` を直接呼び出している。
- `frontend/src/features/leads/contracts.ts` と `gasAdapter.ts` は、詳細取得の境界として `LeadRepository.getDetail` を提供している。
- `frontend/src/preview/gasRunnerMock.ts` は `__gasMockCallCounts` で `getLeadDetail` を関数名別に計数できる。

### 計画1の合格条件

- `/leads/:leadId` を開き、一覧へ戻って同じ詳細を再度開いたとき、`getLeadDetail` の生出力が初回の `1` から増えない。
- 一覧に未命中のleadIdでは `LeadRepository.getDetail` を `createListCache` のleadIdキーで取得し、nullはmissingとしてキャッシュする。

### 計画1の生出力

```text
first:  getLeadDetail = 1
second: getLeadDetail = 1
PASS: detail reopen did not issue another getLeadDetail call
```

### PR / revert / deploy

- PR #507 を squash merge。マージコミット SHA: `e459264a0a47d897191198b7ce508aac41c05fb7`。
- 戻し方: `git revert e459264a0a47d897191198b7ce508aac41c05fb7`
- Deploy to DEV run `32778593946` は成功。`getDeployedSha` 生出力の SHA は同じ `e459264a0a47d897191198b7ce508aac41c05fb7`。

---

## 【アプリ全体プリフェッチ標準化 Phase 0】取得経路再調査

### PR #508 の確認

- `git show --stat --oneline 3a8a1d0` の生出力は `3a8a1d0 docs: record lead cache merge (#508)`、変更は `docs/AUTONOMOUS_WORK_LOG.md | 6 ++++++` のみ。
- 内容は PR #507（Lead detail keyed cache）の squash merge SHA、`git revert e459264a0a47d897191198b7ce508aac41c05fb7`、Deploy to DEV run `32778593946` と当時の deployed SHA 一致の記録である。アプリ全体プリフェッチの計画表は含まない。

### 読んだファイルと取得経路

- ルーティング: `frontend/src/App.tsx`。業務画面は dashboard / leads / customers / quotes / orders / inventory / staff / issuerMaster / discordIntegration / inbox / salesOrders。カタログ、認証、データ管理はこの調査時点で repository 読み取りなし。
- 共通裏読み: `frontend/src/app/usePrefetch.ts`。権限に応じ、lead list・lead form options・customer list・customer aggregates・inventory・orders・currencies・sales orders・staff・quotes を各 cache の `ensureLoaded` 経由で読む。
- Cache 実装: `frontend/src/app/createListCache.tsx`、`frontend/src/pages/{leads,customers,inventory,orders,quotes,sales-orders,staff}/*CacheContext.tsx`、`frontend/src/features/customers/CustomerAggregateCacheContext.tsx`、`frontend/src/pages/currency/CurrencyMasterCacheContext.tsx`。
- 直接詳細取得: `frontend/src/pages/customers/CustomerDetailPage.tsx` は `repository.getCustomer(customerId)` を `useEffect` で直接呼ぶ。`frontend/src/pages/leads/LeadEditorPage.tsx` は `LeadDetailCacheContext` に置換済み。`frontend/src/pages/orders/OrderDetailPage.tsx` は在庫選択肢を直接取得する。
- 編集ページの補助取得: `frontend/src/pages/orders/OrderEditorPage.tsx` は顧客・在庫・顧客 aggregate、`frontend/src/pages/quotes/QuoteEditorPage.tsx` は lead options・issuer・quote detail・inventory options、`frontend/src/pages/inbox/InboxPreviewPage.tsx` は会話一覧・選択会話詳細、`frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx` は接続/チャンネル/OAuth/setup 状態を直接取得する。
- GAS 境界: `frontend/src/features/*/gasAdapter.ts` と `frontend/src/gas/client.ts`。Customer は `getCoreCustomers` / `getCoreCustomer` / `getCoreAllCustomerAggregates` の三経路を持つ。`CustomerAggregateCache` は aggregate 一覧専用で profile を返す `getCustomer` の代替ではない。
- 検証モック: `frontend/src/preview/gasRunnerMock.ts`。GAS 関数 `getCoreCustomerForFrontend` は customerId 別 aggregate を返し、`__gasMockCallCounts` が関数名別に計数する。

### 生出力（取得呼び出し検索）

```text
frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx:52:        repository.getConnectionStatus(),
frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx:53:        repository.getChannels(),
frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx:54:        repository.getOAuthStatus(),
frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx:55:        repository.getSetupStatus(),
frontend/src/pages/orders/OrderDetailPage.tsx:166:      void repository.listInventoryProducts()
frontend/src/pages/inbox/InboxPreviewPage.tsx:25:        const rows = await repository.listConversations();
frontend/src/pages/inbox/InboxPreviewPage.tsx:44:        const detail = await repository.getConversation(selectedId);
frontend/src/pages/orders/OrderEditorPage.tsx:69:      repository.listInventoryProducts(),
frontend/src/pages/customers/CustomerDetailPage.tsx:18:  const load = useCallback(async () => { setState('loading'); setError(''); try { const result = await repository.getCustomer(customerId); setCustomer(result); setState(result == null ? 'missing' : 'ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : ''); setState('error'); } }, [customerId, repository]);
frontend/src/pages/leads/LeadDetailCacheContext.tsx:10:    const record = await repository.getDetail(leadId);
```

### 未対応一覧と小コスト順

1. Customer detail keyed cache — `CustomerDetailPage` の `repository.getCustomer` を customerId key の `createListCache` へ移す。profile を含むため既存 `CustomerAggregateCache` と分離する。合格条件: 詳細→戻る→同一詳細で `getCoreCustomer` が増えず、現ページに保存操作はない。
2. Order detail inventory options — 直接取得を既存/新規 cache 化できるか、編集ページとの option shape と更新要件を調査してから判断する。
3. Inbox detail / Discord integration status / Quote editor options / Order editor aggregate reads — 各ページに保存・状態更新・画面遷移の要件があるため、個別の合格条件と更新不変性を確定してから別PRで扱う。

### Phase 1 の合格条件（実装前定義）

- `/customers/:customerId` を開く→一覧へ戻る→同一詳細を再度開くで、`__gasMockCallCounts.getCoreCustomerForFrontend` が増えない。
- Customer detail は保存操作を持たないため、保存後更新の合格条件は非該当。
- list cache にない customerId を keyed cache が取得し、`null` は missing として cache する。

### Phase 1 の実装と検証

- `frontend/src/pages/customers/CustomerDetailCacheContext.tsx` を追加。`createListCache<CustomerAggregateDto, string>` を customerId key で使用し、`repository.getCustomer` の null は空配列として missing cache に保存する。
- `frontend/src/App.tsx` に `CustomerDetailCacheProvider` を追加し、`CustomerListCacheProvider` の内側へ配置した。
- `frontend/src/pages/customers/CustomerDetailPage.tsx` の mount 時直接 `repository.getCustomer` 呼び出しを、keyed cache の `ensureLoaded(customerId)` と cached result/error/retry 参照に置換した。Discord ticket 発行の既存動作は変更していない。
- Customer detail に保存操作はないため、保存後最新化の受入条件は非該当。

```text
__gasMockCallCounts (first):
getCoreCustomerForFrontend: 1

__gasMockCallCounts (same detail after back):
getCoreCustomerForFrontend: 1

customer input values: ["CUS-0001", "Preview Customer A", "", "JP", "", "", "", "", "Preview User", ""]
PASS: same customer detail was rendered and did not call getCoreCustomerForFrontend again
```

```text
npm run build:gas
> npm run typecheck && npm run build && node scripts/emit-gas-html.mjs && npm run check:design-system
✓ 515 modules transformed.
dist/index.html  477.03 kB │ gzip: 123.57 kB
✓ built in 1.11s
design-system checks passed
```

### PR / revert / deploy

- PR #516 を squash merge。マージコミット SHA: `2ed32ed1f9860bfed0257dc4d1c8f5f2adc57695`。
- 戻し方: `git revert 2ed32ed1f9860bfed0257dc4d1c8f5f2adc57695`
- Deploy to DEV run `32781866020` は成功。`getDeployedSha` 生出力: `{ sha: '2ed32ed1f9860bfed0257dc4d1c8f5f2adc57695', deployedAt: '2026-08-24T21:54:05.630Z' }`。

---

## 【InventoryProductOptions cache】Order detail の直接取得置換

### 合格条件（実装前定義）

- orders または quotes 権限の裏読み完了時点で、`getInventoryProductOptions` は全体で1回。
- 注文詳細で「金額を編集」を開いても、その呼び出し数は増えない。
- Order detail の金額保存は既存の `updateOrder` を維持し、商品選択肢の取得経路だけを置換する。

### 変更

- `frontend/src/pages/inventory/InventoryProductOptionsCacheContext.tsx` を追加。`getInventoryProductOptions()` の戻り値を変換せず、`createListCache` + `SINGLE_KEY` で保持する。
- `frontend/src/App.tsx` に Provider を登録し、`frontend/src/app/usePrefetch.ts` は orders または quotes 権限で `ensureLoaded` を実行する。
- `frontend/src/pages/orders/OrderDetailPage.tsx` の `repository.listInventoryProducts()` 直接取得を context の `ensureLoaded` / `products` / `loading` 参照に置換した。OrderEditorPage と QuoteEditorPage は未変更。

### 生出力

```text
__gasMockCallCounts (prefetch complete):
getInventoryProductOptions: 1

__gasMockCallCounts (after opening amount edit):
getInventoryProductOptions: 1

PASS: opening order amount edit did not call getInventoryProductOptions again
```

```text
npm run build:gas
> npm run typecheck && npm run build && node scripts/emit-gas-html.mjs && npm run check:design-system
✓ 516 modules transformed.
dist/index.html  477.55 kB │ gzip: 123.65 kB
✓ built in 831ms
design-system checks passed
```

### PR / revert / deploy

- PR #524 を squash merge。マージコミット SHA: `499dd9a27859d6c8e6a2e71d0b63dabca95a4ee9`。
- 戻し方: `git revert 499dd9a27859d6c8e6a2e71d0b63dabca95a4ee9`
- Deploy to DEV run `32786150669` は成功。`getDeployedSha` 生出力: `{ sha: '499dd9a27859d6c8e6a2e71d0b63dabca95a4ee9', deployedAt: '2026-08-24T22:46:20.060Z' }`。

---

## 【記録のみ】frontend/dist の rebase 競合

- `frontend/dist/index.html` は Git 管理対象であり、PR #524 を `origin/develop` へ rebase した際に同ファイルで content conflict が発生した。
- 解消は手編集せず、rebase 側を採用した後に `frontend/npm ci && npm run build` で生成し直した。
- 同じ生成物を複数PRが変更すると同様の競合が発生しうる構造的課題である。修正はこのPRでは行わない。
- デプロイ経路が Git 管理された `frontend/dist/index.html` を参照する必要性は未調査。追跡対象から外す／CI生成物へ移行する等の判断は、別途デプロイ経路の一次調査後に行う。

---

## 【InventoryProductOptions cache】Order editor の直接取得置換

### 合格条件（実装前定義）

- orders または quotes 権限の裏読み完了時点で `getInventoryProductOptions` は全体で1回。
- 新規注文編集を開いても同呼び出しは増えない。注文編集は保存操作を持つが、今回変更するのは商品選択肢取得のみで、既存の保存処理は変更しない。

### 変更と生出力

- `OrderEditorPage` の `repository.listInventoryProducts()` を `InventoryProductOptionsCacheContext` の `ensureLoaded` と `products` 参照へ置換した。
- `OrderEditorPage` 表示後の `__gasMockCallCounts.getInventoryProductOptions`: `1`。新規注文編集画面の表示を確認。
- `npm run build:gas`: typecheck / Vite build / design-system checks passed。

---

## 【InventoryProductOptions cache】Quote editor の直接取得置換

### 合格条件（実装前定義）

- orders または quotes 権限の裏読み完了時点で `getInventoryProductOptions` は全体で1回。
- 見積編集を開いても同呼び出しは増えない。見積の保存処理は変更しない。

### 変更と生出力

- `QuoteEditorPage` の直接 `getInventoryProductOptions()` を `InventoryProductOptionsCacheContext` の `ensureLoaded` / `products` 参照に置換した。
- Quote editor 表示後の `__gasMockCallCounts.getInventoryProductOptions`: `1`。
- `npm run build:gas`: typecheck / Vite build / design-system checks passed。

---

## 【発行元マスタseed匿名化】公開記載ルール準拠 — PR #493

### 変更内容
- 発行元マスタのseedに含まれる実名をダミー値へ変更し、実データはシートへ手入力する旨を明記した。

### 戻し方
`git revert 54baa8148bce7bd999b85b33166c732f716acc90`

---

## 【受信箱公開 Phase 4-1】DEVヘッダー監査関数

- `auditDevInboxSheetHeaders()` を追加。DEV限定で会話ログ・リード管理の1行目を読み、列数とヘッダー名だけをJSON文字列として返す。行データ・シートIDは返さない。
- 実測（唯一の正）: 会話ログ（商談用）は11列: `ログID, リードID, 日時, 送受信, 発言者, 原文, 原文言語, 翻訳文, 記録者ID, 記録日時, 商談解析`。リード管理は64列: `リードID, 登録日, 顧客名, リード進捗, 商談進捗, 商談結果, 呼び方（英語）, 国, シート更新日, リード担当者, リード種別, 流入経路, 流入元ID, メッセージURL, 取り扱いタイトル, 作品ID, CSメモ, メール, 電話番号, 連絡手段, 温度感, 想定規模, 返信速度, 問い合わせ回数, アーカイブ日, アーカイブ理由, アサイン日, 営業担当者, 担当者ID, 顧客タイプ, 最終対応者ID, 見込度, 次回アクション, 次回アクション日, 商談メモ, 相手の課題, 販売形態, 月間見込み金額, 1回の発注金額, 購入頻度(月次), 競合比較中, 商談の手応え, アラート確認日, 対象外理由, 失注理由, 初回取引日, 初回取引金額, 累計取引金額, Good Point, More Point, 反省と今後の抱負, レポート提出日, レポート確認者, レポート確認日, レポートコメント, Buddyフィードバック, 会話要約, 最終会話日時, 会話数, 重複フラグ, 重複元リードID, 重複確認日, 重複確認者, リードステータス`。
- PR #492 / squash merge SHA: `b4f2d50f7f42ae64db12105436281820844bc20d` / revert: `git revert b4f2d50f7f42ae64db12105436281820844bc20d`。DEV Deploy は成功（43秒）。

---

## 【受信箱公開 Phase 4-2】固定添字のヘッダー名参照化

### 全量一覧と実測判定

| 対象 | 種別 | 旧固定添字 | 実シートでの判定 | 対応 |
| --- | --- | --- | --- | --- |
| `10_ConversationLogService.js` `getConversationLogs()` | 読取 | `data[i][1]` | 会話ログ実測の2列目は「リードID」で現時点は正しい | `headers.indexOf('リードID')` へ置換 |
| `25_TestRunner.js` `createTestLead()` / 追加ログ | 書込 | `lead[0]`、`lead[5]`、`lead[19]`、`lead[41]`、および `row[0]`〜`row[42]` | 実リード管理は64列で、旧配列の3番目「リード種別」は実3列目「顧客名」へ書かれるなど、13列目「流入元ID」と16列目「作品ID」の挿入以降を含め不正 | 実シートのヘッダー順でオブジェクトを行へ変換し、すべてヘッダー名で読取・書込 |

- 単列の `getRange(..., 1, ..., 1)` から得る `row[0]` は、範囲指定で列1に限定済みのため対象外とした。
- PR番号、squash merge SHA、revert SHA、デプロイ後検証はマージ後に追記する。

---

## 【受信箱公開 Phase 4-3】Config整合（再作成）

- 失敗一次情報: PR #499 の Sensitive Content Check は `src/08_Config.js` のサンプルコメントを唯一検出した（検出値は `c***@a***.com`、同ファイルのコメント行）。検査は変更ファイル全体を対象にメール正規表現を適用し、許可ドメインは `example.com` 等に限定される。
- 判定: 実データではないサンプルコメントの検出。許可ドメインを広げず、コメントを許可ドメイン形式へ置換した。検出値・機密の疑いがある値は以後、ログ・PR説明・コミットメッセージで伏字のみを記録する。
- DEV実測どおり、`HEADERS.LEADS` の13列目へ「流入元ID」、16列目へ「作品ID」を追加し64列化。`HEADERS.CONVERSATION_LOG` は「原文」と「翻訳文」の間へ「原文言語」を追加し、11列目の「商談解析」まで含む11列に完全一致させた。
- 会話ログ11列目の「商談解析」は `rg "商談解析" .` でコード・文書とも参照0件。デプロイ済みシートにのみ存在する孤立ヘッダーで、追加元機能はリポジトリ内から特定不能。Configの列定義には実測整合のため保持する。
- PR #499 はこの一次情報に基づく再作成のためクローズした。新PRのCI・配布・revert SHAは完了後に記録する。

---

## 【npmキャッシュ除外】誤コミット防止 — PR #488

### 変更内容
- ルートおよび frontend の npm キャッシュディレクトリを .gitignore に追加した。

### 戻し方
`git revert c9a42a97e7683bb7a1ac6f7f1cd6d48ee621c8fc`

---

## 【受信箱公開 Phase 0–3】ナビゲーション昇格

- セッション健全性: `true` は exit 0・hook エラーなし。
- Playwright: Chromium CLI により `?preview#/` と `?preview#/inbox` のスクリーンショット取得に成功。受信箱ヘッダーにプレビューバッジがなく、一覧・詳細が表示されることを確認。
- DEV 件数照合: `dryRunVerifyInboxPhase1("LDI-00002")` は一覧25件、対象メッセージ75件。
- 変更範囲: inbox の navigation state を `available` に変更し、画面文言とバッジを公開状態へ整合。受注管理の state は未変更。
- 検証: `frontend/npm run build:gas` 成功。
- PR #485 / squash merge SHA: `0816cf107217fdec2371389b73876f79ba433a95` / revert: `git revert 0816cf107217fdec2371389b73876f79ba433a95`。

### Phase 4 停止記録

- 停止理由: 会話ログシートの列位置を固定で参照するコードを検出した。`src/10_ConversationLogService.js` の `getConversationLogs()` は `CONFIG.SHEETS.CONVERSATION_LOG` を開いた後、リードID照合に `data[i][1]` を使用している。
- 判定: 指示書の「直指定が1件でもあれば一覧化して停止・報告」に該当。`HEADERS.CONVERSATION_LOG` への「原文言語」追加、`HEADERS.LEADS` への「流入元ID」追加、DEV配布、Phase 5 は未実施。
- 補足: 調査では上記の会話ログ実行経路のほか、`src/25_TestRunner.js` にリード配列の固定添字（`lead[0]`〜`lead[42]`）を確認した。実行経路ごとのヘッダー名参照への置換方針は、この統合指示書の範囲外の設計判断となる。

---

## 【Discord設定API認証】セッション利用者を権限確認前に設定 — PR #484

### 変更内容
- `src/34_DiscordSettingsApi.js` の sessionId を受け取る4関数で、`checkPermission('admin_access')` の前に `setEmailFromSession(sessionId)` を追加した。
- 設定保存・取得の権限確認が、渡されたセッションの利用者を基準に実行される順序へ統一した。

### 検証結果
- `npm run build:gas --prefix frontend` 成功。

### mergeCommit
`787000cc93c9ecf67452526f8639a300ff71a4a0`

---

## 【Discord設定API認証】セッション利用者を権限確認前に設定 — PR #484

### 変更内容
- `src/34_DiscordSettingsApi.js` の sessionId を受け取る4関数で、`checkPermission('admin_access')` の前に `setEmailFromSession(sessionId)` を追加した。
- 設定保存・取得の権限確認が、渡されたセッションの利用者を基準に実行される順序へ統一した。

### 検証結果
- `npm run build:gas --prefix frontend` 成功。

### mergeCommit
`787000cc93c9ecf67452526f8639a300ff71a4a0`

---

## 【リポジトリ正規状態】恒久記録の追加 — PR #482

### 変更内容
- `docs/REPOSITORY_CANONICAL_STATE.md` を追加し、リポジトリ・クローン・バックアップの唯一の正、使用禁止対象、旧SHAの読み替え、全セッション共通ルールを恒久記録化した。
- 本ログ先頭告知から同文書を参照するようにした。

### 戻し方
`git revert e99e166bcdb3ef71b4d1993621245ab68cbc7bc0`

---

## 【redaction2後処理】Security Content Check のCLI化 — PR #472

**マージ日時**: 2026-08-24T11:17:14Z

### 変更内容
- ライセンス必須の `gitleaks/gitleaks-action@v2` を廃止し、公式 GitHub Releases から取得する gitleaks CLI v8.18.4 へ変更
- SHA-256 をワークフローへ固定し、展開前に `sha256sum --check` で検証
- 既存の個人情報パターン検査は変更なし

### 実測値
- PR #472 Security Content Check run `32721030126`: Gitleaks pass（11秒）、Sensitive Content pass（6秒）
- 負例PR #473 Security Content Check run `32721130562`: Gitleaks pass（10秒）、Sensitive Content fail（7秒）。予約ドメインのダミー値を検出し、未マージでクローズ・ブランチ削除済み

### 戻し方
`git revert 4d4b7c329e506856fc36bf387838bf96d525357f`

---

## 【redaction2 Phase 5】DEVブック移行・ERP読取調査

### 一時管理関数
- PR #475 でGASの一時管理関数を追加し、Driveスコープは既存マニフェストの明示設定を使用した（追加なし）。merge/revert SHA: `80243a7e3b436c4727c23443255935cf1dfc4803`
- PR #476 で退役状態の読取確認を追加した。merge/revert SHA: `fccc1ea0721a180265795706f5179922785d9ef6`
- 作業完了後の本PRで一時関数を削除する。実IDはコード・戻り値・ログに記録しない。

### DEV移行の実測
- DEVブックをコピーし、`DEV_SPREADSHEET_ID` を新コピーへ切替済み（新ID値は非掲載）。
- `smokeReadConfiguredSpreadsheets` → `devReadable: true`, `erpReadable: true`。
- `dryRunVerifyInboxPhase1("LDI-00002")` → 会話一覧25件、メッセージ75件。
- `getDeployedSha` は移行用関数配布時のdevelop HEADと一致。
- 旧DEVブックは `_RETIRED_20260824` へ改名済みで、直接編集者0件・直接閲覧者0件を確認。
- リンク共有は `ANYONE_WITH_LINK / VIEW` のまま。GASからの `setSharing(PRIVATE, NONE)` はDriveポリシーにより `Access denied` で拒否された。ID非掲載のまま、オーナーがDrive UIまたは組織管理設定でリンク共有を制限付きへ変更する必要がある。

### ERP読取調査（切替はオーナー判断待ち）
- 読取実測: オーナーは実行主体、直接編集者0件、直接閲覧者0件、シート数28、最終更新日時は2026-01-23T15:05:13.897Z。
- DriveAppが返す最終更新日時は確認できるが、更新頻度の履歴は取得できないため頻度は未確定（推測しない）。
- 参照用途: `01_Initialize.js` のERP連携初期化、`15_ERPSync.js` のERP取得／同期、`99_DataTransfer.js` の全シート・個別シート転記、`99_ERPAnalyzer.js` の構造・サンプル読取、`99_ERPDataCleaning.js` の配送レート等の整形、`Config.js` の共通ERP ID取得。
- 切替案: オーナー承認後にERPコピーを作成し、上記の同期・転記・分析・整形処理を新コピーで読取検証してから `ERP_SPREADSHEET_ID` を切替える。不合格時はプロパティを旧値へ戻す。今回は切替操作を実施しない。

---

## 【ERP旧版廃止】旧取引管理ブックの退役

### 変更内容
- 旧版ブックを開く `15_ERPSync.js`、`99_DataTransfer.js`、`99_ERPAnalyzer.js`、`99_ERPDataCleaning.js` を削除。
- 旧ERP統合初期化、トリガー補助、設定済みブックのスモークから旧版ブックへの依存を削除し、スモークはDEV読取のみへ変更。
- 旧版ブック用のScript PropertyをGASから削除し、ブックをゴミ箱へ移動した。ゴミ箱は空にしない。

### 参照全量（実測）
- 旧Script Propertyの直接参照は、変更前に `01_Initialize.js`、`15_ERPSync.js`、`99_DataTransfer.js`、`99_ERPAnalyzer.js`、`99_ERPDataCleaning.js`、`Config.js`、本作業ログで確認。
- 旧版ブックを開く補助参照は `00_TriggerSetup.js` と `99_TestFunctions.js` にも存在したため、前者は現在の環境参照へ変更し、後者は互換ヘルパー経由で現DEVブックを参照するようにした。
- `ERP_CONFIG` は現DEVブック内のシート名・gid定義であり、旧版ブックIDは保持しないため残置。

### 実測値
- Deploy to DEV: run `32724436296` 成功（44秒）。
- `getDeployedSha` は `338b124d083ea94525506bcc99c96ff6ecd9d160` で当時のdevelop HEADと一致。
- `smokeReadConfiguredSpreadsheets` → `devReadable: true`。
- `dryRunVerifyInboxPhase1("LDI-00002")` → 会話一覧25件、メッセージ75件。
- 退役GAS関数 → `erpPropertyDeleted: true`、`bookTrashed: true`。ID値は出力・記録していない。

### 戻し方
この廃止はゴミ箱保持期間中にブックを復元し、オーナー判断で新しいScript Propertyを設定したうえで、廃止PRのrevertを検討する。

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
`git revert f5740e95a9ee868fe7d8d67251a2ef894643a873` で LeadCombobox / ProductCombobox の旧実装を復元可能

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
`git revert bddf9f21ff4a3247c40325b098164f5a5e5cc576` でカタログ登録を元に戻せる

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
`git revert 9b1ce3dc7ae56d3caf05746995668cdcf4518614` でハードコード方式に戻せる

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

**追加元**: PR #299「スタッフ一覧にキャッシュコンテキストを追加」(commit `937fdff3178a87dc2499472b64592ea4ccdbc8fa`) でスタッフ境界の実装と同時に検査が追加された。

### 変更内容
なし（コード変更不要）

### 戻し方
対象なし

---

## 【5】オーダー作成画面のフルページスケルトン廃止 — PR #362

**マージ日時**: 2026-08-21T21:11:51Z  
**revert用SHA**: `bc2663031ab57135572506f42f2f7e13333eaf17`

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
**revert用SHA**: `cd41c9898bc306df1e63acf429f75f2353531711`

### 変更内容
- `git revert bc2663031ab57135572506f42f2f7e13333eaf17` により PR #362 の変更を差し戻し

### 経緯
- 2回の静的解析では根本原因を特定できなかったため、ルールに従い即リバート
- 実際の原因は OrderListPage の navigate バグ（PR #367 で修正）であり、PR #362 自体は無関係だった

### 検証結果
- CI 通過、DEV デプロイ完了

---

## 【7】オーダー新規作成ボタンの navigate 修正 — PR #367

**マージ日時**: 2026-08-21T21:48:07Z  
**revert用SHA**: `4b666e187a392c1596d13f31cecc91706a19d9c9`

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
**revert用SHA**: `e6beba84381468c6792043d4e8c194dc0d2cbef5`

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
**revert用SHA**: `1e4f8aa8e072e491dd1ab04d84bdc224a9e1e9f5`

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

`git revert 1e4f8aa8e072e491dd1ab04d84bdc224a9e1e9f5` で列定義・ページ変更を元に戻せる

---

## 【10】オーダー受注日・支払期日をサーバー側で自動設定 — PR #377

**マージ日時**: 2026-08-22T06:53:02Z
**revert用SHA**: `0e91fc0ddb6f5a5c1b01511282de17dfc971ff1d`

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
**revert用SHA**: `313a3d05bee7e11e000451e60bb50480c95c520e`

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

- getDeployedSha: `313a3d05bee7e11e000451e60bb50480c95c520e`
- origin/develop HEAD: `313a3d05bee7e11e000451e60bb50480c95c520e` ✓ 一致

### conformance audit 結果

**★FAIL**: 総不一致 1件
- `ORDERS / オーダー管理`: 定義 40 列 / 実シート 42 列 → 差 2 列
- 今回の変更はオーダー管理シートに一切触れていない（変更は SharedInventoryReadApi のみ）
- PR #377 時点では audit PASS だった → この 2 列の乖離は今回マージ後に初めて検出

**停止条件に該当**: AUTONOMOUS_WORK_RULES.md「runCoreSchemaConformanceAudit が FAIL → 即座に revert」
→ ORDERS 列数不一致の原因調査のため報告して停止。PO の指示を待つ。

### 戻し方

```
git revert 313a3d05bee7e11e000451e60bb50480c95c520e
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

986d21b6e20124be14acdf46191b5ccbadf65814

### 戻し方

```
git revert 986d21b6e20124be14acdf46191b5ccbadf65814
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

3d054a6e6d155170e12c224f0f001d432d774357

### 戻し方

```
git revert 3d054a6e6d155170e12c224f0f001d432d774357
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

61a6bd05934d005cbf007c1cf6ef07290ab38b00

### 戻し方

```
git revert 61a6bd05934d005cbf007c1cf6ef07290ab38b00
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
- マージコミットSHA: 特定できず（PR番号が未記録のため）
- 戻し方: 特定できず。PR番号が判明次第、追記すること

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
- マージコミットSHA: be222b9fbfbe5884408cc3abaad96b0b2657e82a
  （書換え前SHA: d32192c51fa3e9df63c67c2228c54a46ab58e635 ※2026-08-24の履歴書換え2回により無効）
- 対象: /sales-orders/:orderId
- 新規ファイル: SalesOrderDetailPage.tsx, SalesOrderDetailPage.css
- GAS: getCoreOrderDetailForFrontend を 28_CoreOrderReadApi.js に追加
- 戻し方: git revert be222b9fbfbe5884408cc3abaad96b0b2657e82a
- dryRun（2026-08-23）: 175件中変更あり0件。実害なし。
- PO実機確認: OD-00175（登録なし確認）+ OD-00164（実データ確認）が必要

---

## 【20】管理センター Discord連携設定ページ — PR #438

- PR番号: #438
- マージコミットSHA: `953338be7edf8d66df8aa139e72ee255a67105f8`
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
- 戻し方: `git revert 953338be7edf8d66df8aa139e72ee255a67105f8`
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
- ブランチコミット SHA: ba69a4e5ce5fc888a2b666dda544189044eb5c9c
- マージコミット SHA: dbbf1b2aa66cd749ec95304b81c45854f300ff25
  （書換え前SHA: 16727d81766135ab5cc112acc28c11fca3e67e86 ※2026-08-24の履歴書換え2回により無効）
- 戻し方: git revert dbbf1b2aa66cd749ec95304b81c45854f300ff25

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
- マージコミット SHA: 22cecdde7da027b56f9a70ff58f17540e0e889ca
  （書換え前SHA: f78b00b7dd588f13823418a973c99219cd39a6c2 ※2026-08-24の履歴書換え2回により無効）
- 戻し方: git revert 22cecdde7da027b56f9a70ff58f17540e0e889ca

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

`6358ba06c95faad54e23cba6c970446125968b23`（2026-08-24T00:00:59Z）

### 戻し方

`git revert 6358ba06c95faad54e23cba6c970446125968b23`

---

## 【23】LEADS に IP_IDS（作品ID）列追加 — PR #437

- mergedAt: 2026-08-23T21:35:41Z
- マージコミット SHA: `124b18b0840b67dad036f355ca5b484cd4bdf7cb`
- 戻し方: `git revert 124b18b0840b67dad036f355ca5b484cd4bdf7cb`

---

## 【24】受信箱 GAS 読み取り API（Phase 1） — PR #445

- mergedAt: 2026-08-23T22:10:54Z
- マージコミット SHA: `e5577e23ec6bffb0876e1e99c0c7226f36ee2d48`
- 戻し方: `git revert e5577e23ec6bffb0876e1e99c0c7226f36ee2d48`

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
- マージコミット SHA: `9dd4cfc225c17da3b5d48a1b7b85ebe9e63f8b93`
- 戻し方: `git revert 9dd4cfc225c17da3b5d48a1b7b85ebe9e63f8b93`

---

## 【26】受信箱フロント接続（Phase 2） — PR #449

- mergedAt: 2026-08-23T22:37:05Z
- マージコミット SHA: `978d1b69045aca1b5abb0931f2b7a3b861d8b415`
- 戻し方: `git revert 978d1b69045aca1b5abb0931f2b7a3b861d8b415`

### 変更内容

- `frontend/src/features/inbox/gasAdapter.ts` 新規作成（InboxRepository → GAS クライアント橋渡し）
- `frontend/src/gas/client.ts` — getInboxConversations / getInboxConversationDetail 追加
- `frontend/src/gas/types.d.ts` — GoogleScriptRun 型に 2 メソッド追加
- `frontend/src/App.tsx` — inboxPreviewRepository → inboxGasRepository に差し替え
- `frontend/src/preview/gasRunnerMock.ts` — 5件モック（alpha/bravo/charlie/delta/echo）追加

---

## 【27】受信箱 3 ペイン UI 実装（Phase 3） — PR #453

- mergedAt: 2026-08-23T22:57:43Z
- マージコミット SHA: `ebe28c3db67a6270d0f671f0b779f49bd148222d`
- 戻し方: `git revert ebe28c3db67a6270d0f671f0b779f49bd148222d`

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
4. `clasp run recordDeployedSha ["59e5dbd26a368bfb539a9b5970486ee9ad478e53"]`
   → `{ sha: '59e5dbd26a368bfb539a9b5970486ee9ad478e53...', deployedAt: '2026-08-24T06:45:39.695Z' }` ✓
5. `clasp run getDeployedSha` → `59e5dbd26a368bfb539a9b5970486ee9ad478e53...` = develop HEAD ✓
6. `dryRunVerifyInboxPhase1("LDI-00002")` → conversationListCount=25 / sampleMessageCount=75 ✓
7. `dryRunVerifyInboxPhase1("LDI-00001")` → sampleMessageCount=8 ✓
8. 25 件目（CONVERSATION_SUMMARY のみ、会話ログなし）: **LDI-00233**（顧客実名は公開後監査で除去。詳細は `docs/PUBLIC_READINESS_SCAN.md` を参照）

### 公開後監査・DEV Deploy to DEV Run 512 再実行（2026-08-24）

- 合格条件（DEV）: Run 512 が成功し、`clasp run getDeployedSha` が `develop` HEAD と一致すること。
- 実測: `gh run rerun 32699033081 --failed` の再実行は **成功**。`deploy` job は全工程成功（42秒）。
  - `Build GAS artifact` は `npm run build:gas`（`typecheck` / `vite build` / `emit-gas-html` / design-system check）を実行。
  - `clasp run getDeployedSha` → `bd906456379d8df9c72ac762fa4ea272165a367b`。
  - `develop` HEAD → `bd906456379d8df9c72ac762fa4ea272165a367b`。一致。
  - Phase A の DEV API 実測: `LDI-00002` は会話一覧25件・メッセージ75件、`LDI-00001` はメッセージ8件。
- 画面照合: この実行環境には操作可能なブラウザ接続がなく、新規の実UI観測は未実施。上記は Phase A の DEV API 実測値。
- 公開後監査: `gitleaks git --log-opts="--all"` は0件、`trufflehog git file://. --no-update --only-verified` は verified/unverified とも0件。
- 補完grepで顧客実名1件を検出（本ログの旧記載、コミット `bd906456379d8df9c72ac762fa4ea272165a367b`）。GitHubリポジトリは `PRIVATE` へ復帰済み。現行ファイルから実名を除去した。履歴書換えは実施しない。
- 変更内容: 実名をID参照へ置換し、`docs/PUBLIC_READINESS_SCAN.md` を追加。
- 戻し方: 監査PR #462 のsquash mergeコミット `17a7d4f63df7938129ecaeaf1cc4e5e6fb0cc998` は `git revert 17a7d4f63df7938129ecaeaf1cc4e5e6fb0cc998` で戻せる（実名の再公開はしない）。

### 履歴書換え（2026-08-24）

- バックアップ: `git clone --mirror` と `git bundle create --all` を実行し、バンドルから復元した `origin/develop` が書換え前の `97b005ad8c441277f63b7362e3f59f44ef95e4d8` と一致。
- 実施: `git-filter-repo --replace-text` で顧客実名のフルネーム・姓・名の3パターンを `[REDACTED]` へ置換。全パターンは同一の4コミットにのみ出現。
- SHA対応: `docs/SHA_REMAP_20260824.md` に filter-repo の commit-map（旧SHA→新SHA、1,108行）を保存。
- 読み替え: 過去のrevert SHAを含むすべての旧SHAは、同ファイルで新SHAに読み替えること。

---

## 【28】LeadFormOptionsCacheContext — 背景プリフェッチ標準化 PR 1

### 合格条件

- A. `?preview#/leads` 表示後、`__gasMockCallCounts.getLeadFormOptions === 1`
- B. 同一 SPA セッションで新規リード編集を開いた後も、同回数が `1` のまま
- `npm run build:gas`（typecheck / build / design-system check）成功

### 変更内容

- `LeadFormOptionsCacheContext` を追加し、`getLeadFormOptions` の単一 payload を `createListCache` へ保持
- `usePrefetch` に `ensureLeadFormOptions` を登録
- `LeadEditorPage` の mount 時直接取得を Context の `ensureLoaded` と `formOptions` 参照へ置換。失敗時は `null` でフォーム継続
- DEV preview の全 GAS モック呼び出しを `window.__gasMockCallCounts` へ関数名別に記録

### Playwright 生出力

```text
A getLeadFormOptions=1
B getLeadFormOptions=1
PASS A+B
```

### build:gas 生出力

```text
> crm-app-frontend@0.1.0 build:gas
> npm run typecheck && npm run build && node scripts/emit-gas-html.mjs && npm run check:design-system

> crm-app-frontend@0.1.0 typecheck
> tsc --noEmit

✓ 512 modules transformed.
✓ built in 1.17s

design-system checks passed
```

### PR / revert

- PR と squash merge 後に merge SHA と `git revert <SHA>` を追記する。
## 【28】Discord チケット発行（Phase 2-C・案α）— 着手前確認で停止

- 日時: 2026-08-24
- ブランチ: `feat/discord-ticket-issuance`
- PR番号: #465
- mergedAt: 2026-08-24T07:46:37Z
- mergeCommit SHA: `02ef6614cd28d3aae6a591f8f85e6e0e10a72bcc`
- 対象環境: DEV のみ（本番操作なし）
- 変更ファイル: 本ログのみ。実装・デプロイ・スプレッドシート変更は行っていない。

### 実読した根拠パス

| 根拠パス | 確認した事項 |
| --- | --- |
| `docs/AUTONOMOUS_WORK_LOG.md`（PR #438 / #456 / #458 / #459 のエントリ） | Phase 2-A/B の既存API・フロント中間層・過去の検証記録 |
| `docs/DISCORD_FEATURE_CATCHUP.md` | 案αの定義、チケットは顧客専用チャンネル、移植元の保存先・冪等性 |
| `docs/HANDOFF_FRONTEND.md` | 9ステップ金型、CustomerDetailPage の repository 経由の中間層方式、`window.google?.script?.run` の利用方式 |
| `src/33_DiscordIntegrationService.js` | `DISCORD_BOT_TOKEN` の既存接続確認・Discord REST v10の利用 |
| `src/34_DiscordSettingsApi.js` | admin_access ガードとトークンをフロントへ返さない既存制約 |
| `src/35_DiscordOAuthApi.js` / `src/36_DiscordChannelSetupApi.js` | Phase 2-A/B の OAuth/Guild 設定および既存のチャンネル作成ヘルパー |
| `src/00_CoreSchemaRegistry.js` | 保存先は既存 `CUSTOMERS.DISCORD_CHANNEL_ID`。新規シート／Registry追加は不要 |
| `src/28_CoreCustomerReadApi.js` / `frontend/src/pages/customers/CustomerDetailPage.tsx` | 顧客詳細は customerId と customerName を確定でき、顧客マスタ保存と整合する配置先 |
| `.claspignore` | `src/` の新規GASファイルは除外されない（ただし今回新規GASファイルなし） |

### 実装前の判断

- チケット作成ボタンの候補は顧客詳細とリード詳細だった。保存先が既存の `CUSTOMERS.DISCORD_CHANNEL_ID` であり、顧客詳細は顧客ID・顧客名を確定して取得するため、実装再開時は顧客詳細に配置する。
- 同一顧客は `DISCORD_CHANNEL_ID` が設定済みなら新規作成せず、そのIDを返す方式で二重作成を防ぐ設計が必要。移植元の「既存チャンネルを再利用」の冪等性と整合する。

### V1 着手前確認（停止理由）

`frontend/` で `npm run dev -- --host 127.0.0.1` を実行し、`http://127.0.0.1:5173/?preview` のVite起動を確認した。その後、Browser skill のPlaywright実行面へ接続を試行したが、結果は `No browser is available` だった。

したがって、指示書V1の「`?preview` のボタン表示・押下・結果表示をPlaywrightでPASS」は**未実測**である。指示書の「推測禁止」および「確認できない事項が出たら停止」に従い、チケット実装には着手しない。

| 項目 | 実測結果 |
| --- | --- |
| S1 | 未実装のため未測定 |
| S2 | 未実装のため未測定 |
| S3 | 未実装のため未測定 |
| V1 | 未達: Playwright実行面が利用不可（上記） |
| V2 | 未実装のため未測定（`emit-gas-html` 未実行） |
| V3 | 未実装のため未測定 |
| V4 | 未実装のため未測定 |

### 再開条件

Playwrightを実行できるブラウザ接続を用意し、既存 `?preview` の画面確認をPASSさせること。その後に限り、案αの実装・S/V検証・DEVのみの配布を再開する。

### 実装再開・検証結果

- Playwright Chromium導入: `npx playwright install chromium --with-deps` は exit 0。`?preview` の既存ダッシュボードは表示・pageerror 0件。
- 顧客詳細へ管理者専用の発行ボタンを追加。`CUSTOMERS.DISCORD_CHANNEL_ID` が既存ならDiscord APIを呼ばずそのIDを返す。空欄時のみ、Phase 2-Bの `discordRequest_` と `applyPermissionOverwrites_` を再利用してチャンネルを作成・記録する。
- V1/V3: Playwrightで CUS-0001 の新規作成結果表示、CUS-0002 の既存チャンネル再利用表示を実測し、両方PASS（pageerror 0件）。
- V2: `npm run build:gas` PASS（typecheck / Vite / emit-gas-html / design-system check）。
- V4: 実トークンを使わないDEVモックで未設定時の案内をAPI実装として確認。実トークン設定・実チャンネル作成はShingo実施待ち。
- S1: `src/37_DiscordTicketApi.js` のLogger出力はstatus/channelId/error.messageのみ。トークン値を渡す箇所なし。
- S2: `createDiscordTicketForCustomer` の先頭で `checkPermission('admin_access')` を実測。
- S3: 新規コードにトークン値・Webhook URL・実環境IDなし（previewの数値はモック値）。

---

## 【履歴書換え後処理】revert用SHAのv1→v2連結更新

- 履歴書換えが行われた場合、作業ログのSHAも同時に更新する。
- 複数回の書き換えでは remap を順に連結して読み替える。
- 本作業の戻し方: `git revert <本PRのマージコミットSHA>`。

### PR #467 の revert SHA 訂正

- 旧記載の `b38f145759607c23f74873a20783352550dfee22` は履歴書き換えにより無効化された。
- 正しい revert 対象は `b10aaf6bc9695e3b930a779aebc2c47f10ae7f2e`。戻し方: `git revert b10aaf6bc9695e3b930a779aebc2c47f10ae7f2e`。

---

## 【通貨マスタ共通キャッシュ】PR作成前記録

### 合格条件

- `?preview` の背景プリフェッチ完了後、`window.__gasMockCallCounts` の生出力で `getCoreCurrenciesForFrontend: 1` であること。
- 見積権限だけで通貨取得が実行され、見積一覧の通貨記号が表示されること。
- `npm run build:gas` が成功すること。

### 実装

- `CurrencyMasterCacheContext` を `CurrencyRecord[]` の唯一の正本とし、`useCurrencySymbolMap` だけが記号mapを派生する。
- 注文／見積一覧Contextと注文／見積編集画面の直接通貨取得を共通Context参照に置換した。
- `usePrefetch` は注文または見積のいずれかの権限がある場合に通貨キャッシュを取得する。

### 検証記録

- `frontend/npm run build:gas`: PASS（typecheck / Vite / emit-gas-html / design-system check）。
- 生出力による画面検証: この実行環境では利用可能なブラウザ接続がなく未実施。合格条件の1・2は未達のため、PR作成・mergeは行わない。

## 【PR #512】仕入れ支払済みステータス影響試算

- mergeCommit: `79a9824ec8c9ddb4ceb64e4a5bdd21a490d923ba`
- 変更: 仕入れ支払済み状態を反映する注文ステータスの読み取り専用dry-runを追加。
- 検証: `npm run build:gas` 成功。DEVでのdry-runはマージ後に実施する。

## 【公開リポジトリ実値除去】PR作成前記録

### 判断・変更

- `src/99_SalesMigration.js` は、全トップレベル関数のリポジトリ内参照が0件、作業ログの参照が0件、完了済みのコード内記録ありのため、一度きりの移行スクリプトとして削除する。
- カタログの発行元サンプルは非実在のダミー値へ置換する。
- `frontend/dist/index.html` は、`develop`向けActionsが`build:gas`を実行し、同ビルドが当該成果物をGAS用HTMLへ変換するため、Git管理を維持して再ビルドする。

### 検証記録

- `npm run build:gas` 成功。
- `grep -rFf ~/crm-app-local-secrets/scan-patterns.txt`（Git管理外依存ディレクトリを除外）: ヒット0件。

### 戻し方

- マージ後のPRを `git revert <mergeCommit SHA>` で戻す。履歴書き換え・force pushは行わない。

## 【公開リポジトリ実値除去】マージ・CI検査強化の停止記録

- 実値除去PR #518 mergeCommit: `2030eafddd58f2656bca09fd290a75600fa9a1a4`。
- PR #518で、完了済みかつ参照のない移行スクリプトを削除し、カタログの発行元サンプルをダミー化して追跡中のビルド成果物を再生成した。
- 固定文字列パターン検品はヒット0件、PR時のCIは全緑だった。
- CI検査強化は、登録番号形式の全リポジトリ検査を既存の汎用コンテンツ検査へ組み込む設計で、既存のサンプル・テスト記述による多数のベースライン検出が判明したため未コミットで停止した。Secretsパターン検査のPRは未作成。

### 戻し方

- 実値除去は `git revert 2030eafddd58f2656bca09fd290a75600fa9a1a4`。CI検査強化は未コミットのため戻し操作不要。

## 【請求書テンプレート再混入の復旧】PR作成前記録

- 再混入元はPR #519（`docs: restore sanitized invoice template layout`、`docs/restore-sanitized-invoice-template` → `develop`）であることを履歴と固定文字列検品で確認した。
- 同PRのタイトルはsanitizedを示すが、実態として固定文字列パターンに一致する値が再混入していたため、タイトルと実態は一致しなかった。
- PR #519のレイアウト変更を保持したまま、検出された11箇所を既存プレースホルダへ戻した。
- 検証: `grep -Ff ~/crm-app-local-secrets/scan-patterns.txt docs/invoice-template.html` とリポジトリ全体検品はいずれもヒット0件。

### 戻し方

- マージ後のPRを `git revert <mergeCommit SHA>` で戻す。履歴書き換え・force pushは行わない。

## 【Secrets固定文字列CI検査】要件変更・PR作成前記録

- 形式ベースの登録番号検査は、ダミー値との原理的衝突により採用しない。既存のSensitive Contentチェックは変更しない。
- PR #526（請求書テンプレートの再復旧）のmergeCommitは `7beb26ccfbda417ab818562307c3a2b8fec21372`。
- `SECRET_SCAN_PATTERNS` を実行時にのみ読み込み、Git管理ファイルを固定文字列検索するステップを追加する。パターン本文は出力せず、検出時はファイル名と行番号だけを出力する。Secret未設定時は警告してスキップする。

### 戻し方

- マージ後のPRを `git revert <mergeCommit SHA>` で戻す。既存のSensitive Contentチェックには影響しない。

## 【Secrets固定文字列CI検査】マージ記録

- PR #525 mergeCommit: `64d912a92c70d06fa399ec4bec4487e77fbbc865`。
- PR #525のCIで、`Check configured secret patterns` ステップはsuccessを確認した。
- ワークフローは`pull_request`専用のため、developへのpush単独では同ステップを起動しない。後続のdocs PRで同一develop内容に対するステップ成功を確認する。

## 【Discord招待・Guild連携・チャンネルセットアップ認証補完】PR作成前記録

### 対象

- `src/35_DiscordOAuthApi.js`: `generateDiscordOAuthUrl`、`getDiscordOAuthStatus`。
- `src/36_DiscordChannelSetupApi.js`: `runDiscordAutoSetup`、`getDiscordSetupStatus`。

### 変更・検証

- 各関数で`checkPermission('admin_access')`の前に`setEmailFromSession(sessionId)`を追加した。
- フロントのGASクライアントは対象4操作すべてでsessionIdを渡しているため、フロント変更は不要だった。
- 全Discord GAS関数の順序監査で不備0件、`npm run build:gas`成功、`?preview#/discord-integration`のPlaywright操作確認が成功した。

### 戻し方

- マージ後のPRを `git revert <mergeCommit SHA>` で戻す。

## 【Discord招待・Guild連携・チャンネルセットアップ認証補完】マージ記録

- PR #532 mergeCommit: `df2f636ce3e9250687e74b94584fba8e36668fd9`。
- 対象4関数で、sessionIdからのメール設定を管理権限確認より前に行う順序へ統一した。

## 【Discord連携設定カード統合・Application ID入力】PR作成前記録

### 変更ファイルと目的

- `src/34_DiscordSettingsApi.js`: Application ID保存APIと接続状態の公開Application ID返却を追加。
- `frontend/src/gas/client.ts`、`frontend/src/gas/types.d.ts`、`frontend/src/features/discordIntegration/contracts.ts`、`frontend/src/features/discordIntegration/gasAdapter.ts`: GAS APIの型・呼び出しを追加。
- `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx`、`frontend/src/content/ja/discordIntegration.ts`、`frontend/src/preview/gasRunnerMock.ts`: 統合カード、案内文、previewモックを追加。

### 着手前確定（U1〜U4）

- U1: `src/35_DiscordOAuthApi.js`が`DISCORD_CLIENT_ID`を読み出す。新APIも同じキー名へ保存する。
- U2: 実行コードとフロントにCLIENT_SECRET参照はない。`docs/DISCORD_FEATURE_CATCHUP.md`の設計上の言及だけである。
- U3: カード構成は`frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx`が保持する。トークン設定・接続状態の2カードを1カードへ統合し、監視チャンネル・Bot招待・チャンネルセットアップは分離を維持する。
- U4: `src/34_DiscordSettingsApi.js`の`saveDiscordBotToken`を保存APIのパターンとし、sessionメール設定後に管理権限確認してからScript Propertiesへ保存する。
- `.claspignore`を確認し、変更したGASファイルは除外規則に一致せずDEV配布対象である。

### セキュリティ・動作検証（S・V）

- S1: 新APIは`setEmailFromSession(sessionId)`の後に`checkPermission('admin_access')`を実行することを静的検証した。
- S2: 接続状態APIはBotトークンを返さず、従来どおりマスク表示だけを返す。
- S3: 実トークン・実Application IDをログ、コミット、PR本文へ記載しない。
- V1/V3/V4: `?preview#/discord-integration`のPlaywrightで、統合カード、トークン保存接続、Application ID未設定案内、保存後の案内消去・全文表示、既存3カード表示を確認した。
- V2: `npm run build:gas`成功。

### 戻し方

- マージ後のPRを `git revert <mergeCommit SHA>` で戻す。

## 【Discord連携設定カード統合・Application ID入力】マージ記録

- PR #534 mergeCommit: `96a911664d4f274a4e6752afa65277aa5d819310`。
- 統合カード、管理者限定のApplication ID保存、固定文字列機密検査、preview操作検証を完了した。

### 読み替え済みSHA

- マージコミット SHA: f5740e95a9ee868fe7d8d67251a2ef894643a873
  戻し方: git revert f5740e95a9ee868fe7d8d67251a2ef894643a873
  （書換え前SHA: 78e308e80f398efd0540a0869461d92475a427da ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: bddf9f21ff4a3247c40325b098164f5a5e5cc576
  戻し方: git revert bddf9f21ff4a3247c40325b098164f5a5e5cc576
  （書換え前SHA: 4f35b416a08d4c8d5db7851283968988ce0c2126 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 9b1ce3dc7ae56d3caf05746995668cdcf4518614
  戻し方: git revert 9b1ce3dc7ae56d3caf05746995668cdcf4518614
  （書換え前SHA: e143adffe1b8fb628a91f80b8df50d4810bfc7ff ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 937fdff3178a87dc2499472b64592ea4ccdbc8fa
  戻し方: git revert 937fdff3178a87dc2499472b64592ea4ccdbc8fa
  （書換え前SHA: 1e82b1d8b8f061ec43f4ecfbe8a82abdf7334982 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: bc2663031ab57135572506f42f2f7e13333eaf17
  戻し方: git revert bc2663031ab57135572506f42f2f7e13333eaf17
  （書換え前SHA: 6e10e1d62f278b9b8b1c042e886bf335a58d48d1 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: cd41c9898bc306df1e63acf429f75f2353531711
  戻し方: git revert cd41c9898bc306df1e63acf429f75f2353531711
  （書換え前SHA: df83e0a36bff4143d3bc964bad310853a61919a9 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 4b666e187a392c1596d13f31cecc91706a19d9c9
  戻し方: git revert 4b666e187a392c1596d13f31cecc91706a19d9c9
  （書換え前SHA: 3bdc975109811d4955a1333a42d9082162e8ea40 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: e6beba84381468c6792043d4e8c194dc0d2cbef5
  戻し方: git revert e6beba84381468c6792043d4e8c194dc0d2cbef5
  （書換え前SHA: 78bff4f3e1ce0f04016de2d02e9f37a8fe93c6f6 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: b0c4d90438e5f164ea649a4e552b325d0d505dc5
  戻し方: git revert b0c4d90438e5f164ea649a4e552b325d0d505dc5
  （書換え前SHA: 07b672eec3946c9797ee2bfd8004a60cdea42ca6 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 1e4f8aa8e072e491dd1ab04d84bdc224a9e1e9f5
  戻し方: git revert 1e4f8aa8e072e491dd1ab04d84bdc224a9e1e9f5
  （書換え前SHA: b8c8dc1f39219dd664443e9db5950e3aa24c9b8d ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 0e91fc0ddb6f5a5c1b01511282de17dfc971ff1d
  戻し方: git revert 0e91fc0ddb6f5a5c1b01511282de17dfc971ff1d
  （書換え前SHA: 56d9e125b877e35d536f66bb537ecfb02ac7162c ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 313a3d05bee7e11e000451e60bb50480c95c520e
  戻し方: git revert 313a3d05bee7e11e000451e60bb50480c95c520e
  （書換え前SHA: efad153df11b5217d6e351e10e936f0714693ac1 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 986d21b6e20124be14acdf46191b5ccbadf65814
  戻し方: git revert 986d21b6e20124be14acdf46191b5ccbadf65814
  （書換え前SHA: fd084eda2725ec7ba675afb947982fb0e0aa8e4c ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 3d054a6e6d155170e12c224f0f001d432d774357
  戻し方: git revert 3d054a6e6d155170e12c224f0f001d432d774357
  （書換え前SHA: e0eafe480182d5450d0134b048ce2e33ab4a4723 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 61a6bd05934d005cbf007c1cf6ef07290ab38b00
  戻し方: git revert 61a6bd05934d005cbf007c1cf6ef07290ab38b00
  （書換え前SHA: 457ef47f394b748ce875fd2f050cc1e29c788a44 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 953338be7edf8d66df8aa139e72ee255a67105f8
  戻し方: git revert 953338be7edf8d66df8aa139e72ee255a67105f8
  （書換え前SHA: b7fb2bd00f73ef0e02637f24049eeeec68aeb335 ※2026-08-24の履歴書換え2回により無効）
- ブランチコミットSHA: ba69a4e5ce5fc888a2b666dda544189044eb5c9c（参考。revertには使用不可）
  マージコミットSHA: dbbf1b2aa66cd749ec95304b81c45854f300ff25
  戻し方: git revert dbbf1b2aa66cd749ec95304b81c45854f300ff25
  （書換え前SHA: fd6a22c86d15055bae64dcd873d461e38c353a25 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 6358ba06c95faad54e23cba6c970446125968b23
  戻し方: git revert 6358ba06c95faad54e23cba6c970446125968b23
  （書換え前SHA: 8575fcbef423b06eaacfa466a02fee24f4761851 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 124b18b0840b67dad036f355ca5b484cd4bdf7cb
  戻し方: git revert 124b18b0840b67dad036f355ca5b484cd4bdf7cb
  （書換え前SHA: 5af2fd6dfe084675f40d1e4e509cc299fa9842eb ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: e5577e23ec6bffb0876e1e99c0c7226f36ee2d48
  戻し方: git revert e5577e23ec6bffb0876e1e99c0c7226f36ee2d48
  （書換え前SHA: b62e200ee59137b67a510f92e82f097a01671922 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 9dd4cfc225c17da3b5d48a1b7b85ebe9e63f8b93
  戻し方: git revert 9dd4cfc225c17da3b5d48a1b7b85ebe9e63f8b93
  （書換え前SHA: db3676e06c887f02df30d654c812e9c104e41f97 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 978d1b69045aca1b5abb0931f2b7a3b861d8b415
  戻し方: git revert 978d1b69045aca1b5abb0931f2b7a3b861d8b415
  （書換え前SHA: d14bb3bb8960d92e9abb9789ff5a1183cf9508c8 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: ebe28c3db67a6270d0f671f0b779f49bd148222d
  戻し方: git revert ebe28c3db67a6270d0f671f0b779f49bd148222d
  （書換え前SHA: f1237217a83fb0359a148fdadef995b8fbb67490 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 59e5dbd26a368bfb539a9b5970486ee9ad478e53
  戻し方: git revert 59e5dbd26a368bfb539a9b5970486ee9ad478e53
  （書換え前SHA: 3b25543839071fa5ac4366302b63e04bb47f1977 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: bd906456379d8df9c72ac762fa4ea272165a367b
  戻し方: git revert bd906456379d8df9c72ac762fa4ea272165a367b
  （書換え前SHA: e4e6b66e3d360ba162c8dd742d41d2ccdbe5e330 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 17a7d4f63df7938129ecaeaf1cc4e5e6fb0cc998
  戻し方: git revert 17a7d4f63df7938129ecaeaf1cc4e5e6fb0cc998
  （書換え前SHA: bc4453579a7f49bf3fda69b1223f0dfa4c53bc16 ※2026-08-24の履歴書換え2回により無効）
- マージコミット SHA: 97b005ad8c441277f63b7362e3f59f44ef95e4d8
  戻し方: git revert 97b005ad8c441277f63b7362e3f59f44ef95e4d8
  （書換え前SHA: 3c16588c73e13ed639e76b6ace07a3d0e17ff4cc ※2026-08-24の履歴書換え2回により無効）
## 2026-08-25 関所PR-1 擬似ブロック試験

```
$ CRM_MIN_FREE_GB=99 .githooks/pre-push </dev/null
ERROR: only 17GB free; need 99GB. Run scripts/janitor.sh first.
exit=1

$ CRM_MAX_WORKTREES=1 .githooks/pre-push </dev/null
ERROR: 18 worktrees; limit is 1. Run scripts/janitor.sh first.
exit=1
```

## 2026-08-25 清掃員PR-2 検証

- dry-run検出を受け、develop/main保護、7日mtime保護、JANITOR_ONLY_PATH隔離モードを追加。probeのみを隔離撤去し、既存worktreeは残存確認済み。

## 新規クローンの画面検証前提（運用改善）

- 新しい clone では、画面検証の前に `frontend/` で `npm ci` を実行し、続けて `npx playwright install chromium` と `npx playwright install chromium-headless-shell` を実行する。
- `chromium-headless-shell` が unknown browser で失敗した場合は、`npx playwright install` を実行する。導入失敗時は生出力を記録して画面検証および PR 作成を停止する。

---

## 【Sales order detail keyed cache】計画3

### 合格条件

- 同一SPAセッションで受注詳細を開く→一覧へ戻る→同じ詳細を再度開いたとき、`getCoreOrderDetailForFrontend` の呼び出し数が増えない。
- 入金確定後、detail key の refresh により同関数が1回追加で呼ばれ、`STATUS` を使う既存の入金確認ボタンが有効から無効へ変化する。ステータス表示UIは追加しない。

### 変更と検証

- `SalesOrderDetailCacheContext` を追加し、`createListCache<OrderDetailRecord, string>` を orderId key で使う。missing detail は空配列として保持する。
- 詳細ページの mount 時直接取得を keyed cache の `ensureLoaded(orderId)` に置換した。入金確定成功時は既存の再取得を `await refresh(orderId)` に置換し、一覧refreshも維持する。
- DEV preview mock は入金確定後の再取得で `STATUS` を支払い待ちから仕入れ中へ変更する。これは検証専用であり、本番APIは変更していない。

```text
a:getCoreOrderDetailForFrontend first=1 reopened=1
b-2:before paymentButton.disabled=false
b-1:getCoreOrderDetailForFrontend reopened=1 afterConfirm=2
b-2:after paymentButton.disabled=true
PASS=true
```

- `frontend/scripts/verify-sales-order-detail-cache.cjs` により標準出力で検証した。`frontend/npm run build:gas` は typecheck / Vite build / emit-gas-html / design-system checks をすべて通過した。

### PR / revert / deploy（3件まとめて記録）

- PR #529 — OrderEditorPage の InventoryProductOptions 直接取得置換。squash merge SHA: `8527a17773bc9f66f80403f6c978e29c202cae96`。戻し方: `git revert 8527a17773bc9f66f80403f6c978e29c202cae96`。DEV の `getDeployedSha` は同SHAと一致。
- PR #531 — QuoteEditorPage の InventoryProductOptions 直接取得置換。squash merge SHA: `ce4d724c1bed360f75af763132fa218d3eaf33fd`。戻し方: `git revert ce4d724c1bed360f75af763132fa218d3eaf33fd`。DEV の `getDeployedSha` は同SHAと一致。
- PR #539 — Sales order detail keyed cache。squash merge SHA: `569beb6dc5a1fe1f2c52ab13d6c9703ad47ff875`。戻し方: `git revert 569beb6dc5a1fe1f2c52ab13d6c9703ad47ff875`。Deploy to DEV run `32797609301` は成功。`clasp run getDeployedSha` 生出力: `{ sha: '569beb6dc5a1fe1f2c52ab13d6c9703ad47ff875', deployedAt: '2026-08-25T01:28:13.343Z' }`。

### 保留

- Inbox conversation list / detail cache は保留。理由: inbox 同期シグナルが未定義であり、無効化なしのcache化は新着未反映を起こす。着手には `checkSyncSignals` の契約変更が必要であり、本作業の範囲外である。
- Issuer settings は保留。`getCoreIssuerForFrontend` に対応する同期シグナルが既存6ドメインにないため、外部更新を無効化できない。着手には `checkSyncSignals` 契約変更が必要。
- Discord settings は保留。接続状態・チャンネル・OAuth・setup状態に対応する同期シグナルが既存6ドメインにないため、外部更新を無効化できない。着手には `checkSyncSignals` 契約変更が必要。

---

## 【Dashboard KPI cache】計画8

### 合格条件

- Dashboard を開いた後、別画面へ移動してDashboardへ戻っても `getDashboardKPIs` が増えない。
- 初期表示時の `getDashboardKPIs` は全体で1回である。
- Dashboard KPI は LEADS シートを読むため、既存 `leads` 同期シグナルの変更時に refresh する。

### 変更と検証

- `DashboardKpiCacheContext` を `createListCache + SINGLE_KEY` で追加し、AppRouter の直接取得を context の `ensureLoaded` / `refresh` 参照に置換した。
- SyncPoller の `leads` refresher で lead list とDashboard KPIを同時にrefreshする。

```text
first __gasMockCallCounts ... "getDashboardKPIs":1
reopened __gasMockCallCounts ... "getDashboardKPIs":1
getDashboardKPIs first=1 reopened=1
PASS=true
```

### PR / revert / deploy

- PR #543 を squash merge。マージコミット SHA: `9457b42fd13c38657ecec8a9a67c760a8e27be72`。
- 戻し方: `git revert 9457b42fd13c38657ecec8a9a67c760a8e27be72`。
- Deploy to DEV run `32799722980` は成功。`clasp run getDeployedSha` 生出力: `{ sha: '9457b42fd13c38657ecec8a9a67c760a8e27be72', deployedAt: '2026-08-25T02:01:14.918Z' }`。

---

## 請求書発行フロー A-1 / A-2 / A-3

- 2026-08-25 — PR #523（A-1、請求書番号の次番号生成）。squash SHA: `86ca5bcb92047707714f4ca11f49effb61ea8a96`。`INV-` 系列の最大連番から5桁ゼロ埋めで採番し、既存系列を変更しない。build・CI・Core Schema V1監査は成功。戻し方: `git revert 86ca5bcb92047707714f4ca11f49effb61ea8a96`。
- 2026-08-25 — PR #530（A-2、下書き／発行のGAS処理）。squash SHA: `d943ce98196f7ae4e652f0382deeec58d4b906b8`。`isDraft` を作成・更新APIに追加し、Wise自動採番、PayPal番号必須、再発行の既存値維持を実装。build・CI・Core Schema V1監査は成功。戻し方: `git revert d943ce98196f7ae4e652f0382deeec58d4b906b8`。
- 2026-08-25 — PR #537（A-3、請求書画面の一時保存／発行）。squash SHA: `8b49dbd0c4b3a680de0f87a6cff83122c2b25b76`。PayPal時の請求書番号入力、発行済み時の一時保存非表示、`isDraft`／`invoiceNumber` のAPI伝達を実装。Deploy to DEV・SHA照合・Core Schema V1監査は成功。戻し方: `git revert 8b49dbd0c4b3a680de0f87a6cff83122c2b25b76`。

---

## Discord Bot 招待後の Guild 自動検出（PR #545）

### 変更内容と判断根拠

- `src/35_DiscordOAuthApi.js` の招待URLから callback 用のクエリを除去し、Bot招待に必要な `client_id`・`scope`・`permissions` のみを生成するよう変更した。配布先に Discord Developer Portal での redirect URI 事前登録を要求しないためである。
- 同ファイルの `getDiscordOAuthStatus` は、Botトークンで Discord の guild 一覧 API を呼ぶ。1件なら `DISCORD_GUILD_ID` に保存して連携済みを返し、複数件なら名称・IDの選択肢を返し、0件なら未連携を返す。`saveDiscordGuildId` は再取得した一覧に含まれるIDだけを保存する。
- `src/27_WebApp.js` の callback 呼出しを除去した。callback handler の参照元は当該 `doGet` 分岐のみであり、招待URLから callback パラメータを除去した後には到達経路がないためである。
- `src/36_DiscordChannelSetupApi.js` は既存どおり `DISCORD_GUILD_ID` を読むため、上記の保存経路でチャンネルセットアップに必要な値が供給されることを確認した。
- `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx`、GAS client・adapter・型定義・日本語文言を更新し、複数guildの選択・保存UIを追加した。
- `src/27_WebApp.js` の指定6箇所は、サンプルCSV生成コード中の既存ダミー値であることを実読で確認した。機密検査の誤検知を避ける明確なダミー表記へ統一した。実値は含まれていない。

### 実測結果

- `frontend/npm run build:gas`: 成功。
- `?preview` Playwright: 招待URLのクエリが3種のみであること、複数guildの選択・保存、連携済み表示、ページエラー0件を確認して成功。
- Node VMによるGAS関数検証: 招待URL、1件自動保存、複数件返却、選択保存の各ケースが成功。
- `SENSITIVE_CONTENT_BASE_SHA=$(git merge-base origin/develop HEAD) node scripts/check-sensitive-content.mjs`: 検出0件。
- PR CI: Frontend Check、GAS Global Namespace Check、Security Content Check（Gitleaks / Sensitive Content）すべて成功。
- Deploy to DEV run `32802358971`: 成功。

### PR / revert

- PR #545 — Discord Bot 招待後のGuild検出とサンプルダミー値の誤検知解消。squash merge SHA: `0c895719c7c847c7281da8eaca38cd30f4eb4e91`。
- 戻し方: `git revert 0c895719c7c847c7281da8eaca38cd30f4eb4e91`。

---

## 【同期登録】LeadFormOptions → leads

- 合格条件: 信号なしで `getLeadFormOptions` が増えず、leads信号後に1回増えること。
- `SyncPoller` の leads refresher に `refreshLeadFormOptions()` を登録した。
- preview限定の同期信号トリガーで検証。生出力: `getLeadFormOptions initial=1 noSignal=1 afterSignal=2`、`PASS=true`。
- `frontend/npm run build:gas` は成功。

---

## 【同期登録】InventoryProductOptions → inventory

- 合格条件: 信号なしで `getInventoryProductOptions` が増えず、inventory信号後に1回増えること。
- `SyncPoller` の inventory refresher に `refreshInventoryProductOptions()` を登録した。
- 検証結果は PR 作成前に `__gasMockCallCounts` の生出力で記録する。

---

## 【同期登録】LeadDetail → leads

- 合格条件: 詳細を一度開いた後、信号なしでは `getLeadDetail` が増えず、leads信号後に既知の全キーを `refresh()` して1回増えること。
- `LeadDetailCacheContext` は `createListCache.refresh()`（引数なし）を公開し、`SyncPoller` の leads refresher に登録した。
- 検証結果は PR 作成前に `__gasMockCallCounts` の生出力で記録する。

---

## 【同期登録】CustomerDetail → customers

- 合格条件: 詳細を一度開いた後、信号なしでは `getCoreCustomerForFrontend` が増えず、customers信号後に既知の全キーを `refresh()` して1回増えること。
- `CustomerDetailCacheContext` は `createListCache.refresh()`（引数なし）を公開し、`SyncPoller` の customers refresher に登録した。
- 検証結果は PR 作成前に `__gasMockCallCounts` の生出力で記録する。

---

## 【同期登録】SalesOrderDetail → orders

- 合格条件: 詳細を一度開いた後、信号なしでは `getCoreOrderDetailForFrontend` が増えず、orders信号後に既知の全キーを `refresh()` して1回増えること。
- `SalesOrderDetailCacheContext` の `refresh` を引数省略可能にし、`SyncPoller` の orders refresher に引数なしの全キーrefreshを登録した。入金確定など個別キーを渡す既存呼出しは維持する。
- 検証結果は PR 作成前に `__gasMockCallCounts` の生出力で記録する。

---

## アプリ全体プリフェッチ標準化 Phase 1 — 同期登録漏れの是正

- `CurrencyMasterCacheProvider`、`LeadFormOptionsCacheProvider`、`InventoryProductOptionsCacheProvider`、`LeadDetailCacheProvider`、`CustomerDetailCacheProvider`、`SalesOrderDetailCacheProvider` の6件に SyncPoller refreshers 登録漏れが存在した。
- 原因は既存の design-system 検査が `*ListCacheProvider` 命名だけを文字列検索しており、上記Providerを対象外にしていたことである。
- CurrencyMaster は対応する既存ドメイン信号がないため、第2段階で currencies 信号を新設してから対応する。残る5件は leads / inventory / customers / orders 信号へ登録した。

---

## Discord Guild 選択状態の再取得時保持（PR #550）

- `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx` の「状態を確認する」処理を修正した。再取得結果が複数Guildで、現在選択中のIDが結果一覧に含まれる場合はその選択を維持する。一覧から消えた場合のみ未選択へ戻す。
- `frontend/npm run build:gas` と差分基準の機密検査は成功。PR CIの Frontend Check、GAS Global Namespace Check、Security Content Check はすべて成功。
- PR #550 を squash merge。マージコミット SHA: `f335858bd250d152c986c37ec85f666201ad15e5`。
- 戻し方: `git revert f335858bd250d152c986c37ec85f666201ad15e5`。

## PR22: サブメニュー金型整備 ＋ 期日バッジ表示条件修正 (2026-08-25)

### 作業内容

- 変更1: 入金済み受注の期日バッジ非表示（一覧・詳細）
  - GAS getCoreOrdersForFrontend に PAYMENT_CONFIRMED_AT を追加、cache V2→V3
  - paymentConfirmedAt が非空の場合、期日バッジ（期限超過/本日期日/期日1日前）を表示しない
- 変更2: サブメニュー選択状態の明示
  - active/hover テキスト色を --color-tab-text-active に統一
- 変更3: スクロール分離
  - position:sticky でサイドバーを固定、モバイルは position:static
- 変更4: DESIGN_TOKENS.md にサブメニュー実装ルール節を追加

### PR / revert

- PR #549 — CI 4件通過・Draft。merge commit SHA は develop マージ後に記録予定。
- 戻し方: `git revert <merge-commit-SHA>` ※マージ後に更新する

---

## Discordチャンネルセットアップの連携状態同期（PR #553）

- 原因: `frontend/src/pages/discord-integration/DiscordIntegrationPage.tsx` は、連携済み表示を `guildId` で更新していた一方、チャンネルセットアップボタンの有効化判定は `setupStatus.guildId` を参照していた。この2つの状態が連携確認後に同期されず、表示は連携済みでもボタンは無効のままになった。
- 修正: 初期読込、`状態を確認する` による再取得、複数Guildからの選択保存の3経路で、`setupStatus.guildId` を連携済みGuild IDと同期するよう変更した。これにより `setupStatus.guildId` を条件とするセットアップボタンも有効化される。
- 検証: `frontend/npm run build:gas`、差分基準の機密検査、PR CIの Frontend Check / GAS Global Namespace Check / Security Content Check はすべて成功。
- PR #553 を squash merge。マージコミット SHA: `15b16faad625202785755d2fc6ff319896ada698`。
- 戻し方: `git revert 15b16faad625202785755d2fc6ff319896ada698`。

---

## アプリ全体プリフェッチ標準化 Phase 1 — PR / revert 確定記録

- PR #548 — LeadFormOptions を leads 信号で refresh。squash merge SHA: `9238c16c3677246f4122ad11cbe89ced225f4445`。戻し方: `git revert 9238c16c3677246f4122ad11cbe89ced225f4445`。Deploy to DEV / `getDeployedSha` 一致を確認。
- PR #552 — InventoryProductOptions を inventory 信号で refresh。squash merge SHA: `89cf525f463a512a18536574b00d022058d39ea1`。戻し方: `git revert 89cf525f463a512a18536574b00d022058d39ea1`。Deploy to DEV / `getDeployedSha` 一致を確認。
- PR #555 — LeadDetail の既知全キーを leads 信号で refresh。squash merge SHA: `13bf207b1d2409ae254b27a2a697201688588dae`。戻し方: `git revert 13bf207b1d2409ae254b27a2a697201688588dae`。Deploy to DEV / `getDeployedSha` 一致を確認。
- PR #556 — CustomerDetail の既知全キーを customers 信号で refresh。squash merge SHA: `9a6beebfd21cea13a8fe1d024f795c786107de25`。戻し方: `git revert 9a6beebfd21cea13a8fe1d024f795c786107de25`。Deploy to DEV / `getDeployedSha` 一致を確認。
- PR #557 — SalesOrderDetail の既知全キーを orders 信号で refresh。squash merge SHA: `26b8cf40e178e97434230cb464c0e6f33f2a73da`。戻し方: `git revert 26b8cf40e178e97434230cb464c0e6f33f2a73da`。Deploy to DEV / `getDeployedSha` 一致を確認。

---

## アプリ全体プリフェッチ標準化 Phase 2 — 通貨マスタの同期対象外判断

- 通貨マスタは手動シート編集が唯一の更新経路のため同期信号の対象外とした。通貨を変更した場合は各利用者の画面再読み込みが必要。
- 将来、通貨編集UIを実装する際は、同時に `currencies` 信号の追加が必要になる。

---

## アプリ全体プリフェッチ標準化 Phase 2-1 — issuer / discord / inbox 同期信号

- `checkSyncSignals` の読出ドメインを既存6件から issuer / discord / inbox を加えた9件へ拡張した。
- `writeSyncSignalDomains_` を追加し、既存の `withSheetWrite_` もこの共通処理を経由するようにした。既存の cache target 起点の発行契約は保持する。
- issuer保存、Discordのトークン・Application ID・チャンネル・Guild・自動セットアップ保存、および Discord受信会話ログの一括保存成功後に、それぞれの信号を発行する。
- 検証生出力: 既存6ドメインは各 `existing-*` 値を保持、新3ドメインは非null、全書込フック検査は `true`、`PASS=true`。
- `frontend/npm run build:gas` と DEV `runCoreSchemaConformanceAudit()` は成功（総不一致0）。
- Sensitive Content Check ではコメントの13桁ミリ秒タイムスタンプ例示が電話番号パターンに一致した。コード内で例示する際は非数値プレースホルダを使うこと。検査ルールは変更しない。

---

## アプリ全体プリフェッチ標準化 Phase 2-2 — Issuer settings cache

- `IssuerMasterCacheContext`（`createListCache` + `SINGLE_KEY`）を追加し、Issuer settings ページの直接 `getCoreIssuer` 読込を置換した。
- issuer信号では `SyncPoller` が cache を refresh し、保存成功後も同じ cache を refresh して最新のフォーム値へ更新する。
- 検証生出力: `getCoreIssuerForFrontend initial=1 reopened=1 afterSignal=2 afterSave=3`、保存後の会社名は `Preview Company Updated`、`PASS=true`。
- `frontend/npm run build:gas` は成功。
