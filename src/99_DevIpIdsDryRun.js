/**
 * 取り扱いタイトル → 作品ID 変換 DRY RUN
 *
 * dryRunIpIdsMigration()
 *   書き込みを一切行わず、変換結果をログ出力して返す。
 *
 *   報告内容:
 *     - 変換成功件数（行単位）
 *     - 変換不可の値（マスタ不一致）— 行番号・リードID・値を全件列挙
 *     - 空欄でスキップした件数
 *
 *   ★ 変換不可の値が1件でもある場合は結果を報告して処理を止める。
 *     第4段階（実変換）は承認を得てから別途実行する。
 *
 * 実行方法:
 *   clasp run dryRunIpIdsMigration
 */

/**
 * 取り扱いタイトル → 作品ID の変換 DRY RUN。書き込みなし。
 *
 * @returns {{ converted: number, skipped: number, unknown: { rowNumber: number, leadId: string, value: string }[] }}
 */
function dryRunIpIdsMigration() {
  var ss = getSpreadsheet();

  // ── 作品マスタを読み込む ──────────────────────────────────────────────────
  var masterSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (!masterSheet) throw new Error('作品マスタ_共用在庫シートが見つかりません');

  var masterLastRow = masterSheet.getLastRow();
  var masterLastCol = masterSheet.getLastColumn();
  if (masterLastRow < 2) throw new Error('作品マスタにデータがありません');

  var masterData    = masterSheet.getRange(1, 1, masterLastRow, masterLastCol).getValues();
  var masterHeaders = masterData[0].map(String);

  var ipIdIdx   = masterHeaders.indexOf('ip_id');
  var nameIdx   = masterHeaders.indexOf('title');
  var aliasIdx  = masterHeaders.indexOf('alias');
  var activeIdx = masterHeaders.indexOf('is_active');
  if (ipIdIdx  < 0) throw new Error('作品マスタに「ip_id」列がありません');
  if (nameIdx  < 0) throw new Error('作品マスタに「title」列がありません');

  // 名称・別名 → ip_id マップ（有効・無効問わず全件）
  var nameToId = {};
  for (var m = 1; m < masterData.length; m++) {
    var ipId  = String(masterData[m][ipIdIdx]  || '').trim();
    var name  = String(masterData[m][nameIdx]  || '').trim();
    var alias = aliasIdx >= 0 ? String(masterData[m][aliasIdx] || '').trim() : '';
    if (!ipId) continue;
    if (name)  nameToId[name]  = ipId;
    if (alias) nameToId[alias] = ipId;
  }

  Logger.log('作品マスタ読み込み完了: エントリ数=' + Object.keys(nameToId).length);

  // ── リード管理を読み込む ─────────────────────────────────────────────────
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders     = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var titleColIdx     = leadHeaders.indexOf('handled_title');
  var leadIdColIdx    = leadHeaders.indexOf('lead_id');
  if (titleColIdx  < 0) throw new Error('リード管理に「handled_title」列がありません');
  if (leadIdColIdx < 0) throw new Error('リード管理に「lead_id」列がありません');

  var allData = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();

  // ── DRY RUN ──────────────────────────────────────────────────────────────
  var converted = 0;
  var skipped   = 0;
  var unknownRows = [];

  for (var r = 0; r < allData.length; r++) {
    var titleVal = String(allData[r][titleColIdx] || '').trim();
    var leadId   = String(allData[r][leadIdColIdx] || '').trim();
    var rowNumber = r + 2; // 1-indexed + header

    if (!titleVal) {
      skipped++;
      continue;
    }

    // カンマ区切りで分割し、各パーツを変換
    var parts = titleVal.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
    var hasUnknown = false;

    for (var p = 0; p < parts.length; p++) {
      if (!nameToId[parts[p]]) {
        unknownRows.push({ rowNumber: rowNumber, leadId: leadId, value: parts[p] });
        hasUnknown = true;
      }
    }

    if (!hasUnknown) converted++;
  }

  // ── ログ出力 ─────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('=== 取り扱いタイトル → 作品ID DRY RUN ===');
  Logger.log('');
  Logger.log('変換成功（全パーツ一致）: ' + converted + '行');
  Logger.log('空欄スキップ            : ' + skipped   + '行');
  Logger.log('変換不可（マスタ不一致）: ' + unknownRows.length + '件');
  Logger.log('');

  if (unknownRows.length > 0) {
    Logger.log('【変換不可の値（全件）】');
    unknownRows.forEach(function(u) {
      Logger.log('  行' + u.rowNumber + ' / LeadID=' + u.leadId + ' / 値="' + u.value + '"');
    });
    Logger.log('');
    Logger.log('★ 変換不可あり → 第4段階（実変換）は実施しない。上記を確認して対処を決めること。');
  } else {
    Logger.log('★ 全値マスタ一致 → 第4段階（実変換）に進んで構いません。');
  }

  Logger.log('');
  Logger.log('=== DRY RUN 完了（書き込みなし）===');

  return { converted: converted, skipped: skipped, unknown: unknownRows };
}
