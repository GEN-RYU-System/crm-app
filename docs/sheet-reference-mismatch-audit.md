# シート参照ミスマッチ 監査レポート

> 作成日: 2026-08-30  
> 調査対象: `docs/sheet-headers-snapshot.md` B分類（コードが参照するが実在しないシート）全38件  
> 調査方法: コード静的解析 + 44フロントエンド関数の呼び出しチェーン追跡 + ヘッダー比較（previous session 実測値）

---

## ⚠ 停止条件発動

**新方式 × 完全不在 が 1 件検出されました。Phase 3（コード修正）には進まず、PO 判断を待ちます。**

| 項目 | 詳細 |
|-----|------|
| CONFIG.SHEETS キー | `PERMISSIONS` |
| コード上のシート名 | `'権限設定'` （src/08_Config.js:66） |
| スプレッドシート上の実在シート | `'権限管理'`（GID: 130039144）※別目的の別シート |
| ヘッダー一致（旧コード期待 vs '権限管理'） | **1 / 17**（一致は `'役割名'` のみ。残 16 列は日本語メニュー制御列） |
| 現在の動作 | `getSheetByName('権限設定')` → null → `DEFAULT_ROLES` フォールバック |
| 影響範囲 | **44 関数すべて**（`checkPermission()` → `getPermissionsByRole()` → `CONFIG.SHEETS.PERMISSIONS`） |
| 停止理由 | 意図した英語権限キースキーマのシート（`権限設定`）が存在しない。`権限管理`は目的・列構造が異なる別シート。シート作成または設計確認が必要 → PO 判断必須 |

---

## 1. 全 38 件 分類表

凡例:
- **新方式**: 44 フロントエンド関数の呼び出しチェーンに含まれる
- **旧方式**: 44 関数チェーンから到達不能（旧バックエンド専用関数、初期化関数、外部スクリプト等）
- **完全不在**: 対応するシートが存在しない（名前を変えても見つからない）
- **名前不一致**: 異なる名前のシートが実在する
- **修正可否**: 「新方式 × 名前不一致」のみ修正対象。旧方式は記録のみ

### 1-1. 静的 CONFIG.SHEETS（src/08_Config.js 定義、24 件）

| # | コード上シート名 | CONFIG.SHEETSキー | 参照元ファイル:行 | 新/旧 | 判定 | 対応実在シート | ヘッダー一致 | 修正可否 |
|---|----------------|------------------|-----------------|-------|------|--------------|------------|---------|
| 1 | `権限設定` | `PERMISSIONS` | src/27_WebApp.js:2703 | **新** | **完全不在** ⚠ | `権限管理`（別目的） | 1/17 | **STOP** |
| 2 | `会話ログ` | `CONVERSATION_LOG` | src/28_CoreInboxApi.js:344 | **新** | **名前不一致** | `会話ログ（商談用）` | 11/11 | 可（fallback実装済み） |
| 3 | `テンプレート` | `TEMPLATES` | src/22_SetupIntegratedSheet.js:1265 | 旧 | 完全不在 | なし | — | 対象外 |
| 4 | `週次レポート` | `WEEKLY_REPORT` | src/20_ReportService.js:17 | 旧 | 完全不在 | なし | — | 対象外 |
| 5 | `月次レポート` | `MONTHLY_REPORT` | src/20_ReportService.js:43 | 旧 | 完全不在 | なし | — | 対象外 |
| 6 | `Buddy対話ログ` | `BUDDY_LOG` | src/05_BuddyCoachingService.js:788 | 旧 | 完全不在 | なし | — | 対象外 |
| 7 | `専門用語辞書` | `TERM_DICTIONARY` | src/12_KnowledgeService.js:12 | 旧 | 完全不在 | なし | — | 対象外 |
| 8 | `お知らせ` | `NOTICES` | src/16_NoticeService.js:30 | 旧 | 完全不在 | なし | — | 対象外 |
| 9 | `既読管理` | `READ_STATUS` | src/16_NoticeService.js:96 | 旧 | 完全不在 | なし | — | 対象外 |
| 10 | `見積書管理` | `QUOTES` | src/27_WebApp.js:5002 | 旧 | 名前不一致 | `見積書管理_旧` | 未取得（旧方式） | 対象外 |
| 11 | `見積書明細` | `QUOTE_ITEMS` | src/11_Quote.js:41 | 旧 | 名前不一致 | `見積もり明細` | 未取得（旧方式） | 対象外 |
| 12 | `請求書管理` | `INVOICES` | src/27_WebApp.js:5113 | 旧 | 完全不在 | なし | — | 対象外 |
| 13 | `請求書明細` | `INVOICE_ITEMS` | src/01_Initialize.js:491 | 旧 | 完全不在 | なし | — | 対象外 |
| 14 | `📝請求書作成` | `INVOICE_INPUT` | src/08_Config.js:94 ※1 | 旧 | 名前不一致 | `請求書作成`（emoji なし） | 未取得（旧方式） | 対象外 |
| 15 | `フォーマット` | `INVOICE_TEMPLATE` | src/08_Config.js:95 ※1 | 旧 | 完全不在 | なし | — | 対象外 |
| 16 | `M_Customer` | `CUSTOMER_MASTER` | src/16_Customer.js:46 | 旧 | 名前不一致 | `顧客マスタ` | 未取得（旧方式） | 対象外 |
| 17 | `M_Product同期` | `PRODUCT_MASTER_SYNC` | src/01_Initialize.js:900 | 旧 | 名前不一致 | `商品マスタ同期` | 未取得（旧方式） | 対象外 |
| 18 | `Stock List同期` | `STOCK_LIST_SYNC` | src/14_StockSync.js:47 | 旧 | 完全不在 | なし | — | 対象外 |
| 19 | `M_Zones同期` | `ZONES_SYNC` | src/13_Shipping.js:126 | 旧 | 完全不在 | なし | — | 対象外 |
| 20 | `FedEx_ShippingRates同期` | `FEDEX_RATES_SYNC` | src/13_Shipping.js:168 | 旧 | 名前不一致 | `FedEx送料` | 未取得（旧方式） | 対象外 |
| 21 | `DHL_ShippingRates同期` | `DHL_RATES_SYNC` | src/13_Shipping.js:179 | 旧 | 名前不一致 | `DHL送料` | 未取得（旧方式） | 対象外 |
| 22 | `UPS_ShippingRates同期` | `UPS_RATES_SYNC` | src/13_Shipping.js:190 | 旧 | 名前不一致 | `UPS送料` | 未取得（旧方式） | 対象外 |
| 23 | `📊売上データ同期` | `SALES_DATA_SYNC` | src/08_Config.js:106 ※2 | 旧 | 完全不在 | なし | — | 対象外 |
| 24 | `仕入元マスタ同期` | `SCM_SUPPLIER_MASTER_SYNC` | src/01_Initialize.js:578 | 旧 | 完全不在 | なし | — | 対象外 |

※1: `INVOICE_INPUT` / `INVOICE_TEMPLATE` の実際の参照元は src/請求書発行.js が `ERP_CONFIG.SHEETS` 経由（GID ルックアップ）。CONFIG.SHEETS 側キーへの直接参照は定義のみで使用箇所が未確認。  
※2: `SALES_DATA_SYNC` の src 参照箇所は定義（src/08_Config.js:106）のみで使用箇所を確認できず。

### 1-2. 旧 ERP 系（ERP_CONFIG.SHEETS / 文字列リテラル、9 件）

ERP_CONFIG は src/Config.js で定義。`getSheetByConfig()` は GID → シート名 の順でルックアップするが、いずれの GID もこのスプレッドシートには存在しない。

| # | コード上シート名 | 参照元ファイル:行 | 新/旧 | 判定 | 対応実在シート | ヘッダー一致 | 修正可否 |
|---|----------------|-----------------|-------|------|--------------|------------|---------|
| 25 | `M_Zones` (ERP_CONFIG.SHEETS.ZONES) | src/見積もりページ.js:5 | 旧 | 完全不在 | なし | — | 対象外 |
| 26 | `FedEx_ShippingRates` (ERP_CONFIG.SHEETS.SHIPPING_FEDEX) | src/見積もりページ.js:19 | 旧 | 名前不一致 | `FedEx送料` | 未取得（旧方式） | 対象外 |
| 27 | `DHL_ShippingRates` (ERP_CONFIG.SHEETS.SHIPPING_DHL) | src/見積もりページ.js:20 | 旧 | 名前不一致 | `DHL送料` | 未取得（旧方式） | 対象外 |
| 28 | `UPS_ShippingRates` (ERP_CONFIG.SHEETS.SHIPPING_UPS) | src/見積もりページ.js:21 | 旧 | 名前不一致 | `UPS送料` | 未取得（旧方式） | 対象外 |
| 29 | `📋仕入れリスト` (ERP_CONFIG.SHEETS.PURCHASE_LIST) | src/仕入れ転記.js:72 | 旧 | 完全不在 | なし | — | 対象外 |
| 30 | `M_商品` (ERP_CONFIG.SHEETS.PRODUCT_MASTER) | src/仕入れ転記.js:96 | 旧 | 完全不在 | なし | — | 対象外 |
| 31 | `raw_顧客回答` (ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES) | src/CRM作成.js:16 | 旧 | 完全不在 | なし | — | 対象外 |
| 32 | `M_顧客` (ERP_CONFIG.SHEETS.CUSTOMER_MASTER) | src/CRM作成.js:17 | 旧 | 完全不在 | なし | — | 対象外 |
| 33 | `ImportLog`（文字列リテラル） | src/仕入れ転記.js:173 | 旧 | 完全不在 ※3 | なし | — | 対象外 |

※3: `ImportLog` は `|| ss.insertSheet('ImportLog')` の自動作成 fallback 付き。

### 1-3. Buddy / Dev 系（文字列リテラル、5 件）

| # | コード上シート名 | 参照元ファイル:行 | 新/旧 | 判定 | 備考 |
|---|----------------|-----------------|-------|------|------|
| 34 | `Buddy日替わりメッセージ` | src/05_BuddyCoachingService.js:1955 | 旧 | 完全不在 | insertSheet fallback 付き |
| 35 | `Buddy Feedback Log` | src/30_BuddyFeedbackLogger.js:90 | 旧 | 完全不在 | insertSheet fallback 付き |
| 36 | `BuddyKnowledge` | src/30_BuddyFeedbackLogger.js:16 | 旧 | 完全不在 | not found → Error throw |
| 37 | `🔍列定義検証結果` | src/write_verification_results.js:21 | 旧 | 完全不在 | insertSheet fallback 付き |
| 38 | `KPI管理・PDSサイクル` | src/28_AnalyticsEngine.js:179 | 旧 | 完全不在 | fallback なし（null 返却） |

---

## 2. 判定サマリー

| 分類 | 件数 | 対応方針 |
|-----|------|---------|
| 新方式 × 完全不在 | **1** | ⚠ **STOP — PO 判断** |
| 新方式 × 名前不一致（fallback実装済み） | **1** | 修正可。ただし緊急度低（CONVERSATION_LOG） |
| 旧方式 × 名前不一致 | 11 | 記録のみ（修正対象外） |
| 旧方式 × 完全不在 | 25 | 記録のみ（修正対象外） |
| **合計** | **38** | |

---

## 3. 新方式アイテム 詳細

### 3-1. PERMISSIONS — ⚠ STOP（新方式 × 完全不在）

**コール チェーン:**
```
44 関数すべて
  └→ checkPermission()               src/27_WebApp.js:2760
       └→ getCurrentUserWithPermissions()  src/27_WebApp.js:2732
            └→ getPermissionsByRole(role)  src/27_WebApp.js:2700
                 └→ ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS)
                                           src/27_WebApp.js:2703
                    ↓
                    null（シート '権限設定' が存在しない）
                    ↓
                    DEFAULT_ROLES[role] フォールバック  src/27_WebApp.js:2707
```

**期待されるシートスキーマ（src/08_Config.js:358-363）:**
```
役割名 | dashboard_view | dashboard_cs | dashboard_sales | dashboard_leader |
lead_view | lead_add | lead_edit | lead_delete | deal_view_all | deal_view_own |
deal_edit | team_stats | staff_manage | settings | admin_access | force_reset
→ 計 17 列（英語権限キー）
```

**実在する '権限管理' シートのヘッダー（sheet-headers-snapshot.md 実測）:**
```
役割名 | チャットメニュー表示 | 営業メニュー表示 | 設定メニュー表示 |
管理者メニュー表示 | Buddyメンテナンスメニュー表示 | サイドバー表示 | …
→ 計 24 列（日本語メニュー制御列）
```

**ヘッダー一致: 1 / 17**（`役割名` のみ一致）

**現状:** `DEFAULT_ROLES` ハードコードで動作しているため UI は機能するが、スプレッドシートの権限データを一切参照していない。`権限管理` シートへのメニュー表示制御データは別途 STAFF シートのアクセスで管理されているとみられる（未確認 [?]）。

**PO への確認事項:**
1. `権限設定`（英語権限キー形式）のシートを新規作成するか
2. または `DEFAULT_ROLES` 定数で運用を続けると正式に決定するか
3. `権限管理` シートが現行コードでどう活用されているかを確認するか

---

### 3-2. CONVERSATION_LOG — 新方式 × 名前不一致（fallback実装済み）

**コール チェーン（4 関数）:**
```
getInboxConversationsForFrontend     client.ts:925
getInboxConversationDetailForFrontend  client.ts:940
getInboxBulkInitialLoad              client.ts:965
getInboxMoreMessages                 client.ts:980
  └→ resolveConversationLogSheet_()  src/28_CoreInboxApi.js:343-347
       └→ getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG)  → '会話ログ' → null
          || getSheetByName('会話ログ（商談用）')           → ✅ シート取得成功
```

**実在シート `会話ログ（商談用）` ヘッダー一致: 11 / 11**（全列一致）

**現状:** `resolveConversationLogSheet_()` の fallback により 4 つの inbox 読み取り関数は正常動作している。ただし以下の書き込み関数は fallback なしで CONVERSATION_LOG を直接参照：
- `addConversationLogInternal()` — src/27_WebApp.js:4645（44 関数チェーン外）
- `updateConversationLogTranslation()` — src/27_WebApp.js:8008（44 関数チェーン外）

**修正方針（Phase 3 対象、STOP 解除後）:**
```diff
// src/08_Config.js:79
- CONVERSATION_LOG: '会話ログ',
+ CONVERSATION_LOG: '会話ログ（商談用）',
```
修正後は `resolveConversationLogSheet_()` のリテラル fallback（`'会話ログ（商談用）'`）が冗長になるが動作には影響しない。書き込み関数（44 関数外）も恩恵を受ける。

---

## 4. 停止時の記録

### 停止理由
`PERMISSIONS`（CONFIG.SHEETS.PERMISSIONS = '権限設定'）が **新方式 × 完全不在** に該当。  
この項目は全 44 フロントエンド関数の認証ガードに使われており、シートが実在しないため DEFAULT_ROLES フォールバックに依存している。シート作成要否の判断は PO が行う必要がある。

### 完了済み範囲
- [x] B 分類全 38 件の調査・分類
- [x] 本監査レポート（`docs/sheet-reference-mismatch-audit.md`）の作成
- [x] STOP 条件（新方式 × 完全不在 1 件）の特定と記録

### 未完了範囲（STOP により保留）
- [ ] Phase 3: CONVERSATION_LOG の名前修正（`'会話ログ'` → `'会話ログ（商談用）'`）
  - 対象ファイル: src/08_Config.js:79
  - 修正はコード 1 行のみ。STOP 解除後に即座に実施可能
- [ ] Phase 4: 後続検証（`clasp run getDeployedSha`, `runCoreSchemaConformanceAudit`, `dryRunOrderStatusRecalculation`）

### STOP 解除条件
PO から以下のいずれかの判断を受けた場合：
- A. 「`権限設定` シートを作成する」→ シート作成後、CONVERSATION_LOG 修正 PR を作成して Phase 3 再開
- B. 「DEFAULT_ROLES 運用を継続する（シート作成しない）」→ PERMISSIONS を 旧方式 × 完全不在 として記録、CONVERSATION_LOG 修正 PR のみ Phase 3 実施
