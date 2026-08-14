import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationItem } from '../../app/navigation';
import { navigationCopy } from '../../content/ja';
import './SidebarNav.css';

type Props = { onNavClick: () => void; navigationItems: readonly NavigationItem[] };
export function SidebarNav({ onNavClick, navigationItems }: Props) { return <nav className="shell-sidebar-nav" aria-label={navigationCopy.primaryNav}>{navigationItems.map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; return <NavLink key={item.id} to={item.hash} onClick={onNavClick} className={({ isActive }) => `shell-sidebar-nav__item${isActive ? ' shell-sidebar-nav__item--active' : ''}`}><span className="shell-sidebar-nav__icon"><Icon aria-hidden="true" /></span><span className="shell-sidebar-nav__label">{item.label}</span></NavLink>; })}</nav>; }
