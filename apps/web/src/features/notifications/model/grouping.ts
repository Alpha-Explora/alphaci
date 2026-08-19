import type { NotificationItem } from "../api/notifications.contracts";

/* Pure grouping logic — no React, no fetch, no DOM.
 *
 * Extracted from the inbox route so it can be tested directly instead of
 * through a rendered component. Nothing here knows it is being displayed. */

export interface NotificationGroup {
  label: string;
  items: NotificationItem[];
}

export function groupNotificationsByDay(
  items: NotificationItem[],
): NotificationGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const groups: NotificationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (Number.isNaN(created.getTime())) {
      groups[3].items.push(item);
    } else if (created >= startOfToday) {
      groups[0].items.push(item);
    } else if (created >= startOfYesterday) {
      groups[1].items.push(item);
    } else if (created >= startOfWeek) {
      groups[2].items.push(item);
    } else {
      groups[3].items.push(item);
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

/* Flatten day groups into one continuous row list (day-label rows interspersed
 * with item rows) so the list reads as one smooth surface, not stacked cards,
 * while keeping a stable per-item index for a snappy, capped stagger-in. */
export type InboxRow =
  | { type: "header"; label: string }
  | { type: "item"; item: NotificationItem; index: number };

export function flattenGroups(groups: NotificationGroup[]): InboxRow[] {
  const rows: InboxRow[] = [];
  let index = 0;
  for (const group of groups) {
    rows.push({ type: "header", label: group.label });
    for (const item of group.items) {
      rows.push({ type: "item", item, index });
      index += 1;
    }
  }
  return rows;
}
