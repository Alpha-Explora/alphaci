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

import type { RunGroup, RunOverallStatus } from "@/shared/api/contracts";

import {
  indexReportedIdentities,
  reportedCommitSha,
  type ReportedIdentity,
} from "./reported-run-identity";

/**
 * The fields the grouping needs from a GitHub run.
 *
 * `id` is here for the same reason it is on `BranchRun`: `headSha` is the
 * branch's head rather than the triggering commit on every chained stage, so
 * the run id is what lets our report correct it.
 */
export interface CommitRun {
  id: number;
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
 * Reports are indexed rather than searched per commit, so a project with a long
 * history does not turn the join quadratic.
 *
 * THE KEY IS BRANCH AND SHA, not SHA alone.
 *
 * A promotion fast-forwards the same commit onto the next tier, so one SHA
 * exists on dev, uat and main — with a separate report for each, because each
 * ran its own pipeline. Keying on SHA alone attached whichever report happened
 * to come first, and it showed: `dev` displayed `PACKAGE success` for a commit
 * whose dev pipeline recorded only access and quality. It was reading main's
 * report. Dev's package should have read `blocked`, since dev's quality failed.
 *
 * A stage reported as passing when it never ran on that branch is the worst
 * direction for this to be wrong in.
 */
export function groupRunsByCommit<T extends CommitRun>(
  runs: readonly T[],
  reports: readonly RunGroup[],
  branch: string,
  identities: ReadonlyMap<number, ReportedIdentity> = indexReportedIdentities(
    reports,
  ),
): CommitRunGroup<T>[] {
  const reportBySha = new Map<string, RunGroup>();
  for (const report of reports) {
    if (report.branch !== branch) continue;
    // Rows arrive newest first; keep the first seen for a SHA so a re-run does
    // not lose to an older attempt of the same commit.
    if (!reportBySha.has(report.commitSha)) {
      reportBySha.set(report.commitSha, report);
    }
  }

  /*
   * Keyed on the commit our report recorded, not the run's head_sha.
   *
   * A chained run is stamped with the branch's CURRENT head, so five pushes
   * in quick succession left every chained run claiming the last commit while
   * their reports were filed under the commits that actually triggered them.
   * The two never met: the quality report sat on a commit with no run group,
   * and a stage that ran seven times rendered as "Stage never started".
   */
  const byCommit = new Map<string, T[]>();
  for (const run of runs) {
    const commitSha = reportedCommitSha(run, identities);
    const bucket = byCommit.get(commitSha);
    if (bucket) {
      bucket.push(run);
    } else {
      byCommit.set(commitSha, [run]);
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
    .sort(
      (left, right) => createdAtMs(right.latest) - createdAtMs(left.latest),
    );
}

/** How a commit's headline reads: the word, and the tone to paint it. */
export interface CommitHeadline {
  label: string;
  tone: "success" | "failure" | "running" | "neutral" | "warning";
  /** True when this came from our grading rather than a single GitHub run. */
  fromReport: boolean;
}

const OVERALL_TONE: Record<RunOverallStatus, CommitHeadline["tone"]> = {
  success: "success",
  failure: "failure",
  running: "running",
  cancelled: "neutral",
  partial: "neutral",
};

function concludedAsFailed(run: { status: string; conclusion: string | null }): boolean {
  return (
    run.status === "completed" &&
    (run.conclusion === "failure" || run.conclusion === "timed_out")
  );
}

/**
 * The headline status for a commit.
 *
 * It must come from the REPORT when we have one. The header used to show the
 * latest GitHub run's conclusion, which produced a row reading `SUCCESS` above
 * a `QUALITY failure` pill — the package workflow had succeeded, so the newest
 * run was green while the pipeline as a whole was not. A headline that
 * contradicts the detail beneath it is worse than no headline, and it errs
 * green, which is the dangerous direction.
 *
 * One exception, and it only ever moves the headline AWAY from green: a report
 * of success whose stage run GitHub later finished as failed. The promotion
 * job runs after the package stage reports, so when it fails the report stays
 * `success` forever while nothing was promoted. That reads "attention" rather
 * than "failure", because every stage did pass.
 *
 * Without a report there is nothing to contradict, so the run's own conclusion
 * is the honest answer.
 */
export function commitHeadline<
  T extends CommitRun & { status: string; conclusion: string | null },
>(commit: CommitRunGroup<T>): CommitHeadline {
  return commit.report
    ? reportHeadline(commit.report, commit.runs)
    : runHeadline(commit.latest);
}

function reportHeadline(
  report: RunGroup,
  runs: readonly (CommitRun & { status: string; conclusion: string | null })[],
): CommitHeadline {
  const lateFailure =
    report.overallStatus === "success" &&
    report.stages.some(
      (stage) =>
        stage.status === "success" &&
        runs.some((run) => run.id === stage.runId && concludedAsFailed(run)),
    );
  if (lateFailure) {
    return { label: "attention", tone: "warning", fromReport: true };
  }
  return {
    label: report.overallStatus,
    tone: OVERALL_TONE[report.overallStatus],
    fromReport: true,
  };
}

function runHeadline(run: { status: string; conclusion: string | null }): CommitHeadline {
  const { status, conclusion } = run;
  const label = status === "completed" ? (conclusion ?? "completed") : status;
  let tone: CommitHeadline["tone"] = "neutral";
  if (status !== "completed") {
    tone = status === "queued" || status === "waiting" ? "neutral" : "running";
  } else if (conclusion === "success") {
    tone = "success";
  } else if (concludedAsFailed(run)) {
    tone = "failure";
  }
  return { label, tone, fromReport: false };
}
