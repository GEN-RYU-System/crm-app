import type { KeyboardEvent, ReactNode } from 'react';
import './DataTable.css';

export type DataTableSortDirection = 'ascending' | 'descending' | 'none';
export type DataTableHeaderAlignment = 'start' | 'center';
export type DataTableSurface = 'standalone' | 'embedded';

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  renderCell: (row: Row) => ReactNode;
  ariaSort?: DataTableSortDirection;
  onSort?: () => void;
  sortAriaLabel?: string;
  sortIcon?: ReactNode;
  headerAlignment?: DataTableHeaderAlignment;
};

type Props<Row> = {
  ariaLabel: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  surface?: DataTableSurface;
  className?: string;
};

export function DataTable<Row>({ ariaLabel, columns, rows, rowKey, onRowClick, surface = 'standalone', className = '' }: Props<Row>) {
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onRowClick(row);
  };

  return <div className={`ui-data-table ui-data-table--${surface} ${className}`.trim()}><div className="ui-data-table__scroll"><table className="ui-data-table__table" aria-label={ariaLabel}><thead><tr>{columns.map((column) => <th key={column.key} className={`ui-data-table__header ui-data-table__header--${column.headerAlignment ?? 'center'}`} scope="col" aria-sort={column.ariaSort}>{column.onSort ? <button type="button" className="ui-data-table__sort-button" onClick={column.onSort} aria-label={column.sortAriaLabel}>{column.header}{column.sortIcon && <span className="ui-data-table__sort-icon" aria-hidden="true">{column.sortIcon}</span>}</button> : <span className="ui-data-table__header-content">{column.header}</span>}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={rowKey(row)} className={onRowClick ? 'ui-data-table__row ui-data-table__row--interactive' : 'ui-data-table__row'} role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={(event) => onRowKeyDown(event, row)}>{columns.map((column) => <td key={column.key} className="ui-data-table__cell">{column.renderCell(row)}</td>)}</tr>)}</tbody></table></div></div>;
}
