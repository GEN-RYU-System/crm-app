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
 *   - 旧シード（8件）の投入にのみ使用。新規環境のみ動作する
 *   - LockService で保護
 *
 * CORRECT_SEEDS（定数）
 *   - 実データ準拠の正式マスタ（選択肢マスタ + リード管理実データ）
 *
 * dryRunReseedLeadSourceMaster()
 *   - 現在のマスタと CORRECT_SEEDS の差分を出力（書き込みなし）
 *
 * execReseedLeadSourceMaster()
 *   - ★承認後のみ実行。現在のデータ行を全削除し CORRECT_SEEDS を投入
 *   - LockService + withSheetWrite_ で保護
 */

// 実データ準拠の正式マスタ（選択肢マスタ・リード管理実データに基づく）
// X(旧Twitter) / Discord / メール は実リードデータに存在しないため除外
var CORRECT_SEEDS = [
  { id: 'SRC001', name: 'Instagram',    inbound: true,  outbound: false, active: true, order: 1 },
  { id: 'SRC002', name: 'Facebook',     inbound: true,  outbound: false, active: true, order: 2 },
  { id: 'SRC003', name: 'Market Place', inbound: true,  outbound: false, active: true, order: 3 },
  { id: 'SRC004', name: 'Whatsapp',     inbound: true,  outbound: false, active: true, order: 4 },
  { id: 'SRC005', name: '紹介',          inbound: true,  outbound: false, active: true, order: 5 },
  { id: 'SRC006', name: 'Card Market',  inbound: false, outbound: true,  active: true, order: 6 },
  { id: 'SRC007', name: 'eBay',         inbound: false, outbound: true,  active: true, order: 7 },
  { id: 'SRC008', name: 'その他',        inbound: true,  outbound: true,  active: true, order: 8 }
];

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

// ---------------------------------------------------------------------------
// DRY RUN: 現在マスタ vs CORRECT_SEEDS の差分確認（書き込みなし）
// ---------------------------------------------------------------------------

/**
 * 現在の流入元マスタと CORRECT_SEEDS を比較し、差分を出力する。
 * 書き込みは一切行わない。
 *
 * @returns {{ current: Object[], next: Object[], added: string[], removed: string[], changed: Object[] }}
 */
function dryRunReseedLeadSourceMaster() {
  var ss       = getSpreadsheet();
  var tableKey = 'LEAD_SOURCES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

  var lastCol  = sheet.getLastColumn();
  var lastRow  = sheet.getLastRow();
  var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0].map(String);

  var idIdx      = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'SOURCE_ID'));
  var nameIdx    = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'NAME'));
  var inbIdx     = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'IS_INBOUND'));
  var outIdx     = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'IS_OUTBOUND'));
  var activeIdx  = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'IS_ACTIVE'));
  var orderIdx   = rawHeaders.indexOf(getCoreSchemaV1HeaderName(tableKey, 'DISPLAY_ORDER'));

  // 現在のデータ行を読む
  var current = [];
  if (lastRow > table.headerRowNumber) {
    var dataRows = sheet.getRange(table.headerRowNumber + 1, 1, lastRow - table.headerRowNumber, lastCol).getValues();
    dataRows.forEach(function(row) {
      current.push({
        id:       String(row[idIdx]     || '').trim(),
        name:     String(row[nameIdx]   || '').trim(),
        inbound:  row[inbIdx],
        outbound: row[outIdx],
        active:   row[activeIdx],
        order:    row[orderIdx]
      });
    });
  }

  // 差分計算（id をキーに比較）
  var currentById = {};
  current.forEach(function(r) { currentById[r.id] = r; });
  var nextById    = {};
  CORRECT_SEEDS.forEach(function(r) { nextById[r.id] = r; });

  var added   = [];
  var removed = [];
  var changed = [];

  // 削除・変更
  current.forEach(function(cur) {
    var nxt = nextById[cur.id];
    if (!nxt) {
      removed.push(cur.id + ' (' + cur.name + ')');
    } else if (
      cur.name !== nxt.name ||
      Boolean(cur.inbound)  !== nxt.inbound  ||
      Boolean(cur.outbound) !== nxt.outbound  ||
      Boolean(cur.active)   !== nxt.active    ||
      Number(cur.order)     !== nxt.order
    ) {
      changed.push({
        id:     cur.id,
        before: { name: cur.name, inbound: cur.inbound, outbound: cur.outbound, active: cur.active, order: cur.order },
        after:  { name: nxt.name, inbound: nxt.inbound, outbound: nxt.outbound, active: nxt.active, order: nxt.order }
      });
    }
  });

  // 追加
  CORRECT_SEEDS.forEach(function(nxt) {
    if (!currentById[nxt.id]) {
      added.push(nxt.id + ' (' + nxt.name + ')');
    }
  });

  // 出力
  Logger.log('=== 流入元マスタ DRY RUN RESEED ===');
  Logger.log('');
  Logger.log('【現在のマスタ】' + current.length + '件');
  current.forEach(function(r) {
    Logger.log('  ' + r.id + ' | ' + r.name + ' | IN=' + r.inbound + ' OUT=' + r.outbound + ' 有効=' + r.active + ' 順=' + r.order);
  });
  Logger.log('');
  Logger.log('【修正後のマスタ（CORRECT_SEEDS）】' + CORRECT_SEEDS.length + '件');
  CORRECT_SEEDS.forEach(function(r) {
    Logger.log('  ' + r.id + ' | ' + r.name + ' | IN=' + r.inbound + ' OUT=' + r.outbound + ' 有効=' + r.active + ' 順=' + r.order);
  });
  Logger.log('');
  Logger.log('【差分】');
  Logger.log('  追加: ' + (added.length   > 0 ? added.join(', ')   : 'なし'));
  Logger.log('  削除: ' + (removed.length > 0 ? removed.join(', ') : 'なし'));
  Logger.log('  変更: ' + changed.length + '件');
  changed.forEach(function(c) {
    Logger.log('    ' + c.id + ':');
    Logger.log('      before: ' + JSON.stringify(c.before));
    Logger.log('      after : ' + JSON.stringify(c.after));
  });
  Logger.log('');
  Logger.log('=== DRY RUN 完了（書き込みなし）===');

  return {
    current:  current,
    next:     CORRECT_SEEDS,
    added:    added,
    removed:  removed,
    changed:  changed
  };
}

// ---------------------------------------------------------------------------
// RESEED 実行（★承認後のみ実行）
// ---------------------------------------------------------------------------

/**
 * 現在のデータ行を全削除し、CORRECT_SEEDS を投入する。
 * ★ dryRunReseedLeadSourceMaster() の承認を得てから実行すること。
 *
 * @returns {{ status: string, rows: number }}
 */
function execReseedLeadSourceMaster() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'LEAD_SOURCES';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

    var lastCol    = sheet.getLastColumn();
    var rawHeaders = sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0].map(String);

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

    // 既存データ行をすべて削除
    var lastRow = sheet.getLastRow();
    var dataRowCount = lastRow - table.headerRowNumber;
    if (dataRowCount > 0) {
      sheet.deleteRows(table.headerRowNumber + 1, dataRowCount);
      Logger.log('[execReseedLeadSourceMaster] ' + dataRowCount + '行を削除');
    }

    // CORRECT_SEEDS を投入
    var startRow = table.headerRowNumber + 1;
    CORRECT_SEEDS.forEach(function(seed, i) {
      var row = startRow + i;
      sheet.getRange(row, colSourceId).setValue(seed.id);
      sheet.getRange(row, colName).setValue(seed.name);
      sheet.getRange(row, colIsInbound).setValue(seed.inbound);
      sheet.getRange(row, colIsOutbound).setValue(seed.outbound);
      sheet.getRange(row, colIsActive).setValue(seed.active);
      sheet.getRange(row, colDisplayOrder).setValue(seed.order);
    });

    Logger.log('[execReseedLeadSourceMaster] 投入完了: ' + CORRECT_SEEDS.length + '件');
    return { status: 'RESEEDED', rows: CORRECT_SEEDS.length };
  } finally {
    lock.releaseLock();
  }
}
