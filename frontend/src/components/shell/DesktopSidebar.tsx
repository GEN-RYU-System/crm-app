import { SidebarNav } from './SidebarNav';
import './DesktopSidebar.css';

export function DesktopSidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) { return <aside className={`shell-desktop-sidebar${expanded ? ' shell-desktop-sidebar--expanded' : ''}`}><div className="shell-desktop-sidebar__brand"><span className="shell-desktop-sidebar__mark" aria-hidden="true">SA</span><span className="shell-desktop-sidebar__name">CRM POC</span></div><SidebarNav /><button className="shell-desktop-sidebar__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? '折畳む' : '展開する'}</button></aside>; }
