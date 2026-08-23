/**
 * Core Schema V1 を正本としてオーダー（請求書）を読み取る React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

var CORE_ORDERS_CACHE_INDEX      = 'CORE_ORDERS_CACHE_INDEX_V2';
var CORE_ORDERS_CACHE_PREFIX     = 'CORE_ORDERS_CACHE_V2_';
var CORE_ORDERS_CACHE_CHUNK_SIZE = 90000;
var CORE_ORDERS_CACHE_TTL        = 600;

function getCoreOrdersForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (forceRefresh !== true) {
    var cached = readCacheChunks_(CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX);
    if (cached !== null) return cached;
  }

  var spreadsheet = getSpreadsheet();

  // 顧客マスタを1回だけ読み、ID→名前の対応表を作る（172回読まない）
  var customers = coreCustomerFrontendReadTable(spreadsheet, 'CUSTOMERS', [
    'CUSTOMER_ID', 'CUSTOMER_NAME'
  ]);
  var customerNameById = customers.rows.reduce(function(map, row) {
    var id   = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
    var name = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]);
    if (id) map[id] = name;
    return map;
  }, {});

  var orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'CUSTOMER_ID', 'INVOICE_NUMBER', 'INVOICE_ISSUED_AT',
    'PAYMENT_METHOD', 'INVOICE_TOTAL', 'CURRENCY',
    'PAYMENT_DUE_AT', 'PAYMENT_STATUS', 'INVOICE_TOTAL_JPY',
    'STATUS'
  ]);

  var rows = orders.rows
    .filter(function(row) {
      return coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    })
    .map(function(row) {
      var customerId = coreCustomerFrontendValue(row[orders.indexes.CUSTOMER_ID]);
      return {
        orderId:         coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]),
        customerName:    customerNameById[customerId] || '',
        invoiceNumber:   coreCustomerFrontendValue(row[orders.indexes.INVOICE_NUMBER]),
        invoiceIssuedAt: coreCustomerFrontendValue(row[orders.indexes.INVOICE_ISSUED_AT]),
        paymentMethod:   coreCustomerFrontendValue(row[orders.indexes.PAYMENT_METHOD]),
        invoiceTotal:    coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]),
        currency:        coreCustomerFrontendValue(row[orders.indexes.CURRENCY]),
        paymentDueAt:     coreCustomerFrontendValue(row[orders.indexes.PAYMENT_DUE_AT]),
        paymentStatus:    coreCustomerFrontendValue(row[orders.indexes.PAYMENT_STATUS]),
        invoiceTotalJpy:  coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL_JPY]),
        status:           coreCustomerFrontendValue(row[orders.indexes.STATUS])
      };
    });

  writeCacheChunks_(CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX, rows, CORE_ORDERS_CACHE_TTL, CORE_ORDERS_CACHE_CHUNK_SIZE);
  return rows;
}

/**
 * サイドメニューのタブとして表示するステータスを、表示順で返す。
 * UNKNOWN は業務上出さない前提のためタブに含めない。
 * （UNKNOWN の行が万一存在しても「すべて」タブには表示されるため取りこぼさない）
 */
var CORE_ORDER_STATUS_TAB_KEYS = [
  'AWAITING_PAYMENT',
  'SOURCING',
  'AWAITING_SHIPPING',
  'COMPLETED',
  'TROUBLE',
  'CANCELLED'
];

function getCoreOrderStatusOptionsForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  return CORE_ORDER_STATUS_TAB_KEYS.map(function(key) {
    return {
      key:   key,
      label: getCoreSchemaV1Value('ORDERS', 'STATUS', key)
    };
  });
}

/**
 * 1オーダーの詳細（本体 + 明細行 + 仕入れ行 + 発送行）を返す。
 *
 * @param {string} sessionId
 * @param {string} orderId
 * @returns {{ order: Object, lines: Object[], purchases: Object[], shipments: Object[] }
 *           | { success: false }}
 */
function getCoreOrderDetailForFrontend(sessionId, orderId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss = getSpreadsheet();

  // ── ORDERS ─────────────────────────────────────────────────────────────────
  var orderFields = [
    'ORDER_ID', 'INVOICE_NUMBER', 'ORDER_DATE', 'CUSTOMER_ID',
    'INVOICE_ISSUED_AT', 'PAYMENT_DUE_AT', 'PAYMENT_METHOD',
    'CURRENCY', 'EXCHANGE_RATE',
    'LINE_TOTAL', 'SHIPPING_FEE', 'DUTY', 'DISCOUNT', 'OTHER_FEE', 'INVOICE_TOTAL', 'INVOICE_TOTAL_JPY',
    'PAYMENT_STATUS', 'STATUS',
    'PAYMENT_CONFIRMED_AT', 'PAYMENT_CONFIRMATION_SOURCE',
    'SHIPPING_METHOD', 'SHIPPED_AT', 'TRACKING_NUMBER', 'SHIPPING_NOTE',
    'NOTE', 'TRANSACTION_NOTE', 'INTERNAL_NOTE',
    'SHIPPING_DESTINATION_ID', 'PAYMENT_DESTINATION_ID',
    'CANCELLATION_REASON', 'CANCELLATION_NOTE',
    'REGISTERED_AT', 'UPDATED_AT'
  ];
  var ordersData = readDetailSheet_(ss, 'ORDERS', orderFields);
  var orderRow = null;
  for (var i = 0; i < ordersData.length; i++) {
    if (String(ordersData[i].ORDER_ID || '').trim() === String(orderId || '').trim()) {
      orderRow = ordersData[i];
      break;
    }
  }
  if (!orderRow) return { success: false };

  // CUSTOMER_ID → 顧客名 解決
  var customers = coreCustomerFrontendReadTable(ss, 'CUSTOMERS', ['CUSTOMER_ID', 'CUSTOMER_NAME']);
  var customerNameById = customers.rows.reduce(function(map, row) {
    var id = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
    var name = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]);
    if (id) map[id] = name;
    return map;
  }, {});
  orderRow.customerName = customerNameById[orderRow.CUSTOMER_ID] || '';

  // AWAITING_PAYMENT ステータスの実値をフロントに渡す（日本語ハードコードを避けるため）
  orderRow.awaitingPaymentStatus = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');

  // SHIPPING_DESTINATION → 表示名・住所解決
  var shippingDests = coreCustomerFrontendReadTable(ss, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'DISPLAY_NAME', 'RECIPIENT_NAME',
    'ADDRESS_LINE_1', 'ADDRESS_LINE_2', 'ADDRESS_LINE_3',
    'CITY', 'STATE', 'ZIP', 'COUNTRY'
  ]);
  var shippingDestById = shippingDests.rows.reduce(function(map, row) {
    var id = coreCustomerFrontendValue(row[shippingDests.indexes.SHIPPING_DESTINATION_ID]);
    if (!id) return map;
    map[id] = {
      name:          coreCustomerFrontendValue(row[shippingDests.indexes.DISPLAY_NAME])
                  || coreCustomerFrontendValue(row[shippingDests.indexes.RECIPIENT_NAME]),
      addressLine1:  coreCustomerFrontendValue(row[shippingDests.indexes.ADDRESS_LINE_1]),
      addressLine2:  coreCustomerFrontendValue(row[shippingDests.indexes.ADDRESS_LINE_2]),
      addressLine3:  coreCustomerFrontendValue(row[shippingDests.indexes.ADDRESS_LINE_3]),
      city:          coreCustomerFrontendValue(row[shippingDests.indexes.CITY]),
      state:         coreCustomerFrontendValue(row[shippingDests.indexes.STATE]),
      zip:           coreCustomerFrontendValue(row[shippingDests.indexes.ZIP]),
      country:       coreCustomerFrontendValue(row[shippingDests.indexes.COUNTRY])
    };
    return map;
  }, {});
  var shippingDest = shippingDestById[orderRow.SHIPPING_DESTINATION_ID] || {};
  orderRow.shippingDestinationName  = shippingDest.name         || '';
  orderRow.shippingAddressLine1     = shippingDest.addressLine1 || '';
  orderRow.shippingAddressLine2     = shippingDest.addressLine2 || '';
  orderRow.shippingAddressLine3     = shippingDest.addressLine3 || '';
  orderRow.shippingCity             = shippingDest.city         || '';
  orderRow.shippingState            = shippingDest.state        || '';
  orderRow.shippingZip              = shippingDest.zip          || '';
  orderRow.shippingCountry          = shippingDest.country      || '';

  // PAYMENT_DESTINATION → 表示名解決
  var paymentDests = coreCustomerFrontendReadTable(ss, 'PAYMENT_DESTINATIONS', [
    'PAYMENT_DESTINATION_ID', 'DISPLAY_NAME', 'BILLING_NAME'
  ]);
  var paymentDestById = paymentDests.rows.reduce(function(map, row) {
    var id = coreCustomerFrontendValue(row[paymentDests.indexes.PAYMENT_DESTINATION_ID]);
    if (!id) return map;
    map[id] = {
      name: coreCustomerFrontendValue(row[paymentDests.indexes.DISPLAY_NAME])
         || coreCustomerFrontendValue(row[paymentDests.indexes.BILLING_NAME])
    };
    return map;
  }, {});
  var paymentDest = paymentDestById[orderRow.PAYMENT_DESTINATION_ID] || {};
  orderRow.paymentDestinationName = paymentDest.name || '';

  // ── ORDER_LINES ─────────────────────────────────────────────────────────────
  var lineFields = [
    'ORDER_LINE_ID', 'ORDER_ID', 'LINE_NUMBER', 'CATEGORY',
    'PRODUCT_NAME', 'STATUS', 'SKU', 'QUANTITY', 'UNIT_PRICE', 'SUBTOTAL', 'PRODUCT_ID'
  ];
  var allLines = readDetailSheet_(ss, 'ORDER_LINES', lineFields);
  var lines = allLines.filter(function(row) {
    return String(row.ORDER_ID || '').trim() === String(orderId || '').trim();
  });

  // ── PURCHASES ───────────────────────────────────────────────────────────────
  var purchaseFields = [
    'PURCHASE_ID', 'ORDER_ID', 'ORDERED_AT', 'TRANSACTION_NUMBER',
    'SUPPLIER', 'SUPPLIER_URL', 'QUANTITY', 'UNIT_PRICE', 'AMOUNT',
    'SHIPPING_OR_AGENCY_FEE', 'CARRIER', 'TRACKING_NUMBER', 'STATUS', 'NOTE'
  ];
  var allPurchases = readDetailSheet_(ss, 'PURCHASES', purchaseFields);
  var purchases = allPurchases.filter(function(row) {
    return String(row.ORDER_ID || '').trim() === String(orderId || '').trim();
  });

  // ── SHIPMENTS ───────────────────────────────────────────────────────────────
  var shipmentFields = [
    'SHIPMENT_ID', 'ORDER_ID', 'BOX_NUMBER', 'SHIPPING_METHOD',
    'SHIPPED_AT', 'TRACKING_NUMBER', 'WEIGHT',
    'PICKUP_REQUEST', 'NOTE'
  ];
  var allShipments = readDetailSheet_(ss, 'SHIPMENTS', shipmentFields);
  var shipments = allShipments.filter(function(row) {
    return String(row.ORDER_ID || '').trim() === String(orderId || '').trim();
  });

  return {
    order:     orderRow,
    lines:     lines,
    purchases: purchases,
    shipments: shipments
  };
}

/**
 * テーブルを1回だけ読み、論理フィールドキーをキーとするオブジェクト配列で返す。
 * readOrderStatusServiceSheet_ (26_OrderStatusService.js) と同じ方式。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tableKey
 * @param {string[]} fieldKeys
 * @returns {Object[]}
 */
function readDetailSheet_(ss, tableKey, fieldKeys) {
  var sheet   = getCoreSchemaV1Sheet(ss, tableKey);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerToIdx = {};
  rawHeaders.forEach(function(h, i) {
    var key = String(h).trim();
    if (key) headerToIdx[key] = i;
  });

  var fieldIdxMap = {};
  fieldKeys.forEach(function(fieldKey) {
    var physicalName = getCoreSchemaV1HeaderName(tableKey, fieldKey);
    if (headerToIdx[physicalName] !== undefined) {
      fieldIdxMap[fieldKey] = headerToIdx[physicalName];
    }
  });

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return data.map(function(row) {
    var obj = {};
    fieldKeys.forEach(function(fieldKey) {
      var idx = fieldIdxMap[fieldKey];
      obj[fieldKey] = (idx !== undefined) ? coreCustomerFrontendValue(row[idx]) : '';
    });
    return obj;
  });
}
