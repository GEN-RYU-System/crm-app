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
    'CASE_PACKAGE_ID', 'BOX_PACKAGE_ID', 'PACK_PACKAGE_ID', 'IS_ACTIVE'
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
        isActive:         coreCustomerFrontendValue(r[ppData.indexes.IS_ACTIVE])
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

  // ── ORDER_LINES 全行の ORDER_ID + LINE_ID + PRODUCT_ID を一覧 ──
  var linesData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'LINE_ID', 'ORDER_ID', 'PRODUCT_ID', 'CONDITION'
  ]);

  var lines = linesData.rows.map(function(r) {
    return {
      lineId:    coreCustomerFrontendValue(r[linesData.indexes.LINE_ID]),
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
 * ORDER_LINES の指定明細1行のコンディション列にのみ書き込む。
 *
 * @param {string} mode        'DRY_RUN' または 'APPLY'
 * @param {string} orderLineId 対象明細 ID（LINE_ID 列の値）
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

  var lineIdColName    = getCoreSchemaV1HeaderName('ORDER_LINES', 'LINE_ID');
  var conditionColName = getCoreSchemaV1HeaderName('ORDER_LINES', 'CONDITION');

  var lineIdCol    = headers.indexOf(lineIdColName);
  var conditionCol = headers.indexOf(conditionColName);

  if (lineIdCol === -1) {
    throw new Error('LINE_ID 列が見つかりません: ' + lineIdColName);
  }
  if (conditionCol === -1) {
    throw new Error('CONDITION 列が見つかりません: ' + conditionColName);
  }

  // 対象行を LINE_ID で特定（targetRow は appendRow の前に確定）
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
      reason:      'LINE_ID が見つかりません',
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
