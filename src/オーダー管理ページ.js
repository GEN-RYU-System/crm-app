/**
 * 指定したステータスのオーダーを取得
 * statuses: "Payment", "Purchase", "Shipping", "Pickup", "Completed"
 */
function getOrdersByStatus(status) {
  // 本来はスプレッドシートから取得しますが、今はダミーデータを返します
  // 実装時はシート"Orders"から取得する処理に書き換えてください
  const dummyData = [
    { id: "ORD-001", customer: "John Doe", amount: 50000, date: "2024-01-15", status: status },
    { id: "ORD-002", customer: "Jane Smith", amount: 12000, date: "2024-01-16", status: status }
  ];
  return dummyData;
}

/**
 * 新規Invoiceデータの保存
 */
function saveInvoice(invoiceData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // "Invoices"シートがある前提
  // シートへの保存処理...
  return "Success: Invoice " + invoiceData.number + " created.";
}

/**
 * 売上データの集計取得
 */
function getSalesSummary() {
  return {
    monthly: 1500000,
    daily: 50000,
    count: 25
  };
}