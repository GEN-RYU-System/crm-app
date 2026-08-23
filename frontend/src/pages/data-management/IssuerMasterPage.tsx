import { useCallback, useEffect, useState } from 'react';
import { Button, Card, PageHeader, Spinner, StatusMessage, Textarea, TextField } from '../../components/ui';
import { ISSUER_HEADER, issuerCopy } from '../../content/ja/issuer';
import { getCoreIssuer, updateCoreIssuer, type IssuerRecord } from '../../gas/client';
import './IssuerMasterPage.css';

// Editable field keys (excludes ISSUER_ID and IS_ACTIVE which are read-only)
const EDITABLE_KEYS = [
  'COMPANY_NAME', 'CONTACT_NAME',
  'ADDRESS_LINE1', 'ADDRESS_LINE2', 'ADDRESS_LINE3',
  'CITY', 'STATE', 'ZIP', 'COUNTRY',
  'PHONE', 'EMAIL', 'REGISTRATION_NO',
  'PAYEE_NAME', 'PAYMENT_EMAIL', 'PAYMENT_NOTE', 'CLOSING_MESSAGE',
] as const satisfies readonly (keyof typeof ISSUER_HEADER)[];

type FieldKey = typeof EDITABLE_KEYS[number];
type FormState = Record<FieldKey, string>;

const INITIAL_FORM: FormState = {
  COMPANY_NAME: '',
  CONTACT_NAME: '',
  ADDRESS_LINE1: '',
  ADDRESS_LINE2: '',
  ADDRESS_LINE3: '',
  CITY: '',
  STATE: '',
  ZIP: '',
  COUNTRY: '',
  PHONE: '',
  EMAIL: '',
  REGISTRATION_NO: '',
  PAYEE_NAME: '',
  PAYMENT_EMAIL: '',
  PAYMENT_NOTE: '',
  CLOSING_MESSAGE: '',
};

function issuerToForm(issuer: IssuerRecord): FormState {
  const get = (key: string): string => {
    const val = issuer[key];
    if (val === null || val === undefined) return '';
    return String(val);
  };
  return {
    COMPANY_NAME: get(ISSUER_HEADER.COMPANY_NAME),
    CONTACT_NAME: get(ISSUER_HEADER.CONTACT_NAME),
    ADDRESS_LINE1: get(ISSUER_HEADER.ADDRESS_LINE1),
    ADDRESS_LINE2: get(ISSUER_HEADER.ADDRESS_LINE2),
    ADDRESS_LINE3: get(ISSUER_HEADER.ADDRESS_LINE3),
    CITY: get(ISSUER_HEADER.CITY),
    STATE: get(ISSUER_HEADER.STATE),
    ZIP: get(ISSUER_HEADER.ZIP),
    COUNTRY: get(ISSUER_HEADER.COUNTRY),
    PHONE: get(ISSUER_HEADER.PHONE),
    EMAIL: get(ISSUER_HEADER.EMAIL),
    REGISTRATION_NO: get(ISSUER_HEADER.REGISTRATION_NO),
    PAYEE_NAME: get(ISSUER_HEADER.PAYEE_NAME),
    PAYMENT_EMAIL: get(ISSUER_HEADER.PAYMENT_EMAIL),
    PAYMENT_NOTE: get(ISSUER_HEADER.PAYMENT_NOTE),
    CLOSING_MESSAGE: get(ISSUER_HEADER.CLOSING_MESSAGE),
  };
}

function formToIssuerData(form: FormState): IssuerRecord {
  const data: IssuerRecord = {};
  for (const key of EDITABLE_KEYS) {
    data[ISSUER_HEADER[key]] = form[key];
  }
  return data;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

export function IssuerMasterPage({ canEdit }: { canEdit: boolean }) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const issuer = await getCoreIssuer();
      setForm(issuerToForm(issuer));
      setLoadState('ready');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : issuerCopy.loadError);
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleChange = (key: FieldKey) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaveState('idle');
    setForm((previous) => ({ ...previous, [key]: event.target.value }));
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      await updateCoreIssuer(formToIssuerData(form));
      setSaveState('success');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : issuerCopy.saveError);
      setSaveState('error');
    }
  };

  const isLoading = loadState === 'loading';

  return (
    <>
      <PageHeader title={issuerCopy.title} subtitle={issuerCopy.subtitle} />
      <Card>
        {isLoading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={issuerCopy.loading} />
            {issuerCopy.loading}
          </StatusMessage>
        )}
        {loadState === 'error' && (
          <StatusMessage variant="error">
            {loadError || issuerCopy.loadError}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {issuerCopy.retry}
            </Button>
          </StatusMessage>
        )}
        {loadState === 'ready' && (
          <div className="issuer-master-form">
            <TextField
              label={issuerCopy.companyName}
              value={form.COMPANY_NAME}
              onChange={handleChange('COMPANY_NAME')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.contactName}
              value={form.CONTACT_NAME}
              onChange={handleChange('CONTACT_NAME')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.addressLine1}
              value={form.ADDRESS_LINE1}
              onChange={handleChange('ADDRESS_LINE1')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.addressLine2}
              value={form.ADDRESS_LINE2}
              onChange={handleChange('ADDRESS_LINE2')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.addressLine3}
              value={form.ADDRESS_LINE3}
              onChange={handleChange('ADDRESS_LINE3')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.city}
              value={form.CITY}
              onChange={handleChange('CITY')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.state}
              value={form.STATE}
              onChange={handleChange('STATE')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.zip}
              value={form.ZIP}
              onChange={handleChange('ZIP')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.country}
              value={form.COUNTRY}
              onChange={handleChange('COUNTRY')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.phone}
              value={form.PHONE}
              onChange={handleChange('PHONE')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.email}
              value={form.EMAIL}
              onChange={handleChange('EMAIL')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.registrationNo}
              value={form.REGISTRATION_NO}
              onChange={handleChange('REGISTRATION_NO')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.payeeName}
              value={form.PAYEE_NAME}
              onChange={handleChange('PAYEE_NAME')}
              fullWidth
              disabled={!canEdit}
            />
            <TextField
              label={issuerCopy.paymentEmail}
              value={form.PAYMENT_EMAIL}
              onChange={handleChange('PAYMENT_EMAIL')}
              fullWidth
              disabled={!canEdit}
            />
            <Textarea
              label={issuerCopy.paymentNote}
              value={form.PAYMENT_NOTE}
              onChange={handleChange('PAYMENT_NOTE')}
              rows={4}
              fullWidth
              disabled={!canEdit}
            />
            <Textarea
              label={issuerCopy.closingMessage}
              value={form.CLOSING_MESSAGE}
              onChange={handleChange('CLOSING_MESSAGE')}
              rows={4}
              fullWidth
              disabled={!canEdit}
            />
            {saveState === 'success' && (
              <p className="issuer-master-save-success" role="status">{issuerCopy.saveSuccess}</p>
            )}
            {saveState === 'error' && (
              <StatusMessage variant="error">{saveError || issuerCopy.saveError}</StatusMessage>
            )}
            {canEdit && (
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                loading={saveState === 'saving'}
                loadingText={issuerCopy.saving}
              >
                {issuerCopy.save}
              </Button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
