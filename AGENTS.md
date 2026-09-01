# Development Rules

## ガードは停止信号であり、迂回してはならない

フック（worktree-only-guard / agent-danger-hook /
gh-scope-guard など）にブロックされた場合、
理由を問わず即座に停止し、PO に報告すること。

禁止される対処（例外なし）:
- ! プレフィックスでのホスト直接実行
- GH_SCOPE_OVERRIDE 等の環境変数による強制
- permit ファイルの自己作成
  （~/.claude/permits/ 配下へのファイル書き込み。
  permit-peek.sh / permit-danger.sh の実行を含む。
  printf や echo による直接作成も同じ扱いとする）
  permit の発行は PO のみが行う。
  エージェントが自分で許可を発行してはならない。
- フック本体や設定ファイル（agent-tokens.json 等）の編集
- 他 worktree やリポジトリルートの .pr-number 書き換え

ブロックは「作業を止める合図」であり、
「回避方法を探す合図」ではない。
迂回した時点で、その作業は失敗とみなす。

## CI 検査ルールの変更には承認が必要

frontend/scripts/ 配下の検査スクリプト
（check-design-system.mjs、check-sensitive-content.mjs、
その他 CI が実行する検査）を変更する場合、
必ず事前に PO の承認を得ること。

検査に引っかかったときの原則:
- 検査を緩める前に、まず報告して判断を仰ぐ
- 「検査が邪魔だから範囲を狭める」は禁止
- コード側を直して通せないかを先に検討する

2026-09-01、preview/gasRunnerMock.ts に日本語を書いた結果
check-design-system が失敗し、CC が自己判断で preview/ を
検査対象から除外した（PR #887）。
変更内容自体は妥当だったが、承認を経ずに検査を緩めた点が問題。
以後は事前承認を必須とする。

## 履歴を書き換える操作は行わない

git rebase / git reset --hard / git push --force は
いかなる理由でも実行しない。
リモートと乖離した場合は、origin/develop から
ブランチを作り直すこと。

## PR 作成後の所有宣言

gh pr create の直後、`~/crm-app-current/.pr-number` に PR番号を書く:

```
echo <PR番号> > ~/crm-app-current/.pr-number
```

マージ完了後は削除する:

```
rm ~/crm-app-current/.pr-number
```

**根拠（実測）:** gh-scope-guard.sh は `git rev-parse --show-toplevel` で
REPO_ROOT を取得する。フックは Bash ツール内の `cd` より前に走るため、
cwd は Claude Code のプライマリ作業ディレクトリ（`~/crm-app-current`）になる。
`git rev-parse --show-toplevel` の実測値は `/Users/tanizawashingo/crm-app-current`。
worktree 内・`~/crm-app-canonical-20260830/` に置いても読まれない。

## Frontend smoke checks

- Every frontend PR must include a real-screen smoke check covering login, dashboard, and inbox display.
- A session without browser access must not merge a PR that changes an application startup path, including Provider, Context, or `App.tsx`. It may implement and open the PR; merging requires owner confirmation or a browser-capable session.
- A newly created worktree must run `npm ci` before frontend checks or builds.

## Public-repository records

- Do not write a matched value or a value suspected to be sensitive verbatim in logs, PR descriptions, or commit messages. Record a masked value and file/line only.

- AUTONOMOUS_WORK_LOG.mdへの追記は必ずファイル末尾に日付見出し付きセクションで行う。中間挿入・既存行編集は禁止。

## Git pre-commit hook（develop/main への直接コミット禁止）

`.githooks/pre-commit` に develop / main への直接コミットを拒否するフックを設置済み。
新規クローン後は以下のコマンドで有効化すること（1回のみ実行）:

```bash
git config core.hooksPath .githooks
```

- `core.hooksPath` はリポジトリローカル設定（`--global` は不要）。
- フックは `.githooks/pre-commit` に実装。develop / main 上でコミットしようとすると ERROR で中断する。
- feature/* / release/* ブランチ上では通常どおりコミットできる。
