'use client';

import { useCallback, useEffect, useState } from 'react';

import { getWorkflowHistory } from '@/features/workflows/studio/data/workflows-api';
import type { WorkflowHistoryItem } from '@/shared/api/contracts';

export function useWorkflowHistory(
  setStatusMessage: (message: string) => void,
) {
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  // The mount effect starts the first read, so history is loading from the first render.
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  /**
   * Reads history; a loud read also ends the loading state it was started
   * under. State is only written from the answer, never before the request.
   */
  const readHistory = useCallback(
    (silent: boolean): Promise<void> =>
      getWorkflowHistory(25)
        .then(
          (response) => {
            setHistory(response.items);
            setHistoryError(null);
          },
          () => {
            setHistoryError('Workflow history is temporarily unavailable.');
            if (!silent) {
              setStatusMessage('Workflow history is temporarily unavailable.');
            }
          },
        )
        .finally(() => {
          if (!silent) {
            setLoadingHistory(false);
          }
        }),
    [setStatusMessage],
  );

  useEffect(() => {
    void readHistory(false);
  }, [readHistory]);

  const loadHistory = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoadingHistory(true);
      }
      await readHistory(silent);
    },
    [readHistory],
  );

  return {
    history,
    loadHistory,
    loadingHistory,
    /** User-safe load error, for surfaces that render it inline. */
    error: historyError,
  };
}

export type WorkflowHistoryState = ReturnType<typeof useWorkflowHistory>;
