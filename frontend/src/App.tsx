import { type ReactNode, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { canAccessNavigationItem, DATA_MANAGEMENT_ITEMS, hasNavigationPermission, NAVIGATION_BY_ID, visibleDataManagementItems, visibleNavigationGroups, type NavigationItemId, type NavigationPermissions } from './app/navigation';
import { usePrefetch } from './app/usePrefetch';
import { useSyncPolling, type DomainRefreshers } from './app/useSyncPolling';
import { useLeadListCache } from './pages/leads/LeadListCacheContext';
import { useCustomerListCache } from './pages/customers/CustomerListCacheContext';
import { useInventoryListCache } from './pages/inventory/InventoryListCacheContext';
import { useOrderListCache } from './pages/orders/OrderListCacheContext';
import { useStaffListCache } from './pages/staff/StaffListCacheContext';
import { useQuoteListCache } from './pages/quotes/QuoteListCacheContext';
import { AppShell } from './components/shell';
import { Spinner, StatusMessage } from './components/ui';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getCurrentUser } from './gas/client';
import type { DashboardKpis } from './features/dashboard/contracts';
import { dashboardGasRepository } from './features/dashboard/gasAdapter';
import { ComponentCatalogPage } from './pages/catalog/ComponentCatalogPage';
import { customerGasRepository } from './features/customers/gasAdapter';
import { leadGasRepository } from './features/leads/gasAdapter';
import { staffGasRepository } from './features/staff/gasAdapter';
import { StaffListCacheProvider } from './pages/staff/StaffListCacheContext';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { CUSTOMER_ROUTE_SEGMENTS } from './pages/customers/customerConfig';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DataManagementPage } from './pages/data-management/DataManagementPage';
import { CustomerListCacheProvider } from './pages/customers/CustomerListCacheContext';
import { LeadListCacheProvider } from './pages/leads/LeadListCacheContext';
import { LeadEditorPage } from './pages/leads/LeadEditorPage';
import { LEAD_EDITOR_SEGMENTS } from './pages/leads/leadEditorConfig';
import { LeadListPage } from './pages/leads/LeadListPage';
import { InboxPreviewPage } from './pages/inbox/InboxPreviewPage';
import { InventoryListPage } from './pages/inventory/InventoryListPage';
import { InventoryListCacheProvider } from './pages/inventory/InventoryListCacheContext';
import { QuoteEditorPage } from './pages/quotes/QuoteEditorPage';
import { QuoteListPage } from './pages/quotes/QuoteListPage';
import { QuoteListCacheProvider } from './pages/quotes/QuoteListCacheContext';
import { QUOTE_ROUTE_SEGMENTS } from './pages/quotes/quoteListConfig';
import { OrderEditorPage } from './pages/orders/OrderEditorPage';
import { OrderListPage } from './pages/orders/OrderListPage';
import { OrderListCacheProvider } from './pages/orders/OrderListCacheContext';
import { ORDER_ROUTE_SEGMENTS } from './pages/orders/orderEditorConfig';
import { StaffListPage } from './pages/staff/StaffListPage';
import { CustomerAggregateCacheProvider } from './features/customers/CustomerAggregateCacheContext';
import { inboxPreviewRepository } from './features/inbox/previewAdapter';
import { inventoryGasRepository } from './features/inventory/gasAdapter';
import { orderGasRepository } from './features/orders/gasAdapter';
import { quoteGasRepository } from './features/quotes/gasAdapter';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SalesOrderListPage } from './pages/sales-orders/SalesOrderListPage';
import { SalesOrderListCacheProvider } from './pages/sales-orders/SalesOrderListCacheContext';
import { customersCopy, errorCopy, inboxCopy, leadsCopy, ordersCopy, quotesCopy, salesOrdersCopy, staffCopy } from './content/ja';
import { authCopy } from './content/ja/auth';

type LoadState = 'loading' | 'ready' | 'error';
type PermissionState =
  | { status: 'checking' }
  | { status: 'ready'; permissions: NavigationPermissions }
  | { status: 'failed' };

function LeadPermissionLoading() {
  return <StatusMessage variant="loading"><Spinner size="sm" aria-label={leadsCopy.permissionsChecking} />{leadsCopy.permissionsChecking}</StatusMessage>;
}

function CustomerPermissionLoading() {
  return <StatusMessage variant="loading"><Spinner size="sm" aria-label={customersCopy.loading} />{customersCopy.loading}</StatusMessage>;
}

function StaffPermissionLoading() {
  return <StatusMessage variant="loading"><Spinner size="sm" aria-label={staffCopy.loading} />{staffCopy.loading}</StatusMessage>;
}

/**
 * Polling component that lives for the entire authenticated session.
 * Mounted inside all CacheProviders, alongside AppShellWithPrefetch.
 * Unmounts with AppRouter on logout, so prevSignalsRef resets correctly on re-login.
 */
function SyncPoller() {
  const { refreshAll: refreshLeads } = useLeadListCache();
  const { refresh: refreshCustomers } = useCustomerListCache();
  const { refresh: refreshInventory } = useInventoryListCache();
  const { refresh: refreshOrders } = useOrderListCache();
  const { refresh: refreshStaff } = useStaffListCache();
  const { refresh: refreshQuotes } = useQuoteListCache();

  const refreshers = useMemo<DomainRefreshers>(() => ({
    leads:     () => refreshLeads(),
    customers: () => refreshCustomers(),
    inventory: () => refreshInventory(),
    orders:    () => refreshOrders(),
    staff:     () => refreshStaff(),
    quotes:    () => refreshQuotes(),
  }), [refreshLeads, refreshCustomers, refreshInventory, refreshOrders, refreshStaff, refreshQuotes]);

  useSyncPolling(refreshers);
  return null;
}

function AppShellWithPrefetch({ permissions, navigationGroups, children }: PropsWithChildren<{ permissions: NavigationPermissions | null; navigationGroups: ReturnType<typeof visibleNavigationGroups> }>) {
  usePrefetch(permissions);
  return <AppShell navigationGroups={navigationGroups}>{children}</AppShell>;
}

function AppContent() {
  const { state: authState } = useAuth();

  if (authState.status === 'checking') {
    return <StatusMessage variant="loading"><Spinner size="sm" aria-label={authCopy.sessionChecking} />{authCopy.sessionChecking}</StatusMessage>;
  }
  if (authState.status === 'unauthenticated') {
    return <LoginPage />;
  }

  // authState.status === 'authenticated'
  return <AppRouter />;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}

function AppRouter() {
  const [state, setState] = useState<LoadState>('loading');
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState('');
  const [permissionState, setPermissionState] = useState<PermissionState>({ status: 'checking' });
  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      setKpis(await dashboardGasRepository.getKpis());
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorCopy.genericLoad);
      setState('error');
    }
  }, []);
  const loadPermissions = useCallback(async () => {
    setPermissionState({ status: 'checking' });
    try {
      const user = await getCurrentUser();
      setPermissionState(user.success ? { status: 'ready', permissions: user.permissions } : { status: 'failed' });
    } catch {
      setPermissionState({ status: 'failed' });
    }
  }, []);
  useEffect(() => { void load(); void loadPermissions(); }, [load, loadPermissions]);

  const permissions = permissionState.status === 'ready' ? permissionState.permissions : null;
  const navigationGroups = visibleNavigationGroups(permissions);
  const dataManagementItems = visibleDataManagementItems(permissions);
  const canAccessLeads = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.leads, permissions);
  const canAccessCustomers = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.customers, permissions);
  const canAccessInbox = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.inbox, permissions);
  const canAccessStaff = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.staff, permissions);
  const canAccessQuotes = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions);
  const canAddQuotes = hasNavigationPermission(permissions, 'lead_add');
  const canEditQuotes = hasNavigationPermission(permissions, 'lead_edit');
  const canAccessOrders = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions);
  const canAddOrders = hasNavigationPermission(permissions, 'lead_add');
  const canAccessSalesOrders = permissionState.status === 'ready' && hasNavigationPermission(permissions, 'lead_view');
  const inventoryRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessLeads ? <InventoryListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const quotesRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={quotesCopy.permissionsChecking} />{quotesCopy.permissionsChecking}</StatusMessage> : canAccessQuotes ? <QuoteListPage canAdd={canAddQuotes} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const quoteCreateRoute = canAccessQuotes && canAddQuotes ? <QuoteEditorPage mode="create" canEdit={true} /> : <Navigate to={canAccessQuotes ? NAVIGATION_BY_ID.quotes.hash : NAVIGATION_BY_ID.dashboard.hash} replace />;
  const quoteDetailRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={quotesCopy.permissionsChecking} />{quotesCopy.permissionsChecking}</StatusMessage> : canAccessQuotes ? <QuoteEditorPage mode="detail" canEdit={canEditQuotes} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const ordersRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={ordersCopy.permissionsChecking} />{ordersCopy.permissionsChecking}</StatusMessage> : canAccessOrders ? <OrderListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const salesOrdersRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={salesOrdersCopy.permissionsChecking} />{salesOrdersCopy.permissionsChecking}</StatusMessage> : canAccessSalesOrders ? <SalesOrderListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const orderCreateRoute = canAccessOrders && canAddOrders
    ? <OrderEditorPage mode="create" repository={orderGasRepository} customerRepository={customerGasRepository} />
    : <Navigate to={canAccessOrders ? NAVIGATION_BY_ID.orders.hash : NAVIGATION_BY_ID.dashboard.hash} replace />;
  const canAddLeads = hasNavigationPermission(permissions, 'lead_add');
  const canEditLeads = hasNavigationPermission(permissions, 'lead_edit');
  const leadsRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessLeads ? <LeadListPage canAdd={canAddLeads} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const inboxRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={inboxCopy.loading} />{inboxCopy.loading}</StatusMessage> : canAccessInbox ? <InboxPreviewPage repository={inboxPreviewRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const createRoute = canAccessLeads && canAddLeads ? <LeadEditorPage mode="create" canEdit={false} repository={leadGasRepository} /> : <Navigate to={canAccessLeads ? NAVIGATION_BY_ID.leads.hash : NAVIGATION_BY_ID.dashboard.hash} replace />;
  const detailRoute = canAccessLeads ? <LeadEditorPage mode="detail" canEdit={canEditLeads} repository={leadGasRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const customersRoute = permissionState.status === 'checking' ? <CustomerPermissionLoading /> : canAccessCustomers ? <CustomerListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const staffRoute = permissionState.status === 'checking' ? <StaffPermissionLoading /> : canAccessStaff ? <StaffListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const customerDetailRoute = permissionState.status === 'checking' ? <CustomerPermissionLoading /> : canAccessCustomers ? <CustomerDetailPage repository={customerGasRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const dataManagementRoute = permissionState.status === 'checking'
    ? <LeadPermissionLoading />
    : canAccessLeads
      ? <DataManagementPage navigationItems={dataManagementItems} />
      : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;

  const hubIndexRoutes: Partial<Record<NavigationItemId, ReactNode>> = {
    leads: leadsRoute,
    customers: customersRoute,
    quotes: quotesRoute,
    orders: ordersRoute,
    inventory: inventoryRoute,
    staff: staffRoute
  };
  const hubExtraRoutes: Partial<Record<NavigationItemId, ReactNode[]>> = {
    leads: [
      <Route key="create" path={LEAD_EDITOR_SEGMENTS.create} element={createRoute} />,
      <Route key="detail" path={LEAD_EDITOR_SEGMENTS.detail} element={detailRoute} />
    ],
    customers: [
      <Route key="detail" path={CUSTOMER_ROUTE_SEGMENTS.detail} element={customerDetailRoute} />
    ],
    quotes: [
      <Route key="create" path={QUOTE_ROUTE_SEGMENTS.create} element={quoteCreateRoute} />,
      <Route key="detail" path={QUOTE_ROUTE_SEGMENTS.detail} element={quoteDetailRoute} />
    ],
    orders: [
      <Route key="create" path={ORDER_ROUTE_SEGMENTS.create} element={orderCreateRoute} />
    ]
  };

  return <HashRouter><LeadListCacheProvider><CustomerListCacheProvider repository={customerGasRepository}><InventoryListCacheProvider repository={inventoryGasRepository}><OrderListCacheProvider repository={orderGasRepository}><StaffListCacheProvider repository={staffGasRepository}><QuoteListCacheProvider repository={quoteGasRepository}><CustomerAggregateCacheProvider repository={customerGasRepository}><SalesOrderListCacheProvider><><SyncPoller /><AppShellWithPrefetch permissions={permissions} navigationGroups={navigationGroups}><Routes>
    <Route path={NAVIGATION_BY_ID.dashboard.hash} element={<DashboardPage kpis={kpis} state={state} error={error} onRefresh={() => void load()} />} />
    {DATA_MANAGEMENT_ITEMS
      .filter((item) => item.state !== 'planned' && hubIndexRoutes[item.id] != null)
      .map((item) => (
        <Route key={item.id} path={item.hash} element={dataManagementRoute}>
          <Route index element={hubIndexRoutes[item.id]} />
          {hubExtraRoutes[item.id]}
        </Route>
      ))}
    <Route path={NAVIGATION_BY_ID.inbox.hash} element={inboxRoute} />
    <Route path={NAVIGATION_BY_ID.salesOrders.hash} element={salesOrdersRoute} />
    <Route path="/leads-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/new-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/route-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/archive-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path={NAVIGATION_BY_ID.components.hash} element={<ComponentCatalogPage />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />
    <Route path="*" element={<Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />} />
  </Routes></AppShellWithPrefetch></></SalesOrderListCacheProvider></CustomerAggregateCacheProvider></QuoteListCacheProvider></StaffListCacheProvider></OrderListCacheProvider></InventoryListCacheProvider></CustomerListCacheProvider></LeadListCacheProvider></HashRouter>;
}
