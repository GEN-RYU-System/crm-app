# 環境とリリースフロー

## DEV

- `release/*` → PR → `develop` へマージする。
- GitHub上で `develop` をbaseとしてマージ済みのPRだけが、検証済みSHAで DEV スクリプトへ自動配布される。
- 手動実行は、GitHub APIで取得した `develop` の最新SHAが同じ条件を満たす場合の再配布だけに使える。
- 開発確認は DEV の `/dev` 画面だけで行う。
- `/dev` は開発者だけが使い、顧客には渡さない。

## PROD

- 今は本番に一切配布しない。
- DEV で全機能・全テストが終わった後にだけ、`develop` → `main` の PR を作る。
- 本番反映は、PROD スクリプトへ配布後、固定版の `/exec` を更新して行う。
- 本番反映の仕組みは、DEV 完成後に別 PR で作る。

## 配布の同時実行防止（標準仕様）

- 同じ配布先への配布は、必ず1件ずつ実行する。
- 実行中の配布は途中キャンセルしない。次の配布は前の配布完了後に実行する。
- 配布対象ごとに固定の concurrency group を持つ。
- DEV の group 名は `crm-app-dev-deploy` とし、DEV 配布はこの group で直列化する。
- 将来の PROD 配布は `crm-app-prod-deploy` を使用する。DEV と PROD は別 group とし、互いの配布を止めない。

## シートの分離（環境分離 PR の必須要件）

次の環境分離 PR で、以下を実装する。

- DEV スクリプトは DEV シートだけを見る。
- PROD スクリプトは PROD シートだけを見る。
- 同じコードを使うが、各スクリプトの設定で接続先を決める。
- 設定が足りない時は停止し、本番へ勝手につながない。
- ID やトークンの値はコード・文書・PR 本文に書かない。

環境分離の実装前には、DEV 設定不足時に PROD シートへフォールバックする既存実装があった。環境分離 PR はこの経路を削除し、上記の安全性を実装する。

環境分離 PR では、各GASが `ENVIRONMENT`、`SPREADSHEET_ID`、`ARCHIVE_BOOK_ID`、`ERP_SPREADSHEET_ID` をスクリプトプロパティから必須取得し、未設定・不正値では停止する。SCM同期を実行する場合は `SCM_SPREADSHEET_ID` も必須とする。値はこの文書に記載しない。

## Secrets

- `CLASPRC_JSON`
- `SCRIPT_ID_DEV`
- `SCRIPT_ID_PROD`
- `SPREADSHEET_ID_DEV`
- `SPREADSHEET_ID_PROD`

GAS 実行中は GitHub Secrets を読めないため、シート ID は各 GAS のスクリプトプロパティにも設定が必要です。

## 現在の制約

- private リポジトリのプラン制約で、GitHub 側のブランチ保護は未設定。
- 設定済みのローカル環境では、ローカルフックがマージコミットを含む直接 push を push 前に拒否する。
- GitHub Actions は、GitHub上のマージ済みPRに紐づかない直接 push を push 後に検知し、失敗として記録する。
- 直接 push は GitHub 上では入り得るが、DEV 配布ワークフローはpush・手動実行のいずれも、GitHub上で `develop` をbaseとしてマージ済みのPRに紐づかない限り、Secrets参照前に停止する。
