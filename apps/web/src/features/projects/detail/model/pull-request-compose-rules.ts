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
  isPipelineBranch,
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
      message: `${head} is ${commits(comparison.behindBy)} behind ${base}. It may conflict, and its checks will run against an older ${base}. Consider updating it first.`,
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
export function selectableBaseBranches(
  branches: string[],
  role?: AppRole | null,
): string[] {
  const selectable = branches.filter((branch) => branch !== PRODUCTION_BRANCH);
  // A Developer only ever opens into dev (from a feature) or uat (from dev).
  if (role === "member") {
    return selectable.filter(
      (branch) => branch === WORKING_BRANCH || branch === QA_BRANCH,
    );
  }
  return selectable;
}

/**
 * The branches a viewer may pick as `head` for a given `base`. A Developer
 * proposes a feature branch into dev, or dev into uat, and nothing else; every
 * other role may pick any branch but the base itself.
 */
export function selectableHeadBranches(
  branches: readonly string[],
  role: AppRole | null | undefined,
  base: string,
): string[] {
  if (role !== "member") return branches.filter((name) => name !== base);
  if (base === WORKING_BRANCH) {
    return branches.filter((name) => !isPipelineBranch(name));
  }
  if (base === QA_BRANCH) return branches.filter((name) => name === WORKING_BRANCH);
  return [];
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
export function defaultComposeBase(
  branches: string[],
  role?: AppRole | null,
): string {
  const selectable = selectableBaseBranches(branches, role);
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
 * The route rule, mirroring the backend's `PR_ROUTE_RESTRICTED` (and
 * `MAIN_PR_RESTRICTED` for `main`):
 *
 *   - lead, admin: any head into any base except `main`.
 *   - member (Developer): a non-pipeline (feature) branch into `dev`, or `dev`
 *     into `uat`. Never a feature into `uat`, never into `main`.
 *   - qa and anything unknown: nothing.
 */
export function isPullRequestRouteAllowed(
  role: AppRole | null | undefined,
  head: string,
  base: string,
): boolean {
  if (!isPullRequestRole(role)) return false;
  if (base === PRODUCTION_BRANCH) return false;
  if (role !== "member") return true;
  if (head === "" || head === base) return false;
  if (base === WORKING_BRANCH) return !isPipelineBranch(head);
  return base === QA_BRANCH && head === WORKING_BRANCH;
}

/**
 * Whether opening a pull request from `head` into `base` should be offered,
 * mirroring the backend's 403 codes for `POST .../pull-requests`
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1): `MAIN_PR_RESTRICTED` for `main`,
 * `PR_ROLE_FORBIDDEN` for QA, and `PR_ROUTE_RESTRICTED` for a Developer's
 * disallowed route.
 */
export function canCreatePullRequest(
  role: AppRole | null | undefined,
  base: string,
  head: string,
): boolean {
  return isPullRequestRouteAllowed(role, head, base);
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

/* ── Phase 3 presets (PERSONA_WORKFLOW_SPEC.md §8.4) ───────────────────── */

export type PullRequestPresetId = "feature-to-dev" | "dev-to-uat" | "custom";

/** In the order they are offered; the first available one is the default. */
export const PULL_REQUEST_PRESET_IDS: readonly PullRequestPresetId[] = [
  "feature-to-dev",
  "dev-to-uat",
  "custom",
];

/** Shared with the backend's `PR_ROUTE_RESTRICTED` sentence. */
export const DEVELOPER_ROUTE_MESSAGE =
  "Developers open pull requests from a feature branch into dev, and from dev into uat.";

const PRESET_LABELS: Record<PullRequestPresetId, string> = {
  "feature-to-dev": "Feature → Dev",
  "dev-to-uat": "Dev → UAT",
  custom: "Custom",
};

/** What the presets need to know about the viewer and the repository. */
export interface PresetContext {
  branches: readonly string[];
  role: AppRole | null | undefined;
  /** The viewer's GitHub login, used to recognise their own branches. */
  login?: string | null;
}

export interface PullRequestPreset {
  id: PullRequestPresetId;
  label: string;
  available: boolean;
  /** Why it is disabled; null when available. */
  reason: string | null;
}

/**
 * Whether a preset can be used here, and if not, why. A branch a preset
 * names must exist in the (role-filtered) list; nothing is assumed present.
 */
export function presetFor(
  id: PullRequestPresetId,
  context: PresetContext,
): PullRequestPreset {
  const has = (name: string) => context.branches.includes(name);
  const label = PRESET_LABELS[id];
  let reason: string | null = null;

  if (!isPullRequestRole(context.role)) {
    reason = "Your role does not open pull requests.";
  } else if (id === "custom" && context.role === "member") {
    reason = DEVELOPER_ROUTE_MESSAGE;
  } else if (id === "feature-to-dev" && !has(WORKING_BRANCH)) {
    reason = `There is no ${WORKING_BRANCH} branch to merge into.`;
  } else if (id === "dev-to-uat") {
    if (!has(WORKING_BRANCH)) reason = `There is no ${WORKING_BRANCH} branch to merge from.`;
    else if (!has(QA_BRANCH)) reason = `There is no ${QA_BRANCH} branch to merge into.`;
  }

  return { id, label, available: reason === null, reason };
}

/** The first preset that can be used, or `custom` when none of the others can. */
export function defaultPresetId(context: PresetContext): PullRequestPresetId {
  return (
    PULL_REQUEST_PRESET_IDS.find((id) => presetFor(id, context).available) ??
    "custom"
  );
}

/**
 * The viewer's own branches, in list order.
 *
 * Pipeline branches are never "own". A branch counts when it is named
 * `feature/<login>-...` (case-insensitive). For a `member` the backend already
 * narrows the list to dev, uat and their own branches (authored ones included),
 * so any other branch in it is theirs; for every other role only the naming
 * convention is trusted, because their list is not scoped to them.
 */
export function ownBranches(context: PresetContext): string[] {
  const login = context.login?.trim().toLowerCase() ?? "";
  const serverScoped = context.role === "member";
  return context.branches.filter((name) => {
    if (isPipelineBranch(name)) return false;
    if (serverScoped) return true;
    return login !== "" && name.toLowerCase().startsWith(`feature/${login}-`);
  });
}

/**
 * The most recent own branch. The branch list carries no timestamps, so this
 * is the last own branch in the order the backend returned them.
 */
export function mostRecentOwnBranch(context: PresetContext): string {
  return ownBranches(context).at(-1) ?? "";
}

/**
 * The base and head a preset selects. `custom` returns null: it leaves the two
 * pickers as they are. An unavailable preset also returns null.
 */
export function applyPreset(
  id: PullRequestPresetId,
  context: PresetContext,
): { base: string; head: string } | null {
  if (!presetFor(id, context).available) return null;
  if (id === "feature-to-dev") {
    return { base: WORKING_BRANCH, head: mostRecentOwnBranch(context) };
  }
  if (id === "dev-to-uat") return { base: QA_BRANCH, head: WORKING_BRANCH };
  return null;
}
