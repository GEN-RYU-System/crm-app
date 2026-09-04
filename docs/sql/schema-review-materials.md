# DDL レビュー用 PO 判断材料

> 作成日: 2026-09-04  
> 対象ファイル: `docs/sql/schema.sql` / `docs/sql/schema-notes.md`  
> 方針: **事実と選択肢のみ。推奨は記載しない。**

---

## 1. PO 判断が必要な項目（未決定）

`docs/sql/schema-notes.md` §7 に記録された過去 PO 判断（A〜H）はすべて (a) が採用済みであり、`schema.sql` に反映されている。

**現時点で未決定の PO 判断は 1 件のみ。**

| # | 項目 | 状態 | 参照 |
|---|------|------|------|
| PK-1 | 共用在庫（`shared_inventory`）の主キー設計 | **未決定** | §2 参照 |

過去決定済み項目の一覧は `docs/sql/schema-notes.md` §7 を参照。

---

## 2. shared_inventory の主キー案

### 2-1. 前提事実（実測値）

| 項目 | 値 | 出典 |
|------|-----|------|
| 総行数（DEV 実測） | **876 行** | `clasp run auditSharedInventoryUniqueness` 2026-09-04 |
| ※ 前回分析値との差異 | 前回は 1086 行（postgres-migration-analysis.md §2-13）。DEV シートの行数が変動したと考えられる。【未確認: 差異の原因】 | — |
| product_id が NULL/空の行数 | **180 行** | 同上（DEV 実測） |
| product_id が存在する行数 | **696 行**（= 876 − 180） | 計算値 |
| 孤児参照（product_id が 商品マスタ同期に存在しない）| 0 件 | postgres-migration-analysis.md §7（1086 行対象時の値） |
| 提供者（supplier）が空の行数 | 0 件 | `clasp run auditSharedInventoryUniqueness` 2026-09-04 |
| Condition が空の行数 | 0 件 | 同上 |
| Condition 列の値種別（Registry 定義） | Sealed box / Damaged sealed box / Case / No shrink box / Searched pack / FLAG_SINGLE / Damaged case / Unsearched pack（計 8 種） | CoreSchemaRegistry.SHARED_INVENTORY.values |
| Condition 列の値種別（実データ追加値） | **Opened box**（Registry 未定義。`runCoreSchemaConformanceAudit` 2026-09-04 で検出） | `clasp run runCoreSchemaConformanceAudit` |
| 提供者（supplier）列の先頭 100 行サンプル | maxLen=4、sample: シンソク | postgres-migration-analysis.md §2-13 |

備考: `CoreSchemaV1.SHARED_INVENTORY.primaryKey = null`（コメント: 「product_id が重複する（同一商品を複数の提供者が出す場合がある）ため」）

**一意性確認結果（`clasp run auditSharedInventoryUniqueness --json` 2026-09-04 実行）:**

| 確認項目 | 結果 |
|---------|------|
| (product_id, 提供者) の組み合わせが 876 行で一意か | **一意でない**（重複キー組み合わせ数: 10） |
| (product_id, Condition, 提供者) の組み合わせが 876 行で一意か | **一意でない**（重複キー組み合わせ数: 10） |
| 完全重複行（全 11 列一致）の件数 | **0 件** |

**comboA 重複キー詳細（(product_id, 提供者) 上位 10 組）:**

| product_id | 提供者 | 該当行数 |
|-----------|-------|---------|
| （空） | 吉田翔 | 40 |
| （空） | 株式会社モノウリ ハタナカ | 15 |
| （空） | H | 15 |
| （空） | SIG | 13 |
| PM0263 | 佐々木優太 | 10 |
| （空） | やまちゃん | 8 |
| （空） | 下司弘樹 | 8 |
| （空） | 株式会社fun labo | 8 |
| （空） | 武 | 7 |
| （空） | 佐々木優太 | 7 |

※ 10 組のうち 9 組は product_id が空。1 組（PM0263 + 佐々木優太）は product_id が非 NULL の実重複。

**comboB 重複キー詳細（(product_id, Condition, 提供者) 上位 10 組）:**

| product_id | Condition | 提供者 | 該当行数 |
|-----------|----------|-------|---------|
| （空） | FLAG_SINGLE | 吉田翔 | 30 |
| （空） | FLAG_SINGLE | 株式会社モノウリ ハタナカ | 15 |
| （空） | FLAG_SINGLE | H | 13 |
| （空） | FLAG_SINGLE | SIG | 13 |
| PM0263 | Sealed box | 佐々木優太 | 10 |
| （空） | FLAG_SINGLE | やまちゃん | 8 |
| （空） | Unsearched pack | 吉田翔 | 8 |
| （空） | FLAG_SINGLE | 下司弘樹 | 7 |
| （空） | FLAG_SINGLE | 吉田 | 7 |
| （空） | Case | 株式会社fun labo | 7 |

※ 10 組のうち 9 組は product_id が空。1 組（PM0263 + Sealed box + 佐々木優太）は product_id が非 NULL の実重複。

### 2-2. 外部参照（GAS API）

共用在庫にアクセスする GAS 関数:

| 関数名 | ファイル | 用途 |
|--------|---------|------|
| `getSharedInventoryForFrontend` | `28_SharedInventoryReadApi.js:358` | フロント向け在庫一覧 |
| `getInventoryBatchForFrontend` | `28_SharedInventoryReadApi.js:197` | バッチ取得 |
| `getInventoryProductOptions` | `28_CoreInventoryOptionApi.js` | 在庫商品選択肢 |

これら 3 関数はいずれも **読み取り専用**（`writeAllowed: false`）。シートへの書き込みはしない。

共用在庫は `CoreSchemaV1.SHARED_INVENTORY` で「別セッション管轄」と記録されている。

### 2-3. 各案の事実と影響

#### 選択肢1: `(product_id, 提供者)` に UNIQUE 制約 + サロゲートキー（SERIAL）を PK として追加

**内容**

```sql
CREATE TABLE shared_inventory (
    id          SERIAL PRIMARY KEY,       -- 追加するサロゲートキー
    product_id  TEXT,
    supplier    TEXT NOT NULL,
    condition   TEXT NOT NULL,
    ...
    CONSTRAINT uq_shared_inventory_product_supplier
        UNIQUE (product_id, supplier)
);
```

**必要な作業**

| 項目 | 内容 |
|------|------|
| シートへの列追加 | **不要**（id は PostgreSQL 内部で自動採番。GAS スプレッドシートに列を追加しない） |
| product_id が NULL の 180 行の扱い | PostgreSQL の UNIQUE 制約は NULL 同士を別値として扱うため、NULL + supplier の組み合わせが重複しても制約違反にならない |
| GAS API への影響 | 読み取り専用 API のため、主キー列への依存なし。影響なし |

**前提条件**: (product_id, 提供者) が全行で一意であること。**→ 実測結果: 一意でない（PM0263 + 佐々木優太 が 10 行重複）。UNIQUE 制約を追加する場合、この重複を事前に解消する必要がある。**

**ユニーク制約に NULL を含む場合の動作**:  
PostgreSQL 15 以前: NULL は UNIQUE 制約で「異なる値」として扱われる（NULL + 同一 supplier が複数存在しても制約違反にならない）。  
PostgreSQL 15 以降: `NULLS NOT DISTINCT` オプションで NULL を同一扱いにすることも可能。

---

#### 選択肢2: `(product_id, Condition, 提供者)` の複合主キー

**内容**

```sql
CREATE TABLE shared_inventory (
    product_id TEXT,
    condition  TEXT NOT NULL,
    supplier   TEXT NOT NULL,
    ...
    CONSTRAINT pk_shared_inventory
        PRIMARY KEY (product_id, condition, supplier)
);
```

**必要な作業**

| 項目 | 内容 |
|------|------|
| シートへの列追加 | **不要** |
| product_id が NULL の 180 行の扱い | PostgreSQL では主キー列に NULL を持てないため、NULL の 180 行は挿入拒否。移行前に NULL の 180 行を別途処理する必要がある |
| GAS API への影響 | 読み取り専用 API のため影響なし |

**前提条件**: (product_id, Condition, 提供者) が全行で一意であること。**→ 実測結果: 一意でない（PM0263 + Sealed box + 佐々木優太 が 10 行重複）。NULL 行 180 件 + この重複を事前に解消する必要がある。**

**NULL 行の処理方針（別途 PO 判断が必要）**:  
- (a) product_id = NULL の 180 行は移行対象外とする  
- (b) placeholder の product_id（例: `UNKNOWN`）を割り当てて移行する

---

#### 選択肢3: 在庫管理専用テーブルとして別スキーマで設計

**内容**

`shared_inventory` をコア CRM スキーマ（`public`）から分離し、別スキーマ（例: `inventory`）で再設計する。主キー・列構成は独立して設計できる。

**必要な作業**

| 項目 | 内容 |
|------|------|
| シートへの列追加 | **不要** |
| スキーマ分離の実装 | PostgreSQL に `CREATE SCHEMA inventory;` を実行し、`inventory.shared_inventory` として定義する |
| 22 テーブル DDL への影響 | 現在の `schema.sql` には外部キー参照なし。影響なし |
| GAS API への影響 | 読み取り専用 API のため、SQL 移行後の API 再実装時に接続先スキーマを指定する必要がある |

**この案はデータ構造の問題（NULL、一意性）を解決しない。** 別スキーマで設計しても、主キーの定義方針（選択肢1または2に相当するもの）は別途決める必要がある。

---

### 2-4. 別セッション管轄との競合可能性

共用在庫は「別セッション管轄」と記録されている（`docs/schema-notes.md` §4）。

**確認事項**:  
- 別セッションが共用在庫テーブルの DDL を独自に定義している場合、本 DDL と競合する可能性がある  
- **【未確認】**: 別セッションが共用在庫の SQL DDL を作成済みかどうかは本調査では確認していない。別セッションとの調整が必要。

---

## 3. 型が未確定の列の一覧

`schema.sql` を全件精査した。**「-- 型未確定」コメントが存在する列は 0 件。**

ただし、以下の状況が存在する。

### 3-1. 分析データなしで型を推定した列（option_master）

`選択肢マスタV2`（OPTION_MASTER）は初回分析時に DEV 環境に存在しなかったため（SHEET_NOT_FOUND）、5列のうち 4列の型を CoreSchemaV1 Registry の論理型から推定している。

**2026-09-04 追記**: `clasp run runCoreSchemaConformanceAudit` により、DEV 環境に `選択肢マスタV2` シートが存在することを確認（シート取得: OK、ヘッダー列数: 定義 5 / 実シート 5 → OK、不一致: 0件）。シートは存在するが、各列の実データ型の確認（全行空かどうか等）は別途必要。

| SQL 列名 | schema.sql の型 | 型の根拠 | 備考 |
|---------|---------------|---------|------|
| `option_id` | TEXT NOT NULL | Registry 論理キー（PK） | — |
| `category` | TEXT | Registry 論理型（string）から推定 | シート存在確認済み（2026-09-04）。実データ型は未確認 |
| `value` | TEXT | 同上 | 同上 |
| `sort_order` | INTEGER | 同上（number かつ小数なし） | 同上 |
| `is_active` | BOOLEAN | 同上（boolean） | 同上 |

schema-notes.md §3-2: 「分析データなしのため全列 NULL 可（Registry の論理型から推定）」

実データ分析を別途実施すれば型を確定できる。

### 3-2. 型の決定が注目すべき列（既に確定済み）

以下は schema-notes.md §2-4 に記録された「型決定が複雑だった列」。型は確定済みであり未確定ではないが、レビュー時に注目点となりうる。

| テーブル.列 | SQL 型 | 判断根拠 |
|-----------|--------|---------|
| `products.boxes_per_case` | NUMERIC(15,2) NULL可 | GAS 値に "-"（文字列）が混在。PO判断G(a)で NULL 変換を採用 |
| `products.packs_per_box` | NUMERIC(15,2) NULL可 | 同上 |
| `products.case_weight` | NUMERIC(15,2) NULL可 | 同上 |
| `products.hs_code` | BIGINT | 10桁整数は INTEGER 上限（約 21億）を超えるため |
| `settings.setting_value` | TEXT | GAS での型混在（number/boolean）を文字列統一済み（2026-09-02） |
| `login_sessions.session_id` | TEXT | UUID×2連結形式（maxLen=72）。UUID 型 2列への分割は移行フェーズで検討 |
| `conversation_logs.recorder_id` | TEXT | メールアドレス形式（maxLen=27）。STAFF.staff_id（EMP-XXXXX）とは形式が異なりFK制約なし |

---

## 4. auditSharedInventoryUniqueness の実行結果（2026-09-04）

`src/99_DevSharedInventoryUniquenessAudit.js` を DEV 環境にデプロイ後、以下のコマンドで実行済み。

```bash
clasp run auditSharedInventoryUniqueness --json
```

**生出力（抜粋）:**

```json
{
  "totalDataRows": 876,
  "productIdNullCount": 180,
  "supplierEmptyCount": 0,
  "conditionEmptyCount": 0,
  "fullDuplicateRowCount": 0,
  "comboA": {
    "isUnique": false,
    "duplicateKeyCount": 10
  },
  "comboB": {
    "isUnique": false,
    "duplicateKeyCount": 10
  }
}
```

重複キー詳細は §2-1 参照。

---

## 5. 確認済み・未確認項目まとめ

| # | 項目 | 状態 | 結果 |
|---|------|------|------|
| U-1 | (product_id, 提供者) が全行で一意か | **確認済み** | 一意でない（10 組の重複。うち非 NULL 実重複: PM0263 + 佐々木優太 が 10 行） |
| U-2 | (product_id, Condition, 提供者) が全行で一意か | **確認済み** | 一意でない（10 組の重複。うち非 NULL 実重複: PM0263 + Sealed box + 佐々木優太 が 10 行） |
| U-3 | 完全重複行（全 11 列一致）の件数 | **確認済み** | 0 件 |
| U-4 | option_master の 4 列（category / value / sort_order / is_active）の実データ型 | **一部確認** | シート存在を確認（2026-09-04）。各列の実データ分析は未実施 |
| U-5 | 別セッションが共用在庫の SQL DDL を独自に作成済みかどうか | **未確認** | 別セッション担当者への確認が必要 |

---

## 6. 共用在庫 inventory_id 列追加 事前確認（2026-09-04 調査）

PO 決定（2026-09-04）: 共用在庫の主キーはサロゲートキー（連番）とする。
列追加前の事前確認として以下を調査した。

### 6-1. GAS 側からの書き込み

`grep -rn "共用在庫\|SHARED_INVENTORY" src/ | grep -iE "setValue|appendRow|write"` の結果:

| ファイル | 内容 | 判定 |
|--------|------|------|
| `src/00_SheetWrite.js:44` | `SHARED_INVENTORY_CACHE_INDEX` → "inventory"（コメント） | cache write（シート書き込みなし）|
| `src/99_PerfBench.js:676` | `writeCacheChunks_` | cache write（シート書き込みなし）|
| `src/28_SharedInventoryReadApi.js:345,374` | `writeCacheChunks_` | cache write（シート書き込みなし）|
| `src/00_CoreSchemaRegistry.js:219` | `writeAllowed: false` | Registry 定義（書き込み禁止）|

**判定: GAS 側からのシート書き込み = なし**

### 6-2. 読み取り関数の列参照方式

`getSharedInventoryForFrontend`（`28_SharedInventoryReadApi.js:358`）と `getInventoryBatchForFrontend`（同:197）はいずれも `buildSharedInventoryRows_`（同:11）を経由する。

`buildSharedInventoryRows_` の列解決方式（`28_SharedInventoryReadApi.js:76-93`）:

```javascript
var headers = invData[0].map(String);
var col = {
  series:          headers.indexOf('Series'),
  quantity:        headers.indexOf('Quantity'),
  unitPrice:       headers.indexOf('Unit Price'),
  condition:       headers.indexOf('Condition'),
  status:          headers.indexOf('Status'),
  noteJa:          headers.indexOf('Note_JA'),
  noteEn:          headers.indexOf('Note_EN'),
  supplier:        headers.indexOf('提供者'),
  productId:       headers.indexOf('product_id'),
  rawName:         headers.indexOf('raw_name'),
  exclusionReason: headers.indexOf('除外理由')
};
```

全 11 列を**ヘッダー名で動的解決**。列位置の直書きなし。ヘッダー不足の場合は例外をスロー。

**判定: 読み取り関数の列参照方式 = 列名ベース（列追加による影響なし）**

### 6-3. 外部からの書き込み・IMPORTRANGE

| 確認項目 | 結果 | 出典 |
|---------|------|------|
| このコードベースの IMPORTRANGE 対象 | `共用在庫` は対象外。`01_Initialize.js:880` の IMPORTRANGE は 'Stock List同期'（ERP の Stock List）。| `src/01_Initialize.js:869-894` |
| '共用在庫' の sheetType | `SYNC_MASTER`（外部から同期されるシートの可能性あり） | `src/00_CoreSchemaRegistry.js:219` |
| `共用在庫` シートの実際の数式 | **【未確認】**（`clasp run checkSharedInventoryFormulas` が実行不可） | — |
| tcg-inventory-parser の書き込み方式 | **【未確認】**（外部リポジトリのためコード参照不可） | — |

### 6-4. 判定

| 判定基準 | 状態 |
|---------|------|
| 全参照が列名ベース | **OK** |
| 外部書き込みなし | **【未確認】**（tcg-inventory-parser + 実シートの数式） |

**最終判定: 【未確認】** → 列を追加しない。tcg-inventory-parser の書き込み方式および共用在庫シートの IMPORTRANGE 数式の有無について、別セッション担当者に確認が必要。

### 6-5. 未確認事項の確認方法

| 未確認事項 | 確認方法 |
|---------|---------|
| 共用在庫シートの数式 | `clasp run checkSharedInventoryFormulas` を実行（`src/99_DevSharedInventoryFormulaCheck.js` デプロイ済み） |
| tcg-inventory-parser の書き込み方式 | tcg-inventory-parser リポジトリのコードで共用在庫シートへの書き込み部分を確認。列位置直書きか列名指定かを確認 |
