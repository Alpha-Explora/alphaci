"use client";

import { useEffect, useRef, useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { useIterationEpoch } from "../../iteration";
import type { HeadStatus, ProjectQaRun, ProjectRunCurrent } from "../../model/project-run-types";
import { qaActionError } from "../../model/qa-run-rules";
import type { QaActionError } from "../../model/qa-run-types";
import { errorStatus } from "../../model/wire-readers";

export type ProjectRunViewStatus = "idle" | "loading" | "ready" | "error" | "unavailable" | "starting";

export interface ProjectRunViewModel {
  /**
   * `idle` without a Project; `unavailable` when the server has no Project
   * runs (a 404: an older backend), so the caller can fall back to the
   * per-repository screens; `starting` while a run is being created.
   */
  status: ProjectRunViewStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** The run for the current set of uat heads, or the latest one when they moved. */
  run: ProjectQaRun | null;
  /** Every repository's uat head now. */
  heads: HeadStatus[];
  stale: boolean;
  requirementsChanged: boolean;
  startError: QaActionError | null;
  /** Created a run, or found one already on these heads (the server's idempotency). */
  lastStart: "created" | "existing" | null;
  start: () => Promise<void>;
  /** Adopt the run a write returned, so every part of the panel shows the server's state. */
  applyRun: (run: ProjectQaRun) => void;
  reload: () => void;
}

interface LoadResult {
  key: string;
  data: ProjectRunCurrent | null;
  error: string | null;
  missing: boolean;
}

const LOAD_ERROR = "The Project's QA run could not be loaded. Try again in a moment.";
const START_ERROR = "The Project QA run could not be started. Try again in a moment.";

function viewStatus(active: boolean, current: LoadResult | null, starting: boolean): ProjectRunViewStatus {
  if (!active) return "idle";
  if (starting) return "starting";
  if (!current) return "loading";
  if (current.missing) return "unavailable";
  return current.error ? "error" : "ready";
}

/** What the loaded answer says, flattened for the view. */
function loadedView(current: LoadResult | null) {
  const data = current?.data;
  if (!data) {
    return { error: current?.error ?? null, run: null, heads: [], stale: false, requirementsChanged: false };
  }
  return { error: null, run: data.run, heads: data.heads, stale: data.stale, requirementsChanged: data.requirementsChanged };
}

/** A value kept with the Project it is about; null for any other Project. */
function forProject<T>(entry: { key: string; value: T } | null, key: string): T | null {
  return entry && entry.key === key ? entry.value : null;
}

function fromRun(run: ProjectQaRun): ProjectRunCurrent {
  return { run, heads: run.repositories, stale: run.stale, requirementsChanged: run.requirementsChanged };
}

/**
 * ViewModel for a Project's QA run: the run on the current uat heads of every
 * repository, and starting one. The server reads the heads; the client never
 * names a commit, not when reading and not when starting.
 */
export function useProjectRunViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
}): ProjectRunViewModel {
  const { deliveryProjectId, enabled } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ key: string; value: QaActionError } | null>(null);
  const [lastStart, setLastStart] = useState<{ key: string; value: "created" | "existing" } | null>(null);
  const requestRef = useRef(0);
  const active = enabled && Boolean(deliveryProjectId);
  const projectKey = deliveryProjectId ?? "";
  // A started iteration (Iterations phase 3) reads the run again: the new
  // iteration has none yet, so QA can start a fresh one.
  const epoch = useIterationEpoch(deliveryProjectId);
  const key = `${projectKey}|${String(nonce)}|${String(epoch)}`;

  useEffect(() => {
    if (!active || !deliveryProjectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    projectQaRunsRepository
      .current(deliveryProjectId)
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null, missing: false });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        const missing = errorStatus(cause) === 404;
        setResult({ key, data: null, error: missing ? null : LOAD_ERROR, missing });
      });
  }, [active, deliveryProjectId, key]);

  const current = result?.key === key ? result : null;

  async function start() {
    if (!active || !deliveryProjectId || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const outcome = await projectQaRunsRepository.start(deliveryProjectId);
      setResult({ key, data: fromRun(outcome.run), error: null, missing: false });
      setLastStart({ key: projectKey, value: outcome.created ? "created" : "existing" });
    } catch (cause) {
      setStartError({ key: projectKey, value: qaActionError(cause, START_ERROR) });
    } finally {
      setStarting(false);
    }
  }

  function applyRun(run: ProjectQaRun) {
    setResult((previous) => {
      if (!previous?.data || previous.key !== key) return previous;
      if (previous.data.run && previous.data.run.id !== run.id) return previous;
      return { ...previous, data: { ...previous.data, run, stale: run.stale, requirementsChanged: run.requirementsChanged } };
    });
  }

  return {
    status: viewStatus(active, current, starting),
    ...loadedView(current),
    startError: forProject(startError, projectKey),
    lastStart: forProject(lastStart, projectKey),
    start,
    applyRun,
    reload: () => setNonce((value) => value + 1),
  };
}
