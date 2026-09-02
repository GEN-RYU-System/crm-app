import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, DataTable, EmptyState, PageHeader, Select, Spinner, StatusMessage, Tabs, TextField,
} from '../../components/ui';
import type { DataTableColumn, TabItem } from '../../components/ui';
import { productMasterCopy } from '../../content/ja/productMaster';
import {
  getCoreSharedProducts, getCoreProductPackages, upsertCoreProductPackage,
  getCoreOwnProducts, upsertCoreOwnProductWithPackage, getCorePackages,
  getCoreOwnCategories, getCoreOwnWorks, getCoreOwnManufacturers,
  getCoreItems, getCoreHtsCodes, getCoreMaterials,
  type SharedProductRecord, type ProductPackageRecord, type OwnProductRecord, type PackageRecord,
  type OwnCategoryRecord, type OwnWorkRecord, type OwnManufacturerRecord,
  type ItemRecord, type HtsCodeRecord, type MaterialRecord,
} from '../../gas/client';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ProductTab = 'shared' | 'own';

const TABS: ReadonlyArray<TabItem<ProductTab>> = [
  { key: 'shared', label: productMasterCopy.tabShared },
  { key: 'own',    label: productMasterCopy.tabOwn },
];

// ─── Form state types ─────────────────────────────────────────────────────────

type PackageAssignForm = {
  productPackageId: string;
  casePackageId: string; boxPackageId: string; packPackageId: string;
  itemId: string; htsCodeId: string; materialId: string;
  isActive: boolean;
};

type OwnProductForm = {
  ownProductId: string;
  sharedProductId: string; nameEn: string; nameJa: string;
  ownCategoryId: string; ownWorkId: string; ownManufacturerId: string;
  note: string; isActive: boolean;
  // package fields
  productPackageId: string;
  casePackageId: string; boxPackageId: string; packPackageId: string;
  itemId: string; htsCodeId: string; materialId: string;
  pkgIsActive: boolean;
};

const EMPTY_PKG_FORM: PackageAssignForm = {
  productPackageId: '',
  casePackageId: '', boxPackageId: '', packPackageId: '',
  itemId: '', htsCodeId: '', materialId: '',
  isActive: true,
};

const EMPTY_OWN_FORM: OwnProductForm = {
  ownProductId: '',
  sharedProductId: '', nameEn: '', nameJa: '',
  ownCategoryId: '', ownWorkId: '', ownManufacturerId: '',
  note: '', isActive: true,
  productPackageId: '',
  casePackageId: '', boxPackageId: '', packPackageId: '',
  itemId: '', htsCodeId: '', materialId: '',
  pkgIsActive: true,
};

function packageLabel(r: PackageRecord): string {
  const parts: string[] = [r.packageName];
  if (r.unit) parts.push(r.unit);
  if (r.quantityPerUnit) parts.push(`${r.quantityPerUnit}${productMasterCopy.perUnitSuffix}`);
  return parts.join(' · ');
}

function pkgAssignToForm(pp: ProductPackageRecord): PackageAssignForm {
  return {
    productPackageId: pp.productPackageId,
    casePackageId:  pp.casePackageId,
    boxPackageId:   pp.boxPackageId,
    packPackageId:  pp.packPackageId,
    itemId:         pp.itemId,
    htsCodeId:      pp.htsCodeId,
    materialId:     pp.materialId,
    isActive:       pp.isActive === 'TRUE',
  };
}

function ownProductToForm(r: OwnProductRecord, pp: ProductPackageRecord | null): OwnProductForm {
  return {
    ownProductId:      r.ownProductId,
    sharedProductId:   r.sharedProductId,
    nameEn:            r.nameEn,
    nameJa:            r.nameJa,
    ownCategoryId:     r.ownCategoryId,
    ownWorkId:         r.ownWorkId,
    ownManufacturerId: r.ownManufacturerId,
    note:              r.note,
    isActive:          r.isActive === 'TRUE',
    productPackageId:  pp ? pp.productPackageId : '',
    casePackageId:     pp ? pp.casePackageId  : '',
    boxPackageId:      pp ? pp.boxPackageId   : '',
    packPackageId:     pp ? pp.packPackageId  : '',
    itemId:            pp ? pp.itemId         : '',
    htsCodeId:         pp ? pp.htsCodeId      : '',
    materialId:        pp ? pp.materialId     : '',
    pkgIsActive:       pp ? pp.isActive === 'TRUE' : true,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductMasterPage() {
  const [activeTab, setActiveTab] = useState<ProductTab>('shared');

  // Data
  const [sharedProducts,  setSharedProducts]  = useState<SharedProductRecord[]>([]);
  const [productPackages, setProductPackages] = useState<ProductPackageRecord[]>([]);
  const [ownProducts,     setOwnProducts]     = useState<OwnProductRecord[]>([]);
  const [packages,        setPackages]        = useState<PackageRecord[]>([]);
  const [categories,      setCategories]      = useState<OwnCategoryRecord[]>([]);
  const [works,           setWorks]           = useState<OwnWorkRecord[]>([]);
  const [manufacturers,   setManufacturers]   = useState<OwnManufacturerRecord[]>([]);
  const [items,           setItems]           = useState<ItemRecord[]>([]);
  const [htsCodes,        setHtsCodes]        = useState<HtsCodeRecord[]>([]);
  const [materials,       setMaterials]       = useState<MaterialRecord[]>([]);

  // Load state
  const [loadError, setLoadError] = useState<string | undefined>();
  const [loading,   setLoading]   = useState(true);

  // Search
  const [sharedSearch, setSharedSearch] = useState('');
  const [ownSearch,    setOwnSearch]    = useState('');

  // Inline edit state
  const [editingId,     setEditingId]   = useState<string | 'new' | null>(null);
  const [pkgForm,       setPkgForm]     = useState<PackageAssignForm>(EMPTY_PKG_FORM);
  const [ownForm,       setOwnForm]     = useState<OwnProductForm>(EMPTY_OWN_FORM);
  const [saving,        setSaving]      = useState(false);
  const [saveError,     setSaveError]   = useState<string | undefined>();
  const [saveSuccess,   setSaveSuccess] = useState(false);

  const closeForm = () => {
    setEditingId(null);
    setSaveError(undefined);
    setSaveSuccess(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [sp, pp, op, pkgs, cats, wrks, mfrs, itms, hts, mats] = await Promise.all([
        getCoreSharedProducts(),
        getCoreProductPackages(),
        getCoreOwnProducts(),
        getCorePackages(),
        getCoreOwnCategories(),
        getCoreOwnWorks(),
        getCoreOwnManufacturers(),
        getCoreItems(),
        getCoreHtsCodes(),
        getCoreMaterials(),
      ]);
      setSharedProducts(sp);
      setProductPackages(pp);
      setOwnProducts(op);
      setPackages(pkgs);
      setCategories(cats);
      setWorks(wrks);
      setManufacturers(mfrs);
      setItems(itms);
      setHtsCodes(hts);
      setMaterials(mats);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : productMasterCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { closeForm(); }, [activeTab]);

  // ─── Derived data ───────────────────────────────────────────────────────────

  // shared product ID → product package index
  const pkgBySharedId = useMemo(() => {
    const m: Record<string, ProductPackageRecord> = {};
    productPackages.forEach((pp) => { if (pp.sharedProductId) m[pp.sharedProductId] = pp; });
    return m;
  }, [productPackages]);

  // own product ID → product package index
  const pkgByOwnId = useMemo(() => {
    const m: Record<string, ProductPackageRecord> = {};
    productPackages.forEach((pp) => { if (pp.ownProductId) m[pp.ownProductId] = pp; });
    return m;
  }, [productPackages]);

  const activePackages      = useMemo(() => packages.filter((p) => p.isActive === 'TRUE'), [packages]);
  const activeCategories    = useMemo(() => categories.filter((c) => c.isActive === 'TRUE'), [categories]);
  const activeWorks         = useMemo(() => works.filter((w) => w.isActive === 'TRUE'), [works]);
  const activeManufacturers = useMemo(() => manufacturers.filter((m) => m.isActive === 'TRUE'), [manufacturers]);
  const activeItems         = useMemo(() => items.filter((i) => i.isActive === 'TRUE'), [items]);
  const activeHtsCodes      = useMemo(() => htsCodes.filter((h) => h.isActive === 'TRUE'), [htsCodes]);
  const activeMaterials     = useMemo(() => materials.filter((m) => m.isActive === 'TRUE'), [materials]);

  const filteredShared = useMemo(() => {
    const q = sharedSearch.trim().toLowerCase();
    if (!q) return sharedProducts;
    return sharedProducts.filter((r) =>
      r.productId.toLowerCase().includes(q) ||
      r.englishTitle.toLowerCase().includes(q) ||
      r.japaneseTitle.toLowerCase().includes(q)
    );
  }, [sharedProducts, sharedSearch]);

  const filteredOwn = useMemo(() => {
    const q = ownSearch.trim().toLowerCase();
    if (!q) return ownProducts;
    return ownProducts.filter((r) =>
      r.ownProductId.toLowerCase().includes(q) ||
      r.nameEn.toLowerCase().includes(q) ||
      r.nameJa.toLowerCase().includes(q)
    );
  }, [ownProducts, ownSearch]);

  // ─── Save handlers ──────────────────────────────────────────────────────────

  const handleSaveShared = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    try {
      const payload = {
        ...(pkgForm.productPackageId ? { productPackageId: pkgForm.productPackageId } : {}),
        sharedProductId: editingId !== 'new' && editingId !== null ? editingId : undefined,
        casePackageId:  pkgForm.casePackageId,
        boxPackageId:   pkgForm.boxPackageId,
        packPackageId:  pkgForm.packPackageId,
        itemId:         pkgForm.itemId,
        htsCodeId:      pkgForm.htsCodeId,
        materialId:     pkgForm.materialId,
        isActive:       pkgForm.isActive,
      };
      await upsertCoreProductPackage(payload);
      setSaveSuccess(true);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : productMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOwn = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSaveSuccess(false);
    const hasPackageField = ownForm.casePackageId || ownForm.boxPackageId || ownForm.packPackageId ||
      ownForm.itemId || ownForm.htsCodeId || ownForm.materialId || ownForm.productPackageId;
    try {
      const result = await upsertCoreOwnProductWithPackage({
        product: {
          ...(ownForm.ownProductId ? { ownProductId: ownForm.ownProductId } : {}),
          sharedProductId:   ownForm.sharedProductId || undefined,
          nameEn:            ownForm.nameEn,
          nameJa:            ownForm.nameJa,
          ownCategoryId:     ownForm.ownCategoryId || undefined,
          ownWorkId:         ownForm.ownWorkId || undefined,
          ownManufacturerId: ownForm.ownManufacturerId || undefined,
          note:              ownForm.note,
          isActive:          ownForm.isActive,
        },
        ...(hasPackageField ? {
          package: {
            ...(ownForm.productPackageId ? { productPackageId: ownForm.productPackageId } : {}),
            casePackageId:  ownForm.casePackageId || undefined,
            boxPackageId:   ownForm.boxPackageId  || undefined,
            packPackageId:  ownForm.packPackageId  || undefined,
            itemId:         ownForm.itemId        || undefined,
            htsCodeId:      ownForm.htsCodeId     || undefined,
            materialId:     ownForm.materialId    || undefined,
            isActive:       ownForm.pkgIsActive,
          },
        } : {}),
      });
      if (result.failedStep) {
        setSaveError(`${productMasterCopy.saveErrorPartial}${result.failedStep})`);
      } else {
        setSaveSuccess(true);
        await loadAll();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : productMasterCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ─── DataTable columns ──────────────────────────────────────────────────────

  const sharedColumns: DataTableColumn<SharedProductRecord>[] = [
    { key: 'productId',     header: productMasterCopy.colProductId,     renderCell: (r) => r.productId },
    { key: 'englishTitle',  header: productMasterCopy.colEnglishTitle,  renderCell: (r) => r.englishTitle },
    { key: 'japaneseTitle', header: productMasterCopy.colJapaneseTitle, renderCell: (r) => r.japaneseTitle },
    { key: 'category',      header: productMasterCopy.colCategory,      renderCell: (r) => r.category },
    {
      key: 'hasPackage',
      header: productMasterCopy.colHasPackage,
      renderCell: (r) => {
        const hasPkg = Boolean(pkgBySharedId[r.productId]);
        return <span style={{ color: hasPkg ? 'var(--color-success, green)' : 'var(--color-text-secondary, #888)' }}>
          {hasPkg ? productMasterCopy.hasPackageYes : productMasterCopy.hasPackageNo}
        </span>;
      },
    },
  ];

  const ownColumns: DataTableColumn<OwnProductRecord>[] = [
    { key: 'ownProductId', header: productMasterCopy.colOwnProductId, renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.ownProductId}</span> },
    { key: 'nameEn',       header: productMasterCopy.colNameEn,       renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameEn}</span> },
    { key: 'nameJa',       header: productMasterCopy.colNameJa,       renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.nameJa}</span> },
    { key: 'active',       header: productMasterCopy.colActive,       renderCell: (r) => <span style={r.isActive !== 'TRUE' ? { opacity: 0.4 } : {}}>{r.isActive === 'TRUE' ? '✓' : productMasterCopy.inactiveLabel}</span> },
  ];

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const saveActions = (onSave: () => Promise<void>) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
      {saveSuccess && <p role="status" style={{ color: 'var(--color-success, green)', margin: 0 }}>{productMasterCopy.saveSuccess}</p>}
      {saveError && <StatusMessage variant="error">{saveError}</StatusMessage>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="primary" onClick={() => void onSave()} loading={saving} loadingText={productMasterCopy.saving}>
          {productMasterCopy.btnSave}
        </Button>
        <Button variant="ghost" onClick={closeForm}>{productMasterCopy.btnCancel}</Button>
      </div>
    </div>
  );

  const packageOptions  = activePackages.map((p) => ({ value: p.packageId, label: packageLabel(p) }));
  const itemOptions     = activeItems.map((i) => ({ value: i.itemId, label: i.nameJa || i.nameEn }));
  const htsCodeOptions  = activeHtsCodes.map((h) => ({ value: h.htsCodeId, label: h.htsCode + (h.descriptionJa || h.descriptionEn ? ' — ' + (h.descriptionJa || h.descriptionEn) : '') }));
  const materialOptions = activeMaterials.map((m) => ({ value: m.materialId, label: m.nameJa || m.nameEn }));

  const sharedInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <Select label={productMasterCopy.labelCasePackage} value={pkgForm.casePackageId}
          onChange={(e) => setPkgForm((p) => ({ ...p, casePackageId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
        <Select label={productMasterCopy.labelBoxPackage} value={pkgForm.boxPackageId}
          onChange={(e) => setPkgForm((p) => ({ ...p, boxPackageId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
        <Select label={productMasterCopy.labelPackPackage} value={pkgForm.packPackageId}
          onChange={(e) => setPkgForm((p) => ({ ...p, packPackageId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
        <Select label={productMasterCopy.labelItem} value={pkgForm.itemId}
          onChange={(e) => setPkgForm((p) => ({ ...p, itemId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={itemOptions} fullWidth />
        <Select label={productMasterCopy.labelHtsCode} value={pkgForm.htsCodeId}
          onChange={(e) => setPkgForm((p) => ({ ...p, htsCodeId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={htsCodeOptions} fullWidth />
        <Select label={productMasterCopy.labelMaterial} value={pkgForm.materialId}
          onChange={(e) => setPkgForm((p) => ({ ...p, materialId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={materialOptions} fullWidth />
        <Select
          label={productMasterCopy.colActive}
          value={pkgForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setPkgForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: productMasterCopy.activeLabel }, { value: '', label: productMasterCopy.inactiveSelectLabel }]}
          fullWidth
        />
      </div>
      {saveActions(handleSaveShared)}
    </div>
  );

  const categoryOptions     = activeCategories.map((c) => ({ value: c.categoryId, label: c.nameJa || c.nameEn }));
  const workOptions         = activeWorks.map((w) => ({ value: w.workId, label: w.nameJa || w.nameEn }));
  const manufacturerOptions = activeManufacturers.map((m) => ({ value: m.manufacturerId, label: m.nameJa || m.nameEn }));
  const sharedProductOptions = sharedProducts.map((r) => ({
    value: r.productId,
    label: r.japaneseTitle ? `${r.japaneseTitle} (${r.productId})` : `${r.englishTitle} (${r.productId})`,
  }));

  const ownInlineForm = (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-secondary, #f8f8f8)', borderRadius: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <TextField label={productMasterCopy.colNameEn} value={ownForm.nameEn}
          onChange={(e) => setOwnForm((p) => ({ ...p, nameEn: e.target.value }))} fullWidth />
        <TextField label={productMasterCopy.colNameJa} value={ownForm.nameJa}
          onChange={(e) => setOwnForm((p) => ({ ...p, nameJa: e.target.value }))} fullWidth />
        <Select label={productMasterCopy.colActive} value={ownForm.isActive ? 'TRUE' : ''}
          onChange={(e) => setOwnForm((p) => ({ ...p, isActive: e.target.value === 'TRUE' }))}
          options={[{ value: 'TRUE', label: productMasterCopy.activeLabel }, { value: '', label: productMasterCopy.inactiveSelectLabel }]}
          fullWidth />
        <Select label={productMasterCopy.labelOwnCategory} value={ownForm.ownCategoryId}
          onChange={(e) => setOwnForm((p) => ({ ...p, ownCategoryId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={categoryOptions} fullWidth />
        <Select label={productMasterCopy.labelOwnWork} value={ownForm.ownWorkId}
          onChange={(e) => setOwnForm((p) => ({ ...p, ownWorkId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={workOptions} fullWidth />
        <Select label={productMasterCopy.labelOwnManufacturer} value={ownForm.ownManufacturerId}
          onChange={(e) => setOwnForm((p) => ({ ...p, ownManufacturerId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={manufacturerOptions} fullWidth />
        <Select label={productMasterCopy.labelSharedProduct} value={ownForm.sharedProductId}
          onChange={(e) => setOwnForm((p) => ({ ...p, sharedProductId: e.target.value }))}
          placeholder={productMasterCopy.selectPlaceholder} options={sharedProductOptions} fullWidth />
        <TextField label={productMasterCopy.labelMemo} value={ownForm.note}
          onChange={(e) => setOwnForm((p) => ({ ...p, note: e.target.value }))} fullWidth />
      </div>
      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border, #eee)', paddingTop: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Select label={productMasterCopy.labelCasePackage} value={ownForm.casePackageId}
            onChange={(e) => setOwnForm((p) => ({ ...p, casePackageId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
          <Select label={productMasterCopy.labelBoxPackage} value={ownForm.boxPackageId}
            onChange={(e) => setOwnForm((p) => ({ ...p, boxPackageId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
          <Select label={productMasterCopy.labelPackPackage} value={ownForm.packPackageId}
            onChange={(e) => setOwnForm((p) => ({ ...p, packPackageId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={packageOptions} fullWidth />
          <Select label={productMasterCopy.labelItem} value={ownForm.itemId}
            onChange={(e) => setOwnForm((p) => ({ ...p, itemId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={itemOptions} fullWidth />
          <Select label={productMasterCopy.labelHtsCode} value={ownForm.htsCodeId}
            onChange={(e) => setOwnForm((p) => ({ ...p, htsCodeId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={htsCodeOptions} fullWidth />
          <Select label={productMasterCopy.labelMaterial} value={ownForm.materialId}
            onChange={(e) => setOwnForm((p) => ({ ...p, materialId: e.target.value }))}
            placeholder={productMasterCopy.selectPlaceholder} options={materialOptions} fullWidth />
        </div>
      </div>
      {saveActions(handleSaveOwn)}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title={productMasterCopy.title} subtitle={productMasterCopy.subtitle} />
      <Card>
        {loading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={productMasterCopy.loading} />
            {productMasterCopy.loading}
          </StatusMessage>
        )}
        {!loading && loadError !== undefined && (
          <StatusMessage variant="error">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>{productMasterCopy.retry}</Button>
          </StatusMessage>
        )}
        {!loading && loadError === undefined && (
          <>
            <Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} aria-label={productMasterCopy.title} />

            {/* Shared products tab */}
            {activeTab === 'shared' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <TextField
                    label={productMasterCopy.search}
                    placeholder={productMasterCopy.searchPlaceholder}
                    value={sharedSearch}
                    onChange={(e) => setSharedSearch(e.target.value)}
                    fullWidth
                  />
                </div>
                {filteredShared.length === 0
                  ? <EmptyState title={productMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={productMasterCopy.tabShared}
                      columns={sharedColumns}
                      rows={filteredShared}
                      rowKey={(r) => r.productId}
                      onRowClick={(r) => {
                        if (editingId === r.productId) { closeForm(); return; }
                        const existing = pkgBySharedId[r.productId];
                        setEditingId(r.productId);
                        setPkgForm(existing ? pkgAssignToForm(existing) : { ...EMPTY_PKG_FORM });
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && sharedInlineForm}
              </div>
            )}

            {/* Own products tab */}
            {activeTab === 'own' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label={productMasterCopy.search}
                      placeholder={productMasterCopy.searchPlaceholder}
                      value={ownSearch}
                      onChange={(e) => setOwnSearch(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => {
                    setEditingId('new');
                    setOwnForm(EMPTY_OWN_FORM);
                    setSaveError(undefined);
                    setSaveSuccess(false);
                  }}>
                    {productMasterCopy.btnAddNew}
                  </Button>
                </div>
                {filteredOwn.length === 0
                  ? <EmptyState title={productMasterCopy.noData} />
                  : <DataTable
                      ariaLabel={productMasterCopy.tabOwn}
                      columns={ownColumns}
                      rows={filteredOwn}
                      rowKey={(r) => r.ownProductId}
                      onRowClick={(r) => {
                        if (editingId === r.ownProductId) { closeForm(); return; }
                        const pp = pkgByOwnId[r.ownProductId] ?? null;
                        setEditingId(r.ownProductId);
                        setOwnForm(ownProductToForm(r, pp));
                        setSaveError(undefined);
                        setSaveSuccess(false);
                      }}
                      surface="embedded"
                    />
                }
                {editingId !== null && ownInlineForm}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
