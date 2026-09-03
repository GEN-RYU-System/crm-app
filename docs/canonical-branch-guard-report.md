# canonical clone ブランチ関所 実装レポート

実施日: 2026-09-04

---

## 選定した方式

**候補B: `.githooks/pre-push` への追加**

### 理由

| 候補 | 採否 | 理由 |
|------|------|------|
| A. git hook（管理外） | — | B と同等。B で代替できる |
| B. `.githooks/pre-push` | **採用** | git 管理下。既存フックと同じファイルに自然に追加できる。crm-app 専用なので他リポジトリに影響なし |
| C. `~/.claude/scripts/` | **禁止** | PO決定（2026-09-03）。全セッションに適用され他リポジトリに影響する |
| D. CI | 不適 | canonical clone はローカルなので CI からは見えない |

### 判断結果

- **停止か警告か**: 警告のみ（push は続行）  
  停止させると正当な理由でブランチを移動している場合も止まる。  
  push は作業の区切りとして気づく機会として適切。
- **いつ検査するか**: `git push` 時（`.githooks/pre-push`）
- **例外**: なし（main も develop 以外として警告対象）

---

## 既存の仕組みの調査結果

### `.githooks/` 配下（実測）

```
total 16
-rwxr-xr-x  1  257  8月 30 08:52 pre-commit
-rwxr-xr-x  1 1840  8月 30 08:52 pre-push
```

#### `pre-commit` の機能

develop / main への直接 commit を禁止する（exit 1）。

#### `pre-push` の既存機能（変更前）

1. ディスク空き容量チェック（`MIN_FREE_GB`、デフォルト 10GB）
2. worktree 上限チェック（`MAX_WORKTREES`、デフォルト 19）
3. protected branch への直接 push 禁止（main / develop）

### `~/.claude/scripts/` 配下（参考のみ・変更なし）

| ファイル | 役割 |
|---------|------|
| `worktree-only-guard.sh` | git commit/push のガード（全セッション） |
| `gh-scope-guard.sh` | gh CLI スコープ制御（現在 exit 0 で無効） |
| `agent-danger-hook.sh` | 危険操作ブロック |
| `agent-start-hook.sh` | セッション開始イベント記録 |

PO 決定により、これらのファイルは変更しない。

---

## 実装内容

### 変更ファイル

`.githooks/pre-push`

### 変更箇所

変更前（10行）→ 変更後（26行）。追加した内容:

```sh
CANONICAL_DIR="${HOME}/crm-app-canonical-20260830"
```

および以下のブロック（既存の worktree チェックの直後に挿入）:

```sh
# canonical clone ブランチ関所（2026-09-04 追加）
# canonical clone が develop 以外のブランチにある場合、警告を出す（push は続行）
# 理由: 古いブランチのまま調査すると「存在するファイルを存在しない」と誤判定する事故が
#       2026-08-30・2026-09-03 に発生。機械で気づく仕組みを設ける。
#
# 実装ノート: git フック実行時は GIT_DIR 環境変数が worktree のパスに設定されるため、
# `git -C ${CANONICAL_DIR} branch --show-current` は worktree 自身のブランチを返してしまう。
# そのため HEAD ファイルを直接読んで canonical clone のブランチを取得する。
CANONICAL_HEAD_FILE="${CANONICAL_DIR}/.git/HEAD"
if [ -f "${CANONICAL_HEAD_FILE}" ]; then
  CANONICAL_HEAD_CONTENT=$(cat "${CANONICAL_HEAD_FILE}" 2>/dev/null || echo "")
  case "${CANONICAL_HEAD_CONTENT}" in
    ref:\ refs/heads/*)
      CANONICAL_BRANCH="${CANONICAL_HEAD_CONTENT#ref: refs/heads/}"
      ;;
    *)
      CANONICAL_BRANCH=""
      ;;
  esac
  if [ -n "${CANONICAL_BRANCH}" ] && [ "${CANONICAL_BRANCH}" != "develop" ]; then
    echo ""
    echo "======================================================"
    echo "  WARNING: canonical clone が develop 以外のブランチにいます"
    echo "  現在: ${CANONICAL_BRANCH}"
    echo "  戻し方: git -C ${CANONICAL_DIR} checkout develop"
    echo "======================================================"
    echo ""
    # 警告のみ。push は続行する
  fi
fi
```

**実装ノート（重要）**: 初期実装では `git -C ${CANONICAL_DIR} branch --show-current` を使用したが、
git フック実行時に `GIT_DIR` 環境変数が worktree 自身を指すため、常に worktree のブランチを
返してしまうことが判明（最初の push で誤検知が発生し確認）。
`.git/HEAD` ファイルを直接読む方式に修正した。

---

## 検証結果

### 検証1: 構文チェック

```
bash -n .githooks/pre-push
OK: 構文エラーなし
```

### 検証2: develop にいる場合に通ること（.git/HEAD 読み取り方式）

```
HEAD file: ref: refs/heads/develop
CANONICAL_BRANCH='develop'
OK: 警告なし（期待どおり）
```

canonical clone が develop のとき、.git/HEAD を読んで `develop` と判定 → 警告なし。

### 検証3: develop 以外で検出されること

```
git -C ~/crm-app-canonical-20260830 checkout main
→ Switched to branch 'main'

HEAD file: ref: refs/heads/main
CANONICAL_BRANCH='main'
======================================================
  WARNING: canonical clone が develop 以外のブランチにいます
  現在: main
  戻し方: git -C /Users/tanizawashingo/crm-app-canonical-20260830 checkout develop
======================================================
OK: WARNING が検出された（期待どおり）

git -C ~/crm-app-canonical-20260830 checkout develop
→ Switched to branch 'develop'（develop に戻した）
```

### 検証4: 既存のガードが引き続き動作すること

変更後の `pre-push` に以下の変数・チェックが存在することを grep で確認:

```
11:PROTECTED_BRANCHES="main develop"
12:MIN_FREE_GB="${CRM_MIN_FREE_GB:-10}"
13:MAX_WORKTREES="${CRM_MAX_WORKTREES:-19}"
18:if [ "$FREE_GB" -lt "$MIN_FREE_GB" ]; then
22:if [ "$WORKTREE_COUNT" -gt "$MAX_WORKTREES" ]; then
46:  for protected_branch in $PROTECTED_BRANCHES; do
```

既存3つのチェックがすべて残っている。

### 検証5: 他リポジトリへの影響なし

```
cd /Users/tanizawashingo/salesanchor && git status
→ On branch main（正常）
ls /Users/tanizawashingo/salesanchor/.githooks/
→ No such file or directory
```

salesanchor は `.githooks/` を持たない。crm-app の hooks は salesanchor に影響しない。  
`core.hooksPath` はリポジトリごとの設定であり、他リポジトリには適用されない。

### 発見した問題と修正

最初の push 時（検証中）に `GIT_DIR` 環境変数の問題が判明:

- **症状**: canonical clone が `develop` にあるのに、WARNING が `release/canonical-branch-guard` を表示
- **原因**: git フック実行時、`GIT_DIR` が現在の worktree を指すため `git -C` では canonical clone のブランチを取得できない
- **修正**: `git branch --show-current` を廃止し、`.git/HEAD` ファイルを直接読む方式に変更
- **再検証**: 修正後に検証2・3を実施し、いずれも期待どおり

---

## 復元手順

本変更は git 管理下（`.githooks/pre-push`）のため、git でいつでも戻せる。

```bash
git revert <このPRのSHA>
# または
git checkout <変更前のSHA> -- .githooks/pre-push
```

`~/.claude/scripts/` は変更していないためバックアップは不要。

---

## 【未確認】項目

なし。

---

## `docs/AUTONOMOUS_WORK_RULES.md` の更新

「canonical clone での直接編集の禁止」セクションの「作業終了時の確認」部分に、
関所設置の旨（WARNING の例と実装箇所）を追記した。
