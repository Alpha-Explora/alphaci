"use client";

import { useEffect, useRef, useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import type { ChecklistsStatus } from "../../model/checklist-types";
import { applyRunToMyItems, myItemsFromReturned, normalizeMyQaItems } from "../../model/qa-my-items-rules";
import type { QaMyItemsResponse, QaRun } from "../../model/qa-run-types";
import { errorStatus } from "../../model/wire-readers";

export interface MyQaItemsViewModel {
  status: ChecklistsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  data: QaMyItemsResponse;
  /** Read both lists again from the server. */
  reload: () => void;
  /** Adopt the run a write returned, so its rows show the server's state at once. */
  applyRun: (run: QaRun) => void;
}

interface LoadResult {
  key: string;
  data: QaMyItemsResponse | null;
  error: string | null;
}

const LOAD_ERROR = "Your QA items could not be loaded. Try again in a moment.";
const EMPTY: QaMyItemsResponse = { returned: [], developerItems: [] };

function loadStatus(result: LoadResult | null): ChecklistsStatus {
  if (!result) return "loading";
  return result.error ? "error" : "ready";
}

/**
 * Both lists in one read. A backend without the qa-my-items route (404) still
 * has qa-returned-items, so the card falls back to it: returned items, no
 * developer items — never an error card for an older server.
 */
async function loadMyItems(projectId: string): Promise<QaMyItemsResponse> {
  try {
    return normalizeMyQaItems(await qaRunsRepository.myItems(projectId));
  } catch (cause) {
    if (errorStatus(cause) !== 404) throw cause;
    return myItemsFromReturned(await qaRunsRepository.returnedItems(projectId));
  }
}

/**
 * ViewModel for the Overview's "My QA items" card: what QA returned on this
 * project, and the developer items of the current uat run.
 */
export function useMyQaItemsViewModel(options: { projectId: string; enabled: boolean }): MyQaItemsViewModel {
  const { projectId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestRef = useRef(0);
  // Keyed by project only: a reload keeps the lists on screen until the new
  // ones arrive, so recording one item does not blank the whole card.
  const key = projectId;

  useEffect(() => {
    if (!enabled || !projectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    loadMyItems(projectId)
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
    data: current?.data ?? EMPTY,
    reload: () => setNonce((value) => value + 1),
    applyRun: (run) =>
      setResult((previous) =>
        previous?.data ? { ...previous, data: applyRunToMyItems(previous.data, run) } : previous,
      ),
  };
}
