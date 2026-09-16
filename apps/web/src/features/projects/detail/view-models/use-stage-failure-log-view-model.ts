"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getProjectRunFailureLog,
  type RunFailureLogResponse,
} from "../data/project-workspace-api";

/*
 * Re-exported so a View can name what it renders without importing from
 * `data/`. The boundary checks treat any view -> data edge as a violation,
 * type-only or not, and they are right to: the ViewModel owns this contract,
 * so the shape should come from it rather than from the transport beneath it.
 */
export type { RunFailureLogResponse };
import type { ProjectStatus } from "../../model/projects-types";

export interface StageFailureLogViewModel {
  status: ProjectStatus;
  log: RunFailureLogResponse | null;
  error: string | null;
  reload: () => void;
}

/**
 * The error output for one failed stage.
 *
 * Loaded once per stage, never polled. This is a heavier read than the run
 * list — the server fetches the run's jobs and then that job's log — so it is
 * fetched when a failed stage is actually rendered, and not again.
 *
 * It loads WITHOUT being asked, which is the point of the whole change. The
 * card used to say "open the workflow logs, fix the first failed job, then
 * re-run" — an instruction to go and do the diagnosis somewhere else. A
 * product that knows a stage failed and makes you leave to find out why has
 * not reported the failure, it has announced it.
 */
export function useStageFailureLogViewModel(options: {
  projectId: string;
  runId: number;
  /** False for stages that never ran, which have no log to fetch. */
  enabled: boolean;
}): StageFailureLogViewModel {
  const { projectId, runId, enabled } = options;

  const [status, setStatus] = useState<ProjectStatus>(
    enabled ? "loading" : "ready",
  );
  const [log, setLog] = useState<RunFailureLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return getProjectRunFailureLog(projectId, runId)
      .then((result) => {
        setLog(result);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        setError("The error output could not be read from GitHub.");
        setStatus("error");
      });
  }, [projectId, runId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const reload = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  return { status, log, error, reload };
}
