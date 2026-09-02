import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, DataTable, EmptyState, PageHeader, Spinner, StatusMessage, Tabs, TextField, Select,
} from '../../components/ui';
import type { DataTableColumn, TabItem } from '../../components/ui';
import { exportMasterCopy } from '../../content/ja/exportMaster';
import {
  getCoreItems, getCoreHtsCodes, getCoreMaterials,
  upsertCoreItem, upsertCoreHtsCode, upsertCoreMaterial,
  type ItemRecord, type HtsCodeRecord, type MaterialRecord,
} from '../../gas/client';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type MasterTab = 'items' | 'htsCodes' | 'materials';

const TABS: ReadonlyArray<TabItem<MasterTab>> = [
  { key: 'items',    label: exportMasterCopy.tabItems },
  { key: 'htsCodes', label: exportMasterCopy.tabHtsCodes },
  { key: 'materials', label: exportMasterCopy.tabMaterials },
];

// ─── Form state types ─────────────────────────────────────────────────────────

type ItemForm = { nameEn: string; nameJa: string; isActive: boolean };
type HtsCodeForm = { htsCode: string; descriptionEn: string; descriptionJa: string; isActive: boolean };
type MaterialForm = { nameEn: string; nameJa: string; isActive: boolean };

const EMPTY_ITEM_FORM: ItemForm = { nameEn: '', nameJa: '', isActive: true };
const EMPTY_HTS_CODE_FORM: HtsCodeForm = { htsCode: '', descriptionEn: '', descriptionJa: '', isActive: true };
const EMPTY_MATERIAL_FORM: MaterialForm = { nameEn: '', nameJa: '', isActive: true };

function itemToForm(r: ItemRecord): ItemForm {
  return { nameEn: r.nameEn, nameJa: r.nameJa, isActive: r.isActive === 'TRUE' };
}
function htsCodeToForm(r: HtsCodeRecord): HtsCodeForm {
  return { htsCode: r.htsCode, descriptionEn: r.descriptionEn, descriptionJa: r.descriptionJa, isActive: r.isActive === 'TRUE' };
}
function materialToForm(r: MaterialRecord): MaterialForm {
  return { nameEn: r.nameEn, nameJa: r.nameJa, isActive: r.isActive === 'TRUE' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportMasterPage() {
  const [activeTab, setActiveTab] = useState<MasterTab>('items');

  // Data
  const [items,    setItems]    = useState<ItemRecord[]>([]);
  const [htsCodes, setHtsCodes] = useState<HtsCodeRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);

  // Load state
  const [loadError, setLoadError] = useState<string | undefined>();
  const [loading,   setLoading]   = useState(true);

  // Inline edit state
  const [editingId,    setEditingId]    = useState<string | 'new' | null>(null);
  const [itemForm,     setItemForm]     = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [htsCodeForm,  setHtsCodeForm]  = useState<HtsCodeForm>(EMPTY_HTS_CODE_FORM);
  const [materialForm, setMaterialForm] = useState<MaterialForm>(EMPTY_MATERIAL_FORM);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | undefined>();
  const [saveSuccess,  setSaveSuccess]  = useState(false);

  const closeForm = () => {
    setEditingId(null);
    setSaveError(undefined);
    setSaveSuccess(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [i, h, m] = await Promise.all([
        getCoreItems(), getCoreHtsCodes(), getCoreMaterials(),
      ]);
      setItems(i);
      setHtsCodes(h);
      setMaterials(m);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : exportMasterCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Close form when tab changes
  useEffect(() => { closeForm(); }, [activeTab]);

  // ─── Save handlers ─────────────────────────────────────────────────────────

  const handleSaveItem = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { itemId: editingId } : {}),
        nameEn:   itemForm.nameEn,
        nameJa:   itemForm.nameJa,
        isActive: itemForm.isActive,
      };
      await upsertCoreItem(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : exportMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHtsCode = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { htsCodeId: editingId } : {}),
        htsCode:       htsCodeForm.htsCode,
        descriptionEn: htsCodeForm.descriptionEn,
        descriptionJa: htsCodeForm.descriptionJa,
        isActive:      htsCodeForm.isActive,
      };
      await upsertCoreHtsCode(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : exportMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMaterial = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { materialId: editingId } : {}),
        nameEn:   materialForm.nameEn,
        nameJa:   materialForm.nameJa,
        isActive: materialForm.isActive,
      };
      await upsertCoreMaterial(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : exportMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ─── DataTable columns ─────────────────────────────────────────────────────

  const itemColumns: DataTableColumn<ItemRecord>[] = [
    { key: 'itemId',  header: exportMasterCopy.colItemId,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.itemId}</span> },
    { key: 'nameEn',  header: exportMasterCopy.colNameEn,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',  header: exportMasterCopy.colNameJa,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',  header: exportMasterCopy.colActive,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : exportMasterCopy.inactiveLabel}</span> },
  ];

  const htsCodeColumns: DataTableColumn<HtsCodeRecord>[] = [
    { key: 'htsCodeId',     header: exportMasterCopy.colHtsCodeId,     renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.htsCodeId}</span> },
    { key: 'htsCode',       header: exportMasterCopy.colHtsCode,       renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.htsCode}</span> },
    { key: 'descriptionEn', header: exportMasterCopy.colDescriptionEn, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.descriptionEn}</span> },
    { key: 'descriptionJa', header: exportMasterCopy.colDescriptionJa, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.descriptionJa}</span> },
    { key: 'active',        header: exportMasterCopy.colActive,        renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : exportMasterCopy.inactiveLabel}</span> },
  ];

  const materialColumns: DataTableColumn<MaterialRecord>[] = [
    { key: 'materialId', header: exportMasterCopy.colMaterialId,      renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.materialId}</span> },
    { key: 'nameEn',     header: exportMasterCopy.colMaterialNameEn,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',     header: exportMasterCopy.colMaterialNameJa,  renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',     header: exportMasterCopy.colActive,          renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : exportMasterCopy.inactiveLabel}</span> },
  ];

  // ─── Render helpers ────────────────────────────────────────────────────────

  const saveActions = (onSave: () => Promise<void>) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
      {saveSuccess && <p role="status" style={{ color: 'var(--color-success, green)', margin: 0 }}>{exportMasterCopy.saveSuccess}</p>}
      {saveError && <StatusMessage variant="error">{saveError}</StatusMessage>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="primary" onClick={() => void onSave()} loading={saving} loadingText={exportMasterCopy.saving}>
          {exportMasterCopy.btnSave}
        </Button>
        <Button variant="ghost" onClick={closeForm}>{exportMasterCopy.btnCancel}</Button>
      </div>
    </div>
  );

  const activeSelectOptions = [
    { value: 'TRUE', label: exportMasterCopy.activeLabel },
    { value: '',     label: exportMasterCopy.inactiveSelectLabel },
  ];

  const itemInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <TextField label={exportMasterCopy.colNameEn} value={itemForm.nameEn} onChange={(e) => setItemForm((p) => ({ ...p, nameEn: e.target.value }))} fullWidth />
        <TextField label={exportMasterCopy.colNameJa} value={itemForm.nameJa} onChange={(e) => setItemForm((p) => ({ ...p, nameJa: e.target.value }))} fullWidth />
        <Select
          label={exportMasterCopy.colActive}
          value={itemForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setItemForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={activeSelectOptions}
          fullWidth
        />
      </div>
      {saveActions(handleSaveItem)}
    </div>
  );

  const htsCodeInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <TextField label={exportMasterCopy.colHtsCode}       value={htsCodeForm.htsCode}       onChange={(e) => setHtsCodeForm((p) => ({ ...p, htsCode:       e.target.value }))} fullWidth />
        <TextField label={exportMasterCopy.colDescriptionEn} value={htsCodeForm.descriptionEn} onChange={(e) => setHtsCodeForm((p) => ({ ...p, descriptionEn: e.target.value }))} fullWidth />
        <TextField label={exportMasterCopy.colDescriptionJa} value={htsCodeForm.descriptionJa} onChange={(e) => setHtsCodeForm((p) => ({ ...p, descriptionJa: e.target.value }))} fullWidth />
        <Select
          label={exportMasterCopy.colActive}
          value={htsCodeForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setHtsCodeForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={activeSelectOptions}
          fullWidth
        />
      </div>
      {saveActions(handleSaveHtsCode)}
    </div>
  );

  const materialInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <TextField label={exportMasterCopy.colMaterialNameEn} value={materialForm.nameEn} onChange={(e) => setMaterialForm((p) => ({ ...p, nameEn: e.target.value }))} fullWidth />
        <TextField label={exportMasterCopy.colMaterialNameJa} value={materialForm.nameJa} onChange={(e) => setMaterialForm((p) => ({ ...p, nameJa: e.target.value }))} fullWidth />
        <Select
          label={exportMasterCopy.colActive}
          value={materialForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setMaterialForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={activeSelectOptions}
          fullWidth
        />
      </div>
      {saveActions(handleSaveMaterial)}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title={exportMasterCopy.title} subtitle={exportMasterCopy.subtitle} />
      <Card>
        {loading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={exportMasterCopy.loading} />
            {exportMasterCopy.loading}
          </StatusMessage>
        )}
        {!loading && loadError !== undefined && (
          <StatusMessage variant="error">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>{exportMasterCopy.retry}</Button>
          </StatusMessage>
        )}
        {!loading && loadError === undefined && (
          <>
            <Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} aria-label={exportMasterCopy.title} />

            {/* items tab */}
            {activeTab === 'items' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setItemForm(EMPTY_ITEM_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {exportMasterCopy.btnAddNew}
                  </Button>
                </div>
                {items.length === 0
                  ? <EmptyState title={exportMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={exportMasterCopy.tabItems}
                      columns={itemColumns}
                      rows={items}
                      rowKey={(r) => r.itemId}
                      onRowClick={(r) => {
                        if (editingId === r.itemId) { closeForm(); return; }
                        setEditingId(r.itemId);
                        setItemForm(itemToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && itemInlineForm}
              </div>
            )}

            {/* htsCodes tab */}
            {activeTab === 'htsCodes' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setHtsCodeForm(EMPTY_HTS_CODE_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {exportMasterCopy.btnAddNew}
                  </Button>
                </div>
                {htsCodes.length === 0
                  ? <EmptyState title={exportMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={exportMasterCopy.tabHtsCodes}
                      columns={htsCodeColumns}
                      rows={htsCodes}
                      rowKey={(r) => r.htsCodeId}
                      onRowClick={(r) => {
                        if (editingId === r.htsCodeId) { closeForm(); return; }
                        setEditingId(r.htsCodeId);
                        setHtsCodeForm(htsCodeToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && htsCodeInlineForm}
              </div>
            )}

            {/* materials tab */}
            {activeTab === 'materials' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setMaterialForm(EMPTY_MATERIAL_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {exportMasterCopy.btnAddNew}
                  </Button>
                </div>
                {materials.length === 0
                  ? <EmptyState title={exportMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={exportMasterCopy.tabMaterials}
                      columns={materialColumns}
                      rows={materials}
                      rowKey={(r) => r.materialId}
                      onRowClick={(r) => {
                        if (editingId === r.materialId) { closeForm(); return; }
                        setEditingId(r.materialId);
                        setMaterialForm(materialToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && materialInlineForm}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
