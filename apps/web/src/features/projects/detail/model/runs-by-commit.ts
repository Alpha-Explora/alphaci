/**
 * A commit's pipeline execution, gathered from the several runs it produced.
 *
 * One commit does not mean one run. access, quality and package are three
 * independent GitHub Actions workflows chained by `workflow_run`, so a single
 * push produces three runs with three distinct run ids. A flat list therefore
 * showed the same commit three times, which is most of why the tab was hard to
 * read: the repetition looked like history when it was one execution.
 *
 * The backend reached this conclusion first and is explicit about it — the
 * stages of one execution share only the commit SHA, "so that — not run_id — is
 * the correlation key" (`ci-reports.service.ts`). This module joins on the same
 * key, so the FE and BE agree on what "one pipeline run" means.
 *
 * Joining also puts the diagnosis where it belongs. `friendlyMessages` describe
 * a stage of an execution, not a GitHub run, so they can only be attached once
 * the runs of a commit are one object.
 */

import type { RunGroup, StageReport } from "@/shared/api/contracts";

/** The two fields the grouping needs from a GitHub run. */
export interface CommitRun {
  headSha: string;
  createdAt: string;
}

/** One commit's execution: every workflow run it triggered, plus our report. */
export interface CommitRunGroup<T extends CommitRun> {
  commitSha: string;
  /** The chained workflow runs for this commit, newest first. */
  runs: T[];
  /** The most recent of them, for the row header. */
  latest: T;
  /**
   * Our own graded report for this commit, when the pipeline reported at all.
   *
   * Null is meaningful: GitHub executed something we have no report for. That
   * is the case the stage resolver exists to name.
   */
  report: RunGroup | null;
}

function createdAtMs(run: CommitRun): number {
  const parsed = Date.parse(run.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Group a branch's runs by commit, newest commit first, attaching our report.
 *
 * Reports are indexed by SHA rather than searched per commit, so a project with
 * a long history does not turn the join quadratic.
 */
export function groupRunsByCommit<T extends CommitRun>(
  runs: readonly T[],
  reports: readonly RunGroup[],
): CommitRunGroup<T>[] {
  const reportBySha = new Map<string, RunGroup>();
  for (const report of reports) {
    // Rows arrive newest first; keep the first seen for a SHA so a re-run does
    // not lose to an older attempt of the same commit.
    if (!reportBySha.has(report.commitSha)) {
      reportBySha.set(report.commitSha, report);
    }
  }

  const byCommit = new Map<string, T[]>();
  for (const run of runs) {
    const bucket = byCommit.get(run.headSha);
    if (bucket) {
      bucket.push(run);
    } else {
      byCommit.set(run.headSha, [run]);
    }
  }

  return [...byCommit.entries()]
    .map(([commitSha, commitRuns]) => {
      const sorted = [...commitRuns].sort(
        (left, right) => createdAtMs(right) - createdAtMs(left),
      );
      return {
        commitSha,
        runs: sorted,
        latest: sorted[0]!,
        report: reportBySha.get(commitSha) ?? null,
      };
    })
    .sort((left, right) => createdAtMs(right.latest) - createdAtMs(left.latest));
}

/**
 * The stages of a commit worth saying something about.
 *
 * A stage that passed needs no words; the pill already says so. Everything else
 * carries a message the resolver wrote — why it was blocked, why it is
 * considered stalled — and those are the sentences someone opened the tab to
 * read. Filtering here keeps the view from deciding what counts as a problem.
 */
export function commitStageProblems(report: RunGroup | null): StageReport[] {
  if (!report) return [];
  return report.stages.filter(
    (stage) => stage.status !== "success" && stage.friendlyMessages.length > 0,
  );
}

/**
 * A stage status as one of the workspace's four pill tones.
 *
 * The runs feature has its own `stageStatusColors`, which returns inline colours
 * for the pipeline diagram. This is a different visual language — the workspace
 * tabs use `.ws-pill--*` classes — so mapping again here is not the duplication
 * it looks like; sharing one of them would force the other's idiom.
 *
 * `stalled` reads as a failure because that is what it is: the stage never
 * started and the pipeline will not continue on its own. `blocked` stays
 * neutral, because it is a consequence of an earlier failure rather than a
 * second thing to go and fix.
 */
export function stagePillTone(
  status: StageReport["status"],
): "success" | "failure" | "running" | "neutral" {
  switch (status) {
    case "success":
      return "success";
    case "failure":
    case "stalled":
      return "failure";
    case "running":
      return "running";
    default:
      return "neutral";
  }
}
