# 公開後監査記録

実施日: 2026-08-24

## 判定

**不合格 — リポジトリは private に復帰済み。**

公開履歴に顧客実名を1件検出したため、公開維持の条件を満たさない。GitHub API実測では `GEN-RYU-System/crm-app` の visibility は `PRIVATE`。

## 合格条件と実測

| 対象 | 実行 | 実測 | 判定 |
| --- | --- | --- | --- |
| シークレット履歴 | `gitleaks git --log-opts="--all" --redact=100` | 0件 | PASS |
| シークレット履歴 | `trufflehog git file://. --no-update --only-verified` | verified 0件 / unverified 0件 | PASS |
| メール・ID・資格情報値・電話番号 | `git grep` による補完確認（`docs/INBOX_EVIDENCE.md` とテストデータを含む） | 設定名、ダミー値、テスト用値を確認。認証情報の値は未検出。 | PASS |
| 顧客実名 | `git blame` / `git log -S` による補完確認 | 1件検出。`docs/AUTONOMOUS_WORK_LOG.md` の旧記載、導入コミット `e4e6b66e3d360ba162c8dd742d41d2ccdbe5e330`。 | FAIL |

## 検出内容と対応

- 種別: 顧客実名（会話一覧25件目のリードに付随する氏名）
- 現行ファイル: この変更で氏名を除去し、リードID `LDI-00233` のみを保持。
- Git履歴: 当該コミットを含むため公開済み履歴には残存。履歴書換え・force pushは実施しない。
- 可視性: `gh repo edit GEN-RYU-System/crm-app --visibility private --accept-visibility-change-consequences` を実行し、`PRIVATE` を再確認。

## 次に必要な承認・対応

1. 公開済み期間に取得された複製・fork・キャッシュの扱いをオーナーが確認する。
2. 顧客へ影響確認が必要か、社内の個人情報インシデント手順に従って判断する。
3. 認証情報の値は今回の2スキャナでは検出されなかった。ただし公開期間中の露出可能性をゼロとは断定できないため、Apps Script / GitHub Actions / 外部連携（Discord・Meta等）のトークン、APIキー、サービスアカウント資格情報は無効化・再発行をオーナーが検討する。
4. 将来の再公開は、履歴からの個人情報除去方針をオーナーが承認し、再スキャンとレビューを完了してから行う。

## 履歴書換え後の再監査（2026-08-24）

履歴書換えの完了後、全ブランチを含む履歴を再スキャンした。対象文字列はフルネーム・姓・名の3パターンであり、各コミットの全ファイルを固定文字列grepした。

| 手段 | 実行 | 実測 | 判定 |
| --- | --- | --- | --- |
| gitleaks | `gitleaks git --log-opts="--all" --redact=100` | 790コミット、0件 | PASS |
| TruffleHog | `trufflehog git file://. --no-update --only-verified` | verified 0件 / unverified 0件 | PASS |
| 実名grep | 3パターンを全コミット・全ファイルに対して `git grep -F` | 一致コミット 0件 | PASS |

**再公開判定: 合格。** 旧SHAは `docs/SHA_REMAP_20260824.md` のcommit-mapで新SHAへ読み替えること。
