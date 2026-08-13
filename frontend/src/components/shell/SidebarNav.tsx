import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import { NAVIGATION_ITEMS } from '../../app/navigation';
import './SidebarNav.css';

export function SidebarNav() { return <nav className="shell-sidebar-nav" aria-label="React POC navigation">{NAVIGATION_ITEMS.map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; return <NavLink key={item.id} to={item.hash} className={({ isActive }) => `shell-sidebar-nav__item${isActive ? ' shell-sidebar-nav__item--active' : ''}`}><span className="shell-sidebar-nav__icon"><Icon aria-hidden="true" /></span><span className="shell-sidebar-nav__label">{item.label}</span></NavLink>; })}</nav>; }
