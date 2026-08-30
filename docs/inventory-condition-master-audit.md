# 在庫状態マスタ 有無確認 調査レポート

**調査日**: 2026-08-30  
**調査基準 SHA**: `51d4c4e`（release/gas-audit-docs、docs/のみ変更）  
**調査範囲**: `src/` 全 .js ファイル（読み取りのみ。変更なし）  
**目的**: SHARED_INVENTORY の未定義値4種の原因確定。  
「マスタシートがあるがコードが見ていない」（パターンA/A'）か「マスタシート自体が無い」（パターンB）かを切り分ける。

---

## 前提: docs/sheet-headers-snapshot.md について

**【訂正 2026-08-30】調査時点で canonical clone が `develop` 未追従（`release/gas-audit-docs` ブランチ）だったため、`ls docs/sheet-headers-snapshot.md` が `No such file or directory` を返した。**
**ファイルは `origin/develop` 上に存在する（PR #674 / squash SHA: `c7cd2fe`）。**

```
git ls-tree origin/develop docs/ --name-only | grep snapshot
→ docs/sheet-headers-snapshot.md  （存在を確認）
```

調査当時は参照できなかったため、代わりに以下を使用した（調査結論への影響なし）:

- `docs/gas-sheet-reference-audit.md`（全参照シート一覧・調査済み）
- `src/00_CoreSchemaRegistry.js`（CONDITION 定義箇所）
- `src/08_Config.js`（CONFIG.SHEETS 定義）
- `src/28_SharedInventoryReadApi.js`（シート読み取り実装）

---

## 1. 在庫状態のマスタシートが実在するか

### 判定根拠

`docs/gas-sheet-reference-audit.md` に列挙された全参照シート（現行系・旧ERP系合計 77件相当）を確認した。

**在庫状態の選択肢を定義するマスタシート（状態 / ステータス / condition / status / M_前置き等）は1件も存在しない。**

確認したリスト（抜粋、状態・選択肢系のキー）:

| シート名 | CONFIG.SHEETS キー | 関係 |
|---------|-------------------|------|
| 選択肢マスタ | SETTINGS | **リード管理の選択肢** (国・温度感等) |
| 共用在庫 | CoreSchema SHARED_INVENTORY | 在庫データ本体（選択肢マスタではない） |

「選択肢マスタ」（`CONFIG.SHEETS.SETTINGS = '選択肢マスタ'`）がもっとも近いが、
このシートの利用箇所（`src/08_Config.js:65`, `src/23_SheetService.js`）は
リード管理用プルダウン（流入経路・国など）を管理するものであり、
在庫の Condition 列の許可値を定義するシートではない。

**【事実】在庫状態（Condition）の許可値を定義するマスタシートは実在しない。**

---

## 2. コード側の定義箇所

### grep コマンドと結果（全件）

```bash
# (1) 依頼コマンド: 4つの未定義値
grep -rn "Searched pack\|Unsearched pack\|Damaged case\|FLAG_SINGLE" src/
# → 0件（完全一致なし）

# (2) 依頼コマンド: SHARED_INVENTORY
grep -rn "SHARED_INVENTORY" src/
# → 以下のファイルが該当
```

| ファイル | 主要な参照行 | 内容 |
|---------|-----------|------|
| `src/00_CoreSchemaRegistry.js` | L195–212 | **CONDITION の許可値を定義（ハードコード）** |
| `src/28_SharedInventoryReadApi.js` | L1–4, L95, L203–204, L299, L345, L364–365, L374 | キャッシュ定数・シート読み取り実装 |
| `src/28_CoreInventoryOptionApi.js` | L32, L120, L121, L131, L166, L168 | 在庫オプションAPI |
| `src/28_CoreQuoteApi.js` | L691, L721 | 見積もりAPI |
| `src/99_PerfBench.js` | L680–708, L2522, L2634, L2656 | ベンチマーク（非本番） |
| `src/99_DisplaySettingsVerify.js` | L81–82 | 表示設定検証（非本番） |

### CONDITION の定義箇所（読んだ行を明記）

**ファイル**: `src/00_CoreSchemaRegistry.js`  
**行**: 195–212

```javascript
// L195
SHARED_INVENTORY: {
  sheetName: '共用在庫', /* ... */
  // L204–211: CONDITION 許可値（ハードコード）
  values: {
    CONDITION: {
      SEALED_BOX:         'Sealed box',         // L206
      DAMAGED_SEALED_BOX: 'Damaged sealed box', // L207
      CASE:               'Case',               // L208
      NO_SHRINK_BOX:      'No shrink box'        // L209
    }
  },
```

**【事実】許可値は4種。すべてコード内にハードコードされており、シートから動的に読み込んでいない。**

### 読み込み実装の確認（読んだ行を明記）

**ファイル**: `src/28_SharedInventoryReadApi.js`  
**行**: 69–131（`buildSharedInventoryRows_` 関数）

```javascript
// L70: シート名を文字列リテラルで直接参照
var invSheet = ss.getSheetByName('共用在庫');
// L76–88: ヘッダー名で列インデックスを動的解決
var col = {
  condition: headers.indexOf('Condition'), // L80
  // ...
};
// L95: CORE_SCHEMA_V1_TABLES の CONDITION.CASE のみ参照（重量計算用）
var CONDITION_CASE = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'].values.CONDITION.CASE;
// L104: condition 値をシートから素通り（バリデーションなし）
var condition = String(row[col.condition] != null ? row[col.condition] : '');
// L109–128: condition 値をそのまま rows に push
rows.push({
  condition: condition, // L113: 無検証のままフロントへ返す
  // ...
});
```

**【事実】コードは Condition 列の値をバリデーションせず素通りさせる。許可値リストとの照合処理は存在しない。**

---

## 3. CONFIG に在庫状態マスタが登録されているか

### grep コマンドと結果

```bash
grep -rn "SHEETS" src/08_Config.js
```

**CONFIG.SHEETS 全定義**（`src/08_Config.js:61–117`）:

```javascript
const CONFIG = {
  SHEETS: {
    SETTINGS: '選択肢マスタ',
    PERMISSIONS: '権限設定',
    GOALS: '目標設定',
    TEMPLATES: 'テンプレート',
    WEEKLY_REPORT: '週次レポート',
    MONTHLY_REPORT: '月次レポート',
    SHIFT: 'シフト',
    BUDDY_LOG: 'Buddy対話ログ',
    CONVERSATION_LOG: '会話ログ',
    TERM_DICTIONARY: '専門用語辞書',
    NOTICES: 'お知らせ',
    READ_STATUS: '既読管理',
    FAQ: 'FAQ',
    QUOTES: '見積書管理', QUOTE_ITEMS: '見積書明細',
    INVOICES: '請求書管理', INVOICE_ITEMS: '請求書明細',
    INVOICE_INPUT: '📝請求書作成', INVOICE_TEMPLATE: 'フォーマット',
    SALES_DATA: '📊売上データ',
    CUSTOMER_MASTER: 'M_Customer',
    PRODUCT_MASTER_SYNC: 'M_Product同期',
    STOCK_LIST_SYNC: 'Stock List同期',
    ZONES_SYNC: 'M_Zones同期',
    FEDEX_RATES_SYNC: 'FedEx_ShippingRates同期',
    DHL_RATES_SYNC: 'DHL_ShippingRates同期',
    UPS_RATES_SYNC: 'UPS_ShippingRates同期',
    SALES_DATA_SYNC: '📊売上データ同期',
    SCM_STOCK_SYNC: '集計同期',
    SCM_SUPPLIER_MASTER_SYNC: '仕入元マスタ同期',
    // CoreSchema V1 経由（lazy getter）:
    // LEADS → リード管理 / STAFF → 担当者マスタ / ORDERS → オーダー管理
    // CUSTOMERS → 顧客マスタ / SHIPMENTS → 発送 / PURCHASES → 仕入れ など
  }
};
```

在庫状態（Condition）のマスタシートに相当するキーは **一切含まれていない**。

**【事実】CONFIG.SHEETS に在庫状態マスタシートは登録されていない。**

---

## 4. 4つの未定義値の在処

### grep 結果（全文）

```bash
grep -rn "Searched pack\|Unsearched pack\|Damaged case\|FLAG_SINGLE" src/
# → 出力なし（0件）
```

**【事実】`Searched pack` / `Unsearched pack` / `Damaged case` / `FLAG_SINGLE` の4値は `src/` 配下のいかなるファイルにも存在しない。**

これらの値は：
- コードの enum（CoreSchemaRegistry）に **定義されていない**
- 在庫状態マスタシートに **定義されていない**（マスタシート自体が存在しない）
- 実際の「共用在庫」シートの Condition 列に存在するデータ値と推測される

**【推測】** これらの値は SCM（tcg-inventory-parser 等）が共用在庫シートに書き込んだ生データ値であり、CRM 側の CONDITION 許可値定義と乖離が生じている。  
（根拠: `docs/SHARED_INVENTORY_SCHEMA.md` に「tcg-inventory-parser が共用在庫シートに書き込む」旨の記載がある。生データ値の確認は PO のシート実閲覧が必要）

---

## 5. 判定

| 判定条件 | 結果 |
|---------|------|
| マスタシート実在 かつ CONFIG 未登録 | ✗ |
| マスタシート実在 かつ CONFIG 登録済 かつ コード未読み込み | ✗ |
| **マスタシート不在** | **✓** |

### 【確定】パターンB — マスタシート不在。定義はコード内固定リストのみ。

**詳細**:
- 在庫状態（Condition）の許可値は `src/00_CoreSchemaRegistry.js:204–210` にハードコード（4種）
- 許可値をシートから動的に読み込む実装は存在しない
- 4つの未定義値（`Searched pack` / `Unsearched pack` / `Damaged case` / `FLAG_SINGLE`）はコードのどこにも定義されていない
- バリデーション処理も存在しないため、未定義値はそのままフロントエンドに返される

---

## 6. 【未確認】事項

| # | 内容 | 確認方法 |
|---|------|---------|
| 1 | 4つの未定義値が実際に「共用在庫」シートの Condition 列に存在するか | PO がスプレッドシートで Condition 列を目視確認 |
| 2 | これらの値は tcg-inventory-parser が書き込んでいるか、手動入力か | tcg-inventory-parser のコードまたは PO に確認 |

---

## 7. 修正方針（PO 判断待ち）

修正は本レポートを受けた PO 判断後に別途指示する。  
候補として以下の2方向が考えられるが、**本報告書では提案しない**。

- A: コード側の enum に4値を追加する
- B: tcg-inventory-parser 側で使用する Condition 値を既存 enum に揃える

---

*調査実施: 読み取り専用（src/ への変更なし、clasp push なし、git push なし）*
