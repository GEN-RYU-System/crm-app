import { SidebarNav } from './SidebarNav';
import './DesktopSidebar.css';

type Props = { expanded: boolean; hoverSuppressed: boolean; onToggle: () => void; onPointerLeave: () => void };
export function DesktopSidebar({ expanded, hoverSuppressed, onToggle, onPointerLeave }: Props) { return <aside className={`shell-desktop-sidebar${expanded ? ' shell-desktop-sidebar--expanded' : ''}${hoverSuppressed ? ' shell-desktop-sidebar--hover-suppressed' : ''}`} onPointerLeave={onPointerLeave}><div className="shell-desktop-sidebar__brand"><span className="shell-desktop-sidebar__mark" aria-hidden="true">C</span><span className="shell-desktop-sidebar__name">CRM</span></div><SidebarNav /><button className="shell-desktop-sidebar__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? '折畳む' : '展開する'}</button></aside>; }
