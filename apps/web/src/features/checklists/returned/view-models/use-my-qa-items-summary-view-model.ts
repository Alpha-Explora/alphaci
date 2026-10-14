"use client";

import { useCurrentIterationViewModel } from "../../iteration";
import { iterationNextStep } from "../../model/iteration-start-rules";
import type { CurrentIteration } from "../../model/iteration-types";
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
  /**
   * Between a delivered iteration and the next (P15): "Iteration 3 was
   * delivered on 14 Oct 2026. Waiting for the Product owner to start
   * iteration 4.", shown instead of the counts. Null otherwise, for a viewer
   * who may start it, and on a backend that does not say.
   */
  waiting: string | null;
  reload: () => void;
}

function summaryStatus(
  enabled: boolean,
  listStatus: string,
  total: number,
  waiting: string | null,
): MyQaItemsSummaryStatus {
  if (!enabled) return "hidden";
  if (listStatus === "error") return "error";
  if (waiting) return "ready";
  return listStatus === "ready" && total > 0 ? "ready" : "hidden";
}

/**
 * The waiting sentence, or null. No role is needed: the server says
 * `canStartNext` only to a viewer who may start, and that viewer's summary
 * stays as it was (Start lives on the Project page and in PO Studio).
 */
function waitingFrom(current: CurrentIteration | null): string | null {
  const step = iterationNextStep(current, null);
  return step.kind === "waiting" ? step.text : null;
}

/** The Project's iteration, read only for a repository filed under a Project. */
function useWaitingSentence(enabled: boolean, qaScope: QaScope): string | null {
  const inProject = qaScope.kind === "project";
  const iteration = useCurrentIterationViewModel({
    deliveryProjectId: inProject ? qaScope.deliveryProjectId : null,
    enabled: enabled && inProject,
  });
  return waitingFrom(iteration.current);
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
  const waiting = useWaitingSentence(enabled, qaScope);

  const fromProject = inProject && project.status !== "unavailable";
  const source = fromProject ? project : repository;
  const counts = summaryCounts(enabled, fromProject, project.data, repository.data);
  const total = myQaItemsSummaryTotal(counts);

  return {
    status: summaryStatus(enabled && qaScope.kind !== "pending", source.status, total, waiting),
    error: source.error,
    counts,
    total,
    // A Project whose server has no project-wide list (an older backend) has
    // no "My QA items" tab to send anyone to: the Checklists tab carries the
    // per-repository list instead.
    destination: fromProject ? myQaItemsDestination(qaScope) : { kind: "checklists-tab" },
    waiting,
    reload: source.reload,
  };
}
