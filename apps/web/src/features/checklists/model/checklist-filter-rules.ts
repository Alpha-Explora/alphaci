import { PROJECT_MY_QA_ITEMS_HASH } from "./my-qa-items-summary-rules";
import type { ProjectQaRun, ProjectQaRunItem } from "./project-run-types";
import type { Requirement, RequirementItem } from "./requirement-types";

/**
 * What a Developer narrows its checklist to. "returned" is QA's verdict and
 * wins over Progress (QA sending an item back also puts it In progress), so
 * an item is in exactly one of the four, as on Home's "Returned by QA" and
 * the backend's My QA items (`bucketMyQaItem`).
 */
export type ChecklistFilter = "all" | "returned" | "todo" | "in_progress" | "done";

export const CHECKLIST_FILTERS: ReadonlyArray<{ id: ChecklistFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "returned", label: "Returned by QA" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

/** QA's verdict on each requirement item, from the run's copy of it (keyed by the item it was taken from). */
export type ItemVerdicts = ReadonlyMap<string, ProjectQaRunItem>;

export const NO_VERDICTS: ItemVerdicts = new Map();

export function verdictsBySourceItem(run: ProjectQaRun | null | undefined): ItemVerdicts {
  if (!run) return NO_VERDICTS;
  const verdicts = new Map<string, ProjectQaRunItem>();
  for (const runItem of run.items) {
    if (runItem.sourceItemId) verdicts.set(runItem.sourceItemId, runItem);
  }
  return verdicts;
}

/** The one filter an item belongs to. */
export function itemFilterKey(item: Pick<RequirementItem, "id" | "progress">, verdicts: ItemVerdicts): Exclude<ChecklistFilter, "all"> {
  if (verdicts.get(item.id)?.status === "returned_to_dev") return "returned";
  return item.progress;
}

export function itemMatches(
  item: Pick<RequirementItem, "id" | "progress">,
  verdicts: ItemVerdicts,
  filter: ChecklistFilter,
): boolean {
  return filter === "all" || itemFilterKey(item, verdicts) === filter;
}

/** How many items each chip would show, across every given requirement. */
export function checklistFilterCounts(
  requirements: ReadonlyArray<Pick<Requirement, "items">>,
  verdicts: ItemVerdicts,
): Record<ChecklistFilter, number> {
  const counts: Record<ChecklistFilter, number> = { all: 0, returned: 0, todo: 0, in_progress: 0, done: 0 };
  for (const requirement of requirements) {
    for (const item of requirement.items) {
      counts.all += 1;
      counts[itemFilterKey(item, verdicts)] += 1;
    }
  }
  return counts;
}

/** Home's "Returned by QA" links here with `#my-qa-items`: open on what was sent back. */
export function initialChecklistFilter(hash: string | null | undefined): ChecklistFilter {
  return (hash ?? "").replace(/^#/, "") === PROJECT_MY_QA_ITEMS_HASH ? "returned" : "all";
}

/** Said in place of the list when a chip matches nothing. */
export function emptyFilterText(filter: ChecklistFilter): string {
  switch (filter) {
    case "returned":
      return "Nothing returned by QA.";
    case "todo":
      return "Nothing left to do.";
    case "in_progress":
      return "Nothing in progress.";
    case "done":
      return "Nothing marked Done yet.";
    default:
      return "No items yet.";
  }
}
