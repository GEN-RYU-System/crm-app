# Legacy SPA page inventory

この台帳は`src/index.html`の現行メニュー、route switch、permission mapを読取り確認した結果をReact移行の正本へ対応付けます。旧SPAは変更しません。

| Group | Legacy route | React navigation state | Existing permission boundary |
|---|---|---|---|
| Overview | `/` | Dashboard available | none in React POC |
| Leads | `/leads-chat`, `/new-chat`, `/route-chat`, `/archive-chat` | Route chat preview; others planned | `lead_view` |
| Sales | `/inventory`, `/quotes`, `/quote-history`, `/invoices`, `/reports` | planned | `deal_view_all` or `deal_view_own` menu access |
| Support | `/faq` | planned | active user |
| Management | `/deals`, `/staff`, `/permissions`, `/settings` | Data management parent available with React `/leads` child; others planned | route-specific permission |
| Management | customer records | Customer preview at `#/customers` and `#/customers/:customerId` | temporary `lead_view` boundary; no customer-specific permission exists in current React navigation |
| Tools | `/preferences`, `/knowledge`, `/translation-prompts`, `/templates` | planned | active user or admin/staff permission |

React固有のリード管理は、主サイドバーの直接リンク「データ管理」から管理ハブへ入り、独立したSubMenuの「リード管理」から開く既存の利用可能画面として維持します。リードのReact URLは`#/leads`、`#/leads/new`、`#/leads/:leadId`を維持し、`/components`も既存の利用可能画面として維持します。`/route-chat` Previewはローカルの明示的ダミーデータだけを使い、`google.script.run`、storage、シート、保存処理へ接続しません。

顧客Previewは既存のデータ管理Hubに「顧客管理」として追加します。現時点の権限SSOTに顧客専用キーはないため、親と同じ既存`lead_view`を暫定表示境界として用い、新しい権限名は追加しません。`CustomerRepository`契約を実装するPreview adapterだけが明示的なダミーデータを返し、将来のCONFIG／マッピング正本が確定した時点で実アダプターへ差し替えます。
