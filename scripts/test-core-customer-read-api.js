const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const registrySource = fs.readFileSync(path.join(root, 'src/00_CoreSchemaRegistry.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'src/28_CoreCustomerReadApi.js'), 'utf8');
const permissionCalls = [];
const sheets = {};
const context = vm.createContext({
  console,
  checkPermission(permission) { permissionCalls.push(permission); },
  getSpreadsheet() { return { getSheetByName(name) { return sheets[name] || null; } }; }
});
vm.runInContext(registrySource, context);

function createSheet(tableKey, records) {
  const table = context.getCoreSchemaV1Table(tableKey);
  const headerKeys = Object.keys(table.headers);
  const headers = headerKeys.map((key) => table.headers[key]);
  const rows = records.map((record) => headerKeys.map((key) => record[key] ?? ''));
  return {
    getLastColumn() { return headers.length; },
    getLastRow() { return table.headerRowNumber + rows.length; },
    getRange(row, column, rowCount) {
      const values = row === table.headerRowNumber ? [headers] : rows.slice(row - table.headerRowNumber - 1, row - table.headerRowNumber - 1 + rowCount);
      return { getDisplayValues() { return values.map((valuesRow) => valuesRow.map(String)); }, getValues() { return values; } };
    }
  };
}

const customerSheetName = context.getCoreSchemaV1Table('CUSTOMERS').sheetName;
const shippingSheetName = context.getCoreSchemaV1Table('SHIPPING_DESTINATIONS').sheetName;
const paymentSheetName = context.getCoreSchemaV1Table('PAYMENT_DESTINATIONS').sheetName;
const leadSheetName = context.getCoreSchemaV1Table('LEADS').sheetName;
const orderSheetName = context.getCoreSchemaV1Table('ORDERS').sheetName;
const completedOrderStatus = context.getCoreSchemaV1Value('ORDERS', 'STATUS', 'COMPLETED');
const cancelledOrderStatus = context.getCoreSchemaV1Value('ORDERS', 'STATUS', 'CANCELLED');
assert.strictEqual(completedOrderStatus, '完了');
assert.throws(() => context.getCoreSchemaV1Value('ORDERS', 'STATUS', 'UNKNOWN'), /CORE_SCHEMA_VALUE_KEY_NOT_FOUND/);

sheets[customerSheetName] = createSheet('CUSTOMERS', [{
  CUSTOMER_ID: 'customer-a', CUSTOMER_NAME: 'Customer A', COUNTRY: 'JP', EMAIL: 'customer@example.invalid',
  PHONE: '000', REGISTERED_AT: new Date('2026-01-02T00:00:00.000Z'), SALES_ASSIGNEE_NAME: 'Staff A',
  CONTACT_TOOL: 'Email', SOURCE_LEAD_ID: 'lead-a', COUNTRY_CODE: '+00', FIRST_TRANSACTION_DATE: '2026-01-03', SHIPPING_NOTE: 'Note'
}]);
sheets[shippingSheetName] = createSheet('SHIPPING_DESTINATIONS', [{
  SHIPPING_DESTINATION_ID: 'shipping-a', CUSTOMER_ID: 'customer-a', RECIPIENT_NAME: 'Recipient A', ADDRESS_LINE_1: 'Line 1',
  CITY: 'City', COUNTRY: 'JP', PHONE: '000', EMAIL: 'delivery@example.invalid', IS_DEFAULT: true, IS_ACTIVE: true
}]);
sheets[paymentSheetName] = createSheet('PAYMENT_DESTINATIONS', [{
  PAYMENT_DESTINATION_ID: 'payment-a', CUSTOMER_ID: 'customer-a', BILLING_NAME: 'Billing A', ADDRESS_LINE_1: 'Billing line',
  COUNTRY: 'JP', PAYMENT_METHOD: 'Invoice', CURRENCY: 'JPY', IS_DEFAULT: true, IS_ACTIVE: true
}]);
sheets[leadSheetName] = createSheet('LEADS', [{
  LEAD_ID: 'lead-a', SALES_CHANNEL: 'Wholesale', HANDLED_TITLE: 'Product A'
}]);
sheets[orderSheetName] = createSheet('ORDERS', [
  { ORDER_ID: 'order-a', CUSTOMER_ID: 'customer-a', STATUS: completedOrderStatus, CURRENCY: 'JPY', INVOICE_TOTAL: 1200 },
  { ORDER_ID: 'order-b', CUSTOMER_ID: 'customer-a', STATUS: completedOrderStatus, CURRENCY: 'JPY', INVOICE_TOTAL: '2,300' },
  { ORDER_ID: 'order-c', CUSTOMER_ID: 'customer-a', STATUS: completedOrderStatus, CURRENCY: 'USD', INVOICE_TOTAL: 45 },
  { ORDER_ID: 'order-d', CUSTOMER_ID: 'customer-a', STATUS: cancelledOrderStatus, CURRENCY: 'JPY', INVOICE_TOTAL: 9999 },
  { ORDER_ID: 'order-e', CUSTOMER_ID: 'customer-a', STATUS: '未確定', CURRENCY: 'JPY', INVOICE_TOTAL: 8888 },
  { ORDER_ID: '', CUSTOMER_ID: 'customer-a', STATUS: completedOrderStatus, CURRENCY: 'JPY', INVOICE_TOTAL: 7777 }
]);

vm.runInContext(apiSource, context);
const list = JSON.parse(JSON.stringify(context.getCoreCustomersForFrontend()));
assert.strictEqual(list.length, 1);
assert.strictEqual(list[0].salesChannel, 'Wholesale');
assert.strictEqual(list[0].handledTitle, 'Product A');
assert.strictEqual(list[0].salesAssigneeName, 'Staff A');
assert.strictEqual(list[0].transactionCount, 3);
assert.deepStrictEqual(list[0].transactionAmounts, [
  { currency: 'JPY', amount: 3500 },
  { currency: 'USD', amount: 45 }
]);
assert.strictEqual(Object.prototype.hasOwnProperty.call(list[0], 'emailAddress'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(list[0], 'phone'), false);

const detail = JSON.parse(JSON.stringify(context.getCoreCustomerForFrontend('customer-a')));
assert.strictEqual(detail.profile.customerId, 'customer-a');
assert.strictEqual(detail.shippingAddresses[0].address, 'Line 1, City');
assert.strictEqual(detail.paymentProfiles[0].billingName, 'Billing A');
assert.deepStrictEqual(permissionCalls, ['lead_view', 'lead_view']);
assert.strictEqual(context.getCoreCustomerForFrontend('missing'), null);
assert.ok(!/getSheetByName\s*\(\s*['\"]/.test(apiSource), 'physical sheet names must not be hard-coded');
assert.ok(!/indexOf\s*\(\s*['\"](?:顧客|配送|支払|請求|Address|City|State|Zip)/.test(apiSource), 'physical headers must not be hard-coded');
assert.ok(!/\.(?:appendRow|setValue|setValues|deleteRow|insertRowAfter)\s*\(/.test(apiSource), 'read API must not write');
console.log('Core customer read API test: PASS');
