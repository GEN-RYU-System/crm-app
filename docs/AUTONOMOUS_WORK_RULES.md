# 自律開発標準ルール

## 作業開始前の必須チェック（canonical clone）

すべての作業の冒頭で以下を実行し、条件を満たさなければ
作業を開始せず報告して停止する。

```bash
cd ~/crm-app-canonical-20260830 && git branch --show-current
cd ~/crm-app-canonical-20260830 && git fetch origin
cd ~/crm-app-canonical-20260830 && git rev-parse HEAD origin/develop
```

停止条件:
- ブランチが `develop` でない
- `HEAD` が `origin/develop` と一致しない
- 未コミットの `src/` 変更がある

**なお、`develop` ブランチが別の worktree にチェックアウト済みの場合、**
**canonical clone では checkout できない。その場合は `origin/develop` を直接参照する:**
```bash
git show origin/develop:<パス>
git ls-tree origin/develop <ディレクトリ>/
```

**理由:** 古いブランチのまま調査すると、存在するファイルを「存在しない」と誤判定する。
2026-08-30 に実際に発生（canonical clone が `release/gas-audit-docs` に留まり、
`docs/sheet-headers-snapshot.md` と `src/99_SchemaSnapshot.js` を「存在しない」と誤報告した）。

---

## マージ方式

`gh pr merge <番号> --squash` で統一する。  
`--merge` / `--rebase` は使わない。

**理由**: 1PR = 1コミットとなり `git revert <SHA>` の1回で戻せる。

---

## ブランチ作成手順（毎回必須）

1. `git fetch origin`
2. `git log --oneline origin/develop -5` で最新を確認
3. `git status --short` を確認する
4. 変更がある場合は worktree で `origin/develop` から分岐する（ローカルの `develop` から分岐しない）
   ```bash
   git worktree add <path> -b <branch> origin/develop
   ```
   worktree は現在の作業ツリーがクリーンでなくても作成でき、他セッションの未コミット変更に影響しない。作業完了後は worktree を削除する。
   worktree 作成後は最初に `cd frontend && npm ci` を実行する。`node_modules` は worktree ごとに独立しており、これを省略すると `tsc` / Vite が見つからず `build:gas` が失敗する。
   `clasp` コマンドは canonical クローン直下で実行する。`.clasp.json` は Git 追跡外のため worktree にはコピーされず、worktree 内で実行すると `Project settings not found` となる。
   ```bash
   cd ~/crm-app-canonical-20260824
   clasp run <関数名>
   ```
5. 変更がない場合は通常どおり `origin/develop` から分岐してよい
6. 対象ファイルの直近コミットを確認する
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
9. デプロイ済み SHA を照合する:
   ```bash
   clasp run getDeployedSha
   git log --oneline origin/develop -1
   ```
   SHA が一致しない場合は停止して報告すること
10. `clasp run runCoreSchemaConformanceAudit`

    **判定基準（2026-08-30 改訂）:**

    変更前の記述（改訂により廃止）:
    > 総不一致0でなければ即座に revert

    現行ルール:
    - ベースライン（`docs/schema-audit-baseline.md`）と比較する
    - 総不一致件数および内訳が**ベースラインと同一** → 通過
    - **1件でも増えた、または内訳が変化した** → 直前のPRを revert して停止・報告
    - ORDERS（オーダー管理）は**常に0件**であること。0件でなければ即 revert

    **記録義務:**
    - 監査を実行したら、総件数だけでなく**内訳の数値**を作業ログに記載する
    - 「既存差異」と判断する場合は、`docs/schema-audit-baseline.md` の該当行を引用して根拠を示す
    - 照合せずに「既存」「無関係」と断定してはならない

---

## PR 作成・push のルール

### PR の base ブランチ

PR の base は必ず `develop` とすること。`main` へのマージは行わないこと。

```bash
# 必ず --base develop を明示する
gh pr create --base develop ...

# マージ前に base を確認する
gh pr view <番号> --json baseRefName
# → "develop" でなければマージしない。報告して指示を待つ
```

**理由**: このリポジトリのデフォルトブランチは `main`（PROD環境）であり、
`--base develop` を省略すると `main` への PR が作成される。
PR #319 でこの誤りが実際に発生した。

### push が拒否された場合

push が拒否された場合（non-fast-forward 等）、force push しないこと。  
`--force` / `--force-with-lease` ともに禁止。  
報告して指示を待つこと。

```bash
# ✗ やってはいけない
git push --force-with-lease
git push --force

# ✓ やること: 止まって報告する
# push が拒否された理由（既存ブランチ・別セッションの作業等）を調べて報告する
```

**理由**: push 拒否はブランチの競合・別セッションの作業が原因であることが多く、
force push するとそれらの作業を消失させる。
PR #319 の後処理でこの誤りが実際に発生した（PR #319 を作成したブランチを
別セッションが force-with-lease で上書きした）。

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

---

## 停止条件

以下に該当したら以降を中止し、記録を残す:

- build または check が2回連続で失敗
- CI が2回連続で失敗
- `runCoreSchemaConformanceAudit` が FAIL
- 別ブランチとの競合が発生
- 画面の動作確認で異常

**無理に進めないこと。止まって報告する方が価値がある。**

---

## 画面確認（必須）

**build が通っても画面が壊れている場合がある。PR 作成前に必ず Playwright で確認する。**

### `?preview` モードを使った確認手順

UI に関わる変更の場合、以下の手順を PR 作成前に実施すること。

1. dev サーバーを起動する
   ```bash
   cd frontend && npm run dev
   ```

2. `?preview` モードで対象画面を開く（GAS 認証不要）
   ```
   http://localhost:<port>/?preview#/<route>
   ```

3. Playwright MCP で以下を確認する

   | 確認項目 | OK の基準 |
   |---------|----------|
   | 画面が表示される | ページ構造がスナップショットに存在する |
   | React エラーなし | コンソールに `Error:` / `Uncaught` がない |
   | 操作が動く | 対象機能（ボタン遷移・フォーム入力等）が機能する |

4. dev サーバーを停止する
   ```bash
   kill <PID>
   ```

### `?preview` モードの仕組み

`frontend/src/main.tsx` が `import.meta.env.DEV && ?preview` の条件で  
`frontend/src/preview/gasRunnerMock.ts` の `installGASMock()` を呼ぶ。

- `sessionStorage.setItem('crm_session_id', 'preview-mock-session')` → AuthContext が即座に authenticated になる
- `window.google = { script: { run: mockRunner } }` → 全 GAS 呼び出しがモックデータを返す

本番ビルドでは `import.meta.env.DEV = false` になるため、production バンドルに含まれない。

### Playwright 確認をスキップできるケース

- UI を持たない変更（GAS のみ / CI スクリプトのみ / ドキュメントのみ）
- 既存の Playwright 自動テストがカバーしている変更

スキップした場合はその理由を PR 本文に明記すること。

### DEV 配布後の確認

Playwright 確認後、配布完了を PO（Shingo）に報告し、DEV 実機での画面確認を依頼する。

**背景:** PR #362 でビルド・CI が全通過したにも関わらず「オーダー新規作成画面が開かない」が  
発生した（実際の原因は navigate バグだったが、事前の Playwright 確認があれば発見できた）。

---

## PR 本文への実機確認記録（必須）

画面に関わる変更の PR では、本文に以下を必ず記載すること。

```
## 実機確認
| 確認画面 | URL | 確認操作 | 結果 |
|---------|-----|---------|------|
| オーダー新規作成 | /orders/new | 商品名を入力して候補を確認 | ✓ |
| 見積もり新規作成 | /quotes/new | 同上 | ✓ |

## 未確認項目
| 項目 | 理由 |
|------|------|
| DEV実機での動作 | GAS認証が必要なため PO に依頼 |
```

**守ること:**
- 「実装した」だけでなく「どの画面でどう確認したか」を残す
- 確認できない場合は「未確認」と明記すること
- 確認済みのように書かないこと

**背景:** OrderEditorPage の ProductCombobox 残存は、実機確認記録がなかったために  
「LineItemEditor 化完了」と誤認されていた（2026-08-21 実際に発生）。

---

## 共通部品の作成・変更手順（必須）

共通部品（`components/ui/` 配下）を新規作成・変更・削除した場合:

1. **対象画面を列挙する**  
   `grep -r "import.*<部品名>" frontend/src/pages` で全使用箇所を確認する

2. **全画面の呼び出しを差し替える**  
   旧部品が残っている状態で「移行完了」としない

3. **旧部品を削除する**  
   削除できない場合は、その理由をコミットメッセージに記録する  
   例: `LeadCombobox は LeadEditorPage 固有のため残存`

4. **検証スクリプトに登録する**（後述 `component-usage.json` 参照）

5. **実機で全対象画面を確認する**  
   DEV 配布後、各画面で部品が正常動作することを確認する

**旧部品が削除されていないまま PR をマージしない。**

**背景:** PR #331 で LineItemEditor を共通化したが、`OrderProductCombobox` と `ProductCombobox`  
が削除されず残存し、後続セッションで混乱が発生した（2026-08-21）。
