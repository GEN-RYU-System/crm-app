import type { ReactNode } from 'react';
import './PageHeader.css';
type Props = { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode };
export function PageHeader({ eyebrow, title, subtitle, action }: Props) {
  return <header className="ui-page-header">
    {eyebrow && <div className="ui-page-header__eyebrow">{eyebrow}</div>}
    <div className={`ui-page-header__title-row${subtitle ? ' ui-page-header__title-row--has-subtitle' : ''}`}>
      <h1 className="ui-page-header__title">{title}</h1>
      {action && <div className="ui-page-header__action">{action}</div>}
    </div>
    {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
  </header>;
}
