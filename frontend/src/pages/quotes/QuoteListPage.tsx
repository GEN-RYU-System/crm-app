import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { NAVIGATION_BY_ID } from '../../app/navigation';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { quotesCopy, QUOTE_STATUS_BADGE_VARIANT } from '../../content/ja';
import { filterQuoteRows, QUOTE_LIST_COLUMNS, QUOTE_LIST_INITIAL_SORT, QUOTE_ROUTE_SEGMENTS, toQuoteRows, type QuoteRow, type QuoteSort } from './quoteListConfig';
import { useQuoteListCache } from './QuoteListCacheContext';
import './QuoteListPage.css';

type Props = { canAdd?: boolean };

export function QuoteListPage({ canAdd = false }: Props) {
  const navigate = useNavigate();
  const { items, symbolMap, error, loading, refreshing, ensureLoaded, refresh, retry } = useQuoteListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<QuoteSort>(QUOTE_LIST_INITIAL_SORT);

  void ensureLoaded();

  const records = items ?? [];
  const rows = useMemo(() => toQuoteRows(records, sort, symbolMap), [records, sort, symbolMap]);
  const filteredRows = useMemo(() => filterQuoteRows(rows, query), [rows, query]);

  const changeSort = (key: QuoteSort['key']) =>
    setSort((prev) => prev.key === key ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });

  const columns: readonly DataTableColumn<QuoteRow>[] = QUOTE_LIST_COLUMNS.map((column) => {
    const ariaSort = sort.key === column.key ? sort.direction : 'none';
    const direction = ariaSort === 'none' ? quotesCopy.sortNone : ariaSort === 'ascending' ? quotesCopy.sortAscending : quotesCopy.sortDescending;
    const SortIcon = CRM_SORT_ICONS[ariaSort];
    return {
      key: column.key,
      header: column.label,
      renderCell: column.key === 'status'
        ? (row) => {
            const label = row.status;
            if (label === '-') return label;
            const variant = QUOTE_STATUS_BADGE_VARIANT[label] ?? 'neutral';
            return <Badge variant={variant}>{label}</Badge>;
          }
        : (row) => row[column.key],
      ariaSort,
      onSort: () => changeSort(column.key),
      sortAriaLabel: quotesCopy.sortLabel(column.label, direction),
      sortIcon: <SortIcon aria-hidden="true" />,
      cellAlignment: column.cellAlignment,
    };
  });

  const isLoading = loading || items === undefined;
  const isEmpty = !isLoading && error === undefined && filteredRows.length === 0;
  const detailBase = NAVIGATION_BY_ID.quotes.hash;

  return (
    <>
      <PageHeader
        eyebrow={quotesCopy.eyebrow}
        title={quotesCopy.title}
        subtitle={quotesCopy.subtitle}
      />
      <PageToolbar
        start={<TextField aria-label={quotesCopy.searchLabel} placeholder={quotesCopy.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} width="sm" startIcon={<CRM_SEARCH_ICON aria-hidden="true" />} />}
        end={
          <>
            {canAdd && (
              <Button variant="secondary" onClick={() => navigate(`${NAVIGATION_BY_ID.quotes.hash}/${QUOTE_ROUTE_SEGMENTS.create}`)}>{quotesCopy.newCreate}</Button>
            )}
            <Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingText={quotesCopy.refreshing}>{quotesCopy.refresh}</Button>
          </>
        }
      />
      <Card className="quote-list-page__data-card">
        {isLoading && (
          <DataTable ariaLabel={quotesCopy.tableLabel} columns={columns} rows={[]} rowKey={(row) => row.quoteId} loading loadingLabel={quotesCopy.loading} skeletonRows={4} surface="embedded" />
        )}
        {error !== undefined && (
          <div className="quote-list-page__data-state">
            <StatusMessage variant="error">
              {quotesCopy.loadErrorPrefix} {error}
              <Button variant="outline" size="sm" onClick={() => void retry()}>{quotesCopy.retry}</Button>
            </StatusMessage>
          </div>
        )}
        {isEmpty && (
          <div className="quote-list-page__data-state">
            <EmptyState
              title={query.trim() === '' ? quotesCopy.emptyTitle : quotesCopy.searchEmptyTitle}
              description={query.trim() === '' ? quotesCopy.emptyDescription : quotesCopy.searchEmptyDescription}
            />
          </div>
        )}
        {!isLoading && error === undefined && filteredRows.length > 0 && (
          <DataTable
            ariaLabel={quotesCopy.tableLabel}
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.quoteId}
            onRowClick={(row) => navigate(`${detailBase}/${encodeURIComponent(row.quoteId)}`)}
            surface="embedded"
          />
        )}
      </Card>
    </>
  );
}
