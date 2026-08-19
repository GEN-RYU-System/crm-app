import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { quotesCopy } from '../../content/ja';
import { createCoreQuote, getCoreQuoteDetail, getCoreCurrencies, getInventoryConditions, getInventoryProductOptions, getLeadOptionsForFrontend, updateCoreQuote, type CurrencyRecord, type InventoryConditionOption, type InventoryProductOption, type LeadOption } from '../../gas/client';
import { emptyLineValues, emptyQuoteEditorValues, isValidDiscount, QUOTE_EDITOR_PATHS, toHalfwidthDigits, toQuoteEditorValues, toQuotePayload, type QuoteEditorValues, type QuoteLineEditorValues } from './quoteEditorConfig';
import { LeadCombobox } from './LeadCombobox';
import { ProductCombobox } from './ProductCombobox';
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
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([]);
  const [conditionsMap, setConditionsMap] = useState<Map<string, InventoryConditionOption[]>>(new Map());
  const [lineErrors, setLineErrors] = useState<Map<number, string>>(new Map());
  const [inventoryError, setInventoryError] = useState('');

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
    void getInventoryProductOptions()
      .then((products) => setInventoryProducts([...products]))
      .catch(() => setInventoryError(quotesCopy.editor.inventoryLoadError));
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

  useEffect(() => {
    if (mode !== 'detail' || detailState !== 'ready') return;
    const productIds = [...new Set(values.lines.map((l) => l.productId).filter(Boolean))];
    if (productIds.length === 0) return;
    productIds.forEach((productId) => {
      if (conditionsMap.has(productId)) return;
      void getInventoryConditions(productId)
        .then((conditions) => {
          setConditionsMap((prev) => new Map(prev).set(productId, [...conditions]));
          setValues((prev) => ({
            ...prev,
            lines: prev.lines.map((l) => {
              if (l.productId !== productId || !l.condition) return l;
              const found = conditions.find((c) => c.condition === l.condition);
              return found ? { ...l, unitWeight: found.unitWeight } : l;
            })
          }));
        })
        .catch(() => {
          setConditionsMap((prev) => new Map(prev).set(productId, []));
        });
    });
  }, [mode, detailState]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = mode === 'create' || canEdit;

  const updateValue = (key: keyof Omit<QuoteEditorValues, 'lines'>, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateDiscount = (raw: string) => {
    const half = toHalfwidthDigits(raw);
    updateValue('discount', half);
  };

  const updateLine = (index: number, key: keyof QuoteLineEditorValues, value: string | number) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line)
    }));

  const addLine = () =>
    setValues((prev) => ({ ...prev, lines: [...prev.lines, emptyLineValues()] }));

  const removeLine = (index: number) => {
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
    setLineErrors((prev) => {
      const m = new Map<number, string>();
      prev.forEach((v, k) => { if (k < index) m.set(k, v); else if (k > index) m.set(k - 1, v); });
      return m;
    });
  };

  const handleProductSelect = (index: number, productId: string, productName: string) => {
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index
          ? { ...line, productId, productName, condition: '', unitPrice: '', unitWeight: 0 }
          : line
      )
    }));
    setLineErrors((prev) => { const m = new Map(prev); m.delete(index); return m; });

    if (!productId) return;
    if (!conditionsMap.has(productId)) {
      void getInventoryConditions(productId).then((conditions) => {
        setConditionsMap((prev) => new Map(prev).set(productId, [...conditions]));
      }).catch(() => {
        setConditionsMap((prev) => new Map(prev).set(productId, []));
        setInventoryError(quotesCopy.editor.conditionsLoadError);
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
                unitWeight: found ? found.unitWeight : 0
              }
            : l
        )
      };
    });
    setLineErrors((prev) => { const m = new Map(prev); m.delete(index); return m; });
  };

  const handleQuantityChange = (index: number, raw: string) => {
    const half = toHalfwidthDigits(raw);
    const line = values.lines[index];
    if (line) {
      const conditions = conditionsMap.get(line.productId) ?? [];
      const found = conditions.find((c) => c.condition === line.condition);
      const qty = Number(half);
      if (found && Number.isFinite(qty) && qty > found.quantity) {
        setLineErrors((errs) => new Map(errs).set(index, quotesCopy.editor.validation.lineInventoryExceeded(found.quantity)));
      } else {
        setLineErrors((errs) => { const m = new Map(errs); m.delete(index); return m; });
      }
    }
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => i === index ? { ...l, quantity: half } : l)
    }));
  };

  const getConditionOptions = (line: QuoteLineEditorValues) => {
    if (!line.productId) return [];
    const conditions = conditionsMap.get(line.productId) ?? [];
    return conditions.map((c) => ({
      value: c.condition,
      label: quotesCopy.editor.form.lineConditionOptionLabel(c.condition, c.quantity)
    }));
  };

  const calcWeight = (line: QuoteLineEditorValues) => {
    const qty = Number(toHalfwidthDigits(line.quantity));
    return Number.isFinite(qty) ? Math.round(line.unitWeight * qty) : 0;
  };

  const calcAmount = (line: QuoteLineEditorValues) => {
    const qty = Number(toHalfwidthDigits(line.quantity));
    const price = Number(toHalfwidthDigits(line.unitPrice));
    return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : null;
  };

  const validate = (): boolean => {
    if (!values.leadId.trim()) { setSaveError(quotesCopy.editor.validation.leadRequired); return false; }
    if (!isValidDiscount(values.discount)) { setSaveError(quotesCopy.editor.validation.discountInvalid); return false; }
    if (lineErrors.size > 0) { setSaveError(quotesCopy.editor.validation.lineInventoryError); return false; }
    return true;
  };

  const save = async (statusKey: 'DRAFT' | 'ISSUED') => {
    if (!validate()) return;
    const targetQuoteId = quoteId;
    if (mode === 'detail' && !targetQuoteId) return;
    setSavingState(statusKey === 'DRAFT' ? 'draft' : 'issued');
    setSaveError('');
    try {
      const isDraft = statusKey === 'DRAFT';
      const payload = toQuotePayload(values);
      if (mode === 'create') await createCoreQuote(payload, isDraft);
      else await updateCoreQuote(targetQuoteId!, payload, isDraft);
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
      {inventoryError && (
        <StatusMessage variant="error">{inventoryError}</StatusMessage>
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
              {values.lines.map((line, index) => {
                const conditionOpts = getConditionOptions(line);
                const weight = calcWeight(line);
                const amount = calcAmount(line);
                const lineError = lineErrors.get(index);
                return (
                  <div key={index} className="quote-editor-page__line-row">
                    <span className="quote-editor-page__line-no">{index + 1}</span>
                    <ProductCombobox
                      products={inventoryProducts}
                      value={line.productId}
                      fallbackDisplayText={line.productName}
                      onChange={(pid, pname) => handleProductSelect(index, pid, pname)}
                      label={quotesCopy.editor.form.lineProduct}
                      placeholder={quotesCopy.editor.form.lineProductPlaceholder}
                      noResultsText={quotesCopy.editor.form.lineProductNoResults}
                      disabled={!editable}
                    />
                    <Select
                      label={quotesCopy.editor.form.lineCondition}
                      options={conditionOpts}
                      value={line.condition}
                      onChange={(e) => handleConditionSelect(index, e.target.value)}
                      width="sm"
                      disabled={!editable || !line.productId}
                      placeholder={quotesCopy.editor.form.lineConditionPlaceholder}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineQuantity}
                      value={line.quantity}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      width="sm"
                      disabled={!editable || !line.condition}
                      error={lineError}
                    />
                    <TextField
                      label={quotesCopy.editor.form.lineUnitPrice}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                      width="sm"
                      disabled={!editable}
                    />
                    <div className="quote-editor-page__line-calc">
                      <span className="quote-editor-page__line-calc-label">{quotesCopy.editor.form.lineAmount}</span>
                      <span className="quote-editor-page__line-calc-value">{amount != null ? amount.toLocaleString() : '—'}</span>
                    </div>
                    <div className="quote-editor-page__line-calc">
                      <span className="quote-editor-page__line-calc-label">{quotesCopy.editor.form.lineWeight}</span>
                      <span className="quote-editor-page__line-calc-value">{weight > 0 ? `${weight}g` : '—'}</span>
                    </div>
                    {editable && (
                      <Button variant="outline" size="sm" onClick={() => removeLine(index)}>
                        {quotesCopy.editor.form.removeLine}
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
