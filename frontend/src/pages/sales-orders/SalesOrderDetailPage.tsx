import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button, DataTable, EmptyState, StatusMessage, Tabs } from '../../components/ui';
import type { TabItem } from '../../components/ui';
import { Select } from '../../components/ui/Select/Select';
import { TextField } from '../../components/ui/TextField/TextField';
import type { DataTableColumn } from '../../components/ui';
import { salesOrdersCopy } from '../../content/ja';
import {
  confirmCoreOrderPayment,
  estimateShippingFee,
  estimateShippingFeeForOrder,
  getCorePurchaseStatusOptions,
  upsertCorePurchase,
  upsertCoreShipment,
  uploadCoreShipmentFile,
  type OrderDetailRecord,
  type PurchaseStatusOption,
  type ShippingFeeCarrierResult,
  type ShippingFeeEstimateResult,
  type UpsertPurchasePayload,
  type UpsertShipmentPayload,
} from '../../gas/client';
import { useSalesOrderListCache } from './SalesOrderListCacheContext';
import { useSalesOrderDetailCache } from './SalesOrderDetailCacheContext';
import { PAYMENT_DUE_WARNING_DAYS } from './salesOrderListConfig';
import { PURCHASE_STATUS_BADGE_VARIANT } from './salesOrderDetailConfig';
import './SalesOrderDetailPage.css';

type OrderDetail = OrderDetailRecord;
type DetailTab = 'billing' | 'purchases' | 'shipments';

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

function purchaseStatusBadge(status: unknown, options: readonly PurchaseStatusOption[]): ReactNode {
  const label = formatValue(status);
  if (label === '-') return <span>{label}</span>;
  const found = options.find((opt) => opt.label === label);
  const variant = PURCHASE_STATUS_BADGE_VARIANT[found?.key ?? ''] ?? 'neutral';
  return <Badge variant={variant}>{label}</Badge>;
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

const EMPTY_SHIPMENT_FORM: UpsertShipmentPayload = {
  orderId: '',
  shipmentId: undefined,
  boxNumber: '',
  shippingMethod: '',
  shippedAt: '',
  trackingNumber: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  estimatedShippingFee: '',
  inspection: '',
  packing: '',
  storage: '',
  pickupRequest: '',
  notification: '',
  note: '',
};

const VALID_TABS: ReadonlySet<string> = new Set<DetailTab>(['billing', 'purchases', 'shipments']);

function resolveInitialTab(tabParam: string | null): DetailTab {
  if (tabParam !== null && VALID_TABS.has(tabParam)) return tabParam as DetailTab;
  return 'billing';
}

export function SalesOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();

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

  // shipment form state
  const [shipmentFormOpen, setShipmentFormOpen] = useState(false);
  const [shipmentFormStep, setShipmentFormStep] = useState<'input' | 'confirm'>('input');
  const [shipmentFormData, setShipmentFormData] = useState<UpsertShipmentPayload>(EMPTY_SHIPMENT_FORM);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentFormError, setShipmentFormError] = useState<string | undefined>(undefined);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | undefined>(undefined);
  const [shipmentInlineEditData, setShipmentInlineEditData] = useState<UpsertShipmentPayload>({ ...EMPTY_SHIPMENT_FORM });
  const [shipmentInlineSaving, setShipmentInlineSaving] = useState(false);
  const [shipmentInlineError, setShipmentInlineError] = useState<string | undefined>(undefined);
  const [uploadingFileType, setUploadingFileType] = useState<'label' | 'invoice' | null>(null);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);

  // shipping fee calculation state (shipment tab — actual boxes)
  const [shippingFeeLoading, setShippingFeeLoading] = useState(false);
  const [shippingFeeResult, setShippingFeeResult] = useState<{
    hasIncompleteRows: boolean;
    results: ShippingFeeCarrierResult[];
  } | null>(null);
  const [shippingFeeError, setShippingFeeError] = useState<string | undefined>(undefined);

  // billing tab shipping fee (estimate from order lines)
  const [billingShippingFeeLoading, setBillingShippingFeeLoading] = useState(false);
  const [billingShippingFeeResult, setBillingShippingFeeResult] = useState<ShippingFeeEstimateResult | null>(null);
  const [billingShippingFeeError, setBillingShippingFeeError] = useState<string | undefined>(undefined);

  // tab state: initialise from ?tab= query param; invalid/missing → 'billing'
  const [activeTab, setActiveTab] = useState<DetailTab>(() => resolveInitialTab(searchParams.get('tab')));

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

  const translateShippingFeeError = (code: string): string => {
    const errorMap: Record<string, string> = {
      ZONE_NOT_FOUND:           copy.shippingFeeErrorZoneNotFound,
      WEIGHT_EXCEEDS_MAX:       copy.shippingFeeErrorWeightExceedsMax,
      RATE_NOT_FOUND:           copy.shippingFeeErrorRateNotFound,
      INVALID_BOX_DIMENSIONS:   copy.shippingFeeErrorInvalidBoxDimensions,
      UNSUPPORTED_DIM_ROUNDING: copy.shippingFeeErrorUnsupportedDimRounding,
      CARRIER_NOT_AVAILABLE:    copy.shippingFeeErrorNotAvailable,
    };
    return errorMap[code] ?? copy.shippingFeeErrorUnknown;
  };

  const translateBillingSkipReason = (reason: string): string => {
    const map: Record<string, string> = {
      CONDITION_NOT_FOUND:           copy.billingShippingFeeSkipReasonConditionNotFound,
      CONDITION_NOT_SHIPPING_TARGET: copy.billingShippingFeeSkipReasonConditionNotTarget,
      CONDITION_UNIT_NOT_APPLICABLE: copy.billingShippingFeeSkipReasonConditionUnitNotApplicable,
      PRODUCT_PACKAGE_NOT_FOUND:     copy.billingShippingFeeSkipReasonProductPackageNotFound,
      PACKAGE_ID_NOT_SET:            copy.billingShippingFeeSkipReasonPackageIdNotSet,
      PACKAGE_NOT_FOUND:             copy.billingShippingFeeSkipReasonPackageNotFound,
      SIZE_NOT_FOUND:                copy.billingShippingFeeSkipReasonSizeNotFound,
      WEIGHT_NOT_FOUND:              copy.billingShippingFeeSkipReasonWeightNotFound,
    };
    return map[reason] ?? copy.billingShippingFeeSkipReasonUnknown;
  };

  const translateBillingCarrierError = (error: string): string => {
    const map: Record<string, string> = {
      ZONE_NOT_FOUND:           copy.billingShippingFeeCarrierErrorZoneNotFound,
      WEIGHT_EXCEEDS_MAX:       copy.billingShippingFeeCarrierErrorWeightExceedsMax,
      RATE_NOT_FOUND:           copy.billingShippingFeeCarrierErrorRateNotFound,
      INVALID_BOX_DIMENSIONS:   copy.billingShippingFeeCarrierErrorInvalidBoxDimensions,
      UNSUPPORTED_DIM_ROUNDING: copy.billingShippingFeeCarrierErrorUnsupportedDimRounding,
      CARRIER_NOT_AVAILABLE:    copy.billingShippingFeeCarrierErrorNotAvailable,
    };
    return map[error] ?? copy.billingShippingFeeCarrierErrorUnknown;
  };

  const getLineProductName = (productId: string): string => {
    const line = detail?.lines.find((l) => l.PRODUCT_ID === productId);
    return line ? line.PRODUCT_NAME : productId;
  };

  const DETAIL_TABS: ReadonlyArray<TabItem<DetailTab>> = [
    { key: 'billing',   label: copy.tabBilling },
    { key: 'purchases', label: copy.tabPurchases },
    { key: 'shipments', label: copy.tabShipments },
  ];

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

  const openShipmentForm = (existing?: OrderDetail['shipments'][number]) => {
    if (!orderId) return;
    setShipmentFormData(
      existing
        ? {
            orderId,
            shipmentId: existing.SHIPMENT_ID,
            boxNumber: String(existing.BOX_NUMBER ?? ''),
            shippingMethod: String(existing.SHIPPING_METHOD ?? ''),
            shippedAt: String(existing.SHIPPED_AT ?? ''),
            trackingNumber: String(existing.TRACKING_NUMBER ?? ''),
            length: String(existing.LENGTH ?? ''),
            width: String(existing.WIDTH ?? ''),
            height: String(existing.HEIGHT ?? ''),
            weight: String(existing.WEIGHT ?? ''),
            estimatedShippingFee: String(existing.ESTIMATED_SHIPPING_FEE ?? ''),
            inspection: String(existing.INSPECTION ?? ''),
            packing: String(existing.PACKING ?? ''),
            storage: String(existing.STORAGE ?? ''),
            pickupRequest: String(existing.PICKUP_REQUEST ?? ''),
            notification: String(existing.NOTIFICATION ?? ''),
            note: String(existing.NOTE ?? ''),
          }
        : { ...EMPTY_SHIPMENT_FORM, orderId }
    );
    setShipmentFormStep('input');
    setShipmentFormError(undefined);
    setShipmentFormOpen(true);
  };

  const handleShipmentSave = async () => {
    if (!orderId) return;
    setShipmentSaving(true);
    setShipmentFormError(undefined);
    try {
      await upsertCoreShipment(shipmentFormData);
      setShipmentFormOpen(false);
      void refresh();
      await refreshDetail(orderId);
    } catch (e: unknown) {
      setShipmentFormError(e instanceof Error ? e.message : copy.shipmentFormSaveError);
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleShipmentInlineSave = async () => {
    if (!orderId) return;
    setShipmentInlineSaving(true);
    setShipmentInlineError(undefined);
    try {
      await upsertCoreShipment(shipmentInlineEditData);
      void refresh();
      await refreshDetail(orderId);
    } catch (e: unknown) {
      setShipmentInlineError(e instanceof Error ? e.message : copy.shipmentFormSaveError);
    } finally {
      setShipmentInlineSaving(false);
    }
  };

  const handleShipmentFileUpload = async (fileType: 'label' | 'invoice', file: File) => {
    if (!orderId || !selectedShipmentId) return;
    setUploadingFileType(fileType);
    setUploadError(undefined);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.split(',')[1];
          if (!b64) { reject(new Error(copy.shipmentUploadError)); return; }
          resolve(b64);
        };
        reader.onerror = () => reject(new Error(copy.shipmentUploadError));
        reader.readAsDataURL(file);
      });
      await uploadCoreShipmentFile({ shipmentId: selectedShipmentId, fileType, fileBase64: base64 });
      await refreshDetail(orderId);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : copy.shipmentUploadError);
    } finally {
      setUploadingFileType(null);
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

  const handleCalculateShippingFee = async () => {
    if (!detail) return;
    const shipments = detail.shipments;
    const countryCode = detail.order.shippingCountry;
    const postalCode  = detail.order.shippingZip;

    if (shipments.length === 0) {
      setShippingFeeError(copy.shippingFeeNoShipments);
      setShippingFeeResult(null);
      return;
    }

    const validShipments = shipments.filter((s) => {
      const l  = Number(s.LENGTH);
      const w  = Number(s.WIDTH);
      const h  = Number(s.HEIGHT);
      const wt = Number(s.WEIGHT);
      return s.LENGTH !== '' && s.WIDTH !== '' && s.HEIGHT !== '' && s.WEIGHT !== ''
        && !isNaN(l) && !isNaN(w) && !isNaN(h) && !isNaN(wt)
        && l > 0 && w > 0 && h > 0 && wt > 0;
    });

    if (validShipments.length === 0) {
      setShippingFeeError(copy.shippingFeeAllRowsIncomplete);
      setShippingFeeResult(null);
      return;
    }

    const hasIncompleteRows = validShipments.length < shipments.length;
    const boxes = validShipments.map((s) => ({
      length:       Number(s.LENGTH),
      width:        Number(s.WIDTH),
      height:       Number(s.HEIGHT),
      actualWeight: Number(s.WEIGHT),
    }));
    const linkId = shipments[0].SHIPMENT_ID;

    setShippingFeeLoading(true);
    setShippingFeeError(undefined);
    setShippingFeeResult(null);
    try {
      const res = await estimateShippingFee({
        countryCode,
        postalCode: postalCode || undefined,
        boxes,
        linkType: 'SHIPMENT',
        linkId,
        save: true,
      });
      setShippingFeeResult({ hasIncompleteRows, results: res.results });
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : '';
      const knownErrors: Record<string, string> = {
        MISSING_COUNTRY_CODE: copy.shippingFeeErrorMissingCountryCode,
      };
      setShippingFeeError(knownErrors[code] ?? copy.shippingFeeErrorUnknown);
    } finally {
      setShippingFeeLoading(false);
    }
  };

  const handleCalculateBillingShippingFee = async () => {
    if (!orderId) return;
    setBillingShippingFeeLoading(true);
    setBillingShippingFeeError(undefined);
    setBillingShippingFeeResult(null);
    try {
      const res = await estimateShippingFeeForOrder(orderId);
      setBillingShippingFeeResult(res);
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : '';
      const knownErrors: Record<string, string> = {
        ORDER_COUNTRY_NOT_RESOLVABLE: copy.billingShippingFeeErrorOrderCountryNotResolvable,
      };
      setBillingShippingFeeError(knownErrors[code] ?? copy.billingShippingFeeErrorUnknown);
    } finally {
      setBillingShippingFeeLoading(false);
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
          { key: 'STATUS',          header: copy.colPurchaseStatus,         renderCell: (r) => purchaseStatusBadge(r.STATUS, purchaseStatusOptions) },
          { key: 'TRACKING_NUMBER', header: copy.colPurchaseTrackingNumber, renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
        ];

        // shipment table columns
        const shipmentColumns: DataTableColumn<OrderDetail['shipments'][number]>[] = [
          { key: 'SHIPPING_METHOD', header: copy.colShippingMethod,         renderCell: (r) => formatValue(r.SHIPPING_METHOD) },
          { key: 'SHIPPED_AT',      header: copy.colShippedAt,              renderCell: (r) => formatDate(r.SHIPPED_AT) },
          { key: 'TRACKING_NUMBER', header: copy.colShipmentTrackingNumber, renderCell: (r) => formatValue(r.TRACKING_NUMBER) },
          { key: 'BOX_NUMBER',      header: copy.colBoxNumber,              renderCell: (r) => formatValue(r.BOX_NUMBER) },
          { key: 'PICKUP_REQUEST',  header: copy.colPickupRequest,          renderCell: (r) => formatValue(r.PICKUP_REQUEST) },
        ];

        return (
          <>
            {/* header row: invoice number + conditional confirm button */}
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
                {canConfirmPayment && (
                  <Button
                    variant="primary"
                    disabled={confirming}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {copy.btnConfirmPayment}
                  </Button>
                )}
              </div>
            </div>

            {/* tabs */}
            <Tabs
              aria-label={copy.tabsLabel}
              items={DETAIL_TABS}
              activeKey={activeTab}
              onChange={setActiveTab}
              variant="underline"
              size="md"
            />

            {/* tab content */}
            <div className="sales-order-detail-page__tab-content">
              {activeTab === 'billing' && (
                <>
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

                  {/* order line items */}
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

                  {/* billing tab shipping fee estimate (from order lines) */}
                  <div className="sales-order-detail-page__section">
                    <div className="sales-order-detail-page__section-header">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={billingShippingFeeLoading}
                        onClick={() => void handleCalculateBillingShippingFee()}
                      >
                        {billingShippingFeeLoading ? copy.billingShippingFeeCalculating : copy.billingShippingFeeBtn}
                      </Button>
                    </div>
                    <p className="sales-order-detail-page__billing-shipping-fee-note">{copy.billingShippingFeeNote}</p>
                    {billingShippingFeeError && !billingShippingFeeLoading && (
                      <StatusMessage variant="error">{billingShippingFeeError}</StatusMessage>
                    )}
                    {billingShippingFeeResult && !billingShippingFeeLoading && (
                      <>
                        {!billingShippingFeeResult.success && (
                          <StatusMessage variant="empty">{copy.billingShippingFeeNoBoxes}</StatusMessage>
                        )}
                        {billingShippingFeeResult.success && (
                          <>
                            <h3 className="sales-order-detail-page__section-title">{copy.billingShippingFeeResultTitle}</h3>
                            <table className="sales-order-detail-page__shipping-fee-table">
                              <thead>
                                <tr>
                                  <th>{copy.billingShippingFeeColCarrier}</th>
                                  <th>{copy.billingShippingFeeColZone}</th>
                                  <th>{copy.billingShippingFeeColWeight}</th>
                                  <th>{copy.billingShippingFeeColBoxCount}</th>
                                  <th>{copy.billingShippingFeeColFee}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {billingShippingFeeResult.results.map((r) => {
                                  const totalChargeableWeight = r.boxes.reduce(
                                    (sum, b) => sum + b.chargeableWeight, 0
                                  );
                                  return (
                                    <tr key={r.carrierId}>
                                      <td>{r.carrierName}</td>
                                      <td>{r.zone ?? '-'}</td>
                                      <td>{r.error ? '-' : totalChargeableWeight.toFixed(2)}</td>
                                      <td>{r.error ? '-' : r.boxes.length}</td>
                                      <td>
                                        {r.error
                                          ? <span className="sales-order-detail-page__shipping-fee-error">{translateBillingCarrierError(r.error)}</span>
                                          : formatNumber(r.totalFee)
                                        }
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {billingShippingFeeResult.skipped.length > 0 && (
                              <>
                                <h3 className="sales-order-detail-page__section-title">{copy.billingShippingFeeSkippedTitle}</h3>
                                <table className="sales-order-detail-page__shipping-fee-table">
                                  <thead>
                                    <tr>
                                      <th>{copy.billingShippingFeeSkippedColProduct}</th>
                                      <th>{copy.billingShippingFeeSkippedColReason}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {billingShippingFeeResult.skipped.map((s, i) => (
                                      <tr key={i}>
                                        <td>{getLineProductName(s.productId)}</td>
                                        <td>{translateBillingSkipReason(s.reason)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* amount detail */}
                  <div className="sales-order-detail-page__section">
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
                </>
              )}

              {activeTab === 'purchases' && (
                <div className="sales-order-detail-page__section">
                  <div className="sales-order-detail-page__section-header">
                    <h2 className="sales-order-detail-page__section-title">{copy.sectionPurchases}</h2>
                    <Button variant="secondary" size="sm" onClick={() => openPurchaseForm()}>
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
              )}

              {activeTab === 'shipments' && (
                <div className="sales-order-detail-page__section">
                  <div className="sales-order-detail-page__section-header">
                    <h2 className="sales-order-detail-page__section-title">{copy.sectionShipments}</h2>
                    <div className="sales-order-detail-page__section-header-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={shippingFeeLoading}
                        onClick={() => void handleCalculateShippingFee()}
                      >
                        {shippingFeeLoading ? copy.shippingFeeCalculating : copy.btnCalculateShippingFee}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openShipmentForm()}>
                        {copy.btnAddShipment}
                      </Button>
                    </div>
                  </div>
                  {detail.shipments.length === 0 ? (
                    <p className="sales-order-detail-page__empty-note">{copy.noShipments}</p>
                  ) : (
                    <DataTable
                      ariaLabel={copy.sectionShipments}
                      columns={shipmentColumns}
                      rows={detail.shipments}
                      rowKey={(r) => String(r.SHIPMENT_ID)}
                      onRowClick={(r) => {
                          if (selectedShipmentId === r.SHIPMENT_ID) {
                            setSelectedShipmentId(undefined);
                          } else {
                            setSelectedShipmentId(r.SHIPMENT_ID);
                            setShipmentInlineEditData({
                              orderId: orderId ?? '',
                              shipmentId: r.SHIPMENT_ID,
                              boxNumber: String(r.BOX_NUMBER ?? ''),
                              shippingMethod: String(r.SHIPPING_METHOD ?? ''),
                              shippedAt: String(r.SHIPPED_AT ?? ''),
                              trackingNumber: String(r.TRACKING_NUMBER ?? ''),
                              length: String(r.LENGTH ?? ''),
                              width: String(r.WIDTH ?? ''),
                              height: String(r.HEIGHT ?? ''),
                              weight: String(r.WEIGHT ?? ''),
                              estimatedShippingFee: String(r.ESTIMATED_SHIPPING_FEE ?? ''),
                              inspection: String(r.INSPECTION ?? ''),
                              packing: String(r.PACKING ?? ''),
                              storage: String(r.STORAGE ?? ''),
                              pickupRequest: String(r.PICKUP_REQUEST ?? ''),
                              notification: String(r.NOTIFICATION ?? ''),
                              note: String(r.NOTE ?? ''),
                            });
                            setShipmentInlineError(undefined);
                            setUploadError(undefined);
                          }
                        }}
                      surface="embedded"
                    />
                  )}
                  {selectedShipmentId && (() => {
                    const s = detail.shipments.find((r) => r.SHIPMENT_ID === selectedShipmentId);
                    if (!s) return null;
                    return (
                      <div className="sales-order-detail-page__shipment-detail">
                        <div className="sales-order-detail-page__shipment-detail-header">
                          <h3 className="sales-order-detail-page__section-title">{copy.shipmentDetailTitle}</h3>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedShipmentId(undefined)}>
                            {copy.shipmentDetailClose}
                          </Button>
                        </div>
                        <dl className="sales-order-detail-page__purchase-confirm-dl">
                          <dt>{copy.labelShipmentId}</dt><dd>{formatValue(s.SHIPMENT_ID)}</dd>
                          <dt>{copy.labelShipmentShippingAssigneeId}</dt><dd>{formatValue(s.SHIPPING_ASSIGNEE_ID)}</dd>
                        </dl>
                        <div className="sales-order-detail-page__purchase-form-grid">
                          <TextField
                            label={copy.labelShipmentBoxNumber}
                            type="number"
                            value={shipmentInlineEditData.boxNumber ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, boxNumber: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentShippingMethod}
                            value={shipmentInlineEditData.shippingMethod ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, shippingMethod: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentShippedAt}
                            type="date"
                            value={shipmentInlineEditData.shippedAt ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, shippedAt: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentTrackingNumber}
                            value={shipmentInlineEditData.trackingNumber ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentLength}
                            type="number"
                            value={shipmentInlineEditData.length ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, length: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentWidth}
                            type="number"
                            value={shipmentInlineEditData.width ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, width: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentHeight}
                            type="number"
                            value={shipmentInlineEditData.height ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, height: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentWeight}
                            type="number"
                            value={shipmentInlineEditData.weight ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, weight: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentEstimatedShippingFee}
                            type="number"
                            value={shipmentInlineEditData.estimatedShippingFee ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, estimatedShippingFee: e.target.value }))}
                          />
                          <TextField
                            label={copy.labelShipmentNote}
                            value={shipmentInlineEditData.note ?? ''}
                            onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, note: e.target.value }))}
                          />
                        </div>
                        <div className="sales-order-detail-page__shipment-flags">
                          {(
                            [
                              ['inspection',   copy.labelShipmentInspection],
                              ['packing',      copy.labelShipmentPacking],
                              ['storage',      copy.labelShipmentStorage],
                              ['pickupRequest', copy.labelShipmentPickupRequest],
                              ['notification', copy.labelShipmentNotification],
                            ] as const
                          ).map(([field, label]) => (
                            <label key={field} className="sales-order-detail-page__shipment-flag-label">
                              <input
                                type="checkbox"
                                checked={shipmentInlineEditData[field] === 'TRUE'}
                                onChange={(e) => setShipmentInlineEditData((prev) => ({ ...prev, [field]: e.target.checked ? 'TRUE' : '' }))}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {shipmentInlineError && <StatusMessage variant="error">{shipmentInlineError}</StatusMessage>}
                        <div className="sales-order-detail-page__confirm-actions">
                          <Button
                            variant="primary"
                            disabled={shipmentInlineSaving}
                            onClick={() => void handleShipmentInlineSave()}
                          >
                            {shipmentInlineSaving ? copy.shipmentFormSaving : copy.btnSaveShipment}
                          </Button>
                        </div>
                        <div className="sales-order-detail-page__shipment-files">
                          {!s.TRACKING_NUMBER ? (
                            <p className="sales-order-detail-page__upload-no-tracking">
                              {copy.shipmentUploadNoTrackingHint}
                            </p>
                          ) : (
                            <>
                              {uploadError && <StatusMessage variant="error">{uploadError}</StatusMessage>}
                              {(['label', 'invoice'] as const).map((ft) => {
                                const url = ft === 'label' ? s.LABEL_URL : s.INVOICE_URL;
                                const title = ft === 'label' ? copy.shipmentUploadLabelTitle : copy.shipmentUploadInvoiceTitle;
                                const isUploading = uploadingFileType === ft;
                                return (
                                  <div key={ft} className="sales-order-detail-page__upload-item">
                                    <span className="sales-order-detail-page__upload-label">{title}</span>
                                    {url && (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sales-order-detail-page__upload-link"
                                      >
                                        {copy.shipmentUploadViewLink}
                                      </a>
                                    )}
                                    <label className="sales-order-detail-page__upload-zone">
                                      <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        style={{ display: 'none' }}
                                        disabled={isUploading}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) void handleShipmentFileUpload(ft, file);
                                          e.target.value = '';
                                        }}
                                      />
                                      {isUploading ? copy.shipmentUploadUploading : copy.shipmentUploadDropHint}
                                      <span className="sales-order-detail-page__upload-hint">
                                        {copy.shipmentUploadFileSizeHint}
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* shipping fee calculation results */}
                  {(shippingFeeLoading || shippingFeeError || shippingFeeResult) && (
                    <div className="sales-order-detail-page__shipping-fee-result">
                      {shippingFeeLoading && (
                        <StatusMessage variant="loading">{copy.shippingFeeCalculating}</StatusMessage>
                      )}
                      {shippingFeeError && !shippingFeeLoading && (
                        <StatusMessage variant="error">{shippingFeeError}</StatusMessage>
                      )}
                      {shippingFeeResult && !shippingFeeLoading && (
                        <>
                          {shippingFeeResult.hasIncompleteRows && (
                            <StatusMessage variant="empty">{copy.shippingFeeIncompleteRows}</StatusMessage>
                          )}
                          <h3 className="sales-order-detail-page__section-title">{copy.shippingFeeResultTitle}</h3>
                          <table className="sales-order-detail-page__shipping-fee-table">
                            <thead>
                              <tr>
                                <th>{copy.shippingFeeColCarrier}</th>
                                <th>{copy.shippingFeeColZone}</th>
                                <th>{copy.shippingFeeColWeight}</th>
                                <th>{copy.shippingFeeColBoxCount}</th>
                                <th>{copy.shippingFeeColFee}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shippingFeeResult.results.map((r) => {
                                const totalChargeableWeight = r.boxes.reduce(
                                  (sum, b) => sum + b.chargeableWeight, 0
                                );
                                const errorMsg = r.error ? translateShippingFeeError(r.error) : null;
                                return (
                                  <tr key={r.carrierId}>
                                    <td>{r.carrierName}</td>
                                    {errorMsg ? (
                                      <td colSpan={4} className="sales-order-detail-page__shipping-fee-error">
                                        {errorMsg}
                                      </td>
                                    ) : (
                                      <>
                                        <td>{r.zone ?? '-'}</td>
                                        <td>{totalChargeableWeight.toFixed(1)}</td>
                                        <td>{r.boxes.length}</td>
                                        <td>{r.totalFee !== null ? r.totalFee.toLocaleString('ja-JP') : '-'}</td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
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
            {/* shipment form dialog */}
            {shipmentFormOpen && (
              <div className="sales-order-detail-page__confirm-overlay">
                <div className="sales-order-detail-page__shipment-dialog">
                  {shipmentFormStep === 'input' ? (
                    <>
                      <h3 className="sales-order-detail-page__section-title">
                        {shipmentFormData.shipmentId ? copy.shipmentFormEditTitle : copy.shipmentFormTitle}
                      </h3>
                      <div className="sales-order-detail-page__shipment-form-grid">
                        <TextField
                          label={copy.labelShipmentBoxNumber}
                          type="number"
                          value={shipmentFormData.boxNumber ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, boxNumber: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentShippingMethod}
                          value={shipmentFormData.shippingMethod ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, shippingMethod: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentShippedAt}
                          type="date"
                          value={shipmentFormData.shippedAt ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, shippedAt: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentTrackingNumber}
                          value={shipmentFormData.trackingNumber ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentLength}
                          type="number"
                          value={shipmentFormData.length ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, length: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentWidth}
                          type="number"
                          value={shipmentFormData.width ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, width: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentHeight}
                          type="number"
                          value={shipmentFormData.height ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, height: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentWeight}
                          type="number"
                          value={shipmentFormData.weight ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, weight: e.target.value }))}
                        />
                        <TextField
                          label={copy.labelShipmentEstimatedShippingFee}
                          type="number"
                          value={shipmentFormData.estimatedShippingFee ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, estimatedShippingFee: e.target.value }))}
                        />
                        <div className="sales-order-detail-page__shipment-form-full sales-order-detail-page__shipment-checkbox-group">
                          <label className="sales-order-detail-page__shipment-checkbox">
                            <input
                              type="checkbox"
                              checked={shipmentFormData.inspection === 'TRUE'}
                              onChange={(e) => setShipmentFormData((prev) => ({ ...prev, inspection: e.target.checked ? 'TRUE' : '' }))}
                            />
                            {copy.labelShipmentInspection}
                          </label>
                          <label className="sales-order-detail-page__shipment-checkbox">
                            <input
                              type="checkbox"
                              checked={shipmentFormData.packing === 'TRUE'}
                              onChange={(e) => setShipmentFormData((prev) => ({ ...prev, packing: e.target.checked ? 'TRUE' : '' }))}
                            />
                            {copy.labelShipmentPacking}
                          </label>
                          <label className="sales-order-detail-page__shipment-checkbox">
                            <input
                              type="checkbox"
                              checked={shipmentFormData.storage === 'TRUE'}
                              onChange={(e) => setShipmentFormData((prev) => ({ ...prev, storage: e.target.checked ? 'TRUE' : '' }))}
                            />
                            {copy.labelShipmentStorage}
                          </label>
                          <label className="sales-order-detail-page__shipment-checkbox">
                            <input
                              type="checkbox"
                              checked={shipmentFormData.pickupRequest === 'TRUE'}
                              onChange={(e) => setShipmentFormData((prev) => ({ ...prev, pickupRequest: e.target.checked ? 'TRUE' : '' }))}
                            />
                            {copy.labelShipmentPickupRequest}
                          </label>
                          <label className="sales-order-detail-page__shipment-checkbox">
                            <input
                              type="checkbox"
                              checked={shipmentFormData.notification === 'TRUE'}
                              onChange={(e) => setShipmentFormData((prev) => ({ ...prev, notification: e.target.checked ? 'TRUE' : '' }))}
                            />
                            {copy.labelShipmentNotification}
                          </label>
                        </div>
                        <TextField
                          label={copy.labelShipmentNote}
                          value={shipmentFormData.note ?? ''}
                          onChange={(e) => setShipmentFormData((prev) => ({ ...prev, note: e.target.value }))}
                          className="sales-order-detail-page__shipment-form-full"
                        />
                      </div>
                      <div className="sales-order-detail-page__confirm-actions">
                        <Button
                          variant="secondary"
                          onClick={() => { setShipmentFormOpen(false); setShipmentFormError(undefined); }}
                        >
                          {copy.shipmentFormCancel}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => { setShipmentFormStep('confirm'); }}
                        >
                          {copy.shipmentFormConfirmTitle}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="sales-order-detail-page__section-title">{copy.shipmentFormConfirmTitle}</h3>
                      <p className="sales-order-detail-page__purchase-confirm-body">{copy.shipmentFormConfirmBody}</p>
                      <dl className="sales-order-detail-page__purchase-confirm-dl">
                        {shipmentFormData.boxNumber           && <><dt>{copy.labelShipmentBoxNumber}</dt><dd>{shipmentFormData.boxNumber}</dd></>}
                        {shipmentFormData.shippingMethod      && <><dt>{copy.labelShipmentShippingMethod}</dt><dd>{shipmentFormData.shippingMethod}</dd></>}
                        {shipmentFormData.shippedAt           && <><dt>{copy.labelShipmentShippedAt}</dt><dd>{shipmentFormData.shippedAt}</dd></>}
                        {shipmentFormData.trackingNumber      && <><dt>{copy.labelShipmentTrackingNumber}</dt><dd>{shipmentFormData.trackingNumber}</dd></>}
                        {shipmentFormData.length              && <><dt>{copy.labelShipmentLength}</dt><dd>{shipmentFormData.length}</dd></>}
                        {shipmentFormData.width               && <><dt>{copy.labelShipmentWidth}</dt><dd>{shipmentFormData.width}</dd></>}
                        {shipmentFormData.height              && <><dt>{copy.labelShipmentHeight}</dt><dd>{shipmentFormData.height}</dd></>}
                        {shipmentFormData.weight              && <><dt>{copy.labelShipmentWeight}</dt><dd>{shipmentFormData.weight}</dd></>}
                        {shipmentFormData.estimatedShippingFee && <><dt>{copy.labelShipmentEstimatedShippingFee}</dt><dd>{shipmentFormData.estimatedShippingFee}</dd></>}
                        {shipmentFormData.inspection === 'TRUE' && <><dt>{copy.labelShipmentInspection}</dt><dd>{copy.labelShipmentInspection}</dd></>}
                        {shipmentFormData.packing === 'TRUE'    && <><dt>{copy.labelShipmentPacking}</dt><dd>{copy.labelShipmentPacking}</dd></>}
                        {shipmentFormData.storage === 'TRUE'    && <><dt>{copy.labelShipmentStorage}</dt><dd>{copy.labelShipmentStorage}</dd></>}
                        {shipmentFormData.pickupRequest === 'TRUE' && <><dt>{copy.labelShipmentPickupRequest}</dt><dd>{copy.labelShipmentPickupRequest}</dd></>}
                        {shipmentFormData.notification === 'TRUE' && <><dt>{copy.labelShipmentNotification}</dt><dd>{copy.labelShipmentNotification}</dd></>}
                        {shipmentFormData.note                && <><dt>{copy.labelShipmentNote}</dt><dd>{shipmentFormData.note}</dd></>}
                      </dl>
                      {shipmentFormError && <StatusMessage variant="error">{shipmentFormError}</StatusMessage>}
                      <div className="sales-order-detail-page__confirm-actions">
                        <Button
                          variant="secondary"
                          disabled={shipmentSaving}
                          onClick={() => { setShipmentFormStep('input'); setShipmentFormError(undefined); }}
                        >
                          {copy.shipmentFormBack}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={shipmentSaving}
                          onClick={() => { void handleShipmentSave(); }}
                        >
                          {shipmentSaving ? copy.shipmentFormSaving : copy.shipmentFormConfirm}
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
