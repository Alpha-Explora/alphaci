"use client";

import type { AppRole } from "@/shared/api/contracts";

import type { QaScope } from "../../model/qa-scope";
import { usePoDeliveryViewModel, type PoDeliveryViewModel } from "./use-po-delivery-view-model";
import { useProjectRunViewModel, type ProjectRunViewModel } from "./use-project-run-view-model";
import { useQaPromotionViewModel, type QaPromotionViewModel } from "./use-qa-promotion-view-model";
import { useQaRunViewModel, type QaRunViewModel } from "./use-qa-run-view-model";
import { useStudioChecklistsViewModel, type StudioChecklistsViewModel } from "./use-studio-checklists-view-model";

export interface StudioRunsViewModel {
  /** The Project run's lookup state: what decides which run column shows. */
  status: ProjectRunViewModel["status"];
  /** True when the run column is the Project's QA run. */
  projectMode: boolean;
  projectRun: ProjectRunViewModel;
  /** The per-repository checklist and run: idle in Project mode. */
  checklists: StudioChecklistsViewModel;
  run: QaRunViewModel;
  promotion: QaPromotionViewModel;
  /** The Project's delivery: what Merge to main merges on a Project of two or more repositories. */
  delivery: PoDeliveryViewModel;
}

/**
 * What the readiness chip watches: the selected run's id, status and sign-off,
 * once the run lookup has answered. Signing off or reopening changes it, and
 * the chip re-reads whether uat is ready for main.
 */
function repositoryWatch(run: QaRunViewModel): string | null {
  if (run.status !== "ready" && run.status !== "starting") return null;
  const current = run.run;
  return [current?.id, current?.status, current?.signoff?.id].map((part) => part ?? "").join("|");
}

/** The same watch on a Project run: its sign-off decides the merge gate now. */
function projectWatch(run: ProjectRunViewModel): string | null {
  if (run.status !== "ready" && run.status !== "starting") return null;
  const current = run.run;
  return ["project", current?.id, current?.status, current?.signoff?.id].map((part) => part ?? "").join("|");
}

/**
 * Which run QA Studio verifies. A repository filed under a Project uses the
 * Project's QA run; any other repository — or a server without Project runs
 * (a 404) — keeps the per-repository checklist run. Nothing loads for the
 * per-repository run while the repository's Project is still being read.
 */
export function useStudioRunsViewModel(options: {
  projectId: string;
  appRole: AppRole | null | undefined;
  qaScope: QaScope;
  /** The branch under test (the QA environment's), for the per-repository run. */
  branch: string | null;
}): StudioRunsViewModel {
  const { projectId, appRole, qaScope, branch } = options;
  const enabled = Boolean(projectId);
  const projectRun = useProjectRunViewModel({
    deliveryProjectId: qaScope.kind === "project" ? qaScope.deliveryProjectId : null,
    enabled,
  });
  const projectMode = qaScope.kind === "project" && projectRun.status !== "unavailable";
  const legacyEnabled = enabled && qaScope.kind !== "pending" && !projectMode;
  const checklists = useStudioChecklistsViewModel({ projectId, enabled: legacyEnabled });
  const run = useQaRunViewModel({
    projectId,
    enabled: legacyEnabled,
    branch,
    checklistId: checklists.selected?.id ?? null,
  });
  const promotion = useQaPromotionViewModel({
    projectId,
    enabled,
    appRole,
    watch: projectMode ? projectWatch(projectRun) : repositoryWatch(run),
  });
  const delivery = usePoDeliveryViewModel({
    deliveryProjectId: qaScope.kind === "project" ? qaScope.deliveryProjectId : null,
    enabled: enabled && projectMode,
    projectId,
    appRole,
    promotion,
  });
  return { status: projectRun.status, projectMode, projectRun, checklists, run, promotion, delivery };
}
