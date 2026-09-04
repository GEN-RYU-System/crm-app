/**
 * 99_DevSharedInventoryUniquenessAudit.js
 *
 * 目的: 共用在庫（SHARED_INVENTORY）1086行の列組み合わせ一意性を確認する。
 *      schema-review-materials.md の PO 判断材料収集用。
 *
 * 禁止事項:
 *   - シートへの書き込み（setValue / setValues / appendRow 等）
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run auditSharedInventoryUniqueness
 */

/**
 * 共用在庫シートの列組み合わせ一意性を確認する（読み取り専用）。
 *
 * 確認する組み合わせ:
 *   A: (product_id, supplier)          ← 選択肢1 の UNIQUE 制約候補
 *   B: (product_id, condition, supplier) ← 選択肢2 の複合 PK 候補
 *   C: (product_id のみ)               ← NULL/空の件数確認
 *   D: 全11列完全一致（完全重複行）
 *
 * @returns {{
 *   totalDataRows: number,
 *   productIdNullCount: number,
 *   supplierEmptyCount: number,
 *   conditionEmptyCount: number,
 *   comboA: { isUnique: boolean, duplicateKeyCount: number, sampleDuplicates: Array },
 *   comboB: { isUnique: boolean, duplicateKeyCount: number, sampleDuplicates: Array },
 *   fullDuplicateRowCount: number
 * }}
 */
function auditSharedInventoryUniqueness() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditSharedInventoryUniqueness は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var tableDef = getCoreSchemaV1Table('SHARED_INVENTORY');
  var sheet    = ss.getSheetByName(tableDef.sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + tableDef.sheetName);
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    Logger.log('データ行なし');
    return { totalDataRows: 0 };
  }

  // ヘッダー行から各列インデックスを特定（列番号の直書き禁止）
  var headerRow       = sheet.getRange(tableDef.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0];
  var productIdHeader = getCoreSchemaV1HeaderName('SHARED_INVENTORY', 'PRODUCT_ID'); // 'product_id'
  var supplierHeader  = getCoreSchemaV1HeaderName('SHARED_INVENTORY', 'SUPPLIER');   // '提供者'
  var conditionHeader = getCoreSchemaV1HeaderName('SHARED_INVENTORY', 'CONDITION');  // 'Condition'

  var productIdIdx  = headerRow.indexOf(productIdHeader);
  var supplierIdx   = headerRow.indexOf(supplierHeader);
  var conditionIdx  = headerRow.indexOf(conditionHeader);

  if (productIdIdx === -1) throw new Error('product_id 列が見つかりません。ヘッダー: ' + JSON.stringify(headerRow));
  if (supplierIdx  === -1) throw new Error('提供者 列が見つかりません。');
  if (conditionIdx === -1) throw new Error('Condition 列が見つかりません。');

  // 全データ行を取得
  var dataRowCount = lastRow - tableDef.headerRowNumber;
  var allData      = sheet.getRange(tableDef.headerRowNumber + 1, 1, dataRowCount, lastCol).getDisplayValues();

  // 各列の空値カウント
  var productIdNullCount  = 0;
  var supplierEmptyCount  = 0;
  var conditionEmptyCount = 0;

  // 組み合わせカウント用マップ
  var comboAMap = {}; // (product_id, supplier)
  var comboBMap = {}; // (product_id, condition, supplier)
  var fullRowMap = {}; // 全列完全一致

  allData.forEach(function(row) {
    var pid  = String(row[productIdIdx]  || '').trim();
    var supp = String(row[supplierIdx]   || '').trim();
    var cond = String(row[conditionIdx]  || '').trim();

    if (pid  === '') productIdNullCount++;
    if (supp === '') supplierEmptyCount++;
    if (cond === '') conditionEmptyCount++;

    var keyA    = pid + '\u0000' + supp;
    var keyB    = pid + '\u0000' + cond + '\u0000' + supp;
    var fullKey = row.join('\u0000');

    comboAMap[keyA]   = (comboAMap[keyA]   || 0) + 1;
    comboBMap[keyB]   = (comboBMap[keyB]   || 0) + 1;
    fullRowMap[fullKey] = (fullRowMap[fullKey] || 0) + 1;
  });

  // 重複キーを抽出（件数 >= 2 のもの）
  function getDuplicates(map, limit) {
    var dups = [];
    Object.keys(map).forEach(function(k) {
      if (map[k] >= 2) dups.push({ key: k, count: map[k] });
    });
    dups.sort(function(a, b) { return b.count - a.count; });
    return dups.slice(0, limit);
  }

  var comboADups = getDuplicates(comboAMap, 10);
  var comboBDups = getDuplicates(comboBMap, 10);

  // 完全重複行（全列一致）の件数
  var fullDupRowCount = 0;
  Object.keys(fullRowMap).forEach(function(k) {
    if (fullRowMap[k] >= 2) fullDupRowCount += (fullRowMap[k] - 1);
  });

  var result = {
    totalDataRows:       dataRowCount,
    productIdNullCount:  productIdNullCount,
    supplierEmptyCount:  supplierEmptyCount,
    conditionEmptyCount: conditionEmptyCount,
    comboA: {
      description:       '(product_id, supplier) の組み合わせ一意性',
      isUnique:          comboADups.length === 0,
      duplicateKeyCount: comboADups.length,
      sampleDuplicates:  comboADups
    },
    comboB: {
      description:       '(product_id, condition, supplier) の組み合わせ一意性',
      isUnique:          comboBDups.length === 0,
      duplicateKeyCount: comboBDups.length,
      sampleDuplicates:  comboBDups
    },
    fullDuplicateRowCount: fullDupRowCount
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
