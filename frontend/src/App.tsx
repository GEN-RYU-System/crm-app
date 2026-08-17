import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { canAccessNavigationItem, DATA_MANAGEMENT_ROOT, hasNavigationPermission, NAVIGATION_BY_ID, STAFF_MANAGEMENT_ROOT, visibleDataManagementItems, visibleNavigationGroups, type NavigationPermissions } from './app/navigation';
import { AppShell } from './components/shell';
import { Spinner, StatusMessage } from './components/ui';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getCurrentUser, getDashboardKpis, type DashboardKpis } from './gas/client';
import { ComponentCatalogPage } from './pages/catalog/ComponentCatalogPage';
import { customerGasRepository } from './features/customers/gasAdapter';
import { staffGasRepository } from './features/staff/gasAdapter';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { CUSTOMER_ROUTE_SEGMENTS } from './pages/customers/customerConfig';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DataManagementPage } from './pages/data-management/DataManagementPage';
import { LeadListCacheProvider } from './pages/leads/LeadListCacheContext';
import { LeadEditorPage } from './pages/leads/LeadEditorPage';
import { LEAD_EDITOR_SEGMENTS } from './pages/leads/leadEditorConfig';
import { LeadListPage } from './pages/leads/LeadListPage';
import { InboxPreviewPage } from './pages/inbox/InboxPreviewPage';
import { StaffListPage } from './pages/staff/StaffListPage';
import { inboxPreviewRepository } from './features/inbox/previewAdapter';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { customersCopy, errorCopy, inboxCopy, leadsCopy, staffCopy } from './content/ja';
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
      setKpis(await getDashboardKpis());
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
  const canAddLeads = hasNavigationPermission(permissions, 'lead_add');
  const canEditLeads = hasNavigationPermission(permissions, 'lead_edit');
  const leadsRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessLeads ? <LeadListPage canAdd={canAddLeads} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const inboxRoute = permissionState.status === 'checking' ? <StatusMessage variant="loading"><Spinner size="sm" aria-label={inboxCopy.loading} />{inboxCopy.loading}</StatusMessage> : canAccessInbox ? <InboxPreviewPage repository={inboxPreviewRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const createRoute = canAccessLeads && canAddLeads ? <LeadEditorPage mode="create" canEdit={false} /> : <Navigate to={canAccessLeads ? NAVIGATION_BY_ID.leads.hash : NAVIGATION_BY_ID.dashboard.hash} replace />;
  const detailRoute = canAccessLeads ? <LeadEditorPage mode="detail" canEdit={canEditLeads} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const customersRoute = permissionState.status === 'checking' ? <CustomerPermissionLoading /> : canAccessCustomers ? <CustomerListPage repository={customerGasRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const staffRoute = permissionState.status === 'checking' ? <StaffPermissionLoading /> : canAccessStaff ? <StaffListPage repository={staffGasRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const customerDetailRoute = permissionState.status === 'checking' ? <CustomerPermissionLoading /> : canAccessCustomers ? <CustomerDetailPage repository={customerGasRepository} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const dataManagementRoute = permissionState.status === 'checking'
    ? <LeadPermissionLoading />
    : canAccessLeads
      ? <DataManagementPage navigationItems={dataManagementItems} />
      : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;

  return <HashRouter><LeadListCacheProvider><AppShell navigationGroups={navigationGroups}><Routes>
    <Route path={NAVIGATION_BY_ID.dashboard.hash} element={<DashboardPage kpis={kpis} state={state} error={error} onRefresh={() => void load()} />} />
    <Route path={DATA_MANAGEMENT_ROOT} element={dataManagementRoute}>
      <Route index element={leadsRoute} />
      <Route path={LEAD_EDITOR_SEGMENTS.create} element={createRoute} />
      <Route path={LEAD_EDITOR_SEGMENTS.detail} element={detailRoute} />
    </Route>
    <Route path={NAVIGATION_BY_ID.customers.hash} element={dataManagementRoute}>
      <Route index element={customersRoute} />
      <Route path={CUSTOMER_ROUTE_SEGMENTS.detail} element={customerDetailRoute} />
    </Route>
    <Route path={STAFF_MANAGEMENT_ROOT} element={staffRoute} />
    <Route path={NAVIGATION_BY_ID.inbox.hash} element={inboxRoute} />
    <Route path="/leads-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/new-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/route-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path="/archive-chat" element={<Navigate to={NAVIGATION_BY_ID.inbox.hash} replace />} />
    <Route path={NAVIGATION_BY_ID.components.hash} element={<ComponentCatalogPage />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />
    <Route path="*" element={<Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />} />
  </Routes></AppShell></LeadListCacheProvider></HashRouter>;
}
