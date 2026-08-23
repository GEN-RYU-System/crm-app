import { NAVIGATION_BY_ID } from '../../app/navigation';
import { leadsCopy } from '../../content/ja';
import type { LeadRecord, LeadType } from '../../gas/client';

export type LeadEditorValues = Record<'customerName' | 'sourceId' | 'sourceName' | 'country' | 'productTitle' | 'responseSpeed' | 'csMemo', string>;

export const LEAD_EDITOR_PATHS = {
  list: NAVIGATION_BY_ID.leads.hash,
  create: `${NAVIGATION_BY_ID.leads.hash}/new`,
  detail: `${NAVIGATION_BY_ID.leads.hash}/:leadId`,
  detailFor: (leadId: string) => `${NAVIGATION_BY_ID.leads.hash}/${encodeURIComponent(leadId)}`
} as const;

export const LEAD_EDITOR_SEGMENTS = {
  create: 'new',
  detail: ':leadId'
} as const;

function value(record: LeadRecord, field: keyof typeof leadsCopy.fields): string {
  const source = record[leadsCopy.fields[field]];
  return source == null ? '' : String(source);
}

export function emptyLeadEditorValues(): LeadEditorValues {
  return { customerName: '', sourceId: '', sourceName: '', country: '', productTitle: '', responseSpeed: '', csMemo: '' };
}

export function toLeadEditorValues(record: LeadRecord): LeadEditorValues {
  return {
    customerName: value(record, 'customerName'),
    sourceId: value(record, 'sourceId'),
    sourceName: value(record, 'source'),
    country: value(record, 'country'),
    productTitle: value(record, 'productTitle'),
    responseSpeed: value(record, 'responseSpeed'),
    csMemo: value(record, 'csMemo')
  };
}

function toLeadWriteValues(values: LeadEditorValues): Record<string, string> {
  return {
    [leadsCopy.fields.customerName]: values.customerName,
    [leadsCopy.fields.sourceId]: values.sourceId,
    [leadsCopy.fields.source]: values.sourceName,
    [leadsCopy.fields.country]: values.country,
    [leadsCopy.fields.productTitle]: values.productTitle,
    [leadsCopy.fields.responseSpeed]: values.responseSpeed,
    [leadsCopy.fields.csMemo]: values.csMemo
  };
}

export function toLeadCreateValues(values: LeadEditorValues, type: LeadType): Record<string, string> {
  return { ...toLeadWriteValues(values), [leadsCopy.fields.leadType]: type };
}

export function toLeadUpdateValues(values: LeadEditorValues): Record<string, string> {
  return toLeadWriteValues(values);
}
