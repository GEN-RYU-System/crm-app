import type { ReactNode } from 'react';
import './PageHeader.css';
type Props = { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode };
export function PageHeader({ eyebrow, title, subtitle, action }: Props) { return <header className="ui-page-header"><div>{eyebrow && <div className="ui-page-header__eyebrow">{eyebrow}</div>}<h1 className="ui-page-header__title">{title}</h1>{subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}</div>{action && <div>{action}</div>}</header>; }
