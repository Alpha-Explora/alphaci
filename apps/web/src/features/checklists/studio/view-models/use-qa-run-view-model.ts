"use client";

import { useEffect, useRef, useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { qaActionError } from "../../model/qa-run-rules";
import type {
  QaActionError,
  QaCommitSource,
  QaCurrentRunResponse,
  QaRun,
} from "../../model/qa-run-types";

export type QaRunViewStatus = "idle" | "loading" | "error" | "ready" | "starting";

export interface QaRunViewModel {
  /**
   * `idle` until there is a branch and a checklist to look up; `starting`
   * while a new run is being created. One field, so "loading and failed at
   * once" cannot be represented.
   */
  status: QaRunViewStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** The commit the branch resolves to now. Null when the server found none. */
  commitSha: string | null;
  commitSource: QaCommitSource | null;
  run: QaRun | null;
  /** Why the last attempt to start a run failed, e.g. no commit found. */
  startError: QaActionError | null;
  start: () => Promise<void>;
  /** Adopt the run a write returned, so every pane shows the server's state. */
  applyRun: (run: QaRun) => void;
  reload: () => void;
}

interface LoadResult {
  key: string;
  data: QaCurrentRunResponse | null;
  error: string | null;
}

const LOAD_ERROR = "The QA run for this branch could not be loaded. Try again in a moment.";
const START_ERROR = "The QA run could not be started. Try again in a moment.";

function viewStatus(
  lookupReady: boolean,
  current: LoadResult | null,
  starting: boolean,
): QaRunViewStatus {
  if (!lookupReady) return "idle";
  if (starting) return "starting";
  if (!current) return "loading";
  return current.error ? "error" : "ready";
}

/** The commit under test: what the branch resolves to, else the run's own. */
function loadedCommit(data: QaCurrentRunResponse | null): {
  commitSha: string | null;
  commitSource: QaCommitSource | null;
} {
  if (!data) return { commitSha: null, commitSource: null };
  return {
    commitSha: data.commitSha ?? data.run?.commitSha ?? null,
    commitSource: data.commitSource ?? data.run?.commitSource ?? null,
  };
}

/** What the loaded lookup says, flattened for the view. */
function loadedView(current: LoadResult | null) {
  const data = current?.data ?? null;
  return {
    error: current?.error ?? null,
    ...loadedCommit(data),
    run: data?.run ?? null,
  };
}

/**
 * ViewModel for the run under test: the current run for one checklist on one
 * branch, and starting one when there is none.
 *
 * The server decides which commit "current" means (the deployed one, or the
 * branch head when nothing is deployed), so the client asks for the branch and
 * never names a sha — not when reading, not when starting.
 */
export function useQaRunViewModel(options: {
  projectId: string;
  branch: string | null;
  checklistId: string | null;
  enabled: boolean;
}): QaRunViewModel {
  const { projectId, branch, checklistId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ key: string; error: QaActionError } | null>(null);
  const requestRef = useRef(0);
  const lookupReady = enabled && Boolean(projectId && branch && checklistId);
  const lookupKey = `${projectId}|${branch ?? ""}|${checklistId ?? ""}`;
  const key = `${lookupKey}|${String(nonce)}`;

  useEffect(() => {
    if (!lookupReady || !branch || !checklistId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    qaRunsRepository
      .current(projectId, { branch, checklistId })
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null });
      })
      .catch(() => {
        if (requestId === requestRef.current) setResult({ key, data: null, error: LOAD_ERROR });
      });
  }, [lookupReady, projectId, branch, checklistId, key]);

  const current = result?.key === key ? result : null;
  const loaded = loadedView(current);

  async function start() {
    if (!lookupReady || !branch || !checklistId || starting) return;
    const startKey = lookupKey;
    setStarting(true);
    setStartError(null);
    try {
      const run = await qaRunsRepository.create(projectId, { checklistId, branch });
      setResult({
        key,
        error: null,
        data: { commitSha: run.commitSha, commitSource: run.commitSource, run },
      });
    } catch (cause) {
      setStartError({ key: startKey, error: qaActionError(cause, START_ERROR) });
    } finally {
      setStarting(false);
    }
  }

  function applyRun(run: QaRun) {
    setResult((previous) => {
      if (!previous?.data || previous.key !== key) return previous;
      if (previous.data.run && previous.data.run.id !== run.id) return previous;
      return { ...previous, data: { ...previous.data, run } };
    });
  }

  return {
    status: viewStatus(lookupReady, current, starting),
    ...loaded,
    startError: startError?.key === lookupKey ? startError.error : null,
    start,
    applyRun,
    reload: () => setNonce((value) => value + 1),
  };
}
