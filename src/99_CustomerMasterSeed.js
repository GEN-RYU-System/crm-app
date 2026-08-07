/**
 * 顧客マスタ3タブ新設＋遡及発行ユーティリティ
 * 手動実行専用（PR11）
 */

// ============================================================
// 【1】タブ新設シード（ヘッダーのみ）
// ============================================================

/**
 * 顧客マスタ・配送先マスタ・支払先マスタの3タブをヘッダーのみで新設
 * 既存タブがある場合はスキップ（冪等）
 */
function seedCustomerMasterTabs() {
  const ss = getSpreadsheet();
  const results = [];

  const tabs = [
    { key: 'CRM_CUSTOMERS', name: CONFIG.SHEETS.CRM_CUSTOMERS, color: '#1565c0' },
    { key: 'CRM_SHIPPING',  name: CONFIG.SHEETS.CRM_SHIPPING,  color: '#2e7d32' },
    { key: 'CRM_PAYMENT',   name: CONFIG.SHEETS.CRM_PAYMENT,   color: '#6a1b9a' }
  ];

  tabs.forEach(function(tab) {
    const headers = HEADERS[tab.key];
    const sheet = _createTabIfNotExists(ss, tab.name, headers, tab.color);
    results.push(tab.name + ': ' + (sheet === null ? 'スキップ（既存）' : '作成完了 ' + headers.length + '列'));
  });

  return results.join('\n');
}

/**
 * タブが存在しない場合のみ作成（LockService使用）
 * @returns {Sheet|null} 作成したシート。既存の場合 null
 */
function _createTabIfNotExists(ss, sheetName, headers, headerColor) {
  if (ss.getSheetByName(sheetName)) return null;

  const lock = LockService.getScriptLock();
  let sheet;
  try {
    lock.waitLock(30000);
    if (ss.getSheetByName(sheetName)) return null;
    sheet = ss.insertSheet(sheetName);
  } finally {
    lock.releaseLock();
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(headerColor);
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 120);  // ID列
  sheet.setColumnWidth(2, 130);

  return sheet;
}

// ============================================================
// 【2】遡及発行ドライラン
// ============================================================

/**
 * リードステータス='成約'の51件を顧客マスタに遡及発行するドライラン
 * 書き込みは一切行わない
 * @returns {string} 結果サマリ（clasp run truncation回避のためflatな文字列）
 */
function backfillCustomersDryRun() {
  const ss = getSpreadsheet();
  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadsSheet || leadsSheet.getLastRow() < 2) {
    return 'ERROR: リード管理シートが空です';
  }

  const data = leadsSheet.getDataRange().getValues();
  const h = data[0];

  const idCol       = h.indexOf('リードID');
  const nameCol     = h.indexOf('顧客名');
  const nickCol     = h.indexOf('呼び方（英語）');
  const countryCol  = h.indexOf('国');
  const emailCol    = h.indexOf('メール');
  const phoneCol    = h.indexOf('電話番号');
  const firstTxCol  = h.indexOf('初回取引日');
  const regDateCol  = h.indexOf('登録日');
  const dupSrcCol   = h.indexOf('重複元リードID');
  const statusCol   = h.indexOf('リードステータス');

  const missingCols = [
    ['リードID', idCol], ['顧客名', nameCol], ['リードステータス', statusCol],
    ['重複元リードID', dupSrcCol], ['初回取引日', firstTxCol], ['登録日', regDateCol]
  ].filter(function(c) { return c[1] === -1; }).map(function(c) { return c[0]; });

  if (missingCols.length > 0) {
    return 'ERROR: 列が見つかりません: ' + missingCols.join(', ');
  }

  // 全リードをIDでインデックス化（源流解決用）
  const allLeadsByIdMap = {};
  for (let i = 1; i < data.length; i++) {
    const lid = data[i][idCol];
    if (lid) allLeadsByIdMap[lid] = i;  // 0-indexed data row
  }

  // 成約リードを抽出
  const wonRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol] === '成約') {
      wonRows.push(i);
    }
  }

  // 源流リードID解決
  const resolvedList = [];
  const errors = [];
  let resolvedCount = 0;

  wonRows.forEach(function(rowIdx) {
    const leadId = data[rowIdx][idCol];
    const resolution = _resolveSourceLead(leadId, allLeadsByIdMap, data, idCol, dupSrcCol);

    if (resolution.error) {
      errors.push('  ' + leadId + ': ' + resolution.error);
      return;
    }

    const sourceRowIdx = resolution.sourceRowIdx;
    const isResolved = (resolution.sourceLeadId !== leadId);
    if (isResolved) resolvedCount++;

    // ソート用日付: 初回取引日 → 登録日 の順で取得
    const firstTxRaw = data[rowIdx][firstTxCol];
    const regDateRaw = data[rowIdx][regDateCol];
    const sortDate   = (firstTxRaw instanceof Date && !isNaN(firstTxRaw)) ? firstTxRaw
                     : (regDateRaw instanceof Date && !isNaN(regDateRaw)) ? regDateRaw
                     : new Date(0);

    resolvedList.push({
      srcLeadId:   resolution.sourceLeadId,
      leadId:      leadId,
      name:        data[rowIdx][nameCol]    || '',
      nick:        data[rowIdx][nickCol]    || '',
      country:     data[rowIdx][countryCol] || '',
      email:       data[rowIdx][emailCol]   || '',
      phone:       data[rowIdx][phoneCol]   || '',
      firstTxDate: firstTxRaw instanceof Date ? Utilities.formatDate(firstTxRaw, 'Asia/Tokyo', 'yyyy/MM/dd') : (firstTxRaw || ''),
      regDate:     regDateRaw instanceof Date ? Utilities.formatDate(regDateRaw, 'Asia/Tokyo', 'yyyy/MM/dd') : (regDateRaw || ''),
      sortDate:    sortDate
    });
  });

  if (errors.length > 0) {
    return 'ERROR:\n' + errors.join('\n');
  }

  // 初回取引日の昇順でソート
  resolvedList.sort(function(a, b) {
    return a.sortDate - b.sortDate;
  });

  // 顧客ID採番（CT-NNNNN形式）
  resolvedList.forEach(function(row, idx) {
    row.customerId = 'CT-' + String(idx + 1).padStart(5, '0');
  });

  // 源流リードID重複チェック
  const srcIdCounts = {};
  resolvedList.forEach(function(r) {
    srcIdCounts[r.srcLeadId] = (srcIdCounts[r.srcLeadId] || 0) + 1;
  });
  const srcDuplicates = Object.keys(srcIdCounts).filter(function(k) { return srcIdCounts[k] > 1; });

  // 参照整合性チェック（全源流リードIDがリード管理に実在するか）
  const missingSourceIds = resolvedList
    .filter(function(r) { return !(r.srcLeadId in allLeadsByIdMap); })
    .map(function(r) { return r.srcLeadId; });

  // 先頭5件プレビュー
  const preview = resolvedList.slice(0, 5).map(function(r, i) {
    return '  [' + (i+1) + '] ' + r.customerId + ' | 源流=' + r.srcLeadId
      + ' | ' + r.name + ' | 初回取引日=' + r.firstTxDate;
  }).join('\n');

  const lines = [
    '=== backfillCustomersDryRun 結果 ===',
    '成約件数: '       + wonRows.length,
    '処理成功件数: '   + resolvedList.length,
    '源流解決件数: '   + resolvedCount + ' （重複元を辿った件数）',
    '源流リードID重複: ' + (srcDuplicates.length === 0 ? '0（正常）'
      : srcDuplicates.length + '件 → ' + srcDuplicates.join(', ')),
    '参照整合性: ' + (missingSourceIds.length === 0 ? 'OK（全源流がリード管理に実在）'
      : 'NG ' + missingSourceIds.length + '件 → ' + missingSourceIds.join(', ')),
    '',
    '--- 先頭5件プレビュー ---',
    preview
  ];

  return lines.join('\n');
}

// ============================================================
// 【3】遡及発行書き込み（GOが出たら実行）
// ============================================================

/**
 * リードステータス='成約'の51件を顧客マスタに書き込む
 * 事前条件: 顧客マスタシートが存在し、ヘッダー行のみである（2行目以降が空）
 */
function backfillCustomersWrite() {
  const ss = getSpreadsheet();
  const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);

  if (!customerSheet) {
    return 'ERROR: 顧客マスタシートが存在しません。seedCustomerMasterTabs() を先に実行してください。';
  }
  if (customerSheet.getLastRow() > 1) {
    return 'ERROR: 顧客マスタに既にデータがあります（' + (customerSheet.getLastRow() - 1) + '行）。二重書き込み防止のため中止。';
  }

  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadsSheet || leadsSheet.getLastRow() < 2) {
    return 'ERROR: リード管理シートが空です';
  }

  const data = leadsSheet.getDataRange().getValues();
  const h = data[0];

  const idCol      = h.indexOf('リードID');
  const nameCol    = h.indexOf('顧客名');
  const nickCol    = h.indexOf('呼び方（英語）');
  const countryCol = h.indexOf('国');
  const emailCol   = h.indexOf('メール');
  const phoneCol   = h.indexOf('電話番号');
  const firstTxCol = h.indexOf('初回取引日');
  const regDateCol = h.indexOf('登録日');
  const dupSrcCol  = h.indexOf('重複元リードID');
  const statusCol  = h.indexOf('リードステータス');

  const allLeadsByIdMap = {};
  for (let i = 1; i < data.length; i++) {
    const lid = data[i][idCol];
    if (lid) allLeadsByIdMap[lid] = i;
  }

  const wonRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol] === '成約') wonRows.push(i);
  }

  const resolvedList = [];
  const errors = [];

  wonRows.forEach(function(rowIdx) {
    const leadId = data[rowIdx][idCol];
    const resolution = _resolveSourceLead(leadId, allLeadsByIdMap, data, idCol, dupSrcCol);

    if (resolution.error) {
      errors.push(leadId + ': ' + resolution.error);
      return;
    }

    const firstTxRaw = data[rowIdx][firstTxCol];
    const regDateRaw = data[rowIdx][regDateCol];
    const sortDate   = (firstTxRaw instanceof Date && !isNaN(firstTxRaw)) ? firstTxRaw
                     : (regDateRaw instanceof Date && !isNaN(regDateRaw)) ? regDateRaw
                     : new Date(0);

    resolvedList.push({
      srcLeadId: resolution.sourceLeadId,
      name:      data[rowIdx][nameCol]    || '',
      nick:      data[rowIdx][nickCol]    || '',
      country:   data[rowIdx][countryCol] || '',
      email:     data[rowIdx][emailCol]   || '',
      phone:     data[rowIdx][phoneCol]   || '',
      firstTxDate: firstTxRaw instanceof Date ? firstTxRaw : (firstTxRaw || ''),
      regDate:     regDateRaw instanceof Date ? regDateRaw : (regDateRaw || ''),
      sortDate:  sortDate
    });
  });

  if (errors.length > 0) {
    return 'ERROR（書き込み中止）:\n' + errors.join('\n');
  }

  resolvedList.sort(function(a, b) { return a.sortDate - b.sortDate; });

  const now = new Date();
  const rows = resolvedList.map(function(r, idx) {
    const cid = 'CT-' + String(idx + 1).padStart(5, '0');
    return [cid, r.srcLeadId, r.name, r.nick, r.country, r.email, r.phone, r.firstTxDate, r.regDate];
  });

  customerSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

  return '書き込み完了: ' + rows.length + '件 → 顧客マスタ CT-00001〜CT-' + String(rows.length).padStart(5, '0');
}

// ============================================================
// 【4】検証
// ============================================================

/**
 * 顧客マスタの整合性を検証
 * - 行数
 * - 顧客ID重複0
 * - 源流リードID重複0
 * - 全源流リードIDがリード管理に実在
 */
function verifyCustomerMaster() {
  const ss = getSpreadsheet();
  const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);

  if (!customerSheet || customerSheet.getLastRow() < 2) {
    return 'ERROR: 顧客マスタが空です';
  }

  const custData = customerSheet.getDataRange().getValues();
  const custH = custData[0];
  const cidCol = custH.indexOf('顧客ID');
  const srcCol = custH.indexOf('源流リードID');

  if (cidCol === -1 || srcCol === -1) {
    return 'ERROR: 顧客マスタのヘッダーが不正です';
  }

  const dataRows = custData.slice(1);
  const rowCount = dataRows.length;

  // 顧客ID重複チェック
  const cidSeen = {};
  const cidDups = [];
  dataRows.forEach(function(r) {
    const cid = r[cidCol];
    if (cidSeen[cid]) cidDups.push(cid);
    cidSeen[cid] = true;
  });

  // 源流リードID重複チェック
  const srcSeen = {};
  const srcDups = [];
  dataRows.forEach(function(r) {
    const src = r[srcCol];
    if (srcSeen[src]) srcDups.push(src);
    srcSeen[src] = true;
  });

  // 参照整合性チェック
  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const leadsData = leadsSheet.getDataRange().getValues();
  const leadsH = leadsData[0];
  const lidCol = leadsH.indexOf('リードID');
  const allLeadIds = {};
  for (let i = 1; i < leadsData.length; i++) {
    const lid = leadsData[i][lidCol];
    if (lid) allLeadIds[lid] = true;
  }

  const missingRefs = dataRows
    .filter(function(r) { return !allLeadIds[r[srcCol]]; })
    .map(function(r) { return r[srcCol]; });

  const lines = [
    '=== verifyCustomerMaster ===',
    '行数: ' + rowCount,
    '顧客ID重複: ' + (cidDups.length === 0 ? '0（正常）' : cidDups.length + '件 → ' + cidDups.join(', ')),
    '源流リードID重複: ' + (srcDups.length === 0 ? '0（正常）' : srcDups.length + '件 → ' + srcDups.join(', ')),
    '参照整合性: ' + (missingRefs.length === 0 ? 'OK（全源流がリード管理に実在）'
      : 'NG ' + missingRefs.length + '件 → ' + missingRefs.join(', '))
  ];

  return lines.join('\n');
}

// ============================================================
// 内部ユーティリティ
// ============================================================

/**
 * 重複元リードIDを辿って源流リードIDを解決
 * @param {string} startLeadId - 解決を開始するリードID
 * @param {Object} allLeadsByIdMap - リードIDをキーとするrowインデックス辞書
 * @param {Array} data - getDataRange().getValues() 全体
 * @param {number} idCol - リードID列インデックス
 * @param {number} dupSrcCol - 重複元リードID列インデックス
 * @returns {{sourceLeadId: string, sourceRowIdx: number, error: string|null}}
 */
function _resolveSourceLead(startLeadId, allLeadsByIdMap, data, idCol, dupSrcCol) {
  const MAX_DEPTH = 20;
  const visited = {};
  let currentId = startLeadId;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (visited[currentId]) {
      return { sourceLeadId: null, sourceRowIdx: -1,
               error: '循環参照を検出: ' + currentId + ' (from ' + startLeadId + ')' };
    }
    visited[currentId] = true;

    const rowIdx = allLeadsByIdMap[currentId];
    if (rowIdx === undefined) {
      return { sourceLeadId: null, sourceRowIdx: -1,
               error: 'リード管理に存在しない: ' + currentId + ' (from ' + startLeadId + ')' };
    }

    const dupSrc = data[rowIdx][dupSrcCol];
    if (!dupSrc) {
      // 重複元なし → ここが源流
      return { sourceLeadId: currentId, sourceRowIdx: rowIdx, error: null };
    }

    currentId = dupSrc;
  }

  return { sourceLeadId: null, sourceRowIdx: -1,
           error: '解決深度上限超過(>' + MAX_DEPTH + '): ' + startLeadId };
}
