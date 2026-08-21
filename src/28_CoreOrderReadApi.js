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
