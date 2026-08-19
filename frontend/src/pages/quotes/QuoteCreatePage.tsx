import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAVIGATION_BY_ID } from '../../app/navigation';
import { Button, Card, PageHeader, PageToolbar, Select, StatusMessage, Textarea, TextField } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { quotesCopy } from '../../content/ja';
import { createCoreQuoteSimple, getLeadsForQuoteDropdown, type LeadDropdownItem, type QuoteCreateResult } from '../../gas/client';
import { QUOTE_ROUTE_SEGMENTS } from './quoteListConfig';
import './QuoteCreatePage.css';

type LineItem = {
  id: string;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function newLine(): LineItem {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    productName: '',
    description: '',
    quantity: '',
    unitPrice: '',
  };
}

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'JPY', label: quotesCopy.create.currencyOptions.jpy },
  { value: 'USD', label: quotesCopy.create.currencyOptions.usd },
  { value: 'EUR', label: quotesCopy.create.currencyOptions.eur },
  { value: 'CNY', label: quotesCopy.create.currencyOptions.cny },
  { value: 'HKD', label: quotesCopy.create.currencyOptions.hkd },
];

export function QuoteCreatePage() {
  const navigate = useNavigate();

  const [leadId, setLeadId] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [shippingFee, setShippingFee] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const [leads, setLeads] = useState<LeadDropdownItem[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [localValidationErrors, setLocalValidationErrors] = useState<Record<string, string>>({});

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError('');
    try {
      const result = await getLeadsForQuoteDropdown();
      setLeads([...result]);
    } catch (cause) {
      setLeadsError(cause instanceof Error ? cause.message : quotesCopy.create.loadLeadsError);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const updateLine = (id: string, key: keyof Omit<LineItem, 'id'>, value: string) =>
    setLines((prev) => prev.map((line) => line.id === id ? { ...line, [key]: value } : line));

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const removeLine = (id: string) => setLines((prev) => prev.filter((line) => line.id !== id));

  const handleSave = async (isDraft: boolean) => {
    const errors: Record<string, string> = {};
    if (!leadId.trim()) {
      errors.leadId = quotesCopy.create.leadRequired;
    }
    if (Object.keys(errors).length > 0) {
      setLocalValidationErrors(errors);
      return;
    }
    setLocalValidationErrors({});
    setSaving(true);
    setSaveError('');
    try {
      const result: QuoteCreateResult = await createCoreQuoteSimple(
        {
          leadId,
          currency,
          shippingFee,
          discount,
          note,
          lines: lines.map(({ productName, description, quantity, unitPrice }) => ({
            productName,
            description,
            quantity,
            unitPrice,
          })),
        },
        isDraft,
      );
      navigate(`${NAVIGATION_BY_ID.quotes.hash}/${encodeURIComponent(result.quoteId)}`);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : quotesCopy.create.saveError);
    } finally {
      setSaving(false);
    }
  };

  const leadOptions: SelectOption[] = leads.map((l) => ({ value: l.leadId, label: l.displayName || l.leadId }));

  return (
    <>
      <PageHeader
        eyebrow={quotesCopy.eyebrow}
        title={quotesCopy.create.title}
        subtitle={quotesCopy.create.subtitle}
      />
      <PageToolbar
        start={
          <Button variant="outline" onClick={() => navigate(`${NAVIGATION_BY_ID.quotes.hash}/${QUOTE_ROUTE_SEGMENTS.create}`.replace(`/${QUOTE_ROUTE_SEGMENTS.create}`, ''))}>
            {quotesCopy.backToList}
          </Button>
        }
        end={
          <div className="quote-create-page__actions">
            <Button variant="outline" onClick={() => void handleSave(true)} loading={saving} loadingText={quotesCopy.create.saving}>
              {quotesCopy.create.saveDraft}
            </Button>
            <Button onClick={() => void handleSave(false)} loading={saving} loadingText={quotesCopy.create.saving}>
              {quotesCopy.create.publish}
            </Button>
          </div>
        }
      />

      {saveError && (
        <StatusMessage variant="error">{quotesCopy.create.saveError} {saveError}</StatusMessage>
      )}

      <Card>
        <div className="quote-create-page__form">
          <Select
            label={quotesCopy.create.lead}
            options={leadOptions}
            value={leadId}
            onChange={(e) => { setLeadId(e.target.value); setLocalValidationErrors((prev) => ({ ...prev, leadId: '' })); }}
            placeholder={leadsLoading ? quotesCopy.create.leadLoading : quotesCopy.create.leadPlaceholder}
            width="md"
            required
            disabled={leadsLoading}
          />
          {localValidationErrors.leadId && (
            <StatusMessage variant="error">{localValidationErrors.leadId}</StatusMessage>
          )}
          {leadsError && (
            <StatusMessage variant="error">{quotesCopy.create.loadLeadsError}: {leadsError}</StatusMessage>
          )}

          <Select
            label={quotesCopy.create.currency}
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            width="sm"
          />

          <TextField
            label={quotesCopy.create.shippingFee}
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
            placeholder={quotesCopy.create.shippingFeePlaceholder}
            width="sm"
          />

          <TextField
            label={quotesCopy.create.discount}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder={quotesCopy.create.discountPlaceholder}
            width="sm"
          />

          <Textarea
            label={quotesCopy.create.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <div className="quote-create-page__lines-header">
          <h2 className="quote-create-page__section-title">{quotesCopy.create.lines}</h2>
          <Button variant="outline" size="sm" onClick={addLine}>
            {quotesCopy.create.addLine}
          </Button>
        </div>
        <div className="quote-create-page__lines">
          {lines.map((line, index) => (
            <div key={line.id} className="quote-create-page__line-row">
              <span className="quote-create-page__line-no">{index + 1}</span>
              <div className="quote-create-page__line-fields">
                <TextField
                  label={quotesCopy.create.lineProductName}
                  value={line.productName}
                  onChange={(e) => updateLine(line.id, 'productName', e.target.value)}
                  width="md"
                />
                <TextField
                  label={quotesCopy.create.lineDescription}
                  value={line.description}
                  onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                  width="md"
                />
                <TextField
                  label={quotesCopy.create.lineQuantity}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                  width="sm"
                />
                <TextField
                  label={quotesCopy.create.lineUnitPrice}
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.id, 'unitPrice', e.target.value)}
                  width="sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => removeLine(line.id)}>
                {quotesCopy.create.removeLine}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
