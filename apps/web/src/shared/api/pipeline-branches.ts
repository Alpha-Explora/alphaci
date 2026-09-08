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
