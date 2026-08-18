#!/bin/bash
# new-worktree.sh — Git Worktree 標準起動スクリプト
#
# 使い方:
#   bash scripts/new-worktree.sh <ブランチ名>
#   bash scripts/new-worktree.sh <ブランチ名> --claude  # Claude Code も同時起動
#
# 例:
#   bash scripts/new-worktree.sh release/my-feature
#   bash scripts/new-worktree.sh release/my-feature --claude
#
# 効果:
#   ~/worktrees/crm-app/<ブランチ名の/を-に置換>/ に独立した作業ディレクトリを作成
#   → 別ターミナルのブランチ切り替えに影響を受けない
#
# 参考: CLAUDE.md（ブランチ確認セクション）

set -e

BRANCH="${1}"
WITH_CLAUDE="${2}"

# 本店ブランチの確認（develop 以外の場合に警告）
HONTEN_GIT_DIR=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
if [ -n "${HONTEN_GIT_DIR}" ]; then
  HONTEN_ROOT=$(dirname "${HONTEN_GIT_DIR}")
  HONTEN_BRANCH="$(git -C "${HONTEN_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  if [ "${HONTEN_BRANCH}" != "develop" ]; then
    echo ""
    echo "WARNING: 本店が develop 以外（${HONTEN_BRANCH}）に居ます。作業は続行しますが、"
    echo "         別セッションがブランチを切り替えていないか確認してください。"
    echo ""
  fi
fi

if [ -z "${BRANCH}" ]; then
  echo ""
  echo "使い方: bash scripts/new-worktree.sh <ブランチ名> [--claude]"
  echo ""
  echo "例:"
  echo "  bash scripts/new-worktree.sh release/my-feature"
  echo "  bash scripts/new-worktree.sh release/my-feature --claude"
  echo ""
  exit 1
fi

# リポジトリ名（ハードコード: basename だと crm-app-new になるため）
REPO_NAME="crm-app"

# リポジトリルートを取得
REPO_ROOT="$(git rev-parse --show-toplevel)"

# shared な台帳とフックが見ている本店ルート（worktree 間で共通）
GIT_COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null)"
if [[ "${GIT_COMMON_DIR}" = /* ]]; then
  MAIN_REPO_ROOT="$(dirname "${GIT_COMMON_DIR}")"
else
  MAIN_REPO_ROOT="$(git rev-parse --show-toplevel)"
fi

# worktree の配置先（~/worktrees/crm-app/<ブランチ名の/を-に置換>）
BRANCH_SAFE="${BRANCH//\//-}"
WORKTREE_DIR="${HOME}/worktrees/${REPO_NAME}/${BRANCH_SAFE}"

# develop から最新化してブランチ作成
git fetch origin

BASE_BRANCH="origin/develop"

# すでに worktree が存在する場合はスキップ
if git worktree list | grep -q "${WORKTREE_DIR}"; then
  echo "ℹ️  worktree はすでに存在します: ${WORKTREE_DIR}"
else
  echo "🌿 worktree を作成しています..."
  echo "   ブランチ: ${BRANCH}"
  echo "   ベース  : ${BASE_BRANCH}"
  echo "   場所    : ${WORKTREE_DIR}"
  echo ""

  mkdir -p "$(dirname "${WORKTREE_DIR}")"
  git worktree add -b "${BRANCH}" "${WORKTREE_DIR}" "${BASE_BRANCH}"

  echo ""
  echo "✅ worktree を作成しました: ${WORKTREE_DIR}"

  # pre-push フックを worktree で有効化
  git -C "${WORKTREE_DIR}" config core.hooksPath .githooks
fi

echo ""
echo "📂 移動コマンド:"
echo "   cd ${WORKTREE_DIR}"
echo ""

# --claude フラグで Claude Code を起動
if [ "${WITH_CLAUDE}" = "--claude" ]; then
  echo "🤖 Claude Code を起動しています..."
  cd "${WORKTREE_DIR}"
  claude
fi

echo "🗑️  作業完了後のクリーンアップ:"
echo "   git -C ~/crm-app-new worktree remove ${WORKTREE_DIR}"
echo "   git -C ~/crm-app-new branch -d ${BRANCH}"
echo ""
