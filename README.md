# crm-app

CRM APP_DEV — Google Apps Script プロジェクト

## 構成

- `src/` — GAS ソースコード（clasp push 対象）
- `.github/workflows/deploy-dev.yml` — develop へのマージ時に DEV 環境へ自動配布し、手動実行も可能なワークフロー
- `.github/workflows/block-direct-push.yml` — main / develop への直 push 検知（CI 赤になる・阻止ではなく検知）
- `.githooks/pre-push` — main / develop への直 push をローカルで阻止するフック

## Git フック設定（クローン後に必ず実行）

```bash
bash scripts/setup-hooks.sh
```

または手動:

```bash
git config core.hooksPath .githooks
```

### ⚠️ `--no-verify` の使用禁止

`git push --no-verify` はこのリポジトリでは**使用禁止**です。

- `--no-verify` でフックを回避すると `.github/workflows/block-direct-push.yml` が検知して CI が赤になります
- 意図的なバイパスは PO (Shingo) への事前報告が必須です
- 緊急 break-glass を除き、main / develop への直 push は一切禁止です
