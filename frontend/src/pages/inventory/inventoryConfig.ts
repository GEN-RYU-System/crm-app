import type { DataTableCellAlignment } from '../../components/ui';
import type { SharedInventoryItem } from '../../gas/client';
import { inventoryCopy } from '../../content/ja';

export type InventoryRow = {
  rowKey:        string;
  japaneseTitle: string;
  series:        string;
  quantity:      string;
  unitPrice:     string;
  condition:     string;
  status:        string;
  supplier:      string;
  /** For tab filtering — not displayed */
  ipName:        string;
  /** For sort only — yyyy-MM-dd or empty string */
  releaseDate:   string;
};

export type InventoryColumnKey = 'japaneseTitle' | 'series' | 'quantity' | 'unitPrice' | 'condition' | 'status' | 'supplier';
export type InventorySortKey = InventoryColumnKey | 'releaseDate';
export type InventorySortDirection = 'ascending' | 'descending';
export type InventorySort = { key: InventorySortKey; direction: InventorySortDirection };

export const INVENTORY_LIST_INITIAL_SORT: InventorySort = { key: 'releaseDate', direction: 'descending' };

export const INVENTORY_LIST_COLUMNS: readonly { key: InventoryColumnKey; label: string; cellAlignment: DataTableCellAlignment; sortable: boolean }[] = [
  { key: 'japaneseTitle', label: inventoryCopy.columns.japaneseTitle, cellAlignment: 'center', sortable: true },
  { key: 'series',        label: inventoryCopy.columns.series,        cellAlignment: 'center', sortable: true },
  { key: 'quantity',      label: inventoryCopy.columns.quantity,      cellAlignment: 'center', sortable: true },
  { key: 'unitPrice',     label: inventoryCopy.columns.unitPrice,     cellAlignment: 'center', sortable: true },
  { key: 'condition',     label: inventoryCopy.columns.condition,     cellAlignment: 'center', sortable: true },
  { key: 'status',        label: inventoryCopy.columns.status,        cellAlignment: 'center', sortable: true },
  { key: 'supplier',      label: inventoryCopy.columns.supplier,      cellAlignment: 'center', sortable: true }
];

export const INVENTORY_LIST_SEARCH_COLUMNS: readonly InventoryColumnKey[] = INVENTORY_LIST_COLUMNS.map(({ key }) => key);

/** Build dynamic tabs from real data sorted by ipId ascending. "All" tab is always first. */
export function buildInventoryTabs(items: readonly SharedInventoryItem[]): readonly { key: string; label: string }[] {
  const seen = new Map<string, string>(); // ipId -> ipName (display label)
  for (const item of items) {
    if (item.ipId && !seen.has(item.ipId)) {
      seen.set(item.ipId, item.ipName);
    }
  }
  const sorted = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  return [{ key: 'all', label: inventoryCopy.tabAll }, ...sorted.map(([, name]) => ({ key: name, label: name }))];
}

/**
 * Filter by active tab.
 * Items with empty ipName appear only in the "all" tab.
 */
export function filterInventoryByTab(items: readonly SharedInventoryItem[], activeTab: string): readonly SharedInventoryItem[] {
  if (activeTab === 'all') return items;
  return items.filter((item) => item.ipName === activeTab);
}

/** Compare releaseDate (yyyy-MM-dd) as a date. Empty string always sorts to end. */
function compareReleaseDate(a: string, b: string, direction: InventorySortDirection): number {
  const aEmpty = a === '';
  const bEmpty = b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return a.localeCompare(b) * (direction === 'ascending' ? 1 : -1);
}

export function toInventoryRows(items: readonly SharedInventoryItem[], sort: InventorySort): InventoryRow[] {
  const rows: InventoryRow[] = items.map((item, index) => ({
    rowKey:        `${item.productId}-${item.supplier}-${index}`,
    japaneseTitle: item.japaneseTitle,
    series:        item.series,
    quantity:      String(item.quantity),
    unitPrice:     String(item.unitPrice),
    condition:     item.condition,
    status:        item.status,
    supplier:      item.supplier,
    ipName:        item.ipName,
    releaseDate:   item.releaseDate
  }));

  return rows.sort((left, right) => {
    if (sort.key === 'releaseDate') {
      const d = compareReleaseDate(left.releaseDate, right.releaseDate, sort.direction);
      return d !== 0 ? d : left.series.localeCompare(right.series, 'ja-JP', { numeric: true, sensitivity: 'base' });
    }
    const direction = sort.direction === 'ascending' ? 1 : -1;
    const comparison = left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' });
    return (comparison || left.series.localeCompare(right.series, 'ja-JP', { numeric: true, sensitivity: 'base' })) * direction;
  });
}

export function filterInventoryRows(rows: readonly InventoryRow[], query: string): readonly InventoryRow[] {
  const normalized = query.trim().toLocaleLowerCase('ja-JP');
  return normalized === ''
    ? rows
    : rows.filter((row) => INVENTORY_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(normalized)));
}
