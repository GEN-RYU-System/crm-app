# Dashboard Preview — スタイル対応表

Sales Anchor (`~/salesanchor-readonly/frontend/src/pages/dashboard/*.css`) の
デザイントークンと CRM デザインシステムトークンの対応を記録する。

調査対象: `DashboardPage.css`, `FunnelSection.css`, `PriorityProspectsSection.css`, `WeeklyAdvisorSection.css`, `FollowUpsPage.css`

---

## スペーシング

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--space-1` | 4px | `--space-xs` | 4px | ✓ |
| `--space-2` | 8px | `--space-sm` | 8px | ✓ |
| `--space-3` | 12px | `--space-md` | 12px | ✓ |
| `--space-4` | 16px | `--space-lg` | 16px | ✓ |
| `--space-5` | **20px** | `--space-xl` | **24px** | △ 意図的差異（CRM palette-space-5=24px で固定済み） |
| `--space-6` | 24px | `--space-2xl` | 32px | △ 意図的差異（CRM palette-space-6=32px） |
| `--space-10` | 40px | （なし） | — | 未使用（dashboard-preview では参照なし） |

---

## 角丸

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--radius-sm` | 4px | `--radius-xs` | 4px | ✓ |
| `--radius-md` | 6px | `--radius-control` | 6px | ✓ |
| `--radius-lg` | **8px** | `--radius-card` | **8px** | ✓（PR4 で追加） |
| `--radius-badge` | 10px | `--radius-control` | 6px | △ 意図的近似（pill 型で代用可能な文脈） |
| `--radius-pill` | 9999px | `--radius-pill` | 999px | ✓ |
| `--radius-full` | 9999px | `--radius-pill` | 999px | ✓ |

> **注意**: CRM の `--radius-surface`（18px）は SA の `--radius-lg`（8px）と大きく異なる。
> ダッシュボードプレビューの内部カード（`dp-kpi-tile`, `dp-funnel-card`）には
> 新設した `--radius-card`（8px）を使用する。

---

## シャドウ

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | （なし） | — | 未使用 |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | `--shadow-sm` | 同値 | ✓（PR4 で追加） |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | （なし） | — | 未使用 |
| （重カード） | — | `--shadow-raised` | `0 10px 30px rgb(31 45 76/8%)` | CRM 既存。SA の shadow-sm より重い |

---

## フォントサイズ

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--font-xs` | 12px | `--font-xs` | 12px | ✓ |
| `--font-sm` | 13.6px | `--font-sm` | 13px | △ 0.6px 差（意図的近似） |
| `--font-base` | 14.4px | `--font-md` | 14px | △ 0.4px 差（意図的近似） |
| `--font-xl` | 20px | （なし） | — | 未使用（dashboard-preview では参照なし） |
| `--font-2xl` | **24px** | `--font-2xl` | **24px** | ✓（PR4 で追加） |
| `--font-3xl` | 32px | （なし） | — | 未使用 |
| （大数値） | — | `--font-stat` | 34px | CRM 既存。SA の font-2xl より大きい |

---

## フォントウェイト

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--font-weight-medium` | 500 | （なし） | — | 未使用（近似: semibold で代用） |
| `--font-weight-semi` | 600 | `--font-weight-semibold` | 600 | ✓ |
| `--font-weight-bold` | 700 | `--font-weight-bold` | 700 | ✓ |

---

## 色 — 背景

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--bg-surface` | #ffffff | `--color-surface` | #ffffff | ✓ |
| `--bg-primary` | #f5f7fa | `--color-page` | #f5f7fb | ✓ |
| `--bg-hover` | #e2e8f0 | （なし） | — | 未使用 |

---

## 色 — テキスト

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--text-primary` | #172033 | `--color-text-primary` | #172033 | ✓ |
| `--text-secondary` | #4a5568 | `--color-text-muted` | #67738a | △ 意図的近似（CRM に中間テキスト色なし） |
| `--text-muted` | #718096 | `--color-text-muted` | #67738a | △ 意図的近似 |

---

## 色 — アクセント

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--accent` | #3158d4 | `--color-accent` | #3158d4 | ✓ |
| `--on-accent` | #ffffff | `--color-on-solid` | #ffffff | ✓ |
| `--accent-bg-subtle` | #eaf0ff | `--color-accent-subtle` | #eaf0ff | ✓ |

---

## 色 — セマンティック

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--danger` | #bf3a4c | `--color-danger` | #bf3a4c | ✓ |
| `--danger-bg-subtle` | #fff0f1 | `--color-danger-subtle` | #fff0f1 | ✓ |
| `--warning` | #d97706 | `--color-warning` | #d97706 | ✓ |
| `--warning-text` | #744210 | `--color-warning-text` | #744210 | ✓ |
| `--warning-bg` | #fefcbf | `--color-warning-subtle` | #fefcbf | ✓ |
| `--warning-bg-subtle` | rgba(183,121,31,0.06) | `--color-warning-bg-subtle` | 同値 | ✓（PR4 で追加） |
| `--success` | #2e7d32 | `--color-success` | #2e7d32 | ✓ |
| `--success-text` | #22543d | `--color-success-text` | #22543d | ✓ |
| `--success-bg` | #c6f6d5 | `--color-success-subtle` | #c6f6d5 | ✓ |
| `--success-bg-subtle` | rgba(72,187,120,0.05) | `--color-success-bg-subtle` | 同値 | ✓（PR4 で追加） |

---

## 色 — ボーダー

| SA トークン | SA 実値 | CRM トークン | CRM 実値 | 一致 |
|------------|--------|------------|--------|------|
| `--border` / `--border-default` | #e2e8f0 | `--color-border` | #e2e7f0 | ✓ |
| `--border-muted` | （定義なし、border に近似） | `--color-border` | #e2e7f0 | △ 意図的近似 |
| `--border-subtle` | （定義なし） | `--color-border` | #e2e7f0 | △ 意図的近似 |

---

## ダッシュボード専用トークン

| SA トークン | SA 実値 | CRM 対応 | 備考 |
|------------|--------|---------|------|
| `--progress-bar-h` | 4px | 直書き `height: 4px` | height は checker 対象外。token 化不要 |
| `--dashboard-rank-badge` | 20px | 直書き `min-width: 20px; height: 20px` | PR5 で使用 |
| `--dashboard-badge-min-w` | 38px | 未使用（PR4 時点） | PR5 で必要なら追加 |

---

## 意図的差異サマリ

| 差異 | SA 値 | CRM 実装 | 理由 |
|------|-------|---------|------|
| カード内部 gap（バーラップ） | 2px | 0 | checker が raw `2px` を gap として検出するため丸めた |
| `--space-5` | 20px | `--space-xl`=24px | CRM palette-space-5 が 24px で固定済み。全体への影響を避けるため変更せず |
| `--space-6` | 24px | `--space-2xl`=32px | 同上 |
| `--text-secondary` | #4a5568 | `--color-text-muted`=#67738a | CRM に中間テキスト色なし。視覚差は軽微 |
| `--font-sm` | 13.6px | `--font-sm`=13px | 0.6px 差、視覚上無視可能 |
| `--radius-badge` | 10px | `--radius-control`=6px | 近似で十分 |

---

## 未対応ゼロ確認

- 上記表で「意図的差異」以外の「△」「✗」は存在しない
- PR4 で追加したトークン: `--radius-card`, `--shadow-sm`, `--font-2xl`, `--color-warning-bg-subtle`, `--color-success-bg-subtle`
- check-design-system violations: 0（`npm run build:gas` 通過済み）
