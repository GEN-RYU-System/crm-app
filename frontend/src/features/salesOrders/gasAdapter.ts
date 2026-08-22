import type { OrderRecord } from '../../gas/client';

export type SalesOrderRow = {
  orderId: string;
  customerName: string;
  /** Future: shippingAddress is not yet available in the GAS API response, always '-' */
  shippingAddress: string;
  currency: string;
  invoiceTotal: string;
  /** Raw ISO string from GAS API (e.g. "2026-08-24T00:00:00.000Z"). Empty string when absent. Formatted in renderCell. */
  paymentDueAt: string;
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
    paymentDueAt:    record.paymentDueAt || '',
    status:          text(record.status),
    invoiceIssuedAt: formatDate(record.invoiceIssuedAt),
  };
}
