import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, StatusMessage, Textarea, TextField } from '../../components/ui';
import { leadsCopy } from '../../content/ja';
import type { LeadRepository, LeadType } from '../../features/leads/contracts';
import { useLeadListCache } from './LeadListCacheContext';
import { emptyLeadEditorValues, LEAD_EDITOR_PATHS, toLeadCreateValues, toLeadEditorValues, toLeadUpdateValues, type LeadEditorValues } from './leadEditorConfig';
import { LEAD_TYPE_TABS } from './leadListConfig';
import './LeadEditorPage.css';

type Props = { mode: 'create' | 'detail'; canEdit: boolean; repository: LeadRepository };
type DetailState = 'loading' | 'ready' | 'missing' | 'error';
type NavigationState = { leadType?: LeadType } | null;

function isLeadType(value: unknown): value is LeadType {
  return LEAD_TYPE_TABS.some(({ type }) => type === value);
}

export function LeadEditorPage({ mode, canEdit, repository }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { leadId } = useParams();
  const { refreshAll } = useLeadListCache();
  const requestedType = (location.state as NavigationState)?.leadType;
  const selectedType = isLeadType(requestedType) ? requestedType : LEAD_TYPE_TABS[0]!.type;
  const [leadType, setLeadType] = useState<LeadType>(selectedType);
  const [values, setValues] = useState<LeadEditorValues>(emptyLeadEditorValues);
  const [detailState, setDetailState] = useState<DetailState>(mode === 'create' ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'detail' || !leadId) return;
    setDetailState('loading');
    setLoadError('');
    void repository.getDetail(leadId).then((record) => {
      if (!record) {
        setDetailState('missing');
        return;
      }
      setValues(toLeadEditorValues(record));
      const detailType = record[leadsCopy.fields.leadType];
      if (isLeadType(detailType)) setLeadType(detailType);
      setDetailState('ready');
    }).catch((cause) => {
      setLoadError(cause instanceof Error ? cause.message : leadsCopy.detailLoadError);
      setDetailState('error');
    });
  }, [leadId, mode]);

  const editable = mode === 'create' || canEdit;
  const updateValue = (key: keyof LeadEditorValues, value: string) => setValues((previous) => ({ ...previous, [key]: value }));
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
      await refreshAll();
      navigate(LEAD_EDITOR_PATHS.list);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : leadsCopy.saveErrorPrefix);
    } finally {
      setSaving(false);
    }
  };

  if (detailState === 'loading') return <><PageHeader eyebrow={leadsCopy.eyebrow} title={leadsCopy.detailTitle} subtitle={leadsCopy.detailSubtitle} action={<Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>} /><Card><Skeleton variant="list" rows={7} label={leadsCopy.detailLoading} /></Card></>;
  if (detailState === 'missing') return <EmptyState title={leadsCopy.detailNotFoundTitle} description={leadsCopy.detailNotFoundDescription} action={<Button onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>} />;
  if (detailState === 'error') return <StatusMessage variant="error">{leadsCopy.detailLoadErrorPrefix} {loadError}<Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button></StatusMessage>;

  return <><PageHeader eyebrow={leadsCopy.eyebrow} title={mode === 'create' ? leadsCopy.createTitle : leadsCopy.detailTitle} subtitle={mode === 'create' ? leadsCopy.createSubtitle : leadsCopy.detailSubtitle} action={<div className="lead-editor-page__actions"><Button variant="outline" onClick={() => navigate(LEAD_EDITOR_PATHS.list)}>{leadsCopy.backToList}</Button>{editable && <Button onClick={() => void save()} loading={saving} loadingText={leadsCopy.saving}>{leadsCopy.save}</Button>}</div>} />{mode === 'detail' && !canEdit && <StatusMessage variant="loading">{leadsCopy.editingUnavailable}</StatusMessage>}{saveError && <StatusMessage variant="error">{leadsCopy.saveErrorPrefix} {saveError}</StatusMessage>}<Card><div className="lead-editor-page__form"><Select label={leadsCopy.form.leadType} options={LEAD_TYPE_TABS.map(({ type, label }) => ({ value: type, label }))} value={leadType} width="sm" disabled /><TextField label={leadsCopy.form.customerName} value={values.customerName} onChange={(event) => updateValue('customerName', event.target.value)} width="md" required disabled={!editable} /><TextField label={leadsCopy.form.source} value={values.source} onChange={(event) => updateValue('source', event.target.value)} width="sm" disabled={!editable} /><TextField label={leadsCopy.form.country} value={values.country} onChange={(event) => updateValue('country', event.target.value)} width="sm" disabled={!editable} /><TextField label={leadsCopy.form.productTitle} value={values.productTitle} onChange={(event) => updateValue('productTitle', event.target.value)} width="md" disabled={!editable} /><TextField label={leadsCopy.form.responseSpeed} value={values.responseSpeed} onChange={(event) => updateValue('responseSpeed', event.target.value)} width="sm" disabled={!editable} /><Textarea label={leadsCopy.form.csMemo} value={values.csMemo} onChange={(event) => updateValue('csMemo', event.target.value)} disabled={!editable} /></div></Card></>;
}
