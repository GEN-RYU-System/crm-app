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
| 総行数 | 1086 行 | postgres-migration-analysis.md §2-13 |
| product_id が NULL/空の行数 | 204 行 | 同 §7 参照整合性監査（全 1086 行対象） |
| product_id が存在する行数 | 882 行（= 1086 − 204） | 計算値 |
| 孤児参照（product_id が 商品マスタ同期に存在しない）| 0 件 | 同 §7 |
| Condition 列の値種別 | Sealed box / Damaged sealed box / Case / No shrink box / Searched pack / FLAG_SINGLE / Damaged case / Unsearched pack（計 8 種） | CoreSchemaRegistry.SHARED_INVENTORY.values |
| 提供者（supplier）列の先頭 100 行サンプル | maxLen=4、sample: シンソク | postgres-migration-analysis.md §2-13 |

備考: `CoreSchemaV1.SHARED_INVENTORY.primaryKey = null`（コメント: 「product_id が重複する（同一商品を複数の提供者が出す場合がある）ため」）

**以下の一意性確認は `auditSharedInventoryUniqueness` 関数（本 PR で追加）を DEV 環境にデプロイ後に実行して記入する。**

| 確認項目 | 結果 |
|---------|------|
| (product_id, 提供者) の組み合わせが 1086 行で一意か | **→ 実行後に記入** |
| (product_id, Condition, 提供者) の組み合わせが 1086 行で一意か | **→ 実行後に記入** |
| 完全重複行（全 11 列一致）の件数 | **→ 実行後に記入** |

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
| product_id が NULL の 204 行の扱い | PostgreSQL の UNIQUE 制約は NULL 同士を別値として扱うため、NULL + supplier の組み合わせが重複しても制約違反にならない |
| GAS API への影響 | 読み取り専用 API のため、主キー列への依存なし。影響なし |

**前提条件**: (product_id, 提供者) が 1086 行で一意であること。**→ auditSharedInventoryUniqueness の実行結果を確認すること。**

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
| product_id が NULL の 204 行の扱い | PostgreSQL では主キー列に NULL を持てないため、NULL の 204 行は挿入拒否。移行前に NULL の 204 行を別途処理する必要がある |
| GAS API への影響 | 読み取り専用 API のため影響なし |

**前提条件**: (product_id, Condition, 提供者) が 1086 行で一意であること。**→ auditSharedInventoryUniqueness の実行結果を確認すること。**

**NULL 行の処理方針（別途 PO 判断が必要）**:  
- (a) product_id = NULL の 204 行は移行対象外とする  
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

`選択肢マスタV2`（OPTION_MASTER）は分析時に DEV 環境に存在しなかったため（SHEET_NOT_FOUND）、5列のうち 4列の型を CoreSchemaV1 Registry の論理型から推定している。

| SQL 列名 | schema.sql の型 | 型の根拠 | 全行空か |
|---------|---------------|---------|---------|
| `option_id` | TEXT NOT NULL | Registry 論理キー（PK） | — |
| `category` | TEXT | Registry 論理型（string）から推定 | **【未確認】**（SHEET_NOT_FOUND のため空行数不明） |
| `value` | TEXT | 同上 | **【未確認】** |
| `sort_order` | INTEGER | 同上（number かつ小数なし） | **【未確認】** |
| `is_active` | BOOLEAN | 同上（boolean） | **【未確認】** |

schema-notes.md §3-2: 「分析データなしのため全列 NULL 可（Registry の論理型から推定）」

現在の DEV 環境でのシート存在確認および実データ分析を別途実施すれば確定できる。

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

## 4. auditSharedInventoryUniqueness の実行手順

本 PR で追加した `src/99_DevSharedInventoryUniquenessAudit.js` を DEV 環境にデプロイ後、以下のコマンドで実行する。

```bash
# 本 PR を develop にマージ → CI が DEV に自動デプロイ後
clasp run auditSharedInventoryUniqueness
```

実行結果の読み方:

```json
{
  "totalDataRows": <1086 になることを確認>,
  "productIdNullCount": <NULL/空の product_id 件数>,
  "comboA": {
    "isUnique": <true なら選択肢1の前提を満たす>,
    "duplicateKeyCount": <重複キー数>
  },
  "comboB": {
    "isUnique": <true なら選択肢2の前提を満たす>,
    "duplicateKeyCount": <重複キー数>
  },
  "fullDuplicateRowCount": <完全重複行の件数>
}
```

---

## 5. 【未確認】項目まとめ

| # | 項目 | 確認方法 |
|---|------|---------|
| U-1 | (product_id, 提供者) が 1086 行で一意か | `clasp run auditSharedInventoryUniqueness` の `comboA.isUnique` |
| U-2 | (product_id, Condition, 提供者) が 1086 行で一意か | 同 `comboB.isUnique` |
| U-3 | 完全重複行の件数 | 同 `fullDuplicateRowCount` |
| U-4 | option_master の 4 列（category / value / sort_order / is_active）の実データ型 | DEV 環境で `選択肢マスタV2` シートを分析 |
| U-5 | 別セッションが共用在庫の SQL DDL を独自に作成済みかどうか | 別セッション担当者への確認 |
