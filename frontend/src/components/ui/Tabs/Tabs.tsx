import type { ReactNode } from 'react';
import { Badge } from '../Badge/Badge';
import './Tabs.css';

export type TabsVariant = 'underline' | 'pill';
export type TabsSize = 'sm' | 'md';
export type TabItem<K extends string = string> = { key: K; label: string; count?: number; icon?: ReactNode; disabled?: boolean };
export type TabsProps<K extends string = string> = { items: readonly TabItem<K>[]; activeKey: K; onChange: (key: K) => void; variant?: TabsVariant; size?: TabsSize; className?: string; 'aria-label'?: string };

export function Tabs<K extends string = string>({ items, activeKey, onChange, variant = 'underline', size = 'md', className = '', 'aria-label': ariaLabel }: TabsProps<K>) {
  return <div role="tablist" aria-label={ariaLabel} className={`ui-tabs ui-tabs--${variant} ui-tabs--${size} ${className}`.trim()}>{items.map((item) => { const active = item.key === activeKey; return <button key={item.key} type="button" role="tab" aria-selected={active} disabled={item.disabled} className={`ui-tabs__tab ${active ? 'ui-tabs__tab--active' : ''}`.trim()} onClick={() => onChange(item.key)}>{item.icon != null && <span className="ui-tabs__icon" aria-hidden="true">{item.icon}</span>}<span>{item.label}</span>{item.count !== undefined && <Badge variant="neutral" appearance="soft" size="sm">{String(item.count)}</Badge>}</button>; })}</div>;
}
