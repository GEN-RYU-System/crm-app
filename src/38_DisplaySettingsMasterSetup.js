/**
 * 表示設定マスタ のシート作成と初期データ投入
 *
 * setupDisplaySettingsMasterSheet()
 *   - 既存タブがあれば何もしない（ALREADY_EXISTS を返す）
 *   - ヘッダーは Core Schema V1 の定義から生成（物理ヘッダー名の直書きなし）
 *   - LockService で保護
 *
 * seedDisplaySettingsMaster()
 *   - データが既に1行以上あれば何もしない
 *   - inventory/display_mode = cheapest_one（最安1件のみ）
 *   - quote/display_mode = all（全件）
 *   - LockService で保護
 *
 * ★ 実行は配布後に指示を待つこと
 */

function setupDisplaySettingsMasterSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss        = getSpreadsheet();
    var tableKey  = 'DISPLAY_SETTINGS';
    var table     = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    if (ss.getSheetByName(sheetName)) {
      Logger.log('[setupDisplaySettingsMasterSheet] ' + sheetName + ' は既に存在します。何もしません。');
      return { status: 'ALREADY_EXISTS', sheetName: sheetName };
    }

    var headerKeys  = Object.keys(table.headers);
    var headerNames = headerKeys.map(function(k) { return table.headers[k]; });

    var sheet = ss.insertSheet(sheetName);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length).setValues([headerNames]);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    Logger.log('[setupDisplaySettingsMasterSheet] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
    return { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
  } finally {
    lock.releaseLock();
  }
}

function seedDisplaySettingsMaster() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'DISPLAY_SETTINGS';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

    var dataRowCount = sheet.getLastRow() - table.headerRowNumber;
    if (dataRowCount > 0) {
      Logger.log('[seedDisplaySettingsMaster] データが既に存在します（' + dataRowCount + '行）。何もしません。');
      return { status: 'ALREADY_SEEDED', rows: dataRowCount };
    }

    var lastCol    = sheet.getLastColumn();
    var rawHeaders = lastCol > 0
      ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0]
      : [];

    function colOf(headerKey) {
      var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
      var idx  = rawHeaders.indexOf(name);
      if (idx === -1) throw new Error('HEADER_NOT_FOUND:' + headerKey);
      return idx + 1;
    }

    var colSettingKey   = colOf('SETTING_KEY');
    var colSettingValue = colOf('SETTING_VALUE');
    var colTargetScreen = colOf('TARGET_SCREEN');
    var colStaffId      = colOf('STAFF_ID');

    var seeds = [
      { key: 'display_mode', value: 'cheapest_one', screen: 'inventory', staffId: '' },
      { key: 'display_mode', value: 'all',          screen: 'quote',     staffId: '' }
    ];

    var startRow = table.headerRowNumber + 1;
    seeds.forEach(function(seed, i) {
      var row = startRow + i;
      sheet.getRange(row, colSettingKey).setValue(seed.key);
      sheet.getRange(row, colSettingValue).setValue(seed.value);
      sheet.getRange(row, colTargetScreen).setValue(seed.screen);
      sheet.getRange(row, colStaffId).setValue(seed.staffId);
    });

    Logger.log('[seedDisplaySettingsMaster] 投入完了: ' + seeds.length + '件');
    return { status: 'SEEDED', rows: seeds.length };
  } finally {
    lock.releaseLock();
  }
}
