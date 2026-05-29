"use client";

import { useCallback, useEffect, useState } from "react";

import { getWorkflowHistory } from "@/lib/api/client";
import type { WorkflowHistoryItem } from "@/lib/api/contracts";

export function useWorkflowHistory(setStatusMessage: (message: string) => void) {
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingHistory(true);
    }

    try {
      const response = await getWorkflowHistory(25);
      setHistory(response.items);
    } catch {
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
  };
}

export type WorkflowHistoryState = ReturnType<typeof useWorkflowHistory>;
