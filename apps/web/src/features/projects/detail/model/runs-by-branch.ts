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
 * Structural input rather than the wire type, following `run-diagnosis.ts`: the
 * rule needs a branch and a timestamp, so it should not be coupled to whatever
 * else `WorkflowRunSummary` happens to carry, and the generic hands the caller
 * back its own full run type.
 */

import type { RunGroup } from "@/shared/api/contracts";
import {
  PIPELINE_BRANCHES,
  isPipelineBranch,
  pipelineBranchRank,
} from "@/shared/api/pipeline-branches";

import { groupRunsByCommit, type CommitRunGroup } from "./runs-by-commit";

/** The fields the grouping needs from a run. */
export interface BranchRun {
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
  /** False for a branch outside the declared flow, so the view can mark it. */
  isPipelineBranch: boolean;
}

/**
 * Milliseconds for sorting, tolerant of a timestamp GitHub did not send.
 *
 * An unparseable date sorts oldest rather than throwing. Losing the position of
 * one row is a smaller failure than a run list that will not render.
 */
function createdAtMs(run: BranchRun): number {
  const parsed = Date.parse(run.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Group runs by branch, in promotion-flow order, keeping every declared branch.
 *
 * Unknown branches come after the flow — a repository connected with its own
 * conventions still shows its runs, but never displaces dev/uat/main — and are
 * ordered between themselves by recency. They are only included when they
 * actually have runs; inventing empty sections for branches the product does
 * not provision would be noise, where an empty `uat` is a fact.
 */
export function groupRunsByPipelineBranch<T extends BranchRun>(
  runs: readonly T[],
  reports: readonly RunGroup[] = [],
): BranchRunSection<T>[] {
  const byBranch = new Map<string, T[]>();
  for (const run of runs) {
    const bucket = byBranch.get(run.headBranch);
    if (bucket) {
      bucket.push(run);
    } else {
      byBranch.set(run.headBranch, [run]);
    }
  }

  const sections = [...byBranch.entries()].map(([branch, branchRuns]) => ({
    branch,
    // The branch is passed so the report join matches on branch AND sha: a
    // promoted commit exists on several tiers, each with its own report.
    commits: groupRunsByCommit(branchRuns, reports, branch),
    isPipelineBranch: isPipelineBranch(branch),
  }));

  // Declared branches that recorded nothing. Added after the map so a branch
  // with runs is never duplicated by its own placeholder.
  for (const branch of PIPELINE_BRANCHES) {
    if (!byBranch.has(branch)) {
      sections.push({ branch, commits: [], isPipelineBranch: true });
    }
  }

  return sections.sort((left, right) => {
    const leftOrder = pipelineBranchRank(left.branch);
    const rightOrder = pipelineBranchRank(right.branch);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    // Two unknown branches: newest activity first.
    const leftLatest = left.commits[0]?.latest;
    const rightLatest = right.commits[0]?.latest;
    if (!leftLatest || !rightLatest) return 0;
    return createdAtMs(rightLatest) - createdAtMs(leftLatest);
  });
}
