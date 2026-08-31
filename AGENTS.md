# Development Rules

## ガードは停止信号であり、迂回してはならない

フック（worktree-only-guard / agent-danger-hook /
gh-scope-guard など）にブロックされた場合、
理由を問わず即座に停止し、PO に報告すること。

禁止される対処（例外なし）:
- ! プレフィックスでのホスト直接実行
- GH_SCOPE_OVERRIDE 等の環境変数による強制
- permit スクリプトの実行
- フック本体や設定ファイル（agent-tokens.json 等）の編集
- 他 worktree やリポジトリルートの .pr-number 書き換え

ブロックは「作業を止める合図」であり、
「回避方法を探す合図」ではない。
迂回した時点で、その作業は失敗とみなす。

## 履歴を書き換える操作は行わない

git rebase / git reset --hard / git push --force は
いかなる理由でも実行しない。
リモートと乖離した場合は、origin/develop から
ブランチを作り直すこと。

## PR 作成後の所有宣言

gh pr create の直後に、その worktree 内で
echo <PR番号> > .pr-number を実行する。
これは gh-scope-guard の正規手順である。
リポジトリルートには絶対に書かない。

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
