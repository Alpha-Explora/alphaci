"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getProjectWorkflowRuns,
  type WorkflowRunSummary,
} from "../data/project-workspace-api";
import type { ProjectStatus } from "../../model/projects-types";
import { getRuns } from "@/features/runs";
import type { RunGroup } from "@/shared/api/contracts";
import { WORKING_BRANCH } from "@/shared/api/pipeline-branches";
import {
  groupRunsByPipelineBranch,
  type BranchRunSection,
} from "../model/runs-by-branch";

/* Re-exported so the views name the run shape without importing from `data/`. */
export type { WorkflowRunSummary };

/** The picker value meaning "do not filter". */
export const ALL_BRANCHES = "all";

const STORAGE_PREFIX = "alphaci.runs.branch.";

/**
 * The branch this project was last looked at on.
 *
 * Per project, because which tier matters depends on the project: one is being
 * worked on, another is only ever watched in production. A single global choice
 * would be wrong for whichever project you opened second.
 *
 * Wrapped because storage throws outright in some contexts — a private window,
 * a browser set to block site data, a thumbnail capture — and a remembered
 * preference is never worth failing a render over.
 */
function readStoredBranch(projectId: string): string {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + projectId) ?? WORKING_BRANCH;
  } catch {
    return WORKING_BRANCH;
  }
}

function storeBranch(projectId: string, branch: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + projectId, branch);
  } catch {
    // A preference that cannot be saved is not an error worth surfacing.
  }
  // Writing IS the state change: subscribers re-read and re-render.
  for (const listener of branchListeners) listener();
}

const branchListeners = new Set<() => void>();

function subscribeToStoredBranch(onChange: () => void): () => void {
  branchListeners.add(onChange);
  return () => {
    branchListeners.delete(onChange);
  };
}

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
  /** dev, uat and main, empty ones included — for the picker. */
  sections: BranchRunSection<WorkflowRunSummary>[];
  /** Just the branch being looked at, or all of them when that is the choice. */
  visibleSections: BranchRunSection<WorkflowRunSummary>[];
  /** The chosen branch, or ALL_BRANCHES. */
  selectedBranch: string;
  selectBranch: (branch: string) => void;
  /** True only when GitHub reported no runs at all, on any branch. */
  isEmpty: boolean;
  /**
   * True when our own graded reports could not be read.
   *
   * Not an error for the tab: the executions are still the truth about what
   * ran, and showing them without the grading beats showing nothing. The view
   * says the diagnosis is unavailable rather than pretending every stage passed.
   */
  reportsUnavailable: boolean;
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

  /*
   * The remembered branch, read through useSyncExternalStore.
   *
   * localStorage is external state, and the two obvious ways to reach it are
   * both wrong here: reading it in a useState initialiser makes the server
   * render `dev` while the client renders the remembered branch, which is a
   * hydration mismatch; restoring it in an effect trips
   * react-hooks/set-state-in-effect, the rule this file already works around
   * elsewhere. This hook exists for exactly this — a server snapshot of
   * `dev`, a client snapshot from storage, and no state to keep in sync.
   */
  const storedBranch = useSyncExternalStore(
    subscribeToStoredBranch,
    () => readStoredBranch(projectId),
    () => WORKING_BRANCH,
  );
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [reports, setReports] = useState<RunGroup[]>([]);
  const [reportsUnavailable, setReportsUnavailable] = useState(false);
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
    /*
     * Two sources, deliberately not one request.
     *
     * The executions come from GitHub and say what RAN. The reports come from
     * our own ci_run_reports and say how it was GRADED. They are joined on the
     * commit SHA, which the backend already established is the only value the
     * stages of one execution share.
     *
     * The grading is fetched second and allowed to fail on its own. If our
     * report endpoint is down, what GitHub executed is still true and still
     * worth showing — degrading to "no diagnosis" is honest, where failing the
     * whole tab would hide working information.
     */
    return getProjectWorkflowRuns(projectId)
      .then(async (data) => {
        setRuns(data.runs);
        setUrl(data.actionsUrl);
        setRepoFullName(data.repoFullName);
        setError(null);
        setStatus("ready");

        try {
          const graded = await getRuns(data.repoFullName);
          setReports(graded.runs);
          setReportsUnavailable(false);
        } catch {
          setReportsUnavailable(true);
        }
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

  const sections = useMemo(
    () => groupRunsByPipelineBranch(runs, reports),
    [runs, reports],
  );

  /*
   * A remembered branch that is no longer offered reads as "All branches".
   *
   * The picker used to list pull-request merge refs, so storage still holds
   * values like `7/merge`. Showing everything while the <select> was handed a
   * value it has no option for put the first option, `dev`, on screen above
   * all three sections - the control and the panel disagreeing.
   */
  const effectiveBranch = sections.some(
    (section) => section.branch === storedBranch,
  )
    ? storedBranch
    : ALL_BRANCHES;

  const visibleSections = useMemo(
    () =>
      effectiveBranch === ALL_BRANCHES
        ? sections
        : sections.filter((section) => section.branch === effectiveBranch),
    [sections, effectiveBranch],
  );

  const selectBranch = useCallback(
    (branch: string) => {
      storeBranch(projectId, branch);
    },
    [projectId],
  );

  return {
    status,
    error,
    sections,
    visibleSections,
    selectedBranch: effectiveBranch,
    selectBranch,
    isEmpty: runs.length === 0,
    reportsUnavailable,
    actionsUrl: url,
    repoFullName,
    reload,
  };
}
