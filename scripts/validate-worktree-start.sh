#!/bin/bash
# validate-worktree-start.sh — 作業開始前のworktree強制チェック
#
# 目的: エージェントがメインリポジトリで作業を開始するのを防ぐ
#       個室（worktree）以外での作業開始をブロックし、ブランチ変更干渉を根本から排除
#
# 呼び出し元:
#   - 実装開始前（手動または CLAUDE.md のルールに従って呼び出す）
#
# 参考: CLAUDE.md（ブランチ確認セクション）

set -e

# CI環境はスキップ（GitHub Actions は専用環境で実行）
if [ -n "${GITHUB_ACTIONS}" ]; then
  exit 0
fi

# ── 中央設定ファイルを読み込む（SSoT: .claude/agent-config.sh）──────────────
GIT_COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null)"
if [[ "${GIT_COMMON_DIR}" = /* ]]; then
  MAIN_REPO_ROOT="$(dirname "${GIT_COMMON_DIR}")"
else
  MAIN_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
fi
CONFIG_FILE="${MAIN_REPO_ROOT}/.claude/agent-config.sh"
if [ -f "${CONFIG_FILE}" ]; then
  # shellcheck source=.claude/agent-config.sh
  source "${CONFIG_FILE}"
fi
# デフォルト値（config がない環境へのフォールバック）
AGENT_WORKTREE_BASE="${AGENT_WORKTREE_BASE:-${HOME}/worktrees}"
AGENT_BRANCH_PREFIX="${AGENT_BRANCH_PREFIX:-release/}"

ACTUAL_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"

# main / master は worktree 不要（読み取り・確認作業のため）
# ※ develop は例外としない。本店が develop にいるときもチェックを通すことで、
#   develop 上への誤コミット事故（654fa92 / f41df99）を防ぐ。
case "${CURRENT_BRANCH}" in
  main|master)
    exit 0
    ;;
esac

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# チェック: AGENT_WORKTREE_BASE 配下かどうか
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# メインリポジトリで feature ブランチ作業中 =
# 他エージェントの git checkout でブランチが変わるリスクがある状態

case "${ACTUAL_ROOT}" in
  "${AGENT_WORKTREE_BASE}/"*) ;;  # OK: 個室（worktree）内で作業している
  *)
    echo ""
    echo "🚫 作業開始を中断しました: worktree（個室）の外で作業しようとしています。"
    echo ""
    echo "   現在のディレクトリ: ${ACTUAL_ROOT}"
    echo "   現在のブランチ    : ${CURRENT_BRANCH}"
    echo ""
    echo "   このまま作業を続けると、別のエージェントが git checkout を実行したとき"
    echo "   あなたのブランチが変わってしまう可能性があります。"
    echo ""
    echo "   正しい手順:"
    echo "   1. 個室（worktree）を作成してください:"
    echo "      git -C ~/crm-app-new worktree add \\"
    echo "        ~/worktrees/crm-app/$(echo "${CURRENT_BRANCH}" | tr '/' '-') \\"
    echo "        -b ${CURRENT_BRANCH} origin/develop"
    echo "   2. 作成された個室ディレクトリで作業してください:"
    echo "      ${AGENT_WORKTREE_BASE}/crm-app/$(echo "${CURRENT_BRANCH}" | tr '/' '-')/"
    echo "   正典: CLAUDE.md（ブランチ確認セクション）"
    echo ""
    exit 1
    ;;
esac

echo "✅ worktreeチェック通過: ${CURRENT_BRANCH} @ ${ACTUAL_ROOT}"
exit 0
