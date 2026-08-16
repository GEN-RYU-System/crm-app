import type { DataTableCellAlignment } from '../../components/ui';
import type { StaffSummaryDto } from '../../features/staff/contracts';
import { staffCopy } from '../../content/ja';

export type StaffRow = {
  staffId: string;
  fullNameJa: string;
  email: string;
  role: string;
  status: string;
};

export type StaffColumnKey = Exclude<keyof StaffRow, 'staffId'>;
export type StaffSortKey = StaffColumnKey;
export type StaffSortDirection = 'ascending' | 'descending';
export type StaffSort = { key: StaffSortKey; direction: StaffSortDirection };

export const STAFF_LIST_INITIAL_SORT: StaffSort = { key: 'fullNameJa', direction: 'ascending' };

export const STAFF_LIST_COLUMNS: readonly { key: StaffColumnKey; label: string; cellAlignment: DataTableCellAlignment; sortable: boolean }[] = [
  { key: 'fullNameJa', label: staffCopy.columns.fullNameJa, cellAlignment: 'center', sortable: true },
  { key: 'email',      label: staffCopy.columns.email,      cellAlignment: 'center', sortable: true },
  { key: 'role',       label: staffCopy.columns.role,       cellAlignment: 'center', sortable: true },
  { key: 'status',     label: staffCopy.columns.status,     cellAlignment: 'center', sortable: true }
];

export const STAFF_LIST_SEARCH_COLUMNS: readonly StaffColumnKey[] = STAFF_LIST_COLUMNS.map(({ key }) => key);

export function toStaffRows(staff: readonly StaffSummaryDto[], sort: StaffSort): StaffRow[] {
  const rows = staff.map((member) => ({
    staffId:    member.staffId,
    fullNameJa: member.fullNameJa,
    email:      member.email,
    role:       member.role,
    status:     member.status
  }));
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return rows.sort((left, right) => {
    const comparison = left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' });
    return (comparison || left.fullNameJa.localeCompare(right.fullNameJa, 'ja-JP', { numeric: true, sensitivity: 'base' })) * direction;
  });
}

export function filterStaffRows(rows: readonly StaffRow[], query: string): readonly StaffRow[] {
  const normalized = query.trim().toLocaleLowerCase('ja-JP');
  return normalized === '' ? rows : rows.filter((row) => STAFF_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(normalized)));
}
