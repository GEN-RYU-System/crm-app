import type { BadgeVariant } from '../../components/ui/Badge/Badge';
import type { DataTableCellAlignment } from '../../components/ui';
import { salesOrdersCopy } from '../../content/ja';
import type { SalesOrderRow } from '../../features/salesOrders/gasAdapter';

/** Days before the payment due date when a warning (yellow) badge is shown. Intended to be configurable from settings in the future. */
export const PAYMENT_DUE_WARNING_DAYS = 1 as const;

/** GAS schema key for the SOURCING (in-procurement) order status tab. */
export const SOURCING_STATUS_KEY = 'SOURCING' as const;

/** GAS schema key for the AWAITING_SHIPPING (shipment pending) order status tab. */
export const AWAITING_SHIPPING_STATUS_KEY = 'AWAITING_SHIPPING' as const;

/** Column keys shown on the AWAITING_SHIPPING tab, in display order. */
export const AWAITING_SHIPPING_TAB_COLUMN_KEYS: readonly (keyof SalesOrderRow)[] = [
  'orderId',
  'shipmentStage',
  'customerName',
  'shippingCountryJa',
  'paymentStatus',
] as const;

/**
 * Purchase stage badge config for each status key shown in the SOURCING tab.
 * CONFIRMED and PAID are excluded: orders with those statuses move to the AWAITING_SHIPPING tab.
 */
export const SOURCING_PURCHASE_STAGE_BADGE: Readonly<Record<string, { variant: BadgeVariant; label: string }>> = {
  NOT_ORDERED: { variant: 'neutral', label: salesOrdersCopy.purchaseStageNotOrdered },
  ORDERED:     { variant: 'warning', label: salesOrdersCopy.purchaseStageOrdered },
};

/**
 * Shipment stage badge config for each stage key shown in the AWAITING_SHIPPING tab.
 */
export const AWAITING_SHIPPING_STAGE_BADGE: Readonly<Record<string, { variant: BadgeVariant; label: string }>> = {
  NOT_STARTED:     { variant: 'neutral', label: salesOrdersCopy.shipmentStageLabel.NOT_STARTED },
  PREPARING:       { variant: 'neutral', label: salesOrdersCopy.shipmentStageLabel.PREPARING },
  LABELING:        { variant: 'info',    label: salesOrdersCopy.shipmentStageLabel.LABELING },
  AWAITING_PICKUP: { variant: 'warning', label: salesOrdersCopy.shipmentStageLabel.AWAITING_PICKUP },
  SHIPPED:         { variant: 'info',    label: salesOrdersCopy.shipmentStageLabel.SHIPPED },
  DONE:            { variant: 'success', label: salesOrdersCopy.shipmentStageLabel.DONE },
};

export const SOURCING_PURCHASE_STAGE_FILTER_OPTIONS = [
  { key: 'all',         label: salesOrdersCopy.purchaseStageAll },
  { key: 'NOT_ORDERED', label: salesOrdersCopy.purchaseStageNotOrdered },
  { key: 'ORDERED',     label: salesOrdersCopy.purchaseStageOrdered },
] as const;

export type SourcingPurchaseStageFilter = 'all' | 'NOT_ORDERED' | 'ORDERED';

// purchaseCount is a number and must be excluded from sort keys (localeCompare-based sort).
export type SalesOrderSortKey = Exclude<keyof SalesOrderRow, 'orderId' | 'purchaseCount'>;
export type SalesOrderSortDirection = 'ascending' | 'descending';
export type SalesOrderSort = { key: SalesOrderSortKey; direction: SalesOrderSortDirection };

export const SALES_ORDER_LIST_INITIAL_SORT: SalesOrderSort = { key: 'invoiceIssuedAt', direction: 'descending' };

export type SalesOrderColumnDef = {
  key: keyof SalesOrderRow;
  label: string;
  cellAlignment: DataTableCellAlignment;
  /** Set false for non-sortable columns. Defaults to true when omitted. */
  sortable?: boolean;
  /** When set, the column is only shown on the specified tab key. Shown on all tabs when absent. */
  tabKey?: string;
};

export const SALES_ORDER_LIST_COLUMNS: readonly SalesOrderColumnDef[] = [
  { key: 'orderId',            label: salesOrdersCopy.columns.orderId,            cellAlignment: 'start',  sortable: false },
  { key: 'purchaseStatus',     label: salesOrdersCopy.columns.purchaseStatus,     cellAlignment: 'center', sortable: false },
  // Columns exclusive to the AWAITING_SHIPPING tab
  { key: 'shipmentStage',      label: salesOrdersCopy.columns.shipmentStage,      cellAlignment: 'center', sortable: false, tabKey: 'AWAITING_SHIPPING' },
  { key: 'invoiceNumber',      label: salesOrdersCopy.columns.invoiceNumber,      cellAlignment: 'start',                   tabKey: 'AWAITING_SHIPPING' },
  { key: 'shippingCountryJa',  label: salesOrdersCopy.columns.shippingCountryJa, cellAlignment: 'start',                   tabKey: 'AWAITING_SHIPPING' },
  { key: 'paymentStatus',      label: salesOrdersCopy.columns.paymentStatus,      cellAlignment: 'center', sortable: false, tabKey: 'AWAITING_SHIPPING' },
  // Common columns
  { key: 'customerName',       label: salesOrdersCopy.columns.customerName,       cellAlignment: 'start'  },
  { key: 'shippingAddress',    label: salesOrdersCopy.columns.shippingAddress,    cellAlignment: 'start'  },
  { key: 'currency',           label: salesOrdersCopy.columns.currency,           cellAlignment: 'center' },
  { key: 'invoiceTotal',       label: salesOrdersCopy.columns.invoiceTotal,       cellAlignment: 'center' },
  { key: 'paymentDueAt',       label: salesOrdersCopy.columns.paymentDueAt,       cellAlignment: 'center' },
  { key: 'status',             label: salesOrdersCopy.columns.status,             cellAlignment: 'center' },
  { key: 'invoiceIssuedAt',    label: salesOrdersCopy.columns.invoiceIssuedAt,    cellAlignment: 'center' },
];

// Exclude paymentDueAt (raw ISO string), purchaseStatus, shipmentStage, paymentStatus (schema keys) from search.
export const SALES_ORDER_LIST_SEARCH_COLUMNS: readonly (keyof SalesOrderRow)[] =
  SALES_ORDER_LIST_COLUMNS
    .filter((col) => col.key !== 'paymentDueAt' && col.key !== 'purchaseStatus' && col.key !== 'shipmentStage' && col.key !== 'paymentStatus')
    .map(({ key }) => key);

function compareRows(a: SalesOrderRow, b: SalesOrderRow, sort: SalesOrderSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return String(a[sort.key]).localeCompare(String(b[sort.key]), 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function sortSalesOrderRows(rows: SalesOrderRow[], sort: SalesOrderSort): SalesOrderRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, sort));
}

export function filterSalesOrderRows(rows: readonly SalesOrderRow[], query: string): readonly SalesOrderRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) =>
    SALES_ORDER_LIST_SEARCH_COLUMNS.some((key) => String(row[key]).toLocaleLowerCase('ja-JP').includes(q)),
  );
}

export function filterSalesOrderRowsByTab(rows: readonly SalesOrderRow[], tabLabel: string | null): readonly SalesOrderRow[] {
  if (tabLabel === null) return rows;
  // filter by label value, not key
  return rows.filter((row) => row.status === tabLabel);
}

/**
 * Filters rows by purchase stage (for the SOURCING tab only).
 * 'NOT_ORDERED' matches rows where purchaseStatus is '' (no purchases) or 'NOT_ORDERED'.
 */
export function filterSalesOrderRowsByPurchaseStage(
  rows: readonly SalesOrderRow[],
  filter: SourcingPurchaseStageFilter,
): readonly SalesOrderRow[] {
  if (filter === 'all') return rows;
  if (filter === 'NOT_ORDERED') return rows.filter((row) => row.purchaseStatus === '' || row.purchaseStatus === 'NOT_ORDERED');
  return rows.filter((row) => row.purchaseStatus === filter);
}
