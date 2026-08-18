import type { QuoteRecord } from '../../gas/client';
import type { DataTableCellAlignment } from '../../components/ui';
import { quotesCopy } from '../../content/ja';

export type QuoteRow = {
  quoteId: string;
  customerName: string;
  issuedDate: string;
  expiryDate: string;
  totalAmount: string;
  status: string;
};
export type QuoteSortKey = Exclude<keyof QuoteRow, 'quoteId'>;
export type QuoteSortDirection = 'ascending' | 'descending';
export type QuoteSort = { key: QuoteSortKey; direction: QuoteSortDirection };

export const QUOTE_LIST_INITIAL_SORT: QuoteSort = { key: 'issuedDate', direction: 'descending' };

export const QUOTE_LIST_COLUMNS: readonly { key: QuoteSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'customerName', label: quotesCopy.columns.customerName, cellAlignment: 'start'  },
  { key: 'issuedDate',   label: quotesCopy.columns.issuedDate,   cellAlignment: 'center' },
  { key: 'expiryDate',   label: quotesCopy.columns.expiryDate,   cellAlignment: 'center' },
  { key: 'totalAmount',  label: quotesCopy.columns.totalAmount,  cellAlignment: 'center' },
  { key: 'status',       label: quotesCopy.columns.status,       cellAlignment: 'center' },
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

function formatCurrency(totalAmount: unknown, currency: string, symbolMap: Record<string, string>): string {
  if (totalAmount == null) return '-';
  const num = Number(totalAmount);
  if (!Number.isFinite(num)) return '-';
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(num));
  const symbol = symbolMap[currency] ?? null;
  return symbol != null ? `${symbol}${formatted}` : `${currency} ${formatted}`;
}

function compareRows(a: QuoteRow, b: QuoteRow, sort: QuoteSort): number {
  const dir = sort.direction === 'ascending' ? 1 : -1;
  return a[sort.key].localeCompare(b[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * dir;
}

export function toQuoteRows(
  records: readonly QuoteRecord[],
  sort: QuoteSort = QUOTE_LIST_INITIAL_SORT,
  symbolMap: Record<string, string> = {},
): QuoteRow[] {
  return records
    .map((r) => ({
      quoteId:      text(r.quoteId),
      customerName: text(r.customerName),
      issuedDate:   formatDate(r.issuedDate),
      expiryDate:   formatDate(r.expiryDate),
      totalAmount:  formatCurrency(r.totalAmount, r.currency, symbolMap),
      status:       text(r.status),
    }))
    .sort((a, b) => compareRows(a, b, sort));
}

export function filterQuoteRows(rows: readonly QuoteRow[], query: string): readonly QuoteRow[] {
  const q = query.trim().toLocaleLowerCase('ja-JP');
  if (q === '') return rows;
  return rows.filter((row) => QUOTE_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(q)));
}

export const QUOTE_ROUTE_SEGMENTS = { detail: ':quoteId' } as const;
