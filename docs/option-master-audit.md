# 選択肢マスタ 36列 使用箇所調査レポート

## 1. 調査概要

| 項目 | 内容 |
|------|------|
| 調査日 | 2026-08-31 |
| 調査対象シート | 選択肢マスタ（CONFIG.SHEETS.SETTINGS） |
| develop HEAD SHA | `8386f5c5a64f94f29a7678293f9b1fc2a8b380d2`（PR #787 マージ後） |
| 調査手法 | `clasp run getOptionMasterFullDump` + ソースコード grep |
| 書き込み系メソッドヒット数 | **0 件**（`setValue`, `setValues`, `appendRow`, `insertRows`, `clearContent` を対象に `99_OptionMasterFullDump.js` を走査） |
| シート行数 / 列数 | 45行 / 36列 |

### 1.1 使用分類の定義

| 分類 | 意味 |
|------|------|
| **A** | React新path実動 — `getLeadFormOptions()` から直接読む（`client.ts` 経由で React から呼ばれる） |
| **B** | 旧SPA実動 — `index.html` から GAS 関数を直接呼ぶ |
| **C** | コード参照あり・現在API未公開 — サーバー関数内で読まれるが、クライアントから呼ばれる dispatch path がない（setup関数・dead serviceなど） |
| **D** | 参照コードなし — 選択肢マスタの dropdown source としてコードから読まれていない |
| **E** | 専用関数・dispatch未登録 — `getFAQCategories()` のみ呼ぶが、どのdispatchにも登録されていない（dead code） |

---

## 2. 全36列 一覧

| col | ヘッダー名 | 値数 | 分類 | 参照箇所 |
|-----|-----------|------|------|---------|
| 1 | リード種別 | 2 | **A** | `28_CoreLeadFormOptionsApi.js:46` |
| 2 | リードID | 2 | **D** | — |
| 3 | 流入経路 | 8 | **D** | — ※LEADSシート列と同名だが選択肢sourceとして未使用 |
| 4 | 流入経路（IN） | 5 | **C** | `08_Config.js:244`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:270`（DROPDOWN_COLUMNS） |
| 5 | 流入経路（OUT） | 2 | **C** | `08_Config.js:245`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:270`（DROPDOWN_COLUMNS） |
| 6 | アーカイブ理由 | 5 | **B** | `27_WebApp.js:1468 getArchiveReasons()` ← `index.html:15548` |
| 7 | リードステータス | 10 | **C** | `08_Config.js:252`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:271`（DROPDOWN_COLUMNS） |
| 8 | 返信速度 | 5 | **A** | `28_CoreLeadFormOptionsApi.js:47` |
| 9 | 連絡手段 | 7 | **C** | `08_Config.js:251`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:270`（DROPDOWN_COLUMNS） |
| 10 | 取り扱い商材 | 6 | **C** | `13_DealReportService.js:320` `options['取り扱い商材']`（dispatch未登録） |
| 11 | 温度感 | 3 | **C** | `08_Config.js:247`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:271`（DROPDOWN_COLUMNS） |
| 12 | 想定規模 | 4 | **C** | `08_Config.js:248`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:271`（DROPDOWN_COLUMNS） |
| 13 | 商談ステータス | 4 | **D** | — |
| 14 | 商談結果 | 5 | **C** | `13_DealReportService.js:319` `options['商談結果']`（dispatch未登録），`08_Config.js:257`（DEFAULT_DROPDOWN_OPTIONS） |
| 15 | 顧客タイプ | 3 | **C** | `08_Config.js:249`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:271`（DROPDOWN_COLUMNS） |
| 16 | 販売形態 | 6 | **C** | `08_Config.js:255`（DEFAULT_DROPDOWN_OPTIONS：`販売形態`），`08_Config.js:272`（DROPDOWN_COLUMNS） |
| 17 | 競合比較中 | 3 | **C** | `08_Config.js:256`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:272`（DROPDOWN_COLUMNS） |
| 18 | 役割 | 5 | **C** | `23_SheetService.js:529` `setDataValidations()`（担当者マスタ入力規則），`08_Config.js:261`（DEFAULT_DROPDOWN_OPTIONS） |
| 19 | ステータス | 2 | **C** | `23_SheetService.js:530` `setDataValidations()`（担当者マスタ入力規則），`08_Config.js:262`（DEFAULT_DROPDOWN_OPTIONS） |
| 20 | カテゴリ | 5 | **D** | — ※MESSAGE_TEMPLATESシート等と同名列だが，選択肢sourceとして未使用 |
| 21 | 購入頻度(月次) | 6 | **C** | `13_DealReportService.js:323` `options['購入頻度(月次)']`（dispatch未登録） |
| 22 | 見込度 | 5 | **C** | `21_SetupDealReport.js:56`（シート追加対象として列挙） |
| 23 | 支払い方法 | 2 | **D** | — ※QUOTESシートのフィールドと同名だが，選択肢sourceとして未使用 |
| 24 | 発送方法 | 6 | **D** | — ※ORDERSシートのフィールドと同名だが，選択肢sourceとして未使用 |
| 25 | 商品ステータス | 5 | **D** | — |
| 26 | 為替 | 5 | **D** | — ※通貨管理はCURRENCIES CoreSchemaテーブルで行う |
| 27 | 為替レート | 5 | **D** | — ※QUOTES/ORDERSのフィールドと同名だが，選択肢sourceとして未使用 |
| 28 | 次回アクション日 | 7 | **C** | `08_Config.js:253`（DEFAULT_DROPDOWN_OPTIONS），`08_Config.js:271`（DROPDOWN_COLUMNS） |
| 29 | ページ | 4 | **D** | — ※MESSAGE_TEMPLATESシートのフィールドと同名だが，選択肢sourceとして未使用 |
| 30 | リードシーン | 0 | **D** | — ※値ゼロ，コード参照なし |
| 31 | 仕入元 | 44 | **D** | — ※PURCHASESシートのフィールドと同名だが，選択肢sourceとして未使用 |
| 32 | eLogiCSV格納フォルダ | 1 | **D** | — |
| 33 | ラベルPDF格納フォルダ | 1 | **D** | — |
| 34 | FAQ_カテゴリ | 5 | **E** | `35_FAQService.js:362` `getFAQCategories()`（dispatch未登録・dead code） |
| 35 | 支払サイト | 5 | **D** | — ※ORDERSフィールド(PAYMENT_TERMS)と同名。フロントエンドはfree-textで入力 |
| 36 | キャンセル理由 | 7 | **D** | — ※ORDERSフィールド(CANCELLATION_REASON)と同名。フロントエンドはfree-textで入力 |

**集計:** A=2, B=1, C=16, D=16, E=1（合計 36）

---

## 3. 使用経路の詳細

### 3.1 A — React新path（2件）

`getLeadFormOptions()` は `src/28_CoreLeadFormOptionsApi.js` で定義され、
React client.ts の `getLeadFormOptions()` から直接呼ばれる。
選択肢マスタの全データを取得するのではなく、`indexOf` で特定列のみを読む。

```
28_CoreLeadFormOptionsApi.js:43-57
  optH.indexOf('リード種別')  → col 1
  optH.indexOf('返信速度')    → col 8
```

### 3.2 B — 旧SPA実動（1件）

`getArchiveReasons()` は `src/27_WebApp.js:1468` で定義され、
`src/index.html:15548` から `google.script.run.getArchiveReasons()` で直接呼ばれる。
`indexOf('アーカイブ理由')` でシートの col 6 を読む。

### 3.3 C — コード参照あり・現在API未公開（16件）

主に2つの経路:

**C-1: `getDropdownOptions()` 経由**
`08_Config.js:906` の `getDropdownOptions()` は `getDropdownOptionsFromSheet()` を呼び、
シートの全列を `{ヘッダー名: [値...]}` として返す。
この返り値を実際に消費するコードは以下に限られる:

| 消費者 | 参照キー | 状態 |
|--------|---------|------|
| `13_DealReportService.js:319-323` `getDealReportDropdownOptions()` | `商談結果`, `取り扱い商材`, `購入頻度(月次)` | dispatch未登録・dead service |
| `23_SheetService.js:529-530` `setDataValidations()` | `役割`, `ステータス` | admin setup（管理シート初期化時のみ） |
| `23_SheetService.js:180` `initializeGoalsSheet()` | `期間タイプ` | **シート列なし**・DEFAULTフォールバック使用 |

**C-2: DEFAULT_DROPDOWN_OPTIONS / DROPDOWN_COLUMNSに定義あり（旧SPA dispatch broken）**
`27_WebApp.js:251` の `case 'getDropdownOptions': result = DROPDOWN_OPTIONS;` は
グローバル変数 `DROPDOWN_OPTIONS` を返すが、この変数は定義されていない → `undefined` を返すバグ。
そのため、旧SPA からのプルダウン取得は**現在機能していない**。

対象列: 流入経路（IN）, 流入経路（OUT）, リードステータス, 連絡手段, 温度感, 想定規模, 顧客タイプ,
販売形態, 競合比較中, 次回アクション日, 商談結果, 取り扱い商材（重複カウントで C-1 と共有）

### 3.4 D — 参照コードなし（16件）

以下のいずれかに該当する:
- 選択肢マスタの dropdown source として `indexOf` / `options[key]` でアクセスするコードが0件
- 別シートの列名と同名だが、そちらはシートのフィールドとして使われており、選択肢マスタを読まない

特記:
- `リードシーン` (col 30): **値ゼロ**（シートに値が入っていない）
- `eLogiCSV格納フォルダ` (col 32), `ラベルPDF格納フォルダ` (col 33): Google Drive フォルダURL 1件のみ格納
- `支払サイト` (col 35): 値は `即日/2日後/7日後/14日後/30日後`（5値）。ORDERSのPAYMENT_TERMSフィールドと対応するが、フロントエンドはfree-text inputを使用しており、選択肢マスタを読んでいない
- `キャンセル理由` (col 36): 7値入り。ORDERSのCANCELLATION_REASONフィールドと対応するが、フロントエンドはfree-text inputを使用

### 3.5 E — 専用関数・dispatch未登録（1件）

`getFAQCategories()` (`35_FAQService.js:345`) は `indexOf('FAQ_カテゴリ')` で col 34 を読む。
index.html / client.ts / 27_WebApp.js dispatch のいずれからも呼ばれていない。**dead code**。

---

## 4. SSOT違反の詳細

### 4.1 キー名不一致（コード vs シート）

| # | 問題箇所 | コードのキー | シートの実態 | 影響 |
|---|---------|------------|------------|------|
| 1 | `08_Config.js:254`（DEFAULT_DROPDOWN_OPTIONS） | `取り扱いタイトル` | col 10 `取り扱い商材` | `getDropdownOptionsFromSheet()` は `取り扱い商材` を返すが，DEFAULT の `取り扱いタイトル` とはキー不一致。getDropdownOptions の補完ロジック（L967-970）で両者が共存 |
| 2 | `08_Config.js:272`（DROPDOWN_COLUMNS） | `取り扱いタイトル` | col 10 `取り扱い商材` | DROPDOWN_COLUMNS は旧シート想定のキーを持つ |
| 3 | `13_DealReportService.js:321` | `options['販売先']` | col 16 `販売形態` | `販売先` キーはシートに存在しない → 常にフォールバック値を使用 |
| 4 | `21_SetupDealReport.js:53` | `'販売先': [...]` | col 16 `販売形態` | setup 時に誤ったキーで列追加を試みる（既存列として認識されず，追加試行するが `headers.includes('販売先')` が false なので毎回追加しようとする） |
| 5 | `13_DealReportService.js:322` | `options['信頼重視/価格重視']` | col 15 `顧客タイプ` | `信頼重視/価格重視` キーはシートに存在しない → 常にフォールバック値を使用 |

### 4.2 シートに存在しないキーが DEFAULT_DROPDOWN_OPTIONS / DROPDOWN_COLUMNS に定義あり

| # | キー | 箇所 | シートの状況 |
|---|-----|------|------------|
| 6 | `対象外理由` | `08_Config.js:259`, `08_Config.js:272` | 36列中に存在しない |
| 7 | `失注理由` | `08_Config.js:260`, `08_Config.js:272` | 36列中に存在しない |
| 8 | `国` | `08_Config.js:246`, `08_Config.js:270`, `13_DealReportService.js:325` | 36列中に存在しない（国マスタシートで管理） |
| 9 | `期間タイプ` | `08_Config.js:263`, `08_Config.js:272`, `23_SheetService.js:180` | 36列中に存在しない（DEFAULT_DROPDOWN_OPTIONSのフォールバックで補完） |

### 4.3 値の件数差異（DEFAULT vs シート実測）

| 列名 | DEFAULT件数 | シート実測 | 差分 |
|------|------------|-----------|-----|
| 返信速度 | 4値 | **5値** | +1（シートが多い） |
| 次回アクション日 | 6値 | **7値** | +1（シートが多い） |
| 販売形態 | 5値 | **6値** | +1（シートが多い） |
| 商談結果 | 4値 | **5値** | +1（シートが多い） |
| アーカイブ理由 | 4値 | **5値** | +1（シートが多い） |

### 4.4 `DROPDOWN_OPTIONS` undefined バグ

```
src/27_WebApp.js:251-253
case 'getDropdownOptions':
  result = DROPDOWN_OPTIONS;  // ← グローバル未定義変数。undefined を返す
  break;
```

`getDropdownOptions()` 関数（`08_Config.js:906`）とは別物。
旧SPA の `case 'getDropdownOptions'` 経由でドロップダウン取得を試みているクライアントは
現在すべて `undefined` を受け取っている。

### 4.5 DROPDOWN_COLUMNS（20件）とシート実際36列の差

`HEADERS.SETTINGS = DROPDOWN_COLUMNS`（`08_Config.js:356`）。
DROPDOWN_COLUMNS は 20 項目だが，シートには 36 列が存在する。
DROPDOWN_COLUMNS に含まれない16列は初期化（`01_Initialize.js:158`）で無視される。

---

## 5. PO 判断が必要な項目

### 5.1 新規追加列の React 対応

以下は**シートに値が入っている**が、React フロントエンドから選択肢を取得する経路がない。
受注管理フォームや注文詳細画面で自由入力になっている。PO が確認すること。

| 列名 | 値数 | 値（99_InvBookRecon.js より） | 現状フロントエンド |
|------|------|---------------------------|-----------------|
| 支払サイト (col 35) | 5 | 即日/2日後/7日後/14日後/30日後 | free-text input（ドロップダウンなし） |
| キャンセル理由 (col 36) | 7 | 実際の値はシートを確認 | free-text input（ドロップダウンなし） |

### 5.2 dead code の処理

| 項目 | 影響 |
|------|------|
| `getFAQCategories()` (E分類) | FAQ_カテゴリ列は正しく読めているが，呼び出し元がない。FAQ機能を実装する予定がなければ，`35_FAQService.js` ごと削除可能 |
| `getDealReportDropdownOptions()` (C分類) | 商談レポート向け関数。dispatch未登録。残すか削除するか要判断 |

### 5.3 未使用16列（D分類）の整理

以下の列は現在どのコードからも読まれていない。削除または用途追加を検討。

| 列名 | 値数 | 備考 |
|------|------|------|
| リードID | 2 | 選択肢ではなくIDフォーマット例の可能性あり |
| 流入経路 | 8 | 旧dropdown列か。現在はLEAD_SOURCESマスタで管理 |
| 商談ステータス | 4 | 別シートのフィールドと混在するが，コード参照なし |
| カテゴリ | 5 | MESSAGE_TEMPLATES等の文脈不明。選択肢sourceとして未使用 |
| 支払い方法 | 2 | QUOTESシートのフィールドと混在 |
| 発送方法 | 6 | ORDERSシートのフィールドと混在 |
| 商品ステータス | 5 | 商品管理はOWN_CATEGORIESなどCoreSchemaで管理 |
| 為替 | 5 | 通貨管理はCURRENCIESマスタで管理 |
| 為替レート | 5 | QUOTES/ORDERSのフィールド値（実際のレート）と混在 |
| ページ | 4 | MESSAGE_TEMPLATESシートのフィールドと混在 |
| リードシーン | 0 | 値ゼロ。用途不明 |
| 仕入元 | 44 | 仕入先44件。PURCHASESシートのフィールドと混在 |
| eLogiCSV格納フォルダ | 1 | Google Drive フォルダURL。設定値であり選択肢ではない |
| ラベルPDF格納フォルダ | 1 | 同上 |
| 支払サイト | 5 | React未接続（§5.1参照） |
| キャンセル理由 | 7 | React未接続（§5.1参照） |

---

## 6. 未確認事項

| # | 項目 | 状態 | 確認方法 |
|---|------|------|---------|
| 1 | `リードシーン` の用途 | 未確認 | POへの聞き取り |
| 2 | `カテゴリ` 5値の内容 | 未確認 | シート直接確認 |
| 3 | `商談ステータス` 4値の内容 | 未確認 | シート直接確認 |
| 4 | `キャンセル理由` 実際の7値 | 未確認 | シート直接確認 |
| 5 | `支払サイト`/`キャンセル理由` を React ドロップダウン化する計画があるか | 未確認 | PO確認 |
| 6 | `eLogiCSV格納フォルダ`/`ラベルPDF格納フォルダ` の利用状況 | 未確認 | 運用担当者確認 |

---

## 7. 調査済みファイル一覧

| ファイル | 調査内容 |
|---------|---------|
| `src/99_OptionMasterFullDump.js` | 調査用関数（本PRで追加・読み取り専用） |
| `src/08_Config.js` | DEFAULT_DROPDOWN_OPTIONS, DROPDOWN_COLUMNS, getDropdownOptions, getDropdownOptionsFromSheet |
| `src/27_WebApp.js` | dispatch switch文, getArchiveReasons, getLeadOptionsForFrontend |
| `src/28_CoreLeadFormOptionsApi.js` | getLeadFormOptions（React向けAPI） |
| `src/13_DealReportService.js` | getDealReportDropdownOptions |
| `src/23_SheetService.js` | setDataValidations, initializeGoalsSheet |
| `src/35_FAQService.js` | getFAQCategories |
| `src/21_SetupDealReport.js` | 選択肢マスタへの列追加処理 |
| `src/01_Initialize.js` | シート初期化（HEADERS.SETTINGS使用箇所） |
| `src/index.html` | 旧SPA（archiveReasonList, getArchiveReasons呼び出し） |
| `frontend/src/gas/client.ts` | React向けGAS関数一覧（getDropdownOptions参照なし確認） |
| `src/99_InvBookRecon.js` | 支払サイト・キャンセル理由の追加経緯・候補値 |

---

## 8. 調査結論

1. **React新path（client.ts経由）で選択肢マスタを実際に使っているのは2列のみ**（リード種別・返信速度）
2. **旧SPA実動は1列のみ**（アーカイブ理由・index.html経由）
3. **旧SPA の `case 'getDropdownOptions'` は DROPDOWN_OPTIONS 未定義バグにより機能していない**。C分類16列（流入経路（IN）等）はコード上定義されているが現在どのクライアントにも届いていない
4. **D分類16列は選択肢sourceとして読まれていない**。うち `支払サイト`・`キャンセル理由` はORDERSフィールドと対応するが，フロントエンドがfree-text入力を使っているため未接続
5. **SSOT違反は9件**。最重要は `DROPDOWN_OPTIONS` undefined バグ（#4.4）と `販売先`/`取り扱いタイトル` キー名不一致（#4.1）
