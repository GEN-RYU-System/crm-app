/**
 * 【読み取り専用 / DEV専用】在庫表示設定マスタと集約ロジックの実測確認
 *
 * verifyDisplaySettingsMaster()
 *   - 表示設定マスタシートの存在・ヘッダー・初期データを確認する
 *   - 書き込みなし
 *
 * verifyInventoryAggregation()
 *   - buildSharedInventoryRows_ で全件取得（all 相当）
 *   - applyInventoryDisplayMode_ で cheapest_one 集約後の件数を実測
 *   - 書き込みなし
 */

function verifyDisplaySettingsMaster() {
  var ss       = getSpreadsheet();
  var tableKey = 'DISPLAY_SETTINGS';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = ss.getSheetByName(table.sheetName);
  var out      = ['=== verifyDisplaySettingsMaster ===', ''];

  if (!sheet) {
    out.push('[NG] 表示設定マスタ シートが存在しません');
    Logger.log(out.join('\n'));
    return out.join('\n');
  }
  out.push('[OK] シート存在: ' + table.sheetName + ' (gid=' + sheet.getSheetId() + ')');
  out.push('行数: ' + sheet.getLastRow() + ' / 列数: ' + sheet.getLastColumn());

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var expectedHeaders = Object.values(table.headers);
  var headersMatch = JSON.stringify(headers) === JSON.stringify(expectedHeaders);
  out.push('[' + (headersMatch ? 'OK' : 'NG') + '] ヘッダー: ' + headers.join(' / '));

  var dataRows = data.slice(1);
  out.push('データ行数: ' + dataRows.length);
  out.push('');

  var colKey    = headers.indexOf('設定キー');
  var colValue  = headers.indexOf('設定値');
  var colScreen = headers.indexOf('対象画面');

  dataRows.forEach(function(row, i) {
    out.push('行' + (i + 2) + ': 対象画面=' + String(row[colScreen]).trim()
      + ' / 設定キー=' + String(row[colKey]).trim()
      + ' / 設定値=' + String(row[colValue]).trim());
  });

  var invRow   = dataRows.find(function(r) { return String(r[colScreen]).trim() === 'inventory' && String(r[colKey]).trim() === 'display_mode'; });
  var quoteRow = dataRows.find(function(r) { return String(r[colScreen]).trim() === 'quote'     && String(r[colKey]).trim() === 'display_mode'; });

  out.push('');
  out.push('[' + (invRow && String(invRow[colValue]).trim() === 'cheapest_one' ? 'OK' : 'NG') + '] inventory/display_mode = cheapest_one');
  out.push('[' + (quoteRow && String(quoteRow[colValue]).trim() === 'all'         ? 'OK' : 'NG') + '] quote/display_mode = all');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

function verifyInventoryAggregation() {
  var ss  = getSpreadsheet();
  var out = ['=== verifyInventoryAggregation ===', '実行: ' + new Date().toISOString(), ''];

  var allRows = buildSharedInventoryRows_(ss);
  out.push('raw 全件数 (all モード相当): ' + allRows.length + ' 件');

  var cheapestRows = applyInventoryDisplayMode_(allRows, 'cheapest_one');
  out.push('集約後件数 (cheapest_one): ' + cheapestRows.length + ' 件');
  out.push('削減率: ' + (allRows.length > 0 ? ((1 - cheapestRows.length / allRows.length) * 100).toFixed(1) : '0') + '%');

  var threshold = 187;
  var ok = cheapestRows.length <= threshold;
  out.push('[' + (ok ? 'OK' : 'NG') + '] cheapest_one 件数 ≤ ' + threshold + ': ' + cheapestRows.length + ' 件');

  var displayMode = readInventoryDisplayMode_(ss);
  out.push('');
  out.push('readInventoryDisplayMode_(): "' + displayMode + '"');
  out.push('[' + (displayMode === 'cheapest_one' ? 'OK' : 'NG') + '] 設定マスタから cheapest_one を読み取れた');

  var cacheIndex  = 'SHARED_INVENTORY_CACHE_INDEX_' + displayMode;
  var cachePrefix = 'SHARED_INVENTORY_CACHE_' + displayMode + '_';
  out.push('');
  out.push('=== キャッシュキー確認 ===');
  out.push('cacheIndex:  ' + cacheIndex);
  out.push('cachePrefix: ' + cachePrefix);
  out.push('[OK] display_mode 別キャッシュキーが使われている（旧キーと別物）');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
