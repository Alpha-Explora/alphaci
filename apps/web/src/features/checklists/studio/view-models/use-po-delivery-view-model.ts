"use client";

import { useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { iterationsRepository } from "../../data/iterations-repository";
import {
  useCurrentIterationViewModel,
  useStartIterationViewModel,
  type CurrentIterationViewModel,
  type StartIterationViewModel,
} from "../../iteration";
import {
  canOfferMergeAll,
  mergeAllError,
  mergeAllErrorRefreshes,
  pendingRepositories,
} from "../../model/iteration-rules";
import type { CoveredRepository, MergeAllError, MergeAllResult } from "../../model/iteration-types";
import { qaSignInHref } from "../../model/qa-automation-rules";
import type { QaPromotionStatus } from "../../model/qa-promotion-types";
import type { QaPromotionViewModel } from "./use-qa-promotion-view-model";

/** Merge all repositories: nothing, the confirmation open, or the request in flight. */
export type MergeAllState = "idle" | "confirming" | "merging";

/** How the last Merge all ended, shown until dismissed. */
export type MergeAllOutcome = { kind: "result"; result: MergeAllResult } | { kind: "error"; error: MergeAllError };

export interface PoDeliveryViewModel {
  /** The Project's current iteration: stored delivery state per repository. */
  iteration: CurrentIterationViewModel;
  /** Once it is delivered: Start iteration N+1 for a Product owner or admin (Iterations phase 3). */
  start: StartIterationViewModel;
  /** Whether Merge to main merges every repository not in main yet (else it merges this one). */
  canMergeAll: boolean;
  /** The covered repositories not in main yet: what Merge all merges. */
  pending: CoveredRepository[];
  mergeState: MergeAllState;
  /** The confirmation is open (also while its merge is in flight; never for a retry). */
  dialogOpen: boolean;
  /** A failure worth retrying, shown inside the open confirmation. */
  dialogError: string | null;
  outcome: MergeAllOutcome | null;
  signInHref: string;
  openConfirm: () => void;
  cancelConfirm: () => void;
  confirmMergeAll: () => Promise<void>;
  /** After a partial failure: merge the rest again, no second confirmation. */
  retry: () => Promise<void>;
  dismissOutcome: () => void;
}

/**
 * What the iteration watches on the promotion status: its delivery flags and
 * head. A merge of this repository alone changes them, so the per-repository
 * state is read again. Null until the status is known.
 */
function promotionWatch(data: QaPromotionStatus | null): string | null {
  if (!data) return null;
  return [data.iterationDelivered, data.repositoryDelivered, data.eligible, data.headSha].map(String).join("|");
}

/**
 * ViewModel for a Project's delivery, shared by the studio's tab bar and PO
 * Studio's column: the stored per-repository state of the Project's
 * iteration (so a reload still shows what is in main), and — for a Product
 * owner or admin on a Project of two or more repositories — the merge of
 * every repository not in main yet, which the tab bar's Merge to main runs,
 * with each repository's result and a retry after a partial failure. The
 * server re-checks the gate and decides when the iteration is Delivered;
 * this only asks and explains. Disabled (a repository in no Project), it
 * reads nothing and offers nothing.
 */
export function usePoDeliveryViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
  /** The repository page this studio is on, for "Sign in again". */
  projectId: string;
  appRole: AppRole | null | undefined;
  promotion: QaPromotionViewModel;
}): PoDeliveryViewModel {
  const { deliveryProjectId, enabled, projectId, appRole, promotion } = options;
  const iteration = useCurrentIterationViewModel({
    deliveryProjectId,
    enabled,
    watch: promotionWatch(promotion.data),
  });
  const [mergeState, setMergeState] = useState<MergeAllState>("idle");
  const [viaDialog, setViaDialog] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MergeAllOutcome | null>(null);
  const current = iteration.current;
  const pending = current ? pendingRepositories(current) : [];
  const offer = canOfferMergeAll(current, appRole) && pending.length > 0;
  // A start re-reads the iteration and the QA run itself (the Project's
  // epoch); the promotion status is this studio's own, so it is asked here.
  const start = useStartIterationViewModel({
    deliveryProjectId: deliveryProjectId ?? "",
    current,
    appRole,
    onStarted: promotion.reload,
  });

  function refresh() {
    iteration.reload();
    promotion.reload();
  }

  async function run(fromDialog: boolean) {
    if (!deliveryProjectId) return;
    setViaDialog(fromDialog);
    setMergeState("merging");
    setDialogError(null);
    try {
      const result = await iterationsRepository.mergeAll(deliveryProjectId);
      setOutcome({ kind: "result", result });
      setMergeState("idle");
      setViaDialog(false);
      refresh();
    } catch (cause) {
      const error = mergeAllError(cause);
      if (fromDialog && error.kind === "failed") {
        setDialogError(error.message);
        setMergeState("confirming");
        return;
      }
      setOutcome({ kind: "error", error });
      setMergeState("idle");
      setViaDialog(false);
      if (mergeAllErrorRefreshes(error)) refresh();
    }
  }

  return {
    iteration,
    start,
    canMergeAll: offer,
    pending,
    mergeState,
    dialogOpen: mergeState === "confirming" || (mergeState === "merging" && viaDialog),
    dialogError,
    outcome,
    signInHref: qaSignInHref(projectId),
    openConfirm: () => {
      if (!offer || mergeState !== "idle") return;
      setDialogError(null);
      setOutcome(null);
      setMergeState("confirming");
    },
    cancelConfirm: () => {
      if (mergeState === "merging") return;
      setMergeState("idle");
      setDialogError(null);
    },
    confirmMergeAll: async () => {
      if (!offer || mergeState !== "confirming") return;
      await run(true);
    },
    retry: async () => {
      if (mergeState !== "idle") return;
      await run(false);
    },
    dismissOutcome: () => setOutcome(null),
  };
}
