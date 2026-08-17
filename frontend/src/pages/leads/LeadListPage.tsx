import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TabBar, TextField, type DataTableColumn } from '../../components/ui';
import { leadsCopy } from '../../content/ja';
import { useLeadListCache } from './LeadListCacheContext';
import { LEAD_EDITOR_PATHS } from './leadEditorConfig';
import { filterLeadListRows, LEAD_LIST_COLUMNS, LEAD_LIST_SEARCH_INITIAL_STATE, LEAD_LIST_TABS, toLeadListRows, type LeadListRow, type LeadListSearchState, type LeadListTabType, type LeadSort } from './leadListConfig';
import './LeadListPage.css';

export function LeadListPage({ canAdd }: { canAdd: boolean }) {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<LeadListTabType>(LEAD_LIST_TABS[0].type);
  const [sort, setSort] = useState<LeadSort>({ key: 'updatedAt', direction: 'descending' });
  const [search, setSearch] = useState<LeadListSearchState>(() => ({ ...LEAD_LIST_SEARCH_INITIAL_STATE }));
  const { recordsByType, errorsByType, loadingByType, refreshing, ensureLoaded, refreshAll, retryType } = useLeadListCache();

  useEffect(() => { void ensureLoaded(activeType); }, [activeType, ensureLoaded]);

  const records = recordsByType[activeType];
  const error = errorsByType[activeType];
  const loading = loadingByType[activeType] === true;
  const hasRecords = records !== undefined;
  const initialLoading = !hasRecords && !error;
  const rows = useMemo(() => toLeadListRows(records ?? [], sort), [records, sort]);
  const filteredRows = useMemo(() => filterLeadListRows(rows, search.query), [rows, search.query]);
  const changeSort = (key: LeadSort['key']) => setSort((previous) => previous.key === key ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const columns: DataTableColumn<LeadListRow>[] = LEAD_LIST_COLUMNS.map((column) => {
    const ariaSort = sort.key === column.key ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? leadsCopy.sortNone : ariaSort === 'ascending' ? leadsCopy.sortAscending : leadsCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return { key: column.key, header: column.label, renderCell: (row) => row[column.key], ariaSort, onSort: () => changeSort(column.key), sortAriaLabel: leadsCopy.sortLabel(column.label, direction), sortIcon: <SortIcon aria-hidden="true" />, cellAlignment: column.cellAlignment };
  });

  return <><PageHeader eyebrow={leadsCopy.eyebrow} title={leadsCopy.title} subtitle={leadsCopy.subtitle} /><PageToolbar start={<TextField aria-label={leadsCopy.searchLabel} placeholder={leadsCopy.searchPlaceholder} value={search.query} onChange={(event) => setSearch({ query: event.target.value })} width="sm" />} end={<div className="lead-list-page__actions"><Button variant="secondary" onClick={() => void refreshAll()} loading={refreshing} loadingText={leadsCopy.refreshing}>{leadsCopy.refresh}</Button>{canAdd && <Button variant="primary" onClick={() => navigate(LEAD_EDITOR_PATHS.create, activeType === 'all' ? undefined : { state: { leadType: activeType } })}>{leadsCopy.create}</Button>}</div>} /><Card className="lead-list-page__data-card"><TabBar aria-label={leadsCopy.title} items={LEAD_LIST_TABS.map(({ type, label }) => ({ key: type, label }))} activeKey={activeType} onChange={(type) => setActiveType(type)} />{refreshing && hasRecords && <div className="lead-list-page__data-state"><StatusMessage variant="loading">{leadsCopy.refreshing}</StatusMessage></div>}{error && <div className="lead-list-page__data-state"><StatusMessage variant="error">{leadsCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void retryType(activeType)} loading={loading} loadingText={leadsCopy.retry}>{leadsCopy.retry}</Button></StatusMessage></div>}{initialLoading && <DataTable ariaLabel={leadsCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.id} loading loadingLabel={leadsCopy.loading} skeletonRows={4} surface="embedded" />}{hasRecords && filteredRows.length === 0 && <div className="lead-list-page__data-state"><EmptyState title={search.query.trim() === '' ? leadsCopy.emptyTitle : leadsCopy.searchEmptyTitle} description={search.query.trim() === '' ? leadsCopy.emptyDescription : leadsCopy.searchEmptyDescription} /></div>}{hasRecords && filteredRows.length > 0 && <DataTable ariaLabel={leadsCopy.tableLabel} columns={columns} rows={filteredRows} rowKey={(row) => row.id} onRowClick={(row) => navigate(LEAD_EDITOR_PATHS.detailFor(row.id))} surface="embedded" />}</Card></>;
}
