import type { OrderRecord } from '../../gas/client';

export type SalesOrderRow = {
  orderId: string;
  customerName: string;
  /** Future: shippingAddress is not yet available in the GAS API response, always '-' */
  shippingAddress: string;
  currency: string;
  invoiceTotal: string;
  status: string;
  invoiceIssuedAt: string;
};

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}

export function toSalesOrderRow(record: OrderRecord): SalesOrderRow {
  return {
    orderId:         text(record.orderId),
    customerName:    text(record.customerName),
    shippingAddress: '-', // Future: shippingAddress not yet in GAS API
    currency:        text(record.currency),
    invoiceTotal:    text(record.invoiceTotal),
    status:          text(record.status),
    invoiceIssuedAt: formatDate(record.invoiceIssuedAt),
  };
}
