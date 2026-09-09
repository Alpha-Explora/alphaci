/**
 * The promotion flow the backend provisions and the generated pipelines run on.
 *
 * Declared once because it was written out as prose in three views and drifted:
 * two still read "test > uat > main" after `test` was retired and replaced by
 * `dev`, and a third listed only the two branches above the working tier. The
 * UI was describing a branch the product no longer creates.
 *
 * Mirrors `kernel/config/pipeline-branches.ts` in the backend, which is the
 * source of truth for what actually gets created. Keep the two in step; if they
 * disagree, the backend is right.
 */
export const PIPELINE_BRANCHES = ["dev", "uat", "main"] as const;

export type PipelineBranch = (typeof PIPELINE_BRANCHES)[number];

/** Where work lands, and the only tier developers push to directly. */
export const WORKING_BRANCH: PipelineBranch = PIPELINE_BRANCHES[0];

/**
 * The tiers reached by promotion rather than by pushing.
 *
 * Derived so a change to the flow above cannot leave a ladder behind that
 * silently drops or invents a rung.
 */
export const PROMOTION_BRANCHES = PIPELINE_BRANCHES.slice(1);

/** The flow as a label, e.g. "dev > uat > main". */
export const PROMOTION_FLOW_LABEL = PIPELINE_BRANCHES.join(" > ");

/**
 * Where a branch sits in the promotion flow, for ordering.
 *
 * Lives here, beside the flow itself, because two different features order by
 * it over two different shapes: the runs list groups our own `RunGroup` reports
 * by `branch`, and a project's Pipeline runs tab groups GitHub's
 * `WorkflowRunSummary` executions by `headBranch`. Written out at each call
 * site it would be the same `indexOf` twice, which is how "test" outlived its
 * own retirement in three views.
 *
 * A branch outside the flow — a leftover, or a repository someone connected
 * with its own conventions — ranks after every known tier rather than being
 * dropped, so it stays visible without displacing the pipeline.
 */
export function pipelineBranchRank(branch: string): number {
  const rank = (PIPELINE_BRANCHES as readonly string[]).indexOf(branch);
  return rank === -1 ? PIPELINE_BRANCHES.length : rank;
}

/** True when a branch is one the product actually provisions. */
export function isPipelineBranch(branch: string): boolean {
  return (PIPELINE_BRANCHES as readonly string[]).includes(branch);
}
