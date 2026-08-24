# リポジトリ・クローン・バックアップの正誤表（恒久記録）

最終更新: 2026-08-25
目的: 履歴書き換え（redaction 2回・2026-08-24実施）以降、どのリポジトリ・クローン・バックアップを使うべきかを一意に定め、セッション間の混乱を防ぐ。

## 唯一の正（これだけを使う）

| 対象 | 場所 | 備考 |
|---|---|---|
| リモートリポジトリ | GitHub: GEN-RYU-System/crm-app | public運用。可視性変更禁止 |
| ローカル正クローン | `~/crm-app-canonical-20260824` | .clasp.json 配置済み。全エージェント作業はここでのみ行う |

## 使用禁止（存在するが触らない）

| 対象 | 場所 | 理由 |
|---|---|---|
| バックアップ① | `~/crm-app-history-backup-20260824/crm-app-backup-20260824.bundle` | 黒塗り1回目直前の旧履歴。**除去済みの機密（顧客実名）を含む**。復元・push厳禁 |
| バックアップ② | `~/crm-app-history-backup-20260824-redaction2/crm-app-backup-redaction2-20260824.bundle` | 黒塗り2回目準備時点。**実メール・電話番号・旧シートIDを含む**。復元・push厳禁 |
| バックアップ③ | `~/crm-app-history-backup-20260824-redaction2-final/crm-app-redaction2-final.bundle` | 黒塗り2回目直前。同上。復元・push厳禁 |
| 旧クローン群 | `~/crm-app-rewritten-20260824` / `~/crm-app-redaction2-work-20260824` / その他過去のクローン | 役目終了。削除可。**ここからのpush/fetchは除去済み機密の再混入事故になるため厳禁** |
| ゴミ箱内 | `~/.Trash/crm-app-new-retired-20260824` | .clasp.json回収済み。自然削除に任せる |

## バックアップの用途と扱い

- 用途は1つだけ: 履歴書き換えで必要なコードまで壊れていたと後日判明した場合の**読み取り専用の参照**。
- 3バンドルはローカルMacにのみ存在（クラウド未保管）。保全または廃棄の判断はオーナーのみが行う。
- バンドルから復元した内容を、いかなる形でも現リポジトリへpushしてはならない。

## 旧SHAの読み替え

- 2026-08-24より前に記録されたコミットSHA・revert SHAは、2回の履歴書き換えにより現行履歴には存在しない。
- 読み替えは `docs/SHA_REMAP_20260824.md`（1回目）→ `docs/SHA_REMAP_20260824_v2.md`（2回目）の順に連結して行う。

## 全セッション共通ルール（要点）

1. 新しく作業を始めるときは `~/crm-app-canonical-20260824` を使う。古いクローンを見つけても使わない・pullしない。
2. リポジトリはpublic。実名・実メール・電話番号・スプレッドシートIDをコード/docs/テストデータに書かない（ダミー値とScript Properties参照を使う）。CIのSecurity Content Checkが混入PRを自動で落とす。
3. PRはsquash mergeのみ。revert SHAを `docs/AUTONOMOUS_WORK_LOG.md` に記録。force push禁止・可視性変更禁止。
4. スプレッドシートの現役ブックはScript Propertiesが指すもののみ（DEV = DEV_CRM APP_MIGRATED_20260824）。名前に RETIRED を含むブックは使用しない。
