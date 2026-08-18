import { useCallback, useEffect, useMemo, useState } from 'react';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TabBar, TextField, type DataTableColumn } from '../../components/ui';
import { inventoryCopy } from '../../content/ja';
import type { InventoryRepository, SharedInventoryDto } from '../../features/inventory/contracts';
import { buildInventoryTabs, filterInventoryByTab, filterInventoryRows, INVENTORY_LIST_COLUMNS, INVENTORY_LIST_INITIAL_SORT, toInventoryRows, type InventoryRow, type InventorySort } from './inventoryConfig';
import './InventoryListPage.css';

type LoadState = 'loading' | 'ready' | 'error';

export function InventoryListPage({ repository }: { repository: InventoryRepository }) {
  const [state, setState] = useState<LoadState>('loading');
  const [items, setItems] = useState<readonly SharedInventoryDto[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<InventorySort>(INVENTORY_LIST_INITIAL_SORT);
  const [activeTab, setActiveTab] = useState<string>('all');

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      setItems(await repository.listSharedInventory());
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '');
      setState('error');
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const tabs = useMemo(() => buildInventoryTabs(items), [items]);
  const tabFilteredItems = useMemo(() => filterInventoryByTab(items, activeTab), [items, activeTab]);
  const rows = useMemo(() => toInventoryRows(tabFilteredItems, sort), [tabFilteredItems, sort]);
  const filteredRows = useMemo(() => filterInventoryRows(rows, query), [rows, query]);

  const changeSort = (key: InventorySort['key']) =>
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' }
    );

  const columns: readonly DataTableColumn<InventoryRow>[] = INVENTORY_LIST_COLUMNS.map((column) => {
    const sortKey = column.key as InventorySort['key'];
    const ariaSort = sort.key === sortKey ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? inventoryCopy.sortNone : ariaSort === 'ascending' ? inventoryCopy.sortAscending : inventoryCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return {
      key:           column.key,
      header:        column.label,
      renderCell:    (row: InventoryRow) => row[column.key],
      ariaSort,
      onSort:        () => changeSort(sortKey),
      sortAriaLabel: inventoryCopy.sortLabel(column.label, direction),
      sortIcon:      <SortIcon aria-hidden="true" />,
      cellAlignment: column.cellAlignment
    };
  });

  const isEmpty = state === 'ready' && filteredRows.length === 0;

  return (
    <>
      <PageHeader eyebrow={inventoryCopy.eyebrow} title={inventoryCopy.title} subtitle={inventoryCopy.subtitle} />
      <PageToolbar
        start={
          <TextField
            aria-label={inventoryCopy.searchLabel}
            placeholder={inventoryCopy.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            width="sm"
          />
        }
      />
      <Card className="inventory-list-page__data-card">
        <TabBar
          aria-label={inventoryCopy.title}
          items={tabs}
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); }}
        />
        {state === 'loading' && (
          <DataTable
            ariaLabel={inventoryCopy.tableLabel}
            columns={columns}
            rows={[]}
            rowKey={(row) => row.rowKey}
            loading
            loadingLabel={inventoryCopy.loading}
            skeletonRows={4}
            surface="embedded"
          />
        )}
        {state === 'error' && (
          <div className="inventory-list-page__data-state">
            <StatusMessage variant="error">
              {inventoryCopy.loadErrorPrefix} {error}
              <Button variant="outline" size="sm" onClick={() => void load()}>{inventoryCopy.retry}</Button>
            </StatusMessage>
          </div>
        )}
        {isEmpty && (
          <div className="inventory-list-page__data-state">
            <EmptyState
              title={query.trim() === '' ? inventoryCopy.emptyTitle : inventoryCopy.searchEmptyTitle}
              description={query.trim() === '' ? inventoryCopy.emptyDescription : inventoryCopy.searchEmptyDescription}
            />
          </div>
        )}
        {state === 'ready' && filteredRows.length > 0 && (
          <DataTable
            ariaLabel={inventoryCopy.tableLabel}
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.rowKey}
            surface="embedded"
          />
        )}
      </Card>
    </>
  );
}
