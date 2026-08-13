# Foundation

React POCのデザイン値は、次の一方向で管理します。

```text
palette.css → tokens.css → components/ui → pages
```

`palette.css` は色・影・余白・角丸などの生値を置く唯一の場所です。`tokens.css` は画面上の役割名だけを定義し、`palette.css` の値をalias参照します。

ページと共通金型から、色・余白・影・角丸を直書きしてはいけません。例外が必要なら、実装前にこの設計書と台帳を更新します。設計書を先に更新しない例外の追加は禁止です。

App Shell本文のグラデーション背景は`--app-canvas-gradient`だけを使用し、ページ・カード・金型で再定義しません。ナビゲーションのlabel、hash route、icon、順序、状態は`src/app/navigation.ts`が正本です。UIでのメニュー表示制御は将来追加できますが、認可そのものはGAS側の責務です。

React POCは`HashRouter`内で`#/dashboard`と`#/components`を表示します。モバイル下部タブは、実ページが3〜5個揃った段階で別PRで検討します。
