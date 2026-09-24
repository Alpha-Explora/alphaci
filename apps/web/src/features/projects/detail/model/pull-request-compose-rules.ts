/**
 * The decisions the compose screen makes about a comparison, kept pure so
 * they can be tested without rendering anything.
 */

import type {
  BranchComparisonResponse,
  ComparisonCommit,
} from "../data/project-workspace-api";

/**
 * Something the banner can offer to fix what it describes, so the person is
 * not left to work out the remedy from the sentence.
 */
export type ComposeAction =
  | { kind: "swap" }
  | { kind: "open-existing"; number: number };

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
  action?: ComposeAction;
}

/**
 * Decide whether a pull request from `head` into `base` should be offered.
 *
 * Blocked only where GitHub would refuse, or where the pull request would be
 * empty; a pull request that is merely risky is allowed with a warning,
 * because the person may have reasons the comparison cannot see.
 *
 *   - existing: already open. GitHub would 422 a second one, so the answer is
 *     the pull request that exists, one click away inside the product.
 *   - identical: the same commit on both sides; nothing to propose.
 *   - behind: head has nothing base lacks. This is nearly always the two
 *     pickers the wrong way round, so the fix offered is swapping them.
 *   - diverged: base moved on after head branched. It can still merge, but
 *     it may conflict and its checks run against a base that is out of date.
 *   - ahead: the clean case, and the banner stays quiet.
 */
export function describeComparison(
  compare: BranchComparisonResponse,
): ComposeReadiness {
  const { base, head, comparison, existingPullRequest } = compare;

  if (existingPullRequest) {
    return {
      canCreate: false,
      tone: "blocked",
      message: `${head} → ${base} is already open as #${String(existingPullRequest.number)}: ${existingPullRequest.title}`,
      action: { kind: "open-existing", number: existingPullRequest.number },
    };
  }

  if (comparison.aheadBy === 0) {
    if (comparison.behindBy === 0) {
      return {
        canCreate: false,
        tone: "blocked",
        message: `${head} and ${base} point at the same commit, so there is nothing to merge.`,
      };
    }
    return {
      canCreate: false,
      tone: "blocked",
      message: `${head} has no commits that ${base} lacks; ${base} is ${commits(comparison.behindBy)} ahead of it. The branches may be the wrong way round.`,
      action: { kind: "swap" },
    };
  }

  if (comparison.behindBy > 0) {
    return {
      canCreate: true,
      tone: "warning",
      message: `${base} has ${commits(comparison.behindBy)} that ${head} does not. This can still be opened, but it may conflict, and its checks will run against an older ${base}. Consider updating ${head} first.`,
    };
  }

  return { canCreate: true, tone: "ready", message: "" };
}

function commits(count: number): string {
  return `${String(count)} commit${count === 1 ? "" : "s"}`;
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
