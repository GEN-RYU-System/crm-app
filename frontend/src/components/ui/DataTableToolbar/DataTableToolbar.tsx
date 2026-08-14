import type { ReactNode } from 'react';
import './DataTableToolbar.css';

export type DataTableToolbarProps = {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
};

export function DataTableToolbar({ start, end, className }: DataTableToolbarProps) {
  return <div className={['ui-data-table-toolbar', className].filter(Boolean).join(' ')}>
    {start && <div className="ui-data-table-toolbar__start">{start}</div>}
    {end && <div className="ui-data-table-toolbar__end">{end}</div>}
  </div>;
}
