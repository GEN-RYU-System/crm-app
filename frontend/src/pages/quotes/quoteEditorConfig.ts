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
  customerId: string;
  staffId: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
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
    leadId: '', customerId: '', staffId: '', issuedDate: '', expiryDate: '',
    status: '下書き', currency: 'JPY', shippingFee: '', discount: '', note: '',
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
    customerId: q.customerId ?? '',
    staffId: q.staffId ?? '',
    issuedDate: q.issuedDate ?? '',
    expiryDate: q.expiryDate ?? '',
    status: q.status ?? '',
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

export function toQuotePayload(values: QuoteEditorValues): QuotePayload {
  const lines: QuoteLinePayload[] = values.lines.map((line, index) => ({
    lineNo: index + 1,
    productName: line.productName,
    description: line.description,
    quantity: parseNumber(line.quantity),
    unitPrice: parseNumber(line.unitPrice),
    note: line.note
  }));
  return {
    leadId: values.leadId,
    customerId: values.customerId,
    staffId: values.staffId,
    issuedDate: values.issuedDate,
    expiryDate: values.expiryDate,
    status: values.status,
    currency: values.currency,
    shippingFee: parseNumber(values.shippingFee),
    discount: parseNumber(values.discount),
    note: values.note,
    lines
  };
}
