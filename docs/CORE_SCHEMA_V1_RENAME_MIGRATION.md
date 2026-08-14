# Core Schema V1: 発送・仕入れの改名移行

## 現在の状態

- `SHIPMENTS` の active `sheetName` は `発送`。
- `PURCHASES` の active `sheetName` は `仕入れ`。
- `発送管理` と `仕入れ管理` は将来の canonicalName として Registry にだけ記録する。
- 既存 `CONFIG.SHEETS` は現在も `発送` と `仕入れ` を返す。今回のPRは改名対応済みとは扱わない。

## 改名を実施するための別PR

手動改名を許可するPO承認後、専用の移行PRで次を順に実施する。

1. DEVで全参照先とデプロイ済みコードの互換性を検証する。
2. POがDEVの2シートを手動で `発送管理` / `仕入れ管理` へ改名する。
3. 同じPRで `SHIPMENTS.sheetName` / `PURCHASES.sheetName` を canonicalName へ切替え、旧名を alias として残す。
4. DEVで既存CONFIG経由の処理を確認し、別承認後にPRODへ展開する。

このPRでは、シート改名・active sheetName 切替え・既存データ変更を行わない。
