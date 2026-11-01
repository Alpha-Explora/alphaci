import type { NotificationItem } from "../../model/notifications-types";
import type {
  NotificationsInboxGroup,
  NotificationsInboxRow,
} from "./notifications-inbox-types";

/* Pure inbox rules — no React, no I/O, no JSX.
 *
 * Everything here is directly unit-testable; the assertions used to require
 * rendering the whole route and inspecting the DOM. */

export function groupNotificationsByDay(
  items: NotificationItem[],
): NotificationsInboxGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const groups: NotificationsInboxGroup[] = [
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

export function flattenGroups(groups: NotificationsInboxGroup[]): NotificationsInboxRow[] {
  const rows: NotificationsInboxRow[] = [];
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
