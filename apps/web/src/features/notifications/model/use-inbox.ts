"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  NotificationItem,
  NotificationsResponse,
} from "../api/notifications.contracts";
import { getNotifications, markNotificationRead } from "../api/notifications.api";
import { flattenGroups, groupNotificationsByDay } from "./grouping";
import type { InboxRow } from "./grouping";

export type InboxFilter = "all" | "unread";

export interface InboxViewModel {
  /** Grouped + flattened for the inbox list. */
  rows: InboxRow[];
  /** Ungrouped, for consumers rendering a plain list (e.g. the settings panel). */
  items: NotificationItem[];
  unreadCount: number;
  unreadItemCount: number;
  totalCount: number;
  hasUnread: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  filter: InboxFilter;
  setFilter: (filter: InboxFilter) => void;
  markingId: string | null;
  isMarkingAll: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * ViewModel for the inbox.
 *
 * Owns every piece of state and behaviour the inbox needs, and returns a shape
 * the View can render without knowing that an API exists. This is the seam the
 * whole MVVM split rests on: `ui/` is forbidden from importing `api/`, so the
 * only way data reaches a component is through a hook like this one.
 *
 * `enabled` should be treated as "not fetched yet" only while `isLoading` is
 * true — the backend returns `enabled: false` for users whose notifications are
 * switched off, which is a real state and not an error.
 */
export function useInbox(active: boolean): InboxViewModel {
  const [notifications, setNotifications] =
    useState<NotificationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    void getNotifications()
      .then((response) => {
        if (!alive) return;
        setNotifications(response);
        setError(null);
      })
      .catch(() => {
        if (alive) setError("Notifications are unavailable right now.");
      });
    return () => {
      alive = false;
    };
  }, [active]);

  const unreadItems = useMemo(
    () => notifications?.items.filter((item) => !item.readAt) ?? [],
    [notifications],
  );

  const visibleItems = useMemo(() => {
    if (!notifications) return [];
    return filter === "unread" ? unreadItems : notifications.items;
  }, [notifications, filter, unreadItems]);

  const rows = useMemo(
    () => flattenGroups(groupNotificationsByDay(visibleItems)),
    [visibleItems],
  );

  /* Applied locally rather than refetching: the row is already on screen, and
   * a round trip would make a click feel slow for a purely additive change. */
  const applyMarkedRead = useCallback((id: string) => {
    setNotifications((current) =>
      current
        ? {
            ...current,
            unreadCount: Math.max(0, current.unreadCount - 1),
            items: current.items.map((item) =>
              item.id === id
                ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                : item,
            ),
          }
        : current,
    );
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      setMarkingId(id);
      setError(null);
      try {
        await markNotificationRead(id);
        applyMarkedRead(id);
      } catch {
        setError("Notification update failed.");
      } finally {
        setMarkingId(null);
      }
    },
    [applyMarkedRead],
  );

  const markAllRead = useCallback(async () => {
    setIsMarkingAll(true);
    setError(null);
    try {
      /* Sequential on purpose. Each call is applied optimistically as it
       * resolves, so a failure part-way leaves the ones that succeeded marked
       * rather than rolling the whole batch back. */
      for (const item of unreadItems) {
        await markNotificationRead(item.id);
        applyMarkedRead(item.id);
      }
    } catch {
      setError("Some notifications could not be marked as read. Please retry.");
    } finally {
      setIsMarkingAll(false);
    }
  }, [unreadItems, applyMarkedRead]);

  return {
    rows,
    items: notifications?.items ?? [],
    unreadCount: notifications?.unreadCount ?? 0,
    unreadItemCount: unreadItems.length,
    totalCount: notifications?.items.length ?? 0,
    hasUnread: unreadItems.length > 0,
    isEnabled: notifications?.enabled ?? false,
    isLoading: notifications === null && error === null,
    error,
    filter,
    setFilter,
    markingId,
    isMarkingAll,
    markRead,
    markAllRead,
  };
}
