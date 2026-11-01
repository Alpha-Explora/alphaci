"use client";

import { useState } from "react";

import {
  groupOffsets,
  groupRunItems,
  initialExpandedGroups,
  itemMatchesRunFilter,
  runFilterCounts,
  visibleRunFilters,
  type RunFilter,
} from "../../model/project-run-rules";
import type { ProjectQaRun, ProjectQaRunItem, ProjectRunGroup } from "../../model/project-run-types";

export interface ProjectRunListGroup extends ProjectRunGroup {
  /** Where the group's numbering starts, so items count 01, 02… across the whole run. */
  offset: number;
  /** The group's items under the chosen filter (all of them under "All"). */
  shown: ProjectQaRunItem[];
  expanded: boolean;
}

/** `empty`: nothing to draw under the chosen filter (or a run with no items). */
export type ProjectRunListStatus = "ready" | "empty";

export interface ProjectRunListViewModel {
  status: ProjectRunListStatus;
  filter: RunFilter;
  filters: RunFilter[];
  counts: Record<RunFilter, number>;
  setFilter: (filter: RunFilter) => void;
  /** The groups to draw: under a filter, only those with a matching item. */
  groups: ProjectRunListGroup[];
  toggleGroup: (key: string) => void;
}

/**
 * ViewModel for a Project run's item list: the Verification filter and which
 * requirements are expanded. Mounted with the run (the panel keys it by run
 * id), so a reopened or newly started run starts from its own defaults.
 *
 * Under a filter every shown group is expanded: the filter already narrowed
 * the list to the items the tester asked for, and hiding them again behind a
 * collapsed heading would defeat it.
 */
export function useProjectRunListViewModel(run: ProjectQaRun): ProjectRunListViewModel {
  const all = groupRunItems(run.items);
  const [filter, setFilter] = useState<RunFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => initialExpandedGroups(all));

  const counts = runFilterCounts(run.items);
  const offsets = groupOffsets(all);
  const groups = all
    .map((group, index) => ({
      ...group,
      offset: offsets[index],
      shown: group.items.filter((item) => itemMatchesRunFilter(item, filter)),
      // A requirement added since the list opened has nothing recorded yet: expanded.
      expanded: filter !== "all" || (expanded[group.key] ?? true),
    }))
    .filter((group) => filter === "all" || group.shown.length > 0);

  return {
    status: groups.length === 0 ? "empty" : "ready",
    filter,
    filters: visibleRunFilters(counts, filter),
    counts,
    setFilter,
    groups,
    toggleGroup: (key) => setExpanded((current) => ({ ...current, [key]: !(current[key] ?? true) })),
  };
}
