"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getProjectWorkflowRuns,
  type WorkflowRunSummary,
} from "../data/project-workspace-api";
import type { ProjectStatus } from "../../model/projects-types";
import {
  groupRunsByPipelineBranch,
  type BranchRunSection,
} from "../model/runs-by-branch";

/** How often the run LIST refreshes while the tab is open. */
export const RUNS_POLL_MS = 15_000;

export interface PipelineRunsViewModel {
  /*
   * One lifecycle field rather than a `loading` boolean beside an `error`
   * string: that pair encodes four states when only three exist, and the view
   * then has to decide what "loading and errored at once" means. It cannot
   * happen, so it should not be representable.
   */
  status: ProjectStatus;
  error: string | null;
  /** Runs split per branch, in promotion order, empty branches included. */
  sections: BranchRunSection<WorkflowRunSummary>[];
  /** True only when GitHub reported no runs at all, on any branch. */
  isEmpty: boolean;
  actionsUrl: string | null;
  repoFullName: string | null;
  reload: () => void;
}

/**
 * The run list for one project: fetching, polling, and the per-branch split.
 *
 * This moved out of `pipeline-runs-tab.tsx`, which fetched directly and held
 * five pieces of state alongside its markup. The boundary rule
 * (`views-must-not-fetch`) had not caught it, because the view reached the
 * request through the `@/features/projects` barrel — the import resolved to
 * `index.ts` rather than `data/`, so a real violation read as compliant. The
 * rule was right about the shape even though it could not see this instance.
 *
 * THE FETCHING RULE is preserved exactly: only the run list polls here. A run's
 * jobs load when someone expands that run, and a job's log when someone opens
 * it — neither is ever fetched on the tick. The GitHub rate limit is shared by
 * the whole organisation, so pulling jobs for every listed run every fifteen
 * seconds would drain it and take every other GitHub call down with it. That
 * on-demand loading stays in the row components, which own that state.
 */
export function usePipelineRunsViewModel(options: {
  projectId: string;
  actionsUrl?: string | null;
}): PipelineRunsViewModel {
  const { projectId, actionsUrl } = options;

  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [url, setUrl] = useState<string | null>(actionsUrl ?? null);
  const [repoFullName, setRepoFullName] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  /*
   * Every setState happens in a promise callback. `status` starts "loading", so
   * the first render shows the skeleton without the effect having to raise it —
   * setting state synchronously inside an effect body cascades renders
   * (react-hooks/set-state-in-effect). `reload` is an event handler, so it may
   * raise the spinner itself.
   */
  const load = useCallback(() => {
    return getProjectWorkflowRuns(projectId)
      .then((data) => {
        setRuns(data.runs);
        setUrl(data.actionsUrl);
        setRepoFullName(data.repoFullName);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        setError("The run list could not be read from GitHub.");
        setStatus("error");
      });
  }, [projectId]);

  useEffect(() => {
    void load();
    const handle = window.setInterval(() => void load(), RUNS_POLL_MS);
    return () => window.clearInterval(handle);
  }, [load]);

  const reload = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  return {
    status,
    error,
    sections: groupRunsByPipelineBranch(runs),
    isEmpty: runs.length === 0,
    actionsUrl: url,
    repoFullName,
    reload,
  };
}
