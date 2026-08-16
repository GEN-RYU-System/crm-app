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
 * 基準値ALL全行突合（書き込みなし・一時検証用）
 *
 * キー: (検証_基準値ALL.列名, raw_name, Condition)
 *      ≡ (出力.提供者, raw_name, Condition)
 *
 * 合格条件（いずれか）:
 *   1. pid・数量・単価・Note_JA が完全一致
 *   2. Note_JA のみ「(なし)→空欄」の差
 *   3. pid=NONE 行の Note_JA に「(原文タイトルを採用・マスタ未確定)」が付いただけ
 *
 * @returns {{ 基準値行数, 出力行数, 合格, 違反, 基準値のみ, 違反詳細, シート行数 }}
 */
function verifyBaselineAllDiff() {
  const realScmId = '1or39_glwYtF9OfOxXizN8ZjcUKL0hNIeW3qP3nCx3AI';
  const ss = SpreadsheetApp.openById(realScmId);

  // ── 1. 基準値ALL を読み込む ──
  const baseSheet = ss.getSheetByName('検証_基準値ALL');
  if (!baseSheet) throw new Error('シートが見つかりません: 検証_基準値ALL');
  const baseRaw = baseSheet.getDataRange().getValues();
  const bh = baseRaw[0];
  const bi = {
    ln:  bh.indexOf('列名'),
    rn:  bh.indexOf('raw_name'),
    cd:  bh.indexOf('Condition'),
    pid: bh.indexOf('product_id'),
    qty: bh.indexOf('数量'),
    prc: bh.indexOf('単価'),
    nt:  bh.indexOf('Note_JA')
  };
  ['ln','rn','cd','pid','qty','prc','nt'].forEach(k => {
    if (bi[k] < 0) throw new Error('検証_基準値ALL に列がありません: ' + k);
  });

  // キー = '列名\traw_name\tCondition'
  const baseRows = baseRaw.slice(1).filter(r => String(r[bi.rn]).trim() !== '');
  const baseMap = {};
  baseRows.forEach((r, i) => {
    const key = [String(r[bi.ln]), String(r[bi.rn]), String(r[bi.cd])].join('\t');
    baseMap[key] = {
      pid:    String(r[bi.pid] || ''),
      qty:    r[bi.qty],
      price:  r[bi.prc],
      note:   String(r[bi.nt] || ''),
      sheetRow: i + 2
    };
  });

  // ── 2. 出力シートを読み込む ──
  const outSheet = ss.getSheetByName('出力');
  if (!outSheet) throw new Error('シートが見つかりません: 出力');
  const outRaw = outSheet.getDataRange().getValues();
  const oh = outRaw[0];
  const oi = {
    ln:  oh.indexOf('提供者'),   // 列名に対応
    rn:  oh.indexOf('raw_name'),
    cd:  oh.indexOf('Condition'),
    pid: oh.indexOf('product_id'),
    qty: oh.indexOf('Quantity'),
    prc: oh.indexOf('Unit Price'),
    nt:  oh.indexOf('Note_JA')
  };

  // 出力を Map 化（同一キーが複数あれば配列で保持）
  const outMap = {};
  outRaw.slice(1).forEach((r, i) => {
    const key = [String(r[oi.ln]), String(r[oi.rn]), String(r[oi.cd])].join('\t');
    if (!outMap[key]) outMap[key] = [];
    outMap[key].push({
      pid:    String(r[oi.pid] || ''),
      qty:    r[oi.qty],
      price:  r[oi.prc],
      note:   String(r[oi.nt] || ''),
      sheetRow: i + 2
    });
  });

  // ── 3. 突合: 基準値ALL の各行を 出力 で検索 ──
  const violations = [];
  let passCount = 0;
  let baselineOnly = 0; // 出力に存在しない基準値行

  Object.entries(baseMap).forEach(([key, base]) => {
    const hits = outMap[key];
    if (!hits || hits.length === 0) {
      baselineOnly++;
      return;
    }

    // 同一キーが複数ある場合は全 hit を確認し、1つでも合格なら合格
    const matched = hits.some(hit => {
      // 合格条件1: 完全一致
      if (base.pid === hit.pid && base.qty === hit.qty &&
          base.price === hit.price && base.note === hit.note) return true;

      // 合格条件2: Note_JA のみ「(なし)→空欄」
      if (base.pid === hit.pid && base.qty === hit.qty &&
          base.price === hit.price &&
          base.note === '(なし)' && hit.note === '') return true;

      // 合格条件3: pid=NONE 行に注釈が付いただけ
      if (base.pid === 'NONE' &&
          base.qty === hit.qty && base.price === hit.price &&
          hit.note.includes('(原文タイトルを採用・マスタ未確定)')) return true;

      return false;
    });

    if (matched) {
      passCount++;
    } else {
      // 最初の hit を代表として違反詳細に記録
      const hit = hits[0];
      const keyParts = key.split('\t');
      violations.push({
        基準値行: base.sheetRow,
        出力行:   hit.sheetRow,
        列名:     keyParts[0],
        raw_name: keyParts[1],
        Condition: keyParts[2],
        基準値: { pid: base.pid, qty: base.qty, price: base.price, note: base.note },
        新値:   { pid: hit.pid,  qty: hit.qty,  price: hit.price,  note: hit.note }
      });
    }
  });

  // ── 4. 出力/FLAG_Single/FLAG_Error の行数 ──
  const sheetRows = {};
  ['出力', 'FLAG_Single', 'FLAG_Error'].forEach(name => {
    const sh = ss.getSheetByName(name);
    sheetRows[name] = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  });

  // 違反詳細を文字列にフラット化（clasp run の [Object] 省略を避ける）
  const violationText = violations.map(v =>
    '行' + v.基準値行 + '→出力行' + v.出力行 +
    ' [' + v.列名 + ' / ' + v.raw_name + ' / ' + v.Condition + ']\n' +
    '  基準値: pid=' + v.基準値.pid + ' qty=' + v.基準値.qty +
    ' price=' + v.基準値.price + ' note="' + v.基準値.note + '"\n' +
    '  新 値: pid=' + v.新値.pid + ' qty=' + v.新値.qty +
    ' price=' + v.新値.price + ' note="' + v.新値.note + '"'
  );

  return {
    基準値行数:  baseRows.length,
    出力行数:    outRaw.length - 1,
    合格:        passCount,
    違反:        violations.length,
    基準値のみ:  baselineOnly,
    違反詳細:    violationText,
    シート行数:  sheetRows
  };
}

/**
 * リード管理シートをバックアップ（一時検証用）
 */
function backupLeadSheet() {
  const ss = getSpreadsheet();
  const src = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const name = 'リード管理_backup_20260807';
  if (ss.getSheetByName(name)) throw new Error('既に存在: ' + name);
  src.copyTo(ss).setName(name);
  const b = ss.getSheetByName(name);
  return { rows: b.getLastRow(), cols: b.getLastColumn() };
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
 * ステータス移行表タブを新設してシードする（一時検証用）
 * ヘッダー込み17行（データ16行）
 */
function seedStatusMigrationTable() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('ステータス移行表');
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet('ステータス移行表');
  }
  const rows = [
    ['旧リード進捗', '旧商談進捗', '旧商談結果', '新リードステータス'],
    ['新規',         '',           '',           '新規'],
    ['新規',         '',           '対象外',     'リード対象外'],
    ['新規',         '',           '追客',       '失注'],
    ['新規',         '対応中',     '失注',       '失注'],
    ['',             '対応中',     '失注',       '失注'],
    ['アサイン確定', 'アサイン確定', '',          'アサイン確定'],
    ['アサイン確定', 'アサイン確定', '失注',      '失注'],
    ['アサイン確定', 'アサイン確定', '見送り',    '失注'],
    ['アサイン確定', '対応中',     '',           '商談中'],
    ['アサイン確定', '対応中',     '対応中',     '商談中'],
    ['アサイン確定', '商談中',     '対応中',     '商談中'],
    ['アサイン確定', '対応中',     '失注',       '失注'],
    ['アサイン確定', '対応中',     '見送り',     '失注'],
    ['アサイン確定', '対応中',     '対象外',     '商談対象外'],
    ['アサイン確定', 'クロージング対応', '成約',  '成約'],
    ['アーカイブ',   '*',          '*',          '【削除】']
  ];
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  return { rowsWritten: rows.length - 1, sheetName: 'ステータス移行表' };
}

/**
 * ステータス1列化 ドライランV2（移行表シート駆動・書き込みなし）
 */
function migrateStatusDryRunV2() {
  const ss = getSpreadsheet();
  const migSheet = ss.getSheetByName('ステータス移行表');
  if (!migSheet) throw new Error('ステータス移行表シートが見つかりません。seedStatusMigrationTable() を先に実行してください');

  // 移行表を読み込む（ヘッダー行を除く）
  const migData = migSheet.getDataRange().getValues();
  const migRows = migData.slice(1).map(r => ({
    L: String(r[0]), D: String(r[1]), R: String(r[2]), ns: String(r[3])
  }));

  // マッチング（* はワイルドカード。表の上の行が優先）
  function lookup(L, D, R) {
    for (const row of migRows) {
      if ((row.L === '*' || row.L === L) &&
          (row.D === '*' || row.D === D) &&
          (row.R === '*' || row.R === R)) return row.ns;
    }
    return null;
  }

  const v = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const h = v[0];
  const idIdx = h.indexOf('リードID'), li = h.indexOf('リード進捗'),
        di = h.indexOf('商談進捗'), ri = h.indexOf('商談結果');
  const out = { counts: {}, deleteRows: 0, unmapped: [] };

  v.slice(1).forEach((r, i) => {
    const L = String(r[li] || ''), D = String(r[di] || ''), R = String(r[ri] || '');
    const ID = String(r[idIdx] || '');
    if (!ID) { out.deleteRows++; return; }  // 空ID → コード固定ルールで削除
    const ns = lookup(L, D, R);
    if (ns === null) { out.unmapped.push('行' + (i + 2) + ': ' + [L, D, R].join('|')); return; }
    if (ns === '【削除】') { out.deleteRows++; return; }
    out.counts[ns] = (out.counts[ns] || 0) + 1;
  });
  return out;
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
 * 【読み取り専用】アーカイブ系3タブの削除可否を判定する
 * ID値・セル値は出力せず、件数と列名のみ返す
 */
function checkArchiveContainment() {
  var ss = getSpreadsheet();
  var out = [];

  var main = ss.getSheetByName('リード管理');
  if (!main) { Logger.log('[NOT FOUND] リード管理'); return '[NOT FOUND] リード管理'; }
  var mv = main.getDataRange().getValues();
  var mi = mv[0].indexOf('リードID');
  if (mi < 0) { Logger.log('[ERROR] リード管理にリードID列なし'); return '[ERROR]'; }

  var mainIds = {};
  mv.slice(1).forEach(function(r) {
    var id = String(r[mi] || '').trim();
    if (id) mainIds[id] = true;
  });
  var mainHeaders = {};
  mv[0].forEach(function(x) {
    var s = String(x || '').trim();
    if (s) mainHeaders[s] = true;
  });

  out.push('リード管理: ' + (mv.length - 1) + '行 / ' + mv[0].length + '列 / ユニークID ' +
           Object.keys(mainIds).length);
  out.push('');

  ['リード_アーカイブ', 'リード_成約', 'リード_失注'].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { out.push(name + ': [NOT FOUND]'); return; }
    if (sh.getLastRow() < 2 || sh.getLastColumn() < 1) {
      out.push(name + ': データ0行 → 条件1・2ともに自動的に成立');
      out.push('');
      return;
    }

    var v = sh.getDataRange().getValues();
    var i = v[0].indexOf('リードID');

    // 条件1: ID
    var missingId = 0, uniqCount = 0;
    if (i < 0) {
      out.push(name + ': リードID列なし → ★停止');
    } else {
      var uniq = {};
      v.slice(1).forEach(function(r) {
        var id = String(r[i] || '').trim();
        if (id) uniq[id] = true;
      });
      uniqCount = Object.keys(uniq).length;
      Object.keys(uniq).forEach(function(id) { if (!mainIds[id]) missingId++; });
    }

    // 条件2: 列
    var onlyInArchive = v[0].filter(function(x) {
      var s = String(x || '').trim();
      return s && !mainHeaders[s];
    });

    out.push(name + ': ' + (v.length - 1) + '行 / ' + v[0].length + '列 / ユニークID ' + uniqCount);
    out.push('  条件1 リード管理に無いID: ' + missingId + '件');
    out.push('  条件2 リード管理に無い列: ' + onlyInArchive.length + '件' +
             (onlyInArchive.length ? ' → ' + onlyInArchive.join(' / ') : ''));
    out.push('  判定: ' + ((missingId === 0 && onlyInArchive.length === 0 && i >= 0)
             ? '削除可' : '★停止'));
    out.push('');
  });

  Logger.log(out.join('\n'));
  return out.join('\n');
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

/**
 * ステータス1列化 書き込み（W2で実行）
 * 第1パス: 全行lookup（unmappedが1件でもあればthrow・シート無変更）
 * 第2パス: ヘッダー＋全データをsetValuesで一括書き込み → 削除行を下から削除
 * @returns {{ writeCount: number, deleteCount: number }}
 */
function migrateStatusWrite() {
  const ss = getSpreadsheet();
  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadsSheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.LEADS);

  // 前提チェック: 現在61列であること（部分書き込み後の再実行を防ぐ）
  const lastCol = leadsSheet.getLastColumn();
  if (lastCol !== 61) throw new Error('列数が想定外です: ' + lastCol + '（期待値: 61）');

  // ステータス移行表を読み込む
  const migSheet = ss.getSheetByName('ステータス移行表');
  if (!migSheet) throw new Error('シートが見つかりません: ステータス移行表');
  const migData = migSheet.getDataRange().getValues();
  const migRows = migData.slice(1).map(r => ({
    L: String(r[0]), D: String(r[1]), R: String(r[2]), ns: String(r[3])
  }));

  function lookup(L, D, R) {
    for (const row of migRows) {
      if ((row.L === '*' || row.L === L) &&
          (row.D === '*' || row.D === D) &&
          (row.R === '*' || row.R === R)) return row.ns;
    }
    return null;
  }

  const allData = leadsSheet.getDataRange().getValues();
  const h = allData[0];
  const idIdx = h.indexOf('リードID');
  const li = h.indexOf('リード進捗');
  const di = h.indexOf('商談進捗');
  const ri = h.indexOf('商談結果');
  if ([idIdx, li, di, ri].some(i => i < 0)) {
    throw new Error('必須列が見つかりません: リードID/' + [idIdx,li,di,ri].join('/'));
  }

  // === 第1パス: 全行lookup（シートへの書き込みなし） ===
  const results = []; // 各データ行の判定結果: { delete: bool, value: string }
  const unmapped = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const ID = String(row[idIdx] || '');
    const L = String(row[li] || '');
    const D = String(row[di] || '');
    const R = String(row[ri] || '');

    if (!ID) {
      results.push({ delete: true, value: '' });
      continue;
    }

    const ns = lookup(L, D, R);
    if (ns === null) {
      unmapped.push('行' + (i + 1) + ': [' + [L, D, R].join('|') + ']');
      results.push({ delete: false, value: '' }); // 後でthrowするので値は不使用
      continue;
    }
    if (ns === '【削除】') {
      results.push({ delete: true, value: '' });
      continue;
    }
    results.push({ delete: false, value: ns });
  }

  // unmappedが1件でもあればシート無変更のままthrow
  if (unmapped.length > 0) {
    throw new Error('unmapped ' + unmapped.length + '件:\n' + unmapped.join('\n'));
  }

  // === 第2パス: 一括書き込み → 行削除 ===
  // ヘッダー書き込み（62列目）
  leadsSheet.getRange(1, 62).setValue('リードステータス');

  // 全データ行の62列目を1回のsetValuesで書き込む
  const colValues = results.map(r => [r.value]);
  leadsSheet.getRange(2, 62, colValues.length, 1).setValues(colValues);

  // 削除対象行を下から削除（行番号はシート上の1-indexed）
  const deleteRowIndices = results
    .map((r, i) => r.delete ? i + 2 : null)
    .filter(n => n !== null)
    .sort((a, b) => b - a);

  for (const rowNum of deleteRowIndices) {
    leadsSheet.deleteRow(rowNum);
  }

  const writeCount = results.filter(r => !r.delete).length;
  return { writeCount: writeCount, deleteCount: deleteRowIndices.length };
}
