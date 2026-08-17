/**
 * 仕入れリスト作成スクリプト v3.0
 */
function transferSelectedToPurchaseList() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const srcSheet = ss.getActiveSheet();
    const salesConfig = ERP_CONFIG.SHEETS.SALES_DATA;
    
    // 1. シート検証 (IDまたは名前で一致を確認)
    if (srcSheet.getSheetId() !== salesConfig.ID && srcSheet.getName() !== salesConfig.NAME) {
      ui.alert('エラー', `このスクリプトは「${salesConfig.NAME}」シートでのみ実行可能です。`, ui.ButtonSet.OK);
      return;
    }

    const selection = srcSheet.getSelection().getActiveRange();
    if (!selection) {
      ui.alert('エラー', '行を選択してください。', ui.ButtonSet.OK);
      return;
    }

    const startRow = selection.getRow();
    const numRows = selection.getNumRows();
    const HEADER_ROW = 4;      // 取引状況のヘッダー行
    const DATA_START_ROW = 7;  // 実際のデータ開始行

    if (startRow < DATA_START_ROW) {
      ui.alert('エラー', `${DATA_START_ROW}行目以降のデータを選択してください。`, ui.ButtonSet.OK);
      return;
    }

    // 2. 動的なヘッダーマッピング
    const headers = srcSheet.getRange(HEADER_ROW, 1, 1, srcSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const salesHeaderDef = ERP_CONFIG.HEADERS.SALES_DATA;
    
    const colMap = {
      NAME: headers.indexOf(salesHeaderDef.NAME),
      COND: headers.indexOf(salesHeaderDef.COND),
      QTY: headers.indexOf(salesHeaderDef.QTY),
      PRICE: headers.indexOf(salesHeaderDef.PRICE)
    };

    // 必須列の存在確認
    const missing = Object.entries(colMap).filter(([k, v]) => v === -1).map(([k]) => salesHeaderDef[k]);
    if (missing.length > 0) {
      ui.alert('エラー', `以下の列が見つかりません（${HEADER_ROW}行目）:\n${missing.join(', ')}`, ui.ButtonSet.OK);
      return;
    }

    // 3. マスター取得
    const masterMap = loadMasterData(ss, ui);
    if (!masterMap) return;

    // 4. データ検証
    // 選択範囲ではなく、その行全体のデータを取得（列インデックスに合わせるため）
    const fullRowData = srcSheet.getRange(startRow, 1, numRows, srcSheet.getLastColumn()).getValues();
    const {validated, errors} = processTransactionData(fullRowData, colMap, masterMap, startRow);

    if (errors.length > 0) {
      showDetailedErrors(ui, errors);
      return;
    }

    if (validated.length === 0) {
      ui.alert('通知', '転記対象のデータがありませんでした。', ui.ButtonSet.OK);
      return;
    }

    // 5. 書き出し
    const targetSheet = getSheetByConfig(ERP_CONFIG.SHEETS.PURCHASE_LIST);
    if (!targetSheet) throw new Error('仕入れリストシートが見つかりません。');

    ensurePurchaseListHeaders(targetSheet);
    const startWriteRow = targetSheet.getLastRow() + 1;
    targetSheet.getRange(startWriteRow, 1, validated.length, 5).setValues(validated);

    // 書式適用
    targetSheet.getRange(startWriteRow, 3, validated.length, 1).setNumberFormat('#,##0');
    targetSheet.getRange(startWriteRow, 5, validated.length, 1).setNumberFormat('¥#,##0');

    logTransaction(ss, 'import_success', { count: validated.length });
    ui.alert('完了', `✅ ${validated.length}件 転記しました。`, ui.ButtonSet.OK);

  } catch (e) {
    console.error(e);
    ui.alert('システムエラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * 以下、ヘルパー関数（ロジック最適化済み）
 */
function loadMasterData(ss, ui) {
  const masterSheet = getSheetByConfig(ERP_CONFIG.SHEETS.PRODUCT_MASTER);
  if (!masterSheet) return null;

  const data = masterSheet.getDataRange().getValues();
  const mHeaders = data[0].map(h => String(h).trim());
  const idxEN = mHeaders.indexOf(ERP_CONFIG.HEADERS.PRODUCT.TITLE_EN);
  const idxJP = mHeaders.indexOf(ERP_CONFIG.HEADERS.PRODUCT.TITLE_JP);

  if (idxEN === -1 || idxJP === -1) return null;

  const masterMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const en = data[i][idxEN];
    const jp = data[i][idxJP];
    if (en && jp) masterMap.set(normalizeTitle(String(en)), { english: en, japanese: jp });
  }
  return masterMap;
}

function processTransactionData(dataValues, colMap, masterMap, startRow) {
  const validated = [];
  const errors = [];

  dataValues.forEach((row, index) => {
    const rowNum = startRow + index;
    const name = row[colMap.NAME];
    if (!name || String(name).trim() === '') return;

    const cond = String(row[colMap.COND] || '').trim();
    const qty = row[colMap.QTY];
    const price = row[colMap.PRICE];
    const rowErrors = [];

    const master = masterMap.get(normalizeTitle(String(name)));
    if (!master) rowErrors.push(`未登録の商品: ${name}`);
    if (!cond) rowErrors.push('状態が未入力');
    if (isNaN(qty) || qty <= 0) rowErrors.push(`数量不備: ${qty}`);

    const unit = detectUnit(cond);
    if (unit === '不明') rowErrors.push(`単位判定不可: ${cond}`);

    if (rowErrors.length > 0) {
      errors.push({row: rowNum, reasons: rowErrors});
    } else {
      validated.push([master.japanese, cond, qty, unit, price]);
    }
  });
  return {validated, errors};
}

function normalizeTitle(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

function detectUnit(condition) {
  const c = condition.toLowerCase();
  if (c.includes('case')) return 'カートン';
  if (c.includes('box')) return 'BOX';
  if (c.includes('single')) return '枚';
  return '不明';
}

function ensurePurchaseListHeaders(sheet) {
  const headers = [['タイトル名', '状態', '数量', '単位', '売値']];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 5).setValues(headers).setFontWeight('bold').setBackground('#4a4a4a').setFontColor('#ffffff');
  }
}

function showDetailedErrors(ui, errors) {
  let msg = `⚠️ ${errors.length}件のエラー:\n\n` + errors.slice(0, 5).map(e => `行${e.row}: ${e.reasons.join(', ')}`).join('\n');
  if (errors.length > 5) msg += '\n...他多数';
  ui.alert('転記エラー', msg, ui.ButtonSet.OK);
}

function logTransaction(ss, action, data) {
  try {
    let logSheet = ss.getSheetByName('ImportLog') || ss.insertSheet('ImportLog');
    logSheet.appendRow([new Date(), resolveCurrentUserEmail(), action, JSON.stringify(data)]);
  } catch (e) {}
}