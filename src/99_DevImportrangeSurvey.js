/**
 * 99_DevImportrangeSurvey.js
 * 調査専用: 集計同期・商品マスタ同期・SCM出力同期 の IMPORTRANGE 数式を確認する
 * 読み取りのみ。書き込みなし。
 */

/**
 * 3シートの1行目・2行目の数式と列数・データ行数を返す
 */
function surveyImportrangeFormulas() {
  const ss = getSpreadsheet();
  const targetSheets = ['集計同期', '商品マスタ同期', 'SCM出力同期'];

  const results = targetSheets.map(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { sheetName: sheetName, exists: false };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // 1行目の数式を全列取得
    const row1Formulas = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getFormulas()[0]
      : [];

    // 2行目の数式を全列取得（データがある場合）
    const row2Formulas = lastRow >= 2 && lastCol > 0
      ? sheet.getRange(2, 1, 1, lastCol).getFormulas()[0]
      : [];

    // 数式セルのみ抽出（スプレッドシートIDをマスク）
    const maskId = function(formula) {
      return formula.replace(/"1[A-Za-z0-9_-]{25,}"/g, '"[SPREADSHEET_ID]"');
    };

    const row1NonEmpty = row1Formulas
      .map(function(f, i) { return f ? { col: i + 1, formula: maskId(f) } : null; })
      .filter(Boolean);

    const row2NonEmpty = row2Formulas
      .map(function(f, i) { return f ? { col: i + 1, formula: maskId(f) } : null; })
      .filter(Boolean);

    return {
      sheetName: sheetName,
      exists: true,
      lastRow: lastRow,
      lastCol: lastCol,
      dataRows: lastRow > 0 ? lastRow - 1 : 0,
      row1FormulaCount: row1NonEmpty.length,
      row1Formulas: row1NonEmpty,
      row2FormulaCount: row2NonEmpty.length,
      row2Formulas: row2NonEmpty
    };
  });

  // clasp の表示上限でネスト配列が [Array] になるため、文字列化して返す
  return { results: JSON.stringify(results) };
}

/**
 * SCM出力同期 の現在のヘッダー行を全件返す（DRY RUN 用）
 * 読み取りのみ。書き込みなし。
 */
function surveyScmOutputHeaders() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('SCM出力同期');
  if (!sheet) {
    return { error: 'SCM出力同期 シートが見つかりません' };
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  const a1Formula = sheet.getRange('A1').getFormula();
  const maskId = function(f) {
    return f.replace(/"1[A-Za-z0-9_-]{25,}"/g, '"[SPREADSHEET_ID]"');
  };

  return JSON.stringify({
    sheetName: 'SCM出力同期',
    lastRow: lastRow,
    lastCol: lastCol,
    dataRows: lastRow > 0 ? lastRow - 1 : 0,
    a1Formula: maskId(a1Formula),
    headers: headers.map(function(name, i) {
      return { col: i + 1, name: String(name) };
    })
  });
}

/**
 * DEV環境のスプレッドシートIDプロパティ名と、ブック名を確認する（読み取りのみ）
 * ID の値は返さない。存在確認とブック名のみ。
 */
function surveyDevSpreadsheetIdentity() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(props).sort();

  // SPREADSHEET_ID 系のキーが存在するか確認（値は返さない）
  const spreadsheetIdKeys = keys.filter(function(k) {
    return k.toUpperCase().indexOf('SPREADSHEET') !== -1 || k.toUpperCase().indexOf('SS_ID') !== -1;
  });

  const ss = getSpreadsheet();
  const name = ss.getName();

  return JSON.stringify({
    allPropertyKeys: keys,
    spreadsheetRelatedKeys: spreadsheetIdKeys,
    spreadsheetName: name,
    isProd: name === 'CRM APP_PROD'
  });
}

/**
 * 「共用在庫」シートの書き込み結果を検証する（読み取りのみ）
 * 1. 行数・列数・ヘッダー全件
 * 2. 期待11列との一致確認
 * 3. Quantity / Unit Price の型確認（文字列になっている行数）
 * 4. product_id と 商品マスタ同期 の照合
 */
function verifySharedInventorySheet() {
  const ss = getSpreadsheet();
  const EXPECTED_HEADERS = [
    'Series', 'Quantity', 'Unit Price', 'Condition', 'Status',
    'Note_JA', 'Note_EN', '提供者', 'product_id', 'raw_name', '除外理由'
  ];

  // ── 1. 共用在庫シート ──────────────────────────────────────────────
  const sheet = ss.getSheetByName('共用在庫');
  if (!sheet) {
    return JSON.stringify({ error: '「共用在庫」シートが見つかりません' });
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];

  // ── 2. 期待列との差分 ───────────────────────────────────────────────
  const missingFromSheet  = EXPECTED_HEADERS.filter(function(h) { return headers.indexOf(h) === -1; });
  const extraInSheet      = headers.filter(function(h) { return EXPECTED_HEADERS.indexOf(h) === -1; });
  const headersMatch      = missingFromSheet.length === 0 && extraInSheet.length === 0 &&
                            JSON.stringify(headers) === JSON.stringify(EXPECTED_HEADERS);

  // ── 3. Quantity / Unit Price の型確認 ───────────────────────────────
  var quantityStringRows = 0;
  var unitPriceStringRows = 0;
  const dataRows = lastRow - 1;

  if (dataRows > 0) {
    const qIdx = headers.indexOf('Quantity');
    const upIdx = headers.indexOf('Unit Price');

    if (qIdx !== -1 || upIdx !== -1) {
      const colCount = lastCol;
      const data = sheet.getRange(2, 1, dataRows, colCount).getValues();

      data.forEach(function(row) {
        if (qIdx !== -1 && typeof row[qIdx] === 'string' && row[qIdx] !== '') quantityStringRows++;
        if (upIdx !== -1 && typeof row[upIdx] === 'string' && row[upIdx] !== '') unitPriceStringRows++;
      });
    }
  }

  // ── 4. product_id 照合 ──────────────────────────────────────────────
  const masterSheet = ss.getSheetByName('商品マスタ同期');
  var masterLookupResult = null;

  if (masterSheet && dataRows > 0) {
    const masterLastRow = masterSheet.getLastRow();
    const masterHeaders = masterSheet.getRange(1, 1, 1, masterSheet.getLastColumn()).getValues()[0].map(String);
    const masterPidIdx = masterHeaders.indexOf('product_id');

    var masterIds = new Set();
    if (masterPidIdx !== -1 && masterLastRow > 1) {
      masterSheet.getRange(2, masterPidIdx + 1, masterLastRow - 1, 1).getValues()
        .forEach(function(r) { if (r[0]) masterIds.add(String(r[0]).trim()); });
    }

    const pidIdx = headers.indexOf('product_id');
    var notInMaster = [];
    if (pidIdx !== -1) {
      sheet.getRange(2, pidIdx + 1, dataRows, 1).getValues().forEach(function(r) {
        const pid = String(r[0]).trim();
        if (pid && !masterIds.has(pid)) notInMaster.push(pid);
      });
    }

    masterLookupResult = {
      masterRowCount: masterLastRow - 1,
      notInMasterCount: notInMaster.length,
      notInMasterIds: notInMaster
    };
  }

  return JSON.stringify({
    sheetName: '共用在庫',
    lastRow: lastRow,
    lastCol: lastCol,
    dataRows: dataRows,
    headers: headers,
    headersMatch: headersMatch,
    missingFromSheet: missingFromSheet,
    extraInSheet: extraInSheet,
    quantityStringRows: quantityStringRows,
    unitPriceStringRows: unitPriceStringRows,
    masterLookup: masterLookupResult
  });
}

/**
 * 「商品マスタ同期」シートの Category 全種類・件数と
 * Release Date の型内訳を実測する（読み取りのみ・書き込みなし）
 */
function surveyProductCategories() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('商品マスタ同期');
  if (!sheet) {
    return JSON.stringify({ error: '「商品マスタ同期」シートが見つかりません' });
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return JSON.stringify({ error: 'データ行がありません', lastRow: lastRow });
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const catIdx = headers.indexOf('Category');
  const rdIdx  = headers.indexOf('Release Date');

  if (catIdx === -1) {
    return JSON.stringify({ error: 'Category 列が見つかりません', headers: headers });
  }

  const dataRows = lastRow - 1;
  const data = sheet.getRange(2, 1, dataRows, lastCol).getValues();

  // ── Category 集計 ──────────────────────────────────────────────────
  const categoryCounts = {};
  var emptyCategory = 0;

  data.forEach(function(row) {
    const raw = row[catIdx];
    const val = (raw === null || raw === undefined) ? '' : String(raw).trim();
    if (val === '') {
      emptyCategory++;
    } else {
      categoryCounts[val] = (categoryCounts[val] || 0) + 1;
    }
  });

  // 件数の多い順にソート
  const categoryList = Object.keys(categoryCounts)
    .map(function(k) { return { category: k, count: categoryCounts[k] }; })
    .sort(function(a, b) { return b.count - a.count; });

  // ── Release Date 型内訳 ─────────────────────────────────────────────
  var rdDateCount   = 0;
  var rdStringCount = 0;
  var rdEmptyCount  = 0;
  var rdStringSamples = [];

  if (rdIdx !== -1) {
    data.forEach(function(row) {
      const val = row[rdIdx];
      if (val === null || val === undefined || val === '') {
        rdEmptyCount++;
      } else if (val instanceof Date) {
        rdDateCount++;
      } else {
        rdStringCount++;
        if (rdStringSamples.length < 5) rdStringSamples.push(String(val));
      }
    });
  }

  return JSON.stringify({
    sheetName: '商品マスタ同期',
    totalDataRows: dataRows,
    category: {
      columnIndex: catIdx + 1,
      uniqueCount: categoryList.length,
      emptyCount: emptyCategory,
      list: categoryList
    },
    releaseDate: {
      columnFound: rdIdx !== -1,
      columnIndex: rdIdx !== -1 ? rdIdx + 1 : null,
      dateInstanceCount: rdDateCount,
      stringCount: rdStringCount,
      emptyCount: rdEmptyCount,
      stringSamples: rdStringSamples
    }
  });
}

/**
 * 共用在庫マスタ用の空シートを4つ作成する（DEV環境のみ・書き込みあり）
 * 対象: 大分類マスタ_共用在庫 / 作品マスタ_共用在庫 / メーカーマスタ_共用在庫 / 商品区分マスタ_共用在庫
 * 前提チェック:
 *   1. スプレッドシート名が 'CRM APP_PROD' でないこと（DEV確認）
 *   2. 各シート名が既に存在しないこと（重複防止）
 */
function createSharedInventoryMasterSheets() {
  const SHEET_NAMES = [
    '大分類マスタ_共用在庫',
    '作品マスタ_共用在庫',
    'メーカーマスタ_共用在庫',
    '商品区分マスタ_共用在庫'
  ];

  const ss = getSpreadsheet();
  const ssName = ss.getName();

  // ── 1. PROD ガード ──────────────────────────────────────────────────
  if (ssName === 'CRM APP_PROD') {
    return JSON.stringify({ ok: false, error: 'PROD環境での実行は禁止されています', spreadsheetName: ssName });
  }

  // ── 2. 重複チェック ─────────────────────────────────────────────────
  const existing = SHEET_NAMES.filter(function(name) {
    return ss.getSheetByName(name) !== null;
  });
  if (existing.length > 0) {
    return JSON.stringify({ ok: false, error: '既に存在するシートがあります', existing: existing });
  }

  // ── 3. シート作成 ───────────────────────────────────────────────────
  var created = [];
  SHEET_NAMES.forEach(function(name) {
    ss.insertSheet(name);
    created.push(name);
  });

  return JSON.stringify({ ok: true, spreadsheetName: ssName, created: created });
}

/**
 * 4マスタシートの書き込み結果を検証する（読み取りのみ・書き込みなし）
 * - 各シートの行数・ヘッダー全件
 * - 商品マスタ同期の大分類ID/作品ID/メーカーID/product_category_ID との照合
 */
function verifySharedInventoryMasterSheets() {
  const ss = getSpreadsheet();

  const MASTER_DEFS = [
    { sheetName: '大分類マスタ_共用在庫',  expectedDataRows: 3,  productIdCol: '大分類ID' },
    { sheetName: '作品マスタ_共用在庫',    expectedDataRows: 11, productIdCol: '作品ID' },
    { sheetName: 'メーカーマスタ_共用在庫', expectedDataRows: 5,  productIdCol: 'メーカーID' },
    { sheetName: '商品区分マスタ_共用在庫', expectedDataRows: 2,  productIdCol: 'product_category_ID' }
  ];

  // ── 1. 各マスタシートの行数・ヘッダー ────────────────────────────────────
  const masterResults = MASTER_DEFS.map(function(m) {
    const sheet = ss.getSheetByName(m.sheetName);
    if (!sheet) return { sheetName: m.sheetName, exists: false };
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    const dataRows = lastRow > 1 ? lastRow - 1 : 0;
    return {
      sheetName: m.sheetName,
      exists: true,
      lastRow: lastRow,
      dataRows: dataRows,
      expectedDataRows: m.expectedDataRows,
      rowsMatch: dataRows === m.expectedDataRows,
      headers: headers
    };
  });

  // ── 2. 各マスタのID一覧（先頭列）を Set 化 ───────────────────────────────
  var masterIdSets = {};
  masterResults.forEach(function(mr) {
    if (!mr.exists || mr.lastRow < 2) { masterIdSets[mr.sheetName] = []; return; }
    const sheet = ss.getSheetByName(mr.sheetName);
    const ids = sheet.getRange(2, 1, mr.lastRow - 1, 1).getValues();
    masterIdSets[mr.sheetName] = ids.map(function(r) { return String(r[0]).trim(); }).filter(Boolean);
  });

  // ── 3. 商品マスタ同期との照合 ──────────────────────────────────────────────
  const productSheet = ss.getSheetByName('商品マスタ同期');
  var crossCheck = null;

  if (productSheet && productSheet.getLastRow() > 1) {
    const pLastRow  = productSheet.getLastRow();
    const pLastCol  = productSheet.getLastColumn();
    const pHeaders  = productSheet.getRange(1, 1, 1, pLastCol).getValues()[0].map(String);
    const pData     = productSheet.getRange(2, 1, pLastRow - 1, pLastCol).getValues();

    crossCheck = MASTER_DEFS.map(function(m) {
      const colIdx = pHeaders.indexOf(m.productIdCol);
      if (colIdx === -1) return { productIdCol: m.productIdCol, error: '列が見つかりません', masterSheet: m.sheetName };

      const masterIds = masterIdSets[m.sheetName] || [];
      const masterSet = {};
      masterIds.forEach(function(id) { masterSet[id] = true; });

      var emptyCount = 0;
      var notFound   = [];
      pData.forEach(function(row) {
        const val = String(row[colIdx]).trim();
        if (!val) { emptyCount++; return; }
        if (!masterSet[val]) notFound.push(val);
      });

      return {
        productIdCol:  m.productIdCol,
        masterSheet:   m.sheetName,
        masterIdCount: masterIds.length,
        emptyCount:    emptyCount,
        notFoundCount: notFound.length,
        notFoundIds:   notFound,
        ok:            notFound.length === 0
      };
    });
  }

  return JSON.stringify({ masterSheets: masterResults, crossCheck: crossCheck });
}
