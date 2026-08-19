import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CustomerSummaryDto } from '../../features/customers/contracts';
import type { StaffSummaryDto } from '../../features/staff/contracts';
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { leadsCopy, quotesCopy } from '../../content/ja';
import { createCoreQuote, getCoreCustomers, getCoreQuoteDetail, getCoreStaff, getCoreCurrencies, getLeadsByType, updateCoreQuote, type CurrencyRecord, type LeadRecord } from '../../gas/client';
import { emptyLineValues, emptyQuoteEditorValues, QUOTE_EDITOR_PATHS, toQuoteEditorValues, toQuotePayload, type QuoteEditorValues, type QuoteLineEditorValues } from './quoteEditorConfig';
import './QuoteEditorPage.css';

type Props = { mode: 'create' | 'detail'; canEdit: boolean };
type DetailState = 'loading' | 'ready' | 'missing' | 'error';
type MasterState = 'loading' | 'ready' | 'error';

const STATUS_OPTIONS = [
  { value: quotesCopy.editor.statusOptions.draft,   label: quotesCopy.editor.statusOptions.draft },
  { value: quotesCopy.editor.statusOptions.sent,    label: quotesCopy.editor.statusOptions.sent },
  { value: quotesCopy.editor.statusOptions.expired, label: quotesCopy.editor.statusOptions.expired },
];

export function QuoteEditorPage({ mode, canEdit }: Props) {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const [values, setValues] = useState<QuoteEditorValues>(emptyQuoteEditorValues);
  const [detailState, setDetailState] = useState<DetailState>(mode === 'create' ? 'ready' : 'loading');
  const [masterState, setMasterState] = useState<MasterState>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerSummaryDto[]>([]);
  const [staff, setStaff] = useState<StaffSummaryDto[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([getLeadsByType(), getCoreCustomers(), getCoreStaff(), getCoreCurrencies()])
      .then(([leadsData, customersData, staffData, currenciesData]) => {
        setLeads(leadsData);
        setCustomers([...customersData]);
        setStaff([...staffData]);
        setCurrencies([...currenciesData]);
        setMasterState('ready');
      })
      .catch(() => setMasterState('error'));
  }, []);

  useEffect(() => {
    if (mode !== 'detail' || !quoteId) return;
    setDetailState('loading');
    setLoadError('');
    void getCoreQuoteDetail(quoteId).then((record) => {
      if (!record) { setDetailState('missing'); return; }
      setValues(toQuoteEditorValues(record));
      setDetailState('ready');
    }).catch((cause) => {
      setLoadError(cause instanceof Error ? cause.message : quotesCopy.editor.loadError);
      setDetailState('error');
    });
  }, [quoteId, mode]);

  const editable = mode === 'create' || canEdit;

  const updateValue = (key: keyof Omit<QuoteEditorValues, 'lines'>, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateLine = (index: number, key: keyof QuoteLineEditorValues, value: string) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line)
    }));

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, emptyLineValues()] }));

  const removeLine = (index: number) =>
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const save = async () => {
    if (!values.leadId) { setSaveError(quotesCopy.editor.validation.leadRequired); return; }
    if (!values.staffId) { setSaveError(quotesCopy.editor.validation.staffRequired); return; }
    if (!values.issuedDate) { setSaveError(quotesCopy.editor.validation.issuedDateRequired); return; }
    const targetQuoteId = quoteId;
    if (mode === 'detail' && !targetQuoteId) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = toQuotePayload(values);
      if (mode === 'create') await createCoreQuote(payload);
      else await updateCoreQuote(targetQuoteId!, payload);
      navigate(QUOTE_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : quotesCopy.editor.saveErrorPrefix);
    } finally {
      setSaving(false);
    }
  };

  if (detailState === 'missing') return (
    <EmptyState
      title={quotesCopy.detailNotFoundTitle}
      description={quotesCopy.detailNotFoundDescription}
      action={<Button onClick={() => navigate(QUOTE_EDITOR_PATHS.list)}>{quotesCopy.backToList}</Button>}
    />
  );
  if (detailState === 'error') return (
    <StatusMessage variant="error">
      {quotesCopy.detailLoadErrorPrefix} {loadError}
      <Button variant="outline" onClick={() => navigate(QUOTE_EDITOR_PATHS.list)}>{quotesCopy.backToList}</Button>
    </StatusMessage>
  );
  if (masterState === 'error') return (
    <StatusMessage variant="error">
      {quotesCopy.editor.masterLoadError}
      <Button variant="outline" onClick={() => navigate(QUOTE_EDITOR_PATHS.list)}>{quotesCopy.backToList}</Button>
    </StatusMessage>
  );

  const isLoading = detailState === 'loading' || masterState === 'loading';

  const leadOptions = leads.map((lead) => {
    const id = String(lead[leadsCopy.fields.leadId] ?? '');
    const name = String(lead[leadsCopy.fields.customerName] ?? '');
    return { value: id, label: name ? `${name} (${id})` : id };
  });

  const customerOptions = customers.map((c) => ({ value: c.customerId, label: c.customerName }));

  const staffOptions = staff.map((s) => ({ value: s.staffId, label: s.fullNameJa }));

  const currencyOptions = currencies.length > 0
    ? currencies.map((c) => ({ value: c.currencyCode, label: `${c.currencyCode}（${c.name}）` }))
    : [{ value: 'JPY', label: 'JPY' }];

  return (
    <>
      <PageHeader
        eyebrow={quotesCopy.eyebrow}
        title={mode === 'create' ? quotesCopy.editor.createTitle : quotesCopy.editor.detailTitle}
        subtitle={mode === 'create' ? quotesCopy.editor.createSubtitle : quotesCopy.editor.detailSubtitle}
        action={
          <div className="quote-editor-page__actions">
            <Button variant="outline" onClick={() => navigate(QUOTE_EDITOR_PATHS.list)}>{quotesCopy.backToList}</Button>
            {editable && (
              <Button onClick={() => void save()} loading={saving} loadingText={quotesCopy.editor.saving}>
                {quotesCopy.editor.save}
              </Button>
            )}
          </div>
        }
      />
      {mode === 'detail' && !canEdit && (
        <StatusMessage variant="loading">{quotesCopy.editor.editingUnavailable}</StatusMessage>
      )}
      {saveError && (
        <StatusMessage variant="error">{quotesCopy.editor.saveErrorPrefix} {saveError}</StatusMessage>
      )}
      {isLoading ? (
        <Card><Skeleton variant="list" rows={8} label={quotesCopy.detailLoading} /></Card>
      ) : (
        <>
          <Card>
            <div className="quote-editor-page__form">
              <Select
                label={quotesCopy.editor.form.leadId}
                options={leadOptions}
                value={values.leadId}
                onChange={(e) => updateValue('leadId', e.target.value)}
                placeholder={quotesCopy.editor.form.selectLead}
                width="md"
                required
                disabled={!editable}
              />
              <Select
                label={quotesCopy.editor.form.customerId}
                options={customerOptions}
                value={values.customerId}
                onChange={(e) => updateValue('customerId', e.target.value)}
                placeholder={quotesCopy.editor.form.selectCustomer}
                width="md"
                disabled={!editable}
              />
              <Select
                label={quotesCopy.editor.form.staffId}
                options={staffOptions}
                value={values.staffId}
                onChange={(e) => updateValue('staffId', e.target.value)}
                placeholder={quotesCopy.editor.form.selectStaff}
                width="md"
                required
                disabled={!editable}
              />
              <TextField
                label={quotesCopy.editor.form.issuedDate}
                value={values.issuedDate}
                onChange={(e) => updateValue('issuedDate', e.target.value)}
                width="sm"
                required
                disabled={!editable}
              />
              <TextField
                label={quotesCopy.editor.form.expiryDate}
                value={values.expiryDate}
                onChange={(e) => updateValue('expiryDate', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <Select
                label={quotesCopy.editor.form.status}
                options={STATUS_OPTIONS}
                value={values.status}
                onChange={(e) => updateValue('status', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <Select
                label={quotesCopy.editor.form.currency}
                options={currencyOptions}
                value={values.currency}
                onChange={(e) => updateValue('currency', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={quotesCopy.editor.form.shippingFee}
                value={values.shippingFee}
                onChange={(e) => updateValue('shippingFee', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <TextField
                label={quotesCopy.editor.form.discount}
                value={values.discount}
                onChange={(e) => updateValue('discount', e.target.value)}
                width="sm"
                disabled={!editable}
              />
              <Textarea
                label={quotesCopy.editor.form.note}
                value={values.note}
                onChange={(e) => updateValue('note', e.target.value)}
                disabled={!editable}
              />
            </div>
          </Card>

          <Card>
            <div className="quote-editor-page__lines-header">
              <h2 className="quote-editor-page__section-title">{quotesCopy.editor.form.lines}</h2>
              {editable && (
                <Button variant="outline" size="sm" onClick={addLine}>
                  {quotesCopy.editor.form.addLine}
                </Button>
              )}
            </div>
            <div className="quote-editor-page__lines">
              {values.lines.map((line, index) => (
                <div key={index} className="quote-editor-page__line-row">
                  <span className="quote-editor-page__line-no">{index + 1}</span>
                  <div className="quote-editor-page__line-fields">
                    <TextField
                      label={quotesCopy.editor.form.lineProductName}
                      value={line.productName}
                      onChange={(e) => updateLine(index, 'productName', e.target.value)}
                      width="md"
                      disabled={!editable}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineDescription}
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      width="md"
                      disabled={!editable}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineQuantity}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      width="sm"
                      disabled={!editable}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineUnitPrice}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                      width="sm"
                      disabled={!editable}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineNote}
                      value={line.note}
                      onChange={(e) => updateLine(index, 'note', e.target.value)}
                      width="md"
                      disabled={!editable}
                    />
                  </div>
                  {editable && (
                    <Button variant="outline" size="sm" onClick={() => removeLine(index)}>
                      {quotesCopy.editor.form.removeLine}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
