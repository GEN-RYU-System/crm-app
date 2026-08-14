import type { LeadRecord, LeadType } from '../../gas/client';
import { leadsCopy } from '../../content/ja';

export type LeadListRow = { id: string; customerName: string; responseSpeed: string; updatedAt: string; csMemo: string; source: string; country: string; productTitle: string };
export type LeadSortKey = keyof Omit<LeadListRow, 'id'>;
export type LeadSortDirection = 'ascending' | 'descending';
export type LeadSort = { key: LeadSortKey; direction: LeadSortDirection };
type LeadListSortableRow = LeadListRow & { updatedAtRaw: string };

export const LEAD_LIST_TABS: readonly { type: LeadType; label: string }[] = [
  { type: leadsCopy.leadTypes.inbound, label: leadsCopy.inbound },
  { type: leadsCopy.leadTypes.outbound, label: leadsCopy.outbound }
];

export const LEAD_LIST_COLUMNS: readonly { key: LeadSortKey; label: string }[] = [
  { key: 'customerName', label: leadsCopy.columns.customerName },
  { key: 'responseSpeed', label: leadsCopy.columns.responseSpeed },
  { key: 'updatedAt', label: leadsCopy.columns.updatedAt },
  { key: 'csMemo', label: leadsCopy.columns.csMemo },
  { key: 'source', label: leadsCopy.columns.source },
  { key: 'country', label: leadsCopy.columns.country },
  { key: 'productTitle', label: leadsCopy.columns.productTitle }
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

function compareRows(left: LeadListSortableRow, right: LeadListSortableRow, sort: LeadSort): number {
  const direction = sort.direction === 'ascending' ? 1 : -1;
  if (sort.key === 'updatedAt') {
    const leftDate = new Date(left.updatedAtRaw).getTime();
    const rightDate = new Date(right.updatedAtRaw).getTime();
    return (Number.isNaN(leftDate) ? 0 : leftDate) === (Number.isNaN(rightDate) ? 0 : rightDate) ? 0 : ((Number.isNaN(leftDate) ? 0 : leftDate) - (Number.isNaN(rightDate) ? 0 : rightDate)) * direction;
  }
  return left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * direction;
}

export function toLeadListRows(records: readonly LeadRecord[], sort: LeadSort = { key: 'updatedAt', direction: 'descending' }): LeadListRow[] {
  return records
    .map((record) => ({
      id: text(record[leadsCopy.fields.leadId]),
      customerName: text(record[leadsCopy.fields.customerName]),
      responseSpeed: text(record[leadsCopy.fields.responseSpeed]),
      updatedAt: formatDate(record[leadsCopy.fields.updatedAt]),
      csMemo: trimMemo(record[leadsCopy.fields.csMemo]),
      source: text(record[leadsCopy.fields.source]),
      country: text(record[leadsCopy.fields.country]),
      productTitle: text(record[leadsCopy.fields.productTitle]),
      updatedAtRaw: String(record[leadsCopy.fields.updatedAt] ?? '')
    }))
    .sort((left, right) => compareRows(left, right, sort))
    .map(({ updatedAtRaw, ...row }) => row);
}
