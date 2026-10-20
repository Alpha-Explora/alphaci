import { getApiBaseUrl } from "@/shared/api/request";
import type { NotificationsResponse } from "../model/notifications-types";

/** Stream identity is checked before a snapshot can enter an account's cache. */
export function openNotificationsStream(
  userId: string,
  handlers: {
    onSnapshot: (response: NotificationsResponse) => void;
    onOpen: () => void;
    onError: () => void;
  },
): { close: () => void } | null {
  if (typeof EventSource === "undefined") return null;
  const source = new EventSource(`${getApiBaseUrl()}/notifications/stream`, {
    withCredentials: true,
  });
  source.onopen = handlers.onOpen;
  source.onmessage = (event: MessageEvent<string>) => {
    try {
      const value = JSON.parse(event.data) as {
        kind?: string;
        userId?: string;
        notifications?: NotificationsResponse;
      };
      const next = value.notifications;
      if (
        value.kind !== "snapshot" ||
        value.userId !== userId ||
        !next ||
        typeof next.enabled !== "boolean" ||
        !Number.isInteger(next.unreadCount) ||
        next.unreadCount < 0 ||
        !Array.isArray(next.items) ||
        !next.items.every(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.eventCode === "string" &&
            typeof item.createdAt === "string",
        )
      )
        return;
      handlers.onSnapshot(next);
    } catch {
      /* Ignore malformed events and recover on the next snapshot. */
    }
  };
  source.onerror = handlers.onError;
  return { close: () => source.close() };
}
