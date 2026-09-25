"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getProjectJobLog,
  getProjectRunJobs,
  type JobLogResponse,
  type RunJob,
} from "../data/project-workspace-api";
import type { ProjectStatus } from "../../model/projects-types";
import { RUNS_POLL_MS } from "./use-pipeline-runs-view-model";

/* Re-exported so the views name these shapes without reaching into `data/`. */
export type { JobLogResponse, RunJob };

export interface RunJobsViewModel {
  open: boolean;
  toggle: () => void;
  /** "ready" before the first expand, too: nothing is loading. */
  status: ProjectStatus;
  jobs: RunJob[] | null;
  error: string | null;
  retry: () => void;
}

/**
 * One workflow run's jobs, loaded when someone expands the run.
 *
 * Moved out of the row component, which called the API itself — the
 * views-must-not-fetch rule could not see it because the import went through
 * the `@/features/projects` barrel.
 *
 * THE FETCHING RULE is unchanged. Jobs load on expand and are never fetched by
 * the run list's poll. The one narrow exception: an EXPANDED run that has not
 * completed re-reads its own jobs on the list's interval, and stops the moment
 * it completes or is closed. Fetching jobs for every listed run on every tick
 * would drain the organisation-wide GitHub rate limit.
 *
 * Refreshes never raise the spinner: blanking the panel every fifteen seconds
 * while someone reads a step would be worse than a slightly stale list.
 */
export function useRunJobsViewModel(options: {
  projectId: string;
  runId: number;
  isRunning: boolean;
}): RunJobsViewModel {
  const { projectId, runId, isRunning } = options;
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<RunJob[] | null>(null);
  const [status, setStatus] = useState<ProjectStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (showSpinner: boolean) => {
      if (showSpinner) setStatus("loading");
      return getProjectRunJobs(projectId, runId)
        .then((result) => {
          setJobs(result);
          setError(null);
          setStatus("ready");
        })
        .catch(() => {
          setError("The jobs for this run could not be read.");
          setStatus("error");
        });
    },
    [projectId, runId],
  );

  useEffect(() => {
    if (!open || !isRunning) return;
    const handle = window.setInterval(() => void load(false), RUNS_POLL_MS);
    return () => window.clearInterval(handle);
  }, [open, isRunning, load]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && jobs === null && status !== "loading") void load(true);
  }, [open, jobs, status, load]);

  const retry = useCallback(() => void load(true), [load]);

  return { open, toggle, status, jobs, error, retry };
}

export interface JobLogViewModel {
  open: boolean;
  toggle: () => void;
  status: ProjectStatus;
  log: JobLogResponse | null;
  error: string | null;
  retry: () => void;
}

/**
 * One job's full log: the largest response in the product, so it loads when
 * someone opens it, once, and is never polled.
 */
export function useJobLogViewModel(options: {
  projectId: string;
  jobId: number;
}): JobLogViewModel {
  const { projectId, jobId } = options;
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<JobLogResponse | null>(null);
  const [status, setStatus] = useState<ProjectStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    return getProjectJobLog(projectId, jobId)
      .then((result) => {
        setLog(result);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        setError("The log for this job could not be read.");
        setStatus("error");
      });
  }, [projectId, jobId]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && log === null && status !== "loading") void load();
  }, [open, log, status, load]);

  const retry = useCallback(() => void load(), [load]);

  return { open, toggle, status, log, error, retry };
}
