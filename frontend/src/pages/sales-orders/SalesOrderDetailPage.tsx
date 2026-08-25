import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, DataTable, EmptyState, StatusMessage } from '../../components/ui';
import { Select } from '../../components/ui/Select/Select';
import { TextField } from '../../components/ui/TextField/TextField';
import type { DataTableColumn } from '../../components/ui';
import { salesOrdersCopy } from '../../content/ja';
import {
  confirmCoreOrderPayment,
  getCorePurchaseStatusOptions,
  upsertCorePurchase,
  type OrderDetailRecord,
  type PurchaseStatusOption,
  type UpsertPurchasePayload,
} from '../../gas/client';
import { useSalesOrderListCache } from './SalesOrderListCacheContext';
import { useSalesOrderDetailCache } from './SalesOrderDetailCacheContext';
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

function formatWithCurrency(v: unknown, currency: string): string {
  const formatted = formatNumber(v);
  if (formatted === '-') return '-';
  return currency ? `${formatted} ${currency}` : formatted;
}

function paymentDueBadge(paymentDueAt: string, paymentConfirmedAt: string): ReactNode {
  if (!paymentDueAt) return null;
  // suppress badge when payment is already confirmed
  if (paymentConfirmedAt) return null;
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

function AddressBlock({ name, line1, line2, line3, city, state, zip, country }: {
  name: string; line1: string; line2: string; line3: string;
  city: string; state: string; zip: string; country: string;
}) {
  const cityStateZip = [city, state, zip].filter(Boolean).join(' ');
  const isEmpty = !name && !line1 && !line2 && !line3 && !cityStateZip && !country;
  if (isEmpty) return <address className="sales-order-detail-page__address"><span>-</span></address>;
  return (
    <address className="sales-order-detail-page__address">
      {name && <div>{name}</div>}
      {line1 && <div>{line1}</div>}
      {line2 && <div>{line2}</div>}
      {line3 && <div>{line3}</div>}
      {cityStateZip && <div>{cityStateZip}</div>}
      {country && <div>{country}</div>}
    </address>
  );
}

const EMPTY_PURCHASE_FORM: UpsertPurchasePayload = {
  orderId: '',
  purchaseId: undefined,
  orderedAt: '',
  supplier: '',
  supplierUrl: '',
  quantity: '',
  unitPrice: '',
  amount: '',
  shippingOrAgencyFee: '',
  carrier: '',
  trackingNumber: '',
  status: '',
  note: '',
};

export function SalesOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  // confirm payment state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

  // purchase form state
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseFormStep, setPurchaseFormStep] = useState<'input' | 'confirm'>('input');
  const [purchaseFormData, setPurchaseFormData] = useState<UpsertPurchasePayload>(EMPTY_PURCHASE_FORM);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseFormError, setPurchaseFormError] = useState<string | undefined>(undefined);
  const [purchaseStatusOptions, setPurchaseStatusOptions] = useState<readonly PurchaseStatusOption[]>([]);

  const { refresh } = useSalesOrderListCache();
  const { recordsByOrderId, errorsByOrderId, ensureLoaded, refresh: refreshDetail } = useSalesOrderDetailCache();
  const records = orderId ? recordsByOrderId[orderId] : undefined;
  const detail = records === undefined ? undefined : records[0] ?? null;
  const error = orderId ? errorsByOrderId[orderId] : undefined;

  useEffect(() => {
    if (!orderId) return;
    void ensureLoaded(orderId);
  }, [ensureLoaded, orderId]);

  useEffect(() => {
    getCorePurchaseStatusOptions()
      .then((opts) => setPurchaseStatusOptions(opts))
      .catch(() => { /* ignore: status options fetch failed, keep empty */ });
  }, []);

  const copy = salesOrdersCopy.detail;

  const order = detail?.order;

  const canConfirmPayment = !!order?.awaitingPaymentStatus && order.STATUS === order.awaitingPaymentStatus;

  const openPurchaseForm = (existing?: OrderDetail['purchases'][number]) => {
    if (!orderId) return;
    setPurchaseFormData(
      existing
        ? {
            orderId,
            purchaseId: existing.PURCHASE_ID,
            orderedAt: String(existing.ORDERED_AT ?? ''),
            supplier: String(existing.SUPPLIER ?? ''),
            supplierUrl: String(existing.SUPPLIER_URL ?? ''),
            quantity: String(existing.QUANTITY ?? ''),
            unitPrice: String(existing.UNIT_PRICE ?? ''),
            amount: String(existing.AMOUNT ?? ''),
            shippingOrAgencyFee: String(existing.SHIPPING_OR_AGENCY_FEE ?? ''),
            carrier: String(existing.CARRIER ?? ''),
            trackingNumber: String(existing.TRACKING_NUMBER ?? ''),
            status: String(existing.STATUS ?? ''),
            note: String(existing.NOTE ?? ''),
          }
        : { ...EMPTY_PURCHASE_FORM, orderId }
    );
    setPurchaseFormStep('input');
    setPurchaseFormError(undefined);
    setPurchaseFormOpen(true);
  };

  const handlePurchaseSave = async () => {
    if (!orderId) return;
    setPurchaseSaving(true);
    setPurchaseFormError(undefined);
    try {
      await upsertCorePurchase(purchaseFormData);
      setPurchaseFormOpen(false);
      void refresh();
      await refreshDetail(orderId);
    } catch (e: unknown) {
      setPurchaseFormError(e instanceof Error ? e.message : copy.purchaseFormSaveError);
    } finally {
      setPurchaseSaving(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!orderId) return;
    setConfirming(true);
    setConfirmError(undefined);
    try {
      const result = await confirmCoreOrderPayment(orderId);
      if (result.success) {
        await refreshDetail(orderId);
        setConfirmOpen(false);
        void refresh();
      } else {
        const reason = result.reason;
        setConfirmError(
          reason === 'INVALID_STATUS'
            ? copy.confirmPaymentErrorInvalidStatus
            : copy.confirmPaymentErrorGeneric
        );
      }
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : copy.confirmPaymentErrorGeneric);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="sales-order-detail-page">
      {/* back link */}
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
        const dueBadge = paymentDueBadge(String(o.PAYMENT_DUE_AT), String(o.PAYMENT_CONFIRMED_AT));

        // line item table columns
        const lineColumns: DataTableColumn<OrderDetail['lines'][number]>[] = [
          { key: 'LINE_NUMBER',  header: copy.colLineNumber,  renderCell: (r) => formatValue(r.LINE_NUMBER) },
          { key: 'PRODUCT_NAME', header: copy.colProductName, renderCell: (r) => formatValue(r.PRODUCT_NAME) },
          { key: 'CATEGORY',     header: copy.colCategory,    renderCell: (r) => formatValue(r.CATEGORY) },
          { key: 'SKU',          header: copy.colSku,         renderCell: (r) => formatValue(r.SKU) },
          { key: 'QUANTITY',     header: copy.colQuantity,    renderCell: (r) => formatNumber(r.QUANTITY),   cellAlignment: 'center' },
          { key: 'UNIT_PRICE',   header: copy.colUnitPrice,   renderCell: (r) => formatNumber(r.UNIT_PRICE), cellAlignment: 'center' },
          { key: 'SUBTOTAL',     header: copy.colSubtotal,    renderCell: (r) => formatNumber(r.SUBTOTAL),   cellAlignment: 'center' },
        ];

        // purchase table columns
        const purchaseColumns: DataTableColumn<OrderDetail['purchases'][number]>[] = [
          { key: 'SUPPLIER',        header: copy.colSupplier,               renderCell: (r) => formatValue(r.SUPPLIER) },
          { key: 'ORDERED_AT',      header: copy.colOrderedAt,              renderCell: (r) => formatDate(r.ORDERED_AT) },
          { key: 'AMOUNT',          header: copy.colPurchaseAmount,         renderCell: (r) => formatNumber(r.AMOUNT),  cellAlignment: 'center' },
          { key: 'STATUS',          header: copy.colPurchaseStatus,         renderCell: (r) => formatValue(r.STATUS) },
          { key: 'TRACKING_NUMBER', header: copy.colPurchaseTrackingNumber, renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
        ];

        // shipment table columns
        const shipmentColumns: DataTableColumn<OrderDetail['shipments'][number]>[] = [
          { key: 'SHIPPING_METHOD', header: copy.colShippingMethod,         renderCell: (r) => formatValue(r.SHIPPING_METHOD) },
          { key: 'SHIPPED_AT',      header: copy.colShippedAt,              renderCell: (r) => formatDate(r.SHIPPED_AT) },
          { key: 'TRACKING_NUMBER', header: copy.colShipmentTrackingNumber, renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
        ];

        return (
          <>
            {/* header row: invoice number + confirm button */}
            <div className="sales-order-detail-page__header">
              <div className="sales-order-detail-page__header-left">
                <h1 className="sales-order-detail-page__title">
                  {o.INVOICE_NUMBER ? o.INVOICE_NUMBER : o.ORDER_ID}
                </h1>
                <p className="sales-order-detail-page__subtitle">
                  {o.customerName}
                  {o.ORDER_ID && <span className="sales-order-detail-page__order-id"> ({o.ORDER_ID})</span>}
                </p>
              </div>
              <div className="sales-order-detail-page__header-right">
                <Button
                  variant="primary"
                  disabled={!canConfirmPayment || confirming}
                  onClick={() => setConfirmOpen(true)}
                >
                  {copy.btnConfirmPayment}
                </Button>
              </div>
            </div>

            {/* payment summary: 4-column grid */}
            <div className="sales-order-detail-page__summary-grid">
              <div className="sales-order-detail-page__summary-item">
                <span className="sales-order-detail-page__summary-label">{copy.labelPaymentDueAtSummary}</span>
                <span className="sales-order-detail-page__summary-value">
                  {formatDate(o.PAYMENT_DUE_AT)}
                  {dueBadge && <span className="sales-order-detail-page__summary-badge">{dueBadge}</span>}
                </span>
              </div>
              <div className="sales-order-detail-page__summary-item">
                <span className="sales-order-detail-page__summary-label">{copy.labelInvoiceTotalSummary}</span>
                <span className="sales-order-detail-page__summary-value">{formatWithCurrency(o.INVOICE_TOTAL, o.CURRENCY)}</span>
              </div>
              <div className="sales-order-detail-page__summary-item">
                <span className="sales-order-detail-page__summary-label">{copy.labelPaymentMethodSummary}</span>
                <span className="sales-order-detail-page__summary-value">{formatValue(o.PAYMENT_METHOD)}</span>
              </div>
              <div className="sales-order-detail-page__summary-item">
                <span className="sales-order-detail-page__summary-label">{copy.labelInvoiceIssuedAtSummary}</span>
                <span className="sales-order-detail-page__summary-value">{formatDate(o.INVOICE_ISSUED_AT)}</span>
              </div>
            </div>

            {/* shipping / billing destinations: 2-column grid */}
            <div className="sales-order-detail-page__dest-grid">
              <div className="sales-order-detail-page__dest-section">
                <p className="sales-order-detail-page__dest-label">{copy.labelShippingDestination}</p>
                <AddressBlock
                  name={o.shippingDestinationName}
                  line1={o.shippingAddressLine1}
                  line2={o.shippingAddressLine2}
                  line3={o.shippingAddressLine3}
                  city={o.shippingCity}
                  state={o.shippingState}
                  zip={o.shippingZip}
                  country={o.shippingCountry}
                />
              </div>
              <div className="sales-order-detail-page__dest-section">
                <p className="sales-order-detail-page__dest-label">{copy.labelPaymentDestination}</p>
                <p className="sales-order-detail-page__dest-value">{o.paymentDestinationName || '-'}</p>
              </div>
            </div>

            {/* shipments section */}
            <div className="sales-order-detail-page__section">
              <div className="sales-order-detail-page__section-header">
                <h2 className="sales-order-detail-page__section-title">{copy.sectionShipments}</h2>
                <Button variant="ghost" size="sm" disabled>
                  {copy.btnAddShipment}
                </Button>
              </div>
              {detail.shipments.length === 0 ? (
                <p className="sales-order-detail-page__empty-note">{copy.noShipments}</p>
              ) : (
                <DataTable
                  ariaLabel={copy.sectionShipments}
                  columns={shipmentColumns}
                  rows={detail.shipments}
                  rowKey={(r) => String(r.SHIPMENT_ID)}
                  surface="embedded"
                />
              )}
            </div>

            {/* order line items section */}
            <div className="sales-order-detail-page__section">
              <div className="sales-order-detail-page__section-header">
                <h2 className="sales-order-detail-page__section-title">{copy.sectionLines}</h2>
              </div>
              {detail.lines.length === 0 ? (
                <EmptyState title={copy.noLines} description="" />
              ) : (
                <DataTable
                  ariaLabel={copy.sectionLines}
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(r) => String(r.ORDER_LINE_ID)}
                  surface="embedded"
                />
              )}
            </div>

            {/* bottom two-column: purchases + amount detail */}
            <div className="sales-order-detail-page__section">
              <div className="sales-order-detail-page__two-col">
                {/* purchases */}
                <div>
                  <div className="sales-order-detail-page__section-header">
                    <h2 className="sales-order-detail-page__section-title">{copy.sectionPurchases}</h2>
                    <Button variant="ghost" size="sm" onClick={() => openPurchaseForm()}>
                      {copy.btnAddPurchase}
                    </Button>
                  </div>
                  {detail.purchases.length === 0 ? (
                    <p className="sales-order-detail-page__empty-note">{copy.noPurchases}</p>
                  ) : (
                    <DataTable
                      ariaLabel={copy.sectionPurchases}
                      columns={purchaseColumns}
                      rows={detail.purchases}
                      rowKey={(r) => String(r.PURCHASE_ID)}
                      onRowClick={(r) => openPurchaseForm(r)}
                      surface="embedded"
                    />
                  )}
                </div>

                {/* amount detail */}
                <div>
                  <h2 className="sales-order-detail-page__section-title">{copy.sectionAmountDetail}</h2>
                  <dl className="sales-order-detail-page__amount-dl">
                    <div className="sales-order-detail-page__amount-row">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelLineTotalDetail}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatNumber(o.LINE_TOTAL)}</dd>
                    </div>
                    <div className="sales-order-detail-page__amount-row">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelShippingFeeSummary}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatNumber(o.SHIPPING_FEE)}</dd>
                    </div>
                    <div className="sales-order-detail-page__amount-row">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelDutySummary}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatNumber(o.DUTY)}</dd>
                    </div>
                    <div className="sales-order-detail-page__amount-row">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelDiscountSummary}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatNumber(o.DISCOUNT)}</dd>
                    </div>
                    <div className="sales-order-detail-page__amount-row">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelOtherFeeSummary}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatNumber(o.OTHER_FEE)}</dd>
                    </div>
                    <div className="sales-order-detail-page__amount-row sales-order-detail-page__amount-row--total">
                      <dt className="sales-order-detail-page__amount-label">{copy.labelInvoiceTotalDetail}</dt>
                      <dd className="sales-order-detail-page__amount-value">{formatWithCurrency(o.INVOICE_TOTAL, o.CURRENCY)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* confirm payment dialog */}
            {confirmOpen && (
              <div className="sales-order-detail-page__confirm-overlay">
                <div className="sales-order-detail-page__confirm-dialog">
                  <h3 className="sales-order-detail-page__section-title">{copy.confirmPaymentTitle}</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>
                    {copy.confirmPaymentBody(
                      o.INVOICE_NUMBER || o.ORDER_ID,
                      o.customerName,
                      formatNumber(o.INVOICE_TOTAL)
                    )}
                  </p>
                  {confirmError && <StatusMessage variant="error">{confirmError}</StatusMessage>}
                  <div className="sales-order-detail-page__confirm-actions">
                    <Button
                      variant="secondary"
                      disabled={confirming}
                      onClick={() => { setConfirmOpen(false); setConfirmError(undefined); }}
                    >
                      {copy.confirmPaymentCancel}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={confirming}
                      onClick={() => { void handleConfirmPayment(); }}
                    >
                      {confirming ? copy.confirmPaymentTitle : copy.confirmPaymentConfirm}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* purchase form dialog */}
            {purchaseFormOpen && (
              <div className="sales-order-detail-page__confirm-overlay">
                <div className="sales-order-detail-page__purchase-dialog">
                  {purchaseFormStep === 'input' ? (
                    <>
                      <h3 className="sales-order-detail-page__section-title">
                        {purchaseFormData.purchaseId ? copy.purchaseFormEditTitle : copy.purchaseFormTitle}
                      </h3>
                      <div className="sales-order-detail-page__purchase-form-grid">
                        <TextField
                          label={copy.labelPurchaseOrderedAt}
                          type="date"
                          value={purchaseFormData.orderedAt ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, orderedAt: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseSupplier}
                          value={purchaseFormData.supplier ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseSupplierUrl}
                          value={purchaseFormData.supplierUrl ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, supplierUrl: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseQuantity}
                          type="number"
                          value={purchaseFormData.quantity ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseUnitPrice}
                          type="number"
                          value={purchaseFormData.unitPrice ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, unitPrice: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseAmount}
                          type="number"
                          value={purchaseFormData.amount ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, amount: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseShippingOrAgencyFee}
                          type="number"
                          value={purchaseFormData.shippingOrAgencyFee ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, shippingOrAgencyFee: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseCarrier}
                          value={purchaseFormData.carrier ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, carrier: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseTrackingNumber}
                          value={purchaseFormData.trackingNumber ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                        />
                        <Select
                          label={copy.labelPurchaseStatus}
                          value={purchaseFormData.status ?? ''}
                          options={purchaseStatusOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                          placeholder={purchaseStatusOptions.length === 0 ? copy.purchaseFormStatusLoading : copy.labelPurchaseStatus}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, status: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelPurchaseNote}
                          value={purchaseFormData.note ?? ''}
                          onChange={(e) => setPurchaseFormData((prev) => ({ ...prev, note: e.target.value }))}
                          className="sales-order-detail-page__purchase-form-full"
                        />
                      </div>
                      <div className="sales-order-detail-page__confirm-actions">
                        <Button
                          variant="secondary"
                          onClick={() => { setPurchaseFormOpen(false); setPurchaseFormError(undefined); }}
                        >
                          {copy.purchaseFormCancel}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => { setPurchaseFormStep('confirm'); }}
                        >
                          {copy.purchaseFormConfirmTitle}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="sales-order-detail-page__section-title">{copy.purchaseFormConfirmTitle}</h3>
                      <p className="sales-order-detail-page__purchase-confirm-body">{copy.purchaseFormConfirmBody}</p>
                      <dl className="sales-order-detail-page__purchase-confirm-dl">
                        {purchaseFormData.orderedAt       && <><dt>{copy.labelPurchaseOrderedAt}</dt><dd>{purchaseFormData.orderedAt}</dd></>}
                        {purchaseFormData.supplier        && <><dt>{copy.labelPurchaseSupplier}</dt><dd>{purchaseFormData.supplier}</dd></>}
                        {purchaseFormData.supplierUrl     && <><dt>{copy.labelPurchaseSupplierUrl}</dt><dd>{purchaseFormData.supplierUrl}</dd></>}
                        {purchaseFormData.quantity        && <><dt>{copy.labelPurchaseQuantity}</dt><dd>{purchaseFormData.quantity}</dd></>}
                        {purchaseFormData.unitPrice       && <><dt>{copy.labelPurchaseUnitPrice}</dt><dd>{purchaseFormData.unitPrice}</dd></>}
                        {purchaseFormData.amount          && <><dt>{copy.labelPurchaseAmount}</dt><dd>{purchaseFormData.amount}</dd></>}
                        {purchaseFormData.shippingOrAgencyFee && <><dt>{copy.labelPurchaseShippingOrAgencyFee}</dt><dd>{purchaseFormData.shippingOrAgencyFee}</dd></>}
                        {purchaseFormData.carrier         && <><dt>{copy.labelPurchaseCarrier}</dt><dd>{purchaseFormData.carrier}</dd></>}
                        {purchaseFormData.trackingNumber  && <><dt>{copy.labelPurchaseTrackingNumber}</dt><dd>{purchaseFormData.trackingNumber}</dd></>}
                        {purchaseFormData.status          && <><dt>{copy.labelPurchaseStatus}</dt><dd>{purchaseFormData.status}</dd></>}
                        {purchaseFormData.note            && <><dt>{copy.labelPurchaseNote}</dt><dd>{purchaseFormData.note}</dd></>}
                      </dl>
                      {purchaseFormError && <StatusMessage variant="error">{purchaseFormError}</StatusMessage>}
                      <div className="sales-order-detail-page__confirm-actions">
                        <Button
                          variant="secondary"
                          disabled={purchaseSaving}
                          onClick={() => { setPurchaseFormStep('input'); setPurchaseFormError(undefined); }}
                        >
                          {copy.purchaseFormBack}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={purchaseSaving}
                          onClick={() => { void handlePurchaseSave(); }}
                        >
                          {purchaseSaving ? copy.purchaseFormSaving : copy.purchaseFormConfirm}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
