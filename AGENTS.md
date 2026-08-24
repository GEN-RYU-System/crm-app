# Development Rules

## Frontend smoke checks

- Every frontend PR must include a real-screen smoke check covering login, dashboard, and inbox display.
- A session without browser access must not merge a PR that changes an application startup path, including Provider, Context, or `App.tsx`. It may implement and open the PR; merging requires owner confirmation or a browser-capable session.
- A newly created worktree must run `npm ci` before frontend checks or builds.

## Public-repository records

- Do not write a matched value or a value suspected to be sensitive verbatim in logs, PR descriptions, or commit messages. Record a masked value and file/line only.
