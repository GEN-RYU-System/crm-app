import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NAVIGATION_BY_ID } from './app/navigation';
import { AppShell } from './components/shell';
import { getDashboardKpis, type DashboardKpis } from './gas/client';
import { ComponentCatalogPage } from './pages/catalog/ComponentCatalogPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
type LoadState = 'loading' | 'ready' | 'error';
export default function App() { const [state, setState] = useState<LoadState>('loading'); const [kpis, setKpis] = useState<DashboardKpis | null>(null); const [error, setError] = useState(''); const load = useCallback(async () => { setState('loading'); setError(''); try { setKpis(await getDashboardKpis()); setState('ready'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'データを読み込めませんでした。'); setState('error'); } }, []); useEffect(() => { void load(); }, [load]); return <HashRouter><AppShell><Routes><Route path={NAVIGATION_BY_ID.dashboard.hash} element={<DashboardPage kpis={kpis} state={state} error={error} onRefresh={() => void load()} />} /><Route path={NAVIGATION_BY_ID.components.hash} element={<ComponentCatalogPage />} /><Route path="*" element={<Navigate to={NAVIGATION_BY_ID.dashboard.hash} replace />} /></Routes></AppShell></HashRouter>; }
