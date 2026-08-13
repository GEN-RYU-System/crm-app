# 環境とリリースフロー

## DEV

- `release/*` → PR → `develop` へマージする。
- `develop` のマージコミットだけが DEV スクリプトへ自動配布される。
- 開発確認は DEV の `/dev` 画面だけで行う。
- `/dev` は開発者だけが使い、顧客には渡さない。

## PROD

- 今は本番に一切配布しない。
- DEV で全機能・全テストが終わった後にだけ、`develop` → `main` の PR を作る。
- 本番反映は、PROD スクリプトへ配布後、固定版の `/exec` を更新して行う。
- 本番反映の仕組みは、DEV 完成後に別 PR で作る。

## シートの分離

- DEV スクリプトは DEV シートだけを見る。
- PROD スクリプトは PROD シートだけを見る。
- 同じコードを使うが、各スクリプトの設定で接続先を決める。
- 設定が足りない時は停止し、本番へ勝手につながない。
- ID やトークンの値はコード・文書・PR 本文に書かない。

## Secrets

- `CLASPRC_JSON`
- `SCRIPT_ID_DEV`
- `SCRIPT_ID_PROD`
- `SPREADSHEET_ID_DEV`
- `SPREADSHEET_ID_PROD`

GAS 実行中は GitHub Secrets を読めないため、シート ID は各 GAS のスクリプトプロパティにも設定が必要です。

## 現在の制約

- private リポジトリのプラン制約で、GitHub 側のブランチ保護は未設定。
- ローカルフックは直接 push を止める。
- GitHub Actions は直接 push を後から検知する。
- 直接 push は GitHub 上では入り得るが、DEV 配布ワークフローはマージコミット以外では配布前に停止する。
