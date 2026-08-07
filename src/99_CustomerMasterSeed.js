/**
 * 顧客マスタ3タブ新設＋遡及発行ユーティリティ
 * 手動実行専用（PR11 / PR12）
 */

// ============================================================
// 【PR12】旧顧客マスタ52行 → 新3タブ構造への移行
// ============================================================

/**
 * 旧顧客マスタ52行 → 新スキーマへの列マッピング＋先頭3件プレビュー
 * CT-00001（テスト行）を除外した51行を対象とする。書き込みなし。
 */
function migrateCustomers52DryRun() {
  const ss = getSpreadsheet();

  // ---- 旧顧客マスタ（クリア前のシート）----
  const custSh = ss.getSheetByName('顧客マスタ') || ss.getSheetByName('顧客マスタ_旧');
  if (!custSh) return 'ERROR: 顧客マスタ（または顧客マスタ_旧）が存在しません';
  const custData = custSh.getDataRange().getValues();
  const ch = custData[0];

  // 旧ヘッダーインデックス
  const old = {
    ctId:     ch.indexOf('顧客ID'),
    regDate:  ch.indexOf('登録日時'),
    bName:    ch.indexOf('B Name'),
    bEmail:   ch.indexOf('B Email'),
    bPhone:   ch.indexOf('B Telephone'),
    bTaxId:   ch.indexOf('B Tax ID'),
    bAddr1:   ch.indexOf('B Address 1'),
    bAddr2:   ch.indexOf('B Address 2'),
    bCity:    ch.indexOf('B City'),
    bState:   ch.indexOf('B State'),
    bZip:     ch.indexOf('B Zip'),
    bCountry: ch.indexOf('B Country'),
    dName:    ch.indexOf('D Name'),
    dPhone:   ch.indexOf('D Telephone'),
    dEmail:   ch.indexOf('D Email'),
    dTaxId:   ch.indexOf('D Tax ID'),
    dAddr1:   ch.indexOf('D Address 1'),
    dAddr2:   ch.indexOf('D Address 2'),
    dAddr3:   ch.indexOf('D Address 3'),
    dCity:    ch.indexOf('D City'),
    dState:   ch.indexOf('D State'),
    dZip:     ch.indexOf('D Zip'),
    dCountry: ch.indexOf('D Country'),
    billing:  ch.indexOf('支払い名義'),
    salesRep: ch.indexOf('営業担当者'),
    oldLead:  ch.indexOf('リードID'),
    logId:    ch.indexOf('ログID'),
    channel:  ch.indexOf('連絡ツール'),
    sales:    ch.indexOf('販売先'),
    priority: ch.indexOf('重視ポイント'),
    orderAmt: ch.indexOf('1回発注額'),
    freq:     ch.indexOf('月間頻度'),
    monthly:  ch.indexOf('月間売上見込額'),
    trust:    ch.indexOf('信頼度'),
    discJoin: ch.indexOf('Discord参加'),
    discCh:   ch.indexOf('Discord チャンネルID'),
    discUser: ch.indexOf('Discord ユーザーID'),
    wh1:      ch.indexOf('Discrod 請求書 webhook'),
    wh2:      ch.indexOf('Discrod 発送通知 webhook'),
    shipWh:   ch.indexOf('Shippment webhook'),
    fedex:    ch.indexOf('FedEx ID'),
    memo:     ch.indexOf('発送時メモ')
  };

  // ---- 成約リードの 源流リードID / 初回取引日 を名前正規化で引く ----
  const leadData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leadData[0];
  const liId   = lh.indexOf('リードID');
  const liName = lh.indexOf('顧客名');
  const liStat = lh.indexOf('リードステータス');
  const liTx   = lh.indexOf('初回取引日');

  const norm = v => String(v || '').toLowerCase().replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

  const leadByName = {};
  leadData.slice(1).filter(r => String(r[liStat]) === '成約').forEach(r => {
    const n = norm(r[liName]);
    if (n) leadByName[n] = { leadId: String(r[liId]), firstTx: r[liTx] };
  });

  const g = (row, idx) => (idx >= 0 ? String(row[idx] || '') : '');
  const joinAddr = (...parts) => parts.map(p => String(p || '').trim()).filter(Boolean).join(', ');
  const fmtDate = v => (v instanceof Date && !isNaN(v)) ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd') : String(v || '');

  // ---- 51行（CT-00001 除外）を処理 ----
  const rows51 = custData.slice(1).filter(r => String(r[old.ctId]) !== 'CT-00001');
  const lines = [];

  // === 列マッピング凡例 ===
  lines.push('=== 列マッピング ===');
  lines.push('[新顧客マスタ 9列]');
  lines.push('  顧客ID       ← 旧.顧客ID（CT-NNNNN そのまま維持）');
  lines.push('  源流リードID ← 名前一致で特定した成約リードID');
  lines.push('  顧客名       ← 旧.B Name');
  lines.push('  呼び方(英語) ← 空欄（旧データに対応列なし）');
  lines.push('  国           ← 旧.B Country');
  lines.push('  メール       ← 旧.B Email');
  lines.push('  電話番号     ← 旧.B Telephone');
  lines.push('  初回取引日   ← リード管理.初回取引日（空なら登録日時）');
  lines.push('  登録日       ← 旧.登録日時');
  lines.push('');
  lines.push('[配送先マスタ 8列 / 配送先ID: AD-NNNNN]');
  lines.push('  配送先ID ← 新採番');
  lines.push('  顧客ID   ← 旧.顧客ID');
  lines.push('  宛名     ← 旧.D Name');
  lines.push('  住所     ← D Address 1 + D Address 2 + D Address 3 + D City + D State + D Zip 結合');
  lines.push('  国       ← 旧.D Country');
  lines.push('  電話     ← 旧.D Telephone');
  lines.push('  既定     ← TRUE');
  lines.push('  有効     ← TRUE');
  lines.push('');
  lines.push('[支払先マスタ 8列 / 支払先ID: PY-NNNNN]');
  lines.push('  支払先ID ← 新採番');
  lines.push('  顧客ID   ← 旧.顧客ID');
  lines.push('  請求名義 ← 旧.支払い名義（空なら旧.B Name）');
  lines.push('  住所     ← B Address 1 + B Address 2 + B City + B State + B Zip + B Country 結合');
  lines.push('  支払方法 ← 空欄（旧データになし）');
  lines.push('  通貨     ← 空欄（旧データになし）');
  lines.push('  既定     ← TRUE');
  lines.push('  有効     ← TRUE');
  lines.push('');
  lines.push('[宙に浮く列 — 処遇判断が必要]');
  lines.push('  B Tax ID           → 【要確認】仕入元VAT番号として別管理?');
  lines.push('  D Email            → 【要確認】配送先連絡先として配送先マスタに追加?');
  lines.push('  D Tax ID           → 【要確認】同上');
  lines.push('  営業担当者         → 【重要】35_SalesDataSyncService.js が参照中。CRMリードの担当者IDで代替可?');
  lines.push('  Discord チャンネルID → 【重要】33_DiscordIntegrationService.js が参照中（廃止・移管・カラム追加 何れか）');
  lines.push('  Discord ユーザーID   → 【重要】同上');
  lines.push('  Discrod 請求書 webhook   → 【要確認】移管先?');
  lines.push('  Discrod 発送通知 webhook → 【要確認】移管先?');
  lines.push('  Shippment webhook        → 【要確認】移管先?');
  lines.push('  FedEx ID              → 【要確認】配送先マスタに追加?');
  lines.push('  発送時メモ            → 【要確認】配送先マスタに追加?');
  lines.push('  連絡ツール            → CRMリードの「連絡手段」で代替可（要確認）');
  lines.push('  販売先 / 重視ポイント / 1回発注額 / 月間頻度 / 月間売上見込額 / 信頼度 → CRMリードに対応列あり（移行不要候補）');
  lines.push('  ログID               → 意味不明・要確認');
  lines.push('  Discord参加          → 【要確認】');
  lines.push('');
  lines.push('=== 先頭3件プレビュー（CT-00002〜CT-00004） ===');

  let noMatch = 0;
  rows51.slice(0, 3).forEach((r, i) => {
    const ct     = g(r, old.ctId);
    const bName  = g(r, old.bName);
    const lead   = leadByName[norm(bName)] || null;
    if (!lead) noMatch++;

    const srcId  = lead ? lead.leadId : '—（名前不一致）';
    const regDt  = fmtDate(r[old.regDate]);
    const txDate = lead && lead.firstTx instanceof Date && !isNaN(lead.firstTx)
                   ? fmtDate(lead.firstTx) : regDt;

    const custRow  = [ct, srcId, bName, '', g(r, old.bCountry), g(r, old.bEmail), g(r, old.bPhone), txDate, regDt];
    const addrPad  = (i + 1).toString().padStart(5, '0');
    const shipRow  = ['AD-' + addrPad, ct, g(r, old.dName),
                      joinAddr(g(r,old.dAddr1), g(r,old.dAddr2), g(r,old.dAddr3), g(r,old.dCity), g(r,old.dState), g(r,old.dZip)),
                      g(r, old.dCountry), g(r, old.dPhone), 'TRUE', 'TRUE'];
    const billing  = g(r, old.billing) || bName;
    const payRow   = ['PY-' + addrPad, ct, billing,
                      joinAddr(g(r,old.bAddr1), g(r,old.bAddr2), g(r,old.bCity), g(r,old.bState), g(r,old.bZip), g(r,old.bCountry)),
                      '', '', 'TRUE', 'TRUE'];

    lines.push('--- ' + ct + ' / ' + bName + ' ---');
    lines.push('  [顧客マスタ] ' + custRow.join(' | '));
    lines.push('  [配送先]     ' + shipRow.join(' | '));
    lines.push('  [支払先]     ' + payRow.join(' | '));
    lines.push('');
  });

  lines.push('名前不一致件数（全51行中）: ' + noMatch);
  lines.push('対象行数: ' + rows51.length + '（CT-00001除外済み）');
  return lines.join('\n');
}

/**
 * 既存52行(B Name/B Email) × 成約51リード(顧客名/メール) の同一人物照合
 * 正規化: 小文字・全角→半角スペース・前後trim
 */
function matchCustomersByIdentity() {
  const ss = getSpreadsheet();

  // ---- 既存顧客マスタ52行 ----
  const custSh = ss.getSheetByName('顧客マスタ');
  const custData = custSh.getDataRange().getValues();
  const ch = custData[0];
  const ciId    = ch.indexOf('顧客ID');
  const ciBName = ch.indexOf('B Name');
  const ciBMail = ch.indexOf('B Email');

  // ---- リード管理（成約のみ） ----
  const leadData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leadData[0];
  const liId   = lh.indexOf('リードID');
  const liName = lh.indexOf('顧客名');
  const liMail = lh.indexOf('メール');
  const liStat = lh.indexOf('リードステータス');

  const norm = v => String(v || '').toLowerCase()
    .replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

  // 成約リードをメール・名前で検索できるMapに
  const wonLeads = leadData.slice(1).filter(r => String(r[liStat]) === '成約');
  const byMail = {}, byName = {};
  wonLeads.forEach(r => {
    const m = norm(r[liMail]), n = norm(r[liName]), id = String(r[liId]);
    if (m) { if (!byMail[m]) byMail[m] = []; byMail[m].push(id); }
    if (n) { if (!byName[n]) byName[n] = []; byName[n].push(id); }
  });

  let cntMail = 0, cntName = 0, cntNone = 0;
  const lines = [
    '=== matchCustomersByIdentity ===',
    '既存顧客マスタ: ' + (custData.length - 1) + '行',
    '成約リード: ' + wonLeads.length + '件',
    ''
  ];

  custData.slice(1).forEach(r => {
    const ct   = String(r[ciId]  || '');
    const bName = String(r[ciBName] || '');
    const bMail = String(r[ciBMail] || '');
    const nm   = norm(bName), nm2 = norm(bMail);

    let match = 'なし', matchIds = '';
    if (nm2 && byMail[nm2]) {
      match = 'MAIL一致'; matchIds = byMail[nm2].join(','); cntMail++;
    } else if (nm && byName[nm]) {
      match = '名前一致'; matchIds = byName[nm].join(','); cntName++;
    } else {
      cntNone++;
    }
    lines.push([ct, match, bName, bMail, matchIds || '—'].join(' | '));
  });

  lines.push('');
  lines.push('--- 集計 ---');
  lines.push('MAIL一致: ' + cntMail);
  lines.push('名前一致: ' + cntName);
  lines.push('一致なし: ' + cntNone);

  return lines.join('\n');
}

/**
 * 既存52行と成約リードの突合ドライラン（読み取りのみ）
 */
function reconcileCustomers52() {
  const ss = getSpreadsheet();
  const cust = ss.getSheetByName('顧客マスタ').getDataRange().getValues();
  const ch = cust[0];
  const ci = ch.indexOf('顧客ID'), li = ch.indexOf('リードID');
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leads[0];
  const lid = lh.indexOf('リードID'), lst = lh.indexOf('リードステータス');
  const leadMap = {};
  leads.slice(1).forEach(r => { leadMap[String(r[lid])] = String(r[lst]); });
  const out = { total: 0, linked成約: 0, linked他ステータス: [], リードID空: 0, リード不在: [], ctDup: [] };
  const seen = {};
  cust.slice(1).forEach(r => {
    const ct = String(r[ci]||''), ld = String(r[li]||'');
    if (!ct) return;
    out.total++;
    if (seen[ct]) out.ctDup.push(ct); seen[ct] = true;
    if (!ld) { out.リードID空++; return; }
    if (!(ld in leadMap)) { out.リード不在.push(ct + '→' + ld); return; }
    if (leadMap[ld] === '成約') out.linked成約++;
    else out.linked他ステータス.push(ct + '→' + ld + '(' + leadMap[ld] + ')');
  });
  // 逆方向: 成約リードで顧客マスタに居ない者
  const custLeadIds = new Set(cust.slice(1).map(r => String(r[li]||'')).filter(String));
  out.成約なのに顧客未登録 = leads.slice(1)
    .filter(r => String(r[lst]) === '成約' && !custLeadIds.has(String(r[lid])))
    .map(r => String(r[lid]));
  return JSON.stringify(out, null, 2);
}

/**
 * 既存タブの正体確認（読み取りのみ）— 平文返却
 */
function inspectExistingCustomerTabs() {
  const ss = getSpreadsheet();
  const lines = [];

  function pickTab(label, name) {
    const sh = ss.getSheetByName(name);
    if (!sh) { lines.push(label + ': 存在しない'); return; }
    const v = sh.getDataRange().getValues();
    lines.push(label + ' [' + name + ']');
    lines.push('  gid: ' + sh.getSheetId());
    lines.push('  行数(ヘッダー除く): ' + (v.length - 1));
    lines.push('  ヘッダー: ' + v[0].map(String).join(' | '));
    v.slice(1, 6).forEach(function(row, i) {
      lines.push('  row' + (i+2) + ': ' + row.map(function(c) {
        if (c instanceof Date) return Utilities.formatDate(c, 'Asia/Tokyo', 'yyyy/MM/dd');
        return String(c).substring(0, 40);
      }).join(' | '));
    });
    lines.push('');
  }

  pickTab('顧客マスタ',   '顧客マスタ');
  pickTab('配送先マスタ', '配送先マスタ');
  pickTab('支払先マスタ', '支払先マスタ');
  pickTab('M_顧客',       'M_顧客');

  const formTabs = ss.getSheets().map(s => s.getName())
    .filter(n => n.indexOf('フォーム') >= 0 || n.indexOf('回答') >= 0);
  lines.push('フォーム/回答タブ: ' + (formTabs.length === 0 ? '（なし）' : formTabs.join(', ')));

  return lines.join('\n');
}

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

/**
 * 顧客マスタの現在のヘッダーと行数を報告（診断用）
 */
function inspectCustomerMasterSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!sheet) return '顧客マスタシートが存在しません';
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1) return '顧客マスタ: 行数=0（完全に空）';
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row2 = lastRow >= 2 ? sheet.getRange(2, 1, 1, lastCol).getValues()[0] : null;
  return [
    '顧客マスタ 現状:',
    '  行数: ' + lastRow + ' (ヘッダー含む)',
    '  列数: ' + lastCol,
    '  ヘッダー: ' + headers.join(' | '),
    '  2行目: ' + (row2 ? row2.join(' | ') : '（なし）')
  ].join('\n');
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
