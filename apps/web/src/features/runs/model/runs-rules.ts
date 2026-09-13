/* Pure rules for the runs domain.
 *
 * No React, no Next, no fetch — everything here is directly callable from a
 * test. These assertions were previously reachable only by rendering the route
 * and reading the DOM. */
import {
  PIPELINE_BRANCHES,
  isPipelineBranch,
  pipelineBranchRank,
} from "@/shared/api/pipeline-branches";
import { ApiError } from "@/shared/api/request";

import type {
  BranchRunGroup,
  ProjectRunGroup,
  RunGroup,
  RunOverallStatus,
  RunsSummary,
} from "./runs-types";

export const STATUS_LABELS: Record<RunOverallStatus, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  cancelled: "Cancelled",
  partial: "Partial",
};

export const STATUS_COLORS: Record<RunOverallStatus, string> = {
  success: "var(--accent-teal)",
  failure: "var(--danger)",
  running: "var(--brand)",
  cancelled: "var(--text-muted)",
  partial: "var(--accent-amber)",
};

function startedAtMs(run: RunGroup): number {
  return new Date(run.startedAt).getTime();
}

/**
 * Group runs inside their repository rather than as one flat cross-project
 * stream: one section per repo, newest project first, that project's runs
 * newest first inside it.
 */
export function groupRunsByProject(runs: RunGroup[]): ProjectRunGroup[] {
  const byRepo = new Map<string, RunGroup[]>();
  for (const run of runs) {
    const bucket = byRepo.get(run.repoFullName);
    if (bucket) {
      bucket.push(run);
    } else {
      byRepo.set(run.repoFullName, [run]);
    }
  }

  return Array.from(byRepo.entries())
    .map(([repoFullName, repoRuns]) => {
      const sorted = [...repoRuns].sort(
        (left, right) => startedAtMs(right) - startedAtMs(left),
      );
      return { repoFullName, runs: sorted, latestRun: sorted[0]! };
    })
    .sort(
      (left, right) =>
        startedAtMs(right.latestRun) - startedAtMs(left.latestRun),
    );
}

/**
 * Group one project's runs by the branch they ran on.
 *
 * A flat list of runs is hard to read because the branches interleave: a push
 * to dev, a promotion PR into uat and a main deploy all land next to each other
 * with nothing but a label to tell them apart. Grouped by branch, each column
 * reads as its own history.
 *
 * Ordered by the promotion flow rather than alphabetically, so the view runs in
 * the direction the pipeline does. A branch outside the flow — a leftover, or a
 * repository someone connected with its own conventions — sorts after the known
 * ones rather than being dropped.
 */
export function groupRunsByBranch(runs: RunGroup[]): BranchRunGroup[] {
  const byBranch = new Map<string, RunGroup[]>();
  for (const run of runs) {
    const bucket = byBranch.get(run.branch);
    if (bucket) {
      bucket.push(run);
    } else {
      byBranch.set(run.branch, [run]);
    }
  }

  const groups: BranchRunGroup[] = [...byBranch.entries()].map(
    ([branch, branchRuns]) => {
      const sorted = [...branchRuns].sort(
        (left, right) => startedAtMs(right) - startedAtMs(left),
      );
      return {
        branch,
        runs: sorted,
        latestRun: sorted[0] ?? null,
        isPipelineBranch: isPipelineBranch(branch),
      };
    },
  );

  /*
   * Declared branches that recorded nothing still get a section.
   *
   * An empty `uat` is a fact - nothing has been promoted yet - and a section
   * that silently vanishes cannot state it. Added after the map so a branch
   * with runs is never duplicated by its own placeholder, and only for the
   * branches the product actually provisions: inventing empty sections for
   * branches nobody declared would be noise, where an absent `uat` is not.
   *
   * The same rule the projects feature applies to one project's GitHub runs,
   * so the two views answer "what is on uat" the same way.
   */
  for (const branch of PIPELINE_BRANCHES) {
    if (!byBranch.has(branch)) {
      groups.push({
        branch,
        runs: [],
        latestRun: null,
        isPipelineBranch: true,
      });
    }
  }

  return groups.sort((left, right) => {
    const leftOrder = pipelineBranchRank(left.branch);
    const rightOrder = pipelineBranchRank(right.branch);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    // Two unknown branches: newest activity first. A declared branch with no
    // runs has no timestamp to compare, and holds its place in the flow.
    const leftLatest = left.latestRun;
    const rightLatest = right.latestRun;
    if (!leftLatest || !rightLatest) return 0;
    return startedAtMs(rightLatest) - startedAtMs(leftLatest);
  });
}

/** Headline counts for the summary strip. */
export function summarizeRuns(runs: RunGroup[]): RunsSummary {
  const counts = runs.reduce(
    (acc, run) => {
      acc[run.overallStatus] += 1;
      return acc;
    },
    {
      success: 0,
      failure: 0,
      running: 0,
      cancelled: 0,
      partial: 0,
    } satisfies Record<RunOverallStatus, number>,
  );

  const latestRun = runs.reduce<RunGroup | null>((latest, run) => {
    if (!latest) return run;
    return startedAtMs(run) > startedAtMs(latest) ? run : latest;
  }, null);

  return {
    total: runs.length,
    counts,
    latestRun,
    needsAttention: counts.failure + counts.partial + counts.cancelled,
  };
}

const GENERIC_LOAD_ERROR =
  "Could not load pipeline runs. Check your connection and try again.";

/**
 * Map a thrown value to a message that is safe to render.
 *
 * Views receive this string, never the error object — so an API detail cannot
 * reach the screen by accident.
 */
export function toUserError(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_LOAD_ERROR;

  switch (err.status) {
    case 401:
      return "Your session expired. Please sign in again.";
    case 403:
      return "You don't have access to this repository's runs.";
    case 404:
      return "This repository hasn't been set up for CI yet.";
    default:
      return GENERIC_LOAD_ERROR;
  }
}
