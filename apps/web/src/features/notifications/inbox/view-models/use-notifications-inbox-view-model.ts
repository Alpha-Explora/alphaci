"use client";

import { useCallback, useMemo, useState } from "react";
import { notificationsFeed } from "../../data/notifications-feed";
import { useNotificationFeed } from "../../live";
import { toUserError } from "../../model/notifications-rules";
import type {
  NotificationItem,
  NotificationsResponse,
  NotificationsStatus,
} from "../../model/notifications-types";
import {
  flattenGroups,
  groupNotificationsByDay,
} from "../model/notifications-inbox-rules";
import type {
  NotificationsInboxFilter,
  NotificationsInboxRow,
} from "../model/notifications-inbox-types";

export interface NotificationsInboxViewModel {
  rows: NotificationsInboxRow[];
  items: NotificationItem[];
  unreadCount: number;
  unreadItemCount: number;
  totalCount: number;
  isEnabled: boolean;
  status: NotificationsStatus;
  error: string | null;
  filter: NotificationsInboxFilter;
  setFilter: (filter: NotificationsInboxFilter) => void;
  markingId: string | null;
  isMarkingAll: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const EMPTY_RESPONSE: NotificationsResponse = {
  enabled: false,
  items: [],
  unreadCount: 0,
};

/** Shares recipient data with the app shell, including live and read updates. */
export function useNotificationsInboxViewModel(
  active = true,
  userId: string | null = null,
): NotificationsInboxViewModel {
  const feed = useNotificationFeed(active ? userId : null);
  const response = feed.response ?? EMPTY_RESPONSE;
  const [commandError, setCommandError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationsInboxFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const unreadItems = useMemo(
    () => response.items.filter((item) => !item.readAt),
    [response],
  );
  const rows = useMemo(
    () =>
      flattenGroups(
        groupNotificationsByDay(
          filter === "unread" ? unreadItems : response.items,
        ),
      ),
    [response, filter, unreadItems],
  );
  const refresh = useCallback(async () => {
    if (userId) await notificationsFeed.refresh(userId);
  }, [userId]);
  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      setMarkingId(id);
      setCommandError(null);
      try {
        await notificationsFeed.markRead(userId, id);
      } catch (error) {
        setCommandError(toUserError(error, "Notification update failed."));
      } finally {
        setMarkingId(null);
      }
    },
    [userId],
  );
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setIsMarkingAll(true);
    setCommandError(null);
    try {
      for (const item of unreadItems)
        await notificationsFeed.markRead(userId, item.id);
    } catch (error) {
      setCommandError(
        toUserError(
          error,
          "Some notifications could not be marked as read. Please retry.",
        ),
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [userId, unreadItems]);
  return {
    rows,
    items: response.items,
    unreadCount: response.unreadCount,
    unreadItemCount: unreadItems.length,
    totalCount: response.items.length,
    isEnabled: response.enabled,
    status: feed.status,
    error: commandError ?? feed.error,
    filter,
    setFilter,
    markingId,
    isMarkingAll,
    markRead,
    markAllRead,
    refresh,
  };
}
