import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationGroup } from '../../app/navigation';
import { commonCopy, navigationCopy } from '../../content/ja';
import './MobileHeader.css';

export function MobileHeader({ navigationGroups }: { navigationGroups: readonly NavigationGroup[] }) {
  const items = navigationGroups.flatMap((group) => group.items);
  return <header className="shell-mobile-header"><span className="shell-mobile-header__brand">{commonCopy.brand}</span><nav className="shell-mobile-header__nav" aria-label={navigationCopy.primaryNav}>{items.map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; const contents = <><Icon aria-hidden="true" /><span>{item.label}</span></>; return item.state === 'planned' ? <span key={item.id} className="shell-mobile-header__item shell-mobile-header__item--planned" aria-disabled="true" title={navigationCopy.planned}>{contents}</span> : <NavLink key={item.id} to={item.hash} className={({ isActive }) => `shell-mobile-header__item${isActive ? ' shell-mobile-header__item--active' : ''}`}>{contents}</NavLink>; })}</nav></header>;
}
