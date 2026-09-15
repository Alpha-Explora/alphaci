/**
 * Which branch and commit a GitHub run actually belongs to.
 *
 * GitHub's own answer is wrong for most of a pipeline. `access` is triggered by
 * a push, so its `head_branch` and `head_sha` are true. Every stage after it is
 * triggered by `workflow_run`, and those runs are stamped with the DEFAULT
 * BRANCH and that branch's current head instead of the branch and commit that
 * caused them.
 *
 * It is not a small discrepancy. On one sandbox repository 27 of 31 runs were
 * labelled `main`, including runs whose own display title read
 * "dev - ci: add ALPHACI workflow". Grouping on those labels put every chained
 * stage under `main`, left `dev` and `uat` reading "no runs" while GitHub
 * plainly had runs for both, and filed quality's report under a commit that had
 * no run group to attach to - so a stage that ran seven times and reported
 * genuine failures rendered as "Stage never started".
 *
 * We already hold the truth. The `pipeline-context` job captures the real
 * branch and commit and carries them down the chain, so `ci_run_reports` is
 * correct where GitHub is not, and every stage records the run id it executed
 * in. Run ids are unambiguous - they are the one identifier neither side can
 * get wrong - so they are the join, and the report supplies the branch and sha.
 *
 * A run with no report keeps GitHub's values. That is the honest fallback:
 * `access` is right there anyway, and for anything else an unreported run is
 * one we know nothing better about.
 */

import type { RunGroup } from "@/shared/api/contracts";

/** Where a run really happened, as our own report recorded it. */
export interface ReportedIdentity {
  branch: string;
  commitSha: string;
}

/*
 * Two narrow lookups rather than one wide one. The commit grouping has no
 * business knowing about branches, and asking it for a `headBranch` it never
 * uses would be the interface leaking the resolver's convenience.
 */

/**
 * Index every run id our reports know about.
 *
 * Built once per render and shared by the branch and commit groupings, so a
 * project with a long history does not turn the join quadratic.
 *
 * Reports arrive newest first. The first entry for a run id wins, which only
 * matters if the same run were reported twice - and then the newer report is
 * the one to believe.
 */
export function indexReportedIdentities(
  reports: readonly RunGroup[],
): ReadonlyMap<number, ReportedIdentity> {
  const index = new Map<number, ReportedIdentity>();

  for (const report of reports) {
    for (const stage of report.stages) {
      /*
       * A stage without a real run id is skipped rather than indexed.
       *
       * Older rows predate the field, and a partial payload can omit it. An
       * absent id is still a usable Map key, so indexing it would file every
       * such stage under one entry - and then any run whose own id was
       * missing would match the first of them and inherit a branch and commit
       * from an unrelated pipeline. Two unknowns are not a match.
       */
      if (!Number.isFinite(stage.runId)) continue;

      if (!index.has(stage.runId)) {
        index.set(stage.runId, {
          branch: report.branch,
          commitSha: report.commitSha,
        });
      }
    }
  }

  return index;
}

/** Never let an absent id find an entry; see indexReportedIdentities. */
function lookup(
  runId: number,
  index: ReadonlyMap<number, ReportedIdentity>,
): ReportedIdentity | undefined {
  return Number.isFinite(runId) ? index.get(runId) : undefined;
}

/** The branch to file a run under: ours when we have it, GitHub's when not. */
export function reportedBranch(
  run: { id: number; headBranch: string },
  index: ReadonlyMap<number, ReportedIdentity>,
): string {
  return lookup(run.id, index)?.branch ?? run.headBranch;
}

/** The commit to file a run under: ours when we have it, GitHub's when not. */
export function reportedCommitSha(
  run: { id: number; headSha: string },
  index: ReadonlyMap<number, ReportedIdentity>,
): string {
  return lookup(run.id, index)?.commitSha ?? run.headSha;
}
