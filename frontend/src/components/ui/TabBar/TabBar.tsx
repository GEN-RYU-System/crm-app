import './TabBar.css';

export type TabBarItem<K extends string = string> = { key: K; label: string; disabled?: boolean };

export type TabBarProps<K extends string = string> = {
  items: readonly TabBarItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  'aria-label': string;
  className?: string;
};

export function TabBar<K extends string = string>({ items, activeKey, onChange, 'aria-label': ariaLabel, className }: TabBarProps<K>) {
  return <div aria-label={ariaLabel} className={['ui-tab-bar', className].filter(Boolean).join(' ')} role="tablist">{items.map((item) => {
    const isActive = item.key === activeKey;
    return <button aria-selected={isActive} className={['ui-tab-bar__tab', isActive && 'ui-tab-bar__tab--active'].filter(Boolean).join(' ')} disabled={item.disabled} key={item.key} onClick={() => onChange(item.key)} role="tab" type="button">{item.label}</button>;
  })}</div>;
}
