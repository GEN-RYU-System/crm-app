import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { ordersCopy, PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { filterOrderRows, ORDER_LIST_COLUMNS, ORDER_LIST_INITIAL_SORT, toOrderRows, type OrderRow, type OrderSort } from './orderListConfig';
import { useOrderListCache } from './OrderListCacheContext';
import { ORDER_EDITOR_PATHS } from './orderEditorConfig';
import './OrderListPage.css';

type Props = { canAdd?: boolean };

export function OrderListPage({ canAdd = false }: Props) {
  const navigate = useNavigate();
  const { items, symbolMap, error, loading, refreshing, ensureLoaded, refresh, retry } = useOrderListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OrderSort>(ORDER_LIST_INITIAL_SORT);

  void ensureLoaded();

  const records = items ?? [];
  const rows = useMemo(() => toOrderRows(records, sort, symbolMap), [records, sort, symbolMap]);
  const filteredRows = useMemo(() => filterOrderRows(rows, query), [rows, query]);

  const changeSort = (key: OrderSort['key']) =>
    setSort((prev) => prev.key === key ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });

  const columns: readonly DataTableColumn<OrderRow>[] = ORDER_LIST_COLUMNS.map((column) => {
    const ariaSort = sort.key === column.key ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? ordersCopy.sortNone : ariaSort === 'ascending' ? ordersCopy.sortAscending : ordersCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return {
      key: column.key,
      header: column.label,
      renderCell: column.key === 'paymentStatus'
        ? (row) => {
            const label = row.paymentStatus;
            if (label === '-') return label;
            const variant = PAYMENT_STATUS_BADGE_VARIANT[label] ?? 'neutral';
            return <Badge variant={variant}>{label}</Badge>;
          }
        : (row) => row[column.key],
      ariaSort,
      onSort: () => changeSort(column.key),
      sortAriaLabel: ordersCopy.sortLabel(column.label, direction),
      sortIcon: <SortIcon aria-hidden="true" />,
      cellAlignment: column.cellAlignment,
    };
  });

  const isLoading = loading || items === undefined;
  const isEmpty = !isLoading && error === undefined && filteredRows.length === 0;

  return (
    <>
      <PageHeader eyebrow={ordersCopy.eyebrow} title={ordersCopy.title} subtitle={ordersCopy.subtitle} />
      <PageToolbar
        start={<TextField aria-label={ordersCopy.searchLabel} placeholder={ordersCopy.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} width="sm" startIcon={<CRM_SEARCH_ICON aria-hidden="true" />} />}
        end={
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {canAdd && (
              <Button onClick={() => navigate(ORDER_EDITOR_PATHS.create)}>
                {ordersCopy.newOrder}
              </Button>
            )}
            <Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingText={ordersCopy.refreshing}>{ordersCopy.refresh}</Button>
          </div>
        }
      />
      <Card className="order-list-page__data-card">
        {isLoading && (
          <DataTable ariaLabel={ordersCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.orderId} loading loadingLabel={ordersCopy.loading} skeletonRows={4} surface="embedded" />
        )}
        {error !== undefined && (
          <div className="order-list-page__data-state">
            <StatusMessage variant="error">
              {ordersCopy.loadErrorPrefix} {error}
              <Button variant="outline" size="sm" onClick={() => void retry()}>{ordersCopy.retry}</Button>
            </StatusMessage>
          </div>
        )}
        {isEmpty && (
          <div className="order-list-page__data-state">
            <EmptyState
              title={query.trim() === '' ? ordersCopy.emptyTitle : ordersCopy.searchEmptyTitle}
              description={query.trim() === '' ? ordersCopy.emptyDescription : ordersCopy.searchEmptyDescription}
            />
          </div>
        )}
        {!isLoading && error === undefined && filteredRows.length > 0 && (
          <DataTable
            ariaLabel={ordersCopy.tableLabel}
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.orderId}
            surface="embedded"
          />
        )}
      </Card>
    </>
  );
}
