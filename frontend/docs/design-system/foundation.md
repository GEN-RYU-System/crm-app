# Foundation

React POCのデザイン値は、次の一方向で管理します。

```text
palette.css → tokens.css → components/ui → pages
```

`palette.css` は色・影・余白・角丸などの生値を置く唯一の場所です。`tokens.css` は画面上の役割名だけを定義し、`palette.css` の値をalias参照します。

ページと共通金型から、色・余白・影・角丸を直書きしてはいけません。例外が必要なら、実装前にこの設計書と台帳を更新します。設計書を先に更新しない例外の追加は禁止です。

App Shell本文のグラデーション背景は`--app-canvas-gradient`だけを使用し、ページ・カード・金型で再定義しません。値はSales Anchorの`--inbox-bg-gradient`実装を`palette.css`へ移植し、`tokens.css`がaliasします。ナビゲーションのgroup、label、hash route、icon、順序、実装状態、既存SPA由来のメニュー権限は`src/app/navigation.ts`が正本です。`planned`は表示専用で遷移させず、`preview`と`available`だけをRouteへ接続します。UIでのメニュー表示制御は行いますが、認可そのものはGAS側の責務です。

管理系の親項目は主サイドバーの直接リンクとし、子ページを主サイドバー内へ展開しません。Sales Anchorの管理センターと同じく、遷移先で`HubShell`が主サイドバーとは独立した副ナビゲーションと子ページ領域を作り、`SubMenu variant="grouped"`が子ルートを表示します。`HubShell`はデスクトップで200pxの副ナビゲーションと可変幅の本文を横並びにし、767px以下では縦並びにします。`SubMenu`は業務権限・文言を持たず、呼出側から許可済みのgroups、activeKey、routeを受け取ります。データ管理の親子関係・権限・入口ルートは`navigation.ts`を正本とし、既存の`#/leads`、`#/leads/new`、`#/leads/:leadId`を変えずに右側の`Outlet`へ表示します。

顧客画面は既存の`PageHeader`、`PageToolbar`、`DataTable`、`Tabs`、`Card`、Form、状態金型だけを組み合わせます。ページは`CustomerRepository`だけを参照し、GAS client、storage、物理データ定義へ直接依存しません。顧客用のCopy、列・タブ・表示変換、Core Schema V1接続、サービス契約はそれぞれCopy SSOT、page config、adapter、contractsに分離します。実アダプターは型付きGAS clientだけを呼び、GAS側の読取りAPIが`00_CoreSchemaRegistry.js`の論理テーブルキー・論理ヘッダーキーから物理定義を解決します。顧客一覧は`CUSTOMERS.SOURCE_LEAD_ID`から`LEADS.LEAD_ID`へ販売形態・取扱商材を結合し、`ORDERS.CUSTOMER_ID`から取引回数と`CURRENCY`別の請求総額を集計します。異なる通貨は合算しません。

React POCのApp Shell本文は最大幅を設けず全幅を使用します。左右余白はデスクトップで`--layout-page-padding-x`（24px）、モバイルで`--layout-page-padding-x-mobile`（16px）を使用します。値は`palette.css`から`tokens.css`へaliasし、ページCSSやAppShell CSSに生値を置きません。

React POCは`HashRouter`内でSSOTの`available`または`preview` Routeを表示します。未実装メニューは`planned`として無効表示し、推測で空Routeを作りません。モバイル下部タブは、実ページが3〜5個揃った段階で別PRで検討します。

フィードバック色は、`--color-success`、`--color-warning`、`--color-info`と各`-subtle`／`-text`を用途トークンとして使用します。キーボードフォーカスは`--focus-ring-shadow`を使用し、金型・ページから色や影を再定義しません。

FormField、Badge、SkeletonはReact POCの純粋UI金型です。業務statusからBadge variantへの対応、選択肢の正本、保存・権限・GAS呼出しは金型に含めません。Form catalogは表示専用です。

TextFieldは`startIcon?: ReactNode`を受け取ります。指定時はinputの左側にアイコンを配置し、inputの`padding-left`をアイコン幅ぶん自動で拡張します。未指定時は既存の描画と完全に同一です。アイコンのサイズは`--font-md`、色は`--color-text-muted`をCSS経由で適用し、呼出側から色・サイズをインラインで指定しません。アイコンは`aria-hidden="true"`で装飾として扱います。検索欄には`CRM_SEARCH_ICON`（`app/icons.tsx`公開済み）を使用し、ページからHeroiconsを直接importしません。

Tabsは純粋UI金型で、`pill`と`underline`、`sm`と`md`、任意のicon・count・disabledを提供します。タブの項目・選択状態・変更処理・aria-labelは呼出側の正本で管理し、Tabs自身は業務条件やCopyを持ちません。

TabBarは受信箱由来の、ページまたは一覧上部に置くカテゴリ切替バーです。`key`、`label`、`disabled`だけを扱い、iconやcountを必要とする領域内切替にはTabsを使用します。

PageToolbarはPageHeaderとDataTable surfaceの間に置く、ページ全体の操作領域です。`start`には検索・絞り込み、`end`には更新・新規追加・将来のエクスポートを呼出側が渡します。Toolbar自身は業務文言・検索・絞り込み・固定ボタンを持ちません。Sales Anchorの一覧`.filter-bar`の下余白16pxと`.page-header-actions`のgap 12pxをtokenで採用し、デスクトップでは左右配置、`max-width: 767px`では折り返します。Toolbar自身は横スクロールを発生させません。TabBarはPageToolbarではなくDataTable surfaceの先頭に置き、一覧データのカテゴリ切替を担います。

PageHeaderは`eyebrow → title row（titleと右側action）→ subtitle`の順に描画します。title rowは最小高40px、gap 12px、actionは右寄せです。titleは24px／600／line-height 1.25、subtitleは13.6px／line-height 1.4／primary textで、subtitleの最小高は1.4em、下余白は12pxです。CRM固有のeyebrowは互換性のため維持し、PageHeader tokenだけを使用します。モバイルの`max-width: 767px`ではtitleとactionの折返しを許容します。CSS変数をmedia query条件に使えないため、このbreakpointだけはSales AnchorのPageLayoutと一致する固定値として許可し、それ以外の文字・色・余白はtokenを使用します。

DataTableは表面、border、角丸、overflow、横スクロール、セル余白、列見出しの配置を管理します。scroll領域に横paddingは置かず、セル自身の横paddingで本文と見出しが表面端へ密着しないようにします。見出しは既定で中央配置とし、sortable／staticを問わず同じ配置責務を持ちます。本文セルは既定で中央配置であり、左寄せが必要な列だけ`cellAlignment="start"`を明示します。headerとbody cellは既定で縦中央配置であり、複数行セルだけ`cellVerticalAlignment="top"`を明示できます。`loading`では実際の列見出しと同じtable DOM内に既存Skeleton金型を描画し、`aria-busy`と呼出側の`loadingLabel`で状態を伝えます。ソート状態・行データ・セルの業務表示・行クリック後の遷移は呼出側の正本で管理します。TabBarと同じCardへ埋め込む場合は`embedded`を使い、二重のborder・角丸を作りません。

Skeletonは初回読込みの標準UIです。`table` variantは任意の`columns`を受け、指定時は`rows × columns`のバーを表示します。`columns`未指定時は既存の3列表示を維持します。aria-labelは呼出側のCopy SSOTから渡し、金型自身はCopyをimportしません。reduced-motionではshimmerを停止します。

入力欄の幅は`width`propで指定します。幅の値をCSSに直書きせず、必ずトークン経由にします。`fullWidth`が指定されている場合は`width`propより`fullWidth`が優先されます。未指定の場合は従来通り親要素の100%（後方互換）になります。

| width | トークン | 実寸 | 用途例 |
|-------|---------|------|------|
| `sm` | `--field-width-sm` | 240px | 検索欄・短いプルダウン |
| `md` | `--field-width-md` | 400px | 氏名・メールアドレス |
| `lg` | `--field-width-lg` | 640px | メモ・備考 |
| 未指定 | — | 親要素の100% | 既定・後方互換 |

FormFieldのモバイル最小高さに使うmedia queryは`max-width: 767px`です。CSS変数をmedia query条件に使えないため、この値だけはSales Anchorの`FormField.css`と一致する固定のbreakpointとして許可し、それ以外の色・余白・文字・角丸・animation時間はtokenを使用します。

ConversationWorkspaceは、旧GASのチャット系画面に共通する一覧・会話・詳細の3領域をReact金型として分離します。業務データ、GAS呼出し、保存処理、Copyは持たず、呼出側から各領域を受け取ります。デスクトップは3列、`max-width: 1100px`は詳細を下段、`max-width: 767px`は1列にします。CSS変数をmedia query条件に使えないため、この2つは構造変更用の固定breakpointとして許可し、列幅・最小高・色・余白・角丸はtokenを使用します。

Inbox Previewは`ConversationWorkspace`を再利用し、Sales Anchorの受信箱と同じく上部のステータスタブ、プラットフォーム絞り込み、検索、会話一覧、メッセージスレッド、顧客カルテを分離します。`InboxRepository`を通じてPreview adapterだけを参照し、GAS、storage、ポーリング、送信・保存へ接続しません。

MultiSelectは複数値の選択を受け持つ純粋UI金型です。`items`・`getKey`・`getLabel`・`values`・`onChange`を呼出側から受け取り、業務データ・Copy・保存処理を持ちません。選択済みの値は入力欄内タグ（×ボタン付き）として表示し、タグをクリックまたはBackspaceで削除できます。`items`に存在しないIDが`values`に含まれる場合は`fallbackLabels`（`Record<string, string>`）のラベルでタグ表示し、ドロップダウンには出しません。入力欄はフィルタ文字列として機能し、候補はComboboxと同じポータルドロップダウンで表示します。幅は`width`prop（`sm`/`md`/`lg`）で指定し、`FormField.css`のトークンを使用します。キーボードフォーカスは`--focus-ring-shadow`を使用します。
