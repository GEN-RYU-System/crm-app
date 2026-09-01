# 選択肢マスタ 再設計 事前調査レポート

## 1. 調査概要

| 項目 | 内容 |
|------|------|
| 調査日 | 2026-09-01 |
| 前提ドキュメント | `docs/option-master-audit.md`（2026-08-31） |
| 調査範囲 | (A) Registry全MASTERテーブルの列挙値管理パターン、(B) 選択肢マスタ36列の現状継承 |
| 書き込み系操作 | なし（事実収集のみ） |
| 設計案・DDL | **含まない**（設計フェーズで別途作成） |

---

## 2. Registry における列挙値管理の2方式

### 2.1 方式A — Registry.values にハードコード

`CORE_SCHEMA_V1_TABLES[tableKey].values` に列挙値を直接記述している列。
シートを参照しない。フロントエンド・GAS の両方でインポート可能。

| テーブル | フィールド | 値数 | 値（日本語） |
|---------|-----------|------|------------|
| ORDERS | STATUS | 7 | 支払い待ち/仕入れ中/発送待ち/完了/トラブル/キャンセル/不明 |
| ORDERS | PAYMENT_STATUS | 6 | 未入金/一部入金/入金済み/遅延/保留/キャンセル |
| ORDERS | PAYMENT_CONFIRMATION_SOURCE | 2 | 手動/PayPal自動 |
| ORDERS | PAYMENT_METHOD | 2 | Wise/PayPal |
| QUOTES | STATUS | 3 | 下書き/発行済み/期限切れ |
| STAFF | ROLE | 5 | オーナー/システム管理者/リーダー/営業/CS |
| STAFF | STATUS | 2 | 有効/無効 |
| LOGIN_SESSIONS | STATUS | 3 | 有効/期限切れ/失効 |
| SHARED_INVENTORY | CONDITION | 8 | Sealed box/Damaged sealed box/Case/No shrink box/Searched pack/FLAG_SINGLE/Damaged case/Unsearched pack |
| PACKAGES | UNIT | 3 | ケース/ボックス/パック |
| CONDITIONS | UNIT | 4 | ケース/ボックス/パック/対象外 |
| CONDITIONS | ORIGIN | 2 | SHARED/OWN |
| PURCHASES | STATUS | 3 | 確定済み/未発注/発注済み/支払済み |
| SHIPPING_FEE_ESTIMATES | CALC_SOURCE | 2 | API/MASTER |
| SHIPPING_FEE_ESTIMATES | FEE_TYPE | 2 | ESTIMATE/ACTUAL |

**合計: 15フィールド**

ハードコード方式の特徴:
- 変更にはコードデプロイが必要
- 型安全（定数参照で利用可）
- シート参照のオーバーヘッドなし

### 2.2 方式B — スプレッドシートシートで管理

シートから `indexOf` で列を特定して値を読む方式。

| シート | 管理用途 |
|--------|---------|
| 選択肢マスタ（CONFIG.SHEETS.SETTINGS） | フォーム向けプルダウン36列 |
| 国マスタ（CORE_SCHEMA: COUNTRIES） | 国コード・表示名・電話番号等 |
| 通貨マスタ（CORE_SCHEMA: CURRENCIES） | 通貨コード・記号・円換算レート |
| 流入元マスタ（CORE_SCHEMA: LEAD_SOURCES） | 流入経路のID・名称・IN/OUT区分 |

---

## 3. Registry MASTERテーブルの分類（列構成）

### 3.1 単純な選択肢（ID + 名前 + 有効 + 日付のみ）

以下のテーブルは実質「IDと名前の対応表」であり、選択肢として扱える。

| テーブルキー | シート名 | 列数 | 列構成 |
|------------|---------|------|--------|
| ITEMS | 品目マスタ | 6 | item_id, name_en, name_ja, active, registered_at, updated_at |
| MATERIALS | 素材マスタ | 6 | material_id, name_en, name_ja, active, registered_at, updated_at |
| OWN_CATEGORIES | 自社大分類マスタ | 6 | own_category_id, name_en, name_ja, active, registered_at, updated_at |
| OWN_WORKS | 自社作品マスタ | 6 | own_work_id, name_en, name_ja, active, registered_at, updated_at |
| OWN_MANUFACTURERS | 自社メーカーマスタ | 6 | own_manufacturer_id, name_en, name_ja, active, registered_at, updated_at |

### 3.2 属性付きマスタ（固有属性あり）

以下のテーブルは名前以外の固有属性を持ち、単純な選択肢とは異なる構造。

| テーブルキー | シート名 | 列数 | 固有属性（IDと名前以外） |
|------------|---------|------|----------------------|
| COUNTRIES | 国マスタ | 8 | 国番号, トランク0除去, 州必須, 郵便番号必須 |
| CURRENCIES | 通貨マスタ | 5 | 記号（symbol）, 円換算レート（rate_to_jpy） |
| LEAD_SOURCES | 流入元マスタ | 6 | is_inbound, is_outbound, display_order |
| SIZES | サイズマスタ | 8 | 長さ, 幅, 高さ（寸法3属性） |
| WEIGHTS | 重量マスタ | 6 | 重量（数値） |
| PACKAGES | 荷姿マスタ | 9 | unit, quantity, size_id（FK）, weight_id（FK） |
| CARRIERS | 配送会社マスタ | 16 | 容積重量除数, 端数単位, 寸法端数処理, 重量刻み, 最大重量, API設定3列 |
| ZONES | 地帯マスタ | 7 | carrier_id（FK）, country_code（FK）, zone |
| SHIPPING_RATES | 送料表マスタ | 9 | carrier_id（FK）, zone, min_weight, max_weight, rate |
| CONDITIONS | コンディションマスタ | 9 | condition_value（英語値）, unit, origin, shipping_target |
| OWN_PRODUCTS | 自社商品マスタ | 11 | shared_product_id（FK）, own_category_id（FK）, own_work_id（FK）, own_manufacturer_id（FK）, memo |
| PRODUCT_PACKAGES | 商品荷姿マスタ | 12 | 複数FK（PRODUCTS, OWN_PRODUCTS, PACKAGES×3, ITEMS, HTS_CODES, MATERIALS） |

### 3.3 その他マスタ（構造的に特殊）

| テーブルキー | sheetType | 理由 |
|------------|-----------|------|
| STAFF | MASTER | ログイン認証情報（password_hash等）を含む。選択肢としては非使用 |
| SETTINGS | MASTER | 縦持ちKey-Value（key/value/type/description/updated_at）。システム設定専用 |
| DISPLAY_SETTINGS | MASTER | 縦持ちKey-Value（key/value/target_screen/staff_id）。表示設定専用 |
| ISSUER | MASTER | 発行元会社情報（18列）。選択肢としては非使用 |
| PRODUCTS | SYNC_MASTER | 読み取り専用の商品マスタ同期（writeAllowed: false） |
| SHARED_INVENTORY | SYNC_MASTER | 読み取り専用の共用在庫同期（writeAllowed: false） |

---

## 4. 選択肢マスタ（CONFIG.SHEETS.SETTINGS = '選択肢マスタ'）の現状

### 4.1 シート基本情報

| 項目 | 値（2026-08-31実測） |
|------|-------------------|
| シート名 | 選択肢マスタ |
| 行数 | 45行（ヘッダー含む） |
| 列数 | 36列 |
| データ行数 | 44行（ヘッダー除く） |

**注意**: `CORE_SCHEMA_V1_TABLES.SETTINGS`（システム設定）とは別シート。
`CONFIG.SHEETS.SETTINGS = '選択肢マスタ'` が旧来の選択肢管理シートを指す。

### 4.2 ヘッダー名の状態（English vs Japanese）

選択肢マスタのシートヘッダーは英語スネークケースに変換済み。
以下の関数はすべて英語キーでアクセスしている:

| 関数名 | ファイル | 読むキー |
|--------|---------|---------|
| `getLeadFormOptions()` | `28_CoreLeadFormOptionsApi.js:41-42` | `'lead_type'`, `'response_speed'` |
| `getArchiveReasons()` | `27_WebApp.js:1484` | `'archive_reason'` |

`option-master-audit.md`（2026-08-31作成）の §3.1 では `indexOf('リード種別')` / `indexOf('返信速度')` と記載されているが、
これは作成時点のコードを参照したもので、**現在のコードは英語キーを使用している**（上記参照）。
シートヘッダーが実際に英語に変換済みかどうかは GAS実行で確認が必要。

### 4.3 生きている3列（分類A/B）の詳細

#### col 1: lead_type（旧ヘッダー名: リード種別）

| 項目 | 内容 |
|------|------|
| 分類 | **A**（React新path実動） |
| 読む関数 | `getLeadFormOptions()` |
| 呼び出し元 | `frontend/src/gas/client.ts` → `getLeadFormOptions()` |
| 値数（シート実測） | 2 |
| DEFAULT値 | `CONFIG.LEAD_TYPES = { INBOUND: 'インバウンド', OUTBOUND: 'アウトバウンド' }`（コード定数） |
| シート実測値 | 未確認（DEFAULT2値と同じと推測されるが要GAS確認） |
| キャッシュ | `LEAD_FORM_OPTIONS_CACHE_*`（TTL: 600秒） |

#### col 8: response_speed（旧ヘッダー名: 返信速度）

| 項目 | 内容 |
|------|------|
| 分類 | **A**（React新path実動） |
| 読む関数 | `getLeadFormOptions()` |
| 呼び出し元 | `frontend/src/gas/client.ts` → `getLeadFormOptions()` |
| 値数（シート実測） | **5**（DEFAULTより1多い） |
| DEFAULT値（4値） | '24h以内', '48h以内', '3日以上', '未返信' |
| シート実測値（5値） | DEFAULT4値 + 未確認の1値（要GAS確認） |

#### col 6: archive_reason（旧ヘッダー名: アーカイブ理由）

| 項目 | 内容 |
|------|------|
| 分類 | **B**（旧SPA実動） |
| 読む関数 | `getArchiveReasons()`（`27_WebApp.js:1474`） |
| 呼び出し元 | `src/index.html:15548`（旧SPA、`google.script.run.getArchiveReasons()` 直接呼び出し） |
| 値数（シート実測） | **5**（DEFAULTより1多い） |
| DEFAULT値（4値） | '連絡不通', '対象外', '重複', 'その他' |
| シート実測値（5値） | DEFAULT4値 + 未確認の1値（要GAS確認） |

---

## 5. 区分C（16列）の再確認

到達しない理由は3種類。それぞれの再設計フェーズでの取り扱い可能性を追記する。

### 5.1 DROPDOWN_OPTIONS未定義バグ経由（9列）

`27_WebApp.js:251` の `case 'getDropdownOptions': result = DROPDOWN_OPTIONS;`
`DROPDOWN_OPTIONS` は未定義変数のため `undefined` を返す。旧SPAのdropdown取得は機能していない。

| col | ヘッダー | 値数 | DEFAULT値数 | 備考 |
|-----|---------|------|------------|------|
| 4 | 流入経路（IN） | 5 | 0（DEFAULT空） | LEAD_SOURCESマスタと重複管理 |
| 5 | 流入経路（OUT） | 2 | 0（DEFAULT空） | LEAD_SOURCESマスタと重複管理 |
| 7 | リードステータス | 10 | 10（DEFAULT同値想定） | LEADS.LEAD_STATUS フィールドに対応 |
| 9 | 連絡手段 | 7 | 7 | LEADS.CONTACT_METHOD フィールドに対応 |
| 11 | 温度感 | 3 | 3 | LEADS.TEMPERATURE フィールドに対応 |
| 12 | 想定規模 | 4 | 4 | LEADS.EXPECTED_SCALE フィールドに対応 |
| 15 | 顧客タイプ | 3 | 3（キー名不一致あり: 信頼重視/価格重視）| LEADS.CUSTOMER_TYPE フィールドに対応 |
| 17 | 競合比較中 | 3 | 3 | LEADS.COMPETITOR_COMPARISON フィールドに対応 |
| 28 | 次回アクション日 | 7 | 6（DEFAULT+1） | LEADS.NEXT_ACTION_DATE フィールドに対応 |

再設計の可能性: 9列のうち多くはLEADSのフィールドに対応。新Reactパスで選択肢を提供する場合は `getLeadFormOptions()` 拡張が最短経路。

### 5.2 getDealReportDropdownOptions が dispatch未登録（4列）

`13_DealReportService.js` の `getDealReportDropdownOptions()` が選択肢を読むが、
`27_WebApp.js` の switch文に登録されていない（dead service）。

| col | ヘッダー | 値数 | 備考 |
|-----|---------|------|------|
| 10 | 取り扱い商材 | 6 | キー名不一致（コードは '取り扱いタイトル'） |
| 14 | 商談結果 | 5 | DEFAULT=4値（+1差異） |
| 16 | 販売形態 | 6 | キー名不一致（コードは '販売先'） |
| 21 | 購入頻度(月次) | 6 | 商談関連フィールド |

再設計の可能性: 商談レポート機能を実装する際に必要。現時点では dead code扱い。

### 5.3 シート初期化用 setup関数のみ（3列）

画面には出ず、管理シート初期化時（`setDataValidations()` / `initializeGoalsSheet()`）にのみ使われる。

| col | ヘッダー | 値数 | 参照箇所 | 備考 |
|-----|---------|------|---------|------|
| 18 | 役割 | 5 | `23_SheetService.js:529` | 担当者マスタシートの入力規則設定。Registry.values.STAFF.ROLE と同値 |
| 19 | ステータス | 2 | `23_SheetService.js:530` | 担当者マスタシートの入力規則設定。Registry.values.STAFF.STATUS と同値 |
| 22 | 見込度 | 5 | `21_SetupDealReport.js:56` | 商談レポートシート列追加対象として列挙。現在シートは未作成 |

**重要**: col 18（役割）と col 19（ステータス）の値は、Registry.values.STAFF.ROLE / STAFF.STATUS と実質同一。
SSOT観点では Registry.values が正本であり、選択肢マスタの当該2列は冗長。

---

## 6. 区分D（16列）の再確認

参照コードが0件の列。

| col | ヘッダー | 値数 | 備考 |
|-----|---------|------|------|
| 2 | リードID | 2 | 用途不明（ID形式例の可能性） |
| 3 | 流入経路 | 8 | LEADSOURCESマスタで管理。選択肢sourceとして未使用 |
| 13 | 商談ステータス | 4 | コード参照なし |
| 20 | カテゴリ | 5 | 文脈不明（MESSAGE_TEMPLATES等と同名だが未接続） |
| 23 | 支払い方法 | 2 | QUOTESフィールドと同名。フロントはfree-text |
| 24 | 発送方法 | 6 | ORDERSフィールドと同名。フロントはfree-text |
| 25 | 商品ステータス | 5 | 商品管理はCoreSchemaで管理 |
| 26 | 為替 | 5 | 通貨管理はCURRENCIESマスタで管理 |
| 27 | 為替レート | 5 | QUOTES/ORDERSの実レート値と混在 |
| 29 | ページ | 4 | MESSAGE_TEMPLATESフィールドと同名だが未接続 |
| 30 | リードシーン | 0 | 値ゼロ。用途不明 |
| 31 | 仕入元 | 44 | 44件の実データ蓄積。削除すると失われる |
| 32 | eLogiCSV格納フォルダ | 1 | 選択肢ではなくDriveフォルダURL（設定値） |
| 33 | ラベルPDF格納フォルダ | 1 | 同上 |
| 35 | 支払サイト | 5 | 即日/2日後/7日後/14日後/30日後。ORDERS.PAYMENT_TERMSと対応するがfree-text入力 |
| 36 | キャンセル理由 | 7 | ORDERS.CANCELLATION_REASONと対応するがfree-text入力 |

---

## 7. 区分E（1列）

| col | ヘッダー | 値数 | 備考 |
|-----|---------|------|------|
| 34 | FAQ_カテゴリ | 5 | `35_FAQService.js:362` `getFAQCategories()` が読むが、dispatch未登録・dead code |

---

## 8. 再設計フェーズへの事実継承

### 8.1 確認が必要な未解決事項

| # | 項目 | 確認方法 |
|---|------|---------|
| 1 | 返信速度の5値目（DEFAULT=4値との差1値）の実値 | `clasp run getOptionMasterFullDump`（DEV） |
| 2 | アーカイブ理由の5値目（同上）の実値 | 同上 |
| 3 | リード種別の実値（DEFAULT=インバウンド/アウトバウンドとの一致確認） | 同上 |
| 4 | 選択肢マスタのヘッダーが英語スネークケースに実際に変換済みか | `clasp run getOptionMasterFullDump`（DEV）でヘッダー列確認 |

### 8.2 再設計で引き継ぐ制約事項

| 項目 | 制約 |
|------|------|
| アーカイブ理由（col 6） | 旧SPA（index.html）から直接呼ばれている。新方式移行まで `getArchiveReasons()` と `archive_reason` キーの維持が必要 |
| リード種別・返信速度（col 1, 8） | `getLeadFormOptions()` のキャッシュ（TTL 600秒）がある。変更後はキャッシュ無効化が必要 |
| 役割・ステータス（col 18, 19） | `setDataValidations()` がシートのdropdown入力規則に使用。削除するとスプレッドシート直接編集時のプルダウンが消える |
| 仕入元（col 31、44件） | 44件のデータが蓄積されている。削除するとデータが失われる |
| eLogiCSV/ラベルPDF格納フォルダ（col 32, 33） | 選択肢ではなく設定値（Drive URL）。削除ではなくシステム設定シートへの移動が適切 |

### 8.3 Registry.values との重複（再設計で解消可能な冗長）

以下の選択肢マスタ列は、Registry.values に既にハードコードされた同一値があり、SSOT上は冗長。

| 選択肢マスタ列 | Registry.values のSSO正本 |
|--------------|-------------------------|
| 役割（col 18） | `STAFF.ROLE` = { OWNER: 'オーナー', SYSTEM_ADMIN: 'システム管理者', LEADER: 'リーダー', SALES: '営業', CS: 'CS' } |
| ステータス（col 19） | `STAFF.STATUS` = { ACTIVE: '有効', INACTIVE: '無効' } |

---

## 9. 調査済みファイル一覧

| ファイル | 調査内容 |
|---------|---------|
| `docs/option-master-audit.md` | 前段の36列調査（本ドキュメントの基盤） |
| `src/00_CoreSchemaRegistry.js` | Registry全テーブル定義（sheetType, headers, values） |
| `src/08_Config.js` | CONFIG.SHEETS.SETTINGS, DEFAULT_DROPDOWN_OPTIONS, DROPDOWN_COLUMNS, CONFIG.LEAD_TYPES |
| `src/28_CoreLeadFormOptionsApi.js` | getLeadFormOptions()（lead_type/response_speedキー確認） |
| `src/27_WebApp.js` | getArchiveReasons()（archive_reasonキー確認） |
