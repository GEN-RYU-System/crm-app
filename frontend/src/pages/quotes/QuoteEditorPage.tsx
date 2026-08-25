import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, LineItemEditor, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField, TwoColumnLayout } from '../../components/ui';
import { quotesCopy } from '../../content/ja';
import { ISSUER_HEADER } from '../../content/ja/issuer';
import { QuoteDocument } from '../../features/documents/QuoteDocument';
import { formatDate } from '../shared/dateFormat';
import { createCoreQuote, getCoreIssuer, getCoreQuoteDetail, getLeadOptionsForFrontend, updateCoreQuote, type IssuerRecord, type LeadOption } from '../../gas/client';
import { useInventoryConditionsMap } from '../inventory/InventoryListCacheContext';
import { useInventoryProductOptionsCache } from '../inventory/InventoryProductOptionsCacheContext';
import { useCurrencyMasterCache } from '../currency/CurrencyMasterCacheContext';
import { emptyLineValues, emptyQuoteEditorValues, isValidDiscount, QUOTE_EDITOR_PATHS, toHalfwidthDigits, toQuoteEditorValues, toQuotePayload, type QuoteEditorValues, type QuoteLineEditorValues } from './quoteEditorConfig';
import { LeadCombobox } from './LeadCombobox';
import './QuoteEditorPage.css';

type Props = { mode: 'create' | 'detail'; canEdit: boolean };
type DetailState = 'loading' | 'ready' | 'missing' | 'error';
type SavingState = 'idle' | 'draft' | 'issued';

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

/** Calculate subtotal for a single line item (quantity x unit price). */
function calcLineSubtotal(quantity: string, unitPrice: string): number | null {
  const qty = Number(toHalfwidthDigits(quantity));
  const price = Number(toHalfwidthDigits(unitPrice));
  return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : null;
}

/** Calculate quote total: line subtotal + shipping fee - discount. */
function calcQuoteTotal(
  lines: QuoteLineEditorValues[],
  shippingFee: string,
  discount: string,
): number | null {
  const lineTotal = lines.reduce<number | null>((sum, line) => {
    const sub = calcLineSubtotal(line.quantity, line.unitPrice);
    if (sub === null || sum === null) return null;
    return sum + sub;
  }, 0);
  if (lineTotal === null) return null;
  const fee = Number(toHalfwidthDigits(shippingFee)) || 0;
  const disc = Number(toHalfwidthDigits(discount)) || 0;
  return lineTotal + fee - disc;
}

export function QuoteEditorPage({ mode, canEdit }: Props) {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const [values, setValues] = useState<QuoteEditorValues>(emptyQuoteEditorValues);
  const [detailState, setDetailState] = useState<DetailState>(mode === 'create' ? 'ready' : 'loading');
  const [masterState, setMasterState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [lineErrors, setLineErrors] = useState<Map<number, string>>(new Map());
  const [inventoryError, setInventoryError] = useState('');
  const [quoteMetaInfo, setQuoteMetaInfo] = useState<{
    quoteId: string;
    issuedDate: string;
    expiryDate: string;
    customerName: string;
  } | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [issuer, setIssuer] = useState<IssuerRecord | null>(null);

  // Derive conditions from the prefetched inventory cache (no GAS call needed).
  const conditionsMap = useInventoryConditionsMap();
  const { products: inventoryProducts, ensureLoaded: ensureInventoryProductOptions } = useInventoryProductOptionsCache();
  const { currencies, ensureLoaded: ensureCurrencies } = useCurrencyMasterCache();

  useEffect(() => {
    setMasterState('loading');
    void Promise.all([ensureCurrencies(), getLeadOptionsForFrontend()])
      .then(([, leadData]) => {
        setLeads([...leadData]);
        setMasterState('ready');
      })
      .catch(() => setMasterState('error'));
  }, [ensureCurrencies]);

  useEffect(() => {
    void ensureInventoryProductOptions()
      .catch(() => setInventoryError(quotesCopy.editor.inventoryLoadError));
  }, [ensureInventoryProductOptions]);

  useEffect(() => {
    if (mode !== 'detail' || !quoteId) return;
    setDetailState('loading');
    setLoadError('');
    void getCoreQuoteDetail(quoteId).then((record) => {
      if (!record) { setDetailState('missing'); return; }
      setValues(toQuoteEditorValues(record));
      // Store meta info for right column display
      const q = record.quote;
      if (q.quoteId || q.issuedDate || q.expiryDate) {
        setQuoteMetaInfo({
          quoteId: q.quoteId,
          issuedDate: q.issuedDate,
          expiryDate: q.expiryDate,
          customerName: q.customerName,
        });
      }
      setDetailState('ready');
    }).catch((cause) => {
      setLoadError(cause instanceof Error ? cause.message : quotesCopy.editor.loadError);
      setDetailState('error');
    });
  }, [quoteId, mode]);

  // For detail mode: backfill unitWeight from the prefetched conditionsMap.
  // Re-runs whenever conditionsMap updates (e.g. after the prefetch completes).
  useEffect(() => {
    if (mode !== 'detail' || detailState !== 'ready') return;
    if (conditionsMap.size === 0) return;
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (!l.productId || !l.condition) return l;
        const conditions = conditionsMap.get(l.productId) ?? [];
        const found = conditions.find((c) => c.condition === l.condition);
        return found ? { ...l, unitWeight: found.unitWeight } : l;
      })
    }));
  }, [mode, detailState, conditionsMap]);

  useEffect(() => {
    void getCoreIssuer().then((data) => setIssuer(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

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
    // conditionsMap is derived synchronously from the prefetched cache — no GAS call needed.
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

  const lineItemLabels = {
    product: quotesCopy.editor.form.lineProduct,
    productPlaceholder: quotesCopy.editor.form.lineProductPlaceholder,
    productNoResults: quotesCopy.editor.form.lineProductNoResults,
    condition: quotesCopy.editor.form.lineCondition,
    conditionPlaceholder: quotesCopy.editor.form.lineConditionPlaceholder,
    quantity: quotesCopy.editor.form.lineQuantity,
    unitPrice: quotesCopy.editor.form.lineUnitPrice,
    amount: quotesCopy.editor.form.lineAmount,
    weight: quotesCopy.editor.form.lineWeight,
    remove: quotesCopy.editor.form.removeLine,
    conditionOptionLabel: quotesCopy.editor.form.lineConditionOptionLabel,
  };

  const quoteTotal = calcQuoteTotal(values.lines, values.shippingFee, values.discount);

  /** Right column: quote meta info and amount summary */
  const rightColumn = (
    <div className="quote-editor-page__right-panel">
      {/* Detail mode only: quote ID / issued date / expiry date */}
      {mode === 'detail' && quoteMetaInfo && (
        <>
          <div className="quote-editor-page__right-section">
            <h2 className="quote-editor-page__right-heading">{quotesCopy.detail.title}</h2>
            <dl className="quote-editor-page__meta-list">
              {quoteMetaInfo.quoteId && (
                <>
                  <dt className="quote-editor-page__meta-label">{quotesCopy.columns.quoteId}</dt>
                  <dd className="quote-editor-page__meta-value">{quoteMetaInfo.quoteId}</dd>
                </>
              )}
              {quoteMetaInfo.issuedDate && (
                <>
                  <dt className="quote-editor-page__meta-label">{quotesCopy.detail.issuedDate}</dt>
                  <dd className="quote-editor-page__meta-value">{formatDate(quoteMetaInfo.issuedDate)}</dd>
                </>
              )}
              {quoteMetaInfo.expiryDate && (
                <>
                  <dt className="quote-editor-page__meta-label">{quotesCopy.detail.expiryDate}</dt>
                  <dd className="quote-editor-page__meta-value">{formatDate(quoteMetaInfo.expiryDate)}</dd>
                </>
              )}
            </dl>
          </div>
          <hr className="quote-editor-page__divider" />
        </>
      )}

      {/* Amount summary */}
      <div className="quote-editor-page__right-section">
        <h2 className="quote-editor-page__right-heading">{quotesCopy.detail.lines}</h2>
        <div className="quote-editor-page__amount-form">
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
        </div>
      </div>

      <hr className="quote-editor-page__divider" />

      {/* Quote total */}
      <div className="quote-editor-page__right-section">
        <div className="quote-editor-page__total-row">
          <span className="quote-editor-page__total-label">{quotesCopy.detail.totalAmount}</span>
          <span className="quote-editor-page__total-value">
            {quoteTotal != null ? quoteTotal.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      <hr className="quote-editor-page__divider" />

      {/* Currency */}
      <div className="quote-editor-page__right-section">
        <div className="quote-editor-page__amount-form">
          <Select
            label={quotesCopy.editor.form.currency}
            options={currencyOptions}
            value={values.currency}
            onChange={(e) => updateValue('currency', e.target.value)}
            width="sm"
            disabled={!editable}
          />
        </div>
      </div>
    </div>
  );

  /** Left column: lead selection, line items, memo */
  const leftColumn = (
    <>
      {/* Lead selection section */}
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
        </div>
      </Card>

      {/* Line items section */}
      <Card>
        <div className="quote-editor-page__lines-header">
          <h2 className="quote-editor-page__section-title">{quotesCopy.editor.form.lines}</h2>
          {editable && (
            <Button variant="outline" size="sm" onClick={addLine}>
              {quotesCopy.editor.form.addLine}
            </Button>
          )}
        </div>
        <LineItemEditor
          products={inventoryProducts}
          lines={values.lines}
          conditionsMap={conditionsMap}
          onProductSelect={handleProductSelect}
          onConditionSelect={handleConditionSelect}
          onQuantityChange={handleQuantityChange}
          onUnitPriceChange={(index, value) => updateLine(index, 'unitPrice', value)}
          onRemove={removeLine}
          lineErrors={lineErrors}
          disabled={!editable}
          labels={lineItemLabels}
        />
      </Card>

      {/* Memo / notes section */}
      <Card>
        <div className="quote-editor-page__form">
          <Textarea
            label={quotesCopy.editor.form.note}
            value={values.note}
            onChange={(e) => updateValue('note', e.target.value)}
            disabled={!editable}
            fullWidth
          />
        </div>
      </Card>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow={quotesCopy.eyebrow}
        title={mode === 'create' ? quotesCopy.editor.createTitle : quotesCopy.editor.detailTitle}
        subtitle={mode === 'create' ? quotesCopy.editor.createSubtitle : quotesCopy.editor.detailSubtitle}
        action={
          <div className="quote-editor-page__actions">
            <Button variant="outline" onClick={() => navigate(QUOTE_EDITOR_PATHS.list)} disabled={isSaving}>{quotesCopy.backToList}</Button>
            {mode === 'detail' && !isLoading && quoteMetaInfo && issuer && (
              <Button variant="outline" onClick={() => setShowPrint(true)}>
                {quotesCopy.editor.printQuote}
              </Button>
            )}
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
        <TwoColumnLayout left={leftColumn} right={rightColumn} />
      )}

      {showPrint && issuer && quoteMetaInfo && (() => {
        const docLines = values.lines.map((l, i) => {
          const sub = calcLineSubtotal(l.quantity, l.unitPrice);
          return {
            no: i + 1,
            name: l.productName,
            qty: l.quantity,
            unitPrice: l.unitPrice,
            amount: sub != null ? sub.toLocaleString() : '',
          };
        });
        const docSubtotal = values.lines.reduce<number>((sum, l) => {
          const sub = calcLineSubtotal(l.quantity, l.unitPrice);
          return sub != null ? sum + sub : sum;
        }, 0);
        return createPortal(
          <div className="doc-print-root">
            <QuoteDocument
              issuer={buildIssuerInfo(issuer)}
              quoteId={quoteMetaInfo.quoteId}
              date={formatDate(quoteMetaInfo.issuedDate)}
              validUntil={quoteMetaInfo.expiryDate ? formatDate(quoteMetaInfo.expiryDate) : ''}
              registrationNumber={String(issuer[ISSUER_HEADER.REGISTRATION_NO] ?? '') || undefined}
              customerName={quoteMetaInfo.customerName}
              lines={docLines}
              subtotal={docSubtotal.toLocaleString()}
              shippingFee={values.shippingFee}
              discount={values.discount}
              total={quoteTotal != null ? quoteTotal.toLocaleString() : ''}
              currency={values.currency}
              paymentTermsNote={String(issuer[ISSUER_HEADER.PAYMENT_NOTE] ?? '') || undefined}
              thanksMessage={String(issuer[ISSUER_HEADER.CLOSING_MESSAGE] ?? '') || undefined}
            />
          </div>,
          document.body
        );
      })()}
    </>
  );
}
