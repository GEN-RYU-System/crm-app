# CUSTOMERS 担当者ID 列 調査レポート

調査日: 2026-09-01

## 調査目的

CUSTOMERS シート（顧客マスタ）の「担当者ID」列は CoreSchemaRegistry に定義がなく、
`runCoreSchemaConformanceAudit` の唯一の不一致（CUSTOMERS: 定義 14列 / 実シート 15列、差: 1）となっている。
Registry への追加または削除の判断材料として実態を確定させる。

## 1. GAS 実行結果（全文）

`clasp run auditCustomersAssigneeId` の生出力（2026-09-01T06:51:16.621Z）:

```json
{
  "sheetName": "顧客マスタ",
  "totalRows": 6,
  "totalCols": 15,
  "allHeaders": [
    "顧客ID", "源流リードID", "顧客名", "国", "メール", "電話番号",
    "国番号", "初回取引日", "登録日", "営業担当者", "担当者ID",
    "連絡ツール", "fedex_id", "発送時メモ", "顧客規模"
  ],
  "assigneeId": {
    "exists": true,
    "colPosition": 11,
    "nonEmptyCount": 0,
    "samples": []
  },
  "salesAssigneeName": {
    "exists": true,
    "colPosition": 10
  },
  "auditedAt": "2026-09-01T06:51:16.621Z"
}
```

## 2. データ有無

| 項目 | 値 |
|------|-----|
| 列名 | 担当者ID |
| 列番号（1-indexed） | 11 |
| 全データ行数 | 6 |
| 非空行数 | 0 |
| 空行数 | 6 |

### 値のサンプル

非空行数 0件。全6行が空値。

## 3. シート実ヘッダー vs Registry 定義の対比

| col | 実シートヘッダー | Registry 定義（CUSTOMERS） |
|-----|---------------|--------------------------|
| 1 | 顧客ID | CUSTOMER_ID（顧客ID） |
| 2 | 源流リードID | SOURCE_LEAD_ID（源流リードID） |
| 3 | 顧客名 | CUSTOMER_NAME（顧客名） |
| 4 | 国 | COUNTRY（国） |
| 5 | メール | EMAIL（メール） |
| 6 | 電話番号 | PHONE（電話番号） |
| 7 | 国番号 | COUNTRY_CODE（国番号） |
| 8 | 初回取引日 | FIRST_TRANSACTION_DATE（初回取引日） |
| 9 | 登録日 | REGISTERED_AT（登録日） |
| 10 | 営業担当者 | SALES_ASSIGNEE_NAME（営業担当者） |
| 11 | **担当者ID** | **★Registry に定義なし** |
| 12 | 連絡ツール | CONTACT_TOOL（連絡ツール） |
| 13 | fedex_id | FEDEX_ID（fedex_id） |
| 14 | 発送時メモ | SHIPPING_NOTE（発送時メモ） |
| 15 | 顧客規模 | CUSTOMER_SCALE（顧客規模） |

`担当者ID` は col11 に実在するが、Registry 定義にはない。

## 4. コード参照

### GAS 側（src/）

#### src/27_WebApp.js — 担当者ID / assignee_id を参照する箇所

| 行番号 | 参照内容 | どのテーブルの列か |
|--------|---------|------------------|
| 845 | `headers.indexOf('assignee_id')` | LEADS（リード管理） |
| 848 | コンソールログ「担当者ID列が見つかりません」 | LEADS |
| 852, 873, 879 | コメント・ログ「担当者ID」 | LEADS |
| 862 | `headers.indexOf('staff_id')` | STAFF（担当者マスタ） |
| 1182 | `headers.indexOf('assignee_id')` | LEADS（assignLeadToSales関数内） |
| 1220 | コメント「担当者IDは簡易的に〜」 | LEADS |
| 1426 | `headers.indexOf('staff_id')` | STAFF |
| 1521 | `headers.indexOf('assignee_id')` | LEADS |
| 1702 | `headers.indexOf('assignee_id')` | LEADS |
| 1852 | `headers.indexOf('assignee_id')` | LEADS |
| 2327 | `headers.indexOf('担当者ID')` | STAFF（generateNextStaffId） |
| 2364 | `if (header === '担当者ID')` | STAFF（addStaff） |
| 2390 | `headers.indexOf('担当者ID')` | STAFF（updateStaff） |
| 3436 | `appendRow(['レポートID', '担当者ID', ...])` | 商談レポートシート（ヘッダー定義） |
| 3559 | `appendRow(['ログID', '担当者ID', ...])` | ログイン履歴シート（ヘッダー定義） |
| 3593 | `headers.indexOf('担当者ID')` | ログイン履歴シート |
| 4759 | `headers.indexOf('assignee_id')` | LEADS |
| 6014, 6067 | コメント「// 27: 担当者ID」 | LEADS（サンプルCSVデータ） |

**CUSTOMERS シートの「担当者ID」列を直接 indexOf で参照しているコードは src/27_WebApp.js に存在しない。**

#### src/30_CSVImportService.js

| 行番号 | 参照内容 | どのテーブルの列か |
|--------|---------|------------------|
| 460, 495 | `sheet.getSheetByName('顧客マスタ')` + `headers.map` | CUSTOMERS |

`importCustomerMasterCSV`（30_CSVImportService.js:456）は顧客マスタシートに書き込む関数。
`headers.map(header => row[header] || '')` でシートの物理ヘッダーをそのまま使うため、
`担当者ID` 列が存在する場合、CSVに `担当者ID` キーがあればその値を書き込む。
ただし現行の CSV エクスポート定義（`exportCustomerMasterSampleCSV`）に `担当者ID` 列が含まれているかは未確認。

#### src/99_Phase5BConfirm.js

| 行番号 | 参照内容 | どのテーブルの列か |
|--------|---------|------------------|
| 409, 435 | `担当者ID` バリデーション | SHIPMENT(col17)・PURCHASE(col3)・ORDER_MASTER(col27-29)。CUSTOMERS ではない |

#### src/00_CoreSchemaRegistry.js

| 行番号 | 参照内容 |
|--------|---------|
| 15-20 | CUSTOMERS テーブル定義（14列）。`担当者ID` は含まれていない |

### フロントエンド側（frontend/src/）

| ファイル | 行番号 | 内容 | どのテーブルの列か |
|---------|--------|------|------------------|
| content/ja/auth.ts | 50 | `staffIdLabel: '担当者ID'` | STAFF（ログイン画面の UI ラベル） |
| content/ja/salesOrders.ts | 223 | `labelShipmentShippingAssigneeId: '担当者ID'` | ORDERS/SHIPMENTS 画面の UI ラベル |
| content/ja/quotes.ts | 50 | `staffId: '担当者ID'` | QUOTES 画面の UI ラベル |
| gas/client.ts | 249, 285 | `staffId` 型定義・`loginWithPassword(staffId, ...)` | STAFF |
| contexts/AuthContext.tsx | 61-68 | `login(staffId, password)` | STAFF |
| pages/staff/staffConfig.ts | 6, 31 | `staffId: string` | STAFF |
| pages/auth/LoginPage.tsx | 8, 42 | `staffId` ログイン入力 | STAFF |

**CUSTOMERS シートの「担当者ID」列を参照しているフロントエンドコードは存在しない。**

### 書き込み API

| 関数 | ファイル:行番号 | CUSTOMERS 担当者ID への書き込みか |
|------|---------------|--------------------------------|
| `importCustomerMasterCSV` | 30_CSVImportService.js:456 | CSV に `担当者ID` キーがあれば書く可能性あるが、現行のサンプル CSV 定義の確認は【未確認】 |
| `addStaff` / `updateStaff` | 27_WebApp.js:2349, 2378 | STAFF シートへの書き込み。CUSTOMERS とは無関係 |

CUSTOMERS シートの `担当者ID` 列に意図的に書き込む API は確認できていない。

## 5. 営業担当者（SALES_ASSIGNEE_NAME）との関係

GAS 実行結果より:

- `salesAssigneeName.exists: true, colPosition: 10`（「営業担当者」列、col10）
- `assigneeId.exists: true, colPosition: 11`（「担当者ID」列、col11）

コードの観点では:
- `getCoreCustomersForFrontend` / `getCoreCustomerForFrontend`（28_CoreCustomerReadApi.js）は `SALES_ASSIGNEE_NAME`（営業担当者）を読んでいる。`担当者ID` は読んでいない。
- Registry の CUSTOMERS 定義に `SALES_ASSIGNEE_NAME` は登録済みだが、`担当者ID` に相当するヘッダーキーは定義されていない。
- STAFF テーブルの `担当者ID`（`staff_id`）は LEADS テーブルの `assignee_id` から参照される外部キーとして機能している。
- CUSTOMERS の `担当者ID` 列がこれらと同一の役割を持つかは、値がすべて空のため現時点では確認できない。

## 6. Conformance Audit 結果（マージ後）

```
[CUSTOMERS / 顧客マスタ]
  3. ヘッダー列数: 定義 14 / 実シート 15 → ★不一致 (差: 1)
  小計不一致: 1件

=== 総不一致: 1 → ★FAIL ===
```

ベースラインから悪化なし（CUSTOMERS のみ、差 1 のまま）。

`dryRunOrderStatusRecalculation` 結果:
- 変更なし: 12件 / 変更あり: 0件

## 7. 判定基準（PO 判断用）

| 判定 | 条件 | 現状 |
|------|------|------|
| Registry に追加すべき | データがある、または GAS/Frontend から参照される | 全データ空、GAS/Frontend から参照なし |
| 削除候補 | データが空 かつ 参照が 0件 | **データは全6行空。GAS/Frontend から CUSTOMERS 経由の直接参照なし** |
| 【未確認】 | 判定できない | — |

現時点の事実ベースでは「削除候補」の条件を満たしている。
ただし以下の点が【未確認】であるため最終判断は PO に委ねる。

## 8. 【未確認】項目

1. `exportCustomerMasterSampleCSV`（27_WebApp.js の CSV エクスポート関数）が生成する CSV に `担当者ID` 列を含むかどうか。含む場合は `importCustomerMasterCSV` 経由でこの列に値が書き込まれる経路が存在する。
2. `担当者ID` 列がいつ追加されたか（git log による追跡は本調査スコープ外）。
3. 将来的に CUSTOMERS テーブルにスタッフ紐付けを実装する計画があるかどうか（設計意図としての存在理由）。

---

## 担当者ID 割り当て前確認（2026-09-01）

### 1. タニザワシンゴの staff_id

`getStaffMasterList` 実行結果（2026-09-01T07:35:48.544Z）— 担当者マスタ全件:

| rowNum | staff_id | last_name_ja | first_name_ja | full_name_ja | status |
|--------|----------|-------------|---------------|-------------|--------|
| 2 | EMP-00001 | 谷澤 | 伸吾 | 谷澤 伸吾 | 有効 |
| 3 | EMP-00002 | 営業 | 太郎 | 営業 太郎 | 有効 |
| 4 | EMP-00003 | 谷澤 | 美佳 | 谷澤 美佳 | 有効 |
| 5 | EMP-00004 | 森本 | 均 | 森本 均 | 無効 |
| 6 | EMP-00005 | 森本 | 均 | 森本 均 | 無効 |
| 7 | EMP-00006 | 森本 | 均 | 森本 均 | 無効 |
| 8 | EMP-00007 | 阿部 | 竜馬 | （空） | 無効 |
| 9 | EMP-00008 | テスト | 次郎 | （空） | 有効 |

**「谷澤」「伸吾」に該当する行**:

- rowNum 2: `staff_id = EMP-00001`, last_name_ja = 谷澤, first_name_ja = 伸吾, full_name_ja = 谷澤 伸吾, status = 有効

タニザワシンゴの `staff_id` = **EMP-00001**。

### 2. 顧客マスタ 営業担当者列の現状（全6行）

`getCustomerSalesAssigneeList` 実行結果（2026-09-01T07:35:59.971Z）:

| rowNum | 顧客ID | 顧客名 | 営業担当者(col10) | 担当者ID(col11) |
|--------|--------|-------|-----------------|----------------|
| 2 | CT-0001 | Alex Thompson | Demo Staff | （空） |
| 3 | CT-0002 | Maria Garcia | Demo Staff | （空） |
| 4 | CT-0003 | James Wilson | Demo Staff | （空） |
| 5 | CT-0004 | Sophie Martin | Demo Staff | （空） |
| 6 | CT-0005 | Hiroshi Tanaka | Demo Staff | （空） |
| 7 | CT-0006 | Emma Davis | Demo Staff | （空） |

**担当者マスタとの対応**:

全6行の「営業担当者」値は `Demo Staff`。担当者マスタの `full_name_ja` に `Demo Staff` は存在しない（担当者マスタ全件で照合済み）。「担当者ID」列は全6行空値（既報の通り）。

### 3. Registry 命名案

既存の命名規則（他テーブルの担当者ID外部キー列）:

| テーブル | 論理キー名(headerKey) | 物理列名(physical) | 意味 |
|---------|---------------------|------------------|------|
| LEADS | ASSIGNEE_ID | assignee_id | 担当営業（汎用・単一担当者） |
| ORDERS | ORDER_ASSIGNEE_ID | 受注担当ID | 受注担当者 |
| ORDERS | SALES_ASSIGNEE_ID | 営業担当ID | 営業担当者 |
| ORDERS | SHIPPING_ASSIGNEE_ID | 発送担当ID | 発送担当者 |
| ORDERS | PAYMENT_CONFIRMED_BY_ID | 入金確認者ID | 入金確認者 |
| SHIPMENTS | SHIPPING_ASSIGNEE_ID | 発送担当ID | 発送担当者 |
| PURCHASES | PURCHASE_ASSIGNEE_ID | purchase_assignee_id | 仕入れ担当者 |
| PURCHASES | PAID_BY_ID | paid_by_id | 支払実施者 |
| QUOTES | STAFF_ID | 担当者ID | 担当者（汎用） |
| LOGIN_SESSIONS | STAFF_ID | 担当者ID | セッション所有者（STAFF直接） |

命名パターンの整理:

1. **役割固有型**（ORDERS/SHIPMENTS/PURCHASES）: `{ROLE}_ASSIGNEE_ID` / `{role}_assignee_id` — 役割名を接頭辞にする
2. **汎用型**（LEADS）: `ASSIGNEE_ID` / `assignee_id` — 単一の「担当」
3. **直接参照型**（QUOTES/LOGIN_SESSIONS）: `STAFF_ID` / `担当者ID` または `staff_id` — STAFF テーブルの PK をそのまま使用

CUSTOMERS への追加案（Registry に追加する場合 — PO 判断待ち）:

| 案 | 論理キー名 | 物理列名 | 根拠 |
|----|----------|---------|------|
| 案A | SALES_ASSIGNEE_ID | 担当者ID | ORDERS.SALES_ASSIGNEE_ID（`営業担当ID`）と役割が同義。物理列名は既存「担当者ID」をそのまま維持。referenceId: STAFF |
| 案B | ASSIGNEE_ID | 担当者ID | LEADS.ASSIGNEE_ID（`assignee_id`）と同パターン（汎用担当者）。物理列名は既存維持。referenceId: STAFF |

案A と案B の差異は論理キー名のみ。役割を明示するなら案A（SALES_ASSIGNEE_ID）、汎用担当者として扱うなら案B（ASSIGNEE_ID）。

決定は PO が行う。

### 4. 【未確認】項目

1. 顧客マスタの「営業担当者」（col10）= `Demo Staff` は DEV シードデータ（フィクション）であり、実運用時の値との対応は未確認。
2. Registry に追加する場合の物理列名を英字（`sales_assignee_id` / `assignee_id`）に変更するか、現行の日本語「担当者ID」を維持するかは PO 判断が必要（他 CUSTOMERS 列は日本語物理名を使用しているため日本語維持が整合的だが、ORDERS の同種列は英語）。
