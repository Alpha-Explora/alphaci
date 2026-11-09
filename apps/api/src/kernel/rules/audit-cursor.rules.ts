/**
 * The cursor of the repository Audit tab: where the next page starts.
 *
 * Events are listed newest first, ordered by (created_at, id). A cursor of the
 * timestamp alone cannot split events that share one, and GitHub events do:
 * they carry GitHub's own timestamps, one second apart at best. The page
 * boundary then falls inside a tie and every event in it that sorts after the
 * boundary is skipped. The cursor therefore also names the last event's id,
 * written `<ISO timestamp>|<event id>`.
 *
 * Clients treat it as opaque and pass `next` back unchanged. A bare timestamp
 * (what earlier pages handed out) is still accepted and means "strictly older
 * than this time".
 */

const TIMESTAMP =
  '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?(?:Z|[+-]\\d{2}:\\d{2})';
const EVENT_ID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const AUDIT_CURSOR_PATTERN = new RegExp(
  `^(${TIMESTAMP})(?:\\|(${EVENT_ID}))?$`,
);

export interface AuditCursor {
  /** ISO timestamp of the last event on the previous page. */
  createdAt: string;
  /** Its id, or null for a bare-timestamp cursor. */
  eventId: string | null;
}

export function formatAuditCursor(createdAt: string, eventId: string): string {
  return `${createdAt}|${eventId}`;
}

/** Null when `value` is not a cursor, or names a time that does not exist. */
export function parseAuditCursor(value: string): AuditCursor | null {
  const match = AUDIT_CURSOR_PATTERN.exec(value);
  const createdAt = match?.[1];
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, eventId: match[2] ?? null };
}
