"use client";

/* The inbox probe keeps its loading transition synchronous with activation. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

import { notificationsRepository } from "../../data/notifications-repository";
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
  /** Grouped and flattened for the inbox list. */
  rows: NotificationsInboxRow[];
  /** Ungrouped, for consumers rendering a plain list (the settings panel). */
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

/**
 * ViewModel for the notifications inbox.
 *
 * Owns all state and commands and exposes `status` plus a user-safe `error`,
 * as the skill requires of any interactive view-model. The view renders this
 * and nothing else — it never reaches for the repository, which is what keeps
 * the View/ViewModel boundary real rather than nominal.
 *
 * `active` gates the fetch so a consumer can mount this before the data is
 * wanted — the settings page only loads notifications on its account tab.
 */
export function useNotificationsInboxViewModel(
  active = true,
): NotificationsInboxViewModel {
  const [response, setResponse] = useState<NotificationsResponse | null>(null);
  const [status, setStatus] = useState<NotificationsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationsInboxFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setResponse(await notificationsRepository.list());
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(toUserError(e, "Notifications are unavailable right now."));
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setStatus("loading");
    setError(null);
    void notificationsRepository
      .list()
      .then((next) => {
        if (!alive) return;
        setResponse(next);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setStatus("error");
        setError(toUserError(e, "Notifications are unavailable right now."));
      });
    return () => {
      alive = false;
    };
  }, [active]);

  const unreadItems = useMemo(
    () => response?.items.filter((item) => !item.readAt) ?? [],
    [response],
  );

  const visibleItems = useMemo(() => {
    if (!response) return [];
    return filter === "unread" ? unreadItems : response.items;
  }, [response, filter, unreadItems]);

  const rows = useMemo(
    () => flattenGroups(groupNotificationsByDay(visibleItems)),
    [visibleItems],
  );

  /* Applied locally rather than refetching: the row is already on screen and a
   * round trip would make a click feel slow for a purely additive change. */
  const applyMarkedRead = useCallback((id: string) => {
    setResponse((current) =>
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
        await notificationsRepository.markRead(id);
        applyMarkedRead(id);
      } catch (e) {
        setError(toUserError(e, "Notification update failed."));
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
      /* Sequential on purpose. Each call is applied as it resolves, so a
       * failure part-way leaves the ones that succeeded marked rather than
       * rolling the whole batch back. */
      for (const item of unreadItems) {
        await notificationsRepository.markRead(item.id);
        applyMarkedRead(item.id);
      }
    } catch (e) {
      setError(
        toUserError(
          e,
          "Some notifications could not be marked as read. Please retry.",
        ),
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [unreadItems, applyMarkedRead]);

  return {
    rows,
    items: response?.items ?? [],
    unreadCount: response?.unreadCount ?? 0,
    unreadItemCount: unreadItems.length,
    totalCount: response?.items.length ?? 0,
    isEnabled: response?.enabled ?? false,
    status,
    error,
    filter,
    setFilter,
    markingId,
    isMarkingAll,
    markRead,
    markAllRead,
    refresh,
  };
}
