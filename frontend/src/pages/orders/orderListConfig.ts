import type { OrderRecord } from '../../gas/client';
import type { DataTableCellAlignment } from '../../components/ui';
import { ordersCopy } from '../../content/ja';

export type OrderRow = {
  orderId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceIssuedAt: string;
  paymentMethod: string;
  invoiceTotal: string;
  paymentDueAt: string;
  paymentStatus: string;
};
export type OrderSortKey = Exclude<keyof OrderRow, 'orderId'>;
export type OrderSortDirection = 'ascending' | 'descending';
export type OrderSort = { key: OrderSortKey; direction: OrderSortDirection };

export const ORDER_LIST_INITIAL_SORT: OrderSort = { key: 'invoiceIssuedAt', direction: 'descending' };

export const ORDER_LIST_COLUMNS: readonly { key: OrderSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'customerName',    label: ordersCopy.columns.customerName,    cellAlignment: 'start'  },
  { key: 'invoiceNumber',   label: ordersCopy.columns.invoiceNumber,   cellAlignment: 'center' },
  { key: 'invoiceIssuedAt', label: ordersCopy.columns.invoiceIssuedAt, cellAlignment: 'center' },
  { key: 'paymentMethod',   label: ordersCopy.columns.paymentMethod,   cellAlignment: 'center' },
  { key: 'invoiceTotal',    label: ordersCopy.columns.invoiceTotal,    cellAlignment: 'center' },
  { key: 'paymentDueAt',   label: ordersCopy.columns.paymentDueAt,    cellAlignment: 'center' },
  { key: 'paymentStatus',  label: ordersCopy.columns.paymentStatus,   cellAlignment: 'center' },
];

export const ORDER_LIST_SEARCH_COLUMNS: readonly OrderSortKey[] = ORDER_LIST_COLUMNS.map(({ key }) => key);

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}

function formatCurrency(invoiceTotal: unknown, currency: string, symbolMap: Record<string, string>): string {
  if (invoiceTotal == null || invoiceTotal === '') return '-';
  const raw = String(invoiceTotal).replace(/,/g, '').trim();
  if (raw === '') return '-';
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(num));
  const symbol = symbolMap[currency] ?? null;
  return symbol != null ? `${symbol}${formatted}` : `${currency} ${formatted}`;
}

function compareRows(a: OrderRow, b: OrderRow, sort: OrderSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function toOrderRows(
  records: readonly OrderRecord[],
  sort: OrderSort = ORDER_LIST_INITIAL_SORT,
  symbolMap: Record<string, string> = {},
): OrderRow[] {
  return records
    .map((r) => ({
      orderId:         text(r.orderId),
      customerName:    text(r.customerName),
      invoiceNumber:   text(r.invoiceNumber),
      invoiceIssuedAt: formatDate(r.invoiceIssuedAt),
      paymentMethod:   text(r.paymentMethod),
      invoiceTotal:    formatCurrency(r.invoiceTotal, r.currency, symbolMap),
      paymentDueAt:    formatDate(r.paymentDueAt),
      paymentStatus:   text(r.paymentStatus),
    }))
    .sort((a, b) => compareRows(a, b, sort));
}

export function filterOrderRows(rows: readonly OrderRow[], query: string): readonly OrderRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => ORDER_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}
