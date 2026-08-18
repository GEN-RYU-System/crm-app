import type { DataTableCellAlignment } from '../../components/ui';
import type { SharedInventoryItem } from '../../gas/client';
import { inventoryCopy } from '../../content/ja';

export type InventoryRow = {
  rowKey: string;
  series: string;
  quantity: string;
  unitPrice: string;
  condition: string;
  status: string;
  supplier: string;
};

export type InventoryColumnKey = Exclude<keyof InventoryRow, 'rowKey'>;
export type InventorySortKey = InventoryColumnKey;
export type InventorySortDirection = 'ascending' | 'descending';
export type InventorySort = { key: InventorySortKey; direction: InventorySortDirection };

export const INVENTORY_LIST_INITIAL_SORT: InventorySort = { key: 'series', direction: 'ascending' };

export const INVENTORY_LIST_COLUMNS: readonly { key: InventoryColumnKey; label: string; cellAlignment: DataTableCellAlignment; sortable: boolean }[] = [
  { key: 'series',    label: inventoryCopy.columns.series,    cellAlignment: 'center', sortable: true },
  { key: 'quantity',  label: inventoryCopy.columns.quantity,  cellAlignment: 'center', sortable: true },
  { key: 'unitPrice', label: inventoryCopy.columns.unitPrice, cellAlignment: 'center', sortable: true },
  { key: 'condition', label: inventoryCopy.columns.condition, cellAlignment: 'center', sortable: true },
  { key: 'status',    label: inventoryCopy.columns.status,    cellAlignment: 'center', sortable: true },
  { key: 'supplier',  label: inventoryCopy.columns.supplier,  cellAlignment: 'center', sortable: true }
];

export const INVENTORY_LIST_SEARCH_COLUMNS: readonly InventoryColumnKey[] = INVENTORY_LIST_COLUMNS.map(({ key }) => key);

export function toInventoryRows(items: readonly SharedInventoryItem[], sort: InventorySort): InventoryRow[] {
  const rows = items.map((item, index) => ({
    rowKey:    `${item.productId}-${item.supplier}-${index}`,
    series:    item.series,
    quantity:  String(item.quantity),
    unitPrice: String(item.unitPrice),
    condition: item.condition,
    status:    item.status,
    supplier:  item.supplier
  }));
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return rows.sort((left, right) => {
    const comparison = left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' });
    return (comparison || left.series.localeCompare(right.series, 'ja-JP', { numeric: true, sensitivity: 'base' })) * direction;
  });
}

export function filterInventoryRows(rows: readonly InventoryRow[], query: string): readonly InventoryRow[] {
  const normalized = query.trim().toLocaleLowerCase('ja-JP');
  return normalized === '' ? rows : rows.filter((row) => INVENTORY_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(normalized)));
}
