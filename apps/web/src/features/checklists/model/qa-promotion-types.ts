/* Promotion types: "is uat ready to merge into main, and merge it". Pure: no
 * React, no fetch, no Next.
 *
 * The `…Wire` shapes are what the backend sends. They are never read
 * directly: `normalizePromotionStatus` / `normalizePromotionMerge` turn them
 * into the plain shapes below, tolerating absent or partial fields, so an
 * older or differently deployed backend degrades to "not ready" instead of
 * crashing the studio. The server alone decides eligibility and who may
 * merge; the client only explains it. */

import type { HeadStatus } from "./project-run-types";
import type { QaRunStatus, QaVerdict } from "./qa-run-types";

export interface QaPromotionChecklistWire {
  id?: unknown;
  name?: unknown;
  runId?: unknown;
  verdict?: unknown;
  runStatus?: unknown;
  approvedForHead?: unknown;
}

export interface QaPromotionPullRequestWire {
  number?: unknown;
  url?: unknown;
  headSha?: unknown;
}

export interface QaPromotionStatusWire {
  qaBranch?: unknown;
  targetBranch?: unknown;
  headSha?: unknown;
  checklists?: unknown;
  eligible?: unknown;
  reasons?: unknown;
  pullRequest?: unknown;
  canMerge?: unknown;
  /* Newer backends: the Project-level gate (design section 3.2). */
  scope?: unknown;
  deliveryProject?: unknown;
  run?: unknown;
  repositories?: unknown;
  requirementsChanged?: unknown;
}

export interface QaPromotionMergeWire {
  merged?: unknown;
  sha?: unknown;
  message?: unknown;
  pullRequest?: unknown;
}

/** One shared checklist, and where it stands on uat's current commit. */
export interface QaPromotionChecklist {
  id: string;
  name: string;
  /** The run on uat's current head, or null when nobody has started one. */
  runId: string | null;
  verdict: QaVerdict | null;
  runStatus: QaRunStatus | null;
  /** Signed off APPROVED on exactly the current head. Only `true` counts. */
  approvedForHead: boolean;
}

export interface QaPromotionPullRequest {
  number: number;
  /** Always an https URL: anything else is dropped by the normaliser. */
  url: string;
  headSha: string | null;
}

/**
 * `project`: the repository is filed under a Project and the Project's latest
 * signed-off run decides. `unfiled`: it is not, so it is blocked
 * (QA_PROJECT_REQUIRED). Null: an older backend still gating per checklist.
 */
export type QaPromotionScope = "project" | "unfiled";

/** The Project's latest signed-off QA run, as the gate weighs it. */
export interface QaPromotionRun {
  id: string;
  verdict: QaVerdict | null;
  signedAt: string | null;
  /** A repository moved or joined the Project since: it no longer counts. */
  stale: boolean;
}

export interface QaPromotionStatus {
  qaBranch: string;
  targetBranch: string;
  /** uat's current head. Null when the server could not resolve it. */
  headSha: string | null;
  checklists: QaPromotionChecklist[];
  /** Server-decided. Only an explicit `true` makes the project mergeable. */
  eligible: boolean;
  /** What blocks eligibility, in the server's words. */
  reasons: string[];
  /** The open uat → main promotion PR, when there is one. */
  pullRequest: QaPromotionPullRequest | null;
  /** Server-decided for this viewer. Absent means no. */
  canMerge: boolean;
  scope: QaPromotionScope | null;
  deliveryProject: { id: string; name: string } | null;
  run: QaPromotionRun | null;
  /** Every repository of the Project: its uat head now, against the run's. */
  repositories: HeadStatus[];
  /** Informational only: requirements were edited since the sign-off. */
  requirementsChanged: boolean;
}

export interface QaPromotionMergeResult {
  merged: boolean;
  /** The merge commit on main, when GitHub merged. */
  sha: string | null;
  /** GitHub's own words: its confirmation, or why it refused (shown verbatim). */
  message: string;
  pullRequest: { number: number; url: string } | null;
}

/** A merge that did not go through, as the card explains it. */
export type QaPromotionMergeErrorKind =
  | "blocked"
  | "moved"
  | "reauth"
  | "project_required"
  | "forbidden"
  | "not_found"
  | "failed";

export interface QaPromotionMergeError {
  kind: QaPromotionMergeErrorKind;
  message: string;
  /** For `blocked`: what the server says still blocks the merge. */
  reasons: string[];
  /** True when signing in again is the fix: show a sign-in link. */
  signIn: boolean;
}
