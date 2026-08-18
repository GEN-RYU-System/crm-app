import type { QuoteRecord } from '../../gas/client';
import type { DataTableCellAlignment } from '../../components/ui';
import { quotesCopy } from '../../content/ja';

export type QuoteRow = {
  quoteId: string;
  customerId: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  currency: string;
  totalAmount: string;
};
export type QuoteSortKey = Exclude<keyof QuoteRow, 'quoteId'>;
export type QuoteSortDirection = 'ascending' | 'descending';
export type QuoteSort = { key: QuoteSortKey; direction: QuoteSortDirection };

export const QUOTE_LIST_INITIAL_SORT: QuoteSort = { key: 'issuedDate', direction: 'descending' };

export const QUOTE_LIST_COLUMNS: readonly { key: QuoteSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'customerId',  label: quotesCopy.columns.customerId,  cellAlignment: 'center' },
  { key: 'issuedDate',  label: quotesCopy.columns.issuedDate,  cellAlignment: 'center' },
  { key: 'expiryDate',  label: quotesCopy.columns.expiryDate,  cellAlignment: 'center' },
  { key: 'status',      label: quotesCopy.columns.status,      cellAlignment: 'center' },
  { key: 'currency',    label: quotesCopy.columns.currency,    cellAlignment: 'center' },
  { key: 'totalAmount', label: quotesCopy.columns.totalAmount, cellAlignment: 'center' },
];

export const QUOTE_LIST_SEARCH_COLUMNS: readonly QuoteSortKey[] = QUOTE_LIST_COLUMNS.map(({ key }) => key);

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('ja-JP') : '-';
}

function compareRows(a: QuoteRow, b: QuoteRow, sort: QuoteSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function toQuoteRows(records: readonly QuoteRecord[], sort: QuoteSort = QUOTE_LIST_INITIAL_SORT): QuoteRow[] {
  return records
    .map((r) => ({
      quoteId:     text(r.quoteId),
      customerId:  text(r.customerId),
      issuedDate:  formatDate(r.issuedDate),
      expiryDate:  formatDate(r.expiryDate),
      status:      text(r.status),
      currency:    text(r.currency),
      totalAmount: formatNumber(r.totalAmount),
    }))
    .sort((a, b) => compareRows(a, b, sort));
}

export function filterQuoteRows(rows: readonly QuoteRow[], query: string): readonly QuoteRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => QUOTE_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}

export const QUOTE_ROUTE_SEGMENTS = { detail: ':quoteId' } as const;
