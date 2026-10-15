"use client";

import type { AppRole } from "@/shared/api/contracts";

import { useCurrentIterationViewModel } from "./use-current-iteration-view-model";
import { useStartIterationViewModel, type StartIterationViewModel } from "./use-start-iteration-view-model";

/**
 * The next iteration, for a screen that does not read the Project's iteration
 * already (the QA run, My QA items, the Project page's header): it reads it,
 * and answers what this viewer sees once the iteration is delivered — the
 * waiting sentence, Start (with its dialog), or nothing. A failed read, or a
 * backend without iterations, is nothing.
 */
export function useNextIterationViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
  appRole: AppRole | null | undefined;
}): StartIterationViewModel {
  const { deliveryProjectId, enabled, appRole } = options;
  const iteration = useCurrentIterationViewModel({ deliveryProjectId, enabled });
  return useStartIterationViewModel({
    deliveryProjectId: deliveryProjectId ?? "",
    current: iteration.current,
    appRole,
  });
}
