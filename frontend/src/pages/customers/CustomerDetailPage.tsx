import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, DataTable, EmptyState, PageHeader, Select, Skeleton, Spinner, StatusMessage, Tabs, TextField, Textarea, type DataTableColumn } from '../../components/ui';
import type { CustomerRepository, PaymentProfileDto, ShippingAddressDto } from '../../features/customers/contracts';
import { customersCopy } from '../../content/ja';
import { CUSTOMER_DETAIL_TABS, CUSTOMER_PAYMENT_COLUMNS, CUSTOMER_PROFILE_FIELDS, CUSTOMER_SHIPPING_COLUMNS, customerListPath, displayCustomerProfileValue, displayPaymentValue, displayShippingValue, resolveAssigneeName, type CustomerDetailTab } from './customerConfig';
import { useCustomerDetailCache } from './CustomerDetailCacheContext';
import { useStaffListCache } from '../staff/StaffListCacheContext';
import { getCoreCustomerTaxNumbers, getCoreTaxNumberTypes, upsertCoreCustomerTaxNumber, type CustomerTaxNumberRecord, type TaxNumberTypeRecord } from '../../features/customers/taxNumbersAdapter';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

type TaxNumberForm = { typeId: string; number: string; isActive: boolean };
const EMPTY_TAX_FORM: TaxNumberForm = { typeId: '', number: '', isActive: true };

export function CustomerDetailPage({ repository }: { repository: CustomerRepository }) {
  const navigate = useNavigate();
  const { customerId = '' } = useParams();
  const [tab, setTab] = useState<CustomerDetailTab>('basic');
  const { recordsByCustomerId, errorsByCustomerId, ensureLoaded, retry } = useCustomerDetailCache();
  const { items: staffList } = useStaffListCache();
  const staffMap = useMemo<ReadonlyMap<string, string>>(
    () => new Map((staffList ?? []).map((s) => [s.staffId, s.fullNameJa])),
    [staffList],
  );
  const cachedRecords = recordsByCustomerId[customerId];
  const error = errorsByCustomerId[customerId];
  const customer = cachedRecords?.[0] ?? null;
  const state: LoadState = error !== undefined ? 'error' : cachedRecords === undefined ? 'loading' : customer === null ? 'missing' : 'ready';

  useEffect(() => {
    if (cachedRecords === undefined && error === undefined) void ensureLoaded(customerId);
  }, [cachedRecords, customerId, ensureLoaded, error]);

  const shippingColumns: readonly DataTableColumn<ShippingAddressDto>[] = useMemo(() => CUSTOMER_SHIPPING_COLUMNS.map((column) => ({ key: column.key, header: column.label, renderCell: (row) => displayShippingValue(row, column.key), cellAlignment: column.cellAlignment })), []);
  const paymentColumns: readonly DataTableColumn<PaymentProfileDto>[] = useMemo(() => CUSTOMER_PAYMENT_COLUMNS.map((column) => ({ key: column.key, header: column.label, renderCell: (row) => displayPaymentValue(row, column.key), cellAlignment: column.cellAlignment })), []);

  // ─── Tax Numbers state ──────────────────────────────────────────────────────

  const [taxNumbers,      setTaxNumbers]      = useState<CustomerTaxNumberRecord[]>([]);
  const [taxTypes,        setTaxTypes]        = useState<TaxNumberTypeRecord[]>([]);
  const [taxLoading,      setTaxLoading]      = useState(false);
  const [taxLoadError,    setTaxLoadError]    = useState<string | undefined>();
  const [editingTaxId,    setEditingTaxId]    = useState<string | 'new' | null>(null);
  const [taxForm,         setTaxForm]         = useState<TaxNumberForm>(EMPTY_TAX_FORM);
  const [taxSaving,       setTaxSaving]       = useState(false);
  const [taxSaveError,    setTaxSaveError]    = useState<string | undefined>();

  const loadTaxNumbers = useCallback(async () => {
    if (!customerId) return;
    setTaxLoading(true);
    setTaxLoadError(undefined);
    try {
      const [nums, types] = await Promise.all([
        getCoreCustomerTaxNumbers(customerId),
        getCoreTaxNumberTypes(),
      ]);
      setTaxNumbers(nums);
      setTaxTypes(types);
    } catch (err) {
      setTaxLoadError(err instanceof Error ? err.message : customersCopy.taxNumbersLoadError);
    } finally {
      setTaxLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (tab === 'taxNumbers') void loadTaxNumbers();
  }, [tab, loadTaxNumbers]);

  // Close form when tab changes
  useEffect(() => {
    setEditingTaxId(null);
    setTaxSaveError(undefined);
  }, [tab]);

  const openNewTaxForm = () => {
    setEditingTaxId('new');
    setTaxForm(EMPTY_TAX_FORM);
    setTaxSaveError(undefined);
  };

  const openEditTaxForm = (row: CustomerTaxNumberRecord) => {
    setEditingTaxId(row.taxNumberId);
    setTaxForm({ typeId: row.typeId, number: row.number, isActive: row.isActive === 'TRUE' });
    setTaxSaveError(undefined);
  };

  const closeTaxForm = () => {
    setEditingTaxId(null);
    setTaxSaveError(undefined);
  };

  const handleSaveTaxNumber = async () => {
    setTaxSaving(true);
    setTaxSaveError(undefined);
    try {
      const payload = {
        ...(editingTaxId !== 'new' && editingTaxId !== null ? { taxNumberId: editingTaxId } : {}),
        customerId,
        typeId:   taxForm.typeId,
        number:   taxForm.number,
        isActive: taxForm.isActive ? 'TRUE' : '',
      };
      await upsertCoreCustomerTaxNumber(payload);
      closeTaxForm();
      await loadTaxNumbers();
    } catch (err) {
      setTaxSaveError(err instanceof Error ? err.message : customersCopy.taxNumbersSaveError);
    } finally {
      setTaxSaving(false);
    }
  };

  // Derive available type options for the dropdown:
  // registered typeIds (excluding the one being edited) are excluded.
  const registeredTypeIds = useMemo(() => {
    const editingSelf = editingTaxId !== 'new' && editingTaxId !== null ? editingTaxId : null;
    return new Set(
      taxNumbers
        .filter((n) => n.taxNumberId !== editingSelf)
        .map((n) => n.typeId),
    );
  }, [taxNumbers, editingTaxId]);

  const availableTypeOptions = useMemo(() => {
    const editingSelf = editingTaxId !== 'new' && editingTaxId !== null ? editingTaxId : null;
    const selfTypeId  = editingSelf ? (taxNumbers.find((n) => n.taxNumberId === editingSelf)?.typeId ?? null) : null;
    return taxTypes
      .filter((t) => t.isActive === 'TRUE' && (!registeredTypeIds.has(t.typeId) || t.typeId === selfTypeId))
      .map((t) => ({ value: t.typeId, label: customersCopy.taxNumbersTypeLabel(t.nameJa, t.targetCountry) }));
  }, [taxTypes, registeredTypeIds, taxNumbers, editingTaxId]);

  const taxNumberColumns: DataTableColumn<CustomerTaxNumberRecord>[] = useMemo(() => [
    {
      key: 'typeId',
      header: customersCopy.taxNumbersColType,
      renderCell: (row) => (
        <span
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer', opacity: row.isActive !== 'TRUE' ? 0.4 : 1 }}
          onClick={() => openEditTaxForm(row)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditTaxForm(row); }}
        >
          {row.typeNameJa}
        </span>
      ),
    },
    {
      key: 'number',
      header: customersCopy.taxNumbersColNumber,
      renderCell: (row) => (
        <span style={{ opacity: row.isActive !== 'TRUE' ? 0.4 : 1 }}>{row.number}</span>
      ),
    },
    {
      key: 'isActive',
      header: customersCopy.taxNumbersColActive,
      renderCell: (row) => (
        <span style={{ opacity: row.isActive !== 'TRUE' ? 0.4 : 1 }}>
          {row.isActive === 'TRUE' ? '✓' : '—'}
        </span>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [taxNumbers]);

  const taxInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <Select
          label={customersCopy.taxNumbersFormTypeLabel}
          value={taxForm.typeId}
          onChange={(e) => setTaxForm((p) => ({ ...p, typeId: e.target.value }))}
          options={[{ value: '', label: customersCopy.taxNumbersFormTypePlaceholder }, ...availableTypeOptions]}
          fullWidth
        />
        <TextField
          label={customersCopy.taxNumbersFormNumberLabel}
          value={taxForm.number}
          onChange={(e) => setTaxForm((p) => ({ ...p, number: e.target.value }))}
          fullWidth
        />
        <Select
          label={customersCopy.taxNumbersFormActiveLabel}
          value={taxForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setTaxForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[
            { value: 'TRUE', label: customersCopy.taxNumbersFormActivePlaceholder },
            { value: '',     label: customersCopy.taxNumbersFormInactivePlaceholder },
          ]}
          fullWidth
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        {taxSaveError !== undefined && <StatusMessage variant="error">{taxSaveError}</StatusMessage>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant="primary"
            onClick={() => void handleSaveTaxNumber()}
            loading={taxSaving}
            loadingText={customersCopy.taxNumbersSaving}
            disabled={!taxForm.typeId || !taxForm.number.trim()}
          >
            {customersCopy.taxNumbersSave}
          </Button>
          <Button variant="ghost" onClick={closeTaxForm}>{customersCopy.taxNumbersCancel}</Button>
        </div>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  const header = <PageHeader eyebrow={customersCopy.eyebrow} title={customersCopy.detailTitle} subtitle={customersCopy.detailSubtitle} action={<Button variant="outline" onClick={() => navigate(customerListPath())}>{customersCopy.backToList}</Button>} />;
  if (state === 'loading') return <>{header}<Card><Skeleton variant="list" rows={6} label={customersCopy.detailLoading} /></Card></>;
  if (state === 'missing') return <>{header}<EmptyState title={customersCopy.detailNotFoundTitle} description={customersCopy.detailNotFoundDescription} action={<Button onClick={() => navigate(customerListPath())}>{customersCopy.backToList}</Button>} /></>;
  if (state === 'error') return <>{header}<StatusMessage variant="error">{customersCopy.detailLoadErrorPrefix} {error}<Button variant="outline" onClick={() => void retry(customerId)}>{customersCopy.retry}</Button></StatusMessage></>;
  const profile = customer!.profile;
  const resolveProfileFieldValue = (key: (typeof CUSTOMER_PROFILE_FIELDS)[number]['key']): string => {
    if (key === 'salesAssigneeName') {
      return resolveAssigneeName(profile.salesAssigneeId, staffMap);
    }
    return displayCustomerProfileValue(profile, key);
  };

  return (
    <>
      {header}
      <Tabs aria-label={customersCopy.tabsLabel} items={CUSTOMER_DETAIL_TABS} activeKey={tab} onChange={setTab} variant="underline" size="md" />

      {tab === 'basic' && (
        <Card>
          {CUSTOMER_PROFILE_FIELDS.map((field) =>
            field.key === 'shippingNote'
              ? <Textarea key={field.key} label={field.label} value={resolveProfileFieldValue(field.key)} readOnly />
              : <TextField key={field.key} label={field.label} value={resolveProfileFieldValue(field.key)} readOnly />
          )}
        </Card>
      )}

      {tab === 'shipping' && (
        <Card>
          {customer!.shippingAddresses.length === 0
            ? <EmptyState title={customersCopy.shippingEmptyTitle} description={customersCopy.shippingEmptyDescription} />
            : <DataTable ariaLabel={customersCopy.shippingTableLabel} columns={shippingColumns} rows={customer!.shippingAddresses} rowKey={(row) => row.addressId} />
          }
        </Card>
      )}

      {tab === 'payment' && (
        <Card>
          {customer!.paymentProfiles.length === 0
            ? <EmptyState title={customersCopy.paymentEmptyTitle} description={customersCopy.paymentEmptyDescription} />
            : <DataTable ariaLabel={customersCopy.paymentTableLabel} columns={paymentColumns} rows={customer!.paymentProfiles} rowKey={(row) => row.paymentProfileId} />
          }
        </Card>
      )}

      {tab === 'taxNumbers' && (
        <Card>
          {taxLoading && (
            <StatusMessage variant="loading">
              <Spinner size="sm" aria-label={customersCopy.taxNumbersLoading} />
              {customersCopy.taxNumbersLoading}
            </StatusMessage>
          )}
          {!taxLoading && taxLoadError !== undefined && (
            <StatusMessage variant="error">{taxLoadError}</StatusMessage>
          )}
          {!taxLoading && taxLoadError === undefined && (
            <>
              {taxNumbers.length === 0 && editingTaxId === null
                ? <EmptyState title={customersCopy.taxNumbersEmpty} description="" />
                : (
                  <DataTable
                    ariaLabel={customersCopy.taxNumbersTableLabel}
                    columns={taxNumberColumns}
                    rows={taxNumbers}
                    rowKey={(row) => row.taxNumberId}
                  />
                )
              }
              {editingTaxId !== null && taxInlineForm}
              {editingTaxId === null && (
                <div style={{ marginTop: '0.75rem' }}>
                  <Button variant="outline" onClick={openNewTaxForm}>{customersCopy.taxNumbersAdd}</Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </>
  );
}
