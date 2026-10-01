"use client";

import { useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { isSignedOff, qaActionError } from "../../model/qa-run-rules";
import type { QaActionError, QaRun } from "../../model/qa-run-types";

export interface QaReopenViewModel {
  status: "idle" | "reopening";
  /** Server-decided, and only for a run that is signed off. */
  canReopen: boolean;
  error: QaActionError | null;
  reopen: () => Promise<void>;
}

const REOPEN_ERROR = "The run could not be reopened. Try again in a moment.";

/** Reopening any signed-off run (repository or Project), so its items can change again. */
export function useReopenRunViewModel(options: {
  /** Server-decided, and only for a run that is signed off. */
  canReopen: boolean;
  send: () => Promise<void>;
}): QaReopenViewModel {
  const { canReopen, send } = options;
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<QaActionError | null>(null);

  async function reopen() {
    if (!canReopen || reopening) return;
    setReopening(true);
    setError(null);
    try {
      await send();
    } catch (cause) {
      setError(qaActionError(cause, REOPEN_ERROR));
    } finally {
      setReopening(false);
    }
  }

  return { status: reopening ? "reopening" : "idle", canReopen, error, reopen };
}

/** ViewModel for reopening a signed-off repository run. */
export function useQaReopenViewModel(options: {
  projectId: string;
  run: QaRun;
  onRun: (run: QaRun) => void;
}): QaReopenViewModel {
  const { projectId, run, onRun } = options;
  return useReopenRunViewModel({
    canReopen: run.permissions.canReopen && isSignedOff(run),
    send: async () => onRun(await qaRunsRepository.reopen(projectId, run.id)),
  });
}
