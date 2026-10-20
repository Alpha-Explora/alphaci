"use client";

import { useCallback } from "react";
import { notificationsFeed } from "../../data/notifications-feed";
import { useNotificationFeed } from "../../live";
import type {
  NotificationItem,
  NotificationsStatus,
} from "../../model/notifications-types";

export { NOTIFICATIONS_POLL_MS } from "../../data/notifications-feed";

export interface NotificationsSummaryViewModel {
  unreadCount: number;
  isEnabled: boolean;
  status: NotificationsStatus;
  alerts: NotificationItem[];
  workspaceRevision: number;
  dismissAlert: (id: string) => void;
  openAlert: (id: string) => void;
}

/** The shell and Inbox consume the same account-scoped live snapshot. */
export function useNotificationsSummaryViewModel(options: {
  guest: boolean;
  userId?: string | null;
}): NotificationsSummaryViewModel {
  const userId = options.guest ? null : (options.userId ?? null);
  const feed = useNotificationFeed(userId);
  const dismissAlert = useCallback(
    (id: string) => {
      if (userId) notificationsFeed.dismiss(userId, id);
    },
    [userId],
  );
  const openAlert = useCallback(
    (id: string) => {
      if (userId)
        void notificationsFeed.markRead(userId, id).catch(() => {
          /* Inbox retains a retryable unread entry. */
        });
    },
    [userId],
  );
  return {
    unreadCount: feed.response?.unreadCount ?? 0,
    isEnabled: feed.response?.enabled ?? false,
    status: feed.status,
    alerts: feed.alerts,
    workspaceRevision: feed.workspaceRevision,
    dismissAlert,
    openAlert,
  };
}
