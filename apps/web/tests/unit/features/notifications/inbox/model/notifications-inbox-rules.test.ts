import {
  flattenGroups,
  groupNotificationsByDay,
} from "../../../../../../src/features/notifications/inbox/model/notifications-inbox-rules";
import type { NotificationItem } from "../../../../../../src/features/notifications/model/notifications-types";

/* These assertions were previously only reachable by rendering the whole inbox
 * route and inspecting the DOM. Extracting grouping into a pure module made the
 * behaviour directly testable — no React, no fetch mock, no jsdom. That is the
 * practical payoff of the model/ layer, not just the tidier folder. */

function at(offsetDays: number, id = "n-1"): NotificationItem {
  const created = new Date();
  created.setDate(created.getDate() - offsetDays);
  created.setHours(12, 0, 0, 0);
  return {
    id,
    title: "Pipeline finished",
    body: "main deployed",
    eventCode: "run.succeeded",
    readAt: null,
    createdAt: created.toISOString(),
  };
}

describe("groupNotificationsByDay", () => {
  it("splits items into today, yesterday, this week and earlier", () => {
    const groups = groupNotificationsByDay([
      at(0, "today"),
      at(1, "yesterday"),
      at(3, "this-week"),
      at(90, "earlier"),
    ]);

    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "This week",
      "Earlier",
    ]);
  });

  it("omits empty groups so the list has no blank headers", () => {
    const groups = groupNotificationsByDay([at(0, "only-today")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });

  it("files an unparseable timestamp under Earlier rather than dropping it", () => {
    const broken: NotificationItem = { ...at(0), createdAt: "not-a-date" };

    const groups = groupNotificationsByDay([broken]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Earlier");
    expect(groups[0].items).toHaveLength(1);
  });

  it("returns nothing for an empty list", () => {
    expect(groupNotificationsByDay([])).toEqual([]);
  });
});

describe("flattenGroups", () => {
  it("interleaves header rows with item rows", () => {
    const rows = flattenGroups(
      groupNotificationsByDay([at(0, "a"), at(1, "b")]),
    );

    expect(rows.map((r) => r.type)).toEqual([
      "header",
      "item",
      "header",
      "item",
    ]);
  });

  it("numbers items continuously across group boundaries", () => {
    // The index drives a capped stagger animation, so it has to keep counting
    // through a header rather than restarting per group.
    const rows = flattenGroups(
      groupNotificationsByDay([at(0, "a"), at(1, "b"), at(3, "c")]),
    );

    const indices = rows
      .filter((r): r is Extract<typeof r, { type: "item" }> => r.type === "item")
      .map((r) => r.index);

    expect(indices).toEqual([0, 1, 2]);
  });
});
