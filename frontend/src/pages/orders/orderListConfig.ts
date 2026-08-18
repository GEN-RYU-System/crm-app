import type { OrderRecord } from '../../gas/client';
import type { DataTableCellAlignment } from '../../components/ui';
import { ordersCopy } from '../../content/ja';

export type OrderRow = {
  orderId: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  orderDate: string;
  currency: string;
  invoiceTotal: string;
};
export type OrderSortKey = Exclude<keyof OrderRow, 'orderId'>;
export type OrderSortDirection = 'ascending' | 'descending';
export type OrderSort = { key: OrderSortKey; direction: OrderSortDirection };

export const ORDER_LIST_INITIAL_SORT: OrderSort = { key: 'orderDate', direction: 'descending' };

export const ORDER_LIST_COLUMNS: readonly { key: OrderSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'invoiceNumber', label: ordersCopy.columns.invoiceNumber, cellAlignment: 'center' },
  { key: 'customerId',    label: ordersCopy.columns.customerId,    cellAlignment: 'center' },
  { key: 'orderDate',     label: ordersCopy.columns.orderDate,     cellAlignment: 'center' },
  { key: 'status',        label: ordersCopy.columns.status,        cellAlignment: 'center' },
  { key: 'currency',      label: ordersCopy.columns.currency,      cellAlignment: 'center' },
  { key: 'invoiceTotal',  label: ordersCopy.columns.invoiceTotal,  cellAlignment: 'center' },
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

function compareRows(a: OrderRow, b: OrderRow, sort: OrderSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function toOrderRows(records: readonly OrderRecord[], sort: OrderSort = ORDER_LIST_INITIAL_SORT): OrderRow[] {
  return records
    .map((r) => ({
      orderId:       text(r.orderId),
      invoiceNumber: text(r.invoiceNumber),
      customerId:    text(r.customerId),
      status:        text(r.status),
      orderDate:     formatDate(r.orderDate),
      currency:      text(r.currency),
      invoiceTotal:  text(r.invoiceTotal),
    }))
    .sort((a, b) => compareRows(a, b, sort));
}

export function filterOrderRows(rows: readonly OrderRow[], query: string): readonly OrderRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => ORDER_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}
