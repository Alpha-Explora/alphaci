/* The team's QA overview, read whole. Pure: no React, no fetch, no Next.
 *
 * GET /workspaces/:workspaceId/qa-requirements/overview lists every Project of
 * the team with its requirements' Progress and the Verification of its newest
 * Project run. Any team member may read it; it is behind the qaChecklists
 * capability and reads only the database.
 *
 * A newer backend adds `latestRun`, `counts`, `promotion` and
 * `viewerMembership` to each Project. An older one sends none of them, so the
 * normaliser (team-qa-overview-rules.ts) reads each as "not known" (null)
 * rather than as zero, and `supports` says which ones the server sent at all. */

import type { QaRunStatus, QaVerdict } from "./qa-run-types";
import type { ProgressCounts, RequirementKind } from "./requirement-types";

/** Verification of a requirement's items on the Project's newest run. Key names match the wire. */
export interface TeamQaVerificationCounts {
  pending: number;
  passed: number;
  failed: number;
  blocked: number;
  returned_to_dev: number;
}

export interface TeamQaRequirementSummary {
  id: string;
  kind: RequirementKind;
  name: string;
  itemCount: number;
  progressCounts: ProgressCounts;
  /** From the Project's newest run; null when the Project has none. */
  verification: TeamQaVerificationCounts | null;
  latestRunStatus: QaRunStatus | null;
  archivedAt: string | null;
}

/** The Project's newest Project run. */
export interface TeamQaLatestRun {
  id: string;
  status: QaRunStatus;
  createdAt: string | null;
  verdict: QaVerdict | null;
  signedOffAt: string | null;
  /** Who signed it off, as the server names them. */
  signedOffBy: string | null;
}

export interface TeamQaDefectCounts {
  blocker: number;
  major: number;
  minor: number;
  unrated: number;
}

/** Each part is null when the server did not send it (an older backend). */
export interface TeamQaProjectCounts {
  /** Items whose Progress is done and whose Verification is still pending. */
  readyForQa: number | null;
  openDefects: TeamQaDefectCounts | null;
  /** Active Project members by role. */
  members: { developer: number; qa: number } | null;
}

/** How far the uat to main promotion got, over the Project's repositories. */
export interface TeamQaPromotion {
  mergedRepositories: number;
  totalRepositories: number;
  lastMergedAt: string | null;
}

/** The Project's current iteration (Iterations phase 2). */
export interface TeamQaIteration {
  number: number;
  status: "active" | "delivered";
  deliveredAt: string | null;
}

/** The caller's own Project membership. */
export type TeamQaMembership = "developer" | "qa";

export interface TeamQaProject {
  deliveryProject: { id: string; name: string };
  requirements: TeamQaRequirementSummary[];
  latestRun: TeamQaLatestRun | null;
  counts: TeamQaProjectCounts;
  promotion: TeamQaPromotion | null;
  viewerMembership: TeamQaMembership | null;
  /** Null when the server did not send it (an older backend). */
  iteration: TeamQaIteration | null;
}

/** Which of the newer per-Project fields the server sent, on any Project. */
export interface TeamQaOverviewSupport {
  latestRun: boolean;
  counts: boolean;
  promotion: boolean;
  viewerMembership: boolean;
}

export interface TeamQaOverview {
  projects: TeamQaProject[];
  supports: TeamQaOverviewSupport;
}
