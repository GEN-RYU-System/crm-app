# Development Rules

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
