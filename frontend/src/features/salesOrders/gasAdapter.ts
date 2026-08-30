import type { OrderRecord } from '../../gas/client';
export { advanceCoreShipmentStage } from '../../gas/client';
export type { AdvanceShipmentResult } from '../../gas/client';

export type SalesOrderRow = {
  orderId: string;
  customerName: string;
  /** Future: shippingAddress is not yet available in the GAS API response, always '-' */
  shippingAddress: string;
  currency: string;
  invoiceTotal: string;
  /** Raw ISO string from GAS API (e.g. "2026-08-24T00:00:00.000Z"). Empty string when absent. Formatted in renderCell. */
  paymentDueAt: string;
  /** Raw ISO string from GAS API. Non-empty when payment has been confirmed; empty otherwise. */
  paymentConfirmedAt: string;
  status: string;
  invoiceIssuedAt: string;
  invoiceNumber: string;
  /** Number of purchase rows for this order. 0 when no purchases. */
  purchaseCount: number;
  /** Key of the least-advanced purchase status (e.g. 'NOT_ORDERED', 'ORDERED'). Empty string when purchaseCount is 0. */
  purchaseStatus: string;
  /** ISO2 country code of the shipping destination. Empty string when absent. */
  shippingCountry: string;
  /** Japanese name of the shipping destination country. Falls back to ISO2 code when not in master. Empty string when absent. */
  shippingCountryJa: string;
  /** Key of the least-advanced shipment stage (e.g. 'NOT_STARTED', 'PREPARING', 'DONE'). */
  shipmentStage: string;
  /** Raw payment status value from GAS API. */
  paymentStatus: string;
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
    paymentDueAt:        record.paymentDueAt || '',
    paymentConfirmedAt:  record.paymentConfirmedAt || '',
    status:              text(record.status),
    invoiceIssuedAt:     formatDate(record.invoiceIssuedAt),
    invoiceNumber:       text(record.invoiceNumber),
    purchaseCount:   typeof record.purchaseCount === 'number' ? record.purchaseCount : 0,
    purchaseStatus:  typeof record.purchaseStatus === 'string' ? record.purchaseStatus : '',
    shippingCountry:   typeof record.shippingCountry === 'string' ? record.shippingCountry : '',
    shippingCountryJa: typeof record.shippingCountryJa === 'string' ? record.shippingCountryJa : '',
    shipmentStage:     typeof record.shipmentStage === 'string' ? record.shipmentStage : 'NOT_STARTED',
    paymentStatus:     typeof record.paymentStatus === 'string' ? record.paymentStatus : '',
  };
}
