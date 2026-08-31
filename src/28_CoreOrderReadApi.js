/**
 * Core Schema V1 を正本としてオーダー（請求書）を読み取る React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

var CORE_ORDERS_CACHE_INDEX      = 'CORE_ORDERS_CACHE_INDEX_V4';
var CORE_ORDERS_CACHE_PREFIX     = 'CORE_ORDERS_CACHE_V4_';
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

  // 国マスタを1回だけ読み、ISO2 → 日本語名の対応表を作る
  var countryJaNameByIso2 = buildCountryJaNameMap_(spreadsheet);

  // PURCHASES を1回読み、ORDER_ID → 仕入れ状態キー配列のマップを作る
  var purchaseStatusByOrder = buildPurchaseStatusByOrder_(spreadsheet);

  // SHIPPING_DESTINATIONS を1回読み、SHIPPING_DESTINATION_ID → COUNTRY の対応表を作る
  var shippingDests = coreCustomerFrontendReadTable(spreadsheet, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'COUNTRY'
  ]);
  var shippingCountryByDestId = shippingDests.rows.reduce(function(map, row) {
    var id      = coreCustomerFrontendValue(row[shippingDests.indexes.SHIPPING_DESTINATION_ID]);
    var country = coreCustomerFrontendValue(row[shippingDests.indexes.COUNTRY]);
    if (id) map[id] = country || '';
    return map;
  }, {});

  // SHIPMENTS を1回全件読み、ORDER_ID でグルーピングして発送段階を判定する
  var shipmentStageByOrder = buildShipmentStageByOrder_(spreadsheet);

  var orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'CUSTOMER_ID', 'INVOICE_NUMBER', 'INVOICE_ISSUED_AT',
    'PAYMENT_METHOD', 'INVOICE_TOTAL', 'CURRENCY',
    'PAYMENT_DUE_AT', 'PAYMENT_STATUS', 'INVOICE_TOTAL_JPY',
    'STATUS', 'PAYMENT_CONFIRMED_AT', 'SHIPPING_DESTINATION_ID'
  ]);

  var rows = orders.rows
    .filter(function(row) {
      return coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    })
    .map(function(row) {
      var customerId        = coreCustomerFrontendValue(row[orders.indexes.CUSTOMER_ID]);
      var orderId           = coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
      var shippingDestId    = coreCustomerFrontendValue(row[orders.indexes.SHIPPING_DESTINATION_ID]);
      var psResult          = resolvePurchaseStage_(purchaseStatusByOrder[orderId] || []);
      var shippingCountry   = shippingCountryByDestId[shippingDestId] || '';
      var shippingCountryJa = shippingCountry ? (countryJaNameByIso2[shippingCountry] || shippingCountry) : '';
      return {
        orderId:         orderId,
        customerName:    customerNameById[customerId] || '',
        invoiceNumber:   coreCustomerFrontendValue(row[orders.indexes.INVOICE_NUMBER]),
        invoiceIssuedAt: coreCustomerFrontendValue(row[orders.indexes.INVOICE_ISSUED_AT]),
        paymentMethod:   coreCustomerFrontendValue(row[orders.indexes.PAYMENT_METHOD]),
        invoiceTotal:    coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]),
        currency:        coreCustomerFrontendValue(row[orders.indexes.CURRENCY]),
        paymentDueAt:         coreCustomerFrontendValue(row[orders.indexes.PAYMENT_DUE_AT]),
        paymentStatus:        coreCustomerFrontendValue(row[orders.indexes.PAYMENT_STATUS]),
        invoiceTotalJpy:      coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL_JPY]),
        status:               coreCustomerFrontendValue(row[orders.indexes.STATUS]),
        paymentConfirmedAt:   coreCustomerFrontendValue(row[orders.indexes.PAYMENT_CONFIRMED_AT]),
        purchaseCount:        psResult.count,
        purchaseStatus:       psResult.key,
        shippingCountry:      shippingCountry,
        shippingCountryJa:    shippingCountryJa,
        shipmentStage:        shipmentStageByOrder[orderId] || 'NOT_STARTED'
      };
    });

  writeCacheChunks_(CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX, rows, CORE_ORDERS_CACHE_TTL, CORE_ORDERS_CACHE_CHUNK_SIZE);
  return rows;
}

/**
 * 受注一覧 + ステータス選択肢を1回の呼び出しで返す（プリフェッチ用バッチAPI）。
 * orders キャッシュは getCoreOrdersForFrontend と共有する（CORE_ORDERS_CACHE_INDEX）。
 * @param {string} sessionId
 * @param {boolean} [forceRefresh]
 * @returns {{ orders: Object[], statusOptions: { key: string, label: string }[] }}
 */
function getCoreOrdersBatchForFrontend(sessionId, forceRefresh) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var statusOptions = CORE_ORDER_STATUS_TAB_KEYS.map(function(key) {
    return { key: key, label: getCoreSchemaV1Value('ORDERS', 'STATUS', key) };
  });

  if (forceRefresh !== true) {
    var cached = readCacheChunks_(CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX);
    if (cached !== null) return { orders: cached, statusOptions: statusOptions };
  }

  var spreadsheet = getSpreadsheet();

  var customers = coreCustomerFrontendReadTable(spreadsheet, 'CUSTOMERS', [
    'CUSTOMER_ID', 'CUSTOMER_NAME'
  ]);
  var customerNameById = customers.rows.reduce(function(map, row) {
    var id   = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_ID]);
    var name = coreCustomerFrontendValue(row[customers.indexes.CUSTOMER_NAME]);
    if (id) map[id] = name;
    return map;
  }, {});

  // 国マスタを1回だけ読み、ISO2 → 日本語名の対応表を作る
  var countryJaNameByIso2 = buildCountryJaNameMap_(spreadsheet);

  // PURCHASES を1回読み、ORDER_ID → 仕入れ状態キー配列のマップを作る
  var purchaseStatusByOrder = buildPurchaseStatusByOrder_(spreadsheet);

  // SHIPPING_DESTINATIONS を1回読み、SHIPPING_DESTINATION_ID → COUNTRY の対応表を作る
  var shippingDests = coreCustomerFrontendReadTable(spreadsheet, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'COUNTRY'
  ]);
  var shippingCountryByDestId = shippingDests.rows.reduce(function(map, row) {
    var id      = coreCustomerFrontendValue(row[shippingDests.indexes.SHIPPING_DESTINATION_ID]);
    var country = coreCustomerFrontendValue(row[shippingDests.indexes.COUNTRY]);
    if (id) map[id] = country || '';
    return map;
  }, {});

  // SHIPMENTS を1回全件読み、ORDER_ID でグルーピングして発送段階を判定する
  var shipmentStageByOrder = buildShipmentStageByOrder_(spreadsheet);

  var orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'CUSTOMER_ID', 'INVOICE_NUMBER', 'INVOICE_ISSUED_AT',
    'PAYMENT_METHOD', 'INVOICE_TOTAL', 'CURRENCY',
    'PAYMENT_DUE_AT', 'PAYMENT_STATUS', 'INVOICE_TOTAL_JPY',
    'STATUS', 'PAYMENT_CONFIRMED_AT', 'SHIPPING_DESTINATION_ID'
  ]);

  var rows = orders.rows
    .filter(function(row) {
      return coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    })
    .map(function(row) {
      var customerId        = coreCustomerFrontendValue(row[orders.indexes.CUSTOMER_ID]);
      var orderId           = coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
      var shippingDestId    = coreCustomerFrontendValue(row[orders.indexes.SHIPPING_DESTINATION_ID]);
      var psResult          = resolvePurchaseStage_(purchaseStatusByOrder[orderId] || []);
      var shippingCountry   = shippingCountryByDestId[shippingDestId] || '';
      var shippingCountryJa = shippingCountry ? (countryJaNameByIso2[shippingCountry] || shippingCountry) : '';
      return {
        orderId:            orderId,
        customerName:       customerNameById[customerId] || '',
        invoiceNumber:      coreCustomerFrontendValue(row[orders.indexes.INVOICE_NUMBER]),
        invoiceIssuedAt:    coreCustomerFrontendValue(row[orders.indexes.INVOICE_ISSUED_AT]),
        paymentMethod:      coreCustomerFrontendValue(row[orders.indexes.PAYMENT_METHOD]),
        invoiceTotal:       coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]),
        currency:           coreCustomerFrontendValue(row[orders.indexes.CURRENCY]),
        paymentDueAt:       coreCustomerFrontendValue(row[orders.indexes.PAYMENT_DUE_AT]),
        paymentStatus:      coreCustomerFrontendValue(row[orders.indexes.PAYMENT_STATUS]),
        invoiceTotalJpy:    coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL_JPY]),
        status:             coreCustomerFrontendValue(row[orders.indexes.STATUS]),
        paymentConfirmedAt: coreCustomerFrontendValue(row[orders.indexes.PAYMENT_CONFIRMED_AT]),
        purchaseCount:      psResult.count,
        purchaseStatus:     psResult.key,
        shippingCountry:    shippingCountry,
        shippingCountryJa:  shippingCountryJa,
        shipmentStage:      shipmentStageByOrder[orderId] || 'NOT_STARTED'
      };
    });

  writeCacheChunks_(CORE_ORDERS_CACHE_INDEX, CORE_ORDERS_CACHE_PREFIX, rows, CORE_ORDERS_CACHE_TTL, CORE_ORDERS_CACHE_CHUNK_SIZE);
  return { orders: rows, statusOptions: statusOptions };
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
      recipientName: coreCustomerFrontendValue(row[shippingDests.indexes.RECIPIENT_NAME]),
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
  orderRow.shippingRecipientName    = shippingDest.recipientName || '';
  orderRow.shippingAddressLine1     = shippingDest.addressLine1 || '';
  orderRow.shippingAddressLine2     = shippingDest.addressLine2 || '';
  orderRow.shippingAddressLine3     = shippingDest.addressLine3 || '';
  orderRow.shippingCity             = shippingDest.city         || '';
  orderRow.shippingState            = shippingDest.state        || '';
  orderRow.shippingZip              = shippingDest.zip          || '';
  orderRow.shippingCountry          = shippingDest.country      || '';

  // PAYMENT_DESTINATION → 表示名・請求先住所解決
  var paymentDests = coreCustomerFrontendReadTable(ss, 'PAYMENT_DESTINATIONS', [
    'PAYMENT_DESTINATION_ID', 'DISPLAY_NAME', 'BILLING_NAME',
    'ADDRESS_LINE_1', 'ADDRESS_LINE_2', 'ADDRESS_LINE_3',
    'CITY', 'STATE', 'ZIP', 'COUNTRY', 'TAX_ID'
  ]);
  var paymentDestById = paymentDests.rows.reduce(function(map, row) {
    var id = coreCustomerFrontendValue(row[paymentDests.indexes.PAYMENT_DESTINATION_ID]);
    if (!id) return map;
    map[id] = {
      name:         coreCustomerFrontendValue(row[paymentDests.indexes.DISPLAY_NAME])
                 || coreCustomerFrontendValue(row[paymentDests.indexes.BILLING_NAME]),
      addressLine1: coreCustomerFrontendValue(row[paymentDests.indexes.ADDRESS_LINE_1]),
      addressLine2: coreCustomerFrontendValue(row[paymentDests.indexes.ADDRESS_LINE_2]),
      addressLine3: coreCustomerFrontendValue(row[paymentDests.indexes.ADDRESS_LINE_3]),
      city:         coreCustomerFrontendValue(row[paymentDests.indexes.CITY]),
      state:        coreCustomerFrontendValue(row[paymentDests.indexes.STATE]),
      zip:          coreCustomerFrontendValue(row[paymentDests.indexes.ZIP]),
      country:      coreCustomerFrontendValue(row[paymentDests.indexes.COUNTRY]),
      taxId:        coreCustomerFrontendValue(row[paymentDests.indexes.TAX_ID])
    };
    return map;
  }, {});
  var paymentDest = paymentDestById[orderRow.PAYMENT_DESTINATION_ID] || {};
  orderRow.paymentDestinationName  = paymentDest.name         || '';
  orderRow.billingAddressLine1     = paymentDest.addressLine1 || '';
  orderRow.billingAddressLine2     = paymentDest.addressLine2 || '';
  orderRow.billingAddressLine3     = paymentDest.addressLine3 || '';
  orderRow.billingCity             = paymentDest.city         || '';
  orderRow.billingState            = paymentDest.state        || '';
  orderRow.billingZip              = paymentDest.zip          || '';
  orderRow.billingCountry          = paymentDest.country      || '';
  orderRow.billingTaxId            = paymentDest.taxId        || '';

  // ── ORDER_LINES ─────────────────────────────────────────────────────────────
  var lineFields = [
    'ORDER_LINE_ID', 'ORDER_ID', 'LINE_NUMBER', 'CATEGORY',
    'PRODUCT_NAME', 'STATUS', 'SKU', 'QUANTITY', 'UNIT_PRICE', 'SUBTOTAL', 'PRODUCT_ID'
  ];
  var allLines = readDetailSheet_(ss, 'ORDER_LINES', lineFields);
  var lines = allLines.filter(function(row) {
    return String(row.ORDER_ID || '').trim() === String(orderId || '').trim();
  });

  // PRODUCTS → ENGLISH_TITLE 解決（各明細行に英語商品名を付与）
  var productsData = coreCustomerFrontendReadTable(ss, 'PRODUCTS', ['PRODUCT_ID', 'ENGLISH_TITLE']);
  var englishTitleById = productsData.rows.reduce(function(map, row) {
    var id    = coreCustomerFrontendValue(row[productsData.indexes.PRODUCT_ID]);
    var title = coreCustomerFrontendValue(row[productsData.indexes.ENGLISH_TITLE]);
    if (id) map[id] = title || '';
    return map;
  }, {});
  lines.forEach(function(line) {
    line.ENGLISH_TITLE = englishTitleById[line.PRODUCT_ID] || '';
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
    'SHIPPED_AT', 'TRACKING_NUMBER', 'LENGTH', 'WIDTH', 'HEIGHT',
    'WEIGHT', 'ESTIMATED_SHIPPING_FEE',
    'LABEL_URL', 'INVOICE_URL',
    'INSPECTION', 'PACKING', 'STORAGE', 'PICKUP_REQUEST', 'NOTIFICATION',
    'SHIPPING_ASSIGNEE_ID', 'NOTE'
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
 * 国マスタを1回読み、ISO2 コード → 日本語名 のマップを返す。
 * 国マスタシートが存在しない場合は空オブジェクトを返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}  { [iso2: string]: string }
 */
function buildCountryJaNameMap_(ss) {
  var sheet = ss.getSheetByName('国マスタ');
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {};

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var iso2Idx  = rawHeaders.indexOf('country_code');
  var nameJaIdx = rawHeaders.indexOf('name_ja');
  if (iso2Idx === -1 || nameJaIdx === -1) return {};

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var map = {};
  data.forEach(function(row) {
    var iso2   = String(row[iso2Idx]  || '').trim();
    var nameJa = String(row[nameJaIdx] || '').trim();
    if (iso2 && nameJa) map[iso2] = nameJa;
  });
  return map;
}

/**
 * SHIPMENTS シートを全件読み、ORDER_ID → 発送段階キー のマップを返す。
 * 段階判定は「最も進んでいない行の段階」を採用する。
 *
 * 段階優先順（低い方が先）:
 *   NOT_STARTED < PREPARING < LABELING < AWAITING_PICKUP < SHIPPED < DONE
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}  { [orderId: string]: string }
 */
function buildShipmentStageByOrder_(ss) {
  var sheet = getCoreSchemaV1Sheet(ss, 'SHIPMENTS');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {};

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerToIdx = {};
  rawHeaders.forEach(function(h, i) {
    var key = String(h).trim();
    if (key) headerToIdx[key] = i;
  });

  // ヘッダー名を Registry から解決する
  // PACKING・STORAGE は段階判定に使用しない（検品完了後、梱包とラベル手配は並行して進むため）
  var orderIdHeader      = getCoreSchemaV1HeaderName('SHIPMENTS', 'ORDER_ID');
  var inspectionHeader   = getCoreSchemaV1HeaderName('SHIPMENTS', 'INSPECTION');
  var trackingHeader     = getCoreSchemaV1HeaderName('SHIPMENTS', 'TRACKING_NUMBER');
  var pickupHeader       = getCoreSchemaV1HeaderName('SHIPMENTS', 'PICKUP_REQUEST');
  var notificationHeader = getCoreSchemaV1HeaderName('SHIPMENTS', 'NOTIFICATION');

  var orderIdIdx      = headerToIdx[orderIdHeader];
  var inspectionIdx   = headerToIdx[inspectionHeader];
  var trackingIdx     = headerToIdx[trackingHeader];
  var pickupIdx       = headerToIdx[pickupHeader];
  var notificationIdx = headerToIdx[notificationHeader];

  var STAGE_PRIORITY = ['NOT_STARTED', 'PREPARING', 'LABELING', 'AWAITING_PICKUP', 'SHIPPED', 'DONE'];

  /**
   * 発送行1行の段階を返す。
   * NOT_STARTED  : （行なし — 呼び出し元で処理）
   * PREPARING    : INSPECTION が空
   * LABELING     : INSPECTION あり、TRACKING_NUMBER が空
   * AWAITING_PICKUP : TRACKING_NUMBER あり、PICKUP_REQUEST が空
   * SHIPPED      : PICKUP_REQUEST あり、NOTIFICATION が空
   * DONE         : NOTIFICATION あり
   */
  function resolveRowStage(row) {
    var inspection   = String(row[inspectionIdx]   || '').trim();
    var tracking     = String(row[trackingIdx]     || '').trim();
    var pickup       = String(row[pickupIdx]       || '').trim();
    var notification = String(row[notificationIdx] || '').trim();

    if (notification) return 'DONE';
    if (pickup)       return 'SHIPPED';
    if (tracking)     return 'AWAITING_PICKUP';
    if (inspection)   return 'LABELING';
    return 'PREPARING';
  }

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // ORDER_ID → 発送行配列のマップを作成
  var rowsByOrder = {};
  data.forEach(function(row) {
    var orderId = (orderIdIdx !== undefined) ? String(row[orderIdIdx] || '').trim() : '';
    if (!orderId) return;
    if (!rowsByOrder[orderId]) rowsByOrder[orderId] = [];
    rowsByOrder[orderId].push(row);
  });

  // 各オーダーについて「最も進んでいない段階」を返す
  var stageByOrder = {};
  Object.keys(rowsByOrder).forEach(function(orderId) {
    var rows = rowsByOrder[orderId];
    var minIdx = STAGE_PRIORITY.length - 1; // 初期値: DONE
    rows.forEach(function(row) {
      var stage = resolveRowStage(row);
      var idx = STAGE_PRIORITY.indexOf(stage);
      if (idx < minIdx) minIdx = idx;
    });
    stageByOrder[orderId] = STAGE_PRIORITY[minIdx];
  });

  return stageByOrder;
}

/**
 * PURCHASES シートを1回読み、ORDER_ID → 仕入れステータス値（シート格納値）の配列マップを返す。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object}  { [orderId: string]: string[] }
 */
function buildPurchaseStatusByOrder_(ss) {
  var purchasesTable = coreCustomerFrontendReadTable(ss, 'PURCHASES', ['ORDER_ID', 'STATUS']);
  var map = {};
  purchasesTable.rows.forEach(function(row) {
    var pOrderId = coreCustomerFrontendValue(row[purchasesTable.indexes.ORDER_ID]);
    var pStatus  = coreCustomerFrontendValue(row[purchasesTable.indexes.STATUS]);
    if (!pOrderId) return;
    if (!map[pOrderId]) map[pOrderId] = [];
    map[pOrderId].push(pStatus);
  });
  return map;
}

/**
 * 仕入れ行のステータス値（シート格納値）配列から、最も進んでいない段階のキーと件数を返す。
 * 段階順: NOT_ORDERED < ORDERED < CONFIRMED < PAID
 * 0件の場合は { count: 0, key: '' } を返す。
 *
 * @param {string[]} statusValues  シート格納値の配列（例: ['発注済み', '未発注']）
 * @returns {{ count: number, key: string }}
 */
function resolvePurchaseStage_(statusValues) {
  var priority = ['NOT_ORDERED', 'ORDERED', 'CONFIRMED', 'PAID'];
  if (!statusValues || statusValues.length === 0) {
    return { count: 0, key: '' };
  }
  var valueToKey = {};
  priority.forEach(function(key) {
    valueToKey[getCoreSchemaV1Value('PURCHASES', 'STATUS', key)] = key;
  });
  var minIdx = priority.length;
  statusValues.forEach(function(val) {
    var key = valueToKey[val];
    if (key === undefined) return;
    var idx = priority.indexOf(key);
    if (idx < minIdx) minIdx = idx;
  });
  return {
    count: statusValues.length,
    key:   minIdx < priority.length ? priority[minIdx] : ''
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

/**
 * DEV専用: ORDER_ID を指定して ORDERS シートの STATUS / PAYMENT_STATUS 等を確認する。
 * dryRunCheckOrderDetailLookup が PR15 で削除されたため復元。書き込みなし。
 *
 * @param {string} orderId 例: 'OD-00177'
 * @returns {{ found: boolean, row: Object, total: number }}
 */
function dryRunGetOrderStatus(orderId) {
  if (getEnvironment() !== 'development') {
    throw new Error('dryRunGetOrderStatus は DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var data = readDetailSheet_(ss, 'ORDERS', [
    'ORDER_ID', 'STATUS', 'PAYMENT_STATUS', 'INVOICE_NUMBER',
    'PAYMENT_CONFIRMED_AT', 'CANCELLATION_REASON'
  ]);
  var targetId = String(orderId || '').trim();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i].ORDER_ID || '').trim() === targetId) {
      return { found: true, row: data[i], total: data.length };
    }
  }
  return { found: false, total: data.length };
}
