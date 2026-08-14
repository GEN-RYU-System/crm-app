import type { ReactNode } from 'react';
import './PageToolbar.css';

export type PageToolbarProps = {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
};

export function PageToolbar({ start, end, className }: PageToolbarProps) {
  return <div className={['ui-page-toolbar', className].filter(Boolean).join(' ')}>
    {start && <div className="ui-page-toolbar__start">{start}</div>}
    {end && <div className="ui-page-toolbar__end">{end}</div>}
  </div>;
}
