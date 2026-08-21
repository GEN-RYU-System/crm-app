# crm-app

CRM APP_DEV — Google Apps Script プロジェクト

## 構成

- `src/` — GAS ソースコード（clasp push 対象）
- `.github/workflows/deploy-dev.yml` — GitHub上でdevelopへマージ済みのPRだけを、検証済みSHAで DEV 環境へ自動配布するワークフロー。手動実行は検証済みのdevelop最新コミットの再配布だけに使え、DEV配布は同時実行せず1件ずつ行う
- `.github/workflows/block-direct-push.yml` — GitHub上のマージ済みPRに紐づかない main / develop への push を後から検知し、CI を赤にするワークフロー
- `.githooks/pre-push` — main / develop へのローカルpushをマージコミットを含めて拒否するフック
- [配布の同時実行防止（標準仕様）](docs/ENVIRONMENT_AND_RELEASE_FLOW.md#配布の同時実行防止標準仕様)

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

- ローカルフックはマージコミットを含む直接 push を拒否します。`--no-verify` で回避されたpushは、GitHub上のマージ済みPRに紐づかない限り `.github/workflows/block-direct-push.yml` が後から検知して CI を赤にします
- 意図的なバイパスは PO (Shingo) への事前報告が必須です
- 緊急 break-glass を除き、main / develop への直 push は一切禁止です
