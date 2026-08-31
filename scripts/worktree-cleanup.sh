#!/bin/sh
# scripts/worktree-cleanup.sh
# squash merge 対応 worktree クリーンアップスクリプト
#
# 使い方:
#   bash scripts/worktree-cleanup.sh --dry-run    # 判定のみ（デフォルト）
#   bash scripts/worktree-cleanup.sh --execute    # 実削除
#
# 削除条件（すべて満たす場合のみ）:
#   1. develop / main ではない
#   2. canonical clone ではない（git worktree list の先頭エントリ）
#   3. 実行中ワークツリーではない
#   4. PR がマージ済み（gh pr list --state merged）
#   5. 未コミット変更がない（.pr-number のみは OK）
#
# 保護条件（1つでも該当したら削除しない）:
#   1. canonical clone
#   2. 実行中ワークツリー
#   3. develop / main ブランチ
#   4. PR が open または存在しない
#   5. .pr-number 以外の未追跡ファイル・変更がある

set -eu

# スクリプトが置かれているリポジトリの worktree root
SCRIPT_ROOT=$(cd "$(dirname "$0")" && git rev-parse --show-toplevel)

# canonical clone = git worktree list の先頭エントリ
MAIN_WORKTREE=$(git -C "$SCRIPT_ROOT" worktree list --porcelain \
  | awk '/^worktree /{print $2; exit}')

EXECUTE=false
[ "${1:-}" = "--execute" ] && EXECUTE=true

printf 'worktree-cleanup.sh 開始 (mode=%s)\n' \
  "$([ "$EXECUTE" = true ] && echo EXECUTE || echo DRY-RUN)"
printf '%s\n' "------------------------------------------------------------"

# worktree リストをファイルに保存して subshell 問題を回避
TMPLIST=$(mktemp)
trap 'rm -f "$TMPLIST"' EXIT INT TERM

git -C "$SCRIPT_ROOT" worktree list --porcelain \
  | awk '/^worktree /{p=$2}/^branch refs\/heads\//{b=$2; sub("refs/heads/","",b); print p "|" b}' \
  > "$TMPLIST"

removed=0
kept=0

while IFS='|' read -r path branch; do

  # canonical clone（先頭エントリ）は保護
  if [ "$path" = "$MAIN_WORKTREE" ]; then
    printf 'KEEP   %s (%s canonical clone)\n' "$path" "$branch"
    kept=$((kept + 1))
    continue
  fi

  # 実行中ワークツリーは保護（自己削除防止）
  if [ "$path" = "$SCRIPT_ROOT" ]; then
    printf 'KEEP   %s (%s 実行中ワークツリー)\n' "$path" "$branch"
    kept=$((kept + 1))
    continue
  fi

  # develop / main は保護
  if [ "$branch" = "develop" ] || [ "$branch" = "main" ]; then
    printf 'KEEP   %s (%s 保護ブランチ)\n' "$path" "$branch"
    kept=$((kept + 1))
    continue
  fi

  # 未コミット変更チェック（.pr-number のみは OK）
  dirty_files=$(git -C "$path" status --porcelain | grep -v '^?? \.pr-number$' || true)
  if [ -n "$dirty_files" ]; then
    printf 'KEEP   %s (%s dirty: 未コミット変更あり)\n' "$path" "$branch"
    kept=$((kept + 1))
    continue
  fi

  # PR マージ済みチェック
  merged=$(gh pr list --state merged --head "$branch" --limit 1 --json number \
    2>/dev/null || printf '[]')
  if ! printf '%s' "$merged" | grep -qF '"number"'; then
    printf 'KEEP   %s (%s PR未マージまたは不明)\n' "$path" "$branch"
    kept=$((kept + 1))
    continue
  fi

  # 削除対象
  printf 'REMOVE %s (%s PR済み)\n' "$path" "$branch"
  if [ "$EXECUTE" = true ]; then
    if [ -f "$path/.pr-number" ]; then
      rm "$path/.pr-number"
    fi
    git -C "$MAIN_WORKTREE" worktree remove "$path"
    printf '  → 削除完了\n'
  fi
  removed=$((removed + 1))

done < "$TMPLIST"

printf '%s\n' "------------------------------------------------------------"
printf '集計: 削除%s=%d件 / 保護=%d件\n' \
  "$([ "$EXECUTE" = true ] && echo "済み" || echo "候補")" \
  "$removed" "$kept"
[ "$EXECUTE" = false ] && printf '※ 実削除するには --execute を渡してください\n'
