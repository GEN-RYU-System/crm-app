import { NavLink } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationGroup, NavigationItem } from '../../app/navigation';
import { navigationCopy } from '../../content/ja';
import { SidebarAccordion } from './SidebarAccordion';
import './SidebarNav.css';

type Props = { expanded: boolean; onNavClick: () => void; navigationGroups: readonly NavigationGroup[] };

function NavigationItemView({ expanded, item, onNavClick }: { expanded: boolean; item: NavigationItem; onNavClick: () => void }) {
  if (item.children != null && item.children.length > 0) return <SidebarAccordion expanded={expanded} item={{ ...item, children: item.children }} onNavClick={onNavClick} />;
  const Icon = CRM_NAV_ICONS[item.icon];
  const contents = <><span className="shell-sidebar-nav__icon"><Icon aria-hidden="true" /></span><span className="shell-sidebar-nav__label">{item.label}</span>{item.state === 'preview' && <span className="shell-sidebar-nav__state shell-sidebar-nav__label">{navigationCopy.preview}</span>}</>;
  if (item.state === 'planned') return <span className="shell-sidebar-nav__item shell-sidebar-nav__item--planned" aria-disabled="true" title={navigationCopy.planned}>{contents}</span>;
  return <NavLink to={item.hash} onClick={onNavClick} className={({ isActive }) => `shell-sidebar-nav__item${isActive ? ' shell-sidebar-nav__item--active' : ''}`}>{contents}</NavLink>;
}

export function SidebarNav({ expanded, onNavClick, navigationGroups }: Props) {
  return <nav className="shell-sidebar-nav" aria-label={navigationCopy.primaryNav}>{navigationGroups.map((group) => <section key={group.id} className="shell-sidebar-nav__group"><h2 className="shell-sidebar-nav__group-label shell-sidebar-nav__label">{group.label}</h2>{group.items.map((item) => <NavigationItemView key={item.id} expanded={expanded} item={item} onNavClick={onNavClick} />)}</section>)}</nav>;
}
