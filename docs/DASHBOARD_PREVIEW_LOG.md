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

| セクション | 移植元 Sales Anchor |
|-----------|-------------------|
| フォローアップ | `DashboardPage.tsx:472–536` |
| 目標達成率（月次・週次） | `DashboardPage.tsx:539–580`、`DashboardPage.tsx:206–225`（AchievementBar） |
| リード KPI | `DashboardPage.tsx:593–617` |
| 売上・受注 KPI | `DashboardPage.tsx:628–728` |
| 売上推移グラフ（CSS棒グラフ） | `DashboardPage.tsx:666–723`（recharts 版の構成を CSS で再現） |
| ファネル（4段階） | `FunnelSection.tsx:446–543` |

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
