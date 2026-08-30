import React, { useCallback, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { CRM_SEARCH_ICON, CRM_SORT_ICONS } from '../../app/icons';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, TextField, type DataTableColumn } from '../../components/ui';
import { salesOrdersCopy, SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { toSalesOrderRow, advanceCoreShipmentStage, type SalesOrderRow } from '../../features/salesOrders/gasAdapter';
import type { SalesOrderTab } from '../../features/salesOrders/contracts';
import {
  AWAITING_SHIPPING_STAGE_BADGE,
  AWAITING_SHIPPING_STATUS_KEY,
  AWAITING_SHIPPING_TAB_COLUMN_KEYS,
  filterSalesOrderRows,
  filterSalesOrderRowsByPurchaseStage,
  filterSalesOrderRowsByTab,
  PAYMENT_DUE_WARNING_DAYS,
  SALES_ORDER_LIST_COLUMNS,
  SALES_ORDER_LIST_INITIAL_SORT,
  SOURCING_PURCHASE_STAGE_BADGE,
  SOURCING_PURCHASE_STAGE_FILTER_OPTIONS,
  SOURCING_STATUS_KEY,
  sortSalesOrderRows,
  type SalesOrderColumnDef,
  type SalesOrderSort,
  type SourcingPurchaseStageFilter,
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

function renderPurchaseStatusCell(row: SalesOrderRow) {
  const key = row.purchaseStatus === '' ? 'NOT_ORDERED' : row.purchaseStatus;
  const config = SOURCING_PURCHASE_STAGE_BADGE[key];
  if (!config) return '-';
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/** Shipment stage cell renderer — built inside SalesOrderListPage to access navigate and refresh. */
function createShipmentStageCellRenderer(
  navigate: NavigateFunction,
  onRefresh: () => void,
  advancingOrderIds: React.MutableRefObject<Set<string>>,
  forceUpdate: () => void,
) {
  return function renderShipmentStageCell(row: SalesOrderRow): ReactNode {
    const key = row.shipmentStage || 'NOT_STARTED';
    const config = AWAITING_SHIPPING_STAGE_BADGE[key];
    const badge = config ? <Badge variant={config.variant}>{config.label}</Badge> : <span>-</span>;

    const buttonLabel = salesOrdersCopy.advanceStageButton[key];
    if (!buttonLabel) {
      return badge;
    }

    const isAdvancing = advancingOrderIds.current.has(row.orderId);

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isAdvancing) return;

      if (key === 'LABELING') {
        void navigate(`/sales-orders/${row.orderId}?tab=shipments`);
        return;
      }

      advancingOrderIds.current.add(row.orderId);
      forceUpdate();

      void advanceCoreShipmentStage(row.orderId).then(() => {
        advancingOrderIds.current.delete(row.orderId);
        onRefresh();
      }).catch(() => {
        advancingOrderIds.current.delete(row.orderId);
        forceUpdate();
      });
    };

    return (
      <span className="sales-order-list-page__shipment-stage-cell">
        {badge}
        <button
          type="button"
          className="sales-order-list-page__advance-stage-btn"
          onClick={handleClick}
          disabled={isAdvancing}
          aria-label={buttonLabel}
        >
          {buttonLabel}
        </button>
      </span>
    );
  };
}

function renderPaymentStatusBadgeCell(row: SalesOrderRow) {
  const label = row.paymentStatus;
  if (!label || label === '-') return label || '-';
  const variant = SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT[label] ?? 'neutral';
  return <Badge variant={variant}>{label}</Badge>;
}

export function SalesOrderListPage() {
  const navigate = useNavigate();
  const { items, statusOptions, error, loading, refreshing, ensureLoaded, refresh, retry } = useSalesOrderListCache();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SalesOrderSort>(SALES_ORDER_LIST_INITIAL_SORT);
  const [activeTabLabel, setActiveTabLabel] = useState<string | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [purchaseStageFilter, setPurchaseStageFilter] = useState<SourcingPurchaseStageFilter>('all');
  const [, setAdvanceCount] = useState(0);
  const advancingOrderIds = useRef<Set<string>>(new Set());

  void ensureLoaded();

  const isSourcingTab = activeTabKey === SOURCING_STATUS_KEY;
  const isAwaitingShippingTab = activeTabKey === AWAITING_SHIPPING_STATUS_KEY;

  const records = items ?? [];

  const allRows = useMemo(
    () => sortSalesOrderRows(records.map(toSalesOrderRow), sort),
    [records, sort],
  );

  const tabFilteredRows = useMemo(
    () => filterSalesOrderRowsByTab(allRows, activeTabLabel),
    [allRows, activeTabLabel],
  );

  const purchaseStageFilteredRows = useMemo(
    () => isSourcingTab ? filterSalesOrderRowsByPurchaseStage(tabFilteredRows, purchaseStageFilter) : tabFilteredRows,
    [tabFilteredRows, purchaseStageFilter, isSourcingTab],
  );

  const filteredRows = useMemo(
    () => filterSalesOrderRows(purchaseStageFilteredRows, query),
    [purchaseStageFilteredRows, query],
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

  const handleTabClick = useCallback((tab: SalesOrderTab) => {
    if (tab.key === 'all') {
      setActiveTabLabel(null);
      setActiveTabKey(null);
    } else {
      setActiveTabLabel(tab.label);
      setActiveTabKey(tab.key);
    }
    setPurchaseStageFilter('all');
  }, []);

  const changeSort = useCallback((key: SalesOrderSort['key']) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' },
    ), []);

  const forceUpdate = useCallback(() => setAdvanceCount((c) => c + 1), []);

  const renderShipmentStageCell = useMemo(
    () => createShipmentStageCellRenderer(navigate, () => void refresh(), advancingOrderIds, forceUpdate),
    [navigate, refresh, forceUpdate],
  );

  const columns: readonly DataTableColumn<SalesOrderRow>[] = useMemo(() => {
    const isAllTab = activeTabLabel === null;

    const filteredColumns: SalesOrderColumnDef[] = isAwaitingShippingTab
      ? AWAITING_SHIPPING_TAB_COLUMN_KEYS
          .map((key) => SALES_ORDER_LIST_COLUMNS.find((c) => c.key === key))
          .filter((c): c is SalesOrderColumnDef => c !== undefined)
      : SALES_ORDER_LIST_COLUMNS.filter((column) => {
          if (column.key === 'status') return isAllTab;
          if (column.key === 'purchaseStatus') return isSourcingTab;
          if (column.tabKey === 'AWAITING_SHIPPING') return false;
          return true;
        });

    return filteredColumns
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
                : column.key === 'purchaseStatus'
                  ? renderPurchaseStatusCell
                  : column.key === 'shipmentStage'
                    ? renderShipmentStageCell
                    : column.key === 'paymentStatus'
                      ? renderPaymentStatusBadgeCell
                      : (row: SalesOrderRow) => String(row[column.key]),
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
  }, [activeTabLabel, isSourcingTab, isAwaitingShippingTab, sort, changeSort, renderShipmentStageCell]);

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
                onClick={() => handleTabClick(tab)}
                aria-current={activeTabLabel === (tab.key === 'all' ? null : tab.label) ? 'true' : undefined}
              >
                <span>{tab.label}</span>
                <span className="sales-order-list-page__tab-count">({tab.count})</span>
              </button>
            ))}
          </div>
          {isSourcingTab && (
            <div className="sales-order-list-page__purchase-stage-filter">
              <span className="sales-order-list-page__purchase-stage-filter-label">{salesOrdersCopy.purchaseStageLabel}</span>
              <div className="sales-order-list-page__purchase-stage-filter-buttons">
                {SOURCING_PURCHASE_STAGE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`sales-order-list-page__purchase-stage-btn${purchaseStageFilter === opt.key ? ' sales-order-list-page__purchase-stage-btn--active' : ''}`}
                    onClick={() => setPurchaseStageFilter(opt.key as SourcingPurchaseStageFilter)}
                    aria-pressed={purchaseStageFilter === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                onRowClick={(row) => {
                  const tab = isAwaitingShippingTab ? 'shipments' : isSourcingTab ? 'purchases' : 'billing';
                  navigate(`/sales-orders/${row.orderId}?tab=${tab}`);
                }}
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
