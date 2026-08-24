import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Combobox, EmptyState, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { leadsCopy } from '../../content/ja';
import type { LeadFormCountry, LeadSource, LeadRepository, LeadType } from '../../features/leads/contracts';
import { useLeadFormOptionsCache } from './LeadFormOptionsCacheContext';
import { useLeadListCache } from './LeadListCacheContext';
import { useLeadDetailCache } from './LeadDetailCacheContext';
import { emptyLeadEditorValues, LEAD_EDITOR_PATHS, toLeadCreateValues, toLeadEditorValues, toLeadUpdateValues, type LeadEditorValues } from './leadEditorConfig';
import { LEAD_TYPE_TABS } from './leadListConfig';
import './LeadEditorPage.css';

type Props = { mode: 'create' | 'detail'; canEdit: boolean; repository: LeadRepository };
type DetailState = 'loading' | 'ready' | 'missing' | 'error';
type NavigationState = { leadType?: LeadType } | null;

function isLeadType(value: unknown): value is LeadType {
  return LEAD_TYPE_TABS.some(({ type }) => type === value);
}

/** Appends currentValue to master options if it is not already present. Ignores empty strings. */
function toSelectOptions(masterOptions: readonly string[], currentValue: string) {
  const base = masterOptions.map((v) => ({ value: v, label: v }));
  return currentValue && !masterOptions.includes(currentValue)
    ? [...base, { value: currentValue, label: currentValue }]
    : base;
}

/** Filters lead sources by leadType. Appends currentSourceId as fallback if not in filtered list. */
function toSourceSelectOptions(
  sources: readonly LeadSource[],
  leadType: LeadType,
  currentSourceId: string,
  currentSourceName: string
) {
  const isInbound = leadType === leadsCopy.leadTypes.inbound;
  const filtered = sources.filter((s) => (isInbound ? s.isInbound : s.isOutbound));
  const base = filtered.map((s) => ({ value: s.sourceId, label: s.name }));
  if (currentSourceId && !base.some((o) => o.value === currentSourceId)) {
    return [...base, { value: currentSourceId, label: currentSourceName || currentSourceId }];
  }
  return base;
}

export function LeadEditorPage({ mode, canEdit, repository }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { leadId } = useParams();
  const { refreshAll, recordsByType } = useLeadListCache();
  const { recordsByLeadId, errorsByLeadId, ensureLoaded: ensureDetailLoaded } = useLeadDetailCache();
  const { formOptions, ensureLoaded: ensureFormOptionsLoaded } = useLeadFormOptionsCache();
  const requestedType = (location.state as NavigationState)?.leadType;
  const selectedType = isLeadType(requestedType) ? requestedType : LEAD_TYPE_TABS[0]!.type;
  const [leadType, setLeadType] = useState<LeadType>(selectedType);
  const [values, setValues] = useState<LeadEditorValues>(emptyLeadEditorValues);
  const [detailState, setDetailState] = useState<DetailState>(mode === 'create' ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const recordsByTypeRef = useRef(recordsByType);
  recordsByTypeRef.current = recordsByType;

  // Load form options through the shared cache without blocking the form.
  // On failure it stays null, so the form remains usable with its current values.
  useEffect(() => {
    void ensureFormOptionsLoaded();
  }, [ensureFormOptionsLoaded]);

  useEffect(() => {
    if (mode !== 'detail' || !leadId) return;
    const cached = Object.values(recordsByTypeRef.current)
      .flatMap((arr) => arr ?? [])
      .find((r) => r[leadsCopy.fields.leadId] === leadId);
    if (cached) {
      setValues(toLeadEditorValues(cached));
      const detailType = cached[leadsCopy.fields.leadType];
      if (isLeadType(detailType)) setLeadType(detailType);
      setDetailState('ready');
      return;
    }
    const detailRecords = recordsByLeadId[leadId];
    const detailError = errorsByLeadId[leadId];
    if (detailError !== undefined) {
      setLoadError(detailError);
      setDetailState('error');
      return;
    }
    if (detailRecords !== undefined) {
      const record = detailRecords[0];
      if (!record) {
        setDetailState('missing');
        return;
      }
      setValues(toLeadEditorValues(record));
      const detailType = record[leadsCopy.fields.leadType];
      if (isLeadType(detailType)) setLeadType(detailType);
      setDetailState('ready');
      return;
    }
    setDetailState('loading');
    setLoadError('');
    void ensureDetailLoaded(leadId);
  }, [ensureDetailLoaded, errorsByLeadId, leadId, mode, recordsByLeadId]);

  const editable = mode === 'create' || canEdit;
  const optionsReady = formOptions !== null;
  const updateValue = (key: keyof LeadEditorValues, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const handleSourceChange = (newSourceId: string) => {
    const source = formOptions?.leadSources.find((s) => s.sourceId === newSourceId);
    setValues((previous) => ({
      ...previous,
      sourceId: newSourceId,
      sourceName: source?.name ?? previous.sourceName
    }));
  };

  const save = async () => {
    if (!values.customerName.trim()) {
      setSaveError(leadsCopy.customerNameRequired);
      return;
    }
    const targetLeadId = leadId;
    if (mode === 'detail' && !targetLeadId) return;
    setSaving(true);
    setSaveError('');
    try {
      if (mode === 'create') await repository.create(toLeadCreateValues(values, leadType));
      else await repository.update(leadsCopy.form.sheetName, targetLeadId!, toLeadUpdateValues(values));
      void refreshAll();
      navigate(LEAD_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : leadsCopy.saveErrorPrefix);
    } finally {
      setSaving(false);
    }
  };

  if (detailState === 'loading') return (
    <>
      <PageHeader
        eyebrow={leadsCopy.eyebrow}
        title={leadsCopy.detailTitle}
        subtitle={leadsCopy.detailSubtitle}
        action={<Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>}
      />
      <Card><Skeleton variant="list" rows={7} label={leadsCopy.detailLoading} /></Card>
    </>
  );
  if (detailState === 'missing') return (
    <EmptyState
      title={leadsCopy.detailNotFoundTitle}
      description={leadsCopy.detailNotFoundDescription}
      action={<Button onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>}
    />
  );
  if (detailState === 'error') return (
    <StatusMessage variant="error">
      {leadsCopy.detailLoadErrorPrefix} {loadError}
      <Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>
    </StatusMessage>
  );

  // Lead type options: show current value only while loading, then full master + fallback
  const leadTypeOptions = optionsReady
    ? toSelectOptions(formOptions.leadTypes, leadType)
    : [{ value: leadType, label: leadType }];

  // Lead source options: filtered by leadType (isInbound / isOutbound)
  // Loading: show current sourceId/sourceName as single option (or empty)
  const sourceOptions = optionsReady
    ? toSourceSelectOptions(formOptions.leadSources, leadType, values.sourceId, values.sourceName)
    : values.sourceId
      ? [{ value: values.sourceId, label: values.sourceName || values.sourceId }]
      : [];

  // Response speed options: show current value only while loading (empty if blank)
  const responseSpeedOptions = optionsReady
    ? toSelectOptions(formOptions.responseSpeeds, values.responseSpeed)
    : values.responseSpeed
      ? [{ value: values.responseSpeed, label: values.responseSpeed }]
      : [];

  return (
    <>
      <PageHeader
        eyebrow={leadsCopy.eyebrow}
        title={mode === 'create' ? leadsCopy.createTitle : leadsCopy.detailTitle}
        subtitle={mode === 'create' ? leadsCopy.createSubtitle : leadsCopy.detailSubtitle}
        action={
          <div className="lead-editor-page__actions">
            <Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>
            {editable && (
              <Button onClick={() => void save()} loading={saving} loadingText={leadsCopy.saving}>
                {leadsCopy.save}
              </Button>
            )}
          </div>
        }
      />
      {mode === 'detail' && !canEdit && (
        <StatusMessage variant="loading">{leadsCopy.editingUnavailable}</StatusMessage>
      )}
      {saveError && (
        <StatusMessage variant="error">{leadsCopy.saveErrorPrefix} {saveError}</StatusMessage>
      )}
      <Card>
        <div className="lead-editor-page__form">
          {/* Lead type: Select (enabled for edit) */}
          <Select
            label={leadsCopy.form.leadType}
            options={leadTypeOptions}
            value={leadType}
            onChange={(event) => {
              const v = event.target.value;
              if (isLeadType(v)) setLeadType(v);
            }}
            width="sm"
            disabled={!editable || !optionsReady}
          />

          <TextField
            label={leadsCopy.form.customerName}
            value={values.customerName}
            onChange={(event) => updateValue('customerName', event.target.value)}
            width="md"
            required
            disabled={!editable}
          />

          {/* Lead source: Select (filtered by leadType, preserves current value if not in filtered list) */}
          <Select
            label={leadsCopy.form.source}
            options={sourceOptions}
            value={values.sourceId}
            onChange={(event) => handleSourceChange(event.target.value)}
            width="sm"
            disabled={!editable || !optionsReady}
            placeholder={!optionsReady ? leadsCopy.loading : leadsCopy.form.sourcePlaceholder}
          />

          {/* Country: Combobox (fallbackDisplayText preserves values not in master) */}
          <Combobox<LeadFormCountry>
            items={formOptions ? [...formOptions.countries] : []}
            getKey={(c) => c.name}
            getLabel={(c) => c.name}
            onSelect={(c) => updateValue('country', c?.name ?? '')}
            value={values.country}
            fallbackDisplayText={values.country}
            label={leadsCopy.form.country}
            placeholder={optionsReady ? leadsCopy.form.countryPlaceholder : leadsCopy.loading}
            noResultsText={leadsCopy.form.countryNoResults}
            width="sm"
            disabled={!editable || !optionsReady}
          />

          <TextField
            label={leadsCopy.form.productTitle}
            value={values.productTitle}
            onChange={(event) => updateValue('productTitle', event.target.value)}
            width="md"
            disabled={!editable}
          />

          {/* Response speed: Select (appends current value if not in master) */}
          <Select
            label={leadsCopy.form.responseSpeed}
            options={responseSpeedOptions}
            value={values.responseSpeed}
            onChange={(event) => updateValue('responseSpeed', event.target.value)}
            width="sm"
            disabled={!editable || !optionsReady}
            placeholder={!optionsReady ? leadsCopy.loading : undefined}
          />

          <Textarea
            label={leadsCopy.form.csMemo}
            value={values.csMemo}
            onChange={(event) => updateValue('csMemo', event.target.value)}
            disabled={!editable}
          />
        </div>
      </Card>
    </>
  );
}
