"use client";

import { useEffect, useRef, useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import type { ChecklistsStatus } from "../../model/checklist-types";
import type { QaReturnedItem, QaReturnedItemsResponse } from "../../model/qa-run-types";

export interface ReturnedItemsViewModel {
  status: ChecklistsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  items: QaReturnedItem[];
  reload: () => void;
}

interface LoadResult {
  key: string;
  data: QaReturnedItemsResponse | null;
  error: string | null;
}

const LOAD_ERROR = "Items returned by QA could not be loaded. Try again in a moment.";

function loadStatus(result: LoadResult | null): ChecklistsStatus {
  if (!result) return "loading";
  return result.error ? "error" : "ready";
}

/** ViewModel for the Overview's "Returned by QA" card: every item QA sent back on this project. */
export function useReturnedItemsViewModel(options: {
  projectId: string;
  enabled: boolean;
}): ReturnedItemsViewModel {
  const { projectId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestRef = useRef(0);
  // Keyed by project only: a reload keeps the list on screen until the new one
  // arrives, so marking one item fixed does not blank the whole card.
  const key = projectId;

  useEffect(() => {
    if (!enabled || !projectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    qaRunsRepository
      .returnedItems(projectId)
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null });
      })
      .catch(() => {
        if (requestId === requestRef.current) setResult({ key, data: null, error: LOAD_ERROR });
      });
  }, [enabled, projectId, key, nonce]);

  const current = result?.key === key ? result : null;

  return {
    status: loadStatus(current),
    error: current?.error ?? null,
    items: current?.data?.items ?? [],
    reload: () => setNonce((value) => value + 1),
  };
}
