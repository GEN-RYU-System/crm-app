import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField,
} from '../../components/ui';
import { Combobox } from '../../components/ui';
import { ordersCopy } from '../../content/ja';
import type { CustomerRepository, CustomerSummaryDto } from '../../features/customers/contracts';
import type { OrderInventoryConditionOption, OrderInventoryProductOption, OrderCurrencyRecord, OrderRepository } from '../../features/orders/contracts';
import { emptyOrderEditorValues, ORDER_EDITOR_PATHS, ORDER_LINE_EMPTY, toOrderCreatePayload, type OrderEditorValues, type OrderLineEditorValues } from './orderEditorConfig';
import { ProductCombobox } from '../quotes/ProductCombobox';
import './OrderEditorPage.css';

type Props = {
  mode: 'create';
  canEdit: boolean;
  repository: OrderRepository;
  customerRepository: CustomerRepository;
};

type MasterState = 'loading' | 'ready' | 'error';
type SavingState = 'idle' | 'saving';

export function OrderEditorPage({ canEdit, repository, customerRepository }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState<OrderEditorValues>(emptyOrderEditorValues);
  const [masterState, setMasterState] = useState<MasterState>('loading');
  const [saveError, setSaveError] = useState('');
  const [savingState, setSavingState] = useState<SavingState>('idle');

  const [currencies, setCurrencies] = useState<OrderCurrencyRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerSummaryDto[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<OrderInventoryProductOption[]>([]);
  const [conditionsMap, setConditionsMap] = useState<Map<string, OrderInventoryConditionOption[]>>(new Map());
  const [inventoryError, setInventoryError] = useState('');
  const [shippingOptions, setShippingOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [paymentOptions, setPaymentOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([
      repository.listCurrencies(),
      customerRepository.listCustomers(),
    ])
      .then(([currencyData, customerData]) => {
        setCurrencies([...currencyData]);
        setCustomers([...customerData]);
        setMasterState('ready');
      })
      .catch(() => setMasterState('error'));
  }, [repository, customerRepository]);

  useEffect(() => {
    void repository
      .listInventoryProducts()
      .then((products) => setInventoryProducts([...products]))
      .catch(() => setInventoryError(ordersCopy.editor.inventoryLoadError));
  }, [repository]);

  const editable = canEdit;

  const updateValue = <K extends keyof Omit<OrderEditorValues, 'lines'>>(key: K, value: OrderEditorValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateLine = (index: number, key: keyof OrderLineEditorValues, value: string | number) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line),
    }));

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, { ...ORDER_LINE_EMPTY }] }));

  const removeLine = (index: number) =>
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const handleCustomerSelect = (customerId: string, customerName: string) => {
    setValues((prev) => ({
      ...prev,
      customerId,
      customerName,
      sourceLeadId: '',
      shippingDestinationId: '',
      paymentDestinationId: '',
    }));
    setShippingOptions([]);
    setPaymentOptions([]);

    if (!customerId) return;

    void customerRepository.getCustomer(customerId).then((aggregate) => {
      if (!aggregate) return;
      const sourceLeadId = aggregate.profile.sourceLeadId ?? '';

      const shipping = aggregate.shippingAddresses
        .filter((a) => a.isActive !== '0' && a.isActive !== 'FALSE' && a.isActive !== 'x')
        .map((a) => ({
          value: a.addressId,
          label: `${a.recipient} — ${a.country} ${a.address}`,
        }));
      const payment = aggregate.paymentProfiles
        .filter((p) => p.isActive !== '0' && p.isActive !== 'FALSE' && p.isActive !== 'x')
        .map((p) => ({
          value: p.paymentProfileId,
          label: `${p.billingName} (${p.method} / ${p.currency})`,
        }));

      const defaultShipping = aggregate.shippingAddresses.find(
        (a) => a.isDefault === '1' || a.isDefault === 'TRUE',
      );
      const defaultPayment = aggregate.paymentProfiles.find(
        (p) => p.isDefault === '1' || p.isDefault === 'TRUE',
      );

      setShippingOptions(shipping);
      setPaymentOptions(payment);
      setValues((prev) => ({
        ...prev,
        sourceLeadId,
        shippingDestinationId: defaultShipping?.addressId ?? '',
        paymentDestinationId: defaultPayment?.paymentProfileId ?? '',
      }));
    });
  };

  const handleProductSelect = (index: number, productId: string, productName: string) => {
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index
          ? { ...line, productId, productName, condition: '', unitPrice: '', unitWeight: 0 }
          : line,
      ),
    }));

    if (!productId) return;
    if (!conditionsMap.has(productId)) {
      void repository.getInventoryConditions(productId)
        .then((conditions) => {
          setConditionsMap((prev) => new Map(prev).set(productId, [...conditions]));
        })
        .catch(() => {
          setConditionsMap((prev) => new Map(prev).set(productId, []));
          setInventoryError(ordersCopy.editor.conditionsLoadError);
        });
    }
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
            : l,
        ),
      };
    });
  };

  const getConditionOptions = (line: OrderLineEditorValues) => {
    if (!line.productId) return [];
    const conditions = conditionsMap.get(line.productId) ?? [];
    return conditions.map((c) => ({
      value: c.condition,
      label: ordersCopy.editor.form.lineConditionOptionLabel(c.condition, c.quantity),
    }));
  };

  const calcAmount = (line: OrderLineEditorValues) => {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : null;
  };

  const calcWeight = (line: OrderLineEditorValues) => {
    const qty = Number(line.quantity);
    return Number.isFinite(qty) ? Math.round(line.unitWeight * qty) : 0;
  };

  const validate = (): boolean => {
    if (!values.customerId.trim()) {
      setSaveError(ordersCopy.editor.validation.customerRequired);
      return false;
    }
    if (!values.shippingDestinationId.trim()) {
      setSaveError(ordersCopy.editor.validation.shippingRequired);
      return false;
    }
    if (!values.paymentDestinationId.trim()) {
      setSaveError(ordersCopy.editor.validation.paymentRequired);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSavingState('saving');
    setSaveError('');
    try {
      await repository.createOrder(toOrderCreatePayload(values));
      navigate(ORDER_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : ordersCopy.editor.saveErrorPrefix);
    } finally {
      setSavingState('idle');
    }
  };

  if (masterState === 'error') {
    return (
      <StatusMessage variant="error">
        {ordersCopy.editor.masterLoadError}
        <Button variant="outline" onClick={() => navigate(ORDER_EDITOR_PATHS.list)}>
          {ordersCopy.editor.backToList}
        </Button>
      </StatusMessage>
    );
  }

  const isLoading = masterState === 'loading';
  const isSaving = savingState !== 'idle';

  const currencyOptions = currencies.length > 0
    ? currencies.map((c) => ({ value: c.currencyCode, label: `${c.currencyCode}(${c.name})` }))
    : [{ value: 'JPY', label: 'JPY' }];

  const paymentMethodOptions = [
    { value: 'Wise',   label: 'Wise' },
    { value: 'PayPal', label: 'PayPal' },
  ];

  const inventoryProductsForCombobox: OrderInventoryProductOption[] = inventoryProducts;

  return (
    <>
      <PageHeader
        eyebrow={ordersCopy.eyebrow}
        title={ordersCopy.editor.createTitle}
        subtitle={ordersCopy.editor.createSubtitle}
        action={
          <div className="order-editor-page__actions">
            <Button
              variant="outline"
              onClick={() => navigate(ORDER_EDITOR_PATHS.list)}
              disabled={isSaving}
            >
              {ordersCopy.editor.backToList}
            </Button>
            {editable && (
              <Button
                onClick={() => void handleSave()}
                loading={isSaving}
                loadingText={ordersCopy.editor.saving}
              >
                {ordersCopy.editor.save}
              </Button>
            )}
          </div>
        }
      />

      {saveError && (
        <StatusMessage variant="error">
          {ordersCopy.editor.saveErrorPrefix} {saveError}
        </StatusMessage>
      )}
      {inventoryError && (
        <StatusMessage variant="error">{inventoryError}</StatusMessage>
      )}

      {isLoading ? (
        <Card>
          <Skeleton variant="list" rows={6} label={ordersCopy.loading} />
        </Card>
      ) : (
        <>
          <Card>
            <div className="order-editor-page__form">
              <Combobox
                items={customers}
                getKey={(c) => c.customerId}
                getLabel={(c) => c.customerName}
                onSelect={(c) =>
                  c
                    ? handleCustomerSelect(c.customerId, c.customerName)
                    : handleCustomerSelect('', '')
                }
                value={values.customerId}
                fallbackDisplayText={values.customerName}
                label={ordersCopy.editor.form.customer}
                placeholder={ordersCopy.editor.form.customerPlaceholder}
                noResultsText={ordersCopy.editor.form.customerNoResults}
                width="md"
                required
                disabled={!editable}
              />

              <Select
                label={ordersCopy.editor.form.shippingDestination}
                options={shippingOptions}
                value={values.shippingDestinationId}
                onChange={(e) => updateValue('shippingDestinationId', e.target.value)}
                placeholder={ordersCopy.editor.form.shippingDestinationPlaceholder}
                width="md"
                disabled={!editable || shippingOptions.length === 0}
              />

              <Select
                label={ordersCopy.editor.form.paymentDestination}
                options={paymentOptions}
                value={values.paymentDestinationId}
                onChange={(e) => updateValue('paymentDestinationId', e.target.value)}
                placeholder={ordersCopy.editor.form.paymentDestinationPlaceholder}
                width="md"
                disabled={!editable || paymentOptions.length === 0}
              />

              <Select
                label={ordersCopy.editor.form.currency}
                options={currencyOptions}
                value={values.currency}
                onChange={(e) => updateValue('currency', e.target.value)}
                width="sm"
                disabled={!editable}
              />

              <TextField
                label={ordersCopy.editor.form.shippingFee}
                value={values.shippingFee}
                onChange={(e) => updateValue('shippingFee', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={ordersCopy.editor.form.duty}
                value={values.duty}
                onChange={(e) => updateValue('duty', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={ordersCopy.editor.form.otherFee}
                value={values.otherFee}
                onChange={(e) => updateValue('otherFee', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={ordersCopy.editor.form.discount}
                value={values.discount}
                onChange={(e) => updateValue('discount', e.target.value)}
                width="sm"
                disabled={!editable}
              />

              <Select
                label={ordersCopy.editor.form.paymentMethod}
                options={paymentMethodOptions}
                value={values.paymentMethod}
                onChange={(e) => updateValue('paymentMethod', e.target.value)}
                placeholder={ordersCopy.editor.form.paymentMethodPlaceholder}
                width="sm"
                disabled={!editable}
              />

              <TextField
                label={ordersCopy.editor.form.paymentTerms}
                value={values.paymentTerms}
                onChange={(e) => updateValue('paymentTerms', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={ordersCopy.editor.form.paymentDueAt}
                value={values.paymentDueAt}
                onChange={(e) => updateValue('paymentDueAt', e.target.value)}
                width="sm"
                disabled={!editable}
              />

              <Textarea
                label={ordersCopy.editor.form.note}
                value={values.note}
                onChange={(e) => updateValue('note', e.target.value)}
                disabled={!editable}
              />
            </div>
          </Card>

          <Card>
            <div className="order-editor-page__lines-header">
              <h2 className="order-editor-page__section-title">
                {ordersCopy.editor.form.lines}
              </h2>
              {editable && (
                <Button variant="outline" size="sm" onClick={addLine}>
                  {ordersCopy.editor.form.addLine}
                </Button>
              )}
            </div>
            <div className="order-editor-page__lines">
              {values.lines.map((line, index) => {
                const conditionOpts = getConditionOptions(line);
                const amount = calcAmount(line);
                const weight = calcWeight(line);
                return (
                  <div key={index} className="order-editor-page__line-row">
                    <span className="order-editor-page__line-no">{index + 1}</span>
                    <ProductCombobox
                      className="order-editor-page__line-product"
                      products={inventoryProductsForCombobox}
                      value={line.productId}
                      fallbackDisplayText={line.productName}
                      onChange={(pid, pname) => handleProductSelect(index, pid, pname)}
                      label={ordersCopy.editor.form.lineProduct}
                      placeholder={ordersCopy.editor.form.lineProductPlaceholder}
                      noResultsText={ordersCopy.editor.form.lineProductNoResults}
                      disabled={!editable}
                    />
                    <Select
                      className="order-editor-page__line-condition"
                      label={ordersCopy.editor.form.lineCondition}
                      options={conditionOpts}
                      value={line.condition}
                      onChange={(e) => handleConditionSelect(index, e.target.value)}
                      disabled={!editable || !line.productId}
                      placeholder={ordersCopy.editor.form.lineConditionPlaceholder}
                    />
                    <TextField
                      className="order-editor-page__line-qty"
                      label={ordersCopy.editor.form.lineQuantity}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      disabled={!editable || !line.condition}
                    />
                    <TextField
                      className="order-editor-page__line-price"
                      label={ordersCopy.editor.form.lineUnitPrice}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                      disabled={!editable}
                    />
                    <div className="order-editor-page__line-calc">
                      <span className="order-editor-page__line-calc-label">
                        {ordersCopy.editor.form.lineAmount}
                      </span>
                      <span className="order-editor-page__line-calc-value">
                        {amount != null ? amount.toLocaleString() : '-'}
                      </span>
                    </div>
                    <div className="order-editor-page__line-calc">
                      <span className="order-editor-page__line-calc-label">
                        {ordersCopy.editor.form.lineWeight}
                      </span>
                      <span className="order-editor-page__line-calc-value">
                        {weight > 0 ? `${weight}g` : '-'}
                      </span>
                    </div>
                    {editable && (
                      <Button
                        className="order-editor-page__line-delete"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLine(index)}
                      >
                        {ordersCopy.editor.form.removeLine}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
