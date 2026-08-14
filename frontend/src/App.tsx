import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { canAccessNavigationItem, DATA_MANAGEMENT_ROOT, hasNavigationPermission, NAVIGATION_BY_ID, visibleDataManagementItems, visibleNavigationGroups, type NavigationPermissions } from './app/navigation';
import { AppShell } from './components/shell';
import { Spinner, StatusMessage } from './components/ui';
import { getCurrentUser, getDashboardKpis, type DashboardKpis } from './gas/client';
import { ComponentCatalogPage } from './pages/catalog/ComponentCatalogPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DataManagementPage } from './pages/data-management/DataManagementPage';
import { LeadListCacheProvider } from './pages/leads/LeadListCacheContext';
import { LeadEditorPage } from './pages/leads/LeadEditorPage';
import { LEAD_EDITOR_SEGMENTS } from './pages/leads/leadEditorConfig';
import { LeadListPage } from './pages/leads/LeadListPage';
import { RouteChatPreviewPage } from './pages/route-chat/RouteChatPreviewPage';
import { errorCopy, leadsCopy } from './content/ja';

type LoadState = 'loading' | 'ready' | 'error';
type PermissionState =
  | { status: 'checking' }
  | { status: 'ready'; permissions: NavigationPermissions }
  | { status: 'failed' };

function LeadPermissionLoading() {
  return <StatusMessage variant="loading"><Spinner size="sm" aria-label={leadsCopy.permissionsChecking} />{leadsCopy.permissionsChecking}</StatusMessage>;
}

export default function App() {
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
  const canAccessRouteChat = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.routeChat, permissions);
  const canAddLeads = hasNavigationPermission(permissions, 'lead_add');
  const canEditLeads = hasNavigationPermission(permissions, 'lead_edit');
  const leadsRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessLeads ? <LeadListPage canAdd={canAddLeads} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const routeChatRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessRouteChat ? <RouteChatPreviewPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
  const createRoute = canAccessLeads && canAddLeads ? <LeadEditorPage mode="create" canEdit={false} /> : <Navigate to={canAccessLeads ? NAVIGATION_BY_ID.leads.hash : NAVIGATION_BY_ID.dashboard.hash} replace />;
  const detailRoute = canAccessLeads ? <LeadEditorPage mode="detail" canEdit={canEditLeads} /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />;
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
    <Route path={NAVIGATION_BY_ID.routeChat.hash} element={routeChatRoute} />
    <Route path={NAVIGATION_BY_ID.components.hash} element={<ComponentCatalogPage />} />
    <Route path="*" element={<Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />} />
  </Routes></AppShell></LeadListCacheProvider></HashRouter>;
}
