"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { requirementsRepository } from "../../data/requirements-repository";
import { useCurrentIterationViewModel, useIterationEpoch, type CurrentIterationViewModel } from "../../iteration";
import { lockedIterationNumber } from "../../model/iteration-rules";
import {
  removeRequirementItem,
  requirementsOfKind,
  resolveRequirementPermissions,
  upsertRequirement,
  upsertRequirementItem,
  type RequirementPermissions,
} from "../../model/requirement-rules";
import type {
  ProjectRequirements,
  Requirement,
  RequirementItem,
  RequirementsStatus,
} from "../../model/requirement-types";
import { errorStatus } from "../../model/wire-readers";

export interface ProjectRequirementsViewModel {
  /** `unavailable`: the server answered 404 (no such route yet, or no access). */
  status: RequirementsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** Live Features, oldest first. */
  functional: Requirement[];
  /** Live System requirements, oldest first. */
  system: Requirement[];
  /**
   * Server flags first, the app-role allow-list only when a flag is missing;
   * all off once the Project's iteration is delivered.
   */
  permissions: RequirementPermissions;
  /**
   * The delivered iteration's number, when its requirements are locked. Null
   * while the iteration is active, and on a backend without iterations.
   */
  lockedIteration: number | null;
  reload: () => void;
  /** A requirement the server just saved (created, renamed, reordered). */
  applyRequirement: (requirement: Requirement) => void;
  /** An item the server just saved (added, edited, Progress moved). */
  applyItem: (item: RequirementItem) => void;
  removeItem: (requirementId: string, itemId: string) => void;
}

interface LoadResult {
  key: string;
  data: ProjectRequirements | null;
  error: string | null;
  missing: boolean;
}

const LOAD_ERROR = "This Project's requirements could not be loaded. Try again in a moment.";
const MISSING_ERROR =
  "Requirements could not be found for this Project. The server may not offer Project requirements yet, or you are no longer in its team.";

const LOCKED: RequirementPermissions = { canManage: false, canSetProgress: false };

/** The server's flags, or every one off once the iteration is delivered. */
function permissionsFor(
  data: ProjectRequirements | null,
  appRole: AppRole | null | undefined,
  lockedIteration: number | null,
): RequirementPermissions {
  return lockedIteration === null ? resolveRequirementPermissions(data, appRole) : LOCKED;
}

/** The delivered iteration's number from the current-iteration read, or null. */
function lockedFrom(iteration: CurrentIterationViewModel): number | null {
  return lockedIterationNumber(iteration.current ? iteration.current.iteration : null);
}

function loadStatus(result: LoadResult | null): RequirementsStatus {
  if (!result) return "loading";
  if (result.missing) return "unavailable";
  return result.error ? "error" : "ready";
}

/**
 * ViewModel for a Project's requirements: its Features (functional, told as
 * User stories) and its System requirements, and who may change what.
 * Results are kept with the Project they were read for, and a request counter
 * stops a slow read overwriting a newer one.
 */
export function useProjectRequirementsViewModel(options: {
  deliveryProjectId: string;
  enabled: boolean;
  appRole: AppRole | null | undefined;
}): ProjectRequirementsViewModel {
  const { deliveryProjectId, enabled, appRole } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestRef = useRef(0);
  const key = deliveryProjectId;
  // A started iteration (Iterations phase 3) reads the list again: the
  // carried items are the new iteration's requirements.
  const epoch = useIterationEpoch(deliveryProjectId);

  useEffect(() => {
    if (!enabled || !deliveryProjectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    requirementsRepository
      .listForProject(deliveryProjectId)
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null, missing: false });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        const missing = errorStatus(cause) === 404;
        setResult({ key, data: null, error: missing ? MISSING_ERROR : LOAD_ERROR, missing });
      });
  }, [enabled, deliveryProjectId, key, nonce, epoch]);

  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;
  const requirements = data?.requirements ?? [];
  // The iteration is read beside the list; any failure (an older backend's
  // 404) leaves it unknown, and the requirements stay exactly as before.
  const iteration = useCurrentIterationViewModel({ deliveryProjectId, enabled });
  const lockedIteration = lockedFrom(iteration);

  const update = useCallback(
    (change: (list: Requirement[]) => Requirement[]) =>
      setResult((previous) =>
        previous?.data
          ? { ...previous, data: { ...previous.data, requirements: change(previous.data.requirements) } }
          : previous,
      ),
    [],
  );

  return {
    status: loadStatus(current),
    error: current?.error ?? null,
    functional: requirementsOfKind(requirements, "functional"),
    system: requirementsOfKind(requirements, "system"),
    permissions: permissionsFor(data, appRole, lockedIteration),
    lockedIteration,
    reload: () => setNonce((value) => value + 1),
    applyRequirement: (saved) => update((list) => upsertRequirement(list, saved)),
    applyItem: (item) => update((list) => upsertRequirementItem(list, item.requirementId, item)),
    removeItem: (requirementId, itemId) => update((list) => removeRequirementItem(list, requirementId, itemId)),
  };
}
