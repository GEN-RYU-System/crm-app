import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SORT_ICONS } from '../../app/icons';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusMessage } from '../../components/ui';
import { leadsCopy } from '../../content/ja';
import type { LeadType } from '../../gas/client';
import { useLeadListCache } from './LeadListCacheContext';
import { LEAD_EDITOR_PATHS } from './leadEditorConfig';
import { LEAD_LIST_COLUMNS, LEAD_LIST_TABS, toLeadListRows, type LeadSort } from './leadListConfig';
import './LeadListPage.css';

export function LeadListPage({ canAdd }: { canAdd: boolean }) {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<LeadType>(LEAD_LIST_TABS[0].type);
  const [sort, setSort] = useState<LeadSort>({ key: 'updatedAt', direction: 'descending' });
  const { recordsByType, errorsByType, loadingByType, refreshing, ensureLoaded, refreshAll, retryType } = useLeadListCache();
  useEffect(() => { void ensureLoaded(activeType); }, [activeType, ensureLoaded]);
  const records = recordsByType[activeType];
  const error = errorsByType[activeType];
  const loading = loadingByType[activeType] === true;
  const hasRecords = records !== undefined;
  const rows = useMemo(() => toLeadListRows(records ?? [], sort), [records, sort]);
  const changeSort = (key: LeadSort['key']) => setSort((previous) => previous.key === key ? { key, direction: previous.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, leadId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    navigate(LEAD_EDITOR_PATHS.detailFor(leadId));
  };

  return <><PageHeader eyebrow={leadsCopy.eyebrow} title={leadsCopy.title} subtitle={leadsCopy.subtitle} action={<div className="lead-list-page__actions"><Button onClick={() => void refreshAll()} loading={refreshing} loadingText={leadsCopy.refreshing}>{leadsCopy.refresh}</Button>{canAdd && <Button variant="secondary" onClick={() => navigate(LEAD_EDITOR_PATHS.create, { state: { leadType: activeType } })}>{leadsCopy.create}</Button>}</div>} /><div className="lead-list-page__tabs" role="tablist" aria-label={leadsCopy.title}>{LEAD_LIST_TABS.map(({ type, label }) => <Button key={type} variant="tab" active={activeType === type} role="tab" aria-selected={activeType === type} onClick={() => setActiveType(type)}>{label}</Button>)}</div>{refreshing && hasRecords && <StatusMessage variant="loading">{leadsCopy.refreshing}</StatusMessage>}{error && <StatusMessage variant="error">{leadsCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void retryType(activeType)} loading={loading} loadingText={leadsCopy.retry}>{leadsCopy.retry}</Button></StatusMessage>}{!hasRecords && loading && <Card><Skeleton variant="table" rows={4} label={leadsCopy.loading} /></Card>}{hasRecords && rows.length === 0 && <EmptyState title={leadsCopy.emptyTitle} description={leadsCopy.emptyDescription} />}{hasRecords && rows.length > 0 && <Card><div className="lead-list-page__table-surface"><div className="lead-list-page__table-wrap"><table className="lead-list-page__table" aria-label={leadsCopy.tableLabel}><thead><tr>{LEAD_LIST_COLUMNS.map((column) => { const ariaSort = sort.key === column.key ? sort.direction : 'none'; const direction = ariaSort === 'none' ? leadsCopy.sortNone : ariaSort === 'ascending' ? leadsCopy.sortAscending : leadsCopy.sortDescending; const SortIcon = CRM_SORT_ICONS[ariaSort]; return <th key={column.key} scope="col" aria-sort={ariaSort}><button type="button" className="lead-list-page__sort-button" onClick={() => changeSort(column.key)} aria-label={leadsCopy.sortLabel(column.label, direction)}>{column.label}<SortIcon className="lead-list-page__sort-icon" aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="lead-list-page__row" role="button" tabIndex={0} onClick={() => navigate(LEAD_EDITOR_PATHS.detailFor(row.id))} onKeyDown={(event) => onRowKeyDown(event, row.id)}>{LEAD_LIST_COLUMNS.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div></div></Card>}</>;
}
