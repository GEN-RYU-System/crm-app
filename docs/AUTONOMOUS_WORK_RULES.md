# 自律開発標準ルール

## マージ方式

`gh pr merge <番号> --squash` で統一する。  
`--merge` / `--rebase` は使わない。

**理由**: 1PR = 1コミットとなり `git revert <SHA>` の1回で戻せる。

---

## ブランチ作成手順（毎回必須）

1. `git fetch origin`
2. `git log --oneline origin/develop -5` で最新を確認
3. `origin/develop` から分岐する（ローカルの `develop` から分岐しない）
4. `git status --short` を確認。M/A があれば停止
5. 対象ファイルの直近コミットを確認する  
   `git log --all --oneline -20 -- <ファイル>`  
   別ブランチの変更があれば停止して記録する

---

## 1件ごとの手順

1. 1タスク = 1ブランチ = 1PR
2. `npm run build:gas` を通す
3. `npm run check:design-system` を通す
4. Reviewer でコードレビュー
5. 指摘があれば修正して再レビュー
6. CI通過を確認
7. squash マージ: `gh pr merge <番号> --squash`
8. DEV配布完了を確認: `gh run list --workflow deploy-dev.yml --limit 1`
9. `clasp run runCoreSchemaConformanceAudit`  
   **総不一致0でなければ即座に revert**

---

## 絶対にやらないこと

- シートの列追加・削除・リネーム
- シートへのデータ書き込み（apply系関数の実行）
- Core Schema V1 の `headers` 変更
- 権限まわりの変更  
  （`DEFAULT_ROLES` / `29_PermissionService.js` / `37_PermissionManagementService.js`）
- 認証まわりの変更  
  （`26_AuthGateway.js` / `26_LoginService.js` / `26_SessionService.js`）
- 指示された範囲外の「気づいた改善」

**判断に迷ったら実施せず、記録に残して報告する。**

---

## 記録（必須）

各PRの本文に含めること:
- 変更前の状態
- 変更内容
- 期待する効果
- 検証結果
- 戻し方（`git revert <SHA>`）

`docs/AUTONOMOUS_WORK_LOG.md` に追記すること:
- 実施日時
- PR番号
- 対象
- 変更内容
- 検証結果
- revert用SHA

**PR番号とSHAは実際の値を記載すること。`#NNN` や `<このPRのSHA>` などのプレースホルダのまま残さないこと。**  
squash merge 後に `gh pr view <番号> --json mergedAt,mergeCommit` で SHA を取得してから記入する。

---

## 停止条件

以下に該当したら以降を中止し、記録を残す:

- build または check が2回連続で失敗
- CI が2回連続で失敗
- `runCoreSchemaConformanceAudit` が FAIL
- 別ブランチとの競合が発生
- 画面の動作確認で異常

**無理に進めないこと。止まって報告する方が価値がある。**
