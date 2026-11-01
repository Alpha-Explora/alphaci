/**
 * A project's GitHub runs, split into the branches the pipeline promotes through.
 *
 * A flat run list interleaves the tiers: a push to dev, a promotion PR into uat
 * and a main deploy land next to each other with nothing but a label to tell
 * them apart. Read per branch, each section is its own history — which is how
 * someone actually asks the question ("what is on dev", "did it reach main").
 *
 * Every declared branch appears even with no runs. An empty `uat` is
 * information: it means nothing has been promoted yet, and a section that
 * silently vanishes cannot say that. This is the one behaviour that separates
 * the view from a `groupBy` — absence is rendered, not skipped.
 *
 * ONLY the declared branches appear. Runs on anything else — a pull request's
 * merge ref (`7/merge`), the feature branch behind it, a leftover — are left
 * out. Every pull request added two entries of its own, one for the merge ref
 * our report recorded and one for the head branch GitHub labelled its
 * unreported runs with, so the picker grew by two rows per PR and buried the
 * three tiers it exists to navigate. Those runs are still on GitHub and in the
 * cross-project /runs view; this tab is about what reached dev, uat and main.
 *
 * Structural input rather than the wire type, following `run-diagnosis.ts`: the
 * rule needs a branch and a timestamp, so it should not be coupled to whatever
 * else `WorkflowRunSummary` happens to carry, and the generic hands the caller
 * back its own full run type.
 */

import type { RunGroup } from "@/shared/api/contracts";
import {
  PIPELINE_BRANCHES,
  isPipelineBranch,
} from "@/shared/api/pipeline-branches";

import { groupRunsByCommit, type CommitRunGroup } from "./runs-by-commit";
import {
  indexReportedIdentities,
  reportedBranch,
} from "./reported-run-identity";

/**
 * The fields the grouping needs from a run.
 *
 * `id` is here because `headBranch` cannot be trusted on its own: a chained
 * stage carries the default branch rather than the one it ran for, and the run
 * id is what lets our own report correct it.
 */
export interface BranchRun {
  id: number;
  headBranch: string;
  headSha: string;
  createdAt: string;
}

/** One branch's history, newest commit first. */
export interface BranchRunSection<T extends BranchRun> {
  branch: string;
  /**
   * The branch's commits, each holding the several workflow runs it triggered.
   *
   * Commits rather than runs, because one push produces one run per chained
   * workflow and listing them flat repeated every commit three times.
   */
  commits: CommitRunGroup<T>[];
}

/**
 * Group runs by declared branch: always exactly dev, uat, main, in that order.
 */
export function groupRunsByPipelineBranch<T extends BranchRun>(
  runs: readonly T[],
  reports: readonly RunGroup[] = [],
): BranchRunSection<T>[] {
  /*
   * Filed under the branch our report recorded, not the one GitHub labelled
   * the run with. Only `access` is push-triggered and therefore honestly
   * labelled; every chained stage claims the default branch, which silently
   * emptied `dev` and `uat` while burying their runs under `main`.
   */
  const identities = indexReportedIdentities(reports);

  const byBranch = new Map<string, T[]>();
  for (const run of runs) {
    /*
     * Filtered AFTER the report has corrected the branch, never on GitHub's
     * label. A chained stage of a pull-request pipeline arrives labelled
     * `main`; filtering on that would keep it and file a PR's run under main.
     */
    const branch = reportedBranch(run, identities);
    if (!isPipelineBranch(branch)) continue;

    const bucket = byBranch.get(branch);
    if (bucket) {
      bucket.push(run);
    } else {
      byBranch.set(branch, [run]);
    }
  }

  // Mapped from the declared list, which is already in flow order, so a branch
  // that recorded nothing still gets its section and nothing needs sorting.
  return PIPELINE_BRANCHES.map((branch) => ({
    branch,
    // The branch is passed so the report join matches on branch AND sha: a
    // promoted commit exists on several tiers, each with its own report.
    commits: groupRunsByCommit(
      byBranch.get(branch) ?? [],
      reports,
      branch,
      identities,
    ),
  }));
}
