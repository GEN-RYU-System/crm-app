import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname, dirname } from 'node:path';

const frontendDir = resolve(import.meta.dirname, '..');
const srcDir = resolve(frontendDir, 'src');
const violations = [];
async function files(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat(); }
function hasRawDeclaration(source, property, allowed = []) { const pattern = new RegExp(`${property}\\s*:\\s*([^;}]+)`, 'gi'); return [...source.matchAll(pattern)].some((match) => { const value = match[1].trim(); return !value.startsWith('var(') && !allowed.includes(value) && value !== '0' && !value.startsWith('0 '); }); }
const sourceFiles = await files(srcDir);
for (const file of sourceFiles) { if (extname(file) !== '.css' || file.endsWith('/styles/palette.css')) continue; const source = await readFile(file, 'utf8'); const raw = /#[0-9a-f]{3,8}\b/i.test(source) || /\b(?:rgb|hsl)a?\(/i.test(source) || hasRawDeclaration(source, 'box-shadow', ['none']) || hasRawDeclaration(source, 'border-radius') || ['margin', 'padding', 'gap'].some((property) => hasRawDeclaration(source, property)); if (raw) violations.push(`raw design value: ${relative(frontendDir, file)}`); }
// 未定義 CSS トークン検査（対象: frontend/src/ 全体）
const tokenDefinitionFiles = [
  resolve(frontendDir, 'src/styles/tokens.css'),
  resolve(frontendDir, 'src/styles/palette.css'),
];
const definedTokens = new Set();
for (const tf of tokenDefinitionFiles) {
  const src = await readFile(tf, 'utf8');
  for (const m of src.matchAll(/(--[\w-]+)\s*:/g)) definedTokens.add(m[1]);
}
// --ui-skeleton-table-columns: 呼び出し元が値を渡すコンポーネントAPIのため除外
const INTENTIONALLY_UNDEFINED_TOKENS = new Set(['--ui-skeleton-table-columns']);
const allCssFiles = sourceFiles.filter((f) => extname(f) === '.css');
for (const file of allCssFiles) {
  const src = await readFile(file, 'utf8');
  for (const m of src.matchAll(/var\((--[\w-]+)/g)) {
    if (!m[1].startsWith('--_') && !INTENTIONALLY_UNDEFINED_TOKENS.has(m[1]) && !definedTokens.has(m[1]))
      violations.push(`undefined CSS token: ${m[1]} in ${relative(frontendDir, file)}`);
  }
}
for (const file of await files(resolve(srcDir, 'pages'))) { if (!['.ts', '.tsx'].includes(extname(file))) continue; if ((await readFile(file, 'utf8')).includes('palette.css')) violations.push(`page imports palette directly: ${relative(frontendDir, file)}`); }
const navigationFile = resolve(srcDir, 'app/navigation.ts'); const navigationSource = await readFile(navigationFile, 'utf8'); const navigationRoutes = [...navigationSource.matchAll(/hash:\s*'([^']+)'/g)].map((match) => match[1]); for (const item of navigationRoutes) { for (const file of sourceFiles) { if (file === navigationFile || !['.ts', '.tsx'].includes(extname(file))) continue; if ((await readFile(file, 'utf8')).includes(`'${item}'`) || (await readFile(file, 'utf8')).includes(`"${item}"`)) violations.push(`navigation route duplicated outside navigation.ts: ${relative(frontendDir, file)}`); } }
if (!navigationSource.includes('NAVIGATION_GROUPS') || !navigationSource.includes('NAVIGATION_ITEMS')) violations.push('navigation.ts does not export grouped navigation SSOT');
if (/icon\s*:\s*['"][^'"]*[^\x00-\x7F][^'"]*['"]/.test(navigationSource)) violations.push('navigation.ts contains a Unicode symbol icon instead of a CRM_NAV_ICONS key');
const uiIndexSource = await readFile(resolve(srcDir, 'components/ui/index.ts'), 'utf8'); const catalogSource = await readFile(resolve(srcDir, 'pages/catalog/ComponentCatalogPage.tsx'), 'utf8'); const exportedComponents = [...uiIndexSource.matchAll(/export\s+(?!type\s)\{\s*([A-Z][a-zA-Z]+)\s*\}\s+from/g)].map((m) => m[1]); if (exportedComponents.length === 0) violations.push('components/ui/index.ts has no exported components — regex may be broken'); for (const component of exportedComponents) { if (!catalogSource.includes(`<${component}`)) violations.push(`${component} is not registered in the component catalog`); }
const sidebarNavSource = await readFile(resolve(srcDir, 'components/shell/SidebarNav.tsx'), 'utf8'); if (sidebarNavSource.includes('SidebarAccordion')) violations.push('SidebarNav still uses the removed inline SidebarAccordion pattern');
const dataManagementSource = await readFile(resolve(srcDir, 'pages/data-management/DataManagementPage.tsx'), 'utf8'); if (!dataManagementSource.includes('<HubShell') || !dataManagementSource.includes('<SubMenu')) violations.push('Data management hub does not use HubShell and SubMenu');
const nonHubIds = new Set(['dashboard', 'inbox', 'salesOrders', 'dataManagement', 'components', 'inventory']); const activeHubIds = [...navigationSource.matchAll(/\{\s*id:\s*'([^']+)'[^\n}]*state:\s*'(?:available|preview)'[^\n}]*\}/g)].map((m) => m[1]).filter((id) => !nonHubIds.has(id)); if (activeHubIds.length === 0) violations.push('hub route check: no active DATA_MANAGEMENT_ITEMS detected — regex may be broken or navigation.ts structure changed'); const appSource = await readFile(resolve(srcDir, 'App.tsx'), 'utf8'); const hubIndexMatch = appSource.match(/const hubIndexRoutes[^=]*=\s*\{([^}]+)\}/s); const registeredHubIds = hubIndexMatch ? [...hubIndexMatch[1].matchAll(/^\s*(\w+):/mg)].map((m) => m[1]) : []; for (const id of activeHubIds) { if (!registeredHubIds.includes(id)) violations.push(`hub route not registered in hubIndexRoutes: ${id}`); }
const createListCacheSource = await readFile(resolve(srcDir, 'app/createListCache.tsx'), 'utf8');
if (/from ['"].*gas\/client/.test(createListCacheSource)) violations.push('createListCache must not import from gas/client directly');
const dashboardContractsSource = await readFile(resolve(srcDir, 'features/dashboard/contracts.ts'), 'utf8');
const dashboardGasAdapterSource = await readFile(resolve(srcDir, 'features/dashboard/gasAdapter.ts'), 'utf8');
const dashboardPageSource = await readFile(resolve(srcDir, 'pages/dashboard/DashboardPage.tsx'), 'utf8');
if (!dashboardContractsSource.includes('DashboardRepository')) violations.push('dashboard feature does not declare DashboardRepository');
if (!dashboardGasAdapterSource.includes('dashboardGasRepository')) violations.push('dashboard feature does not provide GAS repository');
if (!dashboardGasAdapterSource.includes("from '../../gas/client'")) violations.push('dashboard GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(dashboardPageSource) || !dashboardPageSource.includes('DashboardKpis')) violations.push('dashboard page bypasses the DashboardRepository boundary');
const customerContractsSource = await readFile(resolve(srcDir, 'features/customers/contracts.ts'), 'utf8');
const customerGasAdapterSource = await readFile(resolve(srcDir, 'features/customers/gasAdapter.ts'), 'utf8');
const customerPageSources = await Promise.all(['pages/customers/CustomerListPage.tsx', 'pages/customers/CustomerDetailPage.tsx'].map((file) => readFile(resolve(srcDir, file), 'utf8')));
if (!customerContractsSource.includes('CustomerRepository')) violations.push('customers feature does not declare CustomerRepository');
if (!customerGasAdapterSource.includes('customerGasRepository')) violations.push('customers feature does not provide GAS repository');
if (!customerGasAdapterSource.includes("from '../../gas/client'")) violations.push('customers GAS repository bypasses the typed GAS client');
for (const source of customerPageSources) if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(source) || (!source.includes('CustomerRepository') && !source.includes('CustomerListCacheContext'))) violations.push('customers page bypasses the CustomerRepository boundary');
const inboxContractsSource = await readFile(resolve(srcDir, 'features/inbox/contracts.ts'), 'utf8');
const inboxGasAdapterSource = await readFile(resolve(srcDir, 'features/inbox/gasAdapter.ts'), 'utf8');
const inboxPageSource = await readFile(resolve(srcDir, 'pages/inbox/InboxPreviewPage.tsx'), 'utf8');
if (!inboxContractsSource.includes('InboxRepository')) violations.push('inbox feature does not declare InboxRepository');
if (!inboxGasAdapterSource.includes('inboxGasRepository')) violations.push('inbox feature does not provide GAS repository');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(inboxPageSource) || !inboxPageSource.includes('InboxRepository')) violations.push('inbox page bypasses the InboxRepository boundary');
const inventoryContractsSource = await readFile(resolve(srcDir, 'features/inventory/contracts.ts'), 'utf8');
const inventoryGasAdapterSource = await readFile(resolve(srcDir, 'features/inventory/gasAdapter.ts'), 'utf8');
const inventoryPageSource = await readFile(resolve(srcDir, 'pages/inventory/InventoryListPage.tsx'), 'utf8');
if (!inventoryContractsSource.includes('InventoryRepository')) violations.push('inventory feature does not declare InventoryRepository');
if (!inventoryGasAdapterSource.includes('inventoryGasRepository')) violations.push('inventory feature does not provide GAS repository');
if (!inventoryGasAdapterSource.includes("from '../../gas/client'")) violations.push('inventory GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(inventoryPageSource) || (!inventoryPageSource.includes('InventoryRepository') && !inventoryPageSource.includes('InventoryListCacheContext'))) violations.push('inventory page bypasses the InventoryRepository boundary');
const orderContractsSource = await readFile(resolve(srcDir, 'features/orders/contracts.ts'), 'utf8');
const orderGasAdapterSource = await readFile(resolve(srcDir, 'features/orders/gasAdapter.ts'), 'utf8');
const orderPageSource = await readFile(resolve(srcDir, 'pages/orders/OrderListPage.tsx'), 'utf8');
if (!orderContractsSource.includes('OrderRepository')) violations.push('orders feature does not declare OrderRepository');
if (!orderGasAdapterSource.includes('orderGasRepository')) violations.push('orders feature does not provide GAS repository');
if (!orderGasAdapterSource.includes("from '../../gas/client'")) violations.push('orders GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(orderPageSource) || (!orderPageSource.includes('OrderRepository') && !orderPageSource.includes('OrderListCacheContext'))) violations.push('orders page bypasses the OrderRepository boundary');
const leadContractsSource = await readFile(resolve(srcDir, 'features/leads/contracts.ts'), 'utf8');
const leadGasAdapterSource = await readFile(resolve(srcDir, 'features/leads/gasAdapter.ts'), 'utf8');
const leadEditorPageSource = await readFile(resolve(srcDir, 'pages/leads/LeadEditorPage.tsx'), 'utf8');
if (!leadContractsSource.includes('LeadRepository')) violations.push('leads feature does not declare LeadRepository');
if (!leadGasAdapterSource.includes('leadGasRepository')) violations.push('leads feature does not provide GAS repository');
if (!leadGasAdapterSource.includes("from '../../gas/client'")) violations.push('leads GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(leadEditorPageSource) || !leadEditorPageSource.includes('LeadRepository')) violations.push('lead editor page bypasses the LeadRepository boundary');
const staffContractsSource = await readFile(resolve(srcDir, 'features/staff/contracts.ts'), 'utf8');
const staffGasAdapterSource = await readFile(resolve(srcDir, 'features/staff/gasAdapter.ts'), 'utf8');
const staffPageSource = await readFile(resolve(srcDir, 'pages/staff/StaffListPage.tsx'), 'utf8');
if (!staffContractsSource.includes('StaffRepository')) violations.push('staff feature does not declare StaffRepository');
if (!staffGasAdapterSource.includes('staffGasRepository')) violations.push('staff feature does not provide GAS repository');
if (!staffGasAdapterSource.includes("from '../../gas/client'")) violations.push('staff GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(staffPageSource) || (!staffPageSource.includes('StaffRepository') && !staffPageSource.includes('StaffListCacheContext'))) violations.push('staff page bypasses the StaffRepository boundary');
const quoteContractsSource = await readFile(resolve(srcDir, 'features/quotes/contracts.ts'), 'utf8');
const quoteGasAdapterSource = await readFile(resolve(srcDir, 'features/quotes/gasAdapter.ts'), 'utf8');
const quoteListPageSource = await readFile(resolve(srcDir, 'pages/quotes/QuoteListPage.tsx'), 'utf8');
if (!quoteContractsSource.includes('QuoteRepository')) violations.push('quotes feature does not declare QuoteRepository');
if (!quoteGasAdapterSource.includes('quoteGasRepository')) violations.push('quotes feature does not provide GAS repository');
if (!quoteGasAdapterSource.includes("from '../../gas/client'")) violations.push('quotes GAS repository bypasses the typed GAS client');
if (/google\.script\.run|gas\/client|localStorage|sessionStorage/.test(quoteListPageSource) || (!quoteListPageSource.includes('QuoteRepository') && !quoteListPageSource.includes('QuoteListCacheContext'))) violations.push('quotes list page bypasses the QuoteRepository boundary');
const copySourceFiles = [resolve(srcDir, 'components/ui/Button/Button.tsx'), resolve(srcDir, 'components/ui/Spinner/Spinner.tsx'), resolve(srcDir, 'components/ui/Skeleton/Skeleton.tsx'), resolve(srcDir, 'pages/dashboard/DashboardPage.tsx'), resolve(srcDir, 'pages/catalog/ComponentCatalogPage.tsx'), resolve(srcDir, 'app/navigation.ts'), resolve(srcDir, 'gas/client.ts'), resolve(srcDir, 'components/shell/SidebarNav.tsx'), resolve(srcDir, 'components/shell/MobileHeader.tsx')]; const copyLiterals = ['読み込み中', 'ダッシュボード', '金型カタログ', '共通金型の見本帳', 'サーバーとの通信に失敗しました。', 'Apps Script の画面として開いてください。', 'React POC navigation']; for (const file of copySourceFiles) { const source = await readFile(file, 'utf8'); for (const literal of copyLiterals) if (source.includes(literal)) violations.push(`copy literal outside content/ja: ${relative(frontendDir, file)}`); } for (const file of sourceFiles) { if (!file.includes('/components/ui/')) continue; if ((await readFile(file, 'utf8')).includes('/content/ja')) violations.push(`UI component imports copy content: ${relative(frontendDir, file)}`); }
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/u; const copyDir = resolve(srcDir, 'content/ja'); const rootErrorFile = resolve(srcDir, 'main.tsx'); for (const file of sourceFiles) { if (!['.ts', '.tsx'].includes(extname(file)) || file.startsWith(copyDir)) continue; const source = await readFile(file, 'utf8'); if (file === rootErrorFile) { const withoutRootError = source.replace(/throw new Error\('[^']*'\);/, ''); if (japanese.test(withoutRootError)) violations.push(`Japanese copy outside content/ja: ${relative(frontendDir, file)}`); continue; } if (japanese.test(source)) violations.push(`Japanese copy outside content/ja: ${relative(frontendDir, file)}`); }
const artifact = resolve(frontendDir, '../src/ReactPoc.html'); const dist = resolve(frontendDir, 'dist/index.html'); const [artifactSource, distSource] = await Promise.all([readFile(artifact, 'utf8'), readFile(dist, 'utf8')]);
if (artifactSource.includes('Warning: truncated output')) violations.push('generated artifact includes truncation warning'); if (artifactSource !== distSource) violations.push('generated artifact differs from frontend/dist/index.html'); if (/<(?:script|link)\b[^>]+(?:src|href)=/i.test(artifactSource)) violations.push('generated artifact references an external JS/CSS asset');
// --- Unused source file detection ---
const checkConfig = JSON.parse(await readFile(resolve(frontendDir, 'scripts/check-design-system-config.json'), 'utf8'));
const unusedCfg = checkConfig.unusedFilesCheck ?? {};
const unusedEntryPoints = new Set([
  ...(unusedCfg.entryPoints ?? []).map((p) => resolve(frontendDir, p)),
  ...(unusedCfg.excludedFiles ?? []).map((e) => resolve(frontendDir, e.path)),
]);
const tsSourceFiles = sourceFiles.filter((f) => {
  const ext = extname(f);
  return (ext === '.ts' || ext === '.tsx') && !f.endsWith('.d.ts');
});
const tsSourceFileSet = new Set(tsSourceFiles);
const importedFiles = new Set();
for (const file of tsSourceFiles) {
  const src = await readFile(file, 'utf8');
  const dir = dirname(file);
  const paths = [
    ...[...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ];
  for (const p of paths) {
    if (!p.startsWith('.')) continue;
    const base = resolve(dir, p);
    for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (tsSourceFileSet.has(base + suffix)) { importedFiles.add(base + suffix); break; }
    }
  }
}
for (const file of tsSourceFiles) {
  if (importedFiles.has(file) || unusedEntryPoints.has(file)) continue;
  violations.push(`unused source file (not imported from anywhere): ${relative(frontendDir, file)}`);
}
// --- Component usage registry check ---
function importsComponentFromUI(source, component) {
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]*components\/ui['"]/g;
  return [...source.matchAll(importRegex)].some((m) =>
    m[1].split(',').map((s) => s.trim()).includes(component)
  );
}
const usageRules = (checkConfig.componentUsageCheck ?? {}).rules ?? [];
for (const rule of usageRules) {
  const { component, pages } = rule;
  for (const pageName of pages) {
    const pageDir = resolve(srcDir, 'pages', pageName);
    const pageFiles = (await files(pageDir)).filter((f) => ['.ts', '.tsx'].includes(extname(f)));
    const sources = await Promise.all(pageFiles.map((f) => readFile(f, 'utf8')));
    if (!sources.some((src) => importsComponentFromUI(src, component))) {
      violations.push(`component usage: ${component} is not imported in pages/${pageName}/ — update usage or component-usage config`);
    }
  }
}
// ─── Cache design template enforcement ────────────────────────────────────────
// 対象外:
//   features/customers/CustomerAggregateCacheContext.tsx は pages/*/ の外なので検査1の対象外。

// 検査1: pages/*/*CacheContext.tsx はすべて createListCache を import していること
const cacheContextFiles = (await files(resolve(srcDir, 'pages'))).filter((f) => f.endsWith('CacheContext.tsx'));
if (cacheContextFiles.length === 0) violations.push('cache template check: no *CacheContext.tsx found under pages/ — directory structure may have changed');
for (const file of cacheContextFiles) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('createListCache')) violations.push(`CacheContext does not use createListCache: ${relative(frontendDir, file)}`);
}

// 検査2・3: App.tsx の *CacheProvider ごとに usePrefetch・SyncPoller への実登録を解析する
// (a) 命名拡大: *ListCacheProvider から *CacheProvider 全般に拡大
// (b) 実登録解析: 文字列包含ではなく、フック返値が steps.load / refreshers の値として
//     実際に使われているかを解析する

/** フック呼び出しから分割代入された変数（エイリアス名）一覧を返す。
 *  例: const { ensureLoaded: ensureIssuer } = useIssuerMasterCache()
 *      → ['ensureIssuer']
 *      const { prefetchBulk } = useInboxConversationDetailCache()
 *      → ['prefetchBulk']
 */
function extractHookVars(source, hookName) {
  const m = source.match(new RegExp(`const\\s+\\{([^}]+)\\}\\s*=\\s*${hookName}\\(\\s*\\)`));
  if (!m) return [];
  return m[1].split(',').map(s => {
    s = s.trim();
    const colon = s.indexOf(':');
    // 'foo: alias' → 'alias'; 'foo' → 'foo'
    return ((colon > -1 ? s.slice(colon + 1) : s).trim().split(/\s+/)[0] ?? '');
  }).filter(Boolean);
}

/** usePrefetch.ts の steps 配列の load ラムダにフックの変数が使われているか解析する */
function isRegisteredInSteps(prefetchSrc, hookName) {
  const vars = extractHookVars(prefetchSrc, hookName);
  if (vars.length === 0) return false;
  // `load: () => ...varName...` パターンを検索（最大300文字以内で変数を探す）
  return vars.some(v =>
    new RegExp(`load:\\s*\\(\\)\\s*=>\\s*[\\s\\S]{0,300}?\\b${v}\\b`).test(prefetchSrc)
  );
}

/** App.tsx の SyncPoller refreshers（useMemo）の本体にフックの変数が使われているか解析する */
function isRegisteredInRefreshers(appSrc, hookName) {
  const vars = extractHookVars(appSrc, hookName);
  if (vars.length === 0) return false;
  // refreshers = useMemo<T>(() => ({ ... }), [...]) の本体を抽出
  const m = appSrc.match(/const\s+refreshers\s*=\s*useMemo[\s\S]*?\(\s*\(\s*\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*,\s*\[/);
  if (!m) return false;
  const body = m[1];
  return vars.some(v => new RegExp(`\\b${v}\\b`).test(body));
}

// 除外リスト: 意図的に登録が省略されているProvider
const PREFETCH_EXEMPT_PROVIDERS = new Set([
  // 詳細系キャッシュ: ページ遷移後にオンデマンドで呼ぶため steps への登録不要
  'CustomerDetailCacheProvider',
  'LeadDetailCacheProvider',
  'SalesOrderDetailCacheProvider',
  // DashboardKpiCacheProvider: AppRouter 内で ensureLoaded を直接呼ぶため usePrefetch 登録不要
  'DashboardKpiCacheProvider',
]);
const SYNC_POLLER_EXEMPT_PROVIDERS = new Set([
  // CustomerAggregateCacheProvider: SyncPoller には接続せず usePrefetch のみで管理
  'CustomerAggregateCacheProvider',
  // CurrencyMasterCacheProvider: 静的マスタのため refreshers 登録不要（usePrefetch のみで管理）
  'CurrencyMasterCacheProvider',
]);
const prefetchSource = await readFile(resolve(srcDir, 'app/usePrefetch.ts'), 'utf8');
const allCacheProviderNames = [...new Set([...appSource.matchAll(/<(\w+CacheProvider)[\s>/]/g)].map((m) => m[1]))];
if (allCacheProviderNames.length === 0) violations.push('cache template check: no *CacheProvider found in App.tsx — regex may be broken');
for (const providerName of allCacheProviderNames) {
  const hookName = 'use' + providerName.replace('Provider', '');
  // 検査2: usePrefetch.ts の steps.load にフックの変数が実登録されているか解析する
  if (!PREFETCH_EXEMPT_PROVIDERS.has(providerName) && !isRegisteredInSteps(prefetchSource, hookName)) {
    violations.push(`${providerName} is not registered in usePrefetch steps (no load: lambda references ${hookName} vars)`);
  }
  // 検査3: App.tsx の SyncPoller refreshers にフックの変数が実登録されているか解析する
  if (!SYNC_POLLER_EXEMPT_PROVIDERS.has(providerName) && !isRegisteredInRefreshers(appSource, hookName)) {
    violations.push(`${providerName} is not registered in SyncPoller refreshers (no refreshers value references ${hookName} vars)`);
  }
}

// ─── (c) pages/ 配下での直接 GAS 呼び出し禁止 ─────────────────────────────────
// pages/ 配下の .tsx ファイルで gas/client から関数（型以外）を import することを禁止する。
// *CacheContext.tsx は自身がキャッシュ層なので除外。
// 許可リスト（allowlist）: 既存コードの違反で段階的移行中のもの、またはキャッシュ不要な境界
const GAS_CLIENT_IN_PAGES_ALLOWLIST = new Set([
  // 保存系・認証系: キャッシュ層に属さない正当な直接呼び出し（Context 経由に移行するまで許可）
  'src/pages/quotes/QuoteEditorPage.tsx',     // createCoreQuote / updateCoreQuote / getCoreQuoteDetail (save+read)
  'src/pages/quotes/LeadCombobox.tsx',        // type-only import (LeadOption)
  'src/pages/auth/ChangePasswordPage.tsx',    // changeOwnPasswordForFrontend (auth boundary)
  'src/pages/data-management/IssuerMasterPage.tsx', // updateCoreIssuer (save operation)
  'src/pages/orders/OrderDetailPage.tsx',     // type-only import (IssuerRecord)
  'src/pages/orders/OrderEditorPage.tsx',     // getCoreOrderDetail for invoice print preview (same pattern as OrderDetailPage)
  'src/pages/sales-orders/SalesOrderDetailPage.tsx', // confirmCoreOrderPayment / upsertCorePurchase (save+action)
]);
const pagesDir = resolve(srcDir, 'pages');
const pagesTsxFiles = (await files(pagesDir)).filter((f) => extname(f) === '.tsx' && !f.endsWith('CacheContext.tsx'));
for (const file of pagesTsxFiles) {
  const relPath = relative(frontendDir, file);
  if (GAS_CLIENT_IN_PAGES_ALLOWLIST.has(relPath)) continue;
  const source = await readFile(file, 'utf8');
  if (/google\.script\.run/.test(source)) {
    violations.push(`direct google.script.run in pages/: ${relPath} — use a Repository or CacheContext instead`);
  }
  // gas/client import: 型のみ（import type または type-only named import）は許可
  const gasImportMatch = source.match(/^import\s+(?!type\s)\{([^}]+)\}\s+from\s+['"][^'"]*gas\/client['"]/m);
  if (gasImportMatch) {
    // named import に型以外（関数・定数）が含まれるか確認
    const namedImports = gasImportMatch[1].split(',').map((s) => s.trim());
    const hasValueImport = namedImports.some((s) => !s.startsWith('type '));
    if (hasValueImport) {
      violations.push(`direct gas/client import in pages/: ${relPath} — use a Repository or CacheContext instead`);
    }
  }
}

// --- Feature component usage check (重複帳票コンポーネント再発防止) ---
function importsFeatureComponent(source, component, importPath) {
  const imported = new RegExp(`from\\s+['"][^'"]*${importPath}['"]`).test(source);
  const usedAsJsx = source.includes(`<${component}`);
  const usedAsCall = source.includes(`${component}(`);
  return imported && (usedAsJsx || usedAsCall);
}
const featureUsageRules = (checkConfig.featureComponentUsageCheck ?? {}).rules ?? [];
for (const rule of featureUsageRules) {
  const { component, importPath, pages } = rule;
  for (const pageName of pages) {
    const pageDir = resolve(srcDir, 'pages', pageName);
    const pageFiles = (await files(pageDir)).filter((f) => ['.ts', '.tsx'].includes(extname(f)));
    const sources = await Promise.all(pageFiles.map((f) => readFile(f, 'utf8')));
    if (!sources.some((src) => importsFeatureComponent(src, component, importPath))) {
      violations.push(`feature component usage: ${component} (${importPath}) is not used in pages/${pageName}/ — update usage or remove from featureComponentUsageCheck config`);
    }
  }
}

if (violations.length) { console.error(violations.join('\n')); process.exit(1); } console.log('design-system checks passed');
