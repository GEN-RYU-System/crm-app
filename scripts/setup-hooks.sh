#!/bin/sh
# setup-hooks.sh — リポジトリをクローンした後に1回だけ実行する
#
# 用途: git config core.hooksPath を .githooks に向ける
# 効果: .githooks/pre-push が有効になり、main への直 push がローカルで拒否される
#
# 使い方:
#   bash scripts/setup-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: git リポジトリのルートが見つかりません"
  exit 1
fi

cd "$REPO_ROOT"

# .githooks ディレクトリの存在確認
if [ ! -d ".githooks" ]; then
  echo "ERROR: .githooks ディレクトリが見つかりません（リポジトリが古い可能性）"
  exit 1
fi

# core.hooksPath を設定
git config core.hooksPath .githooks
echo "OK: git config core.hooksPath = $(git config core.hooksPath)"
echo ""
echo "設定完了。以降 'git push origin main' は .githooks/pre-push で拒否されます。"
echo "--no-verify の使用は禁止（README.md 参照）"
