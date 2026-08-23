/**
 * 作品ID列 追加・DRY RUN・実変換・サーベイ マイグレーション
 *
 * addLeadIpIdsColumn()
 *   リード管理シートに「作品ID」列を挿入する（冪等）。
 *
 * dryRunIpIdsMigration()
 *   「取り扱いタイトル」列を走査し、作品マスタとの照合結果をログ出力する。
 *   書き込みなし。
 *
 * applyIpIdsMigration()
 *   DRY RUN で変換可能と判定された行に「作品ID」を一括書き込みする。
 *   全パーツがマスタと一致する行のみ書き込み。不一致行はスキップ（空欄のまま）。
 *   「取り扱いタイトル」列は変更しない。
 *   withSheetWrite_（ロック＋キャッシュ削除）を使用する。
 *   ★ dryRunIpIdsMigration() で内容を確認してから実行すること。
 *
 * surveyIpIdsMigration()
 *   「作品ID」列と「取り扱いタイトル」列の全値を出力する（書き込みなし）。
 *
 * 実行方法:
 *   clasp run addLeadIpIdsColumn
 *   clasp run dryRunIpIdsMigration
 *   clasp run applyIpIdsMigration
 *   clasp run surveyIpIdsMigration
 */

/**
 * リード管理シートに「作品ID」列を追加する（冪等）。
 *
 * - 既存の「取り扱いタイトル」列の直後に挿入する。
 * - 列がすでに存在する場合は何もしない。
 * - 全行は空欄のまま（変換は別の移行ステップで行う）。
 *
 * @returns {string} 実行結果メッセージ
 */
function addLeadIpIdsColumn() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  if (headers.indexOf('作品ID') !== -1) {
    Logger.log('列既存: 作品ID（スキップ）');
    return '列既存: 作品ID';
  }

  var titleIdx = headers.indexOf('取り扱いタイトル');
  if (titleIdx === -1) throw new Error('「取り扱いタイトル」列が見つかりません');

  // insertColumnAfter は 1-based インデックスを取る
  sheet.insertColumnAfter(titleIdx + 1);
  sheet.getRange(1, titleIdx + 2).setValue('作品ID');

  var newLastCol     = sheet.getLastColumn();
  var updatedHeaders = sheet.getRange(1, 1, 1, newLastCol).getValues()[0].map(String);
  var newIdx         = updatedHeaders.indexOf('作品ID');

  Logger.log('列追加完了: 作品ID（列' + (newIdx + 1) + '、取り扱いタイトル の直後）');
  Logger.log('総列数: ' + newLastCol);
  return '列追加完了: 作品ID（列' + (newIdx + 1) + '）、総列数: ' + newLastCol;
}

// ── DRY RUN ──────────────────────────────────────────────────────────────────

/**
 * 「取り扱いタイトル」→「作品ID」変換の DRY RUN。書き込みなし。
 *
 * 照合順: 作品名（英語）→ 別名（日本語）の順で突き合わせ、どちらで一致したかを明示する。
 * 区切り: 入力はカンマ区切り（前後空白を trim）。出力IDはカンマのみ区切り（空白なし）。
 *   例: "Pokemon, One Piece" → split → ["Pokemon","One Piece"] → "IP001,IP002"
 *
 * @returns {{
 *   convertible: { rowNumber: number, leadId: string, original: string, ids: string }[],
 *   unknown:     { rowNumber: number, leadId: string, value: string }[],
 *   skipped:     number
 * }}
 */
function dryRunIpIdsMigration() {
  var ss = getSpreadsheet();

  // ── 作品マスタ_共用在庫 を読み込む ─────────────────────────────────────────
  var masterSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (!masterSheet) throw new Error('作品マスタ_共用在庫シートが見つかりません');

  var masterLastRow = masterSheet.getLastRow();
  var masterLastCol = masterSheet.getLastColumn();
  if (masterLastRow < 2) throw new Error('作品マスタ_共用在庫にデータがありません');

  var masterData    = masterSheet.getRange(1, 1, masterLastRow, masterLastCol).getValues();
  var masterHeaders = masterData[0].map(String);

  var ipIdIdx  = masterHeaders.indexOf('ip_id');
  var nameIdx  = masterHeaders.indexOf('作品名');
  var aliasIdx = masterHeaders.indexOf('別名');
  if (ipIdIdx < 0) throw new Error('作品マスタ_共用在庫に「ip_id」列がありません');
  if (nameIdx < 0) throw new Error('作品マスタ_共用在庫に「作品名」列がありません');

  // 名称 → { ipId, matchedBy } マップ（有効・無効問わず全件）
  // 同一キーが重複する場合は先勝ち
  var nameToEntry = {};
  for (var m = 1; m < masterData.length; m++) {
    var ipId  = String(masterData[m][ipIdIdx] || '').trim();
    var name  = String(masterData[m][nameIdx]  || '').trim();
    var alias = aliasIdx >= 0 ? String(masterData[m][aliasIdx] || '').trim() : '';
    if (!ipId) continue;
    if (name  && !nameToEntry[name])  nameToEntry[name]  = { ipId: ipId, matchedBy: '作品名' };
    if (alias && !nameToEntry[alias]) nameToEntry[alias] = { ipId: ipId, matchedBy: '別名' };
  }

  Logger.log('作品マスタ_共用在庫 照合キー数: ' + Object.keys(nameToEntry).length);

  // ── リード管理を読み込む ─────────────────────────────────────────────────
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders  = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var titleColIdx  = leadHeaders.indexOf('取り扱いタイトル');
  var leadIdColIdx = leadHeaders.indexOf('リードID');
  if (titleColIdx  < 0) throw new Error('リード管理に「取り扱いタイトル」列がありません');
  if (leadIdColIdx < 0) throw new Error('リード管理に「リードID」列がありません');

  var allData = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();

  // ── 照合ループ ───────────────────────────────────────────────────────────
  var convertible = [];
  var unknownList = [];
  var skipped     = 0;

  for (var r = 0; r < allData.length; r++) {
    var titleVal = String(allData[r][titleColIdx] || '').trim();
    var leadId   = String(allData[r][leadIdColIdx] || '').trim();
    var rowNum   = r + 2;

    if (!titleVal) { skipped++; continue; }

    var parts    = titleVal.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
    var ids      = [];
    var rowUnknown = [];
    var detail   = [];

    for (var p = 0; p < parts.length; p++) {
      var entry = nameToEntry[parts[p]];
      if (entry) {
        ids.push(entry.ipId);
        detail.push('"' + parts[p] + '" → ' + entry.ipId + '（' + entry.matchedBy + '）');
      } else {
        rowUnknown.push(parts[p]);
      }
    }

    if (rowUnknown.length > 0) {
      for (var u = 0; u < rowUnknown.length; u++) {
        unknownList.push({ rowNumber: rowNum, leadId: leadId, value: rowUnknown[u] });
      }
    } else {
      convertible.push({
        rowNumber: rowNum,
        leadId:    leadId,
        original:  titleVal,
        ids:       ids.join(','),
        detail:    detail.join(' | ')
      });
    }
  }

  // ── ログ出力 ─────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('=== dryRunIpIdsMigration ===');
  Logger.log('');
  Logger.log('【区切り文字と空白の扱い】');
  Logger.log('  入力: カンマ区切り、各パーツは前後の空白を trim');
  Logger.log('  例  : "Pokemon, One Piece" → split → ["Pokemon","One Piece"]');
  Logger.log('  出力: カンマのみ区切り（空白なし）→ "IP001,IP002"');
  Logger.log('');
  Logger.log('【変換可能な行: ' + convertible.length + '行】');
  convertible.forEach(function(row) {
    Logger.log('  行' + row.rowNumber + ' / ' + row.leadId);
    Logger.log('    元の値 : "' + row.original + '"');
    Logger.log('    変換後 : "' + row.ids + '"');
    Logger.log('    照合  : ' + row.detail);
  });
  Logger.log('');
  Logger.log('【マスタに無い値: ' + unknownList.length + '件】');
  if (unknownList.length > 0) {
    unknownList.forEach(function(u) {
      Logger.log('  行' + u.rowNumber + ' / ' + u.leadId + ' / "' + u.value + '"');
    });
  } else {
    Logger.log('  なし');
  }
  Logger.log('');
  Logger.log('【空欄の行数: ' + skipped + '行】');
  Logger.log('');
  Logger.log('=== DRY RUN 完了（書き込みなし）===');

  return { convertible: convertible, unknown: unknownList, skipped: skipped };
}

// ── 実変換 ───────────────────────────────────────────────────────────────────

/**
 * 「取り扱いタイトル」→「作品ID」を一括書き込みする。
 *
 * 書き込み条件: カンマ区切りの全パーツがマスタと一致する行のみ。
 * 出力形式: カンマのみ区切り・空白なし（例: "IP001,IP002"）。
 * 不一致・空欄行は「作品ID」列を変更しない。
 * 「取り扱いタイトル」列は変更しない。
 *
 * @returns {{ updated: number, skipped: number, unknown: number }}
 */
function applyIpIdsMigration() {
  var ss = getSpreadsheet();

  // ── 作品マスタ_共用在庫 を読み込む ─────────────────────────────────────────
  var masterSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (!masterSheet) throw new Error('作品マスタ_共用在庫シートが見つかりません');

  var masterLastRow = masterSheet.getLastRow();
  var masterLastCol = masterSheet.getLastColumn();
  if (masterLastRow < 2) throw new Error('作品マスタ_共用在庫にデータがありません');

  var masterData    = masterSheet.getRange(1, 1, masterLastRow, masterLastCol).getValues();
  var masterHeaders = masterData[0].map(String);

  var ipIdIdx  = masterHeaders.indexOf('ip_id');
  var nameIdx  = masterHeaders.indexOf('作品名');
  var aliasIdx = masterHeaders.indexOf('別名');
  if (ipIdIdx < 0) throw new Error('作品マスタ_共用在庫に「ip_id」列がありません');
  if (nameIdx < 0) throw new Error('作品マスタ_共用在庫に「作品名」列がありません');

  var nameToId = {};
  for (var m = 1; m < masterData.length; m++) {
    var ipId  = String(masterData[m][ipIdIdx] || '').trim();
    var name  = String(masterData[m][nameIdx]  || '').trim();
    var alias = aliasIdx >= 0 ? String(masterData[m][aliasIdx] || '').trim() : '';
    if (!ipId) continue;
    if (name  && !nameToId[name])  nameToId[name]  = ipId;
    if (alias && !nameToId[alias]) nameToId[alias] = ipId;
  }

  // ── リード管理を読み込む ─────────────────────────────────────────────────
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol  = leadSheet.getLastColumn();
  var leadLastRow  = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders   = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var titleColIdx   = leadHeaders.indexOf('取り扱いタイトル');
  var ipIdsColIdx   = leadHeaders.indexOf('作品ID');
  if (titleColIdx < 0) throw new Error('リード管理に「取り扱いタイトル」列がありません');
  if (ipIdsColIdx < 0) throw new Error('リード管理に「作品ID」列がありません');

  return withSheetWrite_({
    useLock: true,
    cacheTargets: [
      { indexKey: 'LEADS_CACHE_INDEX_ALL',      prefix: 'LEADS_CACHE_ALL_' },
      { indexKey: 'LEADS_CACHE_INDEX_INBOUND',  prefix: 'LEADS_CACHE_INBOUND_' },
      { indexKey: 'LEADS_CACHE_INDEX_OUTBOUND', prefix: 'LEADS_CACHE_OUTBOUND_' }
    ]
  }, function() {
    var allData = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();
    var updated = 0;
    var skipped = 0;
    var unknown = 0;

    // 作品ID列の新しい値を一括構築（変更なし行は既存値をそのまま保持）
    var newIpIdsColumn = allData.map(function(row) {
      var titleVal = String(row[titleColIdx] || '').trim();

      if (!titleVal) { skipped++; return [row[ipIdsColIdx]]; }

      var parts = titleVal.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
      var ids   = [];
      var hasUnknown = false;

      for (var p = 0; p < parts.length; p++) {
        var id = nameToId[parts[p]];
        if (!id) { hasUnknown = true; break; }
        ids.push(id);
      }

      if (hasUnknown) { unknown++; return [row[ipIdsColIdx]]; }

      updated++;
      return [ids.join(',')];
    });

    // 一括書き込み（作品ID列のみ・API 1回）
    leadSheet.getRange(2, ipIdsColIdx + 1, newIpIdsColumn.length, 1).setValues(newIpIdsColumn);

    Logger.log('[applyIpIdsMigration] 書き込み: ' + updated + '行 / スキップ(空欄): ' + skipped + '行 / 不一致スキップ: ' + unknown + '行');
    return { updated: updated, skipped: skipped, unknown: unknown };
  });
}

// ── サーベイ（書き込みなし）────────────────────────────────────────────────

/**
 * 「作品ID」列と「取り扱いタイトル」列の全値を出力する。書き込みなし。
 *
 * @returns {{ rowNumber: number, leadId: string, title: string, ipIds: string }[]}
 */
function surveyIpIdsMigration() {
  var ss        = getSpreadsheet();
  var leadSheet = ss.getSheetByName('リード管理');
  if (!leadSheet) throw new Error('リード管理シートが見つかりません');

  var leadLastCol = leadSheet.getLastColumn();
  var leadLastRow = leadSheet.getLastRow();
  if (leadLastRow < 2) throw new Error('リード管理にデータがありません');

  var leadHeaders  = leadSheet.getRange(1, 1, 1, leadLastCol).getValues()[0].map(String);
  var titleColIdx  = leadHeaders.indexOf('取り扱いタイトル');
  var ipIdsColIdx  = leadHeaders.indexOf('作品ID');
  var leadIdColIdx = leadHeaders.indexOf('リードID');
  if (titleColIdx  < 0) throw new Error('「取り扱いタイトル」列がありません');
  if (ipIdsColIdx  < 0) throw new Error('「作品ID」列がありません');
  if (leadIdColIdx < 0) throw new Error('「リードID」列がありません');

  var allData = leadSheet.getRange(2, 1, leadLastRow - 1, leadLastCol).getValues();

  var rows = [];
  var writtenCount = 0;

  allData.forEach(function(row, i) {
    var title  = String(row[titleColIdx]  || '').trim();
    var ipIds  = String(row[ipIdsColIdx]  || '').trim();
    var leadId = String(row[leadIdColIdx] || '').trim();
    if (!title && !ipIds) return; // 両方空欄は出力しない
    if (ipIds) writtenCount++;
    rows.push({ rowNumber: i + 2, leadId: leadId, title: title, ipIds: ipIds });
  });

  Logger.log('=== surveyIpIdsMigration ===');
  Logger.log('作品ID 書き込み済み行数: ' + writtenCount);
  Logger.log('');
  rows.forEach(function(r) {
    Logger.log('行' + r.rowNumber + ' / ' + r.leadId);
    Logger.log('  取り扱いタイトル: "' + r.title + '"');
    Logger.log('  作品ID          : "' + r.ipIds + '"');
  });
  Logger.log('');
  Logger.log('=== サーベイ完了（書き込みなし）===');

  return rows;
}
