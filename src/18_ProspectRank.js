/**
 * 見込度を自動計算
 * @param {Object} lead - リードデータ
 * @returns {string} 見込度ランク（A/B+/B/B-/仮C/確定C）
 */
function calculateProspectRank(lead) {
  // C条件カウント
  let cConditions = 0;
  
  // 条件1: 返信が3日以上ない
  if (lead.返信速度 === '3日以上' || lead.返信速度 === '未返信') {
    cConditions++;
  }
  
  // 条件2: 小口
  if (lead.想定規模 === '小口') {
    cConditions++;
  }
  
  // 条件3: 月間見込み金額が10万円未満
  const monthlyAmount = parseFloat(lead.月間見込み金額) || 0;
  if (monthlyAmount > 0 && monthlyAmount < 100000) {
    cConditions++;
  }
  
  // 条件4: 価格のみ聞いて終わり（顧客タイプが価格重視かつ温度感が低）
  if (lead.顧客タイプ === '価格重視' && lead.温度感 === '低') {
    cConditions++;
  }
  
  // C判定
  if (cConditions >= 3) return '確定C';
  if (cConditions >= 1 && lead.顧客タイプ === '不明') return '仮C';
  
  // 通常判定（信頼重視/価格重視 × 規模）
  const type = lead.顧客タイプ;
  const scale = lead.想定規模;
  const speed = lead.返信速度;
  
  // A: 信頼重視 + 大口 + 24h以内
  if (type === '信頼重視' && scale === '大口' && speed === '24h以内') {
    return 'A';
  }
  
  // B+: 価格重視 + 大口 + 24h以内（価値訴求で転換可能性）
  if (type === '価格重視' && scale === '大口' && speed === '24h以内') {
    return 'B+';
  }
  
  // 大口で返信遅い場合
  if (scale === '大口') {
    if (type === '信頼重視') return 'B+';
    if (type === '価格重視') return 'B';
  }
  
  // B: 信頼重視 + 中規模以下
  if (type === '信頼重視' && (scale === '中規模' || scale === '小口')) {
    return 'B';
  }
  
  // B-: 価格重視 + 中規模以下
  if (type === '価格重視' && (scale === '中規模' || scale === '小口')) {
    return 'B-';
  }
  
  // 判断材料不足
  if (type === '不明' || scale === '不明') {
    return '仮C';
  }
  
  return 'B'; // デフォルト
}

/**
 * シート編集時に見込度を再計算（onEdit用）
 */
function updateProspectRankOnEdit(e) {
  if (!e || !e.source) return;
  
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  
  // 対象シートのみ（統合シート版）
  if (sheetName !== CONFIG.SHEETS.LEADS) {
    return;
  }
  
  const editedRow = e.range.getRow();
  if (editedRow === 1) return; // ヘッダー行はスキップ
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const editedColumn = headers[e.range.getColumn() - 1];
  
  // 見込度計算に必要な列が編集された場合のみ再計算
  const triggerColumns = ['温度感', '想定規模', '顧客タイプ', '返信速度', '月間見込み金額'];
  
  if (triggerColumns.includes(editedColumn)) {
    const rowData = sheet.getRange(editedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const lead = {};
    headers.forEach((header, i) => {
      lead[header] = rowData[i];
    });
    
    const newRank = calculateProspectRank(lead);
    const rankColIndex = headers.indexOf('見込度');
    
    if (rankColIndex !== -1) {
      sheet.getRange(editedRow, rankColIndex + 1).setValue(newRank);
    }
  }
}

/**
 * 指定行の見込度を再計算（手動実行用）
 */
function recalculateProspectRank(sheet, rowNum) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const lead = {};
  headers.forEach((header, i) => {
    lead[header] = rowData[i];
  });
  
  const newRank = calculateProspectRank(lead);
  const rankColIndex = headers.indexOf('見込度');
  
  if (rankColIndex !== -1) {
    sheet.getRange(rowNum, rankColIndex + 1).setValue(newRank);
  }
  
  return newRank;
}

/**
 * 全リードの見込度を一括再計算
 */
function recalculateAllProspectRanks() {
  const ss = getSpreadsheet();
  
  [CONFIG.SHEETS.LEADS_IN, CONFIG.SHEETS.LEADS_OUT].forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    
    const lastRow = sheet.getLastRow();
    for (let i = 2; i <= lastRow; i++) {
      recalculateProspectRank(sheet, i);
    }
    
    Logger.log(`「${sheetName}」の見込度を再計算しました。`);
  });
  
  SpreadsheetApp.getActiveSpreadsheet().toast('見込度を再計算しました。', '完了', 3);
}
