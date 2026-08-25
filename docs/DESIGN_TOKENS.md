# デザイントークン一覧

新しい CSS を書くときは、**この表にある名前だけを使う**こと。

> **注意**: `var(--undefined-name)` はビルドも CI も通過するが、
> 定義されていないトークンを参照するとブラウザはフォールバック値（または初期値）を使うため、
> **画面だけが静かに壊れる**。未定義のトークン名は使用しないこと。
>
> `check:design-system` スクリプトが `frontend/src/` 全体を検査する。
> CI で自動的にブロックされるので、ローカルで `npm run check:design-system` を確認してから push すること。

---

## よく使う 20 件（使用回数順）

実際のコードベースで最も多く使われているトークン。まずここを覚えれば日常の CSS はほぼ書ける。

| 順位 | トークン | 値 | 使用回数 | 典型的な用途 |
|------|----------|-----|----------|-------------|
| 1 | `--space-md` | 12px | 56 | テーブル行間、セクション内の要素間（標準間隔） |
| 2 | `--space-sm` | 8px | 51 | ボタン内部の padding-block、入力フィールドの内側余白 |
| 3 | `--font-sm` | 13px | 45 | 本文テキスト、テーブルセル、詳細ページの値 |
| 4 | `--space-xs` | 4px | 44 | バッジ間、アイコンとテキストの最小間隔 |
| 5 | `--color-text-muted` | #67738a | 42 | 補助情報のテキスト（ラベル、空状態のメッセージ、プレースホルダー） |
| 6 | `--space-none` | 0 | 37 | margin・padding を 0 にリセットする |
| 7 | `--border-width` | 1px | 35 | 罫線・区切り線の太さ（border: var(--border-width) solid ...） |
| 8 | `--color-text-primary` | #172033 | 34 | メインテキスト（見出し・値・本文） |
| 9 | `--font-weight-semibold` | 600 | 32 | ラベル・列ヘッダーなどの中強調 |
| 10 | `--color-border` | #e2e7f0 | 31 | 罫線・区切り線の色 |
| 11 | `--space-lg` | 16px | 31 | フォームの gap・padding、セクション間隔 |
| 12 | `--color-surface` | #ffffff | 21 | カード・ダイアログ・パネルの背景色 |
| 13 | `--font-md` | 14px | 21 | セクションタイトル、ドロップダウン項目、フォームグループ見出し |
| 14 | `--space-xl` | 24px | 20 | カードの padding、ページセクション間の大余白 |
| 15 | `--color-accent` | #3158d4 | 17 | ボタン・リンク・アクセント色（青） |
| 16 | `--font-xs` | 12px | 14 | 極小ラベル（サマリグリッドの見出し、大文字テキスト） |
| 17 | `--opacity-disabled` | 0.5 | 9 | 無効状態の透明度（opacity: var(--opacity-disabled)） |
| 18 | `--motion-fast` | 160ms | 8 | ホバー・フォーカスの transition duration |
| 19 | `--color-danger` | #bf3a4c | 8 | エラー・削除・危険操作のアクセント色（赤） |
| 20 | `--shadow-raised` | (card shadow) | 8 | カード・パネルの影（box-shadow） |

---

## 全トークン一覧

### フォントサイズ

| トークン | 値 | 用途 |
|----------|-----|------|
| `--font-xs` | 12px | 極小ラベル（サマリグリッドの見出し、大文字テキスト） |
| `--font-sm` | 13px | 本文テキスト、テーブルセル、詳細ページの値 |
| `--font-md` | 14px | セクションタイトル、ドロップダウン項目 |
| `--font-lg` | 18px | 合計金額・請求総額など強調する数値 |
| `--font-stat` | 34px | KPI 統計数値（ダッシュボードカード） |
| `--font-title` | clamp(28px, 4vw, 40px) | ページ最大見出し（h1 レベル） |
| `--page-header-title-size` | 24px | ページヘッダーのタイトル |
| `--text-sm` | = `--font-sm` | `--font-sm` の別名（互換性用） |

### フォントウェイト

| トークン | 値 | 用途 |
|----------|-----|------|
| `--font-weight-semibold` | 600 | ラベル・列ヘッダーなどの中強調 |
| `--font-weight-bold` | 700 | 合計金額・見出しなどの強強調 |

### 行間

| トークン | 値 | 用途 |
|----------|-----|------|
| `--line-height-tight` | 1.25 | コンパクトなテキスト（コンボボックス選択肢など） |

### 余白（spacing）

単位ステップは 0 / 4 / 8 / 12 / 16 / 24 / 32px。

| トークン | 値 | 用途 |
|----------|-----|------|
| `--space-none` | 0 | margin・padding を 0 にリセット |
| `--space-xs` | 4px | バッジ間、アイコンとテキストの最小間隔 |
| `--space-sm` | 8px | ボタン内部 padding、入力フィールドの内側余白 |
| `--space-md` | 12px | テーブル行間、セクション内要素間の標準間隔 |
| `--space-lg` | 16px | フォームの gap・padding、セクション間隔 |
| `--space-xl` | 24px | カードの padding、ページセクション間の大余白 |
| `--space-2xl` | 32px | 最大余白（ページ間・大セクション間） |

### 角丸（border-radius）

用途別に名前が分かれている。コンポーネントの種類に合わせて選ぶ。

| トークン | 値 | 用途 |
|----------|-----|------|
| `--radius-xs` | 4px | 最小角丸（チップ内のボタンなど） |
| `--radius-button` | 6px | ボタン |
| `--radius-field` | 6px | フォームフィールド（input, select） |
| `--radius-tab-pill` | 6px | タブ pill スタイル |
| `--radius-data-table` | 8px | テーブルコンテナ |
| `--radius-control` | 12px | インプット・コントロール（大きめのフィールド） |
| `--radius-surface` | 18px | カード・モーダル・パネル |
| `--radius-pill` | 999px | バッジ・タグの pill 型 |

### 色（テキスト）

| トークン | 実値 | 用途 |
|----------|------|------|
| `--color-text-primary` | #172033 | メインテキスト（見出し・値・本文） |
| `--color-text-muted` | #67738a | 補助テキスト（ラベル・空状態・プレースホルダー） |

### 色（サーフェス）

| トークン | 実値 | 用途 |
|----------|------|------|
| `--color-page` | #f5f7fb | ページ背景 |
| `--color-surface` | #ffffff | カード・ダイアログ・パネルの背景 |
| `--color-disabled` | #f7f7f7 | 無効状態のサーフェス |

### 色（ボーダー）

| トークン | 実値 | 用途 |
|----------|------|------|
| `--color-border` | #e2e7f0 | 罫線・区切り線 |

### 色（ステータス）

バッジを描画する場合は `subtle`（背景）と `text`（文字）の組み合わせが基本。
テキストのみで状態を示す場合は `strong` を使う。

| トークン | 実値 | 用途 |
|----------|------|------|
| `--color-accent` | #3158d4 | アクセント（ボタン・リンク・フォーカス） |
| `--color-accent-subtle` | #eaf0ff | アクセントの薄い背景 |
| `--color-success` | #2e7d32 | 成功状態の主色 |
| `--color-success-subtle` | #c6f6d5 | 成功バッジの背景 |
| `--color-success-text` | #22543d | 成功バッジのテキスト |
| `--color-success-strong` | #22543d | 白背景上の成功メッセージテキスト |
| `--color-warning` | #d97706 | 警告状態の主色 |
| `--color-warning-subtle` | #fefcbf | 警告バッジの背景 |
| `--color-warning-text` | #744210 | 警告バッジのテキスト |
| `--color-info` | #2563eb | 情報状態の主色 |
| `--color-info-subtle` | #bee3f8 | 情報バッジの背景 |
| `--color-info-text` | #2b6cb0 | 情報バッジのテキスト |
| `--color-danger` | #bf3a4c | エラー・削除・危険操作 |
| `--color-danger-subtle` | #fff0f1 | エラーバッジの背景 |
| `--color-danger-text` | #9b2c2c | エラーバッジのテキスト |
| `--color-neutral` | #718096 | ニュートラル |
| `--color-neutral-subtle` | #e2e8f0 | ニュートラルバッジの背景 |
| `--color-neutral-text` | #4a5568 | ニュートラルバッジのテキスト |
| `--color-on-solid` | #ffffff | ソリッドな背景色（濃色）上のテキスト |

### エフェクト

| トークン | 値 | 用途 |
|----------|-----|------|
| `--shadow-raised` | (card shadow) | カード・パネルの影 |
| `--border-width` | 1px | 罫線・区切り線の太さ |
| `--opacity-disabled` | 0.5 | 無効状態の透明度 |
| `--motion-fast` | 160ms | ホバー・フォーカスの transition duration |
| `--transition-fast` | = `--motion-fast` | `--motion-fast` の別名 |
| `--focus-ring-shadow` | (focus ring) | フォーカスリングの box-shadow |

---

## サブメニューの実装ルール

新しくサブメニュー付きページを作る場合は、このセクションに従うこと。

### 選択状態・ホバー状態のトークン

| 状態 | 背景色トークン | 文字色トークン |
|------|---------------|---------------|
| 通常 | `transparent` | `--color-text-muted` |
| ホバー | `--color-tab-surface-hover` | `--color-tab-text-active` |
| 選択中 | `--color-tab-surface-active` | `--color-tab-text-active` |

実装例（`frontend/src/pages/sales-orders/SalesOrderListPage.css` より）:

```css
.sales-order-list-page__tab:hover {
  background: var(--color-tab-surface-hover);
  color: var(--color-tab-text-active);
}
.sales-order-list-page__tab--active {
  background: var(--color-tab-surface-active);
  color: var(--color-tab-text-active);
  font-weight: var(--font-weight-semibold);
}
```

> `--color-text-primary` は **使わない**。アクティブ状態には必ず `--color-tab-text-active` を使うこと。

### スクロール分離の実装

本文が長い場合でもサブメニューが画面外へ消えないよう、`position: sticky` を使う。
`position: fixed` は使わない（周囲レイアウトが崩れるため）。

ページ上部に固定ヘッダー帯がある場合（後述の「一覧ページのスクロール固定」参照）は、
サイドバーの `top` を帯の高さ分だけずらして重なりを防ぐこと:

```css
.your-page__sidebar {
  position: sticky;
  top: var(--_sticky-band-h, 0px);                    /* 固定帯の高さ分だけずらす */
  max-height: calc(100vh - var(--_sticky-band-h, 0px));
  overflow-y: auto;
}
```

モバイル幅（`max-width: 767px`）では `position: sticky` を解除し縦積みに戻すこと:

```css
@media (max-width: 767px) {
  .your-page__sidebar {
    position: static;
    max-height: none;
    overflow-y: visible;
  }
}
```

---

## 一覧ページのスクロール固定

PageHeader・PageToolbar・DataTable thead を固定する場合の実装パターン。
`position: fixed` は使わない（ページ幅と合わなくなるため）。

### 3 段の役割と z-index

| 段 | 要素 | position | top | z-index |
|----|------|----------|-----|---------|
| 段1+2 | PageHeader + PageToolbar を包む `sticky-band` div | `sticky` | 0 | 20 |
| 段3 | DataTable `<thead>` | `sticky` | `var(--_sticky-band-h)` | 10 |

`--_sticky-band-h` は `sticky-band` の実測高さを JavaScript（ResizeObserver）で計測し、
ラッパー div の `style` 属性で渡すプライベート CSS 変数（`--_` プレフィックス）。

```tsx
// ページコンポーネント
const stickyBandRef = useRef<HTMLDivElement>(null);
const [stickyBandH, setStickyBandH] = useState(0);
useEffect(() => {
  const el = stickyBandRef.current;
  if (!el) return;
  const ro = new ResizeObserver(() => setStickyBandH(el.getBoundingClientRect().height));
  ro.observe(el);
  return () => ro.disconnect();
}, []);

return (
  // --_sticky-band-h を CSS カスケードで DataTable の th に届ける
  <div style={{ '--_sticky-band-h': `${stickyBandH}px` } as React.CSSProperties}>
    <div ref={stickyBandRef} className="your-page__sticky-band">
      <PageHeader ... />
      <PageToolbar className="your-page__toolbar" ... />
    </div>
    <DataTable ... stickyHeader />
  </div>
);
```

```css
/* sticky-band: PageHeader + PageToolbar を1枚のバックグラウンドで覆う */
.your-page__sticky-band {
  position: sticky;
  top: 0;
  z-index: 20;                                       /* DataTable thead (z-index:10) より手前 */
  background: var(--color-page);                     /* スクロール時に下の行が透けないように */
  padding-bottom: var(--page-toolbar-margin-bottom); /* PageToolbar の margin を吸収 */
}
/* PageToolbar 自身の margin-bottom は padding-bottom で代替するので 0 にする */
.your-page__toolbar { margin-bottom: var(--space-none); }
```

### `overflow: clip` を使う理由

DataTable に `stickyHeader` を渡すと内部で `.ui-data-table--sticky-header` クラスが付き、
`overflow: clip` が設定される。`overflow: hidden` は**スクロールコンテナを作るため**、
子孫の `position: sticky` が無効になる。`clip` は視覚的なクリッピングのみで
スクロールコンテナを作らないため、`<thead>` が page scroll に対して sticky として機能する。

### DataTable の stickyHeader prop

```tsx
<DataTable ... stickyHeader />
```

`stickyHeader` を渡すと:
- `.ui-data-table--sticky-header` クラスが付与される
- `overflow: clip` / `overflow-x: clip` が適用される（横スクロールは無効化）
- `<thead>` が `position: sticky; top: var(--_sticky-band-h, 0px); z-index: 10` になる

横スクロールが必要なテーブルには `stickyHeader` を付けないこと。

---

## 禁止事項

- **ハードコードした色値・px値を CSS に直接書かない**。`#3158d4` ではなく `var(--color-accent)` を使う
- **このリストにない名前を使わない**。`var(--space-4)` ではなく `var(--space-lg)` を使う
- **新しいトークンが必要な場合は `tokens.css` に追加してから参照する**。未定義のまま参照しない
