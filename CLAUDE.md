# CLAUDE.md — GEN-RYU CRM App

## プロジェクト前提

- **リポジトリ**: GEN-RYU-System/crm-app（GitHub）
- **ローカルパス**: `~/crm-app-new`
- **組織**: GEN-RYU System（源流システム）
- **スタック**: Google Apps Script (GAS) + React 18 + TypeScript + Vite

## アーキテクチャ

```
frontend/（Vite + React 18）
  └── npm run build:gas
      └── src/ReactPoc.html（JS+CSS インライン埋め込み 287KB）
          └── clasp push（CI経由のみ）
              └── GAS プロジェクト（doGet → React マウント）
```

- GAS との通信: `frontend/src/gas/client.ts` が `window.google?.script?.run` 経由で全呼び出し管理
- GAS側エントリ: `src/27_WebApp.js`

## ブランチ運用

| ブランチ | 用途 |
|---------|------|
| `release/*` | 作業ブランチ（ここで開発） |
| `develop` | DEV環境自動配布の基点（PR mergeで配布） |
| `main` | PROD環境（DEV完成後のみ） |

- **新規作業**: `release/<topic>` ブランチを `develop` から作成
- **直接 push 禁止**: `main` / `develop` への直接 push は `.githooks/pre-push` でブロック
- **clasp push はCI経由のみ**（ローカルからの直接 push 禁止）

## ディレクトリ構成

```
src/             GAS ソースコード（clasp push 対象）
frontend/
  src/
    pages/       dashboard / customers / leads / inbox / data-management / catalog
    features/    customers / inbox
    gas/         client.ts（GAS呼び出しハブ）
    components/  共通UIコンポーネント
    styles/      デザイントークン
docs/
  HANDOFF_FRONTEND.md        フロントエンド引き継ぎドキュメント（必読）
  ENVIRONMENT_AND_RELEASE_FLOW.md  環境・リリースフロー
scripts/         ビルド補助・フック設定
```

## 開発コマンド

```bash
# フロントエンド開発サーバー（GASなしでUI確認）
cd frontend && npm run dev

# GAS配布用ビルド（typecheck → build → emit-gas-html → design-system check）
cd frontend && npm run build:gas

# Gitフック設定（クローン後一度だけ）
bash scripts/setup-hooks.sh
```

## 重要制約

- `clasp push` ローカル実行禁止 → コミット→push→CI配布の一方通行
- DEV確認は `/dev` 画面のみ（顧客に渡さない）
- シークレット（SPREADSHEET_ID 等）はコード・PR本文に書かない
- `--no-verify` 使用禁止

## 作業開始前チェック

```bash
git fetch origin
git checkout develop
git pull origin develop
# → release/<topic> を develop から作成して作業
```

## ブランチ確認（複数セッション運用のため必須）

複数のセッションが同一リポジトリを操作している。
`git checkout -b` が意図通りに効かず、別セッションの作業ブランチ上に
コミットされる事故が実際に発生した（`654fa92` が
`release/session-auth-migration` に混入し、PR #201 と #202 に
同じ変更が二重に乗った）。

以下を必ず守る。

1. ブランチを切った直後に、実際にそのブランチにいることを確認する
   ```bash
   git branch --show-current
   ```
   → 期待したブランチ名と一致しない場合は、コミットせずに報告して止まる

2. commit の直前にも同じ確認を行う
   意図と違うブランチにいた場合は、コミットせずに報告して止まる

3. push は明示的に対象ブランチを指定する
   ```bash
   git push -u origin <ブランチ名>
   ```
   `HEAD:` 形式での push は、どのブランチから送っているかが
   分かりにくいため避ける

4. PR 作成後、diff に意図しないコミットが含まれていないか確認する
   ```bash
   gh pr view <番号> --json commits
   ```
   → 自分が作ったコミット以外が含まれていたら報告して止まる

## マージ完了の報告

「マージしてよい」と判断を得た後、以下を必ず報告してから次の作業に移る。

1. `mergedAt` の実測値（`gh pr view <番号> --json mergedAt` の出力）
2. 作業ブランチの削除結果
3. Deploy to DEV の conclusion（`develop` へのマージ時のみ）
   ```bash
   gh run list --workflow deploy-dev.yml --limit 1
   ```

報告せずに次の作業に着手しない。  
マージ漏れが実際に発生している（PR #189 / PR #203）。

## HANDOFF_FRONTEND.md の更新基準

以下に該当する変更をマージした場合のみ、
`docs/HANDOFF_FRONTEND.md` の該当セクションを更新する。

- 新しいページの追加、または state の昇格（planned → preview → available）
- 画面構成・ナビゲーション構造の変更
- 方針の決定・変更（設計判断、廃止方針など）
- 未確認事項の解消、または新たに判明した制約

該当しないもの（バグ修正、文言変更、小さな調整）では更新しない。  
HANDOFF は「今どうなっているか」を書く文書であり、
作業履歴は GitHub の PR 一覧で追跡する。
