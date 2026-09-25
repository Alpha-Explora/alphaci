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

/**
 * The hosted branch QA verifies before it is promoted to main, and the only
 * branch the backend accepts QA runs on (anything else is a 400).
 *
 * Mirrors `QA_BRANCH` in the backend's `kernel/config/pipeline-branches.ts`.
 * QA Studio offers this environment and no other, so it must never be written
 * out as a literal in a view.
 */
export const QA_BRANCH: PipelineBranch = "uat";

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

/**
 * A pull request's merge ref, as GitHub reports it on a `pull_request` run.
 *
 * A run triggered by a pull request carries `refs/pull/4/merge`, which reaches
 * us as the branch `4/merge`. Rendered literally it sits in the runs list
 * beside dev, uat and main looking like a branch nobody in the team
 * recognises — and there is one per pull request, so they accumulate.
 */
const PULL_REQUEST_MERGE_REF = /^(\d+)\/merge$/;

/**
 * What to call a branch on screen.
 *
 * Only the display changes. The underlying value stays exactly as reported,
 * because it is what joins a run to its reports and to GitHub; renaming it
 * anywhere but the label would break that join.
 */
export function branchDisplayLabel(branch: string): string {
  const pullRequest = PULL_REQUEST_MERGE_REF.exec(branch);
  return pullRequest ? `PR #${pullRequest[1]}` : branch;
}

/** True when this "branch" is really a pull request's merge ref. */
export function isPullRequestRef(branch: string): boolean {
  return PULL_REQUEST_MERGE_REF.test(branch);
}
