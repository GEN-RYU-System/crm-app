# Dashboard Preview 作業ログ

## 設計判断メモ

### recharts を見送った理由
- バンドルサイズへの影響: 現在 484KB → 追加後 約1,057KB（bundlephobia recharts@3.10.1: minified 561,681B / gzip 147,530B）
- vite-plugin-singlefile で全 JS+CSS を ReactPoc.html に埋め込む構成のため、約2倍の増加が確定する
- 代替: CSS のみで棒グラフを自前実装（Sales Anchor DashboardPage.tsx:666–723 と同構成）
- 判断者: Shingo（2026-08-26 自律実装モード指示）

### inbox/previewAdapter.ts が存在しない件
- HANDOFF_FRONTEND.md に記載があるが、現リポジトリでは grep 0件
- 確認コマンド: `grep -r "previewAdapter" frontend/src/ --include="*.ts" -l`
- 影響なし。今回は features/dashboardPreview/previewAdapter.ts として新規作成する

---

## PR 1: 土台（リード KPI セクション）

- **PR 番号**: #643
- **URL**: https://github.com/GEN-RYU-System/crm-app/pull/643
- **マージコミット SHA**: 354ae6c3ac82851128ce29594dee76d07a51308b

### 変更ファイル一覧

| ファイル | 内容 |
|---------|------|
| `frontend/src/content/ja/dashboardPreview.ts` | 日本語文言・仮データ名 |
| `frontend/src/features/dashboardPreview/contracts.ts` | DTO 型・Repository interface |
| `frontend/src/features/dashboardPreview/previewAdapter.ts` | 仮データ実装（ハードコードはここのみ） |
| `frontend/src/pages/dashboardPreview/DashboardPreviewPage.tsx` | ページコンポーネント（リード KPI のみ） |
| `frontend/src/pages/dashboardPreview/DashboardPreviewPage.css` | スタイル（token のみ） |
| `frontend/src/content/ja/index.ts` | dashboardPreviewCopy をエクスポート追加 |
| `frontend/src/content/ja/navigation.ts` | dashboardPreview ラベル追加 |
| `frontend/src/app/navigation.ts` | NavigationItemId 追加・development グループへ項目追加 |
| `frontend/src/App.tsx` | /dashboard-preview ルート追加 |
| `frontend/scripts/check-design-system.mjs` | nonHubIds に dashboardPreview 追加 |
| `docs/DASHBOARD_PREVIEW_LOG.md` | 本ファイル（新規） |

### 何を作ったか
ダッシュボードのデモページ（#/dashboard-preview）の土台を作成した。
GAS に接続せず、全て仮データ（ハードコード）で動作する。
リード KPI セクション（リード数・成約数・除外数・転換率・前期比）のみ表示。

### 移植元 Sales Anchor ファイル
- `frontend/src/pages/dashboard/DashboardPage.tsx:593–617`（リード KPI カード）
- `frontend/src/pages/dashboard/DashboardPage.tsx:388–390`（前期比・changeDir ロジック）

### ReactPoc.html サイズ
- **変更前**: 495,340 B（ベースライン）
- **変更後**: 490,410 B（gzip 127.17 KB）
- **増加量**: −4,930 B（ビルドハッシュ差分による変動）

### Deploy to DEV
- **結果**: success（PR #643 マージ直後の deploy-dev.yml run）

### 戻し方
```bash
git revert -m 1 354ae6c3ac82851128ce29594dee76d07a51308b
git push origin develop
```

### 確認用 DEV URL
（DEV 配布後に確認）

---

## PR 2: 全セクション

- **PR 番号**: #644
- **URL**: https://github.com/GEN-RYU-System/crm-app/pull/644
- **マージコミット SHA**: bb3991f0a7f28d007e844178d0b06032f1a3844b

### セクション一覧と移植元

8セクション中6のみ実装。2件は PR 5 で追加。

| セクション | 移植元 Sales Anchor |
|-----------|-------------------|
| フォローアップ | `DashboardPage.tsx:472–536` |
| 目標達成率（月次・週次） | `DashboardPage.tsx:539–580`、`DashboardPage.tsx:206–225`（AchievementBar） |
| リード KPI | `DashboardPage.tsx:593–617` |
| 売上・受注 KPI | `DashboardPage.tsx:628–728` |
| 売上推移グラフ（CSS棒グラフ） | `DashboardPage.tsx:666–723`（recharts 版の構成を CSS で再現） |
| ファネル（4段階） | `FunnelSection.tsx:446–543` |
| AI推薦（優先見込み客） | → PR 5 |
| 週次アドバイザー | → PR 5 |

### ReactPoc.html サイズ
- **変更前**: 490,410 B（PR1後）
- **変更後**: 503,440 B（gzip 129.51 KB）
- **増加量**: +13,030 B

### Deploy to DEV
- **結果**: success（PR #644 マージ直後の deploy-dev.yml run）

### 戻し方
```bash
git revert -m 1 bb3991f0a7f28d007e844178d0b06032f1a3844b
git push origin develop
```

### 確認用 DEV URL
（DEV 配布後に確認）

---

## PR 4: SA トークン対応・CSS 修正・スタイル対応表

- **PR 番号**: #646
- **URL**: https://github.com/GEN-RYU-System/crm-app/pull/646
- **マージコミット SHA**: cd8318bffbbaade7ae8b2dab9d2d38a61d47c982

### 変更ファイル一覧

| ファイル | 行数 | 内容 |
|---------|-----:|------|
| `docs/DASHBOARD_PREVIEW_STYLE_MAP.md` | 160 | SA↔CRM トークン対応表（新規） |
| `docs/DASHBOARD_PREVIEW_LOG.md` | 104 | PR2 節に「8セクション中6のみ実装」注記追加 |
| `frontend/docs/design-system/foundation.md` | 70 | ダッシュボードプレビュー専用トークン節追記（58–70行） |
| `frontend/src/styles/palette.css` | 46 | SA 対応トークン 5 件追加 |
| `frontend/src/styles/tokens.css` | 50 | SA 対応トークン 5 件追加（palette alias） |
| `frontend/src/pages/dashboardPreview/DashboardPreviewPage.css` | 90 | 下記 CSS 修正 |

### 追加トークン（palette.css → tokens.css）

| tokens.css トークン | 値 | 対応 SA トークン |
|--------------------|----|----------------|
| `--radius-card` | `8px` | `--radius-lg` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | `--shadow-sm` |
| `--font-2xl` | `24px` | `--font-2xl` |
| `--color-warning-bg-subtle` | `rgba(183,121,31,0.06)` | `--warning-bg-subtle` |
| `--color-success-bg-subtle` | `rgba(72,187,120,0.05)` | `--success-bg-subtle` |

### CSS 修正（DashboardPreviewPage.css）

| 箇所 | 修正前 | 修正後 |
|------|-------|-------|
| `:83` `.dp-funnel-card--bottleneck` の border-color | `var(--color-danger)` | `var(--color-warning)` |
| `:83` `.dp-funnel-card--bottleneck` の background | `var(--color-danger-subtle)` | `var(--color-warning-subtle)` |
| `:55` `.dp-kpi-tile` の border-radius | `var(--radius-surface)`（18px） | `var(--radius-card)`（8px） |
| `:55` `.dp-kpi-tile` の box-shadow | なし | `var(--shadow-sm)` |
| `:57` `.dp-kpi-tile__value` の font-size | `var(--font-stat)`（34px） | `var(--font-2xl)`（24px） |
| `:17` `.dp-achievement-bar` の height | `6px` | `4px` |

ボトルネック色バグの根拠: SA `FunnelSection.css` が bottleneck に `--warning` / `--warning-bg-subtle` を使用している。PR2 実装時に `--color-danger` を誤設定した。

### Deploy to DEV
- **結果**: success（PR #646 マージ直後の deploy-dev.yml run）

### 戻し方
```bash
git revert -m 1 cd8318bffbbaade7ae8b2dab9d2d38a61d47c982
git push origin develop
```

---

## PR 5: 残り2セクション（AI推薦・週次アドバイザー）

- **PR 番号**: #647
- **URL**: https://github.com/GEN-RYU-System/crm-app/pull/647
- **マージコミット SHA**: 455aefc735d93e486b2d5c2ba0303c85f500e985

### 変更ファイル一覧

| ファイル | 行数 | 内容 |
|---------|-----:|------|
| `frontend/src/content/ja/dashboardPreview.ts` | 146 | `fakeAiRecommendations`・`fakeWeeklyAdvisor` 追加 |
| `frontend/src/features/dashboardPreview/contracts.ts` | 125 | AI推薦・週次アドバイザー型追加 |
| `frontend/src/features/dashboardPreview/previewAdapter.ts` | 197 | `getAiRecommendations`・`getWeeklyAdvisor` 追加 |
| `frontend/src/pages/dashboardPreview/DashboardPreviewPage.css` | 112 | `dp-prospect-*`・`dp-advisor-*` スタイル追加 |
| `frontend/src/pages/dashboardPreview/DashboardPreviewPage.tsx` | 425 | 2セクション追加 |

### 追加セクションと移植元

| セクション | 移植元 Sales Anchor |
|-----------|-------------------|
| AI推薦（優先見込み客） | `PriorityProspectsSection.tsx:114–484`（表示部のみ。Composer・GAS 接続は含まない） |
| 週次アドバイザー | `WeeklyAdvisorSection.tsx:114–456`（同上） |

### 仮データの分離方針

- 日本語文言（顧客名・ステージ名・理由・アドバイス文章）→ `content/ja/dashboardPreview.ts`
- 数値（スコア: 94/87/81/76/71）→ `previewAdapter.ts:163`（`scores` 配列）
- カテゴリ文字列（`'action'`・`'alert'`・`'insight'`）→ `content/ja/dashboardPreview.ts` の `fakeWeeklyAdvisor.cards[n].category`

### ReactPoc.html サイズ
- **変更前**: 503,440 B（PR2後）
- **変更後**: 509,150 B（gzip 130.94 KB）
- **増加量**: +5,710 B

### Deploy to DEV
- **結果**: success（PR #647 マージ直後の deploy-dev.yml run）

### 戻し方
```bash
git revert -m 1 455aefc735d93e486b2d5c2ba0303c85f500e985
git push origin develop
```

---

## 複数 PR を戻す順番

新しい順（PR5 → PR4 → PR2 → PR1）に revert する。

```bash
git revert -m 1 455aefc735d93e486b2d5c2ba0303c85f500e985  # PR5
git revert -m 1 cd8318bffbbaade7ae8b2dab9d2d38a61d47c982  # PR4
git revert -m 1 bb3991f0a7f28d007e844178d0b06032f1a3844b  # PR2
git revert -m 1 354ae6c3ac82851128ce29594dee76d07a51308b  # PR1
git push origin develop
```
