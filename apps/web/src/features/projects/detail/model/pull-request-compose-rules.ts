/**
 * The decisions the compose screen makes about a comparison, kept pure so
 * they can be tested without rendering anything.
 */

import type {
  BranchComparison,
  ComparisonCommit,
  PullRequestSummary,
} from "../data/project-workspace-api";

/**
 * What the compose screen should say about a comparison, and whether the
 * Create button is live.
 *
 * `tone` picks the banner style: `ready` is the quiet default, `warning`
 * allows creating but wants the person to notice something, and `blocked`
 * disables Create and explains why.
 */
export interface ComposeReadiness {
  canCreate: boolean;
  tone: "ready" | "warning" | "blocked";
  message: string;
}

/**
 * Decide whether a pull request from `head` into `base` should be offered.
 *
 * The cases to consider (GitHub's `status` is in `comparison.status`):
 *   - `identical`: the branches point at the same commit.
 *   - `behind`: head has nothing base lacks, only base has moved on.
 *   - `diverged`: head has commits, and base also has commits head lacks —
 *     it may conflict, or the checks may run against a stale base.
 *   - `ahead`: the clean case.
 *   - `existing`: a pull request for this pair is already open; GitHub would
 *     refuse a second one with a 422.
 *
 * TODO(you): replace the placeholder below. See the note in the reply.
 */
export function describeComparison(
  comparison: BranchComparison,
  existing: PullRequestSummary | null,
): ComposeReadiness {
  // Placeholder so the screen works end to end; it only refuses the cases
  // GitHub itself would refuse, and says nothing about the rest.
  if (existing) {
    return {
      canCreate: false,
      tone: "blocked",
      message: `Already open as #${String(existing.number)}.`,
    };
  }
  if (comparison.aheadBy === 0) {
    return { canCreate: false, tone: "blocked", message: "Nothing to merge." };
  }
  return { canCreate: true, tone: "ready", message: "" };
}

/**
 * A title to start from, the way GitHub suggests one.
 *
 * A single commit already has a sentence someone wrote about the change, so
 * that is used verbatim. Several commits have no one sentence, so the branch
 * name is turned back into words: `feature/add-login` becomes "Add login".
 */
export function suggestTitle(head: string, commits: ComparisonCommit[]): string {
  const [only] = commits;
  if (commits.length === 1 && only?.headline) return only.headline;

  const lastSegment = head.split("/").pop() ?? head;
  const words = lastSegment.replace(/[-_]+/g, " ").trim();
  if (!words) return head;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
