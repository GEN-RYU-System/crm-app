# Discord連携 廃止記録

作成日: 2026-08-26

---

## 結論

GAS単体でのDiscord連携は技術的に不可能と判断し、全実装を廃止する。

---

## 技術的理由

### 根本障害: Cloudflare による書き込み系API ブロック（discord_code=40333）

Discord APIは CloudflareのWAF（Web Application Firewall）の前段に置かれている。
GAS（Google Apps Script）の `UrlFetchApp` から POST/PUT/PATCH 等の書き込み系リクエストを
送ると、HTTP 403 / `discord_code=40333` でブロックされる。

Discord公式エラーコード一覧（出典: https://docs.discord.com/developers/topics/opcodes-and-status-codes）より:

> **40333** — Cloudflare is blocking your request.
> This can often be resolved by setting a proper User Agent

### User-Agent 追加を試みたが効果なし（PR #594 実測）

Discord公式ドキュメント（出典: https://docs.discord.com/developers/reference）記載の形式に従い、
`discordRequest_()` に以下を追加した（PR #594）:

```js
'User-Agent': 'DiscordBot (https://github.com/GEN-RYU-System/crm-app, 1)'
```

DEVデプロイ後に `runDiscordAutoSetup` を実行したが、引き続き 40333 が発生した。

### 根本原因: GASから変更不可能な2要因

1. **User-Agent**: `UrlFetchApp` はGoogle共有インフラ上で動作するため、
   Googleが内部で付加するヘッダーをアプリケーション側で上書きできない。
   （Discord側は宣言したUser-Agentではなく、実際に送信されたUser-Agentを評価する）

2. **共有IPアドレス評価**: GASはGoogleの共有アウトバウンドIPから発信される。
   Cloudflareはこれらの共有IPに対してBotスコアを付与しており、
   書き込み系リクエストを弾く評価基準が適用される。
   これはアプリケーション側からは変更不可能。

### 実測で動いた操作 / 動かなかった操作

| 操作 | エンドポイント | 結果 | 備考 |
|---|---|---|---|
| Bot接続確認 | GET `/users/@me` | **成功** | `testDiscordConnection` で実測済み |
| メッセージ取得 | GET `/channels/{id}/messages` | **成功** | `fetchDiscordMessages` で実測済み |
| チャンネル作成 | POST `/guilds/{id}/channels` | **失敗 (40333)** | `runDiscordAutoSetup` で実測 |
| 権限上書き | PUT `/channels/{id}/permissions/{id}` | **失敗 (40333)** | 同上 |
| ロール作成 | POST `/guilds/{id}/roles` | **失敗 (40333)** | 同上 |
| 招待URL作成 | POST `/channels/{id}/invites` | **未実測** | 同様のブロックが想定される |

GET（読み取り）は通過するが、POST/PUT（書き込み）は一律ブロックされる。

---

## 再着手条件

中継サーバー（自社VPS等）を経由して Discord APIを呼び出す構成であれば実現可能。

- GAS → 自社VPS（固定IP・正規User-Agent） → Discord API
- VPSからの送信は固定IPでCloudflareの評価が安定し、User-Agentも自由に設定できる
- salesanchor の `api.salesanchor.jp`（FastAPI/Python）を中継エンドポイントとして追加するのが最小構成

---

## 廃止対象 PR 一覧（復活参照用）

以下は `develop` ブランチにsquash mergeされた全Discordコミット。
復活させたい場合は各 mergeCommit SHA を参照すること。
戻し方は `git revert <SHA>` だが、依存関係があるため単純revertでは動かない場合がある。

| PR | 内容 | mergeCommit SHA |
|---|---|---|
| #438 | 管理センター Discord連携設定ページ | `b7fb2bd00f73ef0e02637f24049eeeec68aeb335` |
| #458 | Discord チャンネル Auto-setup (Phase 2-B) | `8575fcbef423b06eaacfa466a02fee24f4761851` |
| #459 | Discord OAuth Bot招待フロー (Phase 2-A) | `f78b00b7dd588f13823418a973c99219cd39a6c2` |
| #468 | Discord チケット発行機能 | `c5c80f438d06b872cbcda8b965c05f35d93d0dd9` |
| #484 | Discord設定API 認証強化 | `787000cc93c9ecf67452526f8639a300ff71a4a0` |
| #489 | Discord 保存と接続確認の統合 | `c2075ded9152f0003d5200ea02e8a1fc5f172172` |
| #492 | DEV inbox ヘッダー監査 (Discord含む) | `b4f2d50f7f42ae64db12105436281820844bc20d` |
| #545 | Discord Bot 招待後 Guild 自動検出 | `0c895719c7c847c7281da8eaca38cd30f4eb4e91` |
| #550 | Discord Guild 選択状態の再取得時保持 | `f335858bd250d152c986c37ec85f666201ad15e5` |
| #553 | Discord チャンネルセットアップ連携状態同期 | `15b16faad625202785755d2fc6ff319896ada698` |
| #562 | Discord 顧客別招待 Phase 1 | `103c8404395230051c6c3608fb8f9b5948f936b0` |
| #566 | Discord 顧客別招待 Phase 2 | `963b1762c41ee2f1fe8b451ea3a3fbfcb66a1e80` |
| #574 | Discord 顧客別招待 Phase 3基盤 | `bef41dc4f6a6be87848496d12e3d53adf4cd92a4` |
| #578 | Discord Guild連携状態表示改善 | `ffb03a47a6c4732e13d9d61271e14fcba0e01f14` |
| #583 | Discord APIエラー詳細化 (Phase A-1) | `319ee4be734205512276cd9c5a17dfcc26a4d316` |
| #584 | Discord実装棚卸しドキュメント (Phase B) | `b6d7a42081f436f9f020bc6cb79d198f77487a88` |
| #587 | Customer/Partner カテゴリ・ロール実装 (Phase C) | `ce5d0b585cca84ac150e0104ebd42fafef1d5bda` |
| #594 | User-Agent 追加（40333対策・効果なし） | `1896401ae6dda83e8326e8d409160234092a5731` |

---

## 参考外部事例

- Discord公式: GASからのDiscord API利用は公式サポート対象外
- 外部事例（Stack Overflow / GitHub Issues）では、GASからのDiscord Webhook POST も
  同様にCloudflareでブロックされる報告が複数ある
  （検索: `site:stackoverflow.com google apps script discord 403`）
- GAS → Discord の書き込みが動くケースは、DiscordのWebhook URLを直接POSTする
  古い実装（Cloudflare導入前）か、DiscordがCloudflare保護を無効化している特殊サーバーのみ

---

## スクリプトプロパティについて（削除しない）

以下のプロパティはGASスクリプトプロパティに残留するが、
コードから参照されないため実害はない。削除はShingo判断で手動実施すること。

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_CATEGORY_ID`
- `DISCORD_TICKET_CHANNEL_ID`
- `DISCORD_CUSTOMER_CATEGORY_ID`
- `DISCORD_PARTNER_CATEGORY_ID`
- `DISCORD_CUSTOMER_ROLE_ID`
- `DISCORD_PARTNER_ROLE_ID`
- `DISCORD_MESSAGEFORWARDING_BOT_TOKEN`（存在する場合）
