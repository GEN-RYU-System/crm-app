#!/bin/sh
set -eu

LOG_FILE="$HOME/janitor.log"
TRASH_DIR="$HOME/.Trash"
ROOT=$(git rev-parse --show-toplevel)
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true
PROTECT_DAYS="${JANITOR_PROTECT_DAYS:-7}"
ONLY_PATH="${JANITOR_ONLY_PATH:-}"
mkdir -p "$TRASH_DIR"
if [ "$DRY_RUN" = false ]; then git -C "$ROOT" worktree prune; fi
printf '%s janitor start\n' "$(date -Iseconds)" >> "$LOG_FILE"
git -C "$ROOT" worktree list --porcelain | awk '/^worktree /{p=$2}/^branch refs\/heads\//{b=$2; sub("refs/heads/","",b); print p "|" b}' | while IFS='|' read -r path branch; do
  [ "$path" = "$ROOT" ] && continue
  [ -n "$ONLY_PATH" ] && [ "$path" != "$ONLY_PATH" ] && { printf 'SKIP %s (JANITOR_ONLY_PATH)\n' "$path"; continue; }
  dirty=$(git -C "$path" status --porcelain | wc -l | tr -d ' ')
  age_days=$(( ( $(date +%s) - $(stat -f %m "$path") ) / 86400 ))
  if [ "$branch" = develop ] || [ "$branch" = main ] || [ "$age_days" -lt "$PROTECT_DAYS" ]; then
    printf 'KEEP %s (%s dirty=%s age_days=%s protected)\n' "$path" "$branch" "$dirty" "$age_days"
    continue
  fi
  if git -C "$ROOT" merge-base --is-ancestor "$branch" origin/develop 2>/dev/null && [ "$dirty" = 0 ]; then
    printf 'REMOVE %s (%s)\n' "$path" "$branch"
    if [ "$DRY_RUN" = false ]; then git -C "$ROOT" worktree remove "$path"; fi
    continue
  fi
  printf 'KEEP %s (%s dirty=%s)\n' "$path" "$branch" "$dirty"
  if [ "$DRY_RUN" = false ]; then find "$path" -type d \( -name node_modules -o -name .npm-cache -o -name test-results \) -prune -exec mv {} "$TRASH_DIR"/ \;; fi
done
if [ "$DRY_RUN" = false ]; then npm cache clean --force >> "$LOG_FILE" 2>&1; df -h / >> "$LOG_FILE"; fi
