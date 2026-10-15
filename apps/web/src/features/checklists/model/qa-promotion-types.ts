/* Promotion types: "is uat ready to merge into main, and merge it". Pure: no
 * React, no fetch, no Next.
 *
 * The `…Wire` shapes are what the backend sends. They are never read
 * directly: `normalizePromotionStatus` / `normalizePromotionMerge` turn them
 * into the plain shapes below, tolerating absent or partial fields, so an
 * older or differently deployed backend degrades to "not ready" instead of
 * crashing the studio. The server alone decides eligibility and who may
 * merge; the client only explains it. */

import type { IterationRef } from "./iteration-types";
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
  /* Newer still: the stored delivery state of the Project's iteration. */
  repositoryDelivered?: unknown;
  iterationDelivered?: unknown;
  iteration?: unknown;
}

export interface QaPromotionMergeWire {
  merged?: unknown;
  sha?: unknown;
  message?: unknown;
  pullRequest?: unknown;
  /* Optional: `already_in_main` when main held the head and nothing was merged. */
  how?: unknown;
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
  /**
   * The server's stored answer: this repository's main already contains the
   * signed-off uat head. Null on an older backend, which keeps the card's
   * in-memory "just merged" flag instead.
   */
  repositoryDelivered: boolean | null;
  /** The Project's iteration is Delivered: nothing is merged again. Only an explicit `true`. */
  iterationDelivered: boolean;
  /** The Project's current iteration, when the server sent it. */
  iteration: QaPromotionIteration | null;
}

/** The iteration the promotion status speaks for. */
export interface QaPromotionIteration extends IterationRef {
  deliveredAt: string | null;
}

export interface QaPromotionMergeResult {
  merged: boolean;
  /** The merge commit on main, when GitHub merged. */
  sha: string | null;
  /** GitHub's own words: its confirmation, or why it refused (shown verbatim). */
  message: string;
  pullRequest: { number: number; url: string } | null;
  /**
   * Nothing was merged because main already contains the head: never an
   * error. True only when the server said `how: "already_in_main"`.
   */
  alreadyInMain: boolean;
}

/** A merge that did not go through, as the card explains it. */
export type QaPromotionMergeErrorKind =
  | "blocked"
  | "moved"
  | "reauth"
  | "project_required"
  | "delivered"
  | "no_repositories"
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
