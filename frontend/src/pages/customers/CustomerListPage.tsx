import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import type { CustomerRepository, CustomerSummaryDto } from '../../features/customers/contracts';
import { customersCopy } from '../../content/ja';
import { CUSTOMER_LIST_COLUMNS, CUSTOMER_LIST_INITIAL_SORT, customerDetailPath, filterCustomerListRows, toCustomerListRows, type CustomerListRow, type CustomerSort } from './customerConfig';

type LoadState = 'loading' | 'ready' | 'error';

export function CustomerListPage({ repository }: { repository: CustomerRepository }) {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [customers, setCustomers] = useState<readonly CustomerSummaryDto[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CustomerSort>(CUSTOMER_LIST_INITIAL_SORT);
  const load = useCallback(async () => { setState('loading'); setError(''); try { setCustomers(await repository.listCustomers()); setState('ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : ''); setState('error'); } }, [repository]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => toCustomerListRows(customers, sort), [customers, sort]);
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
  const isEmpty = state === 'ready' && filteredRows.length === 0;
  return <><PageHeader eyebrow={customersCopy.eyebrow} title={customersCopy.title} subtitle={customersCopy.subtitle} /><PageToolbar start={<TextField aria-label={customersCopy.searchLabel} placeholder={customersCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} width="sm" />} /><Card>{state === 'loading' && <DataTable ariaLabel={customersCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.customerId} loading loadingLabel={customersCopy.loading} skeletonRows={4} />}{state === 'error' && <StatusMessage variant="error">{customersCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void load()}>{customersCopy.retry}</Button></StatusMessage>}{isEmpty && <EmptyState title={query.trim() === '' ? customersCopy.emptyTitle : customersCopy.searchEmptyTitle} description={query.trim() === '' ? customersCopy.emptyDescription : customersCopy.searchEmptyDescription} />}{state === 'ready' && filteredRows.length > 0 && <DataTable ariaLabel={customersCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.customerId} onRowClick={(row) => navigate(customerDetailPath(row.customerId))} />}</Card></>;
}
