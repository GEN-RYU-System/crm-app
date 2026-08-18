/**
 * 共用在庫一覧をフロントエンド向けに返す（デモ用・権限チェック省略）
 * @returns {Array<{series:string,quantity:number,unitPrice:number,condition:string,status:string,noteJa:string,noteEn:string,supplier:string,productId:string,rawName:string,exclusionReason:string}>}
 */
function getSharedInventoryForFrontend() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('共用在庫');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
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
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    rows.push({
      series:          String(row[col.series] ?? ''),
      quantity:        Number(row[col.quantity]) || 0,
      unitPrice:       Number(row[col.unitPrice]) || 0,
      condition:       String(row[col.condition] ?? ''),
      status:          String(row[col.status] ?? ''),
      noteJa:          String(row[col.noteJa] ?? ''),
      noteEn:          String(row[col.noteEn] ?? ''),
      supplier:        String(row[col.supplier] ?? ''),
      productId:       String(row[col.productId] ?? ''),
      rawName:         String(row[col.rawName] ?? ''),
      exclusionReason: String(row[col.exclusionReason] ?? '')
    });
  }
  return rows;
}
