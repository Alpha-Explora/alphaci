/**
 * What GitHub's `mergeable_state` means for the person deciding, in words.
 *
 * Pure so every state is testable. The old inline version fell through to
 * "GitHub reports this as 'unstable'" for the most common state of a pull
 * request with a red check, and told every author that a second reviewer was
 * needed even on a branch that requires no review at all — which read as
 * "you cannot merge this" when they could.
 */

import type { AppRole } from "@/shared/api/contracts";
import { PRODUCTION_BRANCH } from "@/shared/api/pipeline-branches";

import {
  isPullRequestRole,
  isPullRequestRouteAllowed,
} from "./pull-request-compose-rules";

export type MergeTone = "ok" | "caution" | "blocked" | "pending";

export interface MergeExplanation {
  tone: MergeTone;
  message: string;
}

export function explainMergeState(
  mergeableState: string,
  viewerIsAuthor: boolean,
): MergeExplanation {
  switch (mergeableState) {
    case "clean":
      return { tone: "ok", message: "Ready to merge." };
    case "unstable":
      // Mergeable, with checks that failed or are still running. Nothing on
      // the base branch requires them, or the state would be `blocked`.
      return {
        tone: "caution",
        message:
          "Some checks failed or are still running. The base branch does not require them, so this can still be merged — look at them first.",
      };
    case "has_hooks":
      return { tone: "ok", message: "Ready to merge; GitHub will run the repository's merge hooks." };
    case "behind":
      return {
        tone: "blocked",
        message:
          "The base branch has moved on, and this repository requires branches to be up to date before merging. Update the branch first.",
      };
    case "dirty":
      return {
        tone: "blocked",
        message:
          "The branch conflicts with its base and has to be updated before it can merge.",
      };
    case "draft":
      return {
        tone: "blocked",
        message: "This is a draft. Mark it ready for review before merging.",
      };
    case "blocked":
      return {
        tone: "blocked",
        message: viewerIsAuthor
          ? "A branch protection rule is not satisfied yet, usually a required review — and GitHub does not let you approve your own pull request, so a teammate has to."
          : "A branch protection rule on the base branch is not satisfied yet, usually a required review or check.",
      };
    case "unknown":
      return {
        tone: "pending",
        message:
          "GitHub is still working out whether this can merge. Reload in a moment.",
      };
    default:
      return { tone: "pending", message: `GitHub reports this as '${mergeableState}'.` };
  }
}

/** The merge button's label, in GitHub's own words for each method. */
export function mergeButtonLabel(method: "merge" | "squash" | "rebase"): string {
  if (method === "squash") return "Squash and merge";
  if (method === "rebase") return "Rebase and merge";
  return "Merge";
}

/* ── Phase 1 security gates: who may merge here at all ──────────────────── */

/**
 * Why the generic workspace merge button is not offered, mirroring the
 * backend's two 403 codes for `POST .../pull-requests/:number/merge`
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1):
 *
 *   - `qa-role`             — QA never merges here (`PR_ROLE_FORBIDDEN`),
 *     regardless of the base branch. QA's sign-off happens in QA Studio.
 *   - `main-via-qa-studio`  — every role is refused when the base is `main`
 *     (`MAIN_MERGE_VIA_QA_STUDIO`): production release is a QA Studio
 *     "Ready for production" action, not a workspace merge, even for a Team
 *     Lead or Admin who is otherwise allowed to merge anything else.
 *   - `route-restricted`    — a Developer merges feature -> dev and dev -> uat
 *     only (`PR_ROUTE_RESTRICTED`); any other route is a Team Lead's call.
 */
export type WorkspaceMergeGate =
  | { allowed: true }
  | { allowed: false; reason: "qa-role" | "main-via-qa-studio" | "route-restricted" };

export function workspaceMergeGate(
  role: AppRole | null | undefined,
  base: string,
  head: string,
): WorkspaceMergeGate {
  if (!isPullRequestRole(role)) return { allowed: false, reason: "qa-role" };
  if (base === PRODUCTION_BRANCH) {
    return { allowed: false, reason: "main-via-qa-studio" };
  }
  if (!isPullRequestRouteAllowed(role, head, base)) {
    return { allowed: false, reason: "route-restricted" };
  }
  return { allowed: true };
}

/** Whether the workspace's own Merge control should be offered at all. */
export function canMergeViaWorkspace(
  role: AppRole | null | undefined,
  base: string,
  head: string,
): boolean {
  return workspaceMergeGate(role, base, head).allowed;
}
