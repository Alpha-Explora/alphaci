/**
 * Visual checks: the Playwright screenshots a deployed uat/main site produced,
 * compared with the reference screenshots ("baselines") ALPHACI stores per
 * repository and branch.
 *
 * Mirrors the backend's `ProjectVisualResponse` (projects/application/visual)
 * exactly. Image URLs arrive as API paths WITHOUT the `/api/v1` prefix; the
 * view-model turns them into full URLs before a view sees them.
 *
 * Pure: no React, no fetch.
 */

/** The branches visual checks run on. `main` falls back to `uat`'s references. */
export type VisualBranch = "uat" | "main";

/** `passed` matched its reference; `changed` differs; `new` has no reference yet. */
export type VisualSnapshotStatus = "passed" | "changed" | "new";

export interface VisualSnapshot {
  /** The screenshot's file name, e.g. `home-desktop.png`. */
  name: string;
  status: VisualSnapshotStatus;
  baselineUrl: string | null;
  actualUrl: string | null;
  diffUrl: string | null;
  baselineApprovedBy: string | null;
  baselineApprovedAt: string | null;
  /** `uat` when a `main` snapshot is compared against uat's reference. */
  inheritedFrom: "uat" | null;
  /** True once the branch's reference already IS this run's screenshot. */
  approved: boolean;
}

export type VisualChecksResponse =
  | {
      branch: VisualBranch;
      runId: number;
      commitSha: string;
      reportedAt: string;
      browser: string;
      /** False for a role that cannot approve, and for a run that is not the branch's latest. */
      canApprove: boolean;
      snapshots: VisualSnapshot[];
    }
  | {
      branch: VisualBranch;
      /** Nothing has been reported for this branch yet. */
      runId: null;
      canApprove: boolean;
      snapshots: [];
    };

export interface VisualApproveInput {
  branch: VisualBranch;
  runId: number;
  names: string[];
}

export interface VisualApproveResponse {
  approved: string[];
}
