/* Pure rules for the runs domain.
 *
 * No React, no Next, no fetch — everything here is directly callable from a
 * test. These assertions were previously reachable only by rendering the route
 * and reading the DOM. */
import { ApiError } from "@/lib/api/request";

import type {
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
