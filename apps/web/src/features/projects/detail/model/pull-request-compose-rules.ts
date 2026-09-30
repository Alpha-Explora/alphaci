/**
 * The decisions the compose screen makes about a comparison, kept pure so
 * they can be tested without rendering anything.
 */

import type {
  BranchComparisonResponse,
  ComparisonCommit,
} from "../data/project-workspace-api";
import type { AppRole } from "@/shared/api/contracts";
import {
  PRODUCTION_BRANCH,
  QA_BRANCH,
  WORKING_BRANCH,
} from "@/shared/api/pipeline-branches";

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

/* ── Phase 1 security gates: what this composer offers as a base ────────── */

/**
 * The branches this composer will let anyone pick as `base`.
 *
 * `main` is never one of them: Hop 3 (`uat` -> `main`) is locked to the
 * promotion engine and QA Studio's "Ready for production" gate
 * (PERSONA_WORKFLOW_SPEC.md §5), not this generic composer — for every role,
 * Team Lead and Admin included.
 */
export function selectableBaseBranches(branches: string[]): string[] {
  return branches.filter((branch) => branch !== PRODUCTION_BRANCH);
}

/**
 * The base this screen opens on.
 *
 * Not the repository's default branch: on this product that is `main`
 * (GitHub's own default, and the one branch this composer must not default
 * into), which used to leave the picker parked on the one base nobody may
 * merge into. `dev` is where Hop 1 and Hop 2 both start from, so it is
 * preferred; `uat` covers a repository still mid-migration that has not cut
 * `dev` yet; and the first remaining selectable branch is the last resort so
 * the picker is never left on `main` even then.
 */
export function defaultComposeBase(branches: string[]): string {
  const selectable = selectableBaseBranches(branches);
  if (selectable.includes(WORKING_BRANCH)) return WORKING_BRANCH;
  if (selectable.includes(QA_BRANCH)) return QA_BRANCH;
  return selectable[0] ?? "";
}

const PULL_REQUEST_ROLES: ReadonlySet<AppRole> = new Set(["admin", "lead", "member"]);

/**
 * Who may open or merge pull requests from the workspace. An allow-list, so a
 * role added later (or a session whose role has not loaded) gets nothing
 * until it is named here.
 */
export function isPullRequestRole(role: AppRole | null | undefined): boolean {
  return role != null && PULL_REQUEST_ROLES.has(role);
}

/**
 * Whether opening a pull request into `base` should be offered at all,
 * mirroring the backend's two 403 codes for `POST .../pull-requests`
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1): `MAIN_PR_RESTRICTED` blocks every
 * role from proposing a merge into `main` here, and `PR_ROLE_FORBIDDEN`
 * blocks QA from opening a pull request at all — Developer is the primary
 * role for this screen, and Team Lead may use it too.
 */
export function canCreatePullRequest(
  role: AppRole | null | undefined,
  base: string,
): boolean {
  if (!isPullRequestRole(role)) return false;
  if (base === PRODUCTION_BRANCH) return false;
  return true;
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
