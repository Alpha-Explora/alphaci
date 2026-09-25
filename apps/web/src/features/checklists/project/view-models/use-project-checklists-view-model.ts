"use client";

import { useEffect, useRef, useState } from "react";

import { checklistsRepository } from "../../data/checklists-repository";
import { checklistErrorMessage, sortChecklists } from "../../model/checklist-rules";
import type {
  ChecklistsStatus,
  QaChecklist,
  QaChecklistListResponse,
} from "../../model/checklist-types";

export interface ProjectChecklistsViewModel {
  status: ChecklistsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  checklists: QaChecklist[];
  canManage: boolean;
  reload: () => void;
}

interface LoadResult {
  key: string;
  data: QaChecklistListResponse | null;
  error: string | null;
}

const LOAD_ERROR = "Checklists for this project could not be loaded. Try again in a moment.";

function loadStatus(result: LoadResult | null): ChecklistsStatus {
  if (!result) return "loading";
  return result.error ? "error" : "ready";
}

/** The loaded list, sorted like the team page so the two read in the same order. */
function loadedChecklists(result: LoadResult | null): QaChecklist[] {
  return sortChecklists(result?.data?.items ?? []);
}

/** ViewModel for a project's Checklists tab: the checklists shared to it, read-only. */
export function useProjectChecklistsViewModel(options: {
  projectId: string;
  enabled: boolean;
}): ProjectChecklistsViewModel {
  const { projectId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestRef = useRef(0);
  const key = `${projectId}|${String(nonce)}`;

  useEffect(() => {
    if (!enabled || !projectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    checklistsRepository
      .listForProject(projectId)
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        setResult({ key, data: null, error: checklistErrorMessage(cause, LOAD_ERROR) });
      });
  }, [enabled, projectId, key]);

  const current = result?.key === key ? result : null;

  return {
    status: loadStatus(current),
    error: current?.error ?? null,
    checklists: loadedChecklists(current),
    canManage: current?.data?.canManage === true,
    reload: () => setNonce((value) => value + 1),
  };
}
