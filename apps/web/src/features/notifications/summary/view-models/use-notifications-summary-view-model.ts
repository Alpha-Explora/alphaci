"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { notificationsRepository } from "../../data/notifications-repository";
import { qaAlertsToShow } from "../../model/notifications-rules";
import type { NotificationItem, NotificationsStatus } from "../../model/notifications-types";

export interface NotificationsSummaryViewModel {
  /** What the app shell renders on its inbox badge. */
  unreadCount: number;
  /** False when the user has notifications switched off entirely. */
  isEnabled: boolean;
  status: NotificationsStatus;
  /**
   * QA refusals (an item failed, blocked or returned to dev) to pop up, newest
   * first. Each pops up once in this browser; it stays unread in the Inbox.
   */
  alerts: NotificationItem[];
  dismissAlert: (id: string) => void;
}

/** How often the shell asks again while the tab is visible. */
export const NOTIFICATIONS_POLL_MS = 30_000;

const SEEN_KEY = "alphaci.notifications.popped";
/** Enough to remember a long while of refusals without growing forever. */
const SEEN_LIMIT = 200;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT)));
  } catch {
    // Not remembered this time: the pop-up may show once more after a reload.
  }
}

/**
 * ViewModel for the app shell's notification badge and its pop-ups.
 *
 * A deliberately narrow slice: the shell needs a count and the QA refusals to
 * pop up, not an inbox. It has no inbox view of its own, which is the point —
 * the inbox view imports AppNav, so a shell that reached for the inbox slice
 * would close a cycle (app-nav -> inbox barrel -> inbox view -> app-nav).
 *
 * It reads once on load and again every 30 seconds while the tab is visible,
 * so a Developer hears that QA blocked their item without reloading. A failure
 * is not surfaced to the user: an unreachable notifications endpoint should
 * not put an error in the navigation rail on every page, so it resolves to a
 * quiet zero.
 */
export function useNotificationsSummaryViewModel(options: {
  /** Guests have no notifications to count. */
  guest: boolean;
}): NotificationsSummaryViewModel {
  const { guest } = options;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<NotificationsStatus>("loading");
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const request = useRef(0);

  const load = useCallback(() => {
    request.current += 1;
    const id = request.current;
    return notificationsRepository
      .list()
      .then((response) => {
        if (id !== request.current) return;
        setUnreadCount(response.unreadCount);
        setIsEnabled(response.enabled);
        setFetchStatus("ready");
        if (!response.enabled) return;
        const seen = readSeen();
        const fresh = qaAlertsToShow(response.items, seen);
        if (fresh.length === 0) return;
        for (const item of fresh) seen.add(item.id);
        writeSeen(seen);
        setAlerts((current) => [...fresh, ...current.filter((item) => !fresh.some((next) => next.id === item.id))]);
      })
      .catch(() => {
        if (id !== request.current) return;
        setUnreadCount(0);
        setIsEnabled(false);
        setFetchStatus("ready");
      });
  }, []);

  useEffect(() => {
    if (guest) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, NOTIFICATIONS_POLL_MS);
    return () => {
      window.clearInterval(timer);
      request.current += 1;
    };
  }, [guest, load]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    unreadCount,
    isEnabled,
    status: guest ? "idle" : fetchStatus,
    alerts: guest ? [] : alerts,
    dismissAlert,
  };
}
