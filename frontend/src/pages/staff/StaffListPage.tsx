import { useMemo, useState } from 'react';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { staffCopy } from '../../content/ja';
import { STAFF_LIST_COLUMNS, STAFF_LIST_INITIAL_SORT, filterStaffRows, toStaffRows, type StaffRow, type StaffSort } from './staffConfig';
import { useStaffListCache } from './StaffListCacheContext';

export function StaffListPage() {
  const { items, error, loading, refreshing, ensureLoaded, refresh, retry } = useStaffListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<StaffSort>(STAFF_LIST_INITIAL_SORT);

  void ensureLoaded();

  const staff = items ?? [];
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
  const isLoading = loading || items === undefined;
  const isEmpty = !isLoading && error === undefined && filteredRows.length === 0;
  return <><PageHeader eyebrow={staffCopy.eyebrow} title={staffCopy.title} subtitle={staffCopy.subtitle} /><PageToolbar start={<TextField aria-label={staffCopy.searchLabel} placeholder={staffCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} width="sm" startIcon={<CRM_SEARCH_ICON aria-hidden="true" />} />} end={<Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingText={staffCopy.refreshing}>{staffCopy.refresh}</Button>} /><Card>{isLoading && <DataTable ariaLabel={staffCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.staffId} loading loadingLabel={staffCopy.loading} skeletonRows={4} />}{error !== undefined && <StatusMessage variant="error">{staffCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void retry()}>{staffCopy.retry}</Button></StatusMessage>}{isEmpty && <EmptyState title={query.trim() === '' ? staffCopy.emptyTitle : staffCopy.searchEmptyTitle} description={query.trim() === '' ? staffCopy.emptyDescription : staffCopy.searchEmptyDescription} />}{!isLoading && error === undefined && filteredRows.length > 0 && <DataTable ariaLabel={staffCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.staffId} />}</Card></>;
}
