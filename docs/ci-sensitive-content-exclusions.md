# CI Sensitive Content チェック — 除外ルール一覧

`scripts/check-sensitive-content.mjs` に追加された除外ルールの全件記録。

> **【注意】除外ルールを追加する際は、必ず本ファイルに追記すること。**
> 除外ルールの累積によって検出力がどれだけ下がったかを追跡するために存在する。
> 追記なしにルールを追加することを禁止する。

---

## 除外ルールの種類

チェックスクリプトの除外機構は2種類ある。

1. **`isKnownNonContactNumber`（電話番号チェック用除外関数）** — L24–40
2. **`safePhone` 正規表現（初期フィルタ）** — L21
3. **スキャンループ内の個別除外** — メインループ中の `if` 条件

---

## A. isKnownNonContactNumber 内の除外ルール

### A-1. CI/CD ワークフロー実行ID パターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L26 |
| 条件 | `prefix` が `github actions`, `deploy to dev`, `security content check`, `ci` 等の語の直後に `run #<数値>` を含む |
| コード | `/(?:github actions\|deploy to dev\|security content check\|ci).*?run\s*#?\s*[` ` '"]?\s*$/i.test(prefix)` |
| 追加日 | 2026-08-24 |
| PR | #474（`docs: record redaction2 unfreeze`） |
| コミット | `b8af537` |
| 理由 | GitHub Actions ワークフロー実行ID（10桁超の数値）が電話番号として誤検出された。ドキュメント内に `gh run rerun 33012345678` 等を記載した際に発生。 |
| 除外対象の例 | `CI run #33012345678`, `Deploy to DEV run 33012345678` |

### A-2. gh run rerun コマンドパターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L27 |
| 条件 | `prefix` が `gh run rerun` で終わる |
| コード | `/\bgh\s+run\s+rerun\s*$/i.test(prefix)` |
| 追加日 | 2026-08-24 |
| PR | #474（`docs: record redaction2 unfreeze`） |
| コミット | `b8af537` |
| 理由 | A-1 と同一事象。`gh run rerun <id>` 形式のコマンド例がドキュメントに含まれていた。 |
| 除外対象の例 | `gh run rerun 33012345678` |

### A-3. `ID:` プレフィックス パターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L28 |
| 条件 | `prefix` が `ID:` で終わる（`\bID\s*:\s*$`） |
| コード | `/\bID\s*:\s*$/i.test(prefix)` |
| 追加日 | 2026-08-24 |
| PR | #480（`chore: retire legacy ERP spreadsheet integration`） |
| コミット | `338b124` |
| 理由 | コミットメッセージ「ci: distinguish configuration IDs from phones」。旧 ERP 連携退役時、設定ファイル等で `ID: <数値>` 形式の設定値が電話番号として誤検出された。 |
| 除外対象の例 | `SHEET_ID: 12345678901`, `config ID: 98765432100` |

### A-4. GIDS/GID 変数内の数値文字列パターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L29–30 |
| 条件 | 行に `GIDS` または `GID` という単語を含み、かつ `prefix` が `"` または `'` で終わる（文字列リテラル内） |
| コード | `/\bGIDS?\b/.test(line) && /["']$/.test(prefix)` |
| 追加日 | 2026-08-31 |
| PR | #750（`feat(customers): 顧客マスタ列名整形 PR-1`） |
| コミット | `df3086b` |
| 理由 | `src/請求書発行.js` の `GIDS` 定数（Google Sheets タブの GID 値）が電話番号として誤検出された。PR #750 で `請求書発行.js` を変更ファイルに含めた際に発生。 |
| 除外対象の例 | `var GIDS = { main: '1234567890', sub: '9876543210' };` |

### A-5. JSDoc・コードコメント行パターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L31–32 |
| 条件 | 行の先頭（空白除く）が `//` または `*`（JSDoc `*` プレフィックス） |
| コード | `/^\s*(?:\/\/\|\*)/.test(line)` |
| 追加日 | 2026-08-31 |
| PR | #762（`fix(ci): JSDoc コメント・テストデータ配列の電話番号サンプルを Sensitive Content チェックから除外`） |
| コミット | `981f1b1` |
| 理由 | PR #760 で `src/17_CountryMaster.js` を変更した際、同ファイル内の既存 JSDoc ブロック（`@returns` 例示の日本の電話番号サンプル、L342）とコードコメント（L375）が電話番号として誤検出された。 |
| 除外対象の例 | ` * @returns {string} '+81-3-XXXX-XXXX'`（JSDoc 例示）, `// 例: '+81-3-XXXX-XXXX'`（コメント） |

### A-6. 配列リテラル行内の文字列パターン

| 項目 | 内容 |
|------|------|
| 現在行番号 | L33–34 |
| 条件 | 行の先頭（空白除く）が `[` かつ `prefix` が `"` または `'` で終わる（配列要素の文字列リテラル内） |
| コード | `/^\s*\[/.test(line) && /["']$/.test(prefix)` |
| 追加日 | 2026-08-31 |
| PR | #762（同上） |
| コミット | `981f1b1` |
| 理由 | PR #760 で `src/17_CountryMaster.js` を変更した際、`testNormalizePhone` 関数内のテストデータ配列（L447–457）に含まれる電話番号テストベクター（配列要素として日本の電話番号サンプルを文字列リテラルで列挙）が誤検出された。 |
| 除外対象の例 | `['+81-3-XXXX-XXXX', 'JP', '03-XXXX-XXXX'],`（配列内の電話番号テストベクター） |

### A-7. 40桁16進文字列内パターン（git SHA）

| 項目 | 内容 |
|------|------|
| 現在行番号 | L35–39 |
| 条件 | 電話番号マッチ位置が同行内の40桁16進数列（git SHA）の範囲内にある |
| コード | `[...line.matchAll(/[0-9a-f]{40}/gi)].some(...)` |
| 追加日 | 2026-08-24 |
| PR | #474（`docs: record redaction2 unfreeze`） |
| コミット | `b8af537`（`isKnownNonContactNumber` 関数の初期実装として追加） |
| 理由 | git SHA（40桁16進）に含まれる数字列が電話番号パターンとマッチすることがある。SHA はシークレットではないため除外。 |
| 除外対象の例 | `8ee78ff7cb7ec59d775164053a191a5ee4f90e28` 内の部分列 |

---

## B. safePhone 正規表現（初期フィルタ）

| 項目 | 内容 |
|------|------|
| 現在行番号 | L21 |
| 条件 | 10桁以上の数字列が `00...`, `11...`, `22...`, `99...`, `123456...` で始まる |
| コード | `/^(?:0{2,}\|1{2,}\|2{2,}\|9{2,}\|123(?:[- ]?456){1,2})/` |
| 追加日 | 2026-08-24 |
| PR | #471（`ci: block secrets and sensitive content in pull requests`） |
| コミット | `8ee78ff` |
| 理由 | テストデータや連番で現れる明らかなダミー番号パターンをチェック対象外にする初期設計。 |
| 除外対象の例 | `0000000000`, `1111111111`, `1234567890` |

---

## C. スキャンループ内の個別除外

### C-1. `getRequiredSpreadsheetProperty` 文字列の除外

| 項目 | 内容 |
|------|------|
| 現在行番号 | L64 |
| 条件 | `spreadsheet_id` または `drive_id` パターンにマッチした値が文字列 `getRequiredSpreadsheetProperty` と一致する |
| コード | `if (match[1] !== 'getRequiredSpreadsheetProperty')` |
| 追加日 | 2026-08-24 |
| PR | #480（`chore: retire legacy ERP spreadsheet integration`） |
| コミット | `338b124` |
| 理由 | 関数名 `getRequiredSpreadsheetProperty` が `spreadsheet_id` 検出パターンにマッチしていた。関数呼び出し式 `spreadsheet_id = getRequiredSpreadsheetProperty(...)` 等で発生。 |
| 除外対象の例 | `spreadsheetId = getRequiredSpreadsheetProperty('KEY')` |

---

## 変更履歴

| 日付 | PR | 追加ルール | 理由の要約 |
|------|----|-----------|-----------|
| 2026-08-24 | #471 | `safePhone` 正規表現（初期設計） | ダミー番号パターンを初期除外 |
| 2026-08-24 | #474 | A-1, A-2, A-7（`isKnownNonContactNumber` 関数新設） | ドキュメント内 CI 実行ID が誤検出 |
| 2026-08-24 | #480 | A-3, C-1 | ERP 退役時の設定ID・関数名が誤検出 |
| 2026-08-31 | #750 | A-4 | `請求書発行.js` の GID 定数が誤検出 |
| 2026-08-31 | #762 | A-5, A-6 | `17_CountryMaster.js` JSDoc・テストデータが誤検出 |
