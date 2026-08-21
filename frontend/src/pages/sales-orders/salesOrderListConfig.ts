import type { DataTableCellAlignment } from '../../components/ui';
import { salesOrdersCopy } from '../../content/ja';
import type { SalesOrderRow } from '../../features/salesOrders/gasAdapter';

export type SalesOrderSortKey = Exclude<keyof SalesOrderRow, 'orderId'>;
export type SalesOrderSortDirection = 'ascending' | 'descending';
export type SalesOrderSort = { key: SalesOrderSortKey; direction: SalesOrderSortDirection };

export const SALES_ORDER_LIST_INITIAL_SORT: SalesOrderSort = { key: 'invoiceIssuedAt', direction: 'descending' };

export const SALES_ORDER_LIST_COLUMNS: readonly { key: SalesOrderSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'customerName',    label: salesOrdersCopy.columns.customerName,    cellAlignment: 'start'  },
  { key: 'shippingAddress', label: salesOrdersCopy.columns.shippingAddress, cellAlignment: 'start'  },
  { key: 'currency',        label: salesOrdersCopy.columns.currency,        cellAlignment: 'center' },
  { key: 'invoiceTotal',    label: salesOrdersCopy.columns.invoiceTotal,    cellAlignment: 'center' },
  { key: 'status',          label: salesOrdersCopy.columns.status,          cellAlignment: 'center' },
  { key: 'invoiceIssuedAt', label: salesOrdersCopy.columns.invoiceIssuedAt, cellAlignment: 'center' },
];

export const SALES_ORDER_LIST_SEARCH_COLUMNS: readonly SalesOrderSortKey[] = SALES_ORDER_LIST_COLUMNS.map(({ key }) => key);

function compareRows(a: SalesOrderRow, b: SalesOrderRow, sort: SalesOrderSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function sortSalesOrderRows(rows: SalesOrderRow[], sort: SalesOrderSort): SalesOrderRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, sort));
}

export function filterSalesOrderRows(rows: readonly SalesOrderRow[], query: string): readonly SalesOrderRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => SALES_ORDER_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}

export function filterSalesOrderRowsByTab(rows: readonly SalesOrderRow[], tabLabel: string | null): readonly SalesOrderRow[] {
  if (tabLabel === null) return rows;
  // Filter by label, not key
  return rows.filter((row) => row.status === tabLabel);
}
