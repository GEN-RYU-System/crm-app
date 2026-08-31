import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, DataTable, EmptyState, PageHeader, Select, Spinner, StatusMessage, Tabs, TextField,
} from '../../components/ui';
import type { DataTableColumn, TabItem } from '../../components/ui';
import { ownMasterCopy } from '../../content/ja/ownMaster';
import {
  getCoreOwnCategories, getCoreOwnWorks, getCoreOwnManufacturers,
  upsertCoreOwnCategory, upsertCoreOwnWork, upsertCoreOwnManufacturer,
  type OwnCategoryRecord, type OwnWorkRecord, type OwnManufacturerRecord,
} from '../../gas/client';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type MasterTab = 'categories' | 'works' | 'manufacturers';

const TABS: ReadonlyArray<TabItem<MasterTab>> = [
  { key: 'categories',    label: ownMasterCopy.tabCategories },
  { key: 'works',         label: ownMasterCopy.tabWorks },
  { key: 'manufacturers', label: ownMasterCopy.tabManufacturers },
];

// ─── Form state types ─────────────────────────────────────────────────────────

type OwnMasterForm = { nameEn: string; nameJa: string; isActive: boolean };

const EMPTY_FORM: OwnMasterForm = { nameEn: '', nameJa: '', isActive: true };

function categoryToForm(r: OwnCategoryRecord): OwnMasterForm {
  return { nameEn: r.nameEn, nameJa: r.nameJa, isActive: r.isActive === 'TRUE' };
}
function workToForm(r: OwnWorkRecord): OwnMasterForm {
  return { nameEn: r.nameEn, nameJa: r.nameJa, isActive: r.isActive === 'TRUE' };
}
function manufacturerToForm(r: OwnManufacturerRecord): OwnMasterForm {
  return { nameEn: r.nameEn, nameJa: r.nameJa, isActive: r.isActive === 'TRUE' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnMasterPage() {
  const [activeTab, setActiveTab] = useState<MasterTab>('categories');

  // Data
  const [categories,    setCategories]    = useState<OwnCategoryRecord[]>([]);
  const [works,         setWorks]         = useState<OwnWorkRecord[]>([]);
  const [manufacturers, setManufacturers] = useState<OwnManufacturerRecord[]>([]);

  // Load state
  const [loadError, setLoadError] = useState<string | undefined>();
  const [loading,   setLoading]   = useState(true);

  // Inline edit state
  const [editingId,   setEditingId]   = useState<string | 'new' | null>(null);
  const [form,        setForm]        = useState<OwnMasterForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | undefined>();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const closeForm = () => {
    setEditingId(null);
    setSaveError(undefined);
    setSaveSuccess(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [cats, wrks, mfrs] = await Promise.all([
        getCoreOwnCategories(), getCoreOwnWorks(), getCoreOwnManufacturers(),
      ]);
      setCategories(cats);
      setWorks(wrks);
      setManufacturers(mfrs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : ownMasterCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Close form when tab changes
  useEffect(() => { closeForm(); }, [activeTab]);

  // ─── Save handlers ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      if (activeTab === 'categories') {
        const payload = {
          ...(editingId !== 'new' && editingId !== null ? { categoryId: editingId } : {}),
          nameEn:   form.nameEn,
          nameJa:   form.nameJa,
          isActive: form.isActive,
        };
        await upsertCoreOwnCategory(payload);
      } else if (activeTab === 'works') {
        const payload = {
          ...(editingId !== 'new' && editingId !== null ? { workId: editingId } : {}),
          nameEn:   form.nameEn,
          nameJa:   form.nameJa,
          isActive: form.isActive,
        };
        await upsertCoreOwnWork(payload);
      } else {
        const payload = {
          ...(editingId !== 'new' && editingId !== null ? { manufacturerId: editingId } : {}),
          nameEn:   form.nameEn,
          nameJa:   form.nameJa,
          isActive: form.isActive,
        };
        await upsertCoreOwnManufacturer(payload);
      }
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : ownMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ─── DataTable columns ───────────────────────────────────────────────────────

  const categoryColumns: DataTableColumn<OwnCategoryRecord>[] = [
    { key: 'categoryId', header: ownMasterCopy.colId,     renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.categoryId}</span> },
    { key: 'nameEn',     header: ownMasterCopy.colNameEn, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',     header: ownMasterCopy.colNameJa, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',     header: ownMasterCopy.colActive, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : ownMasterCopy.inactiveLabel}</span> },
  ];

  const workColumns: DataTableColumn<OwnWorkRecord>[] = [
    { key: 'workId',  header: ownMasterCopy.colId,     renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.workId}</span> },
    { key: 'nameEn',  header: ownMasterCopy.colNameEn, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',  header: ownMasterCopy.colNameJa, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',  header: ownMasterCopy.colActive, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : ownMasterCopy.inactiveLabel}</span> },
  ];

  const manufacturerColumns: DataTableColumn<OwnManufacturerRecord>[] = [
    { key: 'manufacturerId', header: ownMasterCopy.colId,     renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.manufacturerId}</span> },
    { key: 'nameEn',         header: ownMasterCopy.colNameEn, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',         header: ownMasterCopy.colNameJa, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',         header: ownMasterCopy.colActive, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : ownMasterCopy.inactiveLabel}</span> },
  ];

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const inlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <TextField
          label={ownMasterCopy.colNameEn}
          value={form.nameEn}
          onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
          fullWidth
        />
        <TextField
          label={ownMasterCopy.colNameJa}
          value={form.nameJa}
          onChange={(e) => setForm((p) => ({ ...p, nameJa: e.target.value }))}
          fullWidth
        />
        <Select
          label={ownMasterCopy.colActive}
          value={form.isActive ? 'TRUE' : ''}
          onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: ownMasterCopy.activeLabel }, { value: '', label: ownMasterCopy.inactiveSelectLabel }]}
          fullWidth
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        {saveSuccess && <p role="status" style={{ color: 'var(--color-success, green)', margin: 0 }}>{ownMasterCopy.saveSuccess}</p>}
        {saveError && <StatusMessage variant="error">{saveError}</StatusMessage>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving} loadingText={ownMasterCopy.saving}>
            {ownMasterCopy.btnSave}
          </Button>
          <Button variant="ghost" onClick={closeForm}>{ownMasterCopy.btnCancel}</Button>
        </div>
      </div>
    </div>
  );

  const openNewForm = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setSaveError(undefined);
    setSaveSuccess(false);
  };

  const addNewButton = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
      <Button variant="secondary" size="sm" onClick={openNewForm}>
        {ownMasterCopy.btnAddNew}
      </Button>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title={ownMasterCopy.title} subtitle={ownMasterCopy.subtitle} />
      <Card>
        {loading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={ownMasterCopy.loading} />
            {ownMasterCopy.loading}
          </StatusMessage>
        )}
        {!loading && loadError !== undefined && (
          <StatusMessage variant="error">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>{ownMasterCopy.retry}</Button>
          </StatusMessage>
        )}
        {!loading && loadError === undefined && (
          <>
            <Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} aria-label={ownMasterCopy.title} />

            {/* categories tab */}
            {activeTab === 'categories' && (
              <div style={{ marginTop: '1rem' }}>
                {addNewButton}
                {categories.length === 0
                  ? <EmptyState title={ownMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={ownMasterCopy.tabCategories}
                      columns={categoryColumns}
                      rows={categories}
                      rowKey={(r) => r.categoryId}
                      onRowClick={(r) => {
                        if (editingId === r.categoryId) { closeForm(); return; }
                        setEditingId(r.categoryId);
                        setForm(categoryToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && inlineForm}
              </div>
            )}

            {/* works tab */}
            {activeTab === 'works' && (
              <div style={{ marginTop: '1rem' }}>
                {addNewButton}
                {works.length === 0
                  ? <EmptyState title={ownMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={ownMasterCopy.tabWorks}
                      columns={workColumns}
                      rows={works}
                      rowKey={(r) => r.workId}
                      onRowClick={(r) => {
                        if (editingId === r.workId) { closeForm(); return; }
                        setEditingId(r.workId);
                        setForm(workToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && inlineForm}
              </div>
            )}

            {/* manufacturers tab */}
            {activeTab === 'manufacturers' && (
              <div style={{ marginTop: '1rem' }}>
                {addNewButton}
                {manufacturers.length === 0
                  ? <EmptyState title={ownMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={ownMasterCopy.tabManufacturers}
                      columns={manufacturerColumns}
                      rows={manufacturers}
                      rowKey={(r) => r.manufacturerId}
                      onRowClick={(r) => {
                        if (editingId === r.manufacturerId) { closeForm(); return; }
                        setEditingId(r.manufacturerId);
                        setForm(manufacturerToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && inlineForm}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
