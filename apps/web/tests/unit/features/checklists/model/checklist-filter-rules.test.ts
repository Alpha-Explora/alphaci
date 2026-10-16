import {
  CHECKLIST_FILTERS,
  checklistFilterCounts,
  emptyFilterText,
  initialChecklistFilter,
  itemFilterKey,
  itemMatches,
  NO_VERDICTS,
  verdictsBySourceItem,
} from "../../../../../src/features/checklists/model/checklist-filter-rules";
import type { ProjectQaRun, ProjectQaRunItem } from "../../../../../src/features/checklists/model/project-run-types";

const verdict = (sourceItemId: string | null, status: ProjectQaRunItem["status"]) =>
  ({ id: `run-${sourceItemId ?? "gone"}`, sourceItemId, status }) as ProjectQaRunItem;

const run = (items: ProjectQaRunItem[]) => ({ items }) as ProjectQaRun;

describe("verdictsBySourceItem", () => {
  it("keys QA's verdicts by the requirement item each run item was taken from", () => {
    const verdicts = verdictsBySourceItem(run([verdict("item-1", "returned_to_dev"), verdict("item-2", "passed")]));
    expect(verdicts.get("item-1")?.status).toBe("returned_to_dev");
    expect(verdicts.get("item-2")?.status).toBe("passed");
  });

  it("skips a run item whose source item was deleted, and has none without a run", () => {
    expect(verdictsBySourceItem(run([verdict(null, "failed")])).size).toBe(0);
    expect(verdictsBySourceItem(null)).toBe(NO_VERDICTS);
  });
});

describe("itemFilterKey (the backend's bucketMyQaItem, for the chips)", () => {
  it("puts an item QA sent back under Returned by QA, whatever its Progress", () => {
    const verdicts = verdictsBySourceItem(run([verdict("item-1", "returned_to_dev")]));
    for (const progress of ["todo", "in_progress", "done"] as const) {
      expect(itemFilterKey({ id: "item-1", progress }, verdicts)).toBe("returned");
    }
  });

  it("otherwise files it by Progress, whatever else QA said", () => {
    const verdicts = verdictsBySourceItem(run([verdict("item-1", "failed"), verdict("item-2", "passed")]));
    expect(itemFilterKey({ id: "item-1", progress: "in_progress" }, verdicts)).toBe("in_progress");
    expect(itemFilterKey({ id: "item-2", progress: "done" }, verdicts)).toBe("done");
    expect(itemFilterKey({ id: "item-3", progress: "todo" }, NO_VERDICTS)).toBe("todo");
  });

  it("matches every item under All", () => {
    expect(itemMatches({ id: "item-1", progress: "todo" }, NO_VERDICTS, "all")).toBe(true);
    expect(itemMatches({ id: "item-1", progress: "todo" }, NO_VERDICTS, "done")).toBe(false);
  });
});

describe("checklistFilterCounts", () => {
  it("counts each item once, under All and under its own chip", () => {
    const verdicts = verdictsBySourceItem(run([verdict("a", "returned_to_dev")]));
    const counts = checklistFilterCounts(
      [
        { items: [{ id: "a", progress: "in_progress" }, { id: "b", progress: "done" }] },
        { items: [{ id: "c", progress: "todo" }] },
      ] as never,
      verdicts,
    );
    expect(counts).toEqual({ all: 3, returned: 1, todo: 1, in_progress: 0, done: 1 });
  });
});

describe("initialChecklistFilter", () => {
  it("opens on Returned by QA for #my-qa-items, with or without the hash sign", () => {
    expect(initialChecklistFilter("#my-qa-items")).toBe("returned");
    expect(initialChecklistFilter("my-qa-items")).toBe("returned");
  });

  it.each(["", "#checklists", null, undefined])("opens on All for %p", (hash) => {
    expect(initialChecklistFilter(hash)).toBe("all");
  });
});

describe("the chips' words", () => {
  it("offers All first, then QA's word, then Progress in the order work moves", () => {
    expect(CHECKLIST_FILTERS.map((entry) => entry.label)).toEqual(["All", "Returned by QA", "To do", "In progress", "Done"]);
  });

  it("says what a chip that matches nothing is missing", () => {
    expect(emptyFilterText("returned")).toBe("Nothing returned by QA.");
    expect(emptyFilterText("done")).toBe("Nothing marked Done yet.");
  });
});
