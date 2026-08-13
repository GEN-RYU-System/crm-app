import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import { NAVIGATION_ITEMS } from '../../app/navigation';
import './MobileHeader.css';

export function MobileHeader() { return <header className="shell-mobile-header"><span className="shell-mobile-header__brand">CRM</span><nav className="shell-mobile-header__nav" aria-label="React POC navigation">{NAVIGATION_ITEMS.map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; return <NavLink key={item.id} to={item.hash} className={({ isActive }) => `shell-mobile-header__item${isActive ? ' shell-mobile-header__item--active' : ''}`}><Icon aria-hidden="true" /><span>{item.label}</span></NavLink>; })}</nav></header>; }
