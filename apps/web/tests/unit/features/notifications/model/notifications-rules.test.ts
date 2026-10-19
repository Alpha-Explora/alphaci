import { qaAlertsToShow, qaRefusalHref } from "../../../../../src/features/notifications/model/notifications-rules";
import type { NotificationItem } from "../../../../../src/features/notifications/model/notifications-types";

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
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

describe("QA refusal pop-ups", () => {
  it("pops up unread refusals not shown before, newest first, at most three", () => {
    const items = [
      notification({ id: "a", createdAt: "2026-10-19T01:00:00.000Z" }),
      notification({ id: "b", eventCode: "qa.item.failed", createdAt: "2026-10-19T03:00:00.000Z" }),
      notification({ id: "c", eventCode: "qa.item.returned_to_dev", createdAt: "2026-10-19T02:00:00.000Z" }),
      notification({ id: "d", createdAt: "2026-10-19T00:30:00.000Z" }),
      notification({ id: "read", readAt: "2026-10-19T04:00:00.000Z" }),
      notification({ id: "other", eventCode: "qa.run.signed_off" }),
      notification({ id: "seen", createdAt: "2026-10-19T05:00:00.000Z" }),
    ];

    expect(qaAlertsToShow(items, new Set(["seen"])).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("links a refusal to the project's My QA items", () => {
    expect(qaRefusalHref({ projectId: "proj 1" })).toBe("/projects/proj%201?focus=my-qa-items#overview");
    expect(qaRefusalHref({ projectId: null })).toBeNull();
  });
});
