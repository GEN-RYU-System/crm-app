import { useEffect, useState, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import type { NavigationGroup } from '../../app/navigation';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import './AppShell.css';

const mobileQuery = '(max-width: 767px)';
function useMobileLayout() { const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches); useEffect(() => { const query = window.matchMedia(mobileQuery); const update = () => setIsMobile(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []); return isMobile; }
export function AppShell({ children, navigationGroups }: PropsWithChildren<{ navigationGroups: readonly NavigationGroup[] }>) { const location = useLocation(); const isMobile = useMobileLayout(); const [sidebarExpanded, setSidebarExpanded] = useState(false); const [sidebarHoverSuppressed, setSidebarHoverSuppressed] = useState(false); const handleSidebarEnter = () => { if (!sidebarHoverSuppressed) setSidebarExpanded(true); }; const handleSidebarLeave = () => { setSidebarExpanded(false); setSidebarHoverSuppressed(false); }; const handleSidebarNavClick = () => { setSidebarExpanded(false); setSidebarHoverSuppressed(true); }; useEffect(() => { setSidebarExpanded(false); }, [location.pathname]); return <div className={`shell-root${sidebarExpanded ? ' shell-root--expanded' : ''}`}>{isMobile ? <MobileHeader navigationGroups={navigationGroups} /> : <DesktopSidebar expanded={sidebarExpanded} hoverSuppressed={sidebarHoverSuppressed} onMouseEnter={handleSidebarEnter} onMouseLeave={handleSidebarLeave} onNavClick={handleSidebarNavClick} navigationGroups={navigationGroups} />}<div className="shell-canvas"><div className="shell-page-content">{children}</div></div></div>; }
