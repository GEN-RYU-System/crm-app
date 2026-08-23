import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, Card, DataTable, EmptyState, PageHeader, StatusMessage } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { salesOrdersCopy, SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { getCoreOrderDetail, type OrderDetailRecord } from '../../gas/client';
import { PAYMENT_DUE_WARNING_DAYS } from './salesOrderListConfig';
import './SalesOrderDetailPage.css';

type OrderDetail = OrderDetailRecord;

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (v instanceof Date) return v.toLocaleDateString('ja-JP');
  const s = String(v);
  return s.trim() === '' ? '-' : s;
}

function formatDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('ja-JP');
}

function formatNumber(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('ja-JP');
}

function paymentDueBadge(paymentDueAt: string): ReactNode {
  if (!paymentDueAt) return null;
  const due = new Date(paymentDueAt);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const dueDate   = new Date(due.getFullYear(),   due.getMonth(),   due.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (dueDate < todayDate) return <Badge variant="danger">{salesOrdersCopy.paymentDueBadgeOverdue}</Badge>;
  if (dueDate.getTime() === todayDate.getTime()) return <Badge variant="warning">{salesOrdersCopy.paymentDueBadgeToday}</Badge>;
  const warnDate = new Date(todayDate);
  warnDate.setDate(todayDate.getDate() + PAYMENT_DUE_WARNING_DAYS);
  if (dueDate <= warnDate) return <Badge variant="warning">{salesOrdersCopy.paymentDueBadgeTomorrow}</Badge>;
  return null;
}

function DefinitionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sales-order-detail-page__def-row">
      <dt className="sales-order-detail-page__def-label">{label}</dt>
      <dd className="sales-order-detail-page__def-value">{children}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="sales-order-detail-page__section-card">
      <h2 className="sales-order-detail-page__section-title">{title}</h2>
      {children}
    </Card>
  );
}

export function SalesOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<OrderDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!orderId) return;
    setDetail(undefined);
    setError(undefined);
    getCoreOrderDetail(orderId)
      .then((d) => setDetail(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : salesOrdersCopy.detail.loadError));
  }, [orderId]);

  const copy = salesOrdersCopy.detail;

  // Header data
  const order = detail?.order;
  const statusVariant = order ? (SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT[order.PAYMENT_STATUS] ?? 'neutral') : 'neutral';

  return (
    <div className="sales-order-detail-page">
      <div className="sales-order-detail-page__back">
        <Button variant="ghost" size="sm" onClick={() => history.back()}>
          {'\u2190 '}{copy.backToList}
        </Button>
      </div>

      {detail === undefined && error === undefined && (
        <StatusMessage variant="loading">{copy.loading}</StatusMessage>
      )}
      {error !== undefined && (
        <StatusMessage variant="error">{error}</StatusMessage>
      )}
      {detail === null && error === undefined && (
        <StatusMessage variant="error">{copy.notFound}</StatusMessage>
      )}

      {detail !== null && detail !== undefined && error === undefined && (() => {
        const o = detail.order;
        const dueBadge = paymentDueBadge(String(o.PAYMENT_DUE_AT));

        // Line item table columns
        const lineColumns: DataTableColumn<OrderDetail['lines'][number]>[] = [
          { key: 'LINE_NUMBER',  header: copy.colLineNumber,  renderCell: (r) => formatValue(r.LINE_NUMBER) },
          { key: 'PRODUCT_NAME', header: copy.colProductName, renderCell: (r) => formatValue(r.PRODUCT_NAME) },
          { key: 'CATEGORY',     header: copy.colCategory,    renderCell: (r) => formatValue(r.CATEGORY) },
          { key: 'SKU',          header: copy.colSku,         renderCell: (r) => formatValue(r.SKU) },
          { key: 'QUANTITY',     header: copy.colQuantity,    renderCell: (r) => formatNumber(r.QUANTITY),   cellAlignment: 'center' },
          { key: 'UNIT_PRICE',   header: copy.colUnitPrice,   renderCell: (r) => formatNumber(r.UNIT_PRICE), cellAlignment: 'center' },
          { key: 'SUBTOTAL',     header: copy.colSubtotal,    renderCell: (r) => formatNumber(r.SUBTOTAL),   cellAlignment: 'center' },
        ];

        // Purchase table columns
        const purchaseColumns: DataTableColumn<OrderDetail['purchases'][number]>[] = [
          { key: 'SUPPLIER',        header: copy.colSupplier,               renderCell: (r) => formatValue(r.SUPPLIER) },
          { key: 'ORDERED_AT',      header: copy.colOrderedAt,              renderCell: (r) => formatDate(r.ORDERED_AT) },
          { key: 'AMOUNT',          header: copy.colPurchaseAmount,         renderCell: (r) => formatNumber(r.AMOUNT),  cellAlignment: 'center' },
          { key: 'STATUS',          header: copy.colPurchaseStatus,         renderCell: (r) => formatValue(r.STATUS) },
          { key: 'TRACKING_NUMBER', header: copy.colPurchaseTrackingNumber, renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
        ];

        // Shipment table columns
        const shipmentColumns: DataTableColumn<OrderDetail['shipments'][number]>[] = [
          { key: 'BOX_NUMBER',      header: copy.colBoxNumber,               renderCell: (r) => formatValue(r.BOX_NUMBER) },
          { key: 'SHIPPING_METHOD', header: copy.colShippingMethod,          renderCell: (r) => formatValue(r.SHIPPING_METHOD) },
          { key: 'SHIPPED_AT',      header: copy.colShippedAt,               renderCell: (r) => formatDate(r.SHIPPED_AT) },
          { key: 'TRACKING_NUMBER', header: copy.colShipmentTrackingNumber,  renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
          { key: 'PICKUP_REQUEST',  header: copy.colPickupRequest,           renderCell: (r) => formatValue(r.PICKUP_REQUEST) },
        ];

        return (
          <>
            <PageHeader
              eyebrow={salesOrdersCopy.eyebrow}
              title={o.INVOICE_NUMBER ? o.INVOICE_NUMBER : o.ORDER_ID}
              subtitle={o.customerName}
            />
            <div className="sales-order-detail-page__badges">
              {o.STATUS && <Badge variant="neutral">{o.STATUS}</Badge>}
              {o.PAYMENT_STATUS && <Badge variant={statusVariant}>{o.PAYMENT_STATUS}</Badge>}
              {dueBadge}
            </div>

            {/* Billing info */}
            <SectionCard title={copy.sectionBilling}>
              <dl className="sales-order-detail-page__def-list">
                <DefinitionRow label={copy.labelInvoiceNumber}>{formatValue(o.INVOICE_NUMBER)}</DefinitionRow>
                <DefinitionRow label={copy.labelOrderDate}>{formatDate(o.ORDER_DATE)}</DefinitionRow>
                <DefinitionRow label={copy.labelInvoiceIssuedAt}>{formatDate(o.INVOICE_ISSUED_AT)}</DefinitionRow>
                <DefinitionRow label={copy.labelPaymentDueAt}>
                  <span className="sales-order-detail-page__due-with-badge">
                    {formatDate(o.PAYMENT_DUE_AT)}
                    {dueBadge && <span className="sales-order-detail-page__due-badge">{dueBadge}</span>}
                  </span>
                </DefinitionRow>
                <DefinitionRow label={copy.labelPaymentMethod}>{formatValue(o.PAYMENT_METHOD)}</DefinitionRow>
                <DefinitionRow label={copy.labelCurrency}>{formatValue(o.CURRENCY)}</DefinitionRow>
                <DefinitionRow label={copy.labelInvoiceTotal}>{formatNumber(o.INVOICE_TOTAL)}</DefinitionRow>
                <DefinitionRow label={copy.labelInvoiceTotalJpy}>{formatNumber(o.INVOICE_TOTAL_JPY)}</DefinitionRow>
                <DefinitionRow label={copy.labelPaymentStatus}>
                  {o.PAYMENT_STATUS
                    ? <Badge variant={statusVariant}>{o.PAYMENT_STATUS}</Badge>
                    : '-'}
                </DefinitionRow>
              </dl>
            </SectionCard>

            {/* Line items */}
            <SectionCard title={copy.sectionLines}>
              {detail.lines.length === 0 ? (
                <EmptyState title={copy.noLines} description="" />
              ) : (
                <Card className="sales-order-detail-page__table-card">
                  <DataTable
                    ariaLabel={copy.sectionLines}
                    columns={lineColumns}
                    rows={detail.lines}
                    rowKey={(r) => String(r.ORDER_LINE_ID)}
                    surface="embedded"
                  />
                </Card>
              )}
            </SectionCard>

            {/* Purchases */}
            <SectionCard title={copy.sectionPurchases}>
              {detail.purchases.length === 0 ? (
                <EmptyState title={copy.noPurchases} description="" />
              ) : (
                <Card className="sales-order-detail-page__table-card">
                  <DataTable
                    ariaLabel={copy.sectionPurchases}
                    columns={purchaseColumns}
                    rows={detail.purchases}
                    rowKey={(r) => String(r.PURCHASE_ID)}
                    surface="embedded"
                  />
                </Card>
              )}
            </SectionCard>

            {/* Shipments */}
            <SectionCard title={copy.sectionShipments}>
              {detail.shipments.length === 0 ? (
                <EmptyState title={copy.noShipments} description="" />
              ) : (
                <Card className="sales-order-detail-page__table-card">
                  <DataTable
                    ariaLabel={copy.sectionShipments}
                    columns={shipmentColumns}
                    rows={detail.shipments}
                    rowKey={(r) => String(r.SHIPMENT_ID)}
                    surface="embedded"
                  />
                </Card>
              )}
            </SectionCard>
          </>
        );
      })()}
    </div>
  );
}
