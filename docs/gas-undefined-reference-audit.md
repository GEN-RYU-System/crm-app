# GAS 未定義参照 実害確認 Audit

**調査日**: 2026-08-30  
**対象 SHA**: `96b030391d5a415bd3cfe972968e7cc9552e268e`  
**調査範囲**: `src/` 以下の `.js` ファイル全件  
**目的**: 未定義参照（`PRODUCTION_IDS` / `CONFIG.SHEETS.未定義キー`）が実際にユーザー操作でクラッシュするかを確認する

---

## 判定基準

| 観測事実 | 判定 |
|---------|------|
| ヌルチェックが参照より前に存在する | 実害なし |
| ヌルチェックなしで `.getRange()` 等を呼び出す | **実行時エラー確定** |
| フロント44関数から到達不可 | ユーザー操作での実害なし（手動実行時はエラー） |

---

## 1. PRODUCTION_IDS

### 1-1. 定義の有無

```
grep -rn "PRODUCTION_IDS\s*=\|var PRODUCTION_IDS\|const PRODUCTION_IDS\|let PRODUCTION_IDS" src/ --include="*.js"
```

**結果**: 0件 → **【確定】src/ 内に定義なし。参照されると必ず ReferenceError**

---

### 1-2. 参照箇所一覧（全17行）

```
grep -rn "PRODUCTION_IDS" src/ --include="*.js"
```

実行結果:
```
src/27_WebApp.js:7406
src/27_WebApp.js:7407
src/27_WebApp.js:7415
src/27_WebApp.js:7419
src/27_WebApp.js:7579
src/14_DevEnvironmentService.js:26
src/14_DevEnvironmentService.js:34
src/14_DevEnvironmentService.js:137
src/14_DevEnvironmentService.js:140
src/14_DevEnvironmentService.js:166
src/14_DevEnvironmentService.js:208
src/35_SalesDataSyncService.js:202
src/35_SalesDataSyncService.js:203
src/checkEnv.js:9
src/checkEnv.js:14
src/00_HeaderMappingHelper.js:219
src/22_SetupIntegratedSheet.js:129
```

---

### 1-3. 関数別詳細（読んだ行番号を明記）

#### src/27_WebApp.js — `writeQuoteToSheetAndGeneratePDF`

読んだ範囲: 7398–7447、7570–7600

```javascript
// L7398: 関数定義
function writeQuoteToSheetAndGeneratePDF(quoteData) {
  try {
    // ...
    // L7406: ← ここで ReferenceError 発生
    Logger.log('... QUOTE_CREATION_SHEET_GID: ' + PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID);
    // L7407
    Logger.log('... QUOTE_PDF_OUTPUT_SHEET_GID: ' + PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID);
    // L7415
    const quoteSheet = getSheetByGid(ss, PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID);
    // L7419
    const pdfSheet = getSheetByGid(ss, PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID);
    // L7579
    const sheetGid = PRODUCTION_IDS.QUOTE_PDF_OUTPUT_SHEET_GID;
```

- ヌルチェック: **なし**（try{} は ReferenceError を補足しエラーレスポンスを返す。PDF は生成されない）
- **呼び出し元（*.html 含む検索）**:
  ```
  grep -rn "writeQuoteToSheetAndGeneratePDF" src/ --include="*.html"
  → src/index.html:19030  (.writeQuoteToSheetAndGeneratePDF(quoteData))
  → src/index.html:19663  (.writeQuoteToSheetAndGeneratePDF(quoteData))
  ```
  `src/index.html` はレガシーページ（doGet `?page=legacy` で配信）から `google.script.run` 経由で呼ばれる。
- フロント44（React SPA）への到達: **なし**（client.ts に記述なし。doPost スイッチ文にも含まれない）
- **判定**: **レガシーページ経由で到達可能**。呼ばれると try-catch で `{ success: false, message: 'PRODUCTION_IDS is not defined' }` を返す。PDF は生成されない。現行 React アプリには影響なし。

---

#### src/14_DevEnvironmentService.js — 複数関数

読んだ範囲: 1–50、120–175、195–225

| 行 | 含む関数 | ヌルチェック | 詳細 |
|----|---------|-------------|------|
| 26 | `createDevelopmentEnvironment` | なし | `SpreadsheetApp.openById(PRODUCTION_IDS.SPREADSHEET_ID)` → ReferenceError |
| 34 | `createDevelopmentEnvironment` | なし | `DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID)` → ReferenceError |
| 137 | `checkProductionReadiness` | try{} 内 | L134 の try{} が ReferenceError をキャッチするかは【未確認】 |
| 140 | `checkProductionReadiness` | try{} 内 | 同上 |
| 166 | `cleanupOldDevEnvironments` | なし | `DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID)` → ReferenceError |
| 208 | `listDevEnvironments` | なし | `DriveApp.getFolderById(PRODUCTION_IDS.DEV_FOLDER_ID)` → ReferenceError |

- フロント44への到達: `grep -n "createDevelopmentEnvironment\|cleanupOldDevEnvironments\|listDevEnvironments\|checkProductionReadiness" frontend/src/gas/client.ts` → **0件**
- **判定**: 全関数フロント44外 → **ユーザー操作での実害なし**。手動実行するとReferenceError。

---

#### src/35_SalesDataSyncService.js — `writeInvoiceToSalesData`

読んだ範囲: 185–220

```javascript
// L194
function writeInvoiceToSalesData(pdfUrl) {
  try {
    // ...
    const ss = getSpreadsheet();
    // L202: ← ReferenceError 発生
    const invoiceSheet = getSheetByGid(ss, PRODUCTION_IDS.INVOICE_CREATION_SHEET_GID);
    // L203
    const salesDataSheet = getSheetByGid(ss, PRODUCTION_IDS.SALES_DATA_SHEET_GID);
    // L211: invoiceSheet のヌルチェック（PRODUCTION_IDS の ReferenceError で到達しない）
    if (!invoiceSheet) { ... return { success: false }; }
```

- ヌルチェック: **なし**（L202 で ReferenceError。try-catch でエラーレスポンスを返す）
- **呼び出し元（*.html 含む検索）**:
  ```
  grep -rn "writeInvoiceToSalesData" src/ --include="*.html"
  → src/index.html:20570  (.writeInvoiceToSalesData(pdfUrl))
  ```
  `src/index.html` はレガシーページ（doGet `?page=legacy`）から呼ばれる。
- フロント44（React SPA）への到達: **なし**（client.ts に記述なし）
- **判定**: **レガシーページ経由で到達可能**。呼ばれると try-catch で `{ success: false, error: 'PRODUCTION_IDS is not defined' }` を返す。現行 React アプリには影響なし。

---

#### src/00_HeaderMappingHelper.js — `testHeaderMapping`

読んだ範囲: 200–230

```javascript
// L211
function testHeaderMapping() {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();
    // L219: ← PRODUCTION_IDS に .QUOTE_CREATION_SHEET_GID でアクセス
    if (sheets[i].getSheetId() === PRODUCTION_IDS.QUOTE_CREATION_SHEET_GID) { ... }
```

- ヌルチェック: **なし**
- フロント44への到達: `grep -n "testHeaderMapping" frontend/src/gas/client.ts` → **0件**
- **判定**: 実行時エラー確定。テスト関数、フロント44外 → **ユーザー操作での実害なし**

---

#### src/22_SetupIntegratedSheet.js — `setupIntegratedLeadSheetForEnv`

読んだ範囲: 100–140

```javascript
// L116
function setupIntegratedLeadSheetForEnv() {
  // L117–120: 意図的に無効化されている
  throw new Error(
    'この関数は無効化されています。...'
  );
  // ↓ L129 以降は throw 後のデッドコード
  Logger.log('PRODUCTION_ID: ' + PRODUCTION_IDS.SPREADSHEET_ID);
```

- ヌルチェック: **L117 の throw new Error() でガード**（意図的な無効化）
- **判定**: L129 は実行不可（デッドコード） → **実害なし**

---

#### src/checkEnv.js — `checkCurrentEnvironment`

読んだ範囲: 1–16

```javascript
// L1
function checkCurrentEnvironment() {
  // ...
  Logger.log('PRODUCTION_SPREADSHEET_ID: ' + PRODUCTION_IDS.SPREADSHEET_ID); // L9 → ReferenceError
  return {
    prodSpreadsheetId: PRODUCTION_IDS.SPREADSHEET_ID // L14 → 到達しない
  };
}
```

- ヌルチェック: **なし**
- フロント44への到達: `grep -n "checkCurrentEnvironment" frontend/src/gas/client.ts` → **0件**
- **判定**: 実行時エラー確定（手動確認用関数） → **ユーザー操作での実害なし**

---

### 1-4. PRODUCTION_IDS 総括

| 項目 | 結果 |
|-----|------|
| 定義の有無 | **なし（全 src/ に 0件）** |
| 参照している関数数 | 8関数（`writeQuoteToSheetAndGeneratePDF`、`writeInvoiceToSalesData`、`createDevelopmentEnvironment`、`cleanupOldDevEnvironments`、`listDevEnvironments`、`checkProductionReadiness`、`testHeaderMapping`、`checkCurrentEnvironment`） |
| フロント44（React SPA）から到達できる関数 | **0件** |
| レガシーページ（`?page=legacy`）から到達できる関数 | **2件**（`writeQuoteToSheetAndGeneratePDF`（index.html:19030,19663）、`writeInvoiceToSalesData`（index.html:20570））。両関数とも try-catch でエラーレスポンスを返す。PDF・売上データ転記は機能しない |
| ヌルガードなしで直接アクセスしている箇所 | 多数（`setupIntegratedLeadSheetForEnv` のみ throw でガード） |
| 現行 React アプリへの実害 | **なし**（フロント44に含まれない） |
| レガシーページでの実害 | **あり**（PDF 生成・売上データ転記が機能しない）。try-catch によりプロセスはクラッシュしない |
| 手動実行時のリスク | **ReferenceError 確定**（`setupProject` / `testHeaderMapping` / 各 DevService 関数） |

---

## 2. CONFIG.SHEETS 未定義キー

### 2-1. 調査前提の補正

`docs/gas-sheet-reference-audit.md` に記載の 24件のうち、実際には以下の区分が必要。

**コメント行のみ（実行されないコード）**:
```
grep -n "CONFIG\.SHEETS\.LEADS_GID\|CONFIG\.SHEETS\.TERM_DICTIONARY_GID" src/ --include="*.js"
```
- `LEADS_GID` → src/00_DataHelpers.js:209 — JSDoc コメント（`* const leadsSheet =`）
- `TERM_DICTIONARY_GID` → src/00_DataHelpers.js:177 — JSDoc コメント（`* const sheet =`）
→ **実行コードではない。実害なし**

**ERP_CONFIG.SHEETS.* への参照（CONFIG.SHEETS.* ではない）**:
```
grep -rn "CONFIG\.SHEETS\.PRODUCT_MASTER\b\|CONFIG\.SHEETS\.RAW_FORM_RESPONSES\|CONFIG\.SHEETS\.SHIPPING_DHL\|CONFIG\.SHEETS\.SHIPPING_FEDEX\|CONFIG\.SHEETS\.SHIPPING_UPS\|CONFIG\.SHEETS\.VIEWER_SUPPLIER_STOCK\|CONFIG\.SHEETS\.ZONES\b" src/ --include="*.js"
```
- 結果: 全件が `ERP_CONFIG.SHEETS.*` への参照（ERP_CONFIG.SHEETS は定義済み）
- `CONFIG.SHEETS.PRODUCT_MASTER` / `RAW_FORM_RESPONSES` / `SHIPPING_*` / `VIEWER_SUPPLIER_STOCK` / `ZONES` は実際の実行コードで参照されていない
→ **実害なし**

---

### 2-2. 実コードで CONFIG.SHEETS.未定義キー を参照している 16 件

#### BUDDY_CONVERSATION_LOG

```
grep -rn "CONFIG\.SHEETS\.BUDDY_CONVERSATION_LOG" src/ --include="*.js"
```
読んだ行: src/01_Initialize.js:315–335

```javascript
function initializeBuddyConversationLogSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.BUDDY_CONVERSATION_LOG); // undefined
  if (!sheet) { // ← ヌルチェックあり
    sheet = ss.insertSheet(CONFIG.SHEETS.BUDDY_CONVERSATION_LOG); // insertSheet(undefined) — 【未確認: シート名"undefined"で作成されるか否か】
  }
```

- ヌルチェック: **あり**（.getRange 等の呼び出し前にガード）
- フロント44: 該当なし
- **判定**: 実害なし（動作は不正 — シート名が "undefined" になる可能性あり）

---

#### CONVERSATION_LOG_DEAL / CONVERSATION_LOG_LEAD

```
grep -rn "CONFIG\.SHEETS\.CONVERSATION_LOG" src/ --include="*.js"
```
読んだ行: src/09_ConversationArchiveService.js:358–385

```javascript
function deleteLogsFromSheet(ss, sheetName, leadId) {
  const sheet = ss.getSheetByName(sheetName); // getSheetByName(undefined) → null
  if (!sheet || sheet.getLastRow() < 2) return; // ← ヌルチェックあり
```

- ヌルチェック: **あり**
- フロント44: 該当なし
- **判定**: 実害なし

---

#### DEALS

```
grep -rn "CONFIG\.SHEETS\.DEALS" src/ --include="*.js"
```
読んだ行: src/03_AssignService.js:9–35

```javascript
function runAssignMigration() {
  // L15: LEADS_IN/LEADS_OUT が undefined なので常に true → early return
  if (sheetName !== CONFIG.SHEETS.LEADS_IN && sheetName !== CONFIG.SHEETS.LEADS_OUT) {
    ... return; // ← ここで必ずreturnする
  }
  // L27: 到達しない
  const dealsSheet = ss.getSheetByName(CONFIG.SHEETS.DEALS); // getSheetByName(undefined)
  if (!dealsSheet) { ... return; } // ← ヌルチェックあり（二重ガード）
```

- ヌルチェック: **あり**（LEADS_IN/OUT ガードで先に return + DEALS 自身のヌルチェック）
- フロント44: 該当なし
- **判定**: 実害なし（関数は常に早期 return で停止）

---

#### GLOSSARY

読んだ行: src/01_Initialize.js:363–385

`initializeBuddyConversationLogSheet` と同パターン。

- ヌルチェック: **あり**
- フロント44: 該当なし
- **判定**: 実害なし

---

#### LEADS_IN / LEADS_OUT

```
grep -rn "CONFIG\.SHEETS\.LEADS_IN\|CONFIG\.SHEETS\.LEADS_OUT" src/ --include="*.js"
```
読んだ行: src/26_Triggers.js:50–80、src/03_AssignService.js:9–35、src/18_ProspectRank.js:138–155

| ファイル:行 | 含む関数 | パターン | 影響 |
|-----------|---------|--------|------|
| 03_AssignService.js:15 | `runAssignMigration` | `sheetName !== undefined` → 常にtrue | 関数が常に early return |
| 26_Triggers.js:59–62 | `autoFillStaffId` | `[undefined, undefined].includes(sheetName)` → 常にfalse | トリガーハンドラが常に early return |
| 18_ProspectRank.js:142–148 | `recalculateAllProspectRanks` | `getSheetByName(undefined)` → null → if(!sheet)ガード | 0シート処理（無害） |

- ヌルチェック: **全箇所にガードあり**
- フロント44: 該当なし
- **判定**: 実害なし（ただし関数が機能しない — runAssignMigration・autoFillStaffId は常に停止）

---

#### NOTICE

読んだ行: src/01_Initialize.js:388–410

`initializeBuddyConversationLogSheet` と同パターン。  
注: 定義済みの `CONFIG.SHEETS.NOTICES`（末尾S）とは別キー。

- ヌルチェック: **あり**
- フロント44: 該当なし
- **判定**: 実害なし

---

#### NOTIFICATION

読んだ行: src/17_NotificationService.js:10–40

```javascript
function initializeNotificationSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICATION); // undefined
  if (!sheet) { // ← ヌルチェックあり
    const lock = LockService.getScriptLock();
    ...
    sheet = ss.insertSheet(CONFIG.SHEETS.NOTIFICATION); // insertSheet(undefined)
  }
```

- ヌルチェック: **あり**
- フロント44: 該当なし
- **判定**: 実害なし（`insertSheet(undefined)` の動作は【未確認】）

---

#### PROMPT_CONFIG

```
grep -rn "CONFIG\.SHEETS\.PROMPT_CONFIG" src/ --include="*.js"
```
読んだ行: src/34_PromptConfigService.js:12–25 / 78–95 / 200–215、src/11_PromptManager.js:20–33 / 112–125

全5ヶ所のパターン:
```javascript
const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG); // undefined
if (!sheet) { return { success: false, error: 'シートが見つかりません' }; } // ← 全箇所ガードあり
```

- ヌルチェック: **全5箇所にあり**
- フロント44: `grep -n "getPromptConfig\|updatePromptConfig" frontend/src/gas/client.ts` → **0件**
- **判定**: 実害なし

---

#### QUOTE_TEMPLATES

読んだ行: src/27_WebApp.js:6928

```javascript
const sheetName = CONFIG.SHEETS.QUOTE_TEMPLATES || '見積もりテンプレート';
```

- **明示的フォールバックあり** → undefined は '見積もりテンプレート' に置換される
- **判定**: 実害なし（フォールバック正常動作）

---

#### STAFF_MASTER

```
grep -rn "CONFIG\.SHEETS\.STAFF_MASTER" src/ --include="*.js"
```
読んだ行: src/01_Initialize.js:125–145、src/check_staff_registration.js:1–30

**src/01_Initialize.js:125–145 (`initializeStaffMasterSheet`)**:
```javascript
let sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF_MASTER); // undefined
if (!sheet) { // ← ヌルチェックあり
  sheet = ss.insertSheet(CONFIG.SHEETS.STAFF_MASTER); // insertSheet(undefined)
}
const headers = CONFIG.HEADERS.STAFF_MASTER;
sheet.getRange(1, 1, 1, headers.length).setValues([headers]); // insertSheet成功時のみ到達
```

**src/check_staff_registration.js:1–10 (`checkStaffRegistration`)**:
```javascript
const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF_MASTER); // undefined
if (!sheet) {
  return { success: false, error: '担当者マスタシートが見つかりません' }; // ← ヌルチェックあり
}
```

- ヌルチェック: **両ファイルともあり**
- フロント44からの経路: `getCoreStaffForFrontend` は Core Schema V1 (`coreCustomerFrontendReadTable(spreadsheet, 'STAFF', ...)`) 経由 → `CONFIG.SHEETS.STAFF` (lazy getter → '担当者マスタ') → **STAFF_MASTER を通らない**
- フロント44: `checkStaffRegistration` → **0件**
- **判定**: 実害なし。getCoreStaffForFrontend は STAFF_MASTER とは独立した経路で動作

---

#### SYSTEM_AGENTS / SYSTEM_CHANGELOG / SYSTEM_SPECS

```
grep -n "CONFIG\.SHEETS\.SYSTEM_AGENTS\|CONFIG\.SHEETS\.SYSTEM_CHANGELOG\|CONFIG\.SHEETS\.SYSTEM_SPECS" src/DB_System.js
```
読んだ行: src/DB_System.js:1–50

```javascript
function initSystemSheets() {
    // L8: ← TypeError 発生（undefined.NAME）
    let agentSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_AGENTS.NAME);
    // L27: ← 同様 TypeError
    let specSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_SPECS.NAME);
    // L34: ← 同様 TypeError
    let logSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_CHANGELOG.NAME);
}

function getSystemAgents() {
    // L42: ← TypeError 発生
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SYSTEM_AGENTS.NAME);
```

- ヌルチェック: **なし**（undefined へ直接 `.NAME` アクセス → `TypeError: Cannot read properties of undefined (reading 'NAME')`）
- フロント44への到達:
  ```
  grep -n "initSystemSheets\|getSystemAgents" frontend/src/gas/client.ts → 0件
  grep -rn "initSystemSheets\|getSystemAgents" src/ --include="*.js" | grep -v "DB_System.js\|setup.js" → 0件
  ```
  `setup.js:5` にて `setupProject()` → `initSystemSheets()` の呼び出しあり。`setupProject` も フロント44外。
- **判定**: TypeError 確定。ただしフロント44外 → **ユーザー操作での実害なし**。手動で `setupProject` または `initSystemSheets` / `getSystemAgents` を実行するとクラッシュ。

---

#### TEMPLATE

読んだ行: src/01_Initialize.js:220–240

`initializeBuddyConversationLogSheet` と同パターン。  
注: 定義済みの `CONFIG.SHEETS.TEMPLATES`（末尾S）とは別キー（TEMPLATE vs TEMPLATES）。

- ヌルチェック: **あり**
- フロント44: 該当なし
- **判定**: 実害なし

---

### 2-3. CONFIG.SHEETS 未定義キー 総括表

| キー | 参照ファイル（代表） | ヌルガード | フロント44到達 | 判定 |
|-----|------------------|-----------|--------------|------|
| BUDDY_CONVERSATION_LOG | src/01_Initialize.js:321 | あり（if !sheet） | × | 実害なし |
| CONVERSATION_LOG_DEAL | src/09_ConversationArchiveService.js:368 | あり（if !sheet） | × | 実害なし |
| CONVERSATION_LOG_LEAD | src/09_ConversationArchiveService.js:365 | あり（if !sheet） | × | 実害なし |
| DEALS | src/03_AssignService.js:27 | あり（LEADS_IN/OUT + if !sheet 二重ガード） | × | 実害なし |
| GLOSSARY | src/01_Initialize.js:369 | あり（if !sheet） | × | 実害なし |
| LEADS_GID | src/00_DataHelpers.js:209 | — | — | **コメントのみ。実行コードなし** |
| LEADS_IN | src/26_Triggers.js:60 | あり（includes→falseで early return） | × | 実害なし（機能停止） |
| LEADS_OUT | src/26_Triggers.js:61 | あり（同上） | × | 実害なし（機能停止） |
| NOTICE | src/01_Initialize.js:393 | あり（if !sheet） | × | 実害なし |
| NOTIFICATION | src/17_NotificationService.js:16 | あり（if !sheet） | × | 実害なし |
| PRODUCT_MASTER | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.PRODUCT_MASTER のみ）** |
| PROMPT_CONFIG | src/34_PromptConfigService.js:15 | あり（全5箇所） | × | 実害なし |
| QUOTE_TEMPLATES | src/27_WebApp.js:6928 | `\|\| 'フォールバック値'` あり | × | 実害なし（フォールバック動作） |
| RAW_FORM_RESPONSES | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES のみ）** |
| SHIPPING_DHL | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.SHIPPING_DHL のみ）** |
| SHIPPING_FEDEX | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.SHIPPING_FEDEX のみ）** |
| SHIPPING_UPS | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.SHIPPING_UPS のみ）** |
| STAFF_MASTER | src/01_Initialize.js:129 | あり（全2ファイル） | × | 実害なし。getCoreStaffForFrontend は別経路（Core Schema V1） |
| SYSTEM_AGENTS | src/DB_System.js:8 | **なし**（undefined.NAME → TypeError） | × | **手動実行でクラッシュ** |
| SYSTEM_CHANGELOG | src/DB_System.js:34 | **なし**（同上） | × | **手動実行でクラッシュ** |
| SYSTEM_SPECS | src/DB_System.js:27 | **なし**（同上） | × | **手動実行でクラッシュ** |
| TEMPLATE | src/01_Initialize.js:225 | あり（if !sheet） | × | 実害なし |
| TERM_DICTIONARY_GID | src/00_DataHelpers.js:177 | — | — | **コメントのみ。実行コードなし** |
| VIEWER_SUPPLIER_STOCK | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK のみ）** |
| ZONES | — | — | — | **CONFIG.SHEETS参照なし（ERP_CONFIG.SHEETS.ZONES のみ）** |

---

## 3. 全体総括

### 現行 React アプリ（フロント44関数）でクラッシュするものは 0 件

- `PRODUCTION_IDS` を参照する全関数：フロント44から到達不可（React SPA の client.ts に記述なし）
- `CONFIG.SHEETS.SYSTEM_AGENTS/CHANGELOG/SPECS`：TypeError 確定だがフロント44外（手動実行のみ）
- その他全未定義キー：ヌルチェックまたはフォールバックあり

### レガシーページ（`?page=legacy`）で機能しないもの（2件）

| 関数 | ファイル | 症状 | try-catch |
|-----|---------|-----|-----------|
| `writeQuoteToSheetAndGeneratePDF` | src/27_WebApp.js:7398 | PDF 生成不可。`{ success: false, message: 'PRODUCTION_IDS is not defined' }` を返す | あり（L7399/7643） |
| `writeInvoiceToSalesData` | src/35_SalesDataSyncService.js:194 | 売上データ転記不可。`{ success: false, error: ... }` を返す | あり（L195/774） |

呼び出し元: `src/index.html:19030`, `19663`, `20570` （レガシーページ `doGet?page=legacy` 経由）

### 手動実行でクラッシュするもの（3件）

| 関数 | ファイル | エラー種別 |
|-----|---------|---------|
| `initSystemSheets` | src/DB_System.js | TypeError: `CONFIG.SHEETS.SYSTEM_AGENTS.NAME` at L8 |
| `getSystemAgents` | src/DB_System.js | TypeError: `CONFIG.SHEETS.SYSTEM_AGENTS.NAME` at L42 |
| `setupProject` | src/setup.js | initSystemSheets を呼ぶため同上 |

### 機能が停止しているもの（クラッシュはしないが動作しない）

| 関数 | 原因 |
|-----|-----|
| `runAssignMigration` | LEADS_IN/LEADS_OUT が undefined → 常に early return |
| `autoFillStaffId` | 同上 → スプレッドシート編集トリガーが常に early return |
| `recalculateAllProspectRanks` | 同上 → 0シート処理（無害ループ） |

### 【未確認】事項

- `ss.insertSheet(undefined)` の GAS V8 実際の動作（"undefined" 文字列名シートを作るか、エラーになるか）
  → 影響が出るのは `initializeNotificationSheet` 等の init 関数。`initializeSpreadsheet`（07_Code.js メニュー）経由で到達可能

---

## 4. PO 向け確認依頼

| # | 確認内容 | 理由 |
|---|---------|------|
| 1 | `PRODUCTION_IDS` という定数をどこかで定義していたか（別ブランチ・削除履歴など） | 全 src/ に定義なし。将来の復活予定があるか判断材料 |
| 2 | レガシーページ（`?page=legacy`）を現在も業務で使用しているか | 使用中なら `writeQuoteToSheetAndGeneratePDF` / `writeInvoiceToSalesData` の修正が必要。修正には各シートの GID 値が必要 |
| 3 | `CONFIG.SHEETS.LEADS_IN` / `LEADS_OUT` を使うシートはもともと存在したか | LEADS キーが定義されているが LEADS_IN/LEADS_OUT は未定義。設計変更の経緯確認 |
| 4 | `setupProject` を実行したことがあるか | 実行すると TypeError で失敗する。DB_System.js のシート初期化が走らない |
| 5 | メニュー「🔧 全シート初期設定」を最近実行したか | `initializeNotificationSheet` 内の `insertSheet(undefined)` 動作が未確認 |

---

## 実行サマリ（PO が離席から戻った際に読むもの）

| 項目 | 内容 |
|---|---|
| 調査基準 SHA | `96b030391d5a415bd3cfe972968e7cc9552e268e` |
| 調査で確定した実害（修正フェーズ進入条件を満たすもの） | **0 件** |
| 修正 PR | **なし**（後述の理由により修正フェーズに進まなかった） |
| レガシー経路での実害（PO 判断待ち） | `PRODUCTION_IDS` 未定義により `writeQuoteToSheetAndGeneratePDF`（27_WebApp.js:7406）・`writeInvoiceToSalesData`（35_SalesDataSyncService.js:202）がレガシーページ経由で機能しない。try-catch によりプロセスはクラッシュしない。**修正には実際の GID 値が必要（PO 提供要）** |
| 【未確認】のまま残した項目 | ①`CONFIG.SHEETS.NOTIFICATION` — `insertSheet(undefined)` の GAS V8 挙動が実行なしでは確認不可 ②`PRODUCTION_IDS` の実 GID 値 ③レガシーページの現行利用状況 |
| PO 判断が必要な項目 | ①PRODUCTION_IDS を定義（GID 値を提供）するか削除するか ②レガシーページを廃止するか維持するか ③`CONFIG.SHEETS.NOTIFICATION` のシート名を修正するか |
| 全体を戻す手順 | 修正 PR がないため不要 |

### 修正フェーズに進まなかった理由

修正フェーズ進入条件「実害あり と確定している」に合致する項目が存在しない。

- **PRODUCTION_IDS**: 実害は「レガシーページのみ」。現行 React アプリには影響なし。かつ、修正には実際のシート GID 値が必要であり、コードのみでは完結しない（PO 提供要）。
- **CONFIG.SHEETS.NOTIFICATION**: `insertSheet(undefined)` の挙動が実行確認なしには断定不可 → **【未確認】**（修正フェーズ対象外）。
- **その他全キー**: ヌルチェック / フォールバック / デッドコードにより 実害なし。

---

---

## 補遺: CONFIG 未定義定数 到達可能性調査（2026-09-04）

**調査日**: 2026-09-04  
**起点**: PR #996 で `CONFIG.LEAD_STATUSES` を削除した際に判明した、pre-existing の未定義 CONFIG 定数 4 件の到達可能性を確認する。  
**方針**: 調査のみ。修正しない。事実の記録のみ。

### 判定基準

| 判定 | 条件 |
|---|---|
| 実害あり | フロント 44 関数・トリガー・doGet/doPost から到達する |
| レガシーのみ | src/index.html からのみ到達 |
| 到達不能 | どこからも呼ばれない |
| 【未確認】 | 判定できない |

---

### CONFIG.DRIVE（請求書発行.js:568）

**読んだ行番号**: 07_Code.js:49、請求書発行.js:146、350、564–568

#### 参照している関数

```javascript
// 請求書発行.js:564
function createInvoicePDF_Internal(invoiceNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // L568: CONFIG.DRIVE 未定義 → TypeError
  const folderInput = CONFIG.DRIVE.INVOICE_FOLDER_ID;
```

#### 到達経路

```
07_Code.js:49  メニュー「請求書」→「📝請求書発行」
  └─ 請求書発行.js:146  transferAndGeneratePDF()
       └─ 請求書発行.js:350  createInvoicePDF_Internal(invoiceNoMain)
            └─ 請求書発行.js:568  CONFIG.DRIVE.INVOICE_FOLDER_ID  ← TypeError
```

| 経路 | 到達するか |
|------|-----------|
| フロント 44 関数 | しない（リストに `transferAndGeneratePDF` なし） |
| トリガー（00_TriggerSetup.js 全登録） | しない |
| doGet / doPost | しない |
| メニュー（onOpen → UI メニュー） | **する** |

#### 判定: **実害あり**

メニュー「📝請求書発行」をクリックすると `createInvoicePDF_Internal` が呼ばれ、`CONFIG.DRIVE.INVOICE_FOLDER_ID` で TypeError が発生する。PDF は生成されない。

---

### CONFIG.HEADERS（01_Initialize.js 複数行）

**読んだ行番号**: 01_Initialize.js:88–422、23_SheetService.js:93–226、99_CustomerMasterSeed.js:1108、1304、1418

#### 参照している関数（実コード）

| 関数名 | 01_Initialize.js の行 | CONFIG.HEADERS 参照 |
|--------|----------------------|-------------------|
| `initializeLeadsSheet` | 88–121 | 行102: `CONFIG.HEADERS.LEADS` |
| `initializeStaffMasterSheet` | 126–145 | 行134: `CONFIG.HEADERS.STAFF_MASTER` |
| `initializeSettingsSheet` | 150–169 | 行158: `CONFIG.HEADERS.SETTINGS` |
| `initializePermissionsSheet` | 174–193 | 行182: `CONFIG.HEADERS.PERMISSIONS` |
| `initializeGoalsSheet` | 198–217 | 行206: `CONFIG.HEADERS.GOALS` |
| `initializeTemplateSheet` | 222–241 | 行230: `CONFIG.HEADERS.TEMPLATE` |
| `initializeWeeklyReportSheet` | 246–265 | 行254: `CONFIG.HEADERS.WEEKLY_REPORT` |
| `initializeMonthlyReportSheet` | 270–289 | 行278: `CONFIG.HEADERS.MONTHLY_REPORT` |
| `initializeShiftSheet` | 294–313 | 行302: `CONFIG.HEADERS.SHIFT` |
| `initializeBuddyConversationLogSheet` | 318–337 | 行326: `CONFIG.HEADERS.BUDDY_CONVERSATION_LOG` |
| `initializeConversationLogSheet` | 342–361 | 行350: `CONFIG.HEADERS.CONVERSATION_LOG` |
| `initializeGlossarySheet` | 366–385 | 行374: `CONFIG.HEADERS.GLOSSARY` |
| `initializeNoticeSheet` | 390–409 | 行398: `CONFIG.HEADERS.NOTICE` |
| `initializeReadStatusSheet` | 414–433 | 行422: `CONFIG.HEADERS.READ_STATUS` |

※ 99_CustomerMasterSeed.js:1108、1304、1418 の参照は JSDoc コメント内のみ。実コードには存在しない。

#### 到達可能性の分析

**`initializeLeadsSheet`（01_Initialize.js:88）**  
行89に明示的な guard がある。

```javascript
function initializeLeadsSheet(ss) {
  throw new Error(  // L89
    'この関数は無効化されています。...'
  );
  // ...
  const headers = CONFIG.HEADERS.LEADS;  // L102 — ここまで到達しない
```

CONFIG.HEADERS.LEADS は行102で参照されるが、行89の `throw` により到達不能。

**`initializeSettingsSheet` / `initializePermissionsSheet` / `initializeGoalsSheet` / `initializeGoalsSheetFromMenu` / `initializePermissionsSheetFromMenu`**  
23_SheetService.js で同名関数が再定義されている（行93、110、150、193、226）。  
GAS は function 宣言を後勝ちで処理するため、01_Initialize.js 版（CONFIG.HEADERS を参照する版）は無効。  
23_SheetService.js 版は CONFIG.HEADERS を参照しない。  
これらはメニューから到達するが、実行されるのは 23_SheetService.js 版であり CONFIG.HEADERS には触れない。

**残り 9 関数**（`initializeStaffMasterSheet`, `initializeTemplateSheet`, 他 7 件）  
23_SheetService.js に同名関数なし。呼び出し元が `01_Initialize.js` 自身のみまたは 0 件（grep 結果）。  
`initializeAllCRMSheets()`（行701）も `initializeSalesDataSheet` / `initializeAntiqueLedgerSheet` のみを呼ぶ（行720–738）。  
到達経路なし。

#### 判定: **到達不能**

全 14 関数のいずれも CONFIG.HEADERS を参照する行には到達しない。

**【未確認】**: GAS における同一スコープへの重複 function 宣言の公式仕様は未検証。「後勝ち」はアプリ稼働実績から推定（23_SheetService.js 版の関数が問題なく動作している）。

---

### CONFIG.QUOTE_HISTORY（00_HeaderMappingHelper.js:236 / 11_QuoteService.js）

**読んだ行番号**: 00_HeaderMappingHelper.js:211–248、11_QuoteService.js:15–30、75–98、202–225、302–325、408–430、472–495、27_WebApp.js:228–300、7688–7750、7856–7900、src/index.html:18738、19011、19060

#### 参照している関数

| ファイル | 行 | 関数 | CONFIG.QUOTE_HISTORY 参照 |
|--------|-----|------|--------------------------|
| 00_HeaderMappingHelper.js | 211 | `testHeaderMapping()` | 行236: `CONFIG.QUOTE_HISTORY.GID` |
| 11_QuoteService.js | 15 | `generateQuoteId()` | 行23、30 |
| 11_QuoteService.js | 75 | `saveQuote()` | 行88 |
| 11_QuoteService.js | 202 | `getQuoteById()` | 行213 |
| 11_QuoteService.js | 302 | `getAllQuotes()` | 行317 |
| 11_QuoteService.js | 408 | `getQuotePDFUrl()` | 行418 |
| 11_QuoteService.js | 472 | `updateQuotePDFUrl()` | 行483 |

#### 到達可能性の分析

**`testHeaderMapping()`（00_HeaderMappingHelper.js:211）**  
呼び出し元なし（grep 結果 0 件）。フロント 44 関数・メニュー・トリガーのいずれにも含まれない。  
→ **到達不能**

**11_QuoteService.js の 6 関数** — 以下の経路から到達する。

| 到達経路 | 経由する GAS 関数 | CONFIG.QUOTE_HISTORY を参照する関数 |
|---------|----------------|-----------------------------------|
| `doPost`（27_WebApp.js:287） `action:'getAllQuotes'` | `getAllQuotes()` | 行317 |
| `doPost`（27_WebApp.js:293） `action:'getQuotePDFUrl'` | `getQuotePDFUrl()` | 行418 |
| `doPost`（27_WebApp.js:296） `action:'updateQuotePDFUrl'` | `updateQuotePDFUrl()` | 行483 |
| `src/index.html:18787` → `google.script.run.getQuotesForList()` | `getQuotesForList()`（27_WebApp.js:7856）→ `getAllQuotes()` | 行317 |
| `src/index.html:18738` → `google.script.run.saveQuoteFromForm()` | `saveQuoteFromForm()`（27_WebApp.js:7688）→ `saveQuote()` | 行88 |
| `src/index.html:19011` → `google.script.run.updateQuotePDFUrl()` | `updateQuotePDFUrl()` | 行483 |
| `src/index.html:19060` → `google.script.run.getQuotePDFUrl()` | `getQuotePDFUrl()` | 行418 |

`src/index.html` は `doGet?page=legacy`（27_WebApp.js:64）で配信されるレガシーページ。  
`doPost` は gas-cleanup-proposal.md section 3-3 で「現役（Webhookエントリ）」と分類されている。

フロント 44 関数（28_CoreQuoteApi.js: `getCoreQuotesForFrontend`, `createCoreQuoteForFrontend` 等）は `coreQuoteReadTable` / `validateCoreSchemaV1TableForWrite` 経由でシートに直接アクセスし、`CONFIG.QUOTE_HISTORY` を参照しない。44 関数からは到達しない。

#### 判定: **実害あり**

`doPost`（Webhook エントリ）から `action:'getAllQuotes'` 等を送信すると、`11_QuoteService.js` の関数が呼ばれ `CONFIG.QUOTE_HISTORY.GID` で TypeError が発生する。  
また `?page=legacy` 経由でレガシーページを開き見積もり操作を行うと同じ TypeError が発生する。  
現行 React フロントエンド（44 関数）からは到達しない。

---

### CONFIG.SPREADSHEET_ID（27_WebApp.js:8193）

**読んだ行番号**: 27_WebApp.js:8188–8210、check_staff_registration.js:1–5

#### 参照している関数

| ファイル | 行 | 関数 |
|--------|-----|------|
| 27_WebApp.js | 8191 | `checkImportRangeFormula()` |
| check_staff_registration.js | 1 | `checkStaffRegistration()` |

#### 到達可能性の分析

両関数とも呼び出し元が存在しない（`grep -rn "checkImportRangeFormula\|checkStaffRegistration"` → 定義行以外 0 件）。  
フロント 44 関数・doPost・メニュー・トリガーのいずれにも登録なし。

#### 判定: **到達不能**

---

### まとめ

| 定数 | 参照ファイル | 到達する関数 | 判定 |
|------|-----------|------------|------|
| `CONFIG.DRIVE` | 請求書発行.js:568 | `createInvoicePDF_Internal` | **実害あり**（メニューから） |
| `CONFIG.HEADERS` | 01_Initialize.js（14 箇所） | なし（guard / 関数上書き / 呼び出し元なし） | **到達不能** |
| `CONFIG.QUOTE_HISTORY` | 00_HeaderMappingHelper.js:236、11_QuoteService.js（6 箇所） | `getAllQuotes`, `getQuotePDFUrl`, `updateQuotePDFUrl`, `saveQuote` | **実害あり**（doPost + レガシーページ） |
| `CONFIG.SPREADSHEET_ID` | 27_WebApp.js:8193、check_staff_registration.js:3 | なし | **到達不能** |

### 実害ありと判定した件の一覧

| # | 定数 | クラッシュ箇所 | 到達経路 | 現行フロントへの影響 |
|---|------|-------------|---------|-------------------|
| 1 | `CONFIG.DRIVE` | 請求書発行.js:568 | メニュー「📝請求書発行」 | **なし**（メニュー操作時のみ） |
| 2 | `CONFIG.QUOTE_HISTORY` | 11_QuoteService.js:23、88、213、317、418、483 | `doPost` `action:'getAllQuotes'`/`'getQuotePDFUrl'`/`'updateQuotePDFUrl'` | **なし** |
| 3 | `CONFIG.QUOTE_HISTORY` | 同上 | `?page=legacy` + `google.script.run.saveQuoteFromForm`/`getQuotesForList`/`updateQuotePDFUrl`/`getQuotePDFUrl` | **なし** |

### 【未確認】項目

1. GAS における同一スコープへの重複 function 宣言（01_Initialize.js と 23_SheetService.js の同名関数）の公式仕様。「後勝ち」はアプリ稼働実績から推定。
2. `doPost` に対して `action:'getAllQuotes'` 等を実際に送信している外部クライアントが存在するか（コードからは判断不可）。

---

*調査実施: 読み取り専用（src/ への変更なし、clasp push なし、git push なし）*
