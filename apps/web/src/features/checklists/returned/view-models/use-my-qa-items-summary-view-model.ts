"use client";

import {
  EMPTY_MY_QA_ITEMS_SUMMARY,
  myQaItemsDestination,
  myQaItemsSummaryTotal,
  projectMyItemsSummary,
  repositoryMyItemsSummary,
  type MyQaItemsDestination,
  type MyQaItemsSummaryCounts,
} from "../../model/my-qa-items-summary-rules";
import type { ProjectMyItems } from "../../model/project-run-types";
import type { QaMyItemsResponse } from "../../model/qa-run-types";
import type { QaScope } from "../../model/qa-scope";
import { useMyQaItemsViewModel } from "./use-my-qa-items-view-model";
import { useProjectMyItemsViewModel } from "./use-project-my-items-view-model";

/**
 * `hidden`: nothing to show (off, still loading, or no items: the Overview
 * stays quiet). `error`: the list could not be read. `ready`: counts to show.
 */
export type MyQaItemsSummaryStatus = "hidden" | "error" | "ready";

export interface MyQaItemsSummaryViewModel {
  status: MyQaItemsSummaryStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  counts: MyQaItemsSummaryCounts;
  total: number;
  /** Where "Open checklist" goes. */
  destination: MyQaItemsDestination;
  reload: () => void;
}

function summaryStatus(enabled: boolean, listStatus: string, total: number): MyQaItemsSummaryStatus {
  if (!enabled) return "hidden";
  if (listStatus === "error") return "error";
  return listStatus === "ready" && total > 0 ? "ready" : "hidden";
}

function summaryCounts(
  enabled: boolean,
  fromProject: boolean,
  projectData: ProjectMyItems,
  repositoryData: QaMyItemsResponse,
): MyQaItemsSummaryCounts {
  if (!enabled) return EMPTY_MY_QA_ITEMS_SUMMARY;
  if (fromProject) return projectMyItemsSummary(projectData);
  return repositoryMyItemsSummary(repositoryData);
}

/**
 * ViewModel for the Overview's compact "My QA items" summary. It reads the
 * same lists as the full card — the Project-wide one for a repository filed
 * under a Project (falling back to the per-repository list on a server
 * without it), the per-repository one otherwise — and keeps only the counts.
 */
export function useMyQaItemsSummaryViewModel(options: {
  projectId: string;
  enabled: boolean;
  qaScope: QaScope;
}): MyQaItemsSummaryViewModel {
  const { projectId, enabled, qaScope } = options;
  const inProject = qaScope.kind === "project";
  const project = useProjectMyItemsViewModel({
    deliveryProjectId: inProject ? qaScope.deliveryProjectId : null,
    enabled: enabled && inProject,
  });
  const readRepositoryList =
    enabled && qaScope.kind !== "pending" && (!inProject || project.status === "unavailable");
  const repository = useMyQaItemsViewModel({ projectId, enabled: readRepositoryList });

  const fromProject = inProject && project.status !== "unavailable";
  const source = fromProject ? project : repository;
  const counts = summaryCounts(enabled, fromProject, project.data, repository.data);
  const total = myQaItemsSummaryTotal(counts);

  return {
    status: summaryStatus(enabled && qaScope.kind !== "pending", source.status, total),
    error: source.error,
    counts,
    total,
    // A Project whose server has no project-wide list (an older backend) has
    // no "My QA items" tab to send anyone to: the Checklists tab carries the
    // per-repository list instead.
    destination: fromProject ? myQaItemsDestination(qaScope) : { kind: "checklists-tab" },
    reload: source.reload,
  };
}
