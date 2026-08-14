import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationItem } from '../../app/navigation';
import { navigationCopy } from '../../content/ja';
import './SidebarAccordion.css';

type Props = {
  expanded: boolean;
  item: NavigationItem & { children: readonly NavigationItem[] };
  onNavClick: () => void;
};

function matchesPath(pathname: string, hash: string) {
  return pathname === hash || pathname.startsWith(`${hash}/`);
}

export function SidebarAccordion({ expanded, item, onNavClick }: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const Icon = CRM_NAV_ICONS[item.icon];
  const CaretIcon = CRM_NAV_ICONS.chevron;
  const active = item.children.some((child) => matchesPath(pathname, child.hash));

  useEffect(() => {
    if (!expanded) setOpen(false);
  }, [expanded]);

  return <div className="shell-sidebar-accordion">
    <button
      type="button"
      className={`shell-sidebar-nav__item shell-sidebar-accordion__button${active ? ' shell-sidebar-nav__item--active' : ''}`}
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <span className="shell-sidebar-nav__icon"><Icon aria-hidden="true" /></span>
      <span className="shell-sidebar-nav__label">{item.label}</span>
      {expanded && <span className={`shell-sidebar-accordion__caret shell-sidebar-nav__label${open ? ' shell-sidebar-accordion__caret--open' : ''}`}><CaretIcon aria-hidden="true" /></span>}
    </button>
    {expanded && open && <div className="shell-sidebar-accordion__menu">
      {item.children.map((child) => child.state === 'planned'
        ? <span key={child.id} className="shell-sidebar-accordion__child shell-sidebar-accordion__child--planned" aria-disabled="true" title={navigationCopy.planned}>{child.label}</span>
        : <NavLink key={child.id} to={child.hash} onClick={onNavClick} className={({ isActive }) => `shell-sidebar-accordion__child${isActive ? ' shell-sidebar-accordion__child--active' : ''}`}>{child.label}</NavLink>)}
    </div>}
  </div>;
}
