import { useCallback, useEffect, useMemo, useState } from 'react';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import type { StaffRepository, StaffSummaryDto } from '../../features/staff/contracts';
import { staffCopy } from '../../content/ja';
import { STAFF_LIST_COLUMNS, STAFF_LIST_INITIAL_SORT, filterStaffRows, toStaffRows, type StaffRow, type StaffSort } from './staffConfig';

type LoadState = 'loading' | 'ready' | 'error';

export function StaffListPage({ repository }: { repository: StaffRepository }) {
  const [state, setState] = useState<LoadState>('loading');
  const [staff, setStaff] = useState<readonly StaffSummaryDto[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<StaffSort>(STAFF_LIST_INITIAL_SORT);
  const load = useCallback(async () => { setState('loading'); setError(''); try { setStaff(await repository.listStaff()); setState('ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : ''); setState('error'); } }, [repository]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => toStaffRows(staff, sort), [staff, sort]);
  const filteredRows = useMemo(() => filterStaffRows(rows, query), [rows, query]);
  const changeSort = (key: StaffSort['key']) => setSort((previous) => previous.key === key ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const columns: readonly DataTableColumn<StaffRow>[] = STAFF_LIST_COLUMNS.map((column) => {
    if (!column.sortable) return { key: column.key, header: column.label, renderCell: (row: StaffRow) => row[column.key], cellAlignment: column.cellAlignment };
    const sortKey = column.key as StaffSort['key'];
    const ariaSort = sort.key === sortKey ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? staffCopy.sortNone : ariaSort === 'ascending' ? staffCopy.sortAscending : staffCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return { key: column.key, header: column.label, renderCell: (row) => row[column.key], ariaSort, onSort: () => changeSort(sortKey), sortAriaLabel: staffCopy.sortLabel(column.label, direction), sortIcon: <SortIcon aria-hidden="true" />, cellAlignment: column.cellAlignment };
  });
  const isEmpty = state === 'ready' && filteredRows.length === 0;
  return <><PageHeader eyebrow={staffCopy.eyebrow} title={staffCopy.title} subtitle={staffCopy.subtitle} /><PageToolbar start={<TextField aria-label={staffCopy.searchLabel} placeholder={staffCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} fullWidth />} /><Card>{state === 'loading' && <DataTable ariaLabel={staffCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.staffId} loading loadingLabel={staffCopy.loading} skeletonRows={4} />}{state === 'error' && <StatusMessage variant="error">{staffCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void load()}>{staffCopy.retry}</Button></StatusMessage>}{isEmpty && <EmptyState title={query.trim() === '' ? staffCopy.emptyTitle : staffCopy.searchEmptyTitle} description={query.trim() === '' ? staffCopy.emptyDescription : staffCopy.searchEmptyDescription} />}{state === 'ready' && filteredRows.length > 0 && <DataTable ariaLabel={staffCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.staffId} />}</Card></>;
}
