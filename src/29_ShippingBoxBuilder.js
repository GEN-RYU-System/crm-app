/**
 * 29_ShippingBoxBuilder.js
 *
 * 目的: 見積もり明細・オーダー明細の「商品ID + 数量 + コンディション」から
 *       箱を組み立て、estimateShippingFeeForFrontend に渡せる形にする。
 *
 * 【設計意図】
 *   - 数量がそのまま箱数になる。入数は使わない。
 *     数量 10・単位ボックス = 10箱。カード枚数ではない。
 *   - コンディションが単位を決め、単位が荷姿を決める連鎖。
 *     CONDITION → CONDITIONS.UNIT → PRODUCT_PACKAGES.(CASE/BOX/PACK)_PACKAGE_ID
 *              → PACKAGES → SIZES + WEIGHTS → 寸法・重量
 *   - スキップした明細は理由コード（英語）付きで返し、画面で表示する。
 *   - SQL 移行時、この組み立て処理はそのまま残る。
 *
 * 見積もり→配送先の国コード取得経路:
 *   経路A: QUOTES.ORDER_ID → ORDERS.SHIPPING_DESTINATION_ID
 *          → SHIPPING_DESTINATIONS.COUNTRY + ZIP
 *   経路B（ORDER_ID が空の場合）:
 *          QUOTES.CUSTOMER_ID → CUSTOMERS.COUNTRY（ZIP なし）
 */

// ============================================================
// スキップ理由コード
// ============================================================
var SBB_REASON_CONDITION_NOT_FOUND        = 'CONDITION_NOT_FOUND';
var SBB_REASON_CONDITION_NOT_TARGET       = 'CONDITION_NOT_SHIPPING_TARGET';
var SBB_REASON_CONDITION_UNIT_INAPPLICABLE = 'CONDITION_UNIT_NOT_APPLICABLE';
var SBB_REASON_PRODUCT_PACKAGE_NOT_FOUND  = 'PRODUCT_PACKAGE_NOT_FOUND';
var SBB_REASON_PACKAGE_ID_NOT_SET         = 'PACKAGE_ID_NOT_SET';
var SBB_REASON_PACKAGE_NOT_FOUND          = 'PACKAGE_NOT_FOUND';
var SBB_REASON_SIZE_NOT_FOUND             = 'SIZE_NOT_FOUND';
var SBB_REASON_WEIGHT_NOT_FOUND           = 'WEIGHT_NOT_FOUND';

// ============================================================
// 内部ヘルパー: マスタ一括読み込み
// ============================================================

/**
 * コンディションマスタを読み込み { conditionValue → row } マップを返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sbbLoadConditions_(ss) {
  var data = coreCustomerFrontendReadTable(ss, 'CONDITIONS', [
    'CONDITION_VALUE', 'UNIT', 'SHIPPING_TARGET', 'ACTIVE'
  ]);
  var map = {};
  data.rows.forEach(function(row) {
    var val = coreCustomerFrontendValue(row[data.indexes.CONDITION_VALUE]);
    if (val) {
      map[val] = {
        unit:           coreCustomerFrontendValue(row[data.indexes.UNIT]),
        shippingTarget: coreCustomerFrontendValue(row[data.indexes.SHIPPING_TARGET]),
        active:         coreCustomerFrontendValue(row[data.indexes.ACTIVE])
      };
    }
  });
  return map;
}

/**
 * 商品荷姿マスタを読み込み { sharedProductId|ownProductId → row } マップを返す。
 * 共用商品ID と自社商品ID の両方をキーとして登録する。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sbbLoadProductPackages_(ss) {
  var data = coreCustomerFrontendReadTable(ss, 'PRODUCT_PACKAGES', [
    'SHARED_PRODUCT_ID', 'OWN_PRODUCT_ID',
    'CASE_PACKAGE_ID', 'BOX_PACKAGE_ID', 'PACK_PACKAGE_ID', 'ACTIVE'
  ]);
  var map = {};
  data.rows.forEach(function(row) {
    var sharedId = coreCustomerFrontendValue(row[data.indexes.SHARED_PRODUCT_ID]);
    var ownId    = coreCustomerFrontendValue(row[data.indexes.OWN_PRODUCT_ID]);
    var entry = {
      casePackageId: coreCustomerFrontendValue(row[data.indexes.CASE_PACKAGE_ID]),
      boxPackageId:  coreCustomerFrontendValue(row[data.indexes.BOX_PACKAGE_ID]),
      packPackageId: coreCustomerFrontendValue(row[data.indexes.PACK_PACKAGE_ID]),
      active:        coreCustomerFrontendValue(row[data.indexes.ACTIVE])
    };
    if (sharedId) map[sharedId] = entry;
    if (ownId)    map[ownId]    = entry;
  });
  return map;
}

/**
 * 荷姿マスタを読み込み { packageId → row } マップを返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sbbLoadPackages_(ss) {
  var data = coreCustomerFrontendReadTable(ss, 'PACKAGES', [
    'PACKAGE_ID', 'SIZE_ID', 'WEIGHT_ID', 'ACTIVE'
  ]);
  var map = {};
  data.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[data.indexes.PACKAGE_ID]);
    if (id) {
      map[id] = {
        sizeId:   coreCustomerFrontendValue(row[data.indexes.SIZE_ID]),
        weightId: coreCustomerFrontendValue(row[data.indexes.WEIGHT_ID]),
        active:   coreCustomerFrontendValue(row[data.indexes.ACTIVE])
      };
    }
  });
  return map;
}

/**
 * サイズマスタを読み込み { sizeId → row } マップを返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sbbLoadSizes_(ss) {
  var data = coreCustomerFrontendReadTable(ss, 'SIZES', [
    'SIZE_ID', 'LENGTH', 'WIDTH', 'HEIGHT'
  ]);
  var map = {};
  data.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[data.indexes.SIZE_ID]);
    if (id) {
      map[id] = {
        length: Number(coreCustomerFrontendValue(row[data.indexes.LENGTH])) || 0,
        width:  Number(coreCustomerFrontendValue(row[data.indexes.WIDTH]))  || 0,
        height: Number(coreCustomerFrontendValue(row[data.indexes.HEIGHT])) || 0
      };
    }
  });
  return map;
}

/**
 * 重量マスタを読み込み { weightId → row } マップを返す。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}
 */
function _sbbLoadWeights_(ss) {
  var data = coreCustomerFrontendReadTable(ss, 'WEIGHTS', [
    'WEIGHT_ID', 'WEIGHT'
  ]);
  var map = {};
  data.rows.forEach(function(row) {
    var id = coreCustomerFrontendValue(row[data.indexes.WEIGHT_ID]);
    if (id) {
      map[id] = {
        weight: Number(coreCustomerFrontendValue(row[data.indexes.WEIGHT])) || 0
      };
    }
  });
  return map;
}

// ============================================================
// 内部ヘルパー: 配送先解決
// ============================================================

/**
 * QUOTES.ORDER_ID → ORDERS.SHIPPING_DESTINATION_ID → SHIPPING_DESTINATIONS
 * で国コードと郵便番号を解決する。
 * ORDER_ID が空の場合は CUSTOMERS.COUNTRY にフォールバックする。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} quoteOrderId  QUOTES.ORDER_ID（空の場合は ''）
 * @param {string} customerId    QUOTES.CUSTOMER_ID（空の場合は ''）
 * @returns {{ countryCode: string, postalCode: string }}
 * @throws {Error} QUOTE_COUNTRY_NOT_RESOLVABLE
 */
function _sbbResolveQuoteCountry_(ss, quoteOrderId, customerId) {
  // 経路A: ORDER_ID → ORDERS → SHIPPING_DESTINATIONS
  if (quoteOrderId) {
    var ordersData = coreCustomerFrontendReadTable(ss, 'ORDERS', [
      'ORDER_ID', 'SHIPPING_DESTINATION_ID'
    ]);
    var orderRow = null;
    for (var i = 0; i < ordersData.rows.length; i++) {
      var row = ordersData.rows[i];
      if (coreCustomerFrontendValue(row[ordersData.indexes.ORDER_ID]) === quoteOrderId) {
        orderRow = row;
        break;
      }
    }
    if (orderRow) {
      var destId = coreCustomerFrontendValue(orderRow[ordersData.indexes.SHIPPING_DESTINATION_ID]);
      if (destId) {
        var destsData = coreCustomerFrontendReadTable(ss, 'SHIPPING_DESTINATIONS', [
          'SHIPPING_DESTINATION_ID', 'COUNTRY', 'ZIP'
        ]);
        for (var j = 0; j < destsData.rows.length; j++) {
          var dr = destsData.rows[j];
          if (coreCustomerFrontendValue(dr[destsData.indexes.SHIPPING_DESTINATION_ID]) === destId) {
            return {
              countryCode: coreCustomerFrontendValue(dr[destsData.indexes.COUNTRY]),
              postalCode:  coreCustomerFrontendValue(dr[destsData.indexes.ZIP])
            };
          }
        }
      }
    }
  }

  // 経路B: CUSTOMER_ID → CUSTOMERS.COUNTRY（ZIP なし）
  if (customerId) {
    var custData = coreCustomerFrontendReadTable(ss, 'CUSTOMERS', [
      'CUSTOMER_ID', 'COUNTRY'
    ]);
    for (var k = 0; k < custData.rows.length; k++) {
      var cr = custData.rows[k];
      if (coreCustomerFrontendValue(cr[custData.indexes.CUSTOMER_ID]) === customerId) {
        var country = coreCustomerFrontendValue(cr[custData.indexes.COUNTRY]);
        if (country) {
          return { countryCode: country, postalCode: '' };
        }
      }
    }
  }

  throw new Error('QUOTE_COUNTRY_NOT_RESOLVABLE');
}

/**
 * ORDERS.SHIPPING_DESTINATION_ID → SHIPPING_DESTINATIONS で国コードと郵便番号を解決する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} shippingDestinationId
 * @returns {{ countryCode: string, postalCode: string }}
 * @throws {Error} ORDER_COUNTRY_NOT_RESOLVABLE
 */
function _sbbResolveOrderCountry_(ss, shippingDestinationId) {
  if (!shippingDestinationId) throw new Error('ORDER_COUNTRY_NOT_RESOLVABLE');

  var destsData = coreCustomerFrontendReadTable(ss, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'COUNTRY', 'ZIP'
  ]);
  for (var i = 0; i < destsData.rows.length; i++) {
    var row = destsData.rows[i];
    if (coreCustomerFrontendValue(row[destsData.indexes.SHIPPING_DESTINATION_ID]) === shippingDestinationId) {
      return {
        countryCode: coreCustomerFrontendValue(row[destsData.indexes.COUNTRY]),
        postalCode:  coreCustomerFrontendValue(row[destsData.indexes.ZIP])
      };
    }
  }
  throw new Error('ORDER_COUNTRY_NOT_RESOLVABLE');
}

// ============================================================
// 公開関数1: 明細から箱を組み立てる
// ============================================================

/**
 * 明細リストから箱を組み立てる。
 *
 * @param {Array<{ productId: string, quantity: number, condition: string }>} lines
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{ boxes: Array<{ length: number, width: number, height: number, actualWeight: number }>,
 *             skipped: Array<{ productId: string, condition: string, reason: string }> }}
 */
function buildBoxesFromLines_(lines, ss) {
  // マスタを一括ロード（全明細で共有）
  var conditionsMap    = _sbbLoadConditions_(ss);
  var productPackagesMap = _sbbLoadProductPackages_(ss);
  var packagesMap      = _sbbLoadPackages_(ss);
  var sizesMap         = _sbbLoadSizes_(ss);
  var weightsMap       = _sbbLoadWeights_(ss);

  // 対応単位 → 荷姿IDフィールドの対応
  var unitKeyToPackageIdField = {
    'ケース':   'casePackageId',
    'ボックス': 'boxPackageId',
    'パック':   'packPackageId'
  };

  var boxes   = [];
  var skipped = [];

  lines.forEach(function(line) {
    var productId = String(line.productId || '').trim();
    var quantity  = Number(line.quantity)  || 0;
    var condition = String(line.condition  || '').trim();

    // 1. コンディションマスタを引く
    var condEntry = conditionsMap[condition];
    if (!condEntry) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_CONDITION_NOT_FOUND });
      return;
    }

    // 送料計算対象チェック（TRUE 以外はスキップ）
    if (condEntry.shippingTarget !== 'TRUE' && condEntry.shippingTarget !== true) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_CONDITION_NOT_TARGET });
      return;
    }

    // 対応単位チェック
    var unit = condEntry.unit;
    if (unit === '対象外' || !unitKeyToPackageIdField[unit]) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_CONDITION_UNIT_INAPPLICABLE });
      return;
    }

    // 2. 商品荷姿マスタを引く
    var ppEntry = productPackagesMap[productId];
    if (!ppEntry) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_PRODUCT_PACKAGE_NOT_FOUND });
      return;
    }

    // 3. 対応単位に応じて荷姿IDを選ぶ
    var packageIdField = unitKeyToPackageIdField[unit];
    var packageId = ppEntry[packageIdField];
    if (!packageId) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_PACKAGE_ID_NOT_SET });
      return;
    }

    // 4. 荷姿マスタからサイズID・重量IDを引く
    var pkgEntry = packagesMap[packageId];
    if (!pkgEntry) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_PACKAGE_NOT_FOUND });
      return;
    }

    var sizeEntry   = sizesMap[pkgEntry.sizeId];
    var weightEntry = weightsMap[pkgEntry.weightId];

    if (!sizeEntry) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_SIZE_NOT_FOUND });
      return;
    }
    if (!weightEntry) {
      skipped.push({ productId: productId, condition: condition, reason: SBB_REASON_WEIGHT_NOT_FOUND });
      return;
    }

    // 5. 数量の分だけ箱を作る（入数は使わない）
    for (var i = 0; i < quantity; i++) {
      boxes.push({
        length:       sizeEntry.length,
        width:        sizeEntry.width,
        height:       sizeEntry.height,
        actualWeight: weightEntry.weight
      });
    }
  });

  return { boxes: boxes, skipped: skipped };
}

// ============================================================
// 公開関数2: 見積もりから送料を計算
// ============================================================

/**
 * 見積もり明細の商品ID・数量・コンディションから箱を組み立て、
 * 送料見積もりを計算する。
 *
 * 配送先の国コード・郵便番号は以下の順で解決する:
 *   1. QUOTES.ORDER_ID → ORDERS.SHIPPING_DESTINATION_ID → SHIPPING_DESTINATIONS
 *   2. QUOTES.CUSTOMER_ID → CUSTOMERS.COUNTRY（ZIP なし）
 *
 * @param {string} sessionId
 * @param {string} quoteId
 * @returns {{ success: boolean, skipped: Array, results?: Array }}
 */
function estimateShippingFeeForQuoteForFrontend(sessionId, quoteId) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!quoteId) throw new Error('QUOTE_ID_REQUIRED');

  var ss = getSpreadsheet();

  // 見積もりヘッダー読み込み（ORDER_ID・CUSTOMER_ID 取得）
  var quotesData = coreCustomerFrontendReadTable(ss, 'QUOTES', [
    'QUOTE_ID', 'ORDER_ID', 'CUSTOMER_ID'
  ]);
  var quoteRow = null;
  for (var i = 0; i < quotesData.rows.length; i++) {
    var row = quotesData.rows[i];
    if (coreCustomerFrontendValue(row[quotesData.indexes.QUOTE_ID]) === quoteId) {
      quoteRow = row;
      break;
    }
  }
  if (!quoteRow) throw new Error('QUOTE_NOT_FOUND: ' + quoteId);

  var quoteOrderId = coreCustomerFrontendValue(quoteRow[quotesData.indexes.ORDER_ID]);
  var customerId   = coreCustomerFrontendValue(quoteRow[quotesData.indexes.CUSTOMER_ID]);

  // 国コード・郵便番号を解決
  var location = _sbbResolveQuoteCountry_(ss, quoteOrderId, customerId);

  // 見積もり明細読み込み（CONDITION は '状態' 列）
  var linesData = coreCustomerFrontendReadTable(ss, 'QUOTE_LINES', [
    'QUOTE_ID', 'PRODUCT_ID', 'QUANTITY', 'CONDITION'
  ]);
  var rawLines = linesData.rows
    .filter(function(r) {
      return coreCustomerFrontendValue(r[linesData.indexes.QUOTE_ID]) === quoteId;
    })
    .map(function(r) {
      return {
        productId: coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
        quantity:  Number(coreCustomerFrontendValue(r[linesData.indexes.QUANTITY])) || 0,
        condition: coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
      };
    });

  // 箱を組み立てる
  var built = buildBoxesFromLines_(rawLines, ss);

  if (built.boxes.length === 0) {
    return { success: false, reason: 'NO_BOXES', skipped: built.skipped };
  }

  // 送料計算
  var result = estimateShippingFeeForFrontend(sessionId, {
    countryCode: location.countryCode,
    postalCode:  location.postalCode || undefined,
    boxes:       built.boxes,
    linkType:    'QUOTE',
    linkId:      quoteId,
    save:        true
  });

  return { success: true, skipped: built.skipped, results: result.results };
}

// ============================================================
// 公開関数3: 受注から送料を計算
// ============================================================

/**
 * オーダー明細の商品ID・数量・コンディションから箱を組み立て、
 * 送料見積もりを計算する。
 *
 * 配送先は ORDERS.SHIPPING_DESTINATION_ID → SHIPPING_DESTINATIONS から解決する。
 *
 * @param {string} sessionId
 * @param {string} orderId
 * @returns {{ success: boolean, skipped: Array, results?: Array }}
 */
function estimateShippingFeeForOrderForFrontend(sessionId, orderId) {
  setEmailFromSession(sessionId);
  checkPermission('deal_edit');

  if (!orderId) throw new Error('ORDER_ID_REQUIRED');

  var ss = getSpreadsheet();

  // オーダー読み込み（SHIPPING_DESTINATION_ID 取得）
  var ordersData = coreCustomerFrontendReadTable(ss, 'ORDERS', [
    'ORDER_ID', 'SHIPPING_DESTINATION_ID'
  ]);
  var orderRow = null;
  for (var i = 0; i < ordersData.rows.length; i++) {
    var row = ordersData.rows[i];
    if (coreCustomerFrontendValue(row[ordersData.indexes.ORDER_ID]) === orderId) {
      orderRow = row;
      break;
    }
  }
  if (!orderRow) throw new Error('ORDER_NOT_FOUND: ' + orderId);

  var shippingDestId = coreCustomerFrontendValue(orderRow[ordersData.indexes.SHIPPING_DESTINATION_ID]);

  // 国コード・郵便番号を解決
  var location = _sbbResolveOrderCountry_(ss, shippingDestId);

  // オーダー明細読み込み（CONDITION は 'コンディション' 列）
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

  // 箱を組み立てる
  var built = buildBoxesFromLines_(rawLines, ss);

  if (built.boxes.length === 0) {
    return { success: false, reason: 'NO_BOXES', skipped: built.skipped };
  }

  // 送料計算（linkType='INVOICE'）
  var result = estimateShippingFeeForFrontend(sessionId, {
    countryCode: location.countryCode,
    postalCode:  location.postalCode || undefined,
    boxes:       built.boxes,
    linkType:    'INVOICE',
    linkId:      orderId,
    save:        true
  });

  return { success: true, skipped: built.skipped, results: result.results };
}
