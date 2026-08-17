import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationGroup, NavigationItem } from '../../app/navigation';
import { commonCopy, navigationCopy } from '../../content/ja';
import { authCopy } from '../../content/ja/auth';
import { useAuth } from '../../contexts/AuthContext';
import './MobileHeader.css';

function MobileNavigationItem({ item }: { item: NavigationItem }) {
  const Icon = CRM_NAV_ICONS[item.icon];
  const contents = <><Icon aria-hidden="true" /><span>{item.label}</span></>;
  return item.state === 'planned'
    ? <span className="shell-mobile-header__item shell-mobile-header__item--planned" aria-disabled="true" title={navigationCopy.planned}>{contents}</span>
    : <NavLink to={item.hash} className={({ isActive }) => `shell-mobile-header__item${isActive ? ' shell-mobile-header__item--active' : ''}`}>{contents}</NavLink>;
}

export function MobileHeader({ navigationGroups }: { navigationGroups: readonly NavigationGroup[] }) {
  const items = navigationGroups.flatMap((group) => group.items);
  const { logout } = useAuth();
  return (
    <header className="shell-mobile-header">
      <span className="shell-mobile-header__brand">{commonCopy.brand}</span>
      <nav className="shell-mobile-header__nav" aria-label={navigationCopy.primaryNav}>
        {items.map((item) => <MobileNavigationItem key={item.id} item={item} />)}
      </nav>
      <button
        type="button"
        className="shell-mobile-header__logout"
        onClick={() => void logout()}
        aria-label={authCopy.logoutButton}
      >
        {authCopy.logoutButton}
      </button>
    </header>
  );
}
