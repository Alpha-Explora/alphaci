/* Pure domain rules. No React, no I/O — directly unit-testable. */

import type { NotificationItem } from "./notifications-types";

/** QA refused an item: a Developer acts on it from the "My QA items" card. */
const QA_REFUSAL_EVENTS: ReadonlySet<string> = new Set([
  "qa.item.returned_to_dev",
  "qa.item.failed",
  "qa.item.blocked",
]);

/** Whether a notification says QA failed, blocked or returned an item. */
export function isQaRefusal(item: Pick<NotificationItem, "eventCode">): boolean {
  return QA_REFUSAL_EVENTS.has(item.eventCode);
}

/**
 * §6: a refusal takes the Developer to the project's Overview, with the "My
 * QA items" card asked to scroll into view and briefly highlight itself.
 * Null without a project to go to.
 */
export function qaRefusalHref(item: Pick<NotificationItem, "projectId">): string | null {
  const projectId = item.projectId ?? null;
  if (!projectId) return null;
  return `/projects/${encodeURIComponent(projectId)}?focus=my-qa-items#overview`;
}

/** At most this many pop-ups stand at once; the rest wait in the Inbox. */
export const MAX_QA_ALERTS = 3;

/**
 * The QA refusals to pop up: unread, not popped up before in this browser,
 * newest first, at most MAX_QA_ALERTS. Everything else stays in the Inbox only.
 */
export function qaAlertsToShow(
  items: ReadonlyArray<NotificationItem>,
  seen: ReadonlySet<string>,
): NotificationItem[] {
  return items
    .filter((item) => !item.readAt && isQaRefusal(item) && !seen.has(item.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_QA_ALERTS);
}

/** Turns any thrown value into something safe to render to a user. */
export function toUserError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
