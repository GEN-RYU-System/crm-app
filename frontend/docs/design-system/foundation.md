# Foundation

React POCのデザイン値は、次の一方向で管理します。

```text
palette.css → tokens.css → components/ui → pages
```

`palette.css` は色・影・余白・角丸などの生値を置く唯一の場所です。`tokens.css` は画面上の役割名だけを定義し、`palette.css` の値をalias参照します。

ページと共通金型から、色・余白・影・角丸を直書きしてはいけません。例外が必要なら、実装前にこの設計書と台帳を更新します。設計書を先に更新しない例外の追加は禁止です。

App Shell本文のグラデーション背景は`--app-canvas-gradient`だけを使用し、ページ・カード・金型で再定義しません。ナビゲーションのlabel、hash route、icon、順序、状態は`src/app/navigation.ts`が正本です。UIでのメニュー表示制御は将来追加できますが、認可そのものはGAS側の責務です。

React POCのApp Shell本文は最大幅を設けず全幅を使用します。左右余白はデスクトップで`--layout-page-padding-x`（24px）、モバイルで`--layout-page-padding-x-mobile`（16px）を使用します。値は`palette.css`から`tokens.css`へaliasし、ページCSSやAppShell CSSに生値を置きません。

React POCは`HashRouter`内で`#/dashboard`と`#/components`を表示します。モバイル下部タブは、実ページが3〜5個揃った段階で別PRで検討します。

フィードバック色は、`--color-success`、`--color-warning`、`--color-info`と各`-subtle`／`-text`を用途トークンとして使用します。キーボードフォーカスは`--focus-ring-shadow`を使用し、金型・ページから色や影を再定義しません。

FormField、Badge、SkeletonはReact POCの純粋UI金型です。業務statusからBadge variantへの対応、選択肢の正本、保存・権限・GAS呼出しは金型に含めません。Form catalogは表示専用です。

Tabsは純粋UI金型で、`pill`と`underline`、`sm`と`md`、任意のicon・count・disabledを提供します。タブの項目・選択状態・変更処理・aria-labelは呼出側の正本で管理し、Tabs自身は業務条件やCopyを持ちません。

Skeletonは初回読込みの標準UIです。`table` variantは任意の`columns`を受け、指定時は`rows × columns`のバーを表示します。`columns`未指定時は既存の3列表示を維持します。aria-labelは呼出側のCopy SSOTから渡し、金型自身はCopyをimportしません。reduced-motionではshimmerを停止します。

FormFieldのモバイル最小高さに使うmedia queryは`max-width: 767px`です。CSS変数をmedia query条件に使えないため、この値だけはSales Anchorの`FormField.css`と一致する固定のbreakpointとして許可し、それ以外の色・余白・文字・角丸・animation時間はtokenを使用します。
