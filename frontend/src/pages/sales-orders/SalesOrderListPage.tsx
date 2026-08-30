import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { salesOrdersCopy, SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { toSalesOrderRow, type SalesOrderRow } from '../../features/salesOrders/gasAdapter';
import type { SalesOrderTab } from '../../features/salesOrders/contracts';
import {
  filterSalesOrderRows,
  filterSalesOrderRowsByTab,
  PAYMENT_DUE_WARNING_DAYS,
  SALES_ORDER_LIST_COLUMNS,
  SALES_ORDER_LIST_INITIAL_SORT,
  sortSalesOrderRows,
  type SalesOrderSort,
} from './salesOrderListConfig';
import { useSalesOrderListCache } from './SalesOrderListCacheContext';
import './SalesOrderListPage.css';

/**
 * Renders the payment due date cell.
 * Uses a three-column grid (spacer | date | badge-slot) so that the date stays
 * centered in the column regardless of badge presence. Date-only comparison, ignores time.
 */
function renderPaymentDueAtCell(row: SalesOrderRow) {
  const raw = row.paymentDueAt;
  if (!raw) return '-';
  const due = new Date(raw);
  if (Number.isNaN(due.getTime())) return '-';

  const today = new Date();
  const dueDate   = new Date(due.getFullYear(),   due.getMonth(),   due.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const formatted = due.toLocaleDateString('ja-JP');

  // suppress badge when payment is already confirmed
  if (row.paymentConfirmedAt) {
    return (
      <span className="sales-order-list-page__payment-due-cell">
        <span aria-hidden="true" />
        <span>{formatted}</span>
        <span className="sales-order-list-page__payment-due-badge-slot" aria-hidden="true" />
      </span>
    );
  }

  let badge: ReactNode;
  if (dueDate < todayDate) {
    badge = <Badge variant="danger">{salesOrdersCopy.paymentDueBadgeOverdue}</Badge>;
  } else if (dueDate.getTime() === todayDate.getTime()) {
    badge = <Badge variant="warning">{salesOrdersCopy.paymentDueBadgeToday}</Badge>;
  } else {
    const warningDate = new Date(todayDate);
    warningDate.setDate(todayDate.getDate() + PAYMENT_DUE_WARNING_DAYS);
    if (dueDate <= warningDate) {
      badge = <Badge variant="warning">{salesOrdersCopy.paymentDueBadgeTomorrow}</Badge>;
    }
  }

  return (
    <span className="sales-order-list-page__payment-due-cell">
      <span aria-hidden="true" />
      <span>{formatted}</span>
      <span className="sales-order-list-page__payment-due-badge-slot" aria-hidden={badge === undefined ? 'true' : undefined}>{badge}</span>
    </span>
  );
}

export function SalesOrderListPage() {
  const navigate = useNavigate();
  const { items, statusOptions, error, loading, refreshing, ensureLoaded, refresh, retry } = useSalesOrderListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SalesOrderSort>(SALES_ORDER_LIST_INITIAL_SORT);
  const [activeTabLabel, setActiveTabLabel] = useState<string | null>(null);

  void ensureLoaded();

  const records = items ?? [];

  const allRows = useMemo(
    () => sortSalesOrderRows(records.map(toSalesOrderRow), sort),
    [records, sort],
  );

  const tabFilteredRows = useMemo(
    () => filterSalesOrderRowsByTab(allRows, activeTabLabel),
    [allRows, activeTabLabel],
  );

  const filteredRows = useMemo(
    () => filterSalesOrderRows(tabFilteredRows, query),
    [tabFilteredRows, query],
  );

  const tabs: SalesOrderTab[] = useMemo(() => {
    const all: SalesOrderTab = { key: 'all', label: salesOrdersCopy.allTab, count: allRows.length };
    if (!statusOptions) return [all];
    const rest: SalesOrderTab[] = statusOptions.map((opt) => ({
      key: opt.key,
      label: opt.label,
      count: allRows.filter((row) => row.status === opt.label).length,
    }));
    return [all, ...rest];
  }, [allRows, statusOptions]);

  const changeSort = useCallback((key: SalesOrderSort['key']) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' },
    ), []);

  const columns: readonly DataTableColumn<SalesOrderRow>[] = useMemo(() => {
    const isAllTab = activeTabLabel === null;
    return SALES_ORDER_LIST_COLUMNS
      .filter((column) => {
        // hide status column on non-"all" tabs
        if (column.key === 'status') return isAllTab;
        return true;
      })
      .map((column) => {
        const isSortable = column.sortable !== false;
        const ariaSort = isSortable && sort.key === column.key ? sort.direction : 'none';
        const direction =
          ariaSort === 'none'
            ? salesOrdersCopy.sortNone
            : ariaSort === 'ascending'
              ? salesOrdersCopy.sortAscending
              : salesOrdersCopy.sortDescending;
        const SortIcon = CRM_SORT_ICONS[ariaSort];
        return {
          key: column.key,
          header: column.label,
          renderCell:
            column.key === 'status'
              ? (row: SalesOrderRow) => {
                  const label = row.status;
                  if (label === '-') return label;
                  const variant = SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT[label] ?? 'neutral';
                  return <Badge variant={variant}>{label}</Badge>;
                }
              : column.key === 'paymentDueAt'
                ? renderPaymentDueAtCell
                : (row: SalesOrderRow) => row[column.key],
          ...(isSortable
            ? {
                ariaSort,
                onSort: () => changeSort(column.key as SalesOrderSort['key']),
                sortAriaLabel: salesOrdersCopy.sortLabel(column.label, direction),
                sortIcon: <SortIcon aria-hidden="true" />,
              }
            : {}),
          cellAlignment: column.cellAlignment,
        };
      });
  }, [activeTabLabel, sort, changeSort]);

  const isLoading = loading || items === undefined;
  const isEmpty = !isLoading && error === undefined && filteredRows.length === 0;

  return (
    <div className="sales-order-list-page__page">
      <div className="sales-order-list-page__sticky-band">
        <PageHeader eyebrow={salesOrdersCopy.eyebrow} title={salesOrdersCopy.title} subtitle={salesOrdersCopy.subtitle} />
        <PageToolbar
          start={
            <TextField
              aria-label={salesOrdersCopy.searchLabel}
              placeholder={salesOrdersCopy.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              width="sm"
              startIcon={<CRM_SEARCH_ICON aria-hidden="true" />}
            />
          }
          end={
            <Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingText={salesOrdersCopy.refreshing}>
              {salesOrdersCopy.refresh}
            </Button>
          }
        />
      </div>
      <div className="sales-order-list-page__layout">
        <nav className="sales-order-list-page__sidebar" aria-label="Status filter">
          <div className="sales-order-list-page__sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`sales-order-list-page__tab${activeTabLabel === (tab.key === 'all' ? null : tab.label) ? ' sales-order-list-page__tab--active' : ''}`}
                onClick={() => setActiveTabLabel(tab.key === 'all' ? null : tab.label)}
                aria-current={activeTabLabel === (tab.key === 'all' ? null : tab.label) ? 'true' : undefined}
              >
                <span>{tab.label}</span>
                <span className="sales-order-list-page__tab-count">({tab.count})</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="sales-order-list-page__main">
          <Card className="sales-order-list-page__data-card">
            {isLoading && (
              <DataTable
                ariaLabel={salesOrdersCopy.tableLabel}
                columns={columns}
                rows={[]}
                rowKey={(row) => row.orderId}
                loading
                loadingLabel={salesOrdersCopy.loading}
                skeletonRows={4}
                surface="embedded"
                stickyHeader
              />
            )}
            {error !== undefined && (
              <div className="sales-order-list-page__data-state">
                <StatusMessage variant="error">
                  {salesOrdersCopy.loadErrorPrefix} {error}
                  <Button variant="outline" size="sm" onClick={() => void retry()}>
                    {salesOrdersCopy.retry}
                  </Button>
                </StatusMessage>
              </div>
            )}
            {isEmpty && (
              <div className="sales-order-list-page__data-state">
                <EmptyState
                  title={query.trim() === '' ? salesOrdersCopy.emptyTitle : salesOrdersCopy.searchEmptyTitle}
                  description={query.trim() === '' ? salesOrdersCopy.emptyDescription : salesOrdersCopy.searchEmptyDescription}
                />
              </div>
            )}
            {!isLoading && error === undefined && filteredRows.length > 0 && (
              <DataTable
                ariaLabel={salesOrdersCopy.tableLabel}
                columns={columns}
                rows={filteredRows as SalesOrderRow[]}
                rowKey={(row) => row.orderId}
                onRowClick={(row) => navigate(`/sales-orders/${row.orderId}?tab=purchases`)}
                surface="embedded"
                stickyHeader
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
