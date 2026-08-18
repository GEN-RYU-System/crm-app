import { useCallback, useEffect, useMemo, useState } from 'react';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { inventoryCopy } from '../../content/ja';
import { getSharedInventory, type SharedInventoryItem } from '../../gas/client';
import { INVENTORY_LIST_COLUMNS, INVENTORY_LIST_INITIAL_SORT, filterInventoryRows, toInventoryRows, type InventoryRow, type InventorySort } from './inventoryConfig';

type LoadState = 'loading' | 'ready' | 'error';

export function InventoryListPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [items, setItems] = useState<readonly SharedInventoryItem[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<InventorySort>(INVENTORY_LIST_INITIAL_SORT);
  const load = useCallback(async () => { setState('loading'); setError(''); try { setItems(await getSharedInventory()); setState('ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : ''); setState('error'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => toInventoryRows(items, sort), [items, sort]);
  const filteredRows = useMemo(() => filterInventoryRows(rows, query), [rows, query]);
  const changeSort = (key: InventorySort['key']) => setSort((previous) => previous.key === key ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const columns: readonly DataTableColumn<InventoryRow>[] = INVENTORY_LIST_COLUMNS.map((column) => {
    const sortKey = column.key as InventorySort['key'];
    const ariaSort = sort.key === sortKey ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? inventoryCopy.sortNone : ariaSort === 'ascending' ? inventoryCopy.sortAscending : inventoryCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return { key: column.key, header: column.label, renderCell: (row: InventoryRow) => row[column.key], ariaSort, onSort: () => changeSort(sortKey), sortAriaLabel: inventoryCopy.sortLabel(column.label, direction), sortIcon: <SortIcon aria-hidden="true" />, cellAlignment: column.cellAlignment };
  });
  const isEmpty = state === 'ready' && filteredRows.length === 0;
  return <><PageHeader eyebrow={inventoryCopy.eyebrow} title={inventoryCopy.title} subtitle={inventoryCopy.subtitle} /><PageToolbar start={<TextField aria-label={inventoryCopy.searchLabel} placeholder={inventoryCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} width="sm" />} /><Card>{state === 'loading' && <DataTable ariaLabel={inventoryCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.rowKey} loading loadingLabel={inventoryCopy.loading} skeletonRows={4} />}{state === 'error' && <StatusMessage variant="error">{inventoryCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void load()}>{inventoryCopy.retry}</Button></StatusMessage>}{isEmpty && <EmptyState title={query.trim() === '' ? inventoryCopy.emptyTitle : inventoryCopy.searchEmptyTitle} description={query.trim() === '' ? inventoryCopy.emptyDescription : inventoryCopy.searchEmptyDescription} />}{state === 'ready' && filteredRows.length > 0 && <DataTable ariaLabel={inventoryCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.rowKey} />}</Card></>;
}
