# Discord実装インベントリ

> 作成: 2026-08-26 / 根拠: ファイル実読（src/ + frontend/src/ 全量grep）
> 招待URL方式への切替後、案α時代の実装残存を整理した記録。
> **削除は実行しない。** 一覧化して判断を記録することがこのドキュメントのスコープ。

---

## 1. 関連ファイル一覧

| ファイル | 役割 | 現行方式か |
|---------|------|-----------|
| `src/33_DiscordIntegrationService.js` | メッセージ取得・会話ログ同期 | ○ 継続利用 |
| `src/34_DiscordSettingsApi.js` | Botトークン・チャンネルID保存/取得 | ○ 継続利用 |
| `src/35_DiscordOAuthApi.js` | Bot招待URL生成・Guild連携確認 | ○ 継続利用 |
| `src/36_DiscordChannelSetupApi.js` | カテゴリ・crm-ticketsチャンネル作成 | ○ 継続利用 |
| `src/37_DiscordTicketApi.js` | **案α**: 顧客専用チャンネルを即時作成 | △ 一部参照あり（後述） |
| `src/38_DiscordCustomerInviteApi.js` | 招待URL方式: 1回限り招待URL発行 | ○ **現行方式** |
| `src/40_DiscordInviteChannelProvisioning.js` | 招待URL方式: 顧客参加後チャンネル自動生成 | ○ **現行方式** |

---

## B1: `37_DiscordTicketApi.js` の呼び出し元

### GAS側（`src/`）
| 呼び出し元ファイル | 呼び出す関数 | 備考 |
|-----------------|------------|------|
| `src/40_DiscordInviteChannelProvisioning.js:19` | `buildDiscordTicketChannelName_()` | `provisionDiscordInviteChannels()` 内で使用中 |

`createDiscordTicketForCustomer()` 自体をGAS内から呼ぶ箇所はない（フロントエンド経由のみ）。
`buildDiscordTicketChannelName_()` は `40_` から依存されており、**現行の招待URL方式でも使われている**。

### フロントエンド側（`frontend/src/`）
| ファイル | 参照形式 | 備考 |
|---------|---------|------|
| `frontend/src/gas/client.ts:1052` | `createDiscordTicketForCustomer()` をエクスポート | GAS関数バインディング |
| `frontend/src/features/customers/gasAdapter.ts:8` | `createDiscordTicket: createDiscordTicketForCustomer` | CustomerRepository実装 |
| `frontend/src/features/customers/contracts.ts` | `createDiscordTicket` フィールドを定義 | Repository型定義 |
| `frontend/src/preview/gasRunnerMock.ts:557` | mock実装（成功固定） | preview用 |
| `frontend/src/pages/customers/CustomerDetailPage.tsx:27` | `issueDiscordTicket` コールバック定義 | 実際にはUIから呼ばれない（後述） |

### UIからの到達可能性
`CustomerDetailPage.tsx:34` のJSXを実読した結果:
- `canIssueDiscordTicket` が true の場合にDiscordカードを表示
- カード内のボタンは `issueDiscordInvite()` を呼ぶ（`repository.createDiscordInvite()`）
- `issueDiscordTicket()` はコールバックとして定義されているが、**対応するボタンはJSXに存在しない**
- **現状、UIから `createDiscordTicketForCustomer` に到達する経路はない**

---

## B2: `crm-tickets` チャンネルの現在の用途

`DISCORD_SETUP_TICKET_CHANNEL_NAME = 'crm-tickets'`（`36_DiscordChannelSetupApi.js:16`）

| 用途 | ファイル:行 | 内容 |
|------|-----------|------|
| 作成 | `36_:202` | `runDiscordAutoSetup()` が POST `/guilds/{id}/channels` で作成 |
| 保存 | `36_:225` | Script Property `DISCORD_TICKET_CHANNEL_ID` に保存 |
| **招待URL発行先** | `38_:42-45` | `createDiscordInviteForCustomer()` が `DISCORD_TICKET_CHANNEL_ID` に対して POST `/channels/{id}/invites` を実行 |

**結論: `crm-tickets` チャンネルは招待URL方式（現行）で必須。廃止不可。**

`crm-tickets` から発行された招待URLで顧客がGuildに参加すると、
`provisionDiscordInviteChannels()` が顧客専用チャンネルを別途作成する。

---

## B3: 招待URL方式と案αの重複・矛盾一覧

| # | 重複/矛盾の内容 | 影響 |
|---|--------------|------|
| R1 | どちらの方式も「顧客専用チャンネル」を作成する | `DISCORD_CHANNEL_ID` 列で既存チェックがあるため二重作成にはならないが、目的が重複している |
| R2 | `createDiscordTicketForCustomer()` は `DISCORD_USER_ID` が必須。招待URL方式は不要（参加後に `DISCORD_USER_ID` を記録） | `37_` は旧前提（Discord IDが事前判明）に依存 |
| R3 | `CustomerDetailPage.tsx` に `issueDiscordTicket` コールバックが残存しているが、UIボタンは招待URLのみ | デッドコード |
| R4 | `frontend/` の `createDiscordTicket` 型・アダプター・モックが残存 | TypeScript型としては整合しているが、実際には使われない |
| R5 | `buildDiscordTicketChannelName_()` は `37_` に定義されているが `40_` が依存している | 関数の所属ファイルが意味的に不整合 |

---

## B4: 削除・改修の候補一覧と影響範囲

### 候補1: `createDiscordTicketForCustomer()` と関連フロントエンド実装の削除

**削除対象:**
- `src/37_DiscordTicketApi.js` — `createDiscordTicketForCustomer()` 関数
- `frontend/src/gas/client.ts:1052` — `createDiscordTicketForCustomer` エクスポート
- `frontend/src/gas/types.d.ts:56` — `createDiscordTicketForCustomer` 型定義
- `frontend/src/features/customers/gasAdapter.ts:8` — `createDiscordTicket` マッピング
- `frontend/src/features/customers/contracts.ts` — `createDiscordTicket` フィールド
- `frontend/src/preview/gasRunnerMock.ts:557-560` — mock実装
- `frontend/src/pages/customers/CustomerDetailPage.tsx:27` — `issueDiscordTicket` コールバック・state

**影響範囲:**
- UIへの影響: なし（ボタンが存在しない）
- GAS配布への影響: なし（未呼出し）
- `40_DiscordInviteChannelProvisioning.js` への影響: **あり** — `buildDiscordTicketChannelName_()` を使っているため、削除前に`40_`へ移動が必要

**前提作業:** `buildDiscordTicketChannelName_()` を `40_DiscordInviteChannelProvisioning.js` へ移動してから `37_` を削除する。

---

### 候補2: `buildDiscordTicketChannelName_()` を `40_` へ移動

**改修対象:** `src/37_DiscordTicketApi.js` → `src/40_DiscordInviteChannelProvisioning.js`

**影響範囲:** `40_` が `37_` に依存しているのは `buildDiscordTicketChannelName_()` のみ。移動後、`37_` の `createDiscordTicketForCustomer()` 内の呼び出しも同関数を使っているが、候補1の削除と同時に行えば問題ない。

**リスク:** GASは同一プロジェクト内で全関数がグローバルスコープ共有のため、移動先ファイルを問わず動作する。ただし関数名が重複しないよう注意。

---

### 候補3: `canIssueDiscordTicket` prop の整理

`CustomerDetailPage.tsx` の `canIssueDiscordTicket: boolean` propは現在、Discordカード表示制御に使われているが、カード内の操作は招待URLのみ。名称が実態（招待URL発行）と乖離している。

**影響範囲:** prop名変更のみ。`CustomerDetailPage` の呼び出し元（`CustomersPage.tsx` 等）を合わせて変更が必要。型エラーで漏れなく検出可能。

---

## 決定事項と推奨アクション

| # | アクション | 優先度 | 依存 |
|---|----------|--------|------|
| 1 | `buildDiscordTicketChannelName_()` を `40_` へ移動 | 高 | なし |
| 2 | `createDiscordTicketForCustomer()` と関連フロントエンド実装を削除 | 高 | #1完了後 |
| 3 | `canIssueDiscordTicket` prop名を `canIssueDiscordInvite` に変更 | 低 | #2完了後 |

**実行前確認事項:**
- `canIssueDiscordTicket` の値が `true` になる条件（権限マスタ等）を確認すること
- `37_` 削除後、CI の `gas-global-namespace` チェックが通ることを確認すること
