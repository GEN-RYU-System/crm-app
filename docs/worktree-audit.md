# Worktree 棚卸しレポート

> 作成日: 2026-08-31  
> 作成者: CC（自律セッション）  
> 目的: worktree 上限（19/20）到達を受け、削除候補の特定  
> 操作: 調査のみ。削除はPOが判断する

---

## 1. 実行コマンド・出力（全文）

### git worktree list

```
/Users/tanizawashingo/crm-app-canonical-20260830                       c95c29b [develop]
/Users/tanizawashingo/worktrees/core-shipment-api                      3ad8c84 [feat/core-shipment-api]
/Users/tanizawashingo/worktrees/crm-app/docs-worklog-pr737             44cc059 [docs/worklog-pr737]
/Users/tanizawashingo/worktrees/crm-app/docs-worklog-purchases-rename  a6da7d4 [docs/worklog-purchases-rename]
/Users/tanizawashingo/worktrees/crm-app/feat-country-master-ja-names   6e88095 [feat/country-master-ja-names]
/Users/tanizawashingo/worktrees/crm-app/feat-own-master-sheets         56a6a07 [feat/own-master-sheets]
/Users/tanizawashingo/worktrees/crm-app/feat-shipment-inline-edit      bef4cb6 [feat/shipment-inline-edit]
/Users/tanizawashingo/worktrees/crm-app/feat-shipment-stage-advance    9fdbed4 [feat/shipment-stage-advance]
/Users/tanizawashingo/worktrees/crm-app/feat-shipment-stage-columns    e7300dc [feat/shipment-stage-columns]
/Users/tanizawashingo/worktrees/crm-app/release-workrules-pr-number    dca7a18 [release/workrules-pr-number]
/Users/tanizawashingo/worktrees/order-status-confirmed                 f787598 [feat/order-status-confirmed]
/Users/tanizawashingo/worktrees/purchase-stage-filter                  19b95ef [feat/purchase-stage-filter]
/Users/tanizawashingo/worktrees/sales-order-purchase-tab               a01a0c4 [feat/sales-order-purchase-tab]
/Users/tanizawashingo/worktrees/worklog-order-confirmed                d0c0c86 [docs/worklog-order-status-confirmed]
/Users/tanizawashingo/worktrees/worklog-purchase-stage-filter          3bd91b9 [docs/worklog-purchase-stage-filter]
/Users/tanizawashingo/worktrees/worklog-purchase-tab                   a195c88 [docs/worklog-purchase-tab]
/Users/tanizawashingo/worktrees/worklog-shipment-api                   9e85699 [docs/worklog-shipment-api]
```

※ この棚卸しのための worktree `docs/worktree-audit` は上記に含まれていない（作業ログ後に追加）。

---

## 2. 判定基準（先行定義）

| 判定 | 条件 |
|------|------|
| 削除候補 | `git status --short` が空（未コミット変更なし） **かつ** PRがdevelopにマージ済み |
| 保留 | 未コミット変更がある（他セッションが作業中の可能性） |
| 【未確認】 | 判定できない |

**補足**: squash merge は `git branch -r --merged origin/develop` に出ないため、  
マージ済み判定は `gh pr list --state merged` で確認した。

---

## 3. 棚卸し結果

| worktree パス | ブランチ | 未コミット変更 | PR番号 | マージ日 | 判定 |
|---------------|---------|---------------|--------|---------|------|
| ~/crm-app-canonical-20260830 | develop | `?? .pr-number` のみ | — | — | 対象外（canonical） |
| ~/worktrees/core-shipment-api | feat/core-shipment-api | `?? .pr-number` のみ | #676 | 2026-08-30 | **保留** |
| ~/worktrees/crm-app/docs-worklog-pr737 | docs/worklog-pr737 | なし | #739 | 2026-08-31 | **削除候補** |
| ~/worktrees/crm-app/docs-worklog-purchases-rename | docs/worklog-purchases-rename | なし | #738 | 2026-08-31 | **削除候補** |
| ~/worktrees/crm-app/feat-country-master-ja-names | feat/country-master-ja-names | `?? .pr-number` のみ | #690 | 2026-08-30 | **保留** |
| ~/worktrees/crm-app/feat-own-master-sheets | feat/own-master-sheets | `?? .pr-number` のみ | #723 | 2026-08-31 | **保留** |
| ~/worktrees/crm-app/feat-shipment-inline-edit | feat/shipment-inline-edit | `?? .pr-number` のみ | #711 | 2026-08-30 | **保留** |
| ~/worktrees/crm-app/feat-shipment-stage-advance | feat/shipment-stage-advance | `?? .pr-number` のみ | #696 | 2026-08-30 | **保留** |
| ~/worktrees/crm-app/feat-shipment-stage-columns | feat/shipment-stage-columns | `?? .pr-number` のみ | #692 | 2026-08-30 | **保留** |
| ~/worktrees/crm-app/release-workrules-pr-number | release/workrules-pr-number | `?? .pr-number` のみ | #721 | 2026-08-31 | **保留** |
| ~/worktrees/order-status-confirmed | feat/order-status-confirmed | `?? .pr-number` のみ | #665 | 2026-08-30 | **保留** |
| ~/worktrees/purchase-stage-filter | feat/purchase-stage-filter | なし | #667 | 2026-08-30 | **削除候補** |
| ~/worktrees/sales-order-purchase-tab | feat/sales-order-purchase-tab | なし | #663 | 2026-08-30 | **削除候補** |
| ~/worktrees/worklog-order-confirmed | docs/worklog-order-status-confirmed | なし | #666 | 2026-08-30 | **削除候補** |
| ~/worktrees/worklog-purchase-stage-filter | docs/worklog-purchase-stage-filter | `?? .pr-number` のみ | #670 | 2026-08-30 | **保留** |
| ~/worktrees/worklog-purchase-tab | docs/worklog-purchase-tab | なし | #664 | 2026-08-30 | **削除候補** |
| ~/worktrees/worklog-shipment-api | docs/worklog-shipment-api | `?? .pr-number` のみ | #677 | 2026-08-30 | **保留** |

---

## 4. 集計

| 判定 | 件数 |
|------|------|
| 削除候補 | **6件** |
| 保留 | **10件** |
| 【未確認】 | 0件 |

合計（canonical除く）: 16件

---

## 5. 削除候補 一覧

| # | worktree パス | ブランチ | PR |
|---|---------------|---------|-----|
| 1 | ~/worktrees/crm-app/docs-worklog-pr737 | docs/worklog-pr737 | #739 |
| 2 | ~/worktrees/crm-app/docs-worklog-purchases-rename | docs/worklog-purchases-rename | #738 |
| 3 | ~/worktrees/purchase-stage-filter | feat/purchase-stage-filter | #667 |
| 4 | ~/worktrees/sales-order-purchase-tab | feat/sales-order-purchase-tab | #663 |
| 5 | ~/worktrees/worklog-order-confirmed | docs/worklog-order-status-confirmed | #666 |
| 6 | ~/worktrees/worklog-purchase-tab | docs/worklog-purchase-tab | #664 |

削除時のコマンド例（POが実行する場合）:

```bash
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/crm-app/docs-worklog-pr737
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/crm-app/docs-worklog-purchases-rename
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/purchase-stage-filter
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/sales-order-purchase-tab
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/worklog-order-confirmed
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/worklog-purchase-tab
```

---

## 6. 保留（10件）の補足

**全10件の未コミット変更の内容は `?? .pr-number` のみ**（未追跡ファイル）。  
これは `gh-scope-guard` のための運用ファイルであり、コードの変更ではない。

ただし「他セッションが作業中の可能性」を排除できないため、判定基準どおり **保留** とした。  
これらは「PR はマージ済み・コード変更なし・`.pr-number` 残存のみ」の状態である。

POが安全に削除できると判断した場合のコマンド例:

```bash
# 例: core-shipment-api
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/core-shipment-api

# 例: feat-country-master-ja-names
git -C ~/crm-app-canonical-20260830 worktree remove ~/worktrees/crm-app/feat-country-master-ja-names

# 以下同様（--force は不要。変更なしのため）
```

---

## 7. 注意事項

- この文書は **削除指示ではなく調査報告** である
- 削除判断・実行は PO が行う
- 棚卸し後に worktree が追加された場合（例: `docs/worktree-audit`）はこの表に含まれていない
- `git branch -r --merged` が `feat/*` / `docs/*` を返さない理由:  
  squash merge はコミット履歴を親に含めないため、`--merged` 判定に現れない（正常な動作）
