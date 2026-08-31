import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, DataTable, EmptyState, PageHeader, Spinner, StatusMessage, Tabs, TextField, Select,
} from '../../components/ui';
import type { DataTableColumn, TabItem } from '../../components/ui';
import { packageMasterCopy } from '../../content/ja/packageMaster';
import {
  getCoreSizes, getCoreWeights, getCorePackages, getCorePackageUnitOptions,
  upsertCoreSize, upsertCoreWeight, upsertCorePackage,
  type SizeRecord, type WeightRecord, type PackageRecord,
} from '../../gas/client';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type MasterTab = 'sizes' | 'weights' | 'packages';

const TABS: ReadonlyArray<TabItem<MasterTab>> = [
  { key: 'sizes',    label: packageMasterCopy.tabSizes },
  { key: 'weights',  label: packageMasterCopy.tabWeights },
  { key: 'packages', label: packageMasterCopy.tabPackages },
];

// ─── Form state types ─────────────────────────────────────────────────────────

type SizeForm = { sizeName: string; length: string; width: string; height: string; isActive: boolean };
type WeightForm = { weightName: string; weight: string; isActive: boolean };
type PackageForm = { packageName: string; unit: string; quantityPerUnit: string; sizeId: string; weightId: string; isActive: boolean };

const EMPTY_SIZE_FORM: SizeForm = { sizeName: '', length: '', width: '', height: '', isActive: true };
const EMPTY_WEIGHT_FORM: WeightForm = { weightName: '', weight: '', isActive: true };
const EMPTY_PACKAGE_FORM: PackageForm = { packageName: '', unit: '', quantityPerUnit: '', sizeId: '', weightId: '', isActive: true };

function sizeToForm(r: SizeRecord): SizeForm {
  return { sizeName: r.sizeName, length: r.length, width: r.width, height: r.height, isActive: r.isActive === 'TRUE' };
}
function weightToForm(r: WeightRecord): WeightForm {
  return { weightName: r.weightName, weight: r.weight, isActive: r.isActive === 'TRUE' };
}
function packageToForm(r: PackageRecord): PackageForm {
  return { packageName: r.packageName, unit: r.unit, quantityPerUnit: r.quantityPerUnit, sizeId: r.sizeId, weightId: r.weightId, isActive: r.isActive === 'TRUE' };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function sizeLabel(r: SizeRecord): string {
  if (r.length || r.width || r.height) return `${r.sizeName} (${r.length}x${r.width}x${r.height})`;
  return r.sizeName;
}
function weightLabel(r: WeightRecord): string {
  return r.weight ? `${r.weightName} (${r.weight}kg)` : r.weightName;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PackageMasterPage() {
  const [activeTab, setActiveTab] = useState<MasterTab>('sizes');

  // Data
  const [sizes,       setSizes]       = useState<SizeRecord[]>([]);
  const [weights,     setWeights]     = useState<WeightRecord[]>([]);
  const [packages,    setPackages]    = useState<PackageRecord[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);

  // Load state
  const [loadError, setLoadError]     = useState<string | undefined>();
  const [loading,   setLoading]       = useState(true);

  // Inline edit state
  const [editingId,     setEditingId]     = useState<string | 'new' | null>(null);
  const [sizeForm,      setSizeForm]      = useState<SizeForm>(EMPTY_SIZE_FORM);
  const [weightForm,    setWeightForm]    = useState<WeightForm>(EMPTY_WEIGHT_FORM);
  const [packageForm,   setPackageForm]   = useState<PackageForm>(EMPTY_PACKAGE_FORM);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState<string | undefined>();
  const [saveSuccess,   setSaveSuccess]   = useState(false);

  const closeForm = () => {
    setEditingId(null);
    setSaveError(undefined);
    setSaveSuccess(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [s, w, p, u] = await Promise.all([
        getCoreSizes(), getCoreWeights(), getCorePackages(), getCorePackageUnitOptions(),
      ]);
      setSizes(s);
      setWeights(w);
      setPackages(p);
      setUnitOptions(u);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : packageMasterCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Close form when tab changes
  useEffect(() => { closeForm(); }, [activeTab]);

  // ─── Save handlers ─────────────────────────────────────────────────────────

  const handleSaveSize = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { sizeId: editingId } : {}),
        sizeName: sizeForm.sizeName,
        length:   sizeForm.length,
        width:    sizeForm.width,
        height:   sizeForm.height,
        isActive: sizeForm.isActive,
      };
      await upsertCoreSize(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : packageMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeight = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { weightId: editingId } : {}),
        weightName: weightForm.weightName,
        weight:     weightForm.weight,
        isActive:   weightForm.isActive,
      };
      await upsertCoreWeight(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : packageMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePackage = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(editingId !== 'new' && editingId !== null ? { packageId: editingId } : {}),
        packageName:     packageForm.packageName,
        unit:            packageForm.unit,
        quantityPerUnit: packageForm.quantityPerUnit,
        sizeId:          packageForm.sizeId,
        weightId:        packageForm.weightId,
        isActive:        packageForm.isActive,
      };
      await upsertCorePackage(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : packageMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ─── DataTable columns ─────────────────────────────────────────────────────

  const sizeColumns: DataTableColumn<SizeRecord>[] = [
    { key: 'sizeId',   header: packageMasterCopy.colSizeId,   renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.sizeId}</span> },
    { key: 'sizeName', header: packageMasterCopy.colSizeName, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.sizeName}</span> },
    { key: 'dims',     header: `${packageMasterCopy.colLength} / ${packageMasterCopy.colWidth} / ${packageMasterCopy.colHeight}`, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{`${r.length} / ${r.width} / ${r.height}`}</span> },
    { key: 'active',   header: packageMasterCopy.colActive,   renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : packageMasterCopy.inactiveLabel}</span> },
  ];

  const weightColumns: DataTableColumn<WeightRecord>[] = [
    { key: 'weightId',   header: packageMasterCopy.colWeightId,   renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.weightId}</span> },
    { key: 'weightName', header: packageMasterCopy.colWeightName, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.weightName}</span> },
    { key: 'weight',     header: packageMasterCopy.colWeightValue, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.weight}</span> },
    { key: 'active',     header: packageMasterCopy.colActive,     renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : packageMasterCopy.inactiveLabel}</span> },
  ];

  const packageColumns: DataTableColumn<PackageRecord>[] = [
    { key: 'packageId',   header: packageMasterCopy.colPackageId,   renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.packageId}</span> },
    { key: 'packageName', header: packageMasterCopy.colPackageName, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.packageName}</span> },
    { key: 'unit',        header: packageMasterCopy.colUnit,        renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.unit}</span> },
    { key: 'quantity',    header: packageMasterCopy.colQuantity,    renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.quantityPerUnit}</span> },
    { key: 'size',        header: packageMasterCopy.colSize,        renderCell: (r) => { const s = sizes.find((x) => x.sizeId === r.sizeId); return <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{s ? sizeLabel(s) : r.sizeName}</span>; } },
    { key: 'weight',      header: packageMasterCopy.colWeightRef,   renderCell: (r) => { const w = weights.find((x) => x.weightId === r.weightId); return <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{w ? weightLabel(w) : r.weightName}</span>; } },
    { key: 'active',      header: packageMasterCopy.colActive,      renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : packageMasterCopy.inactiveLabel}</span> },
  ];

  // ─── Render helpers ────────────────────────────────────────────────────────

  const saveActions = (onSave: () => Promise<void>) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
      {saveSuccess && <p role="status" style={{ color: 'var(--color-success, green)', margin: 0 }}>{packageMasterCopy.saveSuccess}</p>}
      {saveError && <StatusMessage variant="error">{saveError}</StatusMessage>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="primary" onClick={() => void onSave()} loading={saving} loadingText={packageMasterCopy.saving}>
          {packageMasterCopy.btnSave}
        </Button>
        <Button variant="ghost" onClick={closeForm}>{packageMasterCopy.btnCancel}</Button>
      </div>
    </div>
  );

  const sizeInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <TextField label={packageMasterCopy.colSizeName} value={sizeForm.sizeName} onChange={(e) => setSizeForm((p) => ({ ...p, sizeName: e.target.value }))} fullWidth />
        <TextField label={packageMasterCopy.colLength} type="number" value={sizeForm.length} onChange={(e) => setSizeForm((p) => ({ ...p, length: e.target.value }))} fullWidth />
        <TextField label={packageMasterCopy.colWidth}  type="number" value={sizeForm.width}  onChange={(e) => setSizeForm((p) => ({ ...p, width:  e.target.value }))} fullWidth />
        <TextField label={packageMasterCopy.colHeight} type="number" value={sizeForm.height} onChange={(e) => setSizeForm((p) => ({ ...p, height: e.target.value }))} fullWidth />
        <Select
          label={packageMasterCopy.colActive}
          value={sizeForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setSizeForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: packageMasterCopy.activeLabel }, { value: '', label: packageMasterCopy.inactiveSelectLabel }]}
          fullWidth
        />
      </div>
      {saveActions(handleSaveSize)}
    </div>
  );

  const weightInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <TextField label={packageMasterCopy.colWeightName} value={weightForm.weightName} onChange={(e) => setWeightForm((p) => ({ ...p, weightName: e.target.value }))} fullWidth />
        <TextField label={packageMasterCopy.colWeightValue} type="number" value={weightForm.weight} onChange={(e) => setWeightForm((p) => ({ ...p, weight: e.target.value }))} fullWidth />
        <Select
          label={packageMasterCopy.colActive}
          value={weightForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setWeightForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: packageMasterCopy.activeLabel }, { value: '', label: packageMasterCopy.inactiveSelectLabel }]}
          fullWidth
        />
      </div>
      {saveActions(handleSaveWeight)}
    </div>
  );

  const activeSizes   = sizes.filter((s) => s.isActive === 'TRUE');
  const activeWeights = weights.filter((w) => w.isActive === 'TRUE');

  const packageInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <TextField label={packageMasterCopy.colPackageName} value={packageForm.packageName} onChange={(e) => setPackageForm((p) => ({ ...p, packageName: e.target.value }))} fullWidth />
        <Select
          label={packageMasterCopy.colUnit}
          value={packageForm.unit}
          onChange={(e) => setPackageForm((p) => ({ ...p, unit: e.target.value }))}
          placeholder={packageMasterCopy.selectPlaceholder}
          options={unitOptions.map((u) => ({ value: u, label: u }))}
          fullWidth
        />
        <TextField label={packageMasterCopy.colQuantity} type="number" value={packageForm.quantityPerUnit} onChange={(e) => setPackageForm((p) => ({ ...p, quantityPerUnit: e.target.value }))} fullWidth />
        <Select
          label={packageMasterCopy.colSize}
          value={packageForm.sizeId}
          onChange={(e) => setPackageForm((p) => ({ ...p, sizeId: e.target.value }))}
          placeholder={packageMasterCopy.selectPlaceholder}
          options={activeSizes.map((s) => ({ value: s.sizeId, label: sizeLabel(s) }))}
          fullWidth
        />
        <Select
          label={packageMasterCopy.colWeightRef}
          value={packageForm.weightId}
          onChange={(e) => setPackageForm((p) => ({ ...p, weightId: e.target.value }))}
          placeholder={packageMasterCopy.selectPlaceholder}
          options={activeWeights.map((w) => ({ value: w.weightId, label: weightLabel(w) }))}
          fullWidth
        />
        <Select
          label={packageMasterCopy.colActive}
          value={packageForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setPackageForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: packageMasterCopy.activeLabel }, { value: '', label: packageMasterCopy.inactiveSelectLabel }]}
          fullWidth
        />
      </div>
      {saveActions(handleSavePackage)}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title={packageMasterCopy.title} subtitle={packageMasterCopy.subtitle} />
      <Card>
        {loading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={packageMasterCopy.loading} />
            {packageMasterCopy.loading}
          </StatusMessage>
        )}
        {!loading && loadError !== undefined && (
          <StatusMessage variant="error">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>{packageMasterCopy.retry}</Button>
          </StatusMessage>
        )}
        {!loading && loadError === undefined && (
          <>
            <Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} aria-label={packageMasterCopy.title} />

            {/* size tab */}
            {activeTab === 'sizes' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setSizeForm(EMPTY_SIZE_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {packageMasterCopy.btnAddNew}
                  </Button>
                </div>
                {sizes.length === 0
                  ? <EmptyState title={packageMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={packageMasterCopy.tabSizes}
                      columns={sizeColumns}
                      rows={sizes}
                      rowKey={(r) => r.sizeId}
                      onRowClick={(r) => {
                        if (editingId === r.sizeId) { closeForm(); return; }
                        setEditingId(r.sizeId);
                        setSizeForm(sizeToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && sizeInlineForm}
              </div>
            )}

            {/* weight tab */}
            {activeTab === 'weights' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setWeightForm(EMPTY_WEIGHT_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {packageMasterCopy.btnAddNew}
                  </Button>
                </div>
                {weights.length === 0
                  ? <EmptyState title={packageMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={packageMasterCopy.tabWeights}
                      columns={weightColumns}
                      rows={weights}
                      rowKey={(r) => r.weightId}
                      onRowClick={(r) => {
                        if (editingId === r.weightId) { closeForm(); return; }
                        setEditingId(r.weightId);
                        setWeightForm(weightToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && weightInlineForm}
              </div>
            )}

            {/* package tab */}
            {activeTab === 'packages' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditingId('new'); setPackageForm(EMPTY_PACKAGE_FORM); setSaveError(undefined); setSaveSuccess(false); }}>
                    {packageMasterCopy.btnAddNew}
                  </Button>
                </div>
                {packages.length === 0
                  ? <EmptyState title={packageMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={packageMasterCopy.tabPackages}
                      columns={packageColumns}
                      rows={packages}
                      rowKey={(r) => r.packageId}
                      onRowClick={(r) => {
                        if (editingId === r.packageId) { closeForm(); return; }
                        setEditingId(r.packageId);
                        setPackageForm(packageToForm(r));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && packageInlineForm}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
