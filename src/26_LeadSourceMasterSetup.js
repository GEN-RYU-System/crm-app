/**
 * 流入元マスタ のシート作成と初期データ投入
 *
 * setupLeadSourceMasterSheet()
 *   - 既存タブがあれば何もしない（ALREADY_EXISTS を返す）
 *   - ヘッダーは Core Schema V1 の定義から生成（物理ヘッダー名の直書きなし）
 *   - LockService で保護
 *
 * seedLeadSourceMaster()
 *   - データが既に1行以上あれば何もしない
 *   - 8件の初期データを投入（リード管理シートの流入経路列に存在する値を網羅）
 *   - LockService で保護
 */

function setupLeadSourceMasterSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss        = getSpreadsheet();
    var tableKey  = 'LEAD_SOURCES';
    var table     = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    if (ss.getSheetByName(sheetName)) {
      Logger.log('[setupLeadSourceMasterSheet] ' + sheetName + ' は既に存在します。何もしません。');
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

    Logger.log('[setupLeadSourceMasterSheet] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
    return { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
  } finally {
    lock.releaseLock();
  }
}

function seedLeadSourceMaster() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'LEAD_SOURCES';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

    var dataRowCount = sheet.getLastRow() - table.headerRowNumber;
    if (dataRowCount > 0) {
      Logger.log('[seedLeadSourceMaster] データが既に存在します（' + dataRowCount + '行）。何もしません。');
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
      return idx + 1; // 1-based
    }

    var colSourceId     = colOf('SOURCE_ID');
    var colName         = colOf('NAME');
    var colIsInbound    = colOf('IS_INBOUND');
    var colIsOutbound   = colOf('IS_OUTBOUND');
    var colIsActive     = colOf('IS_ACTIVE');
    var colDisplayOrder = colOf('DISPLAY_ORDER');

    // リード管理シートの流入経路列に存在する値を網羅したシード
    // IS_INBOUND=true: インバウンド（受け身）、IS_OUTBOUND=true: アウトバウンド（能動）
    var seeds = [
      { id: 'SRC001', name: 'Card Market',         inbound: true,  outbound: false, active: true,  order: 1 },
      { id: 'SRC002', name: 'X（旧Twitter）',       inbound: true,  outbound: true,  active: true,  order: 2 },
      { id: 'SRC003', name: 'Discord',              inbound: true,  outbound: true,  active: true,  order: 3 },
      { id: 'SRC004', name: 'Instagram',            inbound: true,  outbound: true,  active: true,  order: 4 },
      { id: 'SRC005', name: 'Facebook',             inbound: true,  outbound: true,  active: true,  order: 5 },
      { id: 'SRC006', name: '紹介',                 inbound: true,  outbound: false, active: true,  order: 6 },
      { id: 'SRC007', name: 'メール',               inbound: true,  outbound: true,  active: true,  order: 7 },
      { id: 'SRC008', name: 'その他',               inbound: true,  outbound: true,  active: true,  order: 8 }
    ];

    var startRow = table.headerRowNumber + 1;

    seeds.forEach(function(seed, i) {
      var row = startRow + i;
      sheet.getRange(row, colSourceId).setValue(seed.id);
      sheet.getRange(row, colName).setValue(seed.name);
      sheet.getRange(row, colIsInbound).setValue(seed.inbound);
      sheet.getRange(row, colIsOutbound).setValue(seed.outbound);
      sheet.getRange(row, colIsActive).setValue(seed.active);
      sheet.getRange(row, colDisplayOrder).setValue(seed.order);
    });

    Logger.log('[seedLeadSourceMaster] 投入完了: ' + seeds.length + '件');
    return { status: 'SEEDED', rows: seeds.length };
  } finally {
    lock.releaseLock();
  }
}
