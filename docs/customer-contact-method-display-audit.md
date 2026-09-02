# 顧客詳細ページへの連絡手段表示 実現性調査レポート

**調査日**: 2026-09-02  
**依頼**: PO 2026-09-01 決定 — 顧客詳細ページで元リードの連絡手段を参照表示  
**制約**: 顧客マスタへの contact_method 列追加禁止。本ドキュメントは調査のみ。実装は含まない。

---

## § 1. 顧客とリードの紐づけ状況

### 実測値（devCustomerLeadLinkageAudit 実行結果 — 2026-09-02）

```json
{
  "customerMaster": {
    "totalCustomers": 6,
    "withSourceLeadId": 6,
    "withoutSourceLeadId": 0
  },
  "leadLinkage": {
    "matchedCount": 6,
    "unmatchedCount": 0,
    "contactMethodColumnExists": true,
    "contactMethodHeaderName": "contact_method"
  },
  "contactMethodDistribution": {
    "メール": 4,
    "Discord": 1,
    "LINE": 1
  }
}
```

### サンプル（全6件）

| 顧客ID | source_lead_id | リード存在 | contact_method |
|--------|---------------|-----------|----------------|
| CT-0001 | LDI-0001 | ✓ | メール |
| CT-0002 | LDI-0002 | ✓ | メール |
| CT-0003 | LDI-0003 | ✓ | Discord |
| CT-0004 | LDI-0004 | ✓ | メール |
| CT-0005 | LDI-0005 | ✓ | LINE |
| CT-0006 | LDI-0006 | ✓ | メール |

### 判定

- 【事実】DEV環境では全6顧客が source_lead_id を持ち、全件リード管理に紐づく（マッチ率 100%）
- 【事実】リード管理に `contact_method` 列が存在する（ヘッダー名: `contact_method`）
- 【未確認】PROD環境での source_lead_id 空白率（DEVはテストデータ全件入力済みのため参考値）

---

## § 2. getCoreCustomerForFrontend の戻り値確認

**ファイル**: `src/28_CoreCustomerReadApi.js`  
**関数**: `getCoreCustomerForFrontend(sessionId, customerId)` — line 67

### 読み取りシート（line 74, 84, 89）

| シート | 読み取り列 |
|--------|-----------|
| CUSTOMERS | CUSTOMER_ID, SOURCE_LEAD_ID, CUSTOMER_NAME, COUNTRY, EMAIL, PHONE, COUNTRY_CODE, FIRST_TRANSACTION_DATE, REGISTERED_AT, SALES_ASSIGNEE_NAME, CONTACT_TOOL, SHIPPING_NOTE |
| SHIPPING_DESTINATIONS | SHIPPING_DESTINATION_ID, CUSTOMER_ID, RECIPIENT_NAME, ADDRESS_LINE_1〜3, CITY, STATE, ZIP, COUNTRY, PHONE, EMAIL, DISPLAY_NAME, IS_DEFAULT, IS_ACTIVE |
| PAYMENT_DESTINATIONS | PAYMENT_DESTINATION_ID, CUSTOMER_ID, BILLING_NAME, ADDRESS_LINE_1〜3, CITY, STATE, ZIP, COUNTRY, PAYMENT_METHOD, CURRENCY, DISPLAY_NAME, IS_DEFAULT, IS_ACTIVE |

**リード管理（LEADS）シートは読み取らない。**

### profile の戻り値フィールド（line 102–116）

```javascript
return {
  profile: {
    customerId,           // line 103
    sourceLeadId,         // line 104 ← 既存。リード取得キーとして使用可能
    customerName,         // line 105
    country,              // line 106
    emailAddress,         // line 107
    phone,                // line 108
    countryCode,          // line 109
    firstTransactionDate, // line 110
    registeredAt,         // line 111
    salesAssigneeName,    // line 112
    contactTool,          // line 113
    shippingNote,         // line 114
    shippingAddressCount, // line 115
    paymentProfileCount   // line 116
    // contact_method は含まれない
  },
  shippingAddresses: [...],
  paymentProfiles:   [...]
}
```

`sourceLeadId` は既に返却されているため、フロントエンドは取得キーを保持している。

---

## § 3. フロント側実装状況

### 型定義 — `frontend/src/features/customers/contracts.ts`

`CustomerProfileDto`（line 13–29）に `contact_method` フィールドは存在しない。

```typescript
export type CustomerProfileDto = {
  customerId: string;       // line 14
  sourceLeadId: string;     // line 15
  // ...
  contactTool: string;      // line 25
  shippingNote: string;     // line 26
  // contact_method: なし
};
```

### 表示設定 — `frontend/src/pages/customers/customerConfig.ts`

`CUSTOMER_PROFILE_FIELDS`（line 51）に 11 フィールドが定義されている。

```typescript
export const CUSTOMER_PROFILE_FIELDS = [
  { key: 'customerId',            label: ... },  // line 52
  { key: 'customerName',          label: ... },  // line 53
  { key: 'emailAddress',          label: ... },  // line 54
  { key: 'country',               label: ... },  // line 55
  { key: 'phone',                 label: ... },  // line 56
  { key: 'countryCode',           label: ... },  // line 57
  { key: 'firstTransactionDate',  label: ... },  // line 58
  { key: 'registeredAt',          label: ... },  // line 59
  { key: 'salesAssigneeName',     label: ... },  // line 60
  { key: 'contactTool',           label: ... },  // line 61
  { key: 'shippingNote',          label: ... },  // line 62
];
// contact_method エントリなし
```

### 表示ロジック — `frontend/src/pages/customers/CustomerDetailPage.tsx`

`CUSTOMER_PROFILE_FIELDS.map()` で各フィールドを TextField/Textarea として描画する実装。  
`contact_method` は現在 CUSTOMER_PROFILE_FIELDS に含まれないため画面に表示されない。

---

## § 4. 実装案ごとの事実整理

### 案A — getCoreCustomerForFrontend に contact_method を追加

**概要**: GAS 関数内で LEADS シートを追加読み取りし、`profile.contactMethod` として返す。

**変更が必要なファイル**:

| ファイル | 変更内容 |
|----------|---------|
| `src/28_CoreCustomerReadApi.js` (line 73〜) | `coreCustomerFrontendReadTable(spreadsheet, 'LEADS', ['LEAD_ID', 'CONTACT_METHOD'])` を追加。`leadsById[sourceLeadId]` でルックアップし `profile.contactMethod` を追加 |
| `frontend/src/features/customers/contracts.ts` (line 29) | `CustomerProfileDto` に `contactMethod: string` を追加 |
| `frontend/src/pages/customers/customerConfig.ts` (line 51) | `CUSTOMER_PROFILE_FIELDS` の Pick 型引数と配列エントリに `contactMethod` を追加 |
| `frontend/src/pages/customers/CustomerDetailPage.tsx` | Pick<> 型に `contactMethod` を追加（PROFILE_FIELDSの型制約に連動） |

**GAS 呼び出し回数への影響**: なし（getCoreCustomerForFrontend 1回の中でシート読み取りを追加するだけ）

**先行実装パターン**: `buildCoreCustomerListRows_`（line 21–31）が同じ `leadsById[sourceLeadId]` パターンで LEADS を参照しており、実装方法の実績あり。

**source_lead_id が空の顧客への対応**: `sourceLead` が undefined の場合は `''` を返す（0件対応が必要）。

---

### 案B — フロントエンドから getLeadDetail を別途呼び出す

**概要**: 顧客詳細ページ表示後、`sourceLeadId` を使って `getLeadDetail` を追加で呼び出し、レスポンスの `contact_method` フィールドを取り出して表示する。

**変更が必要なファイル**:

| ファイル | 変更内容 |
|----------|---------|
| `frontend/src/pages/customers/CustomerDetailPage.tsx` | `sourceLeadId` が非空のとき `getLeadDetail(sourceLeadId)` を呼び出し、結果の `contact_method` を state に保持して表示 |
| `frontend/src/features/customers/contracts.ts` | 変更不要（contact_method は LeadRecord から動的に取得） |

**既存の getLeadDetail 実装**:
- フロント: `frontend/src/gas/client.ts` line 115 — `getLeadDetail(leadId)` が既に実装済み
- GAS: `src/27_WebApp.js` line 780 付近 — リード管理の全列を `{ヘッダー名: 値}` 形式で返す（`contact_method` も含まれる）

**GAS 呼び出し回数への影響**: +1（顧客詳細ページを開くたびに追加で 1回呼び出し）  
GAS 固定オーバーヘッド 3.1秒/呼び出しが加算される。

**source_lead_id が空の顧客への対応**: sourceLeadId が空なら getLeadDetail を呼ばない条件分岐が必要。

---

## まとめ（事実のみ）

| 観点 | 案A | 案B |
|------|-----|-----|
| GAS 呼び出し追加回数 | 0 | +1（≈ 3.1秒） |
| 変更ファイル数 | 4（GAS 1 + フロント 3） | 1（フロントのみ） |
| 先行実装パターンの有無 | あり（buildCoreCustomerListRows_） | あり（getLeadDetail 既存） |
| contact_method 型安全 | CustomerProfileDto に組み込み | LeadRecord（動的型）から取得 |
| source_lead_id 空対応 | GAS 側で空文字返却 | フロント側で呼び出しスキップ |

**次フェーズ課題（PO判断待ち）**: 上記 A/B のどちらを採用するか、または実装しないかの意思決定。
