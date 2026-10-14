/* Pure rules for the repository Overview's compact "My QA items" summary:
 * how many items sit in each bucket, and where "Open checklist" goes. No
 * React, no fetch.
 *
 * The full lists (with Progress and re-test controls) live elsewhere: a
 * repository filed under a Project uses the Project's "My QA items" tab; any
 * other repository shows its list on its own Checklists tab. */

import { MY_ITEMS_BUCKETS } from "./project-run-rules";
import type { MyItemsBucket, ProjectMyItems } from "./project-run-types";
import type { QaMyItemsResponse, QaReturnedItem, QaRunItemStatus } from "./qa-run-types";
import type { QaScope } from "./qa-scope";

/** One count per bucket, in MY_ITEMS_BUCKETS order. */
export type MyQaItemsSummaryCounts = Readonly<Record<MyItemsBucket, number>>;

export const EMPTY_MY_QA_ITEMS_SUMMARY: MyQaItemsSummaryCounts = {
  returned: 0,
  inProgress: 0,
  todo: 0,
  readyForQa: 0,
};

/** The Project-wide list is already bucketed by the server. */
export function projectMyItemsSummary(data: ProjectMyItems): MyQaItemsSummaryCounts {
  return {
    returned: data.returned.length,
    inProgress: data.inProgress.length,
    todo: data.todo.length,
    readyForQa: data.readyForQa.length,
  };
}

/**
 * Where a current-run developer item sits, by the status the developer last
 * recorded. Passed means the developer is done and QA has the next move.
 * Failed and blocked are still the developer's to resolve.
 */
const DEVELOPER_ITEM_BUCKET: Readonly<Record<QaRunItemStatus, MyItemsBucket>> = {
  pending: "todo",
  in_progress: "inProgress",
  failed: "inProgress",
  blocked: "inProgress",
  passed: "readyForQa",
  returned_to_dev: "returned",
};

/**
 * A returned item is still "Returned" while QA's verdict stands; once the
 * developer marked it fixed and asked for a re-test (the status moved on),
 * it waits on QA.
 */
function returnedEntryBucket(entry: QaReturnedItem): MyItemsBucket {
  return entry.item.status === "returned_to_dev" ? "returned" : "readyForQa";
}

/**
 * The per-repository list (what QA returned, plus the current uat run's
 * developer items) folded into the same four buckets, so the summary reads
 * the same whichever list stands behind it. Every item lands in exactly one
 * bucket, so the counts add up to the list's own total.
 */
export function repositoryMyItemsSummary(data: QaMyItemsResponse): MyQaItemsSummaryCounts {
  const counts: Record<MyItemsBucket, number> = { ...EMPTY_MY_QA_ITEMS_SUMMARY };
  for (const entry of data.returned) counts[returnedEntryBucket(entry)] += 1;
  for (const entry of data.developerItems) counts[DEVELOPER_ITEM_BUCKET[entry.item.status] ?? "todo"] += 1;
  return counts;
}

export function myQaItemsSummaryTotal(counts: MyQaItemsSummaryCounts): number {
  return MY_ITEMS_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
}

/** The summary's chip labels: short, the bucket titles of the full list. */
const CHIP_LABELS: Readonly<Record<MyItemsBucket, string>> = {
  returned: "Returned",
  inProgress: "In progress",
  todo: "To do",
  readyForQa: "Ready for QA",
};

export function summaryChipLabel(bucket: MyItemsBucket): string {
  return CHIP_LABELS[bucket];
}

/* ── Where the full list lives ───────────────────────────────────────────── */

/** `#my-qa-items` on a Project page opens its QA workspace on "My QA items". */
export const PROJECT_MY_QA_ITEMS_HASH = "my-qa-items";

export type MyQaItemsDestination =
  /** The repository's own Checklists tab, which carries the full list. */
  | { kind: "checklists-tab" }
  /** The Project page, opened on its "My QA items" tab. */
  | { kind: "project"; href: string };

/**
 * Where "Open checklist" goes. A scope that knows where its Project lives
 * (`projectHref`) sends the viewer to the Projects page's "My QA items". The
 * repository page strips that link (`withProjectOnPage`) for every role, since
 * its own Checklists tab carries the Project's QA workspace: the link then
 * opens that tab, on "My QA items". The same goes for a repository with no
 * Project, whose tab carries the per-repository list.
 */
export function myQaItemsDestination(scope: QaScope): MyQaItemsDestination {
  if (scope.kind === "project" && scope.projectHref) {
    return { kind: "project", href: `${scope.projectHref}#${PROJECT_MY_QA_ITEMS_HASH}` };
  }
  return { kind: "checklists-tab" };
}

/** Whether the repository's Checklists tab should carry the full list itself. */
export function checklistsTabShowsMyItems(scope: QaScope): boolean {
  return scope.kind !== "pending" && myQaItemsDestination(scope).kind === "checklists-tab";
}

/** Whether a deep link asks the Project QA workspace to open on "My QA items". */
export function projectWorkspaceOpensMyItems(hash: string | null | undefined): boolean {
  return (hash ?? "").replace(/^#/, "") === PROJECT_MY_QA_ITEMS_HASH;
}
