import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { customersCopy } from '../../content/ja';
import { CUSTOMER_LIST_COLUMNS, CUSTOMER_LIST_INITIAL_SORT, customerDetailPath, filterCustomerListRows, toCustomerListRows, type CustomerListRow, type CustomerSort } from './customerConfig';
import { useCustomerListCache } from './CustomerListCacheContext';

export function CustomerListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CustomerSort>(CUSTOMER_LIST_INITIAL_SORT);
  const { customers, error, loading, refreshing, ensureLoaded, refresh, retry } = useCustomerListCache();

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const hasCustomers = customers !== undefined;
  const initialLoading = !hasCustomers && !error;
  const rows = useMemo(() => toCustomerListRows(customers ?? [], sort), [customers, sort]);
  const filteredRows = useMemo(() => filterCustomerListRows(rows, query), [rows, query]);
  const changeSort = (key: CustomerSort['key']) => setSort((previous) => previous.key === key ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const columns: readonly DataTableColumn<CustomerListRow>[] = CUSTOMER_LIST_COLUMNS.map((column) => {
    if (!column.sortable) return { key: column.key, header: column.label, renderCell: (row: CustomerListRow) => row[column.key], cellAlignment: column.cellAlignment };
    const sortKey = column.key as CustomerSort['key'];
    const ariaSort = sort.key === sortKey ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? customersCopy.sortNone : ariaSort === 'ascending' ? customersCopy.sortAscending : customersCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return { key: column.key, header: column.label, renderCell: (row) => row[column.key], ariaSort, onSort: () => changeSort(sortKey), sortAriaLabel: customersCopy.sortLabel(column.label, direction), sortIcon: <SortIcon aria-hidden="true" />, cellAlignment: column.cellAlignment };
  });
  const isEmpty = hasCustomers && filteredRows.length === 0;
  return <><PageHeader eyebrow={customersCopy.eyebrow} title={customersCopy.title} subtitle={customersCopy.subtitle} /><PageToolbar start={<TextField aria-label={customersCopy.searchLabel} placeholder={customersCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} width="sm" />} end={<Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingText={customersCopy.refreshing}>{customersCopy.refresh}</Button>} /><Card>{initialLoading && <DataTable ariaLabel={customersCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.customerId} loading loadingLabel={customersCopy.loading} skeletonRows={4} />}{error && <StatusMessage variant="error">{customersCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void retry()} loading={loading} loadingText={customersCopy.retry}>{customersCopy.retry}</Button></StatusMessage>}{isEmpty && <EmptyState title={query.trim() === '' ? customersCopy.emptyTitle : customersCopy.searchEmptyTitle} description={query.trim() === '' ? customersCopy.emptyDescription : customersCopy.searchEmptyDescription} />}{hasCustomers && filteredRows.length > 0 && <DataTable ariaLabel={customersCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.customerId} onRowClick={(row) => navigate(customerDetailPath(row.customerId))} />}</Card></>;
}
