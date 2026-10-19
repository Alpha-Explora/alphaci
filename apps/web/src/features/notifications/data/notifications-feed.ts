import { ApiError } from "@/shared/api/request";
import {
  isMembershipNotification,
  isQaLiveAlert,
} from "../model/notifications-rules";
import type {
  NotificationItem,
  NotificationsResponse,
  NotificationsStatus,
} from "../model/notifications-types";
import { notificationsRepository } from "./notifications-repository";
import { openNotificationsStream } from "./notifications-stream";

export const NOTIFICATIONS_POLL_MS = 30_000;
export interface NotificationFeedState {
  response: NotificationsResponse | null;
  status: NotificationsStatus;
  error: string | null;
  alerts: NotificationItem[];
  workspaceRevision: number;
}
export const EMPTY_NOTIFICATION_FEED: NotificationFeedState = {
  response: null,
  status: "idle",
  error: null,
  alerts: [],
  workspaceRevision: 0,
};

const feeds = new Map<string, NotificationFeed>();

function remembered(userId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`alphaci.notifications.popped.${userId}`) ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** One transport and one cache shared by the shell and Inbox for an account. */
class NotificationFeed {
  state = EMPTY_NOTIFICATION_FEED;
  readonly listeners = new Set<() => void>();
  private stream: { close: () => void } | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private connected = false;
  private running = false;
  private version = 0;
  private initialized = false;
  private readonly observed = new Set<string>();
  private readonly readIds = new Set<string>();
  private readonly seen: Set<string>;

  constructor(readonly userId: string) {
    this.seen = remembered(userId);
  }
  private emit(next: NotificationFeedState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  private apply(response: NotificationsResponse): void {
    const membership = response.items.filter(isMembershipNotification);
    const freshMembership = membership.filter(
      (item) => !this.observed.has(item.id),
    );
    const alerts = response.items.filter(
      (item) =>
        !item.readAt &&
        !this.readIds.has(item.id) &&
        !this.seen.has(item.id) &&
        (isQaLiveAlert(item) ||
          (this.initialized &&
            isMembershipNotification(item) &&
            !this.observed.has(item.id))),
    );
    for (const item of response.items) this.observed.add(item.id);
    for (const item of alerts) this.seen.add(item.id);
    try {
      localStorage.setItem(
        `alphaci.notifications.popped.${this.userId}`,
        JSON.stringify([...this.seen].slice(-200)),
      );
    } catch {
      /* Storage may be disabled. */
    }
    this.initialized = true;
    this.version += 1;
    const locallyRead = response.items.filter(
      (item) => !item.readAt && this.readIds.has(item.id),
    ).length;
    this.emit({
      response: {
        ...response,
        unreadCount: Math.max(0, response.unreadCount - locallyRead),
        items: response.items.map((item) =>
          this.readIds.has(item.id) && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      },
      status: "ready",
      error: null,
      alerts: response.enabled
        ? [
            ...alerts,
            ...this.state.alerts.filter(
              (item) => !alerts.some((next) => next.id === item.id),
            ),
          ]
            .filter(
              (item) =>
                !this.readIds.has(item.id) &&
                !response.items.some(
                  (next) => next.id === item.id && next.readAt,
                ),
            )
            .slice(0, 3)
        : [],
      workspaceRevision:
        this.state.workspaceRevision + (freshMembership.length ? 1 : 0),
    });
  }
  async refresh(): Promise<void> {
    const version = this.version;
    try {
      const response = await notificationsRepository.list();
      if (response.userId && response.userId !== this.userId) {
        this.reset();
        return;
      }
      if (this.running && version === this.version) this.apply(response);
    } catch (error) {
      if (this.running && version === this.version) this.handleError(error);
    }
  }
  private handleError(error: unknown): void {
    const unauthorized =
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403);
    if (unauthorized) {
      this.stop();
      this.emit(EMPTY_NOTIFICATION_FEED);
      return;
    }
    this.emit({
      ...this.state,
      status: this.state.response ? "ready" : "error",
      error: "Notifications are unavailable right now.",
    });
  }
  private readonly focus = () => {
    if (document.visibilityState !== "hidden") void this.refresh();
  };
  start(): void {
    this.running = true;
    void this.refresh();
    this.stream = openNotificationsStream(this.userId, {
      onSnapshot: (next) => {
        if (this.running) this.apply(next);
      },
      onOpen: () => {
        this.connected = true;
      },
      onError: () => {
        this.connected = false;
        void this.refresh();
      },
    });
    this.timer = setInterval(() => {
      if (!this.connected && document.visibilityState === "visible")
        void this.refresh();
    }, NOTIFICATIONS_POLL_MS);
    window.addEventListener("focus", this.focus);
    document.addEventListener("visibilitychange", this.focus);
  }
  stop(): void {
    this.running = false;
    this.version += 1;
    this.stream?.close();
    this.stream = null;
    this.connected = false;
    clearInterval(this.timer);
    window.removeEventListener("focus", this.focus);
    document.removeEventListener("visibilitychange", this.focus);
  }
  reset(): void {
    this.stop();
    this.emit(EMPTY_NOTIFICATION_FEED);
  }
  dismiss(id: string): void {
    this.emit({
      ...this.state,
      alerts: this.state.alerts.filter((item) => item.id !== id),
    });
  }
  async markRead(id: string): Promise<void> {
    await notificationsRepository.markRead(id);
    if (!this.running) return;
    this.readIds.add(id);
    if (this.state.response) this.apply(this.state.response);
    else this.dismiss(id);
  }
}

export const notificationsFeed = {
  snapshot(userId: string | null): NotificationFeedState {
    return userId
      ? (feeds.get(userId)?.state ?? EMPTY_NOTIFICATION_FEED)
      : EMPTY_NOTIFICATION_FEED;
  },
  subscribe(userId: string | null, listener: () => void): () => void {
    if (!userId) return () => undefined;
    // The browser has one session identity. Shut down old-account readers immediately.
    for (const [id, feed] of feeds) if (id !== userId) feed.reset();
    let feed = feeds.get(userId);
    if (!feed) {
      feed = new NotificationFeed(userId);
      feeds.set(userId, feed);
    }
    feed.listeners.add(listener);
    if (feed.listeners.size === 1) feed.start();
    const active = feed;
    return () => {
      active.listeners.delete(listener);
      if (active.listeners.size === 0) {
        active.stop();
        feeds.delete(userId);
      }
    };
  },
  refresh(userId: string): Promise<void> {
    return feeds.get(userId)?.refresh() ?? Promise.resolve();
  },
  dismiss(userId: string, id: string): void {
    feeds.get(userId)?.dismiss(id);
  },
  markRead(userId: string, id: string): Promise<void> {
    return feeds.get(userId)?.markRead(id) ?? Promise.resolve();
  },
};
