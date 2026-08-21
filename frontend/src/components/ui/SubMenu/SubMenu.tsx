import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import './SubMenu.css';

export type SubMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  to?: string;
};

export type SubMenuGroup = {
  title?: string;
  items: readonly SubMenuItem[];
};

export type SubMenuProps = {
  variant?: 'grouped' | 'flat';
  groups: readonly SubMenuGroup[];
  activeKey?: string;
  onChange?: (key: string) => void;
  ariaLabel: string;
  className?: string;
};

function SubMenuEntry({ activeKey, item, onChange }: { activeKey?: string; item: SubMenuItem; onChange?: (key: string) => void }) {
  const content = <><span className="ui-sub-menu__item-content">{item.icon}<span>{item.label}</span></span>{item.badge}</>;
  const className = `ui-sub-menu__item${activeKey === item.key ? ' ui-sub-menu__item--active' : ''}${item.disabled ? ' ui-sub-menu__item--disabled' : ''}`;
  if (item.disabled) return <span className={className} aria-disabled="true">{content}</span>;
  if (item.to != null) return <NavLink to={item.to} className={className} onClick={() => onChange?.(item.key)}>{content}</NavLink>;
  return <button type="button" className={className} onClick={() => onChange?.(item.key)}>{content}</button>;
}

export function SubMenu({ variant = 'grouped', groups, activeKey, onChange, ariaLabel, className = '' }: SubMenuProps) {
  return <nav className={`ui-sub-menu ui-sub-menu--${variant} ${className}`.trim()} aria-label={ariaLabel}>{groups.map((group, groupIndex) => <section key={group.title ?? groupIndex} className="ui-sub-menu__group">{variant === 'grouped' && group.title != null && <h2 className="ui-sub-menu__group-title">{group.title}</h2>}{group.items.map((item) => <SubMenuEntry key={item.key} activeKey={activeKey} item={item} onChange={onChange} />)}</section>)}</nav>;
}
