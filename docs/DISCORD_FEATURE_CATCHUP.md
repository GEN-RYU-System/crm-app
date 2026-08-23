# Discord機能キャッチアップ: salesanchor → crm-app 移植判断ドキュメント

作成日: 2026-08-24  
調査対象: `~/salesanchor`（参照元） / `~/crm-app-new`（移植先）  
調査方法: 両リポジトリのソースコード実読 + crm-app全文grep

---

## C6: crm-appの既存実装確認（最終確定）

以下のgrepをcrm-app全体に対して実行した結果、**全て0件**。

| 検索語 | 対象 | 件数 |
|--------|------|------|
| `oauth\|OAuth\|authorize\|authorization_code\|client_secret` | `src/`（Discord OAuth限定） | 0件（GCP OAuth のみヒット・Discord無関係） |
| `oauth\|OAuth\|authorize\|authorization_code` | `frontend/src/` | 0件 |
| `channels.*create\|createChannel\|GUILD_TEXT\|permission_overwrites` | `src/` | 0件 |
| `channels.*create\|createChannel` | `frontend/src/` | 0件 |
| `ticket\|Ticket\|チケット` | `src/` | 0件 |
| `ticket\|Ticket\|チケット` | `frontend/src/` | 0件 |
| `guild_id\|guild\.id\|discord\.com/api/oauth2\|bot.*invite` | `src/` | 0件 |

**【事実】Discord OAuth連携・チャンネル作成・チケット発行の実装はcrm-appに存在しない。**

---

## C1: OAuthフロー全体

| 項目 | salesanchorの実装 | 根拠 |
|------|-----------------|------|
| scope | `bot applications.commands` | `salesanchor/backend/app/routers/discord_oauth.py:90` |
| response_type | `code`（Authorization Codeフロー） | 同:91 |
| client_secret | **使用しない**（Bot Invite フローのため不要） | 同:80-95 |
| redirect_uri | 環境変数 `DISCORD_CALLBACK_URL`（デフォルト: `https://api.salesanchor.jp/api/v1/discord/oauth/callback`） | 同:73-76 |
| callback処理 | `GET /discord/oauth/callback` — guild_id取得→state検証→DB upsert→フロントへリダイレクト | 同:138-217 |
| stateパラメータ | あり（`secrets.token_urlsafe(32)` 256bit、Redis保存・TTL600秒・atomic one-time消費） | `salesanchor/backend/app/services/oauth_state.py:52-173` |

**crm-app移植時の差分**:
- GASにはRedisがない。state保存は `CacheService.getScriptCache()`（TTL最大6時間、スクリプトレベルのkey-value）で代替可能
- redirect_uriの動的取得: `ScriptApp.getService().getUrl()` でWebApp URLを実行時に取得し、Discord Developer Portalに登録したURLと突合する（ハードコード禁止）
- GASの `doGet(e)` がcallback受信エンドポイントとして機能する

---

## C2: Bot招待の仕組み

| 項目 | salesanchorの実装 | 根拠 |
|------|-----------------|------|
| 招待URL生成関数 | `_build_invite_url(state: str)` | `salesanchor/backend/app/routers/discord_oauth.py:80-95` |
| permissions値 | `805432406`（整数） | 同:48-72 |
| permissions内訳 | Manage Roles(32) / Manage Channels(16) / View Channels(1024) / Send Messages(2048) / Read Message History(65536) / Kick Members(2097152) / Ban Members(4194304) | 同:48-72 |
| guild_id取得 | callbackのquery parameter `guild_id` から直接取得 | 同:140 |
| guild_id保存先 | `public.tenant_discord_config` テーブル（ON CONFLICT upsert） | 同:189-201 |

**crm-app移植時の差分**:
- DBテーブルなし→スクリプトプロパティ `DISCORD_GUILD_ID` に保存
- permissions値はcrm-appの要件（チャンネル作成・メッセージ送信のみ）に合わせて最小化を検討する（後述S5）

---

## C3: チャンネル作成

| 項目 | salesanchorの実装 | 根拠 |
|------|-----------------|------|
| エンドポイント | `POST /guilds/{guild_id}/channels`（Discord REST API v10） | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:292` |
| HTTP共通関数 | `discord_rest.py` の汎用REST呼び出し | `salesanchor/backend/app/services/discord_rest.py:34-136` |
| 作成タイミング（1） | 管理者が `POST /admin/discord/auto-setup` を実行した直後（カテゴリ・固定チャンネル群を作成） | `salesanchor/backend/app/routers/discord_auto_setup.py:79-397` |
| 作成タイミング（2） | 顧客がDiscordで「チケットを開く」ボタンを押した直後（顧客専用チャンネル） | `salesanchor/backend/app/discord_gateway/client.py:122-202` |
| 命名: カテゴリ | 固定値 `Sales Anchor` | `discord_auto_setup.py:224` |
| 命名: ticket-start | 固定値 `ticket-start` | 同:248 |
| 命名: 顧客チケット | `ticket-{customer_name}-{last4_of_discord_user_id}` | `ticket_channel_creator.py:164-171` |
| 権限: カテゴリ | @everyone: 全deny / Bot: VIEW+SEND+READ+MANAGE_CHANNELS allow | `discord_auto_setup.py:207-221` |
| 権限: ticket-start | @everyone: VIEW allow・SEND deny / Staffロール+Bot: SEND allow | 同:637-668 |
| 権限: 顧客チャンネル | @everyone: deny / 顧客・Staff・Bot: VIEW+SEND+READ allow（プライベート） | `ticket_channel_creator.py:266-283` |

**crm-app移植時の差分**:
- GASからDiscord REST APIへのHTTP呼び出しは `UrlFetchApp.fetch()` で実現可能
- 既存の `33_DiscordIntegrationService.js` がv10 REST基盤を持つため流用可能
- 作成タイミング（2）はGateway Botが必要（後述C4参照）

---

## C4: チケット発行

| 項目 | salesanchorの実装 | 根拠 |
|------|-----------------|------|
| 「チケット」の実体 | **顧客専用プライベートチャンネルの作成**（番号発行なし） | `ticket_channel_creator.py:212-383` |
| チャンネル名 | `ticket-{customer_name}-{last4_of_discord_user_id}` | 同:164-171 |
| 初期メッセージ | チャンネル作成直後にウェルカムメッセージを自動送信 | 同:298-325 |
| トリガー | 顧客がDiscordの **「チケットを開く」ボタン**を押下（Discord GatewayイベントによるInteraction） | `client.py:122-202` |
| データ保存先 | `tenant_{id}.leads` テーブル（discord_guild_channel_id カラム） | `ticket_channel_creator.py:330-380` |
| 冪等性 | 同一discord_user_idで既存チャンネルがあれば再利用、削除済みなら再作成 | 同:241-263 |
| クローズ処理 | **自動削除なし**（管理者手動削除）。ticket-startへのアクセスをdenyCHANNEL_VIEW に変更するのみ | 同:174-209 |

### ⚠️ 重要: トリガー実装の技術的差異

salesanchorのチケットトリガーは **Discord Gateway（永続WebSocket接続）上のInteraction** によって動作する。
GASは永続プロセスを維持できないため、**このトリガーはそのまま移植不可**。

移植可能な代替案は以下の**2通り**が存在する:

| 案 | 内容 | 追加要件 |
|----|------|---------|
| 案α | CRM画面から手動でチケット（専用チャンネル）を作成 | なし（GASで完結） |
| 案β | Discord外部からのWebhookを受け取るエンドポイント（`doPost`）を実装し、Interaction受信を試みる | Discordのinteractions endpoint URLの登録・署名検証（Ed25519）が必要 |

**→ 判断が2通り以上あるため、C4（チケット発行）の移植仕様はShingoへの確認が必要。Phase 2-Cは停止・報告。**

---

## C5: マルチテナント固有部分（持ち込まないリスト）

| 持ち込まないコード | salesanchorでの実装場所 | 理由 |
|-----------------|----------------------|------|
| guild_id → tenant_id の逆引きロジック | `client.py:72-99` | crm-appは1ブック＝1テナント（単一Bot）、逆引き不要 |
| `SET search_path = tenant_{id}` | `auth/dependencies.py:255-277` | GASにDBスキーマなし |
| `set_tenant_context()` | 同上 | 同上 |
| RLSポリシー（`app.tenant_id`） | `migrations/097_create_company_discord.sql:68-85` | GASにRLS概念なし |
| Redis state管理コード | `services/oauth_state.py:52-173` | GASにRedisなし（CacheServiceで代替） |
| `public.tenant_discord_config` テーブル定義 | `migrations/` 各SQL | GASはスクリプトプロパティで代替 |
| Bot再接続ロジック（discord.pyのGateway） | `client.py:261-305` | GASは常駐プロセス不可 |

---

## 機能インベントリ表

| 機能 | salesanchorにあるか | crm-appにあるか | 移植要否 |
|------|-------------------|----------------|---------|
| Botトークン保存・接続テスト | ○ | **○（PR#438実装済み）** | 不要 |
| チャンネルID登録 | ○ | **○（PR#438実装済み）** | 不要 |
| プル型メッセージ取得 | △（Gateway型） | ○（`33_DiscordIntegrationService.js`） | 不要 |
| OAuth Bot招待フロー（URL生成） | ○ | ✗ | **必要（Phase 2-A）** |
| OAuth callback処理（guild_id保存） | ○ | ✗ | **必要（Phase 2-A）** |
| state CSRF保護 | ○（Redis） | ✗ | **必要（CacheServiceで代替、Phase 2-A）** |
| auto-setup（カテゴリ・固定チャンネル作成） | ○ | ✗ | **必要（Phase 2-B）** |
| 顧客専用チケットチャンネル作成 | ○ | ✗ | **要仕様確認（Phase 2-C）** |
| Discord Gatewayボタンイベント受信 | ○（discord.py） | ✗ | **移植不可**（GAS常駐不可） |
| Ed25519署名検証（Interactions endpoint） | ✗ | ✗ | 案βを採用する場合に必要 |

---

## 移植差分表

| 項目 | 判断 | 理由 |
|------|------|------|
| OAuth URL生成ロジック | **改変して流用** | RedisなしのためCacheServiceで代替。GASのdoGetをcallbackに使用 |
| permissions値（805432406） | **要確認・削減候補** | Kick/Ban Membersはcrm-appの用途では不要の可能性。S5で内訳・必要性を記録して決定 |
| `UrlFetchApp.fetch()` でのREST呼び出し | **既存流用** | `33_DiscordIntegrationService.js` の `callDiscordApi_()` を拡張 |
| guild_id保存 | **改変** | テーブルなし→スクリプトプロパティ `DISCORD_GUILD_ID` |
| チャンネル命名規則 | **そのまま流用可** | `ticket-{customer_name}-{last4}` はcrm-appでも自然 |
| permission_overwrites構造 | **そのまま流用** | @everyone deny / 顧客+Staff+Bot allow のパターンは同じ |
| チケットトリガー | **持ち込まない** | Gatewayイベント不可。案α/βをShingoが決定 |
| Redis state管理 | **持ち込まない・CacheServiceで再実装** | GAS固有の代替手段で同等のCSRF保護を実現 |
| マルチテナント振り分け全般 | **持ち込まない** | 1ブック=1テナント前提のため不要 |

---

## Phase 2 進行判定（Phase 1完了時点）

| 機能 | 判定 | 根拠 |
|------|------|------|
| **A: OAuth招待フロー** | **✅ 実装に進む** | C1・C2確定。CacheService代替でstate CSRF保護を実現可能 |
| **B: チャンネル作成（auto-setup）** | **✅ 実装に進む** | C3確定。GASからUrlFetchApp経由でDiscord REST v10を呼び出し可能 |
| **C: チケット発行** | **🛑 停止・Shingo確認待ち** | C4でトリガー仕様が2通り（案α: CRM手動 / 案β: Interactions endpoint + Ed25519）に分岐。一意に定まらないため実装しない |

### Shingo確認事項（C停止の理由）

> **Q: チケット（顧客専用Discordチャンネル）の作成をどちらで行いますか？**
>
> - **案α（推奨）**: CRM画面（Discord連携設定ページ）から担当者が手動でボタンを押して作成  
>   → GASのみで完結。追加インフラ不要
>
> - **案β**: Discordの「チケットを開く」ボタンを顧客が押したときに自動作成  
>   → GAS `doPost` でDiscord Interactions endpointを実装し、Ed25519署名検証が必要。Discordのアプリ設定でInteractions Endpoint URLの事前登録も必要

---

## C1〜C6 根拠パス一覧

| # | 根拠ファイルパス |
|---|----------------|
| C1 scope/response_type | `salesanchor/backend/app/routers/discord_oauth.py:90-91` |
| C1 client_secret不使用 | `salesanchor/backend/app/routers/discord_oauth.py:80-95` |
| C1 redirect_uri | `salesanchor/backend/app/routers/discord_oauth.py:73-76` |
| C1 callback処理 | `salesanchor/backend/app/routers/discord_oauth.py:138-217` |
| C1 state実装 | `salesanchor/backend/app/services/oauth_state.py:52-173` |
| C2 招待URL生成 | `salesanchor/backend/app/routers/discord_oauth.py:80-95` |
| C2 permissions値 | `salesanchor/backend/app/routers/discord_oauth.py:48-72` |
| C2 guild_id保存 | `salesanchor/backend/app/routers/discord_oauth.py:189-201` |
| C3 エンドポイント | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:292` |
| C3 auto-setup | `salesanchor/backend/app/routers/discord_auto_setup.py:79-397` |
| C3 チャンネル命名 | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:164-171` |
| C3 permission_overwrites | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:266-283` |
| C4 チケット実体 | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:212-383` |
| C4 トリガー | `salesanchor/backend/app/discord_gateway/client.py:122-202` |
| C4 冪等性 | `salesanchor/backend/app/discord_gateway/ticket_channel_creator.py:241-263` |
| C5 テナント振り分け | `salesanchor/backend/app/discord_gateway/client.py:72-99` |
| C5 RLS設定 | `salesanchor/backend/app/auth/dependencies.py:255-277` |
| C5 guild_id UNIQUE制約 | `salesanchor/migrations/20260626_120000_add_unique_guild_id_to_tenant_discord_config.sql:22` |
| C6 crm-app全文grep | 本ファイル冒頭の表（全0件確定） |
