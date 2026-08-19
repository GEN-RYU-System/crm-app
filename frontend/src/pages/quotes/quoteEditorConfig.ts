import { NAVIGATION_BY_ID } from '../../app/navigation';
import type { QuoteDetailRecord, QuoteLinePayload, QuoteLineRecord, QuotePayload } from '../../gas/client';

export type QuoteLineEditorValues = {
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

export type QuoteEditorValues = {
  leadId: string;
  currency: string;
  shippingFee: string;
  discount: string;
  note: string;
  lines: QuoteLineEditorValues[];
};

export const QUOTE_EDITOR_PATHS = {
  list: NAVIGATION_BY_ID.quotes.hash,
  create: `${NAVIGATION_BY_ID.quotes.hash}/new`,
  detail: `${NAVIGATION_BY_ID.quotes.hash}/:quoteId`,
  detailFor: (quoteId: string) => `${NAVIGATION_BY_ID.quotes.hash}/${encodeURIComponent(quoteId)}`
} as const;

export const QUOTE_EDITOR_SEGMENTS = {
  create: 'new',
  detail: ':quoteId'
} as const;

export function emptyLineValues(): QuoteLineEditorValues {
  return { productName: '', description: '', quantity: '', unitPrice: '', note: '' };
}

export function emptyQuoteEditorValues(): QuoteEditorValues {
  return {
    leadId: '', currency: 'JPY', shippingFee: '', discount: '', note: '',
    lines: [emptyLineValues()]
  };
}

function toLineEditorValues(line: QuoteLineRecord): QuoteLineEditorValues {
  return {
    productName: line.productName ?? '',
    description: line.description ?? '',
    quantity: line.quantity == null ? '' : String(line.quantity),
    unitPrice: line.unitPrice == null ? '' : String(line.unitPrice),
    note: line.note ?? ''
  };
}

export function toQuoteEditorValues(record: QuoteDetailRecord): QuoteEditorValues {
  const q = record.quote;
  return {
    leadId: q.leadId ?? '',
    currency: q.currency ?? '',
    shippingFee: q.shippingFee == null ? '' : String(q.shippingFee),
    discount: q.discount == null ? '' : String(q.discount),
    note: q.note ?? '',
    lines: record.lines.length > 0 ? record.lines.map(toLineEditorValues) : [emptyLineValues()]
  };
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Convert fullwidth digits to halfwidth (0xFF01-0xFF5E range offset 0xFEE0). */
export function toHalfwidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

/** Validate discount input: allow digits and decimal point only (after halfwidth conversion). */
export function isValidDiscount(value: string): boolean {
  const half = toHalfwidthDigits(value).trim();
  if (half === '') return true;
  return /^\d+(\.\d+)?$/.test(half);
}

export function toQuotePayload(values: QuoteEditorValues, statusKey: 'DRAFT' | 'ISSUED'): QuotePayload {
  const lines: QuoteLinePayload[] = values.lines.map((line, index) => ({
    lineNo: index + 1,
    productName: line.productName,
    description: line.description,
    quantity: parseNumber(line.quantity),
    unitPrice: parseNumber(line.unitPrice),
    note: line.note
  }));
  const discountHalf = toHalfwidthDigits(values.discount);
  return {
    leadId: values.leadId,
    status: statusKey,
    currency: values.currency,
    shippingFee: parseNumber(values.shippingFee),
    discount: parseNumber(discountHalf),
    note: values.note,
    lines
  };
}
