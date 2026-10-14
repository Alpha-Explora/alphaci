"use client";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import type { ProjectQaRun, ProjectQaRunPermissions } from "../../model/project-run-types";
import type { QaReopenViewModel } from "./use-qa-reopen-view-model";
import { useReopenRunViewModel } from "./use-qa-reopen-view-model";
import type { QaSignoffViewModel } from "./use-qa-signoff-view-model";
import { useSignoffViewModel } from "./use-qa-signoff-view-model";

/**
 * Signing a Project run off: the same dialog, verdict rules and copy as a
 * repository run, sent to the Project run route. Open runs only, and only
 * when the server (or, without its flag, the app role) allows it.
 */
export function useProjectSignoffViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  permissions: Pick<ProjectQaRunPermissions, "canSignOff">;
  onRun: (run: ProjectQaRun) => void;
}): QaSignoffViewModel {
  const { deliveryProjectId, run, permissions, onRun } = options;
  return useSignoffViewModel({
    canSignOff: permissions.canSignOff && run.status === "open",
    run,
    send: async (input) => onRun(await projectQaRunsRepository.signoff(deliveryProjectId, run.id, input)),
  });
}

/** Reopening a signed-off Project run (Product owner, admin), so its items can change again. */
export function useProjectReopenViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  permissions: Pick<ProjectQaRunPermissions, "canReopen">;
  onRun: (run: ProjectQaRun) => void;
}): QaReopenViewModel {
  const { deliveryProjectId, run, permissions, onRun } = options;
  return useReopenRunViewModel({
    canReopen: permissions.canReopen && run.status === "signed_off",
    send: async () => onRun(await projectQaRunsRepository.reopen(deliveryProjectId, run.id)),
  });
}
