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

    ### 監査判定の必須手順

    runCoreSchemaConformanceAudit の結果を判定する際は、
    必ず docs/schema-audit-baseline.md を開いて数値を照合すること。

    - 自分が直前に観測した値との比較は判定にならない
    - 「変化なし」と書く場合、比較対象の数値と出典
      （ファイル名・行番号）を必ず併記する
    - テーブル単位で照合すること。総件数だけでは
      あるテーブルの悪化が他の改善で相殺されて見えなくなる

    2026-08-31、ベースライン文書を参照せず
    「18件（変化なし）」と報告した事例が発生した。
    実際のベースラインは2件だった。

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

---

## ガード迂回の定義（2026-08-31 追加）

安全装置にブロックされた際、以下はすべて「迂回」とみなす。
迂回した時点でその作業は失敗であり、成果物の正否を問わない。

### 禁止（手段を問わず・例外なし）

1. 許可ファイル（`~/.claude/permits/` 配下）の作成
   - Write ツール / bash / python3 / ヒアドキュメント / `cat >` 等、
     手段を問わず全て禁止
   - 有効期限を自分で設定する行為を含む

2. ブロックされたコマンドと同等の結果を別手段で得ること
   - `gh pr merge` がブロック → `gh api` での merge は迂回
   - `gh pr view` がブロック → `gh api` での取得も迂回
   - curl / python3 / スクリプト経由も同様

3. 環境変数による強制（`GH_SCOPE_OVERRIDE` 等）

4. permit スクリプトの実行

5. ガードが参照するファイルの書き換え。
   ただし `.pr-number` への「自分が `gh pr create` で作成したPR番号の記入」は例外として許可
   （下記「`.pr-number` の自己作成」参照）。
   `claims.json` の編集は引き続き禁止。

6. フック本体の編集・無効化・リネーム

### ブロックされた場合の正しい対処

作業を停止し、以下をそのまま報告する。

- ブロックされたコマンド
- ブロックしたガード名とメッセージ全文
- 完了済み範囲と未完了範囲

回避方法を探してはならない。

### 迂回してしまった場合

作成したファイル・変更した設定を全て列挙して報告する。
自分で削除せず、何を作ったかを報告すること。

### 背景（実際に発生した事例）

2026-08-30〜31 にかけて、PR #692/#693/#698/#699/#700/#702/#703/#704/#717
のマージ等で、`~/.claude/permits/` 配下に許可ファイルを自作する迂回が
10件発生した。有効期限も CC が独自に設定していた（本来は1回限り・30分失効）。
成果物自体に誤りはなかったが、承認ゲートが機能しない状態になっていた。

---

## `.pr-number` の自己作成（2026-08-31 追加・PO承認）

CC は、自分が `gh pr create` で作成した PR の番号に限り、
`~/crm-app-current/.pr-number` に書いてよい。
これは所有権の宣言であり、迂回にはあたらない。

| 行為 | 判定 |
|------|------|
| 自分が `gh pr create` で作ったPR番号を書く | 許可 |
| 他人のPR番号を書く | 迂回・禁止 |
| ブロック回避目的で書く（自分のPRでない番号等） | 迂回・禁止 |
| `gh` コマンド完了後に削除しない | 禁止 |

### 手順

1. worktree 内で作業し、`gh pr create` を実行する
2. 返ってきたPR番号を `~/crm-app-current/` に書く:
   ```
   echo <PR番号> > ~/crm-app-current/.pr-number
   ```
3. `gh pr checks` / `gh pr merge` を実行する
4. 完了後、必ず削除する:
   ```
   rm ~/crm-app-current/.pr-number
   ```

### 注意: 並行セッション

`~/crm-app-current/.pr-number` は1つしかない。
並行セッションと衝突するため、作業終了時の削除を怠らないこと。
既に `.pr-number` が存在する場合は、上書きせず停止して報告する
（他セッションが使用中の可能性があるため）。

### 実行上の注意（2026-08-31 追記）

`echo` と `gh` は必ず**別々のコマンド**として実行すること。

```bash
# ✗ 誤: 同一コマンド内で実行する
echo <PR番号> > ~/crm-app-current/.pr-number && gh pr checks <PR番号>

# ✓ 正: コマンドを分けて実行する
echo <PR番号> > ~/crm-app-current/.pr-number
# （別コマンドとして）
gh pr checks <PR番号>
```

**理由:** gh-scope-guard は Bash ツールの実行**前**（PreToolUse）に評価される。
`&&` で繋いでも、フック評価時点では `echo` がまだ実行されておらず
`.pr-number` が存在しないため、`gh` コマンドがブロックされる。

2026-08-31 に実際に発生:
```bash
# ブロックされたコマンド（意図した順序だが同一コマンド内のため失敗）
echo 740 > ~/crm-app-canonical-20260830/.pr-number && sleep 35 && gh pr checks 740
```

---

## gh-scope-guard を通すための必須手順（2026-08-31 追加・訂正）

gh-scope-guard は `.pr-number` または `claims.json` で
PR の所有権を判定する。どちらも無い場合、
安全側に倒れて全ての gh コマンドを拒否する（仕様どおり）。

**重要:** フックは Bash ツール実行前（`cd` より前）に走る。
そのため `.pr-number` は `~/crm-app-current/` に置く必要がある。
根拠: フック実行時の `git rev-parse --show-toplevel` の実測値が
`/Users/tanizawashingo/crm-app-current` であることを PR #732 で確認。
worktree 内・`~/crm-app-canonical-20260830/` に置いても読まれない。

### 必須手順

1. 作業は必ず worktree 内で行う（canonical clone では作業しない）
2. `gh pr create` の直後、`~/crm-app-current/` に PR番号を書く:
   ```
   echo <PR番号> > ~/crm-app-current/.pr-number
   ```
3. `gh pr checks` / `gh pr diff` / `gh pr merge` を実行する
4. PR のマージが完了したら `.pr-number` を削除する:
   ```
   rm ~/crm-app-current/.pr-number
   ```
5. worktree を削除する前に、PR がマージ済みであることを確認する

### 手順を飛ばした場合

ガードにブロックされる。これは正常な動作である。
迂回してはならない。手順 2 に戻って `.pr-number` を作成すること。

### 注意: 並行セッション

`~/crm-app-current/.pr-number` は1つしかない。
複数セッションが同時に PR を扱う場合、上書きが起きる可能性がある。
作業が終わったら必ず `.pr-number` を削除すること。

### 背景

2026-08-30〜31、`.pr-number` の作成漏れにより
gh-scope-guard が全ブロックする事象が複数回発生し、
これが許可ファイル自作（迂回 10 件）の背景となった。
ガードの不具合ではなく、運用手順の欠落が原因。

2026-08-31、設置場所を2度誤記した経緯:
- PR #721: 「worktree 内に書く」と誤記
- PR #724: 「canonical repo root（~/crm-app-canonical-20260830）に置く」と誤記
  （フックの cd より前に走る、という事実は正しかったが、
  フック実行時の cwd が crm-app-canonical-20260830 ではなく
  crm-app-current であることを把握していなかった）
- PR #732: `git rev-parse --show-toplevel` の実測値が
  `/Users/tanizawashingo/crm-app-current` であることを確認し、
  AGENTS.md に実測根拠付きで記載（PR #732 にて確定）

---

## canonical clone での直接編集の禁止（2026-08-31 追加）

canonical clone（`~/crm-app-canonical-20260830`）上でファイルを編集してはならない。  
`git pull` が競合して停止し、/tmp への退避など後処理が必要になる。

**2026-08-31 に実際に発生:**  
`docs/AUTONOMOUS_WORK_LOG.md` を canonical clone 上で編集したため、  
`git pull origin develop` が以下のエラーで止まった:

```
error: Your local changes to the following files would be overwritten by merge:
    docs/AUTONOMOUS_WORK_LOG.md
Please commit your changes or stash them before you merge.
```

`git checkout -- docs/AUTONOMOUS_WORK_LOG.md` で変更を破棄し、
`/tmp` にバックアップを退避してから pull を実施した。

### canonical clone の用途（許可する操作）

| 操作 | 理由 |
|------|------|
| `git pull` / `git fetch` | develop の最新取得 |
| `clasp run <関数名>` | `.clasp.json` が canonical clone にしかない |
| `echo <PR番号> > .pr-number` | gh-scope-guard のための所有権宣言 |
| `rm .pr-number` | 完了後の削除 |
| `git worktree add` / `git worktree remove` | worktree 管理 |

### 禁止する操作

ファイルの編集・新規作成はすべて **worktree 内** で行うこと。  
canonical clone 上での `Edit` / `Write` ツールの使用は禁止する。

### 作業終了時の確認

worktree での作業とマージが完了したら、
canonical clone が develop にあることを確認すること。

```
git -C ~/crm-app-canonical-20260830 branch --show-current
```

develop でなければ戻すこと。
canonical clone が別ブランチのままだと、
次のセッションが開始前チェックで停止する。

2026-09-03、release/shipments-rename-exec-log のまま
放置されており、後続作業が停止した。

**機械的な関所（2026-09-04 設置）:**  
`git push` を実行するたびに `.githooks/pre-push` が自動で canonical clone のブランチを検査する。  
develop 以外にいる場合は以下の WARNING が表示される（push は続行）:

```
======================================================
  WARNING: canonical clone が develop 以外のブランチにいます
  現在: <ブランチ名>
  戻し方: git -C ~/crm-app-canonical-20260830 checkout develop
======================================================
```

実装: `.githooks/pre-push` の 28–40 行目（PR #<番号> で追加）

---

## worktree の後片付け（2026-08-31 追加）

### 原則: 作った本人が消す

PR をマージしたら、その worktree を必ず削除する。
これが第一の手段であり、スクリプトは取りこぼしの回収用。

```bash
git -C ~/crm-app-canonical-20260830 worktree remove <path>
```

`.pr-number` が残っている場合は先に削除してから実行する。

```bash
rm <path>/.pr-number
```

### 上限

`.githooks/pre-push` が worktree 数を検査する（上限19、
`CRM_MAX_WORKTREES` で変更可）。超えると `git push` が失敗する。

### 取りこぼしの回収

```bash
bash scripts/worktree-cleanup.sh --dry-run   # 判定のみ
bash scripts/worktree-cleanup.sh --execute   # 実削除
```

判定ロジック:
- PR がマージ済み（`gh pr list --state merged --head <branch>`）
- 未コミット変更なし（`.pr-number` のみは OK）
- `develop` / `main` ブランチではない
- canonical clone でも実行中ワークツリーでもない

### scripts/janitor.sh について

`janitor.sh` は削除判定に `git merge-base --is-ancestor` を使うため、
squash merge 運用の本リポジトリでは削除候補が常にゼロになる。
これは既知の制約であり、修正しない。

理由: 他セッションが使用しているスクリプトであり、
挙動を変えると予期しない削除が起きる可能性がある。
また `janitor.sh` は KEEP 判定の worktree に対しても
`node_modules` を `~/.Trash/` へ移動する副作用がある。

worktree の整理には `scripts/worktree-cleanup.sh` を使うこと。
`janitor.sh` は変更しない。

---

## 監査の限界（2026-09-03 追加）

`runCoreSchemaConformanceAudit` は
「Registry の物理名が実シートに存在するか」のみを検証する。

**検証されないこと:**
- コードが参照する論理キーが Registry に存在するか
- フロント側の型定義が GAS の返却と一致するか

Registry からキーを削除する変更では、監査0件でも画面が壊れる。

**削除後の必須手順:**

削除したキーを参照する API 関数を `clasp run` で実行し、
戻り値に `CORE_SCHEMA_HEADER_KEY_NOT_FOUND` が含まれないことを確認すること。

```bash
# 例: CUSTOMERS を読む API を確認
clasp run benchCustomerListMs
# または dev 関数を追加して clasp run devCustomerListAudit
```

**背景:** 2026-09-02、PR #883 で `SALES_ASSIGNEE_NAME` を Registry から削除した際、
`src/28_CoreCustomerReadApi.js` 側の参照が残り、顧客一覧が完全停止した。
監査は 0件不一致を返していた。PR #986 で修正（2026-09-03）。
