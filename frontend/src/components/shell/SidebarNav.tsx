import { NavLink } from 'react-router-dom';
import { NAVIGATION_ITEMS } from '../../app/navigation';
import './SidebarNav.css';

export function SidebarNav() { return <nav className="shell-sidebar-nav" aria-label="React POC navigation">{NAVIGATION_ITEMS.map((item) => <NavLink key={item.id} to={item.hash} className={({ isActive }) => `shell-sidebar-nav__item${isActive ? ' shell-sidebar-nav__item--active' : ''}`}><span className="shell-sidebar-nav__icon" aria-hidden="true">{item.icon}</span><span className="shell-sidebar-nav__label">{item.label}</span></NavLink>)}</nav>; }
