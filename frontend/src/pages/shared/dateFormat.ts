/**
 * Formats a date string for display. Converts ISO strings (e.g. "2026-08-23T01:38:50.486Z")
 * to Japan date format (e.g. "2026/08/23"). Returns '-' for empty/invalid values.
 * Always uses Asia/Tokyo timezone so a UTC midnight timestamp resolves to the correct JST date.
 */
export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
