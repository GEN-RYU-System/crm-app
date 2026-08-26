# DEPLOY LOG

## 2026-08-26

| 項目 | 値 |
|------|-----|
| 日時 | 2026-08-26T15:39:46+09:00 |
| merge SHA | acc9c9d5d7232a3309bdf2363f61de1809668c23 |
| SHA256 | ca71b6d3c26b9d1c7a2347dc8279be5d509890dce83b4a4fe53e8893c44569b0 |
| 変更概要 | 営業用CRM説明スライド8枚(01連動/02見積・請求PDF/03登録フォーム/04販売管理/05受注ステータス/06売上分析/07顧客特性分析/08リード分析)をdocs/sales/slides_crm.htmlとして追加。アプリ本体・GAS・CIへの変更なし |
| PR | https://github.com/GEN-RYU-System/crm-app/pull/648 |

### 検証結果

- **検証A** (SHA256照合): `git show origin/main:docs/sales/slides_crm.html | shasum -a 256`
  → `ca71b6d3c26b9d1c7a2347dc8279be5d509890dce83b4a4fe53e8893c44569b0` ✅ ゲート値と一致
- **検証B** (差分確認): `git log -1 --stat` → `docs/sales/slides_crm.html | 373 +++...` 1 file changed, 373 insertions(+) ✅ 追加のみ

### ロールバック手順

```bash
git revert acc9c9d5d7232a3309bdf2363f61de1809668c23
```
