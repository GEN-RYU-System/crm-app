# フロントエンド引き継ぎドキュメント

> 作成: 2026-08-15  
> 対象リポジトリ: GEN-RYU-System/crm-app（develop ブランチ、PR #142 マージ後の状態）  
> すべて実測値。推測が混じる箇所は【推測】と明記する。

---

## 1. React アプリの配信構造

```
Vite build（frontend/）
  ↓ npm run build
dist/（JS・CSS バンドル）
  ↓ インライン化スクリプト（【推測】別途 build スクリプトが存在するはず）
src/ReactPoc.html（82行 / 287KB）
  ↓ clasp push
GAS プロジェクト
  ↓ doGet()（src/27_WebApp.js 経由）
ブラウザ（<div id="root"> に React マウント）
```

**ReactPoc.html の構造（実測）:**

| 行 | 内容 |
|----|------|
| 1–6 | HTML head。`<base target="_top" />` は GAS の iframe 制約対応 |
| 7 | `<title>CRM Frontend POC</title>`（POC 表記のまま） |
| 8–74 | `<script type="module">` — React 18.3.1 + react-router-dom + アプリ全体のミニファイ済みバンドル |
| 76–77 | `<style>` — 全 CSS インライン（デザイントークン含む） |
| 79–81 | `<body><div id="root"></div></body>` — React のマウント先 |

ファイルが 287KB になるのは JS・CSS がすべてインラインに埋め込まれているため。HTMLとしては 82 行。

---

## 2. GAS との接続方式

`frontend/src/gas/client.ts`（182行）がすべての GAS 呼び出しを管理する。

```typescript
const runner = window.google?.script?.run;
runner
  .withSuccessHandler((value) => resolve(value))
  .withFailureHandler((error) => reject(toError(error)))
  .someGasFunction(args);
```

**前回の grep で「TS ファイルに google.script.run なし」と報告したのは誤りだった。**  
`google.script.run` ではなく `window.google?.script?.run` で書かれているためパターンが一致しなかった。  
`client.ts` は実際に GAS に接続している。

**client.ts に定義済みの GAS 呼び出し:**

| 関数 | GAS 側関数 | 用途 |
|------|-----------|------|
| `getDashboardKpis()` | `getDashboardKPIs` | ダッシュボード KPI |
| `getCurrentUser()` | `getCurrentUser` | 認証・権限取得 |
| `getLeadsByType()` | `getLeadsByType` | リード一覧 |
| `getLeadDetail()` | `getLeadDetail` | リード詳細 |
| `createLead()` | `createLead` | リード作成 |
| `updateLead()` | `updateLead` | リード更新 |
| `getCoreCustomers()` | `getCoreCustomersForFrontend` | 顧客一覧 |
| `getCoreCustomer()` | `getCoreCustomerForFrontend` | 顧客詳細 |

---

## 3. 権限（permission）の仕組み

```
ブラウザ起動
  ↓ App.tsx: getCurrentUser() を呼ぶ
client.ts: window.google?.script?.run.getCurrentUser()
  ↓
GAS（src/27_WebApp.js L1212）:
  getCurrentUser()
    → getCurrentUserRole(): 担当者シートをメールで検索 → role 取得
    → getPermissionsByRole(role): 権限設定シートから role→boolean マップ取得
    → { success: true, permissions: { lead_view: true, lead_add: false, ... } }
  ↓
App.tsx: permissionState に格納
  ↓
navigation.ts: canAccessNavigationItem(item, permissions)
  → item.requiredPermission が permissions に true でなければ false
  → item.anyPermissions があればそのいずれかが true なら OK
  ↓
App.tsx: ルートガード（canAccessLeads / canAccessCustomers / canAccessInbox）
  → 権限なし → <Navigate to="/dashboard" replace />
```

**定義済みの NavigationPermission 型（navigation.ts）:**

```typescript
type NavigationPermission =
  | 'lead_view'     // リード閲覧
  | 'lead_add'      // リード追加
  | 'lead_edit'     // リード編集
  | 'dashboard_view'
  | 'deal_view_all' // 全案件閲覧
  | 'deal_view_own' // 自案件のみ閲覧
  | 'admin_access'
  | 'staff_manage'
  | 'settings';
```

GAS 側の role→permission マッピングは `27_WebApp.js` L2611 `getPermissionsByRole()` で定義。  
新しいページを追加して permission guard を付けるには、この型に値を追加し、GAS 側のマッピングに boolean を追加する必要がある。

---

## 4. 金型（ページ実装パターン）

金型は leads の実装から帰納した標準構成:

| ファイル | 役割 |
|---------|------|
| `pages/{page}/{page}Config.ts` | Row 型・COLUMNS 定数・ソート/フィルター関数・`to*Rows()` 変換 |
| `pages/{page}/{Page}ListPage.tsx` | DataTable + PageHeader + PageToolbar を Config 経由で組み立て |
| `pages/{page}/{Page}DetailPage.tsx` | Tabs + Card + fields（詳細が必要な場合） |
| `features/{page}/contracts.ts` | DTO 型・Repository インターフェース |
| `features/{page}/gasAdapter.ts` | `client.ts` の GAS 呼び出しをラップするリポジトリ実装 |
| `content/ja/{page}.ts` | 日本語コピー文字列 |

---

## 5. 金型化の進捗状況

### 完成（GAS 実接続済み）

| ページ | state | Config | GAS 接続 | 詳細ページ |
|--------|-------|--------|---------|----------|
| leads | `available` | `leadListConfig.ts` 83行 + `leadEditorConfig.ts` 56行 | ✅（client.ts 経由） | ✅ LeadEditorPage |
| customers | `preview` | `customerConfig.ts` 113行（3タブ分のカラム定義含む） | ✅（client.ts 経由） | ✅ CustomerDetailPage |

leads が参照実装（リファレンス）。customers はその金型を踏襲して作られた 2 枚目。

### 途中（GAS 未接続・モックのみ）

| ページ | state | Config | GAS 接続 | 実態 |
|--------|-------|--------|---------|------|
| inbox | `preview` | `inboxConfig.ts` 6行（タブ定義のみ） | ❌ | `previewAdapter.ts` がハードコードの 5 件を返す。real な GAS 呼び出し関数は `client.ts` に存在しない |

**inbox の contracts.ts は型定義として完成している：**
- `InboxStatus`・`InboxPlatform`・`InboxConversationDto`・`InboxMessageDto`・`InboxKarteDto`・`InboxConversationDetailDto`
- `InboxRepository` インターフェース（`listConversations` / `getConversation`）

型の骨格と Config スケルトンはあるが、`gasAdapter.ts` が存在せず、`client.ts` にも GAS 呼び出しが未追加。`InboxPreviewPage.tsx` は 20 行のシェルのみ。旧実装は `src/meta_inbox.html`（588行）が現役。

### 未着手（planned のみ・ページディレクトリなし）

| グループ | ページ | 必要な permission |
|---------|--------|-----------------|
| sales | inventory | `deal_view_all` or `deal_view_own` |
| sales | quotes | `deal_view_all` or `deal_view_own` |
| sales | quoteHistory | `deal_view_all` or `deal_view_own` |
| sales | invoices | `deal_view_all` or `deal_view_own` |
| sales | reports | `deal_view_all` or `deal_view_own` |
| support | faq | なし |
| management | deals | `deal_view_all` |
| management | staff | `staff_manage` |
| management | permissions | `admin_access` |
| tools | preferences | なし |
| tools | knowledge | `admin_access` or `staff_manage` |
| tools | translationPrompts | `admin_access` or `staff_manage` |
| tools | templates | `admin_access` |

---

## 6. 中断時点の作りかけ箇所

**最終 PR（#142 / 2026-08-15T04:05:51Z マージ済み）:**
- `customerConfig.ts` +27/-5: `compareTransactionAmounts()` 追加。`toCustomerListRows()` のソートを通貨別金額比較に対応（customers の取引金額列でのソートが目的）
- `ReactPoc.html` +10/-10: Vite ビルド出力の更新（バンドル差分の反映）

**中断の構造:**
```
leads（参照実装・完成）
  → customers（金型踏襲・GAS 接続・詳細ページあり・PR #142 でソート追加して一段落）
  → [ここで止まっている]
      inbox の gasAdapter 実装か
      planned ページの 1 枚目着手
      のどちらかが次の単位だった【推測】
```

**実際の作りかけ:**
- `inbox`: `InboxPreviewPage.tsx`（20行・シェルのみ）+ `inboxConfig.ts`（6行）+ 型定義 は揃っているが、`gasAdapter.ts` と `client.ts` の GAS 呼び出しが未実装
- `dashboard`: Config ファイルなし。`getDashboardKPIs` への GAS 接続は完成しているが、KPI 内容の拡充は未着手【推測】

---

## 7. 新規ページを追加する手順

leads → customers の差分から帰納した 9 ステップ。

```
Step 1: navigation.ts
  - NavigationItemId 型にページ ID を追加
  - NAVIGATION_GROUPS の適切なグループに NavigationItem を追加
    （state: 'planned' で登録 → 実装後 'preview' → 'available' に昇格）
  - requiredPermission / anyPermissions を設定

Step 2: content/ja/{pageName}.ts を新規作成
  - columns / fields / tabs / コピー文字列を定義
  - content/ja/index.ts に export を追加

Step 3: features/{pageName}/contracts.ts を新規作成
  - SummaryDto / AggregateDto の型定義
  - Repository インターフェースを定義（listXxx / getXxx）

Step 4: gas/client.ts に GAS 呼び出しラッパーを追加
  - window.google?.script?.run → Promise 変換（既存 8 関数のパターンをコピー）

Step 5: features/{pageName}/gasAdapter.ts を新規作成
  - client.ts の関数を Repository 実装でラップ
  - App.tsx に import してルートに渡す

Step 6: pages/{pageName}/{pageName}Config.ts を新規作成
  - Row 型 / COLUMNS / 初期ソート / to*Rows() / filter*Rows()

Step 7: pages/{pageName}/{PageName}ListPage.tsx を新規作成
  - DataTable + PageHeader + PageToolbar を Config 経由で組み立て

Step 8:（詳細ページが必要なら）pages/{pageName}/{PageName}DetailPage.tsx を新規作成
  - Tabs + Card + fields を Config の TABS / FIELDS から組み立て

Step 9: App.tsx を更新
  - permission 変数を追加（canAccess{Page} = permissionState.status === 'ready' && canAccessNavigationItem(...)）
  - <Route path={NAVIGATION_BY_ID.{page}.hash} element={...} /> を追加
  - permission guard（checked ? loading : canAccess ? page : navigate to dashboard）を追加

GAS 側の作業（React 外）:
  - GAS 関数（getXxxForFrontend 等）を src/27_WebApp.js に追加
  - 新 permission 値が必要なら getPermissionsByRole() のマッピングに追加
```

---

## 8. planned 13 ページの技術的な前後関係

実装順序はビジネス判断だが、技術的な依存関係は以下のとおり。

```
独立（どの順序でも実装可）
  ├─ staff      ← 担当者シートを読むだけ
  ├─ faq        ← スタンドアロン
  ├─ preferences ← ユーザー設定
  ├─ inventory  ← 商品カタログ（sales flow に属するが他ページに非依存）
  ├─ knowledge  ← AI ナレッジ管理
  ├─ translationPrompts ← AI プロンプト管理
  └─ templates  ← メッセージテンプレート

前後関係あり
  staff → permissions
    ・permissions 画面は「スタッフを選んで権限を設定する」UI になるはず【推測】
    ・staff が画面として存在していないと UX が破綻する

  quotes → invoices
    ・GAS スキーマで invoice が quote_id を参照している可能性が高い【推測】
    ・少なくとも「見積を請求書に変換する」操作が必要ならば quotes が先

  quotes → quoteHistory
    ・quoteHistory は quotes の履歴ビューであるため quotes が先

  deals 【未確認】
    ・現在の navigation で deal_view_all/deal_view_own が leads と deals の両方に絡む
    ・leads（流入管理）と deals（成約管理）が別テーブルかどうかが不明
    ・GAS 側の deals 関連関数を確認するまで依存関係は断言できない

  reports
    ・データ依存: 集計対象（leads / quotes / invoices / deals）が揃ってから意味が出る
    ・技術依存: なし（ページ単体は先に作れる）
```

---

## 9. 落とし穴・注意点

- **ReactPoc.html は Vite ビルド出力のインライン版**。ソースを直接編集してもビルド時に上書きされる。変更は `frontend/src/` 配下を編集 → ビルド → インライン化の順で行う。
- **`google.script.run` は `window.google?.script?.run` で書く**。GAS 環境外（ローカル開発）では `window.google` が undefined になるため、この optional chaining がないとクラッシュする。
- **inbox の `previewAdapter` は意図的なモック**。GAS 接続の実装前に UI を先行確認するための仮実装。本番にするには `gasAdapter.ts` を新規作成し、App.tsx の `inboxPreviewRepository` を差し替える。
- **新しい permission を追加するには 2 か所を変更する**: `navigation.ts` の `NavigationPermission` 型 + `27_WebApp.js` の `getPermissionsByRole()` のマッピング。型だけ追加しても GAS が返さなければ常に false になる。
- **`state: 'planned'` のページはサイドバーで表示されない**（`visibleNavigationGroups` がフィルタリングする）。開発中に表示したければ `'preview'` に変える。`'preview'` は表示されるが UI 上で Preview バッジが付く。
