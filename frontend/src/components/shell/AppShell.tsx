import { useEffect, useState, type PropsWithChildren } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import './AppShell.css';

const mobileQuery = '(max-width: 767px)';
function useMobileLayout() { const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches); useEffect(() => { const query = window.matchMedia(mobileQuery); const update = () => setIsMobile(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []); return isMobile; }
export function AppShell({ children }: PropsWithChildren) { const isMobile = useMobileLayout(); const [expanded, setExpanded] = useState(false); return <div className={`shell-root${expanded ? ' shell-root--expanded' : ''}`}>{isMobile ? <MobileHeader /> : <DesktopSidebar expanded={expanded} onToggle={() => setExpanded((value) => !value)} />}<div className="shell-canvas"><div className="shell-page-content">{children}</div></div></div>; }
