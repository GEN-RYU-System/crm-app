# 共用在庫スキーマ設計

> **ステータス**: 設計中（未実施）  
> **作成日**: 2026-08-18  
> **対象リポジトリ**: crm-app / tcg-inventory-parser（同時変更が必要）

---

## 1. シート名の変更

| 変更前 | 変更後 |
|--------|--------|
| 集計同期 | 共用在庫 |
| 商品マスタ同期 | 商品マスタ_共用在庫 |

変更は crm-app と tcg-inventory-parser の**両リポジトリで同時に**行う。
片方だけ変更すると IMPORTRANGE が切れる。

---

## 2. 削除対象列の確定根拠

### 実測突き合わせ

集計同期（現 20列）と商品マスタ同期（現 24列）の列名を照合した結果。

| 集計同期の列名 | 商品マスタ同期に存在するか | 判定 |
|---|---|---|
| Category | **あり**（col 2） | 注記参照 |
| Series | なし | **残す** |
| Quantity | なし | **残す** |
| Unit Price | なし | **残す** |
| Condition | なし | **残す** |
| Status | なし | **残す** |
| Note_JA | なし | **残す** |
| Note_EN | なし | **残す** |
| 提供者 | なし | **残す** |
| 採用理由 | なし | **残す** |
| product_id | **あり**（col 1） | JOIN キーのため **残す** |
| Mark | **あり**（col 3） | **削除** |
| Japanese Title | **あり**（col 4） | **削除** |
| English Title | **あり**（col 5） | **削除** |
| Boxes per Case | **あり**（col 6） | **削除** |
| Packs per Box | **あり**（col 7） | **削除** |
| Box重量 | **あり**（col 9） | **削除** |
| Case重量 | **あり**（col 10） | **削除** |
| Release Date | **あり**（col 11） | **削除** |
| 除外理由 | なし | **残す** |

> **Category の扱い**: 商品マスタ同期 col 2 にも存在するが、  
> 集計同期の Category は SCM（在庫管理システム）側が書き込む在庫分類であり、  
> 商品マスタの Category（商品属性）とは用途が異なる可能性がある。  
> 今回は**残す**（変更後の実運用で値の一致を確認してから判断する）。

### 削除列一覧（8列確定）

Mark / Japanese Title / English Title / Boxes per Case / Packs per Box / Box重量 / Case重量 / Release Date

---

## 3. 共用在庫（変更後）列構成

20列 → **12列**

| # | 列名 | 役割 |
|---|------|------|
| 1 | Category | SCM側が書き込む在庫分類（商品マスタの Category と同一か要確認） |
| 2 | Series | シリーズ名（在庫単位での管理名） |
| 3 | Quantity | 在庫数量 |
| 4 | Unit Price | 単価 |
| 5 | Condition | コンディション（新品/中古など） |
| 6 | Status | 販売可否ステータス |
| 7 | Note_JA | 日本語備考 |
| 8 | Note_EN | 英語備考 |
| 9 | 提供者 | この在庫を提供する仕入元・供給元 |
| 10 | 採用理由 | 仕入れ判断理由のメモ |
| 11 | product_id | 商品マスタ_共用在庫との JOIN キー |
| 12 | 除外理由 | 在庫から除外した場合の理由メモ |

Mark / Japanese Title / English Title / Boxes per Case / Packs per Box / Box重量 / Case重量 / Release Date は  
`product_id` で商品マスタ_共用在庫を引けば取得できるため削除する。

---

## 4. 商品マスタ_共用在庫（変更後）列構成

24列をそのまま維持。

| # | 列名 | 役割 |
|---|------|------|
| 1 | product_id | 商品マスタの一意キー（JOIN キー） |
| 2 | Category | 商品カテゴリ（属性） |
| 3 | Mark | 商品マーク・ブランド識別子 |
| 4 | Japanese Title | 商品名（日本語） |
| 5 | English Title | 商品名（英語） |
| 6 | Boxes per Case | 1ケースあたりのボックス数 |
| 7 | Packs per Box | 1ボックスあたりのパック数 |
| 8 | VOLUME WEIGHT | 体積重量 |
| 9 | Box重量 | 1ボックスの重量 |
| 10 | Case重量 | 1ケースの重量 |
| 11 | Release Date | 発売日 |
| 12 | Search Keywords | 商品検索用キーワード |
| 13 | Exclude Keywords | 検索除外キーワード |
| 14 | Related Series | 関連シリーズ |
| 15 | カテゴリ分類 | 内部カテゴリ分類コード |
| 16 | REQUIRED_OUTPUT_VALUE | 出力必須値フラグ |
| 17 | MOQ | 最低発注数量（Minimum Order Quantity） |
| 18 | 品目 | 通関・HSコード申告用の品目名 |
| 19 | HSコード | 輸出入申告用 HS コード |
| 20 | 素材 | 商品素材（通関申告用） |
| 21 | 大分類ID | 商品大分類の識別子 |
| 22 | 作品ID | 作品・IP の識別子 |
| 23 | メーカーID | メーカーの識別子 |
| 24 | product_category_ID | 商品カテゴリの識別子 |

---

## 5. 自社在庫との関係

- 共用在庫（共有 SCM から同期）と自社在庫（自社保有品）は**別マスタ**で管理する
- 自社在庫は自社専用の商品マスタを別途持つ
- 在庫登録・受注時の商品選択 UI では、以下の**両方を統合検索**できる仕様とする
  - 商品マスタ_共用在庫（共用在庫の商品）
  - 自社在庫商品マスタ（自社在庫の商品）
- 検索結果には在庫源泉（共用 / 自社）を明示して区別する

---

## 6. tcg-inventory-parser への申し送り

以下の変更を **crm-app と tcg-inventory-parser の両リポジトリで同時に**行う必要がある。  
片方だけ先行すると IMPORTRANGE が切断される。

### 書き込み先シート名の変更

| 変更前 | 変更後 |
|--------|--------|
| `集計同期` | `共用在庫` |
| `商品マスタ同期` | `商品マスタ_共用在庫` |

### 集計同期（→ 共用在庫）から削除する列

tcg-inventory-parser がこれらの列に書き込んでいる場合、書き込み処理を削除する。

| 列名 |
|------|
| Mark |
| Japanese Title |
| English Title |
| Boxes per Case |
| Packs per Box |
| Box重量 |
| Case重量 |
| Release Date |

### 対応手順（推奨）

1. 両リポジトリで変更ブランチを同時に作成
2. tcg-inventory-parser 側: 書き込み先シート名変更 + 上記8列への書き込み削除
3. crm-app 側: シート参照名変更（`CONFIG.SHEETS.SCM_STOCK_SYNC` 等）
4. 動作確認環境でシート名変更を実施
5. 両 PR を同日マージ
