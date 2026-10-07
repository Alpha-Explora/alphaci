import {
  checklistsTabShowsMyItems,
  EMPTY_MY_QA_ITEMS_SUMMARY,
  myQaItemsDestination,
  myQaItemsSummaryTotal,
  projectMyItemsSummary,
  projectWorkspaceOpensMyItems,
  repositoryMyItemsSummary,
  summaryChipLabel,
} from "../../../../../src/features/checklists/model/my-qa-items-summary-rules";
import { myItemsCount, normalizeMyQaItems } from "../../../../../src/features/checklists/model/qa-my-items-rules";
import type { ProjectMyItems } from "../../../../../src/features/checklists/model/project-run-types";
import type { QaRunItemStatus } from "../../../../../src/features/checklists/model/qa-run-types";
import { REPOSITORY_SCOPE, withProjectOnPage, type QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { runItem } from "../qa-run-fixtures";

function entry(position: number, status: QaRunItemStatus) {
  return {
    runId: "run-1",
    branch: "uat",
    commitSha: "9f8e7d6c5b4a",
    checklistName: "Release smoke test",
    item: { ...runItem(position, { targetPersona: "developer" }), status },
  };
}

function feed(count: number): ProjectMyItems["returned"] {
  return Array.from({ length: count }, (_, index) => ({ item: { id: `i-${index}` } })) as unknown as ProjectMyItems["returned"];
}

const PROJECT_SCOPE: QaScope = {
  kind: "project",
  deliveryProjectId: "dp-1",
  projectName: "Checkout",
  projectHref: "/workflows?group=g-1&project=dp-1",
};

describe("projectMyItemsSummary", () => {
  it("counts each server bucket", () => {
    const counts = projectMyItemsSummary({ returned: feed(2), inProgress: feed(1), todo: feed(4), readyForQa: feed(0) });
    expect(counts).toEqual({ returned: 2, inProgress: 1, todo: 4, readyForQa: 0 });
    expect(myQaItemsSummaryTotal(counts)).toBe(7);
  });
});

describe("repositoryMyItemsSummary", () => {
  it("folds returned items and developer items into the four buckets", () => {
    const data = normalizeMyQaItems({
      returned: [entry(0, "returned_to_dev"), entry(1, "pending")],
      developerItems: [
        entry(2, "pending"),
        entry(3, "in_progress"),
        entry(4, "failed"),
        entry(5, "blocked"),
        entry(6, "passed"),
      ],
    });
    const counts = repositoryMyItemsSummary(data);
    // A returned item is "Returned" while QA's verdict stands, and waits on QA
    // once its status moved on (re-test requested).
    expect(counts).toEqual({ returned: 1, inProgress: 3, todo: 1, readyForQa: 2 });
    // Every item lands in exactly one bucket.
    expect(myQaItemsSummaryTotal(counts)).toBe(myItemsCount(data));
  });

  it("is all zeros for empty lists", () => {
    expect(repositoryMyItemsSummary({ returned: [], developerItems: [] })).toEqual(EMPTY_MY_QA_ITEMS_SUMMARY);
  });
});

describe("summaryChipLabel", () => {
  it("uses the short bucket names", () => {
    expect(["returned", "inProgress", "todo", "readyForQa"].map((b) => summaryChipLabel(b as never))).toEqual([
      "Returned",
      "In progress",
      "To do",
      "Ready for QA",
    ]);
  });
});

describe("myQaItemsDestination", () => {
  it("sends a repository in a Project to the Project's My QA items tab", () => {
    expect(myQaItemsDestination(PROJECT_SCOPE)).toEqual({
      kind: "project",
      href: "/workflows?group=g-1&project=dp-1#my-qa-items",
    });
    expect(checklistsTabShowsMyItems(PROJECT_SCOPE)).toBe(false);
  });

  it("keeps a repository with no Project on its own Checklists tab, which then carries the list", () => {
    expect(myQaItemsDestination(REPOSITORY_SCOPE)).toEqual({ kind: "checklists-tab" });
    expect(checklistsTabShowsMyItems(REPOSITORY_SCOPE)).toBe(true);
  });

  it("falls back to the Checklists tab for a Project the page cannot link to", () => {
    const scope: QaScope = { ...PROJECT_SCOPE, projectHref: null };
    expect(myQaItemsDestination(scope)).toEqual({ kind: "checklists-tab" });
    expect(checklistsTabShowsMyItems(scope)).toBe(true);
  });

  it("keeps a Developer's link on the repository page once the Project link is stripped", () => {
    const onPage = withProjectOnPage(PROJECT_SCOPE);
    expect(myQaItemsDestination(onPage)).toEqual({ kind: "checklists-tab" });
    expect(checklistsTabShowsMyItems(onPage)).toBe(true);
  });

  it("shows nothing on the Checklists tab while the Project is still being read", () => {
    expect(checklistsTabShowsMyItems({ kind: "pending" })).toBe(false);
  });
});

describe("projectWorkspaceOpensMyItems", () => {
  it("reads #my-qa-items, with or without the hash sign", () => {
    expect(projectWorkspaceOpensMyItems("#my-qa-items")).toBe(true);
    expect(projectWorkspaceOpensMyItems("my-qa-items")).toBe(true);
  });

  it.each(["", "#run", null, undefined])("ignores %p", (hash) => {
    expect(projectWorkspaceOpensMyItems(hash)).toBe(false);
  });
});
