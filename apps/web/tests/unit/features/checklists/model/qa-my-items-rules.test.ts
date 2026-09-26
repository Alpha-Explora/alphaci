import {
  applyRunToMyItems,
  developerItemRun,
  groupByCommit,
  myItemKey,
  myItemsCount,
  myItemsFromReturned,
  normalizeMyQaItems,
} from "../../../../../src/features/checklists/model/qa-my-items-rules";
import { allowedItemStatuses } from "../../../../../src/features/checklists/model/qa-run-rules";
import { qaRun, runItem } from "../qa-run-fixtures";

function entry(position: number, overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    branch: "uat",
    commitSha: "9f8e7d6c5b4a",
    checklistName: "Release smoke test",
    item: { ...runItem(position, { targetPersona: "developer", canUpdate: true }), ...item },
    ...overrides,
  };
}

describe("normalizeMyQaItems", () => {
  it("reads both lists as sent", () => {
    const data = normalizeMyQaItems({ returned: [entry(0, {}, { status: "returned_to_dev" })], developerItems: [entry(1)] });
    expect(data.returned).toHaveLength(1);
    expect(data.returned[0].item.status).toBe("returned_to_dev");
    expect(data.developerItems[0]).toEqual({
      runId: "run-1",
      branch: "uat",
      commitSha: "9f8e7d6c5b4a",
      checklistName: "Release smoke test",
      item: expect.objectContaining({ id: "ri-1", runId: "run-1", canUpdate: true, rowVersion: 1, status: "pending" }),
    });
    expect(myItemsCount(data)).toBe(2);
  });

  it.each([undefined, null, {}, { returned: "x", developerItems: 3 }])("degrades %p to two empty lists", (input) => {
    expect(normalizeMyQaItems(input)).toEqual({ returned: [], developerItems: [] });
  });

  it("drops rows without a run, an item id, a title or a known status", () => {
    const data = normalizeMyQaItems({
      developerItems: [
        { item: runItem(0) },
        entry(1, {}, { id: "" }),
        entry(2, {}, { title: null }),
        entry(3, {}, { status: "done" }),
        entry(4),
      ],
    });
    expect(data.developerItems.map((row) => row.item.id)).toEqual(["ri-4"]);
  });

  it("makes an item read-only unless the server said canUpdate: true and sent a row version", () => {
    const data = normalizeMyQaItems({
      developerItems: [
        entry(0, {}, { canUpdate: "true" }),
        entry(1, {}, { canUpdate: undefined }),
        entry(2, {}, { rowVersion: undefined }),
        entry(3, {}, { rowVersion: 0 }),
      ],
    });
    expect(data.developerItems.map((row) => row.item.canUpdate)).toEqual([false, false, false, true]);
  });

  it("fills absent optionals safely", () => {
    const data = normalizeMyQaItems({
      developerItems: [{ runId: "run-1", item: { id: "i1", title: "Tests pass", status: "pending", rowVersion: 3, canUpdate: true } }],
    });
    expect(data.developerItems[0]).toEqual({
      runId: "run-1",
      branch: "",
      commitSha: "",
      checklistName: "Checklist",
      item: {
        id: "i1",
        runId: "run-1",
        position: 0,
        title: "Tests pass",
        description: null,
        targetPersona: "all",
        verificationType: "manual",
        testIdentifier: null,
        status: "pending",
        notes: null,
        defectSeverity: null,
        reproductionSteps: null,
        fixRequest: null,
        verifiedBy: null,
        verifiedAt: null,
        rowVersion: 3,
        canUpdate: true,
        previous: null,
      },
    });
  });

  it("reads the older qa-returned-items reply as returned items only", () => {
    expect(myItemsFromReturned({ items: [entry(0)] }).returned).toHaveLength(1);
    expect(myItemsFromReturned({ items: [entry(0)] }).developerItems).toEqual([]);
    expect(myItemsFromReturned(null)).toEqual({ returned: [], developerItems: [] });
  });
});

describe("after a write", () => {
  it("replaces the item in both lists from the run a PATCH returned, and leaves other runs alone", () => {
    const data = normalizeMyQaItems({
      returned: [entry(0, {}, { status: "returned_to_dev" })],
      developerItems: [entry(1), entry(1, { runId: "run-2" }, { runId: "run-2" })],
    });
    const run = qaRun({ items: [runItem(0, { status: "returned_to_dev", rowVersion: 5 }), runItem(1, { status: "passed", rowVersion: 2 })] });
    const next = applyRunToMyItems(data, run);
    expect(next.developerItems[0].item.status).toBe("passed");
    expect(next.developerItems[0].item.rowVersion).toBe(2);
    expect(next.developerItems[1].item.status).toBe("pending");
    expect(next.returned[0].item.rowVersion).toBe(5);
  });
});

describe("what a developer may set from the Overview", () => {
  it("offers the item's statuses but never Returned to dev", () => {
    const row = normalizeMyQaItems({ developerItems: [entry(0)] }).developerItems[0];
    expect(allowedItemStatuses(row.item, developerItemRun(row))).toEqual([
      "pending",
      "in_progress",
      "passed",
      "failed",
      "blocked",
    ]);
  });

  it("offers nothing when the server says the item is not theirs", () => {
    const row = normalizeMyQaItems({ developerItems: [entry(0, {}, { canUpdate: false })] }).developerItems[0];
    expect(allowedItemStatuses(row.item, developerItemRun(row))).toEqual([]);
  });

  it("keys and groups rows by commit, in first-seen order", () => {
    const rows = normalizeMyQaItems({
      developerItems: [entry(0), entry(1, { commitSha: "aaaaaaa1111" }), entry(2)],
    }).developerItems;
    expect(myItemKey(rows[0])).toBe("run-1:ri-0");
    expect(groupByCommit(rows).map((group) => [group.label, group.entries.length])).toEqual([
      ["uat @ 9f8e7d6", 2],
      ["uat @ aaaaaaa", 1],
    ]);
  });
});
