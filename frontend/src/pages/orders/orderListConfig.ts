import type { OrderRecord } from '../../gas/client';
import type { DataTableCellAlignment } from '../../components/ui';
import { ordersCopy } from '../../content/ja';
import { formatAmountWithJpy } from '../shared/amountFormat';

export type OrderRow = {
  orderId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceIssuedAt: string;
  paymentMethod: string;
  invoiceTotal: string;
  paymentDueAt: string;
  paymentStatus: string;
  invoiceTotalJpy: number;
  /** Sheet value for status (used for side-menu tab filtering; not shown in table) */
  status: string;
};
export type OrderSortKey = Exclude<keyof OrderRow, 'orderId' | 'invoiceTotalJpy' | 'status'>;
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

function compareRows(a: OrderRow, b: OrderRow, sort: OrderSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  if (sort.key === 'invoiceTotal') {
    return (a.invoiceTotalJpy - b.invoiceTotalJpy) * dir;
  }
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function toOrderRows(
  records: readonly OrderRecord[],
  sort: OrderSort = ORDER_LIST_INITIAL_SORT,
  symbolMap: Record<string, string> = {},
): OrderRow[] {
  return records
    .map((r) => {
      const { display, jpy } = formatAmountWithJpy(r.invoiceTotal, r.currency, r.invoiceTotalJpy, symbolMap);
      return {
        orderId:         text(r.orderId),
        customerName:    text(r.customerName),
        invoiceNumber:   text(r.invoiceNumber),
        invoiceIssuedAt: formatDate(r.invoiceIssuedAt),
        paymentMethod:   text(r.paymentMethod),
        invoiceTotal:    display,
        paymentDueAt:    formatDate(r.paymentDueAt),
        paymentStatus:   text(r.paymentStatus),
        invoiceTotalJpy: jpy,
        status:          text(r.status),
      };
    })
    .sort((a, b) => compareRows(a, b, sort));
}

export function filterOrderRows(rows: readonly OrderRow[], query: string): readonly OrderRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => ORDER_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}

/** Empty statusLabel means "all" — no filter applied. */
export function filterOrderRowsByStatus(rows: readonly OrderRow[], statusLabel: string): readonly OrderRow[] {
  if (statusLabel === '') return rows;
  return rows.filter((row) => row.status === statusLabel);
}
