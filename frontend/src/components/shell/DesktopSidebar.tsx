import { SidebarNav } from './SidebarNav';
import type { NavigationItem } from '../../app/navigation';
import './DesktopSidebar.css';

type Props = { expanded: boolean; hoverSuppressed: boolean; onMouseEnter: () => void; onMouseLeave: () => void; onNavClick: () => void; navigationItems: readonly NavigationItem[] };
export function DesktopSidebar({ expanded, hoverSuppressed, onMouseEnter, onMouseLeave, onNavClick, navigationItems }: Props) { return <aside className={`shell-desktop-sidebar${expanded ? ' shell-desktop-sidebar--expanded' : ''}${hoverSuppressed ? ' shell-desktop-sidebar--hover-suppressed' : ''}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}><div className="shell-desktop-sidebar__brand"><span className="shell-desktop-sidebar__mark" aria-hidden="true">C</span><span className="shell-desktop-sidebar__name">CRM</span></div><SidebarNav onNavClick={onNavClick} navigationItems={navigationItems} /></aside>; }
