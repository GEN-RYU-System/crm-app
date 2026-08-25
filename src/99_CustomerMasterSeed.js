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

// ============================================================
// 【PR12】write 実装
// ============================================================

/**
 * 旧顧客マスタ52行 → 新3タブ構造へ書き込み
 * 前提:
 *   - 人間が「顧客マスタ」→「顧客マスタ_旧」に改名済み
 *   - seedCustomerMasterTabs() で新スキーマのタブが空で作成済み
 *   - 新顧客マスタ・配送先マスタ・支払先マスタがヘッダー行のみ（2行目以降空）
 */
function migrateCustomers52Write() {
  const ss = getSpreadsheet();

  // ---- 書き込み先の存在＆空チェック ----
  const newCustSh = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  const newShipSh = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  const newPaySh  = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (!newCustSh || !newShipSh || !newPaySh) {
    return 'ERROR: 新タブが存在しません。seedCustomerMasterTabs() を先に実行してください。';
  }
  if (newCustSh.getLastRow() > 1) {
    return 'ERROR: 顧客マスタに既にデータがあります（' + (newCustSh.getLastRow() - 1) + '行）。二重書き込み防止。';
  }
  if (newShipSh.getLastRow() > 1) {
    return 'ERROR: 配送先マスタに既にデータがあります。二重書き込み防止。';
  }
  if (newPaySh.getLastRow() > 1) {
    return 'ERROR: 支払先マスタに既にデータがあります。二重書き込み防止。';
  }

  // ---- 旧タブを開く（改名後は「顧客マスタ_旧」） ----
  const oldSh = ss.getSheetByName('顧客マスタ_旧') || ss.getSheetByName('顧客マスタ');
  if (!oldSh) return 'ERROR: 旧顧客マスタが見つかりません（「顧客マスタ_旧」または「顧客マスタ」）';
  const oldData = oldSh.getDataRange().getValues();
  const oh = oldData[0];

  // 旧ヘッダーインデックス
  const o = {
    ctId:    oh.indexOf('顧客ID'),
    regDate: oh.indexOf('登録日時'),
    bName:   oh.indexOf('B Name'),
    bEmail:  oh.indexOf('B Email'),
    bPhone:  oh.indexOf('B Telephone'),
    bTaxId:  oh.indexOf('B Tax ID'),
    bAddr1:  oh.indexOf('B Address 1'),
    bAddr2:  oh.indexOf('B Address 2'),
    bCity:   oh.indexOf('B City'),
    bState:  oh.indexOf('B State'),
    bZip:    oh.indexOf('B Zip'),
    bCountry:oh.indexOf('B Country'),
    dName:   oh.indexOf('D Name'),
    dPhone:  oh.indexOf('D Telephone'),
    dEmail:  oh.indexOf('D Email'),
    dTaxId:  oh.indexOf('D Tax ID'),
    dAddr1:  oh.indexOf('D Address 1'),
    dAddr2:  oh.indexOf('D Address 2'),
    dAddr3:  oh.indexOf('D Address 3'),
    dCity:   oh.indexOf('D City'),
    dState:  oh.indexOf('D State'),
    dZip:    oh.indexOf('D Zip'),
    dCountry:oh.indexOf('D Country'),
    billing: oh.indexOf('支払い名義'),
    salesRep:oh.indexOf('営業担当者'),
    channel: oh.indexOf('連絡ツール'),
    fedex:   oh.indexOf('FedEx ID'),
    memo:    oh.indexOf('発送時メモ'),
    discJoin:oh.indexOf('Discord参加'),
    discCh:  oh.indexOf('Discord チャンネルID'),
    discUser:oh.indexOf('Discord ユーザーID'),
    wh1:     oh.indexOf('Discrod 請求書 webhook'),
    wh2:     oh.indexOf('Discrod 発送通知 webhook'),
    shipWh:  oh.indexOf('Shippment webhook')
  };

  // ---- 成約リードの 源流リードID / 初回取引日 を名前引き ----
  const leadData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leadData[0];
  const liName = lh.indexOf('顧客名');
  const liId   = lh.indexOf('リードID');
  const liStat = lh.indexOf('リードステータス');
  const liTx   = lh.indexOf('初回取引日');

  const norm = v => String(v || '').toLowerCase().replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  const leadByName = {};
  leadData.slice(1).filter(r => String(r[liStat]) === '成約').forEach(r => {
    const n = norm(r[liName]);
    if (n) leadByName[n] = { leadId: String(r[liId]), firstTx: r[liTx] };
  });

  const g = (row, idx) => idx >= 0 ? row[idx] : '';
  const joinAddr = (...parts) => parts.map(p => String(p || '').trim()).filter(Boolean).join(', ');
  const fmtDate = v => (v instanceof Date && !isNaN(v)) ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd') : String(v || '');

  // CT-00001（テスト行）を除外した51行
  const rows51 = oldData.slice(1).filter(r => String(r[o.ctId]) !== 'CT-00001');

  const custRows = [], shipRows = [], payRows = [];
  const errors = [];

  rows51.forEach((r, i) => {
    const ct    = String(r[o.ctId] || '');
    const bName = String(r[o.bName] || '');
    const lead  = leadByName[norm(bName)];
    if (!lead) { errors.push(ct + '/' + bName + ': 名前不一致'); return; }

    const regDt  = fmtDate(g(r, o.regDate));
    const firstTx = (lead.firstTx instanceof Date && !isNaN(lead.firstTx))
                    ? fmtDate(lead.firstTx) : regDt;
    const pad = String(i + 1).padStart(5, '0');

    // 新顧客マスタ 20列
    custRows.push([
      ct,                          // 顧客ID
      lead.leadId,                 // 源流リードID
      bName,                       // 顧客名
      '',                          // 呼び方（英語）
      g(r, o.bCountry),            // 国
      g(r, o.bEmail),              // メール
      g(r, o.bPhone),              // 電話番号
      firstTx,                     // 初回取引日
      regDt,                       // 登録日
      g(r, o.salesRep),            // 営業担当者
      g(r, o.bTaxId),              // B Tax ID
      g(r, o.channel),             // 連絡ツール
      g(r, o.fedex),               // FedEx ID
      g(r, o.memo),                // 発送時メモ
      g(r, o.discJoin),            // Discord参加
      g(r, o.discCh),              // Discord チャンネルID
      g(r, o.discUser),            // Discord ユーザーID
      g(r, o.wh1),                 // Discrod 請求書 webhook
      g(r, o.wh2),                 // Discrod 発送通知 webhook
      g(r, o.shipWh)               // Shippment webhook
    ]);

    // 配送先マスタ 10列
    shipRows.push([
      'AD-' + pad,                 // 配送先ID
      ct,                          // 顧客ID
      g(r, o.dName),               // 宛名
      joinAddr(g(r,o.dAddr1), g(r,o.dAddr2), g(r,o.dAddr3), g(r,o.dCity), g(r,o.dState), g(r,o.dZip)), // 住所
      g(r, o.dCountry),            // 国
      g(r, o.dPhone),              // 電話
      'TRUE',                      // 既定
      'TRUE',                      // 有効
      g(r, o.dEmail),              // D Email
      g(r, o.dTaxId)               // D Tax ID
    ]);

    // 支払先マスタ 8列
    const billing = String(g(r, o.billing) || '') || bName;
    payRows.push([
      'PY-' + pad,                 // 支払先ID
      ct,                          // 顧客ID
      billing,                     // 請求名義
      joinAddr(g(r,o.bAddr1), g(r,o.bAddr2), g(r,o.bCity), g(r,o.bState), g(r,o.bZip), g(r,o.bCountry)), // 住所
      '',                          // 支払方法
      '',                          // 通貨
      'TRUE',                      // 既定
      'TRUE'                       // 有効
    ]);
  });

  if (errors.length > 0) return 'ERROR（書き込み中止）:\n' + errors.join('\n');

  // 一括書き込み
  newCustSh.getRange(2, 1, custRows.length, custRows[0].length).setValues(custRows);
  newShipSh.getRange(2, 1, shipRows.length, shipRows[0].length).setValues(shipRows);
  newPaySh .getRange(2, 1, payRows.length,  payRows[0].length) .setValues(payRows);

  return [
    '書き込み完了:',
    '  顧客マスタ   : ' + custRows.length + '行 / 20列',
    '  配送先マスタ : ' + shipRows.length + '行 / 10列 (AD-00001〜AD-' + String(shipRows.length).padStart(5,'0') + ')',
    '  支払先マスタ : ' + payRows.length  + '行 / 8列  (PY-00001〜PY-' + String(payRows.length).padStart(5,'0') + ')'
  ].join('\n');
}

/**
 * 移行後の総合検証（6点）
 * 1. 顧客マスタ行数=51・顧客ID重複0・源流リードID重複0・全源流がリード管理に実在
 * 2. 配送先/支払先マスタ各51行・親子照合（顧客ID全一致）
 * 3. Discord連携・SalesSync が参照する列の存在確認
 */
function verifyMigration() {
  const ss = getSpreadsheet();
  const lines = ['=== verifyMigration ==='];

  // ---- 顧客マスタ ----
  const cSh = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!cSh) { lines.push('ERROR: 顧客マスタが存在しません'); return lines.join('\n'); }
  const cData = cSh.getDataRange().getValues();
  const cH = cData[0];
  const rows = cData.slice(1);

  const cidIdx = cH.indexOf('顧客ID');
  const srcIdx = cH.indexOf('源流リードID');
  const discChIdx  = cH.indexOf('Discord チャンネルID');
  const discUsrIdx = cH.indexOf('Discord ユーザーID');
  const salesRepIdx= cH.indexOf('営業担当者');

  const cidSeen = {}, srcSeen = {}, cidDups = [], srcDups = [];
  rows.forEach(r => {
    const c = String(r[cidIdx] || ''), s = String(r[srcIdx] || '');
    if (cidSeen[c]) cidDups.push(c); cidSeen[c] = true;
    if (srcSeen[s]) srcDups.push(s); srcSeen[s] = true;
  });

  // 参照整合性
  const lData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lH = lData[0];
  const allLeadIds = {};
  lData.slice(1).forEach(r => { const id = String(r[lH.indexOf('リードID')]||''); if(id) allLeadIds[id]=true; });
  const missingRefs = rows.filter(r => !allLeadIds[String(r[srcIdx]||'')]).map(r => String(r[srcIdx]));

  lines.push('[顧客マスタ]');
  lines.push('  行数: ' + rows.length + (rows.length === 51 ? ' ✓' : ' ✗ (期待51)'));
  lines.push('  顧客ID重複: ' + (cidDups.length === 0 ? '0 ✓' : cidDups.join(',')));
  lines.push('  源流リードID重複: ' + (srcDups.length === 0 ? '0 ✓' : srcDups.join(',')));
  lines.push('  参照整合性: ' + (missingRefs.length === 0 ? 'OK ✓' : 'NG ' + missingRefs.join(',')));
  lines.push('  Discord チャンネルID列: ' + (discChIdx >= 0 ? '存在 (col' + (discChIdx+1) + ') ✓' : '存在しない ✗'));
  lines.push('  Discord ユーザーID列: '   + (discUsrIdx >= 0 ? '存在 (col' + (discUsrIdx+1) + ') ✓' : '存在しない ✗'));
  lines.push('  営業担当者列: '           + (salesRepIdx >= 0 ? '存在 (col' + (salesRepIdx+1) + ') ✓' : '存在しない ✗'));
  lines.push('');

  // ---- 配送先マスタ ----
  const adSh = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  const adData = adSh.getDataRange().getValues();
  const adH = adData[0];
  const adRows = adData.slice(1);
  const adCidIdx = adH.indexOf('顧客ID');
  const custCtIds = new Set(rows.map(r => String(r[cidIdx])));
  const adOrphan = adRows.filter(r => !custCtIds.has(String(r[adCidIdx]||''))).map(r => String(r[adCidIdx]));
  const adDEmailIdx = adH.indexOf('D Email');
  const adDTaxIdx   = adH.indexOf('D Tax ID');

  lines.push('[配送先マスタ]');
  lines.push('  行数: ' + adRows.length + (adRows.length === 51 ? ' ✓' : ' ✗ (期待51)'));
  lines.push('  列数: ' + adH.length + (adH.length === 15 ? ' ✓' : ' ✗ (期待15)'));
  lines.push('  親子照合（孤立行）: ' + (adOrphan.length === 0 ? '0 ✓' : adOrphan.join(',')));
  lines.push('  D Email列: '  + (adDEmailIdx >= 0 ? '存在 (col' + (adDEmailIdx+1) + ') ✓' : '存在しない ✗'));
  lines.push('  D Tax ID列: ' + (adDTaxIdx  >= 0 ? '存在 (col' + (adDTaxIdx+1)  + ') ✓' : '存在しない ✗'));
  lines.push('');

  // ---- 支払先マスタ ----
  const pySh = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  const pyData = pySh.getDataRange().getValues();
  const pyH = pyData[0];
  const pyRows = pyData.slice(1);
  const pyCidIdx  = pyH.indexOf('顧客ID');
  const pyBTaxIdx = pyH.indexOf('B Tax ID');
  const pyOrphan  = pyRows.filter(r => !custCtIds.has(String(r[pyCidIdx]||''))).map(r => String(r[pyCidIdx]));
  const pyBTaxCount = pyRows.filter(r => String(r[pyBTaxIdx]||'').trim() !== '').length;

  lines.push('[支払先マスタ]');
  lines.push('  行数: ' + pyRows.length + (pyRows.length === 51 ? ' ✓' : ' ✗ (期待51)'));
  lines.push('  列数: ' + pyH.length + (pyH.length === 15 ? ' ✓' : ' ✗ (期待15)'));
  lines.push('  親子照合（孤立行）: ' + (pyOrphan.length === 0 ? '0 ✓' : pyOrphan.join(',')));
  lines.push('  B Tax ID列: ' + (pyBTaxIdx >= 0 ? '存在 (col' + (pyBTaxIdx+1) + ') ✓' : '存在しない ✗'));
  lines.push('  B Tax ID非空: ' + pyBTaxCount + '件' + (pyBTaxCount === 24 ? ' ✓' : ' ✗ (期待24)'));
  lines.push('');

  // ---- 先頭3行実値 ----
  lines.push('[先頭3行実値（CT列・源流・顧客名・Discord チャンネルID）]');
  rows.slice(0, 3).forEach(r => {
    lines.push('  ' + [
      String(r[cidIdx]||''),
      String(r[srcIdx]||''),
      String(r[cH.indexOf('顧客名')]||''),
      String(r[discChIdx]||'（空）')
    ].join(' | '));
  });
  lines.push('[最終行（CT-00051相当）]');
  const last = rows[rows.length - 1];
  lines.push('  ' + [
    String(last[cidIdx]||''),
    String(last[srcIdx]||''),
    String(last[cH.indexOf('顧客名')]||''),
    String(last[discChIdx]||'（空）')
  ].join(' | '));

  return lines.join('\n');
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

/**
 * 顧客マスタの担当者ID列の入力状況と参照整合性を監査する（計測専用）
 * clasp run auditCustomerStaffIdColumn で実行
 */
function auditCustomerStaffIdColumn() {
  const ss = getSpreadsheet();

  const custSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!custSheet) return '顧客マスタシートが見つかりません';
  const custData = custSheet.getDataRange().getValues();
  const custHeaders = custData[0];
  const staffIdColIdx = custHeaders.indexOf(getCoreSchemaV1HeaderName('CUSTOMERS', 'STAFF_ID'));
  if (staffIdColIdx === -1) return '担当者ID列が顧客マスタに存在しません';

  const dataRows = custData.slice(1);
  const total = dataRows.length;
  const filledValues = dataRows.map(function(r) { return String(r[staffIdColIdx]).trim(); }).filter(function(v) { return v !== ''; });
  const filled = filledValues.length;

  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!staffSheet) return '担当者マスタシートが見つかりません';
  const staffData = staffSheet.getDataRange().getValues();
  const staffHeaders = staffData[0];
  const staffIdColInStaff = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID'));
  const staffIdSet = {};
  if (staffIdColInStaff !== -1) {
    staffData.slice(1).forEach(function(r) {
      const v = String(r[staffIdColInStaff]).trim();
      if (v) staffIdSet[v] = true;
    });
  }

  const orphans = filledValues.filter(function(id) { return !staffIdSet[id]; });

  return [
    '=== 顧客マスタ 担当者ID列 監査 ===',
    '対象行数: ' + total + ' 件',
    '入力済み: ' + filled + ' 件',
    '空欄: ' + (total - filled) + ' 件',
    '担当者マスタ登録ID数: ' + Object.keys(staffIdSet).length + ' 件',
    '孤立参照: ' + orphans.length + ' 件'
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

// ============================================================
// PR13v2 ドライラン
// ============================================================

/**
 * PR13v2 ドライラン
 * - 新3タブの現行データ件数（クリア対象）
 * - 旧タブから転記される B Tax ID 件数
 * - 住所列の存在確認とサンプルマッピング
 * - 名前不一致エラー数
 * 読み取りのみ。クリア・書き込みは行わない。
 */
function dryRunSchemaV2() {
  const ss = getSpreadsheet();
  const lines = ['=== dryRunSchemaV2 ==='];

  // ---- 旧タブ ----
  const oldSh = ss.getSheetByName('顧客マスタ_旧') || ss.getSheetByName('顧客マスタ');
  if (!oldSh) return 'ERROR: 顧客マスタ_旧 が存在しません';
  const oldData = oldSh.getDataRange().getValues();
  const oh = oldData[0];
  const rows52 = oldData.slice(1);
  const rows51 = rows52.filter(r => String(r[oh.indexOf('顧客ID')]) !== 'CT-00001');

  // 旧列インデックス確認
  const need = [
    '顧客ID','B Name','B Email','B Telephone','B Tax ID',
    'B Address 1','B Address 2','B City','B State','B Zip','B Country',
    'D Name','D Telephone','D Email','D Tax ID',
    'D Address 1','D Address 2','D Address 3','D City','D State','D Zip','D Country',
    '支払い名義','営業担当者','連絡ツール','FedEx ID','発送時メモ',
    'Discord参加','Discord チャンネルID','Discord ユーザーID',
    'Discrod 請求書 webhook','Discrod 発送通知 webhook','Shippment webhook','登録日時'
  ];
  const missing = need.filter(n => oh.indexOf(n) < 0);
  lines.push('[旧タブ列チェック]');
  lines.push('  旧タブ: ' + oldSh.getName() + '  行数(除CT-00001): ' + rows51.length);
  lines.push('  必須列 欠落: ' + (missing.length === 0 ? 'なし ✓' : missing.join(', ')));

  // B Tax ID 件数
  const bTaxIdx = oh.indexOf('B Tax ID');
  const bTaxCount = rows51.filter(r => String(r[bTaxIdx] || '').trim() !== '').length;
  lines.push('  B Tax ID 非空: ' + bTaxCount + '件 → 支払先マスタ B Tax ID 列へ移設');

  // ---- 新3タブ現行データ件数（クリア対象） ----
  lines.push('');
  lines.push('[新3タブ現行データ（クリア対象）]');
  ['顧客マスタ','配送先マスタ','支払先マスタ'].forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) { lines.push('  ' + name + ': 存在しない'); return; }
    const lastRow = sh.getLastRow();
    lines.push('  ' + name + ': データ行 ' + (lastRow > 1 ? lastRow - 1 : 0) + '行（行2〜' + lastRow + ' をクリア予定）');
  });

  // ---- 新スキーマ確認 ----
  lines.push('');
  lines.push('[新スキーマ（v2）]');
  lines.push('  顧客マスタ 18列: 顧客ID|源流リードID|顧客名|国|メール|電話番号|初回取引日|登録日|営業担当者|連絡ツール|FedEx ID|発送時メモ|Discord参加|Discord チャンネルID|Discord ユーザーID|Discrod 請求書 webhook|Discrod 発送通知 webhook|Shippment webhook');
  lines.push('  配送先マスタ 15列: 配送先ID|顧客ID|宛名|Address 1|Address 2|Address 3|City|State|Zip|国|電話|D Email|D Tax ID|既定|有効');
  lines.push('  支払先マスタ 15列: 支払先ID|顧客ID|請求名義|Address 1|Address 2|Address 3|City|State|Zip|国|支払方法|通貨|B Tax ID|既定|有効');

  // ---- 名前突合 ----
  const leadData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leadData[0];
  const norm = function(v) { return String(v||'').toLowerCase().replace(/　/g,' ').replace(/\s+/g,' ').trim(); };
  const leadByName = {};
  leadData.slice(1).filter(function(r){ return String(r[lh.indexOf('リードステータス')]) === '成約'; }).forEach(function(r){
    const n = norm(r[lh.indexOf('顧客名')]);
    if (n) leadByName[n] = String(r[lh.indexOf('リードID')]);
  });
  const bNameIdx = oh.indexOf('B Name');
  const errors = rows51.filter(function(r){ return !leadByName[norm(String(r[bNameIdx]||''))]; });

  lines.push('');
  lines.push('[名前突合]');
  lines.push('  成約リード件数: ' + Object.keys(leadByName).length);
  lines.push('  旧51行: 一致=' + (rows51.length - errors.length) + '件, 不一致=' + errors.length + '件');
  if (errors.length > 0) {
    errors.slice(0, 5).forEach(function(r){ lines.push('    NG: ' + String(r[oh.indexOf('顧客ID')]) + ' / ' + String(r[bNameIdx])); });
  }

  // ---- サンプルマッピング（先頭3行） ----
  lines.push('');
  lines.push('[先頭3行サンプルマッピング（旧→新）]');
  const g = function(row, idx){ return idx >= 0 ? String(row[idx]||'').substring(0,30) : '(列なし)'; };
  rows51.slice(0, 3).forEach(function(r) {
    const ct = g(r, oh.indexOf('顧客ID'));
    lines.push('  ' + ct + ':');
    lines.push('    [顧客] 国=' + g(r,oh.indexOf('B Country')) + ' / Email=' + g(r,oh.indexOf('B Email')) + ' / BtaxID=' + g(r,oh.indexOf('B Tax ID')));
    lines.push('    [配送] D Addr1=' + g(r,oh.indexOf('D Address 1')) + ' / D Addr3=' + g(r,oh.indexOf('D Address 3')) + ' / D Email=' + g(r,oh.indexOf('D Email')));
    lines.push('    [支払] B Addr1=' + g(r,oh.indexOf('B Address 1')) + ' / B Country=' + g(r,oh.indexOf('B Country')) + ' / B TaxID=' + g(r,oh.indexOf('B Tax ID')));
  });

  return lines.join('\n');
}

// ============================================================
// PR13: clearNewCustomerTabs / migrateCustomersWriteV2 / compareCustomerHeaders
// ============================================================

/**
 * 新3タブの行2以降をクリアし、ヘッダー行を CONFIG.HEADERS で上書き
 * 引数なし or "CONFIRM" 以外: 対象件数のみ報告（何も変更しない）
 * 引数 "CONFIRM": 実際にクリア＋ヘッダー上書きを実行
 */
function clearNewCustomerTabs(confirmArg) {
  const ss = getSpreadsheet();
  const tabs = [
    { name: CONFIG.SHEETS.CRM_CUSTOMERS, key: 'CRM_CUSTOMERS' },
    { name: CONFIG.SHEETS.CRM_SHIPPING,  key: 'CRM_SHIPPING'  },
    { name: CONFIG.SHEETS.CRM_PAYMENT,   key: 'CRM_PAYMENT'   }
  ];
  const lines = [];
  const isDryRun = (confirmArg !== 'CONFIRM');

  if (isDryRun) lines.push('[DRY RUN] 以下をクリア予定。実行するには "CONFIRM" を引数に渡してください。');

  tabs.forEach(function(t) {
    const sh = ss.getSheetByName(t.name);
    if (!sh) { lines.push(t.name + ': 存在しない（スキップ）'); return; }
    const lastRow = sh.getLastRow();
    const dataRows = lastRow > 1 ? lastRow - 1 : 0;
    const newHeaders = HEADERS[t.key];
    lines.push(t.name + ': データ行=' + dataRows + '行 / 新ヘッダー=' + newHeaders.length + '列');

    if (!isDryRun) {
      // ① 全セルをクリア（旧列数が違っても残骸が残らない）
      if (lastRow >= 1) sh.getRange(1, 1, lastRow, sh.getLastColumn()).clearContent();
      // ② 新ヘッダーを書き込む
      sh.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      lines.push('  → クリア完了・ヘッダー ' + newHeaders.length + '列を書き込み');
    }
  });

  return lines.join('\n');
}

/**
 * 正スキーマ v2 で51行を3タブへ一括書き込み
 * 第1パス: 全51行を変換しエラーがあれば throw（何も書かない）
 * 第2パス: 3タブへ setValues 一括（住所は列ごと転記・結合禁止）
 */
function migrateCustomersWriteV2() {
  const ss = getSpreadsheet();

  // ---- 書き込み先チェック ----
  const newCustSh = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  const newShipSh = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  const newPaySh  = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (!newCustSh || !newShipSh || !newPaySh)
    return 'ERROR: 新タブが存在しません。clearNewCustomerTabs("CONFIRM") を先に実行してください。';
  if (newCustSh.getLastRow() > 1) return 'ERROR: 顧客マスタに既にデータあり（' + (newCustSh.getLastRow()-1) + '行）。二重書き込み防止。';
  if (newShipSh.getLastRow() > 1) return 'ERROR: 配送先マスタに既にデータあり。二重書き込み防止。';
  if (newPaySh.getLastRow()  > 1) return 'ERROR: 支払先マスタに既にデータあり。二重書き込み防止。';

  // ---- 旧タブ ----
  const oldSh = ss.getSheetByName('顧客マスタ_旧') || ss.getSheetByName('顧客マスタ');
  if (!oldSh) return 'ERROR: 顧客マスタ_旧 が見つかりません';
  const oldData = oldSh.getDataRange().getValues();
  const oh = oldData[0];

  const o = {
    ctId:    oh.indexOf('顧客ID'),
    regDate: oh.indexOf('登録日時'),
    bName:   oh.indexOf('B Name'),
    bEmail:  oh.indexOf('B Email'),
    bPhone:  oh.indexOf('B Telephone'),
    bTaxId:  oh.indexOf('B Tax ID'),
    bAddr1:  oh.indexOf('B Address 1'),
    bAddr2:  oh.indexOf('B Address 2'),
    bCity:   oh.indexOf('B City'),
    bState:  oh.indexOf('B State'),
    bZip:    oh.indexOf('B Zip'),
    bCountry:oh.indexOf('B Country'),
    dName:   oh.indexOf('D Name'),
    dPhone:  oh.indexOf('D Telephone'),
    dEmail:  oh.indexOf('D Email'),
    dTaxId:  oh.indexOf('D Tax ID'),
    dAddr1:  oh.indexOf('D Address 1'),
    dAddr2:  oh.indexOf('D Address 2'),
    dAddr3:  oh.indexOf('D Address 3'),
    dCity:   oh.indexOf('D City'),
    dState:  oh.indexOf('D State'),
    dZip:    oh.indexOf('D Zip'),
    dCountry:oh.indexOf('D Country'),
    billing: oh.indexOf('支払い名義'),
    salesRep:oh.indexOf('営業担当者'),
    channel: oh.indexOf('連絡ツール'),
    fedex:   oh.indexOf('FedEx ID'),
    memo:    oh.indexOf('発送時メモ'),
    discJoin:oh.indexOf('Discord参加'),
    discCh:  oh.indexOf('Discord チャンネルID'),
    discUser:oh.indexOf('Discord ユーザーID'),
    wh1:     oh.indexOf('Discrod 請求書 webhook'),
    wh2:     oh.indexOf('Discrod 発送通知 webhook'),
    shipWh:  oh.indexOf('Shippment webhook')
  };

  // ---- リード突合マップ ----
  const leadData = ss.getSheetByName(CONFIG.SHEETS.LEADS).getDataRange().getValues();
  const lh = leadData[0];
  const norm = function(v) { return String(v||'').toLowerCase().replace(/　/g,' ').replace(/\s+/g,' ').trim(); };
  const leadByName = {};
  leadData.slice(1).filter(function(r){ return String(r[lh.indexOf('リードステータス')]) === '成約'; }).forEach(function(r){
    const n = norm(r[lh.indexOf('顧客名')]);
    if (n) leadByName[n] = { leadId: String(r[lh.indexOf('リードID')]), firstTx: r[lh.indexOf('初回取引日')] };
  });

  const g = function(row, idx){ return idx >= 0 ? row[idx] : ''; };
  const fmtDate = function(v){ return (v instanceof Date && !isNaN(v)) ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd') : String(v||''); };
  const rows51 = oldData.slice(1).filter(function(r){ return String(r[o.ctId]) !== 'CT-00001'; });

  // ---- 第1パス: 変換（エラーがあれば即 throw） ----
  const custRows = [], shipRows = [], payRows = [];
  const errors = [];

  rows51.forEach(function(r, i) {
    const ct    = String(r[o.ctId] || '');
    const bName = String(r[o.bName] || '');
    const lead  = leadByName[norm(bName)];
    if (!lead) { errors.push(ct + '/' + bName + ': リード不一致'); return; }

    const regDt  = fmtDate(g(r, o.regDate));
    const firstTx = (lead.firstTx instanceof Date && !isNaN(lead.firstTx)) ? fmtDate(lead.firstTx) : regDt;
    const pad = String(i + 1).padStart(5, '0');

    // 顧客マスタ 18列
    custRows.push([
      ct,                   // 顧客ID
      lead.leadId,          // 源流リードID
      bName,                // 顧客名
      g(r, o.bCountry),     // 国
      g(r, o.bEmail),       // メール
      g(r, o.bPhone),       // 電話番号
      firstTx,              // 初回取引日
      regDt,                // 登録日
      g(r, o.salesRep),     // 営業担当者
      g(r, o.channel),      // 連絡ツール
      g(r, o.fedex),        // FedEx ID
      g(r, o.memo),         // 発送時メモ
      g(r, o.discJoin),     // Discord参加
      g(r, o.discCh),       // Discord チャンネルID
      g(r, o.discUser),     // Discord ユーザーID
      g(r, o.wh1),          // Discrod 請求書 webhook
      g(r, o.wh2),          // Discrod 発送通知 webhook
      g(r, o.shipWh)        // Shippment webhook
    ]);

    // 配送先マスタ 15列（住所は列ごと転記・結合禁止）
    shipRows.push([
      'AD-' + pad,          // 配送先ID
      ct,                   // 顧客ID
      g(r, o.dName),        // 宛名
      g(r, o.dAddr1),       // Address 1
      g(r, o.dAddr2),       // Address 2
      g(r, o.dAddr3),       // Address 3
      g(r, o.dCity),        // City
      g(r, o.dState),       // State
      g(r, o.dZip),         // Zip
      g(r, o.dCountry),     // 国
      g(r, o.dPhone),       // 電話
      g(r, o.dEmail),       // D Email
      g(r, o.dTaxId),       // D Tax ID
      'TRUE',               // 既定
      'TRUE'                // 有効
    ]);

    // 支払先マスタ 14列（B Tax ID を顧客マスタから移設）
    payRows.push([
      'PY-' + pad,          // 支払先ID
      ct,                   // 顧客ID
      g(r, o.billing),      // 請求名義
      g(r, o.bAddr1),       // Address 1
      g(r, o.bAddr2),       // Address 2
      g(r, o.bCity),        // City
      g(r, o.bState),       // State
      g(r, o.bZip),         // Zip
      g(r, o.bCountry),     // 国
      '',                   // 支払方法（旧データになし）
      '',                   // 通貨（旧データになし）
      g(r, o.bTaxId),       // B Tax ID（顧客マスタから移設）
      'TRUE',               // 既定
      'TRUE'                // 有効
    ]);
  });

  if (errors.length > 0) {
    throw new Error('変換エラー ' + errors.length + '件（書き込みなし）:\n' + errors.join('\n'));
  }

  // ---- 第2パス: setValues 一括 ----
  newCustSh.getRange(2, 1, custRows.length, custRows[0].length).setValues(custRows);
  newShipSh.getRange(2, 1, shipRows.length, shipRows[0].length).setValues(shipRows);
  newPaySh.getRange(2, 1,  payRows.length,  payRows[0].length).setValues(payRows);

  const bTaxCount = payRows.filter(function(r){ return String(r[11]||'').trim() !== ''; }).length;

  return [
    '書き込み完了(v2):',
    '  顧客マスタ   : ' + custRows.length + '行 / 18列',
    '  配送先マスタ : ' + shipRows.length + '行 / 15列 (AD-00001〜AD-' + String(shipRows.length).padStart(5,'0') + ')',
    '  支払先マスタ : ' + payRows.length  + '行 / 14列 (PY-00001〜PY-' + String(payRows.length).padStart(5,'0') + ')',
    '  B Tax ID転記 : ' + bTaxCount + '件'
  ].join('\n');
}

/**
 * 3タブの実ヘッダー vs CONFIG.HEADERS 突合（恒久検証）
 * mismatches=0 が合格基準
 */
function compareCustomerHeaders() {
  const ss = getSpreadsheet();
  const targets = [
    { name: CONFIG.SHEETS.CRM_CUSTOMERS, key: 'CRM_CUSTOMERS' },
    { name: CONFIG.SHEETS.CRM_SHIPPING,  key: 'CRM_SHIPPING'  },
    { name: CONFIG.SHEETS.CRM_PAYMENT,   key: 'CRM_PAYMENT'   }
  ];
  const lines = ['=== compareCustomerHeaders ==='];
  let totalMismatches = 0;

  targets.forEach(function(t) {
    const sh = ss.getSheetByName(t.name);
    if (!sh) {
      lines.push('[' + t.name + '] ERROR: シートが存在しません');
      totalMismatches++;
      return;
    }
    const lastCol = sh.getLastColumn();
    const actual   = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    const expected = HEADERS[t.key];
    const maxLen   = Math.max(actual.length, expected.length);
    const mismatches = [];
    for (var i = 0; i < maxLen; i++) {
      const a = i < actual.length   ? actual[i]   : '(なし)';
      const e = i < expected.length ? expected[i] : '(なし)';
      if (a !== e) mismatches.push('  col' + (i+1) + ': 実="' + a + '" / 期待="' + e + '"');
    }
    lines.push('[' + t.name + '] 列数=実' + actual.length + '/CONFIG' + expected.length + ' mismatches=' + mismatches.length + (mismatches.length === 0 ? ' ✓' : ' ✗'));
    mismatches.forEach(function(m){ lines.push(m); });
    totalMismatches += mismatches.length;
  });

  lines.push('');
  lines.push('総 mismatches: ' + totalMismatches + (totalMismatches === 0 ? ' ✓ 全タブ一致' : ' ✗'));
  return lines.join('\n');
}

// ============================================================
// 【PR17】住所フル値取得（auditAddressLength の 40文字打ち切り対策）
// ============================================================

/**
 * 長住所6社のフル値を返す（書き込みなし・閲覧専用）
 * 対象: CT-00015 / CT-00017 / CT-00034 / CT-00037 / CT-00046 / CT-00051
 */
function readFullAddressValues() {
  var ss = getSpreadsheet();
  var targets = ['CT-00015','CT-00017','CT-00034','CT-00037','CT-00046','CT-00051'];
  var lines = ['=== readFullAddressValues ==='];

  // --- 配送先マスタ ---
  var adSh = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  if (!adSh) return 'ERROR: 配送先マスタが存在しません';
  var adData = adSh.getDataRange().getValues();
  var adH = adData[0];
  var adCidIdx  = adH.indexOf('顧客ID');
  var adA1Idx   = adH.indexOf('Address 1');
  var adA2Idx   = adH.indexOf('Address 2');
  var adA3Idx   = adH.indexOf('Address 3');
  var adCityIdx = adH.indexOf('City');
  var adStIdx   = adH.indexOf('State');
  var adZipIdx  = adH.indexOf('Zip');
  var adNameIdx = adH.indexOf('宛名');

  lines.push('[配送先マスタ]');
  adData.slice(1).forEach(function(r) {
    var cid = String(r[adCidIdx] || '');
    if (targets.indexOf(cid) < 0) return;
    lines.push('  ' + cid + ' / 宛名=' + String(r[adNameIdx]||''));
    lines.push('    Address 1 (' + String(r[adA1Idx]||'').length + '): ' + String(r[adA1Idx]||''));
    lines.push('    Address 2 (' + String(r[adA2Idx]||'').length + '): ' + String(r[adA2Idx]||''));
    lines.push('    Address 3 (' + String(r[adA3Idx]||'').length + '): ' + String(r[adA3Idx]||''));
    lines.push('    City  : ' + String(r[adCityIdx]||''));
    lines.push('    State : ' + String(r[adStIdx]||''));
    lines.push('    Zip   : ' + String(r[adZipIdx]||''));
  });

  // --- 支払先マスタ ---
  var pySh = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (!pySh) return 'ERROR: 支払先マスタが存在しません';
  var pyData = pySh.getDataRange().getValues();
  var pyH = pyData[0];
  var pyCidIdx  = pyH.indexOf('顧客ID');
  var pyA1Idx   = pyH.indexOf('Address 1');
  var pyA2Idx   = pyH.indexOf('Address 2');
  var pyCityIdx = pyH.indexOf('City');
  var pyStIdx   = pyH.indexOf('State');
  var pyZipIdx  = pyH.indexOf('Zip');
  var pyNameIdx = pyH.indexOf('請求名義');

  lines.push('[支払先マスタ]');
  pyData.slice(1).forEach(function(r) {
    var cid = String(r[pyCidIdx] || '');
    if (targets.indexOf(cid) < 0) return;
    lines.push('  ' + cid + ' / 請求名義=' + String(r[pyNameIdx]||''));
    lines.push('    Address 1 (' + String(r[pyA1Idx]||'').length + '): ' + String(r[pyA1Idx]||''));
    lines.push('    Address 2 (' + String(r[pyA2Idx]||'').length + '): ' + String(r[pyA2Idx]||''));
    lines.push('    City  : ' + String(r[pyCityIdx]||''));
    lines.push('    State : ' + String(r[pyStIdx]||''));
    lines.push('    Zip   : ' + String(r[pyZipIdx]||''));
  });

  return lines.join('\n');
}

// ============================================================
// 【PR17改訂】支払先マスタ Address 3 列追加（冪等）
// ============================================================

/**
 * 支払先マスタの 'Address 2' 直後に 'Address 3' 列を物理挿入する（冪等）
 * CONFIG.HEADERS.CRM_PAYMENT の 15列化に対応させる実タブ側マイグレーション
 * @returns {string} 実行ログ
 */
function addPaymentAddr3Column() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (!sh) return 'ERROR: ' + CONFIG.SHEETS.CRM_PAYMENT + ' が存在しません';

  var data = sh.getDataRange().getValues();
  var h    = data[0];

  if (h.indexOf('Address 3') >= 0) {
    return CONFIG.SHEETS.CRM_PAYMENT + ': Address 3 列は既に存在します (col' +
           (h.indexOf('Address 3') + 1) + ')。スキップ。';
  }

  var addr2Col = h.indexOf('Address 2');
  if (addr2Col < 0) return 'ERROR: Address 2 列が見つかりません';

  var insertAfterCol = addr2Col + 1;
  sh.insertColumnAfter(insertAfterCol);

  var hCell = sh.getRange(1, insertAfterCol + 1);
  hCell.setValue('Address 3')
       .setFontWeight('bold')
       .setBackground('#1565c0')
       .setFontColor('#ffffff');

  return [
    CONFIG.SHEETS.CRM_PAYMENT + ': Address 3 列を col' + (insertAfterCol + 1) + ' に挿入完了',
    '  列数: 14 → 15 ✓',
    '  既存データ行: Address 3 は空欄（fixAddressSplits CONFIRM で書き込み）'
  ].join('\n');
}

/**
 * 【PR17 3b】CT-00017 支払先マスタ Address 3 を空欄化
 * fixAddressSplits CONFIRM後、A1に "CHAWALPATTY, BAGUIATI" が残存するため
 * splitで生成されたA3 "Chawalpatty Baguiati" を重複として除去する。
 * 一回限り実行専用。
 */
function clearPaymentAddr3CT00017() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (!sh) return 'ERROR: 支払先マスタ シートが見つかりません';

  var data = sh.getDataRange().getValues();
  var h = data[0];
  var cidIdx   = h.indexOf('顧客ID');
  var addr3Idx = h.indexOf('Address 3');
  if (cidIdx < 0 || addr3Idx < 0) {
    return 'ERROR: 顧客ID or Address 3 列が見つかりません (cidIdx=' + cidIdx + ', addr3Idx=' + addr3Idx + ')';
  }

  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cidIdx]).trim() === 'CT-00017') {
      targetRow = i;
      break;
    }
  }
  if (targetRow < 0) return 'ERROR: CT-00017 が 支払先マスタ に見つかりません';

  var before = String(data[targetRow][addr3Idx] || '');
  var cellRef = sh.getRange(targetRow + 1, addr3Idx + 1);
  cellRef.setValue('');
  var after = '';

  return [
    '=== clearPaymentAddr3CT00017 ===',
    'CT-00017 支払先マスタ Address 3',
    '  BEFORE: "' + before + '" (' + before.length + '字)',
    '  AFTER : "' + after + '" (' + after.length + '字)',
    '書き込み完了: 1セル ✓'
  ].join('\n');
}
