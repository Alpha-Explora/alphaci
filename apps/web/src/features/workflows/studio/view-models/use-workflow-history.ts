"use client";

/* Preserve the history probe's initial transition. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";

import { getWorkflowHistory } from "@/features/workflows/studio/data/workflows-api";
import type { WorkflowHistoryItem } from "@/shared/api/contracts";

export function useWorkflowHistory(setStatusMessage: (message: string) => void) {
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingHistory(true);
    }

    try {
      const response = await getWorkflowHistory(25);
      setHistory(response.items);
      setHistoryError(null);
    } catch {
      setHistoryError("Workflow history is temporarily unavailable.");
      if (!silent) {
        setStatusMessage("Workflow history is temporarily unavailable.");
      }
    } finally {
      if (!silent) {
        setLoadingHistory(false);
      }
    }
  }, [setStatusMessage]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return {
    history,
    loadHistory,
    loadingHistory,
    /** User-safe load error, for surfaces that render it inline. */
    error: historyError,
  };
}

export type WorkflowHistoryState = ReturnType<typeof useWorkflowHistory>;
