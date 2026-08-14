import type { LeadRecord, LeadType } from '../../gas/client';
import { leadsCopy } from '../../content/ja';

export type LeadListRow = { id: string; customerName: string; responseSpeed: string; updatedAt: string; csMemo: string };

export const LEAD_LIST_TABS: readonly { type: LeadType; label: string }[] = [
  { type: leadsCopy.leadTypes.inbound, label: leadsCopy.inbound },
  { type: leadsCopy.leadTypes.outbound, label: leadsCopy.outbound }
];

export const LEAD_LIST_COLUMNS: readonly { key: keyof Omit<LeadListRow, 'id'>; label: string }[] = [
  { key: 'customerName', label: leadsCopy.columns.customerName },
  { key: 'responseSpeed', label: leadsCopy.columns.responseSpeed },
  { key: 'updatedAt', label: leadsCopy.columns.updatedAt },
  { key: 'csMemo', label: leadsCopy.columns.csMemo }
];

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}

function trimMemo(value: unknown): string {
  const memo = text(value);
  return memo.length > 30 ? `${memo.slice(0, 30)}...` : memo;
}

export function toLeadListRows(records: readonly LeadRecord[]): LeadListRow[] {
  return records
    .slice()
    .sort((left, right) => new Date(String(right[leadsCopy.fields.updatedAt] ?? '')).getTime() - new Date(String(left[leadsCopy.fields.updatedAt] ?? '')).getTime())
    .map((record, index) => ({
      id: text(record[leadsCopy.fields.customerName]) + index,
      customerName: text(record[leadsCopy.fields.customerName]),
      responseSpeed: text(record[leadsCopy.fields.responseSpeed]),
      updatedAt: formatDate(record[leadsCopy.fields.updatedAt]),
      csMemo: trimMemo(record[leadsCopy.fields.csMemo])
    }));
}
