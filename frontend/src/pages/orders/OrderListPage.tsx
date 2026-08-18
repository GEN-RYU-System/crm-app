import { useCallback, useEffect, useMemo, useState } from 'react';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { ordersCopy, PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { getCoreOrders, getCoreCurrencies, type OrderRecord } from '../../gas/client';
import { filterOrderRows, ORDER_LIST_COLUMNS, ORDER_LIST_INITIAL_SORT, toOrderRows, type OrderRow, type OrderSort } from './orderListConfig';
import './OrderListPage.css';

type LoadState = 'loading' | 'ready' | 'error';

export function OrderListPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [records, setRecords] = useState<readonly OrderRecord[]>([]);
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OrderSort>(ORDER_LIST_INITIAL_SORT);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [ordersResult, currenciesResult] = await Promise.allSettled([
        getCoreOrders(),
        getCoreCurrencies(),
      ]);
      if (ordersResult.status === 'rejected') throw ordersResult.reason;
      setRecords(ordersResult.value);
      if (currenciesResult.status === 'fulfilled') {
        const map: Record<string, string> = {};
        for (const c of currenciesResult.value) {
          if (c.symbol) map[c.currencyCode] = c.symbol;
        }
        setSymbolMap(map);
      }
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '');
      setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  const isEmpty = state === 'ready' && filteredRows.length === 0;

  return (
    <>
      <PageHeader eyebrow={ordersCopy.eyebrow} title={ordersCopy.title} subtitle={ordersCopy.subtitle} />
      <PageToolbar
        start={<TextField aria-label={ordersCopy.searchLabel} placeholder={ordersCopy.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} width="sm" />}
        end={<Button variant="secondary" onClick={() => void load()} loading={state === 'loading'} loadingText={ordersCopy.loading}>{ordersCopy.refresh}</Button>}
      />
      <Card className="order-list-page__data-card">
        {state === 'loading' && (
          <DataTable ariaLabel={ordersCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.orderId} loading loadingLabel={ordersCopy.loading} skeletonRows={4} surface="embedded" />
        )}
        {state === 'error' && (
          <div className="order-list-page__data-state">
            <StatusMessage variant="error">
              {ordersCopy.loadErrorPrefix} {error}
              <Button variant="outline" size="sm" onClick={() => void load()}>{ordersCopy.retry}</Button>
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
        {state === 'ready' && filteredRows.length > 0 && (
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
