import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Combobox, LineItemEditor, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField, TwoColumnLayout } from '../../components/ui';
import { ordersCopy } from '../../content/ja/orders';
import { ISSUER_HEADER } from '../../content/ja/issuer';
import type { ShippingAddressDto, PaymentProfileDto, CustomerRepository } from '../../features/customers/contracts';
import { useCustomerAggregateCache } from '../../features/customers/CustomerAggregateCacheContext';
import type { OrderCreatePayload, OrderRepository, OrderUpdatePayload } from '../../features/orders/contracts';
import { InvoiceDocument } from '../../features/documents/InvoiceDocument';
import { getCoreIssuer, type IssuerRecord } from '../../gas/client';
import { useInventoryConditionsMap } from '../inventory/InventoryListCacheContext';
import { useInventoryProductOptionsCache } from '../inventory/InventoryProductOptionsCacheContext';
import { formatDate } from '../shared/dateFormat';
import {
  calcInvoiceTotal,
  emptyOrderEditorValues,
  emptyOrderLine,
  ORDER_EDITOR_PATHS,
  PAYMENT_METHODS,
  toHalfwidthDigits,
  type OrderEditorValues,
} from './orderEditorConfig';
import { useOrderListCache } from './OrderListCacheContext';
import { useCurrencyMasterCache } from '../currency/CurrencyMasterCacheContext';
import './OrderEditorPage.css';

function buildIssuerInfo(rec: IssuerRecord) {
  const get = (key: string): string => {
    const val = rec[key];
    return val === null || val === undefined ? '' : String(val);
  };
  return {
    name: get(ISSUER_HEADER.COMPANY_NAME),
    lines: [
      get(ISSUER_HEADER.ADDRESS_LINE1),
      get(ISSUER_HEADER.ADDRESS_LINE2),
      get(ISSUER_HEADER.ADDRESS_LINE3),
      [get(ISSUER_HEADER.CITY), get(ISSUER_HEADER.STATE), get(ISSUER_HEADER.ZIP)].filter(Boolean).join(' '),
      get(ISSUER_HEADER.COUNTRY),
      get(ISSUER_HEADER.PHONE),
      get(ISSUER_HEADER.EMAIL),
    ].filter(Boolean),
  };
}

function toDocAmount(value: string | number | undefined | null): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString();
}

type PrintData = {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customerName: string;
  shipToName: string;
  shipToLines: string[];
  lines: { no: number; name: string; qty: string; unitPrice: string; amount: string }[];
  subtotal: string;
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  total: string;
  currency: string;
  paymentMethod: string;
};

type Props = {
  mode: 'create' | 'edit';
  repository: OrderRepository;
  customerRepository: CustomerRepository;
};

type MasterState = 'loading' | 'ready' | 'error';

export function OrderEditorPage({ mode, repository, customerRepository }: Props) {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [values, setValues] = useState<OrderEditorValues>(emptyOrderEditorValues());
  const [masterState, setMasterState] = useState<MasterState>('loading');
  const [masterError, setMasterError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAmountLocked, setIsAmountLocked] = useState(false);
  const [issuer, setIssuer] = useState<IssuerRecord | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const printNavigatePath = useRef(ORDER_EDITOR_PATHS.list);
  const [invoiceInfo, setInvoiceInfo] = useState<{
    invoiceNumber: string;
    invoiceIssuedAt: string;
    paymentDueAt: string;
  } | null>(null);

  const [customers, setCustomers] = useState<readonly { customerId: string; customerName: string }[]>([]);
  const [customerAggregate, setCustomerAggregate] = useState<{
    shippingAddresses: readonly ShippingAddressDto[];
    paymentProfiles: readonly PaymentProfileDto[];
  } | null>(null);
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);

  const conditionsMap = useInventoryConditionsMap();
  const { products: inventoryProducts, ensureLoaded: ensureInventoryProductOptions } = useInventoryProductOptionsCache();

  const { state: aggregateCache } = useCustomerAggregateCache();
  const customerRepositoryRef = useRef(customerRepository);
  customerRepositoryRef.current = customerRepository;

  // In edit mode: get existing data from OrderListCacheContext
  const { items: orderItems } = useOrderListCache();
  const { currencies, ensureLoaded: ensureCurrencies } = useCurrencyMasterCache();

  useEffect(() => {
    void getCoreIssuer().then((data) => setIssuer(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    navigate(printNavigatePath.current);
  }, [showPrint, navigate]);

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([
      customerRepository.listCustomers(),
      ensureInventoryProductOptions(),
      ensureCurrencies(),
    ])
      .then(([customerList]) => {
        setCustomers(customerList.map((c) => ({ customerId: c.customerId, customerName: c.customerName })));
        setMasterState('ready');
      })
      .catch((cause) => {
        setMasterError(cause instanceof Error ? cause.message : ordersCopy.editor.masterLoadError);
        setMasterState('error');
      });
  }, [customerRepository, ensureCurrencies, ensureInventoryProductOptions]);

  // In edit mode: set initial values once order list is loaded
  useEffect(() => {
    if (mode !== 'edit' || !orderId || !orderItems) return;
    const record = orderItems.find((r) => r.orderId === orderId);
    if (!record) return;
    // Lock amount fields if invoice has been issued
    setIsAmountLocked(!!record.invoiceIssuedAt);
    // Store invoice info for right column display
    if (record.invoiceNumber || record.invoiceIssuedAt || record.paymentDueAt) {
      setInvoiceInfo({
        invoiceNumber: record.invoiceNumber,
        invoiceIssuedAt: record.invoiceIssuedAt,
        paymentDueAt: record.paymentDueAt,
      });
    }
    // Apply editable fields available in OrderRecord (list API)
    // Note: shippingFee / duty / otherFee / discount are not included in the list API response;
    // they remain empty and can be re-entered by the operator before invoice issuance.
    setValues((prev) => ({
      ...prev,
      currency: record.currency || prev.currency,
      paymentMethod: record.paymentMethod || prev.paymentMethod,
    }));
  }, [mode, orderId, orderItems]);

  const applyAggregate = useCallback((
    customerId: string,
    shippingAddresses: readonly ShippingAddressDto[],
    paymentProfiles: readonly PaymentProfileDto[],
  ) => {
    setCustomerAggregate({ shippingAddresses, paymentProfiles });
    const defaultShipping = shippingAddresses.find((a) => a.isDefault === '1' || a.isDefault === 'TRUE') ?? shippingAddresses[0];
    const defaultPayment = paymentProfiles.find((p) => p.isDefault === '1' || p.isDefault === 'TRUE') ?? paymentProfiles[0];
    setValues((prev) => ({
      ...prev,
      customerId,
      shippingDestinationId: defaultShipping?.addressId ?? '',
      paymentDestinationId: defaultPayment?.paymentProfileId ?? '',
    }));
  }, []);

  // Resolve pending customer selection when aggregate cache becomes ready or errors out.
  useEffect(() => {
    if (!pendingCustomerId) return;
    if (aggregateCache.status === 'ready') {
      const cached = aggregateCache.data[pendingCustomerId];
      if (cached) applyAggregate(pendingCustomerId, cached.shippingAddresses, cached.paymentProfiles);
      setPendingCustomerId(null);
    } else if (aggregateCache.status === 'error') {
      const id = pendingCustomerId;
      setPendingCustomerId(null);
      void customerRepositoryRef.current.getCustomer(id).then((agg) => {
        if (!agg) return;
        applyAggregate(id, agg.shippingAddresses, agg.paymentProfiles);
      }).catch(() => {/* non-fatal */});
    }
  }, [aggregateCache, pendingCustomerId, applyAggregate]);

  const handleCustomerChange = (customerId: string) => {
    setValues((prev) => ({
      ...prev,
      customerId,
      shippingDestinationId: '',
      paymentDestinationId: '',
    }));
    setCustomerAggregate(null);
    setPendingCustomerId(null);
    if (!customerId) return;

    if (aggregateCache.status === 'ready') {
      const cached = aggregateCache.data[customerId];
      if (cached) {
        applyAggregate(customerId, cached.shippingAddresses, cached.paymentProfiles);
        return;
      }
    }

    if (aggregateCache.status === 'loading') {
      setPendingCustomerId(customerId);
      return;
    }

    void customerRepository.getCustomer(customerId).then((agg) => {
      if (!agg) return;
      applyAggregate(customerId, agg.shippingAddresses, agg.paymentProfiles);
    }).catch(() => {/* aggregate load failure is non-fatal */});
  };

  const updateValue = <K extends keyof Omit<OrderEditorValues, 'lines'>>(key: K, value: OrderEditorValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleProductSelect = (index: number, productId: string, productName: string) => {
    const product = inventoryProducts.find((p) => p.productId === productId);
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index
          ? {
              ...line,
              productId,
              productName,
              category: product?.category ?? '',
              condition: '',
              unitPrice: '',
              unitWeight: 0,
            }
          : line
      ),
    }));
  };

  const handleConditionSelect = (index: number, condition: string) => {
    setValues((prev) => {
      const line = prev.lines[index];
      if (!line) return prev;
      const conditions = conditionsMap.get(line.productId) ?? [];
      const found = conditions.find((c) => c.condition === condition);
      return {
        ...prev,
        lines: prev.lines.map((l, i) =>
          i === index
            ? {
                ...l,
                condition,
                unitPrice: found ? String(found.unitPrice) : l.unitPrice,
                unitWeight: found ? found.unitWeight : 0,
              }
            : l
        ),
      };
    });
  };

  const handleQuantityChange = (index: number, raw: string) => {
    const half = toHalfwidthDigits(raw);
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === index ? { ...l, quantity: half } : l),
    }));
  };

  const handleUnitPriceChange = (index: number, value: string) => {
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === index ? { ...l, unitPrice: value } : l),
    }));
  };

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, emptyOrderLine()] }));

  const removeLine = (index: number) =>
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const validateCreate = (): boolean => {
    if (!values.customerId.trim()) {
      setSaveError(ordersCopy.editor.validation.customerRequired);
      return false;
    }
    if (!values.shippingDestinationId.trim()) {
      setSaveError(ordersCopy.editor.validation.shippingDestinationRequired);
      return false;
    }
    if (!values.paymentDestinationId.trim()) {
      setSaveError(ordersCopy.editor.validation.paymentDestinationRequired);
      return false;
    }
    if (values.lines.length === 0) {
      setSaveError(ordersCopy.editor.validation.linesRequired);
      return false;
    }
    for (let i = 0; i < values.lines.length; i++) {
      const line = values.lines[i];
      if (!line) continue;
      if (!toHalfwidthDigits(line.quantity).trim()) {
        setSaveError(ordersCopy.editor.validation.lineQuantityRequired(i));
        return false;
      }
      if (!toHalfwidthDigits(line.unitPrice).trim()) {
        setSaveError(ordersCopy.editor.validation.lineUnitPriceRequired(i));
        return false;
      }
    }
    return true;
  };

  const handleSave = async (isDraft = true) => {
    setSaveError('');

    if (mode === 'create') {
      if (!validateCreate()) return;
      setSaving(true);
      try {
        const payload: OrderCreatePayload = {
          customerId: values.customerId,
          shippingDestinationId: values.shippingDestinationId,
          paymentDestinationId: values.paymentDestinationId,
          currency: values.currency,
          paymentMethod: values.paymentMethod,
          isDraft,
          invoiceNumber: values.invoiceNumber,
          shippingFee: values.shippingFee,
          duty: values.duty,
          otherFee: values.otherFee,
          discount: values.discount,
          shippingNote: values.shippingNote,
          internalNote: values.internalNote,
          lines: values.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            category: line.category,
            status: line.condition,
            quantity: toHalfwidthDigits(line.quantity),
            unitPrice: toHalfwidthDigits(line.unitPrice),
          })),
        };
        await repository.createOrder(payload);
        if (!isDraft && issuer) {
          const selectedCustomer = customers.find((c) => c.customerId === values.customerId);
          const selectedShipping = customerAggregate?.shippingAddresses.find(
            (a) => a.addressId === values.shippingDestinationId
          );
          const lineTotal = values.lines.reduce((sum, line) => {
            const qty = Number(toHalfwidthDigits(line.quantity)) || 0;
            const price = Number(toHalfwidthDigits(line.unitPrice)) || 0;
            return sum + qty * price;
          }, 0);
          const totalNum = calcInvoiceTotal(
            values.lines, values.shippingFee, values.duty, values.otherFee, values.discount
          );
          printNavigatePath.current = ORDER_EDITOR_PATHS.list;
          setPrintData({
            invoiceNumber: values.invoiceNumber,
            date: new Date().toISOString().slice(0, 10),
            dueDate: '',
            customerName: selectedCustomer?.customerName ?? '',
            shipToName: selectedShipping?.displayName ?? selectedCustomer?.customerName ?? '',
            shipToLines: [
              selectedShipping?.address ?? '',
              selectedShipping?.country ?? '',
            ].filter(Boolean),
            lines: values.lines.map((line, i) => {
              const qty = Number(toHalfwidthDigits(line.quantity)) || 0;
              const price = Number(toHalfwidthDigits(line.unitPrice)) || 0;
              return {
                no: i + 1,
                name: line.productName,
                qty: toDocAmount(qty),
                unitPrice: toDocAmount(price),
                amount: toDocAmount(qty * price),
              };
            }),
            subtotal: toDocAmount(lineTotal),
            shippingFee: toDocAmount(toHalfwidthDigits(values.shippingFee)),
            duty: toDocAmount(toHalfwidthDigits(values.duty)),
            otherFee: toDocAmount(toHalfwidthDigits(values.otherFee)),
            discount: toDocAmount(toHalfwidthDigits(values.discount)),
            total: toDocAmount(totalNum),
            currency: values.currency,
            paymentMethod: values.paymentMethod,
          });
          setShowPrint(true);
          return;
        }
        navigate(ORDER_EDITOR_PATHS.list);
      } catch (cause) {
        setSaveError(
          (cause instanceof Error ? cause.message : '') || ordersCopy.editor.saveErrorFallback
        );
      } finally {
        setSaving(false);
      }
    } else {
      // edit mode
      if (!orderId) return;
      setSaving(true);
      try {
        const payload: OrderUpdatePayload = {
          paymentConfirmedAt: values.paymentConfirmedAt,
          shippedAt: values.shippedAt,
          trackingNumber: values.trackingNumber,
          shippingMethod: values.shippingMethod,
          shippingNote: values.shippingNote,
          internalNote: values.internalNote,
          cancellationReason: values.cancellationReason,
          cancellationNote: values.cancellationNote,
          isDraft,
          invoiceNumber: values.invoiceNumber,
        };
        // Include amount fields only before invoice is issued
        if (!isAmountLocked) {
          payload.shippingFee = values.shippingFee;
          payload.duty = values.duty;
          payload.otherFee = values.otherFee;
          payload.discount = values.discount;
          payload.lines = values.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            category: line.category,
            status: line.condition,
            quantity: toHalfwidthDigits(line.quantity),
            unitPrice: toHalfwidthDigits(line.unitPrice),
          }));
        }
        await repository.updateOrder(orderId, payload);
        navigate(ORDER_EDITOR_PATHS.list);
      } catch (cause) {
        setSaveError(
          (cause instanceof Error ? cause.message : '') || ordersCopy.editor.saveErrorFallback
        );
      } finally {
        setSaving(false);
      }
    }
  };

  if (masterState === 'error') {
    return (
      <StatusMessage variant="error">
        {ordersCopy.editor.masterLoadError} {masterError}
        <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)}>
          {ordersCopy.editor.backToList}
        </Button>
      </StatusMessage>
    );
  }

  const shippingOptions = customerAggregate?.shippingAddresses.map((a) => ({
    value: a.addressId,
    label: a.displayName || [a.recipient, a.country, a.address].filter(Boolean).join(' / '),
  })) ?? [];

  const paymentOptions = customerAggregate?.paymentProfiles.map((p) => ({
    value: p.paymentProfileId,
    label: p.displayName || [p.country, p.address].filter(Boolean).join(' / '),
  })) ?? [];

  const currencyOptions = currencies.length > 0
    ? currencies.map((currency) => ({ value: currency.currencyCode, label: currency.currencyCode }))
    : [{ value: values.currency, label: values.currency }];

  const paymentMethodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: ordersCopy.editor.paymentMethodLabels[m] ?? m,
  }));

  const invoiceTotal = calcInvoiceTotal(
    values.lines,
    values.shippingFee,
    values.duty,
    values.otherFee,
    values.discount,
  );

  const isLoading = masterState === 'loading';

  const isEditMode = mode === 'edit';
  const pageTitle = isEditMode ? ordersCopy.editor.editTitle : ordersCopy.editor.createTitle;
  const pageSubtitle = isEditMode ? ordersCopy.editor.editSubtitle : ordersCopy.editor.createSubtitle;
  const saveLabel = isEditMode ? ordersCopy.editor.updateOrder : ordersCopy.editor.saveOrder;
  const savingLabel = isEditMode ? ordersCopy.editor.updating : ordersCopy.editor.saving;

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

  /** Right column: invoice info and amount summary */
  const rightColumn = (
    <div className="order-editor-page__right-panel">
      {/* Edit mode only: invoice number / issued date / payment due date */}
      {isEditMode && invoiceInfo && (
        <>
          <div className="order-editor-page__right-section">
            <h2 className="order-editor-page__right-heading">{ordersCopy.detail.title}</h2>
            <dl className="order-editor-page__meta-list">
              {invoiceInfo.invoiceNumber && (
                <>
                  <dt className="order-editor-page__meta-label">{ordersCopy.detail.invoiceNumber}</dt>
                  <dd className="order-editor-page__meta-value">{invoiceInfo.invoiceNumber}</dd>
                </>
              )}
              {invoiceInfo.invoiceIssuedAt && (
                <>
                  <dt className="order-editor-page__meta-label">{ordersCopy.detail.invoiceIssuedAt}</dt>
                  <dd className="order-editor-page__meta-value">{formatDate(invoiceInfo.invoiceIssuedAt)}</dd>
                </>
              )}
              {invoiceInfo.paymentDueAt && (
                <>
                  <dt className="order-editor-page__meta-label">{ordersCopy.detail.paymentDueAt}</dt>
                  <dd className="order-editor-page__meta-value">{formatDate(invoiceInfo.paymentDueAt)}</dd>
                </>
              )}
            </dl>
          </div>
          <hr className="order-editor-page__divider" />
        </>
      )}

      {/* Amount summary */}
      {!isAmountLocked && (
        <>
          <div className="order-editor-page__right-section">
            <h2 className="order-editor-page__right-heading">{ordersCopy.detail.sectionAmount}</h2>
            <div className="order-editor-page__amount-form">
              <TextField
                label={ordersCopy.editor.shippingFee}
                value={values.shippingFee}
                onChange={(e) => updateValue('shippingFee', e.target.value)}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.editor.duty}
                value={values.duty}
                onChange={(e) => updateValue('duty', e.target.value)}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.editor.otherFee}
                value={values.otherFee}
                onChange={(e) => updateValue('otherFee', e.target.value)}
                width="sm"
                placeholder="0"
              />
              <TextField
                label={ordersCopy.editor.discount}
                value={values.discount}
                onChange={(e) => updateValue('discount', e.target.value)}
                width="sm"
                placeholder="0"
              />
            </div>
          </div>
          <hr className="order-editor-page__divider" />
        </>
      )}

      {/* Invoice total */}
      <div className="order-editor-page__right-section">
        <div className="order-editor-page__total-row">
          <span className="order-editor-page__total-label">{ordersCopy.editor.invoiceTotal}</span>
          <span className="order-editor-page__total-value">
            {invoiceTotal != null ? invoiceTotal.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      <hr className="order-editor-page__divider" />

      {/* Currency / payment method */}
      <div className="order-editor-page__right-section">
        <div className="order-editor-page__amount-form">
          <Select
            label={ordersCopy.editor.currency}
            options={currencyOptions}
            value={values.currency}
            onChange={(e) => updateValue('currency', e.target.value)}
            width="sm"
          />
          {values.paymentMethod === 'PAYPAL' && <TextField label={ordersCopy.editor.invoiceNumber} helperText={ordersCopy.editor.invoiceNumberPaypalDescription} value={values.invoiceNumber} onChange={(e) => updateValue('invoiceNumber', e.target.value)} />}
          <Select
            label={ordersCopy.editor.paymentMethod}
            options={paymentMethodOptions}
            value={values.paymentMethod}
            onChange={(e) => updateValue('paymentMethod', e.target.value)}
            width="sm"
          />
        </div>
      </div>

      {isAmountLocked && (
        <div className="order-editor-page__right-section">
          <StatusMessage variant="empty">
            {ordersCopy.editor.amountLocked}
          </StatusMessage>
        </div>
      )}
    </div>
  );

  /** Left column: counterparty, line items, memos */
  const leftColumn = (
    <>
      {/* Counterparty section (create mode only) */}
      {!isEditMode && (
        <Card>
          <div className="order-editor-page__form">
            <Combobox
              items={[...customers]}
              getKey={(c) => c.customerId}
              getLabel={(c) => c.customerName}
              onSelect={(customer) => handleCustomerChange(customer?.customerId ?? '')}
              value={values.customerId}
              label={ordersCopy.editor.selectCustomer}
              placeholder={ordersCopy.editor.customerPlaceholder}
              noResultsText={ordersCopy.editor.customerNoResults}
              width="md"
              required
            />

            {values.customerId && (
              pendingCustomerId ? (
                <Skeleton variant="list" rows={2} label={ordersCopy.loading} />
              ) : (
                <>
                  <Select
                    label={ordersCopy.editor.shippingDestination}
                    options={[
                      { value: '', label: ordersCopy.editor.shippingDestinationPlaceholder },
                      ...shippingOptions,
                    ]}
                    value={values.shippingDestinationId}
                    onChange={(e) => updateValue('shippingDestinationId', e.target.value)}
                    width="md"
                    required
                  />

                  <Select
                    label={ordersCopy.editor.paymentDestination}
                    options={[
                      { value: '', label: ordersCopy.editor.paymentDestinationPlaceholder },
                      ...paymentOptions,
                    ]}
                    value={values.paymentDestinationId}
                    onChange={(e) => updateValue('paymentDestinationId', e.target.value)}
                    width="md"
                    required
                  />
                </>
              )
            )}
          </div>
        </Card>
      )}

      {/* Line items section */}
      {!isAmountLocked && (
        <Card>
          <div className="order-editor-page__lines-header">
            <h2 className="order-editor-page__section-title">{ordersCopy.editor.lines}</h2>
            <Button variant="outline" size="sm" onClick={addLine}>
              {ordersCopy.editor.addLine}
            </Button>
          </div>
          <LineItemEditor
            products={inventoryProducts}
            lines={values.lines}
            conditionsMap={conditionsMap}
            onProductSelect={handleProductSelect}
            onConditionSelect={handleConditionSelect}
            onQuantityChange={handleQuantityChange}
            onUnitPriceChange={handleUnitPriceChange}
            onRemove={removeLine}
            labels={lineItemLabels}
          />
        </Card>
      )}

      {/* Memo / notes section */}
      <Card>
        <div className="order-editor-page__form">
          {isEditMode && (
            <>
              <TextField
                label={ordersCopy.editor.paymentConfirmedAt}
                value={values.paymentConfirmedAt}
                onChange={(e) => updateValue('paymentConfirmedAt', e.target.value)}
                width="sm"
                placeholder="YYYY-MM-DD"
              />

              <TextField
                label={ordersCopy.editor.shippedAt}
                value={values.shippedAt}
                onChange={(e) => updateValue('shippedAt', e.target.value)}
                width="sm"
                placeholder="YYYY-MM-DD"
              />

              <TextField
                label={ordersCopy.editor.trackingNumber}
                value={values.trackingNumber}
                onChange={(e) => updateValue('trackingNumber', e.target.value)}
                width="md"
              />

              <TextField
                label={ordersCopy.editor.shippingMethod}
                value={values.shippingMethod}
                onChange={(e) => updateValue('shippingMethod', e.target.value)}
                width="md"
              />

            </>
          )}

          <Textarea
            label={ordersCopy.editor.shippingNote}
            helperText={ordersCopy.editor.shippingNoteDescription}
            value={values.shippingNote}
            onChange={(e) => updateValue('shippingNote', e.target.value)}
            rows={3}
            fullWidth
          />

          <Textarea
            label={ordersCopy.editor.internalNote}
            helperText={ordersCopy.editor.internalNoteDescription}
            value={values.internalNote}
            onChange={(e) => updateValue('internalNote', e.target.value)}
            rows={4}
            fullWidth
          />

          {isEditMode && (
            <>
              <TextField
                label={ordersCopy.editor.cancellationReason}
                value={values.cancellationReason}
                onChange={(e) => updateValue('cancellationReason', e.target.value)}
                width="md"
              />

              <Textarea
                label={ordersCopy.editor.cancellationNote}
                value={values.cancellationNote}
                onChange={(e) => updateValue('cancellationNote', e.target.value)}
                rows={3}
                fullWidth
              />
            </>
          )}
        </div>
      </Card>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow={ordersCopy.eyebrow}
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          <div className="order-editor-page__actions">
            <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)} disabled={saving}>
              {ordersCopy.editor.backToList}
            </Button>
            {!isAmountLocked && <Button variant="outline" onClick={() => void handleSave(true)} loading={saving} loadingText={savingLabel} disabled={saving}>{ordersCopy.editor.saveDraft}</Button>}
            <Button onClick={() => void handleSave(false)} loading={saving} loadingText={savingLabel} disabled={saving}>{ordersCopy.editor.issueInvoice}</Button>
          </div>
        }
      />

      {saveError && (
        <StatusMessage variant="error">
          {isEditMode ? ordersCopy.editor.updateErrorPrefix : ordersCopy.editor.saveErrorPrefix} {saveError}
        </StatusMessage>
      )}

      {isLoading ? (
        <Card>
          <Skeleton variant="list" rows={6} label={ordersCopy.loading} />
        </Card>
      ) : (
        <TwoColumnLayout left={leftColumn} right={rightColumn} />
      )}

      {showPrint && issuer && printData && createPortal(
        <div className="doc-print-root">
          <InvoiceDocument
            issuer={buildIssuerInfo(issuer)}
            invoiceNumber={printData.invoiceNumber}
            date={printData.date}
            dueDate={printData.dueDate}
            registrationNumber={String(issuer[ISSUER_HEADER.REGISTRATION_NO] ?? '') || undefined}
            billedTo={{ name: printData.customerName, lines: [] }}
            shipTo={{ name: printData.shipToName, lines: printData.shipToLines }}
            lines={printData.lines}
            subtotal={printData.subtotal}
            shippingFee={printData.shippingFee}
            duty={printData.duty}
            otherFee={printData.otherFee}
            discount={printData.discount}
            total={printData.total}
            currency={printData.currency}
            paymentMethod={printData.paymentMethod}
            paymentTermsNote={String(issuer[ISSUER_HEADER.PAYMENT_NOTE] ?? '') || undefined}
            thanksMessage={String(issuer[ISSUER_HEADER.CLOSING_MESSAGE] ?? '') || undefined}
          />
        </div>,
        document.body
      )}
    </>
  );
}
