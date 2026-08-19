import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { quotesCopy } from '../../content/ja';
import { createCoreQuote, getCoreQuoteDetail, getCoreCurrencies, getLeadOptionsForFrontend, updateCoreQuote, type CurrencyRecord, type LeadOption } from '../../gas/client';
import { emptyLineValues, emptyQuoteEditorValues, isValidDiscount, QUOTE_EDITOR_PATHS, toHalfwidthDigits, toQuoteEditorValues, toQuotePayload, type QuoteEditorValues, type QuoteLineEditorValues } from './quoteEditorConfig';
import { LeadCombobox } from './LeadCombobox';
import './QuoteEditorPage.css';

type Props = { mode: 'create' | 'detail'; canEdit: boolean };
type DetailState = 'loading' | 'ready' | 'missing' | 'error';
type SavingState = 'idle' | 'draft' | 'issued';

export function QuoteEditorPage({ mode, canEdit }: Props) {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const [values, setValues] = useState<QuoteEditorValues>(emptyQuoteEditorValues);
  const [detailState, setDetailState] = useState<DetailState>(mode === 'create' ? 'ready' : 'loading');
  const [masterState, setMasterState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([getCoreCurrencies(), getLeadOptionsForFrontend()])
      .then(([currencyData, leadData]) => {
        setCurrencies([...currencyData]);
        setLeads([...leadData]);
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

  const updateDiscount = (raw: string) => {
    const half = toHalfwidthDigits(raw);
    updateValue('discount', half);
  };

  const updateLine = (index: number, key: keyof QuoteLineEditorValues, value: string) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line)
    }));

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, emptyLineValues()] }));

  const removeLine = (index: number) =>
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const validate = (): boolean => {
    if (!values.leadId.trim()) { setSaveError(quotesCopy.editor.validation.leadRequired); return false; }
    if (!isValidDiscount(values.discount)) { setSaveError(quotesCopy.editor.validation.discountInvalid); return false; }
    return true;
  };

  const save = async (statusKey: 'DRAFT' | 'ISSUED') => {
    if (!validate()) return;
    const targetQuoteId = quoteId;
    if (mode === 'detail' && !targetQuoteId) return;
    setSavingState(statusKey === 'DRAFT' ? 'draft' : 'issued');
    setSaveError('');
    try {
      const payload = toQuotePayload(values, statusKey);
      if (mode === 'create') await createCoreQuote(payload);
      else await updateCoreQuote(targetQuoteId!, payload);
      navigate(QUOTE_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : quotesCopy.editor.saveErrorPrefix);
    } finally {
      setSavingState('idle');
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
  const isSaving = savingState !== 'idle';

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
            <Button variant="outline" onClick={() => navigate(QUOTE_EDITOR_PATHS.list)} disabled={isSaving}>{quotesCopy.backToList}</Button>
            {editable && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void save('DRAFT')}
                  loading={savingState === 'draft'}
                  loadingText={quotesCopy.editor.savingDraft}
                  disabled={savingState === 'issued'}
                >
                  {quotesCopy.editor.saveDraft}
                </Button>
                <Button
                  onClick={() => void save('ISSUED')}
                  loading={savingState === 'issued'}
                  loadingText={quotesCopy.editor.issuing}
                  disabled={savingState === 'draft'}
                >
                  {quotesCopy.editor.issue}
                </Button>
              </>
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
        <Card><Skeleton variant="list" rows={6} label={quotesCopy.detailLoading} /></Card>
      ) : (
        <>
          <Card>
            <div className="quote-editor-page__form">
              <LeadCombobox
                leads={leads}
                value={values.leadId}
                onChange={(leadId) => updateValue('leadId', leadId)}
                label={quotesCopy.editor.form.leadId}
                placeholder={quotesCopy.editor.form.leadPlaceholder}
                noResultsText={quotesCopy.editor.form.leadNoResults}
                width="md"
                required
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
                onChange={(e) => updateDiscount(e.target.value)}
                placeholder={quotesCopy.editor.form.discountPlaceholder}
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
