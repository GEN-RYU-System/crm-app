/**
 * 共用在庫一覧をフロントエンド向けに返す
 * 共用在庫 → product_id → 商品マスタ同期 → 作品ID → 作品マスタ_共用在庫 の2段階結合
 */
function getSharedInventoryForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const ss = getSpreadsheet();

  // ── 商品マスタ同期: product_id → { japaneseTitle, releaseDate, ipId } ──
  const productMap = {};
  const productSheet = ss.getSheetByName('商品マスタ同期');
  if (productSheet && productSheet.getLastRow() > 1) {
    const pData = productSheet.getDataRange().getValues();
    const pH    = pData[0].map(String);
    const pidIdx = pH.indexOf('product_id');
    const jaIdx  = pH.indexOf('Japanese Title');
    const rdIdx  = pH.indexOf('Release Date');
    const ipIdx  = pH.indexOf('作品ID');
    if (pidIdx !== -1) {
      for (let i = 1; i < pData.length; i++) {
        const r   = pData[i];
        const pid = String(r[pidIdx] ?? '').trim();
        if (!pid) continue;
        let releaseDate = '';
        if (rdIdx !== -1 && r[rdIdx] instanceof Date) {
          releaseDate = Utilities.formatDate(r[rdIdx], 'JST', 'yyyy-MM-dd');
        }
        productMap[pid] = {
          japaneseTitle: jaIdx !== -1 ? String(r[jaIdx] ?? '') : '',
          releaseDate:   releaseDate,
          ipId:          ipIdx !== -1 ? String(r[ipIdx] ?? '').trim() : ''
        };
      }
    }
  }

  // ── 作品マスタ_共用在庫: ip_id → 表示名（別名優先、空の場合は作品名）──
  const ipMap = {};
  const ipSheet = ss.getSheetByName('作品マスタ_共用在庫');
  if (ipSheet && ipSheet.getLastRow() > 1) {
    const ipData    = ipSheet.getDataRange().getValues();
    const ipH       = ipData[0].map(String);
    const ipIdIdx   = ipH.indexOf('ip_id');
    const ipNameIdx = ipH.indexOf('作品名');
    const ipAltIdx  = ipH.indexOf('別名');
    if (ipIdIdx !== -1 && ipNameIdx !== -1) {
      for (let i = 1; i < ipData.length; i++) {
        const r       = ipData[i];
        const id      = String(r[ipIdIdx] ?? '').trim();
        if (!id) continue;
        const name    = String(r[ipNameIdx] ?? '').trim();
        const altName = ipAltIdx !== -1 ? String(r[ipAltIdx] ?? '').trim() : '';
        ipMap[id] = altName || name;
      }
    }
  }

  // ── 共用在庫: ヘッダー名で列を動的解決 ──────────────────────────────
  const invSheet = ss.getSheetByName('共用在庫');
  if (!invSheet) return [];
  const invData = invSheet.getDataRange().getValues();
  if (invData.length <= 1) return [];

  const headers = invData[0].map(String);
  const col = {
    series:          headers.indexOf('Series'),
    quantity:        headers.indexOf('Quantity'),
    unitPrice:       headers.indexOf('Unit Price'),
    condition:       headers.indexOf('Condition'),
    status:          headers.indexOf('Status'),
    noteJa:          headers.indexOf('Note_JA'),
    noteEn:          headers.indexOf('Note_EN'),
    supplier:        headers.indexOf('提供者'),
    productId:       headers.indexOf('product_id'),
    rawName:         headers.indexOf('raw_name'),
    exclusionReason: headers.indexOf('除外理由')
  };

  const missing = Object.entries(col).filter(([, idx]) => idx === -1).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error('共用在庫ヘッダー不足: ' + missing.join(', '));
  }

  const rows = [];
  for (let i = 1; i < invData.length; i++) {
    const r       = invData[i];
    const pid     = String(r[col.productId] ?? '').trim();
    const product = productMap[pid] || {};
    const ipId    = product.ipId || '';
    const ipName  = ipId ? (ipMap[ipId] || '') : '';

    rows.push({
      series:          String(r[col.series] ?? ''),
      quantity:        Number(r[col.quantity]) || 0,
      unitPrice:       Number(r[col.unitPrice]) || 0,
      condition:       String(r[col.condition] ?? ''),
      status:          String(r[col.status] ?? ''),
      noteJa:          String(r[col.noteJa] ?? ''),
      noteEn:          String(r[col.noteEn] ?? ''),
      supplier:        String(r[col.supplier] ?? ''),
      productId:       pid,
      rawName:         String(r[col.rawName] ?? ''),
      exclusionReason: String(r[col.exclusionReason] ?? ''),
      ipId:            ipId,
      ipName:          ipName,
      releaseDate:     product.releaseDate || '',
      japaneseTitle:   product.japaneseTitle || ''
    });
  }
  return rows;
}
