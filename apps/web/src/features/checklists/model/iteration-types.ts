/* Project Iterations: a Project's unit of delivery ("Iteration 3") and the
 * moment it reached main ("Delivered"). Pure: no React, no fetch, no Next.
 *
 * Every field here is optional on the wire. An older backend has no
 * iterations route (404) and sends no `iteration` on runs or on the promotion
 * status; the readers in iteration-rules.ts turn that into null, and every
 * screen then renders exactly as it did before iterations existed. */

export type IterationStatus = "active" | "delivered";

/** The slice of an Iteration that rides along on run payloads. */
export interface IterationRef {
  id: string;
  /** 1, 2, 3 … per Project. */
  number: number;
  status: IterationStatus;
}

export interface ProjectIteration extends IterationRef {
  goal: string | null;
  /** When the last covered repository reached main. Null while active. */
  deliveredAt: string | null;
  /** Whose merge delivered it, as a GitHub login. */
  deliveredByLogin: string | null;
}

/** One row of the Project's History (GET /delivery-projects/:id/iterations). */
export interface HistoryIteration extends ProjectIteration {
  startedAt: string | null;
  startedByLogin: string | null;
  /** The run QA signed off Approved and that was delivered; null while active. */
  signoffRunId: string | null;
}

/** How a repository's signed-off uat head reached main. */
export type DeliveryHow = "merged" | "already_in_main";

/** One repository's stored delivery state (the iteration's `delivery_json`). */
export interface DeliveredRepository {
  projectId: string;
  repoFullName: string;
  how: DeliveryHow;
  /** The merge commit on main; null when main already held the head. */
  mergeSha: string | null;
  prNumber: number | null;
}

/** A repository the signed-off run covers, and whether it is in main yet. */
export interface CoveredRepository {
  projectId: string;
  repoFullName: string;
  delivered: boolean;
  how: DeliveryHow | null;
}

/** GET /delivery-projects/:id/iterations/current, normalised. */
export interface CurrentIteration {
  /** The active iteration, or the last delivered one when none is active. */
  iteration: ProjectIteration;
  deliveredRepositories: DeliveredRepository[];
  /** Empty until the iteration has an Approved sign-off (or on an older backend). */
  coveredRepositories: CoveredRepository[];
  /** Server-decided: lead or admin, gate eligible, iteration active. */
  canMergeAll: boolean;
  /**
   * Server-decided: a lead or admin, and no iteration is active. Null when the
   * server did not say (an older backend): nothing about the next iteration renders.
   */
  canStartNext: boolean | null;
}

/* ── Starting the next iteration (Iterations phase 3) ─────────────────── */

/**
 * POST /delivery-projects/:id/iterations. The new iteration starts with an
 * empty checklist: nothing is carried over (ITERATIONS_PLAN.md 6a).
 */
export interface StartIterationInput {
  /** Trimmed; left out when empty. At most 120 characters. */
  goal?: string;
}

/** The 201 answer, normalised. */
export interface StartedIteration {
  iteration: ProjectIteration | null;
}

/**
 * What a screen shows about the next iteration, once the current one is
 * delivered: nothing, "waiting for the Product owner", or Start.
 */
export type IterationNextStep =
  | { kind: "none" }
  | { kind: "waiting"; text: string }
  | { kind: "start"; nextNumber: number; text: string };

/** One repository's answer from Merge all repositories. */
export interface MergeAllRepositoryResult {
  projectId: string;
  repoFullName: string;
  merged: boolean;
  /** Null when it did not reach main (the merge failed or GitHub refused it). */
  how: DeliveryHow | null;
  /** The server's or GitHub's own words, when it said any. */
  message: string | null;
}

/** POST /delivery-projects/:id/promotion/merge-all, normalised. */
export interface MergeAllResult {
  repositories: MergeAllRepositoryResult[];
  /** True when this call delivered the iteration. */
  delivered: boolean;
  iteration: ProjectIteration | null;
}

/** A Merge all repositories that was refused before anything merged. */
export type MergeAllErrorKind =
  | "delivered"
  | "blocked"
  | "no_repositories"
  | "forbidden"
  | "reauth"
  | "not_found"
  | "failed";

export interface MergeAllError {
  kind: MergeAllErrorKind;
  message: string;
  /** For `blocked`: what the gate says still blocks the merge. */
  reasons: string[];
  /** True when signing in again is the fix. */
  signIn: boolean;
}
