"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_NOTIFICATION_FEED,
  notificationsFeed,
} from "../../data/notifications-feed";

export function useNotificationFeed(userId: string | null) {
  return useSyncExternalStore(
    useCallback(
      (listener) => notificationsFeed.subscribe(userId, listener),
      [userId],
    ),
    useCallback(() => notificationsFeed.snapshot(userId), [userId]),
    () => EMPTY_NOTIFICATION_FEED,
  );
}
