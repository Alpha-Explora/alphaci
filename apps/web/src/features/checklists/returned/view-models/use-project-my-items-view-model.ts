"use client";

import { useEffect, useRef, useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { useIterationEpoch } from "../../iteration";
import { applyItemToMyItems, EMPTY_PROJECT_MY_ITEMS } from "../../model/project-run-rules";
import type { ProjectMyItems } from "../../model/project-run-types";
import type { RequirementItem } from "../../model/requirement-types";
import { errorStatus } from "../../model/wire-readers";

export type ProjectMyItemsStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

export interface ProjectMyItemsViewModel {
  /** `unavailable`: the server has no project-wide list (a 404, an older backend). */
  status: ProjectMyItemsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  data: ProjectMyItems;
  reload: () => void;
  /** Adopt an item a Progress write returned, then re-read the buckets (the server sorts them). */
  applyItem: (item: RequirementItem) => void;
}

interface LoadResult {
  key: string;
  data: ProjectMyItems | null;
  error: string | null;
  missing: boolean;
}

const LOAD_ERROR = "The Project's progress could not be loaded. Try again in a moment.";

function loadStatus(active: boolean, result: LoadResult | null): ProjectMyItemsStatus {
  if (!active) return "idle";
  if (!result) return "loading";
  if (result.missing) return "unavailable";
  return result.error ? "error" : "ready";
}

/**
 * ViewModel for the project-wide "My QA items": every Developer's items in
 * the Project, in four buckets — returned by QA, in progress, to do, and
 * ready for QA (QA's queue). No per-person filter: the team works one list.
 */
export function useProjectMyItemsViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
}): ProjectMyItemsViewModel {
  const { deliveryProjectId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestRef = useRef(0);
  const active = enabled && Boolean(deliveryProjectId);
  // Keyed by Project only: a reload keeps the lists on screen until the new ones arrive.
  const key = deliveryProjectId ?? "";
  // A started iteration (Iterations phase 3) reads the buckets again.
  const epoch = useIterationEpoch(deliveryProjectId);

  useEffect(() => {
    if (!active || !deliveryProjectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    projectQaRunsRepository
      .myItems(deliveryProjectId)
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null, missing: false });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        const missing = errorStatus(cause) === 404;
        setResult({ key, data: null, error: missing ? null : LOAD_ERROR, missing });
      });
  }, [active, deliveryProjectId, key, nonce, epoch]);

  const current = result?.key === key ? result : null;

  return {
    status: loadStatus(active, current),
    error: current?.error ?? null,
    data: current?.data ?? EMPTY_PROJECT_MY_ITEMS,
    reload: () => setNonce((value) => value + 1),
    applyItem: (item) => {
      setResult((previous) =>
        previous?.data ? { ...previous, data: applyItemToMyItems(previous.data, item) } : previous,
      );
      setNonce((value) => value + 1);
    },
  };
}
