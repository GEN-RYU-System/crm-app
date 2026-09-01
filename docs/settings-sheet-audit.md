# システム設定シート 空列調査レポート

## 1. 調査基準

| 項目 | 値 |
|------|-----|
| 調査基準 SHA | `6f46199de753734889aec55c56560b8b562a7ef3` (develop HEAD at audit time) |
| GAS 実行日時 | 2026-09-01T05:22:28.467Z |
| 調査関数 | `auditSettingsSheet()` in `src/99_DevSettingsSheetAudit.js` |
| PR | #830 |

### 書き込み系操作 grep 結果（全文）

```
$ grep -nE "setValue|setValues|appendRow|deleteColumn|deleteRow|\.clear\(" src/99_DevSettingsSheetAudit.js
（出力なし — ヒット 0件）
```

合格条件（ヒット 0件）を満たす。

---

## 2. システム設定シートの全列一覧

GAS 実行結果の生データ:

```json
{
  "sheetName": "システム設定",
  "auditedAt": "2026-09-01T05:22:28.467Z",
  "totalRows": 17,
  "dataRows": 16,
  "totalCols": 14,
  "columns": [
    {"colPosition":1,"columnName":"設定キー","isEmptyName":false,"nonEmptyCount":3},
    {"colPosition":2,"columnName":"設定値","isEmptyName":false,"nonEmptyCount":3},
    {"colPosition":3,"columnName":"値の型","isEmptyName":false,"nonEmptyCount":3},
    {"colPosition":4,"columnName":"説明","isEmptyName":false,"nonEmptyCount":3},
    {"colPosition":5,"columnName":"更新日時","isEmptyName":false,"nonEmptyCount":3},
    {"colPosition":6,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":7,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":8,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":9,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":10,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":11,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":12,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":13,"columnName":"","isEmptyName":true,"nonEmptyCount":0},
    {"colPosition":14,"columnName":"","isEmptyName":true,"nonEmptyCount":1}
  ]
}
```

### 列一覧表

| 列位置 | 列名 | 空列判定 | データ行数（空でない） | 値の全件 |
|--------|------|---------|---------------------|---------|
| 1 | 設定キー | No | 3 | row2: 見積もり有効期限日数 / row3: REMINDER_ENABLED / row4: オーダー支払期日日数 |
| 2 | 設定値 | No | 3 | row2: 30 / row3: TRUE / row4: 2 |
| 3 | 値の型 | No | 3 | row2: 数値 / row3: 真偽値 / row4: 数値 |
| 4 | 説明 | No | 3 | row2: 見積書の有効期限を発行日から何日後に設定するか / row3: リマインダー通知の有効/無効フラグ / row4: オーダーの支払期日（受注日からの日数） |
| 5 | 更新日時 | No | 3 | row2: 2026-08-19T08:14:33.634Z / row3: 2026-08-19T08:14:33.634Z / row4: 2026-08-22T16:25:35.866Z |
| 6 | （空） | Yes | 0 | なし |
| 7 | （空） | Yes | 0 | なし |
| 8 | （空） | Yes | 0 | なし |
| 9 | （空） | Yes | 0 | なし |
| 10 | （空） | Yes | 0 | なし |
| 11 | （空） | Yes | 0 | なし |
| 12 | （空） | Yes | 0 | なし |
| 13 | （空） | Yes | 0 | なし |
| 14 | （空） | Yes | 1 | row17: [マスク済 — トークン形式の文字列。セキュリティ上非公開] |

備考:
- row1 はヘッダー行。データ行は row2〜row17（16行）
- 実際にデータが入っているのは row2〜row4 の3行のみ
- row5〜row16 は全列空
- row17 は列1〜13 が空、列14 のみに値あり（トークン形式の文字列）

---

## 3. Registry 定義との突き合わせ

`src/00_CoreSchemaRegistry.js` 行 260-278 の SETTINGS 定義:

```javascript
SETTINGS: {
  sheetName: 'システム設定',
  headers: createCoreSchemaV1Headers([
    ['SETTING_KEY',   '設定キー'],
    ['SETTING_VALUE', '設定値'],
    ['VALUE_TYPE',    '値の型'],
    ['DESCRIPTION',   '説明'],
    ['UPDATED_AT',    '更新日時']
  ]),
  primaryKey: 'SETTING_KEY',
  ...
}
```

### 定義列と実シート列の対応

| 論理キー | 物理名（定義） | 実シート列位置 | 一致 |
|---------|-------------|--------------|------|
| SETTING_KEY | 設定キー | 列1 | 一致 |
| SETTING_VALUE | 設定値 | 列2 | 一致 |
| VALUE_TYPE | 値の型 | 列3 | 一致 |
| DESCRIPTION | 説明 | 列4 | 一致 |
| UPDATED_AT | 更新日時 | 列5 | 一致 |

定義された5列はすべて実シートの列1〜5と一致する。

列6〜14（9列）はいずれも Registry 定義に存在しない。

---

## 4. 空列9件の判定表

| 列位置 | 値あり | 参照あり（getSettingValue / indexOf で解決） | 判定 |
|--------|--------|----------------------------------------------|------|
| 6 | No（0件） | No | 値なし・参照なし |
| 7 | No（0件） | No | 値なし・参照なし |
| 8 | No（0件） | No | 値なし・参照なし |
| 9 | No（0件） | No | 値なし・参照なし |
| 10 | No（0件） | No | 値なし・参照なし |
| 11 | No（0件） | No | 値なし・参照なし |
| 12 | No（0件） | No | 値なし・参照なし |
| 13 | No（0件） | No | 値なし・参照なし |
| 14 | Yes（1件: row17） | No | 値あり・参照なし |

「参照あり」の判定根拠: `getSettingValue()` は `SETTING_KEY` 列の値でキー検索を行う。
空列（列名なし）は `indexOf` で見つからず、`keyCol < 0` となり参照されない。
また、コード中で列番号（6〜14）を直接指定している箇所は確認されなかった（Step 6 の grep 結果より）。

---

## 5. 使用箇所（getSettingValue 経由の参照）

`getSettingValue` 関数の定義: `src/08_Config.js` 行 861-889

```javascript
function getSettingValue(key) {
  // getCoreSchemaV1Sheet(ss, 'SETTINGS') でシートを取得
  // SETTING_KEY 列でキーを検索し、SETTING_VALUE 列の値を返す
  // 列番号は indexOf で動的に解決（固定列番号なし）
}
```

### 呼び出し箇所

| ファイル | 行番号 | キー |
|---------|--------|------|
| `src/28_CoreOrderWriteApi.js` | 139 | `'オーダー支払期日日数'` |
| `src/28_CoreQuoteApi.js` | 193 | `'見積もり有効期限日数'` |
| `src/19_ReminderService.js` | 7 | `'REMINDER_ENABLED'` |

上記3キーはいずれも実シート row2〜row4 の SETTING_KEY 列（列1）に存在する（Step 4 の実測値より）。

---

## 6. 未確認項目

| 項目 | 確認方法 |
|------|---------|
| 列14 row17 の値の用途 | GAS スクリプトエディタで直接確認するか、PO に問い合わせる |
| row5〜row16 の空行が意図的かどうか | PO に確認する |

---

## 7. PO 判断が必要な項目

| 列位置 | 事実 | PO 判断が必要な理由 |
|--------|------|-------------------|
| 列14（空列） | row17 にトークン形式の文字列が1件存在する | 参照コードなし・列名なし。値の出所・用途・削除可否が不明 |
| 列6〜13（空列） | 全行空値。参照コードなし | 削除可否・存在理由が不明 |

**本レポートは事実の記録のみ。列名の付与・削除の判断は行わない。**
