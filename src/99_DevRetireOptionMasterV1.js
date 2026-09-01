/**
 * DEV専用: 選択肢マスタ（旧横持ちシート）の廃止手続き。
 *
 * 対象シート: '選択肢マスタ'
 * 手順:
 *   1. バックアップを作成する（選択肢マスタ_backup_predelete_20260901）
 *   2. 旧シートを廃止名にリネームする（選択肢マスタ_廃止_20260901）
 *
 * 制約:
 *   - DEV 環境でのみ実行可
 *   - 冪等: バックアップが既存の場合は作成をスキップ
 *   - 旧シートは削除しない（廃止名にリネームのみ）
 *
 * 実行順:
 *   clasp run devRetireOptionMasterV1DryRun  → 現状確認
 *   clasp run devRetireOptionMasterV1Execute → 実施
 */

var V1_ORIGINAL_SHEET  = '選択肢マスタ';
var V1_BACKUP_SHEET    = '選択肢マスタ_backup_predelete_20260901';
var V1_RETIRED_SHEET   = '選択肢マスタ_廃止_20260901';

/**
 * dry-run: 旧シートの現状を報告する（書き込みなし）
 * @returns {string} JSON.stringify({ originalExists, backupExists, retiredExists, originalRows, originalCols, plan })
 */
function devRetireOptionMasterV1DryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('devRetireOptionMasterV1DryRun は DEV 環境でのみ実行できます');
  }

  var ss       = getSpreadsheet();
  var original = ss.getSheetByName(V1_ORIGINAL_SHEET);
  var backup   = ss.getSheetByName(V1_BACKUP_SHEET);
  var retired  = ss.getSheetByName(V1_RETIRED_SHEET);

  return JSON.stringify({
    originalSheet: V1_ORIGINAL_SHEET,
    originalExists: !!original,
    originalRows:   original ? original.getLastRow()    : 0,
    originalCols:   original ? original.getLastColumn() : 0,
    backupExists:   !!backup,
    retiredExists:  !!retired,
    plan: [
      'step1: copyTo → ' + V1_BACKUP_SHEET + (backup ? ' (スキップ: 既存)' : ''),
      'step2: setName → ' + V1_RETIRED_SHEET
    ]
  });
}

/**
 * 実施: バックアップ作成 → 旧シートをリネーム → 検証
 * @returns {string} JSON.stringify({ backup, renamed, originalRemoved, ok })
 */
function devRetireOptionMasterV1Execute() {
  if (getEnvironment() !== 'development') {
    throw new Error('devRetireOptionMasterV1Execute は DEV 環境でのみ実行できます');
  }

  var ss       = getSpreadsheet();
  var original = ss.getSheetByName(V1_ORIGINAL_SHEET);
  if (!original) {
    return JSON.stringify({ error: '旧シートが見つかりません: ' + V1_ORIGINAL_SHEET });
  }

  // ── step1: バックアップ作成（冪等） ─────────────────────────────────────
  var existingBackup = ss.getSheetByName(V1_BACKUP_SHEET);
  if (!existingBackup) {
    var backupSheet = original.copyTo(ss);
    backupSheet.setName(V1_BACKUP_SHEET);
  }

  // ── step2: 旧シートをリネーム ──────────────────────────────────────────
  original.setName(V1_RETIRED_SHEET);

  // ── 検証 ──────────────────────────────────────────────────────────────
  var afterOriginal = ss.getSheetByName(V1_ORIGINAL_SHEET);
  var afterRetired  = ss.getSheetByName(V1_RETIRED_SHEET);
  var afterBackup   = ss.getSheetByName(V1_BACKUP_SHEET);

  return JSON.stringify({
    backup:          { name: V1_BACKUP_SHEET,  existed: !!existingBackup, exists: !!afterBackup },
    renamed:         { name: V1_RETIRED_SHEET, exists:  !!afterRetired },
    originalRemoved: !afterOriginal,
    ok: !afterOriginal && !!afterRetired && !!afterBackup
  });
}
