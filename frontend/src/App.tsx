import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { canAccessNavigationItem, NAVIGATION_BY_ID, visibleNavigationItems, type NavigationPermissions } from './app/navigation';
import { AppShell } from './components/shell';
import { Spinner, StatusMessage } from './components/ui';
import { getCurrentUser, getDashboardKpis, type DashboardKpis } from './gas/client';
import { ComponentCatalogPage } from './pages/catalog/ComponentCatalogPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LeadListCacheProvider } from './pages/leads/LeadListCacheContext';
import { LeadListPage } from './pages/leads/LeadListPage';
import { errorCopy, leadsCopy } from './content/ja';
type LoadState = 'loading' | 'ready' | 'error';
type PermissionState =
  | { status: 'checking' }
  | { status: 'ready'; permissions: NavigationPermissions }
  | { status: 'failed' };

function LeadPermissionLoading() {
  return <StatusMessage variant="loading"><Spinner size="sm" aria-label={leadsCopy.permissionsChecking} />{leadsCopy.permissionsChecking}</StatusMessage>;
}

export default function App() { const [state, setState] = useState<LoadState>('loading'); const [kpis, setKpis] = useState<DashboardKpis | null>(null); const [error, setError] = useState(''); const [permissionState, setPermissionState] = useState<PermissionState>({ status: 'checking' }); const load = useCallback(async () => { setState('loading'); setError(''); try { setKpis(await getDashboardKpis()); setState('ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : errorCopy.genericLoad); setState('error'); } }, []); const loadPermissions = useCallback(async () => { setPermissionState({ status: 'checking' }); try { const user = await getCurrentUser(); setPermissionState(user.success ? { status: 'ready', permissions: user.permissions } : { status: 'failed' }); } catch { setPermissionState({ status: 'failed' }); } }, []); useEffect(() => { void load(); void loadPermissions(); }, [load, loadPermissions]); const permissions = permissionState.status === 'ready' ? permissionState.permissions : null; const navigationItems = visibleNavigationItems(permissions); const canAccessLeads = permissionState.status === 'ready' && canAccessNavigationItem(NAVIGATION_BY_ID.leads, permissions); const leadsRoute = permissionState.status === 'checking' ? <LeadPermissionLoading /> : canAccessLeads ? <LeadListPage /> : <Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />; return <HashRouter><LeadListCacheProvider><AppShell navigationItems={navigationItems}><Routes><Route path={NAVIGATION_BY_ID.dashboard.hash} element={<DashboardPage kpis={kpis} state={state} error={error} onRefresh={() => void load()} />} /><Route path={NAVIGATION_BY_ID.leads.hash} element={leadsRoute} /><Route path={NAVIGATION_BY_ID.components.hash} element={<ComponentCatalogPage />} /><Route path="*" element={<Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />} /></Routes></AppShell></LeadListCacheProvider></HashRouter>; }
