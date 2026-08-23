/**
 * Formats a date string for display. Converts ISO strings (e.g. "2026-08-23T01:38:50.486Z")
 * to locale date format (e.g. "2026/08/23"). Returns '-' for empty/invalid values.
 */
export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}
