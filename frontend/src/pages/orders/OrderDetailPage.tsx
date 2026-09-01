import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, LineItemEditor, PageHeader, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { Badge } from '../../components/ui/Badge/Badge';
import { ordersCopy, PAYMENT_STATUS_BADGE_VARIANT } from '../../content/ja';
import { InvoiceDocument } from '../../features/documents/InvoiceDocument';
import { buildOrderInvoiceProps } from '../../features/documents/invoiceUtils';
import type { OrderRepository, OrderUpdatePayload } from '../../features/orders/contracts';
import { useInventoryConditionsMap } from '../inventory/InventoryListCacheContext';
import { useInventoryProductOptionsCache } from '../inventory/InventoryProductOptionsCacheContext';
import { formatAmountWithJpy } from '../shared/amountFormat';
import { formatDate } from '../shared/dateFormat';
import {
  calcInvoiceTotal,
  emptyOrderLine,
  ORDER_EDITOR_PATHS,
  toHalfwidthDigits,
  type OrderLineEditorValues,
} from './orderEditorConfig';
import { useOrderListCache } from './OrderListCacheContext';
import { useSalesOrderDetailCache } from '../sales-orders/SalesOrderDetailCacheContext';
import { useIssuerMasterCache } from '../data-management/IssuerMasterCacheContext';
import './OrderDetailPage.css';

function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString();
}

type EditPanel = 'none' | 'shipping' | 'amount';

type ShippingEditValues = {
  paymentConfirmedAt: string;
  shippedAt: string;
  trackingNumber: string;
  shippingMethod: string;
  shippingNote: string;
  internalNote: string;
  cancellationReason: string;
  cancellationNote: string;
};

type AmountEditValues = {
  lines: OrderLineEditorValues[];
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
};

type Props = {
  repository: OrderRepository;
};

function emptyShippingValues(): ShippingEditValues {
  return {
    paymentConfirmedAt: '',
    shippedAt: '',
    trackingNumber: '',
    shippingMethod: '',
    shippingNote: '',
    internalNote: '',
    cancellationReason: '',
    cancellationNote: '',
  };
}

function emptyAmountValues(): AmountEditValues {
  return {
    lines: [emptyOrderLine()],
    shippingFee: '',
    duty: '',
    otherFee: '',
    discount: '',
  };
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="order-detail-page__row">
      <dt className="order-detail-page__label">{label}</dt>
      <dd className="order-detail-page__value">{value}</dd>
    </div>
  );
}

export function OrderDetailPage({ repository }: Props) {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { items, symbolMap, ensureLoaded } = useOrderListCache();
  const conditionsMap = useInventoryConditionsMap();

  const [editPanel, setEditPanel] = useState<EditPanel>('none');
  const [shippingValues, setShippingValues] = useState<ShippingEditValues>(emptyShippingValues());
  const [amountValues, setAmountValues] = useState<AmountEditValues>(emptyAmountValues());
  const { products: inventoryProducts, loading: productsLoading, ensureLoaded: ensureInventoryProductOptions } = useInventoryProductOptionsCache();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const { issuer, ensureLoaded: ensureIssuerLoaded } = useIssuerMasterCache();
  const { recordsByOrderId, errorsByOrderId, ensureLoaded: ensureDetailLoaded, refresh: refreshDetail } = useSalesOrderDetailCache();
  const detailRecords = orderId ? recordsByOrderId[orderId] : undefined;
  const detail = detailRecords === undefined ? undefined : detailRecords[0] ?? null;
  const detailError = orderId ? errorsByOrderId[orderId] !== undefined : false;

  useEffect(() => {
    if (!orderId) return;
    void ensureDetailLoaded(orderId);
  }, [ensureDetailLoaded, orderId]);

  useEffect(() => { void ensureIssuerLoaded(); }, [ensureIssuerLoaded]);

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

  void ensureLoaded();

  const record = items?.find((r) => r.orderId === orderId);
  const isAmountLocked = !!record?.invoiceIssuedAt;

  const handleEditShipping = () => {
    setShippingValues(emptyShippingValues());
    setSaveError('');
    setEditPanel('shipping');
  };

  const handleEditAmount = () => {
    setAmountValues(emptyAmountValues());
    setSaveError('');
    setEditPanel('amount');
    void ensureInventoryProductOptions();
  };

  const handleCancelEdit = () => {
    setSaveError('');
    setEditPanel('none');
  };

  const handleSaveShipping = async () => {
    if (!orderId) return;
    setSaveError('');
    setSaving(true);
    try {
      const payload: OrderUpdatePayload = { ...shippingValues };
      await repository.updateOrder(orderId, payload);
      await refreshDetail(orderId);
      setEditPanel('none');
    } catch (cause) {
      setSaveError(
        (cause instanceof Error ? cause.message : '') || ordersCopy.detail.saveErrorFallback,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAmount = async () => {
    if (!orderId) return;
    setSaveError('');
    setSaving(true);
    try {
      const payload: OrderUpdatePayload = {
        shippingFee: amountValues.shippingFee,
        duty: amountValues.duty,
        otherFee: amountValues.otherFee,
        discount: amountValues.discount,
        lines: amountValues.lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          category: line.category,
          status: line.condition,
          condition: line.condition,
          quantity: toHalfwidthDigits(line.quantity),
          unitPrice: toHalfwidthDigits(line.unitPrice),
        })),
      };
      await repository.updateOrder(orderId, payload);
      await refreshDetail(orderId);
      setEditPanel('none');
    } catch (cause) {
      setSaveError(
        (cause instanceof Error ? cause.message : '') || ordersCopy.detail.saveErrorFallback,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleProductSelect = (index: number, productId: string, productName: string) => {
    const product = inventoryProducts.find((p) => p.productId === productId);
    setAmountValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index
          ? { ...line, productId, productName, category: product?.category ?? '', condition: '', unitPrice: '', unitWeight: 0 }
          : line,
      ),
    }));
  };

  const handleConditionSelect = (index: number, condition: string) => {
    setAmountValues((prev) => {
      const line = prev.lines[index];
      if (!line) return prev;
      const conditions = conditionsMap.get(line.productId) ?? [];
      const found = conditions.find((c) => c.condition === condition);
      return {
        ...prev,
        lines: prev.lines.map((l, i) =>
          i === index
            ? { ...l, condition, unitPrice: found ? String(found.unitPrice) : l.unitPrice, unitWeight: found ? found.unitWeight : 0 }
            : l,
        ),
      };
    });
  };

  const handleQuantityChange = (index: number, raw: string) => {
    const half = toHalfwidthDigits(raw);
    setAmountValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === index ? { ...l, quantity: half } : l),
    }));
  };

  const handleUnitPriceChange = (index: number, value: string) => {
    setAmountValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === index ? { ...l, unitPrice: value } : l),
    }));
  };

  const addLine = () =>
    setAmountValues((prev) => ({ ...prev, lines: [...prev.lines, emptyOrderLine()] }));

  const removeLine = (index: number) =>
    setAmountValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  if (items !== undefined && !record) {
    return (
      <StatusMessage variant="error">
        {ordersCopy.detail.notFound}
        <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)}>
          {ordersCopy.editor.backToList}
        </Button>
      </StatusMessage>
    );
  }

  const NA = ordersCopy.detail.notAvailable;

  const { display: totalDisplay } = formatAmountWithJpy(
    record?.invoiceTotal,
    record?.currency ?? '',
    record?.invoiceTotalJpy,
    symbolMap,
  );

  const paymentMethodLabel = record?.paymentMethod
    ? (ordersCopy.editor.paymentMethodLabels[record.paymentMethod] ?? record.paymentMethod)
    : NA;

  const paymentStatusLabel = record?.paymentStatus ?? NA;
  const paymentStatusVariant = PAYMENT_STATUS_BADGE_VARIANT[paymentStatusLabel];

  const invoiceTotal = calcInvoiceTotal(
    amountValues.lines,
    amountValues.shippingFee,
    amountValues.duty,
    amountValues.otherFee,
    amountValues.discount,
  );

  const lineItemLabels = {
    product: ordersCopy.editor.lineProduct,
    productPlaceholder: ordersCopy.editor.lineProductPlaceholder,
    productNoResults: ordersCopy.editor.lineProductNoResults,
    condition: ordersCopy.editor.condition,
    conditionPlaceholder: ordersCopy.editor.lineConditionPlaceholder,
    quantity: ordersCopy.editor.quantity,
    unitPrice: ordersCopy.editor.unitPrice,
    amount: ordersCopy.editor.subtotal,
    weight: ordersCopy.editor.lineWeight,
    remove: ordersCopy.editor.removeLine,
    conditionOptionLabel: ordersCopy.editor.lineConditionOptionLabel,
  };

  const isEditing = editPanel !== 'none';

  return (
    <>
      <PageHeader
        eyebrow={ordersCopy.eyebrow}
        title={ordersCopy.detail.title}
        subtitle={ordersCopy.detail.subtitle}
        action={
          <div className="order-detail-page__actions">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  {ordersCopy.detail.cancel}
                </Button>
                <Button
                  onClick={() => void (editPanel === 'shipping' ? handleSaveShipping() : handleSaveAmount())}
                  loading={saving}
                  loadingText={ordersCopy.detail.saving}
                >
                  {ordersCopy.detail.save}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)}>
                  {ordersCopy.editor.backToList}
                </Button>
                {!isAmountLocked && (
                  <Button variant="outline" onClick={handleEditAmount}>
                    {ordersCopy.detail.editAmount}
                  </Button>
                )}
                <Button variant="outline" onClick={handleEditShipping}>
                  {ordersCopy.detail.editShipping}
                </Button>
                {detail && issuer && (
                  <Button variant="outline" onClick={() => setShowPrint(true)}>
                    {ordersCopy.detail.printInvoice}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {saveError && (
        <StatusMessage variant="error">
          {ordersCopy.detail.saveErrorPrefix} {saveError}
        </StatusMessage>
      )}

      {/* Summary section */}
      <Card>
        <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionSummary}</h2>
        <dl className="order-detail-page__dl">
          <DetailRow label={ordersCopy.detail.invoiceNumber} value={record?.invoiceNumber || NA} />
          <DetailRow label={ordersCopy.detail.orderId} value={record?.orderId || NA} />
          <DetailRow label={ordersCopy.detail.status} value={record?.status || NA} />
          <DetailRow
            label={ordersCopy.detail.paymentStatus}
            value={
              paymentStatusVariant
                ? <Badge variant={paymentStatusVariant}>{paymentStatusLabel}</Badge>
                : paymentStatusLabel
            }
          />
          <DetailRow label={ordersCopy.detail.customerName} value={record?.customerName || NA} />
          <DetailRow label={ordersCopy.detail.invoiceIssuedAt} value={formatDate(record?.invoiceIssuedAt) || NA} />
          <DetailRow label={ordersCopy.detail.paymentDueAt} value={formatDate(record?.paymentDueAt) || NA} />
          <DetailRow label={ordersCopy.detail.paymentMethod} value={paymentMethodLabel} />
          <DetailRow label={ordersCopy.detail.billingName} value={NA} />
        </dl>
      </Card>

      {/* Line items section (read mode) */}
      {editPanel !== 'amount' && (
        <Card>
          <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionLines}</h2>
          {detail === undefined ? (
            <Skeleton variant="list" rows={2} label={ordersCopy.loading} />
          ) : detailError ? (
            <StatusMessage variant="error">{ordersCopy.detail.saveErrorFallback}</StatusMessage>
          ) : detail === null || detail.lines.length === 0 ? (
            <p className="order-detail-page__lines-empty">{NA}</p>
          ) : (
            <table className="order-detail-page__lines-table">
              <thead>
                <tr>
                  <th className="order-detail-page__lines-th">{ordersCopy.editor.lineProduct}</th>
                  <th className="order-detail-page__lines-th">{ordersCopy.editor.condition}</th>
                  <th className="order-detail-page__lines-th order-detail-page__lines-th--num">{ordersCopy.editor.quantity}</th>
                  <th className="order-detail-page__lines-th order-detail-page__lines-th--num">{ordersCopy.editor.unitPrice}</th>
                  <th className="order-detail-page__lines-th order-detail-page__lines-th--num">{ordersCopy.editor.subtotal}</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.ORDER_LINE_ID} className="order-detail-page__lines-tr">
                    <td className="order-detail-page__lines-td">{line.PRODUCT_NAME || NA}</td>
                    <td className="order-detail-page__lines-td">{line.CONDITION || line.STATUS || NA}</td>
                    <td className="order-detail-page__lines-td order-detail-page__lines-td--num">{formatNumber(line.QUANTITY)}</td>
                    <td className="order-detail-page__lines-td order-detail-page__lines-td--num">{formatNumber(line.UNIT_PRICE)}</td>
                    <td className="order-detail-page__lines-td order-detail-page__lines-td--num">{formatNumber(line.SUBTOTAL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Line items / Amount section */}
      {editPanel === 'amount' ? (
        <>
          <Card>
            <div className="order-detail-page__edit-header">
              <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionLines}</h2>
              <Button variant="outline" size="sm" onClick={addLine}>
                {ordersCopy.editor.addLine}
              </Button>
            </div>
            {productsLoading ? (
              <Skeleton variant="list" rows={3} label={ordersCopy.loading} />
            ) : (
              <LineItemEditor
                products={inventoryProducts}
                lines={amountValues.lines}
                conditionsMap={conditionsMap}
                onProductSelect={handleProductSelect}
                onConditionSelect={handleConditionSelect}
                onQuantityChange={handleQuantityChange}
                onUnitPriceChange={handleUnitPriceChange}
                onRemove={removeLine}
                labels={lineItemLabels}
              />
            )}
          </Card>
          <Card>
            <div className="order-detail-page__form">
              <TextField
                label={ordersCopy.detail.shippingFee}
                value={amountValues.shippingFee}
                onChange={(e) => setAmountValues((prev) => ({ ...prev, shippingFee: e.target.value }))}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.detail.duty}
                value={amountValues.duty}
                onChange={(e) => setAmountValues((prev) => ({ ...prev, duty: e.target.value }))}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.detail.otherFee}
                value={amountValues.otherFee}
                onChange={(e) => setAmountValues((prev) => ({ ...prev, otherFee: e.target.value }))}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.detail.discount}
                value={amountValues.discount}
                onChange={(e) => setAmountValues((prev) => ({ ...prev, discount: e.target.value }))}
                width="sm"
                placeholder="0"
              />
              <div className="order-detail-page__invoice-total">
                <span className="order-detail-page__invoice-total-label">
                  {ordersCopy.detail.invoiceTotal}
                </span>
                <span className="order-detail-page__invoice-total-value">
                  {invoiceTotal != null ? invoiceTotal.toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionAmount}</h2>
          <dl className="order-detail-page__dl">
            <DetailRow label={ordersCopy.detail.subtotal} value={NA} />
            <DetailRow label={ordersCopy.detail.shippingFee} value={NA} />
            <DetailRow label={ordersCopy.detail.duty} value={NA} />
            <DetailRow label={ordersCopy.detail.otherFee} value={NA} />
            <DetailRow label={ordersCopy.detail.discount} value={NA} />
            <DetailRow label={ordersCopy.detail.invoiceTotal} value={totalDisplay} />
          </dl>
        </Card>
      )}

      {/* Shipping / Internal section */}
      {editPanel === 'shipping' ? (
        <Card>
          <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionShipping}</h2>
          <div className="order-detail-page__form">
            <TextField
              label={ordersCopy.detail.paymentConfirmedAt}
              value={shippingValues.paymentConfirmedAt}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, paymentConfirmedAt: e.target.value }))}
              width="sm"
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label={ordersCopy.detail.shippedAt}
              value={shippingValues.shippedAt}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, shippedAt: e.target.value }))}
              width="sm"
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label={ordersCopy.detail.trackingNumber}
              value={shippingValues.trackingNumber}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, trackingNumber: e.target.value }))}
              width="md"
            />
            <TextField
              label={ordersCopy.detail.shippingMethod}
              value={shippingValues.shippingMethod}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, shippingMethod: e.target.value }))}
              width="md"
            />
            <Textarea
              label={ordersCopy.detail.shippingNote}
              helperText={ordersCopy.detail.shippingNoteDescription}
              value={shippingValues.shippingNote}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, shippingNote: e.target.value }))}
              rows={3}
              fullWidth
            />
            <Textarea
              label={ordersCopy.detail.internalNote}
              helperText={ordersCopy.detail.internalNoteDescription}
              value={shippingValues.internalNote}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, internalNote: e.target.value }))}
              rows={4}
              fullWidth
            />
            <TextField
              label={ordersCopy.detail.cancellationReason}
              value={shippingValues.cancellationReason}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, cancellationReason: e.target.value }))}
              width="md"
            />
            <Textarea
              label={ordersCopy.detail.cancellationNote}
              value={shippingValues.cancellationNote}
              onChange={(e) => setShippingValues((prev) => ({ ...prev, cancellationNote: e.target.value }))}
              rows={3}
              fullWidth
            />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionShipping}</h2>
            <dl className="order-detail-page__dl">
              <DetailRow label={ordersCopy.detail.shippingDestination} value={NA} />
              <DetailRow label={ordersCopy.detail.shippingMethod} value={NA} />
              <DetailRow label={ordersCopy.detail.shippedAt} value={NA} />
              <DetailRow label={ordersCopy.detail.trackingNumber} value={NA} />
              <DetailRow label={ordersCopy.detail.paymentConfirmedAt} value={NA} />
              <DetailRow
                label={ordersCopy.detail.shippingNote}
                value={detail?.order.SHIPPING_NOTE || NA}
              />
            </dl>
          </Card>
          <Card>
            <h2 className="order-detail-page__section-title">{ordersCopy.detail.sectionInternal}</h2>
            <dl className="order-detail-page__dl">
              <DetailRow label={ordersCopy.detail.assignedStaff} value={NA} />
              <DetailRow label={ordersCopy.detail.internalNote} value={NA} />
            </dl>
          </Card>
        </>
      )}

      {showPrint && issuer && detail && createPortal(
        <div className="doc-print-root">
          <InvoiceDocument {...buildOrderInvoiceProps(detail, issuer)} />
        </div>,
        document.body
      )}
    </>
  );
}
