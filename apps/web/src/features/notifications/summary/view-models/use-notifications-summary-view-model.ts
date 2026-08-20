"use client";

import { useEffect, useRef, useState } from "react";

import { notificationsRepository } from "../../data/notifications-repository";
import type { NotificationsStatus } from "../../model/notifications-types";

export interface NotificationsSummaryViewModel {
  /** What the app shell renders on its inbox badge. */
  unreadCount: number;
  /** False when the user has notifications switched off entirely. */
  isEnabled: boolean;
  status: NotificationsStatus;
}

/**
 * ViewModel for the app shell's notification badge.
 *
 * A deliberately narrow slice: the shell needs a count, not an inbox. It has no
 * view of its own, which is the point — the inbox view imports AppNav, so a
 * shell that reached for the inbox slice would close a cycle
 * (app-nav -> inbox barrel -> inbox view -> app-nav). Exposing the count
 * through its own action slice lets the shell stay barrel-only without one.
 *
 * A failure is not surfaced to the user. An unreachable notifications endpoint
 * should not put an error in the navigation rail on every page, so it resolves
 * to a quiet zero — which is what the shell did inline before.
 */
export function useNotificationsSummaryViewModel(options: {
  /** Guests have no notifications to count. */
  guest: boolean;
}): NotificationsSummaryViewModel {
  const { guest } = options;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<NotificationsStatus>("loading");
  const request = useRef(0);

  useEffect(() => {
    if (guest) return;

    request.current += 1;
    const id = request.current;
    let active = true;

    notificationsRepository
      .list()
      .then((response) => {
        if (!active || id !== request.current) return;
        setUnreadCount(response.unreadCount);
        setIsEnabled(response.enabled);
        setFetchStatus("ready");
      })
      .catch(() => {
        if (!active || id !== request.current) return;
        setUnreadCount(0);
        setIsEnabled(false);
        setFetchStatus("ready");
      });

    return () => {
      active = false;
    };
  }, [guest]);

  return {
    unreadCount,
    isEnabled,
    status: guest ? "idle" : fetchStatus,
  };
}
