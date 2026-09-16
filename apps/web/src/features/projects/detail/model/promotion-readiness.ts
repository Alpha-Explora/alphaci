/**
 * Whether a commit opened its promotion pull request, and if not, what stopped
 * it.
 *
 * The pipeline promotes dev to uat and uat to main by opening a pull request
 * from the package stage, and the job that does it is conditional:
 *
 *   needs.build.result == 'success' && needs['deploy-<provider>-<slot>-dev'].result == 'success'
 *
 * When any of that is unmet the job SKIPS, which is the quietest possible
 * outcome. Nothing failed, nothing is red, and no pull request appears - so
 * the promotion not happening looks exactly like a promotion nobody asked
 * for. Across three sandbox repositories those jobs have been skipped 40
 * times and executed 0, and the only way to learn that was to go and count.
 *
 * Read from the package stage's own per-tool checks, which already carry
 * every job's name and conclusion. No new endpoint, and no second opinion
 * about what happened: the same rows the stage reported.
 *
 * It deliberately does NOT guess. When the promotion job skipped and nothing
 * else in the stage failed, this says the promotion did not run and stops
 * there - naming a cause we cannot see is how the failed-job hints ended up
 * telling people to build locally when a registry push had failed.
 */

import type { StageCheck } from "@/shared/api/contracts";

/** Which branch a source branch promotes into, if any. */
const PROMOTES_INTO: Readonly<Record<string, string>> = {
  dev: "uat",
  uat: "main",
};

export type PromotionState =
  /** The promotion pull request was opened or updated. */
  | "opened"
  /** Something in the stage failed, so the promotion job never ran. */
  | "blocked"
  /** The job skipped and nothing visible explains it. */
  | "did-not-run"
  /** This branch does not promote, or the stage carries no promotion job. */
  | "not-applicable";

export interface PromotionReadiness {
  state: PromotionState;
  /** The branch this one promotes into — null when it does not promote. */
  target: string | null;
  /**
   * The checks that did not pass, when that is why the promotion did not
   * happen. Named rather than counted: "deploy failed" and "tests failed" send
   * a reader to different places.
   */
  blockedBy: string[];
}

const NOT_APPLICABLE: PromotionReadiness = {
  state: "not-applicable",
  target: null,
  blockedBy: [],
};

/**
 * A job that is another branch's business.
 *
 * The package stage carries one deploy job per branch and skips the ones that
 * do not apply, so a dev run legitimately shows `deploy-…-uat` skipped. Those
 * skips are not blockers and must not be reported as though a reader could act
 * on them.
 */
function belongsToAnotherBranch(name: string, branch: string): boolean {
  const other = Object.keys(PROMOTES_INTO)
    .concat(Object.values(PROMOTES_INTO))
    .filter((candidate) => candidate !== branch);

  return other.some(
    (candidate) =>
      name.endsWith(`-${candidate}`) || name.includes(`-${candidate}/`),
  );
}

export function promotionReadiness(
  branch: string,
  checks: readonly StageCheck[] | undefined,
): PromotionReadiness {
  const target = PROMOTES_INTO[branch];
  if (!target || !checks || checks.length === 0) {
    return NOT_APPLICABLE;
  }

  const promotionJob = checks.find((check) =>
    check.name.startsWith(`promote-to-${target}`),
  );
  if (!promotionJob) {
    return NOT_APPLICABLE;
  }

  if (promotionJob.conclusion === "success") {
    return { state: "opened", target, blockedBy: [] };
  }

  /*
   * Only failures block. A skipped job on this branch is either the promotion
   * itself or another branch's deploy, and neither is something to report as a
   * reason: the first is the outcome being explained, the second never applied.
   */
  const blockedBy = checks
    .filter(
      (check) =>
        check.conclusion === "failure" ||
        check.conclusion === "timed_out" ||
        check.conclusion === "action_required",
    )
    .filter((check) => !belongsToAnotherBranch(check.name, branch))
    .map((check) => check.name);

  return blockedBy.length > 0
    ? { state: "blocked", target, blockedBy }
    : { state: "did-not-run", target, blockedBy: [] };
}
