/**
 * 救出 DRY-RUN（一時検証用・書き込みなし）
 * - 重複30ペアを比較し、新しい行を選択
 * - 購入頻度→購入頻度(月次) の列名読み替えを含む61列マッピングを適用
 * - 先頭3行のプレビューと 商談進捗 の値集計を返す
 */
function rescueDryRun() {
  const ss = getSpreadsheet();
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const arch  = ss.getSheetByName('リード_アーカイブ');
  const lh = leads.getRange(1, 1, 1, leads.getLastColumn()).getValues()[0];
  const av = arch.getDataRange().getValues();
  const ah = av[0];

  // アーカイブ列名 → リード管理インデックス（購入頻度 の読み替えを含む）
  function archToLeadsIdx(archHeader) {
    if (archHeader === '購入頻度') return lh.indexOf('購入頻度(月次)');
    return lh.indexOf(archHeader);
  }

  // アーカイブ行をリード管理の列順に変換（61列）
  const updateDateArchIdx = ah.indexOf('シート更新日');
  function toLeadsRow(archRow) {
    return lh.map(leadsHeader => {
      let archIdx;
      if (leadsHeader === '購入頻度(月次)') {
        archIdx = ah.indexOf('購入頻度(月次)') >= 0 ? ah.indexOf('購入頻度(月次)') : ah.indexOf('購入頻度');
      } else {
        archIdx = ah.indexOf(leadsHeader);
      }
      return archIdx >= 0 ? archRow[archIdx] : '';
    });
  }

  // IDでグループ化
  const groups = {};
  av.slice(1).forEach(row => {
    const id = String(row[0]);
    if (!groups[id]) groups[id] = [];
    groups[id].push(row);
  });

  // 重複解決
  const dupAnalysis = { identicalCount: 0, differentCount: 0, differentIds: [] };
  const resolved = [];
  Object.entries(groups).forEach(([id, rows]) => {
    if (rows.length === 1) {
      resolved.push(rows[0]);
      return;
    }
    const identical = JSON.stringify(rows[0]) === JSON.stringify(rows[1]);
    if (identical) {
      dupAnalysis.identicalCount++;
      resolved.push(rows[0]);
    } else {
      dupAnalysis.differentCount++;
      const diffCols = ah.filter((h, i) => String(rows[0][i]) !== String(rows[1][i]));
      let chosen = rows[0];
      if (updateDateArchIdx >= 0) {
        const d0 = rows[0][updateDateArchIdx] instanceof Date ? rows[0][updateDateArchIdx] : new Date(rows[0][updateDateArchIdx] || 0);
        const d1 = rows[1][updateDateArchIdx] instanceof Date ? rows[1][updateDateArchIdx] : new Date(rows[1][updateDateArchIdx] || 0);
        if (d1 > d0) chosen = rows[1];
      }
      dupAnalysis.differentIds.push({ id: id, diffCols: diffCols });
      resolved.push(chosen);
    }
  });

  const mappedRows = resolved.map(toLeadsRow);

  // 商談進捗 集計
  const statusIdx = lh.indexOf('商談進捗');
  const statusCounts = {};
  mappedRows.forEach(row => {
    const v = String(row[statusIdx] || '（空）');
    statusCounts[v] = (statusCounts[v] || 0) + 1;
  });

  // 先頭3行プレビュー（非空フィールドのみ）
  const leadIdIdx = lh.indexOf('リードID');
  const preview = mappedRows.slice(0, 3).map(row => {
    const obj = {};
    lh.forEach((h, i) => {
      const v = row[i];
      if (v !== '' && v !== null && v !== undefined) {
        obj[h] = v instanceof Date ? v.toISOString() : v;
      }
    });
    return obj;
  });

  return {
    resolvedCount: resolved.length,
    dupAnalysis: dupAnalysis,
    statusCounts: statusCounts,
    previewFirst3: preview
  };
}

/**
 * 救出 WRITE（一時検証用・実際にリード管理へ appendRow する）
 * @param {number} limit - 書き込む最大件数
 * @returns {{ writtenIds: string[], skippedIds: string[] }}
 */
function rescueWrite(limit) {
  const ss = getSpreadsheet();
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const arch  = ss.getSheetByName('リード_アーカイブ');
  const lh = leads.getRange(1, 1, 1, leads.getLastColumn()).getValues()[0];
  const av = arch.getDataRange().getValues();
  const ah = av[0];

  // 既存リードIDを収集（重複書き込み防止）
  const existingData = leads.getDataRange().getValues();
  const existingIdIdx = existingData[0].indexOf('リードID');
  const existingIds = new Set(existingData.slice(1).map(r => String(r[existingIdIdx])).filter(String));

  // アーカイブ行をリード管理の列順に変換
  function toLeadsRow(archRow) {
    return lh.map(leadsHeader => {
      let archIdx;
      if (leadsHeader === '購入頻度(月次)') {
        archIdx = ah.indexOf('購入頻度(月次)') >= 0 ? ah.indexOf('購入頻度(月次)') : ah.indexOf('購入頻度');
      } else {
        archIdx = ah.indexOf(leadsHeader);
      }
      return archIdx >= 0 ? archRow[archIdx] : '';
    });
  }

  // IDでグループ化 → 重複解決
  const updateDateArchIdx = ah.indexOf('シート更新日');
  const groups = {};
  av.slice(1).forEach(row => {
    const id = String(row[0]);
    if (!groups[id]) groups[id] = [];
    groups[id].push(row);
  });

  const resolved = [];
  Object.entries(groups).forEach(([id, rows]) => {
    if (rows.length === 1) { resolved.push(rows[0]); return; }
    const identical = JSON.stringify(rows[0]) === JSON.stringify(rows[1]);
    if (identical) { resolved.push(rows[0]); return; }
    let chosen = rows[0];
    if (updateDateArchIdx >= 0) {
      const d0 = rows[0][updateDateArchIdx] instanceof Date ? rows[0][updateDateArchIdx] : new Date(rows[0][updateDateArchIdx] || 0);
      const d1 = rows[1][updateDateArchIdx] instanceof Date ? rows[1][updateDateArchIdx] : new Date(rows[1][updateDateArchIdx] || 0);
      if (d1 > d0) chosen = rows[1];
    }
    resolved.push(chosen);
  });

  // 未存在IDのみ、limit件まで書き込む
  const leadIdArchIdx = ah.indexOf('リードID');
  const statusIdx = lh.indexOf('商談進捗');
  const writtenIds = [];
  const skippedIds = [];

  for (let i = 0; i < resolved.length && writtenIds.length < limit; i++) {
    const id = String(resolved[i][leadIdArchIdx]);
    if (existingIds.has(id)) { skippedIds.push(id); continue; }
    const row = toLeadsRow(resolved[i]);
    if (!row[statusIdx]) row[statusIdx] = 'アーカイブ';
    leads.appendRow(row);
    writtenIds.push(id);
  }

  return { writtenIds: writtenIds, skippedIds: skippedIds };
}

/**
 * 救出3件の書き込み内容確認（一時検証用）
 */
function verifyRescuedRows() {
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const v = sh.getDataRange().getValues();
  const h = v[0];
  const last3 = v.slice(-3).map(r => {
    const o = {};
    ['リードID','顧客名','リード種別','商談進捗','国','流入経路','登録日'].forEach(k => {
      o[k] = String(r[h.indexOf(k)]);
    });
    return o;
  });
  // WebApp一覧への混入チェック
  const outbound = getLeads(null, 'アウトバウンド') || [];
  const leaked = outbound.filter(l =>
    ['LDO-00002','LDO-00003','LDO-00004'].indexOf(l['リードID']) >= 0);
  return { last3: last3, outboundCount: outbound.length, leakedIntoList: leaked.length };
}

/**
 * getLeads のアーカイブ混入チェック（救出起因か既存挙動かの切り分け）
 */
function checkExistingArchiveLeak() {
  const inbound = getLeads(null, 'インバウンド') || [];
  const outbound = getLeads(null, 'アウトバウンド') || [];
  const rescued = ['LDO-00002','LDO-00003','LDO-00004'];
  const count = list => list.filter(l =>
    l['商談進捗'] === 'アーカイブ' && rescued.indexOf(l['リードID']) < 0).length;
  return { inboundArchived: count(inbound), outboundArchivedExclRescued: count(outbound) };
}

/**
 * リード管理シートのID重複チェック（一時検証用）
 */
function checkLeadDuplicates() {
  const ss = getSpreadsheet();
  const v = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const i = v[0].indexOf('リードID');
  const counts = {};
  v.slice(1).forEach(r => { const id = String(r[i]); if (id) counts[id] = (counts[id]||0)+1; });
  const dups = Object.entries(counts).filter(([,c]) => c > 1).map(([id,c]) => id + ' x' + c);
  return { total: Object.keys(counts).length, dupCount: dups.length, dups: dups };
}

/**
 * リード進捗・商談進捗・商談結果の組み合わせ分布調査（一時検証用）
 */
function surveyStatusColumns() {
  const ss = getSpreadsheet();
  const v = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const h = v[0];
  const li = h.indexOf('リード進捗'), di = h.indexOf('商談進捗'), ri = h.indexOf('商談結果');
  const combos = {};
  v.slice(1).forEach(r => {
    const key = [r[li]||'(空)', r[di]||'(空)', r[ri]||'(空)'].join(' | ');
    combos[key] = (combos[key]||0) + 1;
  });
  // 件数降順で返す
  return Object.entries(combos).sort((a,b) => b[1]-a[1])
               .map(([k,c]) => c + '件: ' + k);
}

/**
 * ステータス1列化 ドライラン（書き込みなし・一時検証用）
 */
function migrateStatusDryRun() {
  const ss = getSpreadsheet();
  const v = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const h = v[0];
  const id = h.indexOf('リードID'), li = h.indexOf('リード進捗'),
        di = h.indexOf('商談進捗'), ri = h.indexOf('商談結果');
  const out = { counts: {}, deleteRows: 0, unmapped: [] };
  v.slice(1).forEach((r, i) => {
    const L = r[li]||'', D = r[di]||'', R = r[ri]||'', ID = String(r[id]||'');
    let ns = null;
    if (!ID) { out.deleteRows++; return; }                    // 空ID → 削除
    else if (L === 'アーカイブ') { out.deleteRows++; return; } // アーカイブ → 削除
    else if (R === '成約') ns = '成約';
    else if (R === '失注' || R === '見送り' || R === '追客') ns = '失注';
    else if (R === '対象外') ns = (L === '新規') ? 'リード対象外' : '商談対象外';
    else if (D === '対応中' || D === '商談中') ns = '商談中';
    else if (L === 'アサイン確定') ns = 'アサイン確定';
    else if (L === '対応中') ns = '対応中';
    else if (L === '新規') ns = '新規';
    if (!ns) { out.unmapped.push('行' + (i+2) + ': ' + [L,D,R].join('|')); return; }
    out.counts[ns] = (out.counts[ns]||0) + 1;
  });
  return out;
}

/**
 * アーカイブタブ行ずれ検査（一時検証用・検証後に削除すること）
 * 1列目がリードIDパターン（LDI/LDO-NNNNN）でない行を返す。
 */
function inspectArchiveRows() {
  const ss = getSpreadsheet();
  const arch = ss.getSheetByName('リード_アーカイブ');
  const v = arch.getDataRange().getValues();
  const headers = v[0];
  const statusIdx = headers.indexOf('リード進捗');
  const dateIdx = headers.indexOf('登録日');
  const out = { headerCount: headers.length, rows: v.length - 1, badRows: [] };
  for (let i = 1; i < v.length; i++) {
    const looksOK = String(v[i][0]).match(/^LD[IO]-\d{5}$/);
    if (!looksOK) out.badRows.push({ row: i + 1, first: String(v[i][0]).slice(0, 20) });
  }
  return out;
}

/**
 * アーカイブタブ列構成・ID重複検査（一時検証用・検証後に削除すること）
 */
function inspectArchiveDetail() {
  const ss = getSpreadsheet();
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const arch = ss.getSheetByName('リード_アーカイブ');
  const lh = leads.getRange(1,1,1,leads.getLastColumn()).getValues()[0];
  const av = arch.getDataRange().getValues();
  const ah = av[0];
  // ① 列名の集合差と、並びが同じか
  const onlyInArch = ah.filter(h => lh.indexOf(h) < 0);
  const onlyInLeads = lh.filter(h => ah.indexOf(h) < 0);
  const sameOrder = JSON.stringify(ah) === JSON.stringify(lh);
  // ② ID重複の実態
  const counts = {};
  av.slice(1).forEach(r => { const id = String(r[0]); counts[id] = (counts[id]||0)+1; });
  const dups = Object.entries(counts).filter(([,c]) => c > 1)
                     .map(([id,c]) => id + ' x' + c);
  return { sameOrder: sameOrder, onlyInArch: onlyInArch, onlyInLeads: onlyInLeads,
           dupCount: dups.length, dups: dups };
}

/**
 * アーカイブタブ照合（一時検証用・検証後に削除すること）
 * リード管理シートと「リード_アーカイブ」タブのリードIDを比較し、
 * アーカイブタブにのみ存在するIDを返す。
 */
function reconcileArchiveTab() {
  const ss = getSpreadsheet();
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const arch = ss.getSheetByName('リード_アーカイブ');
  if (!leads || !arch) throw new Error('シートが見つかりません: ' + (!leads ? CONFIG.SHEETS.LEADS : 'リード_アーカイブ'));
  const pick = sh => {
    const v = sh.getDataRange().getValues();
    const i = v[0].indexOf('リードID');
    if (i < 0) throw new Error('リードID列なし: ' + sh.getName());
    return new Set(v.slice(1).map(r => r[i]).filter(String));
  };
  const L = pick(leads), A = pick(arch);
  const onlyArch = [...A].filter(id => !L.has(id));
  return { leadCount: L.size, archCount: A.size, onlyInArchive: onlyArch };
}
