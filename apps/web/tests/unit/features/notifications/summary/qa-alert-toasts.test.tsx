import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { notificationsRepository } from "../../../../../src/features/notifications/data/notifications-repository";
import type { NotificationItem } from "../../../../../src/features/notifications/model/notifications-types";
import {
  QaAlertToasts,
  useNotificationsSummaryViewModel,
} from "../../../../../src/features/notifications/summary";
import { NOTIFICATIONS_POLL_MS } from "../../../../../src/features/notifications/summary/view-models/use-notifications-summary-view-model";

jest.mock("../../../../../src/features/notifications/data/notifications-repository", () => ({
  notificationsRepository: { list: jest.fn() },
}));

const list = notificationsRepository.list as jest.Mock;

function refusal(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n-1",
    title: 'QA blocked "Log in" in Check',
    body: "this wrong",
    eventCode: "qa.item.blocked",
    readAt: null,
    createdAt: "2026-10-19T01:00:00.000Z",
    projectId: "proj-1",
    groupId: null,
    deliveryProjectId: null,
    ...overrides,
  };
}

let root: Root | null = null;
let container: HTMLDivElement;

function Harness() {
  const vm = useNotificationsSummaryViewModel({ guest: false });
  return (
    <>
      <output data-unread={vm.unreadCount} />
      <QaAlertToasts alerts={vm.alerts} onDismiss={vm.dismissAlert} />
    </>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  list.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  jest.useRealTimers();
});

describe("QA refusal pop-ups in the app shell", () => {
  it("pops up a refusal that arrives while the page is open, once", async () => {
    list.mockResolvedValue({ enabled: true, unreadCount: 0, items: [] });
    act(() => root?.render(<Harness />));
    await flush();
    expect(container.querySelector(".qa-alert")).toBeNull();

    list.mockResolvedValue({ enabled: true, unreadCount: 1, items: [refusal()] });
    await act(async () => {
      jest.advanceTimersByTime(NOTIFICATIONS_POLL_MS);
    });
    await flush();

    const alert = container.querySelector(".qa-alert");
    expect(alert?.textContent).toContain('QA blocked "Log in" in Check');
    expect(alert?.textContent).toContain("this wrong");
    expect(container.querySelector<HTMLAnchorElement>(".qa-alert__open")?.getAttribute("href")).toBe(
      "/projects/proj-1?focus=my-qa-items#overview",
    );
    expect(container.querySelector("output")?.getAttribute("data-unread")).toBe("1");

    act(() => container.querySelector<HTMLButtonElement>(".qa-alert__dismiss")?.click());
    expect(container.querySelector(".qa-alert")).toBeNull();

    // Still unread on the next poll, but it already popped up: it stays in the Inbox only.
    await act(async () => {
      jest.advanceTimersByTime(NOTIFICATIONS_POLL_MS);
    });
    await flush();
    expect(container.querySelector(".qa-alert")).toBeNull();
  });

  it("pops nothing up when in-app notifications are switched off", async () => {
    list.mockResolvedValue({ enabled: false, unreadCount: 1, items: [refusal()] });
    act(() => root?.render(<Harness />));
    await flush();
    expect(container.querySelector(".qa-alert")).toBeNull();
  });
});
