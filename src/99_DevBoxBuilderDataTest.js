/**
 * 99_DevBoxBuilderDataTest.js
 *
 * 目的: buildBoxesFromLines_ の連鎖検証に必要な
 *       事前調査と、明細1行へのコンディション書き込みを行う DEV 専用関数。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - コンディション列以外への書き込み
 *   - 2行以上への書き込み
 *
 * 使い方（調査）:
 *   clasp run devInvestigateProductPackageSetup
 *
 * 使い方（書き込み）:
 *   clasp run devSetOrderLineCondition --params '["DRY_RUN","OL-XXXX","Sealed box"]'
 *   clasp run devSetOrderLineCondition --params '["APPLY","OL-XXXX","Sealed box"]'
 */

/**
 * PPK-0001 / PKG-0001 の内容と、
 * ORDER_LINES の全 productId を一覧する調査関数。
 *
 * 書き込み一切なし。
 *
 * @returns {string} JSON
 */
function devInvestigateProductPackageSetup() {
  if (getEnvironment() !== 'development') {
    throw new Error('devInvestigateProductPackageSetup は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // ── PRODUCT_PACKAGES からすべての行を読む ──
  var ppData = coreCustomerFrontendReadTable(ss, 'PRODUCT_PACKAGES', [
    'PRODUCT_PACKAGE_ID', 'SHARED_PRODUCT_ID', 'OWN_PRODUCT_ID',
    'CASE_PACKAGE_ID', 'BOX_PACKAGE_ID', 'PACK_PACKAGE_ID', 'ACTIVE'
  ]);

  var ppk0001 = null;
  ppData.rows.forEach(function(r) {
    var id = coreCustomerFrontendValue(r[ppData.indexes.PRODUCT_PACKAGE_ID]);
    if (id === 'PPK-0001') {
      ppk0001 = {
        productPackageId: id,
        sharedProductId:  coreCustomerFrontendValue(r[ppData.indexes.SHARED_PRODUCT_ID]),
        ownProductId:     coreCustomerFrontendValue(r[ppData.indexes.OWN_PRODUCT_ID]),
        casePackageId:    coreCustomerFrontendValue(r[ppData.indexes.CASE_PACKAGE_ID]),
        boxPackageId:     coreCustomerFrontendValue(r[ppData.indexes.BOX_PACKAGE_ID]),
        packPackageId:    coreCustomerFrontendValue(r[ppData.indexes.PACK_PACKAGE_ID]),
        active:           coreCustomerFrontendValue(r[ppData.indexes.ACTIVE])
      };
    }
  });

  // ── PACKAGES から PKG-0001 を読む ──
  var pkgData = coreCustomerFrontendReadTable(ss, 'PACKAGES', [
    'PACKAGE_ID', 'UNIT', 'SIZE_ID', 'WEIGHT_ID'
  ]);

  var pkg0001 = null;
  pkgData.rows.forEach(function(r) {
    var id = coreCustomerFrontendValue(r[pkgData.indexes.PACKAGE_ID]);
    if (id === 'PKG-0001') {
      pkg0001 = {
        packageId: id,
        unit:      coreCustomerFrontendValue(r[pkgData.indexes.UNIT]),
        sizeId:    coreCustomerFrontendValue(r[pkgData.indexes.SIZE_ID]),
        weightId:  coreCustomerFrontendValue(r[pkgData.indexes.WEIGHT_ID])
      };
    }
  });

  // ── ORDER_LINES 全行の ORDER_ID + ORDER_LINE_ID + PRODUCT_ID を一覧 ──
  var linesData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'ORDER_LINE_ID', 'ORDER_ID', 'PRODUCT_ID', 'CONDITION'
  ]);

  var lines = linesData.rows.map(function(r) {
    return {
      lineId:    coreCustomerFrontendValue(r[linesData.indexes.ORDER_LINE_ID]),
      orderId:   coreCustomerFrontendValue(r[linesData.indexes.ORDER_ID]),
      productId: coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
      condition: coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
    };
  });

  // PPK-0001 の product ID にマッチする行を抽出
  var ppk0001ProductId = ppk0001 ? (ppk0001.sharedProductId || ppk0001.ownProductId) : null;
  var matchingLines = ppk0001ProductId
    ? lines.filter(function(l) { return l.productId === ppk0001ProductId; })
    : [];

  return JSON.stringify({
    ppk0001:          ppk0001,
    pkg0001:          pkg0001,
    totalOrderLines:  lines.length,
    linesWithProduct: lines.filter(function(l) { return l.productId !== ''; }).length,
    matchingLines:    matchingLines
  });
}

/**
 * 指定オーダーの ORDER_LINES 行一覧（ORDER_LINE_ID / PRODUCT_ID / CONDITION）を返す。
 *
 * 書き込み一切なし。
 *
 * @param {string} orderId
 * @returns {string} JSON
 */
function devListOrderLinesForOrder(orderId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devListOrderLinesForOrder は development 環境でのみ実行できます。');
  }
  if (!orderId) throw new Error('orderId を指定してください。');

  var ss = getSpreadsheet();
  var linesData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'ORDER_LINE_ID', 'ORDER_ID', 'PRODUCT_ID', 'CONDITION'
  ]);

  var lines = linesData.rows
    .filter(function(r) {
      return coreCustomerFrontendValue(r[linesData.indexes.ORDER_ID]) === orderId;
    })
    .map(function(r) {
      return {
        orderLineId: coreCustomerFrontendValue(r[linesData.indexes.ORDER_LINE_ID]),
        productId:   coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
        condition:   coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
      };
    });

  return JSON.stringify({ orderId: orderId, lineCount: lines.length, lines: lines });
}

/**
 * ORDER_LINES の指定明細1行のコンディション列にのみ書き込む。
 *
 * @param {string} mode        'DRY_RUN' または 'APPLY'
 * @param {string} orderLineId 対象明細 ID（ORDER_LINE_ID 列の値）
 * @param {string} conditionValue 書き込むコンディション値
 * @returns {string} JSON
 */
function devSetOrderLineCondition(mode, orderLineId, conditionValue) {
  if (getEnvironment() !== 'development') {
    throw new Error('devSetOrderLineCondition は development 環境でのみ実行できます。');
  }

  // 引数チェック: 3つ揃わないと実行不可
  if (!mode || !orderLineId || !conditionValue) {
    throw new Error(
      'devSetOrderLineCondition: 引数が不足しています。' +
      'mode / orderLineId / conditionValue の3つを指定してください。'
    );
  }
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error('mode は "DRY_RUN" または "APPLY" を指定してください。');
  }

  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('ORDER_LINES');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ORDER_LINES シートが見つかりません: ' + sheetName);
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return JSON.stringify({ success: false, reason: 'データ行がありません' });
  }

  // ヘッダー行からインデックスを特定（列番号ハードコード禁止）
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var lineIdColName    = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
  var conditionColName = getCoreSchemaV1HeaderName('ORDER_LINES', 'CONDITION');

  var lineIdCol    = headers.indexOf(lineIdColName);
  var conditionCol = headers.indexOf(conditionColName);

  if (lineIdCol === -1) {
    throw new Error('ORDER_LINE_ID 列が見つかりません: ' + lineIdColName);
  }
  if (conditionCol === -1) {
    throw new Error('CONDITION 列が見つかりません: ' + conditionColName);
  }

  // 対象行を ORDER_LINE_ID で特定（targetRow は appendRow の前に確定）
  var dataValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRow  = -1;
  var beforeValue = '';

  for (var i = 0; i < dataValues.length; i++) {
    var lineId = String(dataValues[i][lineIdCol] || '').trim();
    if (lineId === orderLineId) {
      targetRow   = i + 2; // シート上の行番号（1-indexed、ヘッダー分+1）
      beforeValue = String(dataValues[i][conditionCol] || '');
      break;
    }
  }

  if (targetRow === -1) {
    return JSON.stringify({
      success:     false,
      reason:      'ORDER_LINE_ID が見つかりません',
      orderLineId: orderLineId
    });
  }

  var result = {
    mode:           mode,
    orderLineId:    orderLineId,
    targetRow:      targetRow,
    conditionCol:   conditionCol + 1, // 1-indexed
    conditionColName: conditionColName,
    beforeValue:    beforeValue,
    conditionValue: conditionValue
  };

  if (mode === 'DRY_RUN') {
    result.written = false;
    result.message = 'DRY_RUN: 書き込みは行いません';
    return JSON.stringify(result);
  }

  // APPLY: コンディション列にのみ書き込む
  sheet.getRange(targetRow, conditionCol + 1).setValue(conditionValue);

  // 書き込み後の値を検証
  var afterValue = sheet.getRange(targetRow, conditionCol + 1).getValue();
  result.written    = true;
  result.afterValue = String(afterValue || '');
  result.verified   = (result.afterValue === conditionValue);

  return JSON.stringify(result);
}

/**
 * ORDER_LINES の指定明細1行の PRODUCT_ID と CONDITION の2列にのみ書き込む。
 *
 * @param {string} mode           'DRY_RUN' または 'APPLY'
 * @param {string} orderLineId    対象明細 ID（ORDER_LINE_ID 列の値）
 * @param {string} productId      書き込む PRODUCT_ID 値
 * @param {string} conditionValue 書き込む CONDITION 値
 * @returns {string} JSON
 */
function devSetOrderLineProductAndCondition(mode, orderLineId, productId, conditionValue) {
  if (getEnvironment() !== 'development') {
    throw new Error('devSetOrderLineProductAndCondition は development 環境でのみ実行できます。');
  }

  // 引数チェック: 4つ揃わないと実行不可
  if (!mode || !orderLineId || !productId || !conditionValue) {
    throw new Error(
      'devSetOrderLineProductAndCondition: 引数が不足しています。' +
      'mode / orderLineId / productId / conditionValue の4つを指定してください。'
    );
  }
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error('mode は "DRY_RUN" または "APPLY" を指定してください。');
  }

  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('ORDER_LINES');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('ORDER_LINES シートが見つかりません: ' + sheetName);

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return JSON.stringify({ success: false, reason: 'データ行がありません' });

  // ヘッダーからインデックスを特定（列番号ハードコード禁止）
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var lineIdColName    = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
  var productIdColName = getCoreSchemaV1HeaderName('ORDER_LINES', 'PRODUCT_ID');
  var conditionColName = getCoreSchemaV1HeaderName('ORDER_LINES', 'CONDITION');

  var lineIdCol    = headers.indexOf(lineIdColName);
  var productIdCol = headers.indexOf(productIdColName);
  var conditionCol = headers.indexOf(conditionColName);

  if (lineIdCol    === -1) throw new Error('ORDER_LINE_ID 列が見つかりません: ' + lineIdColName);
  if (productIdCol === -1) throw new Error('PRODUCT_ID 列が見つかりません: '    + productIdColName);
  if (conditionCol === -1) throw new Error('CONDITION 列が見つかりません: '      + conditionColName);

  // 対象行を ORDER_LINE_ID で特定（新規行は作らない）
  var dataValues  = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRow   = -1;
  var beforeProductId  = '';
  var beforeCondition  = '';

  for (var i = 0; i < dataValues.length; i++) {
    var lineId = String(dataValues[i][lineIdCol] || '').trim();
    if (lineId === orderLineId) {
      targetRow        = i + 2; // 1-indexed (ヘッダー行 +1)
      beforeProductId  = String(dataValues[i][productIdCol]  || '');
      beforeCondition  = String(dataValues[i][conditionCol]  || '');
      break;
    }
  }

  if (targetRow === -1) {
    return JSON.stringify({ success: false, reason: 'ORDER_LINE_ID が見つかりません', orderLineId: orderLineId });
  }

  var result = {
    mode:             mode,
    orderLineId:      orderLineId,
    targetRow:        targetRow,
    productIdCol:     productIdCol + 1,
    productIdColName: productIdColName,
    conditionCol:     conditionCol + 1,
    conditionColName: conditionColName,
    beforeProductId:  beforeProductId,
    beforeCondition:  beforeCondition,
    productId:        productId,
    conditionValue:   conditionValue
  };

  if (mode === 'DRY_RUN') {
    result.written  = false;
    result.message  = 'DRY_RUN: 書き込みは行いません';
    return JSON.stringify(result);
  }

  // APPLY: PRODUCT_ID と CONDITION の2列にのみ書き込む
  sheet.getRange(targetRow, productIdCol  + 1).setValue(productId);
  sheet.getRange(targetRow, conditionCol  + 1).setValue(conditionValue);

  // 書き込み後の値を検証
  var afterProductId  = String(sheet.getRange(targetRow, productIdCol  + 1).getValue() || '');
  var afterCondition  = String(sheet.getRange(targetRow, conditionCol  + 1).getValue() || '');

  result.written          = true;
  result.afterProductId   = afterProductId;
  result.afterCondition   = afterCondition;
  result.verifiedProductId  = (afterProductId  === productId);
  result.verifiedCondition  = (afterCondition  === conditionValue);

  return JSON.stringify(result);
}

/**
 * ORD-XXXX の箱を組み立て、estimateShippingFeeForFrontend に渡して送料を算出する。
 * セッション必須だが deal_edit ロールのスタッフからセッションを自動取得する。
 * save: false で SHIPPING_FEE_ESTIMATES への書き込みを行わない。
 *
 * 報告する情報:
 *   - success: boolean（送料算出成功か）
 *   - boxCount: number（組み立てられた箱数）
 *   - carriersCount: number（送料を算出したキャリア数）
 *   - skipped: Array（スキップされた明細）
 *   ★ 送料の金額は含めない
 *
 * @param {string} orderId
 * @returns {string} JSON
 */
function devTestShippingFeeForOrderDev(orderId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestShippingFeeForOrderDev は development 環境でのみ実行できます。');
  }
  if (!orderId) throw new Error('orderId を指定してください。');

  var ss = getSpreadsheet();

  // ── セッション取得（deal_edit ロールの有効スタッフ）──
  var staffTable  = getCoreSchemaV1Table('STAFF');
  var staffSheet  = getCoreSchemaV1Sheet(ss, 'STAFF');
  var staffLastCol = staffSheet.getLastColumn();
  var staffHeaders = staffSheet
    .getRange(staffTable.headerRowNumber, 1, 1, staffLastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });

  var staffIdCol     = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID'));
  var staffStatusCol = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STATUS'));
  var staffRoleCol   = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'ROLE'));
  var staffLastRow   = staffSheet.getLastRow();
  var staffRows      = staffSheet
    .getRange(staffTable.headerRowNumber + 1, 1, staffLastRow - staffTable.headerRowNumber, staffLastCol)
    .getValues();

  var statusActive  = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  var dealEditRoles = [
    getCoreSchemaV1Value('STAFF', 'ROLE', 'OWNER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'LEADER'),
    getCoreSchemaV1Value('STAFF', 'ROLE', 'SALES')
  ];

  var staffId = null;
  for (var s = 0; s < staffRows.length; s++) {
    var status = String(staffRows[s][staffStatusCol] || '').trim();
    var role   = String(staffRows[s][staffRoleCol]   || '').trim();
    if (status === statusActive && dealEditRoles.indexOf(role) !== -1) {
      var sid = String(staffRows[s][staffIdCol] || '').trim();
      if (sid) { staffId = sid; break; }
    }
  }
  if (!staffId) return JSON.stringify({ success: false, reason: 'NO_ACTIVE_STAFF_WITH_DEAL_EDIT_ROLE' });

  var sessionId = createSession(staffId);

  // ── ORDERS から SHIPPING_DESTINATION_ID を取得 ──
  var ordersData = coreCustomerFrontendReadTable(ss, 'ORDERS', [
    'ORDER_ID', 'SHIPPING_DESTINATION_ID'
  ]);
  var shippingDestinationId = null;
  for (var o = 0; o < ordersData.rows.length; o++) {
    var row = ordersData.rows[o];
    if (coreCustomerFrontendValue(row[ordersData.indexes.ORDER_ID]) === orderId) {
      shippingDestinationId = coreCustomerFrontendValue(row[ordersData.indexes.SHIPPING_DESTINATION_ID]);
      break;
    }
  }
  if (!shippingDestinationId) {
    return JSON.stringify({ success: false, reason: 'ORDER_NOT_FOUND', orderId: orderId });
  }

  // ── 配送先から countryCode / postalCode を取得 ──
  var countryCode, postalCode;
  try {
    var countryResult = _sbbResolveOrderCountry_(ss, shippingDestinationId);
    countryCode = countryResult.countryCode;
    postalCode  = countryResult.postalCode;
  } catch (e) {
    return JSON.stringify({ success: false, reason: 'COUNTRY_NOT_RESOLVABLE', detail: e.message });
  }

  // ── ORDER_LINES から明細を読み込み ──
  var linesData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'ORDER_ID', 'PRODUCT_ID', 'QUANTITY', 'CONDITION'
  ]);
  var rawLines = linesData.rows
    .filter(function(r) {
      return coreCustomerFrontendValue(r[linesData.indexes.ORDER_ID]) === orderId;
    })
    .map(function(r) {
      return {
        productId: coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
        quantity:  Number(coreCustomerFrontendValue(r[linesData.indexes.QUANTITY])) || 0,
        condition: coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
      };
    });

  // ── 箱を組み立て ──
  var built = buildBoxesFromLines_(rawLines, ss);

  if (built.boxes.length === 0) {
    return JSON.stringify({
      success:  false,
      reason:   'NO_BOXES',
      boxCount: 0,
      skipped:  built.skipped
    });
  }

  // ── 送料算出（save: false で書き込みなし）──
  var estimateResult;
  try {
    estimateResult = estimateShippingFeeForFrontend(sessionId, {
      countryCode: countryCode,
      postalCode:  postalCode,
      boxes:       built.boxes,
      linkType:    'INVOICE',
      linkId:      orderId,
      save:        false
    });
  } catch (e) {
    return JSON.stringify({
      success:  false,
      reason:   'ESTIMATE_FAILED',
      detail:   e.message,
      boxCount: built.boxes.length,
      skipped:  built.skipped
    });
  }

  // 金額は返さない。算出できた（success + carriersCount）のみ報告
  var carriersCount = estimateResult && Array.isArray(estimateResult.results)
    ? estimateResult.results.length
    : 0;

  return JSON.stringify({
    success:       estimateResult && estimateResult.success === true,
    boxCount:      built.boxes.length,
    carriersCount: carriersCount,
    skipped:       built.skipped
  });
}
