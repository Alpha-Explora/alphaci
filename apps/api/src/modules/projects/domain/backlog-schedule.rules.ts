/** A story's priority in the backlog. */
export type BacklogPriority = 'low' | 'medium' | 'high' | 'urgent';

export const BACKLOG_PRIORITIES: readonly BacklogPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

/** "2026-11-14" for a real calendar date; false for "2026-02-30" or any other text. Pure. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * A DATE column as "YYYY-MM-DD". node-postgres reads DATE as a local-midnight
 * Date, so the local calendar fields are the stored day; a string passes through.
 */
export function toDateOnly(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(value.getFullYear())}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
