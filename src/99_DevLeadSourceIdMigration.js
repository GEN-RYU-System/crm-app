/**
 * 流入元ID列 追加・移行マイグレーション
 *
 * addLeadSourceIdColumn()
 *   リード管理シートに「流入元ID」列を挿入する（冪等）
 *
 * applyLeadSourceIdMigration()
 *   流入元マスタの名称→IDマップを使い、流入元ID列にIDを書き込む。
 *   withSheetWrite_（ロック＋キャッシュ削除）を使用。
 *   ★ dryRunLeadSourceIdMigration() で承認を得てから実行すること。
 *
 * surveyLeadSourceIdColumn()
 *   流入元ID列と流入経路列の分布を出力する（書き込みなし）。
 *
 * 実行方法:
 *   clasp run addLeadSourceIdColumn
 *   clasp run applyLeadSourceIdMigration
 *   clasp run surveyLeadSourceIdColumn
 */

/**
 * リード管理シートに「流入元ID」列を追加する（冪等）。
 *
 * - 既存の「流入経路」列の直後に挿入する。
 * - 列がすでに存在する場合は何もしない。
 * - 全行は空欄のまま（変換は別の移行ステップで行う）。
 *
 * @returns {string} 実行結果メッセージ
 */
function addLeadSourceIdColumn() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  if (headers.indexOf('流入元ID') !== -1) {
    Logger.log('列既存: 流入元ID（スキップ）');
    return '列既存: 流入元ID';
  }

  var sourceIdx = headers.indexOf('流入経路');
  if (sourceIdx === -1) throw new Error('「流入経路」列が見つかりません');

  // insertColumnAfter は 1-based インデックスを取る
  sheet.insertColumnAfter(sourceIdx + 1);
  sheet.getRange(1, sourceIdx + 2).setValue('流入元ID');

  var newLastCol     = sheet.getLastColumn();
  var updatedHeaders = sheet.getRange(1, 1, 1, newLastCol).getValues()[0].map(String);
  var newIdx         = updatedHeaders.indexOf('流入元ID');

  Logger.log('列追加完了: 流入元ID（列' + (newIdx + 1) + '、流入経路 の直後）');
  Logger.log('総列数: ' + newLastCol);
  return '列追加完了: 流入元ID（列' + (newIdx + 1) + '）、総列数: ' + newLastCol;
}

// ── 移行実行（★承認後のみ）─────────────────────────────────────────────────

/**
 * 流入元マスタの名称→IDマップを使い、リード管理の「流入元ID」列にIDを書き込む。
 * 一括書き込み（setValues）で全列を 1 回の API 呼び出しで処理する。
 * ★ dryRunLeadSourceIdMigration() の承認を得てから実行すること。
 *
 * スキップ条件:
 *   - 流入経路が空欄 → skipped
 *   - 流入元マスタに名称が無い → unknown
 *
 * @returns {{ updated: number, skipped: number, unknown: number }}
 */
function applyLeadSourceIdMigration() {
  var ss = getSpreadsheet();

  // ── 流入元マスタを読み込む ─────────────────────────────────────────────
  var masterSheet = ss.getSheetByName('流入元マスタ');
  if (!masterSheet) throw new Error('流入元マスタシートが見つかりません');

  var masterLastCol = masterSheet.getLastColumn();
  var masterLastRow = masterSheet.getLastRow();
  if (masterLastRow < 2) throw new Error('流入元マスタにデータがありません');

  var masterData    = masterSheet.getRange(1, 1, masterLastRow, masterLastCol).getValues();
  var masterHeaders = masterData[0].map(String);
  var nameIdx       = masterHeaders.indexOf('名称');
  var idIdx         = masterHeaders.indexOf('source_id');
  if (nameIdx < 0) throw new Error('流入元マスタに「名称」列がありません');
  if (idIdx   < 0) throw new Error('流入元マスタに「source_id」列がありません');

  // 名称 → source_id のマップ（有効・無効問わず全件）
  var nameToId = {};
  for (var m = 1; m < masterData.length; m++) {
    var mName = String(masterData[m][nameIdx] || '').trim();
    var mId   = String(masterData[m][idIdx]   || '').trim();
    if (mName && mId) nameToId[mName] = mId;
  }

  // ── リード管理を読み込む ─────────────────────────────────────────────
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders    = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var sourceColIdx   = leadHeaders.indexOf('流入経路');
  var sourceIdColIdx = leadHeaders.indexOf('流入元ID');
  if (sourceColIdx   < 0) throw new Error('リード管理に「流入経路」列がありません');
  if (sourceIdColIdx < 0) throw new Error('リード管理に「流入元ID」列がありません');

  return withSheetWrite_({
    useLock: true,
    cacheTargets: [
      { indexKey: 'LEADS_CACHE_INDEX_ALL',      prefix: 'LEADS_CACHE_ALL_' },
      { indexKey: 'LEADS_CACHE_INDEX_INBOUND',  prefix: 'LEADS_CACHE_INBOUND_' },
      { indexKey: 'LEADS_CACHE_INDEX_OUTBOUND', prefix: 'LEADS_CACHE_OUTBOUND_' }
    ]
  }, function() {
    var allData  = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();
    var updated  = 0;
    var skipped  = 0;
    var unknown  = 0;

    // 流入元ID 列の新しい値を一括構築
    var newIdColumn = allData.map(function(row) {
      var sourceVal = String(row[sourceColIdx] || '').trim();
      if (!sourceVal) { skipped++; return ['']; }
      var id = nameToId[sourceVal];
      if (!id) { unknown++; return ['']; }
      updated++;
      return [id];
    });

    // 一括書き込み（API 呼び出し 1 回）
    leadSheet.getRange(2, sourceIdColIdx + 1, newIdColumn.length, 1).setValues(newIdColumn);

    Logger.log('[applyLeadSourceIdMigration] 更新: ' + updated + '件 / スキップ(空欄): ' + skipped + '件 / 不明: ' + unknown + '件');
    return { updated: updated, skipped: skipped, unknown: unknown };
  });
}

// ── サーベイ（書き込みなし）────────────────────────────────────────────────

/**
 * 流入元ID列と流入経路列の値分布を出力する。書き込みは行わない。
 *
 * @returns {string[]} フラット文字列配列
 */
function surveyLeadSourceIdColumn() {
  var ss = getSpreadsheet();
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders    = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var sourceColIdx   = leadHeaders.indexOf('流入経路');
  var sourceIdColIdx = leadHeaders.indexOf('流入元ID');
  if (sourceColIdx   < 0) throw new Error('「流入経路」列が見つかりません');
  if (sourceIdColIdx < 0) throw new Error('「流入元ID」列が見つかりません');

  var allData = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();

  var idDist   = {};
  var idBlank  = 0;
  var srcDist  = {};
  var srcBlank = 0;

  allData.forEach(function(row) {
    var sid = String(row[sourceIdColIdx] || '').trim();
    var src = String(row[sourceColIdx]   || '').trim();
    if (sid) { idDist[sid]  = (idDist[sid]  || 0) + 1; } else { idBlank++;  }
    if (src) { srcDist[src] = (srcDist[src] || 0) + 1; } else { srcBlank++; }
  });

  var lines = [];
  lines.push('=== 流入元ID 列サーベイ ===');
  lines.push('');
  lines.push('【流入元ID 分布】');
  Object.keys(idDist).sort().forEach(function(id) {
    lines.push('  ' + id + ': ' + idDist[id] + '件');
  });
  lines.push('  (空欄): ' + idBlank + '件');
  lines.push('');
  lines.push('【流入経路 分布（変更確認）】');
  Object.keys(srcDist).sort().forEach(function(src) {
    lines.push('  "' + src + '": ' + srcDist[src] + '件');
  });
  lines.push('  (空欄): ' + srcBlank + '件');
  lines.push('');
  lines.push('=== サーベイ完了（書き込みなし）===');

  lines.forEach(function(l) { Logger.log(l); });
  return lines;
}
