/* Domain types for the home dashboard.
 *
 * Wire shapes still live in lib/api, shared with the unmigrated verticals;
 * re-exporting through this file gives the slice one type surface, so when those
 * contracts are decomposed per-domain only this file changes. */
export type {
  ProvisionedProject,
  RunGroup,
  RunOverallStatus,
  StageId,
  StageStatus,
  WorkflowHistoryItem,
} from "@/shared/api/contracts";
export type {
  DeliveryProject,
  GroupActivityItem,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
  MyAssignedRepository,
} from "@/features/groups";

import type { RunGroup, RunOverallStatus, StageId } from "@/shared/api/contracts";
import type {
  DeliveryProject,
  HierarchyRepository,
  HierarchySystem,
} from "@/features/groups";

/** Lifecycle of one independently-loaded dashboard section. */
export type SectionStatus = "loading" | "ready" | "error";

/** A system with its delivery projects, each with its repositories. */
export interface DeliveryPortfolioNode {
  system: HierarchySystem;
  deliveryProjects: Array<
    DeliveryProject & { repositories: HierarchyRepository[] }
  >;
}

/** Status-badge tone for a provisioned project. */
export type ProjectTone = "ok" | "warn" | "danger" | "muted";

/** Colour of a connector segment between two pipeline stages. */
export type ConnectorTone = "success" | "danger" | "flowing" | "pending";

/** Run analytics derived client-side from the recent-runs window. */
export interface RunStats {
  /** Most-recent-first window used for rate and breakdown (up to 10). */
  sample: RunGroup[];
  /** Whole-number success percentage over finished runs, or null when none. */
  successRate: number | null;
  finishedCount: number;
  successes: number;
  failures: number;
  running: number;
  /** Stage that failed most across the sample, or null when no failures. */
  worstStage: { stage: StageId; count: number } | null;
  /** Consecutive failures counted from the most recent run. */
  failureStreak: number;
  /** Overall statuses, most-recent-first, for the sparkline. */
  outcomes: RunOverallStatus[];
}
