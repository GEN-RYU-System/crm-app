/**
 * 流入元ID 変換 DRY RUN
 *
 * dryRunLeadSourceIdMigration() … 書き込みを行わずに変換内容を確認する
 *
 * 実行方法:
 *   clasp run dryRunLeadSourceIdMigration
 *
 * 出力:
 *   1. 変換可能な行数（値ごとの内訳: 名称 → source_id: N件）
 *   2. マスタに無い値の行番号と値（全件）
 *   3. 空欄の行数
 *   4. 変換後の想定分布
 *
 * ★ マスタに無い値が1件でもある場合は Logger に出力して終了（書き込み一切なし）
 */

/**
 * @returns {Object} DRY RUN 結果サマリー
 */
function dryRunLeadSourceIdMigration() {
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
  if (nameIdx < 0)  throw new Error('流入元マスタに「名称」列がありません');
  if (idIdx   < 0)  throw new Error('流入元マスタに「source_id」列がありません');

  // 名称 → source_id のマップ（有効・無効問わず全件）
  var nameToId = {};
  for (var m = 1; m < masterData.length; m++) {
    var name = String(masterData[m][nameIdx] || '').trim();
    var id   = String(masterData[m][idIdx]   || '').trim();
    if (name && id) nameToId[name] = id;
  }

  // ── リード管理を読み込む ─────────────────────────────────────────────
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var sourceColIdx = leadHeaders.indexOf('流入経路');
  if (sourceColIdx < 0) throw new Error('リード管理に「流入経路」列がありません');

  var sourceData = leadSheet.getRange(2, sourceColIdx + 1, leadLastRow - 1, 1).getValues();

  // ── 集計 ─────────────────────────────────────────────────────────────
  var convertible   = {};   // { 名称: { id: string, count: number } }
  var unknown       = [];   // { rowNum: number, value: string }
  var blankCount    = 0;

  for (var r = 0; r < sourceData.length; r++) {
    var val = String(sourceData[r][0] || '').trim();
    var sheetRow = r + 2; // 1-based, row 1 = header

    if (!val) {
      blankCount++;
      continue;
    }

    if (nameToId[val] !== undefined) {
      if (!convertible[val]) {
        convertible[val] = { id: nameToId[val], count: 0 };
      }
      convertible[val].count++;
    } else {
      unknown.push({ rowNum: sheetRow, value: val });
    }
  }

  // ── 出力 ─────────────────────────────────────────────────────────────
  Logger.log('=== 流入元ID 変換 DRY RUN ===');
  Logger.log('');

  // 1. 変換可能行（値ごとの内訳）
  var convertibleNames = Object.keys(convertible);
  Logger.log('【1. 変換可能な行】' + convertibleNames.length + '種類');
  var totalConvertible = 0;
  convertibleNames.forEach(function(name) {
    var entry = convertible[name];
    Logger.log('  ' + name + ' → ' + entry.id + ': ' + entry.count + '件');
    totalConvertible += entry.count;
  });
  Logger.log('  小計: ' + totalConvertible + '件');
  Logger.log('');

  // 2. マスタに無い値
  Logger.log('【2. マスタに無い値】' + unknown.length + '件');
  if (unknown.length > 0) {
    unknown.forEach(function(u) {
      Logger.log('  行' + u.rowNum + ': "' + u.value + '"');
    });
  }
  Logger.log('');

  // 3. 空欄
  Logger.log('【3. 空欄の行数】' + blankCount + '件');
  Logger.log('');

  // 4. 変換後の想定分布
  Logger.log('【4. 変換後の想定分布】');
  convertibleNames.forEach(function(name) {
    var entry = convertible[name];
    Logger.log('  ' + entry.id + ': ' + entry.count + '件');
  });
  Logger.log('  空欄: ' + blankCount + '件');
  Logger.log('');

  Logger.log('=== DRY RUN 完了（書き込みなし）===');

  // 停止条件: マスタに無い値がある場合
  if (unknown.length > 0) {
    Logger.log('★ 停止: マスタに無い値が ' + unknown.length + '件あります。承認前に解消してください。');
  }

  return {
    convertible: convertible,
    unknown: unknown,
    blankCount: blankCount,
    totalConvertible: totalConvertible,
    hasProblem: unknown.length > 0
  };
}
