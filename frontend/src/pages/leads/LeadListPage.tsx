import { useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusMessage } from '../../components/ui';
import { leadsCopy } from '../../content/ja';
import type { LeadType } from '../../gas/client';
import { useLeadListCache } from './LeadListCacheContext';
import { LEAD_LIST_COLUMNS, LEAD_LIST_TABS, toLeadListRows } from './leadListConfig';
import './LeadListPage.css';

export function LeadListPage() {
  const [activeType, setActiveType] = useState<LeadType>(LEAD_LIST_TABS[0].type);
  const { recordsByType, errorsByType, loadingByType, refreshing, ensureLoaded, refreshAll, retryType } = useLeadListCache();
  useEffect(() => { void ensureLoaded(activeType); }, [activeType, ensureLoaded]);
  const records = recordsByType[activeType];
  const error = errorsByType[activeType];
  const loading = loadingByType[activeType] === true;
  const hasRecords = records !== undefined;
  const rows = useMemo(() => toLeadListRows(records ?? []), [records]);

  return <><PageHeader eyebrow={leadsCopy.eyebrow} title={leadsCopy.title} subtitle={leadsCopy.subtitle} action={<Button onClick={() => void refreshAll()} loading={refreshing} loadingText={leadsCopy.refreshing}>{leadsCopy.refresh}</Button>} /><div className="lead-list-page__tabs" role="tablist" aria-label={leadsCopy.title}>{LEAD_LIST_TABS.map(({ type, label }) => <Button key={type} variant="tab" active={activeType === type} role="tab" aria-selected={activeType === type} onClick={() => setActiveType(type)}>{label}</Button>)}</div>{refreshing && hasRecords && <StatusMessage variant="loading">{leadsCopy.refreshing}</StatusMessage>}{error && <StatusMessage variant="error">{leadsCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void retryType(activeType)} loading={loading} loadingText={leadsCopy.retry}>{leadsCopy.retry}</Button></StatusMessage>}{!hasRecords && loading && <Card><Skeleton variant="table" rows={4} label={leadsCopy.loading} /></Card>}{hasRecords && rows.length === 0 && <EmptyState title={leadsCopy.emptyTitle} description={leadsCopy.emptyDescription} />}{hasRecords && rows.length > 0 && <Card><div className="lead-list-page__table-wrap"><table className="lead-list-page__table" aria-label={leadsCopy.tableLabel}><thead><tr>{LEAD_LIST_COLUMNS.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{LEAD_LIST_COLUMNS.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div></Card>}</>;
}
