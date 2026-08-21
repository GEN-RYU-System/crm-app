import { useEffect, useMemo, useState } from 'react';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TabBar, TextField, type DataTableColumn } from '../../components/ui';
import { inventoryCopy } from '../../content/ja';
import { buildInventoryTabs, filterInventoryByTab, filterInventoryRows, INVENTORY_LIST_COLUMNS, INVENTORY_LIST_INITIAL_SORT, toInventoryRows, type InventoryRow, type InventorySort } from './inventoryConfig';
import { useInventoryListCache } from './InventoryListCacheContext';
import './InventoryListPage.css';

export function InventoryListPage() {
  const { items, error, loading, refreshing, ensureLoaded, refresh, retry } = useInventoryListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<InventorySort>(INVENTORY_LIST_INITIAL_SORT);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const displayItems = items ?? [];
  const tabs = useMemo(() => buildInventoryTabs(displayItems), [displayItems]);
  const tabFilteredItems = useMemo(() => filterInventoryByTab(displayItems, activeTab), [displayItems, activeTab]);
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
    const renderCell = column.key === 'englishTitle'
      ? (row: InventoryRow) => (
          <div className="inventory-title-cell">
            <span className="inventory-title-cell__en">{row.englishTitle}</span>
            <span className="inventory-title-cell__ja">{row.japaneseTitle}</span>
          </div>
        )
      : (row: InventoryRow) => row[column.key];
    return {
      key:           column.key,
      header:        column.label,
      renderCell,
      ariaSort,
      onSort:        () => changeSort(sortKey),
      sortAriaLabel: inventoryCopy.sortLabel(column.label, direction),
      sortIcon:      <SortIcon aria-hidden="true" />,
      cellAlignment: column.cellAlignment
    };
  });

  const isInitialLoading = loading && items === undefined;
  const hasError = error !== undefined && items === undefined;
  const isReady = items !== undefined;
  const isEmpty = isReady && filteredRows.length === 0;

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
            startIcon={<CRM_SEARCH_ICON aria-hidden="true" />}
          />
        }
        end={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || refreshing}>
            {refreshing ? inventoryCopy.refreshing : inventoryCopy.refresh}
          </Button>
        }
      />
      <Card className="inventory-list-page__data-card">
        <TabBar
          aria-label={inventoryCopy.title}
          items={tabs}
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); }}
        />
        {isInitialLoading && (
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
        {hasError && (
          <div className="inventory-list-page__data-state">
            <StatusMessage variant="error">
              {inventoryCopy.loadErrorPrefix} {error}
              <Button variant="outline" size="sm" onClick={() => void retry()}>{inventoryCopy.retry}</Button>
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
        {isReady && filteredRows.length > 0 && (
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
