import type { NotificationItem } from "../../model/notifications-types";

/* Inbox-only shapes. Domain-wide types live in features/notifications/model. */

export type NotificationsInboxFilter = "all" | "unread";

export interface NotificationsInboxGroup {
  label: string;
  items: NotificationItem[];
}

/* Day-label rows interleaved with item rows so the list reads as one smooth
 * surface rather than stacked cards, while keeping a stable per-item index for
 * a capped stagger-in. */
export type NotificationsInboxRow =
  | { type: "header"; label: string }
  | { type: "item"; item: NotificationItem; index: number };
