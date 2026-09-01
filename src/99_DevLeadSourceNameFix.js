
var MARKET_PLACE_OLD = 'Market Place';
var MARKET_PLACE_NEW = 'Facebook Marketplace';

// ── DRY RUN ──────────────────────────────────────────────────────────────────

/**
 * @returns {string[]} フラット文字列配列（clasp run で全件表示）
 */
function dryRunMarketPlaceRename() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  var sourceIdx = headers.indexOf('lead_source');
  if (sourceIdx === -1) throw new Error('流入経路列が見つかりません');

  var colData = sheet.getRange(2, sourceIdx + 1, lastRow - 1, 1).getValues();

  var exactMatch       = 0;   // 'Market Place' 完全一致
  var alreadyNew       = 0;   // 'Facebook Marketplace' 既存
  var trimVariants     = [];  // 前後空白あり
  var caseVariants     = [];  // 大文字小文字ゆれ
  var lines            = [];

  colData.forEach(function(row, ri) {
    var raw = String(row[0] == null ? '' : row[0]);
    var val = raw.trim();
    var rowNum = ri + 2;

    if (raw !== val && val.toLowerCase() === MARKET_PLACE_OLD.toLowerCase()) {
      trimVariants.push({ rowNum: rowNum, raw: '"' + raw + '"' });
    } else if (val === MARKET_PLACE_OLD) {
      exactMatch++;
    } else if (val === MARKET_PLACE_NEW) {
      alreadyNew++;
    } else if (val.toLowerCase() === MARKET_PLACE_OLD.toLowerCase() && val !== MARKET_PLACE_OLD) {
      caseVariants.push({ rowNum: rowNum, val: val });
    }
  });

  lines.push('=== DRY RUN: Market Place → Facebook Marketplace ===');
  lines.push('');
  lines.push('変換対象（"' + MARKET_PLACE_OLD + '" 完全一致）: ' + exactMatch + '件');
  lines.push('"' + MARKET_PLACE_NEW + '" 既存件数: ' + alreadyNew + '件');
  lines.push('');

  if (trimVariants.length > 0) {
    lines.push('前後空白あり（変換対象外）: ' + trimVariants.length + '件');
    trimVariants.forEach(function(v) { lines.push('  行' + v.rowNum + ': ' + v.raw); });
  } else {
    lines.push('前後空白あり: 0件');
  }

  if (caseVariants.length > 0) {
    lines.push('大文字小文字ゆれ（変換対象外）: ' + caseVariants.length + '件');
    caseVariants.forEach(function(v) { lines.push('  行' + v.rowNum + ': "' + v.val + '"'); });
  } else {
    lines.push('大文字小文字ゆれ: 0件');
  }

  lines.push('');
  lines.push('=== DRY RUN 完了（書き込みなし）===');

  lines.forEach(function(l) { Logger.log(l); });
  return lines;
}

// ── 実行（★承認後のみ）────────────────────────────────────────────────────

/**
 * リード管理の「流入経路」列で 'Market Place' を 'Facebook Marketplace' に書き換える。
 * ★ dryRunMarketPlaceRename() の承認を得てから実行すること。
 *
 * @returns {{ updated: number, skipped: number }}
 */
function execMarketPlaceRename() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var sourceIdx = headers.indexOf('lead_source');
  if (sourceIdx === -1) throw new Error('流入経路列が見つかりません');

  return withSheetWrite_({
    useLock: true,
    cacheTargets: [
      { indexKey: 'LEADS_CACHE_INDEX_ALL',      prefix: 'LEADS_CACHE_ALL_' },
      { indexKey: 'LEADS_CACHE_INDEX_INBOUND',  prefix: 'LEADS_CACHE_INBOUND_' },
      { indexKey: 'LEADS_CACHE_INDEX_OUTBOUND', prefix: 'LEADS_CACHE_OUTBOUND_' },
      { indexKey: 'LEAD_FORM_OPTIONS_CACHE_INDEX', prefix: 'LEAD_FORM_OPTIONS_CACHE_' }
    ]
  }, function() {
    var colData = sheet.getRange(2, sourceIdx + 1, lastRow - 1, 1).getValues();
    var updated = 0;
    var skipped = 0;

    colData.forEach(function(row, ri) {
      var val = String(row[0] == null ? '' : row[0]).trim();
      if (val === MARKET_PLACE_OLD) {
        sheet.getRange(ri + 2, sourceIdx + 1).setValue(MARKET_PLACE_NEW);
        updated++;
      } else {
        skipped++;
      }
    });

    Logger.log('[execMarketPlaceRename] 更新: ' + updated + '件、スキップ: ' + skipped + '件');
    return { updated: updated, skipped: skipped };
  });
}
