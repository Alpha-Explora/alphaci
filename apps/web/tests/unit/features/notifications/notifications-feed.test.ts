import {
  notificationsFeed,
  EMPTY_NOTIFICATION_FEED,
} from "../../../../src/features/notifications/data/notifications-feed";
import { notificationsRepository } from "../../../../src/features/notifications/data/notifications-repository";
import { openNotificationsStream } from "../../../../src/features/notifications/data/notifications-stream";
import type {
  NotificationItem,
  NotificationsResponse,
} from "../../../../src/features/notifications/model/notifications-types";

jest.mock(
  "../../../../src/features/notifications/data/notifications-repository",
  () => ({ notificationsRepository: { list: jest.fn(), markRead: jest.fn() } }),
);
jest.mock(
  "../../../../src/features/notifications/data/notifications-stream",
  () => ({ openNotificationsStream: jest.fn() }),
);

const list = notificationsRepository.list as jest.Mock;
const open = openNotificationsStream as jest.Mock;
const member = (id: string): NotificationItem => ({
  id,
  eventCode: "hierarchy.group.member_added",
  title: "You were added to Team A",
  body: "@lead added you as a Member.",
  readAt: null,
  createdAt: "2026-10-19T01:00:00Z",
  projectId: null,
  groupId: "group-a",
  deliveryProjectId: null,
});
const response = (
  items: NotificationItem[],
  unreadCount = items.length,
): NotificationsResponse => ({ enabled: true, items, unreadCount });
let handlers: Parameters<typeof openNotificationsStream>[1];
let close: jest.Mock;
let disposers: Array<() => void>;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function connect(userId = "member") {
  const listener = jest.fn();
  disposers.push(notificationsFeed.subscribe(userId, listener));
  return listener;
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  disposers = [];
  list.mockReset().mockResolvedValue(response([]));
  (notificationsRepository.markRead as jest.Mock)
    .mockReset()
    .mockResolvedValue({ read: true });
  close = jest.fn();
  open.mockReset().mockImplementation((_id, next) => {
    handlers = next;
    return { close };
  });
});
afterEach(() => {
  disposers.forEach((dispose) => dispose());
  jest.useRealTimers();
});

it("shares a live subscription between the Inbox and navigation and cleans up after the last consumer", async () => {
  connect();
  connect();
  await flush();
  expect(open).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledTimes(1);
  disposers.shift()!();
  expect(close).not.toHaveBeenCalled();
  disposers.shift()!();
  expect(close).toHaveBeenCalledTimes(1);
  expect(notificationsFeed.snapshot("member")).toBe(EMPTY_NOTIFICATION_FEED);
});

it("shows a newly added workspace once, updates the badge and ignores repeated deliveries", async () => {
  connect();
  await flush();
  handlers.onSnapshot(response([member("one")]));
  expect(notificationsFeed.snapshot("member")).toMatchObject({
    workspaceRevision: 1,
    response: { unreadCount: 1 },
    alerts: [{ id: "one" }],
  });
  notificationsFeed.dismiss("member", "one");
  handlers.onSnapshot(response([member("one")]));
  expect(notificationsFeed.snapshot("member").alerts).toHaveLength(0);
  expect(notificationsFeed.snapshot("member").workspaceRevision).toBe(1);
});

it("keeps offline membership notifications in the initial Inbox without replaying historical toasts", async () => {
  list.mockResolvedValue(response([member("old")]));
  connect();
  await flush();
  expect(notificationsFeed.snapshot("member").response?.items).toHaveLength(1);
  expect(notificationsFeed.snapshot("member").alerts).toHaveLength(0);
  expect(notificationsFeed.snapshot("member").workspaceRevision).toBe(1);
});

it("keeps the existing badge on a transient failure and retries when focus returns", async () => {
  connect();
  await flush();
  handlers.onSnapshot(response([member("one")], 61));
  list.mockRejectedValue(new Error("offline"));
  await notificationsFeed.refresh("member");
  expect(notificationsFeed.snapshot("member").response?.unreadCount).toBe(61);
  list.mockResolvedValue(response([member("one"), member("two")], 62));
  window.dispatchEvent(new Event("focus"));
  await flush();
  expect(notificationsFeed.snapshot("member").response?.unreadCount).toBe(62);
});

it("does not let a slow initial fetch overwrite a newer live snapshot", async () => {
  let resolve!: (value: NotificationsResponse) => void;
  list.mockImplementation(
    () =>
      new Promise<NotificationsResponse>((done) => {
        resolve = done;
      }),
  );
  connect();
  handlers.onSnapshot(response([member("one")]));
  resolve(response([]));
  await flush();
  expect(notificationsFeed.snapshot("member").response?.unreadCount).toBe(1);
});

it("applies reads once to the shared badge and tolerates an older server snapshot", async () => {
  connect();
  await flush();
  handlers.onSnapshot(response([member("one")], 61));
  await notificationsFeed.markRead("member", "one");
  await notificationsFeed.markRead("member", "one");
  expect(notificationsFeed.snapshot("member").response?.unreadCount).toBe(60);
  expect(notificationsFeed.snapshot("member").alerts).toHaveLength(0);
  handlers.onSnapshot(response([member("one")], 61));
  expect(notificationsFeed.snapshot("member").response?.unreadCount).toBe(60);
});

it("closes and clears the old account when a different member signs in", async () => {
  connect("a");
  await flush();
  handlers.onSnapshot(response([member("one")]));
  connect("b");
  await flush();
  expect(close).toHaveBeenCalled();
  expect(notificationsFeed.snapshot("a")).toBe(EMPTY_NOTIFICATION_FEED);
  expect(notificationsFeed.snapshot("b").alerts).toHaveLength(0);
});

it("rejects a fallback response for a different session account", async () => {
  list.mockResolvedValue({
    ...response([member("other")]),
    userId: "someone-else",
  });
  connect("member");
  await flush();
  expect(notificationsFeed.snapshot("member")).toBe(EMPTY_NOTIFICATION_FEED);
  expect(close).toHaveBeenCalled();
});

it("suppresses toasts and clears queued alerts when notifications are disabled", async () => {
  connect();
  await flush();
  handlers.onSnapshot(response([member("one")]));
  handlers.onSnapshot({ enabled: false, items: [], unreadCount: 0 });
  expect(notificationsFeed.snapshot("member").alerts).toHaveLength(0);
});
