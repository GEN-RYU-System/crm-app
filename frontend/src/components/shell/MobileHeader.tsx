import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationItem } from '../../app/navigation';
import { commonCopy, navigationCopy } from '../../content/ja';
import './MobileHeader.css';

export function MobileHeader({ navigationItems }: { navigationItems: readonly NavigationItem[] }) { return <header className="shell-mobile-header"><span className="shell-mobile-header__brand">{commonCopy.brand}</span><nav className="shell-mobile-header__nav" aria-label={navigationCopy.primaryNav}>{navigationItems.map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; return <NavLink key={item.id} to={item.hash} className={({ isActive }) => `shell-mobile-header__item${isActive ? ' shell-mobile-header__item--active' : ''}`}><Icon aria-hidden="true" /><span>{item.label}</span></NavLink>; })}</nav></header>; }
