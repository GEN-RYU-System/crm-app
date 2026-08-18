/**
 * Core Schema V1 を正本としてオーダー（請求書）を読み取る React フロント専用 API。
 * 物理シート名・物理ヘッダー名は 00_CoreSchemaRegistry.js から解決する。
 */

function getCoreOrdersForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  const spreadsheet = getSpreadsheet();
  const orders = coreCustomerFrontendReadTable(spreadsheet, 'ORDERS', [
    'ORDER_ID', 'INVOICE_NUMBER', 'CUSTOMER_ID', 'STATUS',
    'ORDER_DATE', 'CURRENCY', 'INVOICE_TOTAL',
    'PAYMENT_CONFIRMED_AT', 'SHIPPED_AT', 'INVOICE_LINK'
  ]);

  return orders.rows
    .filter(function(row) {
      return coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]);
    })
    .map(function(row) {
      return {
        orderId:            coreCustomerFrontendValue(row[orders.indexes.ORDER_ID]),
        invoiceNumber:      coreCustomerFrontendValue(row[orders.indexes.INVOICE_NUMBER]),
        customerId:         coreCustomerFrontendValue(row[orders.indexes.CUSTOMER_ID]),
        status:             coreCustomerFrontendValue(row[orders.indexes.STATUS]),
        orderDate:          coreCustomerFrontendValue(row[orders.indexes.ORDER_DATE]),
        currency:           coreCustomerFrontendValue(row[orders.indexes.CURRENCY]),
        invoiceTotal:       coreCustomerFrontendValue(row[orders.indexes.INVOICE_TOTAL]),
        paymentConfirmedAt: coreCustomerFrontendValue(row[orders.indexes.PAYMENT_CONFIRMED_AT]),
        shippedAt:          coreCustomerFrontendValue(row[orders.indexes.SHIPPED_AT]),
        invoiceLink:        coreCustomerFrontendValue(row[orders.indexes.INVOICE_LINK])
      };
    });
}
