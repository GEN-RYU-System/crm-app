import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader, Select, Skeleton, StatusMessage, TextField } from '../../components/ui';
import { ordersCopy } from '../../content/ja/orders';
import type { CustomerAggregateDto } from '../../features/customers/contracts';
import type { CustomerRepository } from '../../features/customers/contracts';
import type { InventoryProductOption, OrderCreatePayload, OrderRepository } from '../../features/orders/contracts';
import {
  calcInvoiceTotal,
  calcLineSubtotal,
  emptyOrderEditorValues,
  emptyOrderLine,
  ORDER_EDITOR_PATHS,
  PAYMENT_METHODS,
  toHalfwidthDigits,
  type OrderEditorValues,
  type OrderLineEditorValues,
} from './orderEditorConfig';
import { OrderProductCombobox } from './OrderProductCombobox';
import './OrderEditorPage.css';

type Props = {
  mode: 'create';
  repository: OrderRepository;
  customerRepository: CustomerRepository;
};

type MasterState = 'loading' | 'ready' | 'error';

export function OrderEditorPage({ mode, repository, customerRepository }: Props) {
  const navigate = useNavigate();

  const [values, setValues] = useState<OrderEditorValues>(emptyOrderEditorValues());
  const [masterState, setMasterState] = useState<MasterState>('loading');
  const [masterError, setMasterError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<readonly { customerId: string; customerName: string }[]>([]);
  const [customerAggregate, setCustomerAggregate] = useState<CustomerAggregateDto | null>(null);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(['USD', 'JPY', 'EUR', 'GBP']);

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([
      customerRepository.listCustomers(),
      repository.listInventoryProducts(),
      repository.listCurrencySymbols(),
    ])
      .then(([customerList, products, symbolMap]) => {
        setCustomers(customerList.map((c) => ({ customerId: c.customerId, customerName: c.customerName })));
        setInventoryProducts([...products]);
        const codes = Object.keys(symbolMap);
        if (codes.length > 0) setCurrencies(codes);
        setMasterState('ready');
      })
      .catch((cause) => {
        setMasterError(cause instanceof Error ? cause.message : ordersCopy.editor.masterLoadError);
        setMasterState('error');
      });
  }, [repository, customerRepository]);

  const handleCustomerChange = (customerId: string) => {
    setValues((prev) => ({
      ...prev,
      customerId,
      shippingDestinationId: '',
      paymentDestinationId: '',
    }));
    setCustomerAggregate(null);
    if (!customerId) return;
    void customerRepository.getCustomer(customerId).then((agg) => {
      setCustomerAggregate(agg);
      if (!agg) return;
      const defaultShipping = agg.shippingAddresses.find((a) => a.isDefault === '1' || a.isDefault === 'TRUE') ?? agg.shippingAddresses[0];
      const defaultPayment = agg.paymentProfiles.find((p) => p.isDefault === '1' || p.isDefault === 'TRUE') ?? agg.paymentProfiles[0];
      setValues((prev) => ({
        ...prev,
        customerId,
        shippingDestinationId: defaultShipping?.addressId ?? '',
        paymentDestinationId: defaultPayment?.paymentProfileId ?? '',
      }));
    }).catch(() => {/* aggregate load failure is non-fatal */});
  };

  const updateValue = <K extends keyof Omit<OrderEditorValues, 'lines'>>(key: K, value: OrderEditorValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateLine = (index: number, key: keyof OrderLineEditorValues, value: string) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line),
    }));

  const handleProductSelect = (index: number, product: InventoryProductOption | null) => {
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index
          ? {
              ...line,
              productId: product?.productId ?? '',
              productName: product?.productName ?? '',
              category: product?.category ?? '',
              unitPrice: product?.unitPrice ?? '',
            }
          : line
      ),
    }));
  };

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, emptyOrderLine()] }));

  const removeLine = (index: number) =>
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const validate = (): boolean => {
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

  const handleSave = async () => {
    setSaveError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: OrderCreatePayload = {
        customerId: values.customerId,
        shippingDestinationId: values.shippingDestinationId,
        paymentDestinationId: values.paymentDestinationId,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
        paymentDueAt: values.paymentDueAt,
        orderDate: values.orderDate,
        shippingFee: values.shippingFee,
        duty: values.duty,
        otherFee: values.otherFee,
        discount: values.discount,
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
      navigate(ORDER_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(
        (cause instanceof Error ? cause.message : '') || ordersCopy.editor.saveErrorFallback
      );
    } finally {
      setSaving(false);
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
    label: [a.recipient, a.country, a.address].filter(Boolean).join(' / '),
  })) ?? [];

  const paymentOptions = customerAggregate?.paymentProfiles.map((p) => ({
    value: p.paymentProfileId,
    label: [p.billingName, p.method, p.currency].filter(Boolean).join(' / '),
  })) ?? [];

  const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

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

  return (
    <>
      <PageHeader
        eyebrow={ordersCopy.eyebrow}
        title={ordersCopy.editor.createTitle}
        subtitle={ordersCopy.editor.createSubtitle}
        action={
          <div className="order-editor-page__actions">
            <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)} disabled={saving}>
              {ordersCopy.editor.backToList}
            </Button>
            <Button onClick={() => void handleSave()} loading={saving} loadingText={ordersCopy.editor.saving} disabled={saving}>
              {ordersCopy.editor.saveOrder}
            </Button>
          </div>
        }
      />

      {saveError && (
        <StatusMessage variant="error">
          {ordersCopy.editor.saveErrorPrefix} {saveError}
        </StatusMessage>
      )}

      {isLoading ? (
        <Card>
          <Skeleton variant="list" rows={6} label={ordersCopy.loading} />
        </Card>
      ) : (
        <>
          <Card>
            <div className="order-editor-page__form">
              <Select
                label={ordersCopy.editor.selectCustomer}
                options={[
                  { value: '', label: ordersCopy.editor.customerPlaceholder },
                  ...customers.map((c) => ({ value: c.customerId, label: c.customerName })),
                ]}
                value={values.customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                width="md"
                required
              />

              {values.customerId && (
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
              )}

              <Select
                label={ordersCopy.editor.currency}
                options={currencyOptions}
                value={values.currency}
                onChange={(e) => updateValue('currency', e.target.value)}
                width="sm"
              />

              <Select
                label={ordersCopy.editor.paymentMethod}
                options={paymentMethodOptions}
                value={values.paymentMethod}
                onChange={(e) => updateValue('paymentMethod', e.target.value)}
                width="sm"
              />

              <TextField
                label={ordersCopy.editor.paymentDueAt}
                type="date"
                value={values.paymentDueAt}
                onChange={(e) => updateValue('paymentDueAt', e.target.value)}
                width="sm"
                required
              />

              <TextField
                label={ordersCopy.editor.orderDate}
                type="date"
                value={values.orderDate}
                onChange={(e) => updateValue('orderDate', e.target.value)}
                width="sm"
                required
              />
            </div>
          </Card>

          <Card>
            <div className="order-editor-page__lines-header">
              <h2 className="order-editor-page__section-title">{ordersCopy.editor.lines}</h2>
              <Button variant="outline" size="sm" onClick={addLine}>
                {ordersCopy.editor.addLine}
              </Button>
            </div>

            <div className="order-editor-page__lines">
              {values.lines.map((line, index) => {
                const subtotal = calcLineSubtotal(line);
                return (
                  <div key={index} className="order-editor-page__line-row">
                    <span className="order-editor-page__line-no">{index + 1}</span>

                    <OrderProductCombobox
                      className="order-editor-page__line-product"
                      products={inventoryProducts}
                      value={line.productId}
                      onChange={(product) => handleProductSelect(index, product)}
                      label={ordersCopy.editor.lineProduct}
                      placeholder={ordersCopy.editor.lineProductPlaceholder}
                      noResultsText={ordersCopy.editor.lineProductNoResults}
                    />

                    <TextField
                      className="order-editor-page__line-category"
                      label={ordersCopy.editor.category}
                      value={line.category}
                      onChange={(e) => updateLine(index, 'category', e.target.value)}
                    />

                    <TextField
                      className="order-editor-page__line-condition"
                      label={ordersCopy.editor.condition}
                      value={line.condition}
                      onChange={(e) => updateLine(index, 'condition', e.target.value)}
                      placeholder="Sealed box"
                    />

                    <TextField
                      className="order-editor-page__line-qty"
                      label={ordersCopy.editor.quantity}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    />

                    <TextField
                      className="order-editor-page__line-price"
                      label={ordersCopy.editor.unitPrice}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                    />

                    <div className="order-editor-page__line-calc">
                      <span className="order-editor-page__line-calc-label">{ordersCopy.editor.subtotal}</span>
                      <span className="order-editor-page__line-calc-value">
                        {subtotal != null ? subtotal.toLocaleString() : '—'}
                      </span>
                    </div>

                    <Button
                      className="order-editor-page__line-delete"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLine(index)}
                    >
                      {ordersCopy.editor.removeLine}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="order-editor-page__form">
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

              <div className="order-editor-page__invoice-total">
                <span className="order-editor-page__invoice-total-label">{ordersCopy.editor.invoiceTotal}</span>
                <span className="order-editor-page__invoice-total-value">
                  {invoiceTotal != null ? invoiceTotal.toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
