import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusMessage } from '../../components/ui';
import { commonCopy, errorCopy, leadsCopy } from '../../content/ja';
import { getLeadsByType, type LeadRecord, type LeadType } from '../../gas/client';
import { LEAD_LIST_COLUMNS, LEAD_LIST_TABS, toLeadListRows } from './leadListConfig';
import './LeadListPage.css';

type LoadState = 'loading' | 'ready' | 'error';
const emptyRecords = (): Record<string, LeadRecord[]> => Object.fromEntries(LEAD_LIST_TABS.map(({ type }) => [type, []]));

export function LeadListPage() {
  const [activeType, setActiveType] = useState<LeadType>(LEAD_LIST_TABS[0].type);
  const [state, setState] = useState<LoadState>('loading');
  const [records, setRecords] = useState<Record<string, LeadRecord[]>>(emptyRecords);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const values = await Promise.all(LEAD_LIST_TABS.map(async ({ type }) => [type, await getLeadsByType(type)] as const));
      setRecords(Object.fromEntries(values));
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorCopy.genericLoad);
      setState('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => toLeadListRows(records[activeType]), [activeType, records]);

  return <><PageHeader eyebrow={leadsCopy.eyebrow} title={leadsCopy.title} subtitle={leadsCopy.subtitle} action={<Button onClick={() => void load()} loading={state === 'loading'} loadingText={commonCopy.loading}>{commonCopy.refresh}</Button>} /><div className="lead-list-page__tabs" role="tablist" aria-label={leadsCopy.title}>{LEAD_LIST_TABS.map(({ type, label }) => <Button key={type} variant="tab" active={activeType === type} role="tab" aria-selected={activeType === type} onClick={() => setActiveType(type)}>{label}</Button>)}</div>{state === 'error' && <StatusMessage variant="error">{leadsCopy.loadErrorPrefix} {error}<Button variant="outline" size="sm" onClick={() => void load()}>{leadsCopy.retry}</Button></StatusMessage>}{state === 'loading' && <Card><Skeleton variant="table" rows={4} label={leadsCopy.loading} /></Card>}{state === 'ready' && rows.length === 0 && <EmptyState title={leadsCopy.emptyTitle} description={leadsCopy.emptyDescription} />}{state === 'ready' && rows.length > 0 && <Card><div className="lead-list-page__table-wrap"><table className="lead-list-page__table" aria-label={leadsCopy.tableLabel}><thead><tr>{LEAD_LIST_COLUMNS.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{LEAD_LIST_COLUMNS.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div></Card>}</>;
}
