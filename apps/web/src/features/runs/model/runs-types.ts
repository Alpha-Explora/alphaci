/* Domain types for the runs feature.
 *
 * The wire shapes still live in lib/api/contracts.ts, which every unmigrated
 * vertical shares. Re-exporting them here gives this feature one type surface
 * to import from, so when contracts.ts is finally decomposed per-domain only
 * this file changes — not every view in the slice. */
export type {
  FriendlyMessage,
  MessageSeverity,
  RunGroup,
  RunOverallStatus,
  RunsResponse,
  StageId,
  StageReport,
  StageStatus,
} from "@/shared/api/contracts";

import type { RunGroup, RunOverallStatus } from "@/shared/api/contracts";

/** Lifecycle of the runs list, as the view-model reports it. */
export type RunsStatus = "idle" | "loading" | "ready" | "error";

/** Runs for one repository, newest first, with its most recent run hoisted. */
export interface ProjectRunGroup {
  repoFullName: string;
  runs: RunGroup[];
  latestRun: RunGroup;
}

/**
 * Runs for one branch, newest first, with its most recent run hoisted.
 *
 * The branch is the unit a person reads a pipeline by: what is on dev, what
 * reached uat, what shipped. A flat list interleaves all three.
 */
export interface BranchRunGroup {
  branch: string;
  runs: RunGroup[];
  latestRun: RunGroup;
}

/** Headline counts for the summary strip. */
export interface RunsSummary {
  total: number;
  counts: Record<RunOverallStatus, number>;
  latestRun: RunGroup | null;
  /** Failed, partial or cancelled — the ones a user has to act on. */
  needsAttention: number;
}
